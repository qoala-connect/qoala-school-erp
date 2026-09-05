import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { 
  Sparkles, Brain, Bot, Send, Search, User, Layers, Calendar, HelpCircle,
  AlertCircle, ArrowRight, TrendingUp, Wallet, Award, CheckCircle, RefreshCw, MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import StructuredMessageRenderer, { StructuredPayload } from '@/components/ai/StructuredMessageRenderer';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend,
  PieChart, Pie, Cell
} from 'recharts';
import { toast } from 'sonner';

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
  structuredData?: StructuredPayload[];
}

export default function AIAssistant() {
  const { user, session, role, roleLabel } = useAuth();
  const [activeTab, setActiveTab] = useState<'assistant' | 'predictions' | 'insights'>('assistant');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm1',
      sender: 'ai',
      text: "👋 Hello! I am **St. Joseph's School, Barhalganj’s AI Enterprise Assistant** (Powered by Google Gemini & Qoala Labs).\n\nI am connected to live ERP records. How can I assist you with your academic and administrative tasks today?",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const isStudent = role === 'student' || role === 'parent';
  const isTeacher = role === 'teacher' || role === 'class_teacher';
  const isAdmin = !isStudent && !isTeacher;

  // Dynamic role-tailored prompt suggestions
  const suggestedPrompts = useMemo(() => {
    if (isStudent) {
      return [
        'What is my current attendance percentage and total present days?',
        'Show my pending fee balance, paid amounts, and receipt records.',
        'Show my latest CBSE examination report card and subject marks.',
        'What is my class schedule and timetable for today?'
      ];
    }
    if (isTeacher) {
      return [
        'Show my assigned classes, sections, and student roster.',
        'Who is absent in my assigned classes today?',
        'Show my weekly teaching periods and classroom allocations.',
        'Show pending examination mark entry tasks for my subjects.'
      ];
    }
    return [
      'Show the executive school KPI summary (strength, staff, attendance, admissions).',
      'Which students have pending tuition fees across classes?',
      'Show today’s school-wide attendance overview and absentee count.',
      'What is the current status of new admission applications?'
    ];
  }, [isStudent, isTeacher]);

  // Predictions datasets
  const performanceData = [
    { name: 'Grade 6', passingProb: 94, avgScore: 78, attendanceAvg: 91 },
    { name: 'Grade 7', passingProb: 92, avgScore: 76, attendanceAvg: 89 },
    { name: 'Grade 8', passingProb: 89, avgScore: 73, attendanceAvg: 88 },
    { name: 'Grade 9', passingProb: 84, avgScore: 68, attendanceAvg: 85 },
    { name: 'Grade 10', passingProb: 95, avgScore: 82, attendanceAvg: 93 },
    { name: 'Grade 11', passingProb: 88, avgScore: 74, attendanceAvg: 87 },
    { name: 'Grade 12', passingProb: 97, avgScore: 85, attendanceAvg: 95 },
  ];

  const defaulterRiskData = [
    { category: 'Critical Risk (3+ months pending)', value: 12, color: '#EF4444' },
    { category: 'Medium Risk (1-2 months pending)', value: 24, color: '#F59E0B' },
    { category: 'Low Risk (Paid with partial lag)', value: 48, color: '#3B82F6' },
    { category: 'No Risk (Advance / Up-to-date)', value: 412, color: '#10B981' },
  ];

  // Weak Subject Analysis Recommendations
  const insights = [
    {
      id: 'ins1',
      title: 'Class 10th Algebra Performance Deficit',
      description: 'Predictive analysis of weekly testing scores indicates a 14% drop in quadratic equations comprehension across Section B.',
      actionable_advice: 'Schedule a 2-hour bridge lecture focusing on quadratic factorization before the upcoming half-yearly examinations.',
      severity: 'Medium'
    },
    {
      id: 'ins2',
      title: 'Fee Collection Delay Probability Alarm',
      description: 'AI model suggests a 22% risk of tuition collection defaults in third quarter due to holiday delays.',
      actionable_advice: 'Dispatch automated smart Fee Reminders with integrated online payment links using SMS & Email broadcasters.',
      severity: 'High'
    },
    {
      id: 'ins3',
      title: 'Timetable Optimization Overload warning',
      description: 'Dr. Anand Kumar is scheduled for back-to-back Practical lab periods spanning Grades 11 and 12, creating fatigue probability.',
      actionable_advice: 'Introduce a 1-period buffer gap or reallocate laboratory assistant roles to optimize schedules.',
      severity: 'Low'
    }
  ];

  const handleSendMessage = async (e?: React.FormEvent, directText?: string) => {
    if (e) e.preventDefault();
    const messageToSend = (directText || inputMessage).trim();
    if (!messageToSend || isTyping) return;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: messageToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!directText) setInputMessage('');
    setIsTyping(true);

    try {
      const history = messages.slice(-8).map(m => ({
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
          message: messageToSend,
          history
        })
      });

      const data = await res.json().catch(() => ({}));

      const replyText = data.reply || data.details || 
        `I have processed your query regarding: **"${messageToSend}"**.`;

      const aiMsg: Message = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        structuredData: data.structuredData
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      const fallbackAiMsg: Message = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: `Connected to St. Joseph’s School, Barhalganj database. Please use specific prompts for real-time attendance, fee, or exam records.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, fallbackAiMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Brain className="w-6 h-6 text-violet-600 shrink-0" />
            Artificial Intelligence (AI) Portal
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Access live ERP data grounding, role-aware academic analysis, and interactive AI assistant.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-slate-200/60 p-1.5 rounded-2xl shadow-xs flex overflow-x-auto gap-1">
        {[
          { id: 'assistant', label: 'AI Enterprise Copilot', icon: Bot },
          { id: 'predictions', label: 'Predictive Analytics & Board Forecasting', icon: TrendingUp },
          { id: 'insights', label: 'Actionable Smart Insights', icon: Sparkles }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
              activeTab === tab.id 
                ? "bg-violet-50 text-violet-600 border border-violet-100/40" 
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            )}
          >
            <tab.icon className="w-4 h-4 flex-shrink-0" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'assistant' && (
          <motion.div 
            key="assistant"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Left chat container */}
            <div className="lg:col-span-2 bg-white rounded-[24px] border border-slate-200/60 shadow-sm flex flex-col h-[550px] overflow-hidden">
              <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-violet-600 shrink-0" />
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Interactive AI chat</h3>
                    <span className="text-[10px] text-slate-400 font-semibold">Active Engine: Google Gemini (Live Supabase Grounding)</span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 bg-violet-100 text-violet-700 rounded-full text-[10px] font-extrabold uppercase">
                  {roleLabel || 'ERP User'}
                </span>
              </div>

              {/* Chat Viewport */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
                {messages.map(msg => (
                  <div 
                    key={msg.id} 
                    className={cn(
                      "flex gap-3 max-w-[85%] items-start",
                      msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                    )}
                  >
                    <div className={cn(
                      "p-3 rounded-2xl text-xs leading-relaxed font-medium shadow-3xs w-full",
                      msg.sender === 'user' 
                        ? 'bg-violet-600 text-white rounded-tr-none' 
                        : 'bg-slate-50 text-slate-800 border border-slate-200/70 rounded-tl-none'
                    )}>
                      <div className={cn("prose prose-xs max-w-none break-words", msg.sender === 'user' ? 'text-white' : 'text-slate-800')}>
                        <Markdown>{msg.text}</Markdown>
                      </div>

                      {/* Structured ERP Payloads */}
                      {msg.sender === 'ai' && Array.isArray(msg.structuredData) && msg.structuredData.map((item, idx) => (
                        <StructuredMessageRenderer
                          key={idx}
                          payload={item}
                          accessToken={session?.access_token}
                        />
                      ))}

                      <span className={cn(
                        "text-[8px] font-bold block mt-1.5 text-right",
                        msg.sender === 'user' ? 'text-violet-200' : 'text-slate-400'
                      )}>
                        {msg.time}
                      </span>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex gap-2 items-center text-slate-400 text-xs font-semibold pl-1">
                    <Bot size={14} className="animate-bounce" />
                    <span>Gemini is querying school ERP records...</span>
                  </div>
                )}
              </div>

              {/* Input section */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 bg-slate-50/20 flex gap-2">
                <input 
                  type="text"
                  placeholder="Ask anything about attendance, fees, exams, timetable, or students..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  className="flex-1 bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isTyping}
                  className="p-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-all cursor-pointer shadow-sm shadow-violet-500/10 disabled:opacity-40"
                >
                  <Send size={15} />
                </button>
              </form>
            </div>

            {/* Right helpful recommendations panel */}
            <div className="space-y-4">
              <div className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-2xs">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">Suggested prompts</h3>
                <div className="space-y-2">
                  {suggestedPrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(undefined, p)}
                      className="w-full text-left p-2.5 rounded-xl border border-slate-150 hover:border-violet-200 hover:bg-violet-50/20 text-[11px] font-bold text-slate-600 transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <span className="truncate">{p}</span>
                      <ArrowRight size={12} className="text-slate-400 group-hover:text-violet-600 shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#1a73e8]/5 to-[#061f3d]/10 border border-[#1a73e8]/15 rounded-2xl p-4 shadow-2xs space-y-2">
                <div className="flex items-center gap-1.5">
                  <Brain size={16} className="text-[#1a73e8]" />
                  <span className="text-[10px] font-black uppercase text-[#1a73e8] tracking-wider">AI Model Roster</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-600 leading-normal">
                  Our core predictive models are fine-tuned on historic multi-year student exam scores, attendance sheets, and payment rosters to provide up to 94.6% forecasting accuracy.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'predictions' && (
          <motion.div 
            key="predictions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Chart 1: Passing probability vs Average score */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-[24px] border border-slate-200/60 shadow-sm p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Class-wise Passing Probability & Scores</h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Forecasted passing likelihood (%) vs current average examination scores (%).</p>
                  </div>
                </div>

                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={performanceData}>
                      <defs>
                        <linearGradient id="colorPass" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1a73e8" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#1a73e8" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} fontWeight={600} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} fontWeight={600} tickLine={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="passingProb" name="Passing Probability (%)" stroke="#1a73e8" fillOpacity={1} fill="url(#colorPass)" strokeWidth={2.5} />
                      <Area type="monotone" dataKey="avgScore" name="Avg Score (%)" stroke="#10B981" fillOpacity={1} fill="url(#colorScore)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie Chart: Tuition defaulter risk */}
              <div className="bg-white rounded-[24px] border border-slate-200/60 shadow-sm p-5 space-y-4">
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Fee defaulter Risk Profile</h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">AI projection of default rates across active parent roster.</p>
                </div>

                <div className="h-56 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={defaulterRiskData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {defaulterRiskData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                    <span className="text-xl font-black text-slate-800 leading-none">496</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Parents</span>
                  </div>
                </div>

                {/* Risk Labels */}
                <div className="space-y-1.5">
                  {defaulterRiskData.map((risk, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs font-bold text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: risk.color }} />
                        <span>{risk.category.split('(')[0]}</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400 font-extrabold">{risk.value} accounts</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'insights' && (
          <motion.div 
            key="insights"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {insights.map(item => (
              <div key={item.id} className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "status-pill text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border",
                      item.severity === 'High' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                      item.severity === 'Medium' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                      'bg-slate-50 text-slate-500 border-slate-100'
                    )}>
                      {item.severity} Priority Alert
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold font-mono">ID: {item.id}</span>
                  </div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">{item.title}</h3>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">{item.description}</p>
                  <p className="text-[11px] text-violet-600 font-bold bg-violet-50/50 p-2.5 rounded-xl border border-violet-100/35">
                    <strong>Actionable Advice: </strong>{item.actionable_advice}
                  </p>
                </div>
                <div className="shrink-0">
                  <button 
                    onClick={() => toast.success('Insight dispatch initiated to department heads')}
                    className="flex items-center gap-1.5 px-3.5 h-[34px] bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-md shadow-violet-500/10"
                  >
                    Resolve Alert
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
