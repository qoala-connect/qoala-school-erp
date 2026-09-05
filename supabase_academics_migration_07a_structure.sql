-- =====================================================================
-- MIGRATION 07a — ACADEMICS AS THE CANONICAL ACADEMIC STRUCTURE
-- Additive schema + backfill. No column is dropped, renamed or retyped.
-- =====================================================================
--
-- WHAT THIS FIXES
--
--   classes   held two columns, id and class_name. There was nowhere to
--             record a code, an ordering, a stream or an active flag, so
--             the Academics screen wrote class_code and class_group on
--             every save and every save failed with 42703.
--
--   subjects  held three columns. The same screen wrote `category`,
--             which does not exist, so no subject could be created or
--             edited from the UI at all.
--
--   sections  had no unique constraint on section_name. 'A' could be
--             created any number of times, and each copy would split the
--             students, assignments and timetable rows that pointed at it.
--
--   class_subjects keyed on text: class '1' and academic_year
--             '2025-2026'. Neither matches classes.class_name or
--             academic_years.name, so the twelve existing rows describe a
--             year that the rest of the system does not believe exists.
--             No module reads this table today.
--
--   timetable kept the class as text and had no section or period at all,
--             so a slot could not identify which section it belonged to.
--             timetable.teacher_id points at auth.users while the whole
--             application joins it against teachers.id, which is why
--             every timetable row renders as "Unassigned".
--
-- APPROACH
--   The id columns are added beside the text columns and backfilled, the
--   same transitional shape migration 05a used for students. Triggers
--   keep the text columns in step so nothing reading them breaks. The
--   text columns are retired in a later migration, once every consumer
--   reads ids.
--
-- ROLLBACK: supabase_academics_migration_07_rollback.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. classes — the master definition of a class
-- ---------------------------------------------------------------------
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS class_code    text,
  ADD COLUMN IF NOT EXISTS display_order integer,
  ADD COLUMN IF NOT EXISTS stream        text,
  ADD COLUMN IF NOT EXISTS is_active     boolean,
  ADD COLUMN IF NOT EXISTS created_at    timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at    timestamptz;

-- class_name is '1'..'12'. The code is what people type and search on;
-- display_order is what every list must sort by, because sorting the
-- name as text puts 10, 11 and 12 between 1 and 2.
UPDATE public.classes
   SET class_code    = coalesce(class_code, 'C' || class_name),
       display_order = coalesce(display_order, public.class_key(class_name), 999),
       stream        = coalesce(stream, 'General'),
       is_active     = coalesce(is_active, true),
       created_at    = coalesce(created_at, now()),
       updated_at    = coalesce(updated_at, now());

ALTER TABLE public.classes
  ALTER COLUMN display_order SET NOT NULL,
  ALTER COLUMN is_active     SET DEFAULT true,
  ALTER COLUMN is_active     SET NOT NULL,
  ALTER COLUMN stream        SET DEFAULT 'General',
  ALTER COLUMN created_at    SET DEFAULT now(),
  ALTER COLUMN created_at    SET NOT NULL,
  ALTER COLUMN updated_at    SET DEFAULT now(),
  ALTER COLUMN updated_at    SET NOT NULL;

ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_class_code_key;
ALTER TABLE public.classes ADD  CONSTRAINT classes_class_code_key UNIQUE (class_code);

CREATE INDEX IF NOT EXISTS idx_classes_display_order ON public.classes (display_order);
CREATE INDEX IF NOT EXISTS idx_classes_active        ON public.classes (is_active);

DROP TRIGGER IF EXISTS trg_classes_updated_at ON public.classes;
CREATE TRIGGER trg_classes_updated_at BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

COMMENT ON TABLE public.classes IS
  'Canonical class master, owned by Academics. Every module references classes.id. Never delete a class that has students, exams or fees behind it; deactivate it.';

-- ---------------------------------------------------------------------
-- 2. subjects — the master definition of a subject
-- ---------------------------------------------------------------------
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS category     text,
  ADD COLUMN IF NOT EXISTS subject_type text,
  ADD COLUMN IF NOT EXISTS is_active    boolean,
  ADD COLUMN IF NOT EXISTS created_at   timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz;

UPDATE public.subjects
   SET category     = coalesce(category, 'Scholastic'),
       subject_type = coalesce(subject_type, 'Theory'),
       is_active    = coalesce(is_active, true),
       created_at   = coalesce(created_at, now()),
       updated_at   = coalesce(updated_at, now());

-- Give the six seeded subjects the codes they were created without.
UPDATE public.subjects s
   SET subject_code = v.code
  FROM (VALUES
          ('Mathematics',     'MATH'),
          ('Science',         'SCI'),
          ('English',         'ENG'),
          ('Hindi',           'HIN'),
          ('Social Science',  'SST'),
          ('Social Studies',  'SST2'),
          ('Computer Science','CS'),
          ('Sanskrit',        'SAN')
       ) AS v(nm, code)
 WHERE s.subject_name = v.nm
   AND s.subject_code IS NULL;

-- Anything still without a code gets a deterministic one from its name.
UPDATE public.subjects
   SET subject_code = upper(regexp_replace(subject_name, '[^A-Za-z]', '', 'g'))
 WHERE subject_code IS NULL;

ALTER TABLE public.subjects
  ALTER COLUMN category     SET DEFAULT 'Scholastic',
  ALTER COLUMN category     SET NOT NULL,
  ALTER COLUMN subject_type SET DEFAULT 'Theory',
  ALTER COLUMN subject_type SET NOT NULL,
  ALTER COLUMN is_active    SET DEFAULT true,
  ALTER COLUMN is_active    SET NOT NULL,
  ALTER COLUMN created_at   SET DEFAULT now(),
  ALTER COLUMN created_at   SET NOT NULL,
  ALTER COLUMN updated_at   SET DEFAULT now(),
  ALTER COLUMN updated_at   SET NOT NULL;

ALTER TABLE public.subjects DROP CONSTRAINT IF EXISTS subjects_category_check;
ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_category_check
  CHECK (category IN ('Scholastic', 'Co-Scholastic'));

ALTER TABLE public.subjects DROP CONSTRAINT IF EXISTS subjects_type_check;
ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_type_check
  CHECK (subject_type IN ('Theory', 'Practical', 'Theory + Practical', 'Activity'));

CREATE INDEX IF NOT EXISTS idx_subjects_active ON public.subjects (is_active);

DROP TRIGGER IF EXISTS trg_subjects_updated_at ON public.subjects;
CREATE TRIGGER trg_subjects_updated_at BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

COMMENT ON TABLE public.subjects IS
  'Canonical subject master, owned by Academics. Examination, Timetable and Attendance reference subjects.id and must not create subjects of their own.';

-- ---------------------------------------------------------------------
-- 3. sections — global letters, attached to classes through class_sections
-- ---------------------------------------------------------------------
-- Sections are global here (A, B, C) and become real only once paired
-- with a class in class_sections. That is the shape the data already has
-- and the shape students, teacher_assignments and admissions already
-- point at, so it is kept rather than reinvented.
ALTER TABLE public.sections DROP CONSTRAINT IF EXISTS sections_section_name_key;
ALTER TABLE public.sections ADD  CONSTRAINT sections_section_name_key UNIQUE (section_name);

DROP TRIGGER IF EXISTS trg_sections_updated_at ON public.sections;
CREATE TRIGGER trg_sections_updated_at BEFORE UPDATE ON public.sections
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

COMMENT ON TABLE public.sections IS
  'Section letters, global and reusable. A section becomes a real teaching group only through class_sections.';

-- ---------------------------------------------------------------------
-- 4. class_sections — which sections a class actually runs
-- ---------------------------------------------------------------------
ALTER TABLE public.class_sections
  ADD COLUMN IF NOT EXISTS capacity  integer,
  ADD COLUMN IF NOT EXISTS room_no   text,
  ADD COLUMN IF NOT EXISTS is_active boolean;

UPDATE public.class_sections cs
   SET capacity  = coalesce(cs.capacity, sec.capacity, 40),
       is_active = coalesce(cs.is_active, true)
  FROM public.sections sec
 WHERE sec.id = cs.section_id;

ALTER TABLE public.class_sections
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN capacity  SET DEFAULT 40;

COMMENT ON TABLE public.class_sections IS
  'The sections a class runs. Year-agnostic master data: the year-specific facts live on students.academic_year_id and teacher_assignments.academic_year_id.';

-- ---------------------------------------------------------------------
-- 5. class_subjects — which subjects a class is taught, per year
-- ---------------------------------------------------------------------
ALTER TABLE public.class_subjects
  ADD COLUMN IF NOT EXISTS class_id         uuid REFERENCES public.classes(id)        ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS section_id       uuid REFERENCES public.sections(id)       ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS is_mandatory     boolean,
  ADD COLUMN IF NOT EXISTS is_active        boolean,
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz,
  ADD COLUMN IF NOT EXISTS created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.class_subjects.section_id IS
  'NULL means the subject is offered to the whole class, which is the normal case. A row with a section named restricts the offering to that one section.';

-- Backfill the ids from the text the rows were created with.
UPDATE public.class_subjects cs
   SET class_id = c.id
  FROM public.classes c
 WHERE cs.class_id IS NULL
   AND public.class_key(c.class_name) = public.class_key(cs.class);

UPDATE public.class_subjects cs
   SET academic_year_id = ay.id
  FROM public.academic_years ay
 WHERE cs.academic_year_id IS NULL
   AND substring(ay.name FROM '^[0-9]{4}') = substring(cs.academic_year FROM '^[0-9]{4}');

-- Rows whose year text matched nothing fall to the current year rather
-- than being left dangling and invisible to every year-scoped query.
UPDATE public.class_subjects
   SET academic_year_id = (SELECT id FROM public.academic_years WHERE is_current LIMIT 1)
 WHERE academic_year_id IS NULL;

UPDATE public.class_subjects
   SET is_mandatory = coalesce(is_mandatory, true),
       is_active    = coalesce(is_active, true),
       updated_at   = coalesce(updated_at, created_at, now());

ALTER TABLE public.class_subjects
  ALTER COLUMN is_mandatory SET DEFAULT true,
  ALTER COLUMN is_mandatory SET NOT NULL,
  ALTER COLUMN is_active    SET DEFAULT true,
  ALTER COLUMN is_active    SET NOT NULL,
  ALTER COLUMN updated_at   SET DEFAULT now(),
  ALTER COLUMN updated_at   SET NOT NULL;

-- Keep the text columns filled from the ids so that anything still
-- reading them, and the NOT NULL on class, keeps working.
CREATE OR REPLACE FUNCTION public.fn_class_subjects_sync_text()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.class_id IS NOT NULL THEN
    NEW.class := (SELECT class_name FROM public.classes WHERE id = NEW.class_id);
  END IF;
  IF NEW.academic_year_id IS NOT NULL THEN
    NEW.academic_year := (SELECT name FROM public.academic_years WHERE id = NEW.academic_year_id);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_class_subjects_sync_text ON public.class_subjects;
CREATE TRIGGER trg_class_subjects_sync_text
  BEFORE INSERT OR UPDATE ON public.class_subjects
  FOR EACH ROW EXECUTE FUNCTION public.fn_class_subjects_sync_text();

COMMENT ON TABLE public.class_subjects IS
  'Which subjects a class is taught in a given academic year. Owned by Academics; Examination and Timetable read it and must not invent subjects of their own.';

-- ---------------------------------------------------------------------
-- 6. timetable — give a slot a section and a period
-- ---------------------------------------------------------------------
ALTER TABLE public.timetable
  ADD COLUMN IF NOT EXISTS class_id      uuid REFERENCES public.classes(id)  ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS section_id    uuid REFERENCES public.sections(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS period_number integer;

UPDATE public.timetable t
   SET class_id = c.id
  FROM public.classes c
 WHERE t.class_id IS NULL
   AND public.class_key(c.class_name) = public.class_key(t.class);

UPDATE public.timetable
   SET academic_year_id = (SELECT id FROM public.academic_years WHERE is_current LIMIT 1)
 WHERE academic_year_id IS NULL;

-- Period number from the order of the slot within its class and day.
WITH ordered AS (
  SELECT id, row_number() OVER (PARTITION BY class, day ORDER BY start_time) AS rn
    FROM public.timetable
)
UPDATE public.timetable t
   SET period_number = ordered.rn
  FROM ordered
 WHERE ordered.id = t.id
   AND t.period_number IS NULL;

CREATE OR REPLACE FUNCTION public.fn_timetable_sync_text()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.class_id IS NOT NULL THEN
    NEW.class := (SELECT class_name FROM public.classes WHERE id = NEW.class_id);
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_timetable_sync_text ON public.timetable;
CREATE TRIGGER trg_timetable_sync_text
  BEFORE INSERT OR UPDATE ON public.timetable
  FOR EACH ROW EXECUTE FUNCTION public.fn_timetable_sync_text();

CREATE INDEX IF NOT EXISTS idx_timetable_class_section
  ON public.timetable (academic_year_id, class_id, section_id);

-- ---------------------------------------------------------------------
-- 7. academic_years — an explicit lifecycle
-- ---------------------------------------------------------------------
ALTER TABLE public.academic_years
  ADD COLUMN IF NOT EXISTS status     text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.academic_years
   SET status = CASE
                  WHEN is_current              THEN 'active'
                  WHEN end_date   < CURRENT_DATE THEN 'completed'
                  WHEN start_date > CURRENT_DATE THEN 'upcoming'
                  ELSE 'completed'
                END
 WHERE status IS NULL;

ALTER TABLE public.academic_years
  ALTER COLUMN status SET DEFAULT 'upcoming',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.academic_years DROP CONSTRAINT IF EXISTS academic_years_status_check;
ALTER TABLE public.academic_years
  ADD CONSTRAINT academic_years_status_check
  CHECK (status IN ('upcoming', 'active', 'completed', 'archived'));

ALTER TABLE public.academic_years DROP CONSTRAINT IF EXISTS academic_years_dates_check;
ALTER TABLE public.academic_years
  ADD CONSTRAINT academic_years_dates_check CHECK (end_date > start_date);

-- Exactly one current year. Enforced here rather than trusted to the UI,
-- because two current years silently doubles every year-scoped list.
DROP INDEX IF EXISTS uq_single_current_academic_year;
CREATE UNIQUE INDEX uq_single_current_academic_year
  ON public.academic_years ((is_current)) WHERE is_current = true;

DROP TRIGGER IF EXISTS trg_academic_years_updated_at ON public.academic_years;
CREATE TRIGGER trg_academic_years_updated_at BEFORE UPDATE ON public.academic_years
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

COMMENT ON TABLE public.academic_years IS
  'Canonical academic year, owned by Academics. Exactly one row may carry is_current. Switch it with set_current_academic_year(); never write is_current directly.';

-- ---------------------------------------------------------------------
-- 8. Indexes the year-scoped queries need
-- ---------------------------------------------------------------------
-- idx_students_year already exists but sits on the TEXT academic_year
-- column, so nothing indexes the id the application actually filters on.
CREATE INDEX IF NOT EXISTS idx_students_academic_year_id
  ON public.students (academic_year_id);

CREATE INDEX IF NOT EXISTS idx_students_year_class_section
  ON public.students (academic_year_id, class_id, section_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_class_subjects_class_year
  ON public.class_subjects (class_id, academic_year_id);

CREATE INDEX IF NOT EXISTS idx_class_subjects_subject
  ON public.class_subjects (subject_id);

COMMIT;
