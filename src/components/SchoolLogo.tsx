import React from 'react';

interface SchoolLogoProps {
  className?: string;
  variant?: 'crest' | 'full' | 'horizontal' | 'white';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showBadge?: boolean;
}

/**
 * Enterprise St. Joseph's School Crest Emblem (High-Resolution Vector SVG)
 */
export function SchoolCrest({ className = 'w-10 h-10', variant = 'default' }: { className?: string; variant?: 'default' | 'gold' | 'monochrome' | 'dark' }) {
  return (
    <div className={`relative shrink-0 select-none ${className} flex items-center justify-center`}>
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full drop-shadow-[0_2px_8px_rgba(6,31,61,0.18)] transition-transform group-hover:scale-105"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Rich Gold Gradient */}
          <linearGradient id="crestGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF3B0" />
            <stop offset="25%" stopColor="#F59E0B" />
            <stop offset="60%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#92400E" />
          </linearGradient>

          {/* Deep Navy Gradient */}
          <linearGradient id="crestNavy" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0a2a52" />
            <stop offset="50%" stopColor="#061f3d" />
            <stop offset="100%" stopColor="#031024" />
          </linearGradient>

          {/* Inner Radiant Gradient */}
          <radialGradient id="crestInnerGlow" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
          </radialGradient>

          {/* Circular Text Path for ST. JOSEPH'S SCHOOL */}
          <path
            id="sjsTopArc"
            d="M 28,100 A 72,72 0 0,1 172,100"
            fill="none"
          />
          {/* Circular Text Path for BARHALGANJ • GORAKHPUR */}
          <path
            id="sjsBottomArc"
            d="M 168,100 A 68,68 0 0,1 32,100"
            fill="none"
          />
        </defs>

        {/* Outer Gold Scalloped Ring / Rim */}
        <circle cx="100" cy="100" r="96" fill="url(#crestGold)" />
        <circle cx="100" cy="100" r="92" fill="#061f3d" stroke="#f59e0b" strokeWidth="1.5" />

        {/* Inner Gold Beaded Border */}
        <circle cx="100" cy="100" r="76" fill="none" stroke="url(#crestGold)" strokeWidth="1.5" strokeDasharray="3 2" />

        {/* Central Shield / Core Disc */}
        <circle cx="100" cy="100" r="73" fill="url(#crestNavy)" />
        <circle cx="100" cy="100" r="73" fill="url(#crestInnerGlow)" />

        {/* Circular Typography - Top */}
        <text
          fontFamily="Cinzel, 'Times New Roman', serif"
          fontWeight="900"
          fontSize="9.5"
          letterSpacing="1.8"
          fill="#FFFFFF"
        >
          <textPath href="#sjsTopArc" startOffset="50%" textAnchor="middle">
            ST. JOSEPH'S SCHOOL
          </textPath>
        </text>

        {/* Circular Typography - Bottom */}
        <text
          fontFamily="var(--font-sans), sans-serif"
          fontWeight="800"
          fontSize="7.5"
          letterSpacing="1.2"
          fill="#FDE68A"
        >
          <textPath href="#sjsBottomArc" startOffset="50%" textAnchor="middle">
            BARHALGANJ • CBSE 2131498
          </textPath>
        </text>

        {/* Left & Right Decorative Golden Stars */}
        <g fill="url(#crestGold)">
          {/* Left star */}
          <path d="M 24,100 L 26,96 L 27.5,100 L 31,101 L 28,103 L 29,107 L 25.5,104 L 22,107 L 23,103 L 20,101 Z" transform="scale(0.8) translate(3, 20)" />
          {/* Right star */}
          <path d="M 24,100 L 26,96 L 27.5,100 L 31,101 L 28,103 L 29,107 L 25.5,104 L 22,107 L 23,103 L 20,101 Z" transform="scale(0.8) translate(195, 20)" />
        </g>

        {/* Central Crest Core: Book, Torch of Wisdom, Cross & Rays */}
        {/* Golden Central Shield */}
        <path
          d="M 70,72 Q 100,66 130,72 Q 132,108 100,134 Q 68,108 70,72 Z"
          fill="#0a254a"
          stroke="url(#crestGold)"
          strokeWidth="2"
        />

        {/* Central Cross / Ray */}
        <path d="M 98,75 L 102,75 L 102,87 L 110,87 L 110,91 L 102,91 L 102,118 L 98,118 L 98,91 L 90,91 L 90,87 L 98,87 Z" fill="url(#crestGold)" />

        {/* Open Book of Knowledge */}
        <path
          d="M 80,102 Q 100,96 100,106 Q 100,96 120,102 L 118,118 Q 100,113 100,122 Q 100,113 82,118 Z"
          fill="#FFFFFF"
          stroke="#D97706"
          strokeWidth="1"
        />
        <path d="M 100,106 L 100,122" stroke="#061f3d" strokeWidth="1.2" />

        {/* Book Page Lines */}
        <line x1="85" y1="107" x2="96" y2="109" stroke="#061f3d" strokeWidth="0.8" opacity="0.6" />
        <line x1="85" y1="112" x2="96" y2="114" stroke="#061f3d" strokeWidth="0.8" opacity="0.6" />
        <line x1="104" y1="109" x2="115" y2="107" stroke="#061f3d" strokeWidth="0.8" opacity="0.6" />
        <line x1="104" y1="114" x2="115" y2="112" stroke="#061f3d" strokeWidth="0.8" opacity="0.6" />

        {/* Ribbon / Scroll at Bottom with Motto */}
        <path
          d="M 54,142 Q 100,132 146,142 L 140,152 Q 100,143 60,152 Z"
          fill="url(#crestGold)"
          stroke="#78350F"
          strokeWidth="0.8"
        />
        <text
          x="100"
          y="148"
          fontFamily="Cinzel, serif"
          fontWeight="900"
          fontSize="5.8"
          letterSpacing="0.8"
          fill="#061f3d"
          textAnchor="middle"
        >
          LEAD KINDLY LIGHT
        </text>

        {/* ESTD 2007 Micro Badge */}
        <text
          x="100"
          y="164"
          fontFamily="var(--font-sans), sans-serif"
          fontWeight="800"
          fontSize="6"
          letterSpacing="1"
          fill="#FDE68A"
          textAnchor="middle"
        >
          ESTD. 2007
        </text>
      </svg>
    </div>
  );
}

/**
 * Official Live St. Joseph's Logo Image Component (Direct from Live Website S3)
 */
export function SchoolLiveLogo({ className = 'w-12 h-12' }: { className?: string }) {
  return (
    <div className={`relative shrink-0 select-none flex items-center justify-center ${className}`}>
      <img
        src="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/logo_icon.JPG"
        alt="St. Joseph’s School Crest"
        className="w-full h-full object-contain rounded-full"
        onError={(e) => {
          (e.target as HTMLElement).setAttribute('src', 'https://sjsbrlschool.edu.in/favicon.png');
        }}
      />
    </div>
  );
}

/**
 * Versatile School Logo Component for Header, Sidebar, Login, and Footer
 */
export function SchoolLogo({ 
  className = 'w-10 h-10', 
  variant = 'crest',
  showBadge = true 
}: SchoolLogoProps) {
  if (variant === 'crest') {
    return <SchoolCrest className={className} />;
  }

  if (variant === 'horizontal') {
    return (
      <div className="flex items-center gap-3 select-none">
        <SchoolLiveLogo className={className} />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-serif font-black text-slate-900 tracking-tight text-base leading-tight">
              ST. JOSEPH’S
            </span>
            {showBadge && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 text-[9px] font-bold tracking-wider uppercase border border-amber-500/20">
                CBSE 2131498
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold text-blue-700 tracking-widest uppercase">
            School • Barhalganj
          </span>
        </div>
      </div>
    );
  }

  if (variant === 'white') {
    return (
      <div className="flex items-center gap-3 select-none">
        <SchoolCrest className={className} />
        <div className="flex flex-col min-w-0 text-white">
          <span className="font-serif font-black tracking-tight text-base leading-tight">
            ST. JOSEPH’S SCHOOL
          </span>
          <span className="text-[10px] font-semibold text-amber-300 tracking-widest uppercase">
            Barhalganj, Gorakhpur (U.P.)
          </span>
        </div>
      </div>
    );
  }

  // Default Full mode
  return (
    <div className="flex items-center gap-3 select-none">
      <SchoolLiveLogo className={className} />
      <div className="flex flex-col min-w-0">
        <span className="font-serif font-black text-[#061f3d] tracking-tight text-sm sm:text-base leading-tight">
          ST. JOSEPH’S SCHOOL
        </span>
        <span className="text-[9px] sm:text-[10px] font-bold text-[#1a73e8] tracking-widest uppercase">
          Barhalganj, Gorakhpur
        </span>
      </div>
    </div>
  );
}

export default SchoolLogo;
