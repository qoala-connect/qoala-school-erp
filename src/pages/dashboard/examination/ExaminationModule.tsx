import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Search, 
  Plus, 
  Save, 
  RefreshCw, 
  Calendar, 
  ClipboardList, 
  BarChart3, 
  IdCard, 
  Award, 
  Settings, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  BookOpen, 
  Trash2, 
  Edit2, 
  X, 
  ChevronRight, 
  GraduationCap,
  Sparkles,
  Layers,
  ArrowRight,
  Loader2,
  Users,
  Send,
  ShieldCheck,
  Clock,
  UserCheck,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

// Child view components
import DashboardView from '@/components/results/DashboardView';
import ExamsView from '@/components/results/ExamsView';
import DatesheetsView from '@/components/results/DatesheetsView';
import AdmitCardsView from '@/components/results/AdmitCardsView';
import SeatingPlanView from '@/components/results/SeatingPlanView';
import InvigilationView from '@/components/results/InvigilationView';
import ExamAttendanceView from '@/components/results/ExamAttendanceView';
import ResultsView from '@/components/results/ResultsView';
import MarksVerificationView from '@/components/results/MarksVerificationView';
import ResultProcessingView from '@/components/results/ResultProcessingView';
import StudentReportsView from '@/components/results/StudentReportsView';
import ResultPublishingView from '@/components/results/ResultPublishingView';
import AnalyticsView from '@/components/results/AnalyticsView';
import ConfigView from '@/components/results/ConfigView';
import TeacherTasksView from '@/components/results/TeacherTasksView';
import AdminHeader from '@/components/common/AdminHeader';
import AdminStatCard from '@/components/common/AdminStatCard';
import { fetchClassSubjects } from '@/services/academicsService';

import { 
  isSameClass, 
  formatClassDisplay, 
  normalizeClassName,
  TeacherExamTask,
  MarksWorkflowStatus,
  EXAM_WORKFLOW_PIPELINE
} from '@/lib/cbseExamUtils';
import { examinationService, ExamRecord, AssessmentType } from '@/services/examinationService';

interface ExaminationModuleProps {
  view?: string;
}

export default function ExaminationModule({ view: propView }: ExaminationModuleProps) {
  const { user, role, can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Canonical tab mapping supporting all 14 CBSE examination sub-modules
  const currentTab = useMemo(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) return tabParam;
    
    const path = location.pathname.toLowerCase();
    if (path.includes('dashboard')) return 'dashboard';
    if (path.includes('seating-plan') || path.includes('hall-allocation')) return 'seating-plan';
    if (path.includes('invigilation') || path.includes('invigilator-assignment')) return 'invigilation';
    if (path.includes('exam-attendance') || path.includes('attendance')) return 'exam-attendance';
    if (path.includes('marks-verification')) return 'marks-verification';
    if (path.includes('result-publishing') || path.includes('result-publication')) return 'result-publishing';
    if (path.includes('result-processing') || path.includes('merit-list') || path.includes('rank-list')) return 'result-processing';
    if (path.includes('report-cards') || path.includes('certificates') || path.includes('reports')) return 'report-cards';
    if (path.includes('admit-cards') || path.includes('hall-tickets')) return 'admit-cards';
    if (path.includes('schedule') || path.includes('datesheet')) return 'schedule';
    if (path.includes('marks-entry') || path.includes('grace-marks')) return 'marks-entry';
    if (path.includes('analytics')) return 'analytics';
    if (path.includes('settings') || path.includes('grade-rules') || path.includes('exam-types')) return 'settings';
    if (path.includes('tasks') || path.includes('teacher')) return 'tasks';
    if (path.includes('exams') || path.includes('subject-mapping')) return 'exams';
    
    if (propView) {
      if (propView === 'dashboard') return 'dashboard';
      if (['seating-plan', 'hall-allocation'].includes(propView)) return 'seating-plan';
      if (['invigilation', 'invigilator-assignment'].includes(propView)) return 'invigilation';
      if (['exam-attendance', 'attendance'].includes(propView)) return 'exam-attendance';
      if (['marks-verification'].includes(propView)) return 'marks-verification';
      if (['result-publishing', 'result-publication'].includes(propView)) return 'result-publishing';
      if (['result-processing', 'merit-list', 'rank-list'].includes(propView)) return 'result-processing';
      if (['report-cards', 'certificates', 'reports'].includes(propView)) return 'report-cards';
      if (['admit-cards', 'hall-tickets'].includes(propView)) return 'admit-cards';
      if (['schedule', 'datesheet'].includes(propView)) return 'schedule';
      if (['marks-entry', 'grace-marks'].includes(propView)) return 'marks-entry';
      if (['analytics'].includes(propView)) return 'analytics';
      if (['settings', 'grade-rules', 'exam-types'].includes(propView)) return 'settings';
      if (['tasks', 'teacher'].includes(propView)) return 'tasks';
      if (['exams', 'subject-mapping'].includes(propView)) return 'exams';
    }

    return 'dashboard';
  }, [searchParams, location.pathname, propView]);

  const requiredTabPermission = (
    currentTab === 'exams' || 
    currentTab === 'marks-verification' || 
    currentTab === 'result-processing' || 
    currentTab === 'result-publishing' || 
    currentTab === 'settings'
  )
    ? 'results.publish'
    : 'results.view';
  const canViewTab = can(requiredTabPermission);

  useEffect(() => {
    if (role === 'student' || role === 'parent') {
      navigate('/dashboard/portal?tab=examination', { replace: true });
      return;
    }
    if (!canViewTab) {
      navigate('/unauthorized', { replace: true });
    }
  }, [role, canViewTab, navigate]);

  const setTab = (tabName: string, extraParams: Record<string, string> = {}) => {
    setSearchParams({ tab: tabName, ...extraParams });
  };

  // Auto-scroll active workspace tab into center view on mount and tab change
  useEffect(() => {
    const timer = setTimeout(() => {
      const activeTabId = currentTab === 'overview' ? 'dashboard' : currentTab;
      const el = document.getElementById(`exam-tab-${activeTabId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [currentTab]);

  // Sub-modes within tabs
  const [reportSubMode, setReportSubMode] = useState<'final' | 'coscholastic'>('final');
  const [scheduleSubMode, setScheduleSubMode] = useState<'datesheet' | 'admitCard'>(() => {
    if (!can('results.publish')) return 'admitCard';
    if (location.pathname.includes('admit-cards') || propView === 'admit-cards' || searchParams.get('sub') === 'admitCard') {
      return 'admitCard';
    }
    return 'datesheet';
  });

  // Core Data States
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [examSubjects, setExamSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [teacherTasks, setTeacherTasks] = useState<any[]>([]);
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>([]);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Active marks filter state & incoming selection from Global Search or Task click
  const [marksTargetExamId, setMarksTargetExamId] = useState<string>(() => location.state?.selectedExamId || '');
  const [marksTargetSubjectId, setMarksTargetSubjectId] = useState<string>('');
  const [marksTargetClassId, setMarksTargetClassId] = useState<string>('');

  // Exam CRUD Modal state
  const [showExamModal, setShowExamModal] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [isSavingExam, setIsSavingExam] = useState(false);
  const [examFormData, setExamFormData] = useState({
    exam_name: '',
    short_name: '',
    exam_type: 'Periodic Assessment 1',
    class_ids: [] as string[],
    academic_year: '2026-27',
    academic_year_id: '',
    description: '',
    start_date: '',
    end_date: '',
    marks_entry_start_date: '',
    marks_entry_deadline: '',
    result_publish_date: '',
    instructions: ''
  });

  const handleOpenCreateExamModal = useCallback(() => {
    setEditingExamId(null);
    const currentYear = academicYears.find(y => y.is_current) || academicYears[0] || { id: '2026-27', name: '2026-27' };
    const defaultType = assessmentTypes[0] || { code: 'PA-1', name: 'Periodic Assessment 1' };
    const initialClasses = classes.length > 0 ? [classes[0].id] : [];
    
    setExamFormData({
      exam_name: defaultType.name,
      short_name: defaultType.code,
      exam_type: defaultType.name,
      class_ids: initialClasses,
      academic_year: currentYear.name,
      academic_year_id: currentYear.id,
      description: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      marks_entry_start_date: new Date().toISOString().split('T')[0],
      marks_entry_deadline: '',
      result_publish_date: '',
      instructions: ''
    });
    setShowExamModal(true);
  }, [academicYears, assessmentTypes, classes]);

  // Subject Mapping & Teacher Assignment Modal state
  const [showSubjectMappingModal, setShowSubjectMappingModal] = useState(false);
  const [isSavingMapping, setIsSavingMapping] = useState(false);
  const [targetExamForMapping, setTargetExamForMapping] = useState<any | null>(null);
  const [mappedSubjectList, setMappedSubjectList] = useState<Array<{ 
    id?: string;
    subject_id: string; 
    subject_name: string; 
    max_marks: number; 
    pass_marks: number;
    teacher_id?: string;
    teacher_name?: string;
    component_name?: string;
  }>>([]);

  // Fetch baseline foundational data
  const fetchBaselineData = useCallback(async () => {
    setIsLoading(true);
    try {
      const results = await Promise.allSettled([
        examinationService.getAcademicYears(),
        examinationService.getExamTypes(),
        examinationService.getExams(),
        supabase.from('subjects').select('*').order('subject_name'),
        supabase.from('students').select('*').eq('status', 'active').order('name'),
        supabase.from('classes').select('*').order('display_order'),
        supabase.from('teachers').select('id, name, employee_id, designation, department, status, user_id, email'),
        supabase.from('exam_subjects').select('*')
      ]);

      const loadedYears = results[0].status === 'fulfilled' ? results[0].value : [];
      const loadedTypes = results[1].status === 'fulfilled' ? results[1].value : [];
      const loadedExams = results[2].status === 'fulfilled' ? results[2].value : [];
      const subjectsRes = results[3].status === 'fulfilled' ? results[3].value : { data: [] };
      const studentsRes = results[4].status === 'fulfilled' ? results[4].value : { data: [] };
      const classesRes = results[5].status === 'fulfilled' ? results[5].value : { data: [] };
      const teachersRes = results[6].status === 'fulfilled' ? results[6].value : { data: [] };
      const esRes = results[7].status === 'fulfilled' ? results[7].value : { data: [] };

      // Fallback CBSE Assessment Types if table is empty or loading
      const finalTypes = loadedTypes.length > 0 ? loadedTypes : [
        { id: 'pa1', code: 'PA-1', name: 'Periodic Assessment 1', is_active: true },
        { id: 'hye', code: 'HYE', name: 'Mid-Term / Half-Yearly Exam', is_active: true },
        { id: 'pa2', code: 'PA-2', name: 'Periodic Assessment 2', is_active: true },
        { id: 'pa3', code: 'PA-3', name: 'Periodic Assessment 3', is_active: true },
        { id: 'pre_annual', code: 'PRE_ANNUAL', name: 'Pre-Annual Examination', is_active: true },
        { id: 'annual', code: 'ANNUAL', name: 'Annual Examination', is_active: true },
        { id: 'pre_board', code: 'PRE_BOARD', name: 'Pre-Board Examination', is_active: true },
        { id: 'cbse_board', code: 'CBSE_BOARD', name: 'CBSE Board Examination', is_active: true }
      ];

      // Fallback Academic Years if table is empty
      const finalYears = loadedYears.length > 0 ? loadedYears : [
        { id: '22222222-2222-2222-2222-222222222222', name: '2026-27', start_date: '2026-04-01', end_date: '2027-03-31', is_current: true, status: 'active' },
        { id: '25d97037-3e78-4f1a-b2d9-795008ee69b9', name: '2025-26', start_date: '2025-04-01', end_date: '2026-03-31', is_current: false, status: 'completed' }
      ];

      setAcademicYears(finalYears);
      setAssessmentTypes(finalTypes);
      setExams(loadedExams);
      setSubjects(subjectsRes.data || []);
      setStudents(studentsRes.data || []);
      setClasses(classesRes.data || []);
      setTeachers(teachersRes.data || []);
      setExamSubjects(esRes.data || []);

      // Load teacher workload. A teacher only ever needs their own board, so
      // scope the query — loading all ~150 subject workloads for them is both
      // slow and shows other faculty's assignments.
      try {
        const isExamOffice = ['super_admin', 'admin', 'principal', 'vice_principal', 'exam_controller']
          .includes(role || '');
        const myTeacherId = isExamOffice
          ? undefined
          : (teachersRes.data || []).find((t: any) => t.user_id === user?.id)?.id;

        if (!isExamOffice && !myTeacherId) {
          setTeacherTasks([]);
        } else {
          const tasks = await examinationService.getTeacherWorkload(myTeacherId);
          setTeacherTasks(tasks || []);
        }
      } catch (e) {
        console.warn('[ExaminationModule] getTeacherWorkload warning:', e);
      }

      // Default form data
      const currentYear = finalYears.find(y => y.is_current) || finalYears[0];
      const defaultClassId = classesRes.data && classesRes.data.length > 0 ? classesRes.data[0].id : '';
      const defaultType = finalTypes[0];

      setExamFormData(prev => ({
        ...prev,
        exam_name: prev.exam_name || defaultType.name,
        short_name: prev.short_name || defaultType.code,
        exam_type: prev.exam_type || defaultType.name,
        academic_year: currentYear.name,
        academic_year_id: currentYear.id,
        class_ids: prev.class_ids.length > 0 ? prev.class_ids : (defaultClassId ? [defaultClassId] : [])
      }));
    } catch (err) {
      console.error('[ExaminationModule] Failed to load baseline data:', err);
      toast.error('Failed to sync Examination master data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBaselineData();
  }, [fetchBaselineData]);

  // Open Marks entry tab targeted to specific exam & subject
  const handleOpenMarksFromTask = (examId: string, subjectId: string, classId?: string) => {
    setMarksTargetExamId(examId);
    setMarksTargetSubjectId(subjectId);
    if (classId) setMarksTargetClassId(classId);
    setTab('marks-entry');
  };

  // Open Subject Mapping Modal
  const handleOpenSubjectMapping = async (exam: ExamRecord) => {
    setTargetExamForMapping(exam);

    const isPA = /pa-?\d|periodic/i.test(`${exam.short_name || ''} ${exam.exam_name || ''} ${exam.exam_type || ''}`);
    const defMax = isPA ? 20 : 100;
    const defPass = isPA ? 7 : 33;
    const component = exam.short_name || (isPA ? 'Periodic Assessment' : exam.exam_name || 'Examination');

    // Already-saved rows for this exam, keyed by subject for quick merge
    const existingBySubject = new Map(
      examSubjects.filter(es => es.exam_id === exam.id).map(es => [es.subject_id, es])
    );

    // Source of truth for what a class is taught: the Academics > Class Subjects map
    const yearId = (exam as any).academic_year_id
      || academicYears.find(y => y.is_current)?.id
      || academicYears[0]?.id;

    let classSubjectRows: any[] = [];
    try {
      if (exam.class_id && yearId) {
        classSubjectRows = await fetchClassSubjects(yearId, exam.class_id);
      }
    } catch (err) {
      console.warn('[ExaminationModule] fetchClassSubjects failed, falling back to saved exam subjects:', err);
    }

    // Collapse section-scoped duplicates to one row per subject
    const uniqueClassSubjects = Array.from(
      new Map(
        classSubjectRows
          .filter(r => r.is_active !== false)
          .map(r => [r.subject_id, r])
      ).values()
    );

    let list: typeof mappedSubjectList;
    if (uniqueClassSubjects.length > 0) {
      list = uniqueClassSubjects.map(cs => {
        const es = existingBySubject.get(cs.subject_id);
        const matchedT = teachers.find(t => t.id === es?.teacher_id);
        return {
          id: es?.id,
          subject_id: cs.subject_id,
          subject_name: cs.subject_name,
          max_marks: es?.max_marks || defMax,
          pass_marks: es?.pass_marks || defPass,
          teacher_id: es?.teacher_id || '',
          teacher_name: matchedT?.name || '',
          component_name: es?.component_name || component
        };
      });
    } else if (existingBySubject.size > 0) {
      // No class-subject map available — show whatever was saved before
      list = Array.from(existingBySubject.values()).map(es => {
        const matchedT = teachers.find(t => t.id === es.teacher_id);
        return {
          id: es.id,
          subject_id: es.subject_id,
          subject_name: es.subject_name,
          max_marks: es.max_marks || defMax,
          pass_marks: es.pass_marks || defPass,
          teacher_id: es.teacher_id || '',
          teacher_name: matchedT?.name || '',
          component_name: es.component_name || component
        };
      });
    } else {
      list = [];
      toast.error('No subjects are mapped to this class yet. Add them in Academics → Class Subjects first.');
    }

    setMappedSubjectList(list);
    setShowSubjectMappingModal(true);
  };

  // Save Subject Mapping
  const handleSaveSubjectMapping = async () => {
    if (!targetExamForMapping || isSavingMapping) return;

    setIsSavingMapping(true);
    const results = await Promise.allSettled(
      mappedSubjectList.map(item =>
        examinationService.saveExamSubject({
          id: item.id,
          exam_id: targetExamForMapping.id,
          class_id: targetExamForMapping.class_id,
          subject_id: item.subject_id,
          subject_name: item.subject_name,
          max_marks: item.max_marks,
          pass_marks: item.pass_marks,
          teacher_id: item.teacher_id || undefined,
          component_name: item.component_name || targetExamForMapping.short_name || 'Periodic Assessment'
        })
      )
    );
    setIsSavingMapping(false);

    const failed = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
    if (failed.length > 0) {
      console.error('[ExaminationModule] Save subject mapping errors:', failed.map(f => f.reason));
      toast.error(`Could not save ${failed.length}/${mappedSubjectList.length} subject(s): ${failed[0].reason?.message || failed[0].reason?.hint || 'Error'}`);
      return;
    }

    toast.success('Subjects, marks & evaluators saved.');
    setShowSubjectMappingModal(false);
    await fetchBaselineData();
  };

  // Save or Create Exam Term
  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examFormData.exam_name.trim()) {
      toast.error('Please enter an Examination Title.');
      return;
    }
    if (examFormData.class_ids.length === 0) {
      toast.error('Please select at least one applicable Class.');
      return;
    }

    setIsSavingExam(true);
    try {
      const finalYearId = examFormData.academic_year_id || academicYears[0]?.id || '2026-27';
      const finalYearName = examFormData.academic_year || academicYears[0]?.name || '2026-27';

      if (editingExamId) {
        await examinationService.updateExam(editingExamId, {
          exam_name: examFormData.exam_name,
          short_name: examFormData.short_name || examFormData.exam_name,
          exam_type: examFormData.exam_type,
          description: examFormData.description,
          start_date: examFormData.start_date || undefined,
          end_date: examFormData.end_date || undefined,
          marks_entry_start_date: examFormData.marks_entry_start_date || undefined,
          marks_entry_deadline: examFormData.marks_entry_deadline || undefined,
          result_publish_date: examFormData.result_publish_date || undefined,
          instructions: examFormData.instructions || undefined
        });
        toast.success('Examination term updated successfully.');
      } else {
        await examinationService.createExam({
          exam_name: examFormData.exam_name,
          short_name: examFormData.short_name || examFormData.exam_name,
          exam_type: examFormData.exam_type,
          academic_year: finalYearName,
          academic_year_id: finalYearId,
          class_ids: examFormData.class_ids,
          description: examFormData.description,
          start_date: examFormData.start_date || undefined,
          end_date: examFormData.end_date || undefined,
          marks_entry_start_date: examFormData.marks_entry_start_date || undefined,
          marks_entry_deadline: examFormData.marks_entry_deadline || undefined,
          result_publish_date: examFormData.result_publish_date || undefined,
          instructions: examFormData.instructions || undefined
          // Subjects are seeded per class from Academics → Class Subjects inside createExam.
        });
        toast.success(`Created examination term across ${examFormData.class_ids.length} class(es).`);
      }

      setShowExamModal(false);
      await fetchBaselineData();
    } catch (err: any) {
      console.error('[ExaminationModule] Save exam error:', err);
      toast.error('Failed to create examination term: ' + (err.message || 'Error'));
    } finally {
      setIsSavingExam(false);
    }
  };

  // Delete Exam Term
  const handleDeleteExam = async (examId: string) => {
    if (!window.confirm('Are you sure you want to delete this examination term? All mapped subjects and marks will be removed.')) {
      return;
    }
    try {
      await examinationService.deleteExam(examId);
      toast.success('Examination term deleted.');
      await fetchBaselineData();
    } catch (err: any) {
      toast.error('Failed to delete exam: ' + (err.message || 'Error'));
    }
  };

  if (!canViewTab) return null;

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16 select-none">
      {/* 1. Master Page Header Banner */}
      <AdminHeader
        title="St. Joseph's Examination & Gradebook"
        subtitle="Manage CBSE assessment terms, teacher marks evaluation, admin verification, result processing and official report cards."
        badge={{
          icon: GraduationCap,
          text: 'CBSE Examination Hub',
          variant: 'violet'
        }}
        sessionBadge="2026-27"
        actions={
          can('results.publish') ? (
            <button
              onClick={handleOpenCreateExamModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shadow-blue-600/20 cursor-pointer active:scale-95"
            >
              <Plus size={14} />
              <span>Create Exam Term</span>
            </button>
          ) : undefined
        }
      />

      {/* 3. Workspace Navigation Tabs */}
      <div className="relative group bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => {
              const nav = document.getElementById('exam-module-tabs-nav');
              if (nav) nav.scrollBy({ left: -200, behavior: 'smooth' });
            }}
            className="hidden md:flex p-1.5 text-slate-400 hover:text-slate-800 hover:bg-white rounded-xl transition-all shrink-0 cursor-pointer"
            title="Scroll left"
          >
            <ChevronRight size={14} className="rotate-180" />
          </button>

          <nav 
            id="exam-module-tabs-nav"
            className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth py-0.5 px-1 flex-1"
          >
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Trophy },
              { id: 'exams', label: 'Exams & Assessments', icon: Layers, permission: 'results.publish' },
              { id: 'schedule', label: 'Exam Schedule', icon: Calendar },
              { id: 'admit-cards', label: 'Admit Cards', icon: IdCard },
              { id: 'seating-plan', label: 'Seating Plan', icon: Sparkles },
              { id: 'invigilation', label: 'Invigilation', icon: ShieldCheck },
              { id: 'exam-attendance', label: 'Exam Attendance', icon: UserCheck },
              { id: 'marks-entry', label: 'Marks Entry', icon: ClipboardList },
              { id: 'marks-verification', label: 'Marks Verification', icon: CheckCircle2, permission: 'results.publish' },
              { id: 'result-processing', label: 'Result Processing', icon: Award, permission: 'results.publish' },
              { id: 'report-cards', label: 'Report Cards', icon: FileText },
              { id: 'result-publishing', label: 'Result Publishing', icon: Send, permission: 'results.publish' },
              { id: 'analytics', label: 'Performance Analytics', icon: BarChart3 },
              { id: 'settings', label: 'Examination Settings', icon: Settings, permission: 'results.publish' }
            ].filter(tab => !tab.permission || can(tab.permission)).map(tab => {
              const isActive = currentTab === tab.id || (tab.id === 'dashboard' && currentTab === 'overview');
              return (
                <button
                  key={tab.id}
                  id={`exam-tab-${tab.id}`}
                  onClick={() => {
                    setTab(tab.id);
                    const el = document.getElementById(`exam-tab-${tab.id}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer select-none",
                    isActive 
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200/80" 
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  )}
                >
                  <tab.icon size={13} className={isActive ? "text-blue-600" : "text-slate-400"} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => {
              const nav = document.getElementById('exam-module-tabs-nav');
              if (nav) nav.scrollBy({ left: 200, behavior: 'smooth' });
            }}
            className="hidden md:flex p-1.5 text-slate-400 hover:text-slate-800 hover:bg-white rounded-xl transition-all shrink-0 cursor-pointer"
            title="Scroll right"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* 4. Tab Workspace Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentTab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
        >
          {/* TAB 1: DASHBOARD / OVERVIEW */}
          {(currentTab === 'dashboard' || currentTab === 'overview') && (
            <DashboardView
              academicYears={academicYears}
              selectedYearId={academicYears.find(y => y.is_current)?.id || academicYears[0]?.id || ''}
              onNavigateTab={(targetTab, extra) => setTab(targetTab, extra)}
            />
          )}

          {/* TAB 2: EXAMS & ASSESSMENTS */}
          {currentTab === 'exams' && (
            <ExamsView
              academicYears={academicYears}
              classes={classes}
              subjects={subjects}
              teachers={teachers}
              selectedYearId={academicYears.find(y => y.is_current)?.id || academicYears[0]?.id || ''}
              onNavigateTab={(targetTab, extra) => setTab(targetTab, extra)}
            />
          )}

          {/* TAB 3: EXAM SCHEDULE / DATESHEETS */}
          {currentTab === 'schedule' && (
            <DatesheetsView />
          )}

          {/* TAB 4: ADMIT CARDS */}
          {currentTab === 'admit-cards' && (
            <AdmitCardsView />
          )}

          {/* TAB 5: SEATING PLAN */}
          {currentTab === 'seating-plan' && (
            <SeatingPlanView />
          )}

          {/* TAB 6: INVIGILATION DUTIES */}
          {currentTab === 'invigilation' && (
            <InvigilationView
              exams={exams}
              teachers={teachers}
              selectedYearId={academicYears.find(y => y.is_current)?.id || academicYears[0]?.id || ''}
            />
          )}

          {/* TAB 7: EXAM ATTENDANCE REGISTER */}
          {currentTab === 'exam-attendance' && (
            <ExamAttendanceView
              exams={exams}
              classes={classes}
              subjects={subjects}
              selectedYearId={academicYears.find(y => y.is_current)?.id || academicYears[0]?.id || '2026-27'}
            />
          )}

          {/* TAB 8: MARKS ENTRY */}
          {currentTab === 'marks-entry' && (
            <ResultsView 
              exams={exams}
              subjects={subjects}
              classes={classes}
              currentUserRole={role || 'admin'}
              currentUserId={user?.id}
              initialExamId={marksTargetExamId || (exams[0]?.id || '')}
              initialSubjectId={marksTargetSubjectId}
              initialClassId={marksTargetClassId}
              onBackToTasks={() => setTab('tasks')}
            />
          )}

          {/* TAB 9: MARKS VERIFICATION & MODERATION */}
          {currentTab === 'marks-verification' && (
            <MarksVerificationView
              exams={exams}
              classes={classes}
              subjects={subjects}
              selectedYearId={academicYears.find(y => y.is_current)?.id || academicYears[0]?.id || '2026-27'}
              onNavigateTab={(targetTab, extra) => setTab(targetTab, extra)}
            />
          )}

          {/* TAB 10: RESULT PROCESSING ENGINE */}
          {currentTab === 'result-processing' && (
            <ResultProcessingView 
              exams={exams}
              classes={classes}
              currentUserRole={role || 'admin'}
              currentUserId={user?.id}
              onOpenMarksEntry={handleOpenMarksFromTask}
              onRefreshData={fetchBaselineData}
            />
          )}

          {/* TAB 11: REPORT CARDS HUB */}
          {currentTab === 'report-cards' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200/60 shadow-2xs">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setReportSubMode('final')}
                    className={cn(
                      "px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                      reportSubMode === 'final' ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    Official CBSE Annual Report Card
                  </button>
                  <button
                    onClick={() => setReportSubMode('coscholastic')}
                    className={cn(
                      "px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                      reportSubMode === 'coscholastic' ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    Co-Scholastic &amp; Life Skills Evaluator
                  </button>
                </div>
              </div>

              <StudentReportsView mode={reportSubMode} />
            </div>
          )}

          {/* TAB 12: RESULT PUBLISHING */}
          {currentTab === 'result-publishing' && (
            <ResultPublishingView
              exams={exams}
              classes={classes}
              selectedYearId={academicYears.find(y => y.is_current)?.id || academicYears[0]?.id || ''}
              onNavigateTab={(targetTab, extra) => setTab(targetTab, extra)}
            />
          )}

          {/* TAB 13: PERFORMANCE ANALYTICS */}
          {currentTab === 'analytics' && (
            <AnalyticsView />
          )}

          {/* TAB 14: EXAMINATION SETTINGS & RULES */}
          {(currentTab === 'settings' || currentTab === 'config') && (
            <ConfigView />
          )}

          {/* BONUS: TEACHER WORKLOAD DIRECT TAB */}
          {currentTab === 'tasks' && (
            <TeacherTasksView 
              tasks={teacherTasks}
              teachers={teachers}
              currentUserRole={role || 'admin'}
              currentUserId={user?.id}
              onOpenMarksEntry={handleOpenMarksFromTask}
              onRefreshTasks={fetchBaselineData}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* EXAM CREATION / EDIT MODAL */}
      {showExamModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                {editingExamId ? 'Edit Examination Master' : 'Create New Examination Term'}
              </h3>
              <button onClick={() => setShowExamModal(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveExam} className="p-5 space-y-4 text-xs font-semibold text-slate-700 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-1">Assessment Type</label>
                  <select 
                    value={examFormData.exam_type}
                    onChange={(e) => {
                      const sel = assessmentTypes.find(a => a.name === e.target.value || a.code === e.target.value);
                      setExamFormData(prev => ({
                        ...prev,
                        exam_type: e.target.value,
                        exam_name: sel ? sel.name : prev.exam_name,
                        short_name: sel ? sel.code : prev.short_name
                      }));
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold outline-none cursor-pointer focus:border-blue-500 focus:bg-white"
                  >
                    {assessmentTypes.map(a => (
                      <option key={a.id} value={a.name}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-1">Short Name / Code</label>
                  <input 
                    type="text" 
                    value={examFormData.short_name}
                    onChange={(e) => setExamFormData({ ...examFormData, short_name: e.target.value })}
                    placeholder="e.g. PA-1, HYE, ANNUAL"
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold outline-none focus:border-blue-500 focus:bg-white font-mono"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1">Full Examination Title</label>
                <input 
                  type="text" 
                  value={examFormData.exam_name}
                  onChange={(e) => setExamFormData({ ...examFormData, exam_name: e.target.value })}
                  placeholder="e.g. Periodic Assessment 1 / Mid-Term Examination"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold outline-none focus:border-blue-500 focus:bg-white"
                  required
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1">Academic Session</label>
                <select 
                  value={examFormData.academic_year_id}
                  onChange={(e) => {
                    const sel = academicYears.find(y => y.id === e.target.value);
                    setExamFormData({
                      ...examFormData,
                      academic_year_id: e.target.value,
                      academic_year: sel?.name || '2026-27'
                    });
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold outline-none cursor-pointer focus:border-blue-500 focus:bg-white"
                >
                  {academicYears.map(y => (
                    <option key={y.id} value={y.id}>{y.name} {y.is_current ? '(Current Session)' : ''}</option>
                  ))}
                </select>
              </div>

              {/* Applicable Class Picker */}
              <div className="flex flex-col space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-slate-500">
                    Applicable Class(es) <span className="text-blue-600 font-bold">({examFormData.class_ids.length} selected)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExamFormData({ ...examFormData, class_ids: classes.map(c => c.id) })}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setExamFormData({ ...examFormData, class_ids: [] })}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-700 underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl max-h-36 overflow-y-auto">
                  {classes.map(c => {
                    const isChecked = examFormData.class_ids.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setExamFormData({ ...examFormData, class_ids: examFormData.class_ids.filter(id => id !== c.id) });
                          } else {
                            setExamFormData({ ...examFormData, class_ids: [...examFormData.class_ids, c.id] });
                          }
                        }}
                        className={cn(
                          "px-2 py-1.5 rounded-lg text-xs font-bold border text-center transition-all cursor-pointer flex items-center justify-between gap-1",
                          isChecked 
                            ? "bg-blue-600 border-blue-600 text-white shadow-xs" 
                            : "bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/50"
                        )}
                      >
                        <span className="truncate">{formatClassDisplay(c.class_name)}</span>
                        {isChecked && <Check size={12} className="shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-1">Marks Entry Start</label>
                  <input
                    type="date"
                    value={examFormData.marks_entry_start_date}
                    onChange={e => setExamFormData({ ...examFormData, marks_entry_start_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-1">Marks Entry Deadline</label>
                  <input
                    type="date"
                    value={examFormData.marks_entry_deadline}
                    onChange={e => setExamFormData({ ...examFormData, marks_entry_deadline: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowExamModal(false)}
                  disabled={isSavingExam}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSavingExam}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/15 cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                >
                  {isSavingExam && <Loader2 size={13} className="animate-spin" />}
                  <span>{editingExamId ? (isSavingExam ? 'Saving...' : 'Save Changes') : (isSavingExam ? 'Creating...' : 'Confirm & Create')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBJECT MAPPING & TEACHER ASSIGNMENT MODAL */}
      {showSubjectMappingModal && targetExamForMapping && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden animate-fadeIn">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Configure Subjects, Marks &amp; Evaluators</h3>
                <p className="text-slate-400 text-[10px] mt-0.5">
                  {targetExamForMapping.short_name || targetExamForMapping.exam_name} • {formatClassDisplay(targetExamForMapping.classes?.class_name || targetExamForMapping.class)} • {mappedSubjectList.length} subject{mappedSubjectList.length === 1 ? '' : 's'}
                </p>
              </div>
              <button onClick={() => setShowSubjectMappingModal(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="px-5 pt-4 pb-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-slate-400 grid grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_84px_84px] gap-3 px-3">
                <span>Subject Name</span>
                <span>Assigned Faculty Evaluator</span>
                <span className="text-center">Max Marks</span>
                <span className="text-center">Pass Marks</span>
              </div>
            </div>

            <div className="px-5 pb-5 space-y-2 max-h-[58vh] overflow-y-auto">
              {mappedSubjectList.map((item, idx) => (
                <div key={item.subject_id} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_84px_84px] gap-3 items-center bg-slate-50 hover:bg-slate-100/70 transition-colors p-2.5 rounded-xl border border-slate-100">
                  <span className="font-bold text-slate-800 text-xs leading-tight break-words px-3" title={item.subject_name}>{item.subject_name}</span>

                  <select
                    value={item.teacher_id || ''}
                    onChange={(e) => {
                      const selT = teachers.find(t => t.id === e.target.value);
                      const updated = [...mappedSubjectList];
                      updated[idx].teacher_id = e.target.value;
                      updated[idx].teacher_name = selT?.name || '';
                      setMappedSubjectList(updated);
                    }}
                    className="w-full min-w-0 bg-white border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-lg py-1.5 px-2 text-xs font-bold text-slate-700 outline-none transition-shadow"
                  >
                    <option value="">Choose Evaluator…</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.designation || 'Teacher'})</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min={1}
                    value={item.max_marks}
                    onChange={(e) => {
                      const updated = [...mappedSubjectList];
                      updated[idx].max_marks = Number(e.target.value) || 20;
                      setMappedSubjectList(updated);
                    }}
                    className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-lg py-1.5 text-center font-mono font-bold text-xs outline-none transition-shadow"
                  />
                  <input
                    type="number"
                    min={0}
                    value={item.pass_marks}
                    onChange={(e) => {
                      const updated = [...mappedSubjectList];
                      updated[idx].pass_marks = Number(e.target.value) || 7;
                      setMappedSubjectList(updated);
                    }}
                    className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-lg py-1.5 text-center font-mono font-bold text-xs outline-none transition-shadow"
                  />
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50">
              <button 
                type="button" 
                onClick={() => setShowSubjectMappingModal(false)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSubjectMapping}
                disabled={isSavingMapping}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/15 cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
              >
                {isSavingMapping && <Loader2 size={13} className="animate-spin" />}
                <span>{isSavingMapping ? 'Saving…' : 'Save'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
