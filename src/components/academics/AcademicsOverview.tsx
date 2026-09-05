import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers, BookOpen, Users, GraduationCap, CalendarRange,
  ArrowUpRight, AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { fetchOverview, type AcademicsOverview as Overview } from '@/services/academicsService';
import { AsyncBlock, EmptyBlock, Panel, StatusPill } from './shared';

/**
 * What the academic structure looks like for the selected year.
 *
 * Every number is read from academics_overview() against the live
 * database. Nothing on this page is a placeholder, so a zero means the
 * school genuinely has none of that thing and the panel below says what
 * to do about it.
 *
 * The cross-module links carry the class and year into the module that
 * owns the data, rather than reproducing that module inside Academics.
 */
export default function AcademicsOverview({ onNavigateView }: { onNavigateView: (view: string) => void }) {
  const navigate = useNavigate();
  const { selectedYear, selectedYearId, isViewingHistory } = useAcademicYear();

  const [data, setData] = useState<Overview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedYearId) return;
    setIsLoading(true);
    setError(null);
    try {
      setData(await fetchOverview(selectedYearId));
    } catch (err: any) {
      setError(err.message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYearId]);

  useEffect(() => { load(); }, [load]);

  const metrics = data ? [
    { label: 'Classes', value: data.classes_active, sub: `${data.classes_total} defined`, icon: Layers, onClick: () => onNavigateView('classes') },
    { label: 'Sections', value: data.sections_total, sub: 'across all classes', icon: GraduationCap, onClick: () => onNavigateView('classes') },
    { label: 'Subjects', value: data.subjects_active, sub: `${data.subjects_total} in master`, icon: BookOpen, onClick: () => onNavigateView('subjects') },
    { label: 'Subject mappings', value: data.class_subject_mappings, sub: 'class offerings this year', icon: CheckCircle2, onClick: () => onNavigateView('class-subjects') },
    { label: 'Students enrolled', value: data.students_enrolled, sub: 'active, this year', icon: Users, onClick: () => navigate('/dashboard/students') },
    { label: 'Teachers active', value: data.teachers_active, sub: 'on the faculty roll', icon: Users, onClick: () => navigate('/dashboard/teachers') },
  ] : [];

  const attention = data ? [
    {
      count: data.classes_without_subjects,
      label: 'classes have no subjects mapped for this year',
      fix: 'Map subjects',
      onFix: () => onNavigateView('class-subjects'),
    },
    {
      count: data.sections_without_class_teacher,
      label: 'sections have no class teacher for this year',
      fix: 'Open Teacher Management',
      onFix: () => navigate('/dashboard/teachers', { state: { activeTab: 'assignments' } }),
    },
    {
      count: data.classes_without_sections,
      label: 'classes run no sections',
      fix: 'Add sections',
      onFix: () => onNavigateView('classes'),
    },
    {
      count: data.subjects_never_mapped,
      label: 'active subjects are not taught to any class',
      fix: 'Review subjects',
      onFix: () => onNavigateView('subjects'),
    },
  ].filter(a => a.count > 0) : [];

  return (
    <div className="space-y-4">
      {isViewingHistory && selectedYear && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200" role="status">
          <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[11px] font-semibold text-amber-800">
            You are reading {selectedYear.name}, which is not the school's current year.
            Figures below describe that year's structure. Editing still applies to the record you open.
          </p>
        </div>
      )}

      <AsyncBlock
        isLoading={isLoading}
        error={error}
        isEmpty={!data}
        onRetry={load}
        loadingLabel="Reading academic structure"
        empty={
          <Panel>
            <EmptyBlock
              title="No academic year selected"
              description="Create an academic year before configuring classes, sections and subjects."
              actionLabel="Go to Academic Years"
              onAction={() => onNavigateView('years')}
              icon={CalendarRange}
            />
          </Panel>
        }
      >
        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {metrics.map(m => (
                <button
                  key={m.label}
                  onClick={m.onClick}
                  className={cn(
                    'group text-left bg-white border border-slate-200/70 rounded-2xl p-4',
                    'hover:border-violet-300 hover:shadow-sm transition-all',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <m.icon className="w-4 h-4 text-slate-400 group-hover:text-violet-500 transition-colors" aria-hidden="true" />
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-500 transition-colors" aria-hidden="true" />
                  </div>
                  <p className="text-2xl font-black text-slate-900 mt-3 leading-none tabular-nums">{m.value}</p>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">{m.label}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">{m.sub}</p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Panel
                title="Needs attention"
                description="Gaps in the structure for this academic year"
                className="lg:col-span-2"
              >
                {attention.length === 0 ? (
                  <div className="flex items-center gap-3 px-5 py-6">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
                    <p className="text-xs font-semibold text-slate-700">
                      The structure is complete for {data.academic_year_name}. Every class runs sections,
                      is mapped to subjects and has a class teacher.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {attention.map(a => (
                      <li key={a.label} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
                          <p className="text-xs text-slate-700">
                            <span className="font-black text-slate-900 tabular-nums">{a.count}</span>{' '}
                            <span className="font-medium">{a.label}</span>
                          </p>
                        </div>
                        <button
                          onClick={a.onFix}
                          className="text-[11px] font-bold text-violet-600 hover:text-violet-800 underline underline-offset-2 shrink-0"
                        >
                          {a.fix}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Academic year" description="The year these figures describe">
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-black text-slate-900">{data.academic_year_name}</span>
                    <StatusPill tone={data.is_current_year ? 'good' : 'muted'}>
                      {data.is_current_year ? 'Current' : data.academic_year_status}
                    </StatusPill>
                  </div>
                  <dl className="space-y-2 text-xs">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500 font-medium">Timetable slots</dt>
                      <dd className="font-bold text-slate-800 tabular-nums">{data.timetable_slots}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500 font-medium">Subject mappings</dt>
                      <dd className="font-bold text-slate-800 tabular-nums">{data.class_subject_mappings}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500 font-medium">Students on roll</dt>
                      <dd className="font-bold text-slate-800 tabular-nums">{data.students_enrolled}</dd>
                    </div>
                  </dl>
                  <button
                    onClick={() => onNavigateView('years')}
                    className="w-full mt-1 text-[11px] font-bold text-violet-600 hover:text-violet-800 underline underline-offset-2 text-left"
                  >
                    Manage academic years
                  </button>
                </div>
              </Panel>
            </div>

            <Panel title="Where the rest lives" description="Academics defines the structure. These modules own what happens inside it.">
              <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                {[
                  { label: 'Students', detail: 'Enrolment, promotion, records', to: '/dashboard/students' },
                  { label: 'Teacher Management', detail: 'Teacher assignments and class teachers', to: '/dashboard/teachers', state: { activeTab: 'assignments' } },
                  { label: 'Attendance', detail: 'Daily marking by class and section', to: '/dashboard/attendance' },
                  { label: 'Examination', detail: 'Exams, marks, results, report cards', to: '/dashboard/examination' },
                ].map(link => (
                  <li key={link.label}>
                    <button
                      onClick={() => navigate(link.to, link.state ? { state: link.state } : undefined)}
                      className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors group focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-600"
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
          </>
        )}
      </AsyncBlock>
    </div>
  );
}
