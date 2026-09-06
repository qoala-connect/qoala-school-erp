-- =====================================================================
-- MIGRATION 18b — ACADEMICS TEACHING & LEARNING WORKFLOW: RLS
-- =====================================================================
--
-- THE DEFECTS THIS CLOSES
--
--   lesson_plans   write was gated on academics.manage, held only by
--                  admin and principal. A teacher could not create a
--                  lesson plan for their own class at all. Now a teacher
--                  with academics.teach may write a plan, but only for a
--                  class + section + subject they are actually assigned
--                  to in teacher_assignments.
--
--   assignments    write was is_admin() OR is_teacher(): ANY teacher
--                  could create, edit or delete homework for ANY class in
--                  the school. Read was USING (true): every student and
--                  parent could list every assignment for every class.
--                  Now a teacher writes only within their assignments,
--                  and a student or parent reads only their own class's
--                  published work.
--
--   student_assignment_submissions  staff policy was is_admin() OR
--                  is_teacher() with no scope, so any teacher could read
--                  and re-grade any submission in the school. Now a
--                  teacher sees only submissions to assignments they own.
--                  The student / parent policies were already correct and
--                  are left alone.
--
--   syllabus_*     new tables. Curriculum is world-readable to an
--                  authenticated user (a student must see their syllabus)
--                  and writable only by an admin. Progress is writable by
--                  the assigned subject teacher or an admin.
--
-- timetable read stays open: the whole-school grid is a staff tool, and
-- "a student sees only their own timetable" is enforced by the read-model
-- function and the UI always filtering on the student's class + section.
--
-- ROLLBACK: supabase_academics_workflow_migration_18_rollback.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. syllabus_units / syllabus_chapters / syllabus_topics
--    read: any authenticated user   write: academics.manage
-- ---------------------------------------------------------------------
ALTER TABLE public.syllabus_units    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_topics   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS syllabus_units_read       ON public.syllabus_units;
DROP POLICY IF EXISTS syllabus_units_admin_write ON public.syllabus_units;
CREATE POLICY syllabus_units_read ON public.syllabus_units
  FOR SELECT TO authenticated USING (true);
CREATE POLICY syllabus_units_admin_write ON public.syllabus_units
  FOR ALL TO authenticated
  USING (auth_has_permission('academics.manage'))
  WITH CHECK (auth_has_permission('academics.manage'));

DROP POLICY IF EXISTS syllabus_chapters_read        ON public.syllabus_chapters;
DROP POLICY IF EXISTS syllabus_chapters_admin_write ON public.syllabus_chapters;
CREATE POLICY syllabus_chapters_read ON public.syllabus_chapters
  FOR SELECT TO authenticated USING (true);
CREATE POLICY syllabus_chapters_admin_write ON public.syllabus_chapters
  FOR ALL TO authenticated
  USING (auth_has_permission('academics.manage'))
  WITH CHECK (auth_has_permission('academics.manage'));

DROP POLICY IF EXISTS syllabus_topics_read        ON public.syllabus_topics;
DROP POLICY IF EXISTS syllabus_topics_admin_write ON public.syllabus_topics;
CREATE POLICY syllabus_topics_read ON public.syllabus_topics
  FOR SELECT TO authenticated USING (true);
CREATE POLICY syllabus_topics_admin_write ON public.syllabus_topics
  FOR ALL TO authenticated
  USING (auth_has_permission('academics.manage'))
  WITH CHECK (auth_has_permission('academics.manage'));

-- ---------------------------------------------------------------------
-- 2. syllabus_progress
--    read: any authenticated user
--    write: admin (academics.manage), OR the subject teacher for that
--           section (academics.teach + a matching teacher_assignments row)
-- ---------------------------------------------------------------------
ALTER TABLE public.syllabus_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS syllabus_progress_read        ON public.syllabus_progress;
DROP POLICY IF EXISTS syllabus_progress_admin_write ON public.syllabus_progress;
DROP POLICY IF EXISTS syllabus_progress_teacher_write ON public.syllabus_progress;

CREATE POLICY syllabus_progress_read ON public.syllabus_progress
  FOR SELECT TO authenticated USING (true);

CREATE POLICY syllabus_progress_admin_write ON public.syllabus_progress
  FOR ALL TO authenticated
  USING (auth_has_permission('academics.manage'))
  WITH CHECK (auth_has_permission('academics.manage'));

CREATE POLICY syllabus_progress_teacher_write ON public.syllabus_progress
  FOR ALL TO authenticated
  USING (
    auth_has_permission('academics.teach')
    AND teacher_id = get_current_teacher_id()
  )
  WITH CHECK (
    auth_has_permission('academics.teach')
    AND teacher_id = get_current_teacher_id()
    AND EXISTS (
      SELECT 1
      FROM public.teacher_assignments ta
      JOIN public.syllabus_chapters c ON c.id = syllabus_progress.chapter_id
      JOIN public.syllabus_units    u ON u.id = c.unit_id
      WHERE ta.teacher_id = get_current_teacher_id()
        AND ta.is_active
        AND ta.section_id = syllabus_progress.section_id
        AND ta.subject_id = u.subject_id
    )
  );

-- ---------------------------------------------------------------------
-- 3. lesson_plans
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS lesson_plans_academics_read  ON public.lesson_plans;
DROP POLICY IF EXISTS lesson_plans_academics_write ON public.lesson_plans;
DROP POLICY IF EXISTS lesson_plans_read            ON public.lesson_plans;
DROP POLICY IF EXISTS lesson_plans_admin_all       ON public.lesson_plans;
DROP POLICY IF EXISTS lesson_plans_teacher_own     ON public.lesson_plans;

-- A lesson plan names a topic, not a mark. Any authenticated user may
-- read it; students are shown the plan for their own class by the UI.
CREATE POLICY lesson_plans_read ON public.lesson_plans
  FOR SELECT TO authenticated USING (true);

CREATE POLICY lesson_plans_admin_all ON public.lesson_plans
  FOR ALL TO authenticated
  USING (auth_has_permission('academics.manage'))
  WITH CHECK (auth_has_permission('academics.manage'));

CREATE POLICY lesson_plans_teacher_own ON public.lesson_plans
  FOR ALL TO authenticated
  USING (
    auth_has_permission('academics.teach')
    AND teacher_id = get_current_teacher_id()
  )
  WITH CHECK (
    auth_has_permission('academics.teach')
    AND teacher_id = get_current_teacher_id()
    AND EXISTS (
      SELECT 1 FROM public.teacher_assignments ta
      WHERE ta.teacher_id = get_current_teacher_id()
        AND ta.is_active
        AND ta.class_id = lesson_plans.class_id
        AND (ta.section_id = lesson_plans.section_id OR lesson_plans.section_id IS NULL)
        AND (ta.subject_id = lesson_plans.subject_id OR lesson_plans.subject_id IS NULL)
    )
  );

-- ---------------------------------------------------------------------
-- 4. assignments (homework + assignment)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS assignments_read         ON public.assignments;
DROP POLICY IF EXISTS assignments_staff_write  ON public.assignments;
DROP POLICY IF EXISTS assignments_staff_read   ON public.assignments;
DROP POLICY IF EXISTS assignments_admin_all    ON public.assignments;
DROP POLICY IF EXISTS assignments_teacher_own  ON public.assignments;
DROP POLICY IF EXISTS assignments_student_read ON public.assignments;
DROP POLICY IF EXISTS assignments_parent_read  ON public.assignments;

CREATE POLICY assignments_staff_read ON public.assignments
  FOR SELECT TO authenticated USING (is_staff());

CREATE POLICY assignments_student_read ON public.assignments
  FOR SELECT TO authenticated
  USING (
    status <> 'draft'
    AND class_id = (SELECT s.class_id FROM public.students s WHERE s.id = get_current_student_id())
    AND (
      section_id IS NULL
      OR section_id = (SELECT s.section_id FROM public.students s WHERE s.id = get_current_student_id())
    )
  );

CREATE POLICY assignments_parent_read ON public.assignments
  FOR SELECT TO authenticated
  USING (
    status <> 'draft'
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = ANY (get_current_parent_student_ids())
        AND s.class_id = assignments.class_id
        AND (assignments.section_id IS NULL OR s.section_id = assignments.section_id)
    )
  );

CREATE POLICY assignments_admin_all ON public.assignments
  FOR ALL TO authenticated
  USING (auth_has_permission('academics.manage'))
  WITH CHECK (auth_has_permission('academics.manage'));

CREATE POLICY assignments_teacher_own ON public.assignments
  FOR ALL TO authenticated
  USING (
    auth_has_permission('academics.teach')
    AND teacher_id = get_current_teacher_id()
  )
  WITH CHECK (
    auth_has_permission('academics.teach')
    AND teacher_id = get_current_teacher_id()
    AND EXISTS (
      SELECT 1 FROM public.teacher_assignments ta
      WHERE ta.teacher_id = get_current_teacher_id()
        AND ta.is_active
        AND ta.class_id = assignments.class_id
        AND (ta.section_id = assignments.section_id OR assignments.section_id IS NULL)
        AND (ta.subject_id = assignments.subject_id OR assignments.subject_id IS NULL)
    )
  );

-- ---------------------------------------------------------------------
-- 5. student_assignment_submissions — scope the staff policy
--    (student_insert / student_select / student_update are left as-is)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS student_assignment_submissions_staff_all     ON public.student_assignment_submissions;
DROP POLICY IF EXISTS student_assignment_submissions_admin_all     ON public.student_assignment_submissions;
DROP POLICY IF EXISTS student_assignment_submissions_teacher_scope ON public.student_assignment_submissions;

CREATE POLICY student_assignment_submissions_admin_all ON public.student_assignment_submissions
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY student_assignment_submissions_teacher_scope ON public.student_assignment_submissions
  FOR ALL TO authenticated
  USING (
    is_teacher()
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = student_assignment_submissions.assignment_id
        AND a.teacher_id = get_current_teacher_id()
    )
  )
  WITH CHECK (
    is_teacher()
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = student_assignment_submissions.assignment_id
        AND a.teacher_id = get_current_teacher_id()
    )
  );

COMMIT;
