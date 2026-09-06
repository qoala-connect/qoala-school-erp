-- SECURITY: student and parent logins could read EVERY student record (507 rows).
--
-- Policy students_staff_select was:
--   is_staff() OR auth_has_permission('student.view') OR auth_has_permission('student.list')
-- and role_permissions grants 'student.view' to the student and parent roles —
-- intended as "may view my own profile", but the policy read it as
-- "may view the whole roster". Verified as both roles: 507 students visible.
--
-- 'student.list' is the roster-browsing permission and is held only by staff
-- roles (admin, principal, vice_principal, exam_controller, class_teacher,
-- teacher, office_staff, receptionist). Every other staff role is already
-- covered by is_staff(), so no staff access is lost.
--
-- After this, student/parent fall through to students_owner_select:
--   user_id = auth.uid() OR family_id IN (parents of auth.uid())

BEGIN;

DROP POLICY IF EXISTS students_staff_select ON public.students;

CREATE POLICY students_staff_select
  ON public.students
  FOR SELECT
  TO authenticated
  USING (is_staff() OR auth_has_permission('student.list'));

COMMIT;
