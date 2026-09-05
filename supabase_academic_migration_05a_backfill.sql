-- =====================================================================
-- MIGRATION 05a — academic year and student lifecycle: ADDITIVE + BACKFILL
-- =====================================================================
-- This step ADDS columns and FILLS them. It adds NO constraints and
-- CHANGES NO existing column, so it cannot break anything currently
-- working and needs no downtime. Constraints follow in 05b, only once
-- the backfill has been reviewed.
--
-- WHY
--   students.class, .section and .academic_year are free text with no
--   foreign key. The properly normalised classes, sections,
--   class_sections and academic_years tables exist beside them, unused
--   and in three cases empty. The same class is spelled five different
--   ways across six tables and the same year three ways:
--
--     students             'Class 1' .. 'Class 12'      '2026-2027'
--     classes              '1' .. '12'                  -
--     class_subjects       '1','2','3'                  '2025-2026'
--     class_fee_structure  '1','2','3'                  '2025-2026'
--     timetable            '1','2'                      -
--     exams                '9th','10th'                 '2026-27'
--     class_teachers       '3','10-A','8-C','9-B'       -
--
--   Not one student matched any row in classes. A typo creates a phantom
--   class, and renaming a class orphans every student in it.
--
--   students also has no status column at all, so transferred, graduated
--   and withdrawn cannot be represented and leavers cannot be excluded
--   from class lists, fee runs or attendance.
--
-- DATA IMPACT
--   No existing value is modified. The text columns are left in place as
--   the display source while the application migrates to the ids.
--
-- ROLLBACK: supabase_academic_migration_05a_rollback.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. A normaliser for the five class spellings
-- ---------------------------------------------------------------------
-- Takes the leading run of digits: 'Class 1' -> 1, '10th' -> 10,
-- '9-B' -> 9, '3' -> 3. Returns NULL when there is no number to find,
-- so unmatchable rows surface rather than being silently mis-linked.
CREATE OR REPLACE FUNCTION public.class_key(_raw text)
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$
  SELECT nullif(substring(coalesce(_raw, '') FROM '[0-9]+'), '')::integer;
$$;

COMMENT ON FUNCTION public.class_key(text) IS
  'Extracts the numeric class from any of the spellings in use. Transitional: remove once every table references classes.id.';

-- ---------------------------------------------------------------------
-- 2. Reference data that should already exist
-- ---------------------------------------------------------------------

-- sections holds zero rows while 120 students carry a section letter.
INSERT INTO public.sections (section_name, capacity, is_active)
SELECT DISTINCT s.section, 40, true
FROM public.students s
WHERE s.section IS NOT NULL AND btrim(s.section) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.sections x WHERE x.section_name = s.section)
ON CONFLICT DO NOTHING;

-- class_teachers references sections that no student is in (C).
INSERT INTO public.sections (section_name, capacity, is_active)
SELECT DISTINCT split_part(ct.class, '-', 2), 40, true
FROM public.class_teachers ct
WHERE ct.class LIKE '%-%'
  AND split_part(ct.class, '-', 2) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.sections x WHERE x.section_name = split_part(ct.class, '-', 2))
ON CONFLICT DO NOTHING;

-- class_subjects and class_fee_structure are stamped 2025-2026, a year
-- that does not exist in academic_years. Create it rather than
-- mislabelling those rows as the current year.
INSERT INTO public.academic_years (name, start_date, end_date, is_current, is_active)
SELECT '2025-26', DATE '2025-04-01', DATE '2026-03-31', false, false
WHERE NOT EXISTS (SELECT 1 FROM public.academic_years WHERE name = '2025-26');

-- ---------------------------------------------------------------------
-- 3. New columns on students
-- ---------------------------------------------------------------------
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS class_id         uuid REFERENCES public.classes(id)        ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS section_id       uuid REFERENCES public.sections(id)       ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS status           text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz;

COMMENT ON COLUMN public.students.status IS
  'Lifecycle state: active, inactive, transferred, graduated, withdrawn. Only active students appear in operational lists.';

CREATE INDEX IF NOT EXISTS idx_students_class_section ON public.students (class_id, section_id);
CREATE INDEX IF NOT EXISTS idx_students_status        ON public.students (status);
CREATE INDEX IF NOT EXISTS idx_students_year          ON public.students (academic_year_id);

-- ---------------------------------------------------------------------
-- 4. New columns on exams
-- ---------------------------------------------------------------------
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS class_id         uuid REFERENCES public.classes(id)        ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------
-- 5. Backfill
-- ---------------------------------------------------------------------
UPDATE public.students s
SET class_id = c.id
FROM public.classes c
WHERE s.class_id IS NULL
  AND public.class_key(c.class_name) = public.class_key(s.class);

UPDATE public.students s
SET section_id = sec.id
FROM public.sections sec
WHERE s.section_id IS NULL
  AND sec.section_name = s.section;

-- Every student carries '2026-2027'; the current year is named '2026-27'.
-- Matching on the leading year number rather than the exact string.
UPDATE public.students s
SET academic_year_id = ay.id
FROM public.academic_years ay
WHERE s.academic_year_id IS NULL
  AND substring(ay.name FROM '^[0-9]{4}') = substring(s.academic_year FROM '^[0-9]{4}');

UPDATE public.students
SET status = 'active', status_changed_at = now()
WHERE status IS NULL;

UPDATE public.students SET updated_at = coalesce(updated_at, created_at, now());

UPDATE public.exams e
SET class_id = c.id
FROM public.classes c
WHERE e.class_id IS NULL
  AND public.class_key(c.class_name) = public.class_key(e.class);

UPDATE public.exams e
SET academic_year_id = ay.id
FROM public.academic_years ay
WHERE e.academic_year_id IS NULL
  AND substring(ay.name FROM '^[0-9]{4}') = substring(e.academic_year FROM '^[0-9]{4}');

-- ---------------------------------------------------------------------
-- 6. class_sections, from the class/section pairs students are actually in
-- ---------------------------------------------------------------------
INSERT INTO public.class_sections (class_id, section_id)
SELECT DISTINCT s.class_id, s.section_id
FROM public.students s
WHERE s.class_id IS NOT NULL AND s.section_id IS NOT NULL
ON CONFLICT (class_id, section_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 7. Keep updated_at honest from here on
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_update_students ON public.students;
CREATE TRIGGER trigger_update_students
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

COMMIT;
