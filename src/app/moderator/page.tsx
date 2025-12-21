'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import socketService from '@/lib/socket';

import {
  SignalIcon,
  ArrowPathIcon,
  EyeIcon,
  TrashIcon,
  StopCircleIcon,
  UserGroupIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';

interface ActiveSession {
  sessionId: string;
  participantId: string;
  hasModeratorAssigned: boolean;
  messageCount: number;
  status: 'active' | 'inactive';
  partnerType: 'human' | 'llm';
}

export default function ModeratorDashboard() {
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingSession, setDeletingSession] = useState<string | null>(null);
  
  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'delete' | 'end-ai' | null;
    sessionId: string | null;
    participantId?: string;
  }>({
    isOpen: false,
    type: null,
    sessionId: null,
  });

  const router = useRouter();

  /* ---------- SOCKET SETUP ---------- */

  useEffect(() => {
    const socket = socketService.connect();

    socket.on('connect', () => {
      setIsConnected(true);
      socketService.getActiveSessions();
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

    return () => socketService.disconnect();
  }, []);

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
    setModalConfig({
      isOpen: true,
      type: 'delete',
      sessionId,
    });
  };

  const handleEndAISession = (sessionId: string, participantId: string) => {
    setModalConfig({
      isOpen: true,
      type: 'end-ai',
      sessionId,
      participantId,
    });
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
            <div className="flex items-center gap-2 text-sm">
              <SignalIcon
                className={`w-4 h-4 ${
                  isConnected ? 'text-teal-600' : 'text-slate-400'
                }`}
              />
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
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* INTRO */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Active Chat Sessions
          </h2>
          <p className="text-slate-600">
            Monitor and join participant sessions in real time.
          </p>
        </div>

        {/* SESSIONS GRID */}
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
                <div
                  key={session.sessionId}
                  className="bg-white rounded-2xl border shadow-sm p-6 flex flex-col"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Session #{session.sessionId.slice(-8)}
                      </h3>
                      <p className="text-sm text-slate-500">
                        Participant {session.participantId.slice(-8)}
                      </p>
                    </div>

                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        session.hasModeratorAssigned
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-teal-100 text-teal-700'
                      }`}
                    >
                      {session.hasModeratorAssigned ? 'Moderated' : 'Available'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-4 text-sm">
                    {isAI ? (
                      <CpuChipIcon className="w-4 h-4 text-teal-600" />
                    ) : (
                      <UserGroupIcon className="w-4 h-4 text-teal-600" />
                    )}
                    <span className="text-slate-600">
                      {isAI ? 'AI Participant' : 'Human Participant'}
                    </span>
                  </div>

                  <div className="text-sm text-slate-600 space-y-1 mb-6">
                    <div>Messages: <strong>{session.messageCount}</strong></div>
                    <div>
                      Status:{' '}
                      <span
                        className={
                          session.status === 'active'
                            ? 'text-teal-600'
                            : 'text-red-500'
                        }
                      >
                        {session.status === 'active' ? 'Online' : 'Disconnected'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 mt-auto">
                    {session.status === 'active' && (
                      <button
                        onClick={() => handleJoinSession(session.sessionId)}
                        disabled={session.hasModeratorAssigned && !isAI}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400"
                      >
                        <EyeIcon className="w-4 h-4" />
                        {session.hasModeratorAssigned && !isAI
                          ? 'Already Moderated'
                          : 'Join Session'}
                      </button>
                    )}

                    {isAI && session.status === 'active' && (
                      <button
                        onClick={() =>
                          handleEndAISession(
                            session.sessionId,
                            session.participantId
                          )
                        }
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-900"
                      >
                        <StopCircleIcon className="w-4 h-4" />
                        End AI Session
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteSession(session.sessionId)}
                      disabled={deletingSession === session.sessionId}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      <TrashIcon className="w-4 h-4" />
                      {deletingSession === session.sessionId
                        ? 'Deleting…'
                        : 'Delete Session'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      {/* CONFIRMATION MODAL */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 transform transition-all">
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
                {modalConfig.type === 'delete' ? 'Delete Session?' : 'End AI Session?'}
              </h3>
              
              <p className="text-slate-600">
                {modalConfig.type === 'delete' 
                  ? 'Are you sure you want to delete this session? This action cannot be undone and will remove all session data.'
                  : `Are you sure you want to end the AI session for participant ${modalConfig.participantId?.slice(-8)}? This will stop the AI interaction.`
                }
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                className={`flex-1 px-4 py-2.5 text-white rounded-xl font-medium transition-colors shadow-sm ${
                  modalConfig.type === 'delete' 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-slate-800 hover:bg-slate-900'
                }`}
              >
                {modalConfig.type === 'delete' ? 'Delete' : 'End Session'}
              </button>
            </div>
          </div>
        </div>
      )}

        {/* STATS */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
          <Stat label="Active Sessions" value={activeSessions.length} />
          <Stat
            label="Moderated"
            value={activeSessions.filter(s => s.hasModeratorAssigned).length}
          />
          <Stat
            label="Awaiting Moderator"
            value={activeSessions.filter(s => !s.hasModeratorAssigned).length}
          />
          <Stat
            label="AI Sessions"
            value={activeSessions.filter(s => s.partnerType === 'llm').length}
          />
        </div>
      </main>
    </div>
  );
}

/* ---------- SMALL UI HELPERS ---------- */

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl border p-6 text-center">
      <div className="text-3xl font-bold text-teal-600 mb-1">{value}</div>
      <div className="text-sm text-slate-600">{label}</div>
    </div>
  );
}
