'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import socketService from '@/lib/socket';
import Image from 'next/image';

interface ActiveSession {
  sessionId: string;
  participantId: string;
  hasModeratorAssigned: boolean;
  messageCount: number;
}

export default function ModeratorDashboard() {
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
      setActiveSessions(sessions);
    });

    // Listen for new participants
    socketService.onParticipantJoined((data) => {
      socketService.getActiveSessions(); // Refresh the list
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
    // Clear inactive sessions and get updated active sessions
    socketService.clearInactiveSessions();
    
    // Reset refreshing state after a delay
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image 
                src="/Indiana_Hoosiers_logo.svg" 
                alt="Indiana University Logo" 
                width={32} 
                height={40}
              />
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
            Monitor and join active participant sessions. Click "Join Chat" to start moderating a conversation.
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
            activeSessions.map((session) => (
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

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Messages:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {session.messageCount}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Status:</span>
                      <span className="text-sm font-medium text-green-600">
                        Active
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleJoinSession(session.sessionId)}
                    className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                      session.hasModeratorAssigned
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                    disabled={session.hasModeratorAssigned}
                  >
                    {session.hasModeratorAssigned ? 'Already Moderated' : 'Join Chat'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Statistics */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
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
        </div>
      </div>
    </div>
  );
}
