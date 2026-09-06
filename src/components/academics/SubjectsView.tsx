import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Plus, Edit2, Trash2, Search, Power, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useAcademicYear } from '@/context/AcademicYearContext';
import {
  fetchSubjectDirectory, saveSubject, setSubjectActive, deleteSubject,
  type SubjectDirectoryRow, type Subject,
} from '@/services/academicsService';
import {
  AsyncBlock, EmptyBlock, Field, GhostButton, IconButton, Modal, Panel,
  PrimaryButton, StatusPill, TableScroll, Th, inputClass, selectClass,
} from './shared';

/**
 * The subject master.
 *
 * This is the only list of subjects in the ERP. Examination, Timetable
 * and Attendance reference subjects.id; none of them may create a
 * subject. The reference counts in this table are how you see whether
 * they are doing so.
 *
 * Deleting is guarded in the database: a subject with marks against it
 * or a class mapping raises a message naming the count. Deactivating is
 * the normal way to retire one.
 */
export default function SubjectsView({ onNavigateView }: { onNavigateView: (view: string) => void }) {
  const { can } = useAuth();
  const { selectedYearId, selectedYear } = useAcademicYear();
  const mayManage = can('academics.manage');

  const [rows, setRows] = useState<SubjectDirectoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [editing, setEditing] = useState<SubjectDirectoryRow | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<SubjectDirectoryRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!selectedYearId) return;
    setIsLoading(true);
    setError(null);
    try {
      setRows(await fetchSubjectDirectory(selectedYearId));
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
        || r.subject_name.toLowerCase().includes(q)
        || (r.subject_code ?? '').toLowerCase().includes(q);
      const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? r.is_active : !r.is_active);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [rows, search, categoryFilter, statusFilter]);

  const handleToggleActive = async (r: SubjectDirectoryRow) => {
    setBusy(true);
    try {
      await setSubjectActive(r.subject_id, !r.is_active);
      toast.success(`${r.subject_name} ${r.is_active ? 'deactivated' : 'reactivated'}.`);
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
      await deleteSubject(confirmDelete.subject_id);
      toast.success(`${confirmDelete.subject_name} deleted.`);
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
        title="Subjects"
        description={`The school's subject master. Class counts are for ${selectedYear?.name ?? 'the selected year'}.`}
        action={
          <>
            <GhostButton onClick={load} title="Reload" disabled={isLoading}>
              <RefreshCw size={13} className={cn(isLoading && 'animate-spin')} aria-hidden="true" /> Reload
            </GhostButton>
            {mayManage && (
              <PrimaryButton onClick={() => { setEditing(null); setIsFormOpen(true); }}>
                <Plus size={14} aria-hidden="true" /> Add subject
              </PrimaryButton>
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/40">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <input className={inputClass + ' pl-8'} placeholder="Search subject or code"
              value={search} onChange={e => setSearch(e.target.value)} aria-label="Search subjects" />
          </div>
          <select className={selectClass + ' w-auto'} value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)} aria-label="Filter by category">
            <option value="all">All categories</option>
            <option value="Scholastic">Scholastic</option>
            <option value="Co-Scholastic">Co-Scholastic</option>
          </select>
          <select className={selectClass + ' w-auto'} value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)} aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          {(search || categoryFilter !== 'all' || statusFilter !== 'all') && (
            <GhostButton onClick={() => { setSearch(''); setCategoryFilter('all'); setStatusFilter('all'); }}>
              Reset
            </GhostButton>
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
          loadingLabel="Loading subjects"
          empty={
            <EmptyBlock
              icon={BookOpen}
              title="No subjects created yet"
              description="Subjects are the one list the whole ERP shares. Examination, Timetable and Attendance all read it."
              actionLabel={mayManage ? 'Add subject' : undefined}
              onAction={mayManage ? () => { setEditing(null); setIsFormOpen(true); } : undefined}
            />
          }
        >
          {filtered.length === 0 ? (
            <EmptyBlock
              icon={Search}
              title="Nothing matches that search"
              description="Try a different subject name or code, or reset the filters."
              actionLabel="Reset filters"
              onAction={() => { setSearch(''); setCategoryFilter('all'); setStatusFilter('all'); }}
            />
          ) : (
            <TableScroll minWidth={880}>
              <thead className="bg-slate-50/70 border-b border-slate-100">
                <tr>
                  <Th>Subject</Th>
                  <Th align="center">Code</Th>
                  <Th align="center">Type</Th>
                  <Th>Classes</Th>
                  <Th align="center">Teachers</Th>
                  <Th align="center">Status</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map(r => (
                  <tr key={r.subject_id} className={cn('hover:bg-slate-50/50 transition-colors', !r.is_active && 'opacity-60')}>
                    <td className="py-3 px-4">
                      <span className="font-extrabold text-slate-900">{r.subject_name}</span>
                      <span className="block text-[10px] text-slate-400 font-semibold mt-0.5">{r.category}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-600">{r.subject_code ?? '—'}</td>
                    <td className="py-3 px-4 text-center text-slate-600 font-semibold">{r.subject_type}</td>
                    <td className="py-3 px-4">
                      {r.classes_count === 0
                        ? <span className="text-[11px] text-slate-400">Not mapped to any class</span>
                        : <span className="text-slate-700 font-semibold">{r.class_labels}</span>}
                    </td>
                    <td className="py-3 px-4 text-center font-bold tabular-nums text-slate-700">{r.teachers_count}</td>
                    <td className="py-3 px-4 text-center">
                      <StatusPill tone={r.is_active ? 'good' : 'muted'}>{r.is_active ? 'Active' : 'Inactive'}</StatusPill>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        {mayManage ? (
                          <>
                            <IconButton onClick={() => { setEditing(r); setIsFormOpen(true); }} label={`Edit ${r.subject_name}`}>
                              <Edit2 size={14} />
                            </IconButton>
                            <IconButton onClick={() => handleToggleActive(r)} disabled={busy}
                              label={r.is_active ? `Deactivate ${r.subject_name}` : `Reactivate ${r.subject_name}`}>
                              <Power size={14} />
                            </IconButton>
                            <IconButton onClick={() => setConfirmDelete(r)} tone="danger" label={`Delete ${r.subject_name}`}>
                              <Trash2 size={14} />
                            </IconButton>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-400">View only</span>
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

      {rows.some(r => r.classes_count === 0 && r.is_active) && !isLoading && (
        <p className="text-[11px] text-slate-500 px-1">
          Some active subjects are not taught to any class this year.{' '}
          <button onClick={() => onNavigateView('class-subjects')}
            className="font-bold text-violet-600 hover:text-violet-800 underline underline-offset-2">
            Map them to classes
          </button>
        </p>
      )}

      {isFormOpen && (
        <SubjectForm
          row={editing}
          onClose={() => setIsFormOpen(false)}
          onSaved={async () => { setIsFormOpen(false); await load(); }}
        />
      )}

      {confirmDelete && (
        <Modal
          title={`Delete ${confirmDelete.subject_name}?`}
          onClose={() => { setConfirmDelete(null); setDeleteError(null); }}
          footer={
            <>
              <GhostButton onClick={() => { setConfirmDelete(null); setDeleteError(null); }}>Cancel</GhostButton>
              <PrimaryButton onClick={handleDelete} disabled={busy} className="bg-rose-600 hover:bg-rose-700">
                Delete subject
              </PrimaryButton>
            </>
          }
        >
          <p className="text-xs text-slate-600 leading-relaxed">
            {confirmDelete.has_marks
              ? 'This subject has marks recorded against it. The database will refuse the delete, because removing it would take those results with it. Deactivate it instead.'
              : confirmDelete.classes_count > 0
                ? `This subject is mapped to ${confirmDelete.classes_count} class(es). Remove those mappings first, or deactivate the subject instead.`
                : 'Nothing references this subject, so it can be removed. Deactivating keeps it in the record if you may want it back.'}
          </p>
          {deleteError && (
            <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {deleteError}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------------

function SubjectForm({
  row, onClose, onSaved,
}: {
  row: SubjectDirectoryRow | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(row?.subject_name ?? '');
  const [code, setCode] = useState(row?.subject_code ?? '');
  const [category, setCategory] = useState<Subject['category']>((row?.category as any) ?? 'Scholastic');
  const [type, setType] = useState<Subject['subject_type']>((row?.subject_type as any) ?? 'Theory');
  const [isActive, setIsActive] = useState(row?.is_active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'A subject needs a name.';
    if (!code.trim()) next.code = 'A code is required, and it must be unique.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      await saveSubject({
        id: row?.subject_id,
        subject_name: name,
        subject_code: code,
        category,
        subject_type: type,
        is_active: isActive,
      });
      toast.success(row ? 'Subject updated.' : 'Subject created.');
      await onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={row ? `Edit ${row.subject_name}` : 'Add subject'}
      description="Every module reads this list. Adding a subject here makes it available to Examination, Timetable and Attendance."
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : row ? 'Save changes' : 'Create subject'}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Subject name" htmlFor="sub-name" error={errors.name}>
            <input id="sub-name" className={inputClass} value={name}
              onChange={e => setName(e.target.value)} placeholder="Mathematics" aria-invalid={!!errors.name} />
          </Field>
          <Field label="Code" htmlFor="sub-code" error={errors.code} hint="Unique across the school.">
            <input id="sub-code" className={inputClass} value={code}
              onChange={e => setCode(e.target.value)} placeholder="MATH" aria-invalid={!!errors.code} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Category" htmlFor="sub-cat" hint="Co-scholastic subjects are graded, not marked.">
            <select id="sub-cat" className={selectClass} value={category}
              onChange={e => setCategory(e.target.value as any)}>
              <option value="Scholastic">Scholastic</option>
              <option value="Co-Scholastic">Co-Scholastic</option>
            </select>
          </Field>
          <Field label="Assessment type" htmlFor="sub-type">
            <select id="sub-type" className={selectClass} value={type}
              onChange={e => setType(e.target.value as any)}>
              <option value="Theory">Theory</option>
              <option value="Practical">Practical</option>
              <option value="Theory + Practical">Theory + Practical</option>
              <option value="Activity">Activity</option>
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}
            className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500" />
          <span className="text-xs font-semibold text-slate-700">
            Active. Inactive subjects stay on existing records but cannot be newly mapped.
          </span>
        </label>
      </div>
    </Modal>
  );
}
