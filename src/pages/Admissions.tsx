import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  GraduationCap,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Users,
  Sparkles,
  Check,
  Loader2,
  MessageSquare,
  FileText,
  Send,
  Bot,
  Mic,
  MicOff,
  Phone,
  Calendar,
  MapPin,
  Clock,
  Printer,
  Download,
  ShieldCheck,
  HelpCircle,
  School,
  AlertCircle,
  RefreshCw,
  Copy,
  ExternalLink
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Navbar } from '@/components/Navbar';
import Footer from '@/components/Footer';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Field, inputCls, selectCls, textareaCls } from '@/components/admissions/AdmissionUI';
import { admissionService } from '@/services/admissionService';

// Official SJS Barhalganj Media URLs
const SJS_MEDIA = {
  logoIcon: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/logo_icon.JPG',
  favicon: 'https://sjsbrlschool.edu.in/favicon.png',
  campusLogo: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/Campulogo.png'
};

const STEPS = [
  { id: 1, title: 'Personal Info', short: 'Personal', icon: User },
  { id: 2, title: 'Guardian Details', short: 'Guardian', icon: Users },
  { id: 3, title: 'Academic History', short: 'Academic', icon: GraduationCap },
  { id: 4, title: 'Final Submission', short: 'Submit', icon: CheckCircle2 },
];

interface ChatMsg {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  time: string;
  quickReplies?: string[];
}

export default function Admissions() {
  const [activeTab, setActiveTab] = useState<'chat' | 'form'>('chat');
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    dob: '',
    gender: 'male',
    class: '1st',
    section: 'A',
    academic_year: '2026-27',
    fatherName: '',
    motherName: '',
    phone: '',
    email: '',
    address: '',
    aadhaar_last4: '',
    prevSchool: '',
    percentage: '',
    tcNumber: '',
    photoUrl: ''
  });

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: "👋 **Welcome to St. Joseph’s School, Barhalganj Admissions Portal!**\n\nI am your **AI Admission Assistant**. I can help you register for **Session 2026–27** in just 2 minutes or answer any questions about our CBSE curriculum, fees, school timings, and facilities.\n\nTo begin your application, **what is the applicant student’s full name?**",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      quickReplies: ['Aarav Sharma', 'Aditi Verma', 'Rohan Singh', 'Ask About Fees', 'School Timings']
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isBotTyping, activeTab]);

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setChatInput(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error('Voice input is not supported in this browser.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast.info('Listening… Speak clearly now');
      } catch (err) {
        setIsListening(false);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Chat AI Logic & Field Extraction
  const handleSendChat = (textToSend?: string) => {
    const text = (textToSend || chatInput).trim();
    if (!text || isBotTyping) return;

    const userMsg: ChatMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsBotTyping(true);

    setTimeout(() => {
      processChatResponse(text);
      setIsBotTyping(false);
    }, 600);
  };

  const processChatResponse = (userInput: string) => {
    const lower = userInput.toLowerCase();
    let botReply = '';
    let quickReplies: string[] | undefined = undefined;

    // Helper: update form state and give conversational confirmation
    if (!formData.name && !lower.includes('fee') && !lower.includes('time') && !lower.includes('bus') && !lower.includes('doc')) {
      const cleanedName = userInput.replace(/my name is|student name is|i am/gi, '').trim();
      setFormData(prev => ({ ...prev, name: cleanedName }));
      botReply = `Great! Nice to meet you. I've noted the applicant name as **${cleanedName}**.\n\nWhich **class** are you seeking admission for in Session 2026-27?`;
      quickReplies = ['Nursery', 'LKG', 'UKG', 'Class 1st', 'Class 5th', 'Class 9th', 'Class 11th (Science)'];
    } else if (lower.includes('nursery') || lower.includes('lkg') || lower.includes('ukg') || lower.includes('class') || lower.includes('1st') || lower.includes('2nd') || lower.includes('3rd') || lower.includes('4th') || lower.includes('5th') || lower.includes('6th') || lower.includes('7th') || lower.includes('8th') || lower.includes('9th') || lower.includes('10th') || lower.includes('11th') || lower.includes('12th')) {
      const matchedClass = lower.match(/(nursery|lkg|ukg|1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|11th|12th|\d+th|\d+)/i)?.[0] || '1st';
      const formattedClass = matchedClass.replace(/class/i, '').trim();
      setFormData(prev => ({ ...prev, class: formattedClass }));
      botReply = `Noted **Class ${formattedClass}** for the academic session 2026-27.\n\nPlease select or tell me the applicant's **gender** and **date of birth** (e.g., 15-08-2018):`;
      quickReplies = ['Male', 'Female', '2018-05-12', '2015-09-20'];
    } else if (lower === 'male' || lower === 'female' || lower === 'other') {
      setFormData(prev => ({ ...prev, gender: lower }));
      botReply = `Gender set to **${lower.toUpperCase()}**.\n\nNow, please share the **Father’s Full Name** and **Primary Contact Number** for communication:`;
      quickReplies = ['Father: Mr. Rajesh Sharma', 'Phone: 9450881215'];
    } else if (lower.includes('father') || lower.includes('phone') || lower.includes('mr.') || (lower.split(' ').length >= 2 && !formData.fatherName)) {
      const fatherVal = userInput.replace(/father('s)? name is|father:/gi, '').trim();
      setFormData(prev => ({
        ...prev,
        fatherName: prev.fatherName || fatherVal,
        phone: prev.phone || (userInput.match(/\d{10}/)?.[0] || prev.phone)
      }));
      botReply = `Thank you! I have recorded Father's Name: **${formData.fatherName || fatherVal}**.\n\nPlease provide your **Residential Address / Town** (e.g. Barhalganj, Gola Bazar, Dohrighat):`;
      quickReplies = ['Barhalganj, Gorakhpur', 'Gola Bazar', 'Dohrighat', 'Bhatpar Rani'];
    } else if (lower.includes('fee') || lower.includes('fees') || lower.includes('cost')) {
      botReply = `📌 **St. Joseph’s School Fee Structure (2026–27):**\n\n* **Nursery – UKG**: ~₹1,800 / month\n* **Primary (Class 1–5)**: ~₹2,200 / month\n* **Middle (Class 6–8)**: ~₹2,600 / month\n* **Secondary (Class 9–10)**: ~₹3,200 / month\n* **Senior Secondary (Class 11–12)**: ~₹3,800 / month\n\n*Concessions available for sibling admissions and meritorious students.* Would you like to continue with your application?`;
      quickReplies = ['Continue Application', 'School Timings', 'Transport Facility'];
    } else if (lower.includes('time') || lower.includes('timing') || lower.includes('hour')) {
      botReply = `⏰ **School Timings:**\n* **Summer Timings**: 7:30 AM – 1:30 PM\n* **Winter Timings**: 8:00 AM – 2:00 PM\n* **Administrative Counter**: 8:00 AM – 3:00 PM (Mon – Sat)`;
      quickReplies = ['Continue Application', 'Bus Routes', 'Required Documents'];
    } else if (lower.includes('bus') || lower.includes('transport') || lower.includes('route')) {
      botReply = `🚌 **GPS-Enabled School Fleet:**\nOur buses cover Barhalganj, Gola, Chillupar, Dohrighat, Gagaha, and adjoining 30+ km radial routes with dedicated female attendants and emergency SOS systems.`;
      quickReplies = ['Continue Application', 'Required Documents', 'Ask About Fees'];
    } else if (lower.includes('doc') || lower.includes('document') || lower.includes('certificate')) {
      botReply = `📄 **Required Documents for Verification:**\n1. Student Birth Certificate (Municipal/Gram Panchayat)\n2. Previous Year Report Card (Class 1 and above)\n3. Transfer Certificate (TC) from recognized school\n4. 4 Passport-size photographs\n5. Aadhaar Card copy (Student & Parents)`;
      quickReplies = ['Continue Application', 'Submit My Form'];
    } else if (lower.includes('submit application') || lower.includes('submit my form') || lower === 'submit' || lower.includes('submit now')) {
      if (!formData.name) {
        botReply = `To submit your application, please provide the **Applicant's Full Name** first:`;
        quickReplies = ['Student: Aarav Kumar', 'Student: Priya Sharma'];
      } else if (!formData.fatherName) {
        botReply = `Almost ready! Please share the **Father's / Guardian's Name** to complete the registration:`;
        quickReplies = ['Father: Mr. Rajesh Kumar', 'Father: Mr. Manoj Sharma'];
      } else {
        handleFinalSubmit();
        botReply = `🎉 Processing your application for **${formData.name}** (Class ${formData.class})...\n\nGenerating your instant Registration Slip now!`;
        quickReplies = ['Ask About Fees', 'Required Documents', 'School Timings'];
      }
    } else {
      // General input handling: capture address or other info
      if (!formData.address && formData.fatherName) {
        setFormData(prev => ({ ...prev, address: userInput }));
        botReply = `Got it! Address recorded as **${userInput}**.\n\n🎉 Your basic application profile is ready! Would you like to submit now and get your **Instant Admission Tracking ID**?`;
        quickReplies = ['Submit Application Now', 'Edit Details'];
      } else {
        botReply = `Thank you for sharing that information. I've updated your registration file.\n\nYou can review your real-time **Admission Application Slip** on the right side or tap **Submit Application** to complete!`;
        quickReplies = ['Submit Application Now', 'Ask About Fees', 'Required Documents'];
      }
    }

    const replyMsg: ChatMsg = {
      id: (Date.now() + 1).toString(),
      sender: 'bot',
      text: botReply,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      quickReplies
    };

    setChatMessages(prev => [...prev, replyMsg]);
  };

  // Submission handler
  const handleFinalSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!formData.name) {
      toast.error('Please provide the student’s name.');
      return;
    }
    if (!formData.fatherName) {
      toast.error('Please provide the father/guardian’s name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await admissionService.createAdmission({
        name: formData.name,
        date_of_birth: formData.dob || new Date().toISOString().split('T')[0],
        gender: formData.gender.toLowerCase(),
        class: formData.class,
        section: formData.section || 'A',
        academic_year: formData.academic_year,
        father_name: formData.fatherName,
        mother_name: formData.motherName || '',
        phone: formData.phone || '',
        email: formData.email || '',
        address: formData.address || '',
        photo_url: formData.photoUrl || '',
        aadhaar_last4: formData.aadhaar_last4 || '',
        previous_school: formData.prevSchool || '',
        previous_marks: formData.percentage || '',
        transfer_certificate_no: formData.tcNumber || '',
        status: 'Pending'
      });

      setSubmittedData(created);
      setShowReceiptModal(true);
      toast.success(`Application registered! ID: ${created.application_number}`);
    } catch (error: any) {
      console.error('Submission error:', error);
      toast.error(`Submission failed: ${error.message || 'Check database connection'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Completion calculation for live card
  const requiredFields = [formData.name, formData.fatherName, formData.phone, formData.class];
  const filledCount = requiredFields.filter(Boolean).length;
  const profileCompletion = Math.round((filledCount / requiredFields.length) * 100);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-between font-sans text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
      <Navbar transparent={false} />
{/* Hero Header */}
      <section className="relative pt-28 sm:pt-36 pb-12 bg-gradient-to-b from-blue-950 via-slate-900 to-slate-900 text-white overflow-hidden border-b border-blue-900/40">
        {/* Glow backdrop circles */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/2 right-10 w-[300px] h-[300px] bg-amber-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          
          {/* Authentic Crest Emblem */}
          <div className="inline-flex items-center justify-center mb-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-1.5 shadow-2xl ring-4 ring-amber-400/30 flex items-center justify-center">
              <img
                src={SJS_MEDIA.logoIcon}
                alt="St. Joseph's Emblem"
                className="w-full h-full object-contain rounded-xl"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = SJS_MEDIA.favicon;
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Session 2026–27 Registration Open
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-600/30 text-blue-200 border border-blue-400/30 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> CBSE Aff. No. 2131498
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black font-serif tracking-tight text-white mb-2">
            Student Admission Application
          </h1>
          <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto mb-8 font-medium">
            St. Joseph’s School, Barhalganj · Value-Centered Catholic & CBSE Education
          </p>

          {/* Mode Switcher Pills */}
          <div className="inline-flex p-1.5 bg-slate-950/80 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={cn(
                'flex items-center gap-2 px-5 sm:px-7 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer',
                activeTab === 'chat'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/30 scale-102'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              )}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Interactive AI Chat Mode</span>
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-amber-400/30 text-[10px] uppercase font-bold text-slate-950">Fastest</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className={cn(
                'flex items-center gap-2 px-5 sm:px-7 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer',
                activeTab === 'form'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/30 scale-102'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              )}
            >
              <FileText className="w-4 h-4" />
              <span>Structured 4-Step Form</span>
            </button>
          </div>

        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1">
        
        {/* MODE 1: INTERACTIVE AI ADMISSION CHAT */}
        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left: Chat Container */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col h-[650px] overflow-hidden">
              
              {/* Chat Header */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 text-white flex items-center justify-between border-b border-blue-900/50">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                      <Bot className="w-5 h-5" />
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-slate-900 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                      Sister St. Joseph’s AI Assistant
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/30 text-[10px] text-blue-300 font-mono">ONLINE</span>
                    </h3>
                    <p className="text-xs text-slate-300">Admission Guidance & Instant Auto-Registration</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setChatMessages([chatMessages[0]]);
                    setFormData({
                      name: '',
                      dob: '',
                      gender: 'male',
                      class: '1st',
                      section: 'A',
                      academic_year: '2026-27',
                      fatherName: '',
                      motherName: '',
                      phone: '',
                      email: '',
                      address: '',
                      aadhaar_last4: '',
                      prevSchool: '',
                      percentage: '',
                      tcNumber: '',
                      photoUrl: ''
                    });
                    toast.info('Chat session restarted.');
                  }}
                  className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                  title="Restart Admission Chat"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Chat Message Scrollable Body */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-50/50">
                {chatMessages.map(msg => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn('flex flex-col max-w-[85%]', msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start')}
                  >
                    <div
                      className={cn(
                        'p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm',
                        msg.sender === 'user'
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none prose prose-sm max-w-none'
                      )}
                    >
                      <div className="whitespace-pre-line font-sans">
                        {msg.text}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                      {msg.time}
                    </span>

                    {/* Quick suggestion reply chips */}
                    {msg.quickReplies && msg.quickReplies.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {msg.quickReplies.map((qr, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSendChat(qr)}
                            className="px-3 py-1.5 rounded-full bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                          >
                            {qr}
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}

                {isBotTyping && (
                  <div className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-2xl w-fit text-slate-500 text-xs shadow-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    <span>AI Counselor is typing…</span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleListening}
                  className={cn(
                    'p-2.5 rounded-xl border transition-all cursor-pointer',
                    isListening
                      ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  )}
                  title="Voice Input (Speech to text)"
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder={isListening ? 'Listening… speak now' : 'Type student details or ask questions…'}
                  className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                />

                <button
                  type="button"
                  onClick={() => handleSendChat()}
                  disabled={!chatInput.trim() || isBotTyping}
                  className={cn(
                    'p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-all cursor-pointer',
                    (!chatInput.trim() || isBotTyping) && 'opacity-50 cursor-not-allowed'
                  )}
                  title="Send Message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

            </div>

            {/* Right: Live Admission Slip Preview & Instant Submit */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Profile Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl shadow-slate-200/50 relative overflow-hidden">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs">
                      📋
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Live Application Slip</h3>
                      <p className="text-[11px] text-slate-500">Auto-extracted from your chat</p>
                    </div>
                  </div>

                  {/* Progress Indicator */}
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-blue-700">{profileCompletion}% Complete</span>
                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-amber-500 transition-all duration-500"
                        style={{ width: `${profileCompletion}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Form Fields Summary */}
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Applicant Name:</span>
                    <span className="font-bold text-slate-900">{formData.name || <em className="text-slate-400 font-normal">Pending</em>}</span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Target Class:</span>
                    <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      Class {formData.class}
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Academic Session:</span>
                    <span className="font-bold text-slate-900">{formData.academic_year}</span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Gender:</span>
                    <span className="font-bold text-slate-900 uppercase">{formData.gender || '—'}</span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Father / Guardian:</span>
                    <span className="font-bold text-slate-900">{formData.fatherName || <em className="text-slate-400 font-normal">Pending</em>}</span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Contact Phone:</span>
                    <span className="font-bold text-slate-900">{formData.phone || <em className="text-slate-400 font-normal">Pending</em>}</span>
                  </div>

                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500 font-medium">Address:</span>
                    <span className="font-bold text-slate-900 text-right max-w-[200px] truncate">{formData.address || 'Barhalganj (Default)'}</span>
                  </div>
                </div>

                {/* Instant Submit CTA */}
                <div className="mt-6 pt-5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleFinalSubmit()}
                    disabled={isSubmitting || !formData.name || !formData.fatherName}
                    className={cn(
                      'w-full py-3.5 px-6 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer',
                      (!formData.name || !formData.fatherName)
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-emerald-600/25 hover:scale-101'
                    )}
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>{isSubmitting ? 'Registering Application…' : 'Submit Application & Generate Slip'}</span>
                  </button>

                  {(!formData.name || !formData.fatherName) && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200/60 mt-3 text-center flex items-center justify-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Please share student name and father's name in chat to activate submission.
                    </p>
                  )}
                </div>

              </div>

              {/* Quick Institution Helpline Card */}
              <div className="bg-gradient-to-br from-blue-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-blue-800/40">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Admission Desk Helplines
                </h4>
                <div className="space-y-2.5 text-xs text-slate-200">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span>Administrative Office:</span>
                    <a href="tel:+919450881215" className="font-bold text-amber-300 hover:underline">+91 94508 81215</a>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span>Principal / Inquiry:</span>
                    <a href="tel:+919450881216" className="font-bold text-amber-300 hover:underline">+91 94508 81216</a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Office Timings:</span>
                    <span className="text-slate-300">8:00 AM – 3:00 PM (Mon-Sat)</span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* MODE 2: STRUCTURED 4-STEP FORM */}
        {activeTab === 'form' && (
          <div className="max-w-3xl mx-auto">
            {/* Progress tracker */}
            <div className="mb-8 sm:mb-10">
              <div className="relative">
                <div className="absolute top-5 left-5 right-5 h-0.5 bg-slate-200 rounded-full" />
                <motion.div
                  className="absolute top-5 left-5 h-0.5 bg-gradient-to-r from-blue-700 to-blue-500 rounded-full"
                  initial={false}
                  animate={{ width: `calc((100% - 2.5rem) * ${((currentStep - 1) / (STEPS.length - 1)) * 100 / 100})` }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                />
                <ol className="relative flex justify-between">
                  {STEPS.map(step => {
                    const isDone = currentStep > step.id;
                    const isActive = currentStep === step.id;
                    const Icon = step.icon;
                    return (
                      <li key={step.id} className="flex flex-col items-center gap-2 w-20 sm:w-28">
                        <span
                          className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-300',
                            isDone
                              ? 'bg-blue-800 border-blue-800 text-white'
                              : isActive
                                ? 'bg-gradient-to-r from-blue-800 to-blue-600 border-transparent text-white shadow-md shadow-blue-800/25 scale-105'
                                : 'bg-white border-slate-200 text-slate-400'
                          )}
                        >
                          {isDone ? <Check className="w-4 h-4 stroke-[3]" /> : <Icon className="w-4.5 h-4.5" />}
                        </span>
                        <span className={cn(
                          'text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-center transition-colors',
                          currentStep >= step.id ? 'text-blue-900' : 'text-slate-400'
                        )}>
                          <span className="sm:hidden">{step.short}</span>
                          <span className="hidden sm:inline">{step.title}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>

            {/* Form card */}
            <form onSubmit={handleFinalSubmit} className="bg-white p-6 sm:p-10 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Step 1: Personal */}
                  {currentStep === 1 && (
                    <section className="space-y-6">
                      <div className="border-b border-slate-100 pb-4">
                        <h2 className="text-lg font-bold text-slate-900 font-serif">1. Student Details</h2>
                        <p className="text-xs text-slate-500">Provide authentic student information matching birth certificate</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Full Name" required>
                          <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="e.g. Aarav Sharma"
                            className={inputCls}
                          />
                        </Field>

                        <Field label="Date of Birth" required>
                          <input
                            type="date"
                            name="dob"
                            value={formData.dob}
                            onChange={handleChange}
                            className={inputCls}
                          />
                        </Field>

                        <Field label="Gender" required>
                          <select name="gender" value={formData.gender} onChange={handleChange} className={selectCls}>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                          </select>
                        </Field>

                        <Field label="Applying for Class" required>
                          <select name="class" value={formData.class} onChange={handleChange} className={selectCls}>
                            {['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'].map(c => (
                              <option key={c} value={c}>Class {c}</option>
                            ))}
                          </select>
                        </Field>

                        <Field label="Aadhaar Last 4 Digits">
                          <input
                            type="text"
                            name="aadhaar_last4"
                            maxLength={4}
                            value={formData.aadhaar_last4}
                            onChange={handleChange}
                            placeholder="••••"
                            className={inputCls}
                          />
                        </Field>

                        <Field label="Academic Session">
                          <input
                            type="text"
                            readOnly
                            value={formData.academic_year}
                            className={cn(inputCls, 'bg-slate-100 text-slate-500 cursor-not-allowed')}
                          />
                        </Field>
                      </div>
                    </section>
                  )}

                  {/* Step 2: Guardian */}
                  {currentStep === 2 && (
                    <section className="space-y-6">
                      <div className="border-b border-slate-100 pb-4">
                        <h2 className="text-lg font-bold text-slate-900 font-serif">2. Parents & Guardian Details</h2>
                        <p className="text-xs text-slate-500">Emergency contacts and correspondence details</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Father’s Name" required>
                          <input
                            type="text"
                            name="fatherName"
                            value={formData.fatherName}
                            onChange={handleChange}
                            placeholder="Father's full name"
                            className={inputCls}
                          />
                        </Field>

                        <Field label="Mother’s Name">
                          <input
                            type="text"
                            name="motherName"
                            value={formData.motherName}
                            onChange={handleChange}
                            placeholder="Mother's full name"
                            className={inputCls}
                          />
                        </Field>

                        <Field label="Contact Phone Number" required>
                          <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="+91 98765 43210"
                            className={inputCls}
                          />
                        </Field>

                        <Field label="Email Address">
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="parent@example.com"
                            className={inputCls}
                          />
                        </Field>

                        <div className="sm:col-span-2">
                          <Field label="Residential Address" required>
                            <textarea
                              name="address"
                              rows={3}
                              value={formData.address}
                              onChange={handleChange}
                              placeholder="Full home address with pin code"
                              className={textareaCls}
                            />
                          </Field>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Step 3: Academic */}
                  {currentStep === 3 && (
                    <section className="space-y-6">
                      <div className="border-b border-slate-100 pb-4">
                        <h2 className="text-lg font-bold text-slate-900 font-serif">3. Academic History</h2>
                        <p className="text-xs text-slate-500">Details from previous school or institution (if applicable)</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <Field label="Previous School Name">
                            <input
                              type="text"
                              name="prevSchool"
                              value={formData.prevSchool}
                              onChange={handleChange}
                              placeholder="Name of previous school"
                              className={inputCls}
                            />
                          </Field>
                        </div>

                        <Field label="Previous Class Marks / %">
                          <input
                            type="text"
                            name="percentage"
                            value={formData.percentage}
                            onChange={handleChange}
                            placeholder="e.g. 88.5%"
                            className={inputCls}
                          />
                        </Field>

                        <Field label="Transfer Certificate (TC) No.">
                          <input
                            type="text"
                            name="tcNumber"
                            value={formData.tcNumber}
                            onChange={handleChange}
                            placeholder="e.g. TC-2026/891"
                            className={inputCls}
                          />
                        </Field>
                      </div>
                    </section>
                  )}

                  {/* Step 4: Review & Submit */}
                  {currentStep === 4 && (
                    <section className="space-y-6">
                      <div className="border-b border-slate-100 pb-4">
                        <h2 className="text-lg font-bold text-slate-900 font-serif">4. Review & Confirm Application</h2>
                        <p className="text-xs text-slate-500">Please review your entered details before submitting</p>
                      </div>

                      <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
                          {[
                            ['Student name', formData.name || '—'],
                            ['Date of birth', formData.dob || '—'],
                            ['Applying for', `Class ${formData.class}`],
                            ['Academic session', formData.academic_year],
                            ["Father's name", formData.fatherName || '—'],
                            ["Mother's name", formData.motherName || '—'],
                            ['Phone', formData.phone || '—'],
                            ['Email', formData.email || '—'],
                            ['Residential Address', formData.address || '—'],
                            ['Previous school', formData.prevSchool || '—'],
                          ].map(([label, val]) => (
                            <div key={label} className="flex justify-between border-b border-slate-200/60 pb-1.5">
                              <dt className="text-slate-500 font-medium">{label}:</dt>
                              <dd className="text-slate-900 font-bold">{val}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl text-xs text-blue-900">
                        <div className="flex items-center gap-2 font-bold text-blue-950 mb-1">
                          <Sparkles className="w-4 h-4 text-blue-700" /> Admission Policy Notice
                        </div>
                        Submitting this online registration creates an enquiry and provisional admission profile. Final seat confirmation is subject to document verification by St. Joseph’s School Barhalganj.
                      </div>
                    </section>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Controls */}
              <div className="flex justify-between items-center gap-3 mt-10 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(prev => Math.max(prev - 1, 1))}
                  className={cn(
                    'flex items-center gap-1.5 px-5 py-3 rounded-xl font-bold text-xs transition-colors',
                    currentStep === 1 ? 'opacity-0 pointer-events-none' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer'
                  )}
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>

                {currentStep < STEPS.length ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (currentStep === 1 && !formData.name) {
                        toast.error('Please enter the student name');
                        return;
                      }
                      if (currentStep === 2 && !formData.fatherName) {
                        toast.error("Please enter the father's name");
                        return;
                      }
                      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
                    }}
                    className="flex items-center gap-1.5 px-7 py-3 bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-900/20 transition-all cursor-pointer"
                  >
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={cn(
                      'flex items-center gap-1.5 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer',
                      isSubmitting && 'opacity-60 cursor-not-allowed'
                    )}
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {isSubmitting ? 'Submitting Application…' : 'Submit Admission Application'}
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

      </main>

      {/* SUCCESS CONFIRMATION & PRINTABLE RECEIPT MODAL */}
      <AnimatePresence>
        {showReceiptModal && submittedData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative my-8"
            >
              {/* Header with crest */}
              <div className="text-center pb-5 border-b border-slate-200">
                <div className="w-16 h-16 mx-auto mb-2 rounded-xl bg-white p-1 shadow-md border border-slate-200">
                  <img src={SJS_MEDIA.logoIcon} alt="SJS Crest" className="w-full h-full object-contain rounded-lg" />
                </div>
                <h3 className="font-serif font-black text-xl text-blue-950">ST. JOSEPH’S SCHOOL</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Barhalganj, Gorakhpur (U.P.)</p>
                <div className="inline-block mt-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-700 text-xs font-bold">
                  ✓ Admission Application Registered
                </div>
              </div>

              {/* Receipt Details Body */}
              <div className="py-5 space-y-4 text-xs">
                <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Application Tracking No:</span>
                    <div className="text-base font-mono font-black text-blue-900 mt-0.5">
                      {submittedData.application_number}
                    </div>
                  </div>
                  <QRCodeSVG value={`https://sjsbrlschool.edu.in/verify/${submittedData.application_number}`} size={56} />
                </div>

                <div className="grid grid-cols-2 gap-3 text-slate-700">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Applicant Name</div>
                    <div className="font-bold text-slate-900 text-sm mt-0.5">{submittedData.name}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Class & Session</div>
                    <div className="font-bold text-blue-800 text-sm mt-0.5">Class {submittedData.class} ({submittedData.academic_year})</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Father / Guardian</div>
                    <div className="font-bold text-slate-900 mt-0.5">{submittedData.father_name}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Contact Phone</div>
                    <div className="font-bold text-slate-900 mt-0.5">{submittedData.phone || 'Recorded'}</div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200/80 p-3.5 rounded-xl text-amber-900 text-[11px] leading-relaxed">
                  <strong>Next Step:</strong> Please visit the administrative counter at St. Joseph’s School with original birth certificate, previous marksheets, and 4 photographs for final seat allotment.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-3 bg-blue-900 hover:bg-blue-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print / Save PDF Slip
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowReceiptModal(false);
                    window.location.href = '/';
                  }}
                  className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Unified Enterprise Footer */}
      <Footer showCallout={false} />
    </div>
  );
}
