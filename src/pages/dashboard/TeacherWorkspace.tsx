import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  CalendarDays, LayoutGrid, NotebookPen, PencilRuler, ListTree, GraduationCap, ShieldAlert,
  ClipboardCheck, BookOpen, Users, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useAcademicYear } from '@/context/AcademicYearContext';
import AdminHeader from '@/components/common/AdminHeader';
import { LoadingBlock, ErrorBlock, EmptyBlock, Panel } from '@/components/academics/shared';
import {
  fetchCurrentTeacher, fetchTeacherScope, fetchTeacherAcademicSummary,
  type CurrentTeacher, type TeacherScopeRow, type TeacherAcademicSummary,
} from '@/services/teachingService';
import TodayClasses from '@/components/teaching/TodayClasses';
import LessonPlansView from '@/components/teaching/LessonPlansView';
import AssignmentsView from '@/components/teaching/AssignmentsView';
import SyllabusProgressView from '@/components/teaching/SyllabusProgressView';
import TeacherMarksView from '@/components/teaching/TeacherMarksView';
import ClassWorkspacePanel, { type ClassContext } from '@/components/teaching/ClassWorkspacePanel';

/**
 * My Teaching — the workspace a class or subject teacher runs their day
 * from. Everything here is scoped to the signed-in teacher by the
 * database; a teacher cannot see or touch another teacher's classes.
 */

const TABS = [
  { id: 'today', label: "Today's Classes", icon: CalendarDays },
  { id: 'classes', label: 'My Classes', icon: LayoutGrid },
  { id: 'lessons', label: 'Lesson Plans', icon: NotebookPen },
  { id: 'work', label: 'Homework & Assignments', icon: PencilRuler },
  { id: 'marks', label: 'Marks Entry', icon: ClipboardCheck },
  { id: 'syllabus', label: 'Syllabus Progress', icon: ListTree },
] as const;

type TabId = typeof TABS[number]['id'];
const VALID = new Set<string>(TABS.map(t => t.id));

export default function TeacherWorkspace() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ view?: string }>();
  const { role } = useAuth();
  const { selectedYearId, selectedYear } = useAcademicYear();

  const [teacher, setTeacher] = useState<CurrentTeacher | null>(null);
  const [scope, setScope] = useState<TeacherScopeRow[]>([]);
  const [summary, setSummary] = useState<TeacherAcademicSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notTeacher, setNotTeacher] = useState(false);
  const [openClass, setOpenClass] = useState<ClassContext | null>(null);

  const tab: TabId = useMemo(() => {
    const q = new URLSearchParams(location.search).get('tab');
    if (params.view && VALID.has(params.view)) return params.view as TabId;
    if (q && VALID.has(q)) return q as TabId;
    return 'today';
  }, [params.view, location.search]);

  const today = new Date().toISOString().slice(0, 10);

  const loadCore = useCallback(async () => {
    if (!selectedYearId) return;
    setIsLoading(true);
    setError(null);
    try {
      const t = await fetchCurrentTeacher();
      if (!t) { setNotTeacher(true); setIsLoading(false); return; }
      setTeacher(t);
      const [sc, sm] = await Promise.all([
        fetchTeacherScope(t.id, selectedYearId),
        fetchTeacherAcademicSummary(t.id, selectedYearId, today),
      ]);
      setScope(sc);
      setSummary(sm);
    } catch (err: any) {
      setError(err.message || 'Could not load your teaching workspace.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedYearId, today]);

  useEffect(() => { loadCore(); }, [loadCore]);

  const goTab = (id: string) => navigate(`/dashboard/teaching/${id}`);

  if (isLoading) return <div className="max-w-7xl mx-auto py-6"><LoadingBlock label="Loading your workspace" /></div>;

  if (notTeacher) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <EmptyBlock
          icon={ShieldAlert}
          title="No teaching record"
          description="Your account is not linked to a teacher profile, so there is no teaching workspace to show. If this is wrong, ask an administrator to link your staff record."
        />
      </div>
    );
  }

  if (error) return <div className="max-w-7xl mx-auto py-6"><ErrorBlock message={error} onRetry={loadCore} /></div>;

  // Grouped scope for "My Classes"
  const grouped = new Map<string, { class_name: string; section_name: string; class_id: string; section_id: string; subjects: TeacherScopeRow[] }>();
  scope.forEach(s => {
    const key = `${s.class_id}|${s.section_id}`;
    if (!grouped.has(key)) grouped.set(key, { class_name: s.class_name, section_name: s.section_name, class_id: s.class_id, section_id: s.section_id, subjects: [] });
    grouped.get(key)!.subjects.push(s);
  });
  const classCards = [...grouped.values()].sort((a, b) =>
    a.class_name.localeCompare(b.class_name, undefined, { numeric: true }) || a.section_name.localeCompare(b.section_name));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 text-slate-700">
      <AdminHeader
        title="My Teaching"
        subtitle={`Run your day: attendance, lesson plans, homework, assignments and syllabus for your classes.`}
        badge={{ icon: GraduationCap, text: teacher?.name ?? 'Teacher', variant: 'primary' }}
        sessionBadge={selectedYear ? `Session: ${selectedYear.name}` : undefined}
      />

      {/* summary counters */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <Kpi label="My classes" value={summary.my_classes} icon={LayoutGrid} />
          <Kpi label="Subjects" value={summary.my_subjects} icon={BookOpen} />
          <Kpi label="Classes today" value={summary.classes_today} icon={CalendarDays} />
          <Kpi label="Attendance due" value={summary.pending_attendance} icon={ClipboardCheck} tone={summary.pending_attendance ? 'warn' : 'good'} />
          <Kpi label="To review" value={summary.submissions_to_review} icon={PencilRuler} tone={summary.submissions_to_review ? 'warn' : 'good'} />
          <Kpi label="Syllabus" value={summary.syllabus_percent == null ? '—' : `${summary.syllabus_percent}%`} icon={ListTree} />
        </div>
      )}

      {/* tabs */}
      <div className="bg-slate-100/90 rounded-2xl border border-slate-200/80 p-1.5 overflow-x-auto no-scrollbar">
        <nav className="flex items-center gap-1 min-w-max" aria-label="Teaching sections">
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => goTab(t.id)} aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all',
                  active ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80' : 'text-slate-600 hover:bg-white/60',
                )}>
                <t.icon size={14} className={active ? 'text-indigo-600' : 'text-slate-400'} />
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {!selectedYearId ? (
        <EmptyBlock icon={CalendarDays} title="No academic year" description="Select an academic year to continue." />
      ) : !teacher ? null : openClass ? (
        <ClassWorkspacePanel
          ctx={openClass}
          teacherId={teacher.id}
          academicYearId={selectedYearId}
          canEditAttendance
          onBack={() => setOpenClass(null)}
          onChanged={loadCore}
        />
      ) : tab === 'today' ? (
        <TodayClasses teacherId={teacher.id} academicYearId={selectedYearId} canEditAttendance />
      ) : tab === 'classes' ? (
        <Panel title="My Classes" description="Every class, section and subject you are assigned this year.">
          {classCards.length === 0 ? (
            <EmptyBlock icon={Users} title="No classes assigned" description="You have no active teaching assignments for this year. An administrator sets these in Teacher Management." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {classCards.map(c => (
                <li key={`${c.class_id}|${c.section_id}`} className="px-4 sm:px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-extrabold text-slate-900">{c.class_name}-{c.section_name}</p>
                    <span className="text-[10px] font-bold text-slate-400">{c.subjects.filter(s => s.subject_id).length} subject(s)</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {c.subjects.filter(s => s.subject_id).map(s => (
                      <button
                        key={s.assignment_id}
                        onClick={() => setOpenClass({
                          class_id: c.class_id, class_name: c.class_name,
                          section_id: c.section_id, section_name: c.section_name,
                          subject_id: s.subject_id!, subject_name: s.subject_name ?? 'Subject',
                          date: today,
                        })}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
                      >
                        {s.subject_name}{s.subject_code ? ` (${s.subject_code})` : ''}
                        <ChevronRight size={12} />
                      </button>
                    ))}
                    {c.subjects.some(s => s.assignment_type === 'class_teacher') && (
                      <span className="inline-flex items-center px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black uppercase tracking-wide">
                        Class teacher
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : tab === 'lessons' ? (
        <LessonPlansView teacherId={teacher.id} academicYearId={selectedYearId} scope={scope} />
      ) : tab === 'work' ? (
        <AssignmentsView teacherId={teacher.id} academicYearId={selectedYearId} scope={scope} />
      ) : tab === 'marks' ? (
        <TeacherMarksView teacherId={teacher.id} academicYearId={selectedYearId} />
      ) : tab === 'syllabus' ? (
        <SyllabusProgressView teacherId={teacher.id} academicYearId={selectedYearId} scope={scope} />
      ) : null}
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: React.ReactNode; icon: any; tone?: 'good' | 'warn' }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2.5">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Icon size={11} />{label}</p>
      <p className={cn('text-lg font-extrabold mt-0.5 tabular-nums',
        tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : 'text-slate-800')}>{value}</p>
    </div>
  );
}
