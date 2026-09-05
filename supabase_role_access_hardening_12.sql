-- =====================================================================
-- MIGRATION 12 — RBAC Hardening: Assignments, Assessment Types, 
--                 Notices, Students Table Write Gating & Helpers
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Helper function update: ensure account_is_active on is_teacher
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.account_is_active()
     AND public.current_user_role() IN ('teacher', 'class_teacher');
$$;

-- ---------------------------------------------------------------------
-- 2. assessment_types: Enable RLS and add read/write policies
-- ---------------------------------------------------------------------
ALTER TABLE public.assessment_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assessment_types_read ON public.assessment_types;
CREATE POLICY assessment_types_read ON public.assessment_types
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS assessment_types_admin_write ON public.assessment_types;
CREATE POLICY assessment_types_admin_write ON public.assessment_types
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('academics.manage'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('academics.manage'));

-- ---------------------------------------------------------------------
-- 3. assignments: Enable RLS and add policies for Teacher/Admin/Student
-- ---------------------------------------------------------------------
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assignments_read ON public.assignments;
CREATE POLICY assignments_read ON public.assignments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS assignments_staff_write ON public.assignments;
CREATE POLICY assignments_staff_write ON public.assignments
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_teacher())
  WITH CHECK (public.is_admin() OR public.is_teacher());

-- ---------------------------------------------------------------------
-- 4. student_assignment_submissions: Enable RLS and add policies
-- ---------------------------------------------------------------------
ALTER TABLE public.student_assignment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_assignment_submissions_staff_all ON public.student_assignment_submissions;
CREATE POLICY student_assignment_submissions_staff_all ON public.student_assignment_submissions
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_teacher())
  WITH CHECK (public.is_admin() OR public.is_teacher());

DROP POLICY IF EXISTS student_assignment_submissions_student_select ON public.student_assignment_submissions;
CREATE POLICY student_assignment_submissions_student_select ON public.student_assignment_submissions
  FOR SELECT TO authenticated
  USING (
    student_id = public.get_current_student_id()
    OR student_id = ANY(public.get_current_parent_student_ids())
  );

DROP POLICY IF EXISTS student_assignment_submissions_student_insert ON public.student_assignment_submissions;
CREATE POLICY student_assignment_submissions_student_insert ON public.student_assignment_submissions
  FOR INSERT TO authenticated
  WITH CHECK (student_id = public.get_current_student_id());

DROP POLICY IF EXISTS student_assignment_submissions_student_update ON public.student_assignment_submissions;
CREATE POLICY student_assignment_submissions_student_update ON public.student_assignment_submissions
  FOR UPDATE TO authenticated
  USING (student_id = public.get_current_student_id())
  WITH CHECK (student_id = public.get_current_student_id());

-- ---------------------------------------------------------------------
-- 5. receipt_counters: Add RLS policies for atomic fee operations
-- ---------------------------------------------------------------------
ALTER TABLE public.receipt_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS receipt_counters_admin_all ON public.receipt_counters;
CREATE POLICY receipt_counters_admin_all ON public.receipt_counters
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('fees.collect'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('fees.collect'));

DROP POLICY IF EXISTS receipt_counters_staff_read ON public.receipt_counters;
CREATE POLICY receipt_counters_staff_read ON public.receipt_counters
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- ---------------------------------------------------------------------
-- 6. notices: Fix admin write policy to include super_admin / principal / communication.manage
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS notices_admin_all ON public.notices;
DROP POLICY IF EXISTS notices_manager_all ON public.notices;
CREATE POLICY notices_manager_all ON public.notices
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('communication.manage'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('communication.manage'));

-- ---------------------------------------------------------------------
-- 7. students table: Tighten write permissions to student.create / student.update / student.delete
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS students_staff_all ON public.students;

DROP POLICY IF EXISTS students_staff_select ON public.students;
CREATE POLICY students_staff_select ON public.students
  FOR SELECT TO authenticated
  USING (public.is_staff() OR public.auth_has_permission('student.view') OR public.auth_has_permission('student.list'));

DROP POLICY IF EXISTS students_admin_insert ON public.students;
CREATE POLICY students_admin_insert ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.auth_has_permission('student.create'));

DROP POLICY IF EXISTS students_admin_update ON public.students;
CREATE POLICY students_admin_update ON public.students
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('student.update'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('student.update'));

DROP POLICY IF EXISTS students_admin_delete ON public.students;
CREATE POLICY students_admin_delete ON public.students
  FOR DELETE TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('student.delete'));

-- ---------------------------------------------------------------------
-- 8. disciplinary_records: Add student/parent self-select policy
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS disciplinary_records_owner_select ON public.disciplinary_records;
CREATE POLICY disciplinary_records_owner_select ON public.disciplinary_records
  FOR SELECT TO authenticated
  USING (
    student_id = public.get_current_student_id()
    OR student_id = ANY(public.get_current_parent_student_ids())
  );

COMMIT;
