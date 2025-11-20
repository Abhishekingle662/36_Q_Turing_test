// Enable client-side functionality (required for state management, event handlers, and interactivity)
'use client';

// Import React hooks for state management and DOM manipulation
import { useState, useRef, useEffect } from 'react';
// Import Next.js optimized Image component
import Image from 'next/image';
// Import socket service for real-time communication
import socketService from '@/lib/socket';

// TypeScript interface defining the structure of a chat message
interface Message {
  id: string;                           // Unique identifier for each message
  content: string;                      // The actual message text
  sender: 'user' | 'human' | 'ai';     // Who sent the message (user, human participant, or AI)
  timestamp: Date;                      // When the message was sent
}

// TypeScript interface for participant information (database structure)
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

// Typing indicator component for showing when someone is typing
const TypingIndicator = ({ sender, participantName }: { sender: 'human' | 'ai'; participantName: string }) => (
  <div className="flex justify-start">
    <div className="max-w-xs lg:max-w-md px-4 py-3 rounded-lg bg-gray-200 text-gray-900">
      <div className="flex items-center gap-2">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
        <span className="text-xs text-gray-500">
          {sender === 'ai' ? 'Chatbot is typing...' : `${participantName} is typing...`}
        </span>
      </div>
    </div>
  </div>
);

// Main chat page component - handles the conversation interface
export default function ChatPage() {
  // STATE MANAGEMENT: All the reactive data for the chat interface

  // Array of all chat messages, initialized with a welcome message
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Welcome to the research study conversation interface. You have been paired with another participant. Please be respectful and engage naturally in the conversation.',
      sender: 'ai',
      timestamp: new Date(),
    }
  ]);

  // Current text in the input field
  const [inputMessage, setInputMessage] = useState('');

  // Connection status (for UI feedback)
  const [isConnected, setIsConnected] = useState(false);

  // Type of participant user is chatting with (hidden from user for anonymity)
  const [participantType, setParticipantType] = useState<'human' | 'ai'>('human');

  // Typing indicators for more human-like interaction
  const [isTyping, setIsTyping] = useState(false);
  const [isModeratorTyping, setIsModeratorTyping] = useState(false);

  // Socket-related state
  const [sessionId, setSessionId] = useState<string>('');
  const [moderatorConnected, setModeratorConnected] = useState(false);
  const [isSessionEnded, setIsSessionEnded] = useState(false);

  // Mock participant data (will be fetched from database in production)
  const [participantInfo] = useState<ParticipantInfo>({
    id: '1',
    name: 'Alex Johnson',
    age: 28,
    occupation: 'Software Engineer',
    location: 'Indianapolis, IN',
    interests: ['Technology', 'Reading', 'Hiking', 'Photography'],
    bio: 'I enjoy discussing technology trends and outdoor activities. Always curious about new ideas and perspectives.',
    profileImage: '/male.png'
  });

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
      socketService.joinAsParticipant(participantId);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen for session join confirmation
    socketService.onSessionJoined((data) => {
      if (data.userType === 'participant') {
        setSessionId(data.sessionId);
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

    // Listen for moderator connection status
    socketService.onModeratorJoined(() => {
      setModeratorConnected(true);
    });

    socketService.onModeratorLeft(() => {
      setModeratorConnected(false);
    });

    // Listen for chat history when rejoining
    socketService.onChatHistory((messages) => {
      const formattedMessages = messages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        sender: msg.sender === 'participant' ? 'user' : (msg.sender === 'moderator' ? 'human' : msg.sender),
        timestamp: new Date(msg.timestamp)
      }));
      // Replace messages (keep only welcome message if it exists, then add history)
      setMessages(prev => {
        const welcomeMsg = prev.find(m => m.id === '1'); // Keep welcome message
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
    if (!inputMessage.trim()) return;

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

    if (participantType === 'ai') {
      // Fallback to AI simulation if no moderator
      setIsTyping(true);
      setTimeout(() => {
        // Generate unique ID for AI response
        const aiUniqueId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_ai_${messages.length + 1}`;
        const responseMessage: Message = {
          id: aiUniqueId,
          content: generateResponse(inputMessage, participantType),
          sender: participantType,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, responseMessage]);
        setIsTyping(false);
      }, 1000 + Math.random() * 2000);
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

  const generateResponse = (userMessage: string, type: 'human' | 'ai'): string => {
    if (type === 'ai') {
      const responses = [
        "That's an interesting perspective. Can you tell me more about what led you to think that way?",
        "I appreciate you sharing that. How do you think this relates to your personal experiences?",
        "Thank you for being so open. What aspects of this topic do you find most compelling?",
        "That's a thoughtful point. Have you noticed any patterns in how you approach similar situations?",
        "I find your viewpoint fascinating. Could you elaborate on the reasoning behind it?",
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    } else {
      const responses = [
        "Yeah, I can see what you mean. I've had similar experiences myself.",
        "That's really interesting! I never thought about it that way before.",
        "Hmm, that's a good point. Do you think most people would agree with that?",
        "I appreciate you sharing that. It reminds me of something that happened to me recently.",
        "That's so true! I've been thinking about similar things lately.",
      ];
      return responses[Math.floor(Math.random() * responses.length)];
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

  const switchParticipant = () => {
    setParticipantType(prev => prev === 'human' ? 'ai' : 'human');
    // Reset typing indicators when switching
    setIsTyping(false);
    setIsModeratorTyping(false);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // RENDER: The main component JSX
  return (
    // Main page container with gradient background
    <div className="min-h-screen gradient-bg">

      {/* HEADER SECTION: Top navigation bar */}
      <header className="bg-white shadow-sm border-b">
  <div className="max-w-6xl mx-auto px-8 py-10">
          <div className="flex items-center justify-between">

            {/* Left side: Logo and title */}
            <div className="flex items-center gap-3">
              {/* IU Logo */}
              <Image
                src="/Indiana_Hoosiers_logo.svg"
                alt="Indiana University Logo"
                width={32}
                height={40}
              />
              {/* Title and subtitle */}
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Research Study Chat</h1>
                <p className="text-sm text-gray-600">Conversation Interface</p>
              </div>
            </div>

            {/* Right side: Status indicator and exit button */}
            <div className="flex items-center gap-4">
              {/* Connection status indicator */}
              <div className="flex items-center gap-2">
                {/* Status dot - green if connected, red if not */}
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">
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
                className="btn btn-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Exit Study
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6 h-[600px]">

          {/* Participant Information Panel */}
          <div className="w-80 bg-white rounded-lg shadow-lg p-6 flex-shrink-0">
            <div className="text-center mb-6">
              <div className="relative w-24 h-24 mx-auto mb-4">
                <Image
                  src={participantInfo.profileImage}
                  alt={`${participantInfo.name}'s profile`}
                  width={96}
                  height={96}
                  className="rounded-full object-cover border-4 border-gray-200"
                />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">{participantInfo.name}</h2>
              <p className="text-sm text-gray-600">{participantInfo.age} years old</p>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Occupation</h3>
                <p className="text-sm text-gray-600">{participantInfo.occupation}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Location</h3>
                <p className="text-sm text-gray-600">{participantInfo.location}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Interests</h3>
                <div className="flex flex-wrap gap-2">
                  {participantInfo.interests.map((interest, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">About</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{participantInfo.bio}</p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Online now
              </div>
            </div>
          </div>

          {/* Main Chat Interface */}
          <div className="flex-1 bg-white rounded-lg shadow-lg flex flex-col">

            {/* Chat Controls */}
            <div className="p-4 border-b bg-gray-50 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Chatting with:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="font-semibold text-gray-900">
                      {participantInfo.name}
                    </span>
                  </div>
                </div>
                <button
                  onClick={switchParticipant}
                  className="btn btn-outline text-xs px-3 py-1"
                  style={{ display: 'none' }}
                >
                  Switch Participant
                </button>
              </div>
            </div>

            {/* MESSAGES AREA: Scrollable chat messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Map through all messages and render each one */}
              {messages.map((message) => (
                <div
                  key={message.id} // Unique key for React rendering
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`} // Align user messages right, others left
                >
                  {/* Message bubble */}
                  <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${message.sender === 'user'
                    ? 'bg-blue-400 text-white'      // User messages: blue background
                    : 'bg-gray-200 text-gray-900'   // Participant messages: gray background
                    }`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        {/* Message content */}
                        <p className="text-sm">{message.content}</p>

                        {/* Message metadata: sender and timestamp */}
                        <div className="flex items-center justify-between mt-2">
                          {/* Sender label */}
                          <span className={`text-xs ${message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                            {message.sender === 'user' ? 'You' : 'Participant'} {/* Anonymous labeling */}
                          </span>
                          {/* Timestamp */}
                          <span className={`text-xs ${message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Typing indicators */}
              {isTyping && <TypingIndicator sender="ai" participantName={participantInfo.name} />}
              {isModeratorTyping && <TypingIndicator sender="human" participantName={participantInfo.name} />}

              {/* Invisible div for auto-scrolling to bottom */}
              <div ref={messagesEndRef} />
            </div>

            {/* INPUT AREA: Message composition and send */}
            <div className="p-4 border-t bg-gray-50 rounded-b-lg">
              {/* Input row: text field and send button */}
              <div className="flex gap-3">
                {/* Text input field */}
                <input
                  ref={inputRef}                                    // Reference for focus management
                  type="text"
                  value={inputMessage}                              // Controlled input - synced with state
                  onChange={handleInputChange}                     // Update state and handle typing indicators
                  onKeyPress={handleKeyPress}                      // Handle Enter key press
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-transparent placeholder-gray-500 text-black"
                  disabled={!isConnected || isSessionEnded}                          // Disable if not connected or session ended
                />
                {/* Send button */}
                <button
                  onClick={sendMessage}                            // Send message on click
                  disabled={!inputMessage.trim() || !isConnected || isSessionEnded} // Disable if empty or disconnected or session ended
                  className="btn btn-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
              {/* Help text for users */}
              <p className="text-xs text-gray-500 mt-2">
                Press Enter to send • Shift+Enter for new line • Be respectful and engage naturally
              </p>
            </div>
          </div> {/* End Main Chat Interface */}
        </div> {/* End flex container */}

        {/* STUDY INFORMATION: Important notice about research */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-3">
            {/* Warning icon */}
            <span className="text-yellow-600 text-lg">⚠️</span>
            <div>
              {/* Notice title */}
              <h3 className="font-semibold text-yellow-800 mb-1">Research Study Notice</h3>
              {/* Important information for participants */}
              <p className="text-sm text-yellow-700">
                This conversation is being recorded for research purposes. Please engage naturally and respectfully.
                You have been paired with another participant for this study.
                You can exit at any time by clicking the "Exit Study" button above.
              </p>
            </div>
          </div>
        </div>
      </div> {/* End chat area */}

      {/* Session Ended Modal */}
      {isSessionEnded && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-xl text-center">
            <div className="text-5xl mb-4">🛑</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Session Ended</h2>
            <p className="text-gray-600 mb-6">
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
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
