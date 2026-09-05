import React, { useState, useMemo, useEffect } from 'react';
import { 
  Trophy, 
  Search, 
  Save, 
  RefreshCcw, 
  FileSpreadsheet, 
  Download, 
  Target, 
  UserX, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ArrowRight,
  Send,
  Lock,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CBSEComponentMarks, isSameClass, formatClassDisplay, calculateCBSEGrade, MarksWorkflowStatus, getWorkflowBadge } from '@/lib/cbseExamUtils';

interface Exam {
  id: string;
  exam_name: string;
  class: string;
  academic_year: string;
}

interface Student {
  id: string;
  name: string;
  roll_number: string;
  class: string;
  section?: string;
  admission_number?: string;
}

interface Subject {
  id: string;
  subject_name: string;
  subject_code?: string;
}

interface ResultsViewProps {
  exams: Exam[];
  students: Student[];
  subjects: Subject[];
  marks: Record<string, Record<string, CBSEComponentMarks>>;
  isLoading: boolean;
  isSaving: boolean;
  workflowStatus?: MarksWorkflowStatus;
  assignedTeacherName?: string;
  onMarkChange: (studentId: string, subjectId: string, field: keyof CBSEComponentMarks, value: any) => void;
  onSave: (examId: string) => Promise<void>;
  onSubmitForVerification?: (examId: string, subjectId: string) => Promise<void>;
  onExamChange?: (examId: string) => void;
  initialExamId?: string;
  initialClass?: string;
  initialSection?: string;
  initialSubjectId?: string;
}

export default function ResultsView({
  exams,
  students,
  subjects,
  marks,
  isLoading,
  isSaving,
  workflowStatus = 'draft',
  assignedTeacherName,
  onMarkChange,
  onSave,
  onSubmitForVerification,
  onExamChange,
  initialExamId,
  initialClass,
  initialSection,
  initialSubjectId
}: ResultsViewProps) {
  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId || '');
  const [selectedClass, setSelectedClass] = useState<string>(initialClass || 'All');
  const [selectedSection, setSelectedSection] = useState<string>(initialSection || 'All');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialSubjectId || '');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination for large student scale (e.g. 3,000+ students)
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Sync initial props
  useEffect(() => {
    if (initialExamId) setSelectedExamId(initialExamId);
  }, [initialExamId]);

  useEffect(() => {
    if (initialClass) setSelectedClass(initialClass);
  }, [initialClass]);

  useEffect(() => {
    if (initialSubjectId) setSelectedSubjectId(initialSubjectId);
  }, [initialSubjectId]);

  // Auto-sync initial exam selection
  useEffect(() => {
    if (exams.length > 0 && !selectedExamId) {
      setSelectedExamId(exams[0].id);
    }
  }, [exams, selectedExamId]);

  // Notify parent on exam change to pull marks scoped to this exam
  useEffect(() => {
    if (selectedExamId) {
      onExamChange?.(selectedExamId);
      const currentExam = exams.find(e => e.id === selectedExamId);
      if (currentExam && currentExam.class && selectedClass === 'All') {
        setSelectedClass(currentExam.class);
      }
    }
  }, [selectedExamId]);

  // Auto-sync subject
  useEffect(() => {
    if (subjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [subjects, selectedSubjectId]);

  // Extract unique classes
  const availableClasses = useMemo(() => {
    const classSet = new Set<string>();
    exams.forEach(e => { if (e.class) classSet.add(e.class); });
    students.forEach(s => { if (s.class) classSet.add(s.class); });
    return Array.from(classSet).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  }, [exams, students]);

  // Extract sections
  const availableSections = useMemo(() => {
    const secSet = new Set<string>();
    students.forEach(s => { if (s.section) secSet.add(s.section.toUpperCase()); });
    return Array.from(secSet).sort();
  }, [students]);

  // Filter eligible students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchClass = selectedClass === 'All' || isSameClass(s.class, selectedClass);
      const sSec = (s.section || 'A').toUpperCase();
      const matchSection = selectedSection === 'All' || sSec === selectedSection.toUpperCase();
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        (s.name || '').toLowerCase().includes(q) || 
        (s.roll_number || '').toLowerCase().includes(q) ||
        (s.admission_number || '').toLowerCase().includes(q);
      return matchClass && matchSection && matchSearch;
    });
  }, [students, selectedClass, selectedSection, searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClass, selectedSection, selectedSubjectId, searchQuery, pageSize]);

  // Paginated slice
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;

  // Helper to compute student total score for the active subject
  const getStudentSubjectTotal = (studentId: string) => {
    const sMarks = marks[studentId]?.[selectedSubjectId];
    if (!sMarks) return 0;
    if (sMarks.is_absent) return 0;
    return (Number(sMarks.periodic_test_marks) || 0) +
           (Number(sMarks.multiple_assessment_marks) || 0) +
           (Number(sMarks.portfolio_marks) || 0) +
           (Number(sMarks.subject_enrichment_marks) || 0) +
           (Number(sMarks.annual_exam_marks) || 0);
  };

  // Real-time Class Metrics
  const classMetrics = useMemo(() => {
    if (filteredStudents.length === 0) {
      return { classAvg: 0, passRate: 0, topPerformer: 'N/A', evaluatedCount: 0 };
    }
    
    let totalScore = 0;
    let scoredCount = 0;
    let passedCount = 0;
    let highestTotal = -1;
    let highestStudent = 'N/A';
    
    filteredStudents.forEach(s => {
      const sMarks = marks[s.id]?.[selectedSubjectId];
      if (sMarks && !sMarks.is_absent) {
        const total = getStudentSubjectTotal(s.id);
        totalScore += total;
        scoredCount++;
        if (total >= 33) passedCount++;
        if (total > highestTotal) {
          highestTotal = total;
          highestStudent = `${s.name} (${total}/100)`;
        }
      }
    });
    
    const classAvg = scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0;
    const passRate = scoredCount > 0 ? Math.round((passedCount / scoredCount) * 100) : 0;
    
    return { classAvg, passRate, topPerformer: highestStudent, evaluatedCount: scoredCount };
  }, [filteredStudents, selectedSubjectId, marks]);

  const isLocked = workflowStatus === 'locked' || workflowStatus === 'published';
  const badgeInfo = getWorkflowBadge(workflowStatus);

  const handleSave = async () => {
    if (!selectedExamId) {
      toast.error('Please select an assessment to save marks.');
      return;
    }
    await onSave(selectedExamId);
  };

  const handleSubmitReview = async () => {
    if (!selectedExamId || !selectedSubjectId) return;
    await handleSave();
    if (onSubmitForVerification) {
      await onSubmitForVerification(selectedExamId, selectedSubjectId);
    } else {
      toast.success('Grade sheet submitted for examination review.');
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Real-time KPI Stats Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Eligible Candidates', value: filteredStudents.length, desc: `${classMetrics.evaluatedCount} evaluated`, color: 'bg-indigo-50 border-indigo-100 text-indigo-600', icon: Target },
          { label: 'Class Average', value: `${classMetrics.classAvg}%`, desc: 'Average marks for subject', color: 'bg-emerald-50 border-emerald-100 text-emerald-600', icon: Trophy },
          { label: 'Passing Standard', value: `${classMetrics.passRate}%`, desc: 'Scoring ≥ 33% (Pass)', color: 'bg-violet-50 border-violet-100 text-violet-600', icon: FileSpreadsheet },
          { label: 'Highest Scorer', value: classMetrics.topPerformer, desc: 'Top mark in cohort', color: 'bg-amber-50 border-amber-100 text-amber-600', icon: Sparkles }
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200/60 shadow-2xs rounded-2xl p-4 flex flex-col justify-between min-h-[92px] hover:shadow-xs transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{stat.label}</span>
              <div className={cn("p-1.5 rounded-lg border", stat.color)}>
                <stat.icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-1">
              <h3 className="text-lg font-display font-extrabold text-slate-900 truncate">{stat.value}</h3>
              <p className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate">{stat.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Primary Filter & Workflow Controls Bar */}
      <div className="bg-white rounded-[20px] border border-slate-200/60 p-4 shadow-2xs space-y-3">
        {/* Top Status & Evaluator Information Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className={cn("px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider border", badgeInfo.color)}>
              Status: {badgeInfo.label}
            </span>
            {assignedTeacherName && (
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <UserCheck size={13} className="text-violet-600" />
                Evaluator: <strong className="text-slate-800">{assignedTeacherName}</strong>
              </span>
            )}
            {isLocked && (
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 flex items-center gap-1">
                <Lock size={10} /> Read-Only Mode
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleSave}
              disabled={isSaving || isLocked || filteredStudents.length === 0}
              className="flex items-center gap-1.5 px-4 h-[34px] bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-40 cursor-pointer active:scale-95"
            >
              {isSaving ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Draft</span>
            </button>

            {!isLocked && (
              <button 
                onClick={handleSubmitReview}
                disabled={isSaving || filteredStudents.length === 0}
                className="flex items-center gap-1.5 px-4 h-[34px] bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-violet-500/15 disabled:opacity-40 cursor-pointer active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit for Verification</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Exam Term Selector */}
            <div className="flex flex-col min-w-[170px]">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Assessment Term</span>
              <select 
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-700 outline-none h-[36px] cursor-pointer focus:border-violet-500 focus:bg-white"
              >
                {exams.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.exam_name} ({ex.academic_year})</option>
                ))}
              </select>
            </div>

            {/* Subject Selector */}
            <div className="flex flex-col min-w-[150px]">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Subject</span>
              <select 
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-700 outline-none h-[36px] cursor-pointer focus:border-violet-500 focus:bg-white"
              >
                {subjects.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.subject_name}</option>
                ))}
              </select>
            </div>

            {/* Class Filter */}
            <div className="flex flex-col min-w-[110px]">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Class Grade</span>
              <select 
                value={selectedClass} 
                onChange={(e) => setSelectedClass(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-700 outline-none h-[36px] cursor-pointer focus:border-violet-500 focus:bg-white"
              >
                <option value="All">All Classes</option>
                {availableClasses.map(c => (
                  <option key={c} value={c}>{formatClassDisplay(c)}</option>
                ))}
              </select>
            </div>

            {/* Section Filter */}
            <div className="flex flex-col min-w-[90px]">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Section</span>
              <select 
                value={selectedSection} 
                onChange={(e) => setSelectedSection(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-700 outline-none h-[36px] cursor-pointer focus:border-violet-500 focus:bg-white"
              >
                <option value="All">All Sec</option>
                {availableSections.map(sec => (
                  <option key={sec} value={sec}>Sec {sec}</option>
                ))}
              </select>
            </div>

            {/* Search Box */}
            <div className="flex flex-col min-w-[160px] flex-1 sm:flex-initial">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Search Roster</span>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Name or Roll..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 pl-8 pr-3 text-xs text-slate-800 outline-none h-[36px] focus:border-violet-500 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Page Size Selector */}
          <div className="flex items-center gap-2 self-end pb-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-2 text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. CBSE 5-Component Marks Entry Table */}
      <div className="bg-white border border-slate-200/60 shadow-2xs rounded-[22px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[9.5px] font-black text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-5 w-[220px]">Student Candidate</th>
                <th className="py-3.5 px-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span>Periodic Test</span>
                    <span className="text-violet-600 font-mono font-bold">(10)</span>
                  </div>
                </th>
                <th className="py-3.5 px-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span>Multiple Assmt</span>
                    <span className="text-violet-600 font-mono font-bold">(5)</span>
                  </div>
                </th>
                <th className="py-3.5 px-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span>Portfolio</span>
                    <span className="text-violet-600 font-mono font-bold">(5)</span>
                  </div>
                </th>
                <th className="py-3.5 px-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span>Sub Enrichment</span>
                    <span className="text-violet-600 font-mono font-bold">(5)</span>
                  </div>
                </th>
                <th className="py-3.5 px-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span>Annual / Theory</span>
                    <span className="text-violet-600 font-mono font-bold">(80)</span>
                  </div>
                </th>
                <th className="py-3.5 px-3 text-center">Total (100)</th>
                <th className="py-3.5 px-3 text-center">Grade</th>
                <th className="py-3.5 px-4 text-center w-[90px]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/70 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center text-slate-400 font-extrabold text-xs uppercase tracking-widest">
                    <RefreshCcw className="w-6 h-6 animate-spin mx-auto mb-2.5 text-violet-600" />
                    Synchronizing Student Gradebook...
                  </td>
                </tr>
              ) : paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center text-slate-400 font-bold">
                    No matching student records found for the selected class/section filter.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((s) => {
                  const sMarks: CBSEComponentMarks = marks[s.id]?.[selectedSubjectId] || {
                    periodic_test_marks: 0,
                    multiple_assessment_marks: 0,
                    portfolio_marks: 0,
                    subject_enrichment_marks: 0,
                    annual_exam_marks: 0,
                    is_absent: false
                  };

                  const total = getStudentSubjectTotal(s.id);
                  const gradeInfo = calculateCBSEGrade(total);
                  const isAbsent = !!sMarks.is_absent;

                  return (
                    <tr 
                      key={s.id} 
                      className={cn(
                        "transition-colors",
                        isAbsent ? "bg-rose-50/25 opacity-75" : "hover:bg-slate-50/40"
                      )}
                    >
                      {/* Student Info */}
                      <td className="py-3 px-5">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{s.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-2 mt-0.5">
                          <span>Roll #{s.roll_number || 'N/A'}</span>
                          <span>•</span>
                          <span className="font-mono text-slate-500">{s.admission_number}</span>
                          <span>•</span>
                          <span className="text-violet-600 font-bold">{formatClassDisplay(s.class)}-{s.section || 'A'}</span>
                        </div>
                      </td>

                      {/* Periodic Test (10) */}
                      <td className="py-2.5 px-3 text-center">
                        <input 
                          type="number" 
                          max={10} min={0} step="0.5"
                          disabled={isAbsent || isLocked}
                          value={isAbsent ? '' : (sMarks.periodic_test_marks !== undefined ? sMarks.periodic_test_marks : '')}
                          onChange={(e) => {
                            const val = Math.min(10, Math.max(0, Number(e.target.value) || 0));
                            onMarkChange(s.id, selectedSubjectId, 'periodic_test_marks', e.target.value === '' ? '' : val);
                          }}
                          placeholder="--"
                          className="w-14 bg-slate-50 border border-slate-200/80 focus:border-violet-500 focus:bg-white rounded-lg py-1 text-center text-slate-800 font-extrabold outline-none text-xs transition-all h-[30px] disabled:opacity-40 disabled:bg-slate-100"
                        />
                      </td>

                      {/* Multiple Assessment (5) */}
                      <td className="py-2.5 px-3 text-center">
                        <input 
                          type="number" 
                          max={5} min={0} step="0.5"
                          disabled={isAbsent || isLocked}
                          value={isAbsent ? '' : (sMarks.multiple_assessment_marks !== undefined ? sMarks.multiple_assessment_marks : '')}
                          onChange={(e) => {
                            const val = Math.min(5, Math.max(0, Number(e.target.value) || 0));
                            onMarkChange(s.id, selectedSubjectId, 'multiple_assessment_marks', e.target.value === '' ? '' : val);
                          }}
                          placeholder="--"
                          className="w-14 bg-slate-50 border border-slate-200/80 focus:border-violet-500 focus:bg-white rounded-lg py-1 text-center text-slate-800 font-extrabold outline-none text-xs transition-all h-[30px] disabled:opacity-40 disabled:bg-slate-100"
                        />
                      </td>

                      {/* Portfolio (5) */}
                      <td className="py-2.5 px-3 text-center">
                        <input 
                          type="number" 
                          max={5} min={0} step="0.5"
                          disabled={isAbsent || isLocked}
                          value={isAbsent ? '' : (sMarks.portfolio_marks !== undefined ? sMarks.portfolio_marks : '')}
                          onChange={(e) => {
                            const val = Math.min(5, Math.max(0, Number(e.target.value) || 0));
                            onMarkChange(s.id, selectedSubjectId, 'portfolio_marks', e.target.value === '' ? '' : val);
                          }}
                          placeholder="--"
                          className="w-14 bg-slate-50 border border-slate-200/80 focus:border-violet-500 focus:bg-white rounded-lg py-1 text-center text-slate-800 font-extrabold outline-none text-xs transition-all h-[30px] disabled:opacity-40 disabled:bg-slate-100"
                        />
                      </td>

                      {/* Subject Enrichment (5) */}
                      <td className="py-2.5 px-3 text-center">
                        <input 
                          type="number" 
                          max={5} min={0} step="0.5"
                          disabled={isAbsent || isLocked}
                          value={isAbsent ? '' : (sMarks.subject_enrichment_marks !== undefined ? sMarks.subject_enrichment_marks : '')}
                          onChange={(e) => {
                            const val = Math.min(5, Math.max(0, Number(e.target.value) || 0));
                            onMarkChange(s.id, selectedSubjectId, 'subject_enrichment_marks', e.target.value === '' ? '' : val);
                          }}
                          placeholder="--"
                          className="w-14 bg-slate-50 border border-slate-200/80 focus:border-violet-500 focus:bg-white rounded-lg py-1 text-center text-slate-800 font-extrabold outline-none text-xs transition-all h-[30px] disabled:opacity-40 disabled:bg-slate-100"
                        />
                      </td>

                      {/* Annual / Theory Exam (80) */}
                      <td className="py-2.5 px-3 text-center">
                        <input 
                          type="number" 
                          max={80} min={0} step="0.5"
                          disabled={isAbsent || isLocked}
                          value={isAbsent ? '' : (sMarks.annual_exam_marks !== undefined ? sMarks.annual_exam_marks : '')}
                          onChange={(e) => {
                            const val = Math.min(80, Math.max(0, Number(e.target.value) || 0));
                            onMarkChange(s.id, selectedSubjectId, 'annual_exam_marks', e.target.value === '' ? '' : val);
                          }}
                          placeholder="--"
                          className="w-16 bg-slate-50 border border-slate-200/80 focus:border-violet-500 focus:bg-white rounded-lg py-1 text-center text-slate-900 font-black outline-none text-xs transition-all h-[30px] disabled:opacity-40 disabled:bg-slate-100"
                        />
                      </td>

                      {/* Total Score (100) */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={cn(
                          "font-mono font-black text-xs px-2 py-0.5 rounded-md",
                          isAbsent ? "text-slate-400 bg-slate-100" :
                          total >= 80 ? "text-emerald-700 bg-emerald-50" :
                          total >= 33 ? "text-indigo-700 bg-indigo-50" :
                          "text-rose-700 bg-rose-50"
                        )}>
                          {isAbsent ? 'ABS' : total}
                        </span>
                      </td>

                      {/* Grade Badge */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                          isAbsent ? "bg-slate-100 text-slate-400" :
                          gradeInfo.grade.startsWith('A') ? "bg-emerald-100 text-emerald-800" :
                          gradeInfo.grade.startsWith('B') ? "bg-indigo-100 text-indigo-800" :
                          gradeInfo.grade.startsWith('C') ? "bg-amber-100 text-amber-800" :
                          gradeInfo.grade === 'D' ? "bg-blue-100 text-blue-800" :
                          "bg-rose-100 text-rose-800"
                        )}>
                          {isAbsent ? '—' : gradeInfo.grade}
                        </span>
                      </td>

                      {/* Absent Toggle Button */}
                      <td className="py-2.5 px-4 text-center">
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => {
                            const nextAbsent = !isAbsent;
                            onMarkChange(s.id, selectedSubjectId, 'is_absent', nextAbsent);
                            if (nextAbsent) {
                              toast.info(`Marked ${s.name} as Absent`);
                            }
                          }}
                          className={cn(
                            "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all border cursor-pointer disabled:opacity-40",
                            isAbsent 
                              ? "bg-rose-600 text-white border-rose-600" 
                              : "bg-slate-50 text-slate-500 hover:text-slate-800 border-slate-200"
                          )}
                        >
                          {isAbsent ? 'Absent' : 'Present'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Pagination Footer */}
        <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
          <div>
            Showing <strong className="text-slate-800">{paginatedStudents.length}</strong> of <strong className="text-slate-800">{filteredStudents.length}</strong> candidates
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="font-mono text-xs font-bold text-slate-700 px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
