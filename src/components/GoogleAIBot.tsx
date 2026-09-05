import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { 
  Sparkles, 
  Send, 
  X, 
  User, 
  Copy, 
  Check, 
  Trash2, 
  Maximize2, 
  Minimize2, 
  BookOpen, 
  Wallet, 
  FileText, 
  Award, 
  Bell, 
  RefreshCw,
  Lightbulb,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Download,
  ThumbsUp,
  ThumbsDown,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import StructuredMessageRenderer, { StructuredPayload } from '@/components/ai/StructuredMessageRenderer';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  category?: string;
  structuredData?: StructuredPayload[];
}

export default function GoogleAIBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: "👋 Hello! I am the **Google Gemini AI Assistant** for **St. Joseph’s School, Barhalganj** (Powered by Qoala Labs).\n\nI can assist you with:\n* 🎓 **Academics**: Syllabus tracking, lesson plans, study timetables\n* 💳 **Fees & Finance**: Fee structures, receipts, sibling discounts, defaulters\n* 📝 **Admissions**: Application queue, document checklists, verification SOPs\n* 📊 **CBSE Exams**: Marks moderation, grading rules, report card remarks\n* 📢 **Communication**: Parent circulars, official notices, event scheduling\n\nHow can I help you today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'up' | 'down'>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user, session, role, roleLabel } = useAuth();

  const isStudent = role === 'student' || role === 'parent';
  const isTeacher = role === 'teacher' || role === 'class_teacher';
  const isAdmin = !isStudent && !isTeacher;

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Institutional User';
  const displayRole = roleLabel;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [messages, isOpen, isTyping]);

  // Voice speech synthesis cleanup
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = (textToSend || input).trim();
    if (!messageText || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    try {
      const history = messages.slice(-10).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        text: m.text
      }));

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: messageText,
          history
        })
      });

      const data = await res.json().catch(() => ({}));

      const replyText = data.reply || data.details || data.error || 
        `Hello ${userName}! I am your **Google Gemini AI Assistant** for **St. Joseph’s School, Barhalganj**.\n\nRegarding your query: **"${messageText}"**\n\nHow else may I assist you with St. Joseph’s School, Barhalganj operations?`;

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        structuredData: data.structuredData
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      console.error("Chat client error:", err);
      const fallbackMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: `Hello ${userName}! I am the **Google Gemini AI Assistant** for **St. Joseph’s School, Barhalganj**.\n\nI'm operating in institutional mode. For quick access:\n• **Admissions & Enrolments**: Admissions Portal\n• **Fee Payments**: Fees & POS Portal\n• **Examination & Grades**: Exam & Results Module\n\nHow else may I assist you with St. Joseph’s School, Barhalganj operations?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  // Listen for external trigger events (e.g. from AIDailyBrief)
  useEffect(() => {
    const handleCustomOpen = (e: any) => {
      setIsOpen(true);
      const query = e.detail?.query;
      if (query) {
        setTimeout(() => {
          handleSendMessage(query);
        }, 200);
      }
    };
    window.addEventListener('open-school-ai', handleCustomOpen);
    return () => window.removeEventListener('open-school-ai', handleCustomOpen);
  }, []);

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Response copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeak = (id: string, text: string) => {
    if (!('speechSynthesis' in window)) {
      toast.error('Text-to-speech is not supported in this browser');
      return;
    }

    if (speakingMsgId === id) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(id);
    window.speechSynthesis.speak(utterance);
  };

  const handleFeedback = (id: string, type: 'up' | 'down') => {
    setFeedbackGiven(prev => ({ ...prev, [id]: type }));
    if (type === 'up') {
      toast.success('Thank you for your feedback!');
    } else {
      toast.info('Feedback recorded to refine assistant responses.');
    }
  };

  const toggleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice input is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        toast.info('Listening... Speak now');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  const clearChat = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setSpeakingMsgId(null);
    setMessages([
      {
        id: Date.now().toString(),
        sender: 'bot',
        text: `Chat session refreshed. How can Google Gemini AI assist you with **St. Joseph’s School, Barhalganj** operations today, ${userName}?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    toast.info('Chat session cleared');
  };

  const exportTranscript = () => {
    const transcriptText = messages
      .map(m => `[${m.timestamp}] ${m.sender === 'user' ? userName : 'Gemini AI Assistant'}:\n${m.text}\n`)
      .join('\n----------------------------------------\n\n');
    
    const blob = new Blob([transcriptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `St_Josephs_School_AI_Transcript_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transcript downloaded successfully');
  };

  const promptCategories = useMemo(() => {
    if (isStudent) {
      return [
        { id: 'all', label: 'My Academic 360', icon: Lightbulb },
        { id: 'attendance', label: 'Attendance', icon: BookOpen },
        { id: 'fees', label: 'Fees & Receipts', icon: Wallet },
        { id: 'exams', label: 'CBSE Results', icon: Award },
        { id: 'timetable', label: 'Timetable', icon: FileText }
      ];
    }
    if (isTeacher) {
      return [
        { id: 'all', label: 'Teacher Tools', icon: Lightbulb },
        { id: 'classes', label: 'Assigned Classes', icon: BookOpen },
        { id: 'attendance', label: 'Class Attendance', icon: FileText },
        { id: 'exams', label: 'Marks & Tests', icon: Award },
        { id: 'timetable', label: 'Teaching Schedule', icon: Bell }
      ];
    }
    return [
      { id: 'all', label: 'Executive Tools', icon: Lightbulb },
      { id: 'kpis', label: 'KPIs & Overview', icon: BookOpen },
      { id: 'fees', label: 'Fee Collections', icon: Wallet },
      { id: 'attendance', label: 'Attendance Register', icon: Award },
      { id: 'admissions', label: 'Admissions Pipeline', icon: FileText },
      { id: 'notices', label: 'Official Circulars', icon: Bell }
    ];
  }, [isStudent, isTeacher]);

  const quickPromptsByCategory: Record<string, { label: string; prompt: string }[]> = useMemo(() => {
    if (isStudent) {
      return {
        all: [
          { label: 'My Attendance', prompt: 'What is my current attendance percentage and total present days?' },
          { label: 'My Fee Status', prompt: 'Show my pending fee balance, paid amounts, and receipt records.' },
          { label: 'My Marksheet', prompt: 'Show my latest CBSE examination marksheet and subject grades.' },
          { label: 'Today’s Timetable', prompt: 'What is my class schedule and timetable for today?' }
        ],
        attendance: [
          { label: 'Attendance Summary', prompt: 'Show my complete attendance summary for this academic session.' },
          { label: 'Are my Absents Safe?', prompt: 'Am I above the 75% CBSE mandatory attendance threshold?' }
        ],
        fees: [
          { label: 'Fee Breakdown', prompt: 'Explain my tuition fee breakdown and due dates.' },
          { label: 'Payment Receipts', prompt: 'Show my recent fee payment receipt numbers and payment modes.' }
        ],
        exams: [
          { label: 'Subject Marks', prompt: 'Show my subject scores in Mathematics, Science, and English.' },
          { label: 'CBSE Grading', prompt: 'Explain the 8-point CBSE letter grading criteria from A1 to E.' }
        ],
        timetable: [
          { label: 'Weekly Schedule', prompt: 'Show my full weekly class timetable from Monday to Saturday.' }
        ]
      };
    }

    if (isTeacher) {
      return {
        all: [
          { label: 'My Assigned Classes', prompt: 'Show my assigned classes, sections, and student roster.' },
          { label: 'Who is Absent Today?', prompt: 'Who is absent in my assigned classes today?' },
          { label: 'Teaching Schedule', prompt: 'Show my weekly teaching periods and classroom allocations.' },
          { label: 'Pending Marks Entry', prompt: 'Show pending examination mark entry tasks for my subjects.' }
        ],
        classes: [
          { label: 'Student Roster', prompt: 'Show active enrolled students in my assigned sections.' }
        ],
        attendance: [
          { label: 'Class Attendance Today', prompt: 'Show today’s attendance register for my assigned class.' },
          { label: 'Mark Attendance', prompt: 'Help me mark attendance for my class.' }
        ],
        exams: [
          { label: 'Marks Overview', prompt: 'Review marks entered for my subject across sections.' },
          { label: 'Report Card Remarks', prompt: 'Suggest 5 constructive report card remarks for high-achieving students.' }
        ],
        timetable: [
          { label: 'Today’s Periods', prompt: 'Which periods and classes am I teaching today?' }
        ]
      };
    }

    // Admin
    return {
      all: [
        { label: 'Executive KPI Summary', prompt: 'Show the executive school KPI summary (strength, staff, attendance, admissions).' },
        { label: 'Pending Fee Defaulters', prompt: 'Which students have pending tuition fees across classes?' },
        { label: 'School Attendance', prompt: 'Show today’s school-wide attendance overview and absentee count.' },
        { label: 'Admission Pipeline', prompt: 'What is the current status of new admission applications?' }
      ],
      kpis: [
        { label: 'School Strength', prompt: 'What is the total student enrollment and teacher-to-student ratio?' },
        { label: 'Monthly Growth', prompt: 'Summarize institutional KPIs and faculty strength.' }
      ],
      fees: [
        { label: 'Defaulter Accounts', prompt: 'Show top pending student fee balances and recovery percentage.' },
        { label: 'Fee Policy', prompt: 'Explain the school overdue fee policy and sibling concession rules.' }
      ],
      attendance: [
        { label: 'Class-wise Attendance', prompt: 'Show class-wise attendance rates and absentees for today.' }
      ],
      admissions: [
        { label: 'Admissions Summary', prompt: 'Show admission applications by status (Verified, Pending, Approved).' }
      ],
      notices: [
        { label: 'Draft Sports Notice', prompt: 'Draft an official school circular announcing the Annual Sports Day meet.' },
        { label: 'PTM Notice', prompt: 'Write an official circular for parents regarding the upcoming PTM.' }
      ]
    };
  }, [isStudent, isTeacher]);

  const currentPrompts = quickPromptsByCategory[selectedCategory] || quickPromptsByCategory.all || [];

  return (
    <>
      {/* Floating Enterprise Launcher Button */}
      {/* Draggable so it never blocks dialog or drawer actions underneath */}
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0}
        whileDrag={{ scale: 1.04, cursor: 'grabbing' }}
        dragConstraints={{
          left: -(window.innerWidth - 180),
          top: -(window.innerHeight - 140),
          right: 12,
          bottom: 12,
        }}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 touch-none"
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "relative flex items-center gap-2.5 px-4 py-3 text-white rounded-2xl shadow-xl cursor-pointer transition-all border group",
            isOpen
              ? "bg-slate-900 border-slate-700 shadow-slate-900/40"
              : "bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 border-blue-400/30 shadow-blue-600/30 hover:shadow-blue-600/50"
          )}
          title="Open Google Gemini AI Enterprise Assistant"
          aria-label="Google Gemini AI Assistant"
        >
          {/* Multi-Color Google Sparkle Glow */}
          <div className="relative flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-blue-700 animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-blue-700" />
          </div>

          <div className="flex flex-col text-left hidden sm:flex">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xs tracking-tight text-white uppercase">
                Gemini Copilot
              </span>
              <span className="px-1.5 py-0.2 bg-white/20 rounded text-[9px] font-black uppercase text-amber-200">
                AI
              </span>
            </div>
            <span className="text-[10px] text-blue-200 font-medium leading-none">
              St. Joseph’s School, Barhalganj
            </span>
          </div>
        </motion.button>
      </motion.div>

      {/* Interactive Enterprise AI Drawer / Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.94 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            className={cn(
              "fixed right-3 sm:right-6 bottom-4 sm:bottom-6 z-50 bg-white border border-slate-200/90 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300",
              "max-h-[calc(100dvh-4.5rem)]",
              isExpanded 
                ? "w-[calc(100vw-1.5rem)] sm:w-[680px] md:w-[740px] h-[min(840px,calc(100dvh-5rem))]" 
                : "w-[calc(100vw-1.5rem)] sm:w-[460px] h-[min(620px,calc(100dvh-5.5rem))]"
            )}
          >
            {/* Google Multi-Color Gradient Top Ribbon */}
            <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-rose-500 via-amber-400 to-emerald-500 shrink-0" />

            {/* Enterprise Header - Sticky Top */}
            <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0 select-none">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 via-indigo-500 to-amber-400 p-0.5 flex items-center justify-center shadow-md shrink-0">
                  <div className="w-full h-full bg-slate-950 rounded-[9px] flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-amber-300" />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-sm text-white tracking-tight truncate">
                      Google Gemini AI
                    </h3>
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full text-[9px] font-extrabold uppercase tracking-wider">
                      Enterprise Copilot
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 font-medium flex items-center gap-1.5 truncate mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>St. Joseph’s School, Barhalganj</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400">{displayRole}</span>
                  </p>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-1 text-slate-400 shrink-0">
                <button
                  onClick={exportTranscript}
                  className="p-1.5 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Export Transcript (.txt)"
                >
                  <Download size={15} />
                </button>
                <button
                  onClick={clearChat}
                  className="p-1.5 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Clear Chat History"
                >
                  <Trash2 size={15} />
                </button>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1.5 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer hidden sm:block"
                  title={isExpanded ? "Collapse Window" : "Expand Window"}
                >
                  {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Close Assistant"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              {promptCategories.map((cat) => {
                const Icon = cat.icon;
                const active = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10.5px] font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer",
                      active
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    )}
                  >
                    <Icon size={12} className={active ? "text-white" : "text-slate-500"} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Prompt Chips */}
            <div className="px-3 py-2 bg-slate-100/60 border-b border-slate-200/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 shrink-0 flex items-center gap-1">
                <Lightbulb size={11} className="text-amber-500" /> Prompts:
              </span>
              {currentPrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(p.prompt)}
                  disabled={isTyping}
                  className="px-2.5 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200/90 rounded-full text-[10.5px] font-semibold shrink-0 transition-all cursor-pointer shadow-3xs hover:border-blue-300 disabled:opacity-50 truncate max-w-[200px]"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Chat Body - Scrollable */}
            <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3.5 bg-slate-50/70">
              {messages.map((m) => {
                const isUser = m.sender === 'user';
                const isSpeaking = speakingMsgId === m.id;

                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex gap-2.5 max-w-[90%]",
                      isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}
                  >
                    {/* Avatar */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border shadow-xs",
                        isUser 
                          ? "bg-slate-900 text-white border-slate-800" 
                          : "bg-gradient-to-tr from-blue-600 to-indigo-600 text-amber-300 border-blue-400/40"
                      )}
                    >
                      {isUser ? <User size={15} /> : <Sparkles size={15} />}
                    </div>

                    {/* Bubble */}
                    <div className="space-y-1 min-w-0 max-w-full">
                      <div
                        className={cn(
                          "p-3.5 rounded-2xl text-xs leading-relaxed shadow-3xs relative group",
                          isUser
                            ? "bg-blue-600 text-white rounded-tr-none font-medium"
                            : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-none font-normal"
                        )}
                      >
                        {/* Message Content with Markdown */}
                        <div className={cn(
                          "prose prose-xs max-w-none break-words",
                          isUser ? "text-white prose-invert" : "text-slate-800"
                        )}>
                          <Markdown
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                              li: ({ children }) => <li className="leading-snug">{children}</li>,
                              strong: ({ children }) => <strong className="font-extrabold">{children}</strong>,
                              h1: ({ children }) => <h1 className="text-sm font-extrabold mb-1.5">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-xs font-extrabold mb-1">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-xs font-bold mb-1">{children}</h3>,
                              code: ({ children }) => (
                                <code className="px-1.5 py-0.5 bg-slate-100 text-blue-700 rounded text-[11px] font-mono border border-slate-200">
                                  {children}
                                </code>
                              )
                            }}
                          >
                            {m.text}
                          </Markdown>
                        </div>

                        {/* Structured ERP Entities & Action Cards */}
                        {!isUser && Array.isArray(m.structuredData) && m.structuredData.map((item, sIdx) => (
                          <StructuredMessageRenderer
                            key={sIdx}
                            payload={item}
                            accessToken={session?.access_token}
                          />
                        ))}

                        {/* Bot Action Bar */}
                        {!isUser && (
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-slate-400">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => copyToClipboard(m.id, m.text)}
                                className="p-1 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                title="Copy response"
                              >
                                {copiedId === m.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                              </button>

                              <button
                                onClick={() => handleSpeak(m.id, m.text)}
                                className={cn(
                                  "p-1 rounded transition-colors cursor-pointer",
                                  isSpeaking ? "text-blue-600 bg-blue-50" : "hover:text-slate-700 hover:bg-slate-100"
                                )}
                                title={isSpeaking ? "Stop speaking" : "Read aloud"}
                              >
                                {isSpeaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                              </button>

                              <button
                                onClick={() => handleSendMessage(m.text)}
                                className="p-1 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                title="Regenerate"
                              >
                                <RefreshCw size={12} />
                              </button>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleFeedback(m.id, 'up')}
                                className={cn(
                                  "p-1 rounded transition-colors cursor-pointer",
                                  feedbackGiven[m.id] === 'up' ? "text-emerald-600 bg-emerald-50" : "hover:text-slate-700 hover:bg-slate-100"
                                )}
                                title="Helpful response"
                              >
                                <ThumbsUp size={11} />
                              </button>
                              <button
                                onClick={() => handleFeedback(m.id, 'down')}
                                className={cn(
                                  "p-1 rounded transition-colors cursor-pointer",
                                  feedbackGiven[m.id] === 'down' ? "text-rose-600 bg-rose-50" : "hover:text-slate-700 hover:bg-slate-100"
                                )}
                                title="Not helpful"
                              >
                                <ThumbsDown size={11} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <p className={cn("text-[9px] font-medium text-slate-400 px-1", isUser && "text-right")}>
                        {m.timestamp}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Typing Shimmer State */}
              {isTyping && (
                <div className="flex items-center gap-2.5 text-blue-600 bg-white p-3 rounded-2xl border border-blue-100 w-fit shadow-xs">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '450ms' }} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700">Gemini is synthesizing response...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer Bar */}
            <div className="p-3 sm:p-3.5 bg-white border-t border-slate-200/80 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <div className="flex-1 relative flex items-center">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isListening ? "Listening to your voice..." : `Ask Gemini anything about St. Joseph’s School, Barhalganj...`}
                    disabled={isTyping}
                    className="w-full bg-slate-100 focus:bg-white border border-slate-200 rounded-xl pl-3.5 pr-9 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 placeholder:font-normal"
                  />
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    className={cn(
                      "absolute right-2.5 p-1 rounded-md transition-all cursor-pointer",
                      isListening
                        ? "text-rose-600 bg-rose-100 animate-pulse"
                        : "text-slate-400 hover:text-blue-600 hover:bg-slate-200"
                    )}
                    title={isListening ? "Stop listening" : "Voice input"}
                  >
                    {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="p-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white rounded-xl disabled:opacity-40 transition-all cursor-pointer shadow-sm shadow-blue-600/20 shrink-0"
                  title="Send Message (Enter)"
                >
                  <Send size={15} />
                </button>
              </form>

              {/* Status Footer */}
              <div className="flex items-center justify-between mt-2 px-1 text-[9.5px] font-medium text-slate-400">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={11} className="text-emerald-500" />
                  <span>Enterprise Security Encrypted</span>
                </div>
                <span className="text-blue-600 font-extrabold uppercase">
                  Qoala Labs AI Engine
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
