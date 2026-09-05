import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, Plus, Edit2, Trash2, RefreshCw, CalendarDays, FileSpreadsheet,
  AlertTriangle, UserX, CheckCircle2, Users, BookOpen, ShieldCheck, Sparkles, ChevronRight,
  Printer, UserCheck, Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { supabase } from '@/lib/supabase';
import OfficialTimetableModal, { TimetableGridSlot } from './OfficialTimetableModal';
import {
  fetchClasses, fetchSectionDirectory, fetchClassSubjects, fetchSubjects, fetchTeacherOptions,
  fetchTimetable, fetchYearTimetableIndex, fetchTeacherWeeklySchedule, saveTimetableSlot, deleteTimetableSlot,
  TIMETABLE_DAYS, DAY_LABELS,
  type SchoolClass, type SectionDirectoryRow, type ClassSubjectRow, type Subject, type TimetableSlot,
  type TimetableIndexRow, type TeacherTimetableSlot,
} from '@/services/academicsService';
import {
  AsyncBlock, EmptyBlock, Field, GhostButton, IconButton, Modal, Panel,
  PrimaryButton, StatusPill, TableScroll, inputClass, selectClass,
} from './shared';

/**
 * Enterprise weekly teaching schedule matrix for school classes & sections.
 */
export default function TimetableView({ onNavigateView }: { onNavigateView: (view: string) => void }) {
  const { user, role, can } = useAuth();
  const navigate = useNavigate();
  const { selectedYearId, selectedYear } = useAcademicYear();
  const mayManage = can('academics.manage');
  const isTeacher = role === 'teacher' || role === 'class_teacher';

  const [activeTab, setActiveTab] = useState<'my_schedule' | 'class_schedule'>(
    isTeacher ? 'my_schedule' : 'class_schedule'
  );

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState('');
  const [sections, setSections] = useState<SectionDirectoryRow[]>([]);
  const [sectionId, setSectionId] = useState('');
  const [subjects, setSubjects] = useState<ClassSubjectRow[]>([]);
  const [subjectMaster, setSubjectMaster] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Array<{ id: string; name: string; employee_id: string | null; department?: string | null; designation?: string | null; subjects_taught?: string | null; subject_codes?: string | null }>>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);

  // Teacher Schedule States
  const [currentTeacher, setCurrentTeacher] = useState<any>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [teacherWeeklySlots, setTeacherWeeklySlots] = useState<TeacherTimetableSlot[]>([]);
  const [teacherLoading, setTeacherLoading] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TimetableSlot | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isOfficialModalOpen, setIsOfficialModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TimetableSlot | null>(null);
  const [busy, setBusy] = useState(false);
  const [addAt, setAddAt] = useState<{ day: string; period: number } | null>(null);
  const [yearIndex, setYearIndex] = useState<TimetableIndexRow[]>([]);

  // Load teacher profile
  useEffect(() => {
    let cancelled = false;
    async function loadTeacher() {
      try {
        let tProfile: any = null;
        if (user?.id) {
          const { data } = await supabase.from('teachers').select('*').eq('user_id', user.id).maybeSingle();
          tProfile = data;
        }
        if (!tProfile && user?.email) {
          const { data } = await supabase.from('teachers').select('*').ilike('email', user.email).maybeSingle();
          tProfile = data;
        }
        if (!tProfile) {
          const { data } = await supabase.from('teachers').select('*').eq('is_active', true).order('created_at').limit(1).maybeSingle();
          tProfile = data;
        }
        if (cancelled) return;
        setCurrentTeacher(tProfile);
        if (tProfile) {
          setSelectedTeacherId(tProfile.id);
        }
      } catch (err) {
        console.error('Failed to resolve teacher profile:', err);
      }
    }
    loadTeacher();
    return () => { cancelled = true; };
  }, [user]);

  // Load selected teacher's weekly schedule
  const loadTeacherSchedule = useCallback(async (tId: string) => {
    if (!tId || !selectedYearId) return;
    setTeacherLoading(true);
    try {
      const sch = await fetchTeacherWeeklySchedule(tId, selectedYearId);
      setTeacherWeeklySlots(sch);
    } catch (err) {
      console.error('Failed to load teacher weekly schedule:', err);
      setTeacherWeeklySlots([]);
    } finally {
      setTeacherLoading(false);
    }
  }, [selectedYearId]);

  useEffect(() => {
    if (selectedTeacherId && selectedYearId) {
      loadTeacherSchedule(selectedTeacherId);
    }
  }, [selectedTeacherId, selectedYearId, loadTeacherSchedule]);

  // Class list and teacher list, once.
  useEffect(() => {
    (async () => {
      try {
        const [cls, tch, allSubs] = await Promise.all([
          fetchClasses(), fetchTeacherOptions(), fetchSubjects(false),
        ]);
        setClasses(cls);
        setTeachers(tch);
        setSubjectMaster(allSubs);
        if (cls.length > 0) setClassId(prev => prev || cls[0].id);
      } catch (err: any) {
        setError(err.message);
      }
    })();
  }, []);

  // Sections and subjects follow the chosen class.
  useEffect(() => {
    if (!classId || !selectedYearId) return;
    let cancelled = false;
    (async () => {
      try {
        const [secs, subs] = await Promise.all([
          fetchSectionDirectory(selectedYearId, classId),
          fetchClassSubjects(selectedYearId, classId),
        ]);
        if (cancelled) return;
        setSections(secs);
        setSubjects(subs);
        setSectionId(prev => (secs.some(s => s.section_id === prev) ? prev : ''));
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [classId, selectedYearId]);

  const load = useCallback(async () => {
    if (!selectedYearId || !classId) return;
    setIsLoading(true);
    setError(null);
    try {
      setSlots(await fetchTimetable({
        academic_year_id: selectedYearId,
        class_id: classId,
        section_id: sectionId || null,
      }));
    } catch (err: any) {
      setError(err.message);
      setSlots([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYearId, classId, sectionId]);

  useEffect(() => { load(); }, [load]);

  // The clash check spans the entire school year.
  useEffect(() => {
    if (!selectedYearId) return;
    let cancelled = false;
    fetchYearTimetableIndex(selectedYearId)
      .then(rows => { if (!cancelled) setYearIndex(rows); })
      .catch(() => { if (!cancelled) setYearIndex([]); });
    return () => { cancelled = true; };
  }, [selectedYearId, slots]);

  /** Eight periods minimum unless the class already runs more. */
  const periods = useMemo(() => {
    const highest = slots.reduce((m, s) => Math.max(m, s.period_number ?? 0), 0);
    return Array.from({ length: Math.max(8, highest) }, (_, i) => i + 1);
  }, [slots]);

  /**
   * Teachers booked more than once in a period, anywhere in the school.
   */
  const clashes = useMemo(() => {
    const byKey = new Map<string, TimetableIndexRow[]>();
    for (const r of yearIndex) {
      if (!r.teacher_id || r.period_number === null) continue;
      const key = `${r.teacher_id}|${r.day}|${r.period_number}`;
      (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(r);
    }
    const clashing = new Map<string, TimetableIndexRow[]>();
    for (const [key, rows] of byKey) if (rows.length > 1) clashing.set(key, rows);
    return clashing;
  }, [yearIndex]);

  const clashFor = (slot: TimetableSlot) => {
    if (!slot.teacher_id || slot.period_number === null) return null;
    const rows = clashes.get(`${slot.teacher_id}|${slot.day}|${slot.period_number}`);
    if (!rows) return null;
    const elsewhere = rows.filter(r => r.id !== slot.id);
    const classNames = [...new Set(elsewhere.map(r =>
      classes.find(c => c.id === r.class_id)?.class_name ?? '?'))];
    return { count: elsewhere.length, classNames };
  };

  const subjectName = (id: string | null) =>
    subjectMaster.find(s => s.id === id)?.subject_name ?? 'Subject removed';

  const isUnmapped = (id: string | null) =>
    subjects.length > 0 && !subjects.some(s => s.subject_id === id);

  const teacherName = (id: string | null) =>
    teachers.find(t => t.id === id)?.name ?? null;

  const currentSection = sections.find(s => s.section_id === sectionId);

  /** Slots keyed by day and period. */
  const grid = useMemo(() => {
    const map = new Map<string, TimetableSlot[]>();
    for (const s of slots) {
      const key = `${s.day}|${s.period_number ?? 0}`;
      (map.get(key) ?? map.set(key, []).get(key)!).push(s);
    }
    for (const list of map.values()) list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return map;
  }, [slots]);

  /** The clock times this school already uses for each period. */
  const periodTimes = useMemo(() => {
    const counts = new Map<number, Map<string, number>>();
    for (const s of slots) {
      if (s.period_number === null) continue;
      const key = s.start_time.slice(0, 5) + '-' + s.end_time.slice(0, 5);
      const inner = counts.get(s.period_number) ?? counts.set(s.period_number, new Map()).get(s.period_number)!;
      inner.set(key, (inner.get(key) ?? 0) + 1);
    }
    const out = new Map<number, { start: string; end: string }>();
    for (const [period, inner] of counts) {
      const [best] = [...inner.entries()].sort((a, b) => b[1] - a[1]);
      const [start, end] = best[0].split('-');
      out.set(period, { start, end });
    }
    return out;
  }, [slots]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await deleteTimetableSlot(confirmDelete.id);
      toast.success('Period removed.');
      setConfirmDelete(null);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  /** Summary stats */
  const summary = useMemo(() => {
    const filled = slots.length;
    const assignedCount = slots.filter(s => !!s.teacher_id).length;
    const unassigned = filled - assignedCount;
    const clashing = slots.filter(s => clashFor(s)).length;
    const coveragePct = filled > 0 ? Math.round((assignedCount / filled) * 100) : 0;
    return { filled, assignedCount, unassigned, clashing, coveragePct };
  }, [slots, clashes, classes]);

  // Teacher Schedule Grid mapping
  const teacherGrid = useMemo(() => {
    const map = new Map<string, TeacherTimetableSlot[]>();
    for (const s of teacherWeeklySlots) {
      if (s.period_number === null) continue;
      const key = `${s.day}|${s.period_number}`;
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [teacherWeeklySlots]);

  const teacherPeriods = useMemo(() => {
    const highest = teacherWeeklySlots.reduce((m, s) => Math.max(m, s.period_number ?? 0), 0);
    return Array.from({ length: Math.max(8, highest) }, (_, i) => i + 1);
  }, [teacherWeeklySlots]);

  const teacherSummary = useMemo(() => {
    const totalSlots = teacherWeeklySlots.length;
    const distinctClasses = new Set(teacherWeeklySlots.map(s => `${s.class_name}-${s.section_name}`).filter(Boolean));
    const distinctSubjects = new Set(teacherWeeklySlots.map(s => s.subject_name).filter(Boolean));
    const dailyAvg = (totalSlots / 6).toFixed(1);
    return {
      totalSlots,
      classesCount: distinctClasses.size,
      subjectsCount: distinctSubjects.size,
      dailyAvg,
    };
  }, [teacherWeeklySlots]);

  const openAdd = (day?: string, period?: number) => {
    setEditing(null);
    setAddAt(day && period ? { day, period } : null);
    setIsFormOpen(true);
  };

  const openEdit = (slot: TimetableSlot) => {
    setEditing(slot);
    setAddAt(null);
    setIsFormOpen(true);
  };

  const currentClassName = classes.find(c => c.id === classId)?.class_name ?? '';
  const activeTeacher = teachers.find(t => t.id === selectedTeacherId) || currentTeacher;

  return (
    <>
      {/* Top Tab Bar: My Teaching Schedule vs Class Matrix */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-white p-2.5 rounded-2xl border border-slate-100 shadow-2xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl">
          <button
            onClick={() => setActiveTab('my_schedule')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'my_schedule'
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <UserCheck size={14} />
            <span>My Teaching Schedule</span>
            {teacherWeeklySlots.length > 0 && (
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                activeTab === 'my_schedule' ? "bg-blue-100 text-blue-800 font-black" : "bg-slate-200 text-slate-700"
              )}>
                {teacherWeeklySlots.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('class_schedule')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'class_schedule'
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <BookOpen size={14} />
            <span>Class & Section Timetables</span>
          </button>
        </div>

        {activeTab === 'my_schedule' && (
          <div className="flex items-center gap-2">
            {!isTeacher && teachers.length > 0 && (
              <div className="flex items-center gap-2">
                <label htmlFor="tt-teacher-select" className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Teacher:
                </label>
                <select
                  id="tt-teacher-select"
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className={cn(selectClass, 'w-auto text-xs font-bold text-slate-800')}
                >
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.employee_id ? `(${t.employee_id})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Print personal timetable"
            >
              <Printer size={13} /> Print Schedule
            </button>
          </div>
        )}
      </div>

      {/* VIEW 1: MY TEACHING SCHEDULE (PERSONAL MATRIX) */}
      {activeTab === 'my_schedule' && (
        <Panel
          title={`${activeTeacher?.name || 'Faculty'} — Weekly Teaching Matrix`}
          description={
            activeTeacher?.designation
              ? `${activeTeacher.designation} • ${activeTeacher.department || 'Academic Faculty'} • ${selectedYear?.name || 'Current Academic Year'}`
              : `Personal weekly lecture schedule for ${selectedYear?.name || 'this academic session'}`
          }
          action={
            <div className="flex items-center gap-2">
              <GhostButton onClick={() => selectedTeacherId && loadTeacherSchedule(selectedTeacherId)} title="Reload schedule" disabled={teacherLoading}>
                <RefreshCw size={13} className={cn(teacherLoading && 'animate-spin')} aria-hidden="true" /> Refresh
              </GhostButton>
            </div>
          }
        >
          {/* Workload Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-slate-100 bg-white">
            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Weekly Workload</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl font-black text-blue-700 tabular-nums">{teacherSummary.totalSlots}</span>
                <span className="text-xs text-slate-500 font-medium">periods / week</span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assigned Classes</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl font-black text-slate-900 tabular-nums">{teacherSummary.classesCount}</span>
                <span className="text-xs text-slate-500 font-medium">distinct sections</span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Daily Average</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl font-black text-emerald-700 tabular-nums">{teacherSummary.dailyAvg}</span>
                <span className="text-xs text-slate-500 font-medium">lectures / day</span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Subject Coverage</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl font-black text-slate-900 tabular-nums">{teacherSummary.subjectsCount}</span>
                <span className="text-xs text-slate-500 font-medium">subjects taught</span>
              </div>
            </div>
          </div>

          <AsyncBlock
            isLoading={teacherLoading}
            error={null}
            isEmpty={teacherWeeklySlots.length === 0}
            onRetry={() => selectedTeacherId && loadTeacherSchedule(selectedTeacherId)}
            loadingLabel="Loading weekly teaching schedule"
            empty={
              <EmptyBlock
                icon={Calendar}
                title="No lectures scheduled"
                description={`No periods are currently assigned to this faculty member in ${selectedYear?.name ?? 'this academic session'}.`}
              />
            }
          >
            <TableScroll>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    <th scope="col" className="w-20 px-3 py-2.5 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Period
                    </th>
                    {TIMETABLE_DAYS.map(day => (
                      <th key={day} scope="col"
                        className="px-3 py-2.5 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest border-l border-slate-200 min-w-[170px]">
                        <span className="px-2 py-0.5 rounded bg-slate-200/70 text-slate-800 font-black mr-1.5">
                          {day.toUpperCase()}
                        </span>
                        {DAY_LABELS[day]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teacherPeriods.map(period => (
                    <tr key={period} className="align-top hover:bg-slate-50/30 transition-colors">
                      <th scope="row" className="px-3 py-2.5 bg-slate-50/40 text-center border-r border-slate-100">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-black text-slate-900 tabular-nums">P{period}</span>
                          <span className="text-[9px] font-semibold text-slate-400 font-mono mt-0.5">
                            Period {period}
                          </span>
                        </div>
                      </th>
                      {TIMETABLE_DAYS.map(day => {
                        const cellSlots = teacherGrid.get(`${day}|${period}`) ?? [];
                        return (
                          <td key={day} className="p-1.5 border-l border-slate-100">
                            {cellSlots.length === 0 ? (
                              <div className="min-h-[72px] rounded-xl border border-dashed border-slate-200/70 bg-slate-50/20 flex flex-col items-center justify-center text-slate-300 text-[10px] font-medium select-none">
                                <span>Free / Prep</span>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {cellSlots.map(slot => (
                                  <div
                                    key={slot.id}
                                    className="group relative rounded-xl border border-blue-200 bg-blue-50/40 p-2.5 transition-all shadow-2xs hover:shadow-xs hover:border-blue-300"
                                  >
                                    <div className="flex items-start justify-between gap-1.5">
                                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                        {slot.subject_code && (
                                          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 text-[9px] font-black tracking-wider uppercase shrink-0">
                                            {slot.subject_code}
                                          </span>
                                        )}
                                        <p className="text-xs font-black text-slate-900 leading-snug truncate">
                                          {slot.subject_name || 'Class Subject'}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-1 mt-1.5">
                                      <span className="px-1.5 py-0.5 rounded bg-white text-blue-800 border border-blue-200/80 text-[10px] font-bold">
                                        Class {slot.class_name} - Sec {slot.section_name}
                                      </span>
                                      <span className="text-[10px] text-slate-500 font-semibold font-mono">
                                        {slot.start_time} - {slot.end_time}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-blue-200/50">
                                      <button
                                        onClick={() => navigate('/dashboard/attendance', { state: { selectedClass: slot.class_name, selectedSection: slot.section_name } })}
                                        className="text-[9px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                                      >
                                        Mark Attendance →
                                      </button>
                                      <button
                                        onClick={() => navigate('/dashboard/examination?tab=marks')}
                                        className="text-[9px] font-bold text-indigo-700 hover:text-indigo-800 hover:underline cursor-pointer"
                                      >
                                        Marks Entry →
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </AsyncBlock>
        </Panel>
      )}

      {/* VIEW 2: CLASS & SECTION MASTER TIMETABLE */}
      {activeTab === 'class_schedule' && (
      <Panel
        title="Class Academic Timetable"
        description={selectedYear ? `Live weekly schedule matrix for ${selectedYear.name}` : undefined}
        action={
          <div className="flex items-center gap-2">
            <GhostButton onClick={load} title="Reload timetable" disabled={isLoading}>
              <RefreshCw size={13} className={cn(isLoading && 'animate-spin')} aria-hidden="true" /> Reload
            </GhostButton>
            <button
              onClick={() => {
                if (!currentSection && sections.length > 0) {
                  setSectionId(sections[0].section_id);
                }
                setIsOfficialModalOpen(true);
              }}
              disabled={!classId}
              title="Generate and Download Official CBSE Landscape Matrix PDF"
              className="px-3.5 py-1.5 bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet size={14} className="text-blue-200" /> Official PDF Timetable
            </button>
            {mayManage && (
              <PrimaryButton
                onClick={() => openAdd()}
                disabled={!classId}
              >
                <Plus size={14} aria-hidden="true" /> Add Period
              </PrimaryButton>
            )}
          </div>
        }
      >
        {/* Enterprise Control Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="tt-class" className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Class</label>
              <select id="tt-class" className={cn(selectClass, 'w-auto font-bold text-slate-800')} value={classId} onChange={e => setClassId(e.target.value)}>
                {classes.map(c => <option key={c.id} value={c.id}>Class {c.class_name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="tt-section" className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Section</label>
              <select id="tt-section" className={cn(selectClass, 'w-auto font-bold text-slate-800')} value={sectionId} onChange={e => setSectionId(e.target.value)}>
                <option value="">All Sections</option>
                {sections.map(s => <option key={s.section_id} value={s.section_id}>Section {s.section_name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70 text-xs font-bold tabular-nums">
              <BookOpen size={12} /> {slots.length} Periods Scheduled
            </span>
            {currentSection?.room_no && (
              <span className="hidden sm:inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-mono font-bold">
                Room: {currentSection.room_no}
              </span>
            )}
          </div>
        </div>

        {/* Enterprise Executive KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-slate-100 bg-white">
          <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Weekly Load</p>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-slate-900 tabular-nums">{summary.filled}</span>
              <span className="text-xs text-slate-500 font-medium">periods/wk</span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Faculty Coverage</p>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={cn(
                'text-xl font-black tabular-nums',
                summary.coveragePct === 100 ? 'text-emerald-700' : 'text-blue-700'
              )}>
                {summary.coveragePct}%
              </span>
              <span className="text-xs text-slate-500 font-medium">({summary.assignedCount}/{summary.filled})</span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Unassigned</p>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={cn(
                'text-xl font-black tabular-nums',
                summary.unassigned > 0 ? 'text-amber-700' : 'text-slate-400'
              )}>
                {summary.unassigned}
              </span>
              <span className="text-xs text-slate-500 font-medium">slots</span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Conflict Radar</p>
            <div className="flex items-baseline gap-1.5 mt-1">
              {summary.clashing === 0 ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 text-sm font-bold mt-0.5">
                  <ShieldCheck size={16} className="text-emerald-600" /> 0 Conflicts
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-rose-700 text-sm font-bold mt-0.5">
                  <AlertTriangle size={16} className="text-rose-600" /> {summary.clashing} Clash{summary.clashing === 1 ? '' : 'es'}
                </span>
              )}
            </div>
          </div>
        </div>

        <AsyncBlock
          isLoading={isLoading}
          error={error}
          isEmpty={slots.length === 0}
          onRetry={load}
          loadingLabel="Loading timetable"
          empty={
            <EmptyBlock
              icon={Clock}
              title="No periods scheduled"
              description={`Nothing is scheduled for this class and section in ${selectedYear?.name ?? 'this year'}.`}
              actionLabel={mayManage ? '+ Schedule First Period' : undefined}
              onAction={mayManage ? () => openAdd() : undefined}
            />
          }
        >
          <>
            <TableScroll>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    <th scope="col" className="w-20 px-3 py-2.5 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Period
                    </th>
                    {TIMETABLE_DAYS.map(day => (
                      <th key={day} scope="col"
                        className="px-3 py-2.5 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest border-l border-slate-200 min-w-[160px]">
                        <span className="px-2 py-0.5 rounded bg-slate-200/70 text-slate-800 font-black mr-1.5">
                          {day.toUpperCase()}
                        </span>
                        {DAY_LABELS[day]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {periods.map(period => {
                    const knownTime = periodTimes.get(period);
                    return (
                      <tr key={period} className="align-top hover:bg-slate-50/30 transition-colors">
                        <th scope="row" className="px-3 py-2.5 bg-slate-50/40 text-center border-r border-slate-100">
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-black text-slate-900 tabular-nums">P{period}</span>
                            {knownTime && (
                              <span className="text-[9px] font-semibold text-slate-400 font-mono mt-0.5">
                                {knownTime.start}
                              </span>
                            )}
                          </div>
                        </th>
                        {TIMETABLE_DAYS.map(day => {
                          const cell = grid.get(day + '|' + period) ?? [];
                          return (
                            <td key={day} className="p-1.5 border-l border-slate-100">
                              {cell.length === 0 ? (
                                mayManage ? (
                                  <button
                                    onClick={() => openAdd(day, period)}
                                    className="w-full min-h-[64px] rounded-xl border border-dashed border-slate-200 hover:border-blue-400 text-slate-300 hover:text-blue-600 hover:bg-blue-50/40 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer group"
                                    aria-label={'Schedule ' + DAY_LABELS[day] + ' period ' + period}
                                  >
                                    <Plus size={14} className="group-hover:scale-110 transition-transform" />
                                    <span className="text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">Schedule</span>
                                  </button>
                                ) : (
                                  <div className="min-h-[64px]" />
                                )
                              ) : (
                                <div className="space-y-1.5">
                                  {cell.map(slot => {
                                    const clash = clashFor(slot);
                                    const unmapped = isUnmapped(slot.subject_id);
                                    const subMeta = subjectMaster.find(sub => sub.id === slot.subject_id);
                                    return (
                                      <div
                                        key={slot.id}
                                        className={cn(
                                          'group relative rounded-xl border p-2.5 transition-all shadow-2xs hover:shadow-xs',
                                          clash
                                            ? 'border-rose-300 bg-rose-50/70 text-rose-950'
                                            : unmapped
                                            ? 'border-amber-300 bg-amber-50/60 text-amber-950'
                                            : 'border-slate-200 bg-white hover:border-blue-300'
                                        )}
                                      >
                                        <div className="flex items-start justify-between gap-1.5">
                                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                            {subMeta?.subject_code && (
                                              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 text-[9px] font-black tracking-wider uppercase shrink-0">
                                                {subMeta.subject_code}
                                              </span>
                                            )}
                                            <p className="text-xs font-black text-slate-900 leading-snug truncate">
                                              {subjectName(slot.subject_id)}
                                            </p>
                                          </div>
                                          {mayManage && (
                                            <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                              <IconButton onClick={() => openEdit(slot)} label="Edit period">
                                                <Edit2 size={12} />
                                              </IconButton>
                                              <IconButton onClick={() => setConfirmDelete(slot)} tone="danger" label="Delete period">
                                                <Trash2 size={12} />
                                              </IconButton>
                                            </div>
                                          )}
                                        </div>

                                        <div className="flex items-center justify-between gap-1 mt-1.5 text-[10px] text-slate-500 font-semibold font-mono">
                                          <span>{slot.start_time.slice(0, 5)} &ndash; {slot.end_time.slice(0, 5)}</span>
                                          {!sectionId && slot.section_id && (
                                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-sans font-bold text-[9px]">
                                              Sec {sections.find(x => x.section_id === slot.section_id)?.section_name ?? '?'}
                                            </span>
                                          )}
                                        </div>

                                        <div className={cn(
                                          'text-[10px] mt-1 truncate flex items-center gap-1.5 pt-1 border-t border-slate-100',
                                          slot.teacher_id ? 'text-slate-700 font-medium' : 'text-amber-700 font-bold'
                                        )}>
                                          {!slot.teacher_id ? (
                                            <span className="flex items-center gap-1 text-amber-700">
                                              <UserX size={11} aria-hidden="true" /> Unassigned
                                            </span>
                                          ) : (
                                            <span className="truncate">
                                              👨‍🏫 {teacherName(slot.teacher_id)}
                                            </span>
                                          )}
                                        </div>

                                        {clash && (
                                          <p className="text-[10px] font-bold text-rose-700 mt-1 flex items-start gap-1">
                                            <AlertTriangle size={11} className="mt-0.5 shrink-0 text-rose-600" aria-hidden="true" />
                                            <span>Clash: Also in {clash.classNames.map(c => 'Class ' + c).join(', ')}</span>
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
          </>
        </AsyncBlock>
      </Panel>
      )}

      {/* Add / Edit Period Modal with Time-Availability Intelligence */}
      {isFormOpen && selectedYearId && (
        <SlotForm
          slot={editing}
          academicYearId={selectedYearId}
          classId={classId}
          classes={classes}
          yearIndex={yearIndex}
          initialSectionId={sectionId || currentSection?.section_id || (sections[0]?.section_id ?? null)}
          initialDay={addAt?.day ?? null}
          initialPeriod={addAt?.period ?? null}
          periodTimes={periodTimes}
          sections={sections}
          subjects={subjects}
          subjectMaster={subjectMaster}
          teachers={teachers}
          onClose={() => setIsFormOpen(false)}
          onSaved={async () => { setIsFormOpen(false); await load(); }}
        />
      )}

      {confirmDelete && (
        <Modal
          title="Remove this period?"
          onClose={() => setConfirmDelete(null)}
          footer={
            <>
              <GhostButton onClick={() => setConfirmDelete(null)}>Cancel</GhostButton>
              <PrimaryButton onClick={handleDelete} disabled={busy} className="bg-rose-600 hover:bg-rose-700">
                Remove period
              </PrimaryButton>
            </>
          }
        >
          <p className="text-xs text-slate-600">
            Are you sure you want to remove <strong>{subjectName(confirmDelete.subject_id)}</strong> on <strong>{DAY_LABELS[confirmDelete.day]}</strong>, Period {confirmDelete.period_number ?? '?'}.
          </p>
        </Modal>
      )}

      {/* Official CBSE Landscape Matrix Modal */}
      <OfficialTimetableModal
        isOpen={isOfficialModalOpen}
        onClose={() => setIsOfficialModalOpen(false)}
        className={currentClassName}
        sectionName={currentSection?.section_name ?? ''}
        classTeacherName={currentSection?.class_teacher_name ?? ''}
        roomNo={currentSection?.room_no ?? ''}
        academicYear={selectedYear?.name ?? ''}
        slots={slots.map(s => ({
          day: s.day,
          period_number: s.period_number ?? 1,
          subject_name: subjectName(s.subject_id),
          subject_code: subjectMaster.find(sub => sub.id === s.subject_id)?.subject_code || undefined,
          teacher_name: teacherName(s.teacher_id) || undefined,
          start_time: s.start_time,
          end_time: s.end_time
        }))}
      />
    </>
  );
}

// ---------------------------------------------------------------------

function SlotForm({
  slot, academicYearId, classId, classes, yearIndex, initialSectionId, initialDay, initialPeriod, periodTimes,
  sections, subjects, subjectMaster, teachers, onClose, onSaved,
}: {
  slot: TimetableSlot | null;
  academicYearId: string;
  classId: string;
  classes: SchoolClass[];
  yearIndex: TimetableIndexRow[];
  initialSectionId: string | null;
  initialDay: string | null;
  initialPeriod: number | null;
  periodTimes: Map<number, { start: string; end: string }>;
  sections: SectionDirectoryRow[];
  subjects: ClassSubjectRow[];
  subjectMaster: Subject[];
  teachers: Array<{ id: string; name: string; employee_id: string | null; department?: string | null; designation?: string | null; subjects_taught?: string | null; subject_codes?: string | null }>;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [sectionId, setSectionId] = useState<string>(
    slot?.section_id ?? initialSectionId ?? sections[0]?.section_id ?? ''
  );

  // Mapped subjects for this section or class
  const available = useMemo(() => {
    const direct = subjects.filter(s => s.section_id === null || s.section_id === sectionId);
    if (direct.length > 0) return direct;
    if (subjects.length > 0) return subjects;
    return [];
  }, [subjects, sectionId]);

  const [day, setDay] = useState(slot?.day ?? initialDay ?? 'mon');
  const [period, setPeriod] = useState(String(slot?.period_number ?? initialPeriod ?? 1));
  const [subjectId, setSubjectId] = useState(slot?.subject_id ?? (available[0]?.subject_id || ''));

  const known = periodTimes.get(Number(slot?.period_number ?? initialPeriod ?? 1));
  const [startTime, setStartTime] = useState((slot?.start_time ?? known?.start ?? '09:00').slice(0, 5));
  const [endTime, setEndTime] = useState((slot?.end_time ?? known?.end ?? '09:40').slice(0, 5));
  const [teacherId, setTeacherId] = useState(slot?.teacher_id ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Sync times when changing period for a new slot
  useEffect(() => {
    if (slot) return;
    const times = periodTimes.get(Number(period));
    if (!times) return;
    setStartTime(times.start.slice(0, 5));
    setEndTime(times.end.slice(0, 5));
  }, [period, periodTimes, slot]);

  // Adjust duration preset helper
  const applyDuration = (mins: number) => {
    if (!startTime) return;
    const [h, m] = startTime.split(':').map(Number);
    const totalMins = h * 60 + m + mins;
    const endH = Math.floor(totalMins / 60) % 24;
    const endM = totalMins % 60;
    setEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
  };

  // Selected subject details
  const selectedSubject = available.find(s => s.subject_id === subjectId) ||
    subjectMaster.find(s => s.id === subjectId);
  const selectedSubjectName = (selectedSubject as any)?.subject_name?.toLowerCase() || '';

  // Precise Time-Based & Period-Based Teacher Availability Engine
  const teacherAnalysis = useMemo(() => {
    const periodNum = Number(period);
    const busyMap = new Map<string, { className: string; sectionName?: string; subjectName?: string; startTime?: string; endTime?: string; period?: number }>();

    for (const r of yearIndex) {
      if (!r.teacher_id || r.day !== day || r.id === slot?.id) continue;

      let isTimeOverlap = false;

      // 1. Precise clock-time interval overlap check: (r.start < new.end && r.end > new.start)
      if (startTime && endTime && r.start_time && r.end_time) {
        if (r.start_time < endTime && r.end_time > startTime) {
          isTimeOverlap = true;
        }
      } else if (r.period_number === periodNum) {
        isTimeOverlap = true;
      }

      if (isTimeOverlap) {
        const clsName = r.class_name || classes.find(c => c.id === r.class_id)?.class_name || 'Other Class';
        busyMap.set(r.teacher_id, {
          className: clsName,
          sectionName: r.section_name || undefined,
          subjectName: r.subject_name || undefined,
          startTime: r.start_time || undefined,
          endTime: r.end_time || undefined,
          period: r.period_number || undefined
        });
      }
    }

    const specialists: Array<typeof teachers[0]> = [];
    const otherAvailable: Array<typeof teachers[0]> = [];
    const busyTeachers: Array<typeof teachers[0] & { conflictDesc: string }> = [];

    for (const t of teachers) {
      const conflict = busyMap.get(t.id);
      if (conflict) {
        const timeSpan = conflict.startTime && conflict.endTime ? ` (${conflict.startTime}-${conflict.endTime})` : ` P${conflict.period ?? ''}`;
        const desc = `Class ${conflict.className}${conflict.sectionName ? '-' + conflict.sectionName : ''}${conflict.subjectName ? ` [${conflict.subjectName}]` : ''}${timeSpan}`;
        busyTeachers.push({ ...t, conflictDesc: desc });
      } else {
        const subjectsTaughtLower = (t.subjects_taught || '').toLowerCase();
        const isSpecialist = selectedSubjectName && subjectsTaughtLower.includes(selectedSubjectName);
        if (isSpecialist) {
          specialists.push(t);
        } else {
          otherAvailable.push(t);
        }
      }
    }

    return { busyMap, specialists, otherAvailable, busyTeachers };
  }, [yearIndex, day, period, startTime, endTime, teachers, slot, classes, selectedSubjectName]);

  const selectedTeacher = teachers.find(t => t.id === teacherId);
  const selectedTeacherConflict = teacherId ? teacherAnalysis.busyMap.get(teacherId) : null;
  const isSelectedSpecialist = selectedTeacher && selectedSubjectName && (selectedTeacher.subjects_taught || '').toLowerCase().includes(selectedSubjectName);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!subjectId) next.subjectId = 'Please select a subject.';
    if (!/^\d+$/.test(period) || Number(period) < 1) next.period = 'Period must be a positive number.';
    if (!startTime) next.startTime = 'Start time is required.';
    if (!endTime) next.endTime = 'End time is required.';
    if (startTime && endTime && endTime <= startTime) next.endTime = 'End time must be after start time.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      await saveTimetableSlot({
        id: slot?.id,
        academic_year_id: academicYearId,
        class_id: classId,
        section_id: sectionId || null,
        subject_id: subjectId,
        teacher_id: teacherId || null,
        day,
        period_number: Number(period),
        start_time: startTime,
        end_time: endTime,
      });
      toast.success(slot ? 'Period updated successfully.' : 'Period scheduled successfully.');
      await onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save timetable period.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={slot ? 'Edit Timetable Period' : 'Schedule Timetable Period'}
      description={`Configuring period for ${DAY_LABELS[day]} • Period ${period}`}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : slot ? 'Update Period' : 'Save Period'}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Day of Week" htmlFor="tt-day">
            <select id="tt-day" className={selectClass} value={day} onChange={e => setDay(e.target.value)}>
              {TIMETABLE_DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
            </select>
          </Field>
          <Field label="Period Number" htmlFor="tt-period" error={errors.period}>
            <input id="tt-period" className={inputClass} value={period} inputMode="numeric"
              onChange={e => setPeriod(e.target.value)} aria-invalid={!!errors.period} placeholder="e.g. 1" />
          </Field>
        </div>

        {/* Time Interval with Duration Quick Presets */}
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Starts At" htmlFor="tt-start" error={errors.startTime}>
              <input id="tt-start" type="time" className={inputClass} value={startTime}
                onChange={e => setStartTime(e.target.value)} aria-invalid={!!errors.startTime} />
            </Field>
            <Field label="Ends At" htmlFor="tt-end" error={errors.endTime}>
              <input id="tt-end" type="time" className={inputClass} value={endTime}
                onChange={e => setEndTime(e.target.value)} aria-invalid={!!errors.endTime} />
            </Field>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Duration:</span>
            {[35, 40, 45, 50, 60].map(mins => (
              <button
                key={mins}
                type="button"
                onClick={() => applyDuration(mins)}
                className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-600 text-[10px] font-bold font-mono transition-colors cursor-pointer"
              >
                +{mins}m
              </button>
            ))}
          </div>
        </div>

        {sections.length > 0 && (
          <Field label="Target Section" htmlFor="tt-form-section"
            hint="The period is scheduled for this specific section.">
            <select id="tt-form-section" className={selectClass} value={sectionId}
              onChange={e => setSectionId(e.target.value)}>
              {sections.map(sec => (
                <option key={sec.section_id} value={sec.section_id}>Section {sec.section_name}</option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Subject" htmlFor="tt-subject" error={errors.subjectId}>
          <select id="tt-subject" className={selectClass} value={subjectId}
            onChange={e => {
              const newSubId = e.target.value;
              setSubjectId(newSubId);
              if (!slot && newSubId) {
                const targetSub = available.find(s => s.subject_id === newSubId);
                if (targetSub?.teacher_names) {
                  const matched = teachers.find(t => 
                    targetSub.teacher_names?.toLowerCase().includes(t.name.toLowerCase()) ||
                    t.name.toLowerCase().includes(targetSub.teacher_names?.toLowerCase())
                  );
                  if (matched) {
                    setTeacherId(matched.id);
                  }
                }
              }
            }}
            aria-invalid={!!errors.subjectId}
          >
            <option value="">Choose a subject</option>
            {available.length > 0 ? (
              available.map(s => (
                <option key={s.mapping_id || s.subject_id} value={s.subject_id}>
                  {s.subject_name} {s.subject_code ? `[${s.subject_code}]` : ''} {s.teacher_names ? `— Faculty: ${s.teacher_names}` : ''}
                </option>
              ))
            ) : (
              subjectMaster.map(s => (
                <option key={s.id} value={s.id}>
                  {s.subject_name} {s.subject_code ? `[${s.subject_code}]` : ''} (From Subject Master)
                </option>
              ))
            )}
          </select>
        </Field>

        {/* Teacher Selection with Availability & Specialization Intelligence */}
        <Field 
          label="Assigned Teacher" 
          htmlFor="tt-teacher"
          hint={`Time Window Status (${DAY_LABELS[day]}, ${startTime}-${endTime}): ${teacherAnalysis.specialists.length + teacherAnalysis.otherAvailable.length} Available (${teacherAnalysis.specialists.length} Specialists), ${teacherAnalysis.busyTeachers.length} Busy`}
        >
          <select 
            id="tt-teacher" 
            className={cn(selectClass, selectedTeacherConflict && 'border-amber-400 bg-amber-50/30')} 
            value={teacherId} 
            onChange={e => setTeacherId(e.target.value)}
          >
            <option value="">Unassigned (No teacher allocated)</option>
            
            {/* 1. Recommended Subject Specialists */}
            {teacherAnalysis.specialists.length > 0 && (
              <optgroup label={`⭐ Recommended Subject Specialists — Free (${teacherAnalysis.specialists.length})`}>
                {teacherAnalysis.specialists.map(t => (
                  <option key={t.id} value={t.id}>
                    ⭐ {t.name} • {t.subjects_taught || 'Specialist'} (Available {startTime}-{endTime})
                  </option>
                ))}
              </optgroup>
            )}

            {/* 2. Other Free Teachers */}
            {teacherAnalysis.otherAvailable.length > 0 && (
              <optgroup label={`🟢 Other Free Faculty (${teacherAnalysis.otherAvailable.length})`}>
                {teacherAnalysis.otherAvailable.map(t => (
                  <option key={t.id} value={t.id}>
                    ✅ {t.name} {t.subjects_taught ? `(${t.subjects_taught})` : ''} — Free ({startTime}-{endTime})
                  </option>
                ))}
              </optgroup>
            )}

            {/* 3. Busy Teachers with Time Overlap */}
            {teacherAnalysis.busyTeachers.length > 0 && (
              <optgroup label={`🔴 Busy / Time Conflict (${teacherAnalysis.busyTeachers.length})`}>
                {teacherAnalysis.busyTeachers.map(t => (
                  <option key={t.id} value={t.id}>
                    ⚠️ {t.name} {t.subjects_taught ? `(${t.subjects_taught})` : ''} — Busy in {t.conflictDesc}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </Field>

        {/* Selected Teacher Intelligence & Availability Card */}
        {selectedTeacher && (
          <div className={cn(
            'p-3.5 rounded-xl border transition-all text-xs space-y-2',
            selectedTeacherConflict 
              ? 'bg-rose-50/70 border-rose-300 text-rose-950' 
              : 'bg-slate-50 border-slate-200 text-slate-800'
          )}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-slate-900 leading-tight">
                    {selectedTeacher.name}
                  </span>
                  {selectedTeacher.employee_id && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-mono font-bold">
                      {selectedTeacher.employee_id}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {selectedTeacher.designation || 'Faculty'} {selectedTeacher.department ? `• ${selectedTeacher.department} Dept` : ''}
                </p>
              </div>

              {isSelectedSpecialist ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold flex items-center gap-1 shrink-0">
                  ⭐ Subject Specialist
                </span>
              ) : selectedSubject ? (
                <span className="px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 text-[10px] font-medium shrink-0">
                  Cross-Department
                </span>
              ) : null}
            </div>

            <div className="text-[11px] pt-1 border-t border-slate-200/60 flex items-center gap-1.5 flex-wrap">
              <strong className="text-slate-700 font-bold">Subjects Taught:</strong>
              <span className="text-slate-900 font-semibold">
                {selectedTeacher.subjects_taught || 'General Teaching / Not specified'}
              </span>
            </div>

            <div className="text-[11px] pt-1 border-t border-slate-200/60">
              {selectedTeacherConflict ? (
                <div className="flex items-start gap-1.5 text-rose-700 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Schedule Conflict: Busy teaching <u>Class {selectedTeacherConflict.className}{selectedTeacherConflict.sectionName ? `-${selectedTeacherConflict.sectionName}` : ''}</u> ({selectedTeacherConflict.subjectName || 'Subject'}) during this time window on {DAY_LABELS[day]}.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Available: Free from {startTime} to {endTime} on {DAY_LABELS[day]} (No overlapping classes).</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
