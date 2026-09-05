import React, { useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvasSafe from '@/lib/html2canvasSafe';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Download, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Student } from '@/types/student';
import sjsLogo from '@/assets/sjs_logo_icon.jpg';

interface StudentAdmitCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  exam?: {
    exam_name: string;
    academic_year: string;
  } | null;
  timetable?: Array<{
    subject_code?: string;
    subject_name: string;
    date?: string;
    time?: string;
    hall?: string;
    room?: string;
  }>;
}

export default function StudentAdmitCardModal({
  isOpen,
  onClose,
  student,
  exam,
  timetable = []
}: StudentAdmitCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!isOpen || !student) return null;

  const examName = exam?.exam_name || 'CBSE ANNUAL EXAMINATION 2026-2027';
  const academicYear = exam?.academic_year || student.academic_year || '2026-2027';
  const rollNo = student.roll_number || '12';
  const hallTicketNo = `SJS-HT-${academicYear.split('-')[0]}-${student.admission_number || '044'}`;

  // Real schedule only — no subjects scheduled yet renders an empty state
  // in the table below instead of a fabricated standard CBSE syllabus.
  const schedule = timetable;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!cardRef.current) return;
    setIsGeneratingPdf(true);
    const toastId = toast.loading('Compiling official CBSE Admit Card PDF...');
    try {
      const canvas = await html2canvasSafe(cardRef.current, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
      pdf.save(`CBSE_AdmitCard_${student.name.replace(/\s+/g, '_')}_${rollNo}.pdf`);
      toast.success('Admit Card downloaded successfully!', { id: toastId });
    } catch (err) {
      console.error('PDF error:', err);
      toast.error('Failed to generate PDF admit card.', { id: toastId });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const verificationUrl = `https://sjsbarhalganj.edu.in/verify/admit-card?adm=${student.admission_number}&roll=${rollNo}&session=${academicYear}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-2 sm:p-4 backdrop-blur-xs">
      
      {/* Print-specific style to isolate admit card */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-admit-card, #printable-admit-card * {
            visibility: visible !important;
          }
          #printable-admit-card {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 8mm !important;
            box-shadow: none !important;
            background: #fff !important;
            border: 2px solid #000 !important;
          }
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
        }
      `}</style>

      {/* Modal Dialog Shell */}
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-300 flex flex-col max-h-[94vh] overflow-hidden my-auto">
        
        {/* Header Action Bar */}
        <div className="shrink-0 px-5 py-3 bg-slate-900 text-white flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-xs bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2.5 py-1 rounded-md">
              {hallTicketNo}
            </span>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-white">
                CBSE Examination Hall Ticket & Admit Card
              </h3>
              <p className="text-[11px] text-slate-300">
                Candidate: <span className="font-bold text-white">{student.name}</span> • Class {student.class}-{student.section} • Roll #{rollNo}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" /> Print Slip
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Download PDF
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

        {/* Scrollable Body with Centered Sheet */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 flex justify-center bg-slate-200/60">
          
          <div
            id="printable-admit-card"
            ref={cardRef}
            className="w-[210mm] min-h-[285mm] bg-white text-slate-900 p-[10mm] flex flex-col justify-between font-sans relative shadow-xl border-2 border-slate-900"
            style={{ boxSizing: 'border-box' }}
          >
            {/* Inner Border */}
            <div className="border border-slate-900 p-4 flex flex-col justify-between h-full bg-white relative space-y-3">
              
              {/* Top Section: Header */}
              <div className="space-y-3">
                {/* 1. School & CBSE Header */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2.5">
                  {/* CBSE Logo Left */}
                  <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/en/thumb/9/95/CBSE_new_logo.svg/300px-CBSE_new_logo.svg.png" 
                      alt="CBSE Logo" 
                      className="w-14 h-14 object-contain"
                      crossOrigin="anonymous"
                    />
                  </div>

                  {/* School Details Center */}
                  <div className="flex-1 text-center px-2">
                    <h1 className="text-lg font-black text-slate-950 uppercase tracking-tight font-serif leading-tight">
                      ST. JOSEPH'S SCHOOL
                    </h1>
                    <p className="text-[10px] text-slate-700 font-bold tracking-wide mt-0.5">
                      Korari, Barhalganj - Gorakhpur (U.P.) - 273402
                    </p>
                    <p className="text-[8.5px] text-slate-600 font-semibold tracking-wide">
                      CBSE Affiliation No.: <span className="font-bold text-slate-900">2131498</span> | School No.: <span className="font-bold text-slate-900">70532</span> | Senior Secondary (10+2)
                    </p>
                    <p className="text-[8px] text-slate-500 font-medium">
                      Website: www.sjsbarhalganj.edu.in | Phone: +91 94508 84521
                    </p>
                  </div>

                  {/* SJS Crest Right */}
                  <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
                    <img 
                      src={sjsLogo} 
                      alt="SJS Crest" 
                      className="w-14 h-14 object-contain"
                    />
                  </div>
                </div>

                {/* 2. Document Title Banner */}
                <div className="bg-slate-900 text-white text-center py-1 px-3 border border-slate-900 shadow-2xs">
                  <span className="font-extrabold text-[11px] uppercase tracking-widest block font-sans">
                    CBSE EXAMINATION ADMIT CARD / HALL TICKET
                  </span>
                  <span className="text-[8.5px] text-slate-300 font-medium block">
                    {examName} • ACADEMIC SESSION: {academicYear}
                  </span>
                </div>

                {/* 3. Candidate Biodata Matrix & Photo + QR */}
                <div className="border border-slate-900 p-2.5 bg-slate-50/50">
                  <div className="grid grid-cols-12 gap-3 items-start">
                    
                    {/* Biodata Columns (9 cols) */}
                    <div className="col-span-9 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[9px]">
                      <div className="flex items-baseline gap-1 border-b border-slate-200 pb-0.5">
                        <span className="font-bold text-slate-500 uppercase text-[8px] w-28 shrink-0">Candidate Name:</span>
                        <span className="font-black text-slate-950 uppercase text-[9.5px]">{student.name}</span>
                      </div>
                      <div className="flex items-baseline gap-1 border-b border-slate-200 pb-0.5">
                        <span className="font-bold text-slate-500 uppercase text-[8px] w-28 shrink-0">Roll Number:</span>
                        <span className="font-mono font-black text-blue-900 text-[10px]">#{rollNo}</span>
                      </div>

                      <div className="flex items-baseline gap-1 border-b border-slate-200 pb-0.5">
                        <span className="font-bold text-slate-500 uppercase text-[8px] w-28 shrink-0">Scholar / Adm No.:</span>
                        <span className="font-mono font-bold text-slate-900">{student.admission_number || 'N/A'}</span>
                      </div>
                      <div className="flex items-baseline gap-1 border-b border-slate-200 pb-0.5">
                        <span className="font-bold text-slate-500 uppercase text-[8px] w-28 shrink-0">Class & Section:</span>
                        <span className="font-bold text-slate-900">Class {student.class} - Section {student.section}</span>
                      </div>

                      <div className="flex items-baseline gap-1 border-b border-slate-200 pb-0.5">
                        <span className="font-bold text-slate-500 uppercase text-[8px] w-28 shrink-0">Mother's Name:</span>
                        <span className="font-bold text-slate-900 uppercase">{student.mother_name || 'N/A'}</span>
                      </div>
                      <div className="flex items-baseline gap-1 border-b border-slate-200 pb-0.5">
                        <span className="font-bold text-slate-500 uppercase text-[8px] w-28 shrink-0">Father's Name:</span>
                        <span className="font-bold text-slate-900 uppercase">{student.father_name || 'N/A'}</span>
                      </div>

                      <div className="flex items-baseline gap-1 border-b border-slate-200 pb-0.5">
                        <span className="font-bold text-slate-500 uppercase text-[8px] w-28 shrink-0">Date of Birth:</span>
                        <span className="font-bold text-slate-900">
                          {student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('en-IN') : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1 border-b border-slate-200 pb-0.5">
                        <span className="font-bold text-slate-500 uppercase text-[8px] w-28 shrink-0">Gender / Category:</span>
                        <span className="font-bold text-slate-900">{student.gender || 'N/A'} / Regular (CBSE)</span>
                      </div>

                      <div className="col-span-2 flex items-baseline gap-1 pt-0.5">
                        <span className="font-bold text-slate-500 uppercase text-[8px] w-28 shrink-0">Exam Centre:</span>
                        <span className="font-bold text-blue-950">
                          St. Joseph's Senior Academic Wing, Korari, Barhalganj - Gorakhpur (Center Code: 70532)
                        </span>
                      </div>
                    </div>

                    {/* Photo + QR Column (3 cols) */}
                    <div className="col-span-3 flex flex-col items-center justify-center space-y-1.5 border-l border-slate-300 pl-2">
                      <div className="w-22 h-26 bg-white border border-slate-900 p-0.5 shadow-2xs flex items-center justify-center">
                        {student.photo_url ? (
                          <img 
                            src={student.photo_url} 
                            alt={student.name} 
                            crossOrigin="anonymous"
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-100 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                            <span className="font-black text-2xl">{student.name.charAt(0).toUpperCase()}</span>
                            <span className="text-[6px] font-bold uppercase mt-1">Photo</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 bg-white border border-slate-300 p-1 rounded-xs">
                        <QRCodeSVG value={verificationUrl} size={38} />
                        <div className="text-[6.5px] font-mono text-slate-500 leading-tight">
                          <span className="font-bold text-slate-800 block">SEC-QR</span>
                          <span>Scan to Verify</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* 4. Subject Schedule & Timetable */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[8.5px] font-black text-slate-950 uppercase tracking-wider">
                      SCHOLASTIC EXAMINATION SCHEDULE & TIMINGS
                    </span>
                    <span className="text-[7.5px] text-slate-500 font-mono">Exam Timing: 09:00 AM - 12:00 PM (IST)</span>
                  </div>

                  <table className="w-full text-left text-[8.5px] border-collapse border border-slate-900">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-900 text-[7.5px] font-black text-slate-900 uppercase">
                        <th className="py-1 px-2 border-r border-slate-900 text-center w-8">Sl.</th>
                        <th className="py-1 px-2 border-r border-slate-900 text-center w-16">Sub Code</th>
                        <th className="py-1 px-2 border-r border-slate-900">Subject Name</th>
                        <th className="py-1 px-2 border-r border-slate-900 text-center w-24">Date of Exam</th>
                        <th className="py-1 px-2 border-r border-slate-900 text-center w-36">Session Timing</th>
                        <th className="py-1 px-2 border-r border-slate-900 text-center w-24">Room / Desk</th>
                        <th className="py-1 px-2 text-center w-28">Invigilator Initial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300 text-slate-800">
                      {schedule.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-400 font-bold text-[9px]">
                            No subjects scheduled yet for this exam.
                          </td>
                        </tr>
                      ) : schedule.map((sub, idx) => (
                        <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                          <td className="py-1 px-2 border-r border-slate-900 text-center font-mono font-bold text-slate-600">{idx + 1}</td>
                          <td className="py-1 px-2 border-r border-slate-900 text-center font-mono font-bold text-slate-800">{sub.subject_code || `0${idx + 1}`}</td>
                          <td className="py-1 px-2 border-r border-slate-900 font-bold text-slate-950">{sub.subject_name}</td>
                          <td className="py-1 px-2 border-r border-slate-900 text-center font-mono font-bold text-slate-800">{sub.date}</td>
                          <td className="py-1 px-2 border-r border-slate-900 text-center font-medium text-slate-700">{sub.time}</td>
                          <td className="py-1 px-2 border-r border-slate-900 text-center font-bold text-blue-900">{sub.room || `Desk #${rollNo}`}</td>
                          <td className="py-1 px-2 text-center text-slate-300 font-mono text-[8px]">_____________</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 5. Examination Code of Conduct & Candidate Guidelines */}
                <div className="border border-slate-900 p-2 bg-slate-50/60 space-y-1">
                  <span className="font-black text-slate-950 uppercase tracking-wider block text-[8px]">
                    IMPORTANT INSTRUCTIONS FOR CANDIDATES (CBSE GUIDELINES):
                  </span>
                  <ol className="list-decimal list-inside space-y-0.5 font-medium text-[7.5px] text-slate-700 leading-normal">
                    <li>Candidates must produce this original Admit Card along with their official School ID Card at the entrance of the examination hall.</li>
                    <li>Entry to the examination hall closes strictly at <strong>08:45 AM</strong> (15 minutes prior to the commencement of the exam).</li>
                    <li>Strictly prohibited items: Mobile phones, smart watches, digital calculators, Bluetooth devices, and loose paper slips.</li>
                    <li>Verify that your Roll Number and Admission Number are written accurately on the title page of the answer booklet.</li>
                    <li>15 minutes reading time (08:45 AM to 09:00 AM) is allotted strictly for reading the question paper. Writing starts at 09:00 AM.</li>
                    <li>Candidates will not be allowed to leave the examination room before the final bell at 12:00 PM.</li>
                  </ol>
                </div>
              </div>

              {/* Bottom Section: Seals & Signatures */}
              <div className="space-y-2 pt-2 border-t-2 border-slate-900">
                <div className="grid grid-cols-4 gap-2 items-end text-center">
                  
                  {/* Candidate Signature */}
                  <div className="flex flex-col items-center">
                    <div className="h-8 border-b border-slate-400 w-28 flex items-end justify-center pb-0.5">
                      <span className="text-[7.5px] italic text-slate-400">Candidate Signature</span>
                    </div>
                    <span className="text-[7px] font-black uppercase text-slate-600 mt-1 block">Candidate's Sign</span>
                  </div>

                  {/* Parent Signature */}
                  <div className="flex flex-col items-center">
                    <div className="h-8 border-b border-slate-400 w-28 flex items-end justify-center pb-0.5">
                      <span className="text-[7.5px] italic text-slate-400">Parent / Guardian</span>
                    </div>
                    <span className="text-[7px] font-black uppercase text-slate-600 mt-1 block">Parent's Sign</span>
                  </div>

                  {/* Class Teacher */}
                  <div className="flex flex-col items-center">
                    <div className="h-8 border-b border-slate-400 w-28 flex items-end justify-center pb-0.5">
                      <span className="text-[7.5px] italic text-slate-400">Class Teacher</span>
                    </div>
                    <span className="text-[7px] font-black uppercase text-slate-600 mt-1 block">Class Teacher</span>
                  </div>

                  {/* School Seal & Principal */}
                  <div className="flex flex-col items-center">
                    <div className="h-8 border-b border-slate-400 w-28 flex items-end justify-center pb-0.5 relative">
                      <span className="text-[7.5px] italic text-slate-400">Principal</span>
                      {/* Circular School Seal */}
                      <div className="absolute -top-3 right-0 w-11 h-11 rounded-full border border-blue-900/60 flex flex-col items-center justify-center text-[5px] text-blue-900 font-black uppercase text-center leading-none rotate-12 bg-blue-50/20 pointer-events-none">
                        <span>ST. JOSEPH'S</span>
                        <span className="text-[4px]">BARHALGANJ</span>
                        <span>SEAL</span>
                      </div>
                    </div>
                    <span className="text-[7px] font-black uppercase text-slate-900 mt-1 block font-bold">Principal / Centre Supdt.</span>
                  </div>

                </div>

                {/* Footer Security Token */}
                <div className="flex justify-between items-center text-[7px] font-mono text-slate-500 pt-1 border-t border-slate-200">
                  <span>Security Hash: SJS-CBSE-ADM-{student.admission_number || '00'}-{rollNo}</span>
                  <span>Page 1 of 1 • Official CBSE Admit Card • St. Joseph's School</span>
                </div>
              </div>

            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
