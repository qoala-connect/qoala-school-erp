import React, { useState, useMemo } from 'react';
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
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TeacherExamTask, MarksWorkflowStatus, getWorkflowBadge, formatClassDisplay } from '@/lib/cbseExamUtils';

interface TeacherTasksViewProps {
  tasks: TeacherExamTask[];
  teachers: Array<{ id: string; name: string; email?: string; designation?: string }>;
  currentUserRole?: string;
  currentUserId?: string;
  onOpenMarksEntry: (examId: string, subjectId: string, className: string) => void;
  onSubmitTask: (taskId: string) => Promise<void>;
  onVerifyTask: (taskId: string) => Promise<void>;
  onReopenTask: (taskId: string, reason: string) => Promise<void>;
  onAssignTeacher: (taskId: string, teacherId: string, teacherName: string) => Promise<void>;
}

export default function TeacherTasksView({
  tasks,
  teachers,
  currentUserRole,
  currentUserId,
  onOpenMarksEntry,
  onSubmitTask,
  onVerifyTask,
  onReopenTask,
  onAssignTeacher
}: TeacherTasksViewProps) {
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Reopen modal state
  const [reopenModalTask, setReopenModalTask] = useState<TeacherExamTask | null>(null);
  const [reopenReason, setReopenReason] = useState<string>('');

  // Assign modal state
  const [assignModalTask, setAssignModalTask] = useState<TeacherExamTask | null>(null);
  const [selectedNewTeacherId, setSelectedNewTeacherId] = useState<string>('');

  const isAdminOrController = currentUserRole === 'admin' || 
    currentUserRole === 'super_admin' || 
    currentUserRole === 'exam_controller' || 
    currentUserRole === 'principal';

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchTeacher = selectedTeacherFilter === 'all' || t.teacher_id === selectedTeacherFilter;
      const matchStatus = selectedStatusFilter === 'all' || t.status === selectedStatusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        t.exam_name.toLowerCase().includes(q) ||
        t.subject_name.toLowerCase().includes(q) ||
        t.teacher_name.toLowerCase().includes(q) ||
        t.class_name.toLowerCase().includes(q);
      return matchTeacher && matchStatus && matchSearch;
    });
  }, [tasks, selectedTeacherFilter, selectedStatusFilter, searchQuery]);

  // Metric summaries
  const taskStats = useMemo(() => {
    const total = tasks.length;
    const submitted = tasks.filter(t => t.status === 'submitted').length;
    const verified = tasks.filter(t => t.status === 'verified' || t.status === 'approved' || t.status === 'published').length;
    const pending = tasks.filter(t => t.status === 'draft' || t.status === 'in_progress').length;

    return { total, submitted, verified, pending };
  }, [tasks]);

  const handleConfirmReopen = async () => {
    if (!reopenModalTask) return;
    if (!reopenReason.trim()) {
      toast.error('Please specify a reason for reopening this assessment.');
      return;
    }

    await onReopenTask(reopenModalTask.id, reopenReason);
    setReopenModalTask(null);
    setReopenReason('');
  };

  const handleConfirmAssign = async () => {
    if (!assignModalTask || !selectedNewTeacherId) return;
    const teacherObj = teachers.find(t => t.id === selectedNewTeacherId);
    await onAssignTeacher(assignModalTask.id, selectedNewTeacherId, teacherObj?.name || 'Assigned Teacher');
    setAssignModalTask(null);
    setSelectedNewTeacherId('');
  };

  return (
    <div className="space-y-5">
      {/* 1. Header KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Assigned Tasks', value: taskStats.total, desc: 'Subject-class evaluation allocations', color: 'bg-violet-50 border-violet-100 text-violet-700', icon: ClipboardList },
          { label: 'Marks Pending', value: taskStats.pending, desc: 'Awaiting faculty marks entry', color: 'bg-amber-50 border-amber-100 text-amber-700', icon: Clock },
          { label: 'Submitted for Review', value: taskStats.submitted, desc: 'Ready for coordinator audit', color: 'bg-blue-50 border-blue-100 text-blue-700', icon: Send },
          { label: 'Verified & Approved', value: taskStats.verified, desc: 'Locked and cleared for publishing', color: 'bg-emerald-50 border-emerald-100 text-emerald-700', icon: ShieldCheck }
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200/60 shadow-2xs rounded-2xl p-4 flex flex-col justify-between min-h-[92px]">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{stat.label}</span>
              <div className={cn("p-1.5 rounded-lg border", stat.color)}>
                <stat.icon size={14} />
              </div>
            </div>
            <div className="mt-1">
              <h3 className="text-xl font-display font-extrabold text-slate-900 leading-none">{stat.value}</h3>
              <p className="text-[9px] text-slate-400 font-semibold mt-1">{stat.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Filter & Search Bar */}
      <div className="bg-white rounded-[20px] border border-slate-200/60 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Teacher selector (for Admin or faculty) */}
          <div className="flex flex-col min-w-[170px]">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Faculty Filter</span>
            <select 
              value={selectedTeacherFilter}
              onChange={(e) => setSelectedTeacherFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-700 outline-none h-[36px] cursor-pointer focus:border-violet-500 focus:bg-white"
            >
              <option value="all">All Evaluators ({teachers.length})</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Workflow Status Filter */}
          <div className="flex flex-col min-w-[150px]">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Workflow Status</span>
            <select 
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-700 outline-none h-[36px] cursor-pointer focus:border-violet-500 focus:bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="in_progress">In Progress</option>
              <option value="submitted">Submitted</option>
              <option value="verified">Verified</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="flex flex-col min-w-[180px]">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Search Tasks</span>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Subject, exam, teacher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 pl-8 pr-3 text-xs text-slate-800 outline-none h-[36px] focus:border-violet-500 focus:bg-white"
              />
            </div>
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-400">
          Showing <strong className="text-slate-800">{filteredTasks.length}</strong> of {tasks.length} tasks
        </div>
      </div>

      {/* 3. Tasks Cards Grid */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white border border-slate-200/60 rounded-[22px] p-16 text-center shadow-2xs">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-extrabold text-slate-800">No Examination Tasks Found</h4>
          <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">
            There are currently no active teacher examination assignments matching the selected filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map(task => {
            const badge = getWorkflowBadge(task.status);
            const isCompleted = task.status === 'verified' || task.status === 'approved' || task.status === 'published';
            const progressPct = task.total_students > 0 ? Math.round((task.entered_count / task.total_students) * 100) : 0;

            return (
              <div 
                key={task.id}
                className="bg-white border border-slate-200/60 shadow-2xs hover:shadow-xs transition-all rounded-[22px] p-5 flex flex-col justify-between space-y-4"
              >
                {/* Top Title & Badge */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-violet-50 text-violet-700 border border-violet-100">
                      {formatClassDisplay(task.class_name)} - Sec {task.section || 'A'}
                    </span>
                    <span className={cn("px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider border", badge.color)}>
                      {badge.label}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-black text-slate-900 leading-snug">{task.subject_name}</h4>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">{task.exam_name}</p>
                  </div>
                </div>

                {/* Teacher Evaluator & Progress */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <UserCheck size={13} className="text-violet-600" />
                      <span className="font-bold text-slate-800">{task.teacher_name || 'Unassigned'}</span>
                    </div>
                    {isAdminOrController && (
                      <button
                        onClick={() => {
                          setAssignModalTask(task);
                          setSelectedNewTeacherId(task.teacher_id || '');
                        }}
                        className="text-[10px] font-bold text-violet-600 hover:underline cursor-pointer"
                      >
                        Reassign
                      </button>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                      <span>Roster Marks Completed</span>
                      <span className="font-mono text-slate-700 font-bold">{task.entered_count} / {task.total_students} ({progressPct}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          isCompleted ? "bg-emerald-500" : progressPct > 50 ? "bg-violet-600" : "bg-amber-500"
                        )}
                        style={{ width: `${Math.min(100, Math.max(5, progressPct))}%` }}
                      />
                    </div>
                  </div>

                  {task.reopen_reason && (
                    <div className="p-2 bg-rose-50 border border-rose-100 rounded-xl text-[10px] text-rose-700 font-medium">
                      <strong>Correction Note:</strong> "{task.reopen_reason}"
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => onOpenMarksEntry(task.exam_id, task.subject_id, task.class_name)}
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                  >
                    <Edit3 size={13} />
                    <span>{isCompleted ? 'View Gradebook' : 'Enter Marks'}</span>
                  </button>

                  {/* Submit for Review (if draft/in_progress) */}
                  {(task.status === 'draft' || task.status === 'in_progress') && (
                    <button
                      onClick={() => onSubmitTask(task.id)}
                      className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="Submit to Exam Controller for review"
                    >
                      <Send size={12} />
                      <span>Submit</span>
                    </button>
                  )}

                  {/* Admin Verify & Approve Action */}
                  {isAdminOrController && task.status === 'submitted' && (
                    <button
                      onClick={() => onVerifyTask(task.id)}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                      title="Verify and Approve"
                    >
                      <ShieldCheck size={13} />
                      <span>Approve</span>
                    </button>
                  )}

                  {/* Reopen Action */}
                  {isAdminOrController && (task.status === 'submitted' || task.status === 'verified') && (
                    <button
                      onClick={() => setReopenModalTask(task)}
                      className="p-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-xl text-xs transition-colors cursor-pointer"
                      title="Request Correction / Reopen"
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* REOPEN / CORRECTION MODAL */}
      {reopenModalTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Request Marks Correction</h3>
                <p className="text-slate-400 text-[10px]">{reopenModalTask.subject_name} • {formatClassDisplay(reopenModalTask.class_name)}</p>
              </div>
              <button onClick={() => setReopenModalTask(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-400 block">Correction Feedback for Teacher</label>
              <textarea 
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Specify which component or student marks need verification..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 outline-none focus:border-violet-500 focus:bg-white min-h-[100px]"
                required
              />
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50">
              <button 
                type="button" 
                onClick={() => setReopenModalTask(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleConfirmReopen}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Confirm Reopen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEACHER ASSIGNMENT MODAL */}
      {assignModalTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Assign Evaluating Faculty</h3>
                <p className="text-slate-400 text-[10px]">{assignModalTask.subject_name} • {formatClassDisplay(assignModalTask.class_name)}</p>
              </div>
              <button onClick={() => setAssignModalTask(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-400 block">Select Responsible Teacher</label>
              <select 
                value={selectedNewTeacherId}
                onChange={(e) => setSelectedNewTeacherId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-violet-500 focus:bg-white"
              >
                <option value="">Choose Teacher...</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.designation || 'Teacher'})</option>
                ))}
              </select>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50">
              <button 
                type="button" 
                onClick={() => setAssignModalTask(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleConfirmAssign}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Assign Evaluator
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
