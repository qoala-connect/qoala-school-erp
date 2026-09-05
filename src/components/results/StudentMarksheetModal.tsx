import React, { useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvasSafe from '@/lib/html2canvasSafe';
import { Printer, Download, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import sjsLogoIcon from '@/assets/sjs_logo_icon.jpg';

/** A single real mark row. Accepts either the flat shape (Student360Drawer's
 *  mapped subject_marks) or the raw nested Supabase join shape (StudentPortal's
 *  subjectMarks, `subjects(subject_name)` / `exams(exam_name)`) so both callers
 *  can pass their existing fetch results without extra mapping. */
interface RawMarkRow {
  subject_name?: string;
  subjects?: { subject_name?: string } | null;
  exam_name?: string;
  exams?: { exam_name?: string } | null;
  obtained_marks?: number | null;
  max_marks?: number | null;
  is_absent?: boolean | null;
}

interface StudentMarksheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  /** Real per-subject, per-exam marks. No marks recorded yet renders an
   *  honest empty state rather than fabricated numbers. */
  marks?: RawMarkRow[];
  attendanceData?: { total_days: number; present_days: number; percentage?: number } | null;
  medicalData?: { height?: string; weight?: string; blood_group?: string } | null;
  classTeacherName?: string;
  principalName?: string;
}

// CBSE 8-Point Grading Helper
const getCBSEGrade = (pct: number): string => {
  if (pct >= 91) return 'A1';
  if (pct >= 81) return 'A2';
  if (pct >= 71) return 'B1';
  if (pct >= 61) return 'B2';
  if (pct >= 51) return 'C1';
  if (pct >= 41) return 'C2';
  if (pct >= 33) return 'D';
  return 'E';
};

function normalizeMark(m: RawMarkRow) {
  return {
    subject: m.subject_name || m.subjects?.subject_name || 'Subject',
    exam: m.exam_name || m.exams?.exam_name || 'Exam',
    obtained: Number(m.obtained_marks) || 0,
    max: Number(m.max_marks) || 0,
    isAbsent: !!m.is_absent
  };
}

export default function StudentMarksheetModal({
  isOpen,
  onClose,
  student,
  marks,
  attendanceData,
  medicalData,
  classTeacherName,
  principalName
}: StudentMarksheetModalProps) {
  const marksheetRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Pivot real marks into one row per subject, one column per exam found in
  // the data (Half Yearly / Annual / whatever the school actually recorded).
  const { subjectRows, examColumns, grandTotals } = useMemo(() => {
    const normalized = (marks || []).filter(m => !m.is_absent || m.obtained_marks != null).map(normalizeMark);
    const examNames = Array.from(new Set(normalized.map(m => m.exam))).slice(0, 3);
    const subjectNames = Array.from(new Set(normalized.map(m => m.subject)));

    const rows = subjectNames.map(subject => {
      const perExam = examNames.map(exam => {
        const row = normalized.find(m => m.subject === subject && m.exam === exam);
        if (!row) return { obtained: null as number | null, max: null as number | null, isAbsent: false };
        return { obtained: row.obtained, max: row.max, isAbsent: row.isAbsent };
      });
      const totalObtained = perExam.reduce((s, e) => s + (e.obtained || 0), 0);
      const totalMax = perExam.reduce((s, e) => s + (e.max || 0), 0);
      const pct = totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : null;
      return {
        subject,
        perExam,
        totalObtained,
        totalMax,
        pct,
        grade: pct !== null ? getCBSEGrade(pct) : '—'
      };
    });

    const grandObtained = rows.reduce((s, r) => s + r.totalObtained, 0);
    const grandMax = rows.reduce((s, r) => s + r.totalMax, 0);
    const overallPct = grandMax > 0 ? Number(((grandObtained / grandMax) * 100).toFixed(2)) : null;

    return {
      subjectRows: rows,
      examColumns: examNames,
      grandTotals: {
        obtained: grandObtained,
        max: grandMax,
        pct: overallPct,
        grade: overallPct !== null ? getCBSEGrade(overallPct) : '—'
      }
    };
  }, [marks]);

  if (!isOpen || !student) return null;

  const academicSession = student.academic_year || '2026-2027';
  const rawClass = student.class || '';
  const section = student.section || '';
  const classDisplay = `${String(rawClass).replace(/^CLASS\s*/i, '')} ${section}`.trim() || '—';

  const dobFormatted = student.date_of_birth
    ? new Date(student.date_of_birth).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  const fatherName = (student.father_name || student.guardian_name || '')?.toUpperCase() || '—';
  const motherName = (student.mother_name || '')?.toUpperCase() || '—';
  const studentName = (student.name || '')?.toUpperCase() || '—';
  const rollNo = student.roll_number || '—';
  const admissionNo = student.admission_number || '—';

  const totalDays = attendanceData?.total_days ?? 0;
  const presentDays = attendanceData?.present_days ?? 0;
  const attendanceRatio = totalDays > 0 ? `${presentDays}/${totalDays}` : '—';

  const height = medicalData?.height || '—';
  const weight = medicalData?.weight || '—';

  const hasAnyMarks = subjectRows.length > 0;
  const resultStatus = !hasAnyMarks
    ? 'PENDING'
    : grandTotals.pct !== null && grandTotals.pct >= 33
      ? 'PROMOTED'
      : 'NEEDS IMPROVEMENT';

  const generatedOn = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!marksheetRef.current) return;
    setIsGeneratingPdf(true);
    const toastId = toast.loading('Compiling official CBSE Marksheet PDF...', { id: 'marksheet-pdf' });
    try {
      const canvas = await html2canvasSafe(marksheetRef.current, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
      pdf.save(`Progress-Report-${admissionNo}-${studentName.replace(/\s+/g, '_')}.pdf`);
      toast.success('Official Marksheet downloaded successfully.', { id: 'marksheet-pdf' });
    } catch (err) {
      console.error('PDF error:', err);
      toast.error('Failed to generate PDF. Please try printing directly.', { id: 'marksheet-pdf' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 sm:p-4 backdrop-blur-xs">

      {/* Print isolation rules */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 6mm;
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          #official-sjs-marksheet, #official-sjs-marksheet * {
            visibility: visible !important;
          }
          #official-sjs-marksheet {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 4mm !important;
            box-shadow: none !important;
            border: none !important;
            background: #fff !important;
          }
        }
      `}</style>

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[96vh] overflow-hidden my-auto">

        {/* Modal Toolbar */}
        <header className="shrink-0 px-5 py-3 bg-slate-900 text-white flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-xs bg-blue-500/20 text-blue-300 px-3 py-1 rounded-lg border border-blue-400/30">
              Admission #{admissionNo}
            </span>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wide font-sans">
                Official CBSE Annual Progress Report
              </h2>
              <p className="text-[11px] text-slate-400">
                {studentName} • Class {classDisplay} • Session {academicSession}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-blue-400" /> Print Marksheet
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-900/30 transition-all"
            >
              {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Marksheet"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Scrollable Marksheet Sheet */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center bg-slate-200/60">

          <div
            id="official-sjs-marksheet"
            ref={marksheetRef}
            className="w-[210mm] min-h-[297mm] bg-[#f8fbfa] text-slate-900 p-[8mm] flex flex-col justify-between font-sans relative shadow-xl rounded-none border border-slate-400"
            style={{ boxSizing: 'border-box' }}
          >
            {/* Inner Border Enclosure */}
            <div className="border border-slate-700 p-3.5 flex flex-col justify-between h-full bg-white relative">

              <div className="space-y-2.5">

                {/* 1. Header Section */}
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-400">
                  <div className="w-16 h-16 shrink-0 flex items-center justify-center p-1">
                    <img
                      src="https://upload.wikimedia.org/wikipedia/en/thumb/9/95/CBSE_new_logo.svg/300px-CBSE_new_logo.svg.png"
                      alt="CBSE Logo"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://sjsbrlschool.edu.in/favicon.png';
                      }}
                    />
                  </div>

                  <div className="flex-1 text-center px-2">
                    <h1 className="text-[20px] font-black text-[#1a2b4c] uppercase tracking-tight font-serif leading-none">
                      ST. JOSEPH'S SCHOOL
                    </h1>
                    <p className="text-[11.5px] font-bold text-slate-800 mt-0.5">
                      Korari, Barhalganj - Gorakhpur
                    </p>
                    <p className="text-[10px] font-medium text-slate-700">
                      Affiliated to CBSE (New Delhi)
                    </p>
                    <p className="text-[9.5px] font-medium text-slate-700">
                      Affiliation No. - 2131498, School No. - 70532
                    </p>
                  </div>

                  <div className="w-16 h-16 shrink-0 flex items-center justify-center p-1">
                    <img
                      src={sjsLogoIcon}
                      alt="St. Joseph's School Shield"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/logo_icon.JPG';
                      }}
                    />
                  </div>
                </div>

                {/* 2. Document Title Shaded Bar */}
                <div className="bg-[#e4ebf5] border border-slate-500 py-1 text-center font-bold text-[11px] uppercase tracking-wider text-[#1a2b4c]">
                  ANNUAL PROGRESS REPORT - SESSION {academicSession}
                </div>

                {/* 3. Student Biodata Matrix with Photo */}
                <div className="border border-slate-500 p-2 text-[9.5px] text-slate-900">
                  <div className="flex gap-4">
                    <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1">
                      <div className="flex">
                        <span className="w-28 font-bold text-slate-800">NAME</span>
                        <span className="font-bold text-black uppercase">: {studentName}</span>
                      </div>
                      <div className="flex">
                        <span className="w-28 font-bold text-slate-800">ROLL NO</span>
                        <span className="font-bold text-black">: {rollNo}</span>
                      </div>

                      <div className="flex">
                        <span className="w-28 font-bold text-slate-800">DATE OF BIRTH</span>
                        <span className="font-medium text-black">: {dobFormatted}</span>
                      </div>
                      <div className="flex">
                        <span className="w-28 font-bold text-slate-800">ADMISSION NO</span>
                        <span className="font-bold text-black">: {admissionNo}</span>
                      </div>

                      <div className="flex">
                        <span className="w-28 font-bold text-slate-800">FATHER'S NAME</span>
                        <span className="font-medium text-black uppercase">: {fatherName}</span>
                      </div>
                      <div className="flex">
                        <span className="w-28 font-bold text-slate-800">CLASS</span>
                        <span className="font-bold text-black uppercase">: {classDisplay}</span>
                      </div>

                      <div className="flex">
                        <span className="w-28 font-bold text-slate-800">MOTHER'S NAME</span>
                        <span className="font-medium text-black uppercase">: {motherName}</span>
                      </div>
                      <div className="flex">
                        <span className="w-28 font-bold text-slate-800">ATTENDANCE</span>
                        <span className="font-bold text-black">: {attendanceRatio}</span>
                      </div>
                    </div>

                    <div className="w-[62px] h-[72px] shrink-0 border border-slate-700 bg-slate-100 p-0.5 flex items-center justify-center">
                      <img
                        src={student.photo_url || `https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80`}
                        alt={studentName}
                        crossOrigin="anonymous"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80';
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Scholastic Header & Real-Marks Table */}
                <div className="space-y-0.5">
                  <div className="bg-[#1a2b4c] text-white px-2 py-0.5 font-bold text-[9.5px] uppercase tracking-wider">
                    SCHOLASTIC
                  </div>

                  {!hasAnyMarks ? (
                    <div className="border border-slate-600 py-6 text-center text-[10px] text-slate-500 font-semibold">
                      No marks have been recorded for this student yet.
                    </div>
                  ) : (
                    <table className="w-full border-collapse border border-slate-600 text-[8.5px] leading-tight">
                      <thead>
                        <tr className="bg-[#e8eff9] font-bold text-slate-900 border-b border-slate-600">
                          <th rowSpan={2} className="py-1 px-1 text-left border-r border-slate-600 w-32">SUBJECT</th>
                          {examColumns.map(exam => (
                            <th key={exam} colSpan={2} className="py-0.5 text-center border-r border-slate-600 font-black">{exam}</th>
                          ))}
                          <th rowSpan={2} className="py-1 px-0.5 text-center border-r border-slate-600 w-16 font-black">Total<br />Obtained</th>
                          <th rowSpan={2} className="py-1 px-0.5 text-center border-r border-slate-600 w-10 font-black">%</th>
                          <th rowSpan={2} className="py-1 px-0.5 text-center w-9 font-black">GRADE</th>
                        </tr>
                        <tr className="bg-[#f0f4fa] font-bold text-slate-800 border-b border-slate-600 text-[7.5px]">
                          {examColumns.map(exam => (
                            <React.Fragment key={exam}>
                              <th className="py-0.5 px-0.5 text-center border-r border-slate-400">Marks</th>
                              <th className="py-0.5 px-0.5 text-center border-r border-slate-600">Max</th>
                            </React.Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {subjectRows.map((r, i) => (
                          <tr key={i} className="border-b border-slate-300 text-slate-900 font-medium">
                            <td className="py-0.5 px-1 font-bold border-r border-slate-600 uppercase text-[7.5px]">{r.subject}</td>
                            {r.perExam.map((e, ei) => (
                              <React.Fragment key={ei}>
                                <td className="py-0.5 px-0.5 text-center border-r border-slate-400">{e.isAbsent ? 'AB' : (e.obtained ?? '—')}</td>
                                <td className="py-0.5 px-0.5 text-center border-r border-slate-600">{e.max ?? '—'}</td>
                              </React.Fragment>
                            ))}
                            <td className="py-0.5 px-0.5 text-center border-r border-slate-600 font-bold">{r.totalObtained}/{r.totalMax}</td>
                            <td className="py-0.5 px-0.5 text-center border-r border-slate-600">{r.pct ?? '—'}</td>
                            <td className="py-0.5 px-0.5 text-center font-bold">{r.grade}</td>
                          </tr>
                        ))}

                        <tr className="bg-[#e8eff9] font-bold text-black border-t border-slate-600">
                          <td className="py-0.5 px-1 border-r border-slate-600 uppercase text-[7.5px] font-black" colSpan={1 + examColumns.length * 2}>Grand Total</td>
                          <td className="py-0.5 px-0.5 text-center border-r border-slate-600 font-black">{grandTotals.obtained}/{grandTotals.max}</td>
                          <td className="py-0.5 px-0.5 text-center border-r border-slate-600 font-black">{grandTotals.pct ?? '—'}</td>
                          <td className="py-0.5 px-0.5 text-center font-black">{grandTotals.grade}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>

                {/* 5. Remarks & Health Records */}
                <div className="grid grid-cols-2 gap-2 text-[8.5px]">
                  <div className="border border-slate-600">
                    <div className="bg-[#1a2b4c] text-white px-1.5 py-0.5 font-bold uppercase tracking-wider text-[8px]">
                      RESULT
                    </div>
                    <div className="p-1.5 flex items-center gap-2 font-medium">
                      <div className="border-2 border-[#1a3880] text-[#1a3880] px-3 py-1 font-extrabold text-[12px] tracking-widest uppercase rounded-xs">
                        {resultStatus}
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-600">
                    <div className="bg-[#1a2b4c] text-white px-1.5 py-0.5 font-bold uppercase tracking-wider text-[8px]">
                      HEALTH RECORDS
                    </div>
                    <div className="p-1.5 grid grid-cols-2 gap-2 font-medium">
                      <div>
                        <span className="font-bold">HEIGHT : </span>
                        <span>{height}</span>
                      </div>
                      <div>
                        <span className="font-bold">WEIGHT : </span>
                        <span>{weight}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. Circular Official School Stamp */}
                <div className="flex justify-end pt-1">
                  <div className="w-20 h-20 rounded-full border-2 border-dashed border-[#1a3880]/80 text-[#1a3880] flex flex-col items-center justify-center p-1 text-[6.5px] font-bold text-center leading-none rotate-[-6deg] select-none">
                    <span>St. Joseph's School</span>
                    <span className="text-[14px] my-0.5 font-serif font-black">✝</span>
                    <span>Barhalganj, Gorakhpur</span>
                  </div>
                </div>

                {/* Signature Bar */}
                <div className="grid grid-cols-4 gap-2 pt-4 text-[8.5px] text-slate-800 font-bold border-t border-slate-300">
                  <div>
                    <span>Date : </span>
                    <span className="font-medium">{generatedOn}</span>
                  </div>
                  <div className="text-center">
                    <div className="w-24 border-b border-slate-500 mx-auto pb-3 font-serif italic text-slate-700 text-[10px]">
                      {classTeacherName || ''}
                    </div>
                    <span className="mt-0.5 block">Class Teacher</span>
                  </div>
                  <div className="text-center">
                    <div className="w-24 border-b border-slate-500 mx-auto pb-3 font-serif italic text-slate-700 text-[10px]">
                      {principalName || ''}
                    </div>
                    <span className="mt-0.5 block">Principal</span>
                  </div>
                  <div className="text-center">
                    <div className="w-24 border-b border-slate-500 mx-auto pb-3"></div>
                    <span className="mt-0.5 block">Parent</span>
                  </div>
                </div>

                {/* 7. CBSE 8-Point Grading Scale Footer Matrix */}
                <div className="border border-slate-600 mt-2">
                  <div className="grid grid-cols-2 divide-x divide-slate-600 text-[7.5px]">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-[#e8eff9] font-bold border-b border-slate-600">
                          <th className="py-0.5 px-2 text-left border-r border-slate-600">MARK RANGE</th>
                          <th className="py-0.5 px-2 text-center w-16">GRADE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300">
                        <tr><td className="py-0.5 px-2 border-r border-slate-600 font-mono">91-100</td><td className="py-0.5 px-2 text-center font-bold">A1</td></tr>
                        <tr><td className="py-0.5 px-2 border-r border-slate-600 font-mono">81-90.99</td><td className="py-0.5 px-2 text-center font-bold">A2</td></tr>
                        <tr><td className="py-0.5 px-2 border-r border-slate-600 font-mono">71-80.99</td><td className="py-0.5 px-2 text-center font-bold">B1</td></tr>
                        <tr><td className="py-0.5 px-2 border-r border-slate-600 font-mono">61-70.99</td><td className="py-0.5 px-2 text-center font-bold">B2</td></tr>
                      </tbody>
                    </table>

                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-[#e8eff9] font-bold border-b border-slate-600">
                          <th className="py-0.5 px-2 text-left border-r border-slate-600">MARK RANGE</th>
                          <th className="py-0.5 px-2 text-center w-16">GRADE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300">
                        <tr><td className="py-0.5 px-2 border-r border-slate-600 font-mono">51-60.99</td><td className="py-0.5 px-2 text-center font-bold">C1</td></tr>
                        <tr><td className="py-0.5 px-2 border-r border-slate-600 font-mono">41-50.99</td><td className="py-0.5 px-2 text-center font-bold">C2</td></tr>
                        <tr><td className="py-0.5 px-2 border-r border-slate-600 font-mono">33-40.99</td><td className="py-0.5 px-2 text-center font-bold">D</td></tr>
                        <tr><td className="py-0.5 px-2 border-r border-slate-600 font-mono">0-32.99</td><td className="py-0.5 px-2 text-center font-bold">E</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
