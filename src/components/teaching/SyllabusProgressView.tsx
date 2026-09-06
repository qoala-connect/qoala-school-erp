import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ListTree, CheckCircle2, Circle, CircleDot, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { TeacherScopeRow } from '@/services/teachingService';
import {
  fetchSyllabusTree, updateChapterProgress,
  type SyllabusTreeRow, type ChapterStatus,
} from '@/services/syllabusService';
import {
  AsyncBlock, EmptyBlock, Field, Panel, StatusPill, selectClass,
} from '@/components/academics/shared';

const NEXT: Record<ChapterStatus, ChapterStatus> = {
  not_started: 'in_progress',
  in_progress: 'completed',
  completed: 'not_started',
};

/** The teacher updates how far each of their sections has got through its syllabus. */
export default function SyllabusProgressView({
  teacherId, academicYearId, scope,
}: {
  teacherId: string;
  academicYearId: string;
  scope: TeacherScopeRow[];
}) {
  // Only rows with a subject are meaningful for a syllabus.
  const combos = useMemo(
    () => scope.filter(s => s.subject_id).map(s => ({
      key: `${s.class_id}|${s.section_id}|${s.subject_id}`,
      ...s,
    })),
    [scope],
  );
  const [selKey, setSelKey] = useState(combos[0]?.key ?? '');
  useEffect(() => {
    if (!combos.some(c => c.key === selKey)) setSelKey(combos[0]?.key ?? '');
  }, [combos, selKey]);

  const sel = combos.find(c => c.key === selKey);

  const [rows, setRows] = useState<SyllabusTreeRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sel) { setRows([]); return; }
    setIsLoading(true);
    setError(null);
    try {
      setRows(await fetchSyllabusTree({
        academic_year_id: academicYearId,
        class_id: sel.class_id,
        subject_id: sel.subject_id!,
        section_id: sel.section_id,
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [academicYearId, sel]);

  useEffect(() => { load(); }, [load]);

  const cycle = async (row: SyllabusTreeRow) => {
    if (!row.chapter_id || !sel) return;
    setBusyId(row.chapter_id);
    try {
      await updateChapterProgress({
        chapter_id: row.chapter_id,
        section_id: sel.section_id,
        teacher_id: teacherId,
        status: NEXT[row.progress_status],
      });
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const chapters = rows.filter(r => r.chapter_id);
  const done = chapters.filter(r => r.progress_status === 'completed').length;
  const pct = chapters.length ? Math.round((done / chapters.length) * 100) : 0;

  return (
    <Panel
      title="Syllabus Progress"
      description="Mark chapters as you teach them. Click a status to cycle it."
      action={
        combos.length > 0 && (
          <select className={selectClass + ' w-auto'} value={selKey} onChange={e => setSelKey(e.target.value)}>
            {combos.map(c => (
              <option key={c.key} value={c.key}>
                {c.class_name}-{c.section_name} · {c.subject_name}
              </option>
            ))}
          </select>
        )
      }
    >
      {combos.length === 0 ? (
        <EmptyBlock icon={ListTree} title="No subjects assigned" description="You have no class + subject assignments this year." />
      ) : (
        <>
          {chapters.length > 0 && (
            <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100">
              <div className="h-2 flex-1 max-w-[280px] rounded-full bg-slate-100 overflow-hidden">
                <div className={cn('h-full rounded-full', pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500')}
                  style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-bold text-slate-600 tabular-nums">{done}/{chapters.length} · {pct}%</span>
            </div>
          )}
          <AsyncBlock
            isLoading={isLoading} error={error} isEmpty={chapters.length === 0} onRetry={load}
            loadingLabel="Loading syllabus"
            empty={<EmptyBlock icon={ListTree} title="No syllabus configured" description="An administrator has not set up units and chapters for this class and subject yet." />}
          >
            <ul className="divide-y divide-slate-100">
              {rows.map((r, i) => {
                if (!r.chapter_id) return null;
                const firstOfUnit = i === 0 || rows[i - 1].unit_id !== r.unit_id;
                return (
                  <React.Fragment key={r.chapter_id}>
                    {firstOfUnit && (
                      <li className="px-5 pt-3 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {r.unit_sequence}. {r.unit_title}
                      </li>
                    )}
                    <li className="flex items-center gap-3 px-5 py-2.5">
                      <button onClick={() => cycle(r)} disabled={busyId === r.chapter_id} className="shrink-0" title="Change status">
                        {busyId === r.chapter_id ? <Loader2 size={18} className="animate-spin text-slate-400" />
                          : r.progress_status === 'completed' ? <CheckCircle2 size={18} className="text-emerald-600" />
                          : r.progress_status === 'in_progress' ? <CircleDot size={18} className="text-amber-500" />
                          : <Circle size={18} className="text-slate-300" />}
                      </button>
                      <span className={cn('text-[13px] font-semibold flex-1 min-w-0 truncate',
                        r.progress_status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-800')}>
                        {r.chapter_sequence}. {r.chapter_title}
                      </span>
                      <span className="text-[10px] text-slate-400 hidden sm:inline">{r.topic_count} topic{r.topic_count === 1 ? '' : 's'}</span>
                      <StatusPill tone={r.progress_status === 'completed' ? 'good' : r.progress_status === 'in_progress' ? 'warn' : 'muted'}>
                        {r.progress_status.replace('_', ' ')}
                      </StatusPill>
                    </li>
                  </React.Fragment>
                );
              })}
            </ul>
          </AsyncBlock>
        </>
      )}
    </Panel>
  );
}
