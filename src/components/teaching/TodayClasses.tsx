import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Clock, MapPin, Users, ClipboardCheck, NotebookPen, PencilRuler, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchTeacherToday, type TeacherTodayClass } from '@/services/teachingService';
import { AsyncBlock, EmptyBlock, Panel, StatusPill, inputClass } from '@/components/academics/shared';
import ClassWorkspacePanel, { type ClassContext } from './ClassWorkspacePanel';

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
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <CalendarDays size={14} />
          <input type="date" className={inputClass + ' w-auto'} value={date} onChange={e => setDate(e.target.value)} />
        </label>
      }
    >
      <AsyncBlock
        isLoading={isLoading} error={error} isEmpty={rows.length === 0} onRetry={load}
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
          {rows.map(r => {
            const canOpen = !!r.section_id && !!r.subject_id;
            return (
              <li key={r.slot_id}>
                <button
                  disabled={!canOpen}
                  onClick={() => canOpen && setSelected({
                    class_id: r.class_id,
                    class_name: r.class_name,
                    section_id: r.section_id!,
                    section_name: r.section_name ?? '',
                    subject_id: r.subject_id!,
                    subject_name: r.subject_name ?? 'Subject',
                    date,
                  })}
                  className={cn(
                    'w-full flex items-center gap-4 px-4 sm:px-5 py-3.5 text-left transition-colors',
                    canOpen ? 'hover:bg-slate-50' : 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <div className="w-16 shrink-0">
                    <p className="text-xs font-black text-slate-700 tabular-nums">{r.start_time ?? '--:--'}</p>
                    <p className="text-[10px] text-slate-400 tabular-nums">{r.end_time ?? ''}</p>
                    {r.period_number != null && <p className="text-[9px] font-bold text-slate-300 mt-0.5">P{r.period_number}</p>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-extrabold text-slate-900 truncate">
                      {r.class_name}-{r.section_name ?? '?'} · {r.subject_name ?? 'Subject'}
                    </p>
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
