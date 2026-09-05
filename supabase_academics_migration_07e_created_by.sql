-- =====================================================================
-- MIGRATION 07e — make class_subjects.created_by actually record someone
-- =====================================================================
--
-- 07a added created_by to class_subjects for audit. Driving the live UI
-- showed the column staying null on every row a real user created,
-- because nothing fills it: the client does not send it and there is no
-- default. An audit column that is always null is worse than no column,
-- because it reads as "nobody did this" rather than "we do not know".
--
-- Defaulting to auth.uid() fills it from the JWT for every insert
-- through PostgREST, whichever screen the insert came from, and leaves
-- it null for a service-role or SQL insert where there is no user to
-- name. That is more reliable than asking each client to remember.
--
-- Existing rows are left null. Who created them is genuinely unknown
-- and inventing an answer would be worse than the gap.
--
-- ROLLBACK: supabase_academics_migration_07_rollback.sql already drops
-- the column; to revert only this step:
--   ALTER TABLE public.class_subjects ALTER COLUMN created_by DROP DEFAULT;
-- =====================================================================

BEGIN;

ALTER TABLE public.class_subjects
  ALTER COLUMN created_by SET DEFAULT auth.uid();

COMMENT ON COLUMN public.class_subjects.created_by IS
  'Who mapped this subject to this class. Filled from the JWT by default; null for rows created before 07e, or by a service-role job with no user behind it.';

CREATE INDEX IF NOT EXISTS idx_class_subjects_created_by
  ON public.class_subjects (created_by) WHERE created_by IS NOT NULL;

COMMIT;
