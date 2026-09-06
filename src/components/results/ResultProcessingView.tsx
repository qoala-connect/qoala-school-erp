import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Send, 
  Lock, 
  Unlock, 
  RotateCcw, 
  Download, 
  Printer, 
  FileText, 
  Trophy, 
  Users, 
  Search, 
  Clock, 
  X,
  AlertTriangle,
  Layers,
  ChevronRight,
  Eye,
  RefreshCw,
  Award,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getWorkflowBadge, formatClassDisplay } from '@/lib/cbseExamUtils';
import { supabase } from '@/lib/supabase';
import { examinationService, StudentExamResult } from '@/services/examinationService';

interface ResultProcessingViewProps {
  exams: any[];
  classes: any[];
  currentUserRole?: string;
  currentUserId?: string;
  onOpenMarksEntry: (examId: string, subjectId: string, classId?: string) => void;
  onRefreshData?: () => Promise<void>;
}

export default function ResultProcessingView({
  exams,
  classes,
  currentUserRole,
  currentUserId,
  onOpenMarksEntry,
  onRefreshData
}: ResultProcessingViewProps) {
  const [selectedExamId, setSelectedExamId] = useState<string>(exams[0]?.id || '');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [activeSubTab, setActiveSubTab] = useState<'verification' | 'processing' | 'published'>('verification');

  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [processingSummary, setProcessingSummary] = useState<{
    totalCandidates: number;
    processedCount: number;
    errors: string[];
    warnings: string[];
  } | null>(null);

  // Subject ids of the selected exam that actually carry marks. Approving a
  // subject with no marks would still add its max to every student's total in
  // processClassResults, silently deflating percentages — so it is not offered.
  const [subjectsWithMarks, setSubjectsWithMarks] = useState<Set<string>>(new Set());

  // Results list state
  const [examResultsList, setExamResultsList] = useState<StudentExamResult[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [returnModalSubject, setReturnModalSubject] = useState<any | null>(null);
  const [returnReason, setReturnReason] = useState<string>('');
  const [lockModalSubject, setLockModalSubject] = useState<any | null>(null);
  const [unlockModalSubject, setUnlockModalSubject] = useState<any | null>(null);
  const [unlockReason, setUnlockReason] = useState<string>('');

  // Publish confirmation modal
  const [isPublishModalOpen, setIsPublishModalOpen] = useState<boolean>(false);

  // Current selected exam object
  const currentExam = useMemo(() => {
    return exams.find(e => e.id === selectedExamId);
  }, [exams, selectedExamId]);

  // Load results whenever selectedExamId changes
  const loadExamResults = async () => {
    if (!selectedExamId) return;
    setIsLoadingResults(true);
    try {
      const { data: rawResults, error } = await supabase
        .from('exam_results')
        .select('*, students:student_id(name, roll_number, admission_number, class, section, father_name)')
        .eq('exam_id', selectedExamId)
        .order('rank', { ascending: true });

      if (error) throw error;
      setExamResultsList((rawResults as any[]) || []);
    } catch (err) {
      console.warn('[ResultProcessingView] load results warn:', err);
    } finally {
      setIsLoadingResults(false);
    }
  };

  const loadSubjectsWithMarks = async () => {
    if (!selectedExamId) {
      setSubjectsWithMarks(new Set());
      return;
    }
    try {
      const { data, error } = await supabase
        .from('marks')
        .select('subject_id, obtained_marks, attendance_status')
        .eq('exam_id', selectedExamId);

      if (error) throw error;

      const withMarks = new Set<string>();
      for (const m of data || []) {
        if (m.obtained_marks === null && m.attendance_status === 'Present') continue;
        if (m.subject_id) withMarks.add(m.subject_id);
      }
      setSubjectsWithMarks(withMarks);
    } catch (err) {
      console.warn('[ResultProcessingView] subjects-with-marks warn:', err);
      setSubjectsWithMarks(new Set());
    }
  };

  useEffect(() => {
    if (selectedExamId) {
      loadExamResults();
      loadSubjectsWithMarks();
    }
  }, [selectedExamId]);

  // Exam Subjects in current exam
  const examSubjectsList = useMemo(() => {
    if (!currentExam?.exam_subjects) return [];
    return currentExam.exam_subjects;
  }, [currentExam]);

  // Counts of subjects in various stages
  const subjectStats = useMemo(() => {
    const total = examSubjectsList.length;
    const pending = examSubjectsList.filter(s => s.review_status === 'draft' || s.review_status === 'in_progress').length;
    const submitted = examSubjectsList.filter(s => s.review_status === 'submitted').length;
    const returned = examSubjectsList.filter(s => s.review_status === 'returned').length;
    const approved = examSubjectsList.filter(s => s.review_status === 'approved').length;
    const locked = examSubjectsList.filter(s => s.locked || s.review_status === 'locked').length;

    return { total, pending, submitted, returned, approved, locked };
  }, [examSubjectsList]);

  // Mirrors MarksVerificationView: a stream is approvable once it carries
  // marks, whether or not the teacher formally submitted it.
  const isApprovableSubject = (sub: any) => {
    if (sub.locked || sub.review_status === 'approved' || sub.review_status === 'locked') return false;
    return sub.review_status === 'submitted' || subjectsWithMarks.has(sub.subject_id);
  };

  // Handle Approve Subject Marks
  const handleApproveSubject = async (subject: any) => {
    if (subject.review_status !== 'submitted') {
      const ok = window.confirm(
        `${subject.subject_name} was never formally submitted by its teacher. ` +
        `Approve the entered marks as they stand?`
      );
      if (!ok) return;
    }

    try {
      await examinationService.approveMarks(selectedExamId, subject.subject_id || subject.id, currentUserId);
      toast.success(`Marks for ${subject.subject_name} approved successfully.`);
      await loadSubjectsWithMarks();
      onRefreshData?.();
    } catch (err: any) {
      toast.error('Approval failed: ' + (err.message || 'Error'));
    }
  };

  // Handle Confirm Return for Correction
  const handleConfirmReturn = async () => {
    if (!returnModalSubject || !returnReason.trim()) {
      toast.error('Please provide a reason for returning marks.');
      return;
    }

    try {
      await examinationService.returnMarksForCorrection(
        selectedExamId,
        returnModalSubject.subject_id || returnModalSubject.id,
        returnReason.trim(),
        currentUserId
      );

      toast.success('Marks returned to evaluator teacher for correction.');
      setReturnModalSubject(null);
      setReturnReason('');
      onRefreshData?.();
    } catch (err: any) {
      toast.error('Failed to return marks: ' + (err.message || 'Error'));
    }
  };

  // Handle Confirm Lock
  const handleConfirmLock = async () => {
    if (!lockModalSubject) return;
    try {
      await examinationService.lockMarks(
        selectedExamId,
        lockModalSubject.subject_id || lockModalSubject.id,
        currentUserId,
        'Locked by Administrator'
      );

      toast.success(`Marks for ${lockModalSubject.subject_name} are now locked.`);
      setLockModalSubject(null);
      onRefreshData?.();
    } catch (err: any) {
      toast.error('Lock failed: ' + (err.message || 'Error'));
    }
  };

  // Handle Confirm Unlock
  const handleConfirmUnlock = async () => {
    if (!unlockModalSubject || !unlockReason.trim()) {
      toast.error('Please state a reason for unlocking marks.');
      return;
    }

    try {
      await examinationService.unlockMarks(
        selectedExamId,
        unlockModalSubject.subject_id || unlockModalSubject.id,
        unlockReason.trim(),
        currentUserId
      );

      toast.success(`Marks for ${unlockModalSubject.subject_name} unlocked.`);
      setUnlockModalSubject(null);
      setUnlockReason('');
      onRefreshData?.();
    } catch (err: any) {
      toast.error('Unlock failed: ' + (err.message || 'Error'));
    }
  };

  // Run Result Processing Engine
  const handleProcessResults = async () => {
    if (!selectedExamId) return;

    setIsProcessing(true);
    setProcessingSummary(null);
    try {
      const res = await examinationService.processClassResults(
        selectedExamId,
        selectedClassId,
        currentUserId
      );

      setProcessingSummary({
        totalCandidates: res.totalCandidates,
        processedCount: res.processedCount,
        errors: res.errors,
        warnings: res.warnings
      });

      setExamResultsList(res.results);
      toast.success(`Results calculated successfully for ${res.processedCount} students.`);
      setActiveSubTab('processing');
      onRefreshData?.();
    } catch (err: any) {
      console.error('[ResultProcessingView] Process error:', err);
      toast.error('Result calculation failed: ' + (err.message || 'Error'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Publish Results Handler
  const handleConfirmPublish = async () => {
    if (!selectedExamId) return;

    setIsPublishing(true);
    try {
      await examinationService.publishExamResults(selectedExamId, selectedClassId, currentUserId);
      toast.success('Results published successfully! Students and parents can now view scores.');
      setIsPublishModalOpen(false);
      await loadExamResults();
      onRefreshData?.();
    } catch (err: any) {
      console.error('[ResultProcessingView] Publish error:', err);
      toast.error('Publish failed: ' + (err.message || 'Error'));
    } finally {
      setIsPublishing(false);
    }
  };

  const isPublished = currentExam?.is_published || currentExam?.status === 'published';

  // Filtered Exam Results for table
  const filteredResults = useMemo(() => {
    return examResultsList.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        r.students?.name?.toLowerCase().includes(q) ||
        r.students?.roll_number?.toLowerCase().includes(q) ||
        r.students?.admission_number?.toLowerCase().includes(q)
      );
    });
  }, [examResultsList, searchQuery]);

  // Enterprise Merit Summary Statistics
  const meritStats = useMemo(() => {
    if (examResultsList.length === 0) {
      return { topper: null, averagePct: 0, passRatePct: 0, passCount: 0, total: 0 };
    }
    const topper = examResultsList[0] || null;
    const totalScore = examResultsList.reduce((acc, r) => acc + Number(r.percentage || 0), 0);
    const averagePct = Math.round((totalScore / examResultsList.length) * 10) / 10;
    const passCount = examResultsList.filter(r => r.result_status === 'PASS').length;
    const passRatePct = Math.round((passCount / examResultsList.length) * 100);
    return { topper, averagePct, passRatePct, passCount, total: examResultsList.length };
  }, [examResultsList]);

  const handleExportCSV = () => {
    if (filteredResults.length === 0) {
      toast.error('No results to export');
      return;
    }
    const headers = ['Rank,Student Name,Admission No,Roll No,Class,Section,Total Marks,Max Marks,Percentage,Grade,Division,Status'];
    const rows = filteredResults.map(r => [
      r.rank || '',
      `"${(r.students?.name || '').replace(/"/g, '""')}"`,
      r.students?.admission_number || '',
      r.students?.roll_number || '',
      r.students?.class || '',
      r.students?.section || '',
      r.total_marks,
      r.max_total_marks || 100,
      `${r.percentage}%`,
      r.grade,
      r.division,
      r.result_status
    ].join(','));
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CBSE_Merit_Roster_${(currentExam?.exam_name || 'Exam').replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Merit Roster CSV exported successfully');
  };

  const handlePrintRoster = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Verification Queue</span>
            <Clock size={15} className="text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{subjectStats.submitted}</span>
            <span className="text-xs font-bold text-blue-600">Pending Review</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-1">
            {subjectStats.returned} returned for correction
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Approved &amp; Locked</span>
            <ShieldCheck size={15} className="text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700">
              {subjectStats.approved + subjectStats.locked}
            </span>
            <span className="text-xs font-bold text-emerald-600">/ {subjectStats.total} Ready</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-1">
            {subjectStats.locked} subjects locked &amp; protected
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Processed Roster</span>
            <Users size={15} className="text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{examResultsList.length}</span>
            <span className="text-xs font-bold text-indigo-600">Students Evaluated</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-1">
            Standard CBSE grading applied
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Publication Gate</span>
            <Trophy size={15} className="text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={cn("text-xl font-black", isPublished ? "text-teal-700" : "text-amber-600")}>
              {isPublished ? 'LIVE PUBLISHED' : 'UNPUBLISHED'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-1">
            {isPublished ? 'Available in Student Portal' : 'Restricted from Students'}
          </p>
        </div>
      </div>

      {/* 2. Control Ribbon */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Subtabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveSubTab('verification')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                activeSubTab === 'verification' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <ShieldCheck size={14} />
              <span>1. Faculty Marks Verification ({examSubjectsList.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('processing')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                activeSubTab === 'processing' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <Sparkles size={14} />
              <span>2. Process Results ({examResultsList.length})</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleProcessResults}
              disabled={isProcessing || !selectedExamId}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-40 cursor-pointer active:scale-95"
            >
              {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span>{isProcessing ? 'Processing Engine...' : 'Run Result Calculation'}</span>
            </button>

            {examResultsList.length > 0 && !isPublished && (
              <button
                onClick={() => setIsPublishModalOpen(true)}
                disabled={isPublishing}
                className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95 border border-teal-500/20"
              >
                <Send size={14} />
                <span>Publish Results to Portal</span>
              </button>
            )}

            {isPublished && (
              <span className="px-3 py-1.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-xl text-xs font-bold flex items-center gap-1">
                <CheckCircle2 size={14} className="text-teal-600" /> Published Live
              </span>
            )}
          </div>
        </div>

        {/* Exam & Class Selection Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1 pl-1">
              Select Examination Term
            </label>
            <select
              value={selectedExamId}
              onChange={e => {
                setSelectedExamId(e.target.value);
                const ex = exams.find(x => x.id === e.target.value);
                if (ex?.class_id) setSelectedClassId(ex.class_id);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 h-[36px] text-xs font-bold text-slate-800 outline-none hover:border-slate-300 focus:bg-white focus:border-blue-500 cursor-pointer transition-colors"
            >
              {exams.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.short_name || ex.exam_name} ({ex.academic_year}) - {formatClassDisplay(ex.classes?.class_name || ex.class)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1 pl-1">
              Filter by Class
            </label>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 h-[36px] text-xs font-bold text-slate-800 outline-none hover:border-slate-300 focus:bg-white focus:border-blue-500 cursor-pointer transition-colors"
            >
              <option value="all">All Assigned Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{formatClassDisplay(c.class_name)}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1 pl-1">
              Search Result Records
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search candidate name, roll number, admission..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 h-[36px] text-xs font-medium text-slate-800 outline-none hover:border-slate-300 focus:bg-white focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Processing Summary Alert (if recently calculated) */}
      {processingSummary && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-sm">
              <CheckCircle2 size={18} className="text-emerald-600" />
              <span>Result Calculation Complete</span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-800">
              {processingSummary.processedCount} / {processingSummary.totalCandidates} Candidates Processed
            </span>
          </div>

          {processingSummary.warnings.length > 0 && (
            <div className="text-xs text-amber-800 space-y-1 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200">
              {processingSummary.warnings.map((w, i) => (
                <p key={i} className="flex items-center gap-1.5">
                  <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                  <span>{w}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 1: FACULTY MARKS VERIFICATION */}
      {activeSubTab === 'verification' && (
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-blue-600" />
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Faculty Marks Submissions &amp; Verification Board
              </h4>
            </div>
            <span className="text-xs text-slate-500 font-bold bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
              {examSubjectsList.length} subject workload(s)
            </span>
          </div>

          {examSubjectsList.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <ShieldCheck size={32} className="mx-auto text-slate-300" />
              <p className="text-xs font-medium">No subjects configured for this examination.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200/70 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    <th className="py-3 px-4 min-w-[160px]">Subject</th>
                    <th className="py-3 px-4 min-w-[200px]">Evaluator Faculty</th>
                    <th className="py-3 px-4 text-center min-w-[140px]">Marks Scheme</th>
                    <th className="py-3 px-4 text-center min-w-[130px]">Review Status</th>
                    <th className="py-3 px-4 text-right min-w-[220px]">Verification Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {examSubjectsList.map((sub: any) => {
                    const badge = getWorkflowBadge(sub.review_status || 'draft');
                    const isSubLocked = sub.locked || sub.review_status === 'locked';
                    const isSubApproved = sub.review_status === 'approved';
                    const isSubSubmitted = sub.review_status === 'submitted';
                    const canApproveSub = isApprovableSubject(sub);

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div className="font-extrabold text-slate-900 text-xs">{sub.subject_name}</div>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {sub.component_name || 'Periodic Assessment'}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className={cn(
                            "font-bold text-xs block",
                            sub.teachers?.name ? "text-slate-800" : "text-slate-500 italic"
                          )}>
                            {sub.teachers?.name || 'Unassigned'}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono truncate max-w-[200px]">
                            {sub.teachers?.email || 'No email assigned'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-mono font-bold text-slate-700 whitespace-nowrap">
                            <span>Max: <strong>{sub.max_marks}</strong></span>
                            <span className="text-slate-300">|</span>
                            <span>Pass: {sub.pass_marks}</span>
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border whitespace-nowrap",
                            badge.color
                          )}>
                            {isSubLocked && <Lock size={10} className="shrink-0" />}
                            <span>{isSubLocked ? 'Locked' : badge.label}</span>
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                            <button
                              onClick={() => onOpenMarksEntry(selectedExamId, sub.subject_id || sub.id, currentExam?.class_id)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <Eye size={12} />
                              <span>Review</span>
                            </button>

                            {canApproveSub && (
                              <button
                                onClick={() => handleApproveSubject(sub)}
                                title={isSubSubmitted
                                  ? 'Approve the marks submitted by the teacher'
                                  : 'Not submitted by the teacher — approving accepts the entered marks as-is'}
                                className={cn(
                                  "px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1",
                                  isSubSubmitted
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300"
                                )}
                              >
                                <CheckCircle2 size={12} />
                                <span>{isSubSubmitted ? 'Approve' : 'Approve (unsubmitted)'}</span>
                              </button>
                            )}

                            {(canApproveSub || isSubApproved) && !isSubLocked && (
                              <button
                                onClick={() => {
                                  setReturnModalSubject(sub);
                                  setReturnReason('');
                                }}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <RotateCcw size={12} />
                                <span>Return</span>
                              </button>
                            )}

                            {!canApproveSub && !isSubApproved && !isSubLocked && (
                              <span className="px-2 py-1 text-[11px] font-medium text-slate-400 italic">
                                No marks entered yet
                              </span>
                            )}

                            {isSubApproved && !isSubLocked ? (
                              <button
                                onClick={() => setLockModalSubject(sub)}
                                title="Lock Marks"
                                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg border border-purple-200 cursor-pointer"
                              >
                                <Lock size={13} />
                              </button>
                            ) : isSubLocked ? (
                              <button
                                onClick={() => {
                                  setUnlockModalSubject(sub);
                                  setUnlockReason('');
                                }}
                                title="Unlock Marks"
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg border border-amber-200 cursor-pointer"
                              >
                                <Unlock size={13} />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: PROCESSED RESULTS PREVIEW */}
      {activeSubTab === 'processing' && (
        <div className="space-y-4">
          {/* Top Merit KPI Ribbon */}
          {examResultsList.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 rounded-2xl p-4 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Trophy size={20} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider block">Class Topper (Rank #1)</span>
                  <div className="text-xs font-black text-slate-900 truncate">
                    {meritStats.topper?.students?.name || '—'}
                  </div>
                  <div className="text-[11px] font-bold text-amber-600">
                    {meritStats.topper?.percentage}% • Grade {meritStats.topper?.grade}
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-200/80 rounded-2xl p-4 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider block">Batch Mean Average</span>
                  <div className="text-xl font-black text-slate-900">
                    {meritStats.averagePct}%
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    Across {meritStats.total} evaluated candidates
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-200/80 rounded-2xl p-4 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider block">Pass Efficiency Rate</span>
                  <div className="text-xl font-black text-emerald-700">
                    {meritStats.passRatePct}%
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {meritStats.passCount} of {meritStats.total} passed unconditionally
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Table Container */}
          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <div className="relative flex-1 max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Filter by student name, roll no, adm..."
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-blue-500 outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <span className="text-xs text-slate-500 font-bold">
                  {filteredResults.length} candidate(s)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  disabled={filteredResults.length === 0}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={handlePrintRoster}
                  disabled={filteredResults.length === 0}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Printer size={13} />
                  <span>Print Gazette</span>
                </button>
              </div>
            </div>

            {filteredResults.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <Sparkles size={36} className="mx-auto text-slate-300" />
                <h4 className="text-sm font-bold text-slate-700">No Processed Results Available</h4>
                <p className="text-xs max-w-sm mx-auto text-slate-500">
                  Click <strong>Run Result Calculation</strong> above to aggregate all approved marks and generate student merit standings.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-200/70 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                      <th className="py-3 px-4 w-[60px] text-center">Rank</th>
                      <th className="py-3 px-4 w-[240px]">Student Candidate</th>
                      <th className="py-3 px-4 w-[110px]">Admission No</th>
                      <th className="py-3 px-4 text-center">Total Score</th>
                      <th className="py-3 px-4 text-center">Percentage</th>
                      <th className="py-3 px-4 text-center">CBSE Grade</th>
                      <th className="py-3 px-4 text-center">Division</th>
                      <th className="py-3 px-4 text-right">Result Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredResults.map(res => (
                    <tr key={res.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-center font-mono font-extrabold text-slate-800">
                        #{res.rank || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{res.students?.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Roll #{res.students?.roll_number} • Sec {res.students?.section || 'A'}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {res.students?.admission_number}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                        {res.total_marks} <span className="text-slate-400 font-normal">/ {res.max_total_marks || 100}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-extrabold text-indigo-700">
                        {res.percentage}%
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-800 font-black rounded font-mono text-[10px]">
                          {res.grade}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600">
                        {res.division}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded font-black text-[10px] uppercase",
                          res.result_status === 'PASS' && "bg-emerald-100 text-emerald-800",
                          res.result_status === 'COMPARTMENT' && "bg-amber-100 text-amber-800",
                          res.result_status === 'FAIL' && "bg-rose-100 text-rose-800",
                          res.result_status === 'WITHHELD' && "bg-slate-100 text-slate-800"
                        )}>
                          {res.result_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </div>
      )}

      {/* 4. Return For Correction Modal */}
      {returnModalSubject && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Return Subject Marks</h3>
                  <p className="text-xs text-slate-500">{returnModalSubject.subject_name}</p>
                </div>
              </div>
              <button
                onClick={() => setReturnModalSubject(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Correction Instructions / Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={returnReason}
                onChange={e => setReturnReason(e.target.value)}
                placeholder="State clearly why these marks are being returned to the teacher..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:bg-white focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReturnModalSubject(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!returnReason.trim()}
                onClick={handleConfirmReturn}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-40 cursor-pointer"
              >
                Return to Teacher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Lock Confirmation Modal */}
      {lockModalSubject && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                <Lock size={22} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Lock Examination Marks?</h3>
                <p className="text-xs text-slate-500">{lockModalSubject.subject_name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              Once locked, marks cannot be modified by any faculty member. Only an authorized administrator can unlock them.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLockModalSubject(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLock}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Confirm Lock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Unlock Modal with Reason */}
      {unlockModalSubject && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Unlock size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Unlock Marks for Editing</h3>
                  <p className="text-xs text-slate-500">{unlockModalSubject.subject_name}</p>
                </div>
              </div>
              <button
                onClick={() => setUnlockModalSubject(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Unlock Authorization Reason <span className="text-amber-600">*</span>
              </label>
              <textarea
                rows={3}
                value={unlockReason}
                onChange={e => setUnlockReason(e.target.value)}
                placeholder="State the administrative reason for unlocking these marks..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:bg-white focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUnlockModalSubject(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!unlockReason.trim()}
                onClick={handleConfirmUnlock}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-40 cursor-pointer"
              >
                Authorize Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Publish Confirmation Modal */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl">
                <Send size={22} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Publish Examination Results?</h3>
                <p className="text-xs text-slate-500">
                  {currentExam?.short_name || currentExam?.exam_name}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 leading-relaxed">
              Publishing will make the official scores, CBSE grades, marks, and report cards immediately accessible to students and parents on the Portal.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPublishModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPublishing}
                onClick={handleConfirmPublish}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-40 cursor-pointer"
              >
                {isPublishing ? 'Publishing...' : 'Publish to Portal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
