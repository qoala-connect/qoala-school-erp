-- =====================================================================
-- ROLLBACK for RBAC MIGRATION 02b
-- =====================================================================
-- Restores the pre-migration state: is_staff()/is_admin() back to their
-- original role lists, get_user_role() back to reading user_roles, and
-- the 11 policies back to their inline user_roles subqueries.
--
-- NOT reversed (deliberately, because reversing them would lose data or
-- re-break access):
--   - profiles rows backfilled for auth users that had none
--   - profiles.role raised to 'admin' where user_roles said so
--   - enum values added by 02a (PostgreSQL cannot drop enum values)
-- role_permissions IS dropped, since nothing predating the migration
-- referenced it.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $$ SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.current_user_role() IN ('admin', 'super admin', 'principal'); $$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.current_user_role() IN (
    'admin','super admin','principal','vice principal','teacher',
    'class teacher','exam controller','accountant','office staff','hr','receptionist'
  );
$$;

DROP FUNCTION IF EXISTS public.auth_has_permission(text);
DROP FUNCTION IF EXISTS public.my_permissions();
DROP TABLE IF EXISTS public.role_permissions;

DROP POLICY IF EXISTS class_subjects_staff_read ON public.class_subjects;
DROP POLICY IF EXISTS teachers_staff_select     ON public.teachers;

DROP POLICY IF EXISTS class_fee_structure_admin_all ON public.class_fee_structure;
CREATE POLICY class_fee_structure_admin_all ON public.class_fee_structure FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

DROP POLICY IF EXISTS class_subjects_admin_all ON public.class_subjects;
CREATE POLICY class_subjects_admin_all ON public.class_subjects FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

DROP POLICY IF EXISTS notifications_admin_write ON public.notifications;
CREATE POLICY notifications_admin_select ON public.notifications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));
CREATE POLICY notifications_admin_write ON public.notifications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

DROP POLICY IF EXISTS notifications_student_select ON public.notifications;
CREATE POLICY notifications_student_select ON public.notifications FOR SELECT TO authenticated
  USING (student_id = auth.uid() AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'student'));

DROP POLICY IF EXISTS notifications_student_write ON public.notifications;
CREATE POLICY notifications_student_write ON public.notifications FOR UPDATE TO authenticated
  USING (student_id = auth.uid() AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'student'))
  WITH CHECK (student_id = auth.uid() AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'student'));

DROP POLICY IF EXISTS teachers_admin_write ON public.teachers;
CREATE POLICY teachers_admin_select ON public.teachers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));
CREATE POLICY teachers_admin_write ON public.teachers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

DROP POLICY IF EXISTS teachers_self_select ON public.teachers;
CREATE POLICY teachers_self_select ON public.teachers FOR SELECT TO authenticated
  USING (id = auth.uid() AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'teacher'));

DROP POLICY IF EXISTS timetable_admin_all ON public.timetable;
CREATE POLICY timetable_admin_all ON public.timetable FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

DROP POLICY IF EXISTS timetable_teacher_select ON public.timetable;
CREATE POLICY timetable_teacher_select ON public.timetable FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_teachers ct WHERE ct.teacher_id = auth.uid() AND ct.class = timetable.class)
     AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'teacher'));

COMMIT;
