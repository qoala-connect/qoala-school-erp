import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck, NotebookPen, PencilRuler, ListTree, Check, X, Loader2, CheckCircle2, Circle,
  CircleDot, ArrowLeft, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  fetchClassRegister, saveClassRegister, ATTENDANCE_STATUSES,
  type RegisterStudent, type AttendanceStatus, type ClassRegister,
} from '@/services/attendanceService';
import {
  fetchTeacherClassWorkspace, saveLessonPlan, completeLessonPlan, saveAssignment,
  type TeacherClassWorkspace, type AssignmentKind,
} from '@/services/teachingService';
import {
  fetchSyllabusTree, updateChapterProgress,
  type SyllabusTreeRow, type ChapterStatus,
} from '@/services/syllabusService';
import {
  AsyncBlock, EmptyBlock, Field, GhostButton, Panel, PrimaryButton, StatusPill,
  inputClass, selectClass,
} from '@/components/academics/shared';

/**
 * One screen for running a single class period end to end: attendance,
 * the lesson plan, the homework or assignment given, and the syllabus
 * chapters covered. This is the "one place" a teacher works from, rather
 * than four separate pages.
 */

export interface ClassContext {
  class_id: string;
  class_name: string;
  section_id: string;
  section_name: string;
  subject_id: string;
  subject_name: string;
  date: string;
}

type SubTab = 'attendance' | 'lesson' | 'work' | 'syllabus';

const SUBTABS: { id: SubTab; label: string; icon: any }[] = [
  { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
  { id: 'lesson', label: 'Lesson Plan', icon: NotebookPen },
  { id: 'work', label: 'Homework', icon: PencilRuler },
  { id: 'syllabus', label: 'Syllabus', icon: ListTree },
];

export default function ClassWorkspacePanel({
  ctx, teacherId, academicYearId, canEditAttendance, onBack, onChanged,
}: {
  ctx: ClassContext;
  teacherId: string;
  academicYearId: string;
  canEditAttendance: boolean;
  onBack?: () => void;
  onChanged?: () => void;
}) {
  const [tab, setTab] = useState<SubTab>('attendance');
  const [summary, setSummary] = useState<TeacherClassWorkspace | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      setSummary(await fetchTeacherClassWorkspace({
        teacher_id: teacherId,
        academic_year_id: academicYearId,
        class_id: ctx.class_id,
        section_id: ctx.section_id,
        subject_id: ctx.subject_id,
        date: ctx.date,
      }));
    } catch {
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, [teacherId, academicYearId, ctx]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const bumpAll = () => { loadSummary(); onChanged?.(); };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        {onBack && (
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800">
            <ArrowLeft size={14} /> Today's classes
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight truncate">
            {ctx.class_name}-{ctx.section_name} · {ctx.subject_name}
          </h2>
          <p className="text-[11px] text-slate-500 font-medium">
            {new Date(ctx.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* live counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Mini label="Students" value={loadingSummary ? '—' : summary?.students_total ?? 0} icon={Users} />
        <Mini
          label="Attendance"
          value={loadingSummary ? '—' : summary?.attendance_marked ? `${summary.present_count}/${summary.students_total}` : 'Not marked'}
          tone={summary?.attendance_marked ? 'good' : 'warn'}
        />
        <Mini
          label="Lesson plan"
          value={loadingSummary ? '—' : summary?.lesson_plan ? (summary.lesson_plan.status === 'completed' ? 'Done' : 'Planned') : 'None'}
          tone={summary?.lesson_plan?.status === 'completed' ? 'good' : summary?.lesson_plan ? 'info' : 'warn'}
        />
        <Mini
          label="Syllabus"
          value={loadingSummary ? '—' : summary?.syllabus_percent == null ? 'n/a' : `${summary.syllabus_percent}%`}
        />
      </div>

      {/* sub-tabs */}
      <div className="bg-slate-100/90 rounded-2xl border border-slate-200/80 p-1.5 overflow-x-auto no-scrollbar">
        <nav className="flex items-center gap-1 min-w-max">
          {SUBTABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all',
                  active ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80' : 'text-slate-600 hover:bg-white/60',
                )}>
                <t.icon size={14} className={active ? 'text-indigo-600' : 'text-slate-400'} />
                {t.id === 'work' ? 'Homework / Assignment' : t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {tab === 'attendance' && (
        <AttendanceSection ctx={ctx} canEdit={canEditAttendance} onSaved={bumpAll} />
      )}
      {tab === 'lesson' && (
        <LessonSection ctx={ctx} teacherId={teacherId} academicYearId={academicYearId}
          existing={summary?.lesson_plan ?? null} onSaved={bumpAll} />
      )}
      {tab === 'work' && (
        <WorkSection ctx={ctx} teacherId={teacherId} academicYearId={academicYearId} onSaved={bumpAll} />
      )}
      {tab === 'syllabus' && (
        <SyllabusSection ctx={ctx} teacherId={teacherId} academicYearId={academicYearId} onSaved={bumpAll} />
      )}
    </div>
  );
}

function Mini({ label, value, tone, icon: Icon }: { label: string; value: React.ReactNode; tone?: 'good' | 'warn' | 'info'; icon?: any }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2.5">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
        {Icon && <Icon size={11} />}{label}
      </p>
      <p className={cn(
        'text-sm font-extrabold mt-0.5 tabular-nums',
        tone === 'good' && 'text-emerald-600',
        tone === 'warn' && 'text-amber-600',
        tone === 'info' && 'text-indigo-600',
        !tone && 'text-slate-800',
      )}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------

function AttendanceSection({ ctx, canEdit, onSaved }: { ctx: ClassContext; canEdit: boolean; onSaved: () => void }) {
  const [register, setRegister] = useState<ClassRegister | null>(null);
  const [rows, setRows] = useState<RegisterStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const reg = await fetchClassRegister({
        class_id: ctx.class_id, section_id: ctx.section_id,
        class_name: ctx.class_name, section_name: ctx.section_name, date: ctx.date,
      });
      setRegister(reg);
      setRows(reg.students);
      setEditing(!reg.alreadyMarked);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [ctx]);

  useEffect(() => { load(); }, [load]);

  const setStatus = (id: string, status: AttendanceStatus) =>
    setRows(prev => prev.map(r => (r.id === id ? { ...r, status } : r)));

  const bulk = (status: AttendanceStatus) => setRows(prev => prev.map(r => ({ ...r, status })));

  const save = async () => {
    setSaving(true);
    try {
      const n = await saveClassRegister({
        class_name: ctx.class_name, section_name: ctx.section_name, date: ctx.date,
        rows: rows.map(r => ({ student_id: r.id, status: r.status, remarks: r.remarks })),
      });
      toast.success(`Attendance saved for ${n} student${n === 1 ? '' : 's'}.`);
      setEditing(false);
      await load();
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach(r => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  return (
    <Panel
      title="Attendance"
      description={
        register?.alreadyMarked && !editing
          ? `Already marked${register.markedByName ? ` by ${register.markedByName}` : ''}.`
          : `${rows.length} students · P ${counts.present ?? 0} · A ${counts.absent ?? 0} · L ${counts.late ?? 0}`
      }
      action={
        !isLoading && rows.length > 0 && (
          register?.alreadyMarked && !editing ? (
            canEdit && <GhostButton onClick={() => setEditing(true)}>Edit register</GhostButton>
          ) : (
            <div className="flex items-center gap-2">
              <GhostButton onClick={() => bulk('present')} disabled={saving}>All present</GhostButton>
              <PrimaryButton onClick={save} disabled={saving || !canEdit}>
                {saving ? 'Saving…' : 'Save attendance'}
              </PrimaryButton>
            </div>
          )
        )
      }
    >
      <AsyncBlock
        isLoading={isLoading} error={error} isEmpty={rows.length === 0} onRetry={load}
        loadingLabel="Loading register"
        empty={<EmptyBlock icon={Users} title="No students" description="This class and section has no active students enrolled." />}
      >
        <ul className="divide-y divide-slate-100">
          {rows.map(s => (
            <li key={s.id} className="flex items-center gap-3 px-4 sm:px-5 py-2.5">
              <span className="w-8 text-[11px] font-black text-slate-400 tabular-nums">{s.roll_number}</span>
              <span className="text-[13px] font-semibold text-slate-800 flex-1 min-w-0 truncate">{s.name}</span>
              {register?.alreadyMarked && !editing ? (
                <StatusPill tone={
                  s.status === 'present' ? 'good' : s.status === 'absent' ? 'bad' : s.status === 'late' ? 'warn' : 'muted'
                }>{s.status}</StatusPill>
              ) : (
                <div className="flex items-center gap-1">
                  {ATTENDANCE_STATUSES.map(opt => (
                    <button key={opt.value} disabled={!canEdit}
                      onClick={() => setStatus(s.id, opt.value)}
                      className={cn(
                        'px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-colors disabled:opacity-40',
                        s.status === opt.value
                          ? opt.value === 'present' ? 'bg-emerald-600 text-white border-emerald-600'
                            : opt.value === 'absent' ? 'bg-rose-600 text-white border-rose-600'
                            : opt.value === 'late' ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-slate-700 text-white border-slate-700'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300',
                      )}>
                      {opt.value === 'half_day' ? 'Half' : opt.value === 'leave' ? 'Leave' : opt.label.slice(0, 3)}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </AsyncBlock>
    </Panel>
  );
}

// ---------------------------------------------------------------------
// Lesson plan
// ---------------------------------------------------------------------

function LessonSection({
  ctx, teacherId, academicYearId, existing, onSaved,
}: {
  ctx: ClassContext; teacherId: string; academicYearId: string;
  existing: any | null; onSaved: () => void;
}) {
  const [topic, setTopic] = useState(existing?.topic ?? '');
  const [objectives, setObjectives] = useState(existing?.objectives ?? '');
  const [method, setMethod] = useState(existing?.teaching_method ?? '');
  const [resources, setResources] = useState(existing?.resources ?? '');
  const [homework, setHomework] = useState(existing?.homework_text ?? '');
  const [duration, setDuration] = useState(String(existing?.duration_minutes ?? 40));
  const [outcome, setOutcome] = useState(existing?.outcome_notes ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTopic(existing?.topic ?? '');
    setObjectives(existing?.objectives ?? '');
    setMethod(existing?.teaching_method ?? '');
    setResources(existing?.resources ?? '');
    setHomework(existing?.homework_text ?? '');
    setDuration(String(existing?.duration_minutes ?? 40));
    setOutcome(existing?.outcome_notes ?? '');
  }, [existing]);

  const isCompleted = existing?.status === 'completed';

  const save = async (status: 'planned' | 'completed') => {
    if (!topic.trim()) { toast.error('Give the lesson a topic.'); return; }
    setBusy(true);
    try {
      const plan = await saveLessonPlan({
        id: existing?.id,
        teacher_id: teacherId,
        class_id: ctx.class_id,
        class_name: ctx.class_name,
        section_id: ctx.section_id,
        subject_id: ctx.subject_id,
        subject_name: ctx.subject_name,
        academic_year_id: academicYearId,
        chapter_id: existing?.chapter_id ?? null,
        topic,
        objectives,
        planned_date: ctx.date,
        duration_minutes: Number(duration) || 40,
        teaching_method: method,
        resources,
        homework_text: homework,
        status: status === 'completed' ? 'planned' : status,
      });
      if (status === 'completed') {
        await completeLessonPlan(plan.id, outcome);
      }
      toast.success(status === 'completed' ? 'Lesson marked completed.' : 'Lesson plan saved.');
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Lesson plan"
      description={existing ? (isCompleted ? 'Completed' : 'Planned — not yet completed') : 'No plan for this period yet'}
      action={
        <div className="flex items-center gap-2">
          <GhostButton onClick={() => save('planned')} disabled={busy}>Save plan</GhostButton>
          {!isCompleted && <PrimaryButton onClick={() => save('completed')} disabled={busy}>Mark completed</PrimaryButton>}
        </div>
      }
    >
      <div className="p-5 space-y-3">
        <Field label="Topic" htmlFor="lp-topic">
          <input id="lp-topic" className={inputClass} value={topic} onChange={e => setTopic(e.target.value)}
            placeholder="e.g. Electric Potential" />
        </Field>
        <Field label="Learning objectives" htmlFor="lp-obj">
          <textarea id="lp-obj" className={inputClass + ' h-20 py-2'} value={objectives}
            onChange={e => setObjectives(e.target.value)} placeholder="What students should understand by the end." />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Teaching method" htmlFor="lp-method">
            <input id="lp-method" className={inputClass} value={method} onChange={e => setMethod(e.target.value)}
              placeholder="Lecture + demo" />
          </Field>
          <Field label="Resources" htmlFor="lp-res">
            <input id="lp-res" className={inputClass} value={resources} onChange={e => setResources(e.target.value)}
              placeholder="Textbook, board" />
          </Field>
          <Field label="Duration (min)" htmlFor="lp-dur">
            <input id="lp-dur" type="number" min={5} className={inputClass} value={duration}
              onChange={e => setDuration(e.target.value)} />
          </Field>
        </div>
        <Field label="Homework set in class" htmlFor="lp-hw" hint="Free text — create a tracked homework item under the Homework tab.">
          <input id="lp-hw" className={inputClass} value={homework} onChange={e => setHomework(e.target.value)}
            placeholder="e.g. Exercise 2.1" />
        </Field>
        {(existing || isCompleted) && (
          <Field label="After-class notes" htmlFor="lp-out">
            <textarea id="lp-out" className={inputClass + ' h-16 py-2'} value={outcome}
              onChange={e => setOutcome(e.target.value)} placeholder="How the lesson went, what to revisit." />
          </Field>
        )}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------
// Homework / assignment
// ---------------------------------------------------------------------

function WorkSection({
  ctx, teacherId, academicYearId, onSaved,
}: {
  ctx: ClassContext; teacherId: string; academicYearId: string; onSaved: () => void;
}) {
  const [kind, setKind] = useState<AssignmentKind>('homework');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(ctx.date + 'T00:00:00');
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [maxMarks, setMaxMarks] = useState('20');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!title.trim()) { toast.error('Give it a title.'); return; }
    setBusy(true);
    try {
      await saveAssignment({
        teacher_id: teacherId,
        academic_year_id: academicYearId,
        class_id: ctx.class_id,
        section_id: ctx.section_id,
        subject_id: ctx.subject_id,
        kind,
        title,
        description,
        assigned_date: ctx.date,
        due_date: dueDate || null,
        max_marks: kind === 'assignment' ? Number(maxMarks) || null : null,
        status: 'published',
      });
      toast.success(`${kind === 'homework' ? 'Homework' : 'Assignment'} published to ${ctx.class_name}-${ctx.section_name}.`);
      setTitle(''); setDescription('');
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Give homework or an assignment"
      description={`Published straight to ${ctx.class_name}-${ctx.section_name} · ${ctx.subject_name}. Manage and review everything under Homework & Assignments.`}
    >
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          {(['homework', 'assignment'] as AssignmentKind[]).map(k => (
            <button key={k} onClick={() => setKind(k)}
              className={cn(
                'px-3.5 h-[34px] rounded-xl text-xs font-bold border transition-colors',
                kind === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200',
              )}>
              {k === 'homework' ? 'Homework' : 'Assignment'}
            </button>
          ))}
          <span className="text-[11px] text-slate-400">
            {kind === 'homework' ? 'Lightweight daily work.' : 'Structured, graded piece.'}
          </span>
        </div>
        <Field label="Title" htmlFor="w-title">
          <input id="w-title" className={inputClass} value={title} onChange={e => setTitle(e.target.value)}
            placeholder={kind === 'homework' ? 'e.g. Exercise 2.1' : 'e.g. Electrostatics project'} />
        </Field>
        <Field label="Instructions" htmlFor="w-desc">
          <textarea id="w-desc" className={inputClass + ' h-20 py-2'} value={description}
            onChange={e => setDescription(e.target.value)} placeholder="What to do, what to submit." />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Due date" htmlFor="w-due">
            <input id="w-due" type="date" className={inputClass} value={dueDate} min={ctx.date}
              onChange={e => setDueDate(e.target.value)} />
          </Field>
          {kind === 'assignment' && (
            <Field label="Maximum marks" htmlFor="w-max">
              <input id="w-max" type="number" min={1} className={inputClass} value={maxMarks}
                onChange={e => setMaxMarks(e.target.value)} />
            </Field>
          )}
        </div>
        <div className="flex justify-end">
          <PrimaryButton onClick={create} disabled={busy}>
            {busy ? 'Publishing…' : `Publish ${kind}`}
          </PrimaryButton>
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------
// Syllabus progress
// ---------------------------------------------------------------------

const NEXT: Record<ChapterStatus, ChapterStatus> = {
  not_started: 'in_progress',
  in_progress: 'completed',
  completed: 'not_started',
};

function SyllabusSection({
  ctx, teacherId, academicYearId, onSaved,
}: {
  ctx: ClassContext; teacherId: string; academicYearId: string; onSaved: () => void;
}) {
  const [rows, setRows] = useState<SyllabusTreeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRows(await fetchSyllabusTree({
        academic_year_id: academicYearId,
        class_id: ctx.class_id,
        subject_id: ctx.subject_id,
        section_id: ctx.section_id,
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [academicYearId, ctx]);

  useEffect(() => { load(); }, [load]);

  const cycle = async (row: SyllabusTreeRow) => {
    if (!row.chapter_id) return;
    const next = NEXT[row.progress_status];
    setBusyId(row.chapter_id);
    try {
      await updateChapterProgress({
        chapter_id: row.chapter_id,
        section_id: ctx.section_id,
        teacher_id: teacherId,
        status: next,
      });
      await load();
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const chapters = rows.filter(r => r.chapter_id);
  const done = chapters.filter(r => r.progress_status === 'completed').length;

  return (
    <Panel
      title="Syllabus progress"
      description={
        chapters.length
          ? `${done}/${chapters.length} chapters completed for ${ctx.class_name}-${ctx.section_name}`
          : 'No syllabus configured for this class and subject'
      }
    >
      <AsyncBlock
        isLoading={isLoading} error={error} isEmpty={chapters.length === 0} onRetry={load}
        loadingLabel="Loading syllabus"
        empty={
          <EmptyBlock icon={ListTree} title="No syllabus configured"
            description="Ask an administrator to add the units and chapters for this class and subject." />
        }
      >
        <ul className="divide-y divide-slate-100">
          {rows.map((r, i) => {
            if (!r.chapter_id) return null;
            const isFirstOfUnit = i === 0 || rows[i - 1].unit_id !== r.unit_id;
            return (
              <React.Fragment key={r.chapter_id}>
                {isFirstOfUnit && (
                  <li className="px-4 sm:px-5 pt-3 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {r.unit_sequence}. {r.unit_title}
                  </li>
                )}
                <li className="flex items-center gap-3 px-4 sm:px-5 py-2.5">
                  <button
                    onClick={() => cycle(r)}
                    disabled={busyId === r.chapter_id}
                    className="shrink-0"
                    title="Click to change status"
                  >
                    {busyId === r.chapter_id ? (
                      <Loader2 size={18} className="animate-spin text-slate-400" />
                    ) : r.progress_status === 'completed' ? (
                      <CheckCircle2 size={18} className="text-emerald-600" />
                    ) : r.progress_status === 'in_progress' ? (
                      <CircleDot size={18} className="text-amber-500" />
                    ) : (
                      <Circle size={18} className="text-slate-300" />
                    )}
                  </button>
                  <span className={cn(
                    'text-[13px] font-semibold flex-1 min-w-0 truncate',
                    r.progress_status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-800',
                  )}>
                    {r.chapter_sequence}. {r.chapter_title}
                  </span>
                  <StatusPill tone={
                    r.progress_status === 'completed' ? 'good' : r.progress_status === 'in_progress' ? 'warn' : 'muted'
                  }>
                    {r.progress_status.replace('_', ' ')}
                  </StatusPill>
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      </AsyncBlock>
    </Panel>
  );
}
