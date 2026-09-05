-- =====================================================================
-- ROLLBACK for SECURITY HOTFIX 01
-- =====================================================================
-- WARNING: running this restores the two vulnerabilities. It exists so
-- the change is reversible, not because it should ever be run.
--
-- Restores the exact privilege state captured before the hotfix:
--   - exec_sql EXECUTE granted to PUBLIC, anon, authenticated
--   - all public views back to security_definer semantics with full
--     DML grants to anon and authenticated
-- =====================================================================

BEGIN;

GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO anon;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO authenticated;

DO $$
DECLARE v record;
BEGIN
  FOR v IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relkind = 'v'
  LOOP
    -- class_strength and fee_collection_summary already had
    -- security_invoker = on before the hotfix; re-enable them below.
    EXECUTE format('ALTER VIEW public.%I RESET (security_invoker)', v.relname);
    EXECUTE format('GRANT ALL ON public.%I TO anon', v.relname);
    EXECUTE format('GRANT ALL ON public.%I TO authenticated', v.relname);
  END LOOP;

  EXECUTE 'ALTER VIEW public.class_strength SET (security_invoker = on)';
  EXECUTE 'ALTER VIEW public.fee_collection_summary SET (security_invoker = on)';
END $$;

COMMIT;
