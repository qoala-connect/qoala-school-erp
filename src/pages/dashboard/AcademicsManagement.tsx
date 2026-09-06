import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  LayoutGrid, CalendarRange, Layers, BookOpen, Network, Clock, ShieldCheck, ListTree, GaugeCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useAcademicYear } from '@/context/AcademicYearContext';
import AcademicsOverview from '@/components/academics/AcademicsOverview';
import AcademicYearsView from '@/components/academics/AcademicYearsView';
import ClassesSectionsView from '@/components/academics/ClassesSectionsView';
import SubjectsView from '@/components/academics/SubjectsView';
import ClassSubjectsView from '@/components/academics/ClassSubjectsView';
import AcademicStructureView from '@/components/academics/AcademicStructureView';
import TimetableView from '@/components/academics/TimetableView';
import CurriculumView from '@/components/academics/CurriculumView';
import AcademicMonitorView from '@/components/academics/AcademicMonitorView';
import { LoadingBlock, ErrorBlock, selectClass } from '@/components/academics/shared';
import AdminHeader from '@/components/common/AdminHeader';

/**
 * Academics: the single owner of the school's academic structure.
 *
 * Owns academic years, classes, sections, subjects, the class-subject
 * offering and the timetable. Everything else in the ERP references
 * those rows by id.
 *
 * Deliberately not here, because another module owns it:
 *
 *   Teacher assignments   Teacher Management, /dashboard/teachers
 *   Student enrolment     Students, /dashboard/students
 *   Attendance            Attendance, /dashboard/attendance
 *   Exams, marks, results Examination, /dashboard/examination
 *   Fee structure         Fees, /dashboard/fees
 *
 * Where those appear on an Academics screen they are read-only summaries
 * with a link that carries the class, section and year into the owning
 * module. No screen here duplicates their editing.
 */

export const ACADEMICS_VIEWS = [
  { id: 'overview',       label: 'Overview',            icon: LayoutGrid },
  { id: 'years',          label: 'Academic Years',      icon: CalendarRange },
  { id: 'classes',        label: 'Classes & Sections',  icon: Layers },
  { id: 'subjects',       label: 'Subjects',            icon: BookOpen },
  { id: 'class-subjects', label: 'Class Subjects',      icon: Network },
  { id: 'curriculum',     label: 'Curriculum & Syllabus', icon: ListTree },
  { id: 'timetable',      label: 'Timetable',           icon: Clock },
  { id: 'monitor',        label: 'Academic Monitor',    icon: GaugeCircle },
  { id: 'structure',      label: 'Academic Structure',  icon: Network },
] as const;

export type AcademicsViewId = typeof ACADEMICS_VIEWS[number]['id'];

const VALID = new Set<string>(ACADEMICS_VIEWS.map(v => v.id));

/**
 * The old page addressed its tabs through router state, which meant a
 * tab could not be linked to or reloaded. The view is now in the path.
 * Router state is still honoured so existing sidebar entries and any
 * bookmark that relied on it keep working.
 */
const LEGACY_TAB_MAP: Record<string, AcademicsViewId> = {
  years: 'years',
  classes: 'classes',
  subjects: 'subjects',
  timetable: 'timetable',
  lessons: 'overview',
};

export default function AcademicsManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ view?: string }>();
  const { role, can } = useAuth();
  const { years, selectedYear, selectedYearId, selectYear, isLoading, error, refresh, isViewingHistory } =
    useAcademicYear();

  // Defense-in-depth: Redirect students/parents to their personal class timetable
  useEffect(() => {
    if (role === 'student' || role === 'parent') {
      navigate('/dashboard/portal?tab=timetable', { replace: true });
    }
  }, [role, navigate]);

  const legacyTab = (location.state as any)?.activeTab as string | undefined;

  const view: AcademicsViewId = useMemo(() => {
    if (params.view && VALID.has(params.view)) return params.view as AcademicsViewId;
    if (legacyTab && LEGACY_TAB_MAP[legacyTab]) return LEGACY_TAB_MAP[legacyTab];
    return 'overview';
  }, [params.view, legacyTab]);

  // Send /dashboard/academics and any unknown view to a real, linkable URL.
  //
  // The dashboard animates route changes, which keeps this page mounted for
  // the length of the exit transition after the user has already navigated
  // somewhere else. Without the pathname check the redirect below fired
  // during that window and dragged them straight back into Academics, so no
  // other sidebar module could be opened once this one had been.
  const isOnAcademicsPath = location.pathname.startsWith('/dashboard/academics');

  useEffect(() => {
    if (!isOnAcademicsPath) return;
    if (!params.view || !VALID.has(params.view)) {
      navigate(`/dashboard/academics/${view}`, { replace: true, state: location.state });
    }
  }, [isOnAcademicsPath, params.view, view, navigate, location.state]);

  const goToView = (next: string) => navigate(`/dashboard/academics/${next}`);

  const mayManage = can('academics.manage');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 text-slate-700">
      {/* 1. Master Page Header Banner */}
      <AdminHeader
        title="Academic Management"
        subtitle="Curriculum structure, academic sessions, classes, sections, subject catalogs, and weekly timetables."
        badge={{
          icon: BookOpen,
          text: 'Academic Directorate',
          variant: 'primary'
        }}
        sessionBadge="Session: 2026-27"
        actions={
          <div className="flex items-center gap-2">
            {!mayManage && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600">
                <ShieldCheck size={14} aria-hidden="true" className="text-slate-500" /> View only
              </span>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
                Academic Year:
              </span>
              <select
                id="academic-year"
                className={cn(
                  'w-auto min-w-[140px] font-semibold text-xs bg-white border border-slate-200/90 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs cursor-pointer transition-all',
                  isViewingHistory && 'border-amber-400 bg-amber-50/60'
                )}
                value={selectedYearId ?? ''}
                onChange={e => selectYear(e.target.value)}
                disabled={isLoading || years.length === 0}
              >
                {years.length === 0 && <option value="">No years</option>}
                {years.map(y => (
                  <option key={y.id} value={y.id}>
                    {y.name}{y.is_current ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
      />

      {/* 2. Workspace Navigation Tabs (Enterprise Segmented Dock) */}
      <div className="bg-slate-100/90 rounded-2xl border border-slate-200/80 p-1.5 shadow-2xs overflow-x-auto no-scrollbar">
        <nav
          className="flex items-center gap-1 min-w-max"
          aria-label="Academics sections"
        >
          {ACADEMICS_VIEWS.map(v => {
            const isActive = view === v.id;
            return (
              <button
                key={v.id}
                onClick={() => goToView(v.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer',
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                )}
              >
                <v.icon size={14} className={isActive ? "text-indigo-600" : "text-slate-400"} aria-hidden="true" />
                <span>{v.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {isLoading && years.length === 0 ? (
        <LoadingBlock label="Loading academic years" />
      ) : error ? (
        <ErrorBlock message={error} onRetry={refresh} />
      ) : (
        <>
          {view === 'overview'       && <AcademicsOverview onNavigateView={goToView} />}
          {view === 'years'          && <AcademicYearsView />}
          {view === 'classes'        && <ClassesSectionsView />}
          {view === 'subjects'       && <SubjectsView onNavigateView={goToView} />}
          {view === 'class-subjects' && <ClassSubjectsView />}
          {view === 'curriculum'     && <CurriculumView />}
          {view === 'timetable'      && <TimetableView onNavigateView={goToView} />}
          {view === 'monitor'        && <AcademicMonitorView />}
          {view === 'structure'      && <AcademicStructureView />}
        </>
      )}

      {selectedYear && view !== 'overview' && (
        <p className="text-xs text-slate-400 px-1 font-medium">
          Showing {selectedYear.name}
          {isViewingHistory && ', which is not the school’s current year'}.
        </p>
      )}
    </div>
  );
}
