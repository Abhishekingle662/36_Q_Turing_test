'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'human' | 'ai';
  timestamp: Date;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Welcome to the research study conversation interface. You have been paired with another participant. Please be respectful and engage naturally in the conversation.',
      sender: 'ai',
      timestamp: new Date(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(true);
  const [participantType, setParticipantType] = useState<'human' | 'ai'>('human');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = () => {
    if (!inputMessage.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');

    // Simulate response after a delay
    setTimeout(() => {
      const responseMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: generateResponse(inputMessage, participantType),
        sender: participantType,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, responseMessage]);
    }, 1000 + Math.random() * 2000);
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

  const switchParticipant = () => {
    setParticipantType(prev => prev === 'human' ? 'ai' : 'human');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image 
                src="/Indiana_Hoosiers_logo.svg" 
                alt="Indiana University Logo" 
                width={32} 
                height={40}
              />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Research Study Chat</h1>
                <p className="text-sm text-gray-600">Conversation Interface</p>
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
                onClick={() => window.location.href = '/'}
                className="btn btn-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Exit Study
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-lg h-[600px] flex flex-col">
          
          {/* Chat Controls */}
          <div className="p-4 border-b bg-gray-50 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">Connected to:</span>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="font-semibold text-gray-900">
                    Participant
                  </span>
                </div>
              </div>
              <button
                onClick={switchParticipant}
                className="btn btn-outline text-xs px-3 py-1"
                style={{display: 'none'}}
              >
                Switch Participant
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div                 className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                  message.sender === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-900'
                }`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-sm">{message.content}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-xs ${
                          message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {message.sender === 'user' ? 'You' : 'Participant'}
                        </span>
                        <span className={`text-xs ${
                          message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t bg-gray-50 rounded-b-lg">
            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500 text-black"
                disabled={!isConnected}
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || !isConnected}
                className="btn btn-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Press Enter to send • Shift+Enter for new line • Be respectful and engage naturally
            </p>
          </div>
        </div>

        {/* Study Information */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-yellow-600 text-lg">⚠️</span>
            <div>
              <h3 className="font-semibold text-yellow-800 mb-1">Research Study Notice</h3>
              <p className="text-sm text-yellow-700">
                This conversation is being recorded for research purposes. Please engage naturally and respectfully. 
                You have been paired with another participant for this study. 
                You can exit at any time by clicking the "Exit Study" button above.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
