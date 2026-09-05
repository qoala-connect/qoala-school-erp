import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Trash2, Copy, RefreshCw, ArrowUpRight, Layers, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useAcademicYear } from '@/context/AcademicYearContext';
import {
  fetchClassSubjects, fetchClasses, fetchSubjects, fetchSectionDirectory,
  addClassSubjects, updateClassSubject, removeClassSubject, copyClassSubjects,
  fetchCurriculumGaps, importClassSubjectsFromTimetable,
  type ClassSubjectRow, type SchoolClass, type Subject, type SectionDirectoryRow,
  type CurriculumGap,
} from '@/services/academicsService';
import {
  AsyncBlock, EmptyBlock, Field, GhostButton, IconButton, Modal, Panel,
  PrimaryButton, StatusPill, TableScroll, Th, selectClass,
} from './shared';

/**
 * Which subjects each class is taught, for the selected academic year.
 *
 * This is the relationship Examination and Timetable consume. Before it
 * existed as a maintained list, an exam had to be given a subject by
 * hand and nothing checked that the class was actually taught it.
 *
 * A mapping with no section applies to the whole class, which is the
 * normal case. Naming a section restricts it to that section, which is
 * what an elective needs. The unique index counts a null section as a
 * value, so the same whole-class subject cannot be added twice.
 */
export default function ClassSubjectsView() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { selectedYearId, selectedYear, years } = useAcademicYear();
  const mayManage = can('academics.manage');

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [rows, setRows] = useState<ClassSubjectRow[]>([]);
  const [classFilter, setClassFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCopyOpen, setIsCopyOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<ClassSubjectRow | null>(null);
  const [busy, setBusy] = useState(false);

  // Subjects the timetable schedules that this list never named. The two
  // disagreeing is invisible from either screen on its own, and it is the
  // curriculum that the report card and the exam read.
  const [gaps, setGaps] = useState<CurriculumGap[]>([]);

  const load = useCallback(async () => {
    if (!selectedYearId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [cls, mappings] = await Promise.all([
        fetchClasses(),
        fetchClassSubjects(selectedYearId, classFilter === 'all' ? null : classFilter),
      ]);
      setClasses(cls);
      setRows(mappings);
      // A gap in one class is still a gap while the list is filtered to
      // another, so this is always counted across the whole year.
      setGaps(await fetchCurriculumGaps(selectedYearId));
    } catch (err: any) {
      setError(err.message);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYearId, classFilter]);

  useEffect(() => { load(); }, [load]);

  /** Grouped by class, because that is the unit an administrator thinks in. */
  const grouped = useMemo(() => {
    const map = new Map<string, { class_name: string; class_id: string; items: ClassSubjectRow[] }>();
    for (const r of rows) {
      if (!map.has(r.class_id)) map.set(r.class_id, { class_name: r.class_name, class_id: r.class_id, items: [] });
      map.get(r.class_id)!.items.push(r);
    }
    const order = new Map(classes.map(c => [c.id, c.display_order]));
    return [...map.values()].sort((a, b) => (order.get(a.class_id) ?? 999) - (order.get(b.class_id) ?? 999));
  }, [rows, classes]);

  const handleImportGaps = async () => {
    if (!selectedYearId) return;
    setBusy(true);
    try {
      const added = await importClassSubjectsFromTimetable(selectedYearId);
      toast.success(added === 0
        ? 'The curriculum already covers everything on the timetable.'
        : `${added} subject${added === 1 ? '' : 's'} added to the curriculum.`);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleMandatory = async (r: ClassSubjectRow) => {
    setBusy(true);
    try {
      await updateClassSubject(r.mapping_id, { is_mandatory: !r.is_mandatory });
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Teacher assignments belong to Teacher Management, so this hands the row
   * over rather than editing it here. The class, section, subject and year
   * travel with the link so the assignment form opens already describing
   * the gap the user clicked on.
   */
  const assignTeacher = (r: ClassSubjectRow) => {
    navigate('/dashboard/teachers', {
      state: {
        activeTab: 'assignments',
        assign: {
          academicYearId: selectedYearId,
          classId: r.class_id,
          sectionId: r.section_id,
          subjectId: r.subject_id,
          assignmentType: 'subject_teacher',
        },
      },
    });
  };

  const handleRemove = async () => {
    if (!confirmRemove) return;
    setBusy(true);
    try {
      await removeClassSubject(confirmRemove.mapping_id);
      toast.success(`${confirmRemove.subject_name} removed from Class ${confirmRemove.class_name}.`);
      setConfirmRemove(null);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Panel
        title="Class subjects"
        description={`Which subjects each class is taught in ${selectedYear?.name ?? 'the selected year'}. Examination and Timetable read this.`}
        action={
          <>
            <GhostButton onClick={load} title="Reload" disabled={isLoading}>
              <RefreshCw size={13} className={cn(isLoading && 'animate-spin')} aria-hidden="true" /> Reload
            </GhostButton>
            {mayManage && years.length > 1 && (
              <GhostButton onClick={() => setIsCopyOpen(true)}>
                <Copy size={13} aria-hidden="true" /> Copy from year
              </GhostButton>
            )}
            {mayManage && (
              <PrimaryButton onClick={() => setIsAddOpen(true)}>
                <Plus size={14} aria-hidden="true" /> Map subjects
              </PrimaryButton>
            )}
          </>
        }
      >
        {gaps.length > 0 && (
          <div className="flex flex-wrap items-start gap-3 px-5 py-3.5 border-b border-amber-200 bg-amber-50">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-amber-900">
                The timetable teaches {gaps.length} subject{gaps.length === 1 ? '' : 's'} this list does not name.
              </p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Examination, marks and the student portal read this list, not the timetable, so those
                subjects are missing from all three. Affected: {[...new Set(gaps.map(g => `Class ${g.class_name}`))].join(', ')}.
              </p>
            </div>
            {mayManage && (
              <PrimaryButton onClick={handleImportGaps} disabled={busy}
                className="bg-amber-600 hover:bg-amber-700">
                {busy ? 'Adding…' : 'Add them to the curriculum'}
              </PrimaryButton>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/40">
          <label htmlFor="cs-class" className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Class</label>
          <select id="cs-class" className={selectClass + ' w-auto'} value={classFilter}
            onChange={e => setClassFilter(e.target.value)}>
            <option value="all">All classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>Class {c.class_name}</option>)}
          </select>
          <span className="text-[11px] font-semibold text-slate-400 ml-auto tabular-nums">
            {rows.length} mapping{rows.length === 1 ? '' : 's'}
          </span>
        </div>

        <AsyncBlock
          isLoading={isLoading}
          error={error}
          isEmpty={rows.length === 0}
          onRetry={load}
          loadingLabel="Loading class subjects"
          empty={
            <EmptyBlock
              icon={BookOpen}
              title={classFilter === 'all'
                ? `No subjects mapped for ${selectedYear?.name ?? 'this year'}`
                : 'No subjects mapped to this class'}
              description={years.length > 1
                ? 'A new academic year starts empty. Map subjects now, or copy the whole offering across from another year.'
                : 'Until a class is mapped to subjects, Examination has nothing to build an exam from and the timetable has nothing to schedule.'}
              actionLabel={mayManage ? 'Map subjects' : undefined}
              onAction={mayManage ? () => setIsAddOpen(true) : undefined}
            />
          }
        >
          <div className="divide-y divide-slate-100">
            {grouped.map(group => (
              <section key={group.class_id}>
                <header className="flex items-center justify-between gap-3 px-5 py-2.5 bg-slate-50/60">
                  <h3 className="text-xs font-black text-slate-800">Class {group.class_name}</h3>
                  <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                    {group.items.length} subject{group.items.length === 1 ? '' : 's'}
                  </span>
                </header>
                <TableScroll minWidth={780}>
                  <thead className="sr-only">
                    <tr>
                      <Th>Subject</Th><Th>Applies to</Th><Th>Requirement</Th><Th>Teacher</Th><Th align="right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {group.items.map(r => (
                      <tr key={r.mapping_id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 w-[28%]">
                          <span className="font-extrabold text-slate-900">{r.subject_name}</span>
                          <span className="block text-[10px] text-slate-400 font-semibold mt-0.5">
                            {r.subject_code} · {r.subject_type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {r.section_name
                            ? <StatusPill tone="info">Section {r.section_name} only</StatusPill>
                            : <span className="text-[11px] text-slate-500 font-medium">Whole class</span>}
                        </td>
                        <td className="py-3 px-4">
                          {mayManage ? (
                            <button
                              onClick={() => handleToggleMandatory(r)}
                              disabled={busy}
                              className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 rounded-full disabled:opacity-50"
                              title="Switch between mandatory and optional"
                            >
                              <StatusPill tone={r.is_mandatory ? 'good' : 'muted'}>
                                {r.is_mandatory ? 'Mandatory' : 'Optional'}
                              </StatusPill>
                            </button>
                          ) : (
                            <StatusPill tone={r.is_mandatory ? 'good' : 'muted'}>
                              {r.is_mandatory ? 'Mandatory' : 'Optional'}
                            </StatusPill>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {r.teacher_names ? (
                            <span className="inline-flex items-center gap-2 flex-wrap">
                              <span className="text-slate-700 font-semibold">{r.teacher_names}</span>
                              <button
                                onClick={() => assignTeacher(r)}
                                className="text-[11px] font-bold text-violet-600 hover:text-violet-800 underline underline-offset-2 inline-flex items-center gap-1"
                                title={`Assign another teacher to ${r.subject_name} in Class ${r.class_name}`}
                              >
                                Assign another <ArrowUpRight size={11} aria-hidden="true" />
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => assignTeacher(r)}
                              className="text-[11px] font-bold text-amber-600 hover:text-amber-800 underline underline-offset-2 inline-flex items-center gap-1"
                            >
                              Assign a teacher <ArrowUpRight size={11} aria-hidden="true" />
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end">
                            {mayManage && (
                              <IconButton onClick={() => setConfirmRemove(r)} tone="danger"
                                label={`Remove ${r.subject_name} from Class ${r.class_name}`}>
                                <Trash2 size={14} />
                              </IconButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </TableScroll>
              </section>
            ))}
          </div>
        </AsyncBlock>
      </Panel>

      {isAddOpen && selectedYearId && (
        <MapSubjectsModal
          academicYearId={selectedYearId}
          classes={classes}
          existing={rows}
          preselectedClassId={classFilter === 'all' ? null : classFilter}
          onClose={() => setIsAddOpen(false)}
          onSaved={async () => { setIsAddOpen(false); await load(); }}
        />
      )}

      {isCopyOpen && selectedYearId && selectedYear && (
        <CopyYearModal
          toYear={selectedYear}
          onClose={() => setIsCopyOpen(false)}
          onSaved={async () => { setIsCopyOpen(false); await load(); }}
        />
      )}

      {confirmRemove && (
        <Modal
          title={`Remove ${confirmRemove.subject_name} from Class ${confirmRemove.class_name}?`}
          onClose={() => setConfirmRemove(null)}
          footer={
            <>
              <GhostButton onClick={() => setConfirmRemove(null)}>Cancel</GhostButton>
              <PrimaryButton onClick={handleRemove} disabled={busy} className="bg-rose-600 hover:bg-rose-700">
                Remove mapping
              </PrimaryButton>
            </>
          }
        >
          <p className="text-xs text-slate-600 leading-relaxed">
            This removes the offering for {selectedYear?.name}. It does not touch the subject itself, any marks
            already recorded, or the same mapping in another year.
          </p>
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------------

function MapSubjectsModal({
  academicYearId, classes, existing, preselectedClassId, onClose, onSaved,
}: {
  academicYearId: string;
  classes: SchoolClass[];
  existing: ClassSubjectRow[];
  preselectedClassId: string | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [classId, setClassId] = useState(preselectedClassId ?? classes[0]?.id ?? '');
  const [sectionId, setSectionId] = useState<string>('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sections, setSections] = useState<SectionDirectoryRow[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [isMandatory, setIsMandatory] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const [subs, secs] = await Promise.all([
          fetchSubjects(true),
          classId ? fetchSectionDirectory(academicYearId, classId) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setSubjects(subs);
        setSections(secs);
      } catch (err: any) {
        if (!cancelled) setFormError(err.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [academicYearId, classId]);

  // Subjects already mapped to this class with the same scope cannot be
  // mapped again, so they are shown as taken rather than silently
  // dropped by the unique index.
  const alreadyMapped = useMemo(() => {
    const wanted = sectionId || null;
    return new Set(
      existing
        .filter(r => r.class_id === classId && (r.section_id ?? null) === wanted)
        .map(r => r.subject_id)
    );
  }, [existing, classId, sectionId]);

  const toggle = (id: string) => {
    setPicked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const submit = async () => {
    setFormError(null);
    if (!classId) { setFormError('Choose a class.'); return; }
    if (picked.size === 0) { setFormError('Choose at least one subject.'); return; }

    setBusy(true);
    try {
      const added = await addClassSubjects({
        academic_year_id: academicYearId,
        class_id: classId,
        subject_ids: [...picked],
        section_id: sectionId || null,
        is_mandatory: isMandatory,
      });
      toast.success(added === picked.size
        ? `${added} subject(s) mapped.`
        : `${added} subject(s) mapped. The rest were already mapped.`);
      await onSaved();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const selectedClass = classes.find(c => c.id === classId);

  return (
    <Modal
      wide
      title="Map subjects to a class"
      description="Choose the class, then everything it is taught. Repeat per class, or copy a whole year across."
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={submit} disabled={busy || picked.size === 0}>
            {busy ? 'Saving…' : `Map ${picked.size || ''} subject${picked.size === 1 ? '' : 's'}`.trim()}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Class" htmlFor="ms-class">
            <select id="ms-class" className={selectClass} value={classId}
              onChange={e => { setClassId(e.target.value); setSectionId(''); setPicked(new Set()); }}>
              {classes.map(c => <option key={c.id} value={c.id}>Class {c.class_name}</option>)}
            </select>
          </Field>
          <Field label="Applies to" htmlFor="ms-section"
            hint="Leave as the whole class unless this is an elective for one section.">
            <select id="ms-section" className={selectClass} value={sectionId}
              onChange={e => { setSectionId(e.target.value); setPicked(new Set()); }}>
              <option value="">Whole class</option>
              {sections.map(s => (
                <option key={s.section_id} value={s.section_id}>
                  Section {s.section_name} only
                </option>
              ))}
            </select>
          </Field>
        </div>

        <fieldset>
          <legend className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
            Subjects {selectedClass && `for Class ${selectedClass.class_name}`}
          </legend>

          {isLoading ? (
            <p className="text-xs text-slate-400 py-6 text-center">Loading subjects…</p>
          ) : subjects.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No active subjects exist yet. Create them under Subjects first.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1">
              {subjects.map(s => {
                const taken = alreadyMapped.has(s.id);
                return (
                  <label
                    key={s.id}
                    className={cn(
                      'flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-colors',
                      taken ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-60'
                            : picked.has(s.id) ? 'bg-violet-50 border-violet-300 cursor-pointer'
                            : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 w-4 h-4 rounded text-violet-600 focus:ring-violet-500"
                      checked={picked.has(s.id)}
                      disabled={taken}
                      onChange={() => toggle(s.id)}
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-slate-800 truncate">{s.subject_name}</span>
                      <span className="block text-[10px] text-slate-400 font-semibold">
                        {taken ? 'Already mapped' : `${s.subject_code} · ${s.subject_type}`}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={isMandatory} onChange={e => setIsMandatory(e.target.checked)}
            className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500" />
          <span className="text-xs font-semibold text-slate-700">
            Mandatory for every student in scope. Clear this for an elective.
          </span>
        </label>

        {formError && <p role="alert" className="text-[11px] font-semibold text-rose-600">{formError}</p>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------

function CopyYearModal({
  toYear, onClose, onSaved,
}: {
  toYear: { id: string; name: string };
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { years } = useAcademicYear();
  const sources = years.filter(y => y.id !== toYear.id);
  const [fromId, setFromId] = useState(sources[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    setFormError(null);
    setBusy(true);
    try {
      const n = await copyClassSubjects(fromId, toYear.id);
      if (n === 0) {
        setFormError('That year has no subject mappings to copy, or every one of them already exists here.');
        return;
      }
      toast.success(`${n} mapping(s) copied into ${toYear.name}.`);
      await onSaved();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Copy subject mappings into ${toYear.name}`}
      description="Rebuilding twelve classes by hand is the step that gets skipped. This carries the whole offering across."
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={submit} disabled={busy || !fromId}>
            {busy ? 'Copying…' : 'Copy mappings'}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Copy from" htmlFor="cy-from" hint="Existing mappings in the target year are left alone.">
          <select id="cy-from" className={selectClass} value={fromId} onChange={e => setFromId(e.target.value)}>
            {sources.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </Field>
        {formError && <p role="alert" className="text-[11px] font-semibold text-rose-600">{formError}</p>}
      </div>
    </Modal>
  );
}
