-- =====================================================================
-- MIGRATION 10 — TIMETABLE: CLASH GUARD
-- =====================================================================
--
-- THE INTEGRITY DEFECT THIS CLOSES
--
--   timetable carried no uniqueness of any kind. The same class,
--   section, day and period could be written any number of times, so a
--   class could hold two subjects in period 3 and the printed schedule
--   showed whichever row came back first. The application now refuses
--   such a write, but two admins saving at the same moment still race
--   past a check that lives only in the client.
--
--   section_id is NULL for a slot that belongs to the whole class, so
--   NULLS NOT DISTINCT is required or one class could take the same
--   period twice as long as neither row named a section.
--
-- WHAT THIS DOES NOT DO
--
--   A teacher standing in two rooms at once is left to the application
--   check. The live data holds 200 such pairs, seeded rather than
--   entered, and a unique index would refuse to build until every one
--   of them is resolved. Removing them is a decision about the school's
--   schedule, not a migration. The view added below lists them so they
--   can be worked through, and the index can follow once it returns
--   nothing.
--
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. One subject per class, section and period
-- ---------------------------------------------------------------------
DROP INDEX IF EXISTS uq_timetable_class_period;
CREATE UNIQUE INDEX uq_timetable_class_period
  ON public.timetable (academic_year_id, class_id, section_id, day, period_number)
  NULLS NOT DISTINCT;

COMMENT ON INDEX public.uq_timetable_class_period IS
  'A class and section hold one subject in a period. A NULL section is a whole-class slot and counts as a value, so it cannot be duplicated either.';

-- ---------------------------------------------------------------------
-- 2. A period is a positive number and ends after it starts
-- ---------------------------------------------------------------------
-- NOT VALID: the constraints govern every write from here on without
-- demanding that historic rows be corrected before the migration runs.
ALTER TABLE public.timetable DROP CONSTRAINT IF EXISTS timetable_period_positive;
ALTER TABLE public.timetable
  ADD CONSTRAINT timetable_period_positive
  CHECK (period_number IS NULL OR period_number >= 1) NOT VALID;

ALTER TABLE public.timetable DROP CONSTRAINT IF EXISTS timetable_period_ends_after_start;
ALTER TABLE public.timetable
  ADD CONSTRAINT timetable_period_ends_after_start
  CHECK (start_time IS NULL OR end_time IS NULL OR end_time > start_time) NOT VALID;

-- ---------------------------------------------------------------------
-- 3. Teacher double-bookings, listed rather than enforced
-- ---------------------------------------------------------------------
-- security_invoker: the view reads timetable under the caller's own row
-- level security rather than the owner's, so it grants no extra reach.
DROP VIEW IF EXISTS public.timetable_teacher_clashes;
CREATE VIEW public.timetable_teacher_clashes
WITH (security_invoker = on) AS
SELECT t.academic_year_id,
       t.teacher_id,
       tc.name AS teacher_name,
       t.day,
       t.period_number,
       count(*)                                   AS slot_count,
       array_agg(t.id ORDER BY t.id)              AS slot_ids,
       string_agg(DISTINCT t.class, ', ')         AS classes
  FROM public.timetable t
  LEFT JOIN public.teachers tc ON tc.id = t.teacher_id
 WHERE t.teacher_id IS NOT NULL
 GROUP BY t.academic_year_id, t.teacher_id, tc.name, t.day, t.period_number
HAVING count(*) > 1;

COMMENT ON VIEW public.timetable_teacher_clashes IS
  'Periods where one teacher is scheduled for more than one class at the same time. Empty is the goal; once it is empty a unique index on (academic_year_id, teacher_id, day, period_number) can replace it.';

REVOKE ALL ON public.timetable_teacher_clashes FROM anon, authenticated;
GRANT SELECT ON public.timetable_teacher_clashes TO authenticated;

-- =====================================================================
-- ROLLBACK
-- =====================================================================
--   DROP INDEX IF EXISTS public.uq_timetable_class_period;
--   ALTER TABLE public.timetable DROP CONSTRAINT IF EXISTS timetable_period_positive;
--   ALTER TABLE public.timetable DROP CONSTRAINT IF EXISTS timetable_period_ends_after_start;
--   DROP VIEW IF EXISTS public.timetable_teacher_clashes;
