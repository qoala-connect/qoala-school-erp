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
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { examinationService, ExamRecord } from '@/services/examinationService';
import { useAuth } from '@/context/AuthContext';

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

  // A stream is approvable once it carries marks. Requiring 'submitted' meant
  // that any subject a teacher had entered but not formally submitted — which
  // is every stream on a board seeded outside the teacher workflow — offered no
  // action at all, and result processing rejects anything not approved/locked.
  const isApprovable = (t: any) =>
    t.status === 'submitted' || (t.status === 'in_progress' && t.entered_count > 0);

  const handleApprove = async (task: any) => {
    if (task.status !== 'submitted') {
      const ok = window.confirm(
        `${task.subject_name} (Class ${task.class_name}) was never formally submitted by its teacher. ` +
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
      `Approve ${targets.length} subject stream(s)?

` +
      `• ${unsubmitted} were never formally submitted by a teacher
` +
      `• ${partial} still have candidates without marks

` +
      `Approved streams become eligible for result processing.`
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
        toast.success(`Approved ${approved} subject stream(s). They are now ready for result processing.`);
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

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchExam = selectedExamId === 'all' || t.exam_id === selectedExamId;
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchSearch = !searchQuery ||
        t.subject_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.class_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.teacher_name?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchExam && matchStatus && matchSearch;
    });
  }, [tasks, selectedExamId, statusFilter, searchQuery]);

  const approvableCount = filteredTasks.filter(isApprovable).length;
  const submittedCount = tasks.filter(t => t.status === 'submitted').length;
  const approvedCount = tasks.filter(t => t.status === 'approved' || t.status === 'locked').length;
  const pendingCorrectionCount = tasks.filter(t => t.status === 'returned').length;

  return (
    <div className="space-y-6">
      {/* KPI Overview Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-indigo-50 border border-indigo-200/70 rounded-2xl">
          <span className="text-[10px] font-bold text-indigo-700 uppercase block">Awaiting Verification</span>
          <span className="text-2xl font-black text-indigo-900 font-mono">{submittedCount}</span>
          <span className="text-[10px] text-indigo-600 block mt-0.5">Submitted by teachers</span>
        </div>
        <div className="p-4 bg-emerald-50 border border-emerald-200/70 rounded-2xl">
          <span className="text-[10px] font-bold text-emerald-700 uppercase block">Approved / Locked</span>
          <span className="text-2xl font-black text-emerald-900 font-mono">{approvedCount}</span>
          <span className="text-[10px] text-emerald-600 block mt-0.5">Ready for result processing</span>
        </div>
        <div className="p-4 bg-rose-50 border border-rose-200/70 rounded-2xl">
          <span className="text-[10px] font-bold text-rose-700 uppercase block">Sent Back (Revision)</span>
          <span className="text-2xl font-black text-rose-900 font-mono">{pendingCorrectionCount}</span>
          <span className="text-[10px] text-rose-600 block mt-0.5">Pending teacher correction</span>
        </div>
        <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-2xl">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Subject Streams</span>
          <span className="text-2xl font-black text-slate-900 font-mono">{tasks.length}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Across all classes</span>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search subject, teacher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Exam Filter */}
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-700"
          >
            <option value="all">All Exam Terms</option>
            {exams.map(e => (
              <option key={e.id} value={e.id}>{e.exam_name} (Class {e.class})</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-700"
          >
            <option value="all">All Workflow Statuses</option>
            <option value="submitted">Submitted for Verification</option>
            <option value="in_progress">In Progress</option>
            <option value="returned">Sent Back for Correction</option>
            <option value="approved">Approved</option>
            <option value="locked">Locked</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {can('results.publish') && approvableCount > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={isBulkApproving}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
              title="Approve every stream matching the current filter"
            >
              {isBulkApproving
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <CheckCircle2 size={13} />}
              Approve {approvableCount} Filtered
            </button>
          )}

          <button
            onClick={fetchTasks}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw size={13} /> Refresh Workload
          </button>
        </div>
      </div>

      {/* Main Review Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200">
              <th className="py-3 px-4">Exam Term &amp; Class</th>
              <th className="py-3 px-4">Subject</th>
              <th className="py-3 px-4">Assigned Teacher</th>
              <th className="py-3 px-4 text-center">Marks Entered</th>
              <th className="py-3 px-4 text-center">Workflow Status</th>
              <th className="py-3 px-4 text-right">Verification Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                  Loading marks submissions...
                </td>
              </tr>
            ) : filteredTasks.length > 0 ? (
              filteredTasks.map(t => {
                const isFullyEntered = t.total_students > 0 && t.entered_count >= t.total_students;
                const isLocked = t.status === 'locked' || t.locked;
                const isApproved = t.status === 'approved';

                return (
                  <tr key={t.id} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {t.exam_name}
                      <span className="text-[11px] text-slate-400 block font-normal">Class {t.class_name} • {t.academic_year}</span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-blue-700">
                      {t.subject_name}
                      <span className="text-[10px] text-slate-400 block font-normal font-mono">Max: {t.max_marks} M</span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      {t.teacher_name}
                      {t.teacher_email && (
                        <span className="text-[10px] text-slate-400 block font-normal">{t.teacher_email}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={cn(
                        "font-mono font-bold text-xs",
                        isFullyEntered ? "text-emerald-700" : "text-amber-700"
                      )}>
                        {t.entered_count} / {t.total_students}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {isFullyEntered ? 'Complete' : `${t.total_students - t.entered_count} Missing`}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase",
                        t.status === 'locked' ? "bg-slate-100 text-slate-800 border border-slate-300" :
                        t.status === 'approved' ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                        t.status === 'submitted' ? "bg-indigo-100 text-indigo-800 border border-indigo-200" :
                        t.status === 'returned' ? "bg-rose-100 text-rose-800 border border-rose-200" :
                        "bg-amber-100 text-amber-800 border border-amber-200"
                      )}>
                        {t.status}
                      </span>
                      {t.reopen_reason && (
                        <span className="text-[10px] text-rose-600 block mt-0.5 truncate max-w-xs mx-auto" title={t.reopen_reason}>
                          Note: {t.reopen_reason}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Inspect Roster */}
                        <button
                          onClick={() => handleInspect(t)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                          title="View Student Marks List"
                        >
                          <Eye size={13} /> Inspect
                        </button>

                        {/* Approve Marks */}
                        {can('results.publish') && isApprovable(t) && (
                          <button
                            onClick={() => handleApprove(t)}
                            title={t.status === 'submitted'
                              ? 'Approve the marks submitted by the teacher'
                              : 'Not submitted by the teacher — approving accepts the entered marks as-is'}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs",
                              t.status === 'submitted'
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300"
                            )}
                          >
                            <CheckCircle2 size={13} />
                            {t.status === 'submitted' ? 'Approve' : 'Approve (unsubmitted)'}
                          </button>
                        )}

                        {/* Send Back for Correction */}
                        {can('results.publish') && (isApprovable(t) || t.status === 'approved') && (
                          <button
                            onClick={() => handleOpenReturnModal(t)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <RotateCcw size={13} /> Send Back
                          </button>
                        )}

                        {/* Lock Marks */}
                        {can('results.publish') && isApproved && !isLocked && (
                          <button
                            onClick={() => handleLockMarks(t)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          >
                            <Lock size={13} /> Lock
                          </button>
                        )}

                        {/* Unlock Marks */}
                        {can('results.publish') && isLocked && (
                          <button
                            onClick={() => handleOpenUnlockModal(t)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Unlock size={13} /> Unlock
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <ShieldCheck size={28} className="mx-auto text-slate-300 mb-1.5" />
                  <p className="font-bold text-slate-600 text-xs">No Marks Tasks Found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">No subject marks matched your search filter.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
                <span className="font-bold block mb-1">Notice to Teacher:</span>
                Returning these marks will reopen the entry form for {returnModalTarget.teacher_name} to make corrections and resubmit.
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

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReturnModalTarget(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReturning}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isReturning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw size={14} />}
                  Confirm Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UNLOCK MARKS MODAL */}
      {unlockModalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Unlock Examination Marks</h3>
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
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800">
                <span className="font-bold block mb-1">Administrative Audit Notice:</span>
                Unlocking locked marks will be permanently logged in the audit trail with your user account.
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Audit Reason for Unlock *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Authorized correction of re-evaluation score..."
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUnlockModalTarget(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUnlocking}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isUnlocking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlock size={14} />}
                  Authorize Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT ROSTER DRAWER */}
      {inspectingSubject && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-800 rounded-full font-black text-[10px] uppercase">
                  Class {inspectingSubject.class_name} • Max {inspectingSubject.max_marks} M
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Candidate Score Audit: {inspectingSubject.subject_name}
                </h3>
                <p className="text-xs text-slate-500">
                  Evaluated by {inspectingSubject.teacher_name} for {inspectingSubject.exam_name}
                </p>
              </div>
              <button
                onClick={() => setInspectingSubject(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Inspect Table */}
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200">
                    <th className="py-2.5 px-4 text-center">Roll No</th>
                    <th className="py-2.5 px-4">Student Name</th>
                    <th className="py-2.5 px-4 text-center">Attendance</th>
                    <th className="py-2.5 px-4 text-center">Obtained Marks</th>
                    <th className="py-2.5 px-4 text-center">CBSE Grade</th>
                    <th className="py-2.5 px-4 text-right">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {isInspectLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-1" />
                        Loading candidate marks...
                      </td>
                    </tr>
                  ) : inspectRoster.length > 0 ? (
                    inspectRoster.map(r => (
                      <tr key={r.student_id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-900">
                          {r.student?.roll_number || '—'}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          {r.student?.name}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                            r.attendance_status === 'Present' ? "bg-emerald-50 text-emerald-700" :
                            r.attendance_status === 'Absent' ? "bg-rose-50 text-rose-700" :
                            "bg-amber-50 text-amber-700"
                          )}>
                            {r.attendance_status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-900">
                          {r.obtained_marks !== null && r.obtained_marks !== undefined ? r.obtained_marks : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className="font-bold text-blue-700 font-mono text-[11px]">
                            {r.grade || '—'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-400 font-normal">
                          {r.remarks || '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                        No student marks records entered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setInspectingSubject(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
