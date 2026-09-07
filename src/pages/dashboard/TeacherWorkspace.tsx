import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  CalendarDays, LayoutGrid, NotebookPen, PencilRuler, ListTree, GraduationCap, ShieldAlert,
  ClipboardCheck, BookOpen, Users, ChevronRight, Search, Crown, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useAcademicYear } from '@/context/AcademicYearContext';
import AdminHeader from '@/components/common/AdminHeader';
import { LoadingBlock, ErrorBlock, EmptyBlock, Panel, inputClass } from '@/components/academics/shared';
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
  const [classQuery, setClassQuery] = useState('');

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

  // "My Classes": grouped one card per class, with every section the
  // teacher actually holds for that class nested inside it — real distinct
  // sections stay visible, but the same class no longer repeats as three
  // near-identical top-level rows.
  type SectionGroup = { section_id: string; section_name: string; isClassTeacher: boolean; subjects: TeacherScopeRow[] };
  type ClassGroup = { class_id: string; class_name: string; sections: SectionGroup[] };

  // Plain computation, not a hook: this runs after early returns above, and
  // the list is small (a teacher's own assignments), so re-deriving it on
  // every render is cheap.
  const buildClassCards = (): ClassGroup[] => {
    const classes = new Map<string, { class_name: string; sections: Map<string, SectionGroup> }>();
    scope.forEach(s => {
      if (!classes.has(s.class_id)) classes.set(s.class_id, { class_name: s.class_name, sections: new Map() });
      const cls = classes.get(s.class_id)!;
      if (!cls.sections.has(s.section_id)) {
        cls.sections.set(s.section_id, { section_id: s.section_id, section_name: s.section_name, isClassTeacher: false, subjects: [] });
      }
      const sec = cls.sections.get(s.section_id)!;
      if (s.assignment_type === 'class_teacher') sec.isClassTeacher = true;
      if (s.subject_id) sec.subjects.push(s);
    });
    return [...classes.entries()]
      .map(([class_id, c]) => ({
        class_id,
        class_name: c.class_name,
        sections: [...c.sections.values()].sort((a, b) => a.section_name.localeCompare(b.section_name)),
      }))
      .sort((a, b) => a.class_name.localeCompare(b.class_name, undefined, { numeric: true }));
  };
  const classCards = buildClassCards();
  const totalSections = classCards.reduce((n, c) => n + c.sections.length, 0);

  const classQ = classQuery.trim().toLowerCase();
  const filteredClassCards = !classQ ? classCards : classCards
    .map(c => ({
      ...c,
      sections: c.sections.filter(sec =>
        `${c.class_name} ${sec.section_name}`.toLowerCase().includes(classQ) ||
        sec.subjects.some(s => (s.subject_name ?? '').toLowerCase().includes(classQ)),
      ),
    }))
    .filter(c => c.sections.length > 0);

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi label="My classes" value={summary.my_classes} icon={LayoutGrid} accent="indigo" />
          <Kpi label="Subjects" value={summary.my_subjects} icon={BookOpen} accent="violet" />
          <Kpi label="Classes today" value={summary.classes_today} icon={CalendarDays} accent="sky" />
          <Kpi label="Attendance due" value={summary.pending_attendance} icon={ClipboardCheck} accent={summary.pending_attendance ? 'amber' : 'emerald'} />
          <Kpi label="To review" value={summary.submissions_to_review} icon={PencilRuler} accent={summary.submissions_to_review ? 'amber' : 'emerald'} />
          <Kpi label="Syllabus" value={summary.syllabus_percent == null ? '—' : `${summary.syllabus_percent}%`} icon={ListTree} accent="slate" />
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
        <Panel
          title="My Classes"
          description={`${classCards.length} class${classCards.length === 1 ? '' : 'es'} · ${totalSections} section${totalSections === 1 ? '' : 's'} you actually hold this year — grouped by class, sections nested underneath.`}
          action={
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={classQuery}
                onChange={e => setClassQuery(e.target.value)}
                placeholder="Search class, section or subject"
                className={inputClass + ' w-64 pl-8'}
              />
              {classQuery && (
                <button
                  onClick={() => setClassQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          }
        >
          {classCards.length === 0 ? (
            <EmptyBlock icon={Users} title="No classes assigned" description="You have no active teaching assignments for this year. An administrator sets these in Teacher Management." />
          ) : filteredClassCards.length === 0 ? (
            <EmptyBlock icon={Search} title="No matches" description="Nothing in your classes matches that search." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-4">
              {filteredClassCards.map(c => (
                <div key={c.class_id} className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-600 text-white text-xs font-black">
                        {c.class_name}
                      </span>
                      <p className="text-[13px] font-extrabold text-slate-900">Class {c.class_name}</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      {c.sections.length} section{c.sections.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <ul className="divide-y divide-slate-100">
                    {c.sections.map(sec => (
                      <li key={sec.section_id} className="flex items-start gap-3 px-4 py-3">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-black shrink-0 mt-0.5">
                          {sec.section_name}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-[11px] font-bold text-slate-500">Section {sec.section_name}</p>
                            {sec.isClassTeacher && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black uppercase tracking-wide">
                                <Crown size={9} /> Class teacher
                              </span>
                            )}
                          </div>
                          {sec.subjects.length === 0 ? (
                            <p className="text-[11px] text-slate-400 mt-1.5">No subject assigned</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {sec.subjects.map(s => (
                                <button
                                  key={s.assignment_id}
                                  onClick={() => setOpenClass({
                                    class_id: c.class_id, class_name: c.class_name,
                                    section_id: sec.section_id, section_name: sec.section_name,
                                    subject_id: s.subject_id!, subject_name: s.subject_name ?? 'Subject',
                                    date: today,
                                  })}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50/50 transition-colors"
                                >
                                  {s.subject_name}{s.subject_code ? ` (${s.subject_code})` : ''}
                                  <ChevronRight size={12} />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
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

const KPI_ACCENTS = {
  indigo: { box: 'bg-indigo-50 text-indigo-600', value: 'text-slate-900' },
  violet: { box: 'bg-violet-50 text-violet-600', value: 'text-slate-900' },
  sky: { box: 'bg-sky-50 text-sky-600', value: 'text-slate-900' },
  amber: { box: 'bg-amber-50 text-amber-600', value: 'text-amber-600' },
  emerald: { box: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-600' },
  slate: { box: 'bg-slate-100 text-slate-500', value: 'text-slate-900' },
} as const;

function Kpi({
  label, value, icon: Icon, accent = 'slate',
}: {
  label: string; value: React.ReactNode; icon: any; accent?: keyof typeof KPI_ACCENTS;
}) {
  const a = KPI_ACCENTS[accent];
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-3.5 py-3 shadow-2xs">
      <span className={cn('inline-flex items-center justify-center w-9 h-9 rounded-xl shrink-0', a.box)}>
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</p>
        <p className={cn('text-lg font-extrabold leading-tight tabular-nums', a.value)}>{value}</p>
      </div>
    </div>
  );
}
