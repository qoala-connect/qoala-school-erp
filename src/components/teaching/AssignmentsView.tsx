import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, PencilRuler, Search, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  fetchAssignments, saveAssignment, setAssignmentStatus, deleteAssignment,
  type Assignment, type AssignmentKind, type AssignmentStatus, type TeacherScopeRow,
} from '@/services/teachingService';
import {
  AsyncBlock, EmptyBlock, Field, GhostButton, IconButton, Modal, Panel, PrimaryButton,
  StatusPill, TableScroll, Th, inputClass, selectClass,
} from '@/components/academics/shared';
import SubmissionReviewDrawer from './SubmissionReviewDrawer';

/**
 * The teacher's homework and assignments across all their classes, with
 * filters, a create / edit form and the submission review drawer.
 */
export default function AssignmentsView({
  teacherId, academicYearId, scope,
}: {
  teacherId: string;
  academicYearId: string;
  scope: TeacherScopeRow[];
}) {
  const [rows, setRows] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kindFilter, setKindFilter] = useState<AssignmentKind | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | 'all'>('all');
  const [classFilter, setClassFilter] = useState('all');
  const [query, setQuery] = useState('');

  const [form, setForm] = useState<Partial<Assignment> & { _open?: boolean } | null>(null);
  const [reviewing, setReviewing] = useState<Assignment | null>(null);
  const [confirmDel, setConfirmDel] = useState<Assignment | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRows(await fetchAssignments({
        teacher_id: teacherId,
        academic_year_id: academicYearId,
        kind: kindFilter,
        status: statusFilter,
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [teacherId, academicYearId, kindFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // distinct classes from the teacher's scope
  const classOptions = useMemo(() => {
    const m = new Map<string, string>();
    scope.forEach(s => m.set(s.class_id, `${s.class_name}`));
    return [...m.entries()];
  }, [scope]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (classFilter !== 'all' && r.class_id !== classFilter) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, classFilter, query]);

  const openCreate = () =>
    setForm({
      _open: true,
      kind: 'homework',
      status: 'published',
      assigned_date: new Date().toISOString().slice(0, 10),
      max_marks: 20,
    });

  const save = async () => {
    if (!form) return;
    if (!form.title?.trim()) { toast.error('Give it a title.'); return; }
    if (!form.class_id) { toast.error('Choose a class.'); return; }
    const sc = scope.find(s => s.class_id === form.class_id && (!form.section_id || s.section_id === form.section_id));
    setBusy(true);
    try {
      await saveAssignment({
        id: form.id,
        teacher_id: teacherId,
        academic_year_id: academicYearId,
        class_id: form.class_id!,
        section_id: form.section_id ?? sc?.section_id ?? null,
        subject_id: form.subject_id ?? sc?.subject_id ?? null,
        kind: (form.kind as AssignmentKind) ?? 'homework',
        title: form.title!,
        description: form.description ?? null,
        assigned_date: form.assigned_date ?? new Date().toISOString().slice(0, 10),
        due_date: form.due_date ?? null,
        max_marks: form.kind === 'assignment' ? (form.max_marks ?? null) : null,
        status: (form.status as AssignmentStatus) ?? 'published',
      });
      toast.success(form.id ? 'Saved.' : 'Published.');
      setForm(null);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const runDelete = async () => {
    if (!confirmDel) return;
    setBusy(true);
    try {
      await deleteAssignment(confirmDel.id);
      setConfirmDel(null);
      await load();
      toast.success('Deleted.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  // sections available for the chosen class in the form
  const formSections = form?.class_id
    ? scope.filter(s => s.class_id === form.class_id)
    : [];

  return (
    <div className="space-y-4">
      <Panel
        title="Homework & Assignments"
        description="Everything you've set, across your classes."
        action={<PrimaryButton onClick={openCreate}><Plus size={14} /> New</PrimaryButton>}
      >
        <div className="flex flex-wrap items-center gap-2 p-4">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={inputClass + ' pl-8 w-48'} placeholder="Search title" value={query}
              onChange={e => setQuery(e.target.value)} />
          </div>
          <select className={selectClass + ' w-auto'} value={kindFilter} onChange={e => setKindFilter(e.target.value as any)}>
            <option value="all">All kinds</option>
            <option value="homework">Homework</option>
            <option value="assignment">Assignments</option>
          </select>
          <select className={selectClass + ' w-auto'} value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
            <option value="all">Any status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
          </select>
          <select className={selectClass + ' w-auto'} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
            <option value="all">All classes</option>
            {classOptions.map(([id, name]) => <option key={id} value={id}>Class {name}</option>)}
          </select>
        </div>

        <AsyncBlock
          isLoading={isLoading} error={error} isEmpty={filtered.length === 0} onRetry={load}
          loadingLabel="Loading"
          empty={<EmptyBlock icon={PencilRuler} title="Nothing set yet" description="Create homework or an assignment for one of your classes." actionLabel="New" onAction={openCreate} />}
        >
          <TableScroll minWidth={760}>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>Title</Th>
                <Th>Kind</Th>
                <Th>Class</Th>
                <Th>Assigned</Th>
                <Th>Due</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <td className="py-3 px-4 text-[13px] font-bold text-slate-800">{a.title}</td>
                  <td className="py-3 px-4"><StatusPill tone={a.kind === 'assignment' ? 'info' : 'muted'}>{a.kind}</StatusPill></td>
                  <td className="py-3 px-4 text-[12px] text-slate-600">{a.class ?? '—'}{a.section ? `-${a.section}` : ''}</td>
                  <td className="py-3 px-4 text-[12px] text-slate-500 tabular-nums">{a.assigned_date}</td>
                  <td className="py-3 px-4 text-[12px] text-slate-500 tabular-nums">{a.due_date ?? '—'}</td>
                  <td className="py-3 px-4">
                    <StatusPill tone={a.status === 'published' ? 'good' : a.status === 'closed' ? 'muted' : 'warn'}>{a.status}</StatusPill>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton label="Review submissions" onClick={() => setReviewing(a)}><Eye size={14} /></IconButton>
                      <IconButton label="Edit" onClick={() => setForm({ ...a, _open: true })}>
                        <PencilRuler size={13} />
                      </IconButton>
                      {a.status !== 'closed'
                        ? <GhostButton onClick={() => setAssignmentStatus(a.id, 'closed').then(load)}>Close</GhostButton>
                        : <GhostButton onClick={() => setAssignmentStatus(a.id, 'published').then(load)}>Reopen</GhostButton>}
                      <IconButton label="Delete" tone="danger" onClick={() => setConfirmDel(a)}><Trash2 size={13} /></IconButton>
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
          title={form.id ? 'Edit item' : 'New homework / assignment'}
          onClose={() => setForm(null)}
          footer={
            <>
              <GhostButton onClick={() => setForm(null)} disabled={busy}>Cancel</GhostButton>
              <PrimaryButton onClick={save} disabled={busy}>{busy ? 'Saving…' : form.id ? 'Save' : 'Publish'}</PrimaryButton>
            </>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {(['homework', 'assignment'] as AssignmentKind[]).map(k => (
                <button key={k} onClick={() => setForm({ ...form, kind: k })}
                  className={cn('px-3.5 h-[34px] rounded-xl text-xs font-bold border',
                    form.kind === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200')}>
                  {k === 'homework' ? 'Homework' : 'Assignment'}
                </button>
              ))}
            </div>
            <Field label="Title" htmlFor="a-title">
              <input id="a-title" className={inputClass} value={form.title ?? ''} onChange={e => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Instructions" htmlFor="a-desc">
              <textarea id="a-desc" className={inputClass + ' h-20 py-2'} value={form.description ?? ''}
                onChange={e => setForm({ ...form, description: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Class" htmlFor="a-class">
                <select id="a-class" className={selectClass} value={form.class_id ?? ''}
                  onChange={e => setForm({ ...form, class_id: e.target.value, section_id: undefined, subject_id: undefined })}>
                  <option value="">Choose…</option>
                  {classOptions.map(([id, name]) => <option key={id} value={id}>Class {name}</option>)}
                </select>
              </Field>
              <Field label="Section / subject" htmlFor="a-sec">
                <select id="a-sec" className={selectClass} value={form.section_id ?? ''} disabled={!form.class_id}
                  onChange={e => {
                    const s = formSections.find(x => x.section_id === e.target.value);
                    setForm({ ...form, section_id: e.target.value, subject_id: s?.subject_id ?? undefined });
                  }}>
                  <option value="">Whole class</option>
                  {formSections.map(s => (
                    <option key={s.assignment_id} value={s.section_id}>
                      Sec {s.section_name}{s.subject_name ? ` · ${s.subject_name}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Assigned" htmlFor="a-ad">
                <input id="a-ad" type="date" className={inputClass} value={form.assigned_date ?? ''}
                  onChange={e => setForm({ ...form, assigned_date: e.target.value })} />
              </Field>
              <Field label="Due" htmlFor="a-dd">
                <input id="a-dd" type="date" className={inputClass} value={form.due_date ?? ''}
                  onChange={e => setForm({ ...form, due_date: e.target.value })} />
              </Field>
              {form.kind === 'assignment' && (
                <Field label="Max marks" htmlFor="a-mm">
                  <input id="a-mm" type="number" min={1} className={inputClass} value={form.max_marks ?? 20}
                    onChange={e => setForm({ ...form, max_marks: Number(e.target.value) })} />
                </Field>
              )}
            </div>
            <Field label="Status" htmlFor="a-status">
              <select id="a-status" className={selectClass} value={form.status ?? 'published'}
                onChange={e => setForm({ ...form, status: e.target.value as AssignmentStatus })}>
                <option value="draft">Draft (not visible to students)</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
              </select>
            </Field>
          </div>
        </Modal>
      )}

      {reviewing && (
        <SubmissionReviewDrawer
          assignment={reviewing}
          teacherId={teacherId}
          onClose={() => setReviewing(null)}
          onReviewed={load}
        />
      )}

      {confirmDel && (
        <Modal
          title="Delete item"
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
          <p className="text-sm text-slate-600">
            Delete <span className="font-bold text-slate-900">{confirmDel.title}</span> and its submissions? This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
