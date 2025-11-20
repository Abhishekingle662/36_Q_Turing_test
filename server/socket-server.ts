import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectDB } from './db.js';
import { Session } from './models.js';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3001", "http://localhost:3000"],
    methods: ["GET", "POST"]
  }
});

// Connect to MongoDB
connectDB();

// Store connected users in memory (ephemeral)
const connectedUsers = new Map<string, { socketId: string; userType: 'participant' | 'moderator'; sessionId?: string; lastActive: Date }>();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  console.log('SERVER VERSION: DEBUG-INACTIVE-FIX-V1');

  // Helper to broadcast active sessions
  const broadcastActiveSessions = async () => {
    try {
      const sessions = await Session.find().sort({ lastActivity: -1 });
      const activeSessions = sessions.map(session => ({
        sessionId: session.participantId,
        participantId: session.participantId,
        hasModeratorAssigned: !!session.moderatorId,
        messageCount: session.messages.length,
        status: session.status
      }));
      io.emit('active-sessions', activeSessions);
    } catch (err) {
      console.error("Error broadcasting active sessions:", err);
    }
  };

  // Handle user joining as participant or moderator
  socket.on('join-session', async (data: { userType: 'participant' | 'moderator'; sessionId?: string; participantId?: string }) => {
    const { userType, sessionId, participantId } = data;

    if (userType === 'participant') {
      // Check if participant already has an existing session
      const targetSessionId = participantId || `session_${Date.now()}`;

      try {
        let session = await Session.findOne({ participantId: targetSessionId });

        if (!session) {
          // Create new session only if it doesn't exist
          session = await Session.create({
            participantId: targetSessionId,
            status: 'active',
            lastActivity: new Date(),
            messages: []
          });

          // Notify moderators about new participant
          socket.broadcast.emit('participant-joined', { sessionId: targetSessionId, participantId: targetSessionId });
          console.log(`New participant ${targetSessionId} created session - notifying moderators`);
        } else {
          // Reactivate existing session
          const wasInactive = session.status === 'inactive';
          session.status = 'active';
          session.lastActivity = new Date();
          await session.save();

          // If the session was inactive and is now active, notify moderators
          if (wasInactive) {
            socket.broadcast.emit('participant-rejoined', { sessionId: targetSessionId, participantId: targetSessionId });
            console.log(`Participant ${targetSessionId} rejoined inactive session - notifying moderators`);
          }
          console.log(`Participant ${targetSessionId} rejoined existing session`);
        }

        await broadcastActiveSessions();

        connectedUsers.set(socket.id, { socketId: socket.id, userType: 'participant', sessionId: targetSessionId, lastActive: new Date() });

        socket.join(targetSessionId);
        socket.emit('session-joined', { sessionId: targetSessionId, userType: 'participant' });

        // Send existing chat history to participant
        socket.emit('chat-history', session.messages);
      } catch (err) {
        console.error("Error in join-session (participant):", err);
      }

    } else if (userType === 'moderator' && sessionId) {
      // Moderator joining existing session
      try {
        const session = await Session.findOne({ participantId: sessionId });
        if (session) {
          session.moderatorId = socket.id;
          await session.save();

          connectedUsers.set(socket.id, { socketId: socket.id, userType: 'moderator', sessionId, lastActive: new Date() });

          socket.join(sessionId);
          socket.emit('session-joined', { sessionId, userType: 'moderator', session });

          // Send chat history to moderator
          socket.emit('chat-history', session.messages);

        }
      } catch (err) {
        console.error("Error in join-session (moderator):", err);
      }
    }
  });

  // Handle sending messages
  socket.on('send-message', async (data: { sessionId: string; content: string; sender: 'participant' | 'moderator' }) => {
    const { sessionId, content, sender } = data;
    console.log(`Server: Received send-message for session ${sessionId} from ${sender}`);

    try {
      const session = await Session.findOne({ participantId: sessionId });

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
        const savedSession = await session.save();
        console.log(`Server: Message saved to DB. Message count: ${savedSession.messages.length}`);

        // Broadcast message to all users in the session
        io.to(sessionId).emit('new-message', message);

        console.log(`Message sent in session ${sessionId}:`, message);
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
  socket.on('leave-session', async (data: { sessionId: string }) => {
    const { sessionId } = data;
    const user = connectedUsers.get(socket.id);

    if (user && user.sessionId === sessionId) {
      socket.leave(sessionId);

      try {
        // If participant is leaving, mark session as inactive
        if (user.userType === 'participant') {
          const session = await Session.findOne({ participantId: sessionId });
          if (session) {
            session.status = 'inactive';
            session.lastActivity = new Date();
            await session.save();

            // Notify moderator that participant left
            socket.to(sessionId).emit('participant-left');
            console.log(`Participant left session ${sessionId} via leave-session`);
          }
        } else if (user.userType === 'moderator') {
          // If moderator is leaving, just remove moderator assignment
          const session = await Session.findOne({ participantId: sessionId });
          if (session) {
            session.moderatorId = undefined;
            await session.save();
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
  socket.on('clear-inactive-sessions', async () => {
    try {
      await Session.deleteMany({ status: 'inactive' });
      await broadcastActiveSessions();
    } catch (err) {
      console.error("Error clearing inactive sessions:", err);
    }
  });

  // Handle deleting a specific inactive session
  socket.on('delete-session', async (data: { sessionId: string }) => {
    const { sessionId } = data;
    console.log(`Server: Received delete-session request for ${sessionId}`);

    try {
      const session = await Session.findOne({ participantId: sessionId });

      if (session) {
        await Session.deleteOne({ participantId: sessionId });
        console.log(`Server: Session ${sessionId} deleted by moderator successfully`);

        await broadcastActiveSessions();
        socket.emit('session-deleted', { sessionId });
      } else {
        const error = 'Session not found';
        console.log(`Server: Delete failed for ${sessionId}: ${error}`);
        socket.emit('delete-error', { sessionId, error });
      }
    } catch (err) {
      console.error("Error deleting session:", err);
      socket.emit('delete-error', { sessionId, error: 'Database error' });
    }
  });

  // Handle ending a session (initiated by moderator)
  socket.on('end-session', async (data: { sessionId: string }) => {
    const { sessionId } = data;
    console.log(`Server: Received end-session request for ${sessionId}`);

    try {
      const session = await Session.findOne({ participantId: sessionId });
      console.log(`Server: Processing end-session for ${sessionId}. FORCE SETTING TO INACTIVE.`);

      if (session) {
        session.status = 'inactive';
        session.lastActivity = new Date();
        await session.save();

        // Notify all users in the session that it has ended
        io.to(sessionId).emit('session-ended');
        console.log(`Server: Session ${sessionId} ended by moderator. Emitted session-ended to room ${sessionId}`);

        await broadcastActiveSessions();
      } else {
        console.log(`Server: Session ${sessionId} not found`);
      }
    } catch (err) {
      console.error("Error ending session:", err);
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    const user = connectedUsers.get(socket.id);
    console.log(`User disconnected: ${socket.id}`, user ? `(${user.userType} in session ${user.sessionId})` : '(unknown user)');

    if (user && user.sessionId) {
      try {
        const session = await Session.findOne({ participantId: user.sessionId });
        if (session) {
          if (user.userType === 'moderator') {
            session.moderatorId = undefined;
            await session.save();
            socket.to(user.sessionId).emit('moderator-left');
            console.log(`Moderator left session ${user.sessionId}`);
          } else if (user.userType === 'participant') {
            // Mark session as inactive when participant disconnects
            session.status = 'inactive';
            session.lastActivity = new Date();
            await session.save();
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
const PORT = process.env.SOCKET_PORT || 3002;
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
