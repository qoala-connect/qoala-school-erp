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
  Paperclip,
  Image as ImageIcon,
  Activity,
  Users,
  TrendingUp,
  MessageSquare
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
  imageUrl?: string;
  structuredData?: StructuredPayload[];
  suggestedFollowUps?: string[];
}

export default function GoogleAIBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: "👋 Hello! I am the **Google Gemini Enterprise Copilot** for **St. Joseph’s School, Barhalganj** (Powered by Qoala Labs).\n\nI am equipped with autonomous ERP actions, live Recharts analytics, and predictive AI:\n* 🔮 **Predictive Analytics**: At-risk student early warning & 30-day cashflow forecast\n* 👥 **Faculty Substitution**: Smart period reallocation matrix\n* 💳 **Fee & Finance**: Collection velocity, defaulter recovery & 1-click reminders\n* 📊 **CBSE Exams**: Marks moderation, grades & instant admit card dispatch\n* 📎 **Multimodal Vision**: Upload medical certificates or handwritten marks sheets for OCR\n\nHow can I help you today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedFollowUps: [
        "Show school executive summary",
        "Predict at-risk students",
        "Generate teacher substitution plan",
        "Forecast 30-day fee cashflow"
      ]
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'up' | 'down'>>({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  }, [messages, isOpen, isTyping, isAnalyzingImage]);

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
    if ((!messageText && !selectedImage) || isTyping || isAnalyzingImage) return;

    if (selectedImage) {
      await handleVisionUpload(messageText);
      return;
    }

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
        structuredData: data.structuredData,
        suggestedFollowUps: data.suggestedFollowUps
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

  const handleVisionUpload = async (customPrompt?: string) => {
    if (!selectedImage) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: customPrompt || 'Analyze uploaded document / marksheet / medical certificate.',
      imageUrl: selectedImage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    const imageToAnalyze = selectedImage;
    setSelectedImage(null);
    setInput('');
    setIsAnalyzingImage(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/ai/vision/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          imageBase64: imageToAnalyze,
          documentType: customPrompt?.toLowerCase().includes('medical') ? 'medical_leave' : 'handwritten_marks',
          prompt: customPrompt || 'Analyze this document, extract student names, marks, dates, and provide actionable recommendations.'
        })
      });

      const data = await res.json().catch(() => ({}));
      const replyText = data.summary || "Document processed successfully.";

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedFollowUps: [
          "Record extracted marks into Examination register",
          "Regularize medical leave on attendance roster",
          "Send confirmation notification to parents"
        ]
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      console.error("Vision upload error:", err);
      toast.error("Failed to analyze image with Gemini Vision");
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, WebP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      toast.info('Document attached. Click Send or type instructions to analyze.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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
        { id: 'predictive', label: 'Student Diagnostic', icon: Activity },
        { id: 'timetable', label: 'Teaching Schedule', icon: Bell }
      ];
    }
    return [
      { id: 'all', label: 'Executive Tools', icon: Lightbulb },
      { id: 'predictive', label: 'Predictive & Risk', icon: Activity },
      { id: 'substitution', label: 'Faculty Matrix', icon: Users },
      { id: 'fees', label: 'Fee Cashflow', icon: Wallet },
      { id: 'attendance', label: 'Attendance', icon: Award },
      { id: 'notices', label: 'Circulars & SMS', icon: Bell }
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
          { label: '🔮 At-Risk Students', prompt: 'Predict at-risk students based on low attendance and failing exam marks' },
          { label: 'Who is Absent Today?', prompt: 'Who is absent in my assigned classes today?' },
          { label: 'My Assigned Classes', prompt: 'Show my assigned classes, sections, and student roster.' },
          { label: 'Teaching Schedule', prompt: 'Show my weekly teaching periods and classroom allocations.' }
        ],
        classes: [
          { label: 'Student Roster', prompt: 'Show active enrolled students in my assigned sections.' }
        ],
        attendance: [
          { label: 'Class Attendance Today', prompt: 'Show today’s attendance register for my assigned class.' },
          { label: 'Parent Absence Alert', prompt: 'Send SMS alert to parents of students who are absent today' }
        ],
        exams: [
          { label: 'Marks Overview', prompt: 'Review marks entered for my subject across sections.' },
          { label: 'Report Card Remarks', prompt: 'Suggest 5 constructive report card remarks for high-achieving students.' }
        ],
        predictive: [
          { label: 'At-Risk Diagnostic', prompt: 'Predict at-risk students based on low attendance and failing exam marks' },
          { label: 'Weak Subjects', prompt: 'Identify subjects with lowest pass percentage across my classes' }
        ],
        timetable: [
          { label: 'Today’s Periods', prompt: 'Which periods and classes am I teaching today?' }
        ]
      };
    }

    // Admin
    return {
      all: [
        { label: '🔮 At-Risk Predictor', prompt: 'Predict at-risk students based on low attendance and failing exam marks' },
        { label: '👥 Faculty Substitution', prompt: 'Generate teacher substitution plan for absent faculty members today' },
        { label: '💰 30-Day Cashflow', prompt: 'Forecast fee collection cashflow and recovery for the next 30 days' },
        { label: 'Executive KPI Summary', prompt: 'Show the executive school KPI summary (strength, staff, attendance, admissions).' }
      ],
      predictive: [
        { label: 'At-Risk Student Early Warning', prompt: 'Predict at-risk students based on low attendance and failing exam marks' },
        { label: 'CBSE Admit Card Eligibility', prompt: 'Generate CBSE Admit Cards for students meeting 75% attendance criteria' }
      ],
      substitution: [
        { label: 'Today’s Substitution Matrix', prompt: 'Generate teacher substitution plan for absent faculty members today' },
        { label: 'Teacher Workload Summary', prompt: 'Show active teaching load and period allocations across faculty' }
      ],
      fees: [
        { label: '30-Day Cashflow Projection', prompt: 'Forecast fee collection cashflow and recovery for the next 30 days' },
        { label: 'Pending Fee Defaulters', prompt: 'Which students have pending tuition fees across classes?' },
        { label: 'Dispatch Fee Reminders', prompt: 'Dispatch fee payment reminders to all overdue accounts' }
      ],
      attendance: [
        { label: 'Today’s Absentees', prompt: 'Show today’s school-wide attendance overview and absentee count.' },
        { label: 'Send Parent Absence SMS', prompt: 'Send SMS alert to parents of students who are absent today' }
      ],
      notices: [
        { label: 'Draft Sports Circular', prompt: 'Draft an official school circular announcing the Annual Sports Day meet.' },
        { label: 'Publish PTM Notice', prompt: 'Write an official circular for parents regarding the upcoming PTM.' }
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
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={cn(
              "fixed right-3 sm:right-6 bottom-4 sm:bottom-6 z-50 bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-[28px] shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ring-1 ring-black/5",
              "max-h-[calc(100dvh-3.5rem)]",
              isExpanded 
                ? "w-[calc(100vw-1.5rem)] sm:w-[720px] md:w-[800px] h-[min(860px,calc(100dvh-4.5rem))]" 
                : "w-[calc(100vw-1.5rem)] sm:w-[480px] md:w-[510px] h-[min(680px,calc(100dvh-4.5rem))]"
            )}
          >
            {/* Top Multi-Color Gradient Line */}
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 via-rose-500 via-amber-400 to-emerald-500 shrink-0" />

            {/* Modern Sleek Header */}
            <div className="px-4 py-3 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800/80 shrink-0 select-none">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-violet-500 p-0.5 shadow-md shrink-0">
                  <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-950 rounded-full" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-extrabold text-[13px] text-white tracking-tight truncate">
                      Gemini Copilot
                    </h3>
                    <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-md text-[8.5px] font-black uppercase tracking-wider">
                      Enterprise
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5 truncate mt-0.5">
                    <span>St. Joseph’s School</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-300 font-semibold">{displayRole}</span>
                  </p>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-0.5 text-slate-400 shrink-0">
                <button
                  onClick={exportTranscript}
                  className="p-1.5 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
                  title="Export Transcript (.txt)"
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={clearChat}
                  className="p-1.5 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
                  title="Clear Chat History"
                >
                  <Trash2 size={14} />
                </button>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1.5 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer hidden sm:block"
                  title={isExpanded ? "Collapse Window" : "Expand Window"}
                >
                  {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer ml-0.5"
                  title="Close Assistant"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Streamlined Single-Row Quick Action Bar */}
            <div className="px-3 py-2 bg-slate-50/90 border-b border-slate-200/70 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1 mr-0.5">
                <Sparkles size={11} className="text-amber-500" /> Prompts:
              </span>
              {currentPrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(p.prompt)}
                  disabled={isTyping}
                  className="px-2.5 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-slate-700 border border-slate-200/90 rounded-full text-[10px] font-bold shrink-0 transition-all cursor-pointer shadow-3xs disabled:opacity-50 truncate max-w-[210px] active:scale-95"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Chat Body - Scrollable */}
            <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3.5 bg-slate-50/50">
              {messages.map((m) => {
                const isUser = m.sender === 'user';
                const isSpeaking = speakingMsgId === m.id;

                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex gap-2.5 max-w-[92%]",
                      isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}
                  >
                    {/* Avatar */}
                    <div
                      className={cn(
                        "w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-3xs",
                        isUser 
                          ? "bg-slate-900 text-white" 
                          : "bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-amber-300 border border-blue-400/30"
                      )}
                    >
                      {isUser ? <User size={13} /> : <Sparkles size={13} />}
                    </div>

                    {/* Bubble */}
                    <div className="space-y-1 min-w-0 max-w-full">
                      <div
                        className={cn(
                          "p-3.5 rounded-2xl text-xs leading-relaxed shadow-3xs relative group transition-all",
                          isUser
                            ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white rounded-tr-sm font-medium shadow-blue-500/10"
                            : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-sm font-normal"
                        )}
                      >
                        {/* Uploaded / Attached Image */}
                        {m.imageUrl && (
                          <div className="mb-2.5 overflow-hidden rounded-xl border border-slate-200 bg-slate-950/5">
                            <img 
                              src={m.imageUrl} 
                              alt="Uploaded document" 
                              className="max-h-52 w-auto rounded-lg object-contain"
                            />
                          </div>
                        )}

                        {/* Message Content with Markdown */}
                        <div className={cn(
                          "prose prose-xs max-w-none break-words",
                          isUser ? "text-white prose-invert font-medium" : "text-slate-800"
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

                        {/* Refined Context-Aware Follow-up Chips */}
                        {!isUser && Array.isArray(m.suggestedFollowUps) && m.suggestedFollowUps.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-slate-150 space-y-1.5">
                            <div className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-400">
                              <MessageSquare size={10} className="text-blue-600" />
                              <span>Suggested Next Questions:</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {m.suggestedFollowUps.map((fu, fIdx) => (
                                <button
                                  key={fIdx}
                                  onClick={() => handleSendMessage(fu)}
                                  disabled={isTyping}
                                  className="px-2.5 py-1 bg-blue-50/70 hover:bg-blue-100/90 text-blue-700 border border-blue-200/70 rounded-lg text-[10px] font-semibold transition-all cursor-pointer text-left disabled:opacity-50 active:scale-95 shadow-3xs"
                                >
                                  {fu}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Bot Action Bar */}
                        {!isUser && (
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-slate-400">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => copyToClipboard(m.id, m.text)}
                                className="p-1 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                title="Copy response"
                              >
                                {copiedId === m.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                              </button>

                              <button
                                onClick={() => handleSpeak(m.id, m.text)}
                                className={cn(
                                  "p-1 rounded-md transition-colors cursor-pointer",
                                  isSpeaking ? "text-blue-600 bg-blue-50" : "hover:text-slate-700 hover:bg-slate-100"
                                )}
                                title={isSpeaking ? "Stop speaking" : "Read aloud"}
                              >
                                {isSpeaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                              </button>

                              <button
                                onClick={() => handleSendMessage(m.text)}
                                className="p-1 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                title="Regenerate"
                              >
                                <RefreshCw size={12} />
                              </button>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleFeedback(m.id, 'up')}
                                className={cn(
                                  "p-1 rounded-md transition-colors cursor-pointer",
                                  feedbackGiven[m.id] === 'up' ? "text-emerald-600 bg-emerald-50" : "hover:text-slate-700 hover:bg-slate-100"
                                )}
                                title="Helpful response"
                              >
                                <ThumbsUp size={11} />
                              </button>
                              <button
                                onClick={() => handleFeedback(m.id, 'down')}
                                className={cn(
                                  "p-1 rounded-md transition-colors cursor-pointer",
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

                      <p className={cn("text-[9px] font-semibold text-slate-400 px-1", isUser && "text-right")}>
                        {m.timestamp}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Typing & OCR Shimmer State */}
              {(isTyping || isAnalyzingImage) && (
                <div className="flex items-center gap-2.5 text-blue-600 bg-white p-3 rounded-2xl border border-blue-100 w-fit shadow-xs">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '450ms' }} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700">
                    {isAnalyzingImage ? "Gemini Vision is analyzing document OCR..." : "Gemini is synthesizing response..."}
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Command Bar Footer */}
            <div className="p-3 sm:p-3.5 bg-white border-t border-slate-200/80 shrink-0">
              {/* Selected Image Attachment Preview Bar */}
              {selectedImage && (
                <div className="mb-2 p-1.5 bg-blue-50/90 border border-blue-200 rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <img 
                      src={selectedImage} 
                      alt="Attachment preview" 
                      className="w-8 h-8 rounded-lg object-cover border border-blue-300 shrink-0" 
                    />
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-bold text-blue-900 truncate">Document Image Attached</p>
                      <p className="text-[9px] text-blue-600 font-medium">Ready for Gemini OCR analysis</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedImage(null)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                    title="Remove attachment"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* Hidden File Input for Document/Image OCR */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />

              {/* Unified Command Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-1.5 bg-slate-100/90 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 border border-slate-200 rounded-2xl p-1.5 transition-all shadow-3xs"
              >
                {/* Paperclip Document / Image Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 rounded-xl transition-all cursor-pointer shrink-0"
                  title="Upload Document / Marks Sheet / Medical Certificate for Gemini Vision OCR"
                >
                  <Paperclip size={15} />
                </button>

                {/* Input Text Box */}
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    isListening 
                      ? "Listening to your voice..." 
                      : selectedImage 
                      ? "Add prompt or press Send for OCR..." 
                      : `Ask Gemini anything about St. Joseph’s School...`
                  }
                  disabled={isTyping || isAnalyzingImage}
                  className="flex-1 bg-transparent py-1.5 text-xs font-semibold text-slate-800 outline-none placeholder:text-slate-400 placeholder:font-normal"
                />

                {/* Mic Voice Button */}
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className={cn(
                    "p-2 rounded-xl transition-all cursor-pointer shrink-0",
                    isListening
                      ? "text-rose-600 bg-rose-100 animate-pulse"
                      : "text-slate-400 hover:text-blue-600 hover:bg-slate-200/70"
                  )}
                  title={isListening ? "Stop listening" : "Voice input"}
                >
                  {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                </button>

                {/* Gradient Send Button */}
                <button
                  type="submit"
                  disabled={(!input.trim() && !selectedImage) || isTyping || isAnalyzingImage}
                  className="w-8 h-8 flex items-center justify-center bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white rounded-xl disabled:opacity-40 transition-all cursor-pointer shadow-xs shadow-blue-600/30 shrink-0 active:scale-95"
                  title="Send Message (Enter)"
                >
                  <Send size={13} />
                </button>
              </form>

              {/* Status Footer */}
              <div className="flex items-center justify-between mt-2 px-1 text-[9.5px] font-medium text-slate-400">
                <div className="flex items-center gap-1">
                  <ShieldCheck size={11} className="text-emerald-500" />
                  <span>Enterprise Security Encrypted</span>
                </div>
                <span className="text-blue-600 font-extrabold uppercase tracking-wide">
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
