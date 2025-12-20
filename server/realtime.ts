import 'dotenv/config';
import { Server } from 'socket.io';
import { promises as fs } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { generateLLMResponse, isLLMEnabled } from './llm.js';
import { initializeGoogleSheets, exportMessageToGoogleSheets, exportSessionSummaryToGoogleSheets, isGoogleSheetsEnabled } from './google-sheets.js';
import { exportMessageToExcel, exportSessionSummaryToExcel } from './excel-export.js';

type PartnerType = 'human' | 'llm';
type SessionStatus = 'active' | 'inactive';
type MessageSender = 'participant' | 'moderator';

interface ChatMessage {
  id: string;
  content: string;
  sender: MessageSender;
  timestamp: Date;
}

interface ChatSession {
  participantId: string;
  status: SessionStatus;
  lastActivity: Date;
  partnerType?: PartnerType;
  messages: ChatMessage[];
  moderatorId?: string;
}

const chatSessions = new Map<string, ChatSession>();
const sessionStats = { human: 0, llm: 0 };
const connectedUsers = new Map<string, { socketId: string; userType: MessageSender; sessionId?: string; lastActive: Date }>();
const llmSessionExportIntervals = new Map<string, NodeJS.Timeout>();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const exportsDir = resolve(__dirname, '../exports');

const ensureExportsDirExists = async () => {
  try {
    await fs.mkdir(exportsDir, { recursive: true });
  } catch (err) {
    console.error('Error creating exports directory:', err);
  }
};

const exportSessionData = async (sessionId: string, session: ChatSession) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `session_${sessionId}_${timestamp}.json`;
    const filepath = resolve(exportsDir, filename);

    const exportData = {
      sessionId,
      exportedAt: new Date().toISOString(),
      partnerType: session.partnerType,
      status: session.status,
      lastActivity: session.lastActivity,
      messageCount: session.messages.length,
      messages: session.messages.map((msg) => ({
        id: msg.id,
        content: msg.content,
        sender: msg.sender,
        timestamp: msg.timestamp
      }))
    };

    await fs.writeFile(filepath, JSON.stringify(exportData, null, 2), 'utf-8');
    console.log(`[EXPORT] Session data exported: ${filename}`);
    return filename;
  } catch (err) {
    console.error('Error exporting session data:', err);
    return null;
  }
};

const startLLMSessionAutoExport = (sessionId: string, session: ChatSession) => {
  if (llmSessionExportIntervals.has(sessionId)) {
    clearInterval(llmSessionExportIntervals.get(sessionId)!);
  }

  const intervalId = setInterval(async () => {
    try {
      const exportedFile = await exportSessionData(sessionId, session);
      if (exportedFile) {
        console.log(`[AUTO-EXPORT] LLM session ${sessionId} auto-exported: ${exportedFile}`);
      }
    } catch (err) {
      console.error(`[AUTO-EXPORT] Error auto-exporting LLM session ${sessionId}:`, err);
    }
  }, 30000);

  llmSessionExportIntervals.set(sessionId, intervalId);
};

const stopLLMSessionAutoExport = (sessionId: string) => {
  if (llmSessionExportIntervals.has(sessionId)) {
    clearInterval(llmSessionExportIntervals.get(sessionId)!);
    llmSessionExportIntervals.delete(sessionId);
  }
};

let initialized = false;

export const initRealtime = (io: Server) => {
  if (initialized) return io;
  initialized = true;

  // One-time setup
  void ensureExportsDirExists();
  initializeGoogleSheets();

  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    console.error('Server will continue running...');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    console.error('Server will continue running...');
  });

  // On SIGTERM/SIGINT export and try to close Socket.IO gracefully
  const gracefulShutdown = async () => {
    console.log('\n📛 Shutdown signal received. Starting graceful shutdown...');

    llmSessionExportIntervals.forEach((interval) => clearInterval(interval));
    llmSessionExportIntervals.clear();

    const exportPromises = Array.from(chatSessions.entries()).map(([sessionId, session]) =>
      exportSessionData(sessionId, session)
    );
    await Promise.allSettled(exportPromises);

    io.close(() => {
      console.log('Socket.IO server closed');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  io.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id);
    console.log('SERVER VERSION: IN-MEMORY-STORAGE-V1-STABLE');

    socket.timeout(300000);

    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });

    socket.on('recover', () => {
      console.log(`🔄 Socket ${socket.id} recovered connection`);
      const user = connectedUsers.get(socket.id);
      if (user && user.sessionId) {
        const session = chatSessions.get(user.sessionId);
        if (session && session.status === 'inactive') {
          session.status = 'active';
          session.lastActivity = new Date();
          broadcastActiveSessions();
          console.log(`Session ${user.sessionId} reactivated after connection recovery`);
        }
      }
    });

    const broadcastActiveSessions = () => {
      try {
        const activeSessions = Array.from(chatSessions.values())
          .map((session) => ({
            sessionId: session.participantId,
            participantId: session.participantId,
            hasModeratorAssigned: !!session.moderatorId,
            messageCount: session.messages.length,
            status: session.status,
            partnerType: session.partnerType || 'human'
          }))
          .sort((a, b) => {
            const sessionA = chatSessions.get(a.participantId);
            const sessionB = chatSessions.get(b.participantId);
            if (!sessionA || !sessionB) return 0;
            return sessionB.lastActivity.getTime() - sessionA.lastActivity.getTime();
          });
        io.emit('active-sessions', activeSessions);
      } catch (err) {
        console.error('Error broadcasting active sessions:', err);
      }
    };

    socket.on('join-session', (data: { userType: 'participant' | 'moderator'; sessionId?: string; participantId?: string }) => {
      const { userType, sessionId, participantId } = data;

      if (userType === 'participant') {
        const targetSessionId = participantId || `session_${Date.now()}`;

        try {
          let session = chatSessions.get(targetSessionId);

          if (!session) {
            const randomValue = Math.random();
            const assignedPartnerType: PartnerType = randomValue < 0.5 ? 'human' : 'llm';
            session = {
              participantId: targetSessionId,
              status: 'active',
              lastActivity: new Date(),
              partnerType: assignedPartnerType,
              messages: []
            };
            chatSessions.set(targetSessionId, session);

            sessionStats[assignedPartnerType]++;
            const total = sessionStats.human + sessionStats.llm;
            const humanPercent = ((sessionStats.human / total) * 100).toFixed(1);
            const llmPercent = ((sessionStats.llm / total) * 100).toFixed(1);
            console.log(`[STATS] New session: ${assignedPartnerType.toUpperCase()} | Distribution: Human ${humanPercent}% | LLM ${llmPercent}%`);

            if (assignedPartnerType === 'llm') {
              startLLMSessionAutoExport(targetSessionId, session);
            }

            socket.broadcast.emit('participant-joined', { sessionId: targetSessionId, participantId: targetSessionId });
            console.log(`New participant ${targetSessionId} created session - notifying moderators`);
          } else {
            const wasInactive = session.status === 'inactive';
            session.status = 'active';
            session.lastActivity = new Date();
            if (!session.partnerType) {
              session.partnerType = Math.random() < 0.5 ? 'llm' : 'human';
            }

            if (wasInactive) {
              socket.broadcast.emit('participant-rejoined', { sessionId: targetSessionId, participantId: targetSessionId });
              console.log(`Participant ${targetSessionId} rejoined inactive session - notifying moderators`);
            }
            console.log(`Participant ${targetSessionId} rejoined existing session`);
          }

          broadcastActiveSessions();

          connectedUsers.set(socket.id, { socketId: socket.id, userType: 'participant', sessionId: targetSessionId, lastActive: new Date() });

          socket.join(targetSessionId);
          socket.emit('session-joined', { sessionId: targetSessionId, userType: 'participant', partnerType: session?.partnerType });

          socket.emit('chat-history', chatSessions.get(targetSessionId)?.messages || []);
        } catch (err) {
          console.error('Error in join-session (participant):', err);
        }
      } else if (userType === 'moderator' && sessionId) {
        try {
          const session = chatSessions.get(sessionId);
          if (session && session.partnerType === 'human') {
            session.moderatorId = socket.id;

            connectedUsers.set(socket.id, { socketId: socket.id, userType: 'moderator', sessionId, lastActive: new Date() });

            socket.join(sessionId);
            socket.emit('session-joined', { sessionId, userType: 'moderator', session, partnerType: session.partnerType });

            socket.emit('chat-history', session.messages);
          } else if (session && session.partnerType === 'llm') {
            socket.emit('join-error', { sessionId, error: 'Session managed by LLM moderator' });
          }
        } catch (err) {
          console.error('Error in join-session (moderator):', err);
        }
      }
    });

    socket.on('send-message', async (data: { sessionId: string; content: string; sender: MessageSender }) => {
      const { sessionId, content, sender } = data;
      console.log(`Server: Received send-message for session ${sessionId} from ${sender}`);

      try {
        const session = chatSessions.get(sessionId);

        if (session) {
          const user = connectedUsers.get(socket.id);
          if (user) {
            user.lastActive = new Date();
          }
          session.lastActivity = new Date();
          session.status = 'active';

          const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${session.messages.length}`;
          const message: ChatMessage = {
            id: messageId,
            content,
            sender,
            timestamp: new Date()
          };

          session.messages.push(message);
          console.log(`Server: Message saved to memory. Message count: ${session.messages.length}`);

          await exportMessageToExcel(message, sessionId, session.partnerType);
          if (isGoogleSheetsEnabled()) {
            await exportMessageToGoogleSheets(message, sessionId, session.partnerType);
          }

          io.to(sessionId).emit('new-message', message);
          console.log(`Message sent in session ${sessionId}:`, message);

          if (sender === 'participant' && session.partnerType === 'llm' && isLLMEnabled()) {
            io.to(sessionId).emit('user-typing', { userType: 'moderator', isTyping: true });

            setTimeout(async () => {
              try {
                const sessionData = {
                  participantId: session.participantId,
                  status: session.status,
                  lastActivity: session.lastActivity,
                  partnerType: session.partnerType,
                  messages: session.messages
                };

                console.log(`[LLM] Generating response for session ${sessionId}...`);
                const llmResponse = await generateLLMResponse(sessionData as any);

                if (!llmResponse) {
                  console.warn(`[LLM] No response generated for session ${sessionId}`);
                  io.to(sessionId).emit('user-typing', { userType: 'moderator', isTyping: false });
                  return;
                }

                const llmMessage: ChatMessage = {
                  id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${session.messages.length}`,
                  content: llmResponse,
                  sender: 'moderator',
                  timestamp: new Date()
                };

                console.log(`[LLM] Response generated for session ${sessionId}`);

                session.messages.push(llmMessage);
                session.lastActivity = new Date();
                io.to(sessionId).emit('new-message', llmMessage);

                exportMessageToExcel(llmMessage, sessionId, session.partnerType).catch((err) => console.error('[EXPORT] Excel export failed:', err));

                if (isGoogleSheetsEnabled()) {
                  exportMessageToGoogleSheets(llmMessage, sessionId, session.partnerType).catch((err) => console.error('[EXPORT] Google Sheets export failed:', err));
                }
              } catch (error) {
                console.error('[LLM] Response generation error:', error);
                const fallbackMessage: ChatMessage = {
                  id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${session.messages.length}`,
                  content: "I apologize, I'm having trouble responding right now. Could you please repeat that?",
                  sender: 'moderator',
                  timestamp: new Date()
                };
                session.messages.push(fallbackMessage);
                io.to(sessionId).emit('new-message', fallbackMessage);
              } finally {
                io.to(sessionId).emit('user-typing', { userType: 'moderator', isTyping: false });
              }
            }, 100);
          }
        } else {
          console.error(`Server: Session NOT found for ${sessionId} during send-message`);
        }
      } catch (err) {
        console.error('Error sending message:', err);
      }
    });

    socket.on('typing-start', (data: { sessionId: string; userType: 'participant' | 'moderator' }) => {
      const user = connectedUsers.get(socket.id);
      if (user) {
        user.lastActive = new Date();
      }

      socket.to(data.sessionId).emit('user-typing', { userType: data.userType, isTyping: true });
    });

    socket.on('typing-stop', (data: { sessionId: string; userType: 'participant' | 'moderator' }) => {
      socket.to(data.sessionId).emit('user-typing', { userType: data.userType, isTyping: false });
    });

    socket.on('get-active-sessions', () => {
      broadcastActiveSessions();
    });

    socket.on('leave-session', (data: { sessionId: string }) => {
      const { sessionId } = data;
      const user = connectedUsers.get(socket.id);

      if (user && user.sessionId === sessionId) {
        socket.leave(sessionId);

        try {
          if (user.userType === 'participant') {
            const session = chatSessions.get(sessionId);
            if (session) {
              session.status = 'inactive';
              session.lastActivity = new Date();
              socket.to(sessionId).emit('participant-left');
              console.log(`Participant left session ${sessionId} via leave-session`);
            }
          } else if (user.userType === 'moderator') {
            const session = chatSessions.get(sessionId);
            if (session) {
              session.moderatorId = undefined;
              socket.to(sessionId).emit('moderator-left');
            }
          }
        } catch (err) {
          console.error('Error in leave-session:', err);
        }

        connectedUsers.delete(socket.id);
        console.log(`User ${user.userType} left session ${sessionId}`);
      }
    });

    socket.on('clear-inactive-sessions', () => {
      try {
        const inactiveSessions = Array.from(chatSessions.entries())
          .filter(([, session]) => session.status === 'inactive')
          .map(([key]) => key);

        inactiveSessions.forEach((key) => chatSessions.delete(key));
        broadcastActiveSessions();
      } catch (err) {
        console.error('Error clearing inactive sessions:', err);
      }
    });

    socket.on('delete-session', (data: { sessionId: string }) => {
      const { sessionId } = data;
      console.log(`Server: Received delete-session request for ${sessionId}`);

      try {
        const session = chatSessions.get(sessionId);

        if (session) {
          stopLLMSessionAutoExport(sessionId);

          chatSessions.delete(sessionId);
          console.log(`Server: Session ${sessionId} deleted by moderator successfully`);

          broadcastActiveSessions();
          socket.emit('session-deleted', { sessionId });
        } else {
          const error = 'Session not found';
          console.log(`Server: Delete failed for ${sessionId}: ${error}`);
          socket.emit('delete-error', { sessionId, error });
        }
      } catch (err) {
        console.error('Error deleting session:', err);
        socket.emit('delete-error', { sessionId, error: 'Operation failed' });
      }
    });

    socket.on('end-session', async (data: { sessionId: string }) => {
      const { sessionId } = data;
      console.log(`Server: Received end-session request for ${sessionId}`);

      try {
        const session = chatSessions.get(sessionId);
        console.log(`Server: Processing end-session for ${sessionId}. FORCE SETTING TO INACTIVE.`);

        if (session) {
          stopLLMSessionAutoExport(sessionId);

          session.status = 'inactive';
          session.lastActivity = new Date();

          const exportedFile = await exportSessionData(sessionId, session);
          if (exportedFile) {
            socket.emit('session-exported', { sessionId, filename: exportedFile });
          }

          await exportSessionSummaryToExcel(sessionId, session);
          if (isGoogleSheetsEnabled()) {
            await exportSessionSummaryToGoogleSheets(sessionId, session);
          }
          console.log(`[EXPORT] Session summary exported to Excel and Google Sheets for ${sessionId}`);

          io.to(sessionId).emit('session-ended');
          console.log(`Server: Session ${sessionId} ended by moderator. Emitted session-ended to room ${sessionId}`);

          broadcastActiveSessions();
        } else {
          console.log(`Server: Session ${sessionId} not found`);
        }
      } catch (err) {
        console.error('Error ending session:', err);
      }
    });

    socket.on('disconnect', () => {
      const user = connectedUsers.get(socket.id);
      console.log(`User disconnected: ${socket.id}`, user ? `(${user.userType} in session ${user.sessionId})` : '(unknown user)');

      if (user && user.sessionId) {
        try {
          const session = chatSessions.get(user.sessionId);
          if (session) {
            if (user.userType === 'moderator') {
              session.moderatorId = undefined;
              socket.to(user.sessionId).emit('moderator-left');
              console.log(`Moderator left session ${user.sessionId}`);
            } else if (user.userType === 'participant') {
              session.status = 'inactive';
              session.lastActivity = new Date();
              stopLLMSessionAutoExport(user.sessionId);
              socket.to(user.sessionId).emit('participant-left');
              console.log(`Participant left session ${user.sessionId} - marked as inactive`);
            }

            socket.to(user.sessionId).emit('user-disconnected', { userType: user.userType });
          }
        } catch (err) {
          console.error('Error in disconnect handler:', err);
        }
      }

      connectedUsers.delete(socket.id);
    });
  });

  return io;
};
