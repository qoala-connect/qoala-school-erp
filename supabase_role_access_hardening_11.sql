-- =====================================================================
-- MIGRATION 11 — Teacher/Student role-access hardening
-- =====================================================================
-- WHY
--   A live audit (pg_policies read directly from this project, not the
--   tracked migration history, which several later dashboard edits have
--   drifted from) found:
--
--   1. Three tables still literally readable/writable by ANY authenticated
--      user regardless of role: disciplinary_records, front_office_logs,
--      online_classes (policy body USING (true) / WITH CHECK (true)).
--
--   2. teachers/teacher_assignments SELECT is USING (true) too, so any
--      student or parent can read every teacher's phone, address, DOB,
--      emergency contacts and blood group, plus the full staffing matrix.
--      This regressed a tighter is_staff()-scoped policy that existed
--      briefly in supabase_rbac_migration_02b.sql before
--      supabase_teacher_assignment_migration.sql overwrote it.
--
--   3. student_fees, marks, attendance, exam_results, co_scholastic all
--      grant is_staff() FOR ALL — i.e. every staff role (librarian,
--      transport manager, HR, accountant, receptionist...) can read and
--      write every student's fees/marks/attendance/results school-wide,
--      and a plain teacher is not scoped to their own assigned classes,
--      sections or subjects at all. This is the concrete cause of
--      "Teacher can access data that should belong to Admin."
--
--   4. exam_results and co_scholastic have NO owner-select policy at all
--      (unlike marks/attendance/student_fees, which already have one) —
--      a student currently cannot see their own exam results through
--      RLS no matter what the UI shows.
--
--   5. fee_payments only has is_admin() — no accountant write path
--      (accountant is locked out of recording payments) and no owner
--      select (a student/parent's fee ledger silently omits payments).
--
--   6. role_permissions still grants plain 'teacher'/'class_teacher' the
--      'results.publish' permission, which gates exam creation/scheduling
--      and final result publication — admin/exam-controller territory,
--      not "my assigned class" territory.
--
-- WHAT THIS DOES
--   Additive only: new helper functions, DROP POLICY IF EXISTS + CREATE
--   POLICY (no table/column drops, no data touched other than the two
--   role_permissions rows removed in step 6). Every existing owner-select
--   policy that was already correct (students, attendance, marks,
--   student_fees, student_documents, etc.) is left untouched.
--
-- SAFETY / ROLLBACK
--   Reversible by re-creating the previous policy bodies (recorded above
--   and in the file history: supabase_teacher_assignment_migration.sql,
--   supabase_additive_migration.sql, supabase_results_migration.sql).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Helper functions
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_current_student_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT id FROM public.students WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_current_parent_student_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(ARRAY(
    SELECT s.id
    FROM public.students s
    JOIN public.parents p ON p.family_id = s.family_id
    WHERE p.user_id = auth.uid()
  ), ARRAY[]::uuid[]);
$$;

CREATE OR REPLACE FUNCTION public.get_current_teacher_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT id FROM public.teachers WHERE user_id = auth.uid() OR id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.current_user_role() IN ('teacher', 'class_teacher');
$$;

-- Is the given student in one of the caller's active assignments
-- (matched by class + section, ignoring subject)?
CREATE OR REPLACE FUNCTION public.teacher_teaches_student(_student_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teacher_assignments ta
    JOIN public.students s ON s.id = _student_id
    WHERE ta.teacher_id = public.get_current_teacher_id()
      AND ta.is_active
      AND ta.class_id = s.class_id
      AND ta.section_id = s.section_id
  );
$$;

-- Same, but also requires the assignment to cover this specific subject
-- (used for marks, which are entered per-subject).
CREATE OR REPLACE FUNCTION public.teacher_teaches_student_subject(_student_id uuid, _subject_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teacher_assignments ta
    JOIN public.students s ON s.id = _student_id
    WHERE ta.teacher_id = public.get_current_teacher_id()
      AND ta.is_active
      AND ta.class_id = s.class_id
      AND ta.section_id = s.section_id
      AND ta.subject_id = _subject_id
  );
$$;

REVOKE ALL ON FUNCTION public.get_current_student_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_current_parent_student_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_current_teacher_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_teacher() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.teacher_teaches_student(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.teacher_teaches_student_subject(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_student_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_parent_student_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_teacher_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_teaches_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_teaches_student_subject(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 2. Tables open to any authenticated user, regardless of role
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS disciplinary_staff_all ON public.disciplinary_records;
CREATE POLICY disciplinary_records_staff_all ON public.disciplinary_records
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS front_office_staff_all ON public.front_office_logs;
CREATE POLICY front_office_logs_staff_all ON public.front_office_logs
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- online_classes keeps broad read (schedule/links are low-sensitivity and
-- the route already requires the academics.view permission); only write
-- is restricted, since USING(true) previously covered every command.
DROP POLICY IF EXISTS online_classes_staff_all ON public.online_classes;
CREATE POLICY online_classes_read ON public.online_classes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY online_classes_staff_insert ON public.online_classes
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY online_classes_staff_update ON public.online_classes
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY online_classes_staff_delete ON public.online_classes
  FOR DELETE TO authenticated USING (public.is_staff());

-- ---------------------------------------------------------------------
-- 3. teachers / teacher_assignments — PII and staffing matrix
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS teachers_read_all ON public.teachers;
CREATE POLICY teachers_staff_select ON public.teachers
  FOR SELECT TO authenticated USING (public.is_staff());
-- teachers_admin_all and teachers_self_update are already correctly
-- scoped (is_admin() / own row) and are left as-is.

DROP POLICY IF EXISTS teacher_assignments_read_all ON public.teacher_assignments;
CREATE POLICY teacher_assignments_staff_select ON public.teacher_assignments
  FOR SELECT TO authenticated USING (public.is_staff());
-- teacher_assignments_admin_all is already correct and left as-is.

-- teachers_self_update lets a teacher UPDATE their own row with no column
-- restriction. Block self-changes to employment-status fields the same
-- way guard_profile_role_change() blocks self-role-changes on profiles
-- (supabase_rbac_migration_02c_selfelevation.sql).
CREATE OR REPLACE FUNCTION public.guard_teacher_self_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.designation IS DISTINCT FROM OLD.designation
       OR NEW.department IS DISTINCT FROM OLD.department
       OR NEW.department_id IS DISTINCT FROM OLD.department_id
       OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
       OR NEW.cbse_teaching_level IS DISTINCT FROM OLD.cbse_teaching_level
    THEN
      RAISE EXCEPTION
        'Only an administrator may change employment status, designation, department or employee ID'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS teachers_guard_self_update ON public.teachers;
CREATE TRIGGER teachers_guard_self_update
  BEFORE UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.guard_teacher_self_update();

-- ---------------------------------------------------------------------
-- 4. student_fees / fee_payments — scope write to admin/accountant,
--    read to fees.view holders, and fix the missing payment owner-read
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS student_fees_staff_all ON public.student_fees;
CREATE POLICY student_fees_staff_read ON public.student_fees
  FOR SELECT TO authenticated USING (public.auth_has_permission('fees.view'));
CREATE POLICY student_fees_staff_insert ON public.student_fees
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.auth_has_permission('fees.collect'));
CREATE POLICY student_fees_staff_update ON public.student_fees
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('fees.collect'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('fees.collect'));
CREATE POLICY student_fees_staff_delete ON public.student_fees
  FOR DELETE TO authenticated USING (public.is_admin());
-- student_fees_owner_select is already correct and left as-is.

DROP POLICY IF EXISTS fee_payments_admin_all ON public.fee_payments;
CREATE POLICY fee_payments_staff_write ON public.fee_payments
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('fees.collect'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('fees.collect'));
CREATE POLICY fee_payments_staff_read ON public.fee_payments
  FOR SELECT TO authenticated USING (public.auth_has_permission('fees.view'));
CREATE POLICY fee_payments_owner_select ON public.fee_payments
  FOR SELECT TO authenticated
  USING (
    student_fee_id IN (
      SELECT sf.id
      FROM public.student_fees sf
      WHERE sf.student_id = public.get_current_student_id()
         OR sf.student_id = ANY(public.get_current_parent_student_ids())
    )
  );

-- ---------------------------------------------------------------------
-- 5. attendance — scope teacher write to their own assigned classes
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS attendance_staff_all ON public.attendance;
CREATE POLICY attendance_admin_all ON public.attendance
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY attendance_office_staff_all ON public.attendance
  FOR ALL TO authenticated
  USING (public.auth_has_permission('attendance.manage') AND NOT public.is_teacher())
  WITH CHECK (public.auth_has_permission('attendance.manage') AND NOT public.is_teacher());
CREATE POLICY attendance_teacher_scoped ON public.attendance
  FOR ALL TO authenticated
  USING (public.is_teacher() AND public.teacher_teaches_student(student_id))
  WITH CHECK (public.is_teacher() AND public.teacher_teaches_student(student_id));
-- attendance_owner_select is already correct and left as-is.

-- ---------------------------------------------------------------------
-- 6. marks — scope teacher write to their own assigned class + subject
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS marks_staff_all ON public.marks;
CREATE POLICY marks_admin_all ON public.marks
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('results.publish'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('results.publish'));
CREATE POLICY marks_teacher_scoped ON public.marks
  FOR ALL TO authenticated
  USING (public.is_teacher() AND public.teacher_teaches_student_subject(student_id, subject_id))
  WITH CHECK (public.is_teacher() AND public.teacher_teaches_student_subject(student_id, subject_id));
-- marks_owner_select is already correct and left as-is.

-- ---------------------------------------------------------------------
-- 7. exam_results / co_scholastic — scope teacher write, add the
--    missing owner-select (students currently cannot see their own
--    published results through RLS at all)
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS exam_results_staff_all ON public.exam_results;
CREATE POLICY exam_results_admin_all ON public.exam_results
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('results.publish'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('results.publish'));
CREATE POLICY exam_results_teacher_scoped ON public.exam_results
  FOR ALL TO authenticated
  USING (public.is_teacher() AND public.teacher_teaches_student(student_id))
  WITH CHECK (public.is_teacher() AND public.teacher_teaches_student(student_id));
CREATE POLICY exam_results_owner_select ON public.exam_results
  FOR SELECT TO authenticated
  USING (
    student_id = public.get_current_student_id()
    OR student_id = ANY(public.get_current_parent_student_ids())
  );

DROP POLICY IF EXISTS co_scholastic_staff_all ON public.co_scholastic;
CREATE POLICY co_scholastic_admin_all ON public.co_scholastic
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('results.publish'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('results.publish'));
CREATE POLICY co_scholastic_teacher_scoped ON public.co_scholastic
  FOR ALL TO authenticated
  USING (public.is_teacher() AND public.teacher_teaches_student(student_id))
  WITH CHECK (public.is_teacher() AND public.teacher_teaches_student(student_id));
CREATE POLICY co_scholastic_owner_select ON public.co_scholastic
  FOR SELECT TO authenticated
  USING (
    student_id = public.get_current_student_id()
    OR student_id = ANY(public.get_current_parent_student_ids())
  );

-- ---------------------------------------------------------------------
-- 8. role_permissions — teacher/class_teacher lose exam-office scope
-- ---------------------------------------------------------------------
-- results.publish gates exam creation, exam scheduling and final result
-- publication (/dashboard/examination/exams, /schedule,
-- /result-publication) — school-wide admin/exam-controller workflows,
-- not "my assigned class". Teacher/class_teacher retain results.view,
-- which already covers marks entry and report viewing at the route
-- level, and now the RLS scoping added above for the underlying tables.

DELETE FROM public.role_permissions
WHERE role IN ('teacher', 'class_teacher') AND permission = 'results.publish';

COMMIT;
