'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import socketService from '@/lib/socket';

import {
  SignalIcon,
  ArrowPathIcon,
  EyeIcon,
  TrashIcon,
  StopCircleIcon,
  UserGroupIcon,
  CpuChipIcon,
  ArrowDownTrayIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

/* ---------- TYPES ---------- */

type ExperimentCondition =
  | 'truthful-human'
  | 'truthful-ai'
  | 'deceptive-ai-as-human'
  | 'deceptive-human-as-ai';

interface ActiveSession {
  sessionId: string;
  participantId: string;
  hasModeratorAssigned: boolean;
  messageCount: number;
  status: 'active' | 'inactive';
  partnerType: 'human' | 'llm';
  disclosedType: 'human' | 'llm';
  condition: ExperimentCondition;
}

interface HistorySession {
  sessionId: string;
  participantId: string;
  status: 'active' | 'inactive';
  condition?: ExperimentCondition;
  partnerType?: 'human' | 'llm';
  disclosedType?: 'human' | 'llm';
  lastActivity: string;
  messageCount: number;
  messages: Array<{
    id: string;
    content: string;
    sender: 'participant' | 'moderator';
    timestamp: string | Date;
  }>;
}

const conditionLabels: Record<ExperimentCondition, string> = {
  'truthful-human': 'Truthful Human',
  'truthful-ai': 'Truthful AI',
  'deceptive-ai-as-human': 'AI as Human',
  'deceptive-human-as-ai': 'Human as AI',
};

type Tab = 'sessions' | 'history';

/* ---------- COMPONENT ---------- */

function ModeratorDashboardContent() {
  const [activeTab, setActiveTab] = useState<Tab>('sessions');
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([]);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingSession, setDeletingSession] = useState<string | null>(null);

  // Google Drive state
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);

  // Modal
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'delete' | 'end-ai' | null;
    sessionId: string | null;
    participantId?: string;
  }>({ isOpen: false, type: null, sessionId: null });

  const router = useRouter();
  const searchParams = useSearchParams();

  const [exportingToDrive, setExportingToDrive] = useState(false);

  /* ---------- SOCKET SETUP ---------- */

  useEffect(() => {
    const socket = socketService.connect();

    socket.on('connect', () => {
      setIsConnected(true);
      socketService.getActiveSessions();

      // Try to re-link Google auth from localStorage
      const storedEmail = localStorage.getItem('google_drive_email');
      if (storedEmail) {
        socketService.linkGoogleAuth(storedEmail);
      } else {
        socketService.checkGoogleAuth();
      }
    });

    socket.on('disconnect', () => setIsConnected(false));

    socketService.onActiveSessions(setActiveSessions);
    socketService.onParticipantJoined(socketService.getActiveSessions);
    socketService.onParticipantRejoined(socketService.getActiveSessions);
    socketService.onParticipantLeft(socketService.getActiveSessions);

    socketService.onSessionDeleted(() => {
      setDeletingSession(null);
      socketService.getActiveSessions();
    });

    socketService.onDeleteError((data) => {
      setDeletingSession(null);
      alert(`Error deleting session: ${data.error}`);
    });

    // Google Drive events
    socketService.onGoogleAuthUrl((data) => {
      window.location.href = data.url;
    });

    socketService.onGoogleAuthStatus((data) => {
      setGoogleConnected(data.connected);
      if (data.connected && data.email) {
        setGoogleEmail(data.email);
        localStorage.setItem('google_drive_email', data.email);
      } else if (!data.connected) {
        setGoogleEmail(null);
        localStorage.removeItem('google_drive_email');
      }
    });

    socketService.onGoogleExportResult((data) => {
      setExportingToDrive(false);
      if (data.success) {
        alert(`Exported ${data.exported} of ${data.total} session(s) to Google Drive.`);
      } else {
        alert(`Export failed: ${data.error || 'Unknown error'}`);
      }
    });

    // All sessions (history)
    socketService.onAllSessions((sessions) => {
      const sorted = [...sessions].sort(
        (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      );
      setHistorySessions(sorted);
    });

    return () => socketService.disconnect();
  }, []);

  // Check for Google OAuth redirect (after consent screen)
  useEffect(() => {
    const connected = searchParams.get('google_connected');
    const email = searchParams.get('email');
    if (connected === 'true' && email) {
      const decodedEmail = decodeURIComponent(email);
      setGoogleConnected(true);
      setGoogleEmail(decodedEmail);
      localStorage.setItem('google_drive_email', decodedEmail);
      // Re-link the new socket to this email
      socketService.linkGoogleAuth(decodedEmail);
      router.replace('/moderator');
    } else if (connected === 'false') {
      router.replace('/moderator');
    }
  }, [searchParams, router]);

  /* ---------- ACTIONS ---------- */

  const refreshSessions = () => {
    setIsRefreshing(true);
    socketService.getActiveSessions();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleJoinSession = (sessionId: string) => {
    router.push(`/moderator/chat?sessionId=${sessionId}`);
  };

  const handleDeleteSession = (sessionId: string) => {
    setModalConfig({ isOpen: true, type: 'delete', sessionId });
  };

  const handleEndAISession = (sessionId: string, participantId: string) => {
    setModalConfig({ isOpen: true, type: 'end-ai', sessionId, participantId });
  };

  const confirmAction = () => {
    const { type, sessionId } = modalConfig;
    if (!sessionId) return;
    if (type === 'delete') {
      setDeletingSession(sessionId);
      socketService.deleteSession(sessionId);
    } else if (type === 'end-ai') {
      socketService.endSession(sessionId);
    }
    closeModal();
  };

  const closeModal = () => {
    setModalConfig({ isOpen: false, type: null, sessionId: null });
  };

  const loadHistory = useCallback(() => {
    socketService.getAllSessions();
  }, []);

  const toggleHistorySelection = (sessionId: string) => {
    setSelectedHistoryIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const selectAllHistory = () => {
    if (selectedHistoryIds.size === historySessions.length) {
      setSelectedHistoryIds(new Set());
    } else {
      setSelectedHistoryIds(new Set(historySessions.map(s => s.sessionId)));
    }
  };

  const exportSelectedAsCSV = () => {
    const selected = historySessions.filter(s => selectedHistoryIds.has(s.sessionId));
    if (!selected.length) return;

    const escapeCsvField = (field: string) => {
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = ['Timestamp,Session ID,Condition,Sender,Message'];
    for (const session of selected) {
      for (const msg of session.messages) {
        rows.push([
          escapeCsvField(new Date(msg.timestamp).toISOString()),
          escapeCsvField(session.sessionId),
          escapeCsvField(session.condition || 'unknown'),
          escapeCsvField(msg.sender),
          escapeCsvField(msg.content),
        ].join(','));
      }
    }

    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `chat_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  /* ---------- UI ---------- */

  return (
    <div className="min-h-screen bg-slate-50">

      {/* HEADER */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Moderator Dashboard
            </h1>
            <p className="text-sm text-slate-500">
              Research Study Chat Moderation
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Google Drive connection */}
            {googleConnected ? (
              <div className="flex items-center gap-2 text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span className="text-green-700 font-medium">{googleEmail}</span>
                <button
                  onClick={() => {
                    socketService.disconnectGoogle();
                    localStorage.removeItem('google_drive_email');
                    setGoogleConnected(false);
                    setGoogleEmail(null);
                  }}
                  className="text-green-600 hover:text-red-600 text-xs underline ml-1"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => socketService.requestGoogleAuth()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Connect Google Drive
              </button>
            )}

            <div className="flex items-center gap-2 text-sm">
              <SignalIcon className={`w-4 h-4 ${isConnected ? 'text-teal-600' : 'text-slate-400'}`} />
              <span className="text-slate-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <button
              onClick={refreshSessions}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              <ArrowPathIcon className="w-4 h-4" />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      {/* TABS */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex gap-1 bg-slate-200 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'sessions'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active Sessions
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              loadHistory();
            }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="w-4 h-4" />
              Chat History
            </span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <main className="max-w-7xl mx-auto px-6 py-6">

        {/* ── ACTIVE SESSIONS TAB ── */}
        {activeTab === 'sessions' && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Active Chat Sessions</h2>
              <p className="text-slate-600">Monitor and join participant sessions in real time.</p>
              {googleConnected && (
                <p className="text-sm text-green-600 mt-1">
                  Auto-saving all messages to Google Drive ({googleEmail}).
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeSessions.length === 0 ? (
                <div className="col-span-full text-center py-16 text-slate-500">
                  <UserGroupIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  No active sessions yet
                </div>
              ) : (
                activeSessions.map(session => {
                  const isAI = session.partnerType === 'llm';
                  return (
                    <div key={session.sessionId} className="bg-white rounded-2xl border shadow-sm p-6 flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            Session #{session.sessionId.slice(-8)}
                          </h3>
                          <p className="text-sm text-slate-500">
                            Participant {session.participantId.slice(-8)}
                          </p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          session.hasModeratorAssigned ? 'bg-slate-100 text-slate-600' : 'bg-teal-100 text-teal-700'
                        }`}>
                          {session.hasModeratorAssigned ? 'Moderated' : 'Available'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mb-2 text-sm">
                        {isAI ? <CpuChipIcon className="w-4 h-4 text-teal-600" /> : <UserGroupIcon className="w-4 h-4 text-teal-600" />}
                        <span className="text-slate-600">Actual: {isAI ? 'AI' : 'Human'}</span>
                      </div>
                      <div className="mb-4">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          session.condition?.includes('deceptive') ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {conditionLabels[session.condition] || session.condition}
                        </span>
                      </div>

                      <div className="text-sm text-slate-600 space-y-1 mb-6">
                        <div>Messages: <strong>{session.messageCount}</strong></div>
                        <div>
                          Status:{' '}
                          <span className={session.status === 'active' ? 'text-teal-600' : 'text-red-500'}>
                            {session.status === 'active' ? 'Online' : 'Disconnected'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 mt-auto">
                        {session.status === 'active' && (
                          <button
                            onClick={() => handleJoinSession(session.sessionId)}
                            disabled={session.hasModeratorAssigned && session.partnerType === 'human'}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400"
                          >
                            <EyeIcon className="w-4 h-4" />
                            {session.hasModeratorAssigned && session.partnerType === 'human'
                              ? 'Already Moderated'
                              : isAI ? 'Observe Session' : 'Join Session'}
                          </button>
                        )}
                        {session.status === 'active' && (
                          <button
                            onClick={() => handleEndAISession(session.sessionId, session.participantId)}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-900"
                          >
                            <StopCircleIcon className="w-4 h-4" />
                            End Session
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteSession(session.sessionId)}
                          disabled={deletingSession === session.sessionId}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          <TrashIcon className="w-4 h-4" />
                          {deletingSession === session.sessionId ? 'Deleting...' : 'Delete Session'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* STATS */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
              <Stat label="Active Sessions" value={activeSessions.length} />
              <Stat label="Moderated" value={activeSessions.filter(s => s.hasModeratorAssigned).length} />
              <Stat label="Awaiting Moderator" value={activeSessions.filter(s => !s.hasModeratorAssigned).length} />
              <Stat label="AI Sessions" value={activeSessions.filter(s => s.partnerType === 'llm').length} />
            </div>
          </>
        )}

        {/* ── CHAT HISTORY TAB ── */}
        {activeTab === 'history' && (
          <>
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">Chat History</h2>
                <p className="text-slate-600">
                  View all past and current sessions. Select sessions to export.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={loadHistory}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  Reload
                </button>
                {selectedHistoryIds.size > 0 && (
                  <>
                    <button
                      onClick={exportSelectedAsCSV}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      Export {selectedHistoryIds.size} Session{selectedHistoryIds.size > 1 ? 's' : ''} (CSV)
                    </button>
                    {googleConnected && (
                      <button
                        onClick={() => {
                          setExportingToDrive(true);
                          socketService.exportSessionsToGoogleDrive(Array.from(selectedHistoryIds));
                        }}
                        disabled={exportingToDrive}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M7.71 3.5L1.15 15l3.43 5.96h6.86l-3.43-5.96L7.71 3.5zm8.58 0l-3.43 5.96 3.43 5.96h6.86L19.72 9.5 16.29 3.5zm-4.29 7.46l-3.43 5.96h6.86l3.43-5.96H12z"/>
                        </svg>
                        {exportingToDrive ? 'Saving...' : `Save ${selectedHistoryIds.size} to Google Drive`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {historySessions.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <ClockIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                No chat sessions found.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 bg-slate-50 border-b text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedHistoryIds.size === historySessions.length && historySessions.length > 0}
                      onChange={selectAllHistory}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                  </div>
                  <div>Session</div>
                  <div>Date / Time</div>
                  <div>Condition</div>
                  <div>Messages</div>
                  <div>Status</div>
                  <div>Actions</div>
                </div>

                {/* Rows */}
                {historySessions.map(session => {
                  const date = new Date(session.lastActivity);
                  const dateStr = date.toLocaleDateString();
                  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const isSelected = selectedHistoryIds.has(session.sessionId);

                  return (
                    <div
                      key={session.sessionId}
                      className={`grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 border-b last:border-b-0 items-center text-sm ${
                        isSelected ? 'bg-teal-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleHistorySelection(session.sessionId)}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <span className="font-medium text-slate-900">#{session.sessionId.slice(-8)}</span>
                      </div>
                      <div className="text-slate-600">
                        {dateStr} <span className="text-slate-400">{timeStr}</span>
                      </div>
                      <div>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          session.condition?.includes('deceptive') ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {session.condition ? conditionLabels[session.condition] || session.condition : 'N/A'}
                        </span>
                      </div>
                      <div className="text-slate-600 font-medium">{session.messageCount}</div>
                      <div>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          session.status === 'active' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {session.status === 'active' ? 'Active' : 'Ended'}
                        </span>
                      </div>
                      <div>
                        <button
                          onClick={() => handleJoinSession(session.sessionId)}
                          className="text-teal-600 hover:text-teal-800 text-sm font-medium"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* CONFIRMATION MODAL */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="mb-6">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                modalConfig.type === 'delete' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'
              }`}>
                {modalConfig.type === 'delete' ? (
                  <TrashIcon className="w-6 h-6" />
                ) : (
                  <StopCircleIcon className="w-6 h-6" />
                )}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {modalConfig.type === 'delete' ? 'Delete Session?' : 'End Session?'}
              </h3>
              <p className="text-slate-600">
                {modalConfig.type === 'delete'
                  ? 'Are you sure? This removes all session data permanently.'
                  : `End session for participant ${modalConfig.participantId?.slice(-8)}?`}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                className={`flex-1 px-4 py-2.5 text-white rounded-xl font-medium shadow-sm ${
                  modalConfig.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-800 hover:bg-slate-900'
                }`}
              >
                {modalConfig.type === 'delete' ? 'Delete' : 'End Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- SUSPENSE WRAPPER ---------- */

export default function ModeratorDashboard() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <ModeratorDashboardContent />
    </Suspense>
  );
}

/* ---------- HELPERS ---------- */

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl border p-6 text-center">
      <div className="text-3xl font-bold text-teal-600 mb-1">{value}</div>
      <div className="text-sm text-slate-600">{label}</div>
    </div>
  );
}
