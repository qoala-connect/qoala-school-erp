import React, { useCallback, useEffect, useState } from 'react';
import { ListTree, ChevronRight, ChevronDown, CheckCircle2, CircleDot, Circle, Loader2, CalendarCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  fetchStudentAcademicDashboard, type StudentAcademicDashboard,
} from '@/services/academicsService';
import {
  fetchSyllabusCoverage, fetchSyllabusTree,
  type SyllabusCoverageRow, type SyllabusTreeRow,
} from '@/services/syllabusService';
import {
  AsyncBlock, EmptyBlock, LoadingBlock, ErrorBlock, StatusPill,
} from '@/components/academics/shared';

/**
 * A student's (or a linked parent's) view of the syllabus and how far
 * their class has got through it, per subject. Read only. The database
 * refuses the underlying call for any other student.
 */
export default function StudentSyllabusTab({ studentId }: { studentId: string }) {
  const [dash, setDash] = useState<StudentAcademicDashboard | null>(null);
  const [subjects, setSubjects] = useState<SyllabusCoverageRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openSubject, setOpenSubject] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Record<string, SyllabusTreeRow[]>>({});
  const [loadingSubject, setLoadingSubject] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const d = await fetchStudentAcademicDashboard(studentId);
      setDash(d);
      if (d?.academic_year_id && d.class_id) {
        const cov = await fetchSyllabusCoverage(d.academic_year_id);
        setSubjects(cov.filter(c => c.class_id === d.class_id));
      } else {
        setSubjects([]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const toggleSubject = async (row: SyllabusCoverageRow) => {
    if (openSubject === row.subject_id) { setOpenSubject(null); return; }
    setOpenSubject(row.subject_id);
    if (!chapters[row.subject_id] && dash?.academic_year_id && dash.class_id) {
      setLoadingSubject(row.subject_id);
      try {
        const tree = await fetchSyllabusTree({
          academic_year_id: dash.academic_year_id,
          class_id: dash.class_id,
          subject_id: row.subject_id,
          section_id: dash.section_id,
        });
        setChapters(prev => ({ ...prev, [row.subject_id]: tree.filter(t => t.chapter_id) }));
      } catch {
        setChapters(prev => ({ ...prev, [row.subject_id]: [] }));
      } finally {
        setLoadingSubject(null);
      }
    }
  };

  if (isLoading) return <LoadingBlock label="Loading your syllabus" />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      {dash && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Mini label="Attendance" value={dash.attendance_percent == null ? '—' : `${dash.attendance_percent}%`} icon={CalendarCheck} />
          <Mini label="Pending homework" value={dash.pending_homework} tone={dash.pending_homework ? 'warn' : 'good'} />
          <Mini label="Pending assignments" value={dash.pending_assignments} tone={dash.pending_assignments ? 'warn' : 'good'} />
          <Mini label="Subjects" value={subjects.length} icon={ListTree} />
        </div>
      )}

      <AsyncBlock
        isLoading={false}
        error={null}
        isEmpty={subjects.length === 0}
        empty={
          <EmptyBlock
            icon={ListTree}
            title="No syllabus published yet"
            description="Your teachers have not set up the syllabus for your class this year. Check back later."
          />
        }
      >
        <ul className="space-y-2">
          {subjects.map(s => {
            const pct = s.percent_complete ?? 0;
            const open = openSubject === s.subject_id;
            const chList = chapters[s.subject_id] ?? [];
            return (
              <li key={s.subject_id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <button onClick={() => toggleSubject(s)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left">
                  {open ? <ChevronDown size={15} className="text-slate-400 shrink-0" /> : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
                  <span className="text-[13px] font-extrabold text-slate-800 flex-1 min-w-0 truncate">{s.subject_name}</span>
                  <span className="hidden sm:block w-32 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <span className={cn('block h-full rounded-full', pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500')}
                      style={{ width: `${Math.min(100, pct)}%` }} />
                  </span>
                  <span className="text-[11px] font-bold text-slate-600 tabular-nums w-10 text-right">{pct}%</span>
                </button>
                {open && (
                  <div className="border-t border-slate-100 px-3 py-2 bg-slate-50/40">
                    {loadingSubject === s.subject_id ? (
                      <div className="flex items-center gap-2 py-3 text-xs text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading chapters…</div>
                    ) : chList.length === 0 ? (
                      <p className="text-[12px] text-slate-400 py-3">No chapters listed for this subject.</p>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {chList.map((c, i) => {
                          const firstOfUnit = i === 0 || chList[i - 1].unit_id !== c.unit_id;
                          return (
                            <React.Fragment key={c.chapter_id}>
                              {firstOfUnit && (
                                <li className="pt-2 pb-1 px-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  {c.unit_sequence}. {c.unit_title}
                                </li>
                              )}
                              <li className="flex items-center gap-2.5 px-1 py-2">
                                {c.progress_status === 'completed' ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                                  : c.progress_status === 'in_progress' ? <CircleDot size={15} className="text-amber-500 shrink-0" />
                                  : <Circle size={15} className="text-slate-300 shrink-0" />}
                                <span className={cn('text-[12.5px] font-semibold flex-1 min-w-0 truncate',
                                  c.progress_status === 'completed' ? 'text-slate-500' : 'text-slate-700')}>
                                  {c.chapter_sequence}. {c.chapter_title}
                                </span>
                                <StatusPill tone={c.progress_status === 'completed' ? 'good' : c.progress_status === 'in_progress' ? 'warn' : 'muted'}>
                                  {c.progress_status.replace('_', ' ')}
                                </StatusPill>
                              </li>
                            </React.Fragment>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </AsyncBlock>
    </div>
  );
}

function Mini({ label, value, tone, icon: Icon }: { label: string; value: React.ReactNode; tone?: 'good' | 'warn'; icon?: any }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2.5">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
        {Icon && <Icon size={11} />}{label}
      </p>
      <p className={cn('text-base font-extrabold mt-0.5 tabular-nums',
        tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : 'text-slate-800')}>{value}</p>
    </div>
  );
}
