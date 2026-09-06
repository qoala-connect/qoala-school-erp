import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Trophy, 
  Award, 
  Search, 
  Printer, 
  Download, 
  Check, 
  CheckCircle2, 
  Heart, 
  Activity, 
  BookOpen, 
  Save, 
  Clock, 
  ChevronRight,
  User,
  Shield,
  FileText,
  Loader2,
  Sparkles,
  GraduationCap,
  Filter,
  CheckSquare,
  AlertCircle,
  HelpCircle,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { printRegion } from '@/lib/printRegion';
import { supabase } from '@/lib/supabase';
import { jsPDF } from 'jspdf';
import html2canvasSafe from '../../lib/html2canvasSafe';
import sjsLogoIcon from '@/assets/sjs_logo_icon.jpg';
import { 
  calculateCBSEGrade, 
  calculateCBSEDivision, 
  isSameClass, 
  formatClassDisplay, 
  normalizeClassName 
} from '@/lib/cbseExamUtils';

interface StudentReportViewProps {
  mode: 'final' | 'coscholastic';
  initialStudentId?: string;
  initialClass?: string;
}

/**
 * Computes the subsequent promoted class name cleanly
 */
function getNextClassDisplay(currentClassStr: string): string {
  if (!currentClassStr) return 'Next Grade';
  const norm = currentClassStr.trim().toUpperCase();
  if (norm === 'NURSERY' || norm === 'NUR') return 'LKG';
  if (norm === 'LKG' || norm === 'L.K.G.' || norm === 'L.K.G') return 'UKG';
  if (norm === 'UKG' || norm === 'U.K.G.' || norm === 'U.K.G') return 'Class 1';
  
  const num = parseInt(norm.replace(/\D/g, ''), 10);
  if (!isNaN(num)) {
    if (num >= 12) return 'Higher Education / Alumni Graduation';
    return `Class ${num + 1}`;
  }
  return 'Next Higher Class';
}

export default function StudentReportsView({ mode, initialStudentId, initialClass }: StudentReportViewProps) {
  const [selectedClass, setSelectedClass] = useState(initialClass || 'All');
  const [selectedSection, setSelectedSection] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId || '');
  const [selectedExamId, setSelectedExamId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Custom document controls
  const [zoom, setZoom] = useState<number>(1.0);
  const [watermark, setWatermark] = useState<string>('NONE');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Database-backed datasets
  const [exams, setExams] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [examSubjects, setExamSubjects] = useState<any[]>([]);
  const [classSubjects, setClassSubjects] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [studentMarks, setStudentMarks] = useState<any[]>([]);
  const [examResult, setExamResult] = useState<any | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<{ total_days: number; present_days: number; percentage: number } | null>(null);
  const [coScholasticData, setCoScholasticData] = useState<Record<string, string>>({
    discipline: 'A',
    sports: 'A',
    art: 'A',
    music: 'A',
    dance: 'A',
    computer: 'A',
    behavior: 'A',
    leadership: 'A',
    communication: 'A',
    remarks: 'Consistent academic performance and active participation in institutional activities.'
  });

  // Initial load for exams, classes, subjects, exam_subjects, class_subjects
  useEffect(() => {
    fetchBaseContext();
  }, []);

  const fetchBaseContext = async () => {
    setIsLoading(true);
    try {
      const [examsRes, subjectsRes, studentsRes, classesRes, esRes, csRes] = await Promise.all([
        supabase.from('exams').select('*').order('created_at', { ascending: false }),
        supabase.from('subjects').select('*').order('subject_name'),
        supabase.from('students').select('*').eq('status', 'active').order('roll_number', { ascending: true }),
        supabase.from('classes').select('*').order('display_order', { ascending: true }),
        supabase.from('exam_subjects').select('*'),
        supabase.from('class_subjects').select('id, class_id, subject_id, is_active, subjects(id, subject_name, subject_code)')
      ]);

      const examList = examsRes.data || [];
      const studentList = studentsRes.data || [];
      setExams(examList);
      setSubjects(subjectsRes.data || []);
      setStudents(studentList);
      setClassesList(classesRes.data || []);
      setExamSubjects(esRes.data || []);
      setClassSubjects(csRes.data || []);

      if (examList.length > 0 && !selectedExamId) {
        setSelectedExamId(examList[0].id);
      }
      if (studentList.length > 0 && !selectedStudentId) {
        setSelectedStudentId(studentList[0].id);
      }
    } catch (err) {
      console.error('Failed to load report card context:', err);
      toast.error('Failed loading academic data');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter exams available for current selection
  const filteredExams = useMemo(() => {
    if (selectedClass === 'All') return exams;
    return exams.filter(ex => !ex.class || isSameClass(ex.class, selectedClass));
  }, [exams, selectedClass]);

  // Sync selected exam if filtered list changes
  useEffect(() => {
    if (filteredExams.length > 0 && !filteredExams.some(e => e.id === selectedExamId)) {
      setSelectedExamId(filteredExams[0].id);
    }
  }, [filteredExams, selectedExamId]);

  // Filter students based on selected class, section & query
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchClass = selectedClass === 'All' || isSameClass(s.class, selectedClass);
      const matchSection = selectedSection === 'All' || (s.section || '').toUpperCase() === selectedSection.toUpperCase();
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || 
        (s.name || '').toLowerCase().includes(q) ||
        (s.roll_number || '').toString().includes(q) ||
        (s.admission_number || '').toLowerCase().includes(q);
      
      return matchClass && matchSection && matchQuery;
    });
  }, [students, selectedClass, selectedSection, searchQuery]);

  // Keep selectedStudentId valid
  useEffect(() => {
    if (filteredStudents.length > 0 && !filteredStudents.some(s => s.id === selectedStudentId)) {
      setSelectedStudentId(filteredStudents[0].id);
    }
  }, [filteredStudents, selectedStudentId]);

  const activeStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId) || filteredStudents[0] || students[0] || null;
  }, [students, selectedStudentId, filteredStudents]);

  const activeExam = useMemo(() => {
    return exams.find(e => e.id === selectedExamId) || filteredExams[0] || exams[0] || null;
  }, [exams, selectedExamId, filteredExams]);

  // When activeStudent changes and has a class, sync the exam if current exam is for another class
  useEffect(() => {
    if (activeStudent && activeStudent.class && activeExam && activeExam.class) {
      if (!isSameClass(activeStudent.class, activeExam.class)) {
        const matchingExam = exams.find(e => isSameClass(e.class, activeStudent.class));
        if (matchingExam) {
          setSelectedExamId(matchingExam.id);
        }
      }
    }
  }, [activeStudent?.id, exams]);

  // Fetch student-specific marks, results, attendance, and co-scholastics
  useEffect(() => {
    if (!selectedStudentId) return;
    loadStudentDetails(selectedStudentId, selectedExamId);
  }, [selectedStudentId, selectedExamId]);

  const loadStudentDetails = async (studentId: string, examId: string) => {
    try {
      // 1. Fetch Marks for this student
      let marksQuery = supabase.from('marks').select('*').eq('student_id', studentId);
      if (examId) marksQuery = marksQuery.eq('exam_id', examId);
      const { data: marks } = await marksQuery;
      setStudentMarks(marks || []);

      // 2. Fetch Result for this student
      let resQuery = supabase.from('exam_results').select('*').eq('student_id', studentId);
      if (examId) resQuery = resQuery.eq('exam_id', examId);
      const { data: results } = await resQuery.maybeSingle();
      setExamResult(results || null);

      // 3. Fetch Attendance Summary
      const { data: attLogs } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', studentId);
      
      const totalDays = attLogs?.length || 0;
      const presentDays = attLogs?.filter(a => a.status === 'present').length || 0;
      const pct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
      setAttendanceSummary({ total_days: totalDays, present_days: presentDays, percentage: pct });

      // 4. Fetch Co-scholastic data
      const { data: coData } = await supabase
        .from('co_scholastic')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();

      if (coData) {
        setCoScholasticData({
          discipline: coData.discipline || 'A',
          sports: coData.sports || 'A',
          art: coData.art || 'A',
          music: coData.music || 'A',
          dance: coData.dance || 'A',
          computer: coData.computer || 'A',
          behavior: coData.behavior || 'A',
          leadership: coData.leadership || 'A',
          communication: coData.communication || 'A',
          remarks: coData.remarks || 'Consistent academic performance and active participation.'
        });
      }
    } catch (err) {
      console.error('Error fetching student report details:', err);
    }
  };

  const handleSaveCoScholastic = async () => {
    if (!selectedStudentId) return;
    setIsSaving(true);
    const toastId = toast.loading('Saving co-scholastic evaluations...');

    try {
      const payload = {
        student_id: selectedStudentId,
        exam_id: selectedExamId || null,
        discipline: coScholasticData.discipline,
        sports: coScholasticData.sports,
        art: coScholasticData.art,
        music: coScholasticData.music,
        dance: coScholasticData.dance,
        computer: coScholasticData.computer,
        behavior: coScholasticData.behavior,
        leadership: coScholasticData.leadership,
        communication: coScholasticData.communication,
        remarks: coScholasticData.remarks
      };

      const { error } = await supabase
        .from('co_scholastic')
        .upsert([payload], { onConflict: 'student_id' });

      if (error) {
        // Fallback to delete + insert if constraint differs
        await supabase.from('co_scholastic').delete().eq('student_id', selectedStudentId);
        const { error: insErr } = await supabase.from('co_scholastic').insert([payload]);
        if (insErr) throw insErr;
      }

      toast.success('Co-scholastic evaluation updated successfully!', { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to save evaluation: ' + err.message, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  // Determine subjects strictly mapped to this exam & student's class
  const scholasticRows = useMemo(() => {
    if (!activeStudent) return [];

    const marksBySubjectId: Record<string, any> = {};
    const marksBySubjectName: Record<string, any> = {};
    studentMarks.forEach(m => {
      if (m.subject_id) marksBySubjectId[m.subject_id] = m;
      if (m.subject_name) marksBySubjectName[m.subject_name.toLowerCase().trim()] = m;
    });

    // 1. First priority: Real exam_subjects rows configured for this selected exam
    let candidateSubjects: Array<{
      subject_id?: string;
      subject_name: string;
      subject_code?: string;
      max_marks?: number;
      pass_marks?: number;
    }> = [];

    const matchingExamSubjects = examSubjects.filter(es => es.exam_id === selectedExamId);
    if (matchingExamSubjects.length > 0) {
      candidateSubjects = matchingExamSubjects.map(es => {
        const fullSub = subjects.find(s => s.id === es.subject_id);
        return {
          subject_id: es.subject_id,
          subject_name: es.subject_name || fullSub?.subject_name || 'Subject',
          subject_code: fullSub?.subject_code || (es.subject_id ? `SUB-${es.subject_id.slice(0, 4).toUpperCase()}` : undefined),
          max_marks: Number(es.max_marks) || 100,
          pass_marks: Number(es.pass_marks) || Math.round((Number(es.max_marks) || 100) * 0.33)
        };
      });
    }

    // 2. Second priority: If no exam_subjects, fetch class_subjects for student's class
    if (candidateSubjects.length === 0 && activeStudent.class) {
      const studentClassObj = classesList.find(c => isSameClass(c.class_name, activeStudent.class));
      const studentClassId = studentClassObj?.id;
      
      const matchingClassSubjects = classSubjects.filter(cs => {
        if (studentClassId && cs.class_id === studentClassId) return true;
        return false;
      });

      if (matchingClassSubjects.length > 0) {
        candidateSubjects = matchingClassSubjects.map(cs => {
          const subData = cs.subjects || subjects.find(s => s.id === cs.subject_id);
          return {
            subject_id: cs.subject_id,
            subject_name: subData?.subject_name || 'Subject',
            subject_code: subData?.subject_code,
            max_marks: 100,
            pass_marks: 33
          };
        });
      }
    }

    // 3. Third priority: Subjects from studentMarks records
    if (candidateSubjects.length === 0 && studentMarks.length > 0) {
      candidateSubjects = studentMarks.map(m => {
        const fullSub = subjects.find(s => s.id === m.subject_id);
        return {
          subject_id: m.subject_id,
          subject_name: m.subject_name || fullSub?.subject_name || 'Subject',
          subject_code: fullSub?.subject_code,
          max_marks: Number(m.max_marks) || 100,
          pass_marks: Number(m.pass_marks) || 33
        };
      });
    }

    // 4. Ultimate fallback: If student's class is known, filter subjects logically (avoid senior subjects for primary/pre-primary)
    if (candidateSubjects.length === 0) {
      const isJunior = /^(LKG|UKG|NURSERY|1|2|3|4|5)$/i.test(activeStudent.class || '');
      const defaultJuniorNames = ['English', 'Hindi', 'Mathematics', 'Environmental Studies', 'General Knowledge'];
      
      const filtered = subjects.filter(s => {
        if (isJunior) {
          return defaultJuniorNames.some(d => s.subject_name.toLowerCase().includes(d.toLowerCase()));
        }
        return true;
      });

      candidateSubjects = (filtered.length > 0 ? filtered : subjects).slice(0, 5).map(s => ({
        subject_id: s.id,
        subject_name: s.subject_name,
        subject_code: s.subject_code,
        max_marks: 100,
        pass_marks: 33
      }));
    }

    return candidateSubjects.map((sub, idx) => {
      const markEntry = (sub.subject_id && marksBySubjectId[sub.subject_id]) || 
        marksBySubjectName[sub.subject_name.toLowerCase().trim()];
      
      const isAbsent = markEntry ? !!markEntry.is_absent : false;
      const pt = isAbsent ? 0 : Number(markEntry?.periodic_test_marks || 0);
      const ma = isAbsent ? 0 : Number(markEntry?.multiple_assessment_marks || 0);
      const pf = isAbsent ? 0 : Number(markEntry?.portfolio_marks || 0);
      const se = isAbsent ? 0 : Number(markEntry?.subject_enrichment_marks || 0);
      const ae = isAbsent ? 0 : Number(markEntry?.annual_exam_marks || 0);
      const internalTotal = pt + ma + pf + se;
      
      const maxMarks = sub.max_marks || 100;
      const passMarks = sub.pass_marks || Math.round(maxMarks * 0.33);

      let grandTotal = 0;
      if (isAbsent) {
        grandTotal = 0;
      } else if (markEntry?.obtained_marks !== undefined && markEntry?.obtained_marks !== null) {
        grandTotal = Number(markEntry.obtained_marks);
      } else if (internalTotal + ae > 0) {
        grandTotal = internalTotal + ae;
      } else {
        grandTotal = 0;
      }

      const percentage = maxMarks > 0 ? Math.round((grandTotal / maxMarks) * 10000) / 100 : 0;
      const grade = isAbsent ? 'ABS' : calculateCBSEGrade(percentage).grade;
      const isPass = !isAbsent && grandTotal >= passMarks;

      return {
        serial: idx + 1,
        code: sub.subject_code || `SUB-0${idx + 1}`,
        name: sub.subject_name,
        pt,
        ma,
        pf,
        se,
        internalTotal,
        theoryTotal: ae,
        maxMarks,
        passMarks,
        grandTotal,
        percentage,
        grade,
        isAbsent,
        isPass
      };
    });
  }, [activeStudent, subjects, examSubjects, classSubjects, classesList, studentMarks, selectedExamId]);

  // Aggregate stats
  const totalObtained = scholasticRows.reduce((sum, r) => sum + (r.isAbsent ? 0 : r.grandTotal), 0);
  const totalMax = scholasticRows.reduce((sum, r) => sum + r.maxMarks, 0);
  const overallPercentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 10000) / 100 : 0;
  const overallGrade = calculateCBSEGrade(overallPercentage).grade;
  const isOverallPass = scholasticRows.length > 0 && scholasticRows.every(r => r.isPass);
  
  const isUnitOrPAMode = scholasticRows.length > 0 && scholasticRows.every(r => r.maxMarks <= 50);

  const nextClassStr = getNextClassDisplay(activeStudent?.class || '');
  const promotionText = isOverallPass 
    ? `Promoted unconditionally to ${nextClassStr}`
    : 'Academic Evaluation Ongoing / Remedial Classes Prescribed';

  return (
    <div className="space-y-4">
      {/* 1. Header Filter Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Class select */}
          <div className="flex flex-col min-w-[120px]">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Class</span>
            <select 
              value={selectedClass} 
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none h-[36px] cursor-pointer hover:border-slate-300 focus:border-violet-500 focus:bg-white transition-colors"
            >
              <option value="All">All Classes ({students.length})</option>
              {classesList.length > 0 ? (
                classesList.map(c => (
                  <option key={c.id} value={c.class_name}>
                    {formatClassDisplay(c.class_name)} ({students.filter(s => isSameClass(s.class, c.class_name)).length})
                  </option>
                ))
              ) : (
                ['LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(c => (
                  <option key={c} value={c}>{formatClassDisplay(c)}</option>
                ))
              )}
            </select>
          </div>

          {/* Section Filter */}
          <div className="flex flex-col min-w-[90px]">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Section</span>
            <select 
              value={selectedSection} 
              onChange={(e) => setSelectedSection(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none h-[36px] cursor-pointer hover:border-slate-300 focus:border-violet-500 focus:bg-white transition-colors"
            >
              <option value="All">All Sec</option>
              <option value="A">Sec A</option>
              <option value="B">Sec B</option>
              <option value="C">Sec C</option>
            </select>
          </div>

          {/* Exam term */}
          <div className="flex flex-col min-w-[200px]">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Examination Term</span>
            <select 
              value={selectedExamId} 
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none h-[36px] cursor-pointer hover:border-slate-300 focus:border-violet-500 focus:bg-white transition-colors"
            >
              {filteredExams.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.exam_name} {ex.class ? `[Class ${ex.class}]` : ''} ({ex.academic_year || '2026-27'})
                </option>
              ))}
            </select>
          </div>

          {/* Student selection */}
          <div className="flex flex-col min-w-[220px]">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">
              Candidate ({filteredStudents.length})
            </span>
            <select 
              value={selectedStudentId} 
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 outline-none h-[36px] cursor-pointer hover:border-slate-300 focus:border-violet-500 focus:bg-white transition-colors"
            >
              {filteredStudents.map(st => (
                <option key={st.id} value={st.id}>
                  {st.name} • Roll #{st.roll_number || 'N/A'} ({formatClassDisplay(st.class)}-{st.section || 'A'})
                </option>
              ))}
            </select>
          </div>

          {mode === 'final' && (
            <>
              {/* Zoom Selector */}
              <div className="flex flex-col min-w-[85px]">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Scale</span>
                <select 
                  value={zoom} 
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-2.5 text-xs font-semibold text-slate-700 h-[36px] cursor-pointer hover:border-slate-300"
                >
                  <option value="0.85">85%</option>
                  <option value="1.0">100%</option>
                  <option value="1.15">115%</option>
                </select>
              </div>

              {/* Watermark Selector */}
              <div className="flex flex-col min-w-[110px]">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Watermark</span>
                <select 
                  value={watermark} 
                  onChange={(e) => setWatermark(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-2.5 text-xs font-semibold text-slate-700 h-[36px] cursor-pointer hover:border-slate-300"
                >
                  <option value="NONE">None</option>
                  <option value="OFFICIAL COPY">Official Copy</option>
                  <option value="VERIFIED ERP">Verified ERP</option>
                  <option value="CONFIDENTIAL">Confidential</option>
                  <option value="DRAFT">Draft</option>
                </select>
              </div>
            </>
          )}
        </div>

        {mode === 'coscholastic' ? (
          <button 
            onClick={handleSaveCoScholastic}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-5 h-[36px] bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isSaving ? 'Saving...' : 'Sync Co-Scholastics'}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button 
              onClick={async () => {
                if (!reportRef.current) return;
                setIsGeneratingPdf(true);
                const toastId = toast.loading('Compiling crisp vector PDF Report Card...');
                try {
                  const canvas = await html2canvasSafe(reportRef.current, {
                    scale: 3.0,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff'
                  });
                  const imgData = canvas.toDataURL('image/png');
                  const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'px',
                    format: [794, 1123]
                  });
                  pdf.addImage(imgData, 'PNG', 0, 0, 794, 1123);
                  pdf.save(`CBSE_ReportCard_${(activeStudent?.name || 'Student').replace(/\s+/g, '_')}_${formatClassDisplay(activeStudent?.class)}.pdf`);
                  toast.success('Report Card PDF downloaded successfully!', { id: toastId });
                } catch (err) {
                  console.error(err);
                  toast.error('Failed to compile PDF report card.', { id: toastId });
                } finally {
                  setIsGeneratingPdf(false);
                }
              }}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3.5 h-[36px] border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
            >
              {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download size={14} />}
              Download PDF
            </button>
            <button 
              onClick={() => {
                const ok = printRegion('student-report-print', `Report Card — ${activeStudent?.name || 'Student'}`);
                if (!ok) toast.error('Open a student report card before printing.');
              }}
              className="flex items-center gap-1.5 px-4 h-[36px] bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Report
            </button>
          </div>
        )}
      </div>

      {/* 2. Co-Scholastic Mode vs Full Report Card Mode */}
      {mode === 'coscholastic' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-white border border-slate-200/80 shadow-xs rounded-2xl p-5 space-y-4">
            <div>
              <h4 className="text-sm font-extrabold text-slate-800">Co-Scholastic & Life Skills Evaluation</h4>
              <p className="text-slate-400 text-xs mt-0.5">CBSE 5-point grading scale (A+, A, B+, B, C) for non-academic performance</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {[
                { key: 'discipline', label: 'Discipline & General Conduct', icon: Shield },
                { key: 'sports', label: 'Physical Education & Sportsmanship', icon: Activity },
                { key: 'art', label: 'Visual Arts & Creative Expression', icon: Award },
                { key: 'music', label: 'Music & Performing Arts', icon: Award },
                { key: 'dance', label: 'Dance & Theater Activities', icon: Award },
                { key: 'computer', label: 'Digital Technology & Lab Skills', icon: BookOpen },
                { key: 'behavior', label: 'Classroom Deportment & Ethics', icon: Heart },
                { key: 'leadership', label: 'Collaboration & Initiative', icon: User },
                { key: 'communication', label: 'Interpersonal & Speaking Skills', icon: User }
              ].map((param) => (
                <div key={param.key} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <param.icon className="w-3.5 h-3.5 text-violet-600" />
                    <span className="text-xs font-bold text-slate-700">{param.label}</span>
                  </div>
                  <select 
                    value={coScholasticData[param.key] || 'A'} 
                    onChange={(e) => setCoScholasticData({ ...coScholasticData, [param.key]: e.target.value })}
                    className="bg-white border border-slate-200 rounded-lg py-1 px-2 text-xs font-black text-violet-700 outline-none cursor-pointer h-[28px]"
                  >
                    {['A+', 'A', 'B+', 'B', 'C'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 shadow-xs rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Teacher Remarks</h4>
              <p className="text-slate-400 text-[10px] font-semibold mb-2.5">Narrative feedback on student demeanor & progress</p>
              <textarea 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-700 outline-none focus:border-violet-500 focus:bg-white min-h-[140px] resize-none"
                placeholder="Type descriptive teacher evaluation..."
                value={coScholasticData.remarks || ''}
                onChange={(e) => setCoScholasticData({ ...coScholasticData, remarks: e.target.value })}
              />
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">CURRENT CANDIDATE</span>
              <h5 className="font-extrabold text-slate-800 text-xs mt-0.5 uppercase">{activeStudent?.name || 'Candidate'}</h5>
              <p className="text-[10px] text-violet-600 font-mono font-bold mt-0.5">
                Roll #{activeStudent?.roll_number || 'N/A'} • {formatClassDisplay(activeStudent?.class)} - {activeStudent?.section || 'A'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* 3. Official CBSE Report Card Document Matrix */
        <div 
          ref={reportRef}
          id="student-report-print"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          className="space-y-4 transition-transform duration-200 relative pb-12"
        >
          {/* Dynamic Watermark Stamp Overlay */}
          {watermark !== 'NONE' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-[5]">
              <div className="text-[84px] font-black text-slate-400/10 uppercase tracking-widest -rotate-30 whitespace-nowrap">
                {watermark}
              </div>
            </div>
          )}

          {/* Authentic CBSE Standard Report Card Frame */}
          <div className="max-w-3xl mx-auto bg-white border border-slate-900 p-6 md:p-8 space-y-4 relative print:border-none print:shadow-none animate-fadeIn text-slate-900 rounded-none shadow-sm font-sans">
            
            {/* Background Crest Watermark */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.025] pointer-events-none z-0 select-none">
              <GraduationCap className="w-80 h-80 text-slate-950" />
            </div>

            {/* School Header Section */}
            <div className="flex items-start justify-between border-b border-slate-950 pb-3 relative z-10">
              <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center p-0.5">
                <img
                  src="https://upload.wikimedia.org/wikipedia/en/thumb/9/95/CBSE_new_logo.svg/300px-CBSE_new_logo.svg.png"
                  alt="CBSE Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://sjsbrlschool.edu.in/favicon.png';
                  }}
                />
              </div>

              <div className="flex-1 text-center px-3">
                <h1 className="text-base font-black text-[#1a2b4c] uppercase tracking-tight font-serif leading-none">
                  ST. JOSEPH'S SCHOOL
                </h1>
                <p className="text-[10px] text-slate-800 font-bold uppercase tracking-wider mt-0.5">
                  Korari, Barhalganj - Gorakhpur
                </p>
                <p className="text-[8.5px] text-slate-600 font-medium">
                  Affiliated to CBSE (New Delhi)
                </p>
                <p className="text-[8px] text-slate-500 font-medium">
                  Affiliation No. - 2131498, School No. - 70532
                </p>
              </div>

              <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center p-0.5">
                <img
                  src={sjsLogoIcon}
                  alt="SJS Crest"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Title Bar */}
            <div className="bg-[#e4ebf5] border-y border-slate-950 py-1.5 text-center relative z-10">
              <span className="font-black text-[11px] text-[#1a2b4c] uppercase tracking-widest block">
                {activeExam?.exam_name || 'ANNUAL PROGRESS REPORT'} — SESSION {activeExam?.academic_year || '2026-2027'}
              </span>
            </div>

            {/* Student Biodata Grid */}
            <div className="border border-slate-950 p-3 space-y-1.5 text-[8.5px] font-bold text-slate-800 relative z-10">
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-6">
                <div className="grid grid-cols-[95px_1fr] gap-x-2 border-b border-slate-100 pb-0.5">
                  <span className="text-slate-400 uppercase text-[7px]">Candidate Name</span>
                  <span className="text-slate-950 uppercase font-black">{activeStudent?.name || 'N/A'}</span>
                </div>
                <div className="grid grid-cols-[95px_1fr] gap-x-2 border-b border-slate-100 pb-0.5">
                  <span className="text-slate-400 uppercase text-[7px]">Admission No</span>
                  <span className="text-slate-950 font-mono">{activeStudent?.admission_number || 'N/A'}</span>
                </div>
                <div className="grid grid-cols-[95px_1fr] gap-x-2 border-b border-slate-100 pb-0.5">
                  <span className="text-slate-400 uppercase text-[7px]">Father's Name</span>
                  <span className="text-slate-950 uppercase">{activeStudent?.father_name || 'N/A'}</span>
                </div>
                <div className="grid grid-cols-[95px_1fr] gap-x-2 border-b border-slate-100 pb-0.5">
                  <span className="text-slate-400 uppercase text-[7px]">Class & Section</span>
                  <span className="text-slate-950 uppercase">{formatClassDisplay(activeStudent?.class)} - {activeStudent?.section || 'A'}</span>
                </div>
                <div className="grid grid-cols-[95px_1fr] gap-x-2 border-b border-slate-100 pb-0.5">
                  <span className="text-slate-400 uppercase text-[7px]">Mother's Name</span>
                  <span className="text-slate-950 uppercase">{activeStudent?.mother_name || 'N/A'}</span>
                </div>
                <div className="grid grid-cols-[95px_1fr] gap-x-2 border-b border-slate-100 pb-0.5">
                  <span className="text-slate-400 uppercase text-[7px]">Roll Number</span>
                  <span className="text-slate-950 font-mono">#{activeStudent?.roll_number || 'N/A'}</span>
                </div>
                <div className="grid grid-cols-[95px_1fr] gap-x-2">
                  <span className="text-slate-400 uppercase text-[7px]">Attendance Record</span>
                  <span className="text-emerald-700 font-mono">
                    {attendanceSummary && attendanceSummary.total_days > 0
                      ? `${attendanceSummary.percentage}% (${attendanceSummary.present_days}/${attendanceSummary.total_days} Days)`
                      : 'Recorded on Register'}
                  </span>
                </div>
                <div className="grid grid-cols-[95px_1fr] gap-x-2">
                  <span className="text-slate-400 uppercase text-[7px]">Result Status</span>
                  <span className={cn("uppercase font-black", isOverallPass ? "text-emerald-700" : "text-rose-700")}>
                    {isOverallPass ? 'Passed & Promoted' : 'Academic Evaluation Ongoing'}
                  </span>
                </div>
              </div>
            </div>

            {/* 1. Scholastic Areas Table */}
            <div className="space-y-1 relative z-10">
              <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-widest block">
                1. Scholastic Areas (CBSE Academic Performance Matrix)
              </span>
              <div className="border border-slate-950 overflow-hidden">
                <table className="w-full text-left text-[9px] border-collapse">
                  <thead>
                    {isUnitOrPAMode ? (
                      <tr className="bg-slate-100 border-b border-slate-950 text-[7.5px] font-black text-slate-900 uppercase tracking-wider">
                        <th className="py-1.5 px-2 border-r border-slate-300 w-10 text-center">S.No</th>
                        <th className="py-1.5 px-2 border-r border-slate-300 w-24">Subject Code</th>
                        <th className="py-1.5 px-2 border-r border-slate-300">Subject Name</th>
                        <th className="py-1.5 px-2 text-center border-r border-slate-300 w-20">Max Marks</th>
                        <th className="py-1.5 px-2 text-center border-r border-slate-300 w-20">Pass Marks</th>
                        <th className="py-1.5 px-2 text-center border-r border-slate-300 w-24 font-black">Marks Obtained</th>
                        <th className="py-1.5 px-2 text-center border-r border-slate-300 w-20">Percentage</th>
                        <th className="py-1.5 px-2 text-center w-16 font-black">Grade</th>
                      </tr>
                    ) : (
                      <tr className="bg-slate-100 border-b border-slate-950 text-[7px] font-black text-slate-900 uppercase tracking-wider">
                        <th className="py-1.5 px-2 border-r border-slate-300 text-center">S.No</th>
                        <th className="py-1.5 px-2 border-r border-slate-300">Subject Name</th>
                        <th className="py-1.5 px-2 text-center border-r border-slate-300">PT (10)</th>
                        <th className="py-1.5 px-2 text-center border-r border-slate-300">MA (5)</th>
                        <th className="py-1.5 px-2 text-center border-r border-slate-300">PF (5)</th>
                        <th className="py-1.5 px-2 text-center border-r border-slate-300">SE (5)</th>
                        <th className="py-1.5 px-2 text-center border-r border-slate-300">Theory ({scholasticRows[0]?.maxMarks ? Math.max(0, scholasticRows[0].maxMarks - 20) : 80})</th>
                        <th className="py-1.5 px-2 text-center border-r border-slate-300 font-black">Total ({scholasticRows[0]?.maxMarks || 100})</th>
                        <th className="py-1.5 px-2 text-center font-black">Grade</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-slate-300 text-slate-800">
                    {scholasticRows.map((row) => (
                      <tr key={row.serial} className="hover:bg-slate-50/50">
                        {isUnitOrPAMode ? (
                          <>
                            <td className="py-1.5 px-2 border-r border-slate-300 font-mono text-center">0{row.serial}</td>
                            <td className="py-1.5 px-2 border-r border-slate-300 font-mono text-[8px] text-slate-500 uppercase">{row.code}</td>
                            <td className="py-1.5 px-2 border-r border-slate-300 font-bold text-slate-900">{row.name}</td>
                            <td className="py-1.5 px-2 text-center border-r border-slate-300 font-mono text-slate-600">{row.maxMarks}</td>
                            <td className="py-1.5 px-2 text-center border-r border-slate-300 font-mono text-slate-500">{row.passMarks}</td>
                            <td className="py-1.5 px-2 text-center border-r border-slate-300 font-mono font-black text-slate-950">
                              {row.isAbsent ? <span className="text-rose-600 font-bold">ABS</span> : row.grandTotal}
                            </td>
                            <td className="py-1.5 px-2 text-center border-r border-slate-300 font-mono text-slate-700">
                              {row.isAbsent ? '—' : `${row.percentage}%`}
                            </td>
                            <td className="py-1.5 px-2 text-center font-black text-indigo-800">{row.grade}</td>
                          </>
                        ) : (
                          <>
                            <td className="py-1.5 px-2 border-r border-slate-300 font-mono text-center">0{row.serial}</td>
                            <td className="py-1.5 px-2 border-r border-slate-300 font-bold text-slate-900">{row.name}</td>
                            <td className="py-1.5 px-2 text-center border-r border-slate-300 font-mono text-slate-500">{row.pt}</td>
                            <td className="py-1.5 px-2 text-center border-r border-slate-300 font-mono text-slate-500">{row.ma}</td>
                            <td className="py-1.5 px-2 text-center border-r border-slate-300 font-mono text-slate-500">{row.pf}</td>
                            <td className="py-1.5 px-2 text-center border-r border-slate-300 font-mono text-slate-500">{row.se}</td>
                            <td className="py-1.5 px-2 text-center border-r border-slate-300 font-mono text-slate-700 font-bold">{row.theoryTotal}</td>
                            <td className="py-1.5 px-2 text-center border-r border-slate-300 font-mono font-black text-slate-950">
                              {row.isAbsent ? <span className="text-rose-600 font-bold">ABS</span> : row.grandTotal}
                            </td>
                            <td className="py-1.5 px-2 text-center font-black text-indigo-800">{row.grade}</td>
                          </>
                        )}
                      </tr>
                    ))}
                    {/* Summary Row */}
                    <tr className="bg-slate-50 border-t border-slate-950 font-black text-slate-950">
                      <td colSpan={isUnitOrPAMode ? 5 : 7} className="py-1.5 px-3 border-r border-slate-300 text-right uppercase text-[8px]">
                        Grand Aggregate & Overall Percentage:
                      </td>
                      <td className="py-1.5 px-2 text-center border-r border-slate-300 font-mono text-violet-700">
                        {totalObtained} / {totalMax}
                      </td>
                      {isUnitOrPAMode ? (
                        <>
                          <td className="py-1.5 px-2 text-center border-r border-slate-300 font-mono text-slate-900">
                            {overallPercentage}%
                          </td>
                          <td className="py-1.5 px-2 text-center text-indigo-700">
                            {overallGrade}
                          </td>
                        </>
                      ) : (
                        <td className="py-1.5 px-2 text-center text-indigo-700">
                          {overallGrade} ({overallPercentage}%)
                        </td>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Co-Scholastic Activities & Health Block */}
            <div className="grid grid-cols-2 gap-3 relative z-10">
              <div className="space-y-1">
                <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-widest block">
                  2. Co-Scholastic Life Skills (5-Point Scale)
                </span>
                <div className="border border-slate-950 overflow-hidden text-[8.5px] font-bold text-slate-800">
                  <div className="grid grid-cols-[130px_1fr] border-b border-slate-300 p-1.5">
                    <span className="text-slate-400 uppercase text-[6.5px]">Discipline & Conduct</span>
                    <span className="text-slate-950 font-black">{coScholasticData.discipline}</span>
                  </div>
                  <div className="grid grid-cols-[130px_1fr] border-b border-slate-300 p-1.5">
                    <span className="text-slate-400 uppercase text-[6.5px]">Physical Ed & Sports</span>
                    <span className="text-slate-950 font-black">{coScholasticData.sports}</span>
                  </div>
                  <div className="grid grid-cols-[130px_1fr] p-1.5">
                    <span className="text-slate-400 uppercase text-[6.5px]">Art & Creative Skills</span>
                    <span className="text-slate-950 font-black">{coScholasticData.art}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-widest block">
                  3. Health & Physical Metrics
                </span>
                <div className="border border-slate-950 overflow-hidden text-[8.5px] font-bold text-slate-800">
                  <div className="grid grid-cols-2 border-b border-slate-300">
                    <div className="p-1.5 border-r border-slate-300">
                      <span className="text-slate-400 block text-[6px] uppercase">Height / Weight</span>
                      <span className="text-slate-900 font-mono">Normal</span>
                    </div>
                    <div className="p-1.5">
                      <span className="text-slate-400 block text-[6px] uppercase">Blood Group</span>
                      <span className="text-slate-900 font-mono font-black">{activeStudent?.blood_group || 'O+'}</span>
                    </div>
                  </div>
                  <div className="p-1.5">
                    <span className="text-slate-400 block text-[6px] uppercase">Vision & Dental</span>
                    <span className="text-slate-900 font-medium">Fit & Healthy</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Comprehensive Remarks & Promotion */}
            <div className="space-y-1 relative z-10">
              <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-widest block">
                4. Evaluation Feedback & Promotion Decree
              </span>
              <div className="border border-slate-950 p-2.5 text-[8.5px] space-y-1.5 text-slate-800">
                <div className="grid grid-cols-[110px_1fr] gap-2 border-b border-dashed border-slate-300 pb-1">
                  <span className="text-slate-400 uppercase text-[6.5px] font-black">Teacher Remark</span>
                  <span className="font-medium text-slate-900">"{coScholasticData.remarks}"</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <span className="text-slate-400 uppercase text-[6.5px] font-black">Promotion Decree</span>
                  <span className="font-black text-indigo-800 uppercase">{promotionText}</span>
                </div>
              </div>
            </div>

            {/* 4. Signatures & Official Seals */}
            <div className="grid grid-cols-4 gap-3 items-end text-[7.5px] text-slate-500 pt-3 border-t border-slate-950 relative z-10">
              <div className="flex flex-col items-center justify-center space-y-0.5">
                <div className="w-12 h-12 rounded-full border border-dashed border-slate-950 flex flex-col items-center justify-center text-[5.5px] text-slate-400 font-black uppercase text-center leading-none rotate-12 p-0.5">
                  <span>School Seal</span>
                  <span className="text-[4px]">SJS ERP</span>
                </div>
                <span className="text-[6px] font-black uppercase text-slate-400 block">Affix Seal</span>
              </div>

              <div className="text-center border-t border-slate-300 pt-1 w-24 mx-auto">
                <span className="italic block font-bold text-slate-800 font-serif text-[9px] leading-none mb-0.5">Class Teacher</span>
                <span className="text-[5.5px] font-black uppercase text-slate-400 block">Class Teacher</span>
              </div>

              <div className="text-center border-t border-slate-300 pt-1 w-24 mx-auto">
                <span className="italic block font-bold text-slate-800 font-serif text-[9px] leading-none mb-0.5">Exam Controller</span>
                <span className="text-[5.5px] font-black uppercase text-slate-400 block">Exam Controller</span>
              </div>

              <div className="text-center border-t border-slate-300 pt-1 w-24 ml-auto">
                <span className="italic block font-bold text-slate-800 font-serif text-[9px] leading-none mb-0.5">Principal</span>
                <span className="text-[5.5px] font-black uppercase text-slate-400 block">School Principal</span>
              </div>
            </div>

            {/* Page Footer */}
            <div className="flex justify-between items-center text-[6.5px] font-mono text-slate-400 pt-1.5 border-t border-slate-100 relative z-10">
              <span>Card Index: ERP-CBSE-{activeStudent?.roll_number || '00'}-{activeStudent?.id?.substring(0, 5).toUpperCase()}</span>
              <span>Authenticated Digital Report Card</span>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

