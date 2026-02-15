'use client';

import { Suspense, useState, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import socketService from '@/lib/socket';

import {
  ArrowLeftIcon,
  PaperAirplaneIcon,
  StopCircleIcon,
  ArrowDownTrayIcon,
  InformationCircleIcon,
  LockClosedIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

/* ---------- TYPES ---------- */

type ExperimentCondition =
  | 'truthful-human'
  | 'truthful-ai'
  | 'deceptive-ai-as-human'
  | 'deceptive-human-as-ai';

interface Message {
  id: string;
  content: string;
  sender: 'participant' | 'moderator';
  timestamp: Date;
}

const CONDITION_CONFIG: Record<ExperimentCondition, {
  label: string;
  description: string;
  visibleLabel: string;
  responseSource: string;
  inputEnabled: boolean;
  badgeColor: string;
}> = {
  'truthful-human': {
    label: 'True Human Mode',
    description: 'You are the human responder. The participant sees "Human" and you type the responses.',
    visibleLabel: 'Human',
    responseSource: 'Moderator (you)',
    inputEnabled: true,
    badgeColor: 'bg-teal-100 text-teal-700 border-teal-200',
  },
  'truthful-ai': {
    label: 'True AI Mode',
    description: 'AI generates all responses. The participant sees "AI". You are observing only.',
    visibleLabel: 'AI',
    responseSource: 'AI (automated)',
    inputEnabled: false,
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  'deceptive-human-as-ai': {
    label: 'Human Pretending to be AI',
    description: 'You type the responses, but the participant sees them as coming from "AI".',
    visibleLabel: 'AI',
    responseSource: 'Moderator (you)',
    inputEnabled: true,
    badgeColor: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  'deceptive-ai-as-human': {
    label: 'AI Pretending to be Human',
    description: 'AI generates all responses, presented to the participant as "Human". You are observing only.',
    visibleLabel: 'Human',
    responseSource: 'AI (automated)',
    inputEnabled: false,
    badgeColor: 'bg-rose-100 text-rose-700 border-rose-200',
  },
};

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
  const [isParticipantTyping, setIsParticipantTyping] = useState(false);
  const [participantConnected, setParticipantConnected] = useState(true);
  const [isChatEnded, setIsChatEnded] = useState(false);
  const [condition, setCondition] = useState<ExperimentCondition>('truthful-human');
  const [moderatorInputEnabled, setModeratorInputEnabled] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [savingToDrive, setSavingToDrive] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const config = CONDITION_CONFIG[condition];

  /* ---------- SOCKET ---------- */

  useEffect(() => {
    if (!sessionId) {
      router.push('/moderator');
      return;
    }

    const socket = socketService.connect();

    socket.on('connect', () => {
      socketService.joinAsModerator(sessionId);
      // Re-link Google auth
      const storedEmail = localStorage.getItem('google_drive_email');
      if (storedEmail) {
        socketService.linkGoogleAuth(storedEmail);
      }
    });

    socketService.onGoogleAuthStatus((data) => {
      setGoogleConnected(data.connected);
    });

    socketService.onGoogleExportResult((data) => {
      setSavingToDrive(false);
      if (data.success) {
        alert(`Session saved to Google Drive.`);
      } else {
        alert(`Export failed: ${data.error || 'Unknown error'}`);
      }
    });

    socketService.onSessionJoined((data) => {
      if (data.condition) setCondition(data.condition as ExperimentCondition);
      if (typeof data.moderatorInputEnabled === 'boolean') {
        setModeratorInputEnabled(data.moderatorInputEnabled);
        // Clear any pre-drafted input when joining a disabled session
        if (!data.moderatorInputEnabled) {
          setInputMessage('');
        }
      }
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
    if (!inputMessage.trim() || !sessionId || !moderatorInputEnabled) return;
    socketService.sendMessage(sessionId, inputMessage, 'moderator');
    setInputMessage('');
    socketService.stopTyping(sessionId, 'moderator');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!moderatorInputEnabled) return;
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

    const escapeCsvField = (field: string) => {
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csv = [
      'Timestamp,Sender,Message',
      ...messages.map(m =>
        [
          escapeCsvField(m.timestamp.toISOString()),
          escapeCsvField(m.sender),
          escapeCsvField(m.content),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `chat_${sessionId}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
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
            </div>
          </div>

          <div className="flex items-center gap-3">
            {messages.length > 0 && (
              <>
                <button
                  onClick={exportChat}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 border border-teal-200 text-sm font-medium rounded-lg hover:bg-teal-100 transition-colors"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  Export CSV
                </button>
                {googleConnected && sessionId && (
                  <button
                    onClick={() => {
                      setSavingToDrive(true);
                      socketService.exportSessionsToGoogleDrive([sessionId]);
                    }}
                    disabled={savingToDrive}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.71 3.5L1.15 15l3.43 5.96h6.86l-3.43-5.96L7.71 3.5zm8.58 0l-3.43 5.96 3.43 5.96h6.86L19.72 9.5 16.29 3.5zm-4.29 7.46l-3.43 5.96h6.86l3.43-5.96H12z"/>
                    </svg>
                    {savingToDrive ? 'Saving...' : 'Save to Drive'}
                  </button>
                )}
              </>
            )}
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
        </div>
      </header>

      {/* MODE INDICATOR BANNER — visible to moderator only */}
      <div className={`border-b px-6 py-3 flex items-center justify-between ${config.badgeColor}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${config.badgeColor}`}>
            {config.inputEnabled ? (
              <PaperAirplaneIcon className="w-3.5 h-3.5" />
            ) : (
              <EyeIcon className="w-3.5 h-3.5" />
            )}
            {config.label}
          </span>
          <span className="text-sm font-medium">
            Participant sees: <strong>&quot;{config.visibleLabel}&quot;</strong>
          </span>
          <span className="text-sm">
            Response by: <strong>{config.responseSource}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium flex-shrink-0">
          {config.inputEnabled ? (
            <span className="inline-flex items-center gap-1 text-teal-700">
              <PaperAirplaneIcon className="w-4 h-4" />
              Input Enabled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-red-600">
              <LockClosedIcon className="w-4 h-4" />
              Input Locked
            </span>
          )}
        </div>
      </div>

      {/* CHAT */}
      <main className="max-w-6xl mx-auto w-full px-6 py-4 flex-1 flex flex-col min-h-0">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">

          {/* MESSAGES */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
            {messages.length === 0 && (
              <div className="text-center text-slate-400 py-16 text-sm">
                {config.inputEnabled
                  ? 'No messages yet. Start the conversation.'
                  : 'No messages yet. Waiting for AI to respond.'}
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
                  className={`max-w-[85%] px-5 py-3.5 rounded-2xl shadow-sm text-base leading-relaxed whitespace-pre-line ${
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

          {/* INPUT / LOCKED NOTICE */}
          <div className="border-t border-slate-200 bg-white p-4 flex-none">
            {!moderatorInputEnabled ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600 flex items-center gap-3">
                <div className="bg-white p-1.5 rounded-lg shadow-sm text-red-500">
                  <LockClosedIcon className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Input locked.</span>{' '}
                  {condition === 'truthful-ai'
                    ? 'AI is generating responses. You are observing this session in real time.'
                    : 'AI is generating responses disguised as human. You are observing this session in real time.'}
                </div>
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
                    placeholder={
                      condition === 'deceptive-human-as-ai'
                        ? 'Type your response (participant sees this as AI)…'
                        : 'Type your response…'
                    }
                    rows={1}
                    disabled={!participantConnected || isChatEnded}
                    className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder-slate-400 text-slate-900"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputMessage.trim() || isChatEnded}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                  >
                    <PaperAirplaneIcon className="w-5 h-5" />
                    Send
                  </button>
                </div>

                <p className="mt-2 text-xs text-slate-400 px-1">
                  {condition === 'deceptive-human-as-ai'
                    ? 'You are pretending to be AI. The participant believes they are chatting with an AI. Press Enter to send.'
                    : 'Respond naturally as a human participant. Press Enter to send.'}
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
            <h3 className="font-semibold text-slate-900 mb-1 text-sm">Session Mode: {config.label}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {config.description}
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
