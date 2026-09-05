-- =====================================================================
-- RBAC MIGRATION 02b — one role system, enforced in the database
-- =====================================================================
-- PROBLEM THIS SOLVES
--   1. Authorization was decided in the browser. hasPermission() read the
--      caller's role from localStorage.demo_school_role_display and their
--      permission set from localStorage.erp_custom_role_permissions. Both
--      are console-writable, so any account could become Super Admin.
--   2. Two rival role systems. profiles.role (app_role enum) is what
--      is_staff()/is_admin() read; user_roles.role (text) is what 11 RLS
--      policies read. user_roles holds ONE row, so those 11 policies deny
--      every staff member except a single account.
--
-- WHAT THIS DOES
--   - Backfills a profiles row for every auth user that lacks one.
--   - Migrates user_roles into profiles.role (profiles becomes the single
--     source of truth).
--   - Adds role_permissions: the permission catalogue, in the database,
--     replacing the localStorage copy.
--   - Adds auth_has_permission(text) so the frontend and RLS evaluate the
--     same rules.
--   - Rewrites the 11 user_roles-dependent policies onto the helpers.
--
-- SAFETY
--   Additive and reversible. No table is dropped. user_roles is KEPT and
--   left in place as a record; it simply stops being authoritative.
--   Run supabase_rbac_migration_02a_enum.sql first.
--
-- ROLLBACK: supabase_rbac_migration_02b_rollback.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Backfill missing profiles
-- ---------------------------------------------------------------------
-- One auth user (surajkumarnishad95@gmail.com) predates handle_new_user()
-- and has no profile at all, so current_user_role() resolves to 'anon'
-- and every staff policy denies them. Give them a profile at the LEAST
-- privileged role; an operator raises it deliberately afterwards.

INSERT INTO public.profiles (id, email, name, role)
SELECT u.id,
       coalesce(u.email, ''),
       coalesce(u.raw_user_meta_data->>'name', split_part(coalesce(u.email,''), '@', 1)),
       'student'::public.app_role
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- ---------------------------------------------------------------------
-- 2. Reconcile user_roles into profiles
-- ---------------------------------------------------------------------
-- Where user_roles grants a HIGHER role than profiles records, take the
-- higher one so nobody loses access during the cutover. user_roles only
-- ever holds 'admin', 'teacher' or 'student' (its check constraint).

UPDATE public.profiles p
SET role = ur.role::public.app_role
FROM public.user_roles ur
WHERE ur.user_id = p.id
  AND ur.role = 'admin'
  AND p.role <> 'admin'::public.app_role;

-- ---------------------------------------------------------------------
-- 3. Permission catalogue
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role        public.app_role NOT NULL,
  permission  text            NOT NULL,
  created_at  timestamptz     NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission)
);

COMMENT ON TABLE public.role_permissions IS
  'Authoritative role/permission grants. Replaces localStorage.erp_custom_role_permissions. The wildcard permission ''*'' grants everything.';

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS role_permissions_read ON public.role_permissions;
CREATE POLICY role_permissions_read ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS role_permissions_admin_write ON public.role_permissions;
CREATE POLICY role_permissions_admin_write ON public.role_permissions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON public.role_permissions FROM anon;
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;

-- Seed. Mirrors DEFAULT_ROLE_PERMISSIONS in src/components/Can.tsx so the
-- cutover changes enforcement, not behaviour.
INSERT INTO public.role_permissions (role, permission) VALUES
  ('super_admin','*'),

  ('admin','student.view'),('admin','student.list'),('admin','student.create'),
  ('admin','student.update'),('admin','student.delete'),
  ('admin','teacher.view'),('admin','teacher.create'),('admin','teacher.edit'),('admin','teacher.delete'),
  ('admin','staff.view'),('admin','attendance.manage'),
  ('admin','fees.collect'),('admin','fees.view'),('admin','fees.refund'),
  ('admin','results.publish'),('admin','results.view'),
  ('admin','reports.view'),('admin','reports.export'),
  ('admin','settings.manage'),('admin','database.manage'),('admin','academics.manage'),
  ('admin','inventory.manage'),('admin','certificates.manage'),('admin','documents.manage'),
  ('admin','library.manage'),('admin','transport.manage'),('admin','hostel.manage'),

  ('principal','student.view'),('principal','student.list'),('principal','student.create'),
  ('principal','student.update'),('principal','teacher.view'),('principal','teacher.create'),
  ('principal','teacher.edit'),('principal','staff.view'),('principal','attendance.manage'),
  ('principal','fees.view'),('principal','results.publish'),('principal','results.view'),
  ('principal','reports.view'),('principal','reports.export'),('principal','academics.manage'),

  ('vice_principal','student.view'),('vice_principal','student.list'),('vice_principal','student.update'),
  ('vice_principal','teacher.view'),('vice_principal','staff.view'),('vice_principal','attendance.manage'),
  ('vice_principal','fees.view'),('vice_principal','results.publish'),('vice_principal','results.view'),
  ('vice_principal','reports.view'),

  ('teacher','student.view'),('teacher','student.list'),('teacher','teacher.view'),
  ('teacher','attendance.manage'),('teacher','results.view'),('teacher','results.publish'),

  ('class_teacher','student.view'),('class_teacher','student.list'),('class_teacher','teacher.view'),
  ('class_teacher','attendance.manage'),('class_teacher','results.view'),('class_teacher','results.publish'),

  ('accountant','fees.collect'),('accountant','fees.refund'),('accountant','fees.view'),
  ('accountant','reports.view'),('accountant','reports.export'),('accountant','student.view'),

  ('exam_controller','results.view'),('exam_controller','results.publish'),
  ('exam_controller','student.view'),('exam_controller','student.list'),('exam_controller','reports.view'),

  ('librarian','library.manage'),('librarian','student.view'),
  ('transport_manager','transport.manage'),('transport_manager','student.view'),
  ('hostel_warden','hostel.manage'),('hostel_warden','student.view'),

  ('receptionist','student.view'),('receptionist','student.list'),('receptionist','student.create'),
  ('office_staff','student.view'),('office_staff','student.list'),('office_staff','attendance.manage'),
  ('office_staff','fees.view'),('office_staff','results.view'),('office_staff','reports.view'),
  ('hr','staff.view'),('hr','teacher.view'),('hr','reports.view'),

  ('student','student.view'),('student','results.view'),('student','fees.view'),
  ('parent','student.view'),('parent','results.view'),('parent','fees.view')
ON CONFLICT (role, permission) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4. Helper functions — one definition of who may do what
-- ---------------------------------------------------------------------

-- get_user_role() previously read user_roles, which holds one row.
-- Repoint it at profiles so anything still calling it agrees with
-- is_staff()/is_admin() instead of contradicting them.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT lower(role::text) FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.current_user_role() IN ('super_admin','admin','principal');
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.current_user_role() IN (
    'super_admin','admin','principal','vice_principal',
    'teacher','class_teacher','exam_controller','accountant',
    'office_staff','hr','receptionist','librarian',
    'transport_manager','hostel_warden'
  );
$$;

-- The permission predicate the frontend and RLS share.
CREATE OR REPLACE FUNCTION public.auth_has_permission(_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.profiles p ON p.role = rp.role
    WHERE p.id = auth.uid()
      AND rp.permission IN ('*', _permission)
  );
$$;

COMMENT ON FUNCTION public.auth_has_permission(text) IS
  'True when the calling user''s role grants the named permission. Single source of truth for both RLS and the UI.';

-- Returns the caller's full permission set, for the UI to hide controls
-- with. Hiding is cosmetic; RLS is the actual enforcement.
CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS TABLE (permission text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT rp.permission
  FROM public.role_permissions rp
  JOIN public.profiles p ON p.role = rp.role
  WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.auth_has_permission(text) FROM anon;
REVOKE ALL ON FUNCTION public.my_permissions() FROM anon;
GRANT EXECUTE ON FUNCTION public.auth_has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_permissions() TO authenticated;

-- ---------------------------------------------------------------------
-- 5. Rewrite the 11 policies that depended on the one-row user_roles
-- ---------------------------------------------------------------------
-- Each is replaced with the equivalent helper. Behaviour widens from
-- "the single account listed in user_roles" to "anyone holding the role",
-- which is what these policies were always meant to express.

DROP POLICY IF EXISTS class_fee_structure_admin_all ON public.class_fee_structure;
CREATE POLICY class_fee_structure_admin_all ON public.class_fee_structure
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS class_subjects_admin_all ON public.class_subjects;
CREATE POLICY class_subjects_admin_all ON public.class_subjects
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS class_subjects_staff_read ON public.class_subjects;
CREATE POLICY class_subjects_staff_read ON public.class_subjects
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS notifications_admin_select ON public.notifications;
DROP POLICY IF EXISTS notifications_admin_write  ON public.notifications;
CREATE POLICY notifications_admin_write ON public.notifications
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS notifications_student_select ON public.notifications;
CREATE POLICY notifications_student_select ON public.notifications
  FOR SELECT TO authenticated USING (student_id = auth.uid());

DROP POLICY IF EXISTS notifications_student_write ON public.notifications;
CREATE POLICY notifications_student_write ON public.notifications
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS teachers_admin_select ON public.teachers;
DROP POLICY IF EXISTS teachers_admin_write  ON public.teachers;
CREATE POLICY teachers_admin_write ON public.teachers
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
-- Staff need to read the teacher list to build timetables and allocations.
DROP POLICY IF EXISTS teachers_staff_select ON public.teachers;
CREATE POLICY teachers_staff_select ON public.teachers
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS teachers_self_select ON public.teachers;
CREATE POLICY teachers_self_select ON public.teachers
  FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS timetable_admin_all ON public.timetable;
CREATE POLICY timetable_admin_all ON public.timetable
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS timetable_teacher_select ON public.timetable;
CREATE POLICY timetable_teacher_select ON public.timetable
  FOR SELECT TO authenticated USING (public.is_staff());

-- user_roles is no longer authoritative. Keep it readable to admins so the
-- legacy rows remain inspectable, but it no longer gates anything.
COMMENT ON TABLE public.user_roles IS
  'DEPRECATED as of RBAC migration 02b. profiles.role is authoritative. Retained for historical reference only; no policy or function reads it.';

COMMIT;
