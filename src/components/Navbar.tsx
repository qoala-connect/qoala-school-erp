import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Paperclip, Menu, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavbarProps {
  transparent?: boolean;
}

export function Navbar({ transparent = false }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const location = useLocation();

  const handleLinkClick = () => {
    setMobileMenuOpen(false);
    setActiveDropdown(null);
  };

  const tickerItems = [
    { title: "Admissions Open for Session 2026-27 (Playway to Class XI)", link: "/admissions" },
    { title: "CBSE Affiliation No. 2131498 | School Code: 70836", link: "https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/pdf/PublicDisclosure.pdf" },
    { title: "Lead Kindly Light through Love, Justice & Service - St. Joseph’s School Barhalganj", link: "/about" },
    { title: "Quarterly Academic Fees Online Payment & ERP Portal Active", link: "/login" }
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full font-sans">
      
      {/* 1:1 SJS LIVE HEADER WRAPPER */}
      <div 
        className="w-full bg-[#f4f7fb] border-b border-slate-200 shadow-md relative"
        style={{
          backgroundImage: `url('https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/background.gif')`,
          backgroundSize: '100% auto'
        }}
      >
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between min-h-[105px] py-2 md:py-0">
          
          {/* LEFT 30%: WIDE SJS COMPOSITE LOGO */}
          <div className="w-full md:w-[32%] lg:w-[28%] flex items-center justify-between md:justify-start py-1">
            <Link to="/" onClick={handleLinkClick} className="block group">
              <img 
                src="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/logo.png" 
                alt="St. Joseph’s school, Barhalganj" 
                className="max-w-[280px] sm:max-w-[340px] w-full h-auto object-contain transition-transform group-hover:scale-[1.02]"
              />
            </Link>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-white/80 text-[#881525] hover:bg-white shadow-sm border border-slate-200 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* RIGHT 70%: MAROON TICKER + FLOATING ASYMMETRIC NAVBAR */}
          <div className="hidden md:flex md:w-[68%] lg:w-[72%] flex-col items-end justify-between self-stretch py-2">
            
            {/* TOP MAROON MARQUEE RIBBON (.highlights) */}
            <div className="w-full lg:w-[95%] bg-[#881525] text-white text-xs font-semibold rounded-t-sm shadow-sm overflow-hidden py-1 px-3 flex items-center">
              <span className="text-[10px] font-black uppercase tracking-wider bg-black/30 px-2 py-0.5 rounded mr-2 shrink-0 text-amber-300">
                Notice
              </span>
              {React.createElement(
                'marquee',
                {
                  className: "text-xs uppercase tracking-wide flex-1 cursor-pointer",
                  onMouseOver: (e: any) => e.currentTarget.stop(),
                  onMouseOut: (e: any) => e.currentTarget.start()
                },
                tickerItems.map((item, idx) => (
                  <span key={idx} className="inline-flex items-center mx-4">
                    {item.link.startsWith('http') ? (
                      <a href={item.link} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1 text-white">
                        {item.title} <Paperclip className="w-3 h-3 opacity-80" />
                      </a>
                    ) : (
                      <Link to={item.link} className="hover:underline flex items-center gap-1 text-white">
                        {item.title} <Paperclip className="w-3 h-3 opacity-80" />
                      </Link>
                    )}
                    <span className="ml-4 text-white/50">|</span>
                  </span>
                ))
              )}
            </div>

            {/* FLOATING ASYMMETRIC NAVBAR (border-radius: 30px 100px 30px 100px) */}
            <nav 
              className="w-full lg:w-[95%] bg-white/95 backdrop-blur-md shadow-lg border border-slate-200/80 px-4 py-2 mt-2 flex items-center justify-between z-40"
              style={{
                borderRadius: '30px 100px 30px 100px'
              }}
            >
              <ul className="flex items-center justify-evenly w-full text-[14px] lg:text-[15px] font-bold text-slate-800">
                
                {/* Home */}
                <li className="relative">
                  <Link 
                    to="/" 
                    onClick={handleLinkClick}
                    className="px-3 py-1.5 hover:text-[#881525] transition-colors"
                  >
                    Home
                  </Link>
                </li>

                {/* About Us */}
                <li 
                  className="relative group py-1"
                  onMouseEnter={() => setActiveDropdown('about')}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <button className="flex items-center gap-1 px-3 py-1.5 hover:text-[#881525] transition-colors">
                    About Us <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                  </button>

                  {activeDropdown === 'about' && (
                    <ul className="absolute top-full left-0 w-56 bg-[#881525] text-white rounded-lg shadow-xl py-2 z-50 animate-fadeIn text-xs font-semibold">
                      <li>
                        <Link to="/about" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-[#6e0f1d] text-white border-b border-white/10">
                          Our School
                        </Link>
                      </li>
                      <li>
                        <Link to="/about#vision" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-[#6e0f1d] text-white border-b border-white/10">
                          Our Vision & Values
                        </Link>
                      </li>
                      <li>
                        <Link to="/about#motto" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-[#6e0f1d] text-white border-b border-white/10">
                          School Motto
                        </Link>
                      </li>
                      <li>
                        <Link to="/about#infrastructure" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-[#6e0f1d] text-white">
                          Infrastructure
                        </Link>
                      </li>
                    </ul>
                  )}
                </li>

                {/* Administration */}
                <li 
                  className="relative group py-1"
                  onMouseEnter={() => setActiveDropdown('admin')}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <button className="flex items-center gap-1 px-3 py-1.5 hover:text-[#881525] transition-colors">
                    Administration <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                  </button>

                  {activeDropdown === 'admin' && (
                    <ul className="absolute top-full left-0 w-56 bg-[#881525] text-white rounded-lg shadow-xl py-2 z-50 animate-fadeIn text-xs font-semibold">
                      <li>
                        <Link to="/about" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-[#6e0f1d] text-white">
                          Principal’s Message
                        </Link>
                      </li>
                    </ul>
                  )}
                </li>

                {/* Academics */}
                <li 
                  className="relative group py-1"
                  onMouseEnter={() => setActiveDropdown('academics')}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <button className="flex items-center gap-1 px-3 py-1.5 hover:text-[#881525] transition-colors">
                    Academics <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                  </button>

                  {activeDropdown === 'academics' && (
                    <ul className="absolute top-full left-0 w-64 bg-[#881525] text-white rounded-lg shadow-xl py-2 z-50 animate-fadeIn text-xs font-semibold">
                      <li>
                        <Link to="/#about" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-[#6e0f1d] text-white border-b border-white/10">
                          Curriculum
                        </Link>
                      </li>
                      <li>
                        <Link to="/#toppers" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-[#6e0f1d] text-white border-b border-white/10">
                          Examination & Promotion
                        </Link>
                      </li>
                      <li>
                        <Link to="/#events" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-[#6e0f1d] text-white border-b border-white/10">
                          Co-Curricular Activities
                        </Link>
                      </li>
                      <li>
                        <Link to="/#calendar" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-[#6e0f1d] text-white border-b border-white/10">
                          Attendance & Leave
                        </Link>
                      </li>
                      <li>
                        <Link to="/#calendar" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-[#6e0f1d] text-white border-b border-white/10">
                          Academic Calendar
                        </Link>
                      </li>
                      <li>
                        <Link to="/#about" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-[#6e0f1d] text-white border-b border-white/10">
                          Booklist
                        </Link>
                      </li>
                      <li>
                        <Link to="/#about" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-[#6e0f1d] text-white border-b border-white/10">
                          School Uniform
                        </Link>
                      </li>
                      <li>
                        <a 
                          href="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/pdf/PublicDisclosure.pdf" 
                          target="_blank" 
                          rel="noreferrer" 
                          className="block px-4 py-2 hover:bg-[#6e0f1d] text-amber-300 font-bold flex items-center justify-between"
                        >
                          Mandatory Public Disclosure <ExternalLink className="w-3 h-3" />
                        </a>
                      </li>
                    </ul>
                  )}
                </li>

                {/* Prospects */}
                <li 
                  className="relative group py-1"
                  onMouseEnter={() => setActiveDropdown('prospects')}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <button className="flex items-center gap-1 px-3 py-1.5 hover:text-[#881525] transition-colors">
                    Prospects <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                  </button>

                  {activeDropdown === 'prospects' && (
                    <ul className="absolute top-full left-0 w-64 bg-[#881525] text-white rounded-lg shadow-xl py-2 z-50 animate-fadeIn text-xs font-semibold">
                      <li>
                        <Link to="/admissions" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-[#6e0f1d] text-amber-300 font-bold border-b border-white/10">
                          Registration 2026-27
                        </Link>
                      </li>
                      <li>
                        <Link to="/admissions" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-[#6e0f1d] text-white border-b border-white/10">
                          Admission & Withdrawal
                        </Link>
                      </li>
                      <li>
                        <Link to="/admissions" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-[#6e0f1d] text-white border-b border-white/10">
                          Conduct & Discipline
                        </Link>
                      </li>
                      <li>
                        <Link to="/admissions" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-[#6e0f1d] text-white border-b border-white/10">
                          Recommendation to the parents
                        </Link>
                      </li>
                      <li>
                        <Link to="/admissions" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-[#6e0f1d] text-white border-b border-white/10">
                          Instruction to the Students
                        </Link>
                      </li>
                      <li>
                        <Link to="/admissions" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-[#6e0f1d] text-white border-b border-white/10">
                          School Fee Structure
                        </Link>
                      </li>
                      <li>
                        <Link to="/admissions" onClick={handleLinkClick} className="block px-4 py-2 hover:bg-[#6e0f1d] text-white">
                          Bus Rules & Conveyance
                        </Link>
                      </li>
                    </ul>
                  )}
                </li>

                {/* Gallery */}
                <li>
                  <Link 
                    to="/#gallery" 
                    onClick={handleLinkClick}
                    className="px-3 py-1.5 hover:text-[#881525] transition-colors"
                  >
                    Gallery
                  </Link>
                </li>

                {/* ERP / Login */}
                <li>
                  <Link 
                    to="/login" 
                    className="bg-[#881525] hover:bg-[#6e0f1d] text-white px-4 py-1.5 rounded-full font-bold text-xs uppercase tracking-wider transition-all shadow-sm"
                  >
                    ERP Login
                  </Link>
                </li>

              </ul>
            </nav>

          </div>

        </div>

        {/* MOBILE RESPONSIVE DRAWER */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-200 px-4 pt-3 pb-6 space-y-2 text-sm font-semibold shadow-2xl animate-fadeIn">
            <Link to="/" onClick={handleLinkClick} className="block py-2 text-[#881525] font-bold border-b border-slate-100">
              Home
            </Link>
            <Link to="/about" onClick={handleLinkClick} className="block py-2 text-slate-700 border-b border-slate-100">
              About Us (Our School, Vision & Motto)
            </Link>
            <Link to="/admissions" onClick={handleLinkClick} className="block py-2 text-amber-700 font-bold border-b border-slate-100">
              Registration / Admissions 2026-27
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
              className="block py-2 text-red-700 font-bold border-b border-slate-100 flex items-center justify-between"
            >
              Mandatory Public Disclosure <ExternalLink className="w-4 h-4" />
            </a>

            <div className="pt-2 flex flex-col gap-2">
              <Link to="/admissions" onClick={handleLinkClick} className="w-full text-center bg-[#881525] text-white py-2.5 rounded-lg font-bold">
                Online Admission Form
              </Link>
              <Link to="/login" onClick={handleLinkClick} className="w-full text-center bg-slate-900 text-white py-2.5 rounded-lg font-bold">
                Student & Staff ERP Login
              </Link>
            </div>
          </div>
        )}

      </div>
    </header>
  );
}
