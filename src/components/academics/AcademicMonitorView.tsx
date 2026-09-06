import React, { useCallback, useEffect, useState } from 'react';
import {
  Layers, BookOpen, Users, CalendarCheck, ClipboardList, NotebookPen, PencilRuler, GaugeCircle,
} from 'lucide-react';
import { useAcademicYear } from '@/context/AcademicYearContext';
import {
  fetchAcademicMonitor, type AcademicMonitor,
} from '@/services/academicsService';
import { fetchSyllabusBySubject, type SubjectCoverageRow } from '@/services/syllabusService';
import AdminStatCard from '@/components/common/AdminStatCard';
import { AsyncBlock, EmptyBlock, Panel, TableScroll, Th, inputClass } from './shared';

/**
 * Academic Monitor — the admin's read-only view of daily teaching
 * activity for the selected year: who is scheduled today, whether their
 * attendance and lesson plans are done, how much homework went out, and
 * how far each subject has got through its syllabus.
 *
 * Every number is a live count from admin_academic_monitor() and
 * admin_syllabus_by_subject(). Nothing here is stored or estimated.
 */
export default function AcademicMonitorView() {
  const { selectedYearId } = useAcademicYear();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [monitor, setMonitor] = useState<AcademicMonitor | null>(null);
  const [subjects, setSubjects] = useState<SubjectCoverageRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedYearId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [m, s] = await Promise.all([
        fetchAcademicMonitor(selectedYearId, date),
        fetchSyllabusBySubject(selectedYearId),
      ]);
      setMonitor(m);
      setSubjects(s);
    } catch (err: any) {
      setError(err.message);
      setMonitor(null);
      setSubjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYearId, date]);

  useEffect(() => { load(); }, [load]);

  const attnPct = monitor && monitor.classes_scheduled_today > 0
    ? Math.round((monitor.attendance_completed / monitor.classes_scheduled_today) * 100)
    : 0;
  const lpPct = monitor && monitor.lesson_plans_planned > 0
    ? Math.round((monitor.lesson_plans_completed / monitor.lesson_plans_planned) * 100)
    : 0;

  return (
    <div className="space-y-5">
      <Panel
        title="Academic Monitor"
        description="Live teaching activity for the selected academic year."
        action={
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            Date
            <input type="date" className={inputClass + ' w-auto'} value={date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => setDate(e.target.value)} />
          </label>
        }
      >
        <AsyncBlock
          isLoading={isLoading}
          error={error}
          isEmpty={!monitor}
          onRetry={load}
          loadingLabel="Loading academic activity"
          empty={<EmptyBlock icon={GaugeCircle} title="No data" description="Nothing to show for this year and date." />}
        >
          {monitor && (
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <AdminStatCard label="Classes" value={monitor.total_classes} subtext={`${monitor.total_sections} sections`} icon={Layers} variant="primary" />
                <AdminStatCard label="Subjects" value={monitor.total_subjects} icon={BookOpen} variant="violet" />
                <AdminStatCard label="Teachers" value={monitor.total_teachers} icon={Users} variant="sky" />
                <AdminStatCard label="Scheduled today" value={monitor.classes_scheduled_today} subtext="class-sections with a period" icon={CalendarCheck} variant="emerald" />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <AdminStatCard
                  label="Attendance done"
                  value={`${monitor.attendance_completed}/${monitor.classes_scheduled_today}`}
                  subtext={`${monitor.attendance_pending} pending · ${attnPct}%`}
                  icon={ClipboardList}
                  variant={attnPct >= 90 ? 'emerald' : attnPct >= 60 ? 'amber' : 'rose'}
                />
                <AdminStatCard
                  label="Lesson plans done"
                  value={`${monitor.lesson_plans_completed}/${monitor.lesson_plans_planned}`}
                  subtext={monitor.lesson_plans_planned ? `${lpPct}% of planned` : 'none planned'}
                  icon={NotebookPen}
                  variant={monitor.lesson_plans_planned === 0 ? 'primary' : lpPct >= 75 ? 'emerald' : 'amber'}
                />
                <AdminStatCard label="Homework today" value={monitor.homework_created_today} subtext="items assigned" icon={PencilRuler} variant="violet" />
                <AdminStatCard label="Active assignments" value={monitor.assignments_active} subtext="published, not past due" icon={ClipboardList} variant="sky" />
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-indigo-600"><GaugeCircle size={18} /></div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Syllabus completion, all classes</p>
                  <p className="text-2xl font-black text-slate-900 tabular-nums">
                    {monitor.syllabus_percent_overall == null ? '—' : `${monitor.syllabus_percent_overall}%`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </AsyncBlock>
      </Panel>

      <Panel title="Syllabus completion by subject" description="Section-weighted across every class that teaches the subject.">
        <AsyncBlock
          isLoading={isLoading}
          error={error}
          isEmpty={subjects.length === 0}
          onRetry={load}
          empty={
            <EmptyBlock
              icon={BookOpen}
              title="No syllabus configured"
              description="Once units and chapters exist and teachers record their progress, completion shows here."
            />
          }
        >
          <TableScroll minWidth={520}>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>Subject</Th>
                <Th align="center">Chapters</Th>
                <Th>Completion</Th>
              </tr>
            </thead>
            <tbody>
              {subjects.map(s => {
                const pct = s.percent_complete ?? 0;
                return (
                  <tr key={s.subject_id} className="border-b border-slate-50 last:border-0">
                    <td className="py-3 px-4 text-[13px] font-bold text-slate-800">{s.subject_name}</td>
                    <td className="py-3 px-4 text-center text-[13px] text-slate-500 tabular-nums">{s.chapters_total}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 max-w-[240px] rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={
                              'h-full rounded-full ' +
                              (pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500')
                            }
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-600 tabular-nums w-10">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableScroll>
        </AsyncBlock>
      </Panel>
    </div>
  );
}
