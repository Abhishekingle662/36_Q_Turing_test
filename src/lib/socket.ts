import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private serverUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3006';

  connect(): Socket {
    if (!this.socket) {
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling']
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  // Participant methods
  joinAsParticipant(participantId?: string) {
    if (this.socket) {
      this.socket.emit('join-session', {
        userType: 'participant',
        participantId
      });
    }
  }

  // Moderator methods
  joinAsModerator(sessionId: string) {
    if (this.socket) {
      this.socket.emit('join-session', {
        userType: 'moderator',
        sessionId
      });
    }
  }

  sendMessage(sessionId: string, content: string, sender: 'participant' | 'moderator') {
    if (this.socket) {
      this.socket.emit('send-message', { sessionId, content, sender });
    }
  }

  startTyping(sessionId: string, userType: 'participant' | 'moderator') {
    if (this.socket) {
      this.socket.emit('typing-start', { sessionId, userType });
    }
  }

  stopTyping(sessionId: string, userType: 'participant' | 'moderator') {
    if (this.socket) {
      this.socket.emit('typing-stop', { sessionId, userType });
    }
  }

  getActiveSessions() {
    if (this.socket) {
      this.socket.emit('get-active-sessions');
    }
  }

  clearInactiveSessions() {
    if (this.socket) {
      this.socket.emit('clear-inactive-sessions');
    }
  }

  deleteSession(sessionId: string) {
    console.log('SocketService: Emitting delete-session event for:', sessionId);
    if (this.socket) {
      this.socket.emit('delete-session', { sessionId });
    } else {
      console.error('SocketService: No socket connection available for delete-session');
    }
  }

  leaveSession(sessionId: string) {
    if (this.socket) {
      this.socket.emit('leave-session', { sessionId });
    }
  }

  endSession(sessionId: string) {
    if (this.socket) {
      this.socket.emit('end-session', { sessionId });
    }
  }

  // Event listeners
  onSessionJoined(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('session-joined', callback);
    }
  }

  onNewMessage(callback: (message: any) => void) {
    if (this.socket) {
      this.socket.on('new-message', callback);
    }
  }

  onUserTyping(callback: (data: { userType: string; isTyping: boolean }) => void) {
    if (this.socket) {
      this.socket.on('user-typing', callback);
    }
  }

  onChatHistory(callback: (messages: any[]) => void) {
    if (this.socket) {
      this.socket.on('chat-history', callback);
    }
  }

  onActiveSessions(callback: (sessions: any[]) => void) {
    if (this.socket) {
      this.socket.on('active-sessions', callback);
    }
  }

  onParticipantJoined(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('participant-joined', callback);
    }
  }

  onModeratorJoined(callback: () => void) {
    if (this.socket) {
      this.socket.on('moderator-joined', callback);
    }
  }

  onModeratorLeft(callback: () => void) {
    if (this.socket) {
      this.socket.on('moderator-left', callback);
    }
  }

  onJoinError(callback: (data: { sessionId: string; error: string }) => void) {
    if (this.socket) {
      this.socket.on('join-error', callback);
    }
  }

  onUserDisconnected(callback: (data: { userType: string }) => void) {
    if (this.socket) {
      this.socket.on('user-disconnected', callback);
    }
  }

  onParticipantLeft(callback: () => void) {
    if (this.socket) {
      this.socket.on('participant-left', callback);
    }
  }

  onParticipantRejoined(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('participant-rejoined', callback);
    }
  }

  onSessionDeleted(callback: (data: { sessionId: string }) => void) {
    if (this.socket) {
      this.socket.on('session-deleted', callback);
    }
  }

  onDeleteError(callback: (data: { sessionId: string; error: string }) => void) {
    if (this.socket) {
      this.socket.on('delete-error', callback);
    }
  }

  onSessionEnded(callback: () => void) {
    if (this.socket) {
      this.socket.on('session-ended', callback);
    }
  }

  // Clean up event listeners
  off(event: string, callback?: any) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export default new SocketService();
