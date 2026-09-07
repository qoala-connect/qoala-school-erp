import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, MapPin, Users, ClipboardCheck, NotebookPen, PencilRuler, ChevronRight,
  ChevronLeft, CalendarClock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchTeacherToday, type TeacherTodayClass } from '@/services/teachingService';
import { AsyncBlock, EmptyBlock, Panel, inputClass } from '@/components/academics/shared';
import ClassWorkspacePanel, { type ClassContext } from './ClassWorkspacePanel';

const todayStr = () => new Date().toISOString().slice(0, 10);

function addDays(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function friendlyDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const diffDays = Math.round((d.getTime() - new Date(todayStr() + 'T00:00:00').getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Minutes since midnight for an "HH:MM[:SS]" string, or null if unparseable. */
function toMinutes(t: string | null): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * The teacher's periods for a chosen date. Picking one opens the class
 * workspace — attendance, lesson plan, homework and syllabus in one place.
 */
export default function TodayClasses({
  teacherId, academicYearId, canEditAttendance,
}: {
  teacherId: string;
  academicYearId: string;
  canEditAttendance: boolean;
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<TeacherTodayClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ClassContext | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRows(await fetchTeacherToday(teacherId, date));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [teacherId, date]);

  useEffect(() => { load(); }, [load]);

  const isToday = date === todayStr();
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => (toMinutes(a.start_time) ?? 0) - (toMinutes(b.start_time) ?? 0)),
    [rows],
  );

  const nextUpSlotId = useMemo(() => {
    if (!isToday) return null;
    let best: { id: string; start: number } | null = null;
    for (const r of sortedRows) {
      const start = toMinutes(r.start_time);
      if (start == null || start <= nowMinutes) continue;
      if (!best || start < best.start) best = { id: r.slot_id, start };
    }
    return best?.id ?? null;
  }, [sortedRows, isToday, nowMinutes]);

  const doneCount = sortedRows.filter(r => r.attendance_marked).length;

  if (selected) {
    return (
      <ClassWorkspacePanel
        ctx={selected}
        teacherId={teacherId}
        academicYearId={academicYearId}
        canEditAttendance={canEditAttendance}
        onBack={() => { setSelected(null); load(); }}
        onChanged={load}
      />
    );
  }

  return (
    <Panel
      title="Classes for the day"
      description="Open a period to mark attendance, plan the lesson, set homework and update the syllabus."
      action={
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button
              onClick={() => setDate(d => addDays(d, -1))}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
              aria-label="Previous day"
            >
              <ChevronLeft size={14} />
            </button>
            <label className="flex items-center gap-1.5 px-1 border-x border-slate-200">
              <CalendarDays size={13} className="text-slate-400 shrink-0" />
              <input
                type="date"
                className="h-[30px] text-xs font-semibold text-slate-700 border-0 focus:ring-0 focus:outline-none bg-transparent"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </label>
            <button
              onClick={() => setDate(d => addDays(d, 1))}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
              aria-label="Next day"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          {!isToday && (
            <button
              onClick={() => setDate(todayStr())}
              className="h-[32px] px-3 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-colors"
            >
              Today
            </button>
          )}
        </div>
      }
    >
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <p className="text-[11px] font-bold text-slate-500">{friendlyDate(date)}</p>
        {sortedRows.length > 0 && (
          <p className="text-[11px] font-semibold text-slate-400 tabular-nums">
            {doneCount}/{sortedRows.length} attendance marked
          </p>
        )}
      </div>

      <AsyncBlock
        isLoading={isLoading} error={error} isEmpty={sortedRows.length === 0} onRetry={load}
        loadingLabel="Loading your timetable"
        empty={
          <EmptyBlock
            icon={CalendarDays}
            title="No periods scheduled"
            description="You have no timetable periods on this day. Pick another date, or ask the office if this looks wrong."
          />
        }
      >
        <ul className="divide-y divide-slate-100">
          {sortedRows.map(r => {
            const canOpen = !!r.section_id && !!r.subject_id;
            const start = toMinutes(r.start_time);
            const end = toMinutes(r.end_time);
            const isLive = isToday && start != null && end != null && nowMinutes >= start && nowMinutes < end;
            const isNext = r.slot_id === nextUpSlotId;
            return (
              <li key={r.slot_id}>
                <button
                  disabled={!canOpen}
                  onClick={() => canOpen && setSelected({
                    class_id: r.class_id,
                    class_name: r.class_name,
                    section_id: r.section_id!,
                    section_name: r.section_name ?? '—',
                    subject_id: r.subject_id!,
                    subject_name: r.subject_name ?? '—',
                    date,
                  })}
                  className={cn(
                    'w-full flex items-center gap-4 px-4 sm:px-5 py-3.5 text-left transition-colors border-l-[3px]',
                    isLive ? 'border-l-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/70'
                      : isNext ? 'border-l-indigo-400 hover:bg-slate-50'
                      : 'border-l-transparent hover:bg-slate-50',
                    !canOpen && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <div className="w-16 shrink-0">
                    <p className="text-xs font-black text-slate-700 tabular-nums">{r.start_time?.slice(0, 5) ?? '--:--'}</p>
                    <p className="text-[10px] text-slate-400 tabular-nums">{r.end_time?.slice(0, 5) ?? ''}</p>
                    {r.period_number != null && <p className="text-[9px] font-bold text-slate-300 mt-0.5">P{r.period_number}</p>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[13px] font-extrabold text-slate-900 truncate">
                        {r.class_name}-{r.section_name ?? '—'} · {r.subject_name ?? 'No subject assigned'}
                      </p>
                      {isLive && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-wide shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                        </span>
                      )}
                      {!isLive && isNext && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-wide shrink-0">
                          <CalendarClock size={9} /> Next
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-500 font-medium">
                      {r.room && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {r.room}</span>}
                      <span className="inline-flex items-center gap-1"><Users size={11} /> {r.students_total}</span>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    <Chip ok={r.attendance_marked} icon={ClipboardCheck} label={r.attendance_marked ? 'Attendance' : 'Attendance due'} />
                    <Chip
                      ok={r.lesson_plan_status === 'completed'}
                      neutral={!!r.lesson_plan_id && r.lesson_plan_status !== 'completed'}
                      icon={NotebookPen}
                      label={r.lesson_plan_id ? (r.lesson_plan_status === 'completed' ? 'Lesson done' : 'Lesson planned') : 'No lesson'}
                    />
                    {r.homework_count > 0 && <Chip ok icon={PencilRuler} label={`${r.homework_count} HW`} />}
                  </div>

                  <ChevronRight size={16} className="text-slate-300 shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      </AsyncBlock>
    </Panel>
  );
}

function Chip({ ok, neutral, icon: Icon, label }: { ok?: boolean; neutral?: boolean; icon: any; label: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide border',
      ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : neutral ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
        : 'bg-amber-50 text-amber-700 border-amber-200',
    )}>
      <Icon size={11} /> {label}
    </span>
  );
}
