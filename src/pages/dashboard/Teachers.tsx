import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Plus, Search, Filter, RefreshCw, Eye, Edit2, 
  Trash2, Award, BookOpen, GraduationCap, Calendar, Clock, 
  Layers, Download, AlertTriangle, CheckCircle2, ShieldCheck, 
  Briefcase, ChevronRight, UserPlus, SlidersHorizontal, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { 
  Teacher, 
  TeacherAssignment, 
  fetchTeachers, 
  fetchAssignments 
} from '@/services/teacherService';
import TeacherFormModal from '@/components/teachers/TeacherFormModal';
import TeacherAssignmentModal, { AssignmentPrefill } from '@/components/teachers/TeacherAssignmentModal';
import BulkAssignmentModal from '@/components/teachers/BulkAssignmentModal';
import TeacherStatusModal from '@/components/teachers/TeacherStatusModal';
import Teacher360Drawer from '@/components/teachers/Teacher360Drawer';
import { supabase } from '@/lib/supabase';
import AdminHeader from '@/components/common/AdminHeader';
import AdminStatCard from '@/components/common/AdminStatCard';

type ViewMode = 'directory' | 'assignments' | 'workload';

/**
 * What another module can ask this page to do when it links here.
 *
 * Academics and the sidebar both point at the assignments hub. Academics
 * additionally sends the class, section and subject of the gap it found, so
 * the user lands on the right form instead of the faculty directory.
 */
interface TeachersNavState {
  activeTab?: ViewMode;
  assign?: AssignmentPrefill;
  selectedTeacherId?: string;
}

const TEACHERS_PATH = '/dashboard/teachers';

export default function Teachers() {
  const { role, can } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<ViewMode>(
    (location.state as TeachersNavState | null)?.activeTab ?? 'directory'
  );
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string | null>(
    (location.state as any)?.selectedTeacherId ?? null
  );
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');

  // Academic Year State
  const [academicYears, setAcademicYears] = useState<Array<{ id: string; name: string; is_current: boolean }>>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');

  // Modals & Drawers
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [assignPrefill, setAssignPrefill] = useState<AssignmentPrefill | null>(null);

  // Handle incoming cross-module selection (e.g. from Global Search)
  useEffect(() => {
    const teacherId = (location.state as any)?.selectedTeacherId;
    if (teacherId) {
      setSelectedTeacherFilter(teacherId);
      setActiveTab('directory');
    }
  }, [location.state]);

  // Act on a link from another module once per navigation. The route
  // transition animates, which keeps this page mounted briefly after the
  // user has moved on, so the pathname is checked before anything is opened.
  const consumedNavState = useRef<unknown>(null);
  useEffect(() => {
    if (location.pathname !== TEACHERS_PATH) return;
    const nav = location.state as TeachersNavState | null;
    if (!nav || consumedNavState.current === nav) return;
    consumedNavState.current = nav;

    if (nav.activeTab) setActiveTab(nav.activeTab);
    if (nav.selectedTeacherId) {
      setSelectedTeacherFilter(nav.selectedTeacherId);
      setActiveTab('directory');
    }
    if (nav.assign) {
      setSelectedTeacher(null);
      setAssignPrefill(nav.assign);
      setIsAssignOpen(true);
    }
  }, [location.pathname, location.state]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tList, yrs, asgns] = await Promise.all([
        fetchTeachers({
          search: searchQuery,
          status: statusFilter,
          department: departmentFilter
        }),
        supabase.from('academic_years').select('id, name, is_current').order('start_date', { ascending: false }),
        fetchAssignments()
      ]);

      setTeachers(tList);
      setAssignments(asgns);

      if (yrs.data && yrs.data.length > 0) {
        setAcademicYears(yrs.data);
        if (!selectedYearId) {
          const current = yrs.data.find(y => y.is_current) || yrs.data[0];
          setSelectedYearId(current.id);
        }
      }
    } catch (err: any) {
      console.error('[Teachers] Load error:', err);
      toast.error('Failed to load faculty directory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, departmentFilter, selectedYearId]);

  // Client search filtering & cross-module teacher selection
  const filteredTeachers = useMemo(() => {
    let list = teachers;
    if (selectedTeacherFilter) {
      const matched = list.filter(t => t.id === selectedTeacherFilter || t.employee_id === selectedTeacherFilter);
      if (matched.length > 0) {
        list = matched;
      }
    }
    return list.filter(t => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        t.name.toLowerCase().includes(q) ||
        (t.employee_id && t.employee_id.toLowerCase().includes(q)) ||
        (t.email && t.email.toLowerCase().includes(q)) ||
        (t.phone && t.phone.toLowerCase().includes(q)) ||
        t.department.toLowerCase().includes(q) ||
        t.designation.toLowerCase().includes(q) ||
        t.classes_covered?.some(c => c.toLowerCase().includes(q)) ||
        t.subjects_taught?.some(s => s.toLowerCase().includes(q));

      const matchLevel = levelFilter === 'all' || t.cbse_teaching_level === levelFilter;
      return matchSearch && matchLevel;
    });
  }, [teachers, searchQuery, levelFilter, selectedTeacherFilter]);

  // Metric summaries
  const metrics = useMemo(() => {
    const total = teachers.length;
    const active = teachers.filter(t => t.is_active).length;
    const classTeachers = teachers.filter(t => t.is_class_teacher_of).length;
    const unassigned = teachers.filter(t => (t.assignments_count || 0) === 0).length;
    
    const coveredClasses = new Set<string>();
    assignments.forEach(a => coveredClasses.add(`${a.class_name}-${a.section_name}`));

    return { total, active, classTeachers, unassigned, coveredClassesCount: coveredClasses.size };
  }, [teachers, assignments]);

  // Departments list for dropdown
  const departmentOptions = useMemo(() => {
    return Array.from(new Set(teachers.map(t => t.department).filter(Boolean)));
  }, [teachers]);

  // Academic Matrix group
  const assignmentMatrix = useMemo(() => {
    const matrix: Record<string, { class_name: string; section_name: string; class_teacher?: string; subjects: Array<{ subject_name: string; teacher_name: string }> }> = {};

    assignments.forEach(a => {
      const key = `${a.class_name}-${a.section_name}`;
      if (!matrix[key]) {
        matrix[key] = {
          class_name: a.class_name,
          section_name: a.section_name,
          subjects: []
        };
      }

      if (a.assignment_type === 'class_teacher' || a.assignment_type === 'both') {
        matrix[key].class_teacher = a.teacher_name;
      }

      if (a.subject_name && a.subject_name !== 'Class Teacher') {
        matrix[key].subjects.push({
          subject_name: a.subject_name,
          teacher_name: a.teacher_name || 'Faculty'
        });
      }
    });

    return Object.values(matrix).sort((a, b) => {
      const ca = parseInt(a.class_name.replace(/\D/g, '')) || 0;
      const cb = parseInt(b.class_name.replace(/\D/g, '')) || 0;
      if (ca !== cb) return ca - cb;
      return a.section_name.localeCompare(b.section_name);
    });
  }, [assignments]);

  const handleOpen360 = (t: Teacher) => {
    setSelectedTeacher(t);
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (t: Teacher) => {
    setSelectedTeacher(t);
    setIsFormOpen(true);
  };

  const handleOpenAssign = (t: Teacher) => {
    setSelectedTeacher(t);
    setAssignPrefill(null);
    setIsAssignOpen(true);
  };

  /** Opened from the hub rather than from one teacher's row. */
  const handleOpenBlankAssign = () => {
    setSelectedTeacher(null);
    setAssignPrefill(null);
    setIsAssignOpen(true);
  };

  const handleOpenStatus = (t: Teacher) => {
    setSelectedTeacher(t);
    setIsStatusOpen(true);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16">
      {/* 1. Header Banner */}
      <AdminHeader
        title="Faculty & Academic Management"
        subtitle="Canonical Source of Truth for Teacher Identity, Employment Lifecycle & Academic Responsibilities."
        badge={{
          icon: Briefcase,
          text: 'Faculty Directorate',
          variant: 'violet'
        }}
        sessionBadge="Session: 2026-27"
        actions={
          <>
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw size={14} className={cn(isLoading && "animate-spin text-blue-600")} />
            </button>

            {can('teacher.update') && (
              <button
                onClick={() => {
                  setSelectedTeacher(null);
                  setIsBulkAssignOpen(true);
                }}
                className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Layers size={14} className="text-violet-600" /> Bulk Allocate
              </button>
            )}

            {can('teacher.create') && (
              <button
                onClick={() => {
                  setSelectedTeacher(null);
                  setIsFormOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <UserPlus size={14} /> Register Faculty
              </button>
            )}
          </>
        }
      />

      {/* 2. KPI Metrics Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <AdminStatCard
          label="Total Faculty"
          value={metrics.total}
          subtext="Registered staff records"
          icon={Users}
          variant="violet"
        />
        <AdminStatCard
          label="Active Teachers"
          value={metrics.active}
          subtext="Teaching in school"
          icon={CheckCircle2}
          variant="emerald"
        />
        <AdminStatCard
          label="Class Teachers"
          value={metrics.classTeachers}
          subtext="Appointed class mentors"
          icon={GraduationCap}
          variant="primary"
        />
        <AdminStatCard
          label="Classes Covered"
          value={metrics.coveredClassesCount}
          subtext="Sections with faculty"
          icon={BookOpen}
          variant="sky"
        />
        <AdminStatCard
          label="Unassigned"
          value={metrics.unassigned}
          subtext="Awaiting class allocation"
          icon={AlertTriangle}
          variant="amber"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* 3. Navigation Modes Tab Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 shadow-2xs flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {[
            { id: 'directory', label: 'Faculty Directory', icon: Users, count: filteredTeachers.length },
            { id: 'assignments', label: 'Academic Assignments Hub', icon: GraduationCap, count: assignments.length },
            { id: 'workload', label: 'Workload & Allocation Matrix', icon: Layers }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ViewMode)}
                className={cn(
                  "py-2 px-3.5 rounded-xl flex items-center gap-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                  isActive 
                    ? "bg-slate-900 text-white shadow-xs" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon size={14} className={isActive ? "text-violet-400" : "text-slate-400"} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-black",
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. TAB 1: FACULTY DIRECTORY */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {selectedTeacherFilter && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-center justify-between text-xs text-violet-800 animate-fadeIn">
              <span className="font-semibold">
                Filtered to selected teacher from search.
              </span>
              <button 
                onClick={() => setSelectedTeacherFilter(null)} 
                className="font-bold underline text-violet-700 hover:text-violet-900 cursor-pointer"
              >
                Show All Teachers
              </button>
            </div>
          )}

          {/* Search & Filters */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[240px] relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search faculty by name, employee ID, department, class, or subject..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-violet-500 transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-700 outline-none cursor-pointer focus:border-violet-500"
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Inactive">Inactive</option>
                <option value="Draft">Draft</option>
                <option value="Archived">Archived</option>
              </select>

              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-700 outline-none cursor-pointer focus:border-violet-500"
              >
                <option value="all">All Departments</option>
                {departmentOptions.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-700 outline-none cursor-pointer focus:border-violet-500"
              >
                <option value="all">All CBSE Levels</option>
                <option value="PRT">PRT (Primary)</option>
                <option value="TGT">TGT (Middle/Secondary)</option>
                <option value="PGT">PGT (Senior Secondary)</option>
              </select>
            </div>
          </div>

          {/* Directory Data Table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px] font-black tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Faculty Member</th>
                  <th className="px-4 py-3.5">Employee ID & Contacts</th>
                  <th className="px-4 py-3.5">Department & Level</th>
                  <th className="px-4 py-3.5">Assigned Classes</th>
                  <th className="px-4 py-3.5">Subjects Taught</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      No faculty records match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((t) => {
                    const initials = t.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
                    const isSelected = selectedTeacherFilter === t.id || selectedTeacherFilter === t.employee_id;
                    return (
                      <tr key={t.id} className={cn("hover:bg-slate-50/80 transition-all group", isSelected && "bg-violet-50/60 ring-1 ring-violet-200")}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {t.photo_url ? (
                              <img src={t.photo_url} alt={t.name} className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 border border-violet-200 flex items-center justify-center font-black text-xs shrink-0">
                                {initials}
                              </div>
                            )}
                            <div>
                              <span 
                                onClick={() => handleOpen360(t)}
                                className="font-extrabold text-slate-900 hover:text-violet-600 cursor-pointer block text-xs"
                              >
                                {t.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold block">
                                {t.highest_qualification || t.qualification || 'Educator'}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                          <span className="font-bold text-slate-800 block">{t.employee_id}</span>
                          <span className="text-[10px] text-slate-400 block font-sans">{t.phone || t.email || 'N/A'}</span>
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-800 block text-xs">{t.department}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-slate-500 font-medium">{t.designation}</span>
                            {t.cbse_teaching_level && (
                              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[9px] font-mono font-bold">
                                {t.cbse_teaching_level}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {t.classes_covered && t.classes_covered.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {t.classes_covered.map(c => (
                                <span key={c} className="px-2 py-0.5 bg-violet-50 border border-violet-100 text-violet-700 rounded-md text-[10px] font-bold">
                                  {c}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                              <AlertTriangle size={11} /> Unassigned
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {t.subjects_taught && t.subjects_taught.length > 0 ? (
                            <span className="font-semibold text-slate-700 text-xs">
                              {t.subjects_taught.join(', ')}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                            t.status === 'Active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            t.status === 'On Leave' ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-slate-100 text-slate-600 border-slate-200"
                          )}>
                            {t.status}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpen360(t)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-all cursor-pointer"
                              title="View Teacher 360 Workspace"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => handleOpenAssign(t)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                              title="Assign Class / Subject"
                            >
                              <Plus size={14} />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(t)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                              title="Edit Details"
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. TAB 2: ACADEMIC ASSIGNMENTS HUB */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                Class & Section Academic Allocation Matrix
              </h3>
              <p className="text-[11px] text-slate-400">
                Live canonical assignments feeding Attendance, CBSE Examination, and Timetable
              </p>
            </div>

            <button
              onClick={handleOpenBlankAssign}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} /> New Assignment
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignmentMatrix.map(item => (
              <div key={`${item.class_name}-${item.section_name}`} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-base font-display font-black text-slate-900">
                      Class {item.class_name}-{item.section_name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Academic Session 2026-27</span>
                  </div>

                  {/* Class Teacher Badge */}
                  <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-0.5">
                      Designated Class Teacher
                    </span>
                    {item.class_teacher ? (
                      <span className="text-xs font-extrabold text-emerald-700 flex items-center gap-1">
                        <GraduationCap size={13} /> {item.class_teacher}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                        <AlertTriangle size={12} /> Class Teacher Unassigned
                      </span>
                    )}
                  </div>

                  {/* Subject Teachers List */}
                  <div className="mt-3 space-y-1.5">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                      Subject Evaluators & Teachers ({item.subjects.length})
                    </span>
                    {item.subjects.length === 0 ? (
                      <span className="text-xs text-slate-400 block italic">No subject faculty mapped</span>
                    ) : (
                      item.subjects.map(s => (
                        <div key={s.subject_name} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                          <span className="font-semibold text-slate-700">{s.subject_name}:</span>
                          <span className="font-bold text-slate-900">{s.teacher_name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">Canonical ERP Alignment</span>
                  <button
                    onClick={handleOpenBlankAssign}
                    className="text-xs font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1 cursor-pointer"
                  >
                    Modify <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. TAB 3: WORKLOAD MATRIX */}
      {activeTab === 'workload' && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
              Faculty Workload & Allocation Distribution
            </h3>
            <p className="text-[11px] text-slate-400">
              Aggregated teaching load computed directly from live academic assignments and timetable periods
            </p>
          </div>

          <div className="overflow-hidden border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px] font-black tracking-wider">
                <tr>
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Classes Taught</th>
                  <th className="px-4 py-3">Subjects</th>
                  <th className="px-4 py-3">Class Teacher Role</th>
                  <th className="px-4 py-3 text-right">Workload Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teachers.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-extrabold text-slate-900">
                      {t.name} ({t.employee_id})
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium">
                      {t.department}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800">
                      {t.classes_covered?.join(', ') || 'None'}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-semibold">
                      {t.subjects_taught?.join(', ') || 'None'}
                    </td>
                    <td className="px-4 py-3">
                      {t.is_class_teacher_of ? (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-black uppercase">
                          Class {t.is_class_teacher_of}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase",
                        (t.assignments_count || 0) > 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      )}>
                        {(t.assignments_count || 0) > 0 ? 'Allocated' : 'Pending Allocation'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALS AND DRAWERS */}
      <TeacherFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        teacher={selectedTeacher}
        onSaved={loadData}
      />

      <TeacherAssignmentModal
        isOpen={isAssignOpen}
        onClose={() => { setIsAssignOpen(false); setAssignPrefill(null); }}
        selectedTeacher={selectedTeacher}
        teachers={teachers}
        prefill={assignPrefill}
        onAssigned={loadData}
      />

      <BulkAssignmentModal
        isOpen={isBulkAssignOpen}
        onClose={() => setIsBulkAssignOpen(false)}
        teachers={teachers}
        onAssigned={loadData}
      />

      <TeacherStatusModal
        isOpen={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
        teacher={selectedTeacher}
        onUpdated={loadData}
      />

      <Teacher360Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        teacher={selectedTeacher}
        onEditTeacher={(t) => {
          setIsDrawerOpen(false);
          handleOpenEdit(t);
        }}
        onChangeStatus={(t) => {
          setIsDrawerOpen(false);
          handleOpenStatus(t);
        }}
        onOpenAssignModal={(t) => {
          setIsDrawerOpen(false);
          handleOpenAssign(t);
        }}
        onRefresh={loadData}
      />
    </div>
  );
}
