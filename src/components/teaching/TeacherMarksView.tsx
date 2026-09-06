import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, ChevronRight, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { getWorkflowBadge } from '@/lib/cbseExamUtils';
import { examinationService } from '@/services/examinationService';
import {
  AsyncBlock, EmptyBlock, Panel, TableScroll, Th, inputClass, selectClass,
} from '@/components/academics/shared';
import ResultsView from '@/components/results/ResultsView';

/**
 * Marks Entry for a teacher, inside their own workspace.
 *
 * A teacher sees only the exam subjects they are the assigned evaluator for —
 * their board, never the whole school's. Entering marks reuses the exam
 * module's marks grid, so the teacher and the examination office work on the
 * same sheet with the same validation. Submitting hands the stream to the
 * admin's Marks Verification queue; nothing here can approve, lock or publish.
 *
 * Scope is enforced three deep: this list, the evaluator guard inside
 * ResultsView, and the marks_teacher_scoped row level security policy.
 */

/** Streams a teacher may still type into. Anything else is read only here. */
const EDITABLE = new Set(['draft', 'in_progress', 'returned']);

interface Task {
  id: string;
  exam_id: string;
  exam_name: string;
  short_name: string;
  class_name: string;
  class_id: string;
  subject_id: string;
  subject_name: string;
  max_marks: number;
  total_students: number;
  entered_count: number;
  status: string;
  reopen_reason?: string | null;
  deadline?: string | null;
  locked?: boolean;
}

export default function TeacherMarksView({
  teacherId, academicYearId,
}: {
  teacherId: string;
  academicYearId: string;
}) {
  const { user, role } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [entering, setEntering] = useState<Task | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [workload, allExams] = await Promise.all([
        examinationService.getTeacherWorkload(teacherId, academicYearId),
        examinationService.getExams({ academicYearId }),
      ]);
      setTasks(workload as Task[]);

      // Narrow the exam list and each exam's subject list to this teacher's own
      // streams (both explicitly assigned teacher_id and timetable-mapped),
      // so the grid's own pickers cannot wander outside their board.
      const taskExamIds = new Set((workload as Task[]).map(t => t.exam_id));
      const taskSubjectExamKeys = new Set((workload as Task[]).map(t => `${t.exam_id}_${t.subject_id}`));

      setExams(
        (allExams as any[])
          .filter(ex => taskExamIds.has(ex.id))
          .map(ex => ({
            ...ex,
            exam_subjects: (ex.exam_subjects ?? []).filter(
              (es: any) => es.teacher_id === teacherId || taskSubjectExamKeys.has(`${ex.id}_${es.subject_id}`)
            ),
          }))
          .filter(ex => ex.exam_subjects.length > 0),
      );
    } catch (err: any) {
      setError(err.message || 'Could not load your marks entry board.');
    } finally {
      setIsLoading(false);
    }
  }, [teacherId, academicYearId]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c = { pending: 0, submitted: 0, returned: 0, done: 0 };
    tasks.forEach(t => {
      if (t.status === 'returned') c.returned++;
      else if (t.status === 'submitted') c.submitted++;
      else if (t.status === 'approved' || t.status === 'locked' || t.status === 'published') c.done++;
      else c.pending++;
    });
    return c;
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (q && !`${t.subject_name} ${t.exam_name} ${t.class_name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, statusFilter, query]);

  const overdue = (t: Task) =>
    !!t.deadline && EDITABLE.has(t.status) && t.deadline < new Date().toISOString().slice(0, 10);

  // The marks grid, opened on one of the teacher's own streams.
  if (entering) {
    return (
      <ResultsView
        exams={exams}
        subjects={[]}
        classes={[]}
        currentUserRole={role || 'teacher'}
        currentUserId={user?.id}
        initialExamId={entering.exam_id}
        initialSubjectId={entering.subject_id}
        initialClassId={entering.class_id}
        onBackToTasks={() => { setEntering(null); load(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Kpi label="To enter" value={counts.pending} tone="warn" />
        <Kpi label="Returned to you" value={counts.returned} tone={counts.returned ? 'bad' : undefined} />
        <Kpi label="With admin" value={counts.submitted} tone="info" />
        <Kpi label="Approved" value={counts.done} tone="good" />
      </div>

      <Panel
        title="Marks Entry"
        description="Exam subjects you are the assigned evaluator for. Submit a subject to send it to the examination office for approval."
      >
        <div className="flex flex-wrap items-center gap-2 p-4">
          <input
            className={inputClass + ' w-56'}
            placeholder="Search subject, exam or class"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <select className={selectClass + ' w-auto'} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Any status</option>
            <option value="draft">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="returned">Returned for correction</option>
            <option value="submitted">Submitted for review</option>
            <option value="approved">Approved</option>
            <option value="locked">Locked</option>
          </select>
        </div>

        <AsyncBlock
          isLoading={isLoading}
          error={error}
          isEmpty={filtered.length === 0}
          onRetry={load}
          loadingLabel="Loading your marks board"
          empty={
            <EmptyBlock
              icon={ClipboardList}
              title={tasks.length === 0 ? 'No subjects assigned to you' : 'Nothing matches that filter'}
              description={
                tasks.length === 0
                  ? 'The examination office assigns an evaluator to each exam subject. Once a subject is assigned to you it appears here for marks entry.'
                  : 'Clear the search or status filter to see the rest of your board.'
              }
            />
          }
        >
          <TableScroll minWidth={880}>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>Subject</Th>
                <Th>Exam</Th>
                <Th>Class</Th>
                <Th align="center">Entered</Th>
                <Th>Deadline</Th>
                <Th>Status</Th>
                <Th align="right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const badge = getWorkflowBadge(t.status);
                const canEdit = EDITABLE.has(t.status) && !t.locked;
                const done = t.total_students > 0 && t.entered_count >= t.total_students;
                return (
                  <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <p className="text-[13px] font-bold text-slate-800">{t.subject_name}</p>
                      <p className="text-[11px] text-slate-400">Max {t.max_marks}</p>
                    </td>
                    <td className="py-3 px-4 text-[12px] text-slate-600">{t.short_name || t.exam_name}</td>
                    <td className="py-3 px-4 text-[12px] text-slate-600">Class {t.class_name}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={cn('text-[12px] font-bold tabular-nums',
                        done ? 'text-emerald-600' : t.entered_count > 0 ? 'text-amber-600' : 'text-slate-400')}>
                        {t.entered_count}/{t.total_students}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[12px] tabular-nums">
                      {t.deadline
                        ? <span className={cn('inline-flex items-center gap-1', overdue(t) ? 'font-bold text-rose-600' : 'text-slate-500')}>
                            {overdue(t) && <Clock size={12} />}{t.deadline}
                          </span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn('inline-flex items-center px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wide', badge.color)}>
                        {badge.label}
                      </span>
                      {t.status === 'returned' && t.reopen_reason && (
                        <p className="flex items-start gap-1 text-[11px] text-rose-600 mt-1 max-w-[220px]">
                          <AlertTriangle size={11} className="mt-0.5 shrink-0" />{t.reopen_reason}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end">
                        <button
                          onClick={() => setEntering(t)}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 h-[32px] rounded-xl text-[11px] font-bold border',
                            canEdit
                              ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
                          )}
                        >
                          {canEdit ? 'Enter marks' : 'View'}
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableScroll>
        </AsyncBlock>
      </Panel>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'good' | 'warn' | 'bad' | 'info' }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2.5">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className={cn('text-lg font-extrabold mt-0.5 tabular-nums',
        tone === 'good' ? 'text-emerald-600'
          : tone === 'warn' ? 'text-amber-600'
          : tone === 'bad' ? 'text-rose-600'
          : tone === 'info' ? 'text-blue-600'
          : 'text-slate-800')}>{value}</p>
    </div>
  );
}
