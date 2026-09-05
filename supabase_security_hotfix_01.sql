-- =====================================================================
-- SECURITY HOTFIX 01
-- =====================================================================
-- Closes two verified holes that allow an UNAUTHENTICATED caller
-- (holding only the public anon key) to:
--   1. execute arbitrary SQL as the postgres superuser, and
--   2. read student PII through views that bypass Row Level Security.
--
-- Both were confirmed against the live project by issuing anon-key
-- requests to PostgREST before this file was written.
--
-- This migration is ADDITIVE and REVERSIBLE. It drops no objects and
-- deletes no rows. It only narrows privileges and changes how views
-- resolve permissions.
--
-- ROLLBACK: see supabase_security_hotfix_01_rollback.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. exec_sql(text)
-- ---------------------------------------------------------------------
-- The function is SECURITY DEFINER and owned by postgres, so every call
-- runs with superuser rights. EXECUTE was granted to PUBLIC, anon and
-- authenticated, making it reachable at /rest/v1/rpc/exec_sql by anyone
-- on the internet.
--
-- The function itself is kept (DatabaseManager.tsx calls it and already
-- has a fallback path) but is no longer reachable from the browser.
-- Only postgres and service_role retain EXECUTE.

REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM anon;
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM authenticated;

-- ---------------------------------------------------------------------
-- 2. Views
-- ---------------------------------------------------------------------
-- A view without security_invoker executes with its OWNER's privileges.
-- All of these are owned by postgres, so they read underlying tables
-- with RLS bypassed. anon additionally held full DML grants on them.
--
-- security_invoker = on makes each view execute as the CALLER, so the
-- RLS policies on students/fees/marks/etc. apply normally.
-- anon loses access entirely; authenticated keeps SELECT and is then
-- filtered by the existing is_staff() / owner policies.

DO $$
DECLARE
  v record;
  n_altered int := 0;
BEGIN
  FOR v IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public'
      AND c.relkind = 'v'
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v.relname);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', v.relname);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', v.relname);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', v.relname);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v.relname);
    n_altered := n_altered + 1;
  END LOOP;

  RAISE NOTICE 'security_invoker enabled and grants tightened on % views', n_altered;
END $$;

COMMIT;
