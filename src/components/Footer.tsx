import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Instagram, 
  Linkedin, 
  Facebook, 
  Youtube, 
  Play
} from 'lucide-react';

interface FooterProps {
  showCallout?: boolean;
}

export default function Footer({ showCallout = true }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="w-full bg-white font-sans">
      
      {/* 1. EXACT LIVE SJS UPPER FOOTER BANNER (upper-ftr.png) */}
      {showCallout && (
        <div className="contact_homepg w-full px-4 sm:px-8 lg:px-14 pt-8 pb-10 max-w-[1400px] mx-auto">
          <div 
            className="w-full min-h-[190px] sm:min-h-[210px] p-6 sm:p-10 flex flex-col md:flex-row items-center md:items-end justify-between gap-6 text-white bg-cover bg-no-repeat bg-center"
            style={{
              backgroundImage: 'url(https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/upper-ftr.png)',
              backgroundSize: '100% 100%',
              borderRadius: '24px'
            }}
          >
            {/* Left Title: Knowledge is Power, Learn to Lead Tomorrow */}
            <div className="w-full md:w-1/2 text-center md:text-left">
              <h3 className="text-2xl sm:text-3xl lg:text-[32px] font-light font-['Inter',sans-serif] leading-tight sm:leading-[42px] text-white">
                Knowledge is Power, <br className="hidden sm:inline" /> Learn to Lead Tomorrow
              </h3>
            </div>

            {/* Right Call Block: Reach Out Now + Phone */}
            <div className="flex items-center justify-center md:justify-end gap-4 w-full md:w-auto pb-1">
              <img 
                src="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/call-icon.png" 
                alt="Call" 
                className="w-12 h-12 sm:w-14 sm:h-14 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="text-left text-white">
                <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-white/90 m-0">
                  Reach Out Now
                </p>
                <a 
                  href="tel:+918853242676" 
                  className="text-xl sm:text-2xl lg:text-3xl font-bold text-white hover:underline whitespace-nowrap block"
                >
                  +91-8853242676
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. EXACT LIVE SJS BLUE WAVE FOOTER (footer-bg.png) */}
      <footer 
        className="w-full text-white pt-24 sm:pt-28 lg:pt-32 pb-6 px-4 sm:px-8 lg:px-16 relative bg-cover bg-no-repeat bg-top overflow-hidden"
        style={{
          backgroundImage: 'url(https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/footer-bg.png)',
          backgroundSize: '100% 100%',
          backgroundColor: '#1a73e8' // Fallback
        }}
      >
        {/* Animated Top Wave Shifting Gradient Accent */}
        <div className="ftrShape1-animated absolute -top-3.5 left-0 w-full h-20 pointer-events-none opacity-80" />

        <div className="max-w-[1400px] mx-auto relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-6 items-start pb-8">
            
            {/* Column 1: School Logo & Socials (3 Cols) */}
            <div className="lg:col-span-3 flex flex-col items-center text-center">
              <Link to="/" className="inline-block mb-3">
                <img 
                  src="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/ftr-logo.png" 
                  alt="St. Joseph’s school, Barhalganj" 
                  className="max-w-[200px] sm:max-w-[230px] h-auto object-contain mx-auto"
                />
              </Link>
              
              {/* Social Media Row */}
              <div className="flex items-center justify-center gap-4 text-white text-xl mt-2">
                <a 
                  href="https://instagram.com" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-white hover:text-amber-300 transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="w-5 h-5" />
                </a>
                <a 
                  href="https://linkedin.com" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-white hover:text-amber-300 transition-colors"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="w-5 h-5" />
                </a>
                <a 
                  href="https://facebook.com" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-white hover:text-amber-300 transition-colors"
                  aria-label="Facebook"
                >
                  <Facebook className="w-5 h-5" />
                </a>
                <a 
                  href="https://youtube.com" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-white hover:text-amber-300 transition-colors"
                  aria-label="YouTube"
                >
                  <Youtube className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Column 2: Quick Links (6 Cols - 2 Column Multi-column Layout) */}
            <div className="lg:col-span-6 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                
                {/* Column A */}
                <div className="space-y-2">
                  <Link to="/about#infrastructure" className="text-white text-sm font-light hover:text-amber-300 transition-colors flex items-center gap-2">
                    <Play className="w-2.5 h-2.5 fill-white text-white shrink-0" />
                    <span>Infrastructure</span>
                  </Link>
                  <Link to="/#calendar" className="text-white text-sm font-light hover:text-amber-300 transition-colors flex items-center gap-2">
                    <Play className="w-2.5 h-2.5 fill-white text-white shrink-0" />
                    <span>Academic calender</span>
                  </Link>
                  <Link to="/#events" className="text-white text-sm font-light hover:text-amber-300 transition-colors flex items-center gap-2">
                    <Play className="w-2.5 h-2.5 fill-white text-white shrink-0" />
                    <span>Co-Curricular Activities</span>
                  </Link>
                  <Link to="/#toppers" className="text-white text-sm font-light hover:text-amber-300 transition-colors flex items-center gap-2">
                    <Play className="w-2.5 h-2.5 fill-white text-white shrink-0" />
                    <span>Achievements</span>
                  </Link>
                  <Link to="/#events" className="text-white text-sm font-light hover:text-amber-300 transition-colors flex items-center gap-2">
                    <Play className="w-2.5 h-2.5 fill-white text-white shrink-0" />
                    <span>News</span>
                  </Link>
                  <Link to="/#events" className="text-white text-sm font-light hover:text-amber-300 transition-colors flex items-center gap-2">
                    <Play className="w-2.5 h-2.5 fill-white text-white shrink-0" />
                    <span>Events</span>
                  </Link>
                </div>

                {/* Column B */}
                <div className="space-y-2">
                  <Link to="/admissions" className="text-white text-sm font-light hover:text-amber-300 transition-colors flex items-center gap-2">
                    <Play className="w-2.5 h-2.5 fill-white text-white shrink-0" />
                    <span>Alumnae Registration</span>
                  </Link>
                  <Link to="/about#discipline" className="text-white text-sm font-light hover:text-amber-300 transition-colors flex items-center gap-2">
                    <Play className="w-2.5 h-2.5 fill-white text-white shrink-0" />
                    <span>Conduct and Discipline</span>
                  </Link>
                  <Link to="/about#curriculum" className="text-white text-sm font-light hover:text-amber-300 transition-colors flex items-center gap-2">
                    <Play className="w-2.5 h-2.5 fill-white text-white shrink-0" />
                    <span>Curriculum</span>
                  </Link>
                  <Link to="/about#mission" className="text-white text-sm font-light hover:text-amber-300 transition-colors flex items-center gap-2">
                    <Play className="w-2.5 h-2.5 fill-white text-white shrink-0" />
                    <span>Mission Statement</span>
                  </Link>
                  <Link to="/about#motto" className="text-white text-sm font-light hover:text-amber-300 transition-colors flex items-center gap-2">
                    <Play className="w-2.5 h-2.5 fill-white text-white shrink-0" />
                    <span>School Motto</span>
                  </Link>
                  <a 
                    href="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/pdf/PublicDisclosure.pdf" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-white text-sm font-light hover:text-amber-300 transition-colors flex items-center gap-2"
                  >
                    <Play className="w-2.5 h-2.5 fill-white text-white shrink-0" />
                    <span>Book List</span>
                  </a>
                </div>

              </div>
            </div>

            {/* Column 3: Google Maps Embed (3 Cols) */}
            <div className="lg:col-span-3">
              <div className="rounded overflow-hidden shadow-md border-[5px] border-white bg-white">
                <iframe
                  title="ST. JOSEPH'S SCHOOL Barhalganj Map"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3577.2939324500594!2d83.5066215!3d26.284569699999995!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x399178b2a9eaf059%3A0xc2de2bbbe26a80e0!2sST.%20JOSEPH'S%20SCHOOL%20Barhalganj!5e0!3m2!1sen!2sin!4v1760347218643!5m2!1sen!2sin"
                  width="100%"
                  height="190"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            </div>

          </div>
        </div>
      </footer>

      {/* 3. EXACT LIVE SJS COPYRIGHT BOTTOM STRIP */}
      <div className="copyright bg-white py-3.5 px-4 text-center text-xs sm:text-sm text-slate-700 font-normal border-t border-slate-100">
        <p className="m-0">
          © {currentYear} Copyright, All Right Reserved. St. Joseph’s School, Barhalganj | Accelerating By{' '}
          <a 
            href="https://www.entab.in/" 
            target="_blank" 
            rel="noreferrer" 
            className="text-[#f11e13] font-semibold hover:underline inline-flex items-center"
          >
            Entab Infotech Pvt. Ltd. <sup className="text-[9px] ml-0.5">®</sup>
          </a>
        </p>
      </div>

    </div>
  );
}
