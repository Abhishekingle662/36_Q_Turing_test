import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { promises as fs } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { generateLLMResponse, isLLMEnabled } from './llm.js';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3005", "http://localhost:3000"],
    methods: ["GET", "POST"]
  }
});

// In-memory storage for sessions and users
const chatSessions = new Map<string, {
  participantId: string;
  status: 'active' | 'inactive';
  lastActivity: Date;
  partnerType?: 'human' | 'llm';
  messages: Array<{
    id: string;
    content: string;
    sender: 'participant' | 'moderator';
    timestamp: Date;
  }>;
  moderatorId?: string;
}>();

// Partner type distribution tracking
const sessionStats = { human: 0, llm: 0 };

// Setup exports directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const exportsDir = resolve(__dirname, '../exports');

// Ensure exports directory exists
const ensureExportsDirExists = async () => {
  try {
    await fs.mkdir(exportsDir, { recursive: true });
  } catch (err) {
    console.error('Error creating exports directory:', err);
  }
};

// Export session data to JSON file
const exportSessionData = async (sessionId: string, session: any) => {
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
      messages: session.messages.map((msg: any) => ({
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

// Initialize exports directory
await ensureExportsDirExists();

// Store connected users in memory (ephemeral)
const connectedUsers = new Map<string, { socketId: string; userType: 'participant' | 'moderator'; sessionId?: string; lastActive: Date }>();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  console.log('SERVER VERSION: IN-MEMORY-STORAGE-V1');

  // Helper to broadcast active sessions
  const broadcastActiveSessions = () => {
    try {
      const activeSessions = Array.from(chatSessions.values()).map(session => ({
        sessionId: session.participantId,
        participantId: session.participantId,
        hasModeratorAssigned: !!session.moderatorId,
        messageCount: session.messages.length,
        status: session.status,
        partnerType: session.partnerType || 'human'
      })).sort((a, b) => {
        const sessionA = chatSessions.get(a.participantId);
        const sessionB = chatSessions.get(b.participantId);
        if (!sessionA || !sessionB) return 0;
        return sessionB.lastActivity.getTime() - sessionA.lastActivity.getTime();
      });
      io.emit('active-sessions', activeSessions);
    } catch (err) {
      console.error("Error broadcasting active sessions:", err);
    }
  };

  // Handle user joining as participant or moderator
  socket.on('join-session', (data: { userType: 'participant' | 'moderator'; sessionId?: string; participantId?: string }) => {
    const { userType, sessionId, participantId } = data;

    if (userType === 'participant') {
      // Check if participant already has an existing session
      const targetSessionId = participantId || `session_${Date.now()}`;

      try {
        let session = chatSessions.get(targetSessionId);

        if (!session) {
          // Create new session only if it doesn't exist
          // Assign partner type: 50% human, 50% llm (Math.random() returns 0.0 to 0.999...)
          const randomValue = Math.random();
          const assignedPartnerType = randomValue < 0.5 ? 'human' : 'llm';
          session = {
            participantId: targetSessionId,
            status: 'active',
            lastActivity: new Date(),
            partnerType: assignedPartnerType,
            messages: []
          };
          chatSessions.set(targetSessionId, session);

          // Track distribution
          sessionStats[assignedPartnerType]++;
          const total = sessionStats.human + sessionStats.llm;
          const humanPercent = ((sessionStats.human / total) * 100).toFixed(1);
          const llmPercent = ((sessionStats.llm / total) * 100).toFixed(1);
          console.log(`[STATS] New session: ${assignedPartnerType.toUpperCase()} | Distribution: Human ${humanPercent}% | LLM ${llmPercent}%`);

          // Notify moderators about new participant
          socket.broadcast.emit('participant-joined', { sessionId: targetSessionId, participantId: targetSessionId });
          console.log(`New participant ${targetSessionId} created session - notifying moderators`);
        } else {
          // Reactivate existing session
          const wasInactive = session.status === 'inactive';
          session.status = 'active';
          session.lastActivity = new Date();
          if (!session.partnerType) {
            session.partnerType = Math.random() < 0.5 ? 'llm' : 'human';
          }

          // If the session was inactive and is now active, notify moderators
          if (wasInactive) {
            socket.broadcast.emit('participant-rejoined', { sessionId: targetSessionId, participantId: targetSessionId });
            console.log(`Participant ${targetSessionId} rejoined inactive session - notifying moderators`);
          }
          console.log(`Participant ${targetSessionId} rejoined existing session`);
        }

        broadcastActiveSessions();

        connectedUsers.set(socket.id, { socketId: socket.id, userType: 'participant', sessionId: targetSessionId, lastActive: new Date() });

        socket.join(targetSessionId);
        socket.emit('session-joined', { sessionId: targetSessionId, userType: 'participant', partnerType: session.partnerType });

        // Send existing chat history to participant
        socket.emit('chat-history', session.messages);
      } catch (err) {
        console.error("Error in join-session (participant):", err);
      }

    } else if (userType === 'moderator' && sessionId) {
      // Moderator joining existing session
      try {
        const session = chatSessions.get(sessionId);
        if (session && session.partnerType === 'human') {
          session.moderatorId = socket.id;

          connectedUsers.set(socket.id, { socketId: socket.id, userType: 'moderator', sessionId, lastActive: new Date() });

          socket.join(sessionId);
          socket.emit('session-joined', { sessionId, userType: 'moderator', session, partnerType: session.partnerType });

          // Send chat history to moderator
          socket.emit('chat-history', session.messages);
        } else if (session && session.partnerType === 'llm') {
          socket.emit('join-error', { sessionId, error: 'Session managed by LLM moderator' });
        }
      } catch (err) {
        console.error("Error in join-session (moderator):", err);
      }
    }
  });

  // Handle sending messages
  socket.on('send-message', (data: { sessionId: string; content: string; sender: 'participant' | 'moderator' }) => {
    const { sessionId, content, sender } = data;
    console.log(`Server: Received send-message for session ${sessionId} from ${sender}`);

    try {
      const session = chatSessions.get(sessionId);

      if (session) {
        console.log(`Server: Session found for ${sessionId}, adding message`);
        // Update user and session activity
        const user = connectedUsers.get(socket.id);
        if (user) {
          user.lastActive = new Date();
        }
        session.lastActivity = new Date();
        session.status = 'active';

        // Generate unique message ID using timestamp, random string, and session message count
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${session.messages.length}`;
        const message = {
          id: messageId,
          content,
          sender,
          timestamp: new Date()
        };

        session.messages.push(message);
        console.log(`Server: Message saved to memory. Message count: ${session.messages.length}`);

        // Broadcast message to all users in the session
        io.to(sessionId).emit('new-message', message);

        console.log(`Message sent in session ${sessionId}:`, message);

        // If this is an LLM session and the participant sent a message, generate LLM response
        if (sender === 'participant' && session.partnerType === 'llm' && isLLMEnabled()) {
          io.to(sessionId).emit('user-typing', { userType: 'moderator', isTyping: true });

          (async () => {
            try {
              // Convert session to format expected by LLM (ISession interface)
              const sessionData = {
                participantId: session.participantId,
                status: session.status,
                lastActivity: session.lastActivity,
                partnerType: session.partnerType,
                messages: session.messages
              };
              
              const llmResponse = await generateLLMResponse(sessionData as any);
              if (!llmResponse) return;

              const llmMessage = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${session.messages.length}`,
                content: llmResponse,
                sender: 'moderator' as const,
                timestamp: new Date()
              };

              session.messages.push(llmMessage);
              session.lastActivity = new Date();
              io.to(sessionId).emit('new-message', llmMessage);
            } catch (error) {
              console.error('LLM response error:', error);
            } finally {
              io.to(sessionId).emit('user-typing', { userType: 'moderator', isTyping: false });
            }
          })();
        }
      } else {
        console.error(`Server: Session NOT found for ${sessionId} during send-message`);
      }
    } catch (err) {
      console.error("Error sending message:", err);
    }
  });

  // Handle typing indicators
  socket.on('typing-start', (data: { sessionId: string; userType: 'participant' | 'moderator' }) => {
    // Update user activity
    const user = connectedUsers.get(socket.id);
    if (user) {
      user.lastActive = new Date();
    }

    socket.to(data.sessionId).emit('user-typing', { userType: data.userType, isTyping: true });
  });

  socket.on('typing-stop', (data: { sessionId: string; userType: 'participant' | 'moderator' }) => {
    socket.to(data.sessionId).emit('user-typing', { userType: data.userType, isTyping: false });
  });

  // Handle getting active sessions (for moderator dashboard)
  socket.on('get-active-sessions', () => {
    broadcastActiveSessions();
  });

  // Handle leaving a session
  socket.on('leave-session', (data: { sessionId: string }) => {
    const { sessionId } = data;
    const user = connectedUsers.get(socket.id);

    if (user && user.sessionId === sessionId) {
      socket.leave(sessionId);

      try {
        // If participant is leaving, mark session as inactive
        if (user.userType === 'participant') {
          const session = chatSessions.get(sessionId);
          if (session) {
            session.status = 'inactive';
            session.lastActivity = new Date();

            // Notify moderator that participant left
            socket.to(sessionId).emit('participant-left');
            console.log(`Participant left session ${sessionId} via leave-session`);
          }
        } else if (user.userType === 'moderator') {
          // If moderator is leaving, just remove moderator assignment
          const session = chatSessions.get(sessionId);
          if (session) {
            session.moderatorId = undefined;
            socket.to(sessionId).emit('moderator-left');
          }
        }
      } catch (err) {
        console.error("Error in leave-session:", err);
      }

      connectedUsers.delete(socket.id);
      console.log(`User ${user.userType} left session ${sessionId}`);
    }
  });

  // Handle clearing inactive sessions
  socket.on('clear-inactive-sessions', () => {
    try {
      const inactiveSessions = Array.from(chatSessions.entries())
        .filter(([, session]) => session.status === 'inactive')
        .map(([key]) => key);
      
      inactiveSessions.forEach(key => chatSessions.delete(key));
      broadcastActiveSessions();
    } catch (err) {
      console.error("Error clearing inactive sessions:", err);
    }
  });

  // Handle deleting a specific inactive session
  socket.on('delete-session', (data: { sessionId: string }) => {
    const { sessionId } = data;
    console.log(`Server: Received delete-session request for ${sessionId}`);

    try {
      const session = chatSessions.get(sessionId);

      if (session) {
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
      console.error("Error deleting session:", err);
      socket.emit('delete-error', { sessionId, error: 'Operation failed' });
    }
  });

  // Handle ending a session (initiated by moderator)
  socket.on('end-session', async (data: { sessionId: string }) => {
    const { sessionId } = data;
    console.log(`Server: Received end-session request for ${sessionId}`);

    try {
      const session = chatSessions.get(sessionId);
      console.log(`Server: Processing end-session for ${sessionId}. FORCE SETTING TO INACTIVE.`);

      if (session) {
        session.status = 'inactive';
        session.lastActivity = new Date();

        // Export session data before ending
        const exportedFile = await exportSessionData(sessionId, session);
        if (exportedFile) {
          socket.emit('session-exported', { sessionId, filename: exportedFile });
        }

        // Notify all users in the session that it has ended
        io.to(sessionId).emit('session-ended');
        console.log(`Server: Session ${sessionId} ended by moderator. Emitted session-ended to room ${sessionId}`);

        broadcastActiveSessions();
      } else {
        console.log(`Server: Session ${sessionId} not found`);
      }
    } catch (err) {
      console.error("Error ending session:", err);
    }
  });

  // Handle disconnect
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
            // Mark session as inactive when participant disconnects
            session.status = 'inactive';
            session.lastActivity = new Date();
            // Notify moderator that participant disconnected
            socket.to(user.sessionId).emit('participant-left');
            console.log(`Participant left session ${user.sessionId} - marked as inactive`);
          }

          // Notify others in session about disconnect
          socket.to(user.sessionId).emit('user-disconnected', { userType: user.userType });
        }
      } catch (err) {
        console.error("Error in disconnect handler:", err);
      }
    }

    connectedUsers.delete(socket.id);
  });
});

// Force restart
const PORT = process.env.SOCKET_PORT || 3006;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
}).on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${PORT} is already in use.`);
    console.error(`Please either:`);
    console.error(`  1. Stop the process using port ${PORT}`);
    console.error(`  2. Use a different port by setting SOCKET_PORT environment variable`);
    console.error(`\nTo find and kill the process on Windows:`);
    console.error(`  netstat -ano | findstr :${PORT}`);
    console.error(`  taskkill /PID <PID> /F`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});
