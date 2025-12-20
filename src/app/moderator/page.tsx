'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import socketService from '@/lib/socket';

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
  const router = useRouter();

  useEffect(() => {
    // Connect to socket server
    const socket = socketService.connect();
    
    socket.on('connect', () => {
      setIsConnected(true);
      socketService.getActiveSessions();
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen for active sessions
    socketService.onActiveSessions((sessions) => {
      console.log('Received active sessions:', sessions);
      setActiveSessions(sessions);
    });

    // Listen for new participants
    socketService.onParticipantJoined(() => {
      socketService.getActiveSessions(); // Refresh the list
    });

    // Listen for participant reconnections
    socketService.onParticipantRejoined(() => {
      socketService.getActiveSessions(); // Refresh the list
    });

    // Listen for participant disconnections
    socketService.onParticipantLeft(() => {
      socketService.getActiveSessions(); // Refresh the list
    });

    // Listen for user disconnections
    socketService.onUserDisconnected((data) => {
      if (data.userType === 'participant') {
        socketService.getActiveSessions(); // Refresh the list
      }
    });

    // Listen for session deletion success
    socketService.onSessionDeleted((data) => {
      console.log('Session deleted successfully:', data);
      setDeletingSession(null);
      socketService.getActiveSessions(); // Refresh the list
    });

    // Listen for session deletion errors
    socketService.onDeleteError((data) => {
      console.log('Session deletion error:', data);
      setDeletingSession(null);
      alert(`Error deleting session: ${data.error}`);
    });

    // Cleanup on unmount
    return () => {
      socketService.disconnect();
    };
  }, []);

  const handleJoinSession = (sessionId: string) => {
    router.push(`/moderator/chat?sessionId=${sessionId}`);
  };

  const refreshSessions = () => {
    setIsRefreshing(true);
    // Just get updated active sessions without clearing
    socketService.getActiveSessions();
    
    // Reset refreshing state after a delay
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const handleDeleteSession = (sessionId: string) => {
    console.log('Delete session clicked for:', sessionId);
    if (confirm('Are you sure you want to delete this inactive session? This action cannot be undone.')) {
      console.log('Deletion confirmed, sending delete request for:', sessionId);
      setDeletingSession(sessionId);
      socketService.deleteSession(sessionId);
    } else {
      console.log('Deletion cancelled for:', sessionId);
    }
  };

  const handleEndAISession = (sessionId: string, participantId: string) => {
    if (confirm(`Are you sure you want to end this AI session?\n\nSession: ${sessionId.slice(-8)}\nParticipant: ${participantId.slice(-8)}\n\nAll chat data will be automatically exported before ending.`)) {
      console.log('Ending AI session:', sessionId);
      socketService.endSession(sessionId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Moderator Dashboard</h1>
                <p className="text-sm text-gray-600">Research Study Chat Moderation</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <button 
                onClick={refreshSessions}
                disabled={isRefreshing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Active Chat Sessions</h2>
          <p className="text-gray-600">
            Monitor and join active participant sessions. Sessions marked as AI are handled automatically by the LLM participant.
          </p>
        </div>

        {/* Sessions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeSessions.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">💬</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Sessions</h3>
              <p className="text-gray-600">
                Waiting for participants to join. Sessions will appear here automatically.
              </p>
            </div>
          ) : (
            activeSessions.map((session) => {
              const isLLMSession = session.partnerType === 'llm';
              return (
              <div
                key={session.sessionId}
                className="bg-white rounded-lg shadow-md border hover:shadow-lg transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        Session #{session.sessionId.slice(-8)}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Participant: {session.participantId.slice(-8)}
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      session.hasModeratorAssigned 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {session.hasModeratorAssigned ? 'Moderated' : 'Available'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm text-gray-500">Partner Type:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${isLLMSession ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {isLLMSession ? 'AI Participant' : 'Human Participant'}
                    </span>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Messages:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {session.messageCount}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Status:</span>
                      <span className={`text-sm font-medium ${
                        session.status === 'active' 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {session.status === 'active' ? 'Online' : 'Disconnected'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {session.status === 'inactive' ? (
                      <button
                        onClick={() => handleJoinSession(session.sessionId)}
                        className="w-full py-2 px-4 rounded-lg font-medium bg-red-100 text-red-500 cursor-not-allowed"
                        disabled={true}
                      >
                        Participant Disconnected
                      </button>
                    ) : isLLMSession ? (
                      <>
                        <button
                          onClick={() => handleJoinSession(session.sessionId)}
                          className="w-full py-2 px-4 rounded-lg font-medium transition-colors bg-purple-100 text-purple-700 hover:bg-purple-200"
                        >
                          👁️ View AI Session
                        </button>
                        <button
                          onClick={() => handleEndAISession(session.sessionId, session.participantId)}
                          className="w-full py-2 px-4 rounded-lg font-medium transition-colors bg-purple-600 text-white hover:bg-purple-700"
                        >
                          🤖 End AI Session
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleJoinSession(session.sessionId)}
                        className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                          session.hasModeratorAssigned
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                        disabled={session.hasModeratorAssigned}
                      >
                        {session.hasModeratorAssigned
                          ? 'Already Moderated'
                          : 'Join Chat'}
                      </button>
                    )}
                    
                    {/* Always show delete button for testing */}
                    <button
                      onClick={() => handleDeleteSession(session.sessionId)}
                      disabled={deletingSession === session.sessionId}
                      className={`w-full py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        session.status === 'inactive' 
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-orange-600 text-white hover:bg-orange-700'
                      }`}
                    >
                      {deletingSession === session.sessionId ? 'Deleting...' : `Delete Session (${session.status})`}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
          )}
        </div>

        {/* Statistics */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-2xl font-bold text-blue-600 mb-2">
              {activeSessions.length}
            </div>
            <div className="text-sm text-gray-600">Total Active Sessions</div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-2xl font-bold text-green-600 mb-2">
              {activeSessions.filter(s => s.hasModeratorAssigned).length}
            </div>
            <div className="text-sm text-gray-600">Sessions Being Moderated</div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-2xl font-bold text-yellow-600 mb-2">
              {activeSessions.filter(s => !s.hasModeratorAssigned).length}
            </div>
            <div className="text-sm text-gray-600">Sessions Awaiting Moderator</div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-2xl font-bold text-purple-600 mb-2">
              {activeSessions.filter(s => s.partnerType === 'llm').length}
            </div>
            <div className="text-sm text-gray-600">AI-Managed Sessions</div>
          </div>
        </div>
      </div>
    </div>
  );
}
