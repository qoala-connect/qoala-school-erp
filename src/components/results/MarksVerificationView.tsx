import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RotateCcw, 
  Lock, 
  Unlock, 
  Eye, 
  Clock, 
  BarChart3, 
  Users, 
  Award, 
  Check, 
  X, 
  Loader2,
  ChevronRight,
  TrendingUp,
  FileText,
  Sparkles,
  Edit3,
  BookOpen,
  ArrowRight,
  UserCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { examinationService, ExamRecord } from '@/services/examinationService';
import { useAuth } from '@/context/AuthContext';
import { getWorkflowBadge } from '@/lib/cbseExamUtils';

interface MarksVerificationViewProps {
  exams: ExamRecord[];
  classes: any[];
  subjects: any[];
  selectedYearId: string;
  onNavigateTab: (tab: string, extraParams?: Record<string, string>) => void;
}

export default function MarksVerificationView({
  exams,
  classes,
  subjects,
  selectedYearId,
  onNavigateTab
}: MarksVerificationViewProps) {
  const { user, can } = useAuth();

  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedExamId, setSelectedExamId] = useState('all');
  const [selectedClassId, setSelectedClassId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Return for correction modal
  const [returnModalTarget, setReturnModalTarget] = useState<any | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [isReturning, setIsReturning] = useState(false);

  // Unlock modal
  const [unlockModalTarget, setUnlockModalTarget] = useState<any | null>(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Bulk approval
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  // Roster inspection drawer
  const [inspectingSubject, setInspectingSubject] = useState<any | null>(null);
  const [inspectRoster, setInspectRoster] = useState<any[]>([]);
  const [isInspectLoading, setIsInspectLoading] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [selectedYearId]);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const data = await examinationService.getTeacherWorkload(undefined, selectedYearId);
      setTasks(data);
    } catch (err: any) {
      console.error('Failed to fetch marks tasks:', err);
      toast.error('Failed to load marks review workload');
    } finally {
      setIsLoading(false);
    }
  };

  const isApprovable = (t: any) =>
    t.status === 'submitted' || (t.status === 'in_progress' && t.entered_count > 0);

  const handleApprove = async (task: any) => {
    if (task.status !== 'submitted') {
      const ok = window.confirm(
        `${task.subject_name} (Class ${task.class_name}) was never formally submitted by its teacher.\n` +
        `${task.entered_count} of ${task.total_students} candidates have marks. Approve it anyway?`
      );
      if (!ok) return;
    }

    try {
      await examinationService.approveMarks(task.exam_id, task.subject_id, user?.id);
      toast.success(`Marks approved for ${task.subject_name} (${task.class_name}).`);
      fetchTasks();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve marks');
    }
  };

  const handleBulkApprove = async () => {
    const targets = filteredTasks.filter(isApprovable);
    if (targets.length === 0) {
      toast.error('Nothing in the current filter is ready to approve.');
      return;
    }

    const unsubmitted = targets.filter(t => t.status !== 'submitted').length;
    const partial = targets.filter(t => t.entered_count < t.total_students).length;

    const ok = window.confirm(
      `Approve ${targets.length} subject stream(s)?\n\n` +
      `• ${unsubmitted} were entered but not formally submitted by a teacher\n` +
      `• ${partial} still have missing candidate scores\n\n` +
      `Approved streams become immediately ready for result processing.`
    );
    if (!ok) return;

    setIsBulkApproving(true);
    try {
      const { approved, failed } = await examinationService.approveMarksBulk(
        targets.map(t => ({ examId: t.exam_id, subjectId: t.subject_id })),
        user?.id
      );

      if (failed.length > 0) {
        toast.error(`Approved ${approved}, but ${failed.length} failed: ${failed[0].message}`);
      } else {
        toast.success(`Approved ${approved} subject stream(s). Ready for Result Processing.`);
      }
      fetchTasks();
    } catch (err: any) {
      toast.error(err.message || 'Bulk approval failed');
    } finally {
      setIsBulkApproving(false);
    }
  };

  const handleOpenReturnModal = (task: any) => {
    setReturnModalTarget(task);
    setReturnReason('');
  };

  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnModalTarget) return;
    if (!returnReason.trim()) {
      toast.error('Please specify a clear reason for returning the marks.');
      return;
    }

    setIsReturning(true);
    try {
      await examinationService.returnMarksForCorrection(
        returnModalTarget.exam_id,
        returnModalTarget.subject_id,
        returnReason.trim(),
        user?.id
      );

      toast.success(`Marks for ${returnModalTarget.subject_name} sent back for teacher correction.`);
      setReturnModalTarget(null);
      fetchTasks();
    } catch (err: any) {
      toast.error(err.message || 'Failed to return marks');
    } finally {
      setIsReturning(false);
    }
  };

  const handleLockMarks = async (task: any) => {
    if (!window.confirm(`Lock marks for ${task.subject_name} (${task.class_name})? Teachers will no longer be able to modify these scores.`)) {
      return;
    }

    try {
      await examinationService.lockMarks(task.exam_id, task.subject_id, user?.id, 'Locked by Examination Controller');
      toast.success(`Marks locked for ${task.subject_name}.`);
      fetchTasks();
    } catch (err: any) {
      toast.error(err.message || 'Failed to lock marks');
    }
  };

  const handleOpenUnlockModal = (task: any) => {
    setUnlockModalTarget(task);
    setUnlockReason('');
  };

  const handleConfirmUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockModalTarget) return;
    if (!unlockReason.trim()) {
      toast.error('Please specify a valid audit reason to unlock marks.');
      return;
    }

    setIsUnlocking(true);
    try {
      await examinationService.unlockMarks(
        unlockModalTarget.exam_id,
        unlockModalTarget.subject_id,
        unlockReason.trim(),
        user?.id
      );

      toast.success(`Marks unlocked for ${unlockModalTarget.subject_name}.`);
      setUnlockModalTarget(null);
      fetchTasks();
    } catch (err: any) {
      toast.error(err.message || 'Failed to unlock marks');
    } finally {
      setIsUnlocking(false);
    }
  };

  // Inspect student roster for an exam subject
  const handleInspect = async (task: any) => {
    setInspectingSubject(task);
    setIsInspectLoading(true);
    try {
      const { roster } = await examinationService.getStudentRosterWithMarks(
        task.exam_id,
        task.subject_id,
        task.class_id
      );
      setInspectRoster(roster);
    } catch (err: any) {
      toast.error('Failed to load student score list');
    } finally {
      setIsInspectLoading(false);
    }
  };

  // Jump to Marks Entry directly
  const handleOpenMarksEntry = (task: any) => {
    onNavigateTab('marks-entry', {
      examId: task.exam_id,
      subjectId: task.subject_id,
      classId: task.class_id
    });
  };

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchExam = selectedExamId === 'all' || t.exam_id === selectedExamId;
      const matchClass = selectedClassId === 'all' || t.class_id === selectedClassId;
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchSearch = !searchQuery.trim() ||
        t.subject_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.class_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.teacher_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.exam_name?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchExam && matchClass && matchStatus && matchSearch;
    });
  }, [tasks, selectedExamId, selectedClassId, statusFilter, searchQuery]);

  const approvableCount = filteredTasks.filter(isApprovable).length;
  const submittedCount = tasks.filter(t => t.status === 'submitted').length;
  const approvedCount = tasks.filter(t => t.status === 'approved' || t.status === 'locked').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const draftCount = tasks.filter(t => t.status === 'draft').length;
  const pendingCorrectionCount = tasks.filter(t => t.status === 'returned').length;

  return (
    <div className="space-y-3.5">
      {/* 1. Compact Executive KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div 
          onClick={() => setStatusFilter(statusFilter === 'submitted' ? 'all' : 'submitted')}
          className={cn(
            "p-3 bg-white border rounded-xl shadow-2xs cursor-pointer transition-all hover:shadow-xs",
            statusFilter === 'submitted' 
              ? "border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50/20" 
              : "border-slate-200/80 hover:border-slate-300"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Awaiting Verification
            </span>
            <div className="w-6 h-6 bg-indigo-50 border border-indigo-200/60 rounded-lg flex items-center justify-center text-indigo-600">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900 font-mono tracking-tight">{submittedCount}</span>
            <span className="text-[10.5px] font-bold text-indigo-600">Submitted</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Pending admin approval</p>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')}
          className={cn(
            "p-3 bg-white border rounded-xl shadow-2xs cursor-pointer transition-all hover:shadow-xs",
            statusFilter === 'in_progress' 
              ? "border-amber-500 ring-2 ring-amber-200 bg-amber-50/20" 
              : "border-slate-200/80 hover:border-slate-300"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              In Progress
            </span>
            <div className="w-6 h-6 bg-amber-50 border border-amber-200/60 rounded-lg flex items-center justify-center text-amber-600">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900 font-mono tracking-tight">{inProgressCount}</span>
            <span className="text-[10.5px] font-bold text-amber-600">Active Streams</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Faculty entry ongoing</p>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'approved' ? 'all' : 'approved')}
          className={cn(
            "p-3 bg-white border rounded-xl shadow-2xs cursor-pointer transition-all hover:shadow-xs",
            statusFilter === 'approved' 
              ? "border-emerald-500 ring-2 ring-emerald-200 bg-emerald-50/20" 
              : "border-slate-200/80 hover:border-slate-300"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Approved &amp; Locked
            </span>
            <div className="w-6 h-6 bg-emerald-50 border border-emerald-200/60 rounded-lg flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-black text-emerald-700 font-mono tracking-tight">{approvedCount}</span>
            <span className="text-[10.5px] font-bold text-emerald-600">Ready</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Eligible for result engine</p>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'returned' ? 'all' : 'returned')}
          className={cn(
            "p-3 bg-white border rounded-xl shadow-2xs cursor-pointer transition-all hover:shadow-xs",
            statusFilter === 'returned' 
              ? "border-rose-500 ring-2 ring-rose-200 bg-rose-50/20" 
              : "border-slate-200/80 hover:border-slate-300"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Returned (Revision)
            </span>
            <div className="w-6 h-6 bg-rose-50 border border-rose-200/60 rounded-lg flex items-center justify-center text-rose-600">
              <RotateCcw className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-black text-rose-700 font-mono tracking-tight">{pendingCorrectionCount}</span>
            <span className="text-[10.5px] font-bold text-rose-600">Revision</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Returned to faculty for edit</p>
        </div>
      </div>

      {/* 2. Unified Filter Toolbar & Status Tabs */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5">
        {/* Top Filter Chips */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5 no-scrollbar">
          <div className="flex items-center gap-1.5">
            {[
              { id: 'all', label: 'All Streams', count: tasks.length },
              { id: 'submitted', label: 'Awaiting Verification', count: submittedCount },
              { id: 'in_progress', label: 'In Progress', count: inProgressCount },
              { id: 'approved', label: 'Approved', count: tasks.filter(t => t.status === 'approved').length },
              { id: 'locked', label: 'Locked', count: tasks.filter(t => t.status === 'locked').length },
              { id: 'returned', label: 'Returned', count: pendingCorrectionCount },
              { id: 'draft', label: 'Draft', count: draftCount },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer",
                  statusFilter === tab.id
                    ? "bg-slate-900 text-white font-bold shadow-xs"
                    : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/80"
                )}
              >
                <span>{tab.label}</span>
                <span className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                  statusFilter === tab.id ? "bg-white/20 text-white" : "bg-white text-slate-700 border border-slate-200/80"
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500 font-medium whitespace-nowrap hidden lg:block">
            Showing <strong className="text-slate-900 font-bold">{filteredTasks.length}</strong> of {tasks.length}
          </div>
        </div>

        {/* Inputs & Actions Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 max-w-2xl">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search exam, subject, teacher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 h-[34px] font-medium"
              />
              {searchQuery && (
                <button 
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Exam Filter */}
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="text-xs bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl px-2.5 h-[34px] font-medium text-slate-800 outline-none cursor-pointer transition-colors focus:border-blue-500 focus:bg-white truncate"
            >
              <option value="all">All Exam Terms</option>
              {exams.map(e => (
                <option key={e.id} value={e.id}>{e.exam_name} (Class {e.class})</option>
              ))}
            </select>

            {/* Class Filter */}
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-xs bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl px-2.5 h-[34px] font-medium text-slate-800 outline-none cursor-pointer transition-colors focus:border-blue-500 focus:bg-white"
            >
              <option value="all">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>Class {c.class_name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {can('results.publish') && approvableCount > 0 && (
              <button
                type="button"
                onClick={handleBulkApprove}
                disabled={isBulkApproving}
                className="px-3.5 h-[34px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-60 shrink-0"
                title="Approve every stream with marks in the current filter"
              >
                {isBulkApproving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Approving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve {approvableCount} Filtered</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={fetchTasks}
              className="px-3 h-[34px] bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200/60 shadow-2xs"
              title="Refresh workload data"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Review Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs table-auto">
            <thead>
              <tr className="bg-slate-100/75 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <th className="py-2.5 px-3.5">Exam Term &amp; Class</th>
                <th className="py-2.5 px-3">Subject</th>
                <th className="py-2.5 px-3">Assigned Teacher</th>
                <th className="py-2.5 px-3 text-center">Marks Entered</th>
                <th className="py-2.5 px-3 text-center">Workflow Status</th>
                <th className="py-2.5 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-400">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto text-blue-600 mb-2" />
                    <p className="text-xs font-bold text-slate-600">Loading marks verification board...</p>
                  </td>
                </tr>
              ) : filteredTasks.length > 0 ? (
                filteredTasks.map(t => {
                  const isFullyEntered = t.total_students > 0 && t.entered_count >= t.total_students;
                  const isLocked = t.status === 'locked' || t.locked;
                  const isApproved = t.status === 'approved';
                  const badge = getWorkflowBadge(t.status);
                  const progressPct = t.total_students > 0 ? Math.round((t.entered_count / t.total_students) * 100) : 0;

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Exam Term & Class */}
                      <td className="py-2.5 px-3.5">
                        <p className="font-bold text-slate-900 text-xs group-hover:text-blue-600 transition-colors">{t.exam_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded-md font-semibold text-[10px] border border-slate-200/60">
                            Class {t.class_name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {t.academic_year || '2026-27'}
                          </span>
                        </div>
                      </td>

                      {/* Subject */}
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-slate-900 text-xs">{t.subject_name}</p>
                        <span className="inline-block text-[10px] text-slate-400 font-mono mt-0.5">
                          Max: {t.max_marks} M • Pass: {t.pass_marks} M
                        </span>
                      </td>

                      {/* Assigned Teacher */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border",
                            t.teacher_name && t.teacher_name !== 'Unassigned'
                              ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                              : "bg-slate-100 border-slate-200 text-slate-500"
                          )}>
                            {t.teacher_name && t.teacher_name !== 'Unassigned'
                              ? t.teacher_name.charAt(0).toUpperCase()
                              : '?'}
                          </div>
                          <div className="truncate max-w-[150px]">
                            <p className={cn(
                              "font-semibold text-xs truncate",
                              t.teacher_name && t.teacher_name !== 'Unassigned' ? "text-slate-800" : "text-amber-600"
                            )}>
                              {t.teacher_name || 'Unassigned'}
                            </p>
                            {t.teacher_email ? (
                              <span className="text-[10px] text-slate-400 block truncate">{t.teacher_email}</span>
                            ) : (
                              <span className="text-[9px] text-slate-400 block font-normal">Faculty Evaluator</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Marks Entered Progress */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={cn(
                            "font-mono font-bold text-xs tabular-nums",
                            isFullyEntered ? "text-emerald-700" : t.entered_count > 0 ? "text-amber-700" : "text-slate-400"
                          )}>
                            {t.entered_count} / {t.total_students}
                          </span>
                          <div className="w-14 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden border border-slate-200/60">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all",
                                isFullyEntered ? "bg-emerald-500" : "bg-amber-500"
                              )}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-400 mt-0.5">
                            {isFullyEntered ? '100% Complete' : `${t.total_students - t.entered_count} Missing`}
                          </span>
                        </div>
                      </td>

                      {/* Workflow Status */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border shadow-2xs",
                          badge.color
                        )}>
                          {badge.label}
                        </span>
                        {t.reopen_reason && (
                          <span className="text-[10px] text-rose-600 block mt-0.5 truncate max-w-[140px] mx-auto font-medium" title={t.reopen_reason}>
                            Note: {t.reopen_reason}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1 shrink-0">
                          {/* Inspect Roster */}
                          <button
                            type="button"
                            onClick={() => handleInspect(t)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-200/60"
                            title="Inspect Student Roster"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Jump to Marks Entry */}
                          <button
                            type="button"
                            onClick={() => handleOpenMarksEntry(t)}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100/80 text-blue-700 border border-blue-200/60 rounded-lg transition-colors cursor-pointer"
                            title="Open Marks Entry Grid"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Approve Marks */}
                          {can('results.publish') && isApprovable(t) && !isApproved && !isLocked && (
                            <button
                              type="button"
                              onClick={() => handleApprove(t)}
                              title={t.status === 'submitted' ? 'Approve submitted marks' : 'Approve entered marks'}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 shadow-2xs shrink-0",
                                t.status === 'submitted'
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300/80"
                              )}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                          )}

                          {/* Send Back for Correction */}
                          {can('results.publish') && (isApprovable(t) || isApproved) && !isLocked && (
                            <button
                              type="button"
                              onClick={() => handleOpenReturnModal(t)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-lg transition-colors cursor-pointer"
                              title="Send Back for Faculty Revision"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Lock Marks */}
                          {can('results.publish') && isApproved && !isLocked && (
                            <button
                              type="button"
                              onClick={() => handleLockMarks(t)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs shrink-0"
                              title="Lock Marks to Prevent Changes"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>Lock</span>
                            </button>
                          )}

                          {/* Unlock Marks */}
                          {can('results.publish') && isLocked && (
                            <button
                              type="button"
                              onClick={() => handleOpenUnlockModal(t)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                              title="Unlock Protected Marks"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Unlock</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-400">
                    <ShieldCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-700 text-sm">No Marks Tasks Found</p>
                    <p className="text-xs text-slate-400 mt-0.5">No subject marks matched your filter criteria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RETURN FOR CORRECTION MODAL */}
      {returnModalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Return Marks for Correction</h3>
                <p className="text-xs text-slate-500">
                  {returnModalTarget.subject_name} • Class {returnModalTarget.class_name}
                </p>
              </div>
              <button
                onClick={() => setReturnModalTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmReturn} className="space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 font-medium">
                <span className="font-bold block mb-1">Notice to Faculty:</span>
                Returning these marks will reopen the entry form for {returnModalTarget.teacher_name} to adjust scores and resubmit.
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Reason for Return *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Please verify Roll 04 score; marks exceed maximum..."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReturnModalTarget(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReturning}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isReturning ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                  <span>Return to Faculty</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UNLOCK MARKS AUDIT MODAL */}
      {unlockModalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Unlock Subject Marks</h3>
                <p className="text-xs text-slate-500">
                  {unlockModalTarget.subject_name} • Class {unlockModalTarget.class_name}
                </p>
              </div>
              <button
                onClick={() => setUnlockModalTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmUnlock} className="space-y-4 text-xs">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-medium">
                <span className="font-bold block mb-1">Audit Trail Warning:</span>
                Unlocking protected marks allows scores to be modified. This action will be logged in the official audit record.
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Audit Justification *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Scrutiny committee re-evaluation request approved by Principal..."
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUnlockModalTarget(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUnlocking}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isUnlocking ? <Loader2 size={13} className="animate-spin" /> : <Unlock size={13} />}
                  <span>Confirm Unlock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ROSTER INSPECTION DRAWER / MODAL */}
      {inspectingSubject && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md font-bold text-[10px] uppercase">
                    {inspectingSubject.exam_name}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Class {inspectingSubject.class_name}
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  {inspectingSubject.subject_name} • Candidate Marks Roster
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenMarksEntry(inspectingSubject)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 size={12} />
                  <span>Open in Editor</span>
                </button>
                <button
                  onClick={() => setInspectingSubject(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="p-5 overflow-y-auto flex-1 text-xs">
              {isInspectLoading ? (
                <div className="py-16 text-center text-slate-400">
                  <Loader2 className="w-7 h-7 animate-spin mx-auto text-blue-600 mb-2" />
                  <p className="font-bold text-slate-600">Loading candidate marks...</p>
                </div>
              ) : inspectRoster.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-3 rounded-xl">
                    <span>Total Students: <strong className="text-slate-800 font-mono">{inspectRoster.length}</strong></span>
                    <span>Max Marks: <strong className="text-slate-800 font-mono">{inspectingSubject.max_marks}</strong></span>
                    <span>Pass Marks: <strong className="text-slate-800 font-mono">{inspectingSubject.pass_marks}</strong></span>
                  </div>

                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200">
                        <th className="py-2.5 px-3">Roll</th>
                        <th className="py-2.5 px-3">Student Name</th>
                        <th className="py-2.5 px-3 text-center">Attendance</th>
                        <th className="py-2.5 px-3 text-center">Marks Obtained</th>
                        <th className="py-2.5 px-3 text-center">Grade</th>
                        <th className="py-2.5 px-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inspectRoster.map(r => (
                        <tr key={r.student_id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-600">
                            {r.student?.roll_number || '—'}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {r.student?.name}
                            <span className="text-[10px] text-slate-400 block font-normal font-mono">
                              {r.student?.admission_number}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                              r.attendance_status === 'Present' ? "bg-emerald-50 text-emerald-700" :
                              r.attendance_status === 'Absent' ? "bg-rose-50 text-rose-700" :
                              r.attendance_status === 'Medical' ? "bg-blue-50 text-blue-700" :
                              "bg-slate-100 text-slate-600"
                            )}>
                              {r.attendance_status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold">
                            {r.obtained_marks !== null ? (
                              <span className={r.obtained_marks < (inspectingSubject.pass_marks || 7) ? "text-rose-600 font-black" : "text-slate-800"}>
                                {r.obtained_marks}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-normal">Not Entered</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-mono font-bold text-[11px] px-2 py-0.5 bg-slate-100 rounded text-slate-700">
                              {r.grade || '—'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 italic text-[11px]">
                            {r.remarks || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <p className="font-bold text-slate-600">No students found in this roster.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
