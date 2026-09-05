-- =====================================================================
-- MIGRATION 07d — harden the class-teacher sync trigger
-- =====================================================================
--
-- fn_sync_class_section_teacher() writes class_sections.class_teacher_id
-- whenever a class-teacher assignment is saved. It is SECURITY DEFINER,
-- so it runs with the owner's rights, but it was created without a fixed
-- search_path. A SECURITY DEFINER function with a mutable search_path
-- resolves its unqualified names against whatever the caller has set,
-- which is the standard privilege-escalation route in Postgres.
--
-- The body is unchanged. Only the search_path is pinned, and the table
-- names are schema-qualified so the pin is belt and braces.
--
-- ROLLBACK: supabase_academics_migration_07_rollback.sql (drops nothing
-- here; re-apply the original from supabase_teacher_assignment_migration.sql
-- if this must be reverted).
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_sync_class_section_teacher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  curr_yr_id uuid;
BEGIN
  SELECT id INTO curr_yr_id FROM public.academic_years WHERE is_current = true LIMIT 1;

  IF (NEW.assignment_type IN ('class_teacher', 'both') AND NEW.is_active = true) THEN
    IF (NEW.academic_year_id = curr_yr_id) THEN
      UPDATE public.class_sections
         SET class_teacher_id = NEW.teacher_id, updated_at = now()
       WHERE class_id = NEW.class_id AND section_id = NEW.section_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.fn_sync_class_section_teacher() IS
  'Mirrors the current year''s class-teacher assignment onto class_sections so class lists can resolve it without a join. teacher_assignments remains the source of truth.';

COMMIT;
