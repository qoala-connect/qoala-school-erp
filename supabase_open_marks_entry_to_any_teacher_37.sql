-- =====================================================================
-- OPEN MARKS ENTRY/SUBMISSION TO ANY TEACHER (drop per-subject scoping)
-- =====================================================================
-- Previously, entering and submitting marks for an exam subject was
-- restricted to whichever teacher was specifically assigned to it —
-- either as exam_subjects.teacher_id (the exam office's per-exam
-- "evaluator" pick) or via a matching class/section/subject row in
-- teacher_assignments (the general timetable mapping). A teacher outside
-- both got "Only the assigned evaluator or the examination office may
-- enter/submit these marks" (marks_stream_actor / RLS 42501).
--
-- By request: any teacher account should be able to enter and submit
-- marks for any class/subject, with no assignment check at all. Two
-- places enforced the old restriction; both are relaxed here:
--
--   1. marks_stream_actor() — backs the marks_stream_mark_in_progress and
--      marks_stream_submit_for_review RPCs. It used to require
--      _row.teacher_id to equal the caller's own teacher id; now any
--      authenticated teacher counts as the "evaluator" for every subject.
--
--   2. marks_teacher_scoped (RLS on public.marks) — used to require
--      teacher_teaches_student_subject(student_id, subject_id), i.e. a
--      matching teacher_assignments row. That's dropped in favor of
--      "any active teacher", so a teacher can save marks for a class
--      they have no timetable link to at all.
--
-- The office bypass (is_admin() / results.publish) is untouched, and the
-- workflow-stage gates (locked, already-submitted, etc.) inside those two
-- RPCs are untouched too — this only removes "which teacher", not "what
-- stage the stream is in".
-- =====================================================================

CREATE OR REPLACE FUNCTION public.marks_stream_actor(_row exam_subjects)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.is_admin() OR public.auth_has_permission('results.publish') THEN 'office'
    WHEN public.get_current_teacher_id() IS NOT NULL THEN 'evaluator'
    ELSE NULL
  END;
$function$;

DROP POLICY IF EXISTS marks_teacher_scoped ON public.marks;
CREATE POLICY marks_teacher_scoped ON public.marks
  FOR ALL
  USING (public.is_teacher())
  WITH CHECK (public.is_teacher());

-- ---------------------------------------------------------------------
-- Verify — both should now report true/'evaluator' for any teacher,
-- regardless of assignment. Safe to re-run; it's read-only.
-- ---------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM pg_policies WHERE tablename = 'marks' AND policyname = 'marks_teacher_scoped') AS policy_exists,
  pg_get_functiondef('public.marks_stream_actor(exam_subjects)'::regprocedure) LIKE '%get_current_teacher_id() IS NOT NULL THEN%'
    AND pg_get_functiondef('public.marks_stream_actor(exam_subjects)'::regprocedure) NOT LIKE '%_row.teacher_id = public.get_current_teacher_id()%'
    AS evaluator_check_relaxed;
