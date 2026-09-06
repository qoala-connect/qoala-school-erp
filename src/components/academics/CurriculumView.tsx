import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen, Plus, Pencil, Trash2, Copy, ChevronRight, ChevronDown, ListTree, GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { fetchClasses, fetchClassSubjects, type SchoolClass } from '@/services/academicsService';
import {
  fetchSyllabusTree, saveUnit, deleteUnit, saveChapter, deleteChapter,
  fetchTopics, saveTopic, deleteTopic, copySyllabusFromYear,
  type SyllabusTreeRow, type SyllabusTopic,
} from '@/services/syllabusService';
import {
  AsyncBlock, EmptyBlock, Field, GhostButton, IconButton, Modal, Panel,
  PrimaryButton, TableScroll, Th, inputClass, selectClass,
} from './shared';

/**
 * Curriculum & Syllabus — the unit / chapter / topic structure an admin
 * configures per class and subject for the selected academic year.
 *
 * Nothing here is hard-coded: every class, subject and chapter is a row.
 * Teachers never edit this; they record coverage against it in their
 * workspace. Deleting a unit deletes its chapters and topics (DB cascade),
 * so the confirm step matters.
 */

interface UnitGroup {
  unit_id: string;
  unit_title: string;
  unit_sequence: number;
  chapters: SyllabusTreeRow[];
}

function groupTree(rows: SyllabusTreeRow[]): UnitGroup[] {
  const map = new Map<string, UnitGroup>();
  for (const r of rows) {
    if (!map.has(r.unit_id)) {
      map.set(r.unit_id, {
        unit_id: r.unit_id,
        unit_title: r.unit_title,
        unit_sequence: r.unit_sequence,
        chapters: [],
      });
    }
    if (r.chapter_id) map.get(r.unit_id)!.chapters.push(r);
  }
  return [...map.values()]
    .map(u => ({ ...u, chapters: u.chapters.sort((a, b) => (a.chapter_sequence ?? 0) - (b.chapter_sequence ?? 0)) }))
    .sort((a, b) => a.unit_sequence - b.unit_sequence);
}

export default function CurriculumView() {
  const { can } = useAuth();
  const { selectedYearId, selectedYear, years } = useAcademicYear();
  const mayManage = can('academics.manage');

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');

  const [rows, setRows] = useState<SyllabusTreeRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // modal state
  const [unitModal, setUnitModal] = useState<{ id?: string; title: string; sequence: number } | null>(null);
  const [chapterModal, setChapterModal] = useState<
    { unitId: string; id?: string; title: string; sequence: number; hours: string } | null
  >(null);
  const [topicsModal, setTopicsModal] = useState<{ chapterId: string; chapterTitle: string } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'unit' | 'chapter'; id: string; label: string } | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchClasses().then(c => setClasses(c.filter(x => x.is_active))).catch(() => setClasses([]));
  }, []);

  // Subjects offered to the chosen class this year.
  useEffect(() => {
    if (!selectedYearId || !classId) { setSubjects([]); setSubjectId(''); return; }
    fetchClassSubjects(selectedYearId, classId)
      .then(list => {
        const seen = new Map<string, { id: string; name: string; code: string | null }>();
        list.forEach(r => { if (r.is_active && !seen.has(r.subject_id)) seen.set(r.subject_id, { id: r.subject_id, name: r.subject_name, code: r.subject_code }); });
        const arr = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
        setSubjects(arr);
        setSubjectId(prev => (arr.some(s => s.id === prev) ? prev : arr[0]?.id ?? ''));
      })
      .catch(() => setSubjects([]));
  }, [selectedYearId, classId]);

  const load = useCallback(async () => {
    if (!selectedYearId || !classId || !subjectId) { setRows([]); return; }
    setIsLoading(true);
    setError(null);
    try {
      setRows(await fetchSyllabusTree({ academic_year_id: selectedYearId, class_id: classId, subject_id: subjectId }));
    } catch (err: any) {
      setError(err.message);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYearId, classId, subjectId]);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => groupTree(rows), [rows]);
  const chapterCount = rows.filter(r => r.chapter_id).length;

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const submitUnit = async () => {
    if (!unitModal || !selectedYearId || !classId || !subjectId) return;
    if (!unitModal.title.trim()) { toast.error('Give the unit a title.'); return; }
    setBusy(true);
    try {
      await saveUnit({
        id: unitModal.id,
        academic_year_id: selectedYearId,
        class_id: classId,
        subject_id: subjectId,
        title: unitModal.title,
        sequence: unitModal.sequence,
      });
      setUnitModal(null);
      await load();
      toast.success(unitModal.id ? 'Unit updated.' : 'Unit added.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitChapter = async () => {
    if (!chapterModal) return;
    if (!chapterModal.title.trim()) { toast.error('Give the chapter a title.'); return; }
    setBusy(true);
    try {
      await saveChapter({
        id: chapterModal.id,
        unit_id: chapterModal.unitId,
        title: chapterModal.title,
        sequence: chapterModal.sequence,
        expected_hours: chapterModal.hours ? Number(chapterModal.hours) : null,
      });
      setChapterModal(null);
      await load();
      toast.success(chapterModal.id ? 'Chapter updated.' : 'Chapter added.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const runDelete = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === 'unit') await deleteUnit(confirm.id);
      else await deleteChapter(confirm.id);
      setConfirm(null);
      await load();
      toast.success('Removed.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const runCopy = async (fromYearId: string) => {
    if (!selectedYearId) return;
    setBusy(true);
    try {
      const n = await copySyllabusFromYear(fromYearId, selectedYearId);
      setCopyOpen(false);
      await load();
      toast.success(n === 0 ? 'Nothing to copy, or every unit already exists.' : `${n} unit${n === 1 ? '' : 's'} copied.`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const nextUnitSeq = groups.length ? Math.max(...groups.map(g => g.unit_sequence)) + 1 : 1;

  return (
    <div className="space-y-5">
      <Panel
        title="Curriculum & Syllabus"
        description="Units, chapters and topics for a class and subject in the selected year."
        action={
          mayManage && (
            <GhostButton onClick={() => setCopyOpen(true)} disabled={!selectedYearId}>
              <Copy size={14} /> Copy from year
            </GhostButton>
          )
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5">
          <Field label="Class" htmlFor="cur-class">
            <select id="cur-class" className={selectClass} value={classId} onChange={e => setClassId(e.target.value)}>
              <option value="">Select a class…</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.class_name}{c.stream && c.stream !== 'General' ? ` · ${c.stream}` : ''}</option>
              ))}
            </select>
          </Field>
          <Field label="Subject" htmlFor="cur-subject" hint={classId && subjects.length === 0 ? 'This class has no subjects mapped yet — add them in Class Subjects.' : undefined}>
            <select id="cur-subject" className={selectClass} value={subjectId} onChange={e => setSubjectId(e.target.value)} disabled={!classId || subjects.length === 0}>
              {subjects.length === 0 && <option value="">—</option>}
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
            </select>
          </Field>
        </div>
      </Panel>

      {!classId || !subjectId ? (
        <EmptyBlock
          icon={ListTree}
          title="Pick a class and subject"
          description="Choose a class and one of its subjects to see or build its syllabus."
        />
      ) : (
        <Panel
          title={`Syllabus structure`}
          description={`${groups.length} unit${groups.length === 1 ? '' : 's'} · ${chapterCount} chapter${chapterCount === 1 ? '' : 's'}`}
          action={
            mayManage && (
              <PrimaryButton onClick={() => setUnitModal({ title: '', sequence: nextUnitSeq })} disabled={busy}>
                <Plus size={14} /> Add unit
              </PrimaryButton>
            )
          }
        >
          <AsyncBlock
            isLoading={isLoading}
            error={error}
            isEmpty={groups.length === 0}
            onRetry={load}
            loadingLabel="Loading syllabus"
            empty={
              <EmptyBlock
                icon={BookOpen}
                title="No syllabus configured"
                description="Add the first unit for this class and subject."
                actionLabel={mayManage ? 'Add unit' : undefined}
                onAction={mayManage ? () => setUnitModal({ title: '', sequence: 1 }) : undefined}
              />
            }
          >
            <ul className="divide-y divide-slate-100">
              {groups.map(u => {
                const open = expanded.has(u.unit_id);
                const nextChapSeq = u.chapters.length ? Math.max(...u.chapters.map(c => c.chapter_sequence ?? 0)) + 1 : 1;
                return (
                  <li key={u.unit_id} className="px-3 sm:px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggle(u.unit_id)} className="p-1 text-slate-400 hover:text-slate-700" aria-label={open ? 'Collapse' : 'Expand'}>
                        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </button>
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-slate-100 text-[10px] font-black text-slate-500">{u.unit_sequence}</span>
                      <span className="text-sm font-bold text-slate-800 flex-1 min-w-0 truncate">{u.unit_title}</span>
                      <span className="text-[10px] font-bold text-slate-400 hidden sm:inline">{u.chapters.length} ch.</span>
                      {mayManage && (
                        <>
                          <IconButton label="Add chapter" onClick={() => setChapterModal({ unitId: u.unit_id, title: '', sequence: nextChapSeq, hours: '' })}>
                            <Plus size={14} />
                          </IconButton>
                          <IconButton label="Edit unit" onClick={() => setUnitModal({ id: u.unit_id, title: u.unit_title, sequence: u.unit_sequence })}>
                            <Pencil size={13} />
                          </IconButton>
                          <IconButton label="Delete unit" tone="danger" onClick={() => setConfirm({ kind: 'unit', id: u.unit_id, label: u.unit_title })}>
                            <Trash2 size={13} />
                          </IconButton>
                        </>
                      )}
                    </div>

                    {open && (
                      <div className="mt-1.5 ml-8 sm:ml-11">
                        {u.chapters.length === 0 ? (
                          <p className="text-[11px] text-slate-400 py-2">No chapters in this unit yet.</p>
                        ) : (
                          <ul className="space-y-1">
                            {u.chapters.map(c => (
                              <li key={c.chapter_id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50">
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-white border border-slate-200 text-[9px] font-black text-slate-400">{c.chapter_sequence}</span>
                                <span className="text-[13px] font-semibold text-slate-700 flex-1 min-w-0 truncate">{c.chapter_title}</span>
                                <span className="text-[10px] text-slate-400">{c.topic_count} topic{c.topic_count === 1 ? '' : 's'}</span>
                                {c.expected_hours != null && <span className="text-[10px] text-slate-400 hidden sm:inline">· {c.expected_hours}h</span>}
                                <button
                                  onClick={() => setTopicsModal({ chapterId: c.chapter_id!, chapterTitle: c.chapter_title! })}
                                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 px-1.5"
                                >
                                  Topics
                                </button>
                                {mayManage && (
                                  <>
                                    <IconButton label="Edit chapter" onClick={() => setChapterModal({ unitId: u.unit_id, id: c.chapter_id!, title: c.chapter_title!, sequence: c.chapter_sequence ?? 1, hours: c.expected_hours != null ? String(c.expected_hours) : '' })}>
                                      <Pencil size={12} />
                                    </IconButton>
                                    <IconButton label="Delete chapter" tone="danger" onClick={() => setConfirm({ kind: 'chapter', id: c.chapter_id!, label: c.chapter_title! })}>
                                      <Trash2 size={12} />
                                    </IconButton>
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </AsyncBlock>
        </Panel>
      )}

      {unitModal && (
        <Modal
          title={unitModal.id ? 'Edit unit' : 'Add unit'}
          onClose={() => setUnitModal(null)}
          footer={
            <>
              <GhostButton onClick={() => setUnitModal(null)} disabled={busy}>Cancel</GhostButton>
              <PrimaryButton onClick={submitUnit} disabled={busy}>{busy ? 'Saving…' : 'Save unit'}</PrimaryButton>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Title" htmlFor="u-title">
              <input id="u-title" className={inputClass} value={unitModal.title} autoFocus
                onChange={e => setUnitModal({ ...unitModal, title: e.target.value })}
                placeholder="e.g. Electrostatics" />
            </Field>
            <Field label="Sequence" htmlFor="u-seq" hint="Order within the subject. Lower shows first.">
              <input id="u-seq" type="number" min={1} className={inputClass} value={unitModal.sequence}
                onChange={e => setUnitModal({ ...unitModal, sequence: Math.max(1, Number(e.target.value) || 1) })} />
            </Field>
          </div>
        </Modal>
      )}

      {chapterModal && (
        <Modal
          title={chapterModal.id ? 'Edit chapter' : 'Add chapter'}
          onClose={() => setChapterModal(null)}
          footer={
            <>
              <GhostButton onClick={() => setChapterModal(null)} disabled={busy}>Cancel</GhostButton>
              <PrimaryButton onClick={submitChapter} disabled={busy}>{busy ? 'Saving…' : 'Save chapter'}</PrimaryButton>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Title" htmlFor="c-title">
              <input id="c-title" className={inputClass} value={chapterModal.title} autoFocus
                onChange={e => setChapterModal({ ...chapterModal, title: e.target.value })}
                placeholder="e.g. Electric Charges and Fields" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sequence" htmlFor="c-seq">
                <input id="c-seq" type="number" min={1} className={inputClass} value={chapterModal.sequence}
                  onChange={e => setChapterModal({ ...chapterModal, sequence: Math.max(1, Number(e.target.value) || 1) })} />
              </Field>
              <Field label="Expected hours" htmlFor="c-hours" hint="Optional">
                <input id="c-hours" type="number" min={0} step="0.5" className={inputClass} value={chapterModal.hours}
                  onChange={e => setChapterModal({ ...chapterModal, hours: e.target.value })} />
              </Field>
            </div>
          </div>
        </Modal>
      )}

      {topicsModal && (
        <TopicsModal
          chapterId={topicsModal.chapterId}
          chapterTitle={topicsModal.chapterTitle}
          mayManage={mayManage}
          onClose={() => { setTopicsModal(null); load(); }}
        />
      )}

      {confirm && (
        <Modal
          title={`Delete ${confirm.kind}`}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <GhostButton onClick={() => setConfirm(null)} disabled={busy}>Cancel</GhostButton>
              <button onClick={runDelete} disabled={busy}
                className="inline-flex items-center gap-1.5 px-4 h-[36px] rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50">
                {busy ? 'Removing…' : `Delete ${confirm.kind}`}
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-600">
            Delete <span className="font-bold text-slate-900">{confirm.label}</span>?
            {confirm.kind === 'unit' && ' Its chapters, topics and any teacher progress against them are removed too.'}
            {confirm.kind === 'chapter' && ' Its topics and any teacher progress against it are removed too.'}
          </p>
        </Modal>
      )}

      {copyOpen && (
        <Modal
          title="Copy syllabus from another year"
          description={`Rebuilds every unit, chapter and topic under ${selectedYear?.name ?? 'this year'}. Units that already exist are left alone.`}
          onClose={() => setCopyOpen(false)}
          footer={<GhostButton onClick={() => setCopyOpen(false)} disabled={busy}>Close</GhostButton>}
        >
          <div className="space-y-2">
            {years.filter(y => y.id !== selectedYearId).length === 0 && (
              <p className="text-xs text-slate-500">There is no other year to copy from.</p>
            )}
            {years.filter(y => y.id !== selectedYearId).map(y => (
              <button key={y.id} disabled={busy} onClick={() => runCopy(y.id)}
                className="w-full flex items-center justify-between px-4 h-[42px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 disabled:opacity-50">
                <span>{y.name}{y.is_current ? ' (current)' : ''}</span>
                <ChevronRight size={15} className="text-slate-400" />
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Topics editor
// ---------------------------------------------------------------------

function TopicsModal({
  chapterId, chapterTitle, mayManage, onClose,
}: {
  chapterId: string; chapterTitle: string; mayManage: boolean; onClose: () => void;
}) {
  const [topics, setTopics] = useState<SyllabusTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setTopics(await fetchTopics([chapterId]));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [chapterId]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const seq = topics.length ? Math.max(...topics.map(t => t.sequence)) + 1 : 1;
      await saveTopic({ chapter_id: chapterId, title: draft, sequence: seq });
      setDraft('');
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await deleteTopic(id);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Topics" description={chapterTitle} onClose={onClose}
      footer={<GhostButton onClick={onClose}>Done</GhostButton>}>
      <AsyncBlock
        isLoading={isLoading}
        error={error}
        isEmpty={false}
        onRetry={load}
        empty={null}
      >
        <ul className="space-y-1.5 mb-3">
          {topics.length === 0 && <li className="text-xs text-slate-400 py-2">No topics yet.</li>}
          {topics.map(t => (
            <li key={t.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[9px] font-black text-slate-400 w-4">{t.sequence}</span>
              <span className="text-[13px] font-semibold text-slate-700 flex-1 min-w-0 truncate">{t.title}</span>
              {mayManage && (
                <IconButton label="Remove topic" tone="danger" onClick={() => remove(t.id)} disabled={busy}>
                  <Trash2 size={12} />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
        {mayManage && (
          <div className="flex items-center gap-2">
            <input
              className={inputClass}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add(); }}
              placeholder="Add a topic and press Enter"
            />
            <PrimaryButton onClick={add} disabled={busy || !draft.trim()}>Add</PrimaryButton>
          </div>
        )}
      </AsyncBlock>
    </Modal>
  );
}
