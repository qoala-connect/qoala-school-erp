import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Printer, CheckCircle2, GraduationCap } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { AdmissionRecord } from '@/types/admission';
import { toast } from 'sonner';
import { BodyPortal, useDialogBehaviour } from './AdmissionUI';

interface AdmissionLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AdmissionRecord;
}

export default function AdmissionLetterModal({ isOpen, onClose, record }: AdmissionLetterModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  useDialogBehaviour(isOpen, onClose);

  if (!record) return null;

  const handlePrint = () => {
    window.print();
    toast.success('Opening the print dialog for the admission letter…');
  };

  const appNo = record.application_number || `SJS/ADM/${record.academic_year || '2026-27'}/${record.id.slice(-4)}`;
  const rollNo = record.assigned_roll_number || 'PROVISIONAL';

  return (
    <BodyPortal>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onMouseDown={onClose}
            className="admission-letter-portal fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6 bg-slate-950/60 backdrop-blur-md flex justify-center items-start"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Official admission letter"
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 14 }}
              transition={{ duration: 0.2 }}
              onMouseDown={(e) => e.stopPropagation()}
              className="admission-letter-sheet bg-white border border-slate-200/90 rounded-3xl w-full max-w-3xl shadow-2xl shadow-blue-950/20 overflow-hidden my-auto sm:my-6 flex flex-col max-h-[92vh]"
            >
              {/* Modal chrome — never printed */}
              <header className="flex items-center justify-between gap-3 px-5 sm:px-7 py-4.5 border-b border-slate-100 bg-slate-50/70 shrink-0 print:hidden">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="p-2.5 rounded-2xl bg-white border border-slate-200 text-blue-700 shadow-xs shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-slate-900 tracking-tight truncate font-sans">Official Admission Letter</h2>
                    <p className="text-xs text-slate-500 truncate font-medium">
                      {record.name} · Session {record.academic_year || '2026-27'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-blue-900 to-blue-700 hover:from-blue-800 hover:to-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-900/20 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span className="hidden sm:inline">Print / Save PDF</span>
                    <span className="sm:hidden">Print</span>
                  </button>
                  <button
                    onClick={onClose}
                    aria-label="Close admission letter"
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </header>

              {/* Printable letter body */}
              <div className="admission-letter-scroll overflow-y-auto custom-scrollbar flex-1 p-6 sm:p-10 text-slate-900 bg-white space-y-6 print:p-0 print:m-0 print:overflow-visible">
                <div ref={printRef} className="space-y-6">
                  {/* School header */}
                  <div className="border-b-2 border-slate-900 pb-5 text-center">
                    <div className="flex items-center justify-center gap-3.5 mb-2">
                      <div className="w-14 h-14 rounded-2xl bg-white p-1 border border-slate-200 shadow-md shrink-0 flex items-center justify-center">
                        <img
                          src="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/logo_icon.JPG"
                          alt="SJS Crest"
                          className="w-full h-full object-contain rounded-xl"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://sjsbrlschool.edu.in/favicon.png';
                          }}
                        />
                      </div>
                      <div className="text-left">
                        <h1 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-blue-950">ST. JOSEPH'S SCHOOL, BARHALGANJ</h1>
                        <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Affiliated to CBSE, New Delhi (Aff. No. 2131498 · School Code: 70830)</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Barhalganj, Gorakhpur (U.P.) - 273402 | +91 94508 81215 | info@sjsbrlschool.edu.in
                    </p>

                    <div className="mt-3 inline-block px-4 py-1 bg-blue-50 text-blue-900 border border-blue-200 rounded-full text-[11px] font-bold uppercase tracking-wider">
                      Letter of Admission &amp; Enrolment Confirmation
                    </div>
                  </div>

                  {/* Letter metadata */}
                  <div className="flex justify-between items-start gap-4 text-xs border-b border-slate-100 pb-4">
                    <div className="space-y-1">
                      <p><span className="text-slate-500">Reference No:</span> <strong className="font-mono text-blue-950 font-bold">{appNo}</strong></p>
                      <p><span className="text-slate-500">Issue Date:</span> <strong className="text-slate-900 font-bold">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></p>
                      <p><span className="text-slate-500">Academic Session:</span> <strong className="text-slate-900 font-bold">{record.academic_year || '2026-27'}</strong></p>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      <div className="p-2 bg-white border border-slate-200 rounded-xl shadow-xs">
                        <QRCodeSVG
                          value={`SJS-VERIFIED-ADMISSION:${record.id}:${record.name}:${record.class}:${record.academic_year}`}
                          size={56}
                        />
                      </div>
                      <span className="text-[9px] font-mono font-bold text-slate-400 mt-1 uppercase">Scan to verify</span>
                    </div>
                  </div>

                  {/* Salutation */}
                  <div className="text-[13px] space-y-1.5 leading-relaxed">
                    <p className="font-semibold text-slate-900">To,</p>
                    <p className="font-semibold text-slate-800">Mr./Mrs. <span className="uppercase">{record.father_name || 'Guardian'}</span></p>
                    <p className="text-slate-600">Parent/guardian of: <strong className="text-slate-900 uppercase">{record.name}</strong></p>
                    <p className="text-slate-600">Address: {record.address || 'Registered residential address on record'}</p>
                  </div>

                  {/* Confirmation statement */}
                  <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-emerald-800 font-semibold text-[13px]">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="uppercase tracking-wide">Admission approved &amp; confirmed</span>
                    </div>
                    <p className="text-slate-700 text-[13px] leading-relaxed">
                      We are pleased to inform you that upon verification of records and on meeting the institution's academic
                      entrance standards, <strong>{record.name}</strong> has been granted admission to{' '}
                      <strong>Class {record.class} (Section {record.section || 'A'})</strong> at St. Joseph’s School, Barhalganj for the
                      academic year <strong>{record.academic_year || '2026-27'}</strong>.
                    </p>
                  </div>

                  {/* Allotment details */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2.5 font-semibold text-slate-700 border-b border-slate-200 text-[11px] uppercase tracking-wider">
                      Institutional allotment details
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-white text-[13px]">
                      {[
                        ['Student full name', record.name],
                        ['Allotted grade & section', `Class ${record.class} - ${record.section || 'A'}`],
                        ['Assigned roll / SIS ID', rollNo],
                        ['Date of birth', record.date_of_birth],
                        ['Contact phone', record.phone || 'N/A'],
                        ['Fee category', record.fee_category || 'Standard tuition'],
                      ].map(([label, value]) => (
                        <div key={label as string}>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide block">{label}</span>
                          <span className="font-semibold text-slate-900">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="space-y-1.5 text-[13px] text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
                    <p className="font-semibold text-slate-900">Important instructions for parents</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Classes commence in accordance with the official CBSE academic calendar.</li>
                      <li>Uniform, textbooks and syllabus kits must be obtained before the student orientation day.</li>
                      <li>Retain this letter and the verified receipt for identity card collection.</li>
                    </ul>
                  </div>

                  {/* Signature block */}
                  <div className="pt-6 border-t border-slate-200 flex justify-between items-end gap-6">
                    <div className="space-y-1.5">
                      <div className="w-24 h-12 border border-dashed border-slate-300 rounded-xl flex items-center justify-center text-[10px] text-slate-400 font-semibold uppercase text-center">
                        Institutional seal
                      </div>
                      <p className="text-[11px] text-slate-500">Registrar / Admissions Officer</p>
                    </div>

                    <div className="text-right space-y-1">
                      <div className="font-serif italic font-semibold text-slate-800 text-sm">Principal, St. Joseph’s School, Barhalganj</div>
                      <div className="w-36 border-b border-slate-400 ml-auto pt-4" />
                      <p className="text-[11px] text-slate-500">Authorised signatory</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </BodyPortal>
  );
}
