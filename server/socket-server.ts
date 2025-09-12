import { createServer } from 'http';
import { Server } from 'socket.io';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3001", "http://localhost:3000"],
    methods: ["GET", "POST"]
  }
});

// Store active chat sessions
interface ChatSession {
  participantId: string;
  moderatorId?: string;
  status: 'active' | 'inactive';
  lastActivity: Date;
  messages: Array<{
    id: string;
    content: string;
    sender: 'participant' | 'moderator';
    timestamp: Date;
  }>;
}

const chatSessions = new Map<string, ChatSession>();
const connectedUsers = new Map<string, { socketId: string; userType: 'participant' | 'moderator'; sessionId?: string; lastActive: Date }>();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user joining as participant or moderator
  socket.on('join-session', (data: { userType: 'participant' | 'moderator'; sessionId?: string; participantId?: string }) => {
    const { userType, sessionId, participantId } = data;
    
    if (userType === 'participant') {
      // Check if participant already has an existing session
      const existingSessionId = participantId || `session_${Date.now()}`;
      let session = chatSessions.get(existingSessionId);
      
      if (!session) {
        // Create new session only if it doesn't exist
        session = {
          participantId: existingSessionId,
          status: 'active',
          lastActivity: new Date(),
          messages: []
        };
        chatSessions.set(existingSessionId, session);
        
        // Notify moderators about new participant
        socket.broadcast.emit('participant-joined', { sessionId: existingSessionId, participantId: existingSessionId });
        console.log(`New participant ${existingSessionId} created session`);
      } else {
        // Reactivate existing session
        session.status = 'active';
        session.lastActivity = new Date();
        console.log(`Participant ${existingSessionId} rejoined existing session`);
      }
      
      connectedUsers.set(socket.id, { socketId: socket.id, userType: 'participant', sessionId: existingSessionId, lastActive: new Date() });
      
      socket.join(existingSessionId);
      socket.emit('session-joined', { sessionId: existingSessionId, userType: 'participant' });
      
      // Send existing chat history to participant
      socket.emit('chat-history', session.messages);
    } else if (userType === 'moderator' && sessionId) {
      // Moderator joining existing session
      const session = chatSessions.get(sessionId);
      if (session) {
        session.moderatorId = socket.id;
        connectedUsers.set(socket.id, { socketId: socket.id, userType: 'moderator', sessionId, lastActive: new Date() });
        
        socket.join(sessionId);
        socket.emit('session-joined', { sessionId, userType: 'moderator', session });
        
        // Send chat history to moderator
        socket.emit('chat-history', session.messages);
        
        // Notify participant that moderator joined
        socket.to(sessionId).emit('moderator-joined');
        
        console.log(`Moderator joined session ${sessionId}`);
      }
    }
  });

  // Handle sending messages
  socket.on('send-message', (data: { sessionId: string; content: string; sender: 'participant' | 'moderator' }) => {
    const { sessionId, content, sender } = data;
    const session = chatSessions.get(sessionId);
    
    if (session) {
      // Update user and session activity
      const user = connectedUsers.get(socket.id);
      if (user) {
        user.lastActive = new Date();
      }
      session.lastActivity = new Date();
      session.status = 'active';
      
      const message = {
        id: `msg_${Date.now()}_${Math.random()}`,
        content,
        sender,
        timestamp: new Date()
      };
      
      session.messages.push(message);
      
      // Broadcast message to all users in the session
      io.to(sessionId).emit('new-message', message);
      
      console.log(`Message sent in session ${sessionId}:`, message);
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
    const activeSessions = Array.from(chatSessions.entries()).map(([id, session]) => ({
      sessionId: id,
      participantId: session.participantId,
      hasModeratorAssigned: !!session.moderatorId,
      messageCount: session.messages.length
    }));
    
    socket.emit('active-sessions', activeSessions);
  });

  // Handle leaving a session
  socket.on('leave-session', (data: { sessionId: string }) => {
    const { sessionId } = data;
    const user = connectedUsers.get(socket.id);
    
    if (user && user.sessionId === sessionId) {
      socket.leave(sessionId);
      
      // If participant is leaving, mark session as inactive
      if (user.userType === 'participant') {
        const session = chatSessions.get(sessionId);
        if (session) {
          session.status = 'inactive';
          session.lastActivity = new Date();
          // Notify moderator that participant left
          socket.to(sessionId).emit('participant-left');
        }
      } else if (user.userType === 'moderator') {
        // If moderator is leaving, just remove moderator assignment
        const session = chatSessions.get(sessionId);
        if (session) {
          session.moderatorId = undefined;
          socket.to(sessionId).emit('moderator-left');
        }
      }
      
      connectedUsers.delete(socket.id);
      console.log(`User ${user.userType} left session ${sessionId}`);
    }
  });

  // Handle clearing inactive sessions
  socket.on('clear-inactive-sessions', () => {
    console.log('=== CLEARING INACTIVE SESSIONS ===');
    console.log('Total sessions before cleanup:', chatSessions.size);
    console.log('Connected users:', connectedUsers.size);
    
    const sessionsToRemove: string[] = [];
    const connectedSocketIds = new Set(io.sockets.sockets.keys());
    
    // First, clean up disconnected users from connectedUsers map
    Array.from(connectedUsers.entries()).forEach(([socketId, user]) => {
      if (!connectedSocketIds.has(socketId)) {
        console.log(`Removing disconnected user: ${socketId} (${user.userType})`);
        connectedUsers.delete(socketId);
      }
    });
    
    // Find sessions where the participant is no longer connected
    chatSessions.forEach((session, sessionId) => {
      const participantUser = Array.from(connectedUsers.values()).find(user => 
        user.sessionId === sessionId && user.userType === 'participant'
      );
      
      const isParticipantMissing = !participantUser;
      const isSocketDisconnected = participantUser && !connectedSocketIds.has(participantUser.socketId);
      const isSessionInactive = session.status === 'inactive';
      
      console.log(`Session ${sessionId}:`, {
        status: session.status,
        hasParticipant: !!participantUser,
        participantSocketId: participantUser?.socketId,
        isSocketConnected: participantUser ? connectedSocketIds.has(participantUser.socketId) : false,
        willRemove: isParticipantMissing || isSocketDisconnected || isSessionInactive
      });
      
      if (isParticipantMissing || isSocketDisconnected || isSessionInactive) {
        sessionsToRemove.push(sessionId);
      }
    });
    
    // Remove inactive sessions
    sessionsToRemove.forEach(sessionId => {
      chatSessions.delete(sessionId);
      console.log(`Removed inactive session: ${sessionId}`);
    });
    
    // Send updated active sessions to all moderators
    const activeSessions = Array.from(chatSessions.entries()).map(([id, session]) => ({
      sessionId: id,
      participantId: session.participantId,
      hasModeratorAssigned: !!session.moderatorId,
      messageCount: session.messages.length
    }));
    
    io.emit('active-sessions', activeSessions);
    console.log(`Cleared ${sessionsToRemove.length} inactive sessions`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    console.log(`User disconnected: ${socket.id}`, user ? `(${user.userType} in session ${user.sessionId})` : '(unknown user)');
    
    if (user && user.sessionId) {
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
    }
    
    connectedUsers.delete(socket.id);
  });
});

const PORT = process.env.SOCKET_PORT || 3002;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});
