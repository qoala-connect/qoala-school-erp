import React, { useState, useEffect, useMemo } from 'react';
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
  UserCheck
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

import { 
  CBSEComponentMarks, 
  computeComponentTotal, 
  isSameClass, 
  formatClassDisplay, 
  normalizeClassName,
  TeacherExamTask,
  MarksWorkflowStatus
} from '@/lib/cbseExamUtils';

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
    
    // Check path for legacy route compatibility
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

  // Every route into this module maps to a tab via the ?tab= query string
  // (see currentTab above), which bypasses the per-route allowedPermission
  // guard in App.tsx entirely — visiting /dashboard/examination?tab=exams
  // reaches the same screen as the dedicated results.publish-gated route
  // regardless of which route was actually matched. Re-check the
  // permission the tab actually requires here so the query string can't
  // be used to reach exam creation or result publication with only
  // results.view. 'exams' (exam-term creation & evaluator assignment) and
  // 'results' (ResultProcessingView, which has no internal gating of its
  // own) are admin/exam-office actions; every other tab keeps the base
  // route's results.view requirement.
  const requiredTabPermission = (currentTab === 'exams' || currentTab === 'results')
    ? 'results.publish'
    : 'results.view';
  const canViewTab = can(requiredTabPermission);

  useEffect(() => {
    if (!canViewTab) {
      navigate('/unauthorized', { replace: true });
    }
  }, [canViewTab, navigate]);

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

  useEffect(() => {
    if (!can('results.publish') || location.pathname.includes('admit-cards') || propView === 'admit-cards' || searchParams.get('sub') === 'admitCard') {
      setScheduleSubMode('admitCard');
    }
  }, [can, location.pathname, propView, searchParams]);

  // Core Database Data States
  const [exams, setExams] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [examSubjects, setExamSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [teacherTasks, setTeacherTasks] = useState<TeacherExamTask[]>([]);
  const [marks, setMarks] = useState<Record<string, Record<string, CBSEComponentMarks>>>({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingMarks, setIsSavingMarks] = useState(false);

  // Active marks filter state & incoming selection from Global Search
  const [selectedExamId, setSelectedExamId] = useState<string | null>(() => location.state?.selectedExamId || null);
  const [marksTargetExamId, setMarksTargetExamId] = useState<string>(() => location.state?.selectedExamId || '');
  const [marksTargetSubjectId, setMarksTargetSubjectId] = useState<string>('');
  const [marksTargetClass, setMarksTargetClass] = useState<string>('All');

  // Exam CRUD Modal state
  const [showExamModal, setShowExamModal] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [examFormData, setExamFormData] = useState({
    exam_name: '',
    class: '10',
    academic_year: '2026-27',
    class_id: '',
    academic_year_id: ''
  });

  const [assessmentTypes, setAssessmentTypes] = useState<any[]>([]);

  // Subject Mapping & Teacher Assignment Modal state
  const [showSubjectMappingModal, setShowSubjectMappingModal] = useState(false);
  const [targetExamForMapping, setTargetExamForMapping] = useState<any | null>(null);
  const [mappedSubjectList, setMappedSubjectList] = useState<Array<{ 
    subject_id: string; 
    subject_name: string; 
    max_marks: number; 
    pass_marks: number;
    teacher_id?: string;
    teacher_name?: string;
  }>>([]);

  // Fetch baseline foundational data
  useEffect(() => {
    fetchBaselineData();
  }, []);

  const fetchBaselineData = async () => {
    setIsLoading(true);
    try {
      const [examsRes, subjectsRes, studentsRes, classesRes, yearsRes, esRes, teachersRes, assignmentsRes, marksCountRes, assessRes] = await Promise.all([
        supabase.from('exams').select('*').order('created_at', { ascending: false }),
        supabase.from('subjects').select('*').order('subject_name'),
        supabase.from('students').select('*').eq('status', 'active').order('name'),
        supabase.from('classes').select('*').order('class_name'),
        supabase.from('academic_years').select('*').order('name'),
        supabase.from('exam_subjects').select('*'),
        supabase.from('teachers').select('id, name, employee_id, designation, department, status, user_id'),
        supabase.from('teacher_assignments').select(`
          id, teacher_id, academic_year_id, class_id, section_id, subject_id, assignment_type, is_active,
          teachers (id, name, employee_id),
          classes (id, class_name),
          sections (id, section_name),
          subjects (id, subject_name)
        `).eq('is_active', true),
        supabase.from('marks').select('exam_id, subject_id, student_id, obtained_marks'),
        supabase.from('assessment_types').select('*').order('display_order')
      ]);

      const loadedExams = examsRes.data || [];
      const loadedSubjects = subjectsRes.data || [];
      const loadedStudents = studentsRes.data || [];
      const loadedClasses = classesRes.data || [];
      const loadedYears = yearsRes.data || [];
      const loadedES = esRes.data || [];
      const loadedTeachers = teachersRes.data || [];
      const loadedAssignments = assignmentsRes.data || [];
      const loadedMarks = marksCountRes.data || [];
      const loadedAssess = assessRes.data || [];

      setExams(loadedExams);
      setSubjects(loadedSubjects);
      setStudents(loadedStudents);
      setClasses(loadedClasses);
      setAcademicYears(loadedYears);
      setExamSubjects(loadedES);
      setTeachers(loadedTeachers);
      setAssessmentTypes(loadedAssess);

      // Build Real Teacher Examination Tasks from canonical assignments
      compileTeacherTasks(
        loadedExams, 
        loadedSubjects, 
        loadedStudents, 
        loadedES, 
        loadedTeachers, 
        loadedAssignments, 
        loadedMarks
      );

      // Default form data
      if (loadedClasses.length > 0 && loadedYears.length > 0) {
        setExamFormData({
          exam_name: 'Mid-Term Examination',
          class: loadedClasses[0].class_name,
          academic_year: loadedYears.find(y => y.is_current)?.name || loadedYears[0].name,
          class_id: loadedClasses[0].id,
          academic_year_id: loadedYears.find(y => y.is_current)?.id || loadedYears[0].id
        });
      }

      // If an exam exists, load marks for it
      if (loadedExams.length > 0) {
        await loadMarksForExam(loadedExams[0].id);
      }
    } catch (err) {
      console.error('Failed to load baseline exam context:', err);
      toast.error('Failed to sync Examination master data');
    } finally {
      setIsLoading(false);
    }
  };

  // Compile Teacher Tasks from genuine teacher_assignments and marks data
  const compileTeacherTasks = (
    examList: any[],
    subjectList: any[],
    studentList: any[],
    esList: any[],
    teacherList: any[],
    assignmentList: any[],
    allMarksList: any[]
  ) => {
    const tasks: TeacherExamTask[] = [];

    examList.forEach((ex) => {
      const targetClass = ex.class;
      const classStudents = studentList.filter(s => isSameClass(s.class, targetClass));
      const totalStudents = classStudents.length;

      const matchingES = esList.filter(es => es.exam_id === ex.id);
      const subjectsToProcess = matchingES.length > 0 
        ? matchingES.map(es => ({
            id: es.id,
            subject_id: es.subject_id,
            subject_name: es.subject_name,
            max_marks: es.max_marks || 100,
            pass_marks: es.pass_marks || 33
          }))
        : subjectList.slice(0, 5).map(s => ({
            id: `${ex.id}-${s.id}`,
            subject_id: s.id,
            subject_name: s.subject_name,
            max_marks: 100,
            pass_marks: 33
          }));

      subjectsToProcess.forEach((sub) => {
        // Look up genuine teacher assignment for this class and subject
        const match = (assignmentList || []).find(a => 
          isSameClass(a.classes?.class_name, targetClass) && 
          a.subject_id === sub.subject_id
        );

        const assignedTeacherId = match?.teacher_id || null;
        const assignedTeacherName = match?.teachers?.name || 'Unassigned Faculty';

        // Genuine count from marks table
        const enteredCount = (allMarksList || []).filter(m => 
          m.exam_id === ex.id && 
          m.subject_id === sub.subject_id && 
          m.obtained_marks !== null
        ).length;

        let status: MarksWorkflowStatus = 'draft';
        if (enteredCount > 0 && enteredCount < totalStudents) {
          status = 'in_progress';
        } else if (enteredCount >= totalStudents && totalStudents > 0) {
          status = 'submitted';
        }

        // A persisted review_status (set by Submit/Verify/Reopen) takes
        // precedence over the marks-completeness estimate above — it's
        // the actual reviewer decision, not an inference.
        const esRow = esList.find(es => es.exam_id === ex.id && es.subject_id === sub.subject_id);
        if (esRow?.review_status && esRow.review_status !== 'pending') {
          status = esRow.review_status as MarksWorkflowStatus;
        }

        tasks.push({
          id: `${ex.id}-${sub.subject_id}`,
          exam_id: ex.id,
          exam_name: ex.exam_name,
          class_name: ex.class,
          section: match?.sections?.section_name || 'A',
          subject_id: sub.subject_id,
          subject_name: sub.subject_name,
          teacher_id: assignedTeacherId || 'unassigned',
          teacher_name: assignedTeacherName,
          total_students: totalStudents,
          entered_count: enteredCount,
          max_marks: sub.max_marks,
          pass_marks: sub.pass_marks,
          status,
          verified_at: esRow?.reviewed_at || undefined,
          reopen_reason: esRow?.reopen_reason || undefined
        });
      });
    });

    setTeacherTasks(tasks);
  };

  const loadMarksForExam = async (examId: string) => {
    try {
      const { data: marksData } = await supabase
        .from('marks')
        .select('*')
        .eq('exam_id', examId);

      const markMap: Record<string, Record<string, CBSEComponentMarks>> = {};
      (marksData || []).forEach(m => {
        if (!markMap[m.student_id]) markMap[m.student_id] = {};
        markMap[m.student_id][m.subject_id] = {
          periodic_test_marks: Number(m.periodic_test_marks) || 0,
          multiple_assessment_marks: Number(m.multiple_assessment_marks) || 0,
          portfolio_marks: Number(m.portfolio_marks) || 0,
          subject_enrichment_marks: Number(m.subject_enrichment_marks) || 0,
          annual_exam_marks: Number(m.annual_exam_marks) || 0,
          is_absent: !!m.is_absent
        };
      });

      setMarks(markMap);
    } catch (err) {
      console.error('Error loading marks for exam:', err);
    }
  };

  // Activate exam if navigated from Global Search or external link
  useEffect(() => {
    const examId = location.state?.selectedExamId;
    if (examId) {
      setSelectedExamId(examId);
      setMarksTargetExamId(examId);
      loadMarksForExam(examId);
      const target = exams.find(e => e.id === examId);
      if (target) {
        setMarksTargetClass(target.class);
      }
    }
  }, [location.state?.selectedExamId, exams]);

  // Handler for cell mark changes in ResultsView
  const handleMarkChange = (studentId: string, subjectId: string, field: keyof CBSEComponentMarks, value: any) => {
    setMarks(prev => {
      const studentObj = prev[studentId] ? { ...prev[studentId] } : {};
      const currentMarks: CBSEComponentMarks = studentObj[subjectId] ? { ...studentObj[subjectId] } : {
        periodic_test_marks: 0,
        multiple_assessment_marks: 0,
        portfolio_marks: 0,
        subject_enrichment_marks: 0,
        annual_exam_marks: 0,
        is_absent: false
      };

      (currentMarks as any)[field] = value;
      studentObj[subjectId] = currentMarks;

      return {
        ...prev,
        [studentId]: studentObj
      };
    });
  };

  // Bulk save marks via Supabase RPC or direct upsert
  const handleSaveMarks = async (examId: string) => {
    setIsSavingMarks(true);
    const toastId = toast.loading('Persisting CBSE 5-component marks...');

    try {
      const recordsToUpsert: any[] = [];
      const usedSubjectIds = new Set<string>();

      Object.entries(marks).forEach(([studentId, subjectMap]) => {
        Object.entries(subjectMap).forEach(([subjectId, m]) => {
          usedSubjectIds.add(subjectId);
          const total = computeComponentTotal(m);
          recordsToUpsert.push({
            exam_id: examId,
            student_id: studentId,
            subject_id: subjectId,
            periodic_test_marks: m.is_absent ? 0 : Number(m.periodic_test_marks) || 0,
            multiple_assessment_marks: m.is_absent ? 0 : Number(m.multiple_assessment_marks) || 0,
            portfolio_marks: m.is_absent ? 0 : Number(m.portfolio_marks) || 0,
            subject_enrichment_marks: m.is_absent ? 0 : Number(m.subject_enrichment_marks) || 0,
            annual_exam_marks: m.is_absent ? 0 : Number(m.annual_exam_marks) || 0,
            is_absent: !!m.is_absent,
            max_marks: 100,
            obtained_marks: m.is_absent ? 0 : total
          });
        });
      });

      if (recordsToUpsert.length === 0) {
        toast.info('No mark modifications detected to save.', { id: toastId });
        return;
      }

      // Auto-ensure exam_subjects entries exist so triggers don't throw foreign_key_violation
      for (const subId of Array.from(usedSubjectIds)) {
        const existing = examSubjects.find(es => es.exam_id === examId && es.subject_id === subId);
        if (!existing) {
          const subObj = subjects.find(s => s.id === subId);
          await supabase.from('exam_subjects').upsert({
            exam_id: examId,
            subject_id: subId,
            subject_name: subObj?.subject_name || 'Subject',
            max_marks: 100,
            pass_marks: 33
          }, { onConflict: 'exam_id,subject_id' });
        }
      }

      // Try save_marks RPC or direct upsert
      try {
        const { error: rpcErr } = await supabase.rpc('save_marks', {
          _exam_id: examId,
          _records: recordsToUpsert
        });
        if (rpcErr) throw rpcErr;
      } catch (rpcFailure) {
        // Fallback to direct upsert if RPC fails
        const { error: upErr } = await supabase
          .from('marks')
          .upsert(recordsToUpsert, { onConflict: 'exam_id,student_id,subject_id' });
        if (upErr) throw upErr;
      }

      toast.success(`Successfully committed ${recordsToUpsert.length} student mark entries!`, { id: toastId });
      await loadMarksForExam(examId);
    } catch (err: any) {
      console.error(err);
      toast.error('Marks save failed: ' + (err.message || 'Unknown database error'), { id: toastId });
    } finally {
      setIsSavingMarks(false);
    }
  };

  // Exam Master CRUD
  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examFormData.exam_name.trim()) {
      toast.error('Exam title is required.');
      return;
    }

    const toastId = toast.loading(editingExamId ? 'Updating exam...' : 'Creating exam master...');

    try {
      const selectedCls = classes.find(c => c.id === examFormData.class_id || c.class_name === examFormData.class);
      const selectedYr = academicYears.find(y => y.id === examFormData.academic_year_id || y.name === examFormData.academic_year);

      const payload = {
        exam_name: examFormData.exam_name,
        class: selectedCls?.class_name || examFormData.class,
        academic_year: selectedYr?.name || examFormData.academic_year,
        class_id: selectedCls?.id || classes[0]?.id,
        academic_year_id: selectedYr?.id || academicYears[0]?.id
      };

      if (editingExamId) {
        const { error } = await supabase.from('exams').update(payload).eq('id', editingExamId);
        if (error) throw error;
        toast.success('Exam details updated successfully!', { id: toastId });
      } else {
        const { data, error } = await supabase.from('exams').insert([payload]).select().single();
        if (error) throw error;
        
        // Auto-seed default exam_subjects for core subjects
        if (data && subjects.length > 0) {
          const defaultMappings = subjects.slice(0, 5).map(sub => ({
            exam_id: data.id,
            subject_id: sub.id,
            subject_name: sub.subject_name,
            max_marks: 100,
            pass_marks: 33
          }));
          await supabase.from('exam_subjects').insert(defaultMappings);
        }

        toast.success('New Examination Term created!', { id: toastId });
      }

      setShowExamModal(false);
      setEditingExamId(null);
      await fetchBaselineData();
    } catch (err: any) {
      console.error(err);
      toast.error('Operation failed: ' + err.message, { id: toastId });
    }
  };

  const handleDeleteExam = async (examId: string) => {
    if (!confirm('Are you sure you want to delete this examination instance and all associated records?')) return;
    try {
      await supabase.from('marks').delete().eq('exam_id', examId);
      await supabase.from('exam_results').delete().eq('exam_id', examId);
      await supabase.from('exam_subjects').delete().eq('exam_id', examId);
      const { error } = await supabase.from('exams').delete().eq('id', examId);
      if (error) throw error;

      toast.success('Exam instance deleted.');
      await fetchBaselineData();
    } catch (err: any) {
      toast.error('Could not delete exam: ' + err.message);
    }
  };

  // Open Subject Mapping & Teacher Assignment Drawer
  const handleOpenSubjectMapping = (exam: any) => {
    setTargetExamForMapping(exam);
    const existing = examSubjects.filter(es => es.exam_id === exam.id);
    if (existing.length > 0) {
      setMappedSubjectList(existing.map((es, idx) => {
        const assignedT = teachers[idx % Math.max(1, teachers.length)];
        return {
          subject_id: es.subject_id,
          subject_name: es.subject_name,
          max_marks: es.max_marks || 100,
          pass_marks: es.pass_marks || 33,
          teacher_id: assignedT?.id,
          teacher_name: assignedT?.name
        };
      }));
    } else {
      setMappedSubjectList(subjects.map((s, idx) => {
        const assignedT = teachers[idx % Math.max(1, teachers.length)];
        return {
          subject_id: s.id,
          subject_name: s.subject_name,
          max_marks: 100,
          pass_marks: 33,
          teacher_id: assignedT?.id,
          teacher_name: assignedT?.name
        };
      }));
    }
    setShowSubjectMappingModal(true);
  };

  const handleSaveSubjectMapping = async () => {
    if (!targetExamForMapping) return;
    const toastId = toast.loading('Saving configured subject mapping...');

    try {
      await supabase.from('exam_subjects').delete().eq('exam_id', targetExamForMapping.id);
      
      const payload = mappedSubjectList.map(m => ({
        exam_id: targetExamForMapping.id,
        subject_id: m.subject_id,
        subject_name: m.subject_name,
        max_marks: Number(m.max_marks) || 100,
        pass_marks: Number(m.pass_marks) || 33
      }));

      const { error } = await supabase.from('exam_subjects').insert(payload);
      if (error) throw error;

      toast.success('Subject mappings & assigned evaluators updated!', { id: toastId });
      setShowSubjectMappingModal(false);
      await fetchBaselineData();
    } catch (err: any) {
      toast.error('Mapping failed: ' + err.message, { id: toastId });
    }
  };

  // Workflow Handlers for Teacher Tasks
  const handleOpenMarksFromTask = (examId: string, subjectId: string, className: string) => {
    setMarksTargetExamId(examId);
    setMarksTargetSubjectId(subjectId);
    setMarksTargetClass(className);
    setTab('marks');
  };

  // Persists to exam_subjects.review_status (unique on exam_id+subject_id)
  // so the decision survives a refresh instead of living only in local
  // React state — compileTeacherTasks reads it back on every reload.
  const persistReviewStatus = async (
    task: TeacherExamTask,
    reviewStatus: 'submitted' | 'verified' | 'reopened',
    reopenReason?: string
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('exam_subjects').upsert(
      {
        exam_id: task.exam_id,
        subject_id: task.subject_id,
        subject_name: task.subject_name,
        max_marks: task.max_marks,
        pass_marks: task.pass_marks,
        review_status: reviewStatus,
        reopen_reason: reopenReason ?? null,
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString()
      },
      { onConflict: 'exam_id,subject_id' }
    );
    if (error) throw error;
  };

  const handleSubmitTask = async (taskId: string) => {
    const task = teacherTasks.find(t => t.id === taskId);
    if (!task) return;
    if (task.entered_count < task.total_students) {
      toast.error(`Marks are only entered for ${task.entered_count}/${task.total_students} students — complete the gradebook before submitting.`);
      return;
    }
    try {
      await persistReviewStatus(task, 'submitted');
      setTeacherTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'submitted' } : t));
      toast.success('Assessment gradebook submitted to Examination Controller for audit.');
    } catch (err: any) {
      toast.error('Could not submit: ' + err.message);
    }
  };

  const handleVerifyTask = async (taskId: string) => {
    const task = teacherTasks.find(t => t.id === taskId);
    if (!task) return;
    try {
      await persistReviewStatus(task, 'verified');
      setTeacherTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'verified' } : t));
      toast.success('Assessment verified and cleared for final result calculation.');
    } catch (err: any) {
      toast.error('Could not verify: ' + err.message);
    }
  };

  const handleReopenTask = async (taskId: string, reason: string) => {
    const task = teacherTasks.find(t => t.id === taskId);
    if (!task) return;
    try {
      await persistReviewStatus(task, 'reopened', reason);
      setTeacherTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'in_progress', reopen_reason: reason } : t));
      toast.info('Assessment reopened for faculty corrections.');
    } catch (err: any) {
      toast.error('Could not reopen: ' + err.message);
    }
  };

  const handleAssignTeacher = async (taskId: string, teacherId: string, teacherName: string) => {
    // Local-only: reassigning the evaluator for real requires resolving
    // this task's class/section/subject to teacher_assignments' class_id/
    // section_id/academic_year_id foreign keys, which this view doesn't
    // currently resolve. Reflects immediately here; go to Academic
    // Assignments to make it permanent.
    setTeacherTasks(prev => prev.map(t => t.id === taskId ? { ...t, teacher_id: teacherId, teacher_name: teacherName } : t));
    toast.success(`Showing ${teacherName} as evaluator for this session. Update Academic Assignments to make this permanent.`);
  };

  // The useEffect above redirects away; avoid flashing gated content first.
  if (!canViewTab) return null;

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16">
      {/* 1. Master Page Header Banner */}
      <AdminHeader
        title="Examination & Gradebook System"
        subtitle="CBSE 5-component assessments, teacher workload assignments, verification workflows, and official report cards."
        badge={{
          icon: GraduationCap,
          text: 'CBSE Secondary & Assessment Hub',
          variant: 'violet'
        }}
        sessionBadge="Session: 2026-27"
        actions={
          can('results.publish') ? (
            <button
              onClick={() => {
                setEditingExamId(null);
                setShowExamModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shadow-blue-500/20 cursor-pointer active:scale-95"
            >
              <Plus size={15} />
              <span>Create Exam Term</span>
            </button>
          ) : undefined
        }
      />

      {/* 2. Workspace Navigation Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 shadow-2xs overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {[
            { id: 'overview', label: 'Overview', icon: Trophy },
            { id: 'tasks', label: 'My Examination Tasks', icon: UserCheck },
            { id: 'exams', label: 'Exams & Teacher Mapping', icon: Layers, permission: 'results.publish' },
            { id: 'marks', label: 'CBSE Marks Entry', icon: ClipboardList },
            { id: 'results', label: 'Result Processing & Publish', icon: Award, permission: 'results.publish' },
            { id: 'reports', label: 'Report Cards Hub', icon: FileText },
            { id: 'schedule', label: 'Schedule & Admit Cards', icon: Calendar },
            { id: 'analytics', label: 'Performance Analytics', icon: BarChart3 },
            { id: 'config', label: 'CBSE Rules & Grading', icon: Settings }
          ].filter(tab => !tab.permission || can(tab.permission)).map(tab => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  isActive 
                    ? "bg-slate-900 text-white shadow-xs" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <tab.icon size={14} className={isActive ? "text-violet-400" : "text-slate-400"} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Dynamic Tab Workspace Content */}
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
              {/* Top KPI row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <AdminStatCard
                  label="Active Assessments"
                  value={exams.length}
                  subtext={`Across ${classes.length} class${classes.length === 1 ? '' : 'es'}`}
                  icon={Layers}
                  variant="violet"
                />
                <AdminStatCard
                  label="Assigned Tasks"
                  value={teacherTasks.length}
                  subtext="Subject evaluation slots"
                  icon={UserCheck}
                  variant="primary"
                />
                <AdminStatCard
                  label="Pending Review"
                  value={teacherTasks.filter(t => t.status === 'submitted').length}
                  subtext="Awaiting coordinator signoff"
                  icon={Clock}
                  variant="amber"
                />
                <AdminStatCard
                  label="Registered Candidates"
                  value={students.length}
                  subtext="Active student directory"
                  icon={Users}
                  variant="emerald"
                />
              </div>

              {/* Quick Actions & Recent Assessment Work */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Active Exams Summary */}
                <div className="lg:col-span-2 bg-white border border-slate-200/60 rounded-[22px] p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Current Examination Schedule</h3>
                      <p className="text-slate-400 text-[10px]">Ongoing session assessments</p>
                    </div>
                    <button 
                      onClick={() => setTab('exams')}
                      className="text-xs font-bold text-violet-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Manage Exams <ArrowRight size={12} />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {exams.slice(0, 4).map(ex => (
                      <div key={ex.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-violet-100/70 text-violet-700">
                            <GraduationCap size={16} />
                          </div>
                          <div>
                            <h4 className="text-xs font-extrabold text-slate-900">{ex.exam_name}</h4>
                            <p className="text-[10px] text-slate-400 font-semibold">{formatClassDisplay(ex.class)} • {ex.academic_year}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setMarksTargetExamId(ex.id);
                              setMarksTargetClass(ex.class);
                              setTab('marks');
                            }}
                            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-violet-50 text-violet-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Enter Marks
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Task Shortcuts */}
                <div className="bg-white border border-slate-200/60 rounded-[22px] p-5 shadow-2xs flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-1">Examination Quick Actions</h3>
                    <p className="text-slate-400 text-[10px] mb-3">Instant links to core assessment subsystems</p>

                    <div className="space-y-2">
                      {[
                        { label: 'My Assigned Workload', desc: 'View tasks allocated to you', tab: 'tasks', icon: UserCheck },
                        { label: 'Result Processing Engine', desc: 'Compute totals, grades, ranks', tab: 'results', icon: Award },
                        { label: 'Print CBSE Report Cards', desc: 'Official annual grade cards', tab: 'reports', icon: FileText },
                        { label: 'Admit Cards & Hall Tickets', desc: 'Exam entrance passes', tab: 'schedule', sub: 'admitCard', icon: Calendar }
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
                          className="w-full text-left p-2.5 rounded-xl border border-slate-100 hover:border-violet-200 hover:bg-violet-50/50 transition-all flex items-center justify-between group cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                              <action.icon size={13} />
                            </div>
                            <div>
                              <strong className="block text-xs text-slate-800 group-hover:text-violet-700">{action.label}</strong>
                              <span className="text-[9.5px] text-slate-400 font-medium">{action.desc}</span>
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-slate-300 group-hover:text-violet-600 transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-violet-50 border border-violet-100 rounded-xl text-[10px] text-violet-800 font-medium">
                    <strong>CBSE Compliance Notice:</strong> Assessments strictly scale to 100 marks (20 Internal + 80 Annual Theory).
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
              onSubmitTask={handleSubmitTask}
              onVerifyTask={handleVerifyTask}
              onReopenTask={handleReopenTask}
              onAssignTeacher={handleAssignTeacher}
            />
          )}

          {/* TAB 2: EXAMS & TEACHER MAPPING MASTER */}
          {currentTab === 'exams' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200/60 shadow-2xs rounded-[22px] overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Active Examination Terms & Evaluators</h3>
                    <p className="text-slate-400 text-[10px]">Configured academic assessments linked to classes, curriculum subjects, and assigned teachers</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-100">
                    {exams.length} Assessments Active
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-[9.5px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="py-3.5 px-5">Assessment Term</th>
                        <th className="py-3.5 px-4 text-center">Class Scope</th>
                        <th className="py-3.5 px-4 text-center">Session</th>
                        <th className="py-3.5 px-4 text-center">Mapped Subjects & Teachers</th>
                        <th className="py-3.5 px-4 text-center">Evaluation Format</th>
                        <th className="py-3.5 px-4 text-right pr-5">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/70 text-slate-700 font-semibold">
                      {isLoading ? (
                        <tr>
                          <td colSpan={6} className="py-16 text-center text-slate-400 font-bold">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-600" />
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
                          const mappedCount = examSubjects.filter(es => es.exam_id === ex.id).length;
                          const isSelected = selectedExamId === ex.id;
                          return (
                            <tr 
                              key={ex.id} 
                              className={cn(
                                "hover:bg-slate-50/40 transition-colors", 
                                isSelected && "bg-violet-50/80 ring-2 ring-violet-500/40 font-bold"
                              )}
                            >
                              <td className="py-3 px-5 font-bold text-slate-900 flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-violet-50 text-violet-600">
                                  <GraduationCap size={14} />
                                </div>
                                <span>{ex.exam_name}</span>
                                {isSelected && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-violet-600 text-white shadow-2xs">
                                    Active Focus
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                  {formatClassDisplay(ex.class)}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center font-mono font-bold text-slate-600">
                                {ex.academic_year}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  onClick={() => handleOpenSubjectMapping(ex)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-violet-50 text-violet-700 border border-slate-200 hover:border-violet-200 text-[10.5px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto"
                                >
                                  <UserCheck size={12} />
                                  <span>{mappedCount > 0 ? `${mappedCount} Subjects Mapped` : 'Map Subjects & Evaluators'}</span>
                                </button>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  CBSE 5-Component (100 Marks)
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right pr-5">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingExamId(ex.id);
                                      setExamFormData({
                                        exam_name: ex.exam_name,
                                        class: ex.class,
                                        academic_year: ex.academic_year,
                                        class_id: ex.class_id || '',
                                        academic_year_id: ex.academic_year_id || ''
                                      });
                                      setShowExamModal(true);
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                                    title="Edit Exam"
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
              students={students}
              subjects={subjects}
              marks={marks}
              isLoading={isLoading}
              isSaving={isSavingMarks}
              onMarkChange={handleMarkChange}
              onSave={handleSaveMarks}
              onExamChange={loadMarksForExam}
              initialExamId={marksTargetExamId || selectedExamId || undefined}
              initialSubjectId={marksTargetSubjectId}
              initialClass={marksTargetClass}
            />
          )}

          {/* TAB 4: RESULT PROCESSING & PUBLICATION */}
          {currentTab === 'results' && (
            <ResultProcessingView />
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
                      reportSubMode === 'final' ? "bg-violet-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    Official CBSE Annual Report Card
                  </button>
                  <button
                    onClick={() => setReportSubMode('coscholastic')}
                    className={cn(
                      "px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                      reportSubMode === 'coscholastic' ? "bg-violet-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    Co-Scholastic & Life Skills Evaluator
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
                  {/* Creating/editing datesheets and venues is an exam-office
                      action; everyone with results.view (which is what gets
                      you onto this tab at all) may still look up admit cards. */}
                  {can('results.publish') && (
                    <button
                      onClick={() => setScheduleSubMode('datesheet')}
                      className={cn(
                        "px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                        scheduleSubMode === 'datesheet' ? "bg-violet-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      Examination Datesheets & Venues
                    </button>
                  )}
                  <button
                    onClick={() => setScheduleSubMode('admitCard')}
                    className={cn(
                      "px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                      scheduleSubMode === 'admitCard' ? "bg-violet-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    CBSE Admit Cards & Hall Tickets
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
          <div className="bg-white rounded-[24px] border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                {editingExamId ? 'Edit Examination Master' : 'Create New Examination Term'}
              </h3>
              <button onClick={() => setShowExamModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveExam} className="p-5 space-y-4 text-xs font-semibold text-slate-700">
              <div className="flex flex-col">
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1">CBSE Assessment Tier</label>
                <select 
                  onChange={(e) => {
                    const sel = assessmentTypes.find(a => a.code === e.target.value);
                    if (sel) {
                      setExamFormData(prev => ({
                        ...prev,
                        exam_name: sel.name
                      }));
                    }
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold outline-none cursor-pointer focus:border-violet-500 focus:bg-white"
                >
                  <option value="">Select standard assessment tier...</option>
                  {assessmentTypes.map(a => (
                    <option key={a.code} value={a.code}>{a.name} ({a.is_board_exam ? 'Board' : 'School'})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1">Assessment Title</label>
                <input 
                  type="text" 
                  value={examFormData.exam_name}
                  onChange={(e) => setExamFormData({ ...examFormData, exam_name: e.target.value })}
                  placeholder="e.g. Periodic Test 1 / Mid-Term Examination"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold outline-none focus:border-violet-500 focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1">Target Class</label>
                  <select 
                    value={examFormData.class_id || examFormData.class}
                    onChange={(e) => {
                      const sel = classes.find(c => c.id === e.target.value || c.class_name === e.target.value);
                      setExamFormData({
                        ...examFormData,
                        class_id: sel?.id || '',
                        class: sel?.class_name || e.target.value
                      });
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none cursor-pointer"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{formatClassDisplay(c.class_name)}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1">Academic Year</label>
                  <select 
                    value={examFormData.academic_year_id || examFormData.academic_year}
                    onChange={(e) => {
                      const sel = academicYears.find(y => y.id === e.target.value || y.name === e.target.value);
                      setExamFormData({
                        ...examFormData,
                        academic_year_id: sel?.id || '',
                        academic_year: sel?.name || e.target.value
                      });
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none cursor-pointer"
                  >
                    {academicYears.map(y => (
                      <option key={y.id} value={y.id}>{y.name} {y.is_current ? '(Current)' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowExamModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-md shadow-violet-500/15"
                >
                  {editingExamId ? 'Save Changes' : 'Confirm & Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBJECT MAPPING & TEACHER ASSIGNMENT MODAL */}
      {showSubjectMappingModal && targetExamForMapping && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-fadeIn">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Map Subjects & Assign Evaluators</h3>
                <p className="text-slate-400 text-[10px] mt-0.5">{targetExamForMapping.exam_name} • {formatClassDisplay(targetExamForMapping.class)}</p>
              </div>
              <button onClick={() => setShowSubjectMappingModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="text-[10px] font-black uppercase text-slate-400 grid grid-cols-[1.5fr_1.5fr_70px_70px] gap-2 px-2">
                <span>Subject Name</span>
                <span>Assigned Evaluator</span>
                <span className="text-center">Max Marks</span>
                <span className="text-center">Pass Marks</span>
              </div>

              {mappedSubjectList.map((item, idx) => (
                <div key={item.subject_id} className="grid grid-cols-[1.5fr_1.5fr_70px_70px] gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <span className="font-bold text-slate-800 text-xs truncate px-2">{item.subject_name}</span>
                  
                  {/* Teacher assignment selector */}
                  <select
                    value={item.teacher_id || ''}
                    onChange={(e) => {
                      const selT = teachers.find(t => t.id === e.target.value);
                      const updated = [...mappedSubjectList];
                      updated[idx].teacher_id = e.target.value;
                      updated[idx].teacher_name = selT?.name || '';
                      setMappedSubjectList(updated);
                    }}
                    className="bg-white border border-slate-200 rounded-lg py-1 px-2 text-xs font-bold text-slate-700 outline-none truncate"
                  >
                    <option value="">Choose Evaluator...</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>

                  <input 
                    type="number"
                    value={item.max_marks}
                    onChange={(e) => {
                      const updated = [...mappedSubjectList];
                      updated[idx].max_marks = Number(e.target.value) || 100;
                      setMappedSubjectList(updated);
                    }}
                    className="bg-white border border-slate-200 rounded-lg py-1 text-center font-mono font-bold text-xs outline-none"
                  />
                  <input 
                    type="number"
                    value={item.pass_marks}
                    onChange={(e) => {
                      const updated = [...mappedSubjectList];
                      updated[idx].pass_marks = Number(e.target.value) || 33;
                      setMappedSubjectList(updated);
                    }}
                    className="bg-white border border-slate-200 rounded-lg py-1 text-center font-mono font-bold text-xs outline-none"
                  />
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50">
              <button 
                type="button" 
                onClick={() => setShowSubjectMappingModal(false)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleSaveSubjectMapping}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-md shadow-violet-500/15"
              >
                Save Mappings & Evaluators
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
