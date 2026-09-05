-- =====================================================================
-- MIGRATION 06b — two gaps the Phase 5 tests exposed
-- =====================================================================
--   1. storage.buckets has no SELECT policy, so listBuckets() returns
--      nothing even for an administrator. The object policies added in 06
--      are correct; the bucket catalogue itself was never readable.
--
--   2. Migration 06 backfilled employee_id on existing staff with a
--      one-off UPDATE, so every NEW employee was created with a NULL
--      employee id. A backfill is not a default.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Let signed-in users see which buckets exist
-- ---------------------------------------------------------------------
-- Reading the catalogue reveals only bucket names and limits. Access to
-- the objects inside stays governed by the storage.objects policies.
DROP POLICY IF EXISTS buckets_authenticated_read ON storage.buckets;
CREATE POLICY buckets_authenticated_read ON storage.buckets
  FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------
-- 2. Assign employee_id on insert, not just to the rows that existed
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_employee_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
DECLARE
  next_number integer;
BEGIN
  IF NEW.employee_id IS NULL OR btrim(NEW.employee_id) = '' THEN
    -- Highest existing EMP-nnnn, then one more. Cast before comparing so
    -- EMP-9 does not sort above EMP-10, the mistake the roll number
    -- generator made.
    SELECT coalesce(max(nullif(substring(employee_id FROM 'EMP-([0-9]+)$'), '')::integer), 0) + 1
      INTO next_number
      FROM public.staff;

    NEW.employee_id := 'EMP-' || lpad(next_number::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS staff_assign_employee_id ON public.staff;
CREATE TRIGGER staff_assign_employee_id
  BEFORE INSERT ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.assign_employee_id();

-- Re-issue the hash-based ids from 06 as a clean sequence.
WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY coalesce(joining_date, created_at::date), created_at) AS n
  FROM public.staff
)
UPDATE public.staff s
SET employee_id = 'EMP-' || lpad(numbered.n::text, 4, '0')
FROM numbered
WHERE s.id = numbered.id
  AND (s.employee_id IS NULL OR s.employee_id LIKE 'EMP-________');

COMMIT;
