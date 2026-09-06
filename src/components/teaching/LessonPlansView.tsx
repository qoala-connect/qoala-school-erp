import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, NotebookPen, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchLessonPlans, saveLessonPlan, completeLessonPlan, deleteLessonPlan,
  type LessonPlan, type LessonPlanStatus, type TeacherScopeRow,
} from '@/services/teachingService';
import {
  AsyncBlock, EmptyBlock, Field, GhostButton, IconButton, Modal, Panel, PrimaryButton,
  StatusPill, TableScroll, Th, inputClass, selectClass,
} from '@/components/academics/shared';

/** The teacher's lesson plans across their classes, with a create / complete flow. */
export default function LessonPlansView({
  teacherId, academicYearId, scope,
}: {
  teacherId: string;
  academicYearId: string;
  scope: TeacherScopeRow[];
}) {
  const [rows, setRows] = useState<LessonPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<LessonPlanStatus | 'all'>('all');
  const [classFilter, setClassFilter] = useState('all');

  const [form, setForm] = useState<Partial<LessonPlan> & { _open?: boolean } | null>(null);
  const [confirmDel, setConfirmDel] = useState<LessonPlan | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRows(await fetchLessonPlans({ teacher_id: teacherId, status: statusFilter }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [teacherId, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const classOptions = useMemo(() => {
    const m = new Map<string, string>();
    scope.forEach(s => m.set(s.class_id, s.class_name));
    return [...m.entries()];
  }, [scope]);

  const filtered = useMemo(
    () => rows.filter(r => classFilter === 'all' || r.class_id === classFilter),
    [rows, classFilter],
  );

  const formSections = form?.class_id ? scope.filter(s => s.class_id === form.class_id) : [];

  const openCreate = () =>
    setForm({ _open: true, planned_date: new Date().toISOString().slice(0, 10), duration_minutes: 40, status: 'planned' });

  const save = async () => {
    if (!form?.topic?.trim()) { toast.error('Give the lesson a topic.'); return; }
    if (!form.class_id) { toast.error('Choose a class.'); return; }
    // A blank select is "", not a uuid — fall back to the teacher's first
    // scope row for the class rather than sending it to Postgres.
    const sectionId = form.section_id || null;
    const sc = scope.find(s => s.class_id === form.class_id && (!sectionId || s.section_id === sectionId));
    setBusy(true);
    try {
      await saveLessonPlan({
        id: form.id,
        teacher_id: teacherId,
        class_id: form.class_id!,
        class_name: sc?.class_name ?? null,
        section_id: sectionId ?? sc?.section_id ?? null,
        subject_id: (form.subject_id || null) ?? sc?.subject_id ?? null,
        subject_name: sc?.subject_name ?? null,
        academic_year_id: academicYearId,
        topic: form.topic!,
        objectives: form.objectives ?? null,
        planned_date: form.planned_date ?? new Date().toISOString().slice(0, 10),
        duration_minutes: form.duration_minutes ?? 40,
        teaching_method: form.teaching_method ?? null,
        resources: form.resources ?? null,
        homework_text: form.homework_text ?? null,
        status: (form.status as LessonPlanStatus) ?? 'planned',
      });
      toast.success(form.id ? 'Saved.' : 'Lesson plan created.');
      setForm(null);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const complete = async (lp: LessonPlan) => {
    try {
      await completeLessonPlan(lp.id);
      await load();
      toast.success('Marked completed.');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const runDelete = async () => {
    if (!confirmDel) return;
    setBusy(true);
    try {
      await deleteLessonPlan(confirmDel.id);
      setConfirmDel(null);
      await load();
      toast.success('Deleted.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Lesson Plans"
        description="What you plan to teach, and what you have completed."
        action={<PrimaryButton onClick={openCreate}><Plus size={14} /> New plan</PrimaryButton>}
      >
        <div className="flex flex-wrap items-center gap-2 p-4">
          <select className={selectClass + ' w-auto'} value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
            <option value="all">Any status</option>
            <option value="draft">Draft</option>
            <option value="planned">Planned</option>
            <option value="completed">Completed</option>
          </select>
          <select className={selectClass + ' w-auto'} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
            <option value="all">All classes</option>
            {classOptions.map(([id, name]) => <option key={id} value={id}>Class {name}</option>)}
          </select>
        </div>

        <AsyncBlock
          isLoading={isLoading} error={error} isEmpty={filtered.length === 0} onRetry={load}
          loadingLabel="Loading lesson plans"
          empty={<EmptyBlock icon={NotebookPen} title="No lesson plans" description="Create your first lesson plan for a class." actionLabel="New plan" onAction={openCreate} />}
        >
          <TableScroll minWidth={720}>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>Date</Th>
                <Th>Class</Th>
                <Th>Topic</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lp => (
                <tr key={lp.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <td className="py-3 px-4 text-[12px] text-slate-500 tabular-nums">{lp.planned_date}</td>
                  <td className="py-3 px-4 text-[12px] text-slate-600">{lp.class_name ?? '—'}</td>
                  <td className="py-3 px-4 text-[13px] font-bold text-slate-800">{lp.topic}</td>
                  <td className="py-3 px-4">
                    <StatusPill tone={lp.status === 'completed' ? 'good' : lp.status === 'planned' ? 'info' : 'muted'}>{lp.status}</StatusPill>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      {lp.status !== 'completed' && (
                        <GhostButton onClick={() => complete(lp)}><Check size={13} /> Complete</GhostButton>
                      )}
                      <IconButton label="Edit" onClick={() => setForm({ ...lp, _open: true })}><NotebookPen size={13} /></IconButton>
                      <IconButton label="Delete" tone="danger" onClick={() => setConfirmDel(lp)}><Trash2 size={13} /></IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        </AsyncBlock>
      </Panel>

      {form?._open && (
        <Modal
          title={form.id ? 'Edit lesson plan' : 'New lesson plan'}
          onClose={() => setForm(null)}
          wide
          footer={
            <>
              <GhostButton onClick={() => setForm(null)} disabled={busy}>Cancel</GhostButton>
              <PrimaryButton onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</PrimaryButton>
            </>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Class" htmlFor="lp-class">
                <select id="lp-class" className={selectClass} value={form.class_id ?? ''}
                  onChange={e => setForm({ ...form, class_id: e.target.value, section_id: undefined, subject_id: undefined })}>
                  <option value="">Choose…</option>
                  {classOptions.map(([id, name]) => <option key={id} value={id}>Class {name}</option>)}
                </select>
              </Field>
              <Field label="Section / subject" htmlFor="lp-sec">
                <select id="lp-sec" className={selectClass} value={form.section_id ?? ''} disabled={!form.class_id}
                  onChange={e => {
                    const s = formSections.find(x => x.section_id === e.target.value);
                    setForm({ ...form, section_id: e.target.value, subject_id: s?.subject_id ?? undefined });
                  }}>
                  <option value="">Choose…</option>
                  {formSections.map(s => (
                    <option key={s.assignment_id} value={s.section_id}>
                      Sec {s.section_name}{s.subject_name ? ` · ${s.subject_name}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Topic" htmlFor="lp-topic">
              <input id="lp-topic" className={inputClass} value={form.topic ?? ''} onChange={e => setForm({ ...form, topic: e.target.value })} />
            </Field>
            <Field label="Learning objectives" htmlFor="lp-obj">
              <textarea id="lp-obj" className={inputClass + ' h-20 py-2'} value={form.objectives ?? ''}
                onChange={e => setForm({ ...form, objectives: e.target.value })} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Field label="Date" htmlFor="lp-date">
                <input id="lp-date" type="date" className={inputClass} value={form.planned_date ?? ''}
                  onChange={e => setForm({ ...form, planned_date: e.target.value })} />
              </Field>
              <Field label="Duration" htmlFor="lp-dur">
                <input id="lp-dur" type="number" min={5} className={inputClass} value={form.duration_minutes ?? 40}
                  onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
              </Field>
              <Field label="Method" htmlFor="lp-method">
                <input id="lp-method" className={inputClass} value={form.teaching_method ?? ''}
                  onChange={e => setForm({ ...form, teaching_method: e.target.value })} />
              </Field>
              <Field label="Resources" htmlFor="lp-res">
                <input id="lp-res" className={inputClass} value={form.resources ?? ''}
                  onChange={e => setForm({ ...form, resources: e.target.value })} />
              </Field>
            </div>
            <Field label="Homework to give" htmlFor="lp-hw">
              <input id="lp-hw" className={inputClass} value={form.homework_text ?? ''}
                onChange={e => setForm({ ...form, homework_text: e.target.value })} />
            </Field>
          </div>
        </Modal>
      )}

      {confirmDel && (
        <Modal
          title="Delete lesson plan"
          onClose={() => setConfirmDel(null)}
          footer={
            <>
              <GhostButton onClick={() => setConfirmDel(null)} disabled={busy}>Cancel</GhostButton>
              <button onClick={runDelete} disabled={busy}
                className="inline-flex items-center gap-1.5 px-4 h-[36px] rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50">
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-600">Delete the plan for <span className="font-bold text-slate-900">{confirmDel.topic}</span>?</p>
        </Modal>
      )}
    </div>
  );
}
