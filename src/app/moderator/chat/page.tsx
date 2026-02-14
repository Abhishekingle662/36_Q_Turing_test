'use client';

import { Suspense, useState, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import socketService from '@/lib/socket';

import {
  ArrowLeftIcon,
  SignalIcon,
  CpuChipIcon,
  UserIcon,
  PaperAirplaneIcon,
  StopCircleIcon,
  ArrowDownTrayIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

/* ---------- TYPES ---------- */

interface Message {
  id: string;
  content: string;
  sender: 'participant' | 'moderator';
  timestamp: Date;
}

/* ---------- TYPING INDICATOR ---------- */

const TypingIndicator = () => (
  <div className="flex justify-start">
    <div className="bg-slate-100 rounded-xl px-4 py-2 text-sm text-slate-600 flex items-center gap-2">
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
      Participant is typing…
    </div>
  </div>
);

/* ---------- MAIN CONTENT ---------- */

function ModeratorChatContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('sessionId');

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isParticipantTyping, setIsParticipantTyping] = useState(false);
  const [participantConnected, setParticipantConnected] = useState(true);
  const [isChatEnded, setIsChatEnded] = useState(false);
  const [partnerType, setPartnerType] = useState<'human' | 'llm'>('human');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  /* ---------- SOCKET ---------- */

  useEffect(() => {
    if (!sessionId) {
      router.push('/moderator');
      return;
    }

    const socket = socketService.connect();

    socket.on('connect', () => {
      setIsConnected(true);
      socketService.joinAsModerator(sessionId);
    });

    socket.on('disconnect', () => setIsConnected(false));

    socketService.onSessionJoined((data) => {
      if (data.partnerType) setPartnerType(data.partnerType);
    });

    socketService.onChatHistory(history => {
      setMessages(
        history.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }))
      );
    });

    socketService.onNewMessage(msg => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [
          ...prev,
          { ...msg, timestamp: new Date(msg.timestamp) },
        ];
      });
    });

    socketService.onUserTyping(data => {
      if (data.userType === 'participant') {
        setIsParticipantTyping(data.isTyping);
      }
    });

    socketService.onParticipantLeft(() => setParticipantConnected(false));
    socketService.onUserDisconnected(() => setParticipantConnected(false));
    socketService.onSessionEnded(() => setIsChatEnded(true));

    return () => socketService.disconnect();
  }, [sessionId, router]);

  useEffect(scrollToBottom, [messages]);

  /* ---------- ACTIONS ---------- */

  const sendMessage = () => {
    if (!inputMessage.trim() || !sessionId) return;
    socketService.sendMessage(sessionId, inputMessage, 'moderator');
    setInputMessage('');
    socketService.stopTyping(sessionId, 'moderator');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    if (!sessionId) return;

    socketService.startTyping(sessionId, 'moderator');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(
      () => socketService.stopTyping(sessionId, 'moderator'),
      1000
    );
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const endChat = () => {
    if (confirm('End this chat session?')) {
      socketService.endSession(sessionId!);
    }
  };

  const exportChat = () => {
    if (!messages.length) return;

    const csv = [
      ['Timestamp', 'Sender', 'Message'].join(','),
      ...messages.map(m =>
        `${m.timestamp.toLocaleString()},${m.sender},"${m.content.replace(/"/g, '""')}"`
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `chat_${sessionId}.csv`;
    link.click();
  };

  if (!sessionId) return null;

  /* ---------- UI ---------- */

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 shadow-sm flex-none">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/moderator')}
              className="p-2 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${participantConnected ? 'bg-teal-500' : 'bg-red-500'}`}></div>
                <span className="font-medium text-slate-700">
                  Participant {participantConnected ? 'Online' : 'Offline'}
                </span>
              </div>

              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${partnerType === 'llm' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'}`}>
                {partnerType === 'llm' ? (
                  <CpuChipIcon className="w-3.5 h-3.5" />
                ) : (
                  <UserIcon className="w-3.5 h-3.5" />
                )}
                {partnerType === 'llm' ? 'AI Participant' : 'Human Participant'}
              </span>
            </div>
          </div>

          {!isChatEnded && (
            <button
              onClick={endChat}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
            >
              <StopCircleIcon className="w-4 h-4" />
              End Chat
            </button>
          )}
        </div>
      </header>

      {/* CHAT */}
      <main className="max-w-6xl mx-auto w-full px-6 py-4 flex-1 flex flex-col min-h-0">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">

          {/* MESSAGES */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
            {messages.length === 0 && (
              <div className="text-center text-slate-400 py-16 text-sm">
                No messages yet. Start the conversation.
              </div>
            )}

            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender === 'moderator'
                    ? 'justify-end'
                    : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] px-5 py-3.5 rounded-2xl shadow-sm text-base leading-relaxed ${
                    msg.sender === 'moderator'
                      ? 'bg-teal-600 text-white rounded-br-none'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                  }`}
                >
                  {msg.content}
                  <div className={`mt-2 text-xs flex justify-end ${msg.sender === 'moderator' ? 'text-teal-100/80' : 'text-slate-400'}`}>
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}

            {isParticipantTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT / INFO */}
          <div className="border-t border-slate-200 bg-white p-4 flex-none">
            {partnerType === 'llm' ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600 flex items-center gap-3">
                <div className="bg-white p-1.5 rounded-lg shadow-sm text-teal-600">
                  <CpuChipIcon className="w-5 h-5" />
                </div>
                AI session is fully automated. You are viewing in real time.
              </div>
            ) : (
              <>
                <div className="flex gap-3">
                  <textarea
                    ref={inputRef}
                    value={inputMessage}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type your response…"
                    rows={1}
                    disabled={!participantConnected}
                    className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder-slate-400 text-slate-900"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputMessage.trim()}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                  >
                    <PaperAirplaneIcon className="w-5 h-5" />
                    Send
                  </button>
                </div>

                <p className="mt-2 text-xs text-slate-400 px-1">
                  Respond naturally as a human participant. Press Enter to send.
                </p>
              </>
            )}
          </div>
        </div>

        {/* GUIDELINES */}
        <div className="mt-4 bg-slate-100 border border-slate-200 rounded-xl p-4 flex gap-3 flex-none">
          <div className="bg-white p-1.5 rounded-lg shadow-sm text-slate-500 h-fit">
            <InformationCircleIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 mb-1 text-sm">Moderator Guidelines</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Act naturally. Do not reveal your moderator role. Participants
              believe they are chatting with another study participant.
            </p>
          </div>
        </div>
      </main>

      {/* END MODAL */}
      {isChatEnded && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center border border-slate-200 shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-3 font-display">
              Session Ended
            </h2>
            <p className="text-slate-600 mb-8 leading-relaxed">
              You can export the chat or return to the dashboard.
            </p>

            <div className="space-y-3">
              <button
                onClick={exportChat}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors shadow-md"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                Export Chat (CSV)
              </button>

              <button
                onClick={() => router.push('/moderator')}
                className="w-full px-6 py-3.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- SUSPENSE WRAPPER ---------- */

export default function ModeratorChat() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <ModeratorChatContent />
    </Suspense>
  );
}
