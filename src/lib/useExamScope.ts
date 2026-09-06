import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

/**
 * Who may do what inside the Examination module, mirroring the database.
 *
 * The server is the authority and already enforces this — `exams` and
 * `exam_subjects` carry `..._admin_write` policies gated on
 * `is_admin() OR auth_has_permission('results.publish')`, while their read
 * policies are plain `true`. `results.publish` is granted to admin, principal,
 * vice_principal and exam_controller only; a teacher holds `results.view`.
 *
 * The consequence the UI has to respect: a teacher can *read* every exam and
 * every scheduled slot in the school, but cannot write any of them. Rendering
 * Schedule / Assign / Delete buttons for them produced controls that could only
 * ever fail with a row-level-security error, and a school-wide datesheet that
 * is none of their business. This hook answers both questions in one place:
 * may this user manage exam setup, and which slots are actually theirs.
 *
 * It is a presentation concern only. Nothing here grants access — hiding a
 * button does not protect a row, the policies do.
 */
export interface ExamScope {
  /** Exam office: may create/edit/delete exam terms, schedules and duties. */
  canManage: boolean;
  /** A teacher whose view should be narrowed to their own assignments. */
  isScopedTeacher: boolean;
  teacherId: string | null;
  /** Classes this teacher is the class teacher of — they see the full class. */
  classTeacherClassIds: Set<string>;
  /** `${class_id}:${subject_id}` pairs this teacher actually teaches. */
  taughtPairs: Set<string>;
  /** Every class the teacher touches, in either capacity. */
  classIds: Set<string>;
  /** Every subject the teacher teaches. */
  subjectIds: Set<string>;
  isLoading: boolean;
  /**
   * Whether a scheduled slot belongs to this user. Always true for the exam
   * office, and true for a teacher only where they teach the subject in that
   * class or are its class teacher.
   */
  allowsSlot: (classId?: string | null, subjectId?: string | null) => boolean;
}

export function useExamScope(): ExamScope {
  const { user, role, can } = useAuth();
  const canManage = can('results.publish');
  const isScopedTeacher = !canManage && (role === 'teacher' || role === 'class_teacher');

  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(isScopedTeacher);

  useEffect(() => {
    if (!isScopedTeacher || !user?.id) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        // get_current_teacher_id() is the same resolver the RLS policies use,
        // so the UI and the database agree on who this teacher is.
        const { data: resolvedId } = await supabase.rpc('get_current_teacher_id');
        if (cancelled) return;
        setTeacherId(resolvedId ?? null);
        if (!resolvedId) {
          setAssignments([]);
          return;
        }

        // teacher_assignments_staff_select already lets a teacher read their
        // own rows, so this needs no elevated path.
        const { data, error } = await supabase
          .from('teacher_assignments')
          .select('class_id, section_id, subject_id, assignment_type')
          .eq('teacher_id', resolvedId)
          .eq('is_active', true);
        if (error) throw error;
        if (!cancelled) setAssignments(data || []);
      } catch (err) {
        console.error('[useExamScope] Could not resolve teacher scope:', err);
        // Fail closed: an unresolved scope shows nothing rather than everything.
        if (!cancelled) setAssignments([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isScopedTeacher, user?.id]);

  return useMemo(() => {
    const classTeacherClassIds = new Set<string>();
    const taughtPairs = new Set<string>();
    const classIds = new Set<string>();
    const subjectIds = new Set<string>();

    for (const a of assignments) {
      if (a.class_id) classIds.add(a.class_id);
      if (a.subject_id) subjectIds.add(a.subject_id);
      if (a.assignment_type === 'class_teacher' && a.class_id) {
        classTeacherClassIds.add(a.class_id);
      }
      if (a.class_id && a.subject_id) taughtPairs.add(`${a.class_id}:${a.subject_id}`);
    }

    const allowsSlot = (classId?: string | null, subjectId?: string | null) => {
      if (!isScopedTeacher) return true;
      if (classId && classTeacherClassIds.has(classId)) return true;
      if (classId && subjectId) return taughtPairs.has(`${classId}:${subjectId}`);
      // A slot missing its class link can only be matched on the subject.
      if (subjectId) return subjectIds.has(subjectId);
      return false;
    };

    return {
      canManage,
      isScopedTeacher,
      teacherId,
      classTeacherClassIds,
      taughtPairs,
      classIds,
      subjectIds,
      isLoading,
      allowsSlot
    };
  }, [assignments, canManage, isScopedTeacher, teacherId, isLoading]);
}
