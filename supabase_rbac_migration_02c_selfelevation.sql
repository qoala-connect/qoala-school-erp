-- =====================================================================
-- RBAC MIGRATION 02c — block self-elevation of profiles.role
-- =====================================================================
-- FOUND BY TEST, NOT BY REVIEW.
--
-- After 02b made profiles.role authoritative, the pre-existing policy
--   profiles_self_update: FOR UPDATE USING (id = auth.uid())
-- became a privilege escalation path. A user may legitimately edit their
-- own profile, and `role` is a column on that row, so:
--
--   PATCH /rest/v1/profiles?id=eq.<self>  {"role":"super_admin"}   -> 204
--
-- A signed-in teacher promoted themselves to super_admin, and a student
-- to admin, in a live test against this database.
--
-- RLS policies operate per row, not per column, so the policy alone
-- cannot express "you may edit this row but not this field". Two
-- independent mechanisms are applied here so that neither is a single
-- point of failure:
--
--   1. Column-level privileges: authenticated may UPDATE only name and
--      email on profiles. The role column is not grantable to them at
--      all, which stops the REST path before RLS is even consulted.
--   2. A BEFORE UPDATE trigger that rejects any role change not made by
--      an administrator. This covers every other path, including
--      SECURITY DEFINER code and future policies.
--
-- Administrators change roles through set_user_role(), which is
-- SECURITY DEFINER and checks is_admin() itself.
--
-- ROLLBACK: supabase_rbac_migration_02c_rollback.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Repair rows corrupted during the escalation test
-- ---------------------------------------------------------------------
UPDATE public.profiles SET role = 'teacher'::public.app_role WHERE email = 'teacher@school.com';
UPDATE public.profiles SET role = 'student'::public.app_role WHERE email = 'student@school.com';
UPDATE public.profiles SET role = 'parent'::public.app_role  WHERE email = 'parent@school.com';

-- Remove the grant the escalated teacher inserted during the test.
DELETE FROM public.role_permissions
WHERE role = 'teacher'::public.app_role AND permission = 'database.manage';

-- ---------------------------------------------------------------------
-- 2. Column-level privileges
-- ---------------------------------------------------------------------
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT  UPDATE (name, email) ON public.profiles TO authenticated;

REVOKE ALL ON public.profiles FROM anon;

-- ---------------------------------------------------------------------
-- 3. Defence in depth: reject role changes from non-administrators
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- auth.uid() is NULL for server-side work (migrations, service_role,
    -- the Supabase dashboard). Those are already privileged paths.
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION
        'Only an administrator may change a user role'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_role_change ON public.profiles;
CREATE TRIGGER profiles_guard_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_role_change();

-- ---------------------------------------------------------------------
-- 4. The supported way for an administrator to reassign a role
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_role(_user_id uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor uuid := auth.uid();
  old_role public.app_role;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator may change a user role'
      USING ERRCODE = '42501';
  END IF;

  SELECT role INTO old_role FROM public.profiles WHERE id = _user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No profile exists for that user' USING ERRCODE = 'P0002';
  END IF;

  -- Nothing to do if the role is unchanged; do not write an audit entry.
  IF old_role IS NOT DISTINCT FROM _role THEN
    RETURN;
  END IF;

  UPDATE public.profiles SET role = _role WHERE id = _user_id;

  INSERT INTO public.audit_logs (user_id, user_email, action_type, table_name, record_id, old_values, new_values)
  VALUES (
    actor,
    (SELECT email FROM public.profiles WHERE id = actor),
    'ROLE_CHANGE', 'profiles', _user_id,
    jsonb_build_object('role', old_role::text),
    jsonb_build_object('role', _role::text)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) TO authenticated;

-- ---------------------------------------------------------------------
-- 5. role_permissions must not be writable by non-admins either
-- ---------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.role_permissions FROM authenticated;

CREATE OR REPLACE FUNCTION public.set_role_permission(
  _role public.app_role, _permission text, _granted boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator may change permissions'
      USING ERRCODE = '42501';
  END IF;

  IF _granted THEN
    INSERT INTO public.role_permissions (role, permission)
    VALUES (_role, _permission)
    ON CONFLICT (role, permission) DO NOTHING;
  ELSE
    DELETE FROM public.role_permissions WHERE role = _role AND permission = _permission;
  END IF;

  INSERT INTO public.audit_logs (user_id, user_email, action_type, table_name, new_values)
  VALUES (
    auth.uid(),
    (SELECT email FROM public.profiles WHERE id = auth.uid()),
    CASE WHEN _granted THEN 'PERMISSION_GRANT' ELSE 'PERMISSION_REVOKE' END,
    'role_permissions',
    jsonb_build_object('role', _role::text, 'permission', _permission)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_role_permission(public.app_role, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_role_permission(public.app_role, text, boolean) TO authenticated;

COMMIT;

-- ---------------------------------------------------------------------
-- 6. Follow-up: REVOKE ... FROM anon does not remove PUBLIC's grant
-- ---------------------------------------------------------------------
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, and anon inherits
-- it through PUBLIC. Revoking from anon alone left both functions
-- callable anonymously. They return nothing without a session, but the
-- grant should not be there.

REVOKE ALL ON FUNCTION public.my_permissions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_has_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_has_permission(text) TO authenticated;
