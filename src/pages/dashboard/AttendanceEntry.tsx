import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Search, 
  Save, 
  RefreshCcw, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Coffee, 
  FileText, 
  Download, 
  Users, 
  BarChart3, 
  GraduationCap, 
  ChevronRight, 
  ExternalLink, 
  Send, 
  X, 
  ShieldAlert, 
  CalendarCheck,
  CalendarX,
  History,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import AdminHeader from '@/components/common/AdminHeader';
import AdminStatCard from '@/components/common/AdminStatCard';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'leave';

interface AttendanceStatusConfig {
  id: AttendanceStatus;
  label: string;
  shortLabel: string;
  icon: any;
  activeBg: string;
  badgeBg: string;
  textColor: string;
  borderColor: string;
}

const ATTENDANCE_STATUSES: AttendanceStatusConfig[] = [
  { 
    id: 'present',  
    label: 'Present', 
    shortLabel: 'P', 
    icon: CheckCircle2,
    activeBg: 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/20', 
    badgeBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    textColor: 'text-emerald-600',
    borderColor: 'border-emerald-200'
  },
  { 
    id: 'absent',   
    label: 'Absent',  
    shortLabel: 'A', 
    icon: XCircle,
    activeBg: 'bg-rose-600 text-white shadow-xs shadow-rose-600/20', 
    badgeBg: 'bg-rose-50 border-rose-200 text-rose-700',
    textColor: 'text-rose-600',
    borderColor: 'border-rose-200'
  },
  { 
    id: 'late',     
    label: 'Late',    
    shortLabel: 'L', 
    icon: Clock,
    activeBg: 'bg-amber-500 text-white shadow-xs shadow-amber-500/20', 
    badgeBg: 'bg-amber-50 border-amber-200 text-amber-700',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-200'
  },
  { 
    id: 'half_day', 
    label: 'Half Day',
    shortLabel: 'HD',
    icon: Clock,
    activeBg: 'bg-sky-600 text-white shadow-xs shadow-sky-600/20',    
    badgeBg: 'bg-sky-50 border-sky-200 text-sky-700',
    textColor: 'text-sky-600',
    borderColor: 'border-sky-200'
  },
  { 
    id: 'leave',    
    label: 'Leave',   
    shortLabel: 'LV', 
    icon: Coffee,
    activeBg: 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/20', 
    badgeBg: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    textColor: 'text-indigo-600',
    borderColor: 'border-indigo-200'
  },
];

interface Student {
  id: string;
  name: string;
  roll_number: string;
  class: string;
  section: string;
  admission_number: string;
  photo_url?: string;
  father_name?: string;
  phone?: string;
}

interface HolidayInfo {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  description?: string;
  is_national?: boolean;
}

interface StudentLeaveInfo {
  student_id: string;
  reason: string;
  start_date: string;
  end_date: string;
}

interface AttendanceHistoryRecord {
  id: string;
  student_id: string;
  student_name: string;
  roll_number: string;
  admission_number: string;
  class: string;
  section: string;
  attendance_date: string;
  status: AttendanceStatus;
  remarks: string | null;
  marked_by: string | null;
  updated_at: string;
}

type TabType = 'register' | 'history' | 'reports' | 'calendar';

export default function AttendanceEntry() {
  const location = useLocation();
  const navigate = useNavigate();

  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>(
    (location.state?.activeTab as TabType) || 'register'
  );

  // Filter States
  const [students, setStudents] = useState<Student[]>([]);
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [sectionOptions, setSectionOptions] = useState<string[]>([]);
  const { user, role } = useAuth();

  // Defense-in-depth: Redirect students/parents to their personal attendance ledger
  useEffect(() => {
    if (role === 'student' || role === 'parent') {
      navigate('/dashboard/portal?tab=attendance', { replace: true });
    }
  }, [role, navigate]);

  const isTeacher = role === 'teacher' || role === 'class_teacher';
  const [teacherAssignedClasses, setTeacherAssignedClasses] = useState<Array<{ class_name: string; section_name: string }>>([]);
  const [teacherProfile, setTeacherProfile] = useState<any>(null);

  const [selectedClass, setSelectedClass] = useState<string>(location.state?.selectedClass || '');
  const [selectedSection, setSelectedSection] = useState<string>(location.state?.selectedSection || '');
  const [selectedDate, setSelectedDate] = useState<string>(
    location.state?.selectedDate || new Date().toISOString().split('T')[0]
  );

  // Attendance Register Mapping
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [cbseWarnings, setCbseWarnings] = useState<Record<string, number>>({});
  const [activeHoliday, setActiveHoliday] = useState<HolidayInfo | null>(null);
  const [approvedLeaves, setApprovedLeaves] = useState<Record<string, StudentLeaveInfo>>({});
  const [classTeacherName, setClassTeacherName] = useState<string | null>(null);

  // Remarks Modal State
  const [editingRemarksStudent, setEditingRemarksStudent] = useState<Student | null>(null);
  const [currentRemarkText, setCurrentRemarkText] = useState('');

  // Loading & Action States
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // History Tab States
  const [historyRecords, setHistoryRecords] = useState<AttendanceHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDateRange, setHistoryDateRange] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Reports & Analytics Tab States
  const [classSummaries, setClassSummaries] = useState<any[]>([]);
  const [cbseDefaulters, setCbseDefaulters] = useState<any[]>([]);

  // Calendar Tab States
  const [allHolidays, setAllHolidays] = useState<HolidayInfo[]>([]);

  // Load teacher assigned classes
  useEffect(() => {
    async function loadTeacherClasses() {
      if (!isTeacher) return;
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

        if (tProfile) {
          setTeacherProfile(tProfile);
          const { data: slots } = await supabase
            .from('timetable')
            .select('classes (class_name), sections (section_name)')
            .eq('teacher_id', tProfile.id);

          const assigned = new Map<string, { class_name: string; section_name: string }>();
          (slots || []).forEach((s: any) => {
            const cName = s.classes?.class_name;
            const sName = s.sections?.section_name;
            if (cName && sName) {
              assigned.set(`${cName}_${sName}`, { class_name: cName, section_name: sName });
            }
          });

          const assignedList = Array.from(assigned.values());
          setTeacherAssignedClasses(assignedList);

          if (assignedList.length > 0 && !location.state?.selectedClass) {
            setSelectedClass(assignedList[0].class_name);
            setSelectedSection(assignedList[0].section_name);
          }
        }
      } catch (err) {
        console.error('Failed to resolve teacher classes in AttendanceEntry:', err);
      }
    }
    loadTeacherClasses();
  }, [user, isTeacher, location.state]);

  // 1. Fetch Academic Metadata & Class/Section Options
  const fetchMetadata = useCallback(async () => {
    try {
      // Read distinct classes and sections directly from active students
      const { data: stdData, error: stdErr } = await supabase
        .from('students')
        .select('class, section')
        .eq('status', 'active');

      if (stdErr) throw stdErr;

      const classes = Array.from(new Set((stdData || []).map(r => r.class).filter(Boolean)))
        .sort((a, b) => (parseInt(String(a).replace(/\D/g, '')) || 0) - (parseInt(String(b).replace(/\D/g, '')) || 0));
      const sections = Array.from(new Set((stdData || []).map(r => r.section).filter(Boolean))).sort();

      setClassOptions(classes);
      setSectionOptions(sections);

      // Handle pre-selected class from state or default to first
      setSelectedClass(prev => {
        if (prev && classes.includes(prev)) return prev;
        if (location.state?.selectedClass && classes.includes(location.state.selectedClass)) return location.state.selectedClass;
        return classes[0] || '';
      });

      setSelectedSection(prev => {
        if (prev && sections.includes(prev)) return prev;
        if (location.state?.selectedSection && sections.includes(location.state.selectedSection)) return location.state.selectedSection;
        return sections[0] || '';
      });

    } catch (err: any) {
      console.error('[Attendance] Metadata load failed:', err);
    }
  }, [location.state]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  // 2. Fetch Students, Existing Attendance, Approved Leaves, and Holidays for Daily Register
  const fetchRegisterData = useCallback(async () => {
    if (!selectedClass || !selectedSection || !selectedDate) return;
    setIsLoading(true);
    setLoadError(null);

    try {
      // Check for Holiday on selected date
      const { data: holidayData } = await supabase
        .from('holidays')
        .select('id, title, start_date, end_date, description, is_national')
        .lte('start_date', selectedDate)
        .gte('end_date', selectedDate)
        .limit(1);

      if (holidayData && holidayData.length > 0) {
        setActiveHoliday(holidayData[0]);
      } else {
        setActiveHoliday(null);
      }

      // Fetch active students in class and section
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, roll_number, class, section, admission_number, photo_url, father_name, phone')
        .eq('class', selectedClass)
        .eq('section', selectedSection)
        .eq('status', 'active')
        .order('roll_number', { ascending: true })
        .order('name', { ascending: true });

      if (studentsError) throw studentsError;

      const loadedStudents: Student[] = studentsData || [];
      setStudents(loadedStudents);

      // Fetch designated Class Teacher from canonical teacher_assignments
      try {
        const { data: ctData } = await supabase
          .from('teacher_assignments')
          .select(`
            teachers (name),
            classes!inner (class_name),
            sections!inner (section_name)
          `)
          .eq('classes.class_name', selectedClass)
          .eq('sections.section_name', selectedSection)
          .in('assignment_type', ['class_teacher', 'both'])
          .eq('is_active', true)
          .limit(1);

        if (ctData && ctData.length > 0) {
          setClassTeacherName((ctData[0].teachers as any)?.name || null);
        } else {
          setClassTeacherName(null);
        }
      } catch (ctErr) {
        console.warn('Class teacher lookup error:', ctErr);
      }

      const studentIds = loadedStudents.map(s => s.id);

      if (studentIds.length === 0) {
        setAttendance({});
        setRemarks({});
        setIsLoading(false);
        return;
      }

      // Fetch approved leaves for students on this date
      const { data: leavesData } = await supabase
        .from('leave_requests')
        .select('applicant_id, reason, start_date, end_date')
        .eq('applicant_type', 'student')
        .eq('status', 'approved')
        .lte('start_date', selectedDate)
        .gte('end_date', selectedDate)
        .in('applicant_id', studentIds);

      const leaveMap: Record<string, StudentLeaveInfo> = {};
      leavesData?.forEach((l: any) => {
        leaveMap[l.applicant_id] = {
          student_id: l.applicant_id,
          reason: l.reason || 'Approved Leave',
          start_date: l.start_date,
          end_date: l.end_date
        };
      });
      setApprovedLeaves(leaveMap);

      // Fetch Existing Recorded Attendance
      const { data: existingData, error: existErr } = await supabase
        .from('attendance')
        .select('student_id, status, remarks')
        .eq('attendance_date', selectedDate)
        .in('student_id', studentIds);

      if (existErr) throw existErr;

      const attendanceMap: Record<string, AttendanceStatus> = {};
      const remarksMap: Record<string, string> = {};

      existingData?.forEach(record => {
        if (record.status) {
          attendanceMap[record.student_id] = record.status as AttendanceStatus;
        }
        if (record.remarks) {
          remarksMap[record.student_id] = record.remarks;
        }
      });

      // For unrecorded students, default to approved leave if on leave, or default to present
      loadedStudents.forEach(s => {
        if (!attendanceMap[s.id]) {
          if (leaveMap[s.id]) {
            attendanceMap[s.id] = 'leave';
            remarksMap[s.id] = leaveMap[s.id].reason;
          } else {
            attendanceMap[s.id] = 'present';
          }
        }
      });

      setAttendance(attendanceMap);
      setRemarks(remarksMap);

      // Fetch CBSE summary percentages for threshold warnings
      const { data: cbseData } = await supabase
        .from('cbse_attendance_summary')
        .select('student_id, attendance_percentage')
        .in('student_id', studentIds);

      const cbseMap: Record<string, number> = {};
      cbseData?.forEach(record => {
        cbseMap[record.student_id] = Number(record.attendance_percentage);
      });
      setCbseWarnings(cbseMap);

    } catch (err: any) {
      console.error('[Attendance] Fetch failed:', err);
      setLoadError(err.message || 'Could not load student attendance register.');
      toast.error('Failed to load register: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedClass, selectedSection, selectedDate]);

  useEffect(() => {
    if (activeTab === 'register') {
      fetchRegisterData();
    }
  }, [fetchRegisterData, activeTab]);

  // 3. Fetch History Logs
  const fetchHistoryLogs = useCallback(async () => {
    setHistoryLoading(true);
    try {
      let query = supabase
        .from('attendance')
        .select(`
          id, student_id, attendance_date, status, class, section, remarks, marked_by, updated_at,
          students!inner (name, roll_number, admission_number)
        `)
        .order('attendance_date', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(200);

      if (selectedClass) query = query.eq('class', selectedClass);
      if (selectedSection) query = query.eq('section', selectedSection);
      if (historyStatusFilter !== 'all') query = query.eq('status', historyStatusFilter);

      const today = new Date();
      if (historyDateRange === 'today') {
        const todayStr = today.toISOString().split('T')[0];
        query = query.eq('attendance_date', todayStr);
      } else if (historyDateRange === 'week') {
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);
        query = query.gte('attendance_date', lastWeek.toISOString().split('T')[0]);
      } else if (historyDateRange === 'month') {
        const lastMonth = new Date(today);
        lastMonth.setDate(today.getDate() - 30);
        query = query.gte('attendance_date', lastMonth.toISOString().split('T')[0]);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formatted: AttendanceHistoryRecord[] = (data || []).map((row: any) => ({
        id: row.id,
        student_id: row.student_id,
        student_name: row.students?.name || 'Unknown',
        roll_number: row.students?.roll_number || 'N/A',
        admission_number: row.students?.admission_number || 'N/A',
        class: row.class || 'N/A',
        section: row.section || 'N/A',
        attendance_date: row.attendance_date,
        status: row.status as AttendanceStatus,
        remarks: row.remarks,
        marked_by: row.marked_by,
        updated_at: row.updated_at
      }));

      setHistoryRecords(formatted);
    } catch (err: any) {
      console.error('[Attendance] History load failed:', err);
      toast.error('Failed to load attendance history: ' + err.message);
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedClass, selectedSection, historyDateRange, historyStatusFilter]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistoryLogs();
    }
  }, [fetchHistoryLogs, activeTab]);

  // 4. Fetch Reports & CBSE Analytics
  const fetchReportsData = useCallback(async () => {
    try {
      // 1. Fetch Class Summaries
      const { data: classData } = await supabase
        .from('dashboard_attendance_class_view')
        .select('*');

      if (classData) {
        setClassSummaries(classData);
      }

      // 2. Fetch CBSE Defaulters (< 75% attendance)
      const { data: defaultersData } = await supabase
        .from('cbse_attendance_summary')
        .select(`
          student_id, total_working_days, total_present, attendance_percentage,
          students!inner (name, roll_number, class, section, admission_number, phone)
        `)
        .lt('attendance_percentage', 75)
        .order('attendance_percentage', { ascending: true })
        .limit(50);

      if (defaultersData) {
        setCbseDefaulters(defaultersData.map((d: any) => ({
          student_id: d.student_id,
          name: d.students?.name || 'Unknown',
          roll_number: d.students?.roll_number || 'N/A',
          class: d.students?.class || 'N/A',
          section: d.students?.section || 'N/A',
          admission_number: d.students?.admission_number || 'N/A',
          phone: d.students?.phone || 'N/A',
          total_working_days: Number(d.total_working_days) || 0,
          total_present: Number(d.total_present) || 0,
          attendance_percentage: Number(d.attendance_percentage) || 0
        })));
      }

    } catch (err: any) {
      console.error('[Attendance] Reports load failed:', err);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReportsData();
    }
  }, [fetchReportsData, activeTab]);

  // 5. Fetch Calendar / Holidays
  const fetchCalendarHolidays = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('holidays')
        .select('*')
        .order('start_date', { ascending: true });
      if (data) setAllHolidays(data);
    } catch (err) {
      console.error('[Attendance] Calendar holidays load failed:', err);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'calendar') {
      fetchCalendarHolidays();
    }
  }, [fetchCalendarHolidays, activeTab]);

  // Handle Save Attendance Mutation
  const handleSaveAttendance = async () => {
    if (students.length === 0) {
      toast.error('No students available in this register');
      return;
    }

    setIsSaving(true);
    try {
      const records = students.map(s => ({
        student_id: s.id,
        status: attendance[s.id] || 'present',
        remarks: remarks[s.id] || null
      }));

      // Call atomic Postgres RPC save_attendance
      const { data, error } = await supabase.rpc('save_attendance', {
        _attendance_date: selectedDate,
        _class: selectedClass,
        _section: selectedSection,
        _records: records
      });

      if (error) {
        if (error.code === '42501') {
          throw new Error('You do not have permission to record attendance.');
        }
        throw error;
      }

      const savedCount = Array.isArray(data) ? data[0]?.saved : data;
      toast.success(`Attendance successfully recorded for ${selectedClass} - ${selectedSection} (${savedCount || students.length} students)`, {
        description: `Date: ${selectedDate}`
      });

      // Refresh data
      fetchRegisterData();
    } catch (err: any) {
      console.error('[Attendance] Save failed:', err);
      toast.error('Save failed: ' + (err.message || 'Could not save attendance'));
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk Actions
  const handleBulkStatusChange = (status: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = {};
    students.forEach(s => {
      next[s.id] = status;
    });
    setAttendance(next);
    toast.info(`Marked all ${students.length} students as ${status.toUpperCase()}`);
  };

  const handleToggleStatus = (studentId: string, status: AttendanceStatus) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  // Remarks Management
  const openRemarksModal = (student: Student) => {
    setEditingRemarksStudent(student);
    setCurrentRemarkText(remarks[student.id] || '');
  };

  const saveRemark = () => {
    if (editingRemarksStudent) {
      setRemarks(prev => ({
        ...prev,
        [editingRemarksStudent.id]: currentRemarkText
      }));
      setEditingRemarksStudent(null);
      toast.success(`Remark updated for ${editingRemarksStudent.name}`);
    }
  };

  // Filtered Students for Register
  const filteredStudents = useMemo(() => {
    if (!searchQuery) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.roll_number.toLowerCase().includes(q) || 
      s.admission_number.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  // Statistics calculation for current register
  const registerStats = useMemo(() => {
    const total = students.length;
    let present = 0;
    let absent = 0;
    let late = 0;
    let halfDay = 0;
    let leave = 0;

    students.forEach(s => {
      const st = attendance[s.id] || 'present';
      if (st === 'present') present++;
      else if (st === 'absent') absent++;
      else if (st === 'late') late++;
      else if (st === 'half_day') halfDay++;
      else if (st === 'leave') leave++;
    });

    const attendanceRate = total > 0 ? Math.round(((present + halfDay * 0.5) / total) * 100) : 100;

    return { total, present, absent, late, halfDay, leave, attendanceRate };
  }, [students, attendance]);

  // Filtered History Records
  const filteredHistory = useMemo(() => {
    if (!historySearchQuery) return historyRecords;
    const q = historySearchQuery.toLowerCase();
    return historyRecords.filter(r => 
      r.student_name.toLowerCase().includes(q) || 
      r.roll_number.toLowerCase().includes(q) || 
      r.admission_number.toLowerCase().includes(q)
    );
  }, [historyRecords, historySearchQuery]);

  // Export History to CSV
  const exportHistoryToCSV = () => {
    if (filteredHistory.length === 0) {
      toast.error('No records to export');
      return;
    }

    const headers = ['Date', 'Student Name', 'Roll No', 'Admission No', 'Class', 'Section', 'Status', 'Remarks', 'Recorded At'];
    const rows = filteredHistory.map(r => [
      r.attendance_date,
      `"${r.student_name}"`,
      r.roll_number,
      r.admission_number,
      `"${r.class}"`,
      r.section,
      r.status.toUpperCase(),
      `"${r.remarks || ''}"`,
      r.updated_at
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_Log_${selectedClass}_${selectedSection}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Attendance records exported to CSV');
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16 text-slate-700">
      {/* 1. Header Banner & Institution Context */}
      <AdminHeader
        title="Attendance Management System"
        subtitle="Authoritative register for student roll-call, leave synchronization, and CBSE audit compliance."
        badge={{
          icon: CalendarCheck,
          text: 'CBSE Attendance Register',
          variant: 'primary'
        }}
        sessionBadge="Session: 2026-27"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate('/dashboard/students')}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200/80 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Go to Students SIS Directory"
            >
              <Users size={14} className="text-blue-600" />
              Student SIS
            </button>
            <button
              onClick={() => navigate('/dashboard/academics', { state: { activeTab: 'classes' } })}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200/80 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Manage Classes & Sections in Academics"
            >
              <GraduationCap size={14} className="text-indigo-600" />
              Class Rosters
            </button>
            <button
              onClick={() => navigate('/dashboard/communication')}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200/80 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Send Absence Alerts via Communication Hub"
            >
              <Send size={14} className="text-emerald-600" />
              Absence Alerts
            </button>
          </div>
        }
      />

      {/* 2. Top-Level Tab Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 shadow-2xs overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {[
            { id: 'register', label: 'Daily Register', icon: CalendarCheck },
            { id: 'history', label: 'Attendance History & Logs', icon: History },
            { id: 'reports', label: 'CBSE Analytics & Defaulters', icon: BarChart3 },
            { id: 'calendar', label: 'School Calendar & Holidays', icon: Calendar }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <Icon size={14} className={isActive ? "text-violet-400" : "text-slate-400"} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DAILY ATTENDANCE REGISTER */}
      {/* ========================================================================= */}
      {activeTab === 'register' && (
        <div className="space-y-4">
          {/* Teacher Assigned Classes Quick Switch Strip */}
          {isTeacher && teacherAssignedClasses.length > 0 && (
            <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-blue-700" />
                <span className="text-xs font-bold text-blue-950">
                  Your Assigned Classes ({teacherProfile?.name || 'Faculty'}):
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {teacherAssignedClasses.map((ac) => {
                  const isSelected = selectedClass === ac.class_name && selectedSection === ac.section_name;
                  return (
                    <button
                      key={`${ac.class_name}_${ac.section_name}`}
                      onClick={() => {
                        setSelectedClass(ac.class_name);
                        setSelectedSection(ac.section_name);
                      }}
                      className={cn(
                        "px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                        isSelected
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-white text-blue-700 border border-blue-200 hover:bg-blue-100/50"
                      )}
                    >
                      <span>Class {ac.class_name} - Sec {ac.section_name}</span>
                      {isSelected && <CheckCircle2 size={12} className="text-blue-100" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Holiday Alert Banner (if date coincides with school holiday) */}
          {activeHoliday && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 shadow-2xs">
              <CalendarX className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <div className="font-extrabold text-sm text-amber-900 flex items-center gap-2">
                  Official School Holiday: {activeHoliday.title}
                  {activeHoliday.is_national && (
                    <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded text-[9px] font-black uppercase">
                      National
                    </span>
                  )}
                </div>
                <p className="text-amber-700 mt-0.5">
                  {activeHoliday.description || 'This date is declared a non-instructional holiday in the School Calendar.'}
                </p>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="bg-white rounded-[24px] border border-slate-200/70 p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Date Input */}
              <div className="flex flex-col min-w-[150px]">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">
                  Attendance Date
                </span>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input 
                    type="date" 
                    value={selectedDate}
                    max={new Date().toISOString().split('T')[0]} // CBSE constraint: cannot mark future attendance
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 transition-all"
                  />
                </div>
              </div>

              {/* Class Selector */}
              <div className="flex flex-col min-w-[130px]">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">
                  Enrolled Class
                </span>
                <select 
                  value={selectedClass} 
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 cursor-pointer"
                >
                  {classOptions.length === 0 && <option value="">No classes found</option>}
                  {classOptions.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Section Selector */}
              <div className="flex flex-col min-w-[110px]">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">
                  Section
                </span>
                <select 
                  value={selectedSection} 
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 cursor-pointer"
                >
                  {sectionOptions.length === 0 && <option value="">No sections</option>}
                  {sectionOptions.map(sec => (
                    <option key={sec} value={sec}>Section {sec}</option>
                  ))}
                </select>
              </div>

              {/* Designated Class Teacher Display */}
              <div className="flex flex-col min-w-[140px]">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">
                  Class Teacher
                </span>
                <div className={cn(
                  "flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border transition-all h-[38px]",
                  classTeacherName 
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                    : "bg-slate-50 text-slate-400 border-slate-200"
                )}>
                  <GraduationCap size={14} className={classTeacherName ? "text-emerald-600 shrink-0" : "text-slate-400 shrink-0"} />
                  <span className="truncate">{classTeacherName || 'Not Assigned'}</span>
                </div>
              </div>

              {/* Student Search */}
              <div className="flex flex-col min-w-[200px] flex-1 sm:flex-initial">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">
                  Filter Roster
                </span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input 
                    type="text" 
                    placeholder="Search name, roll, admission..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 transition-all placeholder:text-slate-400 font-medium"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Bulk Marking Actions & Save Button */}
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
              <button 
                onClick={() => handleBulkStatusChange('present')}
                className="px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5"
                title="Mark all students as Present"
              >
                <CheckCircle2 size={14} />
                All Present
              </button>

              <button 
                onClick={() => handleBulkStatusChange('absent')}
                className="px-3.5 py-2 bg-rose-50 text-rose-700 border border-rose-200/80 hover:bg-rose-100 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5"
                title="Mark all students as Absent"
              >
                <XCircle size={14} />
                All Absent
              </button>

              <button 
                onClick={handleSaveAttendance}
                disabled={isSaving || students.length === 0}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-violet-600/20 disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Register
              </button>
            </div>
          </div>

          {/* Real-time Register Status Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
            <div className="bg-white border border-slate-200/60 rounded-2xl p-3 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Enrolled</span>
              <span className="text-xl font-black text-slate-800">{registerStats.total}</span>
            </div>
            <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-2xl p-3 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">Present</span>
              <span className="text-xl font-black text-emerald-800">{registerStats.present}</span>
            </div>
            <div className="bg-rose-50/70 border border-rose-200/60 rounded-2xl p-3 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 block">Absent</span>
              <span className="text-xl font-black text-rose-800">{registerStats.absent}</span>
            </div>
            <div className="bg-amber-50/70 border border-amber-200/60 rounded-2xl p-3 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 block">Late</span>
              <span className="text-xl font-black text-amber-800">{registerStats.late}</span>
            </div>
            <div className="bg-indigo-50/70 border border-indigo-200/60 rounded-2xl p-3 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 block">Leave</span>
              <span className="text-xl font-black text-indigo-800">{registerStats.leave}</span>
            </div>
            <div className="bg-violet-50/70 border border-violet-200/60 rounded-2xl p-3 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-violet-700 block">Attendance %</span>
              <span className="text-xl font-black text-violet-800">{registerStats.attendanceRate}%</span>
            </div>
          </div>

          {/* Student Register Table Card */}
          <div className="bg-white border border-slate-200/70 shadow-xs rounded-[24px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <th className="py-3.5 px-5 text-[10px] font-black text-slate-400 uppercase tracking-wider w-[70px] text-center">Roll</th>
                    <th className="py-3.5 px-5 text-[10px] font-black text-slate-400 uppercase tracking-wider">Student Profile</th>
                    <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center w-[130px]">Adm No</th>
                    <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center w-[110px]">CBSE Overall</th>
                    <th className="py-3.5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center w-[340px]">Mark Status</th>
                    <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center w-[110px]">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-slate-500 font-medium text-sm">
                        <RefreshCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-600" />
                        Loading student register from database...
                      </td>
                    </tr>
                  ) : loadError ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-800">Unable to load register</p>
                        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">{loadError}</p>
                        <button 
                          onClick={fetchRegisterData}
                          className="mt-3 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Retry Query
                        </button>
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-slate-400 font-medium text-xs">
                        {searchQuery 
                          ? `No student matches "${searchQuery}".` 
                          : `No active students enrolled in ${selectedClass} Section ${selectedSection}.`}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => {
                      const currentStatus = attendance[s.id] || 'present';
                      const currentRemark = remarks[s.id];
                      const cbsePct = cbseWarnings[s.id];
                      const hasCbseWarning = typeof cbsePct === 'number' && cbsePct < 75;
                      const hasApprovedLeave = !!approvedLeaves[s.id];

                      return (
                        <tr key={s.id} className="hover:bg-slate-50/60 transition-colors group">
                          {/* Roll Number */}
                          <td className="py-3.5 px-5 text-center font-mono font-bold text-xs text-slate-600">
                            #{s.roll_number || '—'}
                          </td>

                          {/* Student Details & SIS Link */}
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-violet-50 text-violet-700 font-bold flex items-center justify-center text-xs border border-violet-100 shrink-0">
                                {s.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <button
                                  onClick={() => navigate('/dashboard/students', { state: { selectedStudentId: s.id } })}
                                  className="font-bold text-slate-900 hover:text-violet-600 transition-colors text-xs text-left truncate flex items-center gap-1 cursor-pointer"
                                  title="View full Student 360 profile"
                                >
                                  {s.name}
                                  <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                                <span className="text-[10px] text-slate-400 block truncate">
                                  {s.father_name ? `Father: ${s.father_name}` : `Class ${s.class}-${s.section}`}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Admission Number */}
                          <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-600">
                            {s.admission_number}
                          </td>

                          {/* CBSE Percentage & Warning Badge */}
                          <td className="py-3.5 px-4 text-center">
                            {typeof cbsePct === 'number' ? (
                              <div className="inline-flex flex-col items-center">
                                <span className={cn(
                                  "text-xs font-black font-mono",
                                  hasCbseWarning ? "text-rose-600" : "text-emerald-700"
                                )}>
                                  {cbsePct.toFixed(0)}%
                                </span>
                                {hasCbseWarning && (
                                  <span className="text-[8px] font-black uppercase text-rose-600 bg-rose-50 border border-rose-200 px-1 rounded mt-0.5">
                                    Defaulter
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400">100%</span>
                            )}
                          </td>

                          {/* Status Marking Buttons */}
                          <td className="py-3.5 px-6">
                            <div className="flex items-center justify-center gap-1">
                              {ATTENDANCE_STATUSES.map((btn) => {
                                const isSelected = currentStatus === btn.id;
                                return (
                                  <button
                                    key={btn.id}
                                    onClick={() => handleToggleStatus(s.id, btn.id)}
                                    className={cn(
                                      "px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer select-none",
                                      isSelected 
                                        ? btn.activeBg 
                                        : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                    )}
                                    title={`Mark as ${btn.label}`}
                                  >
                                    {btn.shortLabel}
                                  </button>
                                );
                              })}
                            </div>
                            {hasApprovedLeave && currentStatus === 'leave' && (
                              <span className="text-[9px] text-indigo-600 font-bold block text-center mt-1">
                                ✓ Approved School Leave
                              </span>
                            )}
                          </td>

                          {/* Remarks Button */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => openRemarksModal(s)}
                              className={cn(
                                "p-1.5 rounded-lg text-xs transition-all cursor-pointer",
                                currentRemark 
                                  ? "bg-violet-50 text-violet-700 border border-violet-200 font-bold" 
                                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              )}
                              title={currentRemark ? `Remark: ${currentRemark}` : 'Add note/reason'}
                            >
                              <FileText size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ATTENDANCE HISTORY & AUDIT LOGS */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* History Filters & Actions */}
          <div className="bg-white rounded-[24px] border border-slate-200/70 p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Date Range Filter */}
              <div className="flex flex-col min-w-[130px]">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">
                  Timeframe
                </span>
                <select 
                  value={historyDateRange} 
                  onChange={(e: any) => setHistoryDateRange(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/20 cursor-pointer"
                >
                  <option value="today">Today Only</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                  <option value="all">All Records</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex flex-col min-w-[120px]">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">
                  Status
                </span>
                <select 
                  value={historyStatusFilter} 
                  onChange={(e) => setHistoryStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/20 cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="present">Present Only</option>
                  <option value="absent">Absent Only</option>
                  <option value="late">Late Only</option>
                  <option value="leave">Leave Only</option>
                </select>
              </div>

              {/* Class Filter */}
              <div className="flex flex-col min-w-[120px]">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">
                  Class
                </span>
                <select 
                  value={selectedClass} 
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/20 cursor-pointer"
                >
                  <option value="">All Classes</option>
                  {classOptions.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Search History */}
              <div className="flex flex-col min-w-[200px]">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">
                  Search Log
                </span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search student or roll..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/20 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Export Actions */}
            <div className="flex items-center gap-2">
              <button 
                onClick={fetchHistoryLogs}
                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition-all cursor-pointer"
                title="Refresh audit log"
              >
                <RefreshCcw size={15} />
              </button>
              <button 
                onClick={exportHistoryToCSV}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
              >
                <Download size={14} className="text-violet-600" />
                Export CSV
              </button>
            </div>
          </div>

          {/* History Records Table */}
          <div className="bg-white border border-slate-200/70 shadow-xs rounded-[24px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <th className="py-3.5 px-5 text-[10px] font-black text-slate-400 uppercase tracking-wider w-[120px]">Date</th>
                    <th className="py-3.5 px-5 text-[10px] font-black text-slate-400 uppercase tracking-wider">Student Details</th>
                    <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center w-[120px]">Class & Sec</th>
                    <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center w-[130px]">Status</th>
                    <th className="py-3.5 px-5 text-[10px] font-black text-slate-400 uppercase tracking-wider">Remarks / Reason</th>
                    <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right w-[150px]">Recorded At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyLoading ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-slate-500 font-medium text-sm">
                        <RefreshCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-600" />
                        Loading attendance history logs...
                      </td>
                    </tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-slate-400 font-medium text-xs">
                        No historical attendance records found for this criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((rec) => {
                      const statusConfig = ATTENDANCE_STATUSES.find(s => s.id === rec.status) || ATTENDANCE_STATUSES[0];
                      const StatusIcon = statusConfig.icon;
                      return (
                        <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-5 font-mono font-bold text-xs text-slate-800">
                            {rec.attendance_date}
                          </td>
                          <td className="py-3.5 px-5">
                            <div className="font-bold text-slate-900 text-xs">{rec.student_name}</div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Roll: #{rec.roll_number} • Adm: {rec.admission_number}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold text-xs text-slate-700">
                            {rec.class} - {rec.section}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border",
                              statusConfig.badgeBg
                            )}>
                              <StatusIcon size={11} />
                              {statusConfig.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-xs text-slate-600">
                            {rec.remarks || '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-[10px] text-slate-400">
                            {rec.updated_at ? new Date(rec.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CBSE ANALYTICS & DEFAULTERS */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-5">
          {/* Top KPI row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                <span>CBSE Minimum Threshold</span>
                <ShieldAlert size={16} className="text-violet-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">75.0%</div>
              <p className="text-[11px] text-slate-500 font-medium">Mandatory requirement for board exam eligibility.</p>
            </div>

            <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                <span>Total Defaulters Identified</span>
                <AlertTriangle size={16} className="text-rose-600" />
              </div>
              <div className="text-2xl font-black text-rose-600">{cbseDefaulters.length} Students</div>
              <p className="text-[11px] text-slate-500 font-medium">Students falling below the 75% attendance threshold.</p>
            </div>

            <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                <span>Institution Overall Rate</span>
                <TrendingUp size={16} className="text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-700">
                {classSummaries.length > 0
                  ? `${Math.round(classSummaries.reduce((sum, c) => sum + (Number(c.ratio) || 0), 0) / classSummaries.length)}%`
                  : '—'}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Average across all classes in 2026-27.</p>
            </div>
          </div>

          {/* Class-wise Attendance Comparison Matrix */}
          <div className="bg-white border border-slate-200/70 rounded-[24px] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-extrabold text-slate-900 text-sm">Class-wise Attendance Ratio Matrix</h3>
                <p className="text-[11px] text-slate-500">Attendance percentages aggregated per academic class.</p>
              </div>
              <button 
                onClick={() => navigate('/dashboard/reports')}
                className="text-xs font-bold text-violet-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Full Institutional Reports <ChevronRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {classSummaries.map((cls) => {
                const ratio = Number(cls.ratio) || 100;
                return (
                  <div key={cls.class} className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-slate-900">{cls.class}</span>
                      <span className={cn(
                        "text-xs font-black font-mono",
                        ratio < 75 ? "text-rose-600" : "text-emerald-700"
                      )}>
                        {ratio}%
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          ratio < 75 ? "bg-rose-500" : "bg-emerald-500"
                        )}
                        style={{ width: `${Math.min(100, ratio)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>Present: {cls.present}</span>
                      <span>Absent: {cls.absent}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CBSE Defaulters Warning List */}
          <div className="bg-white border border-slate-200/70 rounded-[24px] overflow-hidden shadow-xs space-y-0">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-display font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <ShieldAlert size={16} className="text-rose-600" />
                  CBSE Attendance Defaulters List (&lt;75%)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Notice required to be issued to parents as per Board circular guidelines.
                </p>
              </div>
              <button
                onClick={() => navigate('/dashboard/communication')}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Send size={12} />
                Broadcast Parent Notice
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-5">Student Name</th>
                    <th className="py-3 px-4 text-center">Class</th>
                    <th className="py-3 px-4 text-center">Roll No</th>
                    <th className="py-3 px-4 text-center">Working Days</th>
                    <th className="py-3 px-4 text-center">Present Days</th>
                    <th className="py-3 px-4 text-center">Attendance %</th>
                    <th className="py-3 px-5 text-right">Direct Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cbseDefaulters.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400 font-medium">
                        ✓ Excellent! No students currently fall below the 75% CBSE attendance threshold.
                      </td>
                    </tr>
                  ) : (
                    cbseDefaulters.map((def) => (
                      <tr key={def.student_id} className="hover:bg-rose-50/30 transition-colors">
                        <td className="py-3.5 px-5 font-bold text-slate-900">
                          {def.name}
                          <span className="text-[10px] text-slate-400 block font-mono">Adm: {def.admission_number}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-semibold">{def.class} - {def.section}</td>
                        <td className="py-3.5 px-4 text-center font-mono">#{def.roll_number}</td>
                        <td className="py-3.5 px-4 text-center font-mono">{def.total_working_days}</td>
                        <td className="py-3.5 px-4 text-center font-mono text-emerald-700 font-bold">{def.total_present}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-xs font-black font-mono">
                            {def.attendance_percentage}%
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <button
                            onClick={() => navigate('/dashboard/students', { state: { selectedStudentId: def.student_id } })}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-violet-50 text-violet-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            Student 360 <ExternalLink size={10} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SCHOOL CALENDAR & HOLIDAYS */}
      {/* ========================================================================= */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <div className="bg-white rounded-[24px] border border-slate-200/70 p-5 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="font-display font-extrabold text-slate-900 text-sm">Official Institutional Calendar</h3>
              <p className="text-[11px] text-slate-500">
                School holidays & non-instructional days recognized by the Attendance System.
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard/calendar')}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Calendar size={14} />
              Open School Calendar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allHolidays.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200/60 p-6">
                No holidays recorded for this session. Use the School Calendar module to schedule terms & holidays.
              </div>
            ) : (
              allHolidays.map(hol => (
                <div key={hol.id} className="p-4 bg-white border border-slate-200/70 rounded-2xl shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-slate-900">{hol.title}</span>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800">
                      {hol.is_national ? 'National' : 'School'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
                    <Calendar size={13} className="text-violet-600" />
                    {hol.start_date} {hol.end_date !== hol.start_date && `to ${hol.end_date}`}
                  </div>
                  {hol.description && (
                    <p className="text-[11px] text-slate-500 leading-normal">{hol.description}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REMARKS MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {editingRemarksStudent && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 max-w-md w-full space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Attendance Remark</h4>
                  <p className="text-xs text-slate-500 font-medium">
                    {editingRemarksStudent.name} (Roll #{editingRemarksStudent.roll_number})
                  </p>
                </div>
                <button 
                  onClick={() => setEditingRemarksStudent(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                  Reason / Observation Note
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Medical leave with doctor slip, Arrived 30 mins late due to transport..."
                  value={currentRemarkText}
                  onChange={(e) => setCurrentRemarkText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 font-medium resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditingRemarksStudent(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveRemark}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition-colors"
                >
                  Save Note
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sticky Bottom Save Bar for Mobile Workflows */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200/80 z-30 lg:hidden flex items-center justify-between gap-3 shadow-lg">
        <div className="text-xs">
          <span className="font-bold text-slate-900 block leading-tight">
            {registerStats.present}/{registerStats.total} Present
          </span>
          <span className="text-[10px] text-slate-500 font-medium">
            {selectedClass} - {selectedSection}
          </span>
        </div>
        <button
          onClick={handleSaveAttendance}
          disabled={isSaving || students.length === 0}
          className="px-5 py-2 bg-violet-600 text-white rounded-xl text-xs font-bold shadow-md shadow-violet-600/20 flex items-center gap-2 cursor-pointer"
        >
          {isSaving ? <RefreshCcw size={14} className="animate-spin" /> : <Save size={14} />}
          Save Register
        </button>
      </div>

    </div>
  );
}
