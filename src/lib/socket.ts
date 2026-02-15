import { io, Socket } from 'socket.io-client';

type Sender = 'participant' | 'moderator';
type PartnerType = 'human' | 'llm';

type ExperimentCondition =
  | 'truthful-human'
  | 'truthful-ai'
  | 'deceptive-ai-as-human'
  | 'deceptive-human-as-ai';

type SessionJoinedPayload = {
  sessionId: string;
  userType: Sender | 'participant' | 'moderator';
  partnerType?: PartnerType;
  disclosedType?: PartnerType;
  condition?: ExperimentCondition;
  moderatorInputEnabled?: boolean;
  session?: unknown;
};

type MessagePayload = {
  id: string;
  content: string;
  sender: Sender;
  timestamp: string | Date;
};

type UserTypingPayload = { userType: Sender; isTyping: boolean };

type ActiveSessionPayload = Array<{
  sessionId: string;
  participantId: string;
  hasModeratorAssigned: boolean;
  messageCount: number;
  status: 'active' | 'inactive';
  partnerType: PartnerType;
  disclosedType: PartnerType;
  condition: ExperimentCondition;
}>;

type AllSessionsPayload = Array<{
  sessionId: string;
  participantId: string;
  status: 'active' | 'inactive';
  condition?: ExperimentCondition;
  partnerType?: PartnerType;
  disclosedType?: PartnerType;
  lastActivity: string;
  messageCount: number;
  messages: Array<{
    id: string;
    content: string;
    sender: Sender;
    timestamp: string | Date;
  }>;
}>;

type ParticipantEventPayload = { sessionId: string; participantId: string };
type JoinErrorPayload = { sessionId: string; error: string };
type DeleteErrorPayload = { sessionId: string; error: string };
type SessionDeletedPayload = { sessionId: string };
type UserDisconnectedPayload = { userType: string };

class SocketService {
  private socket: Socket | null = null;
  private serverUrl = process.env.NEXT_PUBLIC_SOCKET_URL || '';

  connect(): Socket {
    if (!this.socket) {
      const url = this.serverUrl.trim() || undefined; // undefined defaults to same-origin
      this.socket = io(url, {
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

  sendMessage(sessionId: string, content: string, sender: Sender) {
    if (this.socket) {
      this.socket.emit('send-message', { sessionId, content, sender });
    }
  }

  startTyping(sessionId: string, userType: Sender) {
    if (this.socket) {
      this.socket.emit('typing-start', { sessionId, userType });
    }
  }

  stopTyping(sessionId: string, userType: Sender) {
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
  onSessionJoined(callback: (data: SessionJoinedPayload) => void) {
    if (this.socket) {
      this.socket.on('session-joined', callback);
    }
  }

  onNewMessage(callback: (message: MessagePayload) => void) {
    if (this.socket) {
      this.socket.on('new-message', callback);
    }
  }

  onUserTyping(callback: (data: UserTypingPayload) => void) {
    if (this.socket) {
      this.socket.on('user-typing', callback);
    }
  }

  onChatHistory(callback: (messages: MessagePayload[]) => void) {
    if (this.socket) {
      this.socket.on('chat-history', callback);
    }
  }

  onActiveSessions(callback: (sessions: ActiveSessionPayload) => void) {
    if (this.socket) {
      this.socket.on('active-sessions', callback);
    }
  }

  onParticipantJoined(callback: (data: ParticipantEventPayload) => void) {
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

  onJoinError(callback: (data: JoinErrorPayload) => void) {
    if (this.socket) {
      this.socket.on('join-error', callback);
    }
  }

  onUserDisconnected(callback: (data: UserDisconnectedPayload) => void) {
    if (this.socket) {
      this.socket.on('user-disconnected', callback);
    }
  }

  onParticipantLeft(callback: () => void) {
    if (this.socket) {
      this.socket.on('participant-left', callback);
    }
  }

  onParticipantRejoined(callback: (data: ParticipantEventPayload) => void) {
    if (this.socket) {
      this.socket.on('participant-rejoined', callback);
    }
  }

  onSessionDeleted(callback: (data: SessionDeletedPayload) => void) {
    if (this.socket) {
      this.socket.on('session-deleted', callback);
    }
  }

  onDeleteError(callback: (data: DeleteErrorPayload) => void) {
    if (this.socket) {
      this.socket.on('delete-error', callback);
    }
  }

  onSessionEnded(callback: () => void) {
    if (this.socket) {
      this.socket.on('session-ended', callback);
    }
  }

  // ── Google Drive auth ──────────────────────────────────────────
  requestGoogleAuth() {
    this.socket?.emit('google-auth-request', {
      origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    });
  }

  checkGoogleAuth() {
    this.socket?.emit('google-auth-check');
  }

  /** Re-link this socket to an existing Google auth by email. */
  linkGoogleAuth(email: string) {
    this.socket?.emit('google-auth-link', { email });
  }

  disconnectGoogle() {
    this.socket?.emit('google-disconnect');
  }

  /** Request batch export of sessions to Google Drive. */
  exportSessionsToGoogleDrive(sessionIds: string[]) {
    this.socket?.emit('google-export-sessions', { sessionIds });
  }

  onGoogleAuthUrl(callback: (data: { url: string }) => void) {
    this.socket?.on('google-auth-url', callback);
  }

  onGoogleAuthStatus(callback: (data: { connected: boolean; email?: string; error?: string }) => void) {
    this.socket?.on('google-auth-status', callback);
  }

  onGoogleExportResult(callback: (data: { success: boolean; exported?: number; total?: number; error?: string }) => void) {
    this.socket?.on('google-export-result', callback);
  }

  // ── Chat history (all sessions) ───────────────────────────────
  getAllSessions() {
    this.socket?.emit('get-all-sessions');
  }

  onAllSessions(callback: (sessions: AllSessionsPayload) => void) {
    this.socket?.on('all-sessions', callback);
  }

  // Clean up event listeners
  off(event: string, callback?: (...args: unknown[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

const socketService = new SocketService();
export default socketService;
