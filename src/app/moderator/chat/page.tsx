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
             
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Moderator Chat Interface</h1>
                <p className="text-sm text-gray-600">Session #{sessionId.slice(-8)}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${participantConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">
                  Participant {participantConnected ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Interface */}
      <div className="max-w-6xl mx-auto px-8 py-10">
        <div className="bg-white rounded-2xl shadow-2xl h-[800px] flex flex-col">
          
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
                  <div className={`max-w-md lg:max-w-2xl px-8 py-5 rounded-2xl text-lg ${
                    message.sender === 'moderator'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-900'
                  }`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <p className="text-base whitespace-pre-wrap">{message.content}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className={`text-xs ${
                            message.sender === 'moderator' ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {message.sender === 'moderator' ? 'You (Moderator)' : 'Participant'}
                          </span>
                          <span className={`text-xs ${
                            message.sender === 'moderator' ? 'text-blue-100' : 'text-gray-500'
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
            {/* Always keep the bottom in view, including when typing */}
            <div ref={messagesEndRef} style={{height: '1px'}} />
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

        
      </div>
    </div>
  );
}
