import React, { useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvasSafe from '@/lib/html2canvasSafe';
import { 
  Printer, 
  Download, 
  X, 
  Loader2, 
  Calendar, 
  Clock, 
  MapPin, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { SchoolCrest } from '@/components/SchoolLogo';
import { formatClassDisplay } from '@/lib/cbseExamUtils';

export interface ExamTimetableSlot {
  id: string;
  exam_id: string;
  exam_name: string;
  class_name: string;
  subject_name: string;
  subject_code?: string;
  exam_date: string;
  start_time: string;
  duration: string;
  room: string;
  max_marks: number;
}

export interface ExamTimetablePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  className: string;
  examName: string;
  academicYear?: string;
  slots: ExamTimetableSlot[];
}

/**
 * High-Resolution Vector CBSE Emblem (Pure Vector SVG - Zero CORS / Network dependencies)
 */
function CbseVectorEmblem({ className = 'w-14 h-14' }: { className?: string }) {
  return (
    <div className={`relative shrink-0 select-none flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full drop-shadow-[0_1px_4px_rgba(0,0,0,0.12)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="cbseGoldGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="50%" stopColor="#CA8A04" />
            <stop offset="100%" stopColor="#854D0E" />
          </linearGradient>
          <linearGradient id="cbseNavyCore" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1E3A8A" />
            <stop offset="100%" stopColor="#0B132B" />
          </linearGradient>
          <path id="ttCbseTopArc" d="M 30,100 A 70,70 0 0,1 170,100" fill="none" />
          <path id="ttCbseBottomArc" d="M 170,100 A 70,70 0 0,1 30,100" fill="none" />
        </defs>

        <circle cx="100" cy="100" r="95" fill="#0f2b5c" stroke="#d97706" strokeWidth="2.5" />
        <circle cx="100" cy="100" r="90" fill="none" stroke="#fef08a" strokeWidth="1" strokeDasharray="3 2" />
        <circle cx="100" cy="100" r="76" fill="#ffffff" stroke="#d97706" strokeWidth="2" />

        <text
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="9.5"
          letterSpacing="1.2"
          fill="#0f2b5c"
        >
          <textPath href="#ttCbseTopArc" startOffset="50%" textAnchor="middle">
            CENTRAL BOARD OF SECONDARY EDUCATION
          </textPath>
        </text>

        <text
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="800"
          fontSize="8.5"
          letterSpacing="1.5"
          fill="#0f2b5c"
        >
          <textPath href="#ttCbseBottomArc" startOffset="50%" textAnchor="middle">
            NEW DELHI • असतो मा सद्गमय
          </textPath>
        </text>

        <circle cx="100" cy="100" r="60" fill="url(#cbseNavyCore)" stroke="#d97706" strokeWidth="1.5" />
        <circle cx="100" cy="80" r="16" fill="url(#cbseGoldGlow)" />
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => (
          <line
            key={deg}
            x1="100"
            y1="80"
            x2={100 + 24 * Math.cos((deg * Math.PI) / 180)}
            y2={80 + 24 * Math.sin((deg * Math.PI) / 180)}
            stroke="#fde047"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        ))}

        <path
          d="M 68,135 Q 100,118 132,135 L 132,148 Q 100,132 68,148 Z"
          fill="#ffffff"
          stroke="#ca8a04"
          strokeWidth="1"
        />
        <line x1="100" y1="126" x2="100" y2="140" stroke="#0f2b5c" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

export default function ExamTimetablePrintModal({
  isOpen,
  onClose,
  className,
  examName,
  academicYear = '2026-2027',
  slots
}: ExamTimetablePrintModalProps) {
  const [printLayout, setPrintLayout] = useState<'poster' | 'slips'>('poster');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);
  const slipsRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Sort slots chronologically by exam_date and start_time
  const sortedSlots = [...slots].sort((a, b) => {
    if (!a.exam_date && !b.exam_date) return 0;
    if (!a.exam_date) return 1;
    if (!b.exam_date) return -1;
    const dateComp = a.exam_date.localeCompare(b.exam_date);
    if (dateComp !== 0) return dateComp;
    return (a.start_time || '').localeCompare(b.start_time || '');
  });

  const displayClass = className === 'All' ? 'All Classes' : formatClassDisplay(className);
  const displayExam = examName === 'All' ? 'Official Examination Schedule' : examName;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    const targetRef = printLayout === 'poster' ? posterRef.current : slipsRef.current;
    if (!targetRef) return;

    setIsGeneratingPdf(true);
    const toastId = toast.loading('Compiling ultra high-definition CBSE Examination Timetable PDF...');

    try {
      const canvas = await html2canvasSafe(targetRef, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: targetRef.scrollWidth,
        windowHeight: targetRef.scrollHeight
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      if (pdfHeight <= pdf.internal.pageSize.getHeight()) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      } else {
        let heightLeft = pdfHeight;
        let position = 0;
        const pageHeight = pdf.internal.pageSize.getHeight();

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position -= pageHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
          heightLeft -= pageHeight;
        }
      }

      const cleanFileName = `CBSE_Timetable_${displayClass.replace(/[^a-zA-Z0-9]/g, '_')}_${displayExam.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      pdf.save(cleanFileName);
      toast.success('Timetable PDF downloaded successfully!', { id: toastId });
    } catch (err) {
      console.error('Failed to export timetable PDF:', err);
      toast.error('Failed to generate timetable PDF.', { id: toastId });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-2 sm:p-4 backdrop-blur-xs">
      
      {/* Media Print CSS: Isolate only the active timetable layout for 100% crisp printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-timetable-container, #printable-timetable-container * {
            visibility: visible !important;
          }
          #printable-timetable-container {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 6mm !important;
            box-shadow: none !important;
            background: #ffffff !important;
            z-index: 99999 !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 5mm;
          }
        }
      `}</style>

      {/* Main Modal Shell */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Ribbon */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[#ecb30b] text-slate-950 rounded-xl shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-2">
                Official Examination Timetable &amp; Datesheet
              </h2>
              <p className="text-[11px] text-slate-300 font-medium">
                {displayClass} • {displayExam} ({academicYear})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Layout Toggle */}
            <div className="hidden sm:flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setPrintLayout('poster')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  printLayout === 'poster' ? 'bg-[#1a73e8] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                📋 Wall Poster
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout('slips')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  printLayout === 'slips' ? 'bg-[#1a73e8] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                🎟️ Student Slips (2-up)
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Direct Printer Dispatch"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Print Timetable</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="px-4 py-1.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20 disabled:opacity-50"
              title="Download Vector PDF (Non-Breaking)"
            >
              {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Download PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Layout Selector for Mobile */}
        <div className="sm:hidden px-4 py-2 bg-slate-100 border-b border-slate-200 flex justify-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setPrintLayout('poster')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${
              printLayout === 'poster' ? 'bg-[#1a73e8] text-white' : 'bg-white text-slate-600'
            }`}
          >
            📋 Wall Poster
          </button>
          <button
            type="button"
            onClick={() => setPrintLayout('slips')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${
              printLayout === 'slips' ? 'bg-[#1a73e8] text-white' : 'bg-white text-slate-600'
            }`}
          >
            🎟️ Student Slips
          </button>
        </div>

        {/* Scrollable Document Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/70 flex justify-center custom-scrollbar">
          
          <div id="printable-timetable-container" className="w-full flex justify-center">
            
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* LAYOUT 1: WALL NOTICE BOARD POSTER (FULL A4 CLASS TIMETABLE)       */}
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {printLayout === 'poster' && (
              <div
                ref={posterRef}
                style={{ width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}
                className="bg-white text-slate-900 p-8 shadow-xl rounded-xl border border-slate-300 flex flex-col justify-between relative overflow-hidden"
              >
                {/* Decorative CBSE Watermark */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.035] pointer-events-none select-none">
                  <div className="w-[140mm] h-[140mm] rounded-full border-[10mm] border-slate-900 flex items-center justify-center">
                    <span className="text-8xl font-black text-slate-900 tracking-tighter">SJS</span>
                  </div>
                </div>

                <div className="space-y-4 relative z-10">
                  
                  {/* Top Formal School Header */}
                  <div className="border-b-2 border-slate-900 pb-3 flex items-center justify-between gap-4">
                    {/* Left: School Crest */}
                    <div className="shrink-0 flex items-center gap-3">
                      <SchoolCrest size={64} className="drop-shadow-sm" />
                    </div>

                    {/* Center: Official Title & Affiliation Details */}
                    <div className="text-center flex-1 space-y-0.5">
                      <h1 className="text-2xl font-black tracking-tight text-[#0f2b5c] uppercase font-serif">
                        ST. JOSEPH'S SCHOOL
                      </h1>
                      <p className="text-[11px] font-bold text-slate-700 tracking-wide">
                        BARHALGANJ, GORAKHPUR, UTTAR PRADESH — 273402
                      </p>
                      <div className="flex items-center justify-center gap-2 text-[10px] font-semibold text-slate-600 pt-0.5">
                        <span className="px-2 py-0.2 bg-blue-50 border border-blue-200 text-[#0f2b5c] rounded font-bold">
                          CBSE Affiliation No: 2133800
                        </span>
                        <span>•</span>
                        <span className="px-2 py-0.2 bg-amber-50 border border-amber-200 text-amber-900 rounded font-bold">
                          School Code: 71888
                        </span>
                      </div>
                    </div>

                    {/* Right: CBSE Emblem */}
                    <div className="shrink-0">
                      <CbseVectorEmblem className="w-16 h-16" />
                    </div>
                  </div>

                  {/* Datesheet Banner */}
                  <div className="bg-gradient-to-r from-[#0f2b5c] via-[#1a3a6c] to-[#0f2b5c] text-white py-2 px-4 rounded-lg flex items-center justify-between shadow-xs">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#ffd200] block">
                        OFFICIAL DATESHEET &amp; EXAMINATION SCHEDULE
                      </span>
                      <h2 className="text-sm sm:text-base font-black tracking-wide uppercase">
                        {displayExam}
                      </h2>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black bg-[#ffd200] text-slate-950 px-2.5 py-0.5 rounded shadow-xs font-mono">
                        {displayClass}
                      </span>
                      <span className="text-[10px] text-slate-200 block font-semibold mt-0.5">
                        Session: {academicYear}
                      </span>
                    </div>
                  </div>

                  {/* Schedule Information Ribbon */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#1a73e8] shrink-0" />
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Reporting Time</span>
                        <span className="font-extrabold text-slate-900">08:30 AM IST</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Examination Venue</span>
                        <span className="font-extrabold text-slate-900">Main Campus Exam Halls</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">CBSE Protocol</span>
                        <span className="font-extrabold text-slate-900">Admit Card &amp; Uniform Mandatory</span>
                      </div>
                    </div>
                  </div>

                  {/* Schedule Table */}
                  <div className="border border-slate-900 rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#0f2b5c] text-white text-[10px] font-black uppercase tracking-wider">
                          <th className="py-2.5 px-3 border-r border-blue-900 text-center w-10">S.No</th>
                          <th className="py-2.5 px-4 border-r border-blue-900">Date &amp; Day</th>
                          <th className="py-2.5 px-4 border-r border-blue-900">Subject Name</th>
                          <th className="py-2.5 px-3 border-r border-blue-900 text-center">Subject Code</th>
                          <th className="py-2.5 px-4 border-r border-blue-900 text-center">Timings &amp; Duration</th>
                          <th className="py-2.5 px-3 border-r border-blue-900 text-center">Max Marks</th>
                          <th className="py-2.5 px-3 text-center">Hall / Room</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-medium">
                        {sortedSlots.length > 0 ? (
                          sortedSlots.map((slot, index) => {
                            const dateObj = slot.exam_date ? new Date(slot.exam_date) : null;
                            const dayName = dateObj
                              ? dateObj.toLocaleDateString('en-IN', { weekday: 'long' })
                              : '—';
                            const dateFormatted = dateObj
                              ? dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                              : (slot.exam_date || 'To be notified');

                            return (
                              <tr key={slot.id || index} className={index % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                                <td className="py-2.5 px-3 border-r border-slate-200 text-center font-bold text-slate-600 font-mono">
                                  {index + 1}
                                </td>
                                <td className="py-2.5 px-4 border-r border-slate-200">
                                  <span className="font-bold text-slate-900 block">{dateFormatted}</span>
                                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">
                                    {dayName}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 border-r border-slate-200 font-black text-slate-900 text-xs">
                                  {slot.subject_name}
                                </td>
                                <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono font-bold text-slate-600 text-[11px]">
                                  {slot.subject_code || (slot.subject_name.slice(0, 3).toUpperCase())}
                                </td>
                                <td className="py-2.5 px-4 border-r border-slate-200 text-center">
                                  <span className="font-bold text-slate-900 font-mono block">
                                    {slot.start_time || '09:00 AM'}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-500">
                                    Duration: {slot.duration || '3 Hours'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono font-bold text-slate-900">
                                  {slot.max_marks || 100} M
                                </td>
                                <td className="py-2.5 px-3 text-center text-slate-700 font-semibold text-[11px]">
                                  {slot.room || 'Main Hall'}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="py-10 text-center text-slate-400 font-bold">
                              No subject examination dates recorded for this selection.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Standard CBSE Candidate Instructions */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[10px] text-slate-700 space-y-1">
                    <h4 className="font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 text-[10.5px]">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      Important Examination Guidelines &amp; Rules
                    </h4>
                    <ul className="list-disc pl-4 space-y-0.5 font-medium leading-relaxed">
                      <li>Students must report in full school uniform with valid CBSE Admit Card &amp; ID Card <strong>15 minutes prior</strong> to commencement.</li>
                      <li>A 15-minute question paper reading time (08:45 AM to 09:00 AM) will be provided before writing commences.</li>
                      <li>No electronic devices, calculators, smartwatches, or printed materials are permitted inside the examination hall.</li>
                      <li>Transparent writing pouches and transparent water bottles only are permitted.</li>
                    </ul>
                  </div>

                </div>

                {/* Footer Signatures & Authentications */}
                <div className="pt-6 border-t border-slate-200 grid grid-cols-3 gap-4 text-center text-xs relative z-10">
                  <div className="space-y-1">
                    <div className="h-10 flex items-end justify-center font-signature font-bold text-slate-400 text-sm italic">
                      [Class Teacher]
                    </div>
                    <div className="border-t border-slate-400 pt-1">
                      <span className="font-bold text-slate-800 block text-[11px]">Class Teacher</span>
                      <span className="text-[9px] text-slate-400 font-semibold uppercase">Verification</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="h-10 flex items-end justify-center font-signature font-bold text-[#0f2b5c] text-sm">
                      Exam Dept. Verified
                    </div>
                    <div className="border-t border-slate-400 pt-1">
                      <span className="font-bold text-slate-800 block text-[11px]">Controller of Examinations</span>
                      <span className="text-[9px] text-slate-400 font-semibold uppercase">CBSE Exam Cell</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="h-10 flex items-end justify-center font-signature font-bold text-[#0f2b5c] text-sm">
                      Principal Seal
                    </div>
                    <div className="border-t border-slate-400 pt-1">
                      <span className="font-bold text-slate-800 block text-[11px]">Principal</span>
                      <span className="text-[9px] text-slate-400 font-semibold uppercase">St. Joseph's School</span>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* LAYOUT 2: STUDENT HANDOUT SLIP (2-UP SLIP FORMAT FOR PARENTS/BAGS)  */}
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {printLayout === 'slips' && (
              <div
                ref={slipsRef}
                style={{ width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}
                className="bg-white text-slate-900 p-6 shadow-xl rounded-xl border border-slate-300 flex flex-col justify-between gap-6"
              >
                {/* Top Slip (Student Copy) */}
                <div className="border-2 border-slate-800 rounded-xl p-4 space-y-3 bg-white relative flex-1 flex flex-col justify-between">
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-300 pb-2">
                      <div className="flex items-center gap-2.5">
                        <SchoolCrest size={40} />
                        <div>
                          <h3 className="font-black text-sm text-[#0f2b5c] uppercase">ST. JOSEPH'S SCHOOL, BARHALGANJ</h3>
                          <p className="text-[9px] font-bold text-slate-500">CBSE Affiliation: 2133800 • Student Timetable Slip (Student Copy)</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 bg-[#0f2b5c] text-white font-black text-[10px] rounded uppercase">
                          {displayClass}
                        </span>
                        <span className="text-[9px] font-bold text-slate-600 block mt-0.5">{displayExam}</span>
                      </div>
                    </div>

                    {/* Compact Timetable Grid */}
                    <div className="mt-3 border border-slate-300 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-[10.5px]">
                        <thead>
                          <tr className="bg-slate-100 font-black text-slate-700 text-[9px] uppercase border-b border-slate-300">
                            <th className="py-1 px-2">Date</th>
                            <th className="py-1 px-2">Day</th>
                            <th className="py-1 px-2">Subject</th>
                            <th className="py-1 px-2 text-center">Timings</th>
                            <th className="py-1 px-2 text-center">Marks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {sortedSlots.map((s, idx) => {
                            const d = s.exam_date ? new Date(s.exam_date) : null;
                            return (
                              <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                                <td className="py-1.5 px-2 font-bold font-mono text-slate-900">{s.exam_date || '—'}</td>
                                <td className="py-1.5 px-2 text-slate-600">{d ? d.toLocaleDateString('en-IN', { weekday: 'short' }) : '—'}</td>
                                <td className="py-1.5 px-2 font-bold text-slate-900">{s.subject_name}</td>
                                <td className="py-1.5 px-2 text-center font-mono text-slate-700">{s.start_time || '09:00 AM'}</td>
                                <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-900">{s.max_marks} M</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Student Slip Footer */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-500 font-semibold">
                    <span>* Bring CBSE Admit Card, geometry box, and transparent writing board.</span>
                    <span className="font-bold text-slate-800">Principal Sign &amp; Seal</span>
                  </div>
                </div>

                {/* Perforation Cut Line */}
                <div className="flex items-center justify-center gap-2 text-slate-400 text-[9px] font-mono py-1">
                  <span>✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ✂</span>
                </div>

                {/* Bottom Slip (Parent Acknowledgement Copy) */}
                <div className="border-2 border-dashed border-slate-600 rounded-xl p-4 space-y-3 bg-slate-50/50 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-300 pb-2">
                      <div className="flex items-center gap-2.5">
                        <SchoolCrest size={40} />
                        <div>
                          <h3 className="font-black text-sm text-[#0f2b5c] uppercase">ST. JOSEPH'S SCHOOL, BARHALGANJ</h3>
                          <p className="text-[9px] font-bold text-slate-500">Parent Acknowledgement &amp; Consent Tear-off Slip</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-black text-[10px] rounded uppercase">
                          Return to Class Teacher
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-slate-700 space-y-2">
                      <p className="text-[11px] leading-relaxed">
                        I hereby acknowledge receipt of the <strong>{displayExam} ({academicYear})</strong> datesheet for my ward. I undertake that my ward will appear for all examinations in full school uniform on the scheduled dates.
                      </p>

                      <div className="grid grid-cols-2 gap-3 pt-2 text-[11px]">
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">Student Name:</span>
                          <span className="font-bold text-slate-900 border-b border-slate-400 block pb-0.5">_______________________________</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">Class &amp; Section:</span>
                          <span className="font-bold text-slate-900 border-b border-slate-400 block pb-0.5">{displayClass} - Section ______</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">Roll Number:</span>
                          <span className="font-bold text-slate-900 border-b border-slate-400 block pb-0.5">#__________</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">Parent / Guardian Signature:</span>
                          <span className="font-bold text-slate-900 border-b border-slate-400 block pb-0.5">_______________________________</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 text-right text-[9px] text-slate-400 font-semibold">
                    Date of submission: ____ / ____ / 2026
                  </div>
                </div>

              </div>
            )}

          </div>

        </div>

        {/* Modal Footer Bar */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              {sortedSlots.length} subject slot{sortedSlots.length === 1 ? '' : 's'} loaded for <strong>{displayClass}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-initial px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print Document
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="flex-1 sm:flex-initial px-5 py-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
            >
              {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>Download Ultra-HD PDF</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
