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
import ResultsView from '@/components/results/ResultsView';
import DatesheetsView from '@/components/results/DatesheetsView';
import AnalyticsView from '@/components/results/AnalyticsView';
import AdmitCardsView from '@/components/results/AdmitCardsView';
import StudentReportsView from '@/components/results/StudentReportsView';
import ConfigView from '@/components/results/ConfigView';
import ResultProcessingView from '@/components/results/ResultProcessingView';
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

  // Tab state: 'overview' | 'tasks' | 'exams' | 'marks' | 'results' | 'reports' | 'schedule' | 'analytics' | 'config'
  const currentTab = useMemo(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) return tabParam;
    
    const path = location.pathname.toLowerCase();
    if (path.includes('report-cards') || path.includes('certificates')) return 'reports';
    if (path.includes('admit-cards') || path.includes('hall-tickets') || path.includes('schedule')) return 'schedule';
    if (path.includes('result-processing') || path.includes('result-publication') || path.includes('merit-list') || path.includes('rank-list')) return 'results';
    if (path.includes('marks-entry') || path.includes('marks-verification') || path.includes('grace-marks')) return 'marks';
    if (path.includes('analytics') || path.includes('reports')) return 'analytics';
    if (path.includes('grade-rules') || path.includes('exam-types')) return 'config';
    if (path.includes('tasks') || path.includes('teacher')) return 'tasks';
    
    if (propView) {
      if (['report-cards', 'certificates'].includes(propView)) return 'reports';
      if (['admit-cards', 'schedule', 'hall-tickets'].includes(propView)) return 'schedule';
      if (['result-processing', 'result-publication', 'merit-list'].includes(propView)) return 'results';
      if (['marks-entry', 'marks-verification', 'grace-marks'].includes(propView)) return 'marks';
      if (['analytics'].includes(propView)) return 'analytics';
      if (['grade-rules', 'exam-types'].includes(propView)) return 'config';
      if (['tasks', 'teacher'].includes(propView)) return 'tasks';
    }

    return 'overview';
  }, [searchParams, location.pathname, propView]);

  const requiredTabPermission = (currentTab === 'exams' || currentTab === 'results')
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
        { id: '2026-27', name: '2026-27', start_date: '2026-04-01', end_date: '2027-03-31', is_current: true, status: 'active' },
        { id: '2025-26', name: '2025-26', start_date: '2025-04-01', end_date: '2026-03-31', is_current: false, status: 'completed' }
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
    setTab('marks');
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

      {/* 2. Interactive Examination Lifecycle Workflow Pipeline */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                End-to-End CBSE Examination Lifecycle
              </h3>
              <p className="text-[11px] text-slate-500">
                ADMIN (Setup &amp; Approval) → TEACHER (Workload &amp; Drafts) → RESULT ENGINE → STUDENT / PARENT PORTAL
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-mono font-bold">
              St. Joseph's ERP Engine
            </span>
          </div>
        </div>

        {/* 6-Step Stepper Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {EXAM_WORKFLOW_PIPELINE.map((st) => {
            const isCurrentActive = currentTab === st.tab;
            return (
              <button
                key={st.step}
                type="button"
                onClick={() => {
                  if (st.tab === 'exams' && st.step === 1 && can('results.publish')) {
                    handleOpenCreateExamModal();
                  } else {
                    setTab(st.tab);
                  }
                }}
                className={cn(
                  "p-3 rounded-2xl border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer select-none group",
                  isCurrentActive 
                    ? "bg-slate-900 border-slate-900 text-white shadow-md scale-[1.02]" 
                    : "bg-slate-50/70 hover:bg-white border-slate-200/80 text-slate-700 hover:border-blue-300 hover:shadow-2xs"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black",
                      isCurrentActive ? "bg-white text-slate-900" : "bg-slate-200 text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-700"
                    )}>
                      {st.step}
                    </span>
                    <span className={cn(
                      "px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase tracking-wider font-mono",
                      st.role === 'ADMIN' 
                        ? (isCurrentActive ? "bg-blue-400/20 text-blue-300" : "bg-blue-50 text-blue-700 border border-blue-100") :
                      st.role === 'TEACHER' 
                        ? (isCurrentActive ? "bg-amber-400/20 text-amber-300" : "bg-amber-50 text-amber-700 border border-amber-100") :
                        (isCurrentActive ? "bg-emerald-400/20 text-emerald-300" : "bg-emerald-50 text-emerald-700 border border-emerald-100")
                    )}>
                      {st.role}
                    </span>
                  </div>
                  <h4 className={cn("text-xs font-bold leading-tight", isCurrentActive ? "text-white" : "text-slate-900")}>
                    {st.title}
                  </h4>
                  <p className={cn("text-[10px] line-clamp-2 mt-1 font-medium", isCurrentActive ? "text-slate-300" : "text-slate-400")}>
                    {st.subtext}
                  </p>
                </div>
                
                <div className={cn(
                  "mt-2 pt-1.5 border-t text-[10px] font-bold flex items-center justify-between",
                  isCurrentActive ? "border-slate-800 text-blue-300" : "border-slate-200/60 text-blue-600 group-hover:text-blue-700"
                )}>
                  <span>{st.actionText}</span>
                  <ArrowRight size={10} className="transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Workspace Navigation Tabs */}
      <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth py-0.5 px-0.5">
          {[
            { id: 'overview', label: 'Overview', icon: Trophy },
            { id: 'tasks', label: 'My Assigned Workload', icon: UserCheck },
            { id: 'exams', label: 'Exams & Mapping', icon: Layers, permission: 'results.publish' },
            { id: 'marks', label: 'CBSE Marks Entry', icon: ClipboardList },
            { id: 'results', label: 'Result Processing & Publish', icon: Award, permission: 'results.publish' },
            { id: 'reports', label: 'Report Cards Hub', icon: FileText },
            { id: 'schedule', label: 'Schedule & Admit Cards', icon: Calendar },
            { id: 'analytics', label: 'Performance Analytics', icon: BarChart3 },
            { id: 'config', label: 'Grading & Types', icon: Settings }
          ].filter(tab => !tab.permission || can(tab.permission)).map(tab => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer select-none",
                  isActive 
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/80" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                )}
              >
                <tab.icon size={13.5} className={isActive ? "text-blue-600" : "text-slate-400"} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
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
          {/* TAB 0: OVERVIEW */}
          {currentTab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <AdminStatCard
                  label="Configured Terms"
                  value={exams.length}
                  subtext={`Across ${classes.length} class grade levels`}
                  icon={Layers}
                  variant="violet"
                />
                <AdminStatCard
                  label="Assigned Workloads"
                  value={teacherTasks.length}
                  subtext="Subject evaluation slots"
                  icon={UserCheck}
                  variant="primary"
                />
                <AdminStatCard
                  label="Pending Verification"
                  value={teacherTasks.filter(t => t.status === 'submitted').length}
                  subtext="Submitted by teachers"
                  icon={Clock}
                  variant="amber"
                />
                <AdminStatCard
                  label="Active Students"
                  value={students.length}
                  subtext="Eligible examination candidates"
                  icon={Users}
                  variant="emerald"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 bg-white border border-slate-200/60 rounded-[22px] p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Active Examination Terms</h3>
                      <p className="text-slate-400 text-[10px]">Current academic session evaluations</p>
                    </div>
                    {can('results.publish') && (
                      <button 
                        onClick={() => setTab('exams')}
                        className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        Manage Terms <ArrowRight size={12} />
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {exams.slice(0, 5).map(ex => (
                      <div key={ex.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-100/70 text-blue-700">
                            <GraduationCap size={16} />
                          </div>
                          <div>
                            <h4 className="text-xs font-extrabold text-slate-900">
                              {ex.short_name || ex.exam_name}
                            </h4>
                            <p className="text-[10px] text-slate-400 font-semibold">
                              {formatClassDisplay(ex.classes?.class_name || ex.class)} • {ex.academic_year}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setMarksTargetExamId(ex.id);
                              if (ex.class_id) setMarksTargetClassId(ex.class_id);
                              setTab('marks');
                            }}
                            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-blue-50 text-blue-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Enter Marks
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-slate-200/60 rounded-[22px] p-5 shadow-2xs flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-1">Examination Quick Actions</h3>
                    <p className="text-slate-400 text-[10px] mb-3">Direct links to workflow modules</p>

                    <div className="space-y-2">
                      {[
                        { label: 'My Assigned Workload', desc: 'Faculty marks evaluation tasks', tab: 'tasks', icon: UserCheck },
                        { label: 'Result Processing Engine', desc: 'Compute totals, CBSE grades, ranks', tab: 'results', icon: Award },
                        { label: 'Official Report Cards Hub', desc: 'St. Joseph\'s School report cards', tab: 'reports', icon: FileText },
                        { label: 'CBSE Admit Cards Generator', desc: 'Entrance passes with datesheets', tab: 'schedule', sub: 'admitCard', icon: Calendar }
                      ].map((action, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            if (action.sub) {
                              setTab(action.tab, { sub: action.sub });
                              setScheduleSubMode(action.sub as any);
                            } else {
                              setTab(action.tab);
                            }
                          }}
                          className="w-full text-left p-2.5 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all flex items-center justify-between group cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                              <action.icon size={13} />
                            </div>
                            <div>
                              <strong className="block text-xs text-slate-800 group-hover:text-blue-700">{action.label}</strong>
                              <span className="text-[9.5px] text-slate-400 font-medium">{action.desc}</span>
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-[10px] text-blue-800 font-medium">
                    <strong>St. Joseph's School Standard:</strong> Periodic Assessments scale independently (e.g. 20M) without mixing Annual 80M columns.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: TEACHER WORKLOAD TASKS */}
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

          {/* TAB 2: EXAMS & SUBJECT CONFIGURATION MASTER */}
          {currentTab === 'exams' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200/80 shadow-2xs rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold font-sans text-slate-900 tracking-tight">Active Assessment Terms &amp; Subject Schemes</h3>
                    <p className="text-slate-500 text-xs mt-0.5">Configure exam types, maximum marks, pass criteria, and evaluator assignments</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                    {exams.length} Terms Active
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold text-slate-500">
                        <th className="py-3 px-5">Assessment Term</th>
                        <th className="py-3 px-4 text-center">Class Scope</th>
                        <th className="py-3 px-4 text-center">Session</th>
                        <th className="py-3 px-4 text-center">Mapped Subjects &amp; Evaluators</th>
                        <th className="py-3 px-4 text-center">Publication Status</th>
                        <th className="py-3 px-4 text-right pr-5">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/70 text-slate-700 font-semibold">
                      {isLoading ? (
                        <tr>
                          <td colSpan={6} className="py-16 text-center text-slate-400 font-bold">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                            Loading examinations...
                          </td>
                        </tr>
                      ) : exams.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-16 text-center text-slate-400 font-bold">
                            No examinations created yet. Click "Create Exam Term" above to add your first assessment.
                          </td>
                        </tr>
                      ) : (
                        exams.map(ex => {
                          const mappedCount = ex.exam_subjects?.length || 0;
                          return (
                            <tr key={ex.id} className="hover:bg-slate-50/40 transition-colors">
                              <td className="py-3 px-5 font-bold text-slate-900 flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                                  <GraduationCap size={14} />
                                </div>
                                <div>
                                  <span>{ex.short_name || ex.exam_name}</span>
                                  {ex.short_name && ex.short_name !== ex.exam_name && (
                                    <span className="text-[10px] text-slate-400 block font-normal">{ex.exam_name}</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                  {formatClassDisplay(ex.classes?.class_name || ex.class)}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center font-mono font-bold text-slate-600">
                                {ex.academic_year}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  onClick={() => handleOpenSubjectMapping(ex)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 text-blue-700 border border-slate-200 hover:border-blue-200 text-[10.5px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto"
                                >
                                  <UserCheck size={12} />
                                  <span>{mappedCount > 0 ? `${mappedCount} Subjects Configured` : 'Configure Subjects'}</span>
                                </button>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={cn(
                                  "px-2.5 py-0.5 rounded-md text-[10px] font-bold border",
                                  ex.is_published ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-slate-100 text-slate-600 border-slate-200"
                                )}>
                                  {ex.is_published ? 'Published' : 'Draft'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right pr-5">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingExamId(ex.id);
                                      setExamFormData({
                                        exam_name: ex.exam_name,
                                        short_name: ex.short_name || '',
                                        exam_type: ex.exam_type || 'Periodic Assessment',
                                        class_ids: [ex.class_id],
                                        academic_year: ex.academic_year,
                                        academic_year_id: ex.academic_year_id,
                                        description: ex.description || '',
                                        start_date: ex.start_date || '',
                                        end_date: ex.end_date || '',
                                        marks_entry_start_date: ex.marks_entry_start_date || '',
                                        marks_entry_deadline: ex.marks_entry_deadline || '',
                                        result_publish_date: ex.result_publish_date || '',
                                        instructions: ex.instructions || ''
                                      });
                                      setShowExamModal(true);
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                    title="Edit Exam Term"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteExam(ex.id)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                    title="Delete Exam"
                                  >
                                    <Trash2 size={13} />
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
            </div>
          )}

          {/* TAB 3: CBSE MARKS ENTRY */}
          {currentTab === 'marks' && (
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

          {/* TAB 4: RESULT PROCESSING & PUBLICATION */}
          {currentTab === 'results' && (
            <ResultProcessingView 
              exams={exams}
              classes={classes}
              currentUserRole={role || 'admin'}
              currentUserId={user?.id}
              onOpenMarksEntry={handleOpenMarksFromTask}
              onRefreshData={fetchBaselineData}
            />
          )}

          {/* TAB 5: REPORT CARDS HUB */}
          {currentTab === 'reports' && (
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
                    Official St. Joseph's Annual Report Card
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

          {/* TAB 6: SCHEDULE & ADMIT CARDS */}
          {currentTab === 'schedule' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200/60 shadow-2xs">
                <div className="flex items-center gap-1">
                  {can('results.publish') && (
                    <button
                      onClick={() => setScheduleSubMode('datesheet')}
                      className={cn(
                        "px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                        scheduleSubMode === 'datesheet' ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      Examination Datesheets &amp; Venues
                    </button>
                  )}
                  <button
                    onClick={() => setScheduleSubMode('admitCard')}
                    className={cn(
                      "px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                      scheduleSubMode === 'admitCard' ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    CBSE Admit Cards &amp; Hall Tickets
                  </button>
                </div>
              </div>

              {scheduleSubMode === 'datesheet' && can('results.publish') ? <DatesheetsView /> : <AdmitCardsView />}
            </div>
          )}

          {/* TAB 7: PERFORMANCE ANALYTICS */}
          {currentTab === 'analytics' && (
            <AnalyticsView />
          )}

          {/* TAB 8: CONFIG & RULES */}
          {currentTab === 'config' && (
            <ConfigView />
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
