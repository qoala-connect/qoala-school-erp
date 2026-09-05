import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  X, BookOpen, GraduationCap, AlertTriangle, CheckCircle2, 
  Layers, Calendar, Award, Loader2, Save
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  Teacher, 
  TeacherAssignment, 
  AssignmentType,
  saveAssignment,
  checkAssignmentConflicts,
  AssignmentConflict
} from '@/services/teacherService';
import { supabase } from '@/lib/supabase';

/**
 * What the caller already knows about the gap it is trying to fill.
 *
 * Academics links here from a class-subject row that has no teacher, so it
 * can name the year, class, section and subject. Anything it cannot name,
 * such as the section of a whole-class mapping, is left for the user.
 */
export interface AssignmentPrefill {
  academicYearId?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  subjectId?: string | null;
  assignmentType?: AssignmentType;
}

interface TeacherAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTeacher?: Teacher | null;
  teachers: Teacher[];
  onAssigned: () => void;
  prefill?: AssignmentPrefill | null;
}

export default function TeacherAssignmentModal({
  isOpen,
  onClose,
  selectedTeacher,
  teachers,
  onAssigned,
  prefill
}: TeacherAssignmentModalProps) {
  const [teacherId, setTeacherId] = useState<string>('');
  const [academicYearId, setAcademicYearId] = useState<string>('');
  const [classId, setClassId] = useState<string>('');
  const [sectionId, setSectionId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [assignmentType, setAssignmentType] = useState<AssignmentType>('subject_teacher');
  // True while the subject list is the class's own curriculum rather than
  // the whole subject master.
  const [subjectsAreMapped, setSubjectsAreMapped] = useState(false);

  const [academicYears, setAcademicYears] = useState<Array<{ id: string; name: string; is_current: boolean }>>([]);
  const [classes, setClasses] = useState<Array<{ id: string; class_name: string }>>([]);
  const [sections, setSections] = useState<Array<{ id: string; section_name: string }>>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; subject_name: string }>>([]);

  const [conflict, setConflict] = useState<AssignmentConflict | null>(null);
  const [isCheckingConflict, setIsCheckingConflict] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Read as primitives so a caller passing a fresh prefill object on every
  // render cannot turn the loader below into a render loop.
  const prefillYearId = prefill?.academicYearId ?? null;
  const prefillClassId = prefill?.classId ?? null;
  const prefillSectionId = prefill?.sectionId ?? null;
  const prefillSubjectId = prefill?.subjectId ?? null;
  const prefillType = prefill?.assignmentType ?? null;

  useEffect(() => {
    if (!isOpen) return;

    if (selectedTeacher) {
      setTeacherId(selectedTeacher.id);
    } else if (teachers.length > 0) {
      setTeacherId(teachers[0].id);
    }

    if (prefillType) setAssignmentType(prefillType);

    /** A prefilled id is only honoured if the school actually still has that row. */
    const pick = (wanted: string | null, rows: Array<{ id: string }>, fallback: string) =>
      wanted && rows.some(r => r.id === wanted) ? wanted : fallback;

    // Fetch baseline context
    async function loadAcademicStructure() {
      const [yrs, cls, subs] = await Promise.all([
        supabase.from('academic_years').select('id, name, is_current').order('start_date', { ascending: false }),
        supabase.from('classes').select('id, class_name').order('class_name'),
        supabase.from('subjects').select('id, subject_name').order('subject_name')
      ]);

      if (yrs.data && yrs.data.length > 0) {
        setAcademicYears(yrs.data);
        const current = yrs.data.find(y => y.is_current) || yrs.data[0];
        setAcademicYearId(pick(prefillYearId, yrs.data, current.id));
      }

      if (cls.data && cls.data.length > 0) {
        setClasses(cls.data);
        setClassId(pick(prefillClassId, cls.data, cls.data[0].id));
      }

      if (subs.data && subs.data.length > 0) {
        setSubjects(subs.data);
        setSubjectId(pick(prefillSubjectId, subs.data, subs.data[0].id));
      }
    }

    loadAcademicStructure();
  }, [
    isOpen, selectedTeacher, teachers,
    prefillYearId, prefillClassId, prefillSubjectId, prefillType
  ]);

  /**
   * A teacher is assigned a subject the class is actually taught.
   *
   * The list was the whole subject master, so Class 3 could be given a
   * teacher for a subject nobody teaches it, and the resulting row was
   * invisible to every screen that reads the curriculum. Where a class has
   * no mapping yet the master is left in place, because blocking the
   * assignment would be worse than allowing it.
   */
  useEffect(() => {
    if (!isOpen || !classId || !academicYearId) return;
    let isMounted = true;
    (async () => {
      const { data } = await supabase.rpc('academics_class_subjects', {
        _academic_year_id: academicYearId,
        _class_id: classId,
      });
      if (!isMounted) return;

      const seen = new Set<string>();
      const mapped = ((data ?? []) as Array<{ subject_id: string; subject_name: string }>)
        .filter(r => r.subject_id && !seen.has(r.subject_id) && seen.add(r.subject_id))
        .map(r => ({ id: r.subject_id, subject_name: r.subject_name }))
        .sort((a, b) => a.subject_name.localeCompare(b.subject_name));

      setSubjectsAreMapped(mapped.length > 0);
      if (mapped.length === 0) return;

      setSubjects(mapped);
      setSubjectId(prev => {
        if (prefillSubjectId && mapped.some(m => m.id === prefillSubjectId)) return prefillSubjectId;
        if (mapped.some(m => m.id === prev)) return prev;
        return mapped[0].id;
      });
    })();
    return () => { isMounted = false; };
  }, [isOpen, classId, academicYearId, prefillSubjectId]);

  /**
   * Section letters are global, but only some are actually attached to the
   * selected class (class_sections). Refetching on class change stops the
   * picker from offering a section the class does not run.
   */
  useEffect(() => {
    if (!isOpen || !classId) {
      setSections([]);
      return;
    }
    let isMounted = true;
    (async () => {
      const { data } = await supabase
        .from('class_sections')
        .select('sections(id, section_name)')
        .eq('class_id', classId)
        .eq('is_active', true);
      if (!isMounted) return;
      const rows = (data ?? [])
        .map((r: any) => r.sections)
        .filter(Boolean)
        .sort((a: any, b: any) => a.section_name.localeCompare(b.section_name));
      setSections(rows);
      setSectionId(prev => {
        if (prefillSectionId && rows.some((r: any) => r.id === prefillSectionId)) return prefillSectionId;
        if (rows.some((r: any) => r.id === prev)) return prev;
        return rows[0]?.id ?? '';
      });
    })();
    return () => { isMounted = false; };
  }, [isOpen, classId, prefillSectionId]);

  // Conflict validation on field change
  useEffect(() => {
    if (!teacherId || !academicYearId || !classId || !sectionId) {
      setConflict(null);
      return;
    }

    let isMounted = true;
    const check = async () => {
      setIsCheckingConflict(true);
      try {
        const res = await checkAssignmentConflicts({
          teacherId,
          academicYearId,
          classId,
          sectionId,
          subjectId: assignmentType === 'class_teacher' ? null : subjectId,
          assignmentType
        });
        if (isMounted) setConflict(res);
      } catch (err) {
        console.warn('Conflict check failed:', err);
      } finally {
        if (isMounted) setIsCheckingConflict(false);
      }
    };

    const timer = setTimeout(check, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [teacherId, academicYearId, classId, sectionId, subjectId, assignmentType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId || !academicYearId || !classId || !sectionId) {
      toast.error('Please fill in all assignment details.');
      return;
    }

    if (conflict?.hasConflict && conflict.type === 'DUPLICATE_ASSIGNMENT') {
      toast.error(conflict.message);
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('Assigning academic responsibility...');

    try {
      await saveAssignment({
        teacher_id: teacherId,
        academic_year_id: academicYearId,
        class_id: classId,
        section_id: sectionId,
        subject_id: assignmentType === 'class_teacher' ? null : subjectId,
        assignment_type: assignmentType
      });

      toast.success('Academic assignment successfully committed!', { id: toastId });
      onAssigned();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Assignment failed: ' + (err.message || 'Database error'), { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentTeacherObj = teachers.find(t => t.id === teacherId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white border border-slate-200 shadow-2xl rounded-3xl w-full max-w-lg overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-violet-600/30 border border-violet-500/30 rounded-xl text-violet-300">
              <GraduationCap size={18} />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-sm tracking-tight text-white">
                Academic & Teaching Allocation
              </h3>
              <p className="text-[11px] text-slate-400">
                Link Faculty to Class, Section, Subject & Class Teacher Roles
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* 1. Teacher Selector */}
          <div>
            <label className="text-xs font-black uppercase text-slate-600 tracking-wider block mb-1">
              Select Faculty Member <span className="text-rose-500">*</span>
            </label>
            <select 
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-violet-500"
            >
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.employee_id}) — {t.designation}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Academic Year */}
          <div>
            <label className="text-xs font-black uppercase text-slate-600 tracking-wider block mb-1">
              Academic Session Year <span className="text-rose-500">*</span>
            </label>
            <select 
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-violet-500"
            >
              {academicYears.map(y => (
                <option key={y.id} value={y.id}>
                  Session {y.name} {y.is_current ? '(Current Active Session)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Class and Section */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black uppercase text-slate-600 tracking-wider block mb-1">
                Class / Grade <span className="text-rose-500">*</span>
              </label>
              <select 
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-violet-500"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>Class {c.class_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-black uppercase text-slate-600 tracking-wider block mb-1">
                Section <span className="text-rose-500">*</span>
              </label>
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                disabled={sections.length === 0}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-violet-500 disabled:opacity-60"
              >
                {sections.length === 0
                  ? <option value="">No sections for this class yet</option>
                  : sections.map(s => (
                      <option key={s.id} value={s.id}>Section {s.section_name}</option>
                    ))}
              </select>
            </div>
          </div>

          {/* 4. Assignment Responsibility Role */}
          <div>
            <label className="text-xs font-black uppercase text-slate-600 tracking-wider block mb-1">
              Responsibility Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'subject_teacher', label: 'Subject Teacher', desc: 'Teaches subject' },
                { id: 'class_teacher', label: 'Class Teacher', desc: 'Primary mentor & attendance' },
                { id: 'both', label: 'Both Roles', desc: 'Class Teacher + Subject' }
              ].map(opt => (
                <div 
                  key={opt.id}
                  onClick={() => setAssignmentType(opt.id as AssignmentType)}
                  className={cn(
                    "p-2.5 rounded-xl border text-center cursor-pointer transition-all",
                    assignmentType === opt.id 
                      ? "border-violet-600 bg-violet-50/70 text-violet-900 font-bold shadow-xs shadow-violet-600/10" 
                      : "border-slate-200 hover:bg-slate-50 text-slate-600"
                  )}
                >
                  <span className="text-xs block leading-tight">{opt.label}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{opt.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Subject Picker (if not purely class teacher) */}
          {assignmentType !== 'class_teacher' && (
            <div>
              <label className="text-xs font-black uppercase text-slate-600 tracking-wider block mb-1">
                Subject Assigned <span className="text-rose-500">*</span>
              </label>
              <select 
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-violet-500"
              >
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.subject_name}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                {subjectsAreMapped
                  ? 'Only subjects this class is taught this year.'
                  : 'This class has no subjects mapped yet, so every subject is listed. Map them under Academics, Class Subjects.'}
              </p>
            </div>
          )}

          {/* Conflict Warning Alert */}
          {conflict?.hasConflict && (
            <div className={cn(
              "p-3 rounded-2xl border text-xs flex items-start gap-2.5 leading-relaxed",
              conflict.type === 'DUPLICATE_ASSIGNMENT' 
                ? "bg-rose-50 border-rose-200 text-rose-800" 
                : "bg-amber-50 border-amber-200 text-amber-800"
            )}>
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block uppercase text-[10px] tracking-wider">
                  {conflict.type === 'DUPLICATE_ASSIGNMENT' ? 'Duplicate Allocation Blocked' : 'Assignment Advisory'}
                </span>
                <span>{conflict.message}</span>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button 
            type="button" 
            onClick={onClose}
            className="px-4 py-2 bg-transparent text-slate-500 hover:text-slate-800 text-xs font-semibold rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button 
            type="button" 
            onClick={handleSubmit}
            disabled={isSaving || (conflict?.hasConflict && conflict.type === 'DUPLICATE_ASSIGNMENT')}
            className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-violet-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Commit Assignment</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
