import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers, Plus, Edit2, Trash2, Search, Eye, ArrowUpRight,
  Power, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useAcademicYear } from '@/context/AcademicYearContext';
import {
  fetchClassDirectory, saveClass, setClassActive, deleteClass,
  fetchSectionDirectory, attachSectionToClass, updateClassSection, deleteClassSection,
  fetchClassSubjects,
  type ClassDirectoryRow, type SectionDirectoryRow, type ClassSubjectRow,
} from '@/services/academicsService';
import {
  AsyncBlock, EmptyBlock, Field, GhostButton, IconButton, LoadingBlock, Modal,
  Panel, PrimaryButton, StatusPill, TableScroll, Th, inputClass, selectClass,
} from './shared';

/**
 * The class directory, and the workspace behind each class.
 *
 * Counts come from academics_class_directory(), one request for the
 * whole table rather than four per class.
 *
 * The workspace is deliberately thin. Sections are edited here because
 * Academics owns them. Teachers, students and exams are not: those tabs
 * summarise and then hand off to the module that owns the data, with the
 * class, section and year already applied as a filter.
 */
export default function ClassesSectionsView() {
  const { can } = useAuth();
  const { selectedYearId, selectedYear } = useAcademicYear();
  const mayManage = can('academics.manage');

  const [rows, setRows] = useState<ClassDirectoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [editingClass, setEditingClass] = useState<ClassDirectoryRow | null>(null);
  const [isClassFormOpen, setIsClassFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ClassDirectoryRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [workspaceClass, setWorkspaceClass] = useState<ClassDirectoryRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!selectedYearId) return;
    setIsLoading(true);
    setError(null);
    try {
      setRows(await fetchClassDirectory(selectedYearId));
    } catch (err: any) {
      setError(err.message);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYearId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      const matchesSearch = !q
        || r.class_name.toLowerCase().includes(q)
        || (r.class_code ?? '').toLowerCase().includes(q)
        || (r.stream ?? '').toLowerCase().includes(q)
        || (r.section_labels ?? '').toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? r.is_active : !r.is_active);
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const handleToggleActive = async (row: ClassDirectoryRow) => {
    setBusy(true);
    try {
      await setClassActive(row.class_id, !row.is_active);
      toast.success(`Class ${row.class_name} ${row.is_active ? 'deactivated' : 'reactivated'}.`);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteClass(confirmDelete.class_id);
      toast.success(`Class ${confirmDelete.class_name} deleted.`);
      setConfirmDelete(null);
      await load();
    } catch (err: any) {
      // The dialog stays open on failure, so the reason has to be visible
      // inside it -- a toast alone is easy to miss behind the modal.
      setDeleteError(err.message);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Panel
        title="Classes and sections"
        description={selectedYear ? `Structure and enrolment for ${selectedYear.name}` : undefined}
        action={
          <>
            <GhostButton onClick={load} title="Reload" disabled={isLoading}>
              <RefreshCw size={13} className={cn(isLoading && 'animate-spin')} aria-hidden="true" /> Reload
            </GhostButton>
            {mayManage && (
              <PrimaryButton onClick={() => { setEditingClass(null); setIsClassFormOpen(true); }}>
                <Plus size={14} aria-hidden="true" /> Add class
              </PrimaryButton>
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/40">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <input
              className={inputClass + ' pl-8'}
              placeholder="Search class, code, stream or section"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search classes"
            />
          </div>
          <select
            className={selectClass + ' w-auto'}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            aria-label="Filter by status"
          >
            <option value="all">All classes</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          {(search || statusFilter !== 'all') && (
            <GhostButton onClick={() => { setSearch(''); setStatusFilter('all'); }}>Reset</GhostButton>
          )}
          <span className="text-[11px] font-semibold text-slate-400 ml-auto tabular-nums">
            {filtered.length} of {rows.length}
          </span>
        </div>

        <AsyncBlock
          isLoading={isLoading}
          error={error}
          isEmpty={rows.length === 0}
          onRetry={load}
          loadingLabel="Loading classes"
          empty={
            <EmptyBlock
              icon={Layers}
              title="No classes configured"
              description="Classes are the backbone of the academic structure. Students, exams, fees and the timetable all reference them."
              actionLabel={mayManage ? 'Create class' : undefined}
              onAction={mayManage ? () => { setEditingClass(null); setIsClassFormOpen(true); } : undefined}
            />
          }
        >
          {filtered.length === 0 ? (
            <EmptyBlock
              icon={Search}
              title="Nothing matches that search"
              description="Try a different class name, code or stream, or reset the filters."
              actionLabel="Reset filters"
              onAction={() => { setSearch(''); setStatusFilter('all'); }}
            />
          ) : (
            <TableScroll minWidth={940}>
              <thead className="bg-slate-50/70 border-b border-slate-100">
                <tr>
                  <Th>Class</Th>
                  <Th>Sections</Th>
                  <Th align="center">Subjects</Th>
                  <Th align="center">Students</Th>
                  <Th>Class teacher</Th>
                  <Th align="center">Status</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map(r => (
                  <tr key={r.class_id} className={cn('hover:bg-slate-50/50 transition-colors', !r.is_active && 'opacity-60')}>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setWorkspaceClass(r)}
                        className="font-extrabold text-slate-900 hover:text-violet-600 transition-colors text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 rounded"
                      >
                        Class {r.class_name}
                      </button>
                      <span className="block text-[10px] text-slate-400 font-semibold mt-0.5">
                        {r.class_code} · {r.stream}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {r.sections_count === 0 ? (
                        <span className="text-[11px] text-amber-600 font-semibold inline-flex items-center gap-1">
                          <AlertTriangle size={11} aria-hidden="true" /> None
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(r.section_labels ?? '').split(', ').filter(Boolean).map(s => (
                            <span key={s} className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-black">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700 tabular-nums">
                      {r.subjects_count === 0
                        ? <span className="text-amber-600">0</span>
                        : r.subjects_count}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700 tabular-nums">{r.students_count}</td>
                    <td className="py-3 px-4">
                      {r.class_teacher_names
                        ? <span className="font-semibold text-slate-700">{r.class_teacher_names}</span>
                        : <span className="text-[11px] text-slate-400">Not assigned</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusPill tone={r.is_active ? 'good' : 'muted'}>{r.is_active ? 'Active' : 'Inactive'}</StatusPill>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <IconButton onClick={() => setWorkspaceClass(r)} label={`Open Class ${r.class_name}`}>
                          <Eye size={14} />
                        </IconButton>
                        {mayManage && (
                          <>
                            <IconButton onClick={() => { setEditingClass(r); setIsClassFormOpen(true); }} label={`Edit Class ${r.class_name}`}>
                              <Edit2 size={14} />
                            </IconButton>
                            <IconButton
                              onClick={() => handleToggleActive(r)}
                              label={r.is_active ? `Deactivate Class ${r.class_name}` : `Reactivate Class ${r.class_name}`}
                              disabled={busy}
                            >
                              <Power size={14} />
                            </IconButton>
                            <IconButton onClick={() => setConfirmDelete(r)} label={`Delete Class ${r.class_name}`} tone="danger">
                              <Trash2 size={14} />
                            </IconButton>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableScroll>
          )}
        </AsyncBlock>
      </Panel>

      {isClassFormOpen && (
        <ClassForm
          row={editingClass}
          nextOrder={Math.max(0, ...rows.map(r => r.display_order)) + 1}
          onClose={() => setIsClassFormOpen(false)}
          onSaved={async () => { setIsClassFormOpen(false); await load(); }}
        />
      )}

      {confirmDelete && (
        <Modal
          title={`Delete Class ${confirmDelete.class_name}?`}
          onClose={() => { setConfirmDelete(null); setDeleteError(null); }}
          footer={
            <>
              <GhostButton onClick={() => { setConfirmDelete(null); setDeleteError(null); }}>Cancel</GhostButton>
              <PrimaryButton onClick={handleDelete} disabled={busy} className="bg-rose-600 hover:bg-rose-700">
                Delete class
              </PrimaryButton>
            </>
          }
        >
          <p className="text-xs text-slate-600 leading-relaxed">
            The database refuses this while the class holds students, exams or teacher assignments, and it currently
            has <strong className="text-slate-900">{confirmDelete.students_count}</strong> student(s) enrolled for this
            year. Deactivating keeps the history intact and removes the class from every picker.
          </p>
          {deleteError && (
            <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {deleteError}
            </p>
          )}
        </Modal>
      )}

      {workspaceClass && (
        <ClassWorkspace
          row={workspaceClass}
          onClose={() => setWorkspaceClass(null)}
          onChanged={load}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------
// Class form
// ---------------------------------------------------------------------

function ClassForm({
  row, nextOrder, onClose, onSaved,
}: {
  row: ClassDirectoryRow | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [className, setClassName] = useState(row?.class_name ?? '');
  const [classCode, setClassCode] = useState(row?.class_code ?? '');
  const [stream, setStream] = useState(row?.stream ?? 'General');
  const [order, setOrder] = useState(String(row?.display_order ?? nextOrder));
  const [isActive, setIsActive] = useState(row?.is_active ?? true);
  const [sectionsInput, setSectionsInput] = useState('A');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const parsedSections = Array.from(new Set(
    sectionsInput.split(/[,\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean)
  ));

  const validate = () => {
    const next: Record<string, string> = {};
    if (!className.trim()) next.className = 'A class needs a name.';
    if (!classCode.trim()) next.classCode = 'A short code is required, and it must be unique.';
    if (!/^\d+$/.test(order)) next.order = 'Ordering must be a whole number.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const saved = await saveClass({
        id: row?.class_id,
        class_name: className,
        class_code: classCode,
        stream,
        display_order: Number(order),
        is_active: isActive,
      });

      if (!row && parsedSections.length > 0) {
        for (const section_name of parsedSections) {
          await attachSectionToClass({ class_id: saved.id, section_name, capacity: 40, room_no: null });
        }
      }

      toast.success(
        row
          ? 'Class updated.'
          : parsedSections.length > 0
            ? `Class created with section${parsedSections.length > 1 ? 's' : ''} ${parsedSections.join(', ')}.`
            : 'Class created. Add a section before enrolling students.'
      );
      await onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={row ? `Edit Class ${row.class_name}` : 'Add class'}
      description="Classes are referenced by id, so renaming one keeps every student, exam and fee record attached to it."
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : row ? 'Save changes' : 'Create class'}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Class name" htmlFor="cl-name" error={errors.className} hint="For example 8, or Nursery.">
            <input id="cl-name" className={inputClass} value={className}
              onChange={e => setClassName(e.target.value)} aria-invalid={!!errors.className} />
          </Field>
          <Field label="Class code" htmlFor="cl-code" error={errors.classCode} hint="Unique across the school.">
            <input id="cl-code" className={inputClass} value={classCode}
              onChange={e => setClassCode(e.target.value)} placeholder="C8" aria-invalid={!!errors.classCode} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Stream" htmlFor="cl-stream" hint="General for most classes; Science or Commerce for senior secondary.">
            <input id="cl-stream" className={inputClass} value={stream} onChange={e => setStream(e.target.value)} />
          </Field>
          <Field label="Display order" htmlFor="cl-order" error={errors.order}
            hint="Sorts every class list. Nursery before 1, and 10 after 9.">
            <input id="cl-order" className={inputClass} value={order} inputMode="numeric"
              onChange={e => setOrder(e.target.value)} aria-invalid={!!errors.order} />
          </Field>
        </div>

        {!row && (
          <Field label="Sections" htmlFor="cl-sections"
            hint="Comma or space separated, e.g. A, B, C. Each is created with capacity 40 — adjust that per section afterwards. Leave blank to add sections later.">
            <input id="cl-sections" className={inputClass} value={sectionsInput}
              onChange={e => setSectionsInput(e.target.value)} placeholder="A, B" />
          </Field>
        )}

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}
            className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500" />
          <span className="text-xs font-semibold text-slate-700">
            Active. Inactive classes stay in the records but disappear from pickers.
          </span>
        </label>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Class workspace
// ---------------------------------------------------------------------

type WorkspaceTab = 'sections' | 'subjects' | 'people';

function ClassWorkspace({
  row, onClose, onChanged,
}: {
  row: ClassDirectoryRow;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { selectedYearId, selectedYear } = useAcademicYear();
  const mayManage = can('academics.manage');

  const [tab, setTab] = useState<WorkspaceTab>('sections');
  const [sections, setSections] = useState<SectionDirectoryRow[]>([]);
  const [subjects, setSubjects] = useState<ClassSubjectRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSectionFormOpen, setIsSectionFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!selectedYearId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [secs, subs] = await Promise.all([
        fetchSectionDirectory(selectedYearId, row.class_id),
        fetchClassSubjects(selectedYearId, row.class_id),
      ]);
      setSections(secs);
      setSubjects(subs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYearId, row.class_id]);

  useEffect(() => { load(); }, [load]);

  const afterChange = async () => { await load(); await onChanged(); };

  const handleSectionActive = async (s: SectionDirectoryRow) => {
    setBusy(true);
    try {
      await updateClassSection(s.class_section_id, { is_active: !s.is_active });
      toast.success(`Section ${row.class_name}-${s.section_name} ${s.is_active ? 'deactivated' : 'reactivated'}.`);
      await afterChange();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSectionDelete = async (s: SectionDirectoryRow) => {
    setBusy(true);
    try {
      await deleteClassSection(s.class_section_id);
      toast.success(`Section ${row.class_name}-${s.section_name} removed.`);
      await afterChange();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm">
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Class ${row.class_name} workspace`}
        className="bg-slate-50 w-full sm:max-w-2xl h-full flex flex-col shadow-xl border-l border-slate-200"
      >
        <header className="bg-white px-5 py-4 border-b border-slate-200">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-black text-slate-900 tracking-tight">Class {row.class_name}</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {row.class_code} · {row.stream} · {selectedYear?.name ?? 'no year selected'}
              </p>
            </div>
            <IconButton onClick={onClose} label="Close workspace">
              <span aria-hidden="true" className="text-base leading-none">×</span>
            </IconButton>
          </div>

          <dl className="grid grid-cols-3 gap-2 mt-4">
            {[
              ['Sections', row.sections_count],
              ['Students', row.students_count],
              ['Subjects', row.subjects_count],
            ].map(([label, value]) => (
              <div key={label as string} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <dt className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</dt>
                <dd className="text-lg font-black text-slate-900 tabular-nums leading-tight">{value}</dd>
              </div>
            ))}
          </dl>

          <nav className="flex gap-1 mt-4" aria-label="Class workspace sections">
            {([
              ['sections', 'Sections'],
              ['subjects', 'Subjects'],
              ['people', 'Teachers & students'],
            ] as [WorkspaceTab, string][]).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={tab === id ? 'true' : undefined}
                className={cn(
                  'px-3 py-2 rounded-xl text-[11px] font-bold transition-colors',
                  tab === id ? 'bg-violet-50 text-violet-700 border border-violet-200' : 'text-slate-500 hover:bg-slate-100'
                )}
              >
                {label}
              </button>
            ))}
          </nav>
        </header>

        <div className="grow overflow-y-auto p-4 space-y-4">
          {isLoading ? <LoadingBlock label="Loading class" /> : error ? (
            <Panel><EmptyBlock icon={AlertTriangle} title="That did not load" description={error}
              actionLabel="Try again" onAction={load} /></Panel>
          ) : (
            <>
              {tab === 'sections' && (
                <Panel
                  title="Sections"
                  description="Academics owns these. Deactivate rather than delete once students have been placed."
                  action={mayManage && (
                    <PrimaryButton onClick={() => setIsSectionFormOpen(true)}>
                      <Plus size={14} aria-hidden="true" /> Add section
                    </PrimaryButton>
                  )}
                >
                  {sections.length === 0 ? (
                    <EmptyBlock
                      icon={Layers}
                      title="No sections configured for this class"
                      description="A section is what students are actually placed into. Add at least one before enrolling."
                      actionLabel={mayManage ? 'Add section' : undefined}
                      onAction={mayManage ? () => setIsSectionFormOpen(true) : undefined}
                    />
                  ) : (
                    <TableScroll minWidth={620}>
                      <thead className="bg-slate-50/70 border-b border-slate-100">
                        <tr>
                          <Th>Section</Th>
                          <Th align="center">Students</Th>
                          <Th align="center">Capacity</Th>
                          <Th>Class teacher</Th>
                          <Th align="right">Actions</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {sections.map(s => (
                          <tr key={s.class_section_id} className={cn(!s.is_active && 'opacity-60')}>
                            <td className="py-3 px-4">
                              <span className="font-extrabold text-slate-900">{row.class_name}-{s.section_name}</span>
                              {s.room_no && <span className="block text-[10px] text-slate-400 font-semibold">Room {s.room_no}</span>}
                              {!s.is_active && <StatusPill tone="muted">Inactive</StatusPill>}
                            </td>
                            <td className="py-3 px-4 text-center font-bold tabular-nums text-slate-700">{s.students_count}</td>
                            <td className="py-3 px-4 text-center tabular-nums text-slate-500">{s.capacity ?? '—'}</td>
                            <td className="py-3 px-4">
                              {s.class_teacher_name
                                ? <span className="font-semibold text-slate-700">{s.class_teacher_name}</span>
                                : <span className="text-[11px] text-slate-400">Not assigned</span>}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-end gap-1">
                                <IconButton
                                  onClick={() => navigate('/dashboard/students', {
                                    state: { classFilter: row.class_id, sectionFilter: s.section_id },
                                  })}
                                  label={`View students in ${row.class_name}-${s.section_name}`}
                                >
                                  <ArrowUpRight size={14} />
                                </IconButton>
                                {mayManage && (
                                  <>
                                    <IconButton onClick={() => handleSectionActive(s)} disabled={busy}
                                      label={s.is_active ? 'Deactivate section' : 'Reactivate section'}>
                                      <Power size={14} />
                                    </IconButton>
                                    <IconButton onClick={() => handleSectionDelete(s)} disabled={busy}
                                      tone="danger" label={`Remove section ${s.section_name}`}>
                                      <Trash2 size={14} />
                                    </IconButton>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </TableScroll>
                  )}
                </Panel>
              )}

              {tab === 'subjects' && (
                <Panel
                  title="Subjects offered"
                  description={`What Class ${row.class_name} is taught in ${selectedYear?.name ?? 'this year'}. Examination and Timetable read this list.`}
                >
                  {subjects.length === 0 ? (
                    <EmptyBlock
                      title="No subjects mapped to this class"
                      description="Until subjects are mapped, Examination has nothing to build an exam from and the timetable has nothing to schedule."
                      actionLabel="Go to Class Subjects"
                      onAction={() => { onClose(); navigate('/dashboard/academics/class-subjects'); }}
                    />
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {subjects.map(s => (
                        <li key={s.mapping_id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-slate-900">
                              {s.subject_name}
                              {s.section_name && <span className="ml-1.5 text-[10px] font-black text-violet-600">Section {s.section_name} only</span>}
                            </p>
                            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                              {s.subject_code} · {s.subject_type} · {s.is_mandatory ? 'Mandatory' : 'Optional'}
                            </p>
                          </div>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {s.teacher_names ?? 'No teacher assigned'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              )}

              {tab === 'people' && (
                <Panel
                  title="Teachers and students"
                  description="Owned by other modules. Academics links across with this class and year already applied."
                >
                  <ul className="divide-y divide-slate-100">
                    {[
                      {
                        label: 'Students in this class',
                        detail: `${row.students_count} enrolled for ${selectedYear?.name ?? 'this year'}`,
                        to: '/dashboard/students',
                        state: { classFilter: row.class_id },
                      },
                      {
                        label: 'Teacher assignments',
                        detail: row.class_teacher_names
                          ? `Class teacher: ${row.class_teacher_names}. ${row.teachers_count} teacher(s) assigned.`
                          : 'No class teacher assigned for this year.',
                        to: '/dashboard/teachers',
                        state: { activeTab: 'assignments', classFilter: row.class_id },
                      },
                      {
                        label: 'Attendance',
                        detail: 'Daily marking for this class and section',
                        to: '/dashboard/attendance',
                        state: { classFilter: row.class_name },
                      },
                      {
                        label: 'Examination',
                        detail: 'Exams, marks and results for this class',
                        to: '/dashboard/examination',
                        state: { classFilter: row.class_id },
                      },
                    ].map(link => (
                      <li key={link.label}>
                        <button
                          onClick={() => { onClose(); navigate(link.to, { state: link.state }); }}
                          className="w-full text-left px-5 py-3.5 hover:bg-slate-50 transition-colors group focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-600"
                        >
                          <span className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 group-hover:text-violet-700">
                            {link.label}
                            <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                          </span>
                          <span className="block text-[11px] text-slate-500 mt-0.5">{link.detail}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </>
          )}
        </div>
      </aside>

      {isSectionFormOpen && (
        <SectionForm
          classRow={row}
          existing={sections.map(s => s.section_name)}
          onClose={() => setIsSectionFormOpen(false)}
          onSaved={async () => { setIsSectionFormOpen(false); await afterChange(); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Section form
// ---------------------------------------------------------------------

function SectionForm({
  classRow, existing, onClose, onSaved,
}: {
  classRow: ClassDirectoryRow;
  existing: string[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('40');
  const [roomNo, setRoomNo] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const validate = () => {
    const next: Record<string, string> = {};
    const letter = name.trim().toUpperCase();
    if (!letter) next.name = 'A section needs a label, usually a single letter.';
    else if (existing.includes(letter)) next.name = `Class ${classRow.class_name} already runs section ${letter}.`;
    if (!/^\d+$/.test(capacity) || Number(capacity) < 1) next.capacity = 'Capacity must be a positive whole number.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      await attachSectionToClass({
        class_id: classRow.class_id,
        section_name: name,
        capacity: Number(capacity),
        room_no: roomNo.trim() || null,
      });
      toast.success(`Section ${classRow.class_name}-${name.trim().toUpperCase()} added.`);
      await onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Add a section to Class ${classRow.class_name}`}
      description="Section letters are shared across the school. Reusing A here does not affect any other class."
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Add section'}</PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Section" htmlFor="sec-name" error={errors.name} hint="A single letter is conventional.">
          <input id="sec-name" className={inputClass} value={name} maxLength={4}
            onChange={e => setName(e.target.value)} placeholder="A" aria-invalid={!!errors.name} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Capacity" htmlFor="sec-cap" error={errors.capacity}>
            <input id="sec-cap" className={inputClass} value={capacity} inputMode="numeric"
              onChange={e => setCapacity(e.target.value)} aria-invalid={!!errors.capacity} />
          </Field>
          <Field label="Room" htmlFor="sec-room" hint="Optional.">
            <input id="sec-room" className={inputClass} value={roomNo} onChange={e => setRoomNo(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
