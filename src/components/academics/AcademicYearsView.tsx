import React, { useState } from 'react';
import { CalendarRange, Plus, Edit2, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useAcademicYear } from '@/context/AcademicYearContext';
import {
  saveAcademicYear, setCurrentAcademicYear, deleteAcademicYear,
  type AcademicYear, type AcademicYearStatus,
} from '@/services/academicsService';
import {
  AsyncBlock, EmptyBlock, Field, GhostButton, IconButton, Modal, Panel,
  PrimaryButton, StatusPill, TableScroll, Th, inputClass, selectClass,
} from './shared';

const STATUS_TONE: Record<AcademicYearStatus, 'good' | 'info' | 'muted'> = {
  active: 'good', upcoming: 'info', completed: 'muted', archived: 'muted',
};

/**
 * The academic year lifecycle.
 *
 * The years come from academic_years and nothing here is hard coded, so
 * a school that runs 2027-28 gets it by creating it rather than by
 * someone editing a constant in the bundle.
 *
 * Making a year current goes through set_current_academic_year(), which
 * clears the previous one in the same statement. A partial unique index
 * makes two current years impossible, so doing it as two client updates
 * would fail on the second.
 */
export default function AcademicYearsView() {
  const { can } = useAuth();
  const { years, isLoading, error, refresh } = useAcademicYear();
  const mayManage = can('academics.manage');

  const [editing, setEditing] = useState<AcademicYear | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AcademicYear | null>(null);
  const [busy, setBusy] = useState(false);

  const openCreate = () => { setEditing(null); setIsFormOpen(true); };
  const openEdit = (y: AcademicYear) => { setEditing(y); setIsFormOpen(true); };

  const handleMakeCurrent = async (y: AcademicYear) => {
    setBusy(true);
    try {
      await setCurrentAcademicYear(y.id);
      toast.success(`${y.name} is now the current academic year.`);
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await deleteAcademicYear(confirmDelete.id);
      toast.success(`${confirmDelete.name} deleted.`);
      setConfirmDelete(null);
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Panel
        title="Academic years"
        description="The sessions the school runs. Exactly one may be current."
        action={mayManage && (
          <PrimaryButton onClick={openCreate}>
            <Plus size={14} aria-hidden="true" /> Add academic year
          </PrimaryButton>
        )}
      >
        <AsyncBlock
          isLoading={isLoading}
          error={error}
          isEmpty={years.length === 0}
          onRetry={refresh}
          loadingLabel="Loading academic years"
          empty={
            <EmptyBlock
              icon={CalendarRange}
              title="No academic years created yet"
              description="Every class list, fee run, exam and attendance record is scoped to an academic year. Create the first one to begin."
              actionLabel={mayManage ? 'Create academic year' : undefined}
              onAction={mayManage ? openCreate : undefined}
            />
          }
        >
          <TableScroll minWidth={780}>
            <thead className="bg-slate-50/70 border-b border-slate-100">
              <tr>
                <Th>Academic year</Th>
                <Th>Starts</Th>
                <Th>Ends</Th>
                <Th align="center">Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {years.map(y => (
                <tr key={y.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-extrabold text-slate-900">{y.name}</span>
                    {y.is_current && (
                      <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-emerald-600">Current</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">{y.start_date}</td>
                  <td className="py-3 px-4 font-mono text-slate-500">{y.end_date}</td>
                  <td className="py-3 px-4 text-center">
                    <StatusPill tone={STATUS_TONE[y.status]}>{y.status}</StatusPill>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      {mayManage && !y.is_current && (
                        <GhostButton onClick={() => handleMakeCurrent(y)} disabled={busy} className="h-[30px] px-2.5">
                          <CheckCircle2 size={12} aria-hidden="true" /> Make current
                        </GhostButton>
                      )}
                      {mayManage && (
                        <>
                          <IconButton onClick={() => openEdit(y)} label={`Edit ${y.name}`}>
                            <Edit2 size={14} />
                          </IconButton>
                          <IconButton onClick={() => setConfirmDelete(y)} label={`Delete ${y.name}`} tone="danger" disabled={y.is_current}>
                            <Trash2 size={14} />
                          </IconButton>
                        </>
                      )}
                      {!mayManage && <span className="text-[11px] text-slate-400">View only</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        </AsyncBlock>
      </Panel>

      {isFormOpen && (
        <AcademicYearForm
          year={editing}
          onClose={() => setIsFormOpen(false)}
          onSaved={async () => { setIsFormOpen(false); await refresh(); }}
        />
      )}

      {confirmDelete && (
        <Modal
          title={`Delete ${confirmDelete.name}?`}
          description="This cannot be undone."
          onClose={() => setConfirmDelete(null)}
          footer={
            <>
              <GhostButton onClick={() => setConfirmDelete(null)}>Cancel</GhostButton>
              <PrimaryButton onClick={handleDelete} disabled={busy} className="bg-rose-600 hover:bg-rose-700">
                Delete year
              </PrimaryButton>
            </>
          }
        >
          <p className="text-xs text-slate-600 leading-relaxed">
            The database refuses this if any student is enrolled in {confirmDelete.name}, so history cannot be
            lost by accident. If it holds enrolment, set its status to archived instead.
          </p>
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------------

function AcademicYearForm({
  year, onClose, onSaved,
}: {
  year: AcademicYear | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(year?.name ?? '');
  const [startDate, setStartDate] = useState(year?.start_date ?? '');
  const [endDate, setEndDate] = useState(year?.end_date ?? '');
  const [status, setStatus] = useState<AcademicYearStatus>(year?.status ?? 'upcoming');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Give the year a label, for example 2027-28.';
    if (!startDate) next.startDate = 'A start date is required.';
    if (!endDate) next.endDate = 'An end date is required.';
    if (startDate && endDate && endDate <= startDate) next.endDate = 'The end date must fall after the start date.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      await saveAcademicYear({ id: year?.id, name, start_date: startDate, end_date: endDate, status });
      toast.success(year ? 'Academic year updated.' : 'Academic year created.');
      await onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={year ? `Edit ${year.name}` : 'Add academic year'}
      description="Sessions are used by every module to scope students, fees, exams and attendance."
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={submit as any} disabled={busy} type="button">
            {busy ? 'Saving…' : year ? 'Save changes' : 'Create year'}
          </PrimaryButton>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Label" htmlFor="ay-name" error={errors.name} hint="How the session is written across the school, for example 2027-28.">
          <input
            id="ay-name" className={inputClass} value={name}
            onChange={e => setName(e.target.value)} placeholder="2027-28"
            aria-invalid={!!errors.name} aria-describedby={errors.name ? 'ay-name-error' : undefined}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Start date" htmlFor="ay-start" error={errors.startDate}>
            <input id="ay-start" type="date" className={inputClass} value={startDate}
              onChange={e => setStartDate(e.target.value)} aria-invalid={!!errors.startDate} />
          </Field>
          <Field label="End date" htmlFor="ay-end" error={errors.endDate}>
            <input id="ay-end" type="date" className={inputClass} value={endDate}
              onChange={e => setEndDate(e.target.value)} aria-invalid={!!errors.endDate} />
          </Field>
        </div>

        <Field
          label="Status" htmlFor="ay-status"
          hint="Making a year current is a separate action from the list, so it cannot happen by accident while editing dates."
        >
          <select id="ay-status" className={selectClass} value={status}
            onChange={e => setStatus(e.target.value as AcademicYearStatus)}>
            <option value="upcoming">Upcoming</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
      </form>
    </Modal>
  );
}
