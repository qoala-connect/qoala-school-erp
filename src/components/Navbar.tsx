import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ChevronDown, 
  Menu, 
  X, 
  ExternalLink, 
  Phone, 
  Mail, 
  Sparkles, 
  GraduationCap, 
  ShieldCheck, 
  FileText,
  Lock,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
      
      {/* 1. TOP UTILITY BAR (Deep Navy, Crisp Information) */}
      <div className="w-full bg-[#061f3d] text-slate-200 text-[11px] font-medium border-b border-white/10 hidden sm:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between">
          
          {/* Left: Affiliation & Contact */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              CBSE Affiliation No: 2131498 • School Code: 70836
            </span>
            <span className="text-white/20">|</span>
            <a href="tel:+919450883433" className="hover:text-white transition-colors flex items-center gap-1">
              <Phone className="w-3 h-3 text-slate-400" />
              +91 94508 83433
            </a>
            <span className="text-white/20">|</span>
            <a href="mailto:info@sjsbrlschool.edu.in" className="hover:text-white transition-colors flex items-center gap-1">
              <Mail className="w-3 h-3 text-slate-400" />
              info@sjsbrlschool.edu.in
            </a>
          </div>

          {/* Right: Notice & Quick Links */}
          <div className="flex items-center gap-3">
            <Link 
              to="/admissions" 
              className="text-amber-300 hover:text-amber-200 font-bold flex items-center gap-1 transition-colors"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              Admissions Open 2026-27
            </Link>
            <span className="text-white/20">|</span>
            <a 
              href="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/pdf/PublicDisclosure.pdf"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1 text-[11px]"
            >
              <FileText className="w-3 h-3 text-slate-400" />
              Mandatory Disclosure
            </a>
            <span className="text-white/20">|</span>
            <Link 
              to="/login"
              className="hover:text-white transition-colors flex items-center gap-1 text-[11px] font-semibold text-blue-300"
            >
              <Lock className="w-3 h-3" />
              ERP Access
            </Link>
          </div>

        </div>
      </div>

      {/* 2. MAIN NAVIGATION BAR (Crisp White Glass Surface) */}
      <div className={cn(
        "w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 transition-all duration-200",
        isScrolled ? "shadow-md py-2" : "shadow-xs py-2.5"
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          
          {/* Brand Logo & Institution Typography */}
          <Link to="/" onClick={handleLinkClick} className="flex items-center gap-3 group">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full p-0.5 bg-white shadow-xs border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
              <img 
                src="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/logo_icon.JPG"
                alt="St. Joseph's School Crest"
                className="w-full h-full object-contain rounded-full"
                onError={(e) => {
                  (e.target as HTMLElement).setAttribute('src', 'https://sjsbrlschool.edu.in/favicon.png');
                }}
              />
            </div>
            
            <div className="flex flex-col min-w-0">
              <span className="font-serif font-black text-[#061f3d] text-base sm:text-lg tracking-tight leading-none group-hover:text-blue-800 transition-colors">
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

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2 text-[13px] font-bold text-slate-700">
            
            {/* Home */}
            <Link 
              to="/" 
              onClick={handleLinkClick}
              className={cn(
                "px-3 py-2 rounded-xl transition-colors hover:text-blue-900 hover:bg-slate-100/70",
                location.pathname === '/' && "text-blue-900 font-black bg-blue-50/60"
              )}
            >
              Home
            </Link>

            {/* About Us Dropdown */}
            <div 
              className="relative py-2"
              onMouseEnter={() => handleMouseEnter('about')}
              onMouseLeave={handleMouseLeave}
            >
              <button className="flex items-center gap-1 px-3 py-1.5 rounded-xl hover:text-blue-900 hover:bg-slate-100/70 transition-colors cursor-pointer">
                About Us <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </button>

              {activeDropdown === 'about' && (
                <div className="absolute top-full left-0 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 text-xs font-semibold text-slate-800 animate-in fade-in zoom-in-95 duration-150">
                  <Link to="/about" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors">
                    Our School & History
                  </Link>
                  <Link to="/about#vision" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors">
                    Vision, Mission & Values
                  </Link>
                  <Link to="/about#motto" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors">
                    School Motto & Crest
                  </Link>
                  <Link to="/about#infrastructure" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors">
                    Campus Infrastructure
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
              <button className="flex items-center gap-1 px-3 py-1.5 rounded-xl hover:text-blue-900 hover:bg-slate-100/70 transition-colors cursor-pointer">
                Academics <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </button>

              {activeDropdown === 'academics' && (
                <div className="absolute top-full left-0 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 text-xs font-semibold text-slate-800 animate-in fade-in zoom-in-95 duration-150">
                  <Link to="/#about" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors">
                    CBSE Curriculum & Streams
                  </Link>
                  <Link to="/#toppers" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors">
                    Board Examination & Toppers
                  </Link>
                  <Link to="/#calendar" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors">
                    Academic Calendar & Events
                  </Link>
                  <Link to="/#events" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors">
                    Co-Curricular & Sports Activities
                  </Link>
                  <a 
                    href="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/pdf/PublicDisclosure.pdf" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="block px-4 py-2 hover:bg-slate-50 text-amber-800 font-bold flex items-center justify-between border-t border-slate-100"
                  >
                    Mandatory Public Disclosure <ExternalLink className="w-3 h-3" />
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
              <button className="flex items-center gap-1 px-3 py-1.5 rounded-xl hover:text-blue-900 hover:bg-slate-100/70 transition-colors cursor-pointer">
                Admissions <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </button>

              {activeDropdown === 'admissions' && (
                <div className="absolute top-full left-0 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 text-xs font-semibold text-slate-800 animate-in fade-in zoom-in-95 duration-150">
                  <Link to="/admissions" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-amber-50 text-amber-900 font-bold transition-colors">
                    Online Registration 2026-27
                  </Link>
                  <Link to="/admissions" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors">
                    Admission Guidelines & Criteria
                  </Link>
                  <Link to="/admissions" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors">
                    Fee Structure & Installments
                  </Link>
                  <Link to="/admissions" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-slate-50 hover:text-blue-900 transition-colors">
                    Transport & Bus Route Policy
                  </Link>
                </div>
              )}
            </div>

            {/* Gallery */}
            <Link 
              to="/#gallery" 
              onClick={handleLinkClick}
              className="px-3 py-2 rounded-xl transition-colors hover:text-blue-900 hover:bg-slate-100/70"
            >
              Gallery
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
          <div className="lg:hidden bg-white border-t border-slate-200 px-5 pt-3 pb-6 space-y-2.5 text-sm font-semibold shadow-2xl animate-in slide-in-from-top-2 duration-150">
            <Link to="/" onClick={handleLinkClick} className="block py-2 text-blue-950 font-bold border-b border-slate-100">
              Home
            </Link>
            <Link to="/about" onClick={handleLinkClick} className="block py-2 text-slate-700 border-b border-slate-100">
              About Us (Our School, Vision & Motto)
            </Link>
            <Link to="/admissions" onClick={handleLinkClick} className="block py-2 text-amber-800 font-bold border-b border-slate-100">
              Admissions 2026-27
            </Link>
            <Link to="/#calendar" onClick={handleLinkClick} className="block py-2 text-slate-700 border-b border-slate-100">
              Academic Calendar
            </Link>
            <Link to="/#toppers" onClick={handleLinkClick} className="block py-2 text-slate-700 border-b border-slate-100">
              CBSE Board Toppers
            </Link>
            <Link to="/#gallery" onClick={handleLinkClick} className="block py-2 text-slate-700 border-b border-slate-100">
              Photo Gallery
            </Link>
            <a 
              href="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/pdf/PublicDisclosure.pdf"
              target="_blank"
              rel="noreferrer"
              className="block py-2 text-rose-700 font-bold border-b border-slate-100 flex items-center justify-between"
            >
              Mandatory Public Disclosure <ExternalLink className="w-4 h-4" />
            </a>

            <div className="pt-2 flex flex-col gap-2">
              <Link to="/admissions" onClick={handleLinkClick} className="w-full text-center bg-amber-500 hover:bg-amber-600 text-slate-950 py-2.5 rounded-xl font-bold text-xs shadow-xs">
                Apply for Admission 2026-27
              </Link>
              <Link to="/login" onClick={handleLinkClick} className="w-full text-center bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl font-bold text-xs shadow-xs">
                Student & Staff ERP Portal Login
              </Link>
            </div>
          </div>
        )}

      </div>
    </header>
  );
}
