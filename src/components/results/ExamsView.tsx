import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  BookOpen, 
  Layers, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  ChevronRight,
  Settings2,
  Users,
  Award,
  Sparkles,
  Lock,
  Unlock,
  Check,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { examinationService, ExamRecord, AssessmentType, ExamSubjectRecord } from '@/services/examinationService';
import { useAuth } from '@/context/AuthContext';

interface ExamsViewProps {
  academicYears: any[];
  classes: any[];
  subjects: any[];
  teachers: any[];
  selectedYearId: string;
  onNavigateTab: (tab: string, extraParams?: Record<string, string>) => void;
}

export default function ExamsView({
  academicYears,
  classes,
  subjects,
  teachers,
  selectedYearId,
  onNavigateTab
}: ExamsViewProps) {
  const { user, can } = useAuth();

  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create / Edit Modal State
  const [showExamModal, setShowExamModal] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [examName, setExamName] = useState('');
  const [shortName, setShortName] = useState('');
  const [examType, setExamType] = useState('Periodic Assessment');
  const [academicYearId, setAcademicYearId] = useState(selectedYearId || '');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [marksStartDate, setMarksStartDate] = useState('');
  const [marksDeadline, setMarksDeadline] = useState('');
  const [resultPublishDate, setResultPublishDate] = useState('');
  const [status, setStatus] = useState<any>('draft');
  const [instructions, setInstructions] = useState('');
  const [description, setDescription] = useState('');

  // Subject Configuration Drawer State
  const [configuringExam, setConfiguringExam] = useState<ExamRecord | null>(null);
  const [examSubjectsList, setExamSubjectsList] = useState<ExamSubjectRecord[]>([]);
  const [isSavingSubjects, setIsSavingSubjects] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Partial<ExamSubjectRecord> | null>(null);

  useEffect(() => {
    fetchExamsAndTypes();
  }, [selectedYearId, selectedClassId]);

  const fetchExamsAndTypes = async () => {
    setIsLoading(true);
    try {
      const [examsData, typesData] = await Promise.all([
        examinationService.getExams({
          academicYearId: selectedYearId,
          classId: selectedClassId
        }),
        examinationService.getExamTypes()
      ]);
      setExams(examsData);
      setAssessmentTypes(typesData);
    } catch (err: any) {
      console.error('Failed to load exams:', err);
      toast.error('Failed to load examinations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingExam(null);
    setExamName('');
    setShortName('');
    setExamType(assessmentTypes[0]?.name || 'Periodic Assessment');
    setAcademicYearId(selectedYearId || academicYears[0]?.id || '');
    setSelectedClassIds(classes.length > 0 ? [classes[0].id] : []);
    setStartDate('');
    setEndDate('');
    setMarksStartDate('');
    setMarksDeadline('');
    setResultPublishDate('');
    setStatus('draft');
    setInstructions('');
    setDescription('');
    setShowExamModal(true);
  };

  const handleOpenEditModal = (exam: ExamRecord) => {
    setEditingExam(exam);
    setExamName(exam.exam_name);
    setShortName(exam.short_name || '');
    setExamType(exam.exam_type || 'Periodic Assessment');
    setAcademicYearId(exam.academic_year_id);
    setSelectedClassIds([exam.class_id]);
    setStartDate(exam.start_date || '');
    setEndDate(exam.end_date || '');
    setMarksStartDate(exam.marks_entry_start_date || '');
    setMarksDeadline(exam.marks_entry_deadline || '');
    setResultPublishDate(exam.result_publish_date || '');
    setStatus(exam.status || 'draft');
    setInstructions(exam.instructions || '');
    setDescription(exam.description || '');
    setShowExamModal(true);
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examName.trim()) {
      toast.error('Exam name is required.');
      return;
    }
    if (selectedClassIds.length === 0) {
      toast.error('Select at least one applicable class.');
      return;
    }

    const selectedYearObj = academicYears.find(y => y.id === academicYearId);

    setIsSubmitting(true);
    try {
      if (editingExam) {
        await examinationService.updateExam(editingExam.id, {
          exam_name: examName.trim(),
          short_name: shortName.trim() || examName.trim(),
          exam_type: examType,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          marks_entry_start_date: marksStartDate || undefined,
          marks_entry_deadline: marksDeadline || undefined,
          result_publish_date: resultPublishDate || undefined,
          status,
          instructions: instructions.trim() || undefined,
          description: description.trim() || undefined
        });
        toast.success(`Exam "${examName}" updated successfully.`);
      } else {
        await examinationService.createExam({
          exam_name: examName.trim(),
          short_name: shortName.trim() || examName.trim(),
          exam_type: examType,
          academic_year: selectedYearObj?.name || '2026-27',
          academic_year_id: academicYearId,
          class_ids: selectedClassIds,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          marks_entry_start_date: marksStartDate || undefined,
          marks_entry_deadline: marksDeadline || undefined,
          result_publish_date: resultPublishDate || undefined,
          instructions: instructions.trim() || undefined,
          description: description.trim() || undefined
        });
        toast.success(`Created exam terms for ${selectedClassIds.length} class(es).`);
      }

      setShowExamModal(false);
      fetchExamsAndTypes();
    } catch (err: any) {
      console.error('Save exam error:', err);
      toast.error(err.message || 'Failed to save examination term');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExam = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete exam "${name}"? All associated marks and results will be permanently removed.`)) {
      return;
    }

    try {
      await examinationService.deleteExam(id);
      toast.success(`Exam "${name}" deleted.`);
      fetchExamsAndTypes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete exam');
    }
  };

  // Open Subject Marks Configuration Drawer
  const handleOpenSubjectConfig = (exam: ExamRecord) => {
    setConfiguringExam(exam);
    setExamSubjectsList(exam.exam_subjects || []);
    setEditingSubject(null);
  };

  const handleSaveExamSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configuringExam || !editingSubject?.subject_id) {
      toast.error('Select a subject.');
      return;
    }

    const subObj = subjects.find(s => s.id === editingSubject.subject_id);

    setIsSavingSubjects(true);
    try {
      await examinationService.saveExamSubject({
        id: editingSubject.id,
        exam_id: configuringExam.id,
        class_id: configuringExam.class_id,
        subject_id: editingSubject.subject_id,
        subject_name: subObj?.subject_name || editingSubject.subject_name || 'Subject',
        max_marks: Number(editingSubject.max_marks) || 100,
        pass_marks: Number(editingSubject.pass_marks) || 33,
        teacher_id: editingSubject.teacher_id || undefined,
        component_name: editingSubject.component_name || 'Theory',
        exam_date: editingSubject.exam_date || undefined,
        start_time: editingSubject.start_time || '09:00 AM',
        end_time: editingSubject.end_time || '10:00 AM',
        room: editingSubject.room || undefined,
        instructions: editingSubject.instructions || undefined
      });

      toast.success('Subject marks scheme configured.');
      setEditingSubject(null);

      // Refresh exam list
      const refreshed = await examinationService.getExams({ academicYearId: selectedYearId });
      setExams(refreshed);
      const updatedExam = refreshed.find(e => e.id === configuringExam.id);
      if (updatedExam) {
        setConfiguringExam(updatedExam);
        setExamSubjectsList(updatedExam.exam_subjects || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to configure subject');
    } finally {
      setIsSavingSubjects(false);
    }
  };

  const handleDeleteSubject = async (subId: string) => {
    if (!window.confirm('Remove this subject from the examination term?')) return;
    try {
      await examinationService.deleteExamSubject(subId);
      toast.success('Subject removed.');
      if (configuringExam) {
        const refreshed = await examinationService.getExams({ academicYearId: selectedYearId });
        setExams(refreshed);
        const updatedExam = refreshed.find(e => e.id === configuringExam.id);
        if (updatedExam) {
          setConfiguringExam(updatedExam);
          setExamSubjectsList(updatedExam.exam_subjects || []);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove subject');
    }
  };

  // Filtered Exams
  const filteredExams = useMemo(() => {
    return exams.filter(e => {
      const matchStatus = statusFilter === 'all' || e.status === statusFilter;
      const matchSearch = !searchQuery || 
        e.exam_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.short_name && e.short_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        e.class.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [exams, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header Controls & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search exams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Class Filter */}
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-700"
          >
            <option value="all">All Classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>Class {c.class_name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-700"
          >
            <option value="all">All Lifecycle Statuses</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="marks_entry_open">Marks Entry Open</option>
            <option value="review">Review</option>
            <option value="locked">Locked</option>
            <option value="result_processed">Result Processed</option>
            <option value="published">Published</option>
          </select>
        </div>

        {can('results.publish') && (
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus size={14} /> Create Examination Term
          </button>
        )}
      </div>

      {/* Main Exams Grid */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-xs font-bold text-slate-500">Loading examinations...</p>
        </div>
      ) : filteredExams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExams.map(exam => {
            const subjectCount = exam.exam_subjects?.length || 0;
            return (
              <div 
                key={exam.id}
                className="bg-white border border-slate-200/80 hover:border-blue-300 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200/60 rounded-full font-black text-[10px] uppercase">
                        {exam.exam_type || 'Periodic Assessment'}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mt-1">{exam.exam_name}</h4>
                      {exam.short_name && (
                        <span className="text-[11px] font-mono text-slate-400 block">{exam.short_name}</span>
                      )}
                    </div>

                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0",
                      exam.status === 'published' ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                      exam.status === 'result_processed' ? "bg-purple-100 text-purple-800 border border-purple-200" :
                      exam.status === 'locked' ? "bg-slate-100 text-slate-800 border border-slate-300" :
                      exam.status === 'review' ? "bg-indigo-100 text-indigo-800 border border-indigo-200" :
                      "bg-amber-100 text-amber-800 border border-amber-200"
                    )}>
                      {exam.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Class</span>
                      <span className="font-bold text-slate-800">Class {exam.class}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Session</span>
                      <span className="font-bold text-slate-800">{exam.academic_year}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Start Date</span>
                      <span className="font-medium text-slate-600">{exam.start_date || 'Not set'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Configured Subjects</span>
                      <span className="font-bold font-mono text-blue-700">{subjectCount} Subjects</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenSubjectConfig(exam)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold transition-colors flex items-center gap-1 cursor-pointer text-xs"
                      title="Configure Subject Marks Schemes"
                    >
                      <Settings2 size={13} className="text-blue-600" />
                      Configure ({subjectCount})
                    </button>

                    <button
                      onClick={() => onNavigateTab('schedule', { examId: exam.id, classId: exam.class_id })}
                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold transition-colors flex items-center gap-1 cursor-pointer text-xs"
                    >
                      <Calendar size={13} />
                      Schedule
                    </button>
                  </div>

                  {can('results.publish') && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(exam)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                        title="Edit Exam"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteExam(exam.id, exam.exam_name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Delete Exam"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-16 text-center bg-white border border-slate-200/80 rounded-2xl p-8 shadow-xs">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-700">No Examinations Found</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            No examination records match the current filter. Create your first exam term to begin the examination lifecycle.
          </p>
          {can('results.publish') && (
            <button
              onClick={handleOpenCreateModal}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Plus size={14} /> Create Exam Term
            </button>
          )}
        </div>
      )}

      {/* CREATE / EDIT EXAM MODAL */}
      {showExamModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingExam ? 'Edit Examination Term' : 'Create New Examination Term'}
                </h3>
                <p className="text-xs text-slate-500">
                  Define the exam name, academic year, exam type, and target classes.
                </p>
              </div>
              <button
                onClick={() => setShowExamModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveExam} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Exam Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Periodic Assessment 1"
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Short Name / Code</label>
                  <input
                    type="text"
                    placeholder="e.g. PA-1"
                    value={shortName}
                    onChange={(e) => setShortName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Exam Type *</label>
                  <select
                    value={examType}
                    onChange={(e) => setExamType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {assessmentTypes.map(t => (
                      <option key={t.id} value={t.name}>{t.name} ({t.code})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Academic Year *</label>
                  <select
                    disabled={Boolean(editingExam)}
                    value={academicYearId}
                    onChange={(e) => setAcademicYearId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
                  >
                    {academicYears.map(y => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Applicable Classes */}
              <div className="space-y-1 text-xs">
                <label className="font-bold text-slate-700">Applicable Classes *</label>
                {editingExam ? (
                  <p className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800">
                    Class {editingExam.class}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-36 overflow-y-auto">
                    {classes.map(c => {
                      const checked = selectedClassIds.includes(c.id);
                      return (
                        <label 
                          key={c.id} 
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs font-bold transition-colors",
                            checked ? "bg-blue-100/70 text-blue-900" : "hover:bg-slate-200/60 text-slate-700"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedClassIds([...selectedClassIds, c.id]);
                              } else {
                                setSelectedClassIds(selectedClassIds.filter(id => id !== c.id));
                              }
                            }}
                            className="rounded text-blue-600"
                          />
                          Class {c.class_name}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Marks Entry Deadline</label>
                  <input
                    type="date"
                    value={marksDeadline}
                    onChange={(e) => setMarksDeadline(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-1 text-xs">
                <label className="font-bold text-slate-700">Instructions & Notes</label>
                <textarea
                  rows={2}
                  placeholder="Instructions for students and invigilators..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowExamModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save size={14} />}
                  {editingExam ? 'Save Changes' : 'Create Examination'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBJECT MARKS SCHEME CONFIGURATION DRAWER */}
      {configuringExam && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-800 rounded-full font-black text-[10px] uppercase">
                  Class {configuringExam.class} • {configuringExam.academic_year}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Subject Marks Scheme &amp; Evaluator Assignment
                </h3>
                <p className="text-xs text-slate-500">
                  Configure maximum marks, passing marks, and assign teachers for "{configuringExam.exam_name}".
                </p>
              </div>
              <button
                onClick={() => setConfiguringExam(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Edit / Add Subject Form */}
            {editingSubject ? (
              <form onSubmit={handleSaveExamSubject} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <h4 className="text-xs font-bold text-slate-900">
                    {editingSubject.id ? 'Edit Subject Configuration' : 'Add Subject to Exam'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setEditingSubject(null)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Subject *</label>
                    <select
                      value={editingSubject.subject_id || ''}
                      onChange={(e) => {
                        const s = subjects.find(sub => sub.id === e.target.value);
                        setEditingSubject({
                          ...editingSubject,
                          subject_id: e.target.value,
                          subject_name: s?.subject_name || ''
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">Select Subject</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.subject_name} ({s.subject_code || '—'})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Assigned Evaluator Teacher</label>
                    <select
                      value={editingSubject.teacher_id || ''}
                      onChange={(e) => setEditingSubject({ ...editingSubject, teacher_id: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">Unassigned</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.employee_id || 'Staff'})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Maximum Marks *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={200}
                      value={editingSubject.max_marks || 20}
                      onChange={(e) => setEditingSubject({ ...editingSubject, max_marks: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Passing Marks *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={editingSubject.max_marks || 200}
                      value={editingSubject.pass_marks || 7}
                      onChange={(e) => setEditingSubject({ ...editingSubject, pass_marks: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Component Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Theory, Practical, Periodic Assessment"
                      value={editingSubject.component_name || 'Periodic Assessment'}
                      onChange={(e) => setEditingSubject({ ...editingSubject, component_name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSavingSubjects}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    {isSavingSubjects ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check size={13} />}
                    Save Subject Configuration
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700">
                  Configured Subjects ({examSubjectsList.length})
                </span>
                <button
                  onClick={() => setEditingSubject({ max_marks: 20, pass_marks: 7, component_name: configuringExam.short_name || 'Periodic Assessment' })}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={13} /> Add Subject
                </button>
              </div>
            )}

            {/* Subject List Table */}
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200">
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4 text-center">Max Marks</th>
                    <th className="py-3 px-4 text-center">Pass Marks</th>
                    <th className="py-3 px-4">Evaluator</th>
                    <th className="py-3 px-4 text-center">Review Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {examSubjectsList.length > 0 ? (
                    examSubjectsList.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {s.subject_name}
                          <span className="text-[10px] text-slate-400 block font-normal">{s.component_name || 'Assessment'}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">{s.max_marks}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-500">{s.pass_marks}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-700 block">
                            {s.teachers?.name || 'Unassigned'}
                          </span>
                          {s.teachers?.employee_id && (
                            <span className="text-[10px] text-slate-400 font-mono">{s.teachers.employee_id}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                            s.review_status === 'approved' ? "bg-emerald-100 text-emerald-800" :
                            s.review_status === 'submitted' ? "bg-indigo-100 text-indigo-800" :
                            s.review_status === 'returned' ? "bg-rose-100 text-rose-800" :
                            "bg-slate-100 text-slate-700"
                          )}>
                            {s.review_status || 'draft'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditingSubject(s)}
                              className="p-1 text-slate-500 hover:text-blue-600 rounded hover:bg-slate-100"
                              title="Edit Scheme"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteSubject(s.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100"
                              title="Remove"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400 text-xs">
                        No subjects configured yet for this examination.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setConfiguringExam(null)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
