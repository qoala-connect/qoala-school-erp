-- =====================================================================
-- SYSTEM MIGRATION 08 — rollback
-- =====================================================================
-- Undoes 08a, 08b and 08c.
--
-- WHAT THIS DOES NOT UNDO, DELIBERATELY
--   The new columns on profiles and system_settings, and the seeded
--   system_settings row, are LEFT IN PLACE. Dropping profiles.status
--   discards the reason every suspended account was suspended, and
--   dropping the settings columns discards the school's configuration.
--   Both are additive and harmless if unused. If you genuinely need them
--   gone, the DROP statements are at the bottom, commented out, so that
--   removing them is a deliberate act rather than a side effect of
--   rolling back.
--
--   The indexes on audit_logs are also left: they cost storage and
--   nothing else, and removing them makes the audit screen slow again.
--
-- WHAT IT RESTORES
--   The function definitions and policies as they stood after migration
--   02c, including the wide table grants. Note that this reinstates the
--   audit-log mutability and the missing super-admin guards described in
--   08b. Roll back only if 08b broke something you need working.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. audit_logs: remove the append-only enforcement
-- ---------------------------------------------------------------------
DROP TRIGGER  IF EXISTS audit_logs_immutable        ON public.audit_logs;
DROP FUNCTION IF EXISTS public.guard_audit_log_immutable();
DROP POLICY   IF EXISTS audit_logs_admin_read       ON public.audit_logs;

CREATE POLICY audit_logs_admin_all ON public.audit_logs
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------
-- 2. system_settings: back to admin-only
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS system_settings_read ON public.system_settings;

CREATE POLICY system_settings_admin_all ON public.system_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP FUNCTION IF EXISTS public.update_system_settings(jsonb);

-- ---------------------------------------------------------------------
-- 3. Read model
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.system_overview();
DROP FUNCTION IF EXISTS public.admin_user_directory(text,text,text,text,integer,integer);
DROP FUNCTION IF EXISTS public.audit_log_search(text,text,text,uuid,timestamptz,timestamptz,integer,integer);
DROP FUNCTION IF EXISTS public.audit_log_facets();
DROP FUNCTION IF EXISTS public.link_user_to_entity(uuid,text,uuid);
DROP FUNCTION IF EXISTS public.unlink_user_from_entity(text,uuid);
DROP FUNCTION IF EXISTS public.linkable_entities(text,text);
DROP FUNCTION IF EXISTS public.set_user_status(uuid,text,text);
DROP FUNCTION IF EXISTS public.log_system_event(text,text,uuid,jsonb,jsonb);

-- ---------------------------------------------------------------------
-- 4. Authorization helpers: drop the status check
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.current_user_role() IN ('super_admin','admin','principal'); $$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.current_user_role() IN (
    'super_admin','admin','principal','vice_principal',
    'teacher','class_teacher','exam_controller','accountant',
    'office_staff','hr','receptionist','librarian',
    'transport_manager','hostel_warden'
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_has_permission(_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    JOIN public.profiles p ON p.role = rp.role
    WHERE p.id = auth.uid() AND rp.permission IN ('*', _permission)
  );
$$;

CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS TABLE (permission text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT rp.permission FROM public.role_permissions rp
  JOIN public.profiles p ON p.role = rp.role WHERE p.id = auth.uid();
$$;

DROP FUNCTION IF EXISTS public.is_super_admin();
DROP FUNCTION IF EXISTS public.account_is_active();

-- ---------------------------------------------------------------------
-- 5. set_user_role and set_role_permission as they were after 02c
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_role(_user_id uuid, _role public.app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  actor uuid := auth.uid();
  old_role public.app_role;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator may change a user role' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO old_role FROM public.profiles WHERE id = _user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No profile exists for that user' USING ERRCODE = 'P0002';
  END IF;
  IF old_role IS NOT DISTINCT FROM _role THEN RETURN; END IF;
  UPDATE public.profiles SET role = _role WHERE id = _user_id;
  INSERT INTO public.audit_logs (user_id, user_email, action_type, table_name, record_id, old_values, new_values)
  VALUES (actor, (SELECT email FROM public.profiles WHERE id = actor),
          'ROLE_CHANGE', 'profiles', _user_id,
          jsonb_build_object('role', old_role::text),
          jsonb_build_object('role', _role::text));
END;
$$;

CREATE OR REPLACE FUNCTION public.set_role_permission(
  _role public.app_role, _permission text, _granted boolean
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator may change permissions' USING ERRCODE = '42501';
  END IF;
  IF _granted THEN
    INSERT INTO public.role_permissions (role, permission) VALUES (_role, _permission)
    ON CONFLICT (role, permission) DO NOTHING;
  ELSE
    DELETE FROM public.role_permissions WHERE role = _role AND permission = _permission;
  END IF;
  INSERT INTO public.audit_logs (user_id, user_email, action_type, table_name, new_values)
  VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()),
          CASE WHEN _granted THEN 'PERMISSION_GRANT' ELSE 'PERMISSION_REVOKE' END,
          'role_permissions', jsonb_build_object('role', _role::text, 'permission', _permission));
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (new.id, coalesce(new.raw_user_meta_data->>'name',''), new.email);
  RETURN new;
END;
$$;

-- ---------------------------------------------------------------------
-- 6. Restore the wide table grants
-- ---------------------------------------------------------------------
-- These are what Supabase creates by default and what 08b narrowed.
-- Restoring them reinstates TRUNCATE for anon and authenticated, which
-- bypasses row level security. Included only so the rollback is honest
-- about returning to the previous state.
GRANT ALL ON public.audit_logs       TO anon, authenticated;
GRANT ALL ON public.activity_logs    TO anon, authenticated;
GRANT ALL ON public.system_settings  TO anon, authenticated;
GRANT ALL ON public.role_permissions TO anon, authenticated;
GRANT ALL ON public.user_roles       TO anon, authenticated;
GRANT SELECT, INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.profiles TO authenticated;
GRANT UPDATE (name, email) ON public.profiles TO authenticated;

-- The two permissions the System module introduced. Harmless if left,
-- since nothing after a rollback checks them.
DELETE FROM public.role_permissions WHERE permission IN ('audit.view','users.manage');

COMMIT;

-- ---------------------------------------------------------------------
-- 7. Data-destroying steps, not run by default
-- ---------------------------------------------------------------------
-- Uncomment only if you have decided the account lifecycle and school
-- configuration should be discarded along with the code that used them.
--
-- ALTER TABLE public.profiles
--   DROP COLUMN IF EXISTS status,
--   DROP COLUMN IF EXISTS status_reason,
--   DROP COLUMN IF EXISTS status_changed_at,
--   DROP COLUMN IF EXISTS status_changed_by,
--   DROP COLUMN IF EXISTS created_at,
--   DROP COLUMN IF EXISTS updated_at;
--
-- DELETE FROM public.system_settings;
-- ALTER TABLE public.system_settings
--   DROP COLUMN IF EXISTS school_code,
--   DROP COLUMN IF EXISTS school_website,
--   DROP COLUMN IF EXISTS principal_name,
--   DROP COLUMN IF EXISTS affiliation_board,
--   DROP COLUMN IF EXISTS affiliation_number,
--   DROP COLUMN IF EXISTS brand_primary_color,
--   DROP COLUMN IF EXISTS brand_accent_color,
--   DROP COLUMN IF EXISTS document_header_note,
--   DROP COLUMN IF EXISTS document_footer_note,
--   DROP COLUMN IF EXISTS timezone,
--   DROP COLUMN IF EXISTS date_format,
--   DROP COLUMN IF EXISTS currency_code,
--   DROP COLUMN IF EXISTS locale,
--   DROP COLUMN IF EXISTS default_page_size,
--   DROP COLUMN IF EXISTS updated_by,
--   DROP COLUMN IF EXISTS is_singleton;
