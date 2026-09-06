import React, { useState, useMemo, useEffect } from 'react';
import { 
  ClipboardList, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  UserCheck, 
  ArrowRight, 
  Edit3, 
  Send, 
  ShieldCheck, 
  RotateCcw, 
  Users, 
  BookOpen, 
  GraduationCap, 
  Sparkles, 
  Lock, 
  Calendar, 
  X,
  AlertTriangle,
  FileCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getWorkflowBadge, formatClassDisplay } from '@/lib/cbseExamUtils';
import { examinationService } from '@/services/examinationService';

interface TeacherTasksViewProps {
  tasks: any[];
  teachers: Array<{ id: string; name: string; email?: string; designation?: string }>;
  currentUserRole?: string;
  currentUserId?: string;
  onOpenMarksEntry: (examId: string, subjectId: string, classId?: string) => void;
  onRefreshTasks?: () => Promise<void>;
}

export default function TeacherTasksView({
  tasks,
  teachers,
  currentUserRole,
  currentUserId,
  onOpenMarksEntry,
  onRefreshTasks
}: TeacherTasksViewProps) {
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Reopen modal state
  const [reopenModalTask, setReopenModalTask] = useState<any | null>(null);
  const [reopenReason, setReopenReason] = useState<string>('');
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  // Reassign modal state
  const [assignModalTask, setAssignModalTask] = useState<any | null>(null);
  const [selectedNewTeacherId, setSelectedNewTeacherId] = useState<string>('');

  const isAdminOrController = currentUserRole === 'admin' || 
    currentUserRole === 'super_admin' || 
    currentUserRole === 'exam_controller' || 
    currentUserRole === 'principal';

  // Auto-detect logged-in faculty
  useEffect(() => {
    if (!isAdminOrController && currentUserId) {
      const matchTeacher = teachers.find(t => t.id === currentUserId || (t as any).user_id === currentUserId);
      if (matchTeacher) {
        setSelectedTeacherFilter(matchTeacher.id);
      }
    }
  }, [isAdminOrController, currentUserId, teachers]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchTeacher = selectedTeacherFilter === 'all' || t.teacher_id === selectedTeacherFilter;
      const matchStatus = selectedStatusFilter === 'all' || t.status === selectedStatusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        (t.exam_name || '').toLowerCase().includes(q) ||
        (t.subject_name || '').toLowerCase().includes(q) ||
        (t.teacher_name || '').toLowerCase().includes(q) ||
        (t.class_name || '').toLowerCase().includes(q);
      return matchTeacher && matchStatus && matchSearch;
    });
  }, [tasks, selectedTeacherFilter, selectedStatusFilter, searchQuery]);

  // Metric summaries
  const taskStats = useMemo(() => {
    const total = tasks.length;
    const submitted = tasks.filter(t => t.status === 'submitted').length;
    const returned = tasks.filter(t => t.status === 'returned').length;
    const approved = tasks.filter(t => t.status === 'approved' || t.status === 'published').length;
    const locked = tasks.filter(t => t.status === 'locked').length;
    const pending = tasks.filter(t => t.status === 'draft' || t.status === 'in_progress').length;

    return { total, submitted, returned, approved, locked, pending };
  }, [tasks]);

  // Handle Return / Reopen for Correction
  const handleConfirmReturn = async () => {
    if (!reopenModalTask || !reopenReason.trim()) {
      toast.error('Please provide a reason for returning marks.');
      return;
    }

    setIsProcessingAction(true);
    try {
      await examinationService.returnMarksForCorrection(
        reopenModalTask.exam_id,
        reopenModalTask.subject_id,
        reopenReason.trim(),
        currentUserId
      );

      toast.success('Marks returned to evaluator teacher for correction.');
      setReopenModalTask(null);
      setReopenReason('');
      onRefreshTasks?.();
    } catch (err: any) {
      toast.error('Failed to return marks: ' + (err.message || 'Error'));
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle Approve Task directly by Admin
  const handleApprove = async (task: any) => {
    try {
      await examinationService.approveMarks(task.exam_id, task.subject_id, currentUserId);
      toast.success(`Marks for ${task.subject_name} approved successfully.`);
      onRefreshTasks?.();
    } catch (err: any) {
      toast.error('Failed to approve marks: ' + (err.message || 'Error'));
    }
  };

  // Handle Reassign Teacher Evaluator
  const handleConfirmReassign = async () => {
    if (!assignModalTask || !selectedNewTeacherId) return;

    setIsProcessingAction(true);
    try {
      await examinationService.saveExamSubject({
        id: assignModalTask.id,
        exam_id: assignModalTask.exam_id,
        subject_id: assignModalTask.subject_id,
        subject_name: assignModalTask.subject_name,
        max_marks: assignModalTask.max_marks,
        pass_marks: assignModalTask.pass_marks,
        teacher_id: selectedNewTeacherId
      });

      toast.success('Evaluator teacher reassigned successfully.');
      setAssignModalTask(null);
      setSelectedNewTeacherId('');
      onRefreshTasks?.();
    } catch (err: any) {
      toast.error('Failed to reassign evaluator: ' + (err.message || 'Error'));
    } finally {
      setIsProcessingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Total Tasks</span>
            <ClipboardList size={14} className="text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{taskStats.total}</span>
            <span className="text-[10px] font-bold text-slate-400">Evaluation Workloads</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">In Progress</span>
            <Clock size={14} className="text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-600">{taskStats.pending}</span>
            <span className="text-[10px] font-bold text-amber-600">Drafting</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Submitted</span>
            <Send size={14} className="text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-blue-600">{taskStats.submitted}</span>
            <span className="text-[10px] font-bold text-blue-600">Review Queue</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Returned</span>
            <AlertTriangle size={14} className="text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-rose-600">{taskStats.returned}</span>
            <span className="text-[10px] font-bold text-rose-600">Needs Fix</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Approved</span>
            <CheckCircle2 size={14} className="text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-600">{taskStats.approved}</span>
            <span className="text-[10px] font-bold text-emerald-600">Verified</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Locked</span>
            <Lock size={14} className="text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-purple-600">{taskStats.locked}</span>
            <span className="text-[10px] font-bold text-purple-600">Protected</span>
          </div>
        </div>
      </div>

      {/* 2. Search and Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Faculty Filter (Admin only) */}
          {isAdminOrController && (
            <div className="min-w-[180px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                Faculty Evaluator
              </label>
              <select
                value={selectedTeacherFilter}
                onChange={e => setSelectedTeacherFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500"
              >
                <option value="all">All Faculty Workload</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.designation || 'Teacher'})</option>
                ))}
              </select>
            </div>
          )}

          {/* Status Filter */}
          <div className="min-w-[160px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
              Workflow Status
            </label>
            <select
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft / In Progress</option>
              <option value="submitted">Submitted for Review</option>
              <option value="returned">Returned for Correction</option>
              <option value="approved">Approved</option>
              <option value="locked">Locked</option>
            </select>
          </div>

          {/* Search box */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
              Search Tasks
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Subject, exam, teacher, class..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:bg-white focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <span className="text-xs text-slate-400 font-medium">
          Showing {filteredTasks.length} assigned task(s)
        </span>
      </div>

      {/* 3. Task Cards Grid */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center text-slate-400 space-y-3">
          <ClipboardList size={36} className="mx-auto text-slate-300" />
          <h4 className="text-base font-extrabold text-slate-800">No Examination Tasks Found</h4>
          <p className="text-xs max-w-md mx-auto text-slate-500">
            There are no examination evaluation workloads assigned matching the current filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map(task => {
            const badge = getWorkflowBadge(task.status);
            const pctEntered = task.total_students > 0 
              ? Math.round((task.entered_count / task.total_students) * 100) 
              : 0;

            const isReturned = task.status === 'returned';
            const isApproved = task.status === 'approved' || task.status === 'published';
            const isLocked = task.status === 'locked' || task.locked;
            const isSubmitted = task.status === 'submitted';

            return (
              <div
                key={task.id}
                className={cn(
                  "bg-white border rounded-3xl p-5 shadow-2xs flex flex-col justify-between space-y-4 hover:shadow-xs transition-all relative overflow-hidden",
                  isReturned ? "border-rose-300 ring-2 ring-rose-100" : "border-slate-200/80"
                )}
              >
                {/* Top Badge and Term info */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border", badge.color)}>
                      {badge.label}
                    </span>

                    {task.deadline && (
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 font-mono">
                        <Clock size={11} /> Due {task.deadline}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[11px] font-black text-blue-600 uppercase tracking-wider block">
                      {task.short_name || task.exam_name} ({task.academic_year || '2026-27'})
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                      {task.subject_name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                      <span>{formatClassDisplay(task.class_name)}</span>
                      <span>•</span>
                      <span>Max: {task.max_marks} | Pass: {task.pass_marks}</span>
                    </div>
                  </div>
                </div>

                {/* Returned for correction notice (if applicable) */}
                {isReturned && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1">
                    <span className="font-bold flex items-center gap-1 text-rose-900">
                      <AlertTriangle size={13} className="text-rose-600" /> Action Required
                    </span>
                    <p className="text-[11px] text-rose-700 font-medium">
                      {task.reopen_reason || 'Please verify and correct entered marks.'}
                    </p>
                  </div>
                )}

                {/* Progress bar */}
                <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">Marks Entry Progress</span>
                    <span className="font-mono font-bold text-slate-900">
                      {task.entered_count} / {task.total_students} ({pctEntered}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        pctEntered === 100 ? "bg-emerald-500" : isReturned ? "bg-rose-500" : "bg-blue-600"
                      )}
                      style={{ width: `${pctEntered}%` }}
                    />
                  </div>
                </div>

                {/* Evaluator Faculty Tag */}
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                  <span className="flex items-center gap-1.5 truncate">
                    <UserCheck size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">Evaluator: <strong>{task.teacher_name}</strong></span>
                  </span>

                  {isAdminOrController && (
                    <button
                      onClick={() => {
                        setAssignModalTask(task);
                        setSelectedNewTeacherId(task.teacher_id || '');
                      }}
                      className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer shrink-0 ml-2"
                    >
                      Reassign
                    </button>
                  )}
                </div>

                {/* Bottom Action Ribbon */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => onOpenMarksEntry(task.exam_id, task.subject_id, task.class_id)}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-xs",
                      isReturned
                        ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20"
                        : isApproved || isLocked
                        ? "bg-slate-100 hover:bg-slate-200 text-slate-800"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20"
                    )}
                  >
                    <Edit3 size={13} />
                    <span>
                      {isReturned ? 'Correct Marks' : isLocked || isApproved ? 'View Gradebook' : 'Enter Marks'}
                    </span>
                  </button>

                  {/* Admin inline quick actions */}
                  {isAdminOrController && isSubmitted && (
                    <>
                      <button
                        onClick={() => handleApprove(task)}
                        title="Approve Submitted Marks"
                        className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        <CheckCircle2 size={15} />
                      </button>
                      <button
                        onClick={() => {
                          setReopenModalTask(task);
                          setReopenReason('');
                        }}
                        title="Return for Correction"
                        className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        <RotateCcw size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Return for Correction Modal */}
      {reopenModalTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Return Marks for Correction</h3>
                  <p className="text-xs text-slate-500">
                    {reopenModalTask.exam_name} • {reopenModalTask.subject_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReopenModalTask(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Correction Reason / Feedback for Teacher <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={reopenReason}
                onChange={e => setReopenReason(e.target.value)}
                placeholder="e.g. Please verify Roll No. 18. Entered mark appears incorrect or missing."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:bg-white focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReopenModalTask(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingAction || !reopenReason.trim()}
                onClick={handleConfirmReturn}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-40 cursor-pointer"
              >
                {isProcessingAction ? 'Returning...' : 'Return to Teacher'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Reassign Evaluator Teacher Modal */}
      {assignModalTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <UserCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Reassign Evaluator Teacher</h3>
                  <p className="text-xs text-slate-500">
                    {assignModalTask.exam_name} • {assignModalTask.subject_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssignModalTask(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Select New Evaluator Faculty
              </label>
              <select
                value={selectedNewTeacherId}
                onChange={e => setSelectedNewTeacherId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500"
              >
                <option value="">Select Faculty...</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.designation || 'Teacher'})</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssignModalTask(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingAction || !selectedNewTeacherId}
                onClick={handleConfirmReassign}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-40 cursor-pointer"
              >
                {isProcessingAction ? 'Saving...' : 'Assign Evaluator'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
