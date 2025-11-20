'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import socketService from '@/lib/socket';

interface Message {
  id: string;
  content: string;
  sender: 'participant' | 'moderator';
  timestamp: Date;
}



// Typing indicator component
const TypingIndicator = () => (
  <div className="flex justify-start">
    <div className="max-w-xs lg:max-w-md px-4 py-3 rounded-lg bg-gray-200 text-gray-900">
      <div className="flex items-center gap-2">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
        <span className="text-xs text-gray-500">Participant is typing...</span>
      </div>
    </div>
  </div>
);

export default function ModeratorChat() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('sessionId');

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isParticipantTyping, setIsParticipantTyping] = useState(false);
  const [participantConnected, setParticipantConnected] = useState(true);
  const [isChatEnded, setIsChatEnded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!sessionId) {
      router.push('/moderator');
      return;
    }

    // Connect to socket
    const socket = socketService.connect();

    socket.on('connect', () => {
      setIsConnected(true);
      socketService.joinAsModerator(sessionId);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen for session join confirmation
    socketService.onSessionJoined((data) => {
      console.log('Moderator joined session:', data);
    });

    // Listen for chat history
    socketService.onChatHistory((history) => {
      setMessages(history.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      })));
    });

    // Listen for new messages
    socketService.onNewMessage((message) => {
      setMessages(prev => [...prev, {
        ...message,
        timestamp: new Date(message.timestamp)
      }]);
    });

    // Listen for typing indicators
    socketService.onUserTyping((data) => {
      if (data.userType === 'participant') {
        setIsParticipantTyping(data.isTyping);
      }
    });

    // Listen for participant disconnect
    socketService.onUserDisconnected((data) => {
      if (data.userType === 'participant') {
        setParticipantConnected(false);
      }
    });

    // Listen for participant left event
    socketService.onParticipantLeft(() => {
      setParticipantConnected(false);
    });

    // Listen for session ended event
    socketService.onSessionEnded(() => {
      console.log('Moderator: Received session-ended event');
      setIsChatEnded(true);
    });

    return () => {
      socketService.disconnect();
    };
  }, [sessionId, router]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = () => {
    if (!inputMessage.trim() || !sessionId) return;

    socketService.sendMessage(sessionId, inputMessage, 'moderator');
    setInputMessage('');

    // Stop typing indicator
    socketService.stopTyping(sessionId, 'moderator');
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);

    if (!sessionId) return;

    // Start typing indicator
    socketService.startTyping(sessionId, 'moderator');

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 1 second of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socketService.stopTyping(sessionId, 'moderator');
    }, 1000);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const goBackToDashboard = () => {
    router.push('/moderator');
  };

  const handleEndChat = () => {
    if (confirm('Are you sure you want to end this chat session? This will close the chat for the participant as well.')) {
      console.log('Moderator: Ending chat for session:', sessionId);
      socketService.endSession(sessionId!);
    }
  };

  const exportChat = () => {
    if (!messages.length) return;

    // Generate CSV content
    const headers = ['Timestamp', 'Sender', 'Message'];
    const csvContent = [
      headers.join(','),
      ...messages.map(msg => {
        const timestamp = msg.timestamp.toLocaleString();
        const sender = msg.sender === 'moderator' ? 'Moderator' : 'Participant';
        // Escape quotes in message content
        const content = `"${msg.content.replace(/"/g, '""')}"`;
        return `${timestamp},${sender},${content}`;
      })
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `chat_export_${sessionId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!sessionId) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={goBackToDashboard}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ←
              </button>
              
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${participantConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">
                  Participant {participantConnected ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
            {!isChatEnded && (
              <button
                onClick={handleEndChat}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
              >
                End Chat
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Chat Interface */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-lg h-[600px] flex flex-col">

          {/* Chat Header */}
          <div className="p-4 border-b bg-gray-50 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">Moderating chat with participant:</span>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${participantConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="font-semibold text-gray-900">
                    Session #{sessionId.slice(-8)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{paddingBottom: '5.5rem'}}>
            {messages.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">💬</div>
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'moderator' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${message.sender === 'moderator'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-900'
                    }`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <p className="text-base whitespace-pre-wrap">{message.content}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className={`text-xs ${message.sender === 'moderator' ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                            {message.sender === 'moderator' ? 'You (Moderator)' : 'Participant'}
                          </span>
                          <span className={`text-xs ${message.sender === 'moderator' ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Typing indicator */}
            {isParticipantTyping && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-8 border-t bg-gray-50 rounded-b-2xl">
            <div className="flex gap-5">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Type your response as the moderator..."
                rows={1}
                className="flex-1 px-8 py-5 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500 text-black text-lg resize-none"
                disabled={!isConnected || !participantConnected}
                style={{minHeight: '60px', maxHeight: '150px', overflow: 'auto'}}
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || !isConnected || !participantConnected}
                className="px-10 py-5 bg-blue-600 text-white rounded-2xl text-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              You are moderating as a human participant. Respond naturally and authentically.
            </p>
          </div>
        </div>

        {/* Moderator Instructions */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-blue-600 text-lg">ℹ️</span>
            <div>
              <h3 className="font-semibold text-blue-800 mb-1">Moderator Guidelines</h3>
              <p className="text-sm text-blue-700">
                Act as a natural human participant. Engage authentically and avoid revealing your moderator role.
                The participant believes they are chatting with another study participant.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {isChatEnded && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
            <div className="text-center">
              <div className="text-5xl mb-4">📝</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Session Ended</h2>
              <p className="text-gray-600 mb-6">
                The chat session has been ended. You can now export the chat history or return to the dashboard.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={exportChat}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <span>⬇️</span> Export Chat (CSV)
                </button>
                <button
                  onClick={goBackToDashboard}
                  className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
