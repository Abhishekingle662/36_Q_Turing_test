// Enable client-side functionality (required for state management, event handlers, and interactivity)
'use client';

// Import React hooks for state management and DOM manipulation
import { useState, useRef, useEffect } from 'react';
// Import Next.js optimized Image component
import Image from 'next/image';
// Import socket service for real-time communication
import socketService from '@/lib/socket';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'human' | 'ai';
  timestamp: Date;
}

interface ParticipantInfo {
  id: string;
  name: string;
  age: number;
  occupation: string;
  location: string;
  interests: string[];
  bio: string;
  profileImage: string;
}

// Bio shown when participant is told their partner is human
const HUMAN_PARTICIPANT_INFO: ParticipantInfo = {
  id: '1',
  name: 'Carolina',
  age: 26,
  occupation: 'Research Assistant',
  location: 'Indianapolis, IN',
  interests: ['Hiking', 'Reading Sci-Fi', 'Coffee Exploration', 'Communication Studies'],
  bio: "I'm a research assistant studying how people communicate and build connections. I enjoy hiking, reading sci-fi, exploring new coffee shops, and I'm looking forward to chatting with you!",
  profileImage: '/female.png'
};

// Bio shown when participant is told their partner is AI
const AI_PARTICIPANT_INFO: ParticipantInfo = {
  id: '2',
  name: 'Carolina',
  age: 26,
  occupation: 'AI Research Assistant',
  location: 'Indianapolis, IN',
  interests: ['Communication Studies', 'Natural Language', 'Conversation Analysis', 'Research'],
  bio: "I'm an AI research assistant designed to have natural conversations as part of a study on how people communicate and build connections. I'm looking forward to chatting with you!",
  profileImage: '/female.png'
};

const TypingIndicator = ({ participantName }: { participantName: string }) => (
  <div className="flex justify-start">
    <div className="max-w-xs lg:max-w-md px-4 py-3 rounded-lg bg-slate-100 text-slate-900">
      <div className="flex items-center gap-2">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
        <span className="text-xs text-slate-500">
          {`${participantName} is typing...`}
        </span>
      </div>
    </div>
  </div>
);

// Main chat page component - handles the conversation interface
export default function ChatPage() {
  // STATE MANAGEMENT: All the reactive data for the chat interface

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  // partnerType = actual partner (human or llm)
  // disclosedType = what the participant is told (human or llm)
  const [partnerType, setPartnerType] = useState<'human' | 'llm'>('human');
  const [disclosedType, setDisclosedType] = useState<'human' | 'llm'>('human');
  const [hasStartedConversation, setHasStartedConversation] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionCountdown, setConnectionCountdown] = useState(5);
  const [hasJoinedSession, setHasJoinedSession] = useState(false);
  const [matchStatusMessage, setMatchStatusMessage] = useState<string>('');

  const [isTyping, setIsTyping] = useState(false);
  const [isModeratorTyping, setIsModeratorTyping] = useState(false);

  const [sessionId, setSessionId] = useState<string>('');
  const [isSessionEnded, setIsSessionEnded] = useState(false);
  const participantIdRef = useRef<string>('');
  const hasStartedRef = useRef(false);
  const hasJoinedRef = useRef(false);

  // Partner info shown to participant — based on disclosedType, not actual partnerType
  const participantInfo = disclosedType === 'llm' ? AI_PARTICIPANT_INFO : HUMAN_PARTICIPANT_INFO;

  // DOM REFERENCES: For direct DOM manipulation
  // Reference to scroll to bottom of messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Reference to the input field for focus management
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Reference for typing timeout
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // UTILITY FUNCTIONS

  // Automatically scroll to the bottom of the chat when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Effect hook: runs scrollToBottom whenever messages array changes
  useEffect(() => {
    scrollToBottom();
  }, [messages]); // Dependency array - only re-run when messages change

  // Socket connection and event setup
  useEffect(() => {
    hasStartedRef.current = hasStartedConversation;
  }, [hasStartedConversation]);

  useEffect(() => {
    hasJoinedRef.current = hasJoinedSession;
  }, [hasJoinedSession]);

  useEffect(() => {
    // Connect to socket server
    const socket = socketService.connect();

    socket.on('connect', () => {
      setIsConnected(true);
      // Get or create persistent participant ID
      let participantId = sessionStorage.getItem('participantId');
      if (!participantId) {
        participantId = `participant_${Date.now()}`;
        sessionStorage.setItem('participantId', participantId);
      }
      participantIdRef.current = participantId;
      if (hasStartedRef.current && !hasJoinedRef.current) {
        socketService.joinAsParticipant(participantId);
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen for session join confirmation
    socketService.onSessionJoined((data) => {
      if (data.userType === 'participant') {
        setSessionId(data.sessionId);
        setHasJoinedSession(true);
        if (data.partnerType) {
          setPartnerType(data.partnerType);
        }
        // Use disclosedType (what participant is told) for UI display
        const disclosed = data.disclosedType || data.partnerType || 'human';
        setDisclosedType(disclosed);
        // Build welcome message based on disclosed type
        const partnerLabel = disclosed === 'llm'
          ? 'an AI research assistant'
          : 'another human participant';
        const welcomeContent =
          `You have been paired with ${partnerLabel} for this conversation.\n\n` +
          `In this study, you and your conversation partner will take turns asking and answering a series of questions designed to help people get to know each other. ` +
          `Please engage naturally and be open in your responses.\n\n` +
          `To get started, type a message below to say hello to your partner!`;

        setMessages(prev => {
          const hasWelcome = prev.some(m => m.id === 'welcome');
          if (hasWelcome) return prev;
          return [{
            id: 'welcome',
            content: welcomeContent,
            sender: 'human' as const,
            timestamp: new Date(),
          }, ...prev];
        });

        setMatchStatusMessage(
          disclosed === 'llm'
            ? 'You are chatting with an AI research assistant.'
            : 'You are chatting with another human participant.'
        );
      }
    });

    // Listen for new messages from moderator
    socketService.onNewMessage((message) => {
      if (message.sender === 'moderator') {
        setMessages(prev => {
          // Check if message already exists to prevent duplicates
          const messageExists = prev.some(m => m.id === message.id);
          if (messageExists) {
            return prev;
          }
          return [...prev, {
            id: message.id,
            content: message.content,
            sender: 'human', // Show as human to participant
            timestamp: new Date(message.timestamp)
          }];
        });
      }
    });

    // Listen for moderator typing
    socketService.onUserTyping((data) => {
      if (data.userType === 'moderator') {
        setIsModeratorTyping(data.isTyping);
      }
    });

    // Listen for chat history when rejoining
    socketService.onChatHistory((messages) => {
      const formattedMessages: Message[] = messages.map((msg: { id: string; content: string; sender: string; timestamp: string | Date }) => ({
        id: msg.id,
        content: msg.content,
        sender: msg.sender === 'participant' ? 'user' : msg.sender === 'moderator' ? 'human' : 'ai',
        timestamp: new Date(msg.timestamp)
      }));
      setMessages(prev => {
        const welcomeMsg = prev.find(m => m.id === 'welcome');
        const existingIds = new Set(prev.map(m => m.id));
        const newMessages = formattedMessages.filter(m => !existingIds.has(m.id));
        return welcomeMsg ? [welcomeMsg, ...newMessages] : newMessages;
      });
    });

    // Listen for session ended event
    socketService.onSessionEnded(() => {
      setIsSessionEnded(true);
    });

    return () => {
      socketService.disconnect();
    };
  }, []);

  // Handle page unload/refresh - mark session as inactive
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Don't clear session storage on refresh, only on actual navigation away
      if (sessionId) {
        socketService.leaveSession(sessionId);
      }
    };

    const handleUnload = () => {
      if (sessionId) {
        socketService.leaveSession(sessionId);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, [sessionId]);

  const sendMessage = () => {
    if (!inputMessage.trim() || !hasJoinedSession) return;

    // Generate unique ID using timestamp + random + counter
    const uniqueId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${messages.length}`;
    const newMessage: Message = {
      id: uniqueId,
      content: inputMessage,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);

    // Send message through socket
    if (sessionId) {
      socketService.sendMessage(sessionId, inputMessage, 'participant');
    }

    setInputMessage('');

    // Stop typing indicator
    if (sessionId) {
      socketService.stopTyping(sessionId, 'participant');
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
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
    socketService.startTyping(sessionId, 'participant');

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 1 second of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socketService.stopTyping(sessionId, 'participant');
    }, 1000);
  };

  const handleStartConversation = () => {
    if (hasStartedConversation || isConnecting) return;
    setIsConnecting(true);
    setConnectionCountdown(5);
    setMatchStatusMessage('Pairing you with another participant...');

    let remaining = 5;
    const countdownInterval = setInterval(() => {
      remaining -= 1;
      setConnectionCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownInterval);
      }
    }, 1000);

    setTimeout(() => {
      clearInterval(countdownInterval);
      setIsConnecting(false);
      setHasStartedConversation(true);
      if (participantIdRef.current) {
        socketService.joinAsParticipant(participantIdRef.current);
      } else if (isConnected) {
        let participantId = sessionStorage.getItem('participantId');
        if (!participantId) {
          participantId = `participant_${Date.now()}`;
          sessionStorage.setItem('participantId', participantId);
        }
        participantIdRef.current = participantId;
        socketService.joinAsParticipant(participantId);
      }
    }, 5000);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // RENDER: The main component JSX
  return (
    // Main page container with slate background
    <div className="h-screen bg-slate-50 font-sans overflow-hidden flex flex-col">

      {/* HEADER SECTION: Top navigation bar */}
      <header className="bg-white shadow-sm border-b border-slate-200 flex-none">
        <div className="max-w-6xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">

            {/* Left side: Logo and title */}
            <div className="flex items-center gap-3">
              
              {/* Title and subtitle */}
              <div>
                <h1 className="text-xl font-bold text-slate-900 font-display">Research Study Chat</h1>
                <p className="text-sm text-slate-600">Conversation Interface</p>
              </div>
            </div>

            {/* Right side: Status indicator and exit button */}
            <div className="flex items-center gap-4">
              {/* Connection status indicator */}
              <div className="flex items-center gap-2">
                {/* Status dot - green if connected, red if not */}
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-teal-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-slate-600">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {/* Exit button - returns to landing page */}
              <button
                onClick={() => {
                  // Clean up session before leaving
                  if (sessionId) {
                    socketService.leaveSession(sessionId);
                  }
                  // Clear session storage
                  sessionStorage.removeItem('participantId');
                  window.location.href = '/';
                }}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm"
              >
                Exit Study
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="max-w-7xl mx-auto px-4 py-4 flex-1 flex flex-col min-h-0 w-full">
        <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">

          {/* Participant Information Panel */}
          <div className="hidden lg:block w-80 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex-shrink-0 overflow-y-auto">
            <div className="text-center mb-6">
              <div className="relative w-24 h-24 mx-auto mb-4">
                <Image
                  src={participantInfo.profileImage}
                  alt={`${participantInfo.name}'s profile`}
                  width={96}
                  height={96}
                  className="rounded-full object-cover border-4 border-slate-100"
                />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1 font-display">{participantInfo.name}</h2>
              <p className="text-sm text-slate-600">{participantInfo.age} years old</p>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Occupation</h3>
                <p className="text-sm text-slate-700 font-medium">{participantInfo.occupation}</p>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Location</h3>
                <p className="text-sm text-slate-700 font-medium">{participantInfo.location}</p>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Interests</h3>
                <div className="flex flex-wrap gap-2">
                  {participantInfo.interests.map((interest, index) => (
                    <span
                      key={index}
                      className="px-2.5 py-1 bg-teal-50 text-teal-700 text-xs font-medium rounded-full border border-teal-100"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">About</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{participantInfo.bio}</p>
              </div>
            </div>
          </div>

          {/* Main Chat Interface */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden min-h-0">

            {/* Chat Controls */}
            <div className="p-4 border-b border-slate-100 bg-white flex-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-500">Chatting with:</span>
                    <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${hasJoinedSession ? 'bg-teal-500' : 'bg-slate-300'}`}></div>
                    <span className="font-bold text-slate-900">
                      {participantInfo.name}
                    </span>
                    {hasJoinedSession && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${disclosedType === 'llm' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'}`}>
                        {disclosedType === 'llm' ? 'AI Participant' : 'Human Participant'}
                      </span>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* MESSAGES AREA: Scrollable chat messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 relative bg-slate-50/50">
              {(!hasStartedConversation || isConnecting) && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-8 max-w-md text-center space-y-6">
                    <div className="flex justify-center text-teal-600">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2 font-display">
                        {isConnecting ? 'Pairing You Now' : 'Ready to Start?'}
                      </h3>
                      <p className="text-slate-600 leading-relaxed">
                        {isConnecting
                          ? 'Matching you with a conversation partner. This can take up to 5 seconds.'
                          : 'When you start, we will connect you with a conversation partner. You will then take turns asking and answering questions designed to help people get to know each other.'}
                      </p>
                    </div>
                    
                    {isConnecting ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="text-3xl font-mono text-teal-600 font-bold">{connectionCountdown > 0 ? connectionCountdown : 0}</div>
                        <p className="text-sm text-slate-500">Finding your conversation partner...</p>
                      </div>
                    ) : (
                      <button
                        onClick={handleStartConversation}
                        className="w-full px-6 py-3.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                      >
                        Start Conversation
                      </button>
                    )}
                    <p className="text-xs text-slate-400">
                      All chats are recorded for research purposes.
                    </p>
                  </div>
                </div>
              )}
              {/* Map through all messages and render each one */}
              {messages.map((message) => (
                <div
                  key={message.id} // Unique key for React rendering
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`} // Align user messages right, others left
                >
                  {/* Message bubble */}
                  <div className={`max-w-[85%] lg:max-w-[75%] px-5 py-3.5 rounded-2xl shadow-sm ${message.sender === 'user'
                    ? 'bg-teal-600 text-white rounded-br-none'      // User messages: teal background
                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'   // Participant messages: white background with border
                    }`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        {/* Message content */}
                        <p className="text-base leading-relaxed">{message.content}</p>

                        {/* Message metadata: sender and timestamp */}
                        <div className={`flex items-center justify-between mt-2 text-xs ${message.sender === 'user' ? 'text-teal-100/80' : 'text-slate-400'}`}>
                          {/* Sender label */}
                          <span>
                            {message.sender === 'user' ? 'You' : 'Participant'} {/* Anonymous labeling */}
                          </span>
                          {/* Timestamp */}
                          <span>
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Typing indicators */}
              {isTyping && <TypingIndicator participantName={participantInfo.name} />}
              {isModeratorTyping && (
                <TypingIndicator participantName={participantInfo.name} />
              )}

              {/* Invisible div for auto-scrolling to bottom */}
              <div ref={messagesEndRef} />
            </div>

            {/* INPUT AREA: Message composition and send */}
            <div className="p-4 border-t border-slate-200 bg-white flex-none">
              {/* Input row: text field and send button */}
              <div className="flex gap-3">
                {/* Text input field */}
                <textarea
                  ref={inputRef}                                    // Reference for focus management
                  value={inputMessage}                              // Controlled input - synced with state
                  onChange={handleInputChange}                     // Update state and handle typing indicators
                  onKeyPress={handleKeyPress}                      // Handle Enter key press
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 placeholder-slate-400 text-slate-900 resize-none transition-all"
                  rows={1}
                  disabled={!isConnected || isSessionEnded}                          // Disable if not connected or session ended
                />
                {/* Send button */}
                <button
                  onClick={sendMessage}                            // Send message on click
                  disabled={!inputMessage.trim() || !isConnected || isSessionEnded} // Disable if empty or disconnected or session ended
                  className="px-6 py-3 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  Send
                </button>
              </div>
              {/* Help text for users */}
              <div className="flex justify-between items-center mt-2 px-1">
                <p className="text-xs text-slate-400">
                  Press Enter to send • Shift+Enter for new line
                </p>
                <p className="text-xs text-slate-400">
                  {matchStatusMessage || 'Click "Start Conversation" to be paired with a conversation partner.'}
                </p>
              </div>
            </div>
          </div> {/* End Main Chat Interface */}
        </div> {/* End flex container */}

        {/* STUDY INFORMATION: Important notice about research */}
        <div className="mt-4 p-4 bg-slate-100 border border-slate-200 rounded-xl flex-none">
          <div className="flex items-start gap-3">
            {/* Warning icon */}
            <div className="bg-white p-1.5 rounded-lg shadow-sm text-slate-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
            </div>
            <div>
              {/* Notice title */}
              <h3 className="font-semibold text-slate-900 mb-1 text-sm">Research Study Notice</h3>
              {/* Important information for participants */}
              <p className="text-sm text-slate-600 leading-relaxed">
                This conversation is being recorded for research purposes. Please engage naturally and respectfully.
                You have been paired with another participant for this study.
                You can exit at any time by clicking the &quot;Exit Study&quot; button above.
              </p>
            </div>
          </div>
        </div>
      </div> {/* End chat area */}

      {/* Session Ended Modal */}
      {isSessionEnded && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl text-center border border-slate-200">
            <div className="text-5xl mb-6">🛑</div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3 font-display">Session Ended</h2>
            <p className="text-slate-600 mb-8 leading-relaxed">
              The moderator has ended this chat session. Thank you for your participation.
            </p>
            <button
              onClick={() => {
                if (sessionId) {
                  socketService.leaveSession(sessionId);
                }
                sessionStorage.removeItem('participantId');
                window.location.href = '/';
              }}
              className="w-full px-6 py-3.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-colors shadow-md"
            >
              Return to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
