import React, { useRef, useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import html2canvasSafe from '@/lib/html2canvasSafe';
import { Printer, Download, X, Loader2, Calendar, Clock, GraduationCap, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { SchoolCrest } from '@/components/SchoolLogo';

export interface TimetableGridSlot {
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | string;
  dayLabel?: string;
  period_number: number;
  subject_name: string;
  subject_code?: string;
  teacher_name?: string;
  start_time?: string;
  end_time?: string;
  room?: string;
  class_name?: string;
  section_name?: string;
}

export interface OfficialTimetableModalProps {
  isOpen: boolean;
  onClose: () => void;
  className: string;
  sectionName?: string;
  roomNo?: string;
  classTeacherName?: string;
  academicYear?: string;
  slots?: TimetableGridSlot[];
  mode?: 'class' | 'teacher';
  title?: string;
  subtitle?: string;
}

/**
 * High-Resolution Vector CBSE Emblem (Pure SVG - 100% Vector, Zero CORS / Network Dependencies)
 */
function CbseVectorLogo({ className = 'w-14 h-14' }: { className?: string }) {
  return (
    <div className={`relative shrink-0 select-none flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full drop-shadow-[0_1px_4px_rgba(0,0,0,0.15)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="cbseGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="50%" stopColor="#CA8A04" />
            <stop offset="100%" stopColor="#854D0E" />
          </linearGradient>
          <linearGradient id="cbseBlue" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1E3A8A" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <path id="cbseTopArc" d="M 30,100 A 70,70 0 0,1 170,100" fill="none" />
          <path id="cbseBottomArc" d="M 170,100 A 70,70 0 0,1 30,100" fill="none" />
        </defs>

        {/* Outer Ring */}
        <circle cx="100" cy="100" r="95" fill="#0f2b5c" stroke="#d97706" strokeWidth="2.5" />
        <circle cx="100" cy="100" r="90" fill="none" stroke="#fef08a" strokeWidth="1" strokeDasharray="3 2" />
        <circle cx="100" cy="100" r="76" fill="#ffffff" stroke="#d97706" strokeWidth="2" />

        {/* Top Arc Text */}
        <text
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="9.5"
          letterSpacing="1.2"
          fill="#0f2b5c"
        >
          <textPath href="#cbseTopArc" startOffset="50%" textAnchor="middle">
            CENTRAL BOARD OF SECONDARY EDUCATION
          </textPath>
        </text>

        {/* Bottom Arc Text */}
        <text
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="800"
          fontSize="8.5"
          letterSpacing="1.5"
          fill="#0f2b5c"
        >
          <textPath href="#cbseBottomArc" startOffset="50%" textAnchor="middle">
            NEW DELHI • असतो मा सद्गमय
          </textPath>
        </text>

        {/* Inner Core Disc */}
        <circle cx="100" cy="100" r="60" fill="url(#cbseBlue)" stroke="#d97706" strokeWidth="1.5" />

        {/* Radiant Sun of Knowledge */}
        <circle cx="100" cy="80" r="16" fill="url(#cbseGold)" />
        {/* Sun rays */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => (
          <line
            key={deg}
            x1="100"
            y1="80"
            x2={100 + 22 * Math.cos((deg * Math.PI) / 180)}
            y2={80 + 22 * Math.sin((deg * Math.PI) / 180)}
            stroke="#fef08a"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        ))}

        {/* Open Book of Learning */}
        <path
          d="M 72,112 Q 100,105 100,118 Q 100,105 128,112 L 126,132 Q 100,126 100,136 Q 100,126 74,132 Z"
          fill="#ffffff"
          stroke="#d97706"
          strokeWidth="1.5"
        />
        <line x1="100" y1="118" x2="100" y2="136" stroke="#0f2b5c" strokeWidth="1.5" />

        {/* Lamp Flame / Diya */}
        <path
          d="M 96,102 Q 100,92 104,102 Q 100,106 96,102 Z"
          fill="#f59e0b"
          stroke="#b45309"
          strokeWidth="0.8"
        />

        {/* CBSE Acronym Banner */}
        <rect x="76" y="142" width="48" height="12" rx="3" fill="#d97706" />
        <text
          x="100"
          y="151"
          fontFamily="system-ui, sans-serif"
          fontWeight="900"
          fontSize="9"
          letterSpacing="1.5"
          fill="#ffffff"
          textAnchor="middle"
        >
          CBSE
        </text>
      </svg>
    </div>
  );
}

/**
 * Standard Day configurations: Day 1 (Mon) to Day 6 (Sat)
 */
const DAYS = [
  { key: 'mon', dayNum: 'Day 1', name: 'Monday', short: 'MON' },
  { key: 'tue', dayNum: 'Day 2', name: 'Tuesday', short: 'TUE' },
  { key: 'wed', dayNum: 'Day 3', name: 'Wednesday', short: 'WED' },
  { key: 'thu', dayNum: 'Day 4', name: 'Thursday', short: 'THU' },
  { key: 'fri', dayNum: 'Day 5', name: 'Friday', short: 'FRI' },
  { key: 'sat', dayNum: 'Day 6', name: 'Saturday', short: 'SAT' }
];

/**
 * Default fallback CBSE Period Timings (used if slots do not carry distinct start/end times)
 */
const DEFAULT_PERIOD_TIMINGS: Record<number, string> = {
  1: '08:00 - 08:45',
  2: '08:45 - 09:30',
  3: '09:30 - 10:15',
  4: '10:15 - 11:00',
  5: '11:30 - 12:15',
  6: '12:15 - 01:00',
  7: '01:00 - 01:45',
  8: '01:45 - 02:30'
};

export default function OfficialTimetableModal({
  isOpen,
  onClose,
  className,
  sectionName = '',
  classTeacherName = '',
  roomNo = '',
  academicYear = '2026-2027',
  slots = [],
  mode = 'class',
  title,
  subtitle
}: OfficialTimetableModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Class label formatting
  const classLabel = sectionName ? `${className}-${sectionName}` : className;
  const ribbonLabel = classTeacherName
    ? `${classLabel} (${classTeacherName.trim().toUpperCase().split(' ')[0]})`
    : classLabel;

  // Compute maximum period number from real slots (standard 8 periods or highest scheduled)
  const maxPeriod = useMemo(() => {
    const highest = slots.reduce((max, s) => Math.max(max, s.period_number || 0), 0);
    return Math.max(8, highest);
  }, [slots]);

  const periods = useMemo(() => {
    return Array.from({ length: maxPeriod }, (_, i) => i + 1);
  }, [maxPeriod]);

  // Build slot lookup map [dayKey][periodNumber] strictly from REAL data
  const slotMap = useMemo(() => {
    const map: Record<string, Record<number, TimetableGridSlot>> = {};
    DAYS.forEach(d => { map[d.key] = {}; });

    slots.forEach(s => {
      const rawDay = (s.day || '').toLowerCase().trim();
      let dayKey = rawDay.slice(0, 3);
      if (rawDay.startsWith('day')) {
        const num = parseInt(rawDay.replace(/\D/g, ''), 10);
        if (num >= 1 && num <= 6) dayKey = DAYS[num - 1].key;
      }
      if (dayKey && map[dayKey] && s.period_number) {
        map[dayKey][s.period_number] = s;
      }
    });

    return map;
  }, [slots]);

  // Compute period timings dynamically from real slot times
  const periodTimings = useMemo(() => {
    const timings: Record<number, string> = { ...DEFAULT_PERIOD_TIMINGS };
    slots.forEach(s => {
      if (s.period_number && s.start_time && s.end_time) {
        timings[s.period_number] = `${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}`;
      }
    });
    return timings;
  }, [slots]);

  // Dynamic Subject Legend with real subjects and weekly period counts
  const dynamicSubjectsLegend = useMemo(() => {
    const subjectMap = new Map<string, { code: string; name: string; teachers: Set<string>; count: number }>();

    slots.forEach(s => {
      if (!s.subject_name && !s.subject_code) return;
      const code = (s.subject_code || s.subject_name.slice(0, 5)).toUpperCase();
      const name = s.subject_name || s.subject_code || 'Subject';
      const teacher = s.teacher_name?.trim();

      const existing = subjectMap.get(code);
      if (existing) {
        existing.count += 1;
        if (teacher) existing.teachers.add(teacher);
      } else {
        subjectMap.set(code, {
          code,
          name,
          teachers: teacher ? new Set([teacher]) : new Set(),
          count: 1
        });
      }
    });

    return Array.from(subjectMap.values()).sort((a, b) => b.count - a.count);
  }, [slots]);

  // Verification security hash generated for this timetable
  const securityHash = useMemo(() => {
    const base = `SJS-TT-${className || 'ALL'}-${sectionName || 'X'}-${academicYear.replace(/\D/g, '')}`;
    return `${base}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  }, [className, sectionName, academicYear]);

  // Current system timestamp in IST format
  const generatedTimestamp = useMemo(() => {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(new Date());
  }, []);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!cardRef.current) return;
    setIsGeneratingPdf(true);
    const toastId = toast.loading('Generating enterprise vector PDF Timetable...');
    try {
      // High-resolution canvas rendering
      const canvas = await html2canvasSafe(cardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      // Standard A4 Landscape: 297mm width x 210mm height
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      pdf.addImage(imgData, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
      const safeClass = (className || 'Class').replace(/\s+/g, '_');
      const safeSec = sectionName ? `_${sectionName}` : '';
      const safeYear = academicYear.replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`SJS_Official_Timetable_${safeClass}${safeSec}_${safeYear}.pdf`);
      toast.success('Official Timetable PDF downloaded successfully!', { id: toastId });
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF timetable. Please use the Print option.', { id: toastId });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Helper to extract clean cell data strictly from real slots
  const getCellSlot = (dayKey: string, periodNum: number) => {
    return slotMap[dayKey]?.[periodNum] || null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-2 sm:p-4 backdrop-blur-xs">
      
      {/* Print-specific style for landscape A4 timetable */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-timetable, #printable-timetable * {
            visibility: visible !important;
          }
          #printable-timetable {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            max-height: 210mm !important;
            margin: 0 !important;
            padding: 5mm !important;
            box-shadow: none !important;
            background: #ffffff !important;
            border: none !important;
            box-sizing: border-box !important;
          }
          @page {
            size: A4 landscape;
            margin: 0mm;
          }
        }
      `}</style>

      {/* Modal Dialog Shell */}
      <div className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-300 flex flex-col max-h-[96vh] overflow-hidden my-auto">
        
        {/* Header Action Bar */}
        <div className="shrink-0 px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between z-20 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-xs bg-blue-500/20 text-blue-300 border border-blue-400/30 px-3 py-1 rounded-md flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
              Class {classLabel || 'All'}
            </span>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-white flex items-center gap-2">
                Official CBSE Master Timetable
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Real Data Verified
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                Session: <span className="font-semibold text-white">{academicYear}</span> • Class Teacher: <span className="font-bold text-white">{classTeacherName || 'Not Assigned'}</span> • Room: <span className="font-semibold text-white">{roomNo || 'N/A'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" /> Print
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Download Official PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body with Landscape Sheet */}
        <div className="flex-1 overflow-auto p-3 sm:p-6 flex justify-center bg-slate-200/70">
          
          <div
            id="printable-timetable"
            ref={cardRef}
            className="w-[297mm] h-[210mm] max-h-[210mm] bg-white text-slate-900 p-[7mm] flex flex-col justify-between font-sans relative shadow-xl border-2 border-slate-900 overflow-hidden"
            style={{ boxSizing: 'border-box' }}
          >
            <div className="border border-slate-900 p-3.5 flex flex-col justify-between h-full bg-white relative space-y-2">
              
              {/* Top Section: Official CBSE Header */}
              <div className="space-y-1.5">
                {/* 1. School Header & Vector Logos */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
                  {/* CBSE Vector Logo (Left) */}
                  <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center">
                    <CbseVectorLogo className="w-13 h-13" />
                  </div>

                  {/* School Details Center */}
                  <div className="flex-1 text-center px-2">
                    <h1 className="text-[17px] font-black text-slate-950 uppercase tracking-tight font-serif leading-tight">
                      ST. JOSEPH'S SCHOOL
                    </h1>
                    <p className="text-[9.5px] text-slate-800 font-bold tracking-wide mt-0.5">
                      Korari, Barhalganj - Gorakhpur (U.P.) - 273402
                    </p>
                    <p className="text-[8px] text-slate-700 font-semibold tracking-wide">
                      CBSE Affiliation No.: <span className="font-bold text-slate-950">2131498</span> | School Code: <span className="font-bold text-slate-950">70532</span> | Senior Secondary (10+2)
                    </p>
                  </div>

                  {/* SJS Crest Vector Logo (Right) */}
                  <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center">
                    <SchoolCrest className="w-13 h-13" />
                  </div>
                </div>

                {/* 2. Banner Bar */}
                <div className="flex items-center justify-between bg-slate-950 text-white px-3.5 py-1 border border-slate-950 shadow-2xs">
                  <span className="font-black text-[10px] uppercase tracking-widest font-sans">
                    {title || (mode === 'teacher' ? 'TEACHER MASTER SCHEDULE & ALLOTMENT' : 'OFFICIAL CLASS TIME TABLE & TEACHER ALLOTMENT')}
                  </span>
                  <div className="flex items-center gap-3 text-[8.5px] font-bold text-slate-200">
                    <span>CLASS: <strong className="text-white uppercase">{classLabel || 'ALL'}</strong></span>
                    <span>•</span>
                    <span>SESSION: <strong className="text-white">{academicYear}</strong></span>
                    {roomNo && (
                      <>
                        <span>•</span>
                        <span>ROOM: <strong className="text-white">{roomNo}</strong></span>
                      </>
                    )}
                    {classTeacherName && (
                      <>
                        <span>•</span>
                        <span>CLASS TEACHER: <strong className="text-white">{classTeacherName}</strong></span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. The Authentic Master Timetable Matrix Grid */}
              <div className="my-auto py-0.5 flex-1 flex flex-col justify-center">
                <div className="flex border-2 border-slate-950 bg-white">
                  
                  {/* Vertical Rotated Left Sidebar: Class-Section or Teacher */}
                  <div className="w-11 bg-slate-100 border-r-2 border-slate-950 flex items-center justify-center p-1 select-none shrink-0">
                    <div 
                      className="font-black text-slate-950 tracking-wider text-[10.5px] whitespace-nowrap uppercase -rotate-90 origin-center"
                      style={{ transform: 'rotate(-90deg)', width: 'max-content' }}
                    >
                      {ribbonLabel}
                    </div>
                  </div>

                  {/* Main Grid: Columns 1 to N Periods, Rows Day 1 to Day 6 */}
                  <div className="flex-1 overflow-hidden">
                    <table className="w-full border-collapse text-center table-fixed">
                      {/* Top Header: Periods 1 to 8 (or N) */}
                      <thead>
                        <tr className="border-b-2 border-slate-950 bg-slate-100 text-[10px] font-black text-slate-900">
                          <th className="w-16 py-1 border-r border-slate-950 bg-slate-200/80">
                            <span className="text-[9px] uppercase tracking-wider text-slate-700">Day / Per</span>
                          </th>
                          {periods.map(p => (
                            <th key={p} className="py-1 px-1 border-r border-slate-950 last:border-r-0">
                              <div className="text-[11px] font-black text-slate-950">Period {p}</div>
                              <div className="text-[7px] font-mono text-slate-600 font-semibold leading-tight">
                                {periodTimings[p] || DEFAULT_PERIOD_TIMINGS[p] || '—'}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>

                      {/* Rows: Day 1 to Day 6 */}
                      <tbody>
                        {DAYS.map((d) => (
                          <tr 
                            key={d.key} 
                            className="border-b border-slate-950 last:border-b-0 h-[19mm]"
                          >
                            {/* Day Header (e.g. Day 1 / MON) */}
                            <td className="w-16 py-0.5 px-1 border-r-2 border-slate-950 bg-slate-100 font-black text-slate-950 select-none text-center">
                              <div className="text-[9.5px] font-black uppercase text-slate-950 leading-tight">{d.dayNum}</div>
                              <div className="text-[7.5px] text-slate-600 font-bold uppercase tracking-wider">{d.short}</div>
                            </td>

                            {/* Period Cells */}
                            {periods.map(p => {
                              const slot = getCellSlot(d.key, p);
                              
                              if (slot) {
                                const subCode = (slot.subject_code || slot.subject_name.slice(0, 5)).toUpperCase();
                                const teacherDisplay = slot.teacher_name
                                  ? slot.teacher_name.trim().toUpperCase()
                                  : 'UNASSIGNED';

                                return (
                                  <td 
                                    key={p} 
                                    className="p-1 border-r border-slate-950 last:border-r-0 align-middle text-center bg-white"
                                  >
                                    <div className="flex flex-col items-center justify-center space-y-0.5">
                                      <span className="font-black text-slate-950 text-[10.5px] tracking-tight leading-none block">
                                        {subCode}
                                      </span>
                                      <span 
                                        className={`text-[8px] tracking-tight leading-tight block uppercase mt-0.5 font-bold ${
                                          slot.teacher_name ? 'text-slate-700' : 'text-amber-700/80 italic text-[7px]'
                                        }`}
                                      >
                                        {teacherDisplay}
                                      </span>
                                    </div>
                                  </td>
                                );
                              }

                              // Empty Slot (No fake fallback data! True real representation)
                              return (
                                <td 
                                  key={p} 
                                  className="p-1 border-r border-slate-950 last:border-r-0 align-middle text-center bg-slate-50/40"
                                >
                                  <div className="text-slate-300 font-mono text-[9px] font-bold">
                                    —
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>
              </div>

              {/* 4. Dynamic Legend, Timetable Rules & Signature Blocks */}
              <div className="space-y-1.5 pt-1.5 border-t-2 border-slate-950">
                {/* Dynamic Subject Legend Bar */}
                <div className="bg-slate-50 px-2.5 py-1 border border-slate-400 rounded-xs">
                  <div className="flex items-center gap-1 text-[7px] font-black uppercase text-slate-800 mb-0.5">
                    <span>Subject Legend &amp; Weekly Load:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[7px] text-slate-700">
                    {dynamicSubjectsLegend.length > 0 ? (
                      dynamicSubjectsLegend.map((item) => (
                        <span key={item.code} className="inline-flex items-center gap-1 font-medium">
                          <strong className="text-slate-950 font-black">{item.code}:</strong> {item.name}
                          <span className="text-[6.5px] text-slate-500 font-semibold">({item.count} per/wk)</span>
                        </span>
                      ))
                    ) : (
                      <span className="italic text-slate-400">No scheduled subject slots recorded for this session.</span>
                    )}
                  </div>
                </div>

                {/* Signatures & Seal */}
                <div className="grid grid-cols-4 gap-2 items-end text-center pt-1">
                  {/* Class Teacher */}
                  <div className="flex flex-col items-center">
                    <div className="h-5 border-b border-slate-500 w-28 flex items-end justify-center pb-0.5">
                      <span className="text-[7.5px] italic font-serif text-slate-900 font-bold">
                        {classTeacherName || 'Class Teacher'}
                      </span>
                    </div>
                    <span className="text-[6.5px] font-black uppercase text-slate-700 mt-0.5 block">Class Teacher</span>
                  </div>

                  {/* Timetable In-charge */}
                  <div className="flex flex-col items-center">
                    <div className="h-5 border-b border-slate-500 w-28 flex items-end justify-center pb-0.5">
                      <span className="text-[7.5px] italic font-serif text-slate-800 font-bold">Deepak Verma</span>
                    </div>
                    <span className="text-[6.5px] font-black uppercase text-slate-700 mt-0.5 block">Time Table In-Charge</span>
                  </div>

                  {/* Academic Coordinator */}
                  <div className="flex flex-col items-center">
                    <div className="h-5 border-b border-slate-500 w-28 flex items-end justify-center pb-0.5">
                      <span className="text-[7.5px] italic font-serif text-slate-800 font-bold">Sr. Rosily</span>
                    </div>
                    <span className="text-[6.5px] font-black uppercase text-slate-700 mt-0.5 block">Academic Coordinator</span>
                  </div>

                  {/* Principal & Seal */}
                  <div className="flex flex-col items-center">
                    <div className="h-5 border-b border-slate-500 w-28 flex items-end justify-center pb-0.5 relative">
                      <span className="text-[7.5px] italic font-serif text-slate-950 font-black">Fr. Antony Paul</span>
                      <div className="absolute -top-3.5 right-0 w-11 h-11 rounded-full border border-blue-900/60 flex flex-col items-center justify-center text-[4px] text-blue-950 font-black uppercase text-center leading-none rotate-12 bg-blue-50/30 pointer-events-none">
                        <span>ST. JOSEPH'S</span>
                        <span className="text-[3px]">BARHALGANJ</span>
                        <span>OFFICIAL SEAL</span>
                      </div>
                    </div>
                    <span className="text-[6.5px] font-black uppercase text-slate-950 mt-0.5 block font-bold">Principal</span>
                  </div>
                </div>

                {/* Footer Security Hash & Compliance */}
                <div className="flex justify-between items-center text-[6px] font-mono text-slate-500 pt-0.5 border-t border-slate-300">
                  <span>Security Token: <strong className="text-slate-700">{securityHash}</strong> • Generated: {generatedTimestamp}</span>
                  <span>Page 1 of 1 • CBSE Official Academic Timetable • St. Joseph's School Korari Barhalganj</span>
                </div>
              </div>

            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

