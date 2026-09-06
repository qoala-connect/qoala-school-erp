import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  Trophy, 
  Search, 
  Save, 
  RefreshCcw, 
  Target, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Send, 
  Lock, 
  ChevronLeft, 
  ChevronRight, 
  UserCheck, 
  RotateCcw,
  AlertTriangle,
  Users,
  Clock,
  Check,
  X,
  FileCheck,
  ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { calculateCBSEGrade, getWorkflowBadge } from '@/lib/cbseExamUtils';
import { examinationService, GradingRule, StudentMarkEntry } from '@/services/examinationService';

interface ResultsViewProps {
  exams: any[];
  subjects: any[];
  classes: any[];
  currentUserRole?: string;
  currentUserId?: string;
  initialExamId?: string;
  initialSubjectId?: string;
  initialClassId?: string;
  onBackToTasks?: () => void;
}

export default function ResultsView({
  exams,
  subjects,
  classes,
  currentUserRole,
  currentUserId,
  initialExamId,
  initialSubjectId,
  initialClassId,
  onBackToTasks
}: ResultsViewProps) {
  // Selection states
  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId || (exams[0]?.id || ''));
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialSubjectId || '');
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId || '');
  const [selectedSection, setSelectedSection] = useState<string>('All');

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [attendanceFilter, setAttendanceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Data states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  const [examSubjectConfig, setExamSubjectConfig] = useState<any>(null);
  const [roster, setRoster] = useState<StudentMarkEntry[]>([]);
  const [gradingRules, setGradingRules] = useState<GradingRule[]>([]);

  // Review Modal state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [confirmSubmitChecked, setConfirmSubmitChecked] = useState<boolean>(false);

  // Focus navigation ref map
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Current selected exam object
  const currentExam = useMemo(() => {
    return exams.find(e => e.id === selectedExamId);
  }, [exams, selectedExamId]);

  // Available subjects for the selected exam
  const availableExamSubjects = useMemo(() => {
    if (!currentExam) return [];
    if (currentExam.exam_subjects && currentExam.exam_subjects.length > 0) {
      return currentExam.exam_subjects;
    }
    return subjects;
  }, [currentExam, subjects]);

  // Sync initial selections
  useEffect(() => {
    if (initialExamId && initialExamId !== selectedExamId) {
      setSelectedExamId(initialExamId);
    }
  }, [initialExamId]);

  useEffect(() => {
    if (initialSubjectId && initialSubjectId !== selectedSubjectId) {
      setSelectedSubjectId(initialSubjectId);
    }
  }, [initialSubjectId]);

  useEffect(() => {
    if (initialClassId && initialClassId !== selectedClassId) {
      setSelectedClassId(initialClassId);
    }
  }, [initialClassId]);

  // Auto-select first subject if not selected
  useEffect(() => {
    if (availableExamSubjects.length > 0 && !selectedSubjectId) {
      const firstSubId = availableExamSubjects[0].subject_id || availableExamSubjects[0].id;
      setSelectedSubjectId(firstSubId);
    }
  }, [availableExamSubjects, selectedSubjectId]);

  // Load roster data whenever selectedExamId or selectedSubjectId changes
  const loadRosterData = useCallback(async () => {
    if (!selectedExamId || !selectedSubjectId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await examinationService.getStudentRosterWithMarks(
        selectedExamId,
        selectedSubjectId,
        selectedClassId || currentExam?.class_id
      );

      setExamSubjectConfig(data.examSubject);
      setRoster(data.roster);
      setGradingRules(data.gradingRules);
      setIsDirty(false);
    } catch (err: any) {
      console.error('[ResultsView] Error loading roster:', err);
      toast.error('Failed to load marks roster: ' + (err.message || 'Network error'));
    } finally {
      setIsLoading(false);
    }
  }, [selectedExamId, selectedSubjectId, selectedClassId, currentExam]);

  useEffect(() => {
    loadRosterData();
  }, [loadRosterData]);

  const maxMarks = examSubjectConfig?.max_marks || 20;
  const passMarks = examSubjectConfig?.pass_marks || 7;
  const isLocked = examSubjectConfig?.locked || examSubjectConfig?.review_status === 'locked';
  const isSubmitted = examSubjectConfig?.review_status === 'submitted';
  const isReturned = examSubjectConfig?.review_status === 'returned';
  const isApproved = examSubjectConfig?.review_status === 'approved';

  // Marks may only be entered by the assigned subject evaluator or exam-office staff.
  // The database enforces this via RLS (marks_teacher_scoped / marks_admin_all); this
  // client guard just stops a teacher hitting a dead end after typing marks they can
  // never save. `examSubjectConfig.teachers` is the joined teachers row (has user_id).
  const PRIVILEGED_MARK_ROLES = ['super_admin', 'admin', 'principal', 'vice_principal', 'exam_controller'];
  const isPrivilegedMarker = !!currentUserRole && PRIVILEGED_MARK_ROLES.includes(currentUserRole);
  const assignedEvaluator = examSubjectConfig?.teachers || null;
  const isAssignedEvaluator =
    !!currentUserId && !!assignedEvaluator?.user_id && assignedEvaluator.user_id === currentUserId;
  const canEditMarks = !!examSubjectConfig && (isPrivilegedMarker || isAssignedEvaluator);
  const evaluatorBlockReason = !examSubjectConfig
    ? ''
    : canEditMarks
      ? ''
      : !examSubjectConfig.teacher_id
        ? 'No faculty evaluator has been assigned to this subject yet. Ask the examination office to assign you before entering marks.'
        : `Only the assigned evaluator${assignedEvaluator?.name ? ` (${assignedEvaluator.name})` : ''} or the examination office can enter marks for this subject.`;

  const friendlyMarksError = (err: any): string => {
    const raw = err?.message || err?.error_description || String(err || 'Error');
    if (/row-level security|violates .*policy|permission denied|42501/i.test(raw)) {
      return 'Server permission denied: you can only save marks for the class, section and subject assigned to you.';
    }
    return raw;
  };

  // Handle Mark Change
  const handleMarkChange = (studentId: string, valStr: string) => {
    if (isLocked || isSubmitted || !canEditMarks) return;

    setRoster(prev => prev.map(item => {
      if (item.student_id !== studentId) return item;

      let obtained: number | null = null;
      if (valStr.trim() !== '' && valStr !== '—') {
        const parsed = Number(valStr);
        if (!isNaN(parsed)) {
          obtained = parsed;
        }
      }

      // Compute grade
      let grade = '—';
      if (obtained !== null && item.attendance_status === 'Present' && maxMarks > 0) {
        const pct = (obtained / maxMarks) * 100;
        grade = examinationService.calculateGradeFromRules(pct, gradingRules).grade;
      }

      return {
        ...item,
        obtained_marks: obtained,
        grade
      };
    }));

    setIsDirty(true);
  };

  // Handle Attendance Change
  const handleAttendanceChange = (studentId: string, status: 'Present' | 'Absent' | 'Medical' | 'Exempted') => {
    if (isLocked || isSubmitted) return;

    setRoster(prev => prev.map(item => {
      if (item.student_id !== studentId) return item;

      const isNonPresent = status !== 'Present';
      const obtained = isNonPresent ? null : item.obtained_marks;
      let grade = '—';
      if (obtained !== null && status === 'Present' && maxMarks > 0) {
        const pct = (obtained / maxMarks) * 100;
        grade = examinationService.calculateGradeFromRules(pct, gradingRules).grade;
      }

      return {
        ...item,
        attendance_status: status,
        is_absent: status === 'Absent',
        is_medical: status === 'Medical',
        is_exempted: status === 'Exempted',
        obtained_marks: obtained,
        grade
      };
    }));

    setIsDirty(true);
  };

  // Handle Remarks Change
  const handleRemarksChange = (studentId: string, remarks: string) => {
    if (isLocked || isSubmitted) return;
    setRoster(prev => prev.map(item => item.student_id === studentId ? { ...item, remarks } : item));
    setIsDirty(true);
  };

  // Save Draft function
  const handleSaveDraft = async (silent: boolean = false) => {
    if (!selectedExamId || !selectedSubjectId || roster.length === 0) return;
    if (!canEditMarks) {
      if (!silent) toast.error(evaluatorBlockReason || 'You are not permitted to edit these marks.');
      return;
    }

    // Only persist rows the evaluator actually touched. Blank rows stay
    // "Not Evaluated", and — importantly — we never send rows for students
    // outside the evaluator's assigned section, which RLS would reject and
    // which would abort the whole batch (error 42501).
    const touched = roster.filter(r =>
      (r.obtained_marks !== null && r.obtained_marks !== undefined) ||
      (!!r.attendance_status && r.attendance_status !== 'Present') ||
      (!!r.remarks && r.remarks.trim() !== '')
    );

    if (touched.length === 0) {
      if (!silent) toast.error('Enter at least one mark before saving.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = touched.map(r => ({
        student_id: r.student_id,
        obtained_marks: r.obtained_marks,
        attendance_status: r.attendance_status,
        max_marks: maxMarks,
        remarks: r.remarks
      }));

      const res = await examinationService.saveMarksDraft(
        selectedExamId,
        selectedSubjectId,
        payload,
        currentUserId
      );

      setLastSavedTime(res.timestamp);
      setIsDirty(false);
      if (!silent) {
        toast.success(`Draft saved successfully for ${res.count} students.`);
      }
    } catch (err: any) {
      console.error('[ResultsView] Error saving draft:', err);
      if (!silent) {
        toast.error('Failed to save draft: ' + friendlyMarksError(err));
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Safe Autosave Debounce (3.5 seconds after last change)
  useEffect(() => {
    if (!isDirty || isLocked || isSubmitted) return;

    const timer = setTimeout(() => {
      handleSaveDraft(true);
    }, 3500);

    return () => clearTimeout(timer);
  }, [roster, isDirty, isLocked, isSubmitted]);

  // Handle Keyboard Navigation between student input rows
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextStudent = filteredStudents[index + 1];
      if (nextStudent) {
        inputRefs.current.get(nextStudent.student_id)?.focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevStudent = filteredStudents[index - 1];
      if (prevStudent) {
        inputRefs.current.get(prevStudent.student_id)?.focus();
      }
    }
  };

  // Filter and Search Roster
  const filteredStudents = useMemo(() => {
    return roster.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        item.student?.name.toLowerCase().includes(q) ||
        item.student?.roll_number.toLowerCase().includes(q) ||
        item.student?.admission_number.toLowerCase().includes(q);

      const matchAttendance = attendanceFilter === 'all' || item.attendance_status.toLowerCase() === attendanceFilter.toLowerCase();

      let matchStatus = true;
      if (statusFilter === 'entered') {
        matchStatus = item.obtained_marks !== null || item.attendance_status !== 'Present';
      } else if (statusFilter === 'pending') {
        matchStatus = item.obtained_marks === null && item.attendance_status === 'Present';
      }

      const matchSection = selectedSection === 'All' || item.student?.section === selectedSection;

      return matchSearch && matchAttendance && matchStatus && matchSection;
    });
  }, [roster, searchQuery, attendanceFilter, statusFilter, selectedSection]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = roster.length;
    const presentList = roster.filter(r => r.attendance_status === 'Present');
    const absentCount = roster.filter(r => r.attendance_status === 'Absent').length;
    const medicalCount = roster.filter(r => r.attendance_status === 'Medical').length;
    const exemptedCount = roster.filter(r => r.attendance_status === 'Exempted').length;

    const enteredPresent = presentList.filter(r => r.obtained_marks !== null);
    const notEnteredCount = presentList.filter(r => r.obtained_marks === null).length;

    let avgScore = 0;
    let highestScore = 0;
    let passCount = 0;

    if (enteredPresent.length > 0) {
      const sum = enteredPresent.reduce((acc, curr) => acc + (curr.obtained_marks || 0), 0);
      avgScore = Math.round((sum / enteredPresent.length) * 10) / 10;
      highestScore = Math.max(...enteredPresent.map(r => r.obtained_marks || 0));
      passCount = enteredPresent.filter(r => (r.obtained_marks || 0) >= passMarks).length;
    }

    const passRate = enteredPresent.length > 0 
      ? Math.round((passCount / enteredPresent.length) * 100) 
      : 0;

    const invalidMarksCount = roster.filter(
      r => r.obtained_marks !== null && (r.obtained_marks < 0 || r.obtained_marks > maxMarks)
    ).length;

    return {
      total,
      enteredCount: enteredPresent.length + absentCount + medicalCount + exemptedCount,
      presentCount: presentList.length,
      absentCount,
      medicalCount,
      exemptedCount,
      notEnteredCount,
      avgScore,
      highestScore,
      passRate,
      invalidMarksCount
    };
  }, [roster, maxMarks, passMarks]);

  // Submit for Verification Handler
  const handleFinalSubmit = async () => {
    if (!selectedExamId || !selectedSubjectId) return;

    if (metrics.invalidMarksCount > 0) {
      toast.error('Cannot submit. Some marks exceed maximum marks or are invalid.');
      return;
    }

    if (!canEditMarks) {
      toast.error(evaluatorBlockReason || 'You are not permitted to submit these marks.');
      setIsReviewModalOpen(false);
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Save all current marks first
      await handleSaveDraft(true);

      // 2. Transition workflow status to submitted
      await examinationService.submitMarksForReview(
        selectedExamId,
        selectedSubjectId,
        currentUserId
      );

      toast.success('Marks submitted successfully to Administrator for verification.');
      setIsReviewModalOpen(false);
      setConfirmSubmitChecked(false);
      await loadRosterData();
    } catch (err: any) {
      console.error('[ResultsView] Error submitting marks:', err);
      toast.error('Failed to submit marks: ' + friendlyMarksError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const workflowBadge = getWorkflowBadge(examSubjectConfig?.review_status || 'draft');

  return (
    <div className="space-y-6">
      {/* 0. Not-the-assigned-evaluator banner — entry is blocked (also enforced by DB RLS) */}
      {evaluatorBlockReason && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="p-2 bg-amber-100 text-amber-700 rounded-xl mt-0.5">
            <Lock size={18} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-900">Marks entry is read-only for you</h4>
            <p className="text-xs text-amber-700 mt-1 font-medium">{evaluatorBlockReason}</p>
          </div>
        </div>
      )}

      {/* 0b. Submitted / Approved / Locked confirmation banner */}
      {(isSubmitted || isApproved || isLocked) && !isReturned && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl mt-0.5">
              {isLocked ? <Lock size={18} /> : isApproved ? <CheckCircle2 size={18} /> : <Send size={18} />}
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-900">
                {isLocked
                  ? 'Marks locked'
                  : isApproved
                    ? 'Marks approved by administrator'
                    : 'Marks submitted for verification'}
              </h4>
              <p className="text-xs text-emerald-700 mt-1 font-medium">
                {isLocked
                  ? 'These marks are finalised and can no longer be edited.'
                  : isApproved
                    ? 'The administrator has approved these marks — no further action needed.'
                    : 'Your marks were sent to the administrator for review. They stay read-only until approved or returned for correction.'}
              </p>
              {(examSubjectConfig?.reviewed_at || examSubjectConfig?.updated_at) && (
                <p className="text-[11px] text-emerald-600/80 mt-1">
                  {isApproved ? 'Approved' : isLocked ? 'Locked' : 'Submitted'} on{' '}
                  {new Date(examSubjectConfig.reviewed_at || examSubjectConfig.updated_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg shrink-0">
            {isLocked ? 'Locked' : isApproved ? 'Approved' : 'Submitted'}
          </span>
        </div>
      )}

      {/* 1. Returned for Correction Banner (if applicable) */}
      {isReturned && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-xl mt-0.5">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-900">Returned for Correction by Administrator</h4>
              <p className="text-xs text-rose-700 mt-1 font-medium">
                <strong>Reason:</strong> {examSubjectConfig?.reopen_reason || 'Please review entered marks and resubmit.'}
              </p>
              <p className="text-[11px] text-rose-600/80 mt-1">
                Make necessary changes and click <strong>Submit for Verification</strong> when ready.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-lg shrink-0">
            Action Required
          </span>
        </div>
      )}

      {/* 2. Header & Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Total Candidates</span>
            <Users size={15} className="text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{metrics.total}</span>
            <span className="text-xs font-bold text-indigo-600">
              {metrics.enteredCount}/{metrics.total} Entered
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-1">
            {metrics.notEnteredCount > 0 ? `${metrics.notEnteredCount} not entered` : 'All marks recorded'}
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Attendance Breakdown</span>
            <CheckCircle2 size={15} className="text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{metrics.presentCount}</span>
            <span className="text-xs font-bold text-emerald-600">Present</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-1">
            {metrics.absentCount} Absent • {metrics.medicalCount} Medical • {metrics.exemptedCount} Exempted
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Class Average</span>
            <Trophy size={15} className="text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{metrics.avgScore}</span>
            <span className="text-xs font-bold text-slate-400">/ {maxMarks}</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-1">
            Highest Score: <strong className="text-slate-700">{metrics.highestScore} / {maxMarks}</strong>
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Passing Standard</span>
            <Sparkles size={15} className="text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{metrics.passRate}%</span>
            <span className="text-xs font-bold text-blue-600">Pass Rate</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-1">
            Pass Mark: {passMarks} / {maxMarks}
          </p>
        </div>
      </div>

      {/* 3. Primary Control Ribbon & Configuration Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
        {/* Top bar: Workflow status and Action buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3 flex-wrap">
            {onBackToTasks && (
              <button
                onClick={onBackToTasks}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft size={14} /> My Workload
              </button>
            )}

            <div className="flex items-center gap-2">
              <span className={cn("px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5", workflowBadge.color)}>
                {workflowBadge.label}
              </span>

              {isLocked && (
                <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1">
                  <Lock size={12} /> Read-Only Locked
                </span>
              )}

              {isSubmitted && !isApproved && (
                <span className="text-xs text-blue-700 font-medium bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                  Under Admin Review
                </span>
              )}
            </div>

            {lastSavedTime && (
              <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                <Clock size={12} /> Last saved at {lastSavedTime}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isLocked && !isSubmitted && !canEditMarks && examSubjectConfig && (
              <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                <Lock size={12} /> Read-Only
              </span>
            )}
            {!isLocked && !isSubmitted && canEditMarks && (
              <>
                <button
                  onClick={() => handleSaveDraft(false)}
                  disabled={isSaving || isLoading}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-40 cursor-pointer active:scale-95"
                >
                  {isSaving ? <RefreshCcw size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
                </button>

                <button
                  onClick={() => setIsReviewModalOpen(true)}
                  disabled={isSaving || isLoading || roster.length === 0}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-40 cursor-pointer active:scale-95 border border-blue-500/20"
                >
                  <Send size={14} />
                  <span>Review &amp; Submit Marks</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filters and selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Exam Selector */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
              Assessment Term
            </label>
            <select
              value={selectedExamId}
              onChange={e => {
                setSelectedExamId(e.target.value);
                const ex = exams.find(x => x.id === e.target.value);
                if (ex?.class_id) setSelectedClassId(ex.class_id);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500"
            >
              {exams.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.short_name || ex.exam_name} ({ex.academic_year}) - Class {ex.classes?.class_name || ex.class}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Selector */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
              Subject
            </label>
            <select
              value={selectedSubjectId}
              onChange={e => setSelectedSubjectId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500"
            >
              {availableExamSubjects.map((sub: any) => (
                <option key={sub.id} value={sub.subject_id || sub.id}>
                  {sub.subject_name || sub.subjects?.subject_name} ({sub.max_marks || 20} Marks)
                </option>
              ))}
            </select>
          </div>

          {/* Attendance Filter */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
              Attendance Filter
            </label>
            <select
              value={attendanceFilter}
              onChange={e => setAttendanceFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500"
            >
              <option value="all">All Attendance</option>
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Medical">Medical</option>
              <option value="Exempted">Exempted</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
              Entry Status
            </label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500"
            >
              <option value="all">All Marks Status</option>
              <option value="entered">Marks Recorded</option>
              <option value="pending">Pending Entry</option>
            </select>
          </div>

          {/* Search Input */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
              Search Student
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Name, Roll, or Adm..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:bg-white focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Dedicated Single-Exam Marks Entry Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
              {currentExam?.short_name || currentExam?.exam_name || 'Assessment'}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-bold text-indigo-700">
              {examSubjectConfig?.subject_name || 'Subject'}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
              Max: {maxMarks} | Pass: {passMarks}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Showing {paginatedStudents.length} of {filteredStudents.length} candidates</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold outline-none cursor-pointer"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <RefreshCcw size={24} className="animate-spin mx-auto text-blue-600" />
            <p className="text-xs font-medium">Loading student roster and examination marks...</p>
          </div>
        ) : paginatedStudents.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Users size={32} className="mx-auto text-slate-300" />
            <h4 className="text-sm font-bold text-slate-700">No student candidates found</h4>
            <p className="text-xs">No active students matched the selected filters or search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/70 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="py-3 px-4 w-[60px] text-center">Roll #</th>
                  <th className="py-3 px-4 w-[240px]">Student Candidate</th>
                  <th className="py-3 px-4 w-[120px]">Admission No</th>
                  <th className="py-3 px-4 w-[150px] text-center">Attendance</th>
                  <th className="py-3 px-4 w-[160px] text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span>Score</span>
                      <span className="text-blue-700 font-bold font-mono">(/ {maxMarks})</span>
                    </div>
                  </th>
                  <th className="py-3 px-4 w-[100px] text-center">CBSE Grade</th>
                  <th className="py-3 px-4 w-[110px] text-center">Validation</th>
                  <th className="py-3 px-4">Teacher Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedStudents.map((item, index) => {
                  const isAbsent = item.attendance_status === 'Absent';
                  const isMedical = item.attendance_status === 'Medical';
                  const isExempted = item.attendance_status === 'Exempted';
                  const isNonPresent = isAbsent || isMedical || isExempted;

                  const rawScore = item.obtained_marks;
                  const isInvalid = rawScore !== null && (rawScore < 0 || rawScore > maxMarks);
                  const isPassing = rawScore !== null && rawScore >= passMarks;

                  return (
                    <tr key={item.student_id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Roll Number */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-600">
                        {item.student?.roll_number || '—'}
                      </td>

                      {/* Student Info */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{item.student?.name}</div>
                        <div className="text-[10px] text-slate-400">
                          Class {item.student?.class} - Sec {item.student?.section || 'A'}
                        </div>
                      </td>

                      {/* Admission Number */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {item.student?.admission_number}
                      </td>

                      {/* Attendance Selector */}
                      <td className="py-3 px-4 text-center">
                        <select
                          value={item.attendance_status}
                          disabled={isLocked || isSubmitted || !canEditMarks}
                          onChange={e => handleAttendanceChange(item.student_id, e.target.value as any)}
                          className={cn(
                            "px-2 py-1 rounded-lg text-xs font-bold border outline-none cursor-pointer transition-colors",
                            item.attendance_status === 'Present' && "bg-emerald-50 text-emerald-800 border-emerald-200",
                            item.attendance_status === 'Absent' && "bg-rose-50 text-rose-800 border-rose-200",
                            item.attendance_status === 'Medical' && "bg-blue-50 text-blue-800 border-blue-200",
                            item.attendance_status === 'Exempted' && "bg-amber-50 text-amber-800 border-amber-200",
                            (isLocked || isSubmitted) && "opacity-60 cursor-not-allowed"
                          )}
                        >
                          <option value="Present">Present</option>
                          <option value="Absent">Absent</option>
                          <option value="Medical">Medical</option>
                          <option value="Exempted">Exempted</option>
                        </select>
                      </td>

                      {/* Score Input (Numeric) */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center justify-center">
                          {isNonPresent ? (
                            <span className="w-20 py-1.5 text-center font-mono font-bold text-slate-400 bg-slate-100 rounded-xl text-xs">
                              —
                            </span>
                          ) : (
                            <input
                              ref={el => {
                                if (el) inputRefs.current.set(item.student_id, el);
                                else inputRefs.current.delete(item.student_id);
                              }}
                              type="number"
                              min={0}
                              max={maxMarks}
                              step={0.5}
                              placeholder="—"
                              disabled={isLocked || isSubmitted || !canEditMarks}
                              value={item.obtained_marks === null ? '' : item.obtained_marks}
                              onChange={e => handleMarkChange(item.student_id, e.target.value)}
                              onKeyDown={e => handleKeyDown(e, (currentPage - 1) * pageSize + index)}
                              className={cn(
                                "w-20 px-2.5 py-1.5 text-center font-mono font-bold rounded-xl border text-xs outline-none transition-all",
                                isInvalid && "border-rose-500 bg-rose-50 text-rose-800 focus:ring-2 focus:ring-rose-200",
                                !isInvalid && item.obtained_marks !== null && isPassing && "border-emerald-300 bg-emerald-50/40 text-emerald-900 focus:border-emerald-500",
                                !isInvalid && item.obtained_marks !== null && !isPassing && "border-amber-300 bg-amber-50/40 text-amber-900 focus:border-amber-500",
                                item.obtained_marks === null && "border-slate-200 bg-white text-slate-800 focus:border-blue-500",
                                (isLocked || isSubmitted) && "bg-slate-100 text-slate-500 cursor-not-allowed"
                              )}
                            />
                          )}
                        </div>
                      </td>

                      {/* Grade */}
                      <td className="py-3 px-4 text-center">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded font-black text-[11px] font-mono",
                          item.grade === '—' && "text-slate-400",
                          item.grade === 'A1' && "bg-emerald-100 text-emerald-800",
                          item.grade === 'A2' && "bg-emerald-50 text-emerald-700",
                          item.grade === 'B1' && "bg-blue-100 text-blue-800",
                          item.grade === 'B2' && "bg-blue-50 text-blue-700",
                          item.grade === 'C1' && "bg-amber-100 text-amber-800",
                          item.grade === 'C2' && "bg-amber-50 text-amber-700",
                          item.grade === 'D' && "bg-orange-100 text-orange-800",
                          item.grade === 'E' && "bg-rose-100 text-rose-800"
                        )}>
                          {item.grade}
                        </span>
                      </td>

                      {/* Validation Status */}
                      <td className="py-3 px-4 text-center">
                        {isInvalid ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            <AlertCircle size={10} /> Max {maxMarks}
                          </span>
                        ) : isNonPresent ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {item.attendance_status}
                          </span>
                        ) : item.obtained_marks === null ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                            Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <Check size={10} /> Valid
                          </span>
                        )}
                      </td>

                      {/* Remarks */}
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          placeholder="Optional note..."
                          disabled={isLocked || isSubmitted || !canEditMarks}
                          value={item.remarks || ''}
                          onChange={e => handleRemarksChange(item.student_id, e.target.value)}
                          className="w-full max-w-[200px] bg-transparent border-b border-dashed border-slate-200 px-1 py-0.5 text-xs text-slate-700 outline-none focus:border-blue-500"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Review Before Submit Confirmation Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
                  <FileCheck size={22} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Review Marks Before Submission
                  </h3>
                  <p className="text-xs text-slate-500">
                    {currentExam?.short_name || currentExam?.exam_name} • {examSubjectConfig?.subject_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Summary statistics */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Roster</span>
                <span className="text-lg font-black text-slate-900">{metrics.total}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase block">Marks Entered</span>
                <span className="text-lg font-black text-emerald-700">{metrics.enteredCount}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-amber-600 uppercase block">Not Entered</span>
                <span className="text-lg font-black text-amber-700">{metrics.notEnteredCount}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 bg-blue-50/60 p-3.5 rounded-2xl border border-blue-100">
              <div className="flex justify-between">
                <span>Present Candidates:</span>
                <strong>{metrics.presentCount}</strong>
              </div>
              <div className="flex justify-between">
                <span>Absent Candidates:</span>
                <strong>{metrics.absentCount}</strong>
              </div>
              <div className="flex justify-between">
                <span>Medical / Exempted:</span>
                <strong>{metrics.medicalCount + metrics.exemptedCount}</strong>
              </div>
              <div className="flex justify-between border-t border-blue-100/80 pt-1">
                <span>Cohort Average:</span>
                <strong className="text-blue-900">{metrics.avgScore} / {maxMarks}</strong>
              </div>
            </div>

            {metrics.notEnteredCount > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                <span>Notice: {metrics.notEnteredCount} candidate(s) still have unentered marks. They will be marked as Not Evaluated.</span>
              </div>
            )}

            {/* Confirmation checkbox */}
            <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={confirmSubmitChecked}
                onChange={e => setConfirmSubmitChecked(e.target.checked)}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
              />
              <span>
                I confirm that I have verified all entered marks. After submission, marks cannot be edited unless returned by the administrator.
              </span>
            </label>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Back to Editing
              </button>
              <button
                type="button"
                disabled={!confirmSubmitChecked || isSubmitting}
                onClick={handleFinalSubmit}
                className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-40 cursor-pointer active:scale-95"
              >
                {isSubmitting ? <RefreshCcw size={14} className="animate-spin" /> : <Send size={14} />}
                <span>{isSubmitting ? 'Submitting...' : 'Confirm & Submit'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
