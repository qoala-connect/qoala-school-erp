-- =====================================================================
-- SYSTEM MIGRATION 08c — read model
-- =====================================================================
-- The queries the System screens run, moved into the database.
--
-- WHY THESE ARE FUNCTIONS AND NOT CLIENT QUERIES
--
--   The user directory has to show when each account last signed in, and
--   that lives in auth.users, which PostgREST does not expose and should
--   not. The alternative would be a last_login column on profiles kept in
--   step by a trigger, which is a second copy of a fact the auth schema
--   already owns and would drift.
--
--   The audit log is designed to grow without bound. The screen filters
--   by actor, action, table and date range and pages through the result.
--   Doing that in the browser means shipping the whole table to it. Each
--   of these functions filters, sorts and pages in PostgreSQL, against
--   the indexes added in 08a.
--
--   Every one re-checks authorization itself rather than trusting that a
--   caller who reached it was allowed to. They are SECURITY DEFINER, so
--   the check is the only thing standing between the caller and the data.
--
-- SAFETY
--   Read-only. Creates functions, changes no table and no row.
--
-- ROLLBACK: supabase_system_migration_08_rollback.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. System overview
-- ---------------------------------------------------------------------
-- Real counts for the overview screen. Nothing here is computed in the
-- browser and nothing is a placeholder.

CREATE OR REPLACE FUNCTION public.system_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.auth_has_permission('users.manage')
     AND NOT public.auth_has_permission('settings.manage') THEN
    RAISE EXCEPTION 'You do not have permission to view system administration'
      USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'users', jsonb_build_object(
      'total',      (SELECT count(*) FROM public.profiles),
      'active',     (SELECT count(*) FROM public.profiles WHERE status = 'active'),
      'invited',    (SELECT count(*) FROM public.profiles WHERE status = 'invited'),
      'suspended',  (SELECT count(*) FROM public.profiles WHERE status = 'suspended'),
      'disabled',   (SELECT count(*) FROM public.profiles WHERE status = 'disabled'),
      'archived',   (SELECT count(*) FROM public.profiles WHERE status = 'archived'),
      'never_signed_in', (SELECT count(*) FROM auth.users WHERE last_sign_in_at IS NULL),
      'signed_in_7d',    (SELECT count(*) FROM auth.users WHERE last_sign_in_at > now() - interval '7 days')
    ),
    'roles', jsonb_build_object(
      'in_use',       (SELECT count(DISTINCT role) FROM public.profiles),
      'administrators',(SELECT count(*) FROM public.profiles
                        WHERE role IN ('super_admin','admin','principal')
                          AND status IN ('active','invited')),
      'super_admins', (SELECT count(*) FROM public.profiles
                       WHERE role = 'super_admin'::public.app_role
                         AND status IN ('active','invited'))
    ),
    'permissions', jsonb_build_object(
      'grants',        (SELECT count(*) FROM public.role_permissions),
      'roles_granted', (SELECT count(DISTINCT role) FROM public.role_permissions),
      'distinct',      (SELECT count(DISTINCT permission) FROM public.role_permissions WHERE permission <> '*')
    ),
    'audit', jsonb_build_object(
      'total',    (SELECT count(*) FROM public.audit_logs),
      'last_24h', (SELECT count(*) FROM public.audit_logs WHERE created_at > now() - interval '24 hours'),
      'last_7d',  (SELECT count(*) FROM public.audit_logs WHERE created_at > now() - interval '7 days'),
      'security_7d', (SELECT count(*) FROM public.audit_logs
                      WHERE created_at > now() - interval '7 days'
                        AND action_type IN ('ROLE_CHANGE','PERMISSION_GRANT','PERMISSION_REVOKE',
                                            'ACCOUNT_STATUS_CHANGE','SETTINGS_UPDATE','USER_CREATED')),
      'newest',   (SELECT max(created_at) FROM public.audit_logs)
    ),
    -- Read from the module that owns it. System does not keep its own
    -- copy of the academic year and does not let one be created here.
    'academic_year', (
      SELECT jsonb_build_object('id', id, 'name', name, 'status', status)
      FROM public.academic_years WHERE is_current LIMIT 1
    ),
    'linkage', jsonb_build_object(
      'teachers_total',  (SELECT count(*) FROM public.teachers),
      'teachers_linked', (SELECT count(*) FROM public.teachers WHERE user_id IS NOT NULL),
      'students_total',  (SELECT count(*) FROM public.students),
      'students_linked', (SELECT count(*) FROM public.students WHERE user_id IS NOT NULL),
      'staff_total',     (SELECT count(*) FROM public.staff),
      'staff_linked',    (SELECT count(*) FROM public.staff WHERE user_id IS NOT NULL)
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.system_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.system_overview() TO authenticated;

-- ---------------------------------------------------------------------
-- 2. User directory
-- ---------------------------------------------------------------------
-- One row per ERP account. The linked entity is resolved by following
-- the existing teachers.user_id / students.user_id / staff.user_id
-- columns, so an account is joined to the business record that already
-- exists rather than a second record being created alongside it.
--
-- An account may legitimately be linked to more than one entity (a
-- teacher who is also a parent). The first match wins for the summary
-- column; the counts below let the UI say so.

CREATE OR REPLACE FUNCTION public.admin_user_directory(
  _search text    DEFAULT NULL,
  _role   text    DEFAULT NULL,
  _status text    DEFAULT NULL,
  _linked text    DEFAULT NULL,   -- 'teacher' | 'student' | 'staff' | 'none' | 'any'
  _limit  integer DEFAULT 25,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  id                 uuid,
  email              text,
  name               text,
  role               text,
  status             text,
  status_reason      text,
  status_changed_at  timestamptz,
  created_at         timestamptz,
  last_sign_in_at    timestamptz,
  email_confirmed_at timestamptz,
  linked_type        text,
  linked_id          uuid,
  linked_label       text,
  linked_code        text,
  total_count        bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  q text := nullif(btrim(coalesce(_search, '')), '');
  lim integer := least(greatest(coalesce(_limit, 25), 1), 200);
  off integer := greatest(coalesce(_offset, 0), 0);
BEGIN
  IF NOT public.auth_has_permission('users.manage')
     AND NOT public.auth_has_permission('settings.manage') THEN
    RAISE EXCEPTION 'You do not have permission to view the user directory'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH linked AS (
    SELECT t.user_id, 'teacher'::text AS kind, t.id AS eid, t.name AS label, t.employee_id AS code
      FROM public.teachers t WHERE t.user_id IS NOT NULL
    UNION ALL
    SELECT s.user_id, 'staff', s.id, s.name, s.employee_id
      FROM public.staff s WHERE s.user_id IS NOT NULL
    UNION ALL
    SELECT st.user_id, 'student', st.id, st.name, st.admission_number
      FROM public.students st WHERE st.user_id IS NOT NULL
  ),
  first_link AS (
    SELECT DISTINCT ON (user_id) user_id, kind, eid, label, code
    FROM linked ORDER BY user_id, kind
  ),
  base AS (
    SELECT
      p.id, p.email, p.name, p.role::text AS role, p.status, p.status_reason,
      p.status_changed_at, p.created_at,
      u.last_sign_in_at, u.email_confirmed_at,
      fl.kind AS linked_type, fl.eid AS linked_id, fl.label AS linked_label, fl.code AS linked_code
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    LEFT JOIN first_link fl ON fl.user_id = p.id
    WHERE (q IS NULL
           OR p.email ILIKE '%' || q || '%'
           OR p.name  ILIKE '%' || q || '%'
           OR coalesce(fl.label, '') ILIKE '%' || q || '%'
           OR coalesce(fl.code, '')  ILIKE '%' || q || '%')
      AND (_role   IS NULL OR _role   = 'all' OR p.role::text = _role)
      AND (_status IS NULL OR _status = 'all' OR p.status     = _status)
      AND (_linked IS NULL OR _linked = 'all'
           OR (_linked = 'none' AND fl.kind IS NULL)
           OR (_linked = 'any'  AND fl.kind IS NOT NULL)
           OR fl.kind = _linked)
  )
  SELECT b.*, (SELECT count(*) FROM base) AS total_count
  FROM base b
  ORDER BY
    -- accounts needing attention first, then most recently active
    CASE b.status WHEN 'suspended' THEN 0 WHEN 'invited' THEN 1 ELSE 2 END,
    b.last_sign_in_at DESC NULLS LAST,
    b.email
  LIMIT lim OFFSET off;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_directory(text,text,text,text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_directory(text,text,text,text,integer,integer) TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Linking an account to the business record that already exists
-- ---------------------------------------------------------------------
-- The rule this enforces, which the brief is emphatic about: creating a
-- login for a teacher must never create a second teacher. This only ever
-- writes the user_id column on a row that is already there, and refuses
-- if either side is already spoken for.

CREATE OR REPLACE FUNCTION public.link_user_to_entity(
  _user_id uuid, _entity_type text, _entity_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing uuid;
BEGIN
  IF NOT public.auth_has_permission('users.manage') THEN
    RAISE EXCEPTION 'You do not have permission to link accounts'
      USING ERRCODE = '42501';
  END IF;

  IF _entity_type NOT IN ('teacher','staff','student') THEN
    RAISE EXCEPTION 'Unknown entity type: %', _entity_type USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RAISE EXCEPTION 'No profile exists for that user' USING ERRCODE = 'P0002';
  END IF;

  CASE _entity_type
    WHEN 'teacher' THEN
      SELECT user_id INTO existing FROM public.teachers WHERE id = _entity_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'No such teacher' USING ERRCODE = 'P0002'; END IF;
      IF existing IS NOT NULL AND existing <> _user_id THEN
        RAISE EXCEPTION 'That teacher is already linked to a different account'
          USING ERRCODE = '23505';
      END IF;
      UPDATE public.teachers SET user_id = _user_id WHERE id = _entity_id;
    WHEN 'staff' THEN
      SELECT user_id INTO existing FROM public.staff WHERE id = _entity_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'No such staff member' USING ERRCODE = 'P0002'; END IF;
      IF existing IS NOT NULL AND existing <> _user_id THEN
        RAISE EXCEPTION 'That staff member is already linked to a different account'
          USING ERRCODE = '23505';
      END IF;
      UPDATE public.staff SET user_id = _user_id WHERE id = _entity_id;
    WHEN 'student' THEN
      SELECT user_id INTO existing FROM public.students WHERE id = _entity_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'No such student' USING ERRCODE = 'P0002'; END IF;
      IF existing IS NOT NULL AND existing <> _user_id THEN
        RAISE EXCEPTION 'That student is already linked to a different account'
          USING ERRCODE = '23505';
      END IF;
      UPDATE public.students SET user_id = _user_id WHERE id = _entity_id;
  END CASE;

  PERFORM public.log_system_event(
    'USER_LINKED', _entity_type || 's', _entity_id, NULL,
    jsonb_build_object('user_id', _user_id, 'entity_type', _entity_type)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.link_user_to_entity(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_user_to_entity(uuid,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.unlink_user_from_entity(
  _entity_type text, _entity_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.auth_has_permission('users.manage') THEN
    RAISE EXCEPTION 'You do not have permission to unlink accounts'
      USING ERRCODE = '42501';
  END IF;

  CASE _entity_type
    WHEN 'teacher' THEN UPDATE public.teachers SET user_id = NULL WHERE id = _entity_id;
    WHEN 'staff'   THEN UPDATE public.staff    SET user_id = NULL WHERE id = _entity_id;
    WHEN 'student' THEN UPDATE public.students SET user_id = NULL WHERE id = _entity_id;
    ELSE RAISE EXCEPTION 'Unknown entity type: %', _entity_type USING ERRCODE = '22023';
  END CASE;

  PERFORM public.log_system_event(
    'USER_UNLINKED', _entity_type || 's', _entity_id, NULL,
    jsonb_build_object('entity_type', _entity_type)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.unlink_user_from_entity(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlink_user_from_entity(text,uuid) TO authenticated;

-- Candidate business records an account could be attached to. Only
-- unlinked ones, so the UI cannot offer a record that already has a
-- login and cause the duplicate this is meant to prevent.
CREATE OR REPLACE FUNCTION public.linkable_entities(_entity_type text, _search text DEFAULT NULL)
RETURNS TABLE (id uuid, label text, code text, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE q text := nullif(btrim(coalesce(_search, '')), '');
BEGIN
  IF NOT public.auth_has_permission('users.manage') THEN
    RAISE EXCEPTION 'You do not have permission to view linkable records'
      USING ERRCODE = '42501';
  END IF;

  IF _entity_type = 'teacher' THEN
    RETURN QUERY
      SELECT t.id, t.name, t.employee_id, coalesce(t.designation, t.department, '')
      FROM public.teachers t
      WHERE t.user_id IS NULL
        AND (q IS NULL OR t.name ILIKE '%'||q||'%' OR coalesce(t.employee_id,'') ILIKE '%'||q||'%')
      ORDER BY t.name LIMIT 50;
  ELSIF _entity_type = 'staff' THEN
    RETURN QUERY
      SELECT s.id, s.name, s.employee_id, coalesce(s.designation, s.role_title, '')
      FROM public.staff s
      WHERE s.user_id IS NULL
        AND (q IS NULL OR s.name ILIKE '%'||q||'%' OR coalesce(s.employee_id,'') ILIKE '%'||q||'%')
      ORDER BY s.name LIMIT 50;
  ELSIF _entity_type = 'student' THEN
    RETURN QUERY
      SELECT st.id, st.name, st.admission_number,
             coalesce(st.class,'') || coalesce(' / ' || st.section, '')
      FROM public.students st
      WHERE st.user_id IS NULL AND st.status = 'active'
        AND (q IS NULL OR st.name ILIKE '%'||q||'%' OR coalesce(st.admission_number,'') ILIKE '%'||q||'%')
      ORDER BY st.name LIMIT 50;
  ELSE
    RAISE EXCEPTION 'Unknown entity type: %', _entity_type USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.linkable_entities(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.linkable_entities(text,text) TO authenticated;

-- ---------------------------------------------------------------------
-- 4. Audit log search
-- ---------------------------------------------------------------------
-- Filtered, sorted and paged in the database. The screen never asks for
-- the whole table, which matters for the one table in this schema with
-- no natural ceiling on its size.

CREATE OR REPLACE FUNCTION public.audit_log_search(
  _search  text        DEFAULT NULL,
  _action  text        DEFAULT NULL,
  _table   text        DEFAULT NULL,
  _user_id uuid        DEFAULT NULL,
  _from    timestamptz DEFAULT NULL,
  _to      timestamptz DEFAULT NULL,
  _limit   integer     DEFAULT 50,
  _offset  integer     DEFAULT 0
)
RETURNS TABLE (
  id          uuid,
  user_id     uuid,
  user_email  text,
  actor_name  text,
  action_type text,
  table_name  text,
  record_id   uuid,
  old_values  jsonb,
  new_values  jsonb,
  ip_address  text,
  created_at  timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  q text := nullif(btrim(coalesce(_search, '')), '');
  lim integer := least(greatest(coalesce(_limit, 50), 1), 200);
  off integer := greatest(coalesce(_offset, 0), 0);
BEGIN
  IF NOT public.auth_has_permission('audit.view') THEN
    RAISE EXCEPTION 'You do not have permission to read the audit log'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT a.id, a.user_id, a.user_email::text, p.name AS actor_name,
           a.action_type::text, a.table_name::text, a.record_id,
           a.old_values, a.new_values, a.ip_address::text, a.created_at
    FROM public.audit_logs a
    LEFT JOIN public.profiles p ON p.id = a.user_id
    WHERE (_action  IS NULL OR _action = 'all' OR a.action_type = _action)
      AND (_table   IS NULL OR _table  = 'all' OR a.table_name  = _table)
      AND (_user_id IS NULL OR a.user_id = _user_id)
      AND (_from    IS NULL OR a.created_at >= _from)
      AND (_to      IS NULL OR a.created_at <  _to)
      AND (q IS NULL
           OR a.user_email ILIKE '%'||q||'%'
           OR a.action_type ILIKE '%'||q||'%'
           OR a.table_name ILIKE '%'||q||'%'
           OR coalesce(p.name,'') ILIKE '%'||q||'%'
           OR a.record_id::text = q)
  )
  SELECT b.*, (SELECT count(*) FROM base) AS total_count
  FROM base b
  ORDER BY b.created_at DESC
  LIMIT lim OFFSET off;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_log_search(text,text,text,uuid,timestamptz,timestamptz,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_log_search(text,text,text,uuid,timestamptz,timestamptz,integer,integer) TO authenticated;

-- The values the filter dropdowns should offer, taken from what is
-- actually in the log rather than a hand-maintained list that drifts.
CREATE OR REPLACE FUNCTION public.audit_log_facets()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.auth_has_permission('audit.view') THEN
    RAISE EXCEPTION 'You do not have permission to read the audit log'
      USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'actions', (SELECT coalesce(jsonb_agg(x ORDER BY x), '[]'::jsonb)
                FROM (SELECT DISTINCT action_type AS x FROM public.audit_logs) s),
    'tables',  (SELECT coalesce(jsonb_agg(x ORDER BY x), '[]'::jsonb)
                FROM (SELECT DISTINCT table_name AS x FROM public.audit_logs) s),
    'actors',  (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'email', email, 'name', name)
                                          ORDER BY email), '[]'::jsonb)
                FROM (SELECT DISTINCT a.user_id AS id, a.user_email AS email, p.name
                      FROM public.audit_logs a
                      LEFT JOIN public.profiles p ON p.id = a.user_id
                      WHERE a.user_id IS NOT NULL) s)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_log_facets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_log_facets() TO authenticated;

COMMIT;
