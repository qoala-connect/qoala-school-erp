-- =====================================================================
-- SYSTEM MIGRATION 08b — security
-- =====================================================================
-- Closes the holes found while auditing the System module against the
-- live database, and adds the administrative operations the System UI
-- needs, each one enforced in PostgreSQL rather than in React.
--
-- WHAT WAS WRONG
--
--   1. TRUNCATE was granted to anon and authenticated on 69 and 76 public
--      tables respectively, audit_logs, profiles, role_permissions and
--      system_settings among them. TRUNCATE is not subject to row level
--      security. Every RLS policy in this database is therefore bypassed
--      by one statement for anyone who reaches SQL through any path.
--      Verified against the live project:
--        anon         -> TRUNCATE on 69 tables
--        authenticated-> TRUNCATE on 76 tables
--      PostgREST does not emit TRUNCATE today, so this is not remotely
--      exploitable as things stand, but nothing about the grant is
--      intended and nothing depends on it.
--
--   2. audit_logs was writable and deletable. The policy was
--        audit_logs_admin_all  FOR ALL  USING is_admin() WITH CHECK is_admin()
--      so any administrator could edit or delete audit history, and
--      authenticated held INSERT/UPDATE/DELETE/TRUNCATE outright. An
--      audit trail the audited party can rewrite records nothing.
--
--   3. system_settings was readable only by is_admin(). The school name
--      and logo belong on receipts, ID cards and report cards, which are
--      produced by accountants and class teachers, so an admin-only read
--      would have made the settings unusable the moment anything started
--      reading them.
--
--   4. Nothing protected super_admin. set_user_role() checked is_admin()
--      and stopped there: an admin could promote themselves, demote the
--      only remaining administrator and lock the school out of its own
--      ERP, or hand out the wildcard grant.
--
--   5. There was no way to shut off an account, and no server-side
--      meaning for one. Status is now enforced where authorization is
--      decided, not in the browser.
--
-- SAFETY
--   Narrows privileges and adds functions. Drops no table, deletes no
--   row. Every existing legitimate path keeps working: the application
--   reaches these tables through SECURITY DEFINER functions, which are
--   unaffected by the revoked table grants.
--
-- ROLLBACK: supabase_system_migration_08_rollback.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Remove privileges nothing uses and RLS cannot restrain
-- ---------------------------------------------------------------------
-- Scoped to the tables the System module owns. The same grants exist on
-- the business tables; those are reported rather than changed here,
-- because revoking across 76 tables belongs in its own migration with
-- its own regression pass over every module.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'audit_logs','activity_logs','system_settings',
    'profiles','role_permissions','user_roles'
  ] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
  END LOOP;
END $$;

-- Put back only what the application legitimately needs. Everything else
-- goes through a SECURITY DEFINER function that checks authorization
-- itself.
GRANT SELECT                ON public.audit_logs        TO authenticated;
GRANT SELECT                ON public.system_settings   TO authenticated;
GRANT SELECT                ON public.role_permissions  TO authenticated;
GRANT SELECT                ON public.user_roles        TO authenticated;
GRANT SELECT                ON public.profiles          TO authenticated;
-- Users may correct their own display name and email. role and status are
-- deliberately absent: a column the caller cannot write cannot be
-- escalated through, whatever the row policy says.
GRANT UPDATE (name, email)  ON public.profiles          TO authenticated;

-- ---------------------------------------------------------------------
-- 2. audit_logs is append-only, to everyone
-- ---------------------------------------------------------------------
-- Two independent mechanisms, so neither is a single point of failure:
-- no role holds UPDATE or DELETE, and a trigger refuses them regardless
-- of privilege, which also covers SECURITY DEFINER code and the
-- service_role key.

DROP POLICY IF EXISTS policy_admin_all_audit_logs ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_admin_all        ON public.audit_logs;

-- Reading the audit trail is itself a privileged act.
DROP POLICY IF EXISTS audit_logs_admin_read ON public.audit_logs;
CREATE POLICY audit_logs_admin_read ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.auth_has_permission('audit.view'));

-- No INSERT policy, by design. Entries arrive only through SECURITY
-- DEFINER functions, which is what makes the actor recorded on an entry
-- trustworthy: a caller cannot choose it.

CREATE OR REPLACE FUNCTION public.guard_audit_log_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'audit_logs is append-only: % is not permitted on audit history', TG_OP
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.guard_audit_log_immutable();

-- The one supported way to add an entry. Every administrative function
-- below writes through it, so the shape of an audit record is defined
-- once rather than restated at each call site.
CREATE OR REPLACE FUNCTION public.log_system_event(
  _action     text,
  _table_name text,
  _record_id  uuid    DEFAULT NULL,
  _old        jsonb   DEFAULT NULL,
  _new        jsonb   DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  INSERT INTO public.audit_logs
    (user_id, user_email, action_type, table_name, record_id, old_values, new_values)
  VALUES
    (auth.uid(),
     (SELECT email FROM public.profiles WHERE id = auth.uid()),
     _action, _table_name, _record_id, _old, _new);
$$;

REVOKE ALL ON FUNCTION public.log_system_event(text,text,uuid,jsonb,jsonb) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Account status is enforced where authorization is decided
-- ---------------------------------------------------------------------
-- A suspended, disabled or archived account keeps its role and all of
-- its history, and is granted nothing. Putting the check in these four
-- functions means it applies to every RLS policy and every permission
-- lookup at once, rather than being restated per table and forgotten on
-- the one that matters.
--
-- 'invited' counts as permitted: it means an administrator created the
-- account and the person has not signed in yet, not that access is
-- withheld.

CREATE OR REPLACE FUNCTION public.account_is_active()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT coalesce(
    (SELECT status IN ('active','invited') FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

COMMENT ON FUNCTION public.account_is_active() IS
  'False for suspended, disabled and archived accounts, and for a signed-in user with no profile row. Consulted by is_admin(), is_staff(), auth_has_permission() and my_permissions().';

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.account_is_active()
     AND public.current_user_role() IN ('super_admin','admin','principal');
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.account_is_active()
     AND public.current_user_role() = 'super_admin';
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.account_is_active()
     AND public.current_user_role() IN (
       'super_admin','admin','principal','vice_principal',
       'teacher','class_teacher','exam_controller','accountant',
       'office_staff','hr','receptionist','librarian',
       'transport_manager','hostel_warden'
     );
$$;

CREATE OR REPLACE FUNCTION public.auth_has_permission(_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.account_is_active()
     AND EXISTS (
       SELECT 1
       FROM public.role_permissions rp
       JOIN public.profiles p ON p.role = rp.role
       WHERE p.id = auth.uid()
         AND rp.permission IN ('*', _permission)
     );
$$;

CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS TABLE (permission text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT rp.permission
  FROM public.role_permissions rp
  JOIN public.profiles p ON p.role = rp.role
  WHERE p.id = auth.uid()
    AND public.account_is_active();
$$;

GRANT EXECUTE ON FUNCTION public.account_is_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin()    TO authenticated;
REVOKE ALL ON FUNCTION public.account_is_active() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_super_admin()    FROM PUBLIC, anon;

-- ---------------------------------------------------------------------
-- 4. Two new permissions for the System module itself
-- ---------------------------------------------------------------------
-- Reading the audit trail and administering accounts were both folded
-- into settings.manage, which also covers editing the school address.
-- They are separable concerns and now separate permissions, so a
-- principal can be given oversight of the audit trail without being
-- given the ability to reassign roles.

INSERT INTO public.role_permissions (role, permission) VALUES
  ('admin','audit.view'), ('admin','users.manage'),
  ('principal','audit.view')
ON CONFLICT (role, permission) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5. system_settings: readable school-wide, writable by permission
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS policy_admin_all_system_settings ON public.system_settings;
DROP POLICY IF EXISTS system_settings_admin_all        ON public.system_settings;

-- Every signed-in user reads the school identity, because every receipt,
-- ID card and report card carries it. Nothing sensitive lives in this
-- row: secrets stay in environment configuration and are not moved here.
DROP POLICY IF EXISTS system_settings_read ON public.system_settings;
CREATE POLICY system_settings_read ON public.system_settings
  FOR SELECT TO authenticated USING (true);

-- No write policy. Writes go through update_system_settings().

CREATE OR REPLACE FUNCTION public.update_system_settings(_patch jsonb)
RETURNS public.system_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  before_row public.system_settings;
  after_row  public.system_settings;
BEGIN
  IF NOT public.auth_has_permission('settings.manage') THEN
    RAISE EXCEPTION 'You do not have permission to change school settings'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO before_row FROM public.system_settings LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'School settings row is missing' USING ERRCODE = 'P0002';
  END IF;

  -- Only these keys are writable. An unknown key in the patch is ignored
  -- rather than rejected, so a newer client cannot fail against an older
  -- database, and no key outside this list can ever be set this way.
  UPDATE public.system_settings s SET
    school_name             = coalesce(_patch->>'school_name',            s.school_name),
    school_address          = coalesce(_patch->>'school_address',         s.school_address),
    school_phone            = coalesce(_patch->>'school_phone',           s.school_phone),
    school_email            = coalesce(_patch->>'school_email',           s.school_email),
    school_code             = coalesce(_patch->>'school_code',            s.school_code),
    school_website          = coalesce(_patch->>'school_website',         s.school_website),
    principal_name          = coalesce(_patch->>'principal_name',         s.principal_name),
    logo_url                = coalesce(_patch->>'logo_url',               s.logo_url),
    affiliation_board       = coalesce(_patch->>'affiliation_board',      s.affiliation_board),
    affiliation_number      = coalesce(_patch->>'affiliation_number',     s.affiliation_number),
    brand_primary_color     = coalesce(_patch->>'brand_primary_color',    s.brand_primary_color),
    brand_accent_color      = coalesce(_patch->>'brand_accent_color',     s.brand_accent_color),
    document_header_note    = coalesce(_patch->>'document_header_note',   s.document_header_note),
    document_footer_note    = coalesce(_patch->>'document_footer_note',   s.document_footer_note),
    timezone                = coalesce(_patch->>'timezone',               s.timezone),
    date_format             = coalesce(_patch->>'date_format',            s.date_format),
    currency_code           = coalesce(_patch->>'currency_code',          s.currency_code),
    locale                  = coalesce(_patch->>'locale',                 s.locale),
    default_page_size       = coalesce((_patch->>'default_page_size')::int,      s.default_page_size),
    session_timeout_minutes = coalesce((_patch->>'session_timeout_minutes')::int, s.session_timeout_minutes),
    mfa_enabled             = coalesce((_patch->>'mfa_enabled')::boolean,        s.mfa_enabled),
    updated_by              = auth.uid()
  WHERE s.id = before_row.id
  RETURNING * INTO after_row;

  PERFORM public.log_system_event(
    'SETTINGS_UPDATE', 'system_settings', after_row.id,
    to_jsonb(before_row), to_jsonb(after_row)
  );

  RETURN after_row;
END;
$$;

REVOKE ALL ON FUNCTION public.update_system_settings(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_system_settings(jsonb) TO authenticated;

-- ---------------------------------------------------------------------
-- 6. Role assignment, with the guards it was missing
-- ---------------------------------------------------------------------
-- Replaces the 02c version, which checked is_admin() and nothing else.
-- Four things it now refuses, each of which was reachable before:
--
--   a. Changing your own role. Blocks self-promotion outright, and also
--      blocks the accident of an administrator demoting themselves and
--      leaving nobody able to undo it. Role changes are made by someone
--      else, which is the point of having roles.
--   b. Granting or revoking super_admin unless you are one. Bootstrap
--      exception: while no super_admin exists, an admin may appoint the
--      first, because otherwise the role could never come into being.
--   c. Removing the last remaining administrator. A school locked out of
--      its own ERP has no recovery path short of the Supabase dashboard.
--   d. Assigning a role to an account that does not exist.

CREATE OR REPLACE FUNCTION public.set_user_role(_user_id uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor            uuid := auth.uid();
  old_role         public.app_role;
  super_admins     integer;
  remaining_admins integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator may change a user role'
      USING ERRCODE = '42501';
  END IF;

  IF actor IS NOT NULL AND _user_id = actor THEN
    RAISE EXCEPTION 'You cannot change your own role. Ask another administrator.'
      USING ERRCODE = '42501';
  END IF;

  SELECT role INTO old_role FROM public.profiles WHERE id = _user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No profile exists for that user' USING ERRCODE = 'P0002';
  END IF;

  IF old_role IS NOT DISTINCT FROM _role THEN
    RETURN;
  END IF;

  SELECT count(*) INTO super_admins
  FROM public.profiles
  WHERE role = 'super_admin'::public.app_role AND status IN ('active','invited');

  IF (_role = 'super_admin'::public.app_role OR old_role = 'super_admin'::public.app_role)
     AND NOT public.is_super_admin()
     AND super_admins > 0 THEN
    RAISE EXCEPTION 'Only a super admin may grant or revoke the super admin role'
      USING ERRCODE = '42501';
  END IF;

  -- Would this leave nobody able to administer the system?
  IF old_role IN ('super_admin','admin','principal')
     AND _role NOT IN ('super_admin','admin','principal') THEN
    SELECT count(*) INTO remaining_admins
    FROM public.profiles
    WHERE role IN ('super_admin','admin','principal')
      AND status IN ('active','invited')
      AND id <> _user_id;

    IF remaining_admins = 0 THEN
      RAISE EXCEPTION 'This is the last administrator. Appoint another before removing this one.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.profiles SET role = _role WHERE id = _user_id;

  PERFORM public.log_system_event(
    'ROLE_CHANGE', 'profiles', _user_id,
    jsonb_build_object('role', old_role::text),
    jsonb_build_object('role', _role::text)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) TO authenticated;

-- ---------------------------------------------------------------------
-- 7. Account status changes
-- ---------------------------------------------------------------------
-- The supported alternative to deleting a user. Every historical record
-- the account produced stays exactly where it is; only future access
-- stops.

CREATE OR REPLACE FUNCTION public.set_user_status(
  _user_id uuid, _status text, _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor            uuid := auth.uid();
  old_status       text;
  target_role      public.app_role;
  remaining_admins integer;
BEGIN
  IF NOT public.auth_has_permission('users.manage') THEN
    RAISE EXCEPTION 'You do not have permission to change account status'
      USING ERRCODE = '42501';
  END IF;

  IF _status NOT IN ('invited','active','suspended','disabled','archived') THEN
    RAISE EXCEPTION 'Unknown account status: %', _status USING ERRCODE = '22023';
  END IF;

  IF actor IS NOT NULL AND _user_id = actor THEN
    RAISE EXCEPTION 'You cannot change your own account status'
      USING ERRCODE = '42501';
  END IF;

  SELECT status, role INTO old_status, target_role
  FROM public.profiles WHERE id = _user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No profile exists for that user' USING ERRCODE = 'P0002';
  END IF;

  IF old_status IS NOT DISTINCT FROM _status THEN
    RETURN;
  END IF;

  IF target_role = 'super_admin'::public.app_role AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a super admin may change a super admin account'
      USING ERRCODE = '42501';
  END IF;

  IF _status NOT IN ('active','invited')
     AND target_role IN ('super_admin','admin','principal') THEN
    SELECT count(*) INTO remaining_admins
    FROM public.profiles
    WHERE role IN ('super_admin','admin','principal')
      AND status IN ('active','invited')
      AND id <> _user_id;

    IF remaining_admins = 0 THEN
      RAISE EXCEPTION 'This is the last active administrator and cannot be shut off.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.profiles
  SET status = _status,
      status_reason = _reason,
      status_changed_at = now(),
      status_changed_by = actor
  WHERE id = _user_id;

  PERFORM public.log_system_event(
    'ACCOUNT_STATUS_CHANGE', 'profiles', _user_id,
    jsonb_build_object('status', old_status),
    jsonb_build_object('status', _status, 'reason', _reason)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_status(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------
-- 8. Permission grants, with the guards they were missing
-- ---------------------------------------------------------------------
-- Replaces the 02c version. Three refusals, all previously reachable by
-- any is_admin() caller:
--   a. Editing super_admin's grants unless you are one. That role holds
--      the wildcard; editing it is editing the ceiling on everything.
--   b. Granting the wildcard to any other role. That is a super_admin
--      appointment wearing a different name.
--   c. Revoking settings.manage or users.manage from your own role,
--      which is how an administrator locks themselves out one click at
--      a time.

CREATE OR REPLACE FUNCTION public.set_role_permission(
  _role public.app_role, _permission text, _granted boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor_role public.app_role;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator may change permissions'
      USING ERRCODE = '42501';
  END IF;

  SELECT role INTO actor_role FROM public.profiles WHERE id = auth.uid();

  IF _role = 'super_admin'::public.app_role AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a super admin may change super admin permissions'
      USING ERRCODE = '42501';
  END IF;

  IF _permission = '*' AND _granted AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a super admin may grant the unrestricted permission'
      USING ERRCODE = '42501';
  END IF;

  IF NOT _granted
     AND _role = actor_role
     AND _permission IN ('settings.manage','users.manage') THEN
    RAISE EXCEPTION 'You cannot remove % from your own role. Ask another administrator.', _permission
      USING ERRCODE = '42501';
  END IF;

  IF _granted THEN
    INSERT INTO public.role_permissions (role, permission)
    VALUES (_role, _permission)
    ON CONFLICT (role, permission) DO NOTHING;
  ELSE
    DELETE FROM public.role_permissions WHERE role = _role AND permission = _permission;
  END IF;

  PERFORM public.log_system_event(
    CASE WHEN _granted THEN 'PERMISSION_GRANT' ELSE 'PERMISSION_REVOKE' END,
    'role_permissions', NULL, NULL,
    jsonb_build_object('role', _role::text, 'permission', _permission)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_role_permission(public.app_role, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_role_permission(public.app_role, text, boolean) TO authenticated;

-- ---------------------------------------------------------------------
-- 9. New accounts start at the floor
-- ---------------------------------------------------------------------
-- handle_new_user() omitted role entirely and let the column default
-- decide. That works, but it means the least-privilege guarantee for a
-- brand new account rests on a default nobody looking at the function
-- can see. It is now written down.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, status)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''), '@', 1)),
    coalesce(new.email, ''),
    'student'::public.app_role,
    'invited'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

COMMIT;
