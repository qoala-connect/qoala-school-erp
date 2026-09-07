import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ChevronDown, 
  Menu, 
  X, 
  ExternalLink, 
  Phone, 
  PhoneCall,
  Mail, 
  Sparkles, 
  GraduationCap, 
  ShieldCheck, 
  FileText,
  Lock,
  ArrowRight,
  Home,
  School,
  Building2,
  BookOpen,
  Trophy,
  Calendar,
  Activity,
  FileCheck,
  FileSignature,
  CreditCard,
  Bus,
  Images,
  Compass,
  History,
  Award,
  LogIn
} from 'lucide-react';
import { cn } from '@/lib/utils';
import sjsFavicon from '@/assets/sjs_favicon.png';
import sjsLogoIcon from '@/assets/sjs_logo_icon.jpg';

interface NavbarProps {
  transparent?: boolean;
}

export function Navbar({ transparent = false }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLinkClick = () => {
    setMobileMenuOpen(false);
    setActiveDropdown(null);
  };

  const handleMouseEnter = (name: string) => {
    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
    setActiveDropdown(name);
  };

  const handleMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 150);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full font-sans transition-all duration-200">
      
      {/* 1. TOP UTILITY BAR (Deep Navy, Crisp Information & Icons from sjsbrlschool.edu.in) */}
      <div className="w-full bg-[#061f3d] text-slate-200 text-[11px] font-medium border-b border-white/10 hidden sm:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between">
          
          {/* Left: Affiliation & Contact */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-amber-300 font-semibold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              CBSE Affiliation No: 2131498 • School Code: 70836
            </span>
            <span className="text-white/20">|</span>
            <a 
              href="tel:+919450883433" 
              className="hover:text-white transition-colors flex items-center gap-1.5 group"
            >
              <PhoneCall className="w-3 h-3 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
              <span>+91 94508 83433</span>
            </a>
            <span className="text-white/20">|</span>
            <a 
              href="tel:06572284061" 
              className="hover:text-white transition-colors flex items-center gap-1 text-slate-300 text-[10.5px] hidden md:flex"
              title="School Landline Contact"
            >
              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
              <span>0657-2284061</span>
            </a>
            <span className="text-white/20 hidden md:inline">|</span>
            <a 
              href="mailto:info@sjsbrlschool.edu.in" 
              className="hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Mail className="w-3 h-3 text-blue-300 shrink-0" />
              <span>info@sjsbrlschool.edu.in</span>
            </a>
          </div>

          {/* Right: Notice & Quick Links */}
          <div className="flex items-center gap-3">
            <Link 
              to="/admissions" 
              className="text-amber-300 hover:text-amber-200 font-bold flex items-center gap-1.5 transition-colors bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-400/30"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Admissions Open 2026-27</span>
            </Link>
            <span className="text-white/20">|</span>
            <a 
              href="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/pdf/PublicDisclosure.pdf"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1 text-[11px] text-slate-300 hover:text-amber-200"
            >
              <FileText className="w-3 h-3 text-slate-400" />
              <span>Mandatory Disclosure</span>
            </a>
            <span className="text-white/20">|</span>
            <Link 
              to="/login"
              className="hover:text-white transition-colors flex items-center gap-1.5 text-[11px] font-semibold text-blue-300 hover:text-blue-200"
            >
              <LogIn className="w-3 h-3 text-blue-400" />
              <span>ERP Access</span>
            </Link>
          </div>

        </div>
      </div>

      {/* 2. MAIN NAVIGATION BAR (Crisp Glass Surface with School Icon & Refined Title Bar Icons) */}
      <div className={cn(
        "w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 transition-all duration-200",
        isScrolled ? "shadow-md py-2" : "shadow-xs py-2.5"
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          
          {/* Brand Logo & Institution Typography */}
          <Link to="/" onClick={handleLinkClick} className="flex items-center gap-3 group">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full p-0.5 bg-white shadow-xs border border-amber-400/40 ring-2 ring-slate-100 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform duration-200">
              <img 
                src={sjsFavicon || sjsLogoIcon}
                alt="St. Joseph's School Crest"
                className="w-full h-full object-contain rounded-full"
                onError={(e) => {
                  (e.target as HTMLElement).setAttribute('src', 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/logo_icon.JPG');
                }}
              />
            </div>
            
            <div className="flex flex-col min-w-0">
              <span className="font-serif font-black text-[#061f3d] text-base sm:text-lg tracking-tight leading-none group-hover:text-blue-900 transition-colors">
                ST. JOSEPH'S SCHOOL
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[9px] sm:text-[9.5px] font-black text-amber-700 tracking-wider uppercase">
                  BARHALGANJ • ESTD. 1996
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-300 inline-block shrink-0" />
                <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-tight hidden md:inline">
                  Affiliated to CBSE, New Delhi
                </span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation Links with Polished Section Icons */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5 text-[13px] font-bold text-slate-700">
            
            {/* Home */}
            <Link 
              to="/" 
              onClick={handleLinkClick}
              className={cn(
                "px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 hover:text-blue-900 hover:bg-slate-100/80",
                location.pathname === '/' ? "text-blue-900 font-black bg-blue-50/80 shadow-2xs" : "text-slate-700"
              )}
            >
              <Home className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Home</span>
            </Link>

            {/* About Us Dropdown */}
            <div 
              className="relative py-2"
              onMouseEnter={() => handleMouseEnter('about')}
              onMouseLeave={handleMouseLeave}
            >
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:text-blue-900 hover:bg-slate-100/80 transition-colors cursor-pointer">
                <School className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>About Us</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-0.5" />
              </button>

              {activeDropdown === 'about' && (
                <div className="absolute top-full left-0 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 text-xs font-semibold text-slate-800 animate-in fade-in zoom-in-95 duration-150">
                  <Link to="/about" onClick={handleLinkClick} className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors">
                    <History className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Our School & History</span>
                  </Link>
                  <Link to="/about#vision" onClick={handleLinkClick} className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors">
                    <Compass className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Vision, Mission & Values</span>
                  </Link>
                  <Link to="/about#motto" onClick={handleLinkClick} className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors">
                    <Award className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>School Motto & Crest</span>
                  </Link>
                  <Link to="/about#infrastructure" onClick={handleLinkClick} className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Campus Infrastructure</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Academics Dropdown */}
            <div 
              className="relative py-2"
              onMouseEnter={() => handleMouseEnter('academics')}
              onMouseLeave={handleMouseLeave}
            >
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:text-blue-900 hover:bg-slate-100/80 transition-colors cursor-pointer">
                <GraduationCap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Academics</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-0.5" />
              </button>

              {activeDropdown === 'academics' && (
                <div className="absolute top-full left-0 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 text-xs font-semibold text-slate-800 animate-in fade-in zoom-in-95 duration-150">
                  <Link to="/#about" onClick={handleLinkClick} className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors">
                    <BookOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>CBSE Curriculum & Streams</span>
                  </Link>
                  <Link to="/#toppers" onClick={handleLinkClick} className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors">
                    <Trophy className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Board Examination & Toppers</span>
                  </Link>
                  <Link to="/#calendar" onClick={handleLinkClick} className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors">
                    <Calendar className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Academic Calendar & Events</span>
                  </Link>
                  <Link to="/#events" onClick={handleLinkClick} className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors">
                    <Activity className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Co-Curricular & Sports</span>
                  </Link>
                  <a 
                    href="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/pdf/PublicDisclosure.pdf" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 text-amber-800 font-bold border-t border-slate-100"
                  >
                    <span className="flex items-center gap-2">
                      <FileCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span>Mandatory Disclosure</span>
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                </div>
              )}
            </div>

            {/* Admissions Dropdown */}
            <div 
              className="relative py-2"
              onMouseEnter={() => handleMouseEnter('admissions')}
              onMouseLeave={handleMouseLeave}
            >
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:text-blue-900 hover:bg-slate-100/80 transition-colors cursor-pointer">
                <FileSignature className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Admissions</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-0.5" />
              </button>

              {activeDropdown === 'admissions' && (
                <div className="absolute top-full left-0 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 text-xs font-semibold text-slate-800 animate-in fade-in zoom-in-95 duration-150">
                  <Link to="/admissions" onClick={handleLinkClick} className="flex items-center gap-2.5 px-4 py-2 hover:bg-amber-50 text-amber-900 font-bold transition-colors">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Online Registration 2026-27</span>
                  </Link>
                  <Link to="/admissions" onClick={handleLinkClick} className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors">
                    <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Admission Guidelines</span>
                  </Link>
                  <Link to="/admissions" onClick={handleLinkClick} className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Fee Structure & Details</span>
                  </Link>
                  <a 
                    href="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/pdf/BusRoutes.pdf"
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <Bus className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>Bus Routes Policy</span>
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                </div>
              )}
            </div>

            {/* Gallery */}
            <Link 
              to="/#gallery" 
              onClick={handleLinkClick}
              className="px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 hover:text-blue-900 hover:bg-slate-100/80"
            >
              <Images className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span>Gallery</span>
            </Link>

          </nav>

          {/* Right Action Buttons */}
          <div className="hidden sm:flex items-center gap-2.5">
            <Link 
              to="/admissions"
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-xs shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer hover:scale-102"
            >
              <Sparkles className="w-3.5 h-3.5 text-slate-950" />
              <span>Apply Online</span>
            </Link>

            <Link 
              to="/login"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer hover:scale-102"
            >
              <Lock className="w-3.5 h-3.5 text-blue-400" />
              <span>ERP Login</span>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

        </div>

        {/* MOBILE MENU DRAWER */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-slate-200 px-5 pt-3 pb-6 space-y-2 text-sm font-semibold shadow-2xl animate-in slide-in-from-top-2 duration-150">
            <Link to="/" onClick={handleLinkClick} className="flex items-center gap-2.5 py-2 text-blue-950 font-bold border-b border-slate-100">
              <Home className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Home</span>
            </Link>
            <Link to="/about" onClick={handleLinkClick} className="flex items-center gap-2.5 py-2 text-slate-700 border-b border-slate-100">
              <School className="w-4 h-4 text-amber-600 shrink-0" />
              <span>About Us (Our School, Vision & Motto)</span>
            </Link>
            <Link to="/admissions" onClick={handleLinkClick} className="flex items-center gap-2.5 py-2 text-amber-800 font-bold border-b border-slate-100">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Admissions 2026-27</span>
            </Link>
            <Link to="/#calendar" onClick={handleLinkClick} className="flex items-center gap-2.5 py-2 text-slate-700 border-b border-slate-100">
              <Calendar className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Academic Calendar</span>
            </Link>
            <Link to="/#toppers" onClick={handleLinkClick} className="flex items-center gap-2.5 py-2 text-slate-700 border-b border-slate-100">
              <Trophy className="w-4 h-4 text-amber-600 shrink-0" />
              <span>CBSE Board Toppers</span>
            </Link>
            <Link to="/#gallery" onClick={handleLinkClick} className="flex items-center gap-2.5 py-2 text-slate-700 border-b border-slate-100">
              <Images className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Photo Gallery</span>
            </Link>
            <a 
              href="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/pdf/BusRoutes.pdf"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between py-2 text-indigo-700 font-bold border-b border-slate-100"
            >
              <span className="flex items-center gap-2.5">
                <Bus className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Bus Routes</span>
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
            <a 
              href="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/pdf/PublicDisclosure.pdf"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between py-2 text-rose-700 font-bold border-b border-slate-100"
            >
              <span className="flex items-center gap-2.5">
                <FileCheck className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Mandatory Public Disclosure</span>
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>

            <div className="pt-3 flex flex-col gap-2">
              <Link to="/admissions" onClick={handleLinkClick} className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 py-2.5 rounded-xl font-bold text-xs shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Apply for Admission 2026-27</span>
              </Link>
              <Link to="/login" onClick={handleLinkClick} className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl font-bold text-xs shadow-xs">
                <LogIn className="w-3.5 h-3.5 text-blue-400" />
                <span>Student & Staff ERP Portal Login</span>
              </Link>
            </div>
          </div>
        )}

      </div>
    </header>
  );
}
