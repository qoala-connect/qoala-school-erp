import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Footer from '@/components/Footer';
import {
  Phone,
  Mail,
  MapPin,
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Award,
  BookOpen,
  Users,
  Clock,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  FileText,
  ShieldCheck,
  GraduationCap,
  Bell,
  ArrowRight,
  ArrowLeft,
  Play,
  Quote,
  Star,
  School,
  Bus,
  Layers,
  Camera,
  Download,
  Instagram,
  Linkedin,
  Facebook,
  Youtube,
  CreditCard
} from 'lucide-react';
import { toast } from 'sonner';

// Official SJS Barhalganj Media URLs
const SJS_MEDIA = {
  logo: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/logo.png',
  footerLogo: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/ftr-logo.png',
  campusLogo: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/Campulogo.png',
  slider1: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/slider1.png',
  about1: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/about1.jpg',
  about2: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/about2.jpg',
  aboutBadge: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/aboutimg.png',
  about3: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/about3.jpg',
  about4: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/about4.jpg',
  topperBanner: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/topper.png',
  trophy: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/trophy.png',
  phoneGif: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/phone.gif',
  locationGif: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/location.gif',
  callIcon: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/call-icon.png',
  eventsPlaceholder: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/events.jpg',
  newsPlaceholder: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/news.jpg',
  profileThumb: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/profilethumb.png'
};

import { Navbar } from '@/components/Navbar';
import OnlineAdmissionModal from '@/components/admissions/OnlineAdmissionModal';

export default function Home() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(2026);
  const [activeCalendarDay, setActiveCalendarDay] = useState<number | null>(null);
  const [activeGalleryTab, setActiveGalleryTab] = useState('all');
  const [showApplyModal, setShowApplyModal] = useState(false);

  // Auto-trigger Admission Modal after 5 seconds on the home page (with cancel/close option)
  useEffect(() => {
    const hasSeenModal = sessionStorage.getItem('sjs_admission_modal_shown');
    if (!hasSeenModal) {
      const timer = setTimeout(() => {
        setShowApplyModal(true);
        sessionStorage.setItem('sjs_admission_modal_shown', 'true');
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Slider items
  const slides = [
    {
      img: SJS_MEDIA.slider1,
      quoteAuthor: 'Will Durant',
      quoteText: 'Knowledge is the eye of desire and can become the pilot of the soul.'
    },
    {
      img: SJS_MEDIA.about1,
      quoteAuthor: 'St. Joseph’s Philosophy',
      quoteText: 'Lead kindly light through the enduring values of love, truth, and dedicated service.'
    },
    {
      img: SJS_MEDIA.about2,
      quoteAuthor: 'Academic Excellence',
      quoteText: 'Fostering intellectual curiosity, scientific temper, and holistic moral development.'
    }
  ];

  // Auto rotate slides
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  // Calendar event data
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const calendarEvents: Record<number, Array<{ day: number; title: string; category: string }>> = {
    8: [ // September
      { day: 5, title: "Teachers' Day Celebration & Special Assembly", category: "Celebration" },
      { day: 14, title: "Hindi Diwas Inter-House Debate & Poetry", category: "Academic" },
      { day: 22, title: "CBSE Half-Yearly Examinations Commence", category: "Exam" },
      { day: 30, title: "Periodic Assessment Results Moderation", category: "Academic" }
    ],
    9: [ // October
      { day: 2, title: "Gandhi Jayanti & Clean Campus Drive", category: "Holiday" },
      { day: 12, title: "Dussehra & Autumn Break", category: "Holiday" },
      { day: 24, title: "Annual Science & STEM Innovation Exhibition", category: "Exhibition" }
    ],
    10: [ // November
      { day: 14, title: "Children's Day Carnival & Sports Meet", category: "Sports" },
      { day: 26, title: "Constitution Day Assembly & Legal Literacy", category: "Special" }
    ]
  };

  const currentMonthEvents = calendarEvents[selectedMonth] || [
    { day: 1, title: 'Commencement of Regular Academic Session', category: 'Academic' },
    { day: 15, title: 'Parent-Teacher Interaction Meet (PTM)', category: 'Meeting' }
  ];

  // CBSE Toppers
  const toppersClass10 = [
    { name: 'Aarav Gupta', percent: '98.4%', stream: 'CBSE Class X', rank: 'Rank 1', img: SJS_MEDIA.trophy },
    { name: 'Ananya Srivastava', percent: '97.6%', stream: 'CBSE Class X', rank: 'Rank 2', img: SJS_MEDIA.trophy },
    { name: 'Rohan Pandey', percent: '96.8%', stream: 'CBSE Class X', rank: 'Rank 3', img: SJS_MEDIA.trophy }
  ];

  const toppersClass12 = [
    { name: 'Shreya Mishra', percent: '97.8%', stream: 'Science (PCM/CS)', rank: 'Rank 1', img: SJS_MEDIA.trophy },
    { name: 'Aditya Singh', percent: '96.5%', stream: 'Science (PCB)', rank: 'Rank 2', img: SJS_MEDIA.trophy },
    { name: 'Priya Tiwari', percent: '95.9%', stream: 'Commerce', rank: 'Rank 3', img: SJS_MEDIA.trophy }
  ];

  // Events & News
  const schoolEvents = [
    {
      title: 'Annual Inter-School Sports Meet 2026',
      date: 'OCT 18',
      venue: 'Main Sports Complex',
      time: '08:30 AM',
      desc: 'Annual track & field events, basketball tournament, and martial arts demonstrations.'
    },
    {
      title: 'CBSE Regional Science & Robotics Expo',
      date: 'NOV 04',
      venue: 'SJS Auditorium & Labs',
      time: '09:00 AM',
      desc: 'Interactive STEM projects, AI models, and environmental sustainability models by senior students.'
    },
    {
      title: 'Christmas & Winter Carnival Assembly',
      date: 'DEC 22',
      venue: 'School Amphitheatre',
      time: '10:00 AM',
      desc: 'Special choral performances, cultural skits, and student excellence awards presentation.'
    }
  ];

  const latestNews = [
    {
      title: 'Admissions Open for Academic Session 2026-27 (Playway to Class XI)',
      date: 'Latest Notice',
      desc: 'Registration forms are available online and at the administrative school office counter.'
    },
    {
      title: 'CBSE Class X & XII Pre-Board Examination Schedule Released',
      date: 'Exam Notice',
      desc: 'Students can collect their detailed subject datesheet and syllabus checklist from the examination portal.'
    },
    {
      title: 'Mandatory Public Disclosure & CBSE Extension Compliances',
      date: 'Official',
      desc: 'Updated safety certificates, building norms, and fee structure details uploaded as per CBSE norms.'
    }
  ];

  // Gallery images
  const galleryItems = [
    { title: 'Smart Digital Classrooms', cat: 'campus', img: SJS_MEDIA.about1 },
    { title: 'Advanced Science Laboratories', cat: 'labs', img: SJS_MEDIA.about2 },
    { title: 'Annual Cultural Festival', cat: 'events', img: SJS_MEDIA.about3 },
    { title: 'Sports & Athletic Training', cat: 'sports', img: SJS_MEDIA.about4 },
    { title: 'Senior Computer Science Lab', cat: 'labs', img: SJS_MEDIA.slider1 },
    { title: 'School Assembly & Campus Ground', cat: 'campus', img: SJS_MEDIA.about1 }
  ];

  const filteredGallery = activeGalleryTab === 'all'
    ? galleryItems
    : galleryItems.filter(item => item.cat === activeGalleryTab);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
      
      {/* ENTERPRISE DUAL-TIER NAVBAR */}
      <Navbar transparent={false} />

      {/* ENTERPRISE MODERN HERO SECTION */}
      <section className="relative bg-gradient-to-b from-slate-100/90 via-white to-slate-50 overflow-hidden pt-28 sm:pt-32 lg:pt-36 pb-12 lg:pb-16 border-b border-slate-200/80">
        
        {/* Subtle background ambient mesh */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            
            {/* LEFT COLUMN: HERO HEADLINES & ENTERPRISE PORTALS (7 Cols) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Admissions Session Micro-Badge */}
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 shadow-2xs">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-600 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
                </span>
                <span className="text-xs font-bold text-blue-900 tracking-wide">
                  Admissions Open 2026-27
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-[11px] font-semibold text-slate-600">
                  CBSE Affiliation No. 2131498
                </span>
              </div>

              {/* Main Headline */}
              <div className="space-y-2">
                <h1 className="text-3xl sm:text-5xl lg:text-[54px] font-black text-slate-900 tracking-tight font-serif leading-[1.12]">
                  Nurturing Visionary Minds with{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-900">
                    Excellence &amp; Values.
                  </span>
                </h1>
                <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed max-w-xl">
                  St. Joseph’s School, Barhalganj provides holistic CBSE Senior Secondary education, digital smart classrooms, AI robotics laboratories, and time-tested moral discipline since 1996.
                </p>
              </div>

              {/* Primary Call-to-Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(true)}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 hover:from-blue-800 hover:to-indigo-800 text-white px-6 py-3.5 rounded-xl font-bold text-xs sm:text-sm tracking-wide transition-all shadow-md shadow-blue-950/20 hover:scale-102 cursor-pointer group"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Apply for Admission 2026-27</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <a
                  href="#about"
                  className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 px-5 py-3.5 rounded-xl font-bold text-xs sm:text-sm tracking-wide transition-all shadow-2xs hover:border-slate-400 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-blue-700 text-blue-700" />
                  <span>Explore Campus</span>
                </a>

                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-3.5 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-blue-700" />
                  <span>ERP Portal</span>
                </Link>
              </div>

              {/* Enterprise Quick Hub Cards (4-Column Integrated Desk) */}
              <div className="pt-2 border-t border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                  Campus Digital Services &amp; Portals
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <Link
                    to="/login"
                    className="p-2.5 bg-white hover:bg-blue-50/70 border border-slate-200 rounded-xl transition-all group shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-slate-900 group-hover:text-blue-900 truncate">SIS Portal</div>
                        <div className="text-[9px] text-slate-400 truncate">Student / Parent</div>
                      </div>
                    </div>
                  </Link>

                  <Link
                    to="/login"
                    className="p-2.5 bg-white hover:bg-emerald-50/70 border border-slate-200 rounded-xl transition-all group shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <CreditCard className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-slate-900 group-hover:text-emerald-900 truncate">Fee Payment</div>
                        <div className="text-[9px] text-slate-400 truncate">Online Receipts</div>
                      </div>
                    </div>
                  </Link>

                  <a
                    href="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/pdf/PublicDisclosure.pdf"
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 bg-white hover:bg-amber-50/70 border border-slate-200 rounded-xl transition-all group shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-slate-900 group-hover:text-amber-900 truncate">CBSE Docs</div>
                        <div className="text-[9px] text-slate-400 truncate">Public Disclosure</div>
                      </div>
                    </div>
                  </a>

                  <a
                    href="tel:+919450883433"
                    className="p-2.5 bg-white hover:bg-indigo-50/70 border border-slate-200 rounded-xl transition-all group shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Phone className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-slate-900 group-hover:text-indigo-900 truncate">Helpdesk</div>
                        <div className="text-[9px] text-slate-400 truncate">Direct Inquiry</div>
                      </div>
                    </div>
                  </a>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: PRESTIGE SLIDER FRAME WITH FLOATING BADGES (5 Cols) */}
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl p-2 bg-white shadow-2xl shadow-slate-900/10 border border-slate-200/90 group">
                
                {/* Visual Image Slider with Ken Burns */}
                <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-slate-950">
                  {slides.map((slide, idx) => (
                    <div
                      key={idx}
                      className={`absolute inset-0 transition-opacity duration-1000 ${
                        activeSlide === idx ? 'opacity-100 z-10' : 'opacity-0 z-0'
                      }`}
                    >
                      <img
                        src={slide.img}
                        alt="St. Joseph's School Campus"
                        className={`w-full h-full object-cover object-center ${
                          activeSlide === idx ? 'sjs-hero-kenburns' : ''
                        }`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
                    </div>
                  ))}

                  {/* Floating Metric Badge 1 (Top Left) */}
                  <div className="absolute top-3 left-3 z-20 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-md flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] font-black text-slate-900 font-mono">100% CBSE Pass Rate</span>
                  </div>

                  {/* Floating Metric Badge 2 (Top Right) */}
                  <div className="absolute top-3 right-3 z-20 bg-slate-950/80 backdrop-blur-md text-white px-2.5 py-1 rounded-xl border border-white/20 text-[10px] font-bold font-mono">
                    EST. 1996
                  </div>

                  {/* Quote Overlay at bottom of slider */}
                  <div className="absolute bottom-3 left-3 right-3 z-20 bg-slate-950/80 backdrop-blur-md p-3 rounded-xl border border-white/10 text-white">
                    <p className="text-xs italic font-serif leading-snug line-clamp-2 text-slate-200">
                      "{slides[activeSlide].quoteText}"
                    </p>
                    <div className="flex items-center justify-between mt-1.5 text-[10px]">
                      <span className="font-bold text-amber-300 uppercase tracking-wider">
                        — {slides[activeSlide].quoteAuthor}
                      </span>
                      <div className="flex items-center gap-1 text-slate-400 font-mono">
                        <span>0{activeSlide + 1}</span>
                        <span>/</span>
                        <span>0{slides.length}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Slider Navigation Bar Controls */}
                <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => setActiveSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1))}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="text-[11px]">Prev</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {slides.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveSlide(idx)}
                        className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                          activeSlide === idx ? 'w-5 bg-blue-700' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                        }`}
                        aria-label={`Slide ${idx + 1}`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveSlide((prev) => (prev + 1) % slides.length)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span className="text-[11px]">Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

              </div>
            </div>

          </div>
        </div>

        {/* INSTITUTIONAL TRUST & METRICS BANNER */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-800 border border-blue-200/70 flex items-center justify-center font-bold shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-slate-900 font-serif leading-none">30+ Yrs</div>
                <div className="text-[11px] font-bold text-slate-700 mt-1">Academic Legacy</div>
                <div className="text-[10px] text-slate-400">Trusted Since 1996</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/70 flex items-center justify-center font-bold shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-slate-900 font-serif leading-none">100%</div>
                <div className="text-[11px] font-bold text-slate-700 mt-1">Board Pass Rate</div>
                <div className="text-[10px] text-slate-400">CBSE District Toppers</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200/70 flex items-center justify-center font-bold shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-slate-900 font-serif leading-none">3,000+</div>
                <div className="text-[11px] font-bold text-slate-700 mt-1">Active Scholars</div>
                <div className="text-[10px] text-slate-400">Nursery to Class XII</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-800 border border-amber-200/70 flex items-center justify-center font-bold shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-slate-900 font-serif leading-none">1:25</div>
                <div className="text-[11px] font-bold text-slate-700 mt-1">Teacher Ratio</div>
                <div className="text-[10px] text-slate-400">Personal Mentorship</div>
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* 6. EXACT 1:1 CLONE: ABOUT ST. JOSEPH'S SCHOOL & 5-IMAGE ORBITING COMPOSITE (.about-bg) */}
      <section id="about" className="py-14 sm:py-20 bg-white relative overflow-hidden sjs-about-container">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Column: Authentic Rounded White Card (.about-card) */}
            <div className="lg:col-span-6">
              <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-10 shadow-2xl shadow-slate-900/10 border border-slate-200/90 space-y-4 sm:space-y-5">
                
                <p className="text-xs font-bold uppercase text-slate-500 tracking-widest">
                  ABOUT US
                </p>
                
                <h2 className="text-2xl sm:text-3xl lg:text-[32px] font-black text-[#061f3d] font-serif leading-snug tracking-tight">
                  ST. JOSEPH’S SCHOOL, BARHALGANJ
                </h2>

                <p className="text-slate-700 text-xs sm:text-sm font-semibold leading-relaxed sm:leading-7 text-justify uppercase font-sans">
                  ST. JOSEPH’S SCHOOL, BARHALGANJ, AFFILIATED TO THE CENTRAL BOARD OF SECONDARY EDUCATION, NEW DELHI (AFF. NO. 2131498) IS AN ENGLISH MEDIUM CHRISTIAN MINORITY EDUCATIONAL INSTITUTION ESTABLISHED IN 2007, ADMINISTERED AND GOVERNED BY THE CATHOLIC DIOCESE OF GORAKHPUR EDUCATION SOCIETY, REGISTERED UNDER THE SOCIETY'S REGISTRATION ACT.
                </p>

                <div className="pt-2">
                  <Link
                    to="/about"
                    className="sjs-btn-pill px-8 py-3 text-xs tracking-wider shadow-lg hover:scale-105 transition-transform"
                  >
                    READ MORE
                  </Link>
                </div>

              </div>
            </div>

            {/* Right Column: Exact 5-Image Orbiting Composite from Live Website */}
            <div className="lg:col-span-6">
              <div className="relative w-full max-w-[480px] sm:max-w-[520px] aspect-square mx-auto flex items-center justify-center p-6">
                
                {/* 1. Orbit Top-Left (about1.jpg) */}
                <div className="sjs-orb-img sjs-orb-1 w-24 h-24 sm:w-32 sm:h-32 shadow-xl hover:scale-110 transition-transform">
                  <img 
                    src="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/about1.jpg" 
                    alt="Students Classroom" 
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* 2. Orbit Top-Right (about2.jpg) */}
                <div className="sjs-orb-img sjs-orb-2 w-24 h-24 sm:w-32 sm:h-32 shadow-xl hover:scale-110 transition-transform">
                  <img 
                    src="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/about2.jpg" 
                    alt="Student Studying" 
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* 3. Center Main Feature with Live Dynamic Wavy Borders (aboutimg.png) */}
                <div className="sjs-center-img shadow-2xl hover:scale-105 transition-transform">
                  <img 
                    src="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/aboutimg.png" 
                    alt="St. Joseph's Students Campus Walk" 
                    className="w-full h-auto object-cover rounded-2xl relative z-10"
                  />
                </div>

                {/* 4. Orbit Bottom-Left (about3.jpg) */}
                <div className="sjs-orb-img sjs-orb-3 w-24 h-24 sm:w-32 sm:h-32 shadow-xl hover:scale-110 transition-transform">
                  <img 
                    src="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/about3.jpg" 
                    alt="Junior School Students" 
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* 5. Orbit Bottom-Right (about4.jpg) */}
                <div className="sjs-orb-img sjs-orb-4 w-24 h-24 sm:w-32 sm:h-32 shadow-xl hover:scale-110 transition-transform">
                  <img 
                    src="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/about4.jpg" 
                    alt="Group Activities" 
                    className="w-full h-full object-cover"
                  />
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 7. EXACT 1:1 CLONE: ACADEMIC CALENDAR SECTION FROM LIVE WEBSITE */}
      <section id="calendar" className="py-14 sm:py-20 bg-white relative overflow-hidden">
        
        {/* Ambient Rotating Background Gradients from Live CSS */}
        <div className="absolute top-10 -right-40 w-72 h-72 bg-gradient-to-tr from-[#f0dd4d] to-[#ff8800] rounded-3xl opacity-20 sjs-rotating-orb pointer-events-none" />
        <div className="absolute -bottom-20 -left-40 w-80 h-80 bg-gradient-to-tr from-[#f0dd4d] to-[#ff8800] rounded-3xl opacity-15 sjs-rotating-orb-slow pointer-events-none" />

        <div className="max-w-[1300px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          {/* Centered Bold Title */}
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#10345e] font-serif uppercase tracking-tight">
              ACADEMIC CALENDAR
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-center">
            
            {/* Left Column: Authentic Floral Paper Calendar Block (.calender_block) */}
            <div className="lg:col-span-6">
              <div className="sjs-calender-block p-4 sm:p-6 shadow-2xl">
                <div className="sjs-calender-border p-4 sm:p-5 bg-white/70 backdrop-blur-xs">
                  
                  {/* Calendar Month / Year Switcher Header */}
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/60 mb-4">
                    <button 
                      type="button"
                      onClick={() => {
                        setSelectedMonth(prev => prev === 0 ? 11 : prev - 1);
                        setActiveCalendarDay(null);
                      }}
                      className="p-1.5 rounded-lg text-slate-700 hover:text-[#0788b1] hover:bg-slate-100 transition-colors cursor-pointer"
                      aria-label="Previous Month"
                    >
                      <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                    </button>

                    <h3 className="text-base sm:text-lg font-black text-[#0788b1] tracking-wider uppercase font-sans">
                      {months[selectedMonth]} {selectedYear} - {String(selectedYear + 1).slice(-2)}
                    </h3>

                    <button 
                      type="button"
                      onClick={() => {
                        setSelectedMonth(prev => prev === 11 ? 0 : prev + 1);
                        setActiveCalendarDay(null);
                      }}
                      className="p-1.5 rounded-lg text-slate-700 hover:text-[#0788b1] hover:bg-slate-100 transition-colors cursor-pointer"
                      aria-label="Next Month"
                    >
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>

                  {/* Days of the Week Header */}
                  <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                      <span key={d} className="text-[11px] sm:text-xs font-bold text-slate-800 uppercase tracking-tight py-1">
                        {d}
                      </span>
                    ))}
                  </div>

                  {/* Numeric Date Grid */}
                  <div className="grid grid-cols-7 gap-1 text-center text-xs sm:text-sm">
                    {/* Leading empty spaces for alignment */}
                    {Array.from({ length: new Date(selectedYear, selectedMonth, 1).getDay() }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-8 sm:h-9" />
                    ))}

                    {/* Days of Month */}
                    {Array.from({ length: new Date(selectedYear, selectedMonth + 1, 0).getDate() }).map((_, i) => {
                      const dayNum = i + 1;
                      const hasEvent = calendarEvents[selectedMonth]?.some(e => e.day === dayNum);
                      const isSelected = activeCalendarDay === dayNum;

                      return (
                        <button
                          key={dayNum}
                          type="button"
                          onClick={() => setActiveCalendarDay(dayNum)}
                          className={`h-8 sm:h-9 rounded-lg flex flex-col items-center justify-center font-medium transition-all relative cursor-pointer ${
                            isSelected
                              ? 'bg-[#0788b1] text-white font-bold shadow-md'
                              : hasEvent
                                ? 'text-[#061f3d] font-bold hover:bg-emerald-50'
                                : 'text-slate-700 hover:bg-slate-100/80'
                          }`}
                        >
                          <span>{dayNum}</span>
                          {hasEvent && !isSelected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 absolute bottom-1" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                </div>
              </div>
            </div>

            {/* Right Column: Authentic Speech Bubble Event Panel (.sjs-speech-card) */}
            <div className="lg:col-span-6 relative flex items-center justify-center sjs-cal-shape-bg p-4 sm:p-8">
              
              <div className="sjs-speech-card w-full max-w-[460px] min-h-[260px] sm:min-h-[300px] p-6 sm:p-8 flex flex-col justify-center text-left">
                
                {/* Check if filtered day has events or if month has events */}
                {(() => {
                  const eventsToShow = activeCalendarDay 
                    ? (calendarEvents[selectedMonth] || []).filter(e => e.day === activeCalendarDay)
                    : (calendarEvents[selectedMonth] || []);

                  if (eventsToShow.length === 0) {
                    return (
                      <div className="text-center py-6">
                        <p className="text-slate-600 font-sans text-sm sm:text-base font-normal">
                          No events this month.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3.5 max-h-[280px] overflow-y-auto pr-1">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-300">
                        <span className="text-xs font-bold text-[#0788b1] uppercase tracking-wider">
                          {activeCalendarDay ? `Events on ${months[selectedMonth]} ${activeCalendarDay}` : `All Events in ${months[selectedMonth]}`}
                        </span>
                        {activeCalendarDay && (
                          <button
                            type="button"
                            onClick={() => setActiveCalendarDay(null)}
                            className="text-[11px] font-bold text-slate-500 hover:text-blue-700 underline"
                          >
                            View Month
                          </button>
                        )}
                      </div>

                      {eventsToShow.map((evt, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-white/80 rounded-xl shadow-xs border border-slate-200/60">
                          <div className="w-9 h-9 rounded-lg bg-[#0788b1] text-white flex flex-col items-center justify-center shrink-0">
                            <span className="text-[9px] uppercase font-bold leading-none">{months[selectedMonth].slice(0, 3)}</span>
                            <span className="text-sm font-black leading-none mt-0.5">{evt.day}</span>
                          </div>
                          <div>
                            <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-teal-100 text-teal-800 mb-0.5">
                              {evt.category}
                            </span>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">{evt.title}</h4>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 8. FROM THE DESK OF / LEADERSHIP MESSAGE */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Leadership Message</span>
            <h2 className="text-3xl font-black text-blue-950 font-serif mt-1">FROM THE DESK OF</h2>
            <div className="w-16 h-1 bg-amber-500 mx-auto mt-2 rounded-full" />
          </div>

          <div className="max-w-4xl mx-auto bg-gradient-to-br from-blue-950 via-slate-900 to-blue-950 rounded-3xl text-white p-8 sm:p-12 shadow-2xl relative overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              
              <div className="md:col-span-4 text-center">
                <div className="w-36 h-36 mx-auto rounded-full p-1.5 bg-gradient-to-tr from-amber-400 to-blue-500 shadow-xl overflow-hidden mb-4">
                  <img
                    src={SJS_MEDIA.profileThumb}
                    alt="Principal - St. Joseph’s School"
                    className="w-full h-full object-cover rounded-full bg-slate-800"
                  />
                </div>
                <h3 className="text-lg font-bold font-serif text-white">Principal's Desk</h3>
                <p className="text-xs text-amber-400 font-semibold tracking-wider uppercase">St. Joseph’s School</p>
              </div>

              <div className="md:col-span-8 space-y-4">
                <div className="text-amber-400 text-3xl font-serif">“</div>
                <p className="text-slate-200 text-sm sm:text-base leading-relaxed italic font-serif">
                  "Education is not merely the accumulation of facts, but the training of the mind to think critically and live compassionately. At St. Joseph’s School, we aim to awaken curiosity, strengthen character, and equip each student to navigate modern challenges with moral courage and academic competence."
                </p>
                <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                  <span className="text-xs font-bold text-slate-400">Catholic Diocese of Gorakhpur Education Society</span>
                  <Link to="/about" className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1">
                    Read Full Message <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* 9. DUAL SECTION: EVENTS & LATEST NEWS */}
      <section id="events" className="py-16 sm:py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            
            {/* Events Section */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-md border border-slate-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                <div>
                  <h3 className="text-xl font-black text-blue-950 font-serif">Events Section</h3>
                  <p className="text-xs text-slate-500 font-medium">Campus activities & co-curricular calendar</p>
                </div>
                <span className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                  <CalendarIcon className="w-5 h-5" />
                </span>
              </div>

              <div className="space-y-4">
                {schoolEvents.map((evt, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all">
                    <div className="flex items-start gap-3">
                      <div className="bg-amber-500 text-slate-950 rounded-xl px-2.5 py-1.5 text-center shrink-0 min-w-[50px] shadow-sm">
                        <span className="block text-[10px] font-black uppercase">{evt.date.split(' ')[0]}</span>
                        <span className="block text-lg font-black leading-none">{evt.date.split(' ')[1]}</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{evt.title}</h4>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-red-500" /> {evt.venue}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-blue-500" /> {evt.time}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">{evt.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Latest News & Circulars */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-md border border-slate-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                <div>
                  <h3 className="text-xl font-black text-blue-950 font-serif">Latest News / Announcements</h3>
                  <p className="text-xs text-slate-500 font-medium">Important circulars and student alerts</p>
                </div>
                <span className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                  <Bell className="w-5 h-5" />
                </span>
              </div>

              <div className="space-y-4">
                {latestNews.map((news, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-100 text-blue-900">
                        {news.date}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">Notice #{idx + 101}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">{news.title}</h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{news.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                <Link to="/login" className="text-xs font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1">
                  View All Circulars in ERP Dashboard <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 10. CBSE TOPPERS SHOWCASE */}
      <section id="toppers" className="py-16 sm:py-24 bg-gradient-to-b from-blue-950 via-slate-900 to-blue-950 text-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          {/* Header Topper Graphic */}
          <div className="text-center mb-12">
            <img 
              src={SJS_MEDIA.topperBanner} 
              alt="CBSE Examination Toppers Banner" 
              className="max-h-24 sm:max-h-32 mx-auto object-contain mb-4 drop-shadow-xl"
            />
            <h2 className="text-3xl sm:text-4xl font-black font-serif tracking-tight text-white">
              OUR ACADEMIC ACHIEVERS
            </h2>
            <p className="text-sm text-amber-400 font-bold uppercase tracking-wider mt-1">
              Celebrating Outstanding Performance in CBSE Board Examinations
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            
            {/* Class X Toppers */}
            <div className="bg-slate-900/90 rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                <h3 className="text-xl font-bold font-serif text-amber-400 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" /> CBSE Class X Toppers
                </h3>
                <span className="text-xs font-bold text-slate-400 uppercase">Class 10th</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {toppersClass10.map((st, i) => (
                  <div key={i} className="bg-slate-800/80 rounded-xl p-4 text-center border border-slate-700 hover:border-amber-400 transition-all group">
                    <img src={st.img} alt="Trophy" className="w-12 h-12 mx-auto mb-2 object-contain group-hover:scale-110 transition-transform" />
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-400 mb-1">
                      {st.rank}
                    </span>
                    <h4 className="text-sm font-bold text-white truncate">{st.name}</h4>
                    <p className="text-xs text-slate-400">{st.stream}</p>
                    <p className="text-lg font-black text-amber-400 mt-2">{st.percent}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Class XII Toppers */}
            <div className="bg-slate-900/90 rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                <h3 className="text-xl font-bold font-serif text-amber-400 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" /> CBSE Class XII Toppers
                </h3>
                <span className="text-xs font-bold text-slate-400 uppercase">Class 12th</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {toppersClass12.map((st, i) => (
                  <div key={i} className="bg-slate-800/80 rounded-xl p-4 text-center border border-slate-700 hover:border-amber-400 transition-all group">
                    <img src={st.img} alt="Trophy" className="w-12 h-12 mx-auto mb-2 object-contain group-hover:scale-110 transition-transform" />
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-400 mb-1">
                      {st.rank}
                    </span>
                    <h4 className="text-sm font-bold text-white truncate">{st.name}</h4>
                    <p className="text-xs text-slate-400">{st.stream}</p>
                    <p className="text-lg font-black text-amber-400 mt-2">{st.percent}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 11. ACTIVITIES IN IMAGES / PHOTO GALLERY */}
      <section id="gallery" className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Campus Life</span>
            <h2 className="text-3xl sm:text-4xl font-black text-blue-950 font-serif mt-1">
              Activities in Images
            </h2>
            <div className="w-16 h-1 bg-amber-500 mx-auto mt-2 rounded-full" />
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
            {[
              { id: 'all', label: 'All Activities' },
              { id: 'campus', label: 'Campus & Infrastructure' },
              { id: 'labs', label: 'Labs & Smart Class' },
              { id: 'events', label: 'Cultural & Events' },
              { id: 'sports', label: 'Sports & Athletics' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveGalleryTab(tab.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  activeGalleryTab === tab.id
                    ? 'bg-blue-900 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Gallery Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGallery.map((item, idx) => (
              <div 
                key={idx} 
                className="group relative overflow-hidden rounded-2xl shadow-md border border-slate-200 bg-slate-900 aspect-4/3"
              >
                <img 
                  src={item.img} 
                  alt={item.title} 
                  className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent opacity-80 group-hover:opacity-95 transition-opacity flex flex-col justify-end p-5">
                  <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">St. Joseph’s School</span>
                  <h4 className="text-base font-bold text-white font-serif">{item.title}</h4>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 12. & 13. ULTRA-STYLISH FLOATING CALLOUT BANNER & LUXURY FOOTER */}
      <Footer showCallout={true} />

      {/* ONLINE ADMISSION DIRECT MODAL (Auto popup & Button trigger with cancel/close) */}
      <OnlineAdmissionModal
        isOpen={showApplyModal}
        onClose={() => setShowApplyModal(false)}
      />

    </div>
  );
}

// Icon helper
function CreditCardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-6 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
    </svg>
  );
}
