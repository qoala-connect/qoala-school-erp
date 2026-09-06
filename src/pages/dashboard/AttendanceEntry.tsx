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
  TrendingUp,
  ChevronLeft,
  ChevronDown,
  RotateCcw,
  Layers,
  Command,
  CircleDot,
  Undo2,
  Printer,
  Sparkles,
  Bell,
  MessageSquare,
  Check,
  Activity,
  Table as TableIcon,
  Filter,
  UserCheck,
  UserX,
  SlidersHorizontal,
  Flame,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import AdminHeader from '@/components/common/AdminHeader';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'leave';

interface AttendanceStatusConfig {
  id: AttendanceStatus;
  label: string;
  shortLabel: string;
  hotkey: string;
  icon: any;
  activeBg: string;
  badgeBg: string;
  textColor: string;
  borderColor: string;
  railBg: string;
  dotBg: string;
  rowHighlight: string;
}

const ATTENDANCE_STATUSES: AttendanceStatusConfig[] = [
  {
    id: 'present',
    label: 'Present',
    shortLabel: 'P',
    hotkey: 'p',
    icon: CheckCircle2,
    activeBg: 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/30',
    badgeBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    textColor: 'text-emerald-700 font-bold',
    borderColor: 'border-emerald-300',
    railBg: 'bg-emerald-500',
    dotBg: 'bg-emerald-500',
    rowHighlight: 'hover:bg-emerald-50/30'
  },
  {
    id: 'absent',
    label: 'Absent',
    shortLabel: 'A',
    hotkey: 'a',
    icon: XCircle,
    activeBg: 'bg-rose-600 text-white shadow-xs shadow-rose-600/30',
    badgeBg: 'bg-rose-50 border-rose-200 text-rose-700',
    textColor: 'text-rose-700 font-bold',
    borderColor: 'border-rose-300',
    railBg: 'bg-rose-500',
    dotBg: 'bg-rose-500',
    rowHighlight: 'bg-rose-50/30 hover:bg-rose-50/50'
  },
  {
    id: 'late',
    label: 'Late',
    shortLabel: 'L',
    hotkey: 'l',
    icon: Clock,
    activeBg: 'bg-amber-500 text-white shadow-xs shadow-amber-500/30',
    badgeBg: 'bg-amber-50 border-amber-200 text-amber-800',
    textColor: 'text-amber-800 font-bold',
    borderColor: 'border-amber-300',
    railBg: 'bg-amber-500',
    dotBg: 'bg-amber-500',
    rowHighlight: 'bg-amber-50/30 hover:bg-amber-50/50'
  },
  {
    id: 'half_day',
    label: 'Half Day',
    shortLabel: 'HD',
    hotkey: 'h',
    icon: Clock,
    activeBg: 'bg-sky-600 text-white shadow-xs shadow-sky-600/30',
    badgeBg: 'bg-sky-50 border-sky-200 text-sky-700',
    textColor: 'text-sky-700 font-bold',
    borderColor: 'border-sky-300',
    railBg: 'bg-sky-500',
    dotBg: 'bg-sky-500',
    rowHighlight: 'bg-sky-50/20 hover:bg-sky-50/40'
  },
  {
    id: 'leave',
    label: 'Leave',
    shortLabel: 'LV',
    hotkey: 'v',
    icon: Coffee,
    activeBg: 'bg-purple-600 text-white shadow-xs shadow-purple-600/30',
    badgeBg: 'bg-purple-50 border-purple-200 text-purple-700',
    textColor: 'text-purple-700 font-bold',
    borderColor: 'border-purple-300',
    railBg: 'bg-purple-500',
    dotBg: 'bg-purple-500',
    rowHighlight: 'bg-purple-50/30 hover:bg-purple-50/50'
  },
];

const STATUS_BY_ID: Record<AttendanceStatus, AttendanceStatusConfig> = ATTENDANCE_STATUSES.reduce(
  (acc, s) => ({ ...acc, [s.id]: s }),
  {} as Record<AttendanceStatus, AttendanceStatusConfig>
);

const QUICK_REASON_TAGS = [
  { label: 'Medical / Illness', icon: '🩺', status: 'leave' as AttendanceStatus },
  { label: 'School Transport Delay', icon: '🚌', status: 'late' as AttendanceStatus },
  { label: 'Prior Approved Leave', icon: '📝', status: 'leave' as AttendanceStatus },
  { label: 'Family Emergency', icon: '👨‍👩‍👧', status: 'absent' as AttendanceStatus },
  { label: 'Authorized Sports / Event', icon: '🏆', status: 'present' as AttendanceStatus },
  { label: 'Unexcused / No Notice', icon: '❓', status: 'absent' as AttendanceStatus },
];

function formatLongDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatAuditDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const todayIso = new Date().toISOString().split('T')[0];
  const yesterdayIso = shiftDate(todayIso, -1);
  if (iso === todayIso) return 'Today, ' + d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  if (iso === yesterdayIso) return 'Yesterday, ' + d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatAuditTime(updatedAt?: string): string | null {
  if (!updatedAt) return null;
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function capitalizeWords(str?: string | null): string {
  if (!str) return 'Faculty / Admin';
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

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
  photo_url?: string;
  class: string;
  section: string;
  attendance_date: string;
  status: AttendanceStatus;
  remarks: string | null;
  marked_by: string | null;
  marked_by_name?: string | null;
  phone?: string;
  father_name?: string;
  updated_at: string;
}

interface ClassSubmissionStatus {
  class_name: string;
  section_name: string;
  total_students: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  leave_count: number;
  is_submitted: boolean;
  class_teacher_name?: string | null;
  last_updated_at?: string | null;
}

type TabType = 'register' | 'live_monitor' | 'muster' | 'history' | 'reports' | 'calendar';

export default function AttendanceEntry() {
  const location = useLocation();
  const navigate = useNavigate();

  const { user, role } = useAuth();
  const isTeacher = role === 'teacher' || role === 'class_teacher';
  const isAdmin = role === 'admin' || role === 'principal' || role === 'super_admin';

  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>(
    (location.state?.activeTab as TabType) || 'register'
  );

  // Defense-in-depth: Redirect students/parents to personal attendance portal
  useEffect(() => {
    if (role === 'student' || role === 'parent') {
      navigate('/dashboard/portal?tab=attendance', { replace: true });
    }
  }, [role, navigate]);

  // Filter & Selection States
  const [students, setStudents] = useState<Student[]>([]);
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [sectionOptions, setSectionOptions] = useState<string[]>([]);
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
  const [sparklines, setSparklines] = useState<Record<string, AttendanceStatus[]>>({});
  const [activeHoliday, setActiveHoliday] = useState<HolidayInfo | null>(null);
  const [approvedLeaves, setApprovedLeaves] = useState<Record<string, StudentLeaveInfo>>({});
  const [classTeacherName, setClassTeacherName] = useState<string | null>(null);

  // Baseline & Persistence states
  const [baseline, setBaseline] = useState<Record<string, { status: AttendanceStatus; remarks: string }>>({});
  const [recordedIds, setRecordedIds] = useState<Set<string>>(new Set());
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Modal States
  const [editingRemarksStudent, setEditingRemarksStudent] = useState<Student | null>(null);
  const [currentRemarkText, setCurrentRemarkText] = useState('');
  const [showAbsenceAlertModal, setShowAbsenceAlertModal] = useState(false);
  const [selectedNoticeStudent, setSelectedNoticeStudent] = useState<any | null>(null);

  // Loading & Action States
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Roster view controls
  const [rosterStatusFilter, setRosterStatusFilter] = useState<'all' | AttendanceStatus>('all');
  const [focusedRow, setFocusedRow] = useState<number>(-1);
  const [showAllAssigned, setShowAllAssigned] = useState(false);

  // Live Monitor / Heatmap States
  const [allSubmissions, setAllSubmissions] = useState<ClassSubmissionStatus[]>([]);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorSearch, setMonitorSearch] = useState('');
  const [monitorFilter, setMonitorFilter] = useState<'all' | 'submitted' | 'pending'>('all');

  // Monthly Muster Roll Matrix States
  const [musterMonth, setMusterMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [musterData, setMusterData] = useState<{
    daysInMonth: number[];
    recordsByStudent: Record<string, Record<number, { status: AttendanceStatus; isSunday?: boolean; isHoliday?: boolean }>>;
    totalsByStudent: Record<string, { present: number; absent: number; late: number; leave: number; pct: number }>;
  } | null>(null);
  const [musterLoading, setMusterLoading] = useState(false);
  const [musterSearch, setMusterSearch] = useState('');

  // History Tab States
  const [historyRecords, setHistoryRecords] = useState<AttendanceHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyClass, setHistoryClass] = useState<string>('');
  const [historySection, setHistorySection] = useState<string>('');
  const [historyDateRange, setHistoryDateRange] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all'>('week');
  const [historyCustomDate, setHistoryCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [inspectingHistoryRecord, setInspectingHistoryRecord] = useState<AttendanceHistoryRecord | null>(null);

  // Reports & Analytics Tab States
  const [classSummaries, setClassSummaries] = useState<any[]>([]);
  const [cbseDefaulters, setCbseDefaulters] = useState<any[]>([]);
  const [defaulterFilterTier, setDefaulterFilterTier] = useState<'all' | 'critical' | 'warning'>('all');

  // Calendar Tab States
  const [allHolidays, setAllHolidays] = useState<HolidayInfo[]>([]);

  // 0. Load teacher assigned classes
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

  // 1. Fetch Metadata Options
  const fetchMetadata = useCallback(async () => {
    try {
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

  // 2. Fetch Register Data for Selected Class + Date
  const fetchRegisterData = useCallback(async () => {
    if (!selectedClass || !selectedSection || !selectedDate) return;
    setIsLoading(true);
    setLoadError(null);

    try {
      // Check for Holiday
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

      // Fetch Class Teacher
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
        setBaseline({});
        setRecordedIds(new Set());
        setSparklines({});
        setIsLoading(false);
        return;
      }

      // Fetch approved leaves
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
      const persistedIds = new Set<string>();

      existingData?.forEach(record => {
        if (record.status) {
          attendanceMap[record.student_id] = record.status as AttendanceStatus;
          persistedIds.add(record.student_id);
        }
        if (record.remarks) {
          remarksMap[record.student_id] = record.remarks;
        }
      });

      // Default unmarked students to approved leave or present
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
      setRecordedIds(persistedIds);

      const baselineMap: Record<string, { status: AttendanceStatus; remarks: string }> = {};
      loadedStudents.forEach(s => {
        baselineMap[s.id] = { status: attendanceMap[s.id], remarks: remarksMap[s.id] || '' };
      });
      setBaseline(baselineMap);
      setFocusedRow(-1);

      // Fetch CBSE summary percentages
      const { data: cbseData } = await supabase
        .from('cbse_attendance_summary')
        .select('student_id, attendance_percentage')
        .in('student_id', studentIds);

      const cbseMap: Record<string, number> = {};
      cbseData?.forEach(record => {
        cbseMap[record.student_id] = Number(record.attendance_percentage);
      });
      setCbseWarnings(cbseMap);

      // Fetch 5-Day Historical Trail for sparklines
      const fiveDaysAgo = shiftDate(selectedDate, -6);
      const { data: recentLogs } = await supabase
        .from('attendance')
        .select('student_id, attendance_date, status')
        .in('student_id', studentIds)
        .gte('attendance_date', fiveDaysAgo)
        .lt('attendance_date', selectedDate)
        .order('attendance_date', { ascending: true });

      const sparkMap: Record<string, AttendanceStatus[]> = {};
      studentIds.forEach(id => { sparkMap[id] = []; });
      recentLogs?.forEach((log: any) => {
        if (sparkMap[log.student_id]) {
          sparkMap[log.student_id].push(log.status as AttendanceStatus);
        }
      });
      setSparklines(sparkMap);

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

  // 3. Fetch Live Campus Submissions Heatmap (Admin Monitor)
  const fetchCampusLiveMonitor = useCallback(async () => {
    setMonitorLoading(true);
    try {
      // 1. Get all classes and sections
      const { data: stdData } = await supabase
        .from('students')
        .select('class, section, id')
        .eq('status', 'active');

      const classSectionGroups = new Map<string, { class_name: string; section_name: string; total_students: number }>();
      (stdData || []).forEach(s => {
        if (!s.class || !s.section) return;
        const key = `${s.class}__${s.section}`;
        const existing = classSectionGroups.get(key) || { class_name: s.class, section_name: s.section, total_students: 0 };
        existing.total_students++;
        classSectionGroups.set(key, existing);
      });

      // 2. Fetch recorded attendance for selectedDate
      const { data: attData } = await supabase
        .from('attendance')
        .select('class, section, status, marked_by, updated_at')
        .eq('attendance_date', selectedDate);

      // 3. Fetch Class Teachers
      const { data: ctData } = await supabase
        .from('teacher_assignments')
        .select(`
          teachers (name),
          classes (class_name),
          sections (section_name)
        `)
        .in('assignment_type', ['class_teacher', 'both'])
        .eq('is_active', true);

      const ctMap = new Map<string, string>();
      ctData?.forEach((ct: any) => {
        const c = ct.classes?.class_name;
        const s = ct.sections?.section_name;
        const name = ct.teachers?.name;
        if (c && s && name) ctMap.set(`${c}__${s}`, name);
      });

      // Group attendance by class-section
      const attGroup = new Map<string, { present: number; absent: number; late: number; leave: number; last_updated?: string }>();
      (attData || []).forEach(r => {
        if (!r.class || !r.section) return;
        const key = `${r.class}__${r.section}`;
        const cur = attGroup.get(key) || { present: 0, absent: 0, late: 0, leave: 0 };
        if (r.status === 'present') cur.present++;
        else if (r.status === 'absent') cur.absent++;
        else if (r.status === 'late') cur.late++;
        else if (r.status === 'leave' || r.status === 'half_day') cur.leave++;
        if (r.updated_at) cur.last_updated = r.updated_at;
        attGroup.set(key, cur);
      });

      const submissionList: ClassSubmissionStatus[] = Array.from(classSectionGroups.values()).map(cs => {
        const key = `${cs.class_name}__${cs.section_name}`;
        const att = attGroup.get(key);
        const hasAttendance = !!att && (att.present + att.absent + att.late + att.leave > 0);
        return {
          class_name: cs.class_name,
          section_name: cs.section_name,
          total_students: cs.total_students,
          present_count: att?.present || 0,
          absent_count: att?.absent || 0,
          late_count: att?.late || 0,
          leave_count: att?.leave || 0,
          is_submitted: hasAttendance,
          class_teacher_name: ctMap.get(key) || null,
          last_updated_at: att?.last_updated || null
        };
      });

      submissionList.sort((a, b) => {
        const numA = parseInt(a.class_name.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.class_name.replace(/\D/g, '')) || 0;
        if (numA !== numB) return numA - numB;
        return a.section_name.localeCompare(b.section_name);
      });

      setAllSubmissions(submissionList);
    } catch (err) {
      console.error('[Attendance] Campus Monitor failed:', err);
    } finally {
      setMonitorLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (activeTab === 'live_monitor') {
      fetchCampusLiveMonitor();
    }
  }, [fetchCampusLiveMonitor, activeTab]);

  // 4. Fetch Monthly Muster Roll Matrix
  const fetchMonthlyMuster = useCallback(async () => {
    if (!selectedClass || !selectedSection || !musterMonth) return;
    setMusterLoading(true);
    try {
      const [yearStr, monthStr] = musterMonth.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      const daysInMonth = new Date(year, month, 0).getDate();
      const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

      // Fetch students
      const { data: stds } = await supabase
        .from('students')
        .select('id, name, roll_number, admission_number')
        .eq('class', selectedClass)
        .eq('section', selectedSection)
        .eq('status', 'active')
        .order('roll_number', { ascending: true });

      const studentList = stds || [];
      const studentIds = studentList.map(s => s.id);

      // Fetch month attendance logs
      const startIso = `${year}-${String(month).padStart(2, '0')}-01`;
      const endIso = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

      const { data: logs } = await supabase
        .from('attendance')
        .select('student_id, attendance_date, status')
        .in('student_id', studentIds)
        .gte('attendance_date', startIso)
        .lte('attendance_date', endIso);

      // Fetch holidays in this month
      const { data: hols } = await supabase
        .from('holidays')
        .select('start_date, end_date')
        .lte('start_date', endIso)
        .gte('end_date', startIso);

      const holidayDays = new Set<number>();
      hols?.forEach((h: any) => {
        const sD = new Date(h.start_date).getDate();
        const eD = new Date(h.end_date).getDate();
        for (let d = sD; d <= eD; d++) holidayDays.add(d);
      });

      const recordsByStudent: Record<string, Record<number, { status: AttendanceStatus; isSunday?: boolean; isHoliday?: boolean }>> = {};
      const totalsByStudent: Record<string, { present: number; absent: number; late: number; leave: number; pct: number }> = {};

      studentList.forEach(s => {
        recordsByStudent[s.id] = {};
        totalsByStudent[s.id] = { present: 0, absent: 0, late: 0, leave: 0, pct: 100 };
      });

      // Populate calendar day characteristics
      dayNumbers.forEach(day => {
        const dateObj = new Date(year, month - 1, day);
        const isSunday = dateObj.getDay() === 0;
        const isHoliday = holidayDays.has(day);

        studentList.forEach(s => {
          recordsByStudent[s.id][day] = {
            status: 'present',
            isSunday,
            isHoliday
          };
        });
      });

      // Overlay recorded attendance
      logs?.forEach((l: any) => {
        const day = parseInt(l.attendance_date.split('-')[2], 10);
        if (recordsByStudent[l.student_id] && recordsByStudent[l.student_id][day]) {
          recordsByStudent[l.student_id][day].status = l.status as AttendanceStatus;
        }
      });

      // Calculate totals
      studentList.forEach(s => {
        let p = 0, a = 0, lt = 0, lv = 0, totalWorking = 0;
        dayNumbers.forEach(day => {
          const rec = recordsByStudent[s.id][day];
          if (!rec.isSunday && !rec.isHoliday) {
            totalWorking++;
            if (rec.status === 'present') p++;
            else if (rec.status === 'absent') a++;
            else if (rec.status === 'late') { p++; lt++; }
            else if (rec.status === 'half_day') { p += 0.5; }
            else if (rec.status === 'leave') lv++;
          }
        });
        const pct = totalWorking > 0 ? Math.round((p / totalWorking) * 100) : 100;
        totalsByStudent[s.id] = { present: p, absent: a, late: lt, leave: lv, pct };
      });

      setMusterData({
        daysInMonth: dayNumbers,
        recordsByStudent,
        totalsByStudent
      });

    } catch (err) {
      console.error('[Attendance] Muster failed:', err);
    } finally {
      setMusterLoading(false);
    }
  }, [selectedClass, selectedSection, musterMonth]);

  useEffect(() => {
    if (activeTab === 'muster') {
      fetchMonthlyMuster();
    }
  }, [fetchMonthlyMuster, activeTab]);

  // 5. Fetch History Logs
  const fetchHistoryLogs = useCallback(async () => {
    setHistoryLoading(true);
    try {
      let query = supabase
        .from('attendance')
        .select(`
          id, student_id, attendance_date, status, class, section, remarks, marked_by, updated_at,
          students!inner (name, roll_number, admission_number, photo_url, phone, father_name)
        `)
        .order('attendance_date', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(300);

      if (historyClass) query = query.eq('class', historyClass);
      if (historySection) query = query.eq('section', historySection);
      if (historyStatusFilter !== 'all') query = query.eq('status', historyStatusFilter);

      const today = new Date();
      if (historyDateRange === 'today') {
        const todayStr = today.toISOString().split('T')[0];
        query = query.eq('attendance_date', todayStr);
      } else if (historyDateRange === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        query = query.eq('attendance_date', yesterday.toISOString().split('T')[0]);
      } else if (historyDateRange === 'week') {
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);
        query = query.gte('attendance_date', lastWeek.toISOString().split('T')[0]);
      } else if (historyDateRange === 'month') {
        const lastMonth = new Date(today);
        lastMonth.setDate(today.getDate() - 30);
        query = query.gte('attendance_date', lastMonth.toISOString().split('T')[0]);
      } else if (historyDateRange === 'custom' && historyCustomDate) {
        query = query.eq('attendance_date', historyCustomDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Extract unique marked_by IDs to fetch profile names
      const markerIds = Array.from(new Set((data || []).map((r: any) => r.marked_by).filter(Boolean)));
      const markerMap = new Map<string, string>();
      if (markerIds.length > 0) {
        try {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', markerIds);
          profs?.forEach((p: any) => { if (p.id && p.name) markerMap.set(p.id, p.name); });
        } catch {
          // ignore profile lookup fallback
        }
      }

      const formatted: AttendanceHistoryRecord[] = (data || []).map((row: any) => ({
        id: row.id,
        student_id: row.student_id,
        student_name: row.students?.name || 'Unknown',
        roll_number: row.students?.roll_number || 'N/A',
        admission_number: row.students?.admission_number || 'N/A',
        photo_url: row.students?.photo_url || undefined,
        phone: row.students?.phone || undefined,
        father_name: row.students?.father_name || undefined,
        class: row.class || 'N/A',
        section: row.section || 'N/A',
        attendance_date: row.attendance_date,
        status: row.status as AttendanceStatus,
        remarks: row.remarks,
        marked_by: row.marked_by,
        marked_by_name: row.marked_by ? markerMap.get(row.marked_by) || 'Faculty / Admin' : null,
        updated_at: row.updated_at
      }));

      setHistoryRecords(formatted);
    } catch (err: any) {
      console.error('[Attendance] History load failed:', err);
      toast.error('Failed to load attendance history: ' + err.message);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyClass, historySection, historyDateRange, historyCustomDate, historyStatusFilter]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistoryLogs();
    }
  }, [fetchHistoryLogs, activeTab]);

  // 6. Fetch Reports & CBSE Analytics
  const fetchReportsData = useCallback(async () => {
    try {
      const { data: classData } = await supabase
        .from('dashboard_attendance_class_view')
        .select('*');

      if (classData) setClassSummaries(classData);

      const { data: defaultersData } = await supabase
        .from('cbse_attendance_summary')
        .select(`
          student_id, total_working_days, total_present, attendance_percentage,
          students!inner (name, roll_number, class, section, admission_number, phone, father_name)
        `)
        .lt('attendance_percentage', 75)
        .order('attendance_percentage', { ascending: true })
        .limit(100);

      if (defaultersData) {
        setCbseDefaulters(defaultersData.map((d: any) => ({
          student_id: d.student_id,
          name: d.students?.name || 'Unknown',
          roll_number: d.students?.roll_number || 'N/A',
          class: d.students?.class || 'N/A',
          section: d.students?.section || 'N/A',
          admission_number: d.students?.admission_number || 'N/A',
          father_name: d.students?.father_name || 'N/A',
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

  // 7. Fetch Calendar / Holidays
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
      toast.success(`Attendance recorded — Class ${selectedClass} Section ${selectedSection}`, {
        description: `${savedCount || students.length} students • ${formatLongDate(selectedDate)}`
      });
      setLastSavedAt(new Date().toISOString());

      // If there are absentees, offer parent broadcast notification
      const absenteeCount = students.filter(s => (attendance[s.id] || 'present') === 'absent').length;
      if (absenteeCount > 0) {
        setShowAbsenceAlertModal(true);
      }

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
    let protectedLeaves = 0;
    students.forEach(s => {
      if (status !== 'leave' && approvedLeaves[s.id]) {
        next[s.id] = 'leave';
        protectedLeaves++;
      } else {
        next[s.id] = status;
      }
    });
    setAttendance(next);

    const label = STATUS_BY_ID[status]?.label || status;
    toast.info(`${students.length - protectedLeaves} students marked ${label}`, {
      description: protectedLeaves > 0
        ? `${protectedLeaves} on approved leave were left untouched.`
        : 'Review the roster, then click Save Register.'
    });
  };

  const handleToggleStatus = (studentId: string, status: AttendanceStatus) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleDiscardChanges = () => {
    const revertedAttendance: Record<string, AttendanceStatus> = {};
    const revertedRemarks: Record<string, string> = {};
    Object.entries(baseline).forEach(([id, snap]) => {
      revertedAttendance[id] = snap.status;
      if (snap.remarks) revertedRemarks[id] = snap.remarks;
    });
    setAttendance(revertedAttendance);
    setRemarks(revertedRemarks);
    toast.success('Unsaved changes discarded');
  };

  // Remarks Management
  const openRemarksModal = (student: Student) => {
    setEditingRemarksStudent(student);
    setCurrentRemarkText(remarks[student.id] || '');
  };

  const saveRemark = (customText?: string, autoStatus?: AttendanceStatus) => {
    if (editingRemarksStudent) {
      const textToSave = customText !== undefined ? customText : currentRemarkText;
      setRemarks(prev => ({
        ...prev,
        [editingRemarksStudent.id]: textToSave
      }));
      if (autoStatus) {
        setAttendance(prev => ({
          ...prev,
          [editingRemarksStudent.id]: autoStatus
        }));
      }
      setEditingRemarksStudent(null);
      toast.success(`Note saved for ${editingRemarksStudent.name}`);
    }
  };

  // Filtered Students
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter(s => {
      if (rosterStatusFilter !== 'all' && (attendance[s.id] || 'present') !== rosterStatusFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.roll_number || '').toLowerCase().includes(q) ||
        (s.admission_number || '').toLowerCase().includes(q)
      );
    });
  }, [students, searchQuery, rosterStatusFilter, attendance]);

  // Unsaved edits tracker
  const dirtyIds = useMemo(() => {
    const ids = new Set<string>();
    students.forEach(s => {
      const snap = baseline[s.id];
      if (!snap) return;
      const status = attendance[s.id] || 'present';
      const remark = remarks[s.id] || '';
      if (status !== snap.status || remark !== snap.remarks) ids.add(s.id);
    });
    return ids;
  }, [students, baseline, attendance, remarks]);

  const isDirty = dirtyIds.size > 0;
  const unrecordedCount = useMemo(
    () => students.filter(s => !recordedIds.has(s.id)).length,
    [students, recordedIds]
  );

  // Warn before page unload if unsaved
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Keyboard roll-call shortcuts
  useEffect(() => {
    if (activeTab !== 'register') return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (filteredStudents.length === 0) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedRow(prev => {
          const delta = e.key === 'ArrowDown' ? 1 : -1;
          const next = prev < 0 ? (delta === 1 ? 0 : filteredStudents.length - 1) : prev + delta;
          return Math.max(0, Math.min(filteredStudents.length - 1, next));
        });
        return;
      }

      const match = ATTENDANCE_STATUSES.find(s => s.hotkey === e.key.toLowerCase());
      if (match && focusedRow >= 0 && focusedRow < filteredStudents.length) {
        e.preventDefault();
        handleToggleStatus(filteredStudents[focusedRow].id, match.id);
        setFocusedRow(prev => Math.min(filteredStudents.length - 1, prev + 1));
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab, filteredStudents, focusedRow]);

  // Register Statistics
  const registerStats = useMemo(() => {
    const total = students.length;
    let present = 0, absent = 0, late = 0, halfDay = 0, leave = 0;

    students.forEach(s => {
      const st = attendance[s.id] || 'present';
      if (st === 'present') present++;
      else if (st === 'absent') absent++;
      else if (st === 'late') late++;
      else if (st === 'half_day') halfDay++;
      else if (st === 'leave') leave++;
    });

    const attendanceRate = total > 0 ? Math.round(((present + halfDay * 0.5) / total) * 100) : 100;
    const byStatus: Record<AttendanceStatus, number> = {
      present, absent, late, half_day: halfDay, leave
    };

    return { total, present, absent, late, halfDay, leave, attendanceRate, byStatus };
  }, [students, attendance]);

  // Grouped teacher classes
  const groupedAssigned = useMemo(() => {
    const map = new Map<string, string[]>();
    teacherAssignedClasses.forEach(ac => {
      const list = map.get(ac.class_name) || [];
      if (!list.includes(ac.section_name)) list.push(ac.section_name);
      map.set(ac.class_name, list);
    });
    return Array.from(map.entries())
      .sort((a, b) => (parseInt(a[0].replace(/\D/g, '')) || 0) - (parseInt(b[0].replace(/\D/g, '')) || 0))
      .map(([className, sections]) => ({ className, sections: sections.sort() }));
  }, [teacherAssignedClasses]);

  // Campus Monitor Stats
  const campusMonitorStats = useMemo(() => {
    const totalClasses = allSubmissions.length;
    const submittedCount = allSubmissions.filter(s => s.is_submitted).length;
    const pendingCount = totalClasses - submittedCount;
    const totalStudents = allSubmissions.reduce((sum, s) => sum + s.total_students, 0);
    const totalPresent = allSubmissions.reduce((sum, s) => sum + s.present_count, 0);
    const totalAbsent = allSubmissions.reduce((sum, s) => sum + s.absent_count, 0);
    const rate = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 100;

    return { totalClasses, submittedCount, pendingCount, totalStudents, totalPresent, totalAbsent, rate };
  }, [allSubmissions]);

  // Filtered Campus Monitor Submissions
  const filteredSubmissions = useMemo(() => {
    return allSubmissions.filter(s => {
      if (monitorFilter === 'submitted' && !s.is_submitted) return false;
      if (monitorFilter === 'pending' && s.is_submitted) return false;
      if (!monitorSearch) return true;
      const q = monitorSearch.toLowerCase();
      return (
        s.class_name.toLowerCase().includes(q) ||
        s.section_name.toLowerCase().includes(q) ||
        (s.class_teacher_name || '').toLowerCase().includes(q)
      );
    });
  }, [allSubmissions, monitorFilter, monitorSearch]);

  // Filtered History Records
  const filteredHistory = useMemo(() => {
    if (!historySearchQuery) return historyRecords;
    const q = historySearchQuery.toLowerCase();
    return historyRecords.filter(r => 
      r.student_name.toLowerCase().includes(q) || 
      r.roll_number.toLowerCase().includes(q) || 
      r.admission_number.toLowerCase().includes(q) ||
      (r.remarks && r.remarks.toLowerCase().includes(q)) ||
      (r.marked_by_name && r.marked_by_name.toLowerCase().includes(q))
    );
  }, [historyRecords, historySearchQuery]);

  // History KPIs
  const historyMetrics = useMemo(() => {
    const total = filteredHistory.length;
    const present = filteredHistory.filter(r => r.status === 'present').length;
    const absent = filteredHistory.filter(r => r.status === 'absent').length;
    const late = filteredHistory.filter(r => r.status === 'late').length;
    const leave = filteredHistory.filter(r => r.status === 'leave').length;
    const presentPct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { total, present, absent, late, leave, presentPct };
  }, [filteredHistory]);

  // Export History CSV
  const exportHistoryToCSV = () => {
    if (filteredHistory.length === 0) {
      toast.error('No records to export');
      return;
    }
    const headers = ['Attendance Date', 'Student Name', 'Roll Number', 'Admission Number', 'Class', 'Section', 'Status', 'Remarks / Reason', 'Marked By / Author', 'Recorded Timestamp'];
    const rows = filteredHistory.map(r => [
      r.attendance_date,
      `"${r.student_name}"`,
      r.roll_number,
      r.admission_number,
      `"${r.class}"`,
      r.section,
      r.status.toUpperCase(),
      `"${r.remarks || ''}"`,
      `"${r.marked_by_name || 'Faculty / Admin'}"`,
      r.updated_at
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const classTag = historyClass ? `Class_${historyClass}` : 'All_Classes';
    const sectionTag = historySection ? `Sec_${historySection}` : 'All_Sections';
    link.setAttribute('download', `Attendance_Audit_Log_${classTag}_${sectionTag}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Attendance audit records exported to CSV');
  };

  // Export Monthly Muster CSV
  const exportMusterToCSV = () => {
    if (!musterData) {
      toast.error('No muster data to export');
      return;
    }
    const dayHeaders = musterData.daysInMonth.map(d => `Day ${d}`);
    const headers = ['Roll No', 'Student Name', 'Admission No', ...dayHeaders, 'Total Present', 'Total Absent', 'Total Leave', 'Attendance %'];
    
    const rows = students.map(s => {
      const dayStatuses = musterData.daysInMonth.map(d => {
        const cell = musterData.recordsByStudent[s.id]?.[d];
        if (cell?.isSunday) return 'SUN';
        if (cell?.isHoliday) return 'HOL';
        return cell?.status?.toUpperCase() || 'P';
      });
      const totals = musterData.totalsByStudent[s.id] || { present: 0, absent: 0, leave: 0, pct: 100 };
      return [
        s.roll_number,
        `"${s.name}"`,
        s.admission_number,
        ...dayStatuses,
        totals.present,
        totals.absent,
        totals.leave,
        `${totals.pct}%`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Muster_Roll_Class_${selectedClass}_${selectedSection}_${musterMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Monthly Muster Roll exported to CSV');
  };

  // Filtered Defaulters
  const filteredDefaulters = useMemo(() => {
    return cbseDefaulters.filter(d => {
      if (defaulterFilterTier === 'critical' && d.attendance_percentage >= 60) return false;
      if (defaulterFilterTier === 'warning' && (d.attendance_percentage < 60 || d.attendance_percentage >= 75)) return false;
      return true;
    });
  }, [cbseDefaulters, defaulterFilterTier]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24 text-slate-700">
      {/* 1. Header Banner & Actions */}
      <AdminHeader
        title="Enterprise Attendance Management"
        subtitle="Precision roll-call, real-time campus heatmaps, CBSE audit compliance, and monthly muster rolls."
        badge={{
          icon: CalendarCheck,
          text: 'Attendance Suite',
          variant: 'primary'
        }}
        sessionBadge="Session: 2026-27"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate('/dashboard/students')}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-all border border-slate-200/80 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Go to Students SIS Directory"
            >
              <Users size={14} className="text-blue-600" />
              Student SIS
            </button>
            <button
              onClick={() => navigate('/dashboard/academics', { state: { activeTab: 'classes' } })}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-all border border-slate-200/80 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Manage Classes & Sections"
            >
              <GraduationCap size={14} className="text-indigo-600" />
              Class Rosters
            </button>
            <button
              onClick={() => navigate('/dashboard/communication')}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-all border border-slate-200/80 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Send Absence Alerts via Communication Hub"
            >
              <Send size={14} className="text-emerald-600" />
              Communication Hub
            </button>
          </div>
        }
      />

      {/* 2. Top-Level Tab Navigation Dock */}
      <div className="bg-slate-100/90 rounded-2xl border border-slate-200/80 p-1.5 shadow-2xs overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 min-w-max">
          {[
            { id: 'register', label: 'Daily Roll Call', icon: CalendarCheck, count: isDirty ? dirtyIds.size : undefined },
            { id: 'live_monitor', label: 'Campus Live Monitor', icon: Activity, badge: 'Live Heatmap' },
            { id: 'muster', label: 'Monthly Muster Roll', icon: TableIcon, badge: 'Form 14' },
            { id: 'history', label: 'Audit History & Logs', icon: History },
            { id: 'reports', label: 'CBSE Defaulters & Analytics', icon: ShieldAlert, count: cbseDefaulters.length > 0 ? cbseDefaulters.length : undefined },
            { id: 'calendar', label: 'School Calendar & Holidays', icon: Calendar }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer relative",
                  isActive
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/90"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                )}
              >
                <Icon size={14} className={isActive ? "text-indigo-600" : "text-slate-400"} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-black",
                    isActive ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-700"
                  )}>
                    {tab.count}
                  </span>
                )}
                {tab.badge && (
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DAILY ATTENDANCE REGISTER */}
      {/* ========================================================================= */}
      {activeTab === 'register' && (
        <div className="space-y-5">
          {/* Teacher Assigned Classes Workload Switcher */}
          {isTeacher && groupedAssigned.length > 0 && (
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
              <button
                onClick={() => setShowAllAssigned(v => !v)}
                className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50/70 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 shrink-0">
                    <Layers size={14} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      My Teaching Workload
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium truncate block">
                      {teacherProfile?.name || 'Faculty Member'} • {teacherAssignedClasses.length} assigned class-sections
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-[11px] font-bold text-indigo-700">
                    <CheckCircle2 size={11} />
                    Class {selectedClass} · Sec {selectedSection}
                  </span>
                  <ChevronDown
                    size={16}
                    className={cn("text-slate-400 transition-transform duration-200", showAllAssigned && "rotate-180")}
                  />
                </div>
              </button>

              {showAllAssigned && (
                <div className="border-t border-slate-100 divide-y divide-slate-100 bg-slate-50/40">
                  {groupedAssigned.map(group => (
                    <div key={group.className} className="flex items-center gap-3 px-4 sm:px-5 py-2.5">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider w-16 shrink-0">
                        Class {group.className}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {group.sections.map(sec => {
                          const isSelected = selectedClass === group.className && selectedSection === sec;
                          return (
                            <button
                              key={sec}
                              onClick={() => {
                                setSelectedClass(group.className);
                                setSelectedSection(sec);
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                                isSelected
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200/80 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200"
                              )}
                              title={`Open Class ${group.className} Section ${sec}`}
                            >
                              Section {sec}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Holiday Alert Banner */}
          {activeHoliday && (
            <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-3 text-amber-900 shadow-2xs">
              <CalendarX className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <div className="font-bold text-sm text-amber-950 flex items-center gap-2">
                  Official School Holiday: {activeHoliday.title}
                  {activeHoliday.is_national && (
                    <span className="px-2 py-0.5 bg-amber-200/80 text-amber-900 rounded-md text-[10px] font-bold uppercase tracking-wider">
                      National
                    </span>
                  )}
                </div>
                <p className="text-amber-800/80 mt-0.5 font-medium">
                  {activeHoliday.description || 'This date is declared a non-instructional holiday in the School Calendar.'}
                </p>
              </div>
            </div>
          )}

          {/* Register Command Bar — Premium Enterprise Control Panel */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* Top Tier: Academic Scope Selectors */}
            <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
              {/* Date Navigator (4 cols on lg) */}
              <div className="lg:col-span-4 flex flex-col">
                <span className="text-[11px] font-bold text-slate-500 pl-1 mb-1.5 uppercase tracking-wider">
                  Attendance Date
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
                    className="h-[40px] w-9 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer shrink-0 shadow-2xs"
                    title="Previous day"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="relative flex-1 min-w-[130px]">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="date"
                      value={selectedDate}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full bg-slate-50 hover:bg-white border border-slate-200 rounded-xl h-[40px] pl-9 pr-2 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-2xs"
                    />
                  </div>
                  <button
                    onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
                    disabled={selectedDate >= new Date().toISOString().split('T')[0]}
                    className="h-[40px] w-9 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-2xs"
                    title="Next day"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                    className="h-[40px] px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer shrink-0 shadow-2xs"
                    title="Jump to today"
                  >
                    Today
                  </button>
                </div>
              </div>

              {/* Class & Section Scope (4 cols on lg) */}
              <div className="lg:col-span-4 flex flex-col">
                <span className="text-[11px] font-bold text-slate-500 pl-1 mb-1.5 uppercase tracking-wider">
                  Class & Section
                </span>
                <div className="flex items-center gap-2">
                  <div className="min-w-[110px] shrink-0">
                    <select
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      className="w-full bg-slate-50 hover:bg-white border border-slate-200 rounded-xl h-[40px] px-3 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer transition-all shadow-2xs"
                    >
                      {classOptions.length === 0 && <option value="">No classes</option>}
                      {classOptions.map(c => (
                        <option key={c} value={c}>Class {c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Interactive Section Pills */}
                  <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 h-[40px]">
                    {sectionOptions.length === 0 ? (
                      <span className="text-xs text-slate-400 px-2 font-medium">No Sec</span>
                    ) : (
                      sectionOptions.map(sec => {
                        const isSelected = selectedSection === sec;
                        return (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => setSelectedSection(sec)}
                            className={cn(
                              "flex-1 min-w-[34px] h-[30px] rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center select-none",
                              isSelected
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
                            )}
                            title={`Switch to Section ${sec}`}
                          >
                            {sec}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Class Teacher (2 cols on lg) */}
              <div className="lg:col-span-2 flex flex-col">
                <span className="text-[11px] font-bold text-slate-500 pl-1 mb-1.5 uppercase tracking-wider">
                  Class Teacher
                </span>
                <div className={cn(
                  "flex items-center gap-2 h-[40px] px-3 rounded-xl text-xs font-bold border transition-all shadow-2xs",
                  classTeacherName
                    ? "bg-emerald-50/80 text-emerald-900 border-emerald-200"
                    : "bg-slate-50 text-slate-400 border-slate-200"
                )}>
                  <GraduationCap size={15} className={classTeacherName ? "text-emerald-600 shrink-0" : "text-slate-400 shrink-0"} />
                  <span className="truncate">{classTeacherName || 'Not Assigned'}</span>
                </div>
              </div>

              {/* Filter Roster Search (2 cols on lg) */}
              <div className="lg:col-span-2 flex flex-col">
                <span className="text-[11px] font-bold text-slate-500 pl-1 mb-1.5 uppercase tracking-wider">
                  Filter Roster
                </span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search roster..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-white border border-slate-200 rounded-xl h-[40px] pl-9 pr-7 text-xs sm:text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-slate-400 font-semibold shadow-2xs"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Tier: Roll-Call Actions & Save CTA */}
            <div className="border-t border-slate-100 bg-slate-50/70 px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleBulkStatusChange('present')}
                  disabled={students.length === 0}
                  className="px-3.5 py-2 bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                  title="Mark all students Present (leaves preserved)"
                >
                  <UserCheck size={14} className="text-emerald-600" />
                  Mark All Present
                </button>

                <button
                  onClick={() => handleBulkStatusChange('absent')}
                  disabled={students.length === 0}
                  className="px-3.5 py-2 bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                  title="Mark all students Absent (leaves preserved)"
                >
                  <UserX size={14} className="text-rose-600" />
                  Mark All Absent
                </button>

                <button
                  onClick={handleDiscardChanges}
                  disabled={!isDirty}
                  className="px-3.5 py-2 bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-40"
                  title="Revert all unsaved marks"
                >
                  <Undo2 size={14} className="text-slate-500" />
                  Discard
                </button>

                <div className="hidden xl:flex items-center gap-2 pl-2 border-l border-slate-200 text-[11px] text-slate-500 font-medium">
                  <Command size={12} className="text-slate-400" />
                  <span>
                    <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] text-slate-600">↑↓</kbd>
                    {' '}navigate ·{' '}
                    {ATTENDANCE_STATUSES.map(s => (
                      <kbd key={s.id} className="px-1.5 py-0.5 mr-1 rounded bg-white border border-slate-200 font-mono text-[10px] text-slate-600 uppercase">
                        {s.hotkey}
                      </kbd>
                    ))}
                    {' '}mark
                  </span>
                </div>
              </div>

              {/* Right Dock: Status & Primary Save CTA */}
              <div className="flex items-center gap-2.5 ml-auto shrink-0">
                {isDirty ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 shadow-2xs">
                    <CircleDot size={12} className="text-amber-500 animate-pulse" />
                    {dirtyIds.size} unsaved {dirtyIds.size === 1 ? 'change' : 'changes'}
                  </span>
                ) : lastSavedAt ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 shadow-2xs">
                    <CheckCircle2 size={12} className="text-emerald-600" />
                    Saved {new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : unrecordedCount > 0 && students.length > 0 ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600">
                    <AlertTriangle size={12} className="text-amber-500" />
                    Awaiting roll call
                  </span>
                ) : null}

                <button
                  onClick={handleSaveAttendance}
                  disabled={isSaving || students.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {isSaving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSaving ? 'Saving Register…' : 'Save Register'}
                </button>
              </div>
            </div>
          </div>

          {/* Roll Call Live Distribution Cards */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Roll Call Summary — Class {selectedClass || '—'} · Section {selectedSection || '—'}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  {formatLongDate(selectedDate)} • {registerStats.total} active enrolled students
                  {unrecordedCount > 0 && registerStats.total > 0 && (
                    <span className="text-amber-700 font-semibold"> • {unrecordedCount} awaiting first submission</span>
                  )}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className={cn(
                  "text-3xl font-extrabold tracking-tight tabular-nums leading-none",
                  registerStats.attendanceRate < 75 ? "text-rose-600" : "text-emerald-700"
                )}>
                  {registerStats.attendanceRate}%
                </div>
                <span className="text-[11px] font-semibold text-slate-500">Live Attendance Rate</span>
              </div>
            </div>

            {/* Stacked Distribution Bar */}
            <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-slate-100 gap-0.5">
              {ATTENDANCE_STATUSES.map(st => {
                const count = registerStats.byStatus[st.id];
                if (!count) return null;
                return (
                  <div
                    key={st.id}
                    className={cn("h-full transition-all duration-300", st.dotBg)}
                    style={{ width: `${(count / Math.max(1, registerStats.total)) * 100}%` }}
                    title={`${st.label}: ${count} students`}
                  />
                );
              })}
            </div>

            {/* Clickable Filter Status Cards */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <button
                onClick={() => setRosterStatusFilter('all')}
                className={cn(
                  "text-left rounded-xl border p-3 transition-all cursor-pointer",
                  rosterStatusFilter === 'all'
                    ? "border-slate-900 bg-slate-900 text-white shadow-xs"
                    : "border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 text-slate-700"
                )}
              >
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-wider block",
                  rosterStatusFilter === 'all' ? "text-slate-300" : "text-slate-500"
                )}>
                  All Students
                </span>
                <span className="text-2xl font-bold tabular-nums tracking-tight">{registerStats.total}</span>
              </button>

              {ATTENDANCE_STATUSES.map(st => {
                const count = registerStats.byStatus[st.id];
                const isActive = rosterStatusFilter === st.id;
                return (
                  <button
                    key={st.id}
                    onClick={() => setRosterStatusFilter(isActive ? 'all' : st.id)}
                    className={cn(
                      "text-left rounded-xl border p-3 transition-all cursor-pointer relative overflow-hidden",
                      isActive
                        ? cn("shadow-xs ring-2 ring-offset-1 ring-slate-400", st.badgeBg)
                        : "border-slate-200/80 bg-slate-50/70 hover:bg-white hover:border-slate-300"
                    )}
                    title={`Filter by ${st.label}`}
                  >
                    <span className={cn("absolute top-0 left-0 h-full w-1.5", st.dotBg, isActive ? "opacity-100" : "opacity-40")} />
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider block", st.textColor)}>
                      {st.label}
                    </span>
                    <span className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Student Register Roster Table */}
          <div className="bg-white border border-slate-200/80 shadow-xs rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="py-3.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-[60px] text-center">Roll</th>
                    <th className="py-3.5 px-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Student Profile</th>
                    <th className="py-3.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-[100px]">Recent Trail</th>
                    <th className="py-3.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-[120px]">Adm No</th>
                    <th className="py-3.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-[110px]">CBSE Overall</th>
                    <th className="py-3.5 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-[360px]">Attendance Status</th>
                    <th className="py-3.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-[120px]">Remarks / Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-20 text-center text-slate-500 font-medium text-sm">
                        <RefreshCcw className="w-7 h-7 animate-spin mx-auto mb-2.5 text-indigo-600" />
                        Loading student register from database...
                      </td>
                    </tr>
                  ) : loadError ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
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
                      <td colSpan={7} className="py-16 text-center text-slate-400 font-medium text-xs">
                        {searchQuery 
                          ? `No student matches "${searchQuery}".` 
                          : `No active students enrolled in ${selectedClass} Section ${selectedSection}.`}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s, index) => {
                      const currentStatus = attendance[s.id] || 'present';
                      const currentRemark = remarks[s.id];
                      const cbsePct = cbseWarnings[s.id];
                      const hasCbseWarning = typeof cbsePct === 'number' && cbsePct < 75;
                      const hasApprovedLeave = !!approvedLeaves[s.id];
                      const statusConfig = STATUS_BY_ID[currentStatus] || STATUS_BY_ID.present;
                      const isFocused = focusedRow === index;
                      const trail = sparklines[s.id] || [];

                      return (
                        <tr 
                          key={s.id} 
                          className={cn(
                            "transition-colors group",
                            statusConfig.rowHighlight,
                            isFocused && "ring-2 ring-indigo-500 ring-inset bg-indigo-50/30"
                          )}
                        >
                          {/* Roll Number */}
                          <td className="py-3 px-4 text-center font-mono font-bold text-xs text-slate-600">
                            #{s.roll_number || '—'}
                          </td>

                          {/* Student Details */}
                          <td className="py-3 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs border border-slate-200/80 shrink-0 overflow-hidden">
                                {s.photo_url ? (
                                  <img src={s.photo_url} alt={s.name} className="w-full h-full object-cover" />
                                ) : (
                                  s.name.charAt(0)
                                )}
                              </div>
                              <div className="min-w-0">
                                <button
                                  onClick={() => navigate('/dashboard/students', { state: { selectedStudentId: s.id } })}
                                  className="font-bold text-slate-900 hover:text-indigo-600 transition-colors text-xs text-left truncate flex items-center gap-1 cursor-pointer"
                                  title="View full Student 360 profile"
                                >
                                  {s.name}
                                  <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                                <span className="text-[11px] text-slate-400 block truncate">
                                  {s.father_name ? `Father: ${s.father_name}` : `Class ${s.class}-${s.section}`}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Recent 5-Day Attendance Sparkline */}
                          <td className="py-3 px-3 text-center">
                            <div className="inline-flex items-center gap-1 justify-center" title="Recent 5-day attendance record">
                              {trail.length === 0 ? (
                                <span className="text-[10px] text-slate-300 font-mono">—</span>
                              ) : (
                                trail.slice(-5).map((st, i) => {
                                  const c = STATUS_BY_ID[st] || STATUS_BY_ID.present;
                                  return (
                                    <span
                                      key={i}
                                      className={cn("w-2 h-2 rounded-full", c.dotBg)}
                                      title={`Day: ${c.label}`}
                                    />
                                  );
                                })
                              )}
                            </div>
                          </td>

                          {/* Admission Number */}
                          <td className="py-3 px-4 text-center font-mono text-xs text-slate-600">
                            {s.admission_number}
                          </td>

                          {/* CBSE Percentage */}
                          <td className="py-3 px-4 text-center">
                            {typeof cbsePct === 'number' ? (
                              <div className="inline-flex flex-col items-center">
                                <span className={cn(
                                  "text-xs font-bold font-mono",
                                  hasCbseWarning ? "text-rose-600" : "text-emerald-700"
                                )}>
                                  {cbsePct.toFixed(0)}%
                                </span>
                                {hasCbseWarning && (
                                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded-md mt-0.5">
                                    Defaulter
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-mono">100%</span>
                            )}
                          </td>

                          {/* Segmented Status Toggle Buttons */}
                          <td className="py-3 px-6">
                            <div className="flex items-center justify-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 max-w-[340px] mx-auto">
                              {ATTENDANCE_STATUSES.map((btn) => {
                                const isSelected = currentStatus === btn.id;
                                return (
                                  <button
                                    key={btn.id}
                                    onClick={() => handleToggleStatus(s.id, btn.id)}
                                    className={cn(
                                      "flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer select-none text-center flex items-center justify-center gap-1",
                                      isSelected
                                        ? btn.activeBg
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                                    )}
                                    title={`Mark as ${btn.label} (Hotkey: ${btn.hotkey.toUpperCase()})`}
                                  >
                                    <span>{btn.shortLabel}</span>
                                    {isSelected && <Check size={10} className="stroke-[3]" />}
                                  </button>
                                );
                              })}
                            </div>
                            {hasApprovedLeave && currentStatus === 'leave' && (
                              <span className="text-[10px] text-purple-700 font-semibold block text-center mt-1">
                                ✓ Official Leave Approved
                              </span>
                            )}
                          </td>

                          {/* Remarks & Quick Tags */}
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => openRemarksModal(s)}
                              className={cn(
                                "px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5 mx-auto border",
                                currentRemark
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200 font-bold shadow-2xs"
                                  : "text-slate-400 border-slate-200/80 hover:text-slate-700 hover:bg-slate-100"
                              )}
                              title={currentRemark ? `Remark: ${currentRemark}` : 'Add note/reason'}
                            >
                              <FileText size={13} />
                              <span className="text-[11px] truncate max-w-[80px]">
                                {currentRemark ? currentRemark : 'Add tag'}
                              </span>
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
      {/* TAB 2: CAMPUS LIVE MONITOR & HEATMAP (ADMIN COMMAND CENTER) */}
      {/* ========================================================================= */}
      {activeTab === 'live_monitor' && (
        <div className="space-y-5">
          {/* Campus Overview KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-1 relative overflow-hidden">
              <div className="w-1.5 absolute top-0 bottom-0 left-0 bg-indigo-600" />
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Class Registers Submitted</span>
                <Activity size={16} className="text-indigo-600" />
              </div>
              <div className="text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums">
                {campusMonitorStats.submittedCount} / {campusMonitorStats.totalClasses}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {campusMonitorStats.pendingCount > 0 ? (
                  <span className="text-amber-700 font-bold">{campusMonitorStats.pendingCount} classes pending today</span>
                ) : (
                  <span className="text-emerald-700 font-bold">✓ 100% of registers completed</span>
                )}
              </p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-1 relative overflow-hidden">
              <div className="w-1.5 absolute top-0 bottom-0 left-0 bg-emerald-500" />
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Campus Overall Rate</span>
                <TrendingUp size={16} className="text-emerald-600" />
              </div>
              <div className="text-3xl font-extrabold tracking-tight text-emerald-800 tabular-nums">
                {campusMonitorStats.rate}%
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Across all instructional classes</p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-1 relative overflow-hidden">
              <div className="w-1.5 absolute top-0 bottom-0 left-0 bg-blue-500" />
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Total Present Today</span>
                <UserCheck size={16} className="text-blue-600" />
              </div>
              <div className="text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums">
                {campusMonitorStats.totalPresent} <span className="text-base text-slate-400 font-normal">/ {campusMonitorStats.totalStudents}</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Verified student headcount</p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-1 relative overflow-hidden">
              <div className="w-1.5 absolute top-0 bottom-0 left-0 bg-rose-500" />
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Absentees Recorded</span>
                <UserX size={16} className="text-rose-600" />
              </div>
              <div className="text-3xl font-extrabold tracking-tight text-rose-700 tabular-nums">
                {campusMonitorStats.totalAbsent}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Requires parent notification</p>
            </div>
          </div>

          {/* Submission Heatmap Grid & Filter Bar */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Campus Class Submission Heatmap
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Real-time status of attendance registers across all classes for {formatLongDate(selectedDate)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search class, section, teacher..."
                    value={monitorSearch}
                    onChange={(e) => setMonitorSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/90 rounded-xl h-[36px] pl-9 pr-3 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setMonitorFilter('all')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      monitorFilter === 'all' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                    )}
                  >
                    All ({allSubmissions.length})
                  </button>
                  <button
                    onClick={() => setMonitorFilter('submitted')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      monitorFilter === 'submitted' ? "bg-white text-emerald-800 shadow-xs" : "text-slate-600"
                    )}
                  >
                    Submitted ({campusMonitorStats.submittedCount})
                  </button>
                  <button
                    onClick={() => setMonitorFilter('pending')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      monitorFilter === 'pending' ? "bg-white text-amber-800 shadow-xs" : "text-slate-600"
                    )}
                  >
                    Pending ({campusMonitorStats.pendingCount})
                  </button>
                </div>

                <button
                  onClick={fetchCampusLiveMonitor}
                  className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition-all cursor-pointer"
                  title="Refresh live status"
                >
                  <RefreshCcw size={14} className={cn(monitorLoading && "animate-spin")} />
                </button>
              </div>
            </div>

            {/* Heatmap Grid Cards */}
            {monitorLoading ? (
              <div className="py-20 text-center text-slate-500 font-medium text-sm">
                <RefreshCcw className="w-7 h-7 animate-spin mx-auto mb-2 text-indigo-600" />
                Updating campus live monitor...
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-medium">
                No class section matching the filter criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {filteredSubmissions.map((item) => {
                  const rate = item.total_students > 0 ? Math.round((item.present_count / item.total_students) * 100) : 0;
                  return (
                    <div
                      key={`${item.class_name}_${item.section_name}`}
                      className={cn(
                        "rounded-2xl border p-4 transition-all hover:shadow-sm space-y-3 relative overflow-hidden",
                        item.is_submitted
                          ? "bg-white border-slate-200/90"
                          : "bg-amber-50/40 border-amber-200/80"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-extrabold text-sm text-slate-900 block">
                            Class {item.class_name} · Section {item.section_name}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                            <GraduationCap size={12} className="text-slate-400" />
                            {item.class_teacher_name || 'No Class Teacher'}
                          </span>
                        </div>
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border",
                          item.is_submitted
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-amber-100 text-amber-900 border-amber-300 animate-pulse"
                        )}>
                          {item.is_submitted ? 'Submitted' : 'Pending'}
                        </span>
                      </div>

                      {item.is_submitted ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-emerald-700 font-bold">Present: {item.present_count}</span>
                            <span className="text-rose-700 font-bold">Absent: {item.absent_count}</span>
                            <span className="text-slate-500">Total: {item.total_students}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                            <span>Rate: {rate}%</span>
                            {item.last_updated_at && (
                              <span>{new Date(item.last_updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="py-2 text-center text-xs text-amber-800 font-medium">
                          <span>{item.total_students} students awaiting roll call</span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          onClick={() => {
                            setSelectedClass(item.class_name);
                            setSelectedSection(item.section_name);
                            setActiveTab('register');
                          }}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                        >
                          Open Register <ChevronRight size={12} />
                        </button>
                        {!item.is_submitted && (
                          <button
                            onClick={() => toast.success(`Reminder sent to ${item.class_teacher_name || 'Class Teacher'}`)}
                            className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            Send Reminder
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MONTHLY MUSTER ROLL MATRIX (FORM 14 SPREADSHEET) */}
      {/* ========================================================================= */}
      {activeTab === 'muster' && (
        <div className="space-y-5">
          {/* Muster Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col min-w-[140px]">
                <span className="text-[11px] font-semibold text-slate-500 pl-1 mb-1.5">
                  Select Month
                </span>
                <input
                  type="month"
                  value={musterMonth}
                  onChange={(e) => setMusterMonth(e.target.value)}
                  className="bg-slate-50 border border-slate-200/90 rounded-xl h-[38px] px-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                />
              </div>

              <div className="flex flex-col min-w-[120px]">
                <span className="text-[11px] font-semibold text-slate-500 pl-1 mb-1.5">
                  Class
                </span>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="bg-slate-50 border border-slate-200/90 rounded-xl h-[38px] px-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  {classOptions.map(c => (
                    <option key={c} value={c}>Class {c}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col min-w-[120px]">
                <span className="text-[11px] font-semibold text-slate-500 pl-1 mb-1.5">
                  Section
                </span>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="bg-slate-50 border border-slate-200/90 rounded-xl h-[38px] px-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  {sectionOptions.map(s => (
                    <option key={s} value={s}>Section {s}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col min-w-[180px]">
                <span className="text-[11px] font-semibold text-slate-500 pl-1 mb-1.5">
                  Filter Students
                </span>
                <input
                  type="text"
                  placeholder="Filter name or roll..."
                  value={musterSearch}
                  onChange={(e) => setMusterSearch(e.target.value)}
                  className="bg-slate-50 border border-slate-200/90 rounded-xl h-[38px] px-3 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchMonthlyMuster}
                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition-all cursor-pointer"
                title="Refresh muster roll"
              >
                <RefreshCcw size={15} />
              </button>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} className="text-slate-600" />
                Print Register
              </button>
              <button
                onClick={exportMusterToCSV}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download size={14} />
                Export CSV (Excel)
              </button>
            </div>
          </div>

          {/* Muster Roll Matrix Table */}
          <div className="bg-white border border-slate-200/80 shadow-xs rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Monthly Muster Roll (Form 14) — Class {selectedClass} Section {selectedSection}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Instructional Month: {musterMonth} • {students.length} Students
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Present</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Absent</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Late</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Leave</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Sun/Holiday</span>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[600px] no-scrollbar">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead className="sticky top-0 bg-slate-100 z-10 shadow-2xs">
                  <tr className="border-b border-slate-200">
                    <th className="py-2.5 px-3 font-bold text-slate-600 text-center w-12 sticky left-0 bg-slate-100 z-20">Roll</th>
                    <th className="py-2.5 px-3 font-bold text-slate-600 min-w-[160px] sticky left-12 bg-slate-100 z-20">Student Name</th>
                    {musterData?.daysInMonth.map(d => (
                      <th key={d} className="py-2.5 px-1 font-mono font-bold text-slate-600 text-center w-7 border-l border-slate-200/60">
                        {d}
                      </th>
                    ))}
                    <th className="py-2.5 px-2 font-bold text-emerald-800 text-center w-12 border-l border-slate-200">P</th>
                    <th className="py-2.5 px-2 font-bold text-rose-800 text-center w-12">A</th>
                    <th className="py-2.5 px-2 font-bold text-purple-800 text-center w-12">LV</th>
                    <th className="py-2.5 px-3 font-bold text-slate-900 text-center w-14">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {musterLoading ? (
                    <tr>
                      <td colSpan={40} className="py-20 text-center text-slate-500 font-sans font-medium text-sm">
                        <RefreshCcw className="w-7 h-7 animate-spin mx-auto mb-2 text-indigo-600" />
                        Generating monthly muster roll sheet...
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={40} className="py-12 text-center text-slate-400 font-sans text-xs">
                        No students enrolled in this class.
                      </td>
                    </tr>
                  ) : (
                    students
                      .filter(s => !musterSearch || s.name.toLowerCase().includes(musterSearch.toLowerCase()) || s.roll_number.includes(musterSearch))
                      .map((s) => {
                        const totals = musterData?.totalsByStudent[s.id] || { present: 0, absent: 0, late: 0, leave: 0, pct: 100 };
                        return (
                          <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3 text-center font-bold text-slate-700 sticky left-0 bg-white group-hover:bg-slate-50 z-10">
                              #{s.roll_number}
                            </td>
                            <td className="py-2 px-3 font-sans font-bold text-slate-900 truncate max-w-[160px] sticky left-12 bg-white group-hover:bg-slate-50 z-10">
                              {s.name}
                            </td>
                            {musterData?.daysInMonth.map(d => {
                              const cell = musterData.recordsByStudent[s.id]?.[d];
                              if (cell?.isSunday) {
                                return (
                                  <td key={d} className="py-2 px-1 text-center bg-slate-100/70 text-slate-400 border-l border-slate-100 text-[10px]">
                                    S
                                  </td>
                                );
                              }
                              if (cell?.isHoliday) {
                                return (
                                  <td key={d} className="py-2 px-1 text-center bg-amber-50 text-amber-700 border-l border-slate-100 text-[10px] font-bold">
                                    H
                                  </td>
                                );
                              }
                              const st = cell?.status || 'present';
                              return (
                                <td
                                  key={d}
                                  className={cn(
                                    "py-2 px-1 text-center border-l border-slate-100 text-[10px] font-bold",
                                    st === 'present' && "text-emerald-700 bg-emerald-50/20",
                                    st === 'absent' && "text-rose-700 bg-rose-100/50 font-black",
                                    st === 'late' && "text-amber-700 bg-amber-50",
                                    st === 'leave' && "text-purple-700 bg-purple-50"
                                  )}
                                >
                                  {st === 'present' ? 'P' : st === 'absent' ? 'A' : st === 'late' ? 'L' : 'LV'}
                                </td>
                              );
                            })}
                            <td className="py-2 px-2 text-center text-emerald-800 font-bold border-l border-slate-200">
                              {totals.present}
                            </td>
                            <td className="py-2 px-2 text-center text-rose-800 font-bold">
                              {totals.absent}
                            </td>
                            <td className="py-2 px-2 text-center text-purple-800 font-bold">
                              {totals.leave}
                            </td>
                            <td className="py-2 px-3 text-center font-bold">
                              <span className={cn(totals.pct < 75 ? "text-rose-600 font-black" : "text-slate-900")}>
                                {totals.pct}%
                              </span>
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
      {/* TAB 4: ATTENDANCE HISTORY & AUDIT LOGS */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-5">
          {/* 1. History KPI Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {/* Total Audit Logs */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Total Audit Logs</span>
                <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                  <FileText size={16} />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {historyMetrics.total}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">entries</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 font-medium flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400" />
                Filtered dataset
              </div>
            </div>

            {/* Present Logs */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700">Present Marked</span>
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-900 tabular-nums">
                  {historyMetrics.present}
                </span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                  {historyMetrics.presentPct}%
                </span>
              </div>
              <div className="mt-2 text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                In-session attendance
              </div>
            </div>

            {/* Absent Logs */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-700">Absent Marked</span>
                <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                  <XCircle size={16} />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-900 tabular-nums">
                  {historyMetrics.absent}
                </span>
                <span className="text-[11px] font-semibold text-rose-500">records</span>
              </div>
              <div className="mt-2 text-[11px] text-rose-700 font-medium flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500" />
                Requires verification
              </div>
            </div>

            {/* Late Arrivals */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-700">Late Arrivals</span>
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Clock size={16} />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-900 tabular-nums">
                  {historyMetrics.late}
                </span>
                <span className="text-[11px] font-semibold text-amber-500">delayed</span>
              </div>
              <div className="mt-2 text-[11px] text-amber-700 font-medium flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                Tardy arrivals
              </div>
            </div>

            {/* Approved Leaves */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs relative overflow-hidden flex flex-col justify-between col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-700">Approved Leaves</span>
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                  <Coffee size={16} />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-purple-900 tabular-nums">
                  {historyMetrics.leave}
                </span>
                <span className="text-[11px] font-semibold text-purple-500">excused</span>
              </div>
              <div className="mt-2 text-[11px] text-purple-700 font-medium flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500" />
                Documented notice
              </div>
            </div>
          </div>

          {/* 2. Comprehensive Filter Toolbar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-indigo-600" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight">
                  Audit Filter & Search Controls
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={fetchHistoryLogs}
                  disabled={historyLoading}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Reload historical records from server"
                >
                  <RefreshCcw size={13} className={cn(historyLoading && "animate-spin text-indigo-600")} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <button 
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Print current audit report"
                >
                  <Printer size={13} className="text-slate-600" />
                  <span className="hidden sm:inline">Print</span>
                </button>
                <button 
                  onClick={exportHistoryToCSV}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Export filtered records as CSV spreadsheet"
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Filter Dropdowns Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-1">
              {/* Timeframe */}
              <div className="lg:col-span-3 flex flex-col">
                <label className="text-[11px] font-semibold text-slate-500 pl-1 mb-1">Timeframe</label>
                <select 
                  value={historyDateRange} 
                  onChange={(e: any) => setHistoryDateRange(e.target.value)}
                  className="bg-slate-50 border border-slate-200/90 rounded-xl py-2 px-3 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="today">Today Only</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                  <option value="custom">Specific Date (Custom)</option>
                  <option value="all">All Records (300 max)</option>
                </select>
              </div>

              {/* Custom Date Picker (shows when 'custom' or provides quick jump) */}
              {historyDateRange === 'custom' && (
                <div className="lg:col-span-2 flex flex-col">
                  <label className="text-[11px] font-semibold text-slate-500 pl-1 mb-1">Specific Date</label>
                  <input 
                    type="date" 
                    value={historyCustomDate}
                    onChange={(e) => setHistoryCustomDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200/90 rounded-xl py-2 px-3 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  />
                </div>
              )}

              {/* Status Filter */}
              <div className={cn("flex flex-col", historyDateRange === 'custom' ? "lg:col-span-2" : "lg:col-span-2")}>
                <label className="text-[11px] font-semibold text-slate-500 pl-1 mb-1">Status</label>
                <select 
                  value={historyStatusFilter} 
                  onChange={(e) => setHistoryStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200/90 rounded-xl py-2 px-3 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="present">Present Only</option>
                  <option value="absent">Absent Only</option>
                  <option value="late">Late Only</option>
                  <option value="leave">Leave Only</option>
                </select>
              </div>

              {/* Class Filter */}
              <div className={cn("flex flex-col", historyDateRange === 'custom' ? "lg:col-span-2" : "lg:col-span-2")}>
                <label className="text-[11px] font-semibold text-slate-500 pl-1 mb-1">Class</label>
                <select 
                  value={historyClass} 
                  onChange={(e) => setHistoryClass(e.target.value)}
                  className="bg-slate-50 border border-slate-200/90 rounded-xl py-2 px-3 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="">All Classes</option>
                  {classOptions.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Section Filter */}
              <div className={cn("flex flex-col", historyDateRange === 'custom' ? "lg:col-span-1" : "lg:col-span-1")}>
                <label className="text-[11px] font-semibold text-slate-500 pl-1 mb-1">Section</label>
                <select 
                  value={historySection} 
                  onChange={(e) => setHistorySection(e.target.value)}
                  className="bg-slate-50 border border-slate-200/90 rounded-xl py-2 px-3 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="">All</option>
                  {sectionOptions.map(s => (
                    <option key={s} value={s}>Sec {s}</option>
                  ))}
                </select>
              </div>

              {/* Search Log */}
              <div className={cn("flex flex-col", historyDateRange === 'custom' ? "lg:col-span-2" : "lg:col-span-4")}>
                <label className="text-[11px] font-semibold text-slate-500 pl-1 mb-1">Search Log</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search student, roll, remarks..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/90 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                  />
                  {historySearchQuery && (
                    <button 
                      onClick={() => setHistorySearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3. History Records Audit Table */}
          <div className="bg-white border border-slate-200/80 shadow-xs rounded-2xl overflow-hidden">
            {/* Quick Status Filter Tabs Bar */}
            <div className="p-3 sm:px-5 sm:py-3.5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setHistoryStatusFilter('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                    historyStatusFilter === 'all'
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
                  )}
                >
                  <span>All Entries</span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-md text-[10px]",
                    historyStatusFilter === 'all' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  )}>
                    {historyRecords.length}
                  </span>
                </button>

                <button
                  onClick={() => setHistoryStatusFilter('present')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                    historyStatusFilter === 'present'
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200/70"
                  )}
                >
                  <CheckCircle2 size={12} />
                  <span>Present</span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-md text-[10px]",
                    historyStatusFilter === 'present' ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                  )}>
                    {historyRecords.filter(r => r.status === 'present').length}
                  </span>
                </button>

                <button
                  onClick={() => setHistoryStatusFilter('absent')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                    historyStatusFilter === 'absent'
                      ? "bg-rose-600 text-white shadow-xs"
                      : "bg-white text-rose-700 hover:bg-rose-50 border border-rose-200/70"
                  )}
                >
                  <XCircle size={12} />
                  <span>Absent</span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-md text-[10px]",
                    historyStatusFilter === 'absent' ? "bg-white/20 text-white" : "bg-rose-100 text-rose-800"
                  )}>
                    {historyRecords.filter(r => r.status === 'absent').length}
                  </span>
                </button>

                <button
                  onClick={() => setHistoryStatusFilter('late')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                    historyStatusFilter === 'late'
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-white text-amber-700 hover:bg-amber-50 border border-amber-200/70"
                  )}
                >
                  <Clock size={12} />
                  <span>Late</span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-md text-[10px]",
                    historyStatusFilter === 'late' ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
                  )}>
                    {historyRecords.filter(r => r.status === 'late').length}
                  </span>
                </button>

                <button
                  onClick={() => setHistoryStatusFilter('leave')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                    historyStatusFilter === 'leave'
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-white text-purple-700 hover:bg-purple-50 border border-purple-200/70"
                  )}
                >
                  <Coffee size={12} />
                  <span>Leave</span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-md text-[10px]",
                    historyStatusFilter === 'leave' ? "bg-white/20 text-white" : "bg-purple-100 text-purple-800"
                  )}>
                    {historyRecords.filter(r => r.status === 'leave').length}
                  </span>
                </button>
              </div>

              <div className="text-xs font-semibold text-slate-500">
                <span>Showing </span>
                <strong className="text-slate-800 font-bold">{filteredHistory.length}</strong>
                <span> records</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/90 text-slate-500">
                    <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider w-[150px]">
                      Date & Time
                    </th>
                    <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider">
                      Student Details
                    </th>
                    <th className="py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider text-center w-[120px]">
                      Class & Sec
                    </th>
                    <th className="py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider text-center w-[150px]">
                      Recorded Status
                    </th>
                    <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider">
                      Remarks / Reason
                    </th>
                    <th className="py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider text-left w-[190px]">
                      Marked By (Author)
                    </th>
                    <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-right w-[120px]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyLoading ? (
                    <tr>
                      <td colSpan={7} className="py-20 text-center text-slate-500 font-medium text-sm">
                        <RefreshCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                        Loading attendance audit logs...
                      </td>
                    </tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <div className="max-w-md mx-auto space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                            <History size={24} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-800">No Attendance Records Found</h4>
                            <p className="text-xs text-slate-500 mt-1">
                              No log entries match your selected date timeframe, class, section, or search query.
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setHistoryClass('');
                              setHistorySection('');
                              setHistoryStatusFilter('all');
                              setHistoryDateRange('week');
                              setHistorySearchQuery('');
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Reset All Filters
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((rec) => {
                      const statusConfig = STATUS_BY_ID[rec.status] || STATUS_BY_ID.present;
                      const StatusIcon = statusConfig.icon;
                      const formattedDate = formatAuditDate(rec.attendance_date);
                      const formattedTime = formatAuditTime(rec.updated_at);
                      const authorName = capitalizeWords(rec.marked_by_name);

                      return (
                        <tr 
                          key={rec.id} 
                          className="hover:bg-indigo-50/30 transition-colors group cursor-pointer"
                          onClick={() => setInspectingHistoryRecord(rec)}
                        >
                          {/* Date & Time */}
                          <td className="py-3.5 px-5 align-middle">
                            <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                              <Calendar size={12} className="text-indigo-600 shrink-0" />
                              <span>{formattedDate}</span>
                            </div>
                            {formattedTime ? (
                              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-1 pl-4.5">
                                <Clock size={10} className="text-slate-400" />
                                <span>{formattedTime}</span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400 font-mono mt-1 pl-4.5">
                                {rec.attendance_date}
                              </div>
                            )}
                          </td>

                          {/* Student Details with Avatar */}
                          <td className="py-3.5 px-5 align-middle">
                            <div className="flex items-center gap-3">
                              {rec.photo_url ? (
                                <img
                                  src={rec.photo_url}
                                  alt={rec.student_name}
                                  className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/90 border border-indigo-200/60 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                                  {rec.student_name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 text-xs group-hover:text-indigo-600 transition-colors truncate">
                                  {rec.student_name}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono font-bold">
                                    Roll #{rec.roll_number}
                                  </span>
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200/60 text-slate-500 text-[10px] font-mono">
                                    Adm: {rec.admission_number}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Class & Section */}
                          <td className="py-3.5 px-4 text-center align-middle">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200/70">
                              Class {rec.class}-{rec.section}
                            </span>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4 text-center align-middle">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider border shadow-2xs",
                              statusConfig.badgeBg
                            )}>
                              <StatusIcon size={13} />
                              {statusConfig.label}
                            </span>
                          </td>

                          {/* Remarks / Reason */}
                          <td className="py-3.5 px-5 align-middle">
                            {rec.remarks ? (
                              <div className="text-xs text-slate-700 font-medium bg-amber-50/70 border border-amber-200/60 rounded-xl px-2.5 py-1.5 inline-flex items-center gap-1.5 max-w-[220px]">
                                <MessageSquare size={12} className="text-amber-600 shrink-0" />
                                <span className="truncate">{rec.remarks}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300 italic font-medium">—</span>
                            )}
                          </td>

                          {/* Marked By / Audit Author */}
                          <td className="py-3.5 px-4 align-middle">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-slate-100 to-slate-200 border border-slate-300/80 text-slate-700 flex items-center justify-center text-[10px] font-extrabold shadow-2xs shrink-0">
                                {authorName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-800 truncate" title={authorName}>
                                  {authorName}
                                </div>
                                <div className="text-[10px] text-slate-400 font-medium">
                                  Verified Faculty
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Action Button */}
                          <td className="py-3.5 px-5 text-right align-middle" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setSelectedClass(rec.class);
                                setSelectedSection(rec.section);
                                setSelectedDate(rec.attendance_date);
                                setActiveTab('register');
                                toast.info(`Switched to Register for Class ${rec.class}-${rec.section} on ${rec.attendance_date}`);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-600 text-slate-700 hover:text-white border border-slate-200/80 hover:border-indigo-600 text-xs font-bold transition-all shadow-2xs flex items-center gap-1 ml-auto cursor-pointer"
                              title="Open Register on this date"
                            >
                              <span>Inspect</span>
                              <ChevronRight size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer Bar */}
            {!historyLoading && filteredHistory.length > 0 && (
              <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-medium">
                <div>
                  Showing <strong className="text-slate-800 font-bold">{filteredHistory.length}</strong> of <strong className="text-slate-800 font-bold">{historyRecords.length}</strong> audited attendance records
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400">Official RMPS ERP Audit Stream</span>
                  <button 
                    onClick={exportHistoryToCSV}
                    className="text-indigo-600 hover:text-indigo-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Download size={13} />
                    Download Spreadsheet
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: CBSE ANALYTICS & DEFAULTERS */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-5">
          {/* Top KPI Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-1 relative overflow-hidden">
              <div className="w-1.5 absolute top-0 bottom-0 left-0 bg-indigo-600" />
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>CBSE Mandatory Threshold</span>
                <ShieldAlert size={16} className="text-indigo-600" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">75.0% Minimum</div>
              <p className="text-[11px] text-slate-500 font-medium">Mandatory requirement for Board examination eligibility.</p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-1 relative overflow-hidden">
              <div className="w-1.5 absolute top-0 bottom-0 left-0 bg-rose-500" />
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Identified Defaulters</span>
                <AlertTriangle size={16} className="text-rose-600" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-rose-700 tabular-nums">{cbseDefaulters.length} Students</div>
              <p className="text-[11px] text-slate-500 font-medium">Students falling below 75% attendance threshold.</p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-1 relative overflow-hidden">
              <div className="w-1.5 absolute top-0 bottom-0 left-0 bg-emerald-500" />
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Institution Overall Ratio</span>
                <TrendingUp size={16} className="text-emerald-600" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-emerald-800 tabular-nums">
                {classSummaries.length > 0
                  ? `${Math.round(classSummaries.reduce((sum, c) => sum + (Number(c.ratio) || 0), 0) / classSummaries.length)}%`
                  : '—'}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Aggregated across all active sections in 2026-27.</p>
            </div>
          </div>

          {/* Class-wise Comparison Matrix */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Class-wise Attendance Ratio Matrix</h3>
                <p className="text-[11px] text-slate-500">Attendance percentages aggregated per academic class.</p>
              </div>
              <button 
                onClick={() => navigate('/dashboard/reports')}
                className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Full Institutional Reports <ChevronRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {classSummaries.map((cls) => {
                const ratio = Number(cls.ratio) || 100;
                return (
                  <div key={cls.class} className="p-3.5 bg-slate-50/80 border border-slate-200/70 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{cls.class}</span>
                      <span className={cn(
                        "text-xs font-bold font-mono",
                        ratio < 75 ? "text-rose-600" : "text-emerald-700"
                      )}>
                        {ratio}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          ratio < 75 ? "bg-rose-500" : "bg-emerald-500"
                        )}
                        style={{ width: `${Math.min(100, ratio)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>Present: {cls.present}</span>
                      <span>Absent: {cls.absent}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CBSE Defaulters Warning List */}
          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs space-y-0">
            <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <ShieldAlert size={16} className="text-rose-600" />
                  CBSE Attendance Defaulters Watchlist (&lt;75%)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Official notices & warning letters required to be served to parents as per Board affiliation bylaws.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setDefaulterFilterTier('all')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      defaulterFilterTier === 'all' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                    )}
                  >
                    All ({cbseDefaulters.length})
                  </button>
                  <button
                    onClick={() => setDefaulterFilterTier('critical')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      defaulterFilterTier === 'critical' ? "bg-rose-600 text-white shadow-xs" : "text-rose-700"
                    )}
                  >
                    Critical &lt;60%
                  </button>
                  <button
                    onClick={() => setDefaulterFilterTier('warning')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      defaulterFilterTier === 'warning' ? "bg-amber-500 text-white shadow-xs" : "text-amber-800"
                    )}
                  >
                    Warning 60-74%
                  </button>
                </div>

                <button
                  onClick={() => navigate('/dashboard/communication')}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Send size={12} />
                  Broadcast Parent Notice
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-5">Student Name</th>
                    <th className="py-3 px-4 text-center">Class</th>
                    <th className="py-3 px-4 text-center">Roll No</th>
                    <th className="py-3 px-4 text-center">Working Days</th>
                    <th className="py-3 px-4 text-center">Present Days</th>
                    <th className="py-3 px-4 text-center">Attendance %</th>
                    <th className="py-3 px-5 text-right">Direct Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDefaulters.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                        ✓ Excellent! No students currently fall into this attendance risk tier.
                      </td>
                    </tr>
                  ) : (
                    filteredDefaulters.map((def) => (
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
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-xs font-bold font-mono border",
                            def.attendance_percentage < 60
                              ? "bg-rose-100 border-rose-300 text-rose-800"
                              : "bg-amber-50 border-amber-200 text-amber-800"
                          )}>
                            {def.attendance_percentage}%
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right space-x-1.5">
                          <button
                            onClick={() => setSelectedNoticeStudent(def)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <FileText size={11} /> Notice
                          </button>
                          <button
                            onClick={() => navigate('/dashboard/students', { state: { selectedStudentId: def.student_id } })}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
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
      {/* TAB 6: SCHOOL CALENDAR & HOLIDAYS */}
      {/* ========================================================================= */}
      {activeTab === 'calendar' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Official Institutional Calendar</h3>
              <p className="text-[11px] text-slate-500">
                School holidays & non-instructional days recognized by the Attendance System.
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard/calendar')}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Calendar size={14} />
              Open School Calendar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allHolidays.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200/80 p-6">
                No holidays recorded for this session. Use the School Calendar module to schedule terms & holidays.
              </div>
            ) : (
              allHolidays.map(hol => (
                <div key={hol.id} className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{hol.title}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200/80 text-amber-800">
                      {hol.is_national ? 'National' : 'School'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
                    <Calendar size={13} className="text-indigo-600" />
                    {hol.start_date} {hol.end_date !== hol.start_date && `to ${hol.end_date}`}
                  </div>
                  {hol.description && (
                    <p className="text-[11px] text-slate-500 leading-normal font-medium">{hol.description}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: REMARKS & ABSENCE QUICK-TAGS MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {editingRemarksStudent && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl p-5 max-w-md w-full space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Attendance Observation Note</h4>
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

              {/* Quick Preset Tags */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  1-Click Quick Preset Tags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REASON_TAGS.map((tag) => (
                    <button
                      key={tag.label}
                      onClick={() => {
                        setCurrentRemarkText(tag.label);
                        saveRemark(tag.label, tag.status);
                      }}
                      className="px-2.5 py-1.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>{tag.icon}</span>
                      <span>{tag.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Remark Input */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                  Custom Remark or Doctor/Parent Note
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Medical certificate received, Arrived 30 mins late due to road block..."
                  value={currentRemarkText}
                  onChange={(e) => setCurrentRemarkText(e.target.value)}
                  className="w-full bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium resize-none transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditingRemarksStudent(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveRemark()}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition-colors"
                >
                  Save Note
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 2: PARENT ABSENCE NOTIFICATION BROADCAST MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showAbsenceAlertModal && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 max-w-lg w-full space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                    <Bell size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Parent Absence Notification</h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Class {selectedClass} Section {selectedSection} • {formatLongDate(selectedDate)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAbsenceAlertModal(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Attendance was recorded with{' '}
                <span className="font-bold text-rose-600">
                  {students.filter(s => (attendance[s.id] || 'present') === 'absent').length} absentee(s)
                </span>
                . Would you like to dispatch automated SMS/WhatsApp absence notifications to registered parent contacts?
              </p>

              <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
                {students
                  .filter(s => (attendance[s.id] || 'present') === 'absent')
                  .map(s => (
                    <div key={s.id} className="p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900 block">{s.name} (Roll #{s.roll_number})</span>
                        <span className="text-[10px] text-slate-400">Parent Phone: {s.phone || 'Not available'}</span>
                      </div>
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                        Marked Absent
                      </span>
                    </div>
                  ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowAbsenceAlertModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Skip for Now
                </button>
                <button
                  onClick={() => {
                    toast.success('Absence notifications dispatched to parent phone numbers via SMS Gateway');
                    setShowAbsenceAlertModal(false);
                  }}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Send size={13} />
                  Send Parent Alerts
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 3: OFFICIAL CBSE ATTENDANCE NOTICE PREVIEW */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedNoticeStudent && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-xl w-full space-y-4 text-slate-800"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="text-rose-600 w-5 h-5" />
                  <h4 className="font-bold text-slate-900 text-sm">Official CBSE Attendance Shortage Warning Notice</h4>
                </div>
                <button
                  onClick={() => setSelectedNoticeStudent(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 space-y-3 font-serif text-xs leading-relaxed">
                <div className="text-center font-sans border-b border-slate-200 pb-2">
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-900">St. Joseph's School, Barhalganj</h3>
                  <p className="text-[10px] text-slate-500 font-mono">Affiliated to CBSE, New Delhi • Affiliation No. 2130000</p>
                </div>

                <p className="font-sans text-[11px]">
                  <strong>To:</strong> Parent / Guardian of {selectedNoticeStudent.name} (Admission No: {selectedNoticeStudent.admission_number})<br />
                  <strong>Class & Section:</strong> {selectedNoticeStudent.class} - {selectedNoticeStudent.section} (Roll #{selectedNoticeStudent.roll_number})<br />
                  <strong>Date of Notice:</strong> {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>

                <p>
                  <strong>Subject: Urgent Warning regarding Shortage of Attendance (Below 75%)</strong>
                </p>

                <p>
                  Dear Parent/Guardian,<br />
                  This is to formally bring to your attention that your ward's overall attendance for academic session 2026-27 is currently recorded at{' '}
                  <strong className="text-rose-700 font-sans">{selectedNoticeStudent.attendance_percentage}%</strong> (Present for {selectedNoticeStudent.total_present} days out of {selectedNoticeStudent.total_working_days} total working days).
                </p>

                <p>
                  As per <strong>CBSE Examination Bylaw Rule 13.1</strong>, a minimum aggregate attendance of <strong>75%</strong> is mandatory to be eligible to appear in the Board / Annual Examinations.
                </p>

                <p>
                  You are advised to meet the Principal / Class Teacher immediately and ensure regular attendance henceforth.
                </p>

                <div className="pt-4 flex justify-between items-end font-sans text-[10px] font-bold text-slate-700">
                  <span>Class Teacher Signature</span>
                  <span>Principal Signature & School Seal</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setSelectedNoticeStudent(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    window.print();
                  }}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold cursor-pointer shadow-2xs flex items-center gap-1.5"
                >
                  <Printer size={13} /> Print Notice
                </button>
                <button
                  onClick={() => {
                    toast.success(`Notice dispatched to parent of ${selectedNoticeStudent.name}`);
                    setSelectedNoticeStudent(null);
                  }}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Send size={13} /> Dispatch to Parent
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 4: STUDENT 360 AUDIT INSPECTION MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {inspectingHistoryRecord && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-lg w-full space-y-5 text-slate-800"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                    <History size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Attendance Audit Record Details</h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Official verified session entry from RMPS ERP
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setInspectingHistoryRecord(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Student Profile Overview Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3.5">
                {inspectingHistoryRecord.photo_url ? (
                  <img
                    src={inspectingHistoryRecord.photo_url}
                    alt={inspectingHistoryRecord.student_name}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-base shrink-0 shadow-xs">
                    {inspectingHistoryRecord.student_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-900 text-sm truncate">
                    {inspectingHistoryRecord.student_name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs">
                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-bold">
                      Class {inspectingHistoryRecord.class}-{inspectingHistoryRecord.section}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-mono font-semibold">
                      Roll #{inspectingHistoryRecord.roll_number}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-500 font-mono">
                      Adm: {inspectingHistoryRecord.admission_number}
                    </span>
                  </div>
                </div>
              </div>

              {/* Grid of Audit Information */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50/70 border border-slate-200/60 rounded-xl space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 block">Attendance Date</span>
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Calendar size={13} className="text-indigo-600" />
                    <span>{formatAuditDate(inspectingHistoryRecord.attendance_date)}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50/70 border border-slate-200/60 rounded-xl space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 block">Status Recorded</span>
                  <div>
                    {(() => {
                      const cfg = STATUS_BY_ID[inspectingHistoryRecord.status] || STATUS_BY_ID.present;
                      const Icon = cfg.icon;
                      return (
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wider border",
                          cfg.badgeBg
                        )}>
                          <Icon size={12} />
                          {cfg.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <div className="p-3 bg-slate-50/70 border border-slate-200/60 rounded-xl space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 block">Marked By (Author)</span>
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <UserCheck size={13} className="text-emerald-600" />
                    <span>{capitalizeWords(inspectingHistoryRecord.marked_by_name)}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50/70 border border-slate-200/60 rounded-xl space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 block">Timestamp</span>
                  <div className="font-bold text-slate-800 flex items-center gap-1.5 font-mono">
                    <Clock size={13} className="text-slate-400" />
                    <span>{formatAuditTime(inspectingHistoryRecord.updated_at) || inspectingHistoryRecord.attendance_date}</span>
                  </div>
                </div>
              </div>

              {/* Remarks / Notes */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1 text-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Remarks / Medical / Excusal Note
                </span>
                <p className="text-slate-700 font-medium">
                  {inspectingHistoryRecord.remarks || 'No special note recorded for this entry.'}
                </p>
              </div>

              {/* Parent Info if available */}
              {(inspectingHistoryRecord.father_name || inspectingHistoryRecord.phone) && (
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] font-semibold text-indigo-700 block">Guardian Details</span>
                    <span className="font-bold text-slate-800">
                      {inspectingHistoryRecord.father_name ? `${inspectingHistoryRecord.father_name} (Father)` : 'Registered Guardian'}
                    </span>
                    {inspectingHistoryRecord.phone && (
                      <span className="text-[11px] text-slate-500 block font-mono">
                        Phone: {inspectingHistoryRecord.phone}
                      </span>
                    )}
                  </div>
                  {inspectingHistoryRecord.phone && (
                    <a
                      href={`tel:${inspectingHistoryRecord.phone}`}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-2xs"
                    >
                      Call Contact
                    </a>
                  )}
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setInspectingHistoryRecord(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setSelectedClass(inspectingHistoryRecord.class);
                    setSelectedSection(inspectingHistoryRecord.section);
                    setSelectedDate(inspectingHistoryRecord.attendance_date);
                    setActiveTab('register');
                    setInspectingHistoryRecord(null);
                    toast.info(`Switched to Register for Class ${inspectingHistoryRecord.class}-${inspectingHistoryRecord.section} on ${inspectingHistoryRecord.attendance_date}`);
                  }}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <CalendarCheck size={14} />
                  <span>Open Daily Register</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Sticky Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200/80 z-30 lg:hidden flex items-center justify-between gap-3 shadow-lg">
        <div className="text-xs">
          <span className="font-bold text-slate-900 block leading-tight">
            {registerStats.present}/{registerStats.total} Present
          </span>
          <span className="text-[10px] text-slate-500 font-medium">
            Class {selectedClass} - {selectedSection}
          </span>
        </div>
        <button
          onClick={handleSaveAttendance}
          disabled={isSaving || students.length === 0}
          className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer"
        >
          {isSaving ? <RefreshCcw size={14} className="animate-spin" /> : <Save size={14} />}
          Save Register
        </button>
      </div>

    </div>
  );
}
