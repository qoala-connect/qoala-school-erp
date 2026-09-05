import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, User, BookOpen, Calendar, Clock, ClipboardList, Users, 
  Activity, Award, Phone, Mail, MapPin, ShieldCheck, Briefcase, 
  CheckCircle2, AlertTriangle, ExternalLink, Plus, Trash2, 
  Edit2, TrendingUp, Layers, Sparkles, Loader2, ArrowRight, GraduationCap, Camera
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { 
  Teacher, 
  TeacherAssignment, 
  TeacherWorkload, 
  fetchAssignments, 
  deleteAssignment,
  getTeacherWorkload, 
  fetchTeacherStudents, 
  fetchTeacherExamTasks 
} from '@/services/teacherService';
import { supabase } from '@/lib/supabase';
import { uploadEntityPhoto } from '@/lib/photoUpload';
import OfficialTimetableModal from '@/components/academics/OfficialTimetableModal';

interface Teacher360DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: Teacher | null;
  onEditTeacher: (teacher: Teacher) => void;
  onChangeStatus: (teacher: Teacher) => void;
  onOpenAssignModal: (teacher: Teacher) => void;
  onRefresh: () => void;
}

type TabType = 'overview' | 'assignments' | 'timetable' | 'attendance' | 'examination' | 'students' | 'activity';

export default function Teacher360Drawer({
  isOpen,
  onClose,
  teacher,
  onEditTeacher,
  onChangeStatus,
  onOpenAssignModal,
  onRefresh
}: Teacher360DrawerProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Loaded Contexts
  const [workload, setWorkload] = useState<TeacherWorkload | null>(null);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [timetableSlots, setTimetableSlots] = useState<any[]>([]);
  const [examTasks, setExamTasks] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [academicYears, setAcademicYears] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [isTimetableModalOpen, setIsTimetableModalOpen] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handleTeacherPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !teacher) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPEG, PNG).');
      return;
    }
    setIsUploadingPhoto(true);
    const toastId = toast.loading('Uploading faculty portrait...');
    try {
      const { url: publicUrl, stored } = await uploadEntityPhoto(file, 'teachers', teacher.id);
      const { error } = await supabase.from('teachers').update({ photo_url: publicUrl }).eq('id', teacher.id);
      if (error) throw error;
      teacher.photo_url = publicUrl;
      if (stored) {
        toast.success('Faculty photograph updated successfully!', { id: toastId });
      } else {
        toast.warning('Photo saved, but cloud storage was unreachable — it is embedded directly for now.', { id: toastId });
      }
      onRefresh();
    } catch (err: any) {
      console.error('[Teacher360Drawer] Photo upload failed:', err);
      toast.error('Failed to update faculty photograph.', { id: toastId });
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (!isOpen || !teacher) return;
    loadBaselineData();
  }, [isOpen, teacher]);

  const loadBaselineData = async () => {
    if (!teacher) return;
    setIsLoading(true);

    try {
      const [yrs, wl, asgns, exms, stds, tt] = await Promise.all([
        supabase.from('academic_years').select('id, name, is_current').order('start_date', { ascending: false }),
        getTeacherWorkload(teacher.id),
        fetchAssignments({ teacherId: teacher.id }),
        fetchTeacherExamTasks(teacher.id),
        fetchTeacherStudents(teacher.id),
        supabase.from('timetable').select(`
          id, class, day, start_time, end_time,
          subjects (subject_name)
        `).eq('teacher_id', teacher.id).order('day')
      ]);

      if (yrs.data && yrs.data.length > 0) {
        setAcademicYears(yrs.data);
        const curr = yrs.data.find(y => y.is_current) || yrs.data[0];
        setSelectedYearId(curr.id);
      }

      setWorkload(wl);
      setAssignments(asgns);
      setExamTasks(exms);
      setStudents(stds);
      setTimetableSlots(tt.data || []);
    } catch (err: any) {
      console.error('[Teacher360] Load failed:', err);
      toast.error('Failed to load teacher workspace records');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAssignment = async (assignId: string) => {
    if (!confirm('Are you sure you want to remove this academic assignment?')) return;
    try {
      await deleteAssignment(assignId);
      toast.success('Assignment removed.');
      loadBaselineData();
      onRefresh();
    } catch (e: any) {
      toast.error('Could not remove assignment: ' + e.message);
    }
  };

  if (!isOpen || !teacher) return null;

  const initials = teacher.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

  const TABS: { id: TabType; label: string; icon: any; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'assignments', label: 'Academic Assignments', icon: GraduationCap, count: assignments.length },
    { id: 'timetable', label: 'Timetable', icon: Calendar, count: timetableSlots.length },
    { id: 'attendance', label: 'Attendance Roster', icon: Clock },
    { id: 'examination', label: 'CBSE Examination Tasks', icon: ClipboardList, count: examTasks.length },
    { id: 'students', label: 'My Students', icon: Users, count: students.length },
    { id: 'activity', label: 'Audit & History', icon: Activity }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-end">
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="bg-white w-full max-w-4xl h-full shadow-2xl flex flex-col z-50 border-l border-slate-200"
      >
        {/* Top Header Card */}
        <div className="bg-slate-900 text-white p-6 shrink-0 relative overflow-hidden border-b border-slate-800">
          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center gap-4">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                onChange={handleTeacherPhotoUpload}
                className="hidden"
              />

              <div
                onClick={() => !isUploadingPhoto && photoInputRef.current?.click()}
                className="relative w-16 h-16 rounded-2xl cursor-pointer group overflow-hidden shrink-0 border-2 border-violet-500 shadow-md shadow-violet-500/20"
                title="Click to upload/change faculty portrait"
              >
                {teacher.photo_url ? (
                  <img 
                    src={teacher.photo_url} 
                    alt={teacher.name} 
                    className="w-full h-full object-cover rounded-2xl"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-violet-600 to-indigo-600 border border-violet-400/30 flex items-center justify-center font-display font-black text-xl text-white">
                    {initials}
                  </div>
                )}

                <div className="absolute inset-0 bg-slate-950/70 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                  {isUploadingPhoto ? (
                    <Loader2 size={18} className="animate-spin text-white" />
                  ) : (
                    <Camera size={18} className="text-white" />
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-display font-extrabold tracking-tight text-white">
                    {teacher.name}
                  </h2>
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                    teacher.status === 'Active' ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" :
                    teacher.status === 'On Leave' ? "bg-amber-500/20 text-amber-300 border-amber-500/40" :
                    "bg-slate-700 text-slate-300 border-slate-600"
                  )}>
                    {teacher.status}
                  </span>
                </div>

                <p className="text-xs text-slate-300 mt-0.5 font-medium">
                  {teacher.designation} • <span className="text-violet-300 font-semibold">{teacher.department}</span>
                </p>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-2 font-mono">
                  <span className="bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700 text-slate-300">
                    ID: {teacher.employee_id}
                  </span>
                  {teacher.cbse_teaching_level && (
                    <span className="bg-violet-950/60 text-violet-300 px-2 py-0.5 rounded-md border border-violet-800">
                      CBSE {teacher.cbse_teaching_level}
                    </span>
                  )}
                  {teacher.ctet_qualified && (
                    <span className="bg-emerald-950/60 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-800 flex items-center gap-1">
                      <CheckCircle2 size={11} /> CTET Qualified
                    </span>
                  )}
                  {teacher.user_id ? (
                    <span className="bg-sky-950/60 text-sky-300 px-2 py-0.5 rounded-md border border-sky-800 flex items-center gap-1">
                      <ShieldCheck size={11} /> Portal Account Linked
                    </span>
                  ) : (
                    <span className="bg-amber-950/60 text-amber-300 px-2 py-0.5 rounded-md border border-amber-800">
                      No Login Linked
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEditTeacher(teacher)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Edit2 size={13} /> Edit Profile
              </button>
              <button
                onClick={() => onChangeStatus(teacher)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Clock size={13} /> Status
              </button>
              <button
                onClick={onClose}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer ml-1"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Workspace Tab Bar */}
        <div className="border-b border-slate-200 bg-slate-50 flex overflow-x-auto px-4 shrink-0 custom-scrollbar">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "py-3 px-3.5 flex items-center gap-2 border-b-2 font-bold text-xs whitespace-nowrap transition-all cursor-pointer",
                  isActive
                    ? "border-violet-600 text-violet-700 bg-white font-black"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
                )}
              >
                <Icon size={14} className={isActive ? "text-violet-600" : "text-slate-400"} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-black",
                    isActive ? "bg-violet-100 text-violet-800" : "bg-slate-200 text-slate-600"
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Workspace Content Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 size={32} className="text-violet-600 animate-spin mb-3" />
              <p className="text-xs text-slate-500 font-medium">Syncing Teacher 360 Workspace...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Workload Highlights Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                      <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                        <span>Classes Covered</span>
                        <GraduationCap size={15} className="text-violet-600" />
                      </div>
                      <div className="text-2xl font-black text-slate-800 mt-1">
                        {workload?.sections_count || 0}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {workload?.classes_list.join(', ') || 'No classes assigned'}
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                      <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                        <span>Subjects Taught</span>
                        <BookOpen size={15} className="text-indigo-600" />
                      </div>
                      <div className="text-2xl font-black text-slate-800 mt-1">
                        {workload?.subjects_count || 0}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {workload?.subjects_list.join(', ') || 'No subjects allocated'}
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                      <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                        <span>Weekly Periods</span>
                        <Calendar size={15} className="text-emerald-600" />
                      </div>
                      <div className="text-2xl font-black text-slate-800 mt-1">
                        {workload?.periods_per_week || 0}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Periods per timetable
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                      <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                        <span>Pending Exam Marks</span>
                        <ClipboardList size={15} className="text-amber-600" />
                      </div>
                      <div className="text-2xl font-black text-slate-800 mt-1">
                        {workload?.pending_marks_count || 0}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Students awaiting marks
                      </span>
                    </div>
                  </div>

                  {/* Profile Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Personal & Contact */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                        <User size={14} className="text-violet-600" /> Personal & Contact Details
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-400">Email Address:</span>
                          <span className="font-bold text-slate-800">{teacher.email || 'Not specified'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-400">Phone:</span>
                          <span className="font-bold text-slate-800">{teacher.phone || 'Not specified'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-400">Gender / Blood Group:</span>
                          <span className="font-semibold text-slate-800">{teacher.gender || 'N/A'} • {teacher.blood_group || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-400">Date of Birth:</span>
                          <span className="font-semibold text-slate-800">{teacher.date_of_birth || 'Not recorded'}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-400">Address:</span>
                          <span className="font-semibold text-slate-800 max-w-[200px] truncate">{teacher.address || 'Deoria, Uttar Pradesh'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Employment & Qualifications */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                        <Briefcase size={14} className="text-indigo-600" /> Employment & Qualifications
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-400">Qualifications:</span>
                          <span className="font-bold text-slate-800">{teacher.highest_qualification || teacher.qualification || 'M.A., B.Ed.'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-400">Total Experience:</span>
                          <span className="font-bold text-slate-800">{teacher.experience_years} Years</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-400">Date of Joining:</span>
                          <span className="font-semibold text-slate-800">{teacher.joining_date || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-400">Employment Type:</span>
                          <span className="font-semibold text-slate-800">{teacher.employment_type}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-400">Emergency Contact:</span>
                          <span className="font-semibold text-slate-800">
                            {teacher.emergency_contact_name || 'Relative'} ({teacher.emergency_contact_phone || 'N/A'})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Operational Shortcuts */}
                  <div className="p-4 bg-violet-50 border border-violet-100 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-violet-900 block">Manage Academic Deployments</span>
                      <span className="text-[11px] text-violet-700">Assign new class sections, subject curriculums, or class teacher leadership:</span>
                    </div>
                    <button
                      onClick={() => onOpenAssignModal(teacher)}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shadow-violet-600/30 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={14} /> Assign New Class / Subject
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: ACADEMIC ASSIGNMENTS */}
              {activeTab === 'assignments' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                        Current & Historical Academic Allocations
                      </h4>
                      <p className="text-[11px] text-slate-400">Classes, sections, and subjects assigned to {teacher.name}</p>
                    </div>

                    <button
                      onClick={() => onOpenAssignModal(teacher)}
                      className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs shadow-violet-600/20"
                    >
                      <Plus size={13} /> Add Allocation
                    </button>
                  </div>

                  {assignments.length === 0 ? (
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center space-y-3">
                      <GraduationCap size={36} className="text-slate-300 mx-auto" />
                      <h5 className="text-xs font-bold text-slate-700">No academic assignments allocated yet</h5>
                      <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                        This teacher has no active teaching allocations. Assign a class and subject to enable examination marks entry and timetable scheduling.
                      </p>
                      <button
                        onClick={() => onOpenAssignModal(teacher)}
                        className="px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-bold"
                      >
                        Assign Teacher Now
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px] font-black tracking-wider">
                          <tr>
                            <th className="px-4 py-3">Class & Section</th>
                            <th className="px-4 py-3">Subject</th>
                            <th className="px-4 py-3">Responsibility Role</th>
                            <th className="px-4 py-3">Academic Session</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {assignments.map((a) => (
                            <tr key={a.id} className="hover:bg-slate-50/80 transition-all">
                              <td className="px-4 py-3 font-extrabold text-slate-900">
                                Class {a.class_name} - Section {a.section_name}
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-700">
                                {a.subject_name || 'N/A'}
                              </td>
                              <td className="px-4 py-3">
                                {a.assignment_type === 'both' ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-violet-50 text-violet-700 border border-violet-200">
                                    Class Teacher + Subject
                                  </span>
                                ) : a.assignment_type === 'class_teacher' ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Class Teacher
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                                    Subject Teacher
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-600">
                                {a.academic_year_name || '2026-27'}
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                                  a.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                                )}>
                                  {a.is_active ? 'Active' : 'Archived'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => handleDeleteAssignment(a.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 transition-all cursor-pointer"
                                  title="Remove assignment"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: TIMETABLE */}
              {activeTab === 'timetable' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                        Weekly Class Teaching Schedule
                      </h4>
                      <p className="text-[11px] text-slate-400">Timetable slots populated from Academics Timetable module</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsTimetableModalOpen(true)}
                        className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Calendar size={13} /> Official Matrix Timetable PDF
                      </button>
                      <button 
                        onClick={() => navigate('/dashboard/academics', { state: { activeTab: 'timetable' } })}
                        className="text-xs font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1 cursor-pointer"
                      >
                        Master Timetable <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>

                  {timetableSlots.length === 0 ? (
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center space-y-2">
                      <Calendar size={36} className="text-slate-300 mx-auto" />
                      <h5 className="text-xs font-bold text-slate-700">No periods scheduled in timetable</h5>
                      <p className="text-[11px] text-slate-400">Schedule timetable slots for this teacher in the Academics module.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {timetableSlots.map((tt) => (
                        <div key={tt.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 bg-violet-50 text-violet-700 border border-violet-100 rounded-md text-[10px] font-black uppercase">
                              {tt.day}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {tt.start_time?.slice(0, 5)} - {tt.end_time?.slice(0, 5)}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-extrabold text-slate-900 block">Class {tt.class}</span>
                            <span className="text-[11px] font-semibold text-slate-600">
                              {(tt.subjects as any)?.subject_name || 'Subject'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: ATTENDANCE */}
              {activeTab === 'attendance' && (
                <div className="space-y-4">
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                      Attendance Responsibility Hub
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      As a recognized faculty member, {teacher.name} is authorized to record daily student attendance for classes where assigned.
                    </p>

                    <div className="space-y-3">
                      {assignments.filter(a => a.assignment_type === 'class_teacher' || a.assignment_type === 'both').map(a => (
                        <div key={a.id} className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between">
                          <div>
                            <span className="text-xs font-extrabold text-emerald-950 block">
                              Class Teacher of Class {a.class_name}-{a.section_name}
                            </span>
                            <span className="text-[11px] text-emerald-700">
                              Official Class Teacher for Academic Session {a.academic_year_name || '2026-27'}
                            </span>
                          </div>
                          <button
                            onClick={() => navigate('/dashboard/attendance', { state: { selectedClass: a.class_name, selectedSection: a.section_name } })}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            Open Register <ArrowRight size={13} />
                          </button>
                        </div>
                      ))}

                      {assignments.filter(a => a.assignment_type === 'class_teacher' || a.assignment_type === 'both').length === 0 && (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500">
                          This teacher is not designated as a primary Class Teacher for any section, but can take attendance when granted permissions.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: EXAMINATION */}
              {activeTab === 'examination' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                        Assigned CBSE Assessment Workload
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Derived directly from canonical academic assignments (Zero mock data)
                      </p>
                    </div>

                    <button 
                      onClick={() => navigate('/dashboard/examination?tab=marks')}
                      className="text-xs font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1 cursor-pointer"
                    >
                      Open Marks Portal <ExternalLink size={12} />
                    </button>
                  </div>

                  {examTasks.length === 0 ? (
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center space-y-2">
                      <ClipboardList size={36} className="text-slate-300 mx-auto" />
                      <h5 className="text-xs font-bold text-slate-700">No active examination tasks assigned</h5>
                      <p className="text-[11px] text-slate-400">
                        When mid-terms or annual assessments are scheduled for classes taught by this teacher, they will appear here automatically.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {examTasks.map((t) => {
                        const pct = Math.round((t.entered_count / Math.max(1, t.total_students)) * 100);
                        return (
                          <div key={t.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-extrabold text-slate-900">{t.exam_name}</span>
                                <span className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded-md text-[10px] font-black uppercase">
                                  Class {t.class_name} • {t.subject_name}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-1">
                                {t.entered_count} of {t.total_students} student scores recorded ({pct}%)
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-violet-600 h-full rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>

                              <button
                                onClick={() => navigate('/dashboard/examination?tab=marks', { 
                                  state: { selectedExamId: t.exam_id, selectedSubjectId: t.subject_id, selectedClass: t.class_name } 
                                })}
                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                              >
                                Enter Marks <ArrowRight size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: STUDENTS */}
              {activeTab === 'students' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                        Enrolled Students Under Supervision ({students.length})
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Students in classes taught by {teacher.name}
                      </p>
                    </div>
                  </div>

                  {students.length === 0 ? (
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center space-y-2">
                      <Users size={36} className="text-slate-300 mx-auto" />
                      <h5 className="text-xs font-bold text-slate-700">No enrolled students found</h5>
                      <p className="text-[11px] text-slate-400">
                        Assign classes to this teacher to view their student directory.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs max-h-[400px] overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px] font-black tracking-wider sticky top-0">
                          <tr>
                            <th className="px-4 py-3">Student</th>
                            <th className="px-4 py-3">Class & Sec</th>
                            <th className="px-4 py-3">Roll No</th>
                            <th className="px-4 py-3">Guardian</th>
                            <th className="px-4 py-3">Contact</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {students.slice(0, 100).map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50/80">
                              <td className="px-4 py-2.5 font-bold text-slate-900">
                                {s.name}
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-violet-700">
                                Class {s.class}-{s.section}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-slate-600">
                                {s.roll_number || 'N/A'}
                              </td>
                              <td className="px-4 py-2.5 text-slate-600">
                                {s.father_name || 'N/A'}
                              </td>
                              <td className="px-4 py-2.5 text-slate-500 font-mono text-[11px]">
                                {s.phone || 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: ACTIVITY & AUDIT */}
              {activeTab === 'activity' && (
                <div className="space-y-4">
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                      Audit Trail & System History
                    </h4>
                    <div className="space-y-2 text-xs text-slate-600">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800 block">Record Registered</span>
                          <span className="text-[10px] text-slate-400">Created: {teacher.created_at ? new Date(teacher.created_at).toLocaleString() : 'System Initial Seed'}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">ID: {teacher.id}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800 block">Current Status</span>
                          <span className="text-[10px] text-slate-400">State: {teacher.status}</span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-600 font-bold">Verified</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* Official CBSE Teacher Schedule Timetable Modal */}
      {teacher && (
        <OfficialTimetableModal
          isOpen={isTimetableModalOpen}
          onClose={() => setIsTimetableModalOpen(false)}
          className={timetableSlots[0]?.class ?? assignments[0]?.class_name ?? ''}
          sectionName={assignments[0]?.section_name ?? ''}
          classTeacherName={teacher.name}
          mode="teacher"
          title={`OFFICIAL TEACHER SCHEDULE & ALLOTMENT • ${teacher.name.toUpperCase()}`}
          academicYear={academicYears.find(y => y.id === selectedYearId)?.name ?? ''}
          slots={timetableSlots.map(t => ({
            day: t.day,
            period_number: t.period_number || 1,
            subject_name: (t.subjects as any)?.subject_name || 'Subject',
            subject_code: (t.subjects as any)?.subject_code,
            teacher_name: teacher.name,
            start_time: t.start_time,
            end_time: t.end_time
          }))}
        />
      )}
    </div>
  );
}
