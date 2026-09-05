-- =====================================================================
-- MIGRATION 07c — ACADEMICS READ MODEL
-- =====================================================================
--
-- WHY THESE ARE FUNCTIONS RATHER THAN CLIENT QUERIES
--
--   Every figure the Academics screens show is a count across a join:
--   how many sections a class runs, how many subjects it is taught, how
--   many students sit in it this year, who its class teacher is. Built
--   in the browser that is one request per class per figure, and the
--   page grows with the size of the school. Built here it is one
--   request, and the aggregation happens next to the data.
--
--   All of them are SECURITY INVOKER, so row level security applies to
--   the caller exactly as it does to a direct select. None of them
--   expose a row a user could not already read.
--
--   Every one takes the academic year as an argument. There is no
--   default and no fallback to "the current year" inside the query,
--   because a screen that silently answers for a different year than the
--   one on the selector is worse than one that answers for none.
--
-- ROLLBACK: supabase_academics_migration_07_rollback.sql
-- =====================================================================

BEGIN;

-- A class created from the UI should not have to know what ordering to
-- claim; the service assigns one, and this keeps a bare insert legal.
ALTER TABLE public.classes ALTER COLUMN display_order SET DEFAULT 999;

-- ---------------------------------------------------------------------
-- 1. Overview counters
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.academics_overview(uuid);
CREATE FUNCTION public.academics_overview(_academic_year_id uuid)
RETURNS TABLE (
  academic_year_id             uuid,
  academic_year_name           text,
  academic_year_status         text,
  is_current_year              boolean,
  classes_total                bigint,
  classes_active               bigint,
  sections_total               bigint,
  subjects_total               bigint,
  subjects_active              bigint,
  students_enrolled            bigint,
  teachers_active              bigint,
  class_subject_mappings       bigint,
  classes_without_sections     bigint,
  classes_without_subjects     bigint,
  sections_without_class_teacher bigint,
  subjects_never_mapped        bigint,
  timetable_slots              bigint
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $fn$
  SELECT
    ay.id,
    ay.name::text,
    ay.status,
    ay.is_current,
    (SELECT count(*) FROM public.classes),
    (SELECT count(*) FROM public.classes WHERE is_active),
    (SELECT count(*) FROM public.class_sections WHERE is_active),
    (SELECT count(*) FROM public.subjects),
    (SELECT count(*) FROM public.subjects WHERE is_active),
    (SELECT count(*) FROM public.students
      WHERE academic_year_id = ay.id AND status = 'active'),
    (SELECT count(*) FROM public.teachers WHERE is_active),
    (SELECT count(*) FROM public.class_subjects
      WHERE academic_year_id = ay.id AND is_active),
    (SELECT count(*) FROM public.classes c
      WHERE c.is_active
        AND NOT EXISTS (SELECT 1 FROM public.class_sections cs
                         WHERE cs.class_id = c.id AND cs.is_active)),
    (SELECT count(*) FROM public.classes c
      WHERE c.is_active
        AND NOT EXISTS (SELECT 1 FROM public.class_subjects x
                         WHERE x.class_id = c.id
                           AND x.academic_year_id = ay.id
                           AND x.is_active)),
    (SELECT count(*) FROM public.class_sections cs
      WHERE cs.is_active
        AND NOT EXISTS (SELECT 1 FROM public.teacher_assignments ta
                         WHERE ta.class_id = cs.class_id
                           AND ta.section_id = cs.section_id
                           AND ta.academic_year_id = ay.id
                           AND ta.is_active
                           AND ta.assignment_type IN ('class_teacher', 'both'))),
    (SELECT count(*) FROM public.subjects s
      WHERE s.is_active
        AND NOT EXISTS (SELECT 1 FROM public.class_subjects x
                         WHERE x.subject_id = s.id AND x.is_active)),
    (SELECT count(*) FROM public.timetable WHERE academic_year_id = ay.id)
  FROM public.academic_years ay
  WHERE ay.id = _academic_year_id;
$fn$;

COMMENT ON FUNCTION public.academics_overview(uuid) IS
  'Every figure on the Academics overview, for one academic year, in one round trip.';

-- ---------------------------------------------------------------------
-- 2. Class directory
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.academics_class_directory(uuid);
CREATE FUNCTION public.academics_class_directory(_academic_year_id uuid)
RETURNS TABLE (
  class_id            uuid,
  class_name          text,
  class_code          text,
  stream              text,
  display_order       integer,
  is_active           boolean,
  sections_count      bigint,
  section_labels      text,
  subjects_count      bigint,
  students_count      bigint,
  class_teacher_names text,
  teachers_count      bigint
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $fn$
  SELECT
    c.id,
    c.class_name,
    c.class_code,
    c.stream,
    c.display_order,
    c.is_active,
    (SELECT count(*) FROM public.class_sections cs
      WHERE cs.class_id = c.id AND cs.is_active),
    (SELECT string_agg(s.section_name, ', ' ORDER BY s.section_name)
       FROM public.class_sections cs
       JOIN public.sections s ON s.id = cs.section_id
      WHERE cs.class_id = c.id AND cs.is_active),
    (SELECT count(*) FROM public.class_subjects x
      WHERE x.class_id = c.id AND x.academic_year_id = _academic_year_id AND x.is_active),
    (SELECT count(*) FROM public.students st
      WHERE st.class_id = c.id AND st.academic_year_id = _academic_year_id
        AND st.status = 'active'),
    (SELECT string_agg(DISTINCT t.name, ', ')
       FROM public.teacher_assignments ta
       JOIN public.teachers t ON t.id = ta.teacher_id
      WHERE ta.class_id = c.id AND ta.academic_year_id = _academic_year_id
        AND ta.is_active AND ta.assignment_type IN ('class_teacher', 'both')),
    (SELECT count(DISTINCT ta.teacher_id) FROM public.teacher_assignments ta
      WHERE ta.class_id = c.id AND ta.academic_year_id = _academic_year_id AND ta.is_active)
  FROM public.classes c
  ORDER BY c.display_order, c.class_name;
$fn$;

COMMENT ON FUNCTION public.academics_class_directory(uuid) IS
  'One row per class with its sections, subjects, students, teachers and class teacher for the given year.';

-- ---------------------------------------------------------------------
-- 3. Section directory for one class
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.academics_section_directory(uuid, uuid);
CREATE FUNCTION public.academics_section_directory(_academic_year_id uuid, _class_id uuid)
RETURNS TABLE (
  class_section_id   uuid,
  section_id         uuid,
  section_name       text,
  capacity           integer,
  room_no            text,
  is_active          boolean,
  students_count     bigint,
  class_teacher_id   uuid,
  class_teacher_name text,
  subject_teachers   bigint
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $fn$
  SELECT
    cs.id,
    s.id,
    s.section_name::text,
    cs.capacity,
    cs.room_no,
    cs.is_active,
    (SELECT count(*) FROM public.students st
      WHERE st.class_id = cs.class_id AND st.section_id = cs.section_id
        AND st.academic_year_id = _academic_year_id AND st.status = 'active'),
    ct.teacher_id,
    ct.teacher_name,
    (SELECT count(DISTINCT ta.teacher_id) FROM public.teacher_assignments ta
      WHERE ta.class_id = cs.class_id AND ta.section_id = cs.section_id
        AND ta.academic_year_id = _academic_year_id AND ta.is_active
        AND ta.subject_id IS NOT NULL)
  FROM public.class_sections cs
  JOIN public.sections s ON s.id = cs.section_id
  LEFT JOIN LATERAL (
    SELECT ta.teacher_id, t.name AS teacher_name
      FROM public.teacher_assignments ta
      JOIN public.teachers t ON t.id = ta.teacher_id
     WHERE ta.class_id = cs.class_id AND ta.section_id = cs.section_id
       AND ta.academic_year_id = _academic_year_id AND ta.is_active
       AND ta.assignment_type IN ('class_teacher', 'both')
     LIMIT 1
  ) ct ON true
  WHERE cs.class_id = _class_id
  ORDER BY s.section_name;
$fn$;

-- ---------------------------------------------------------------------
-- 4. Subjects offered to a class, with who teaches them
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.academics_class_subjects(uuid, uuid);
CREATE FUNCTION public.academics_class_subjects(_academic_year_id uuid, _class_id uuid)
RETURNS TABLE (
  mapping_id    uuid,
  class_id      uuid,
  class_name    text,
  subject_id    uuid,
  subject_name  text,
  subject_code  text,
  category      text,
  subject_type  text,
  section_id    uuid,
  section_name  text,
  is_mandatory  boolean,
  is_active     boolean,
  teacher_names text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $fn$
  SELECT
    x.id,
    c.id,
    c.class_name,
    s.id,
    s.subject_name,
    s.subject_code::text,
    s.category,
    s.subject_type,
    sec.id,
    sec.section_name::text,
    x.is_mandatory,
    x.is_active,
    (SELECT string_agg(DISTINCT t.name, ', ')
       FROM public.teacher_assignments ta
       JOIN public.teachers t ON t.id = ta.teacher_id
      WHERE ta.class_id = x.class_id
        AND ta.subject_id = x.subject_id
        AND ta.academic_year_id = x.academic_year_id
        AND ta.is_active
        AND (x.section_id IS NULL OR ta.section_id = x.section_id))
  FROM public.class_subjects x
  JOIN public.classes  c   ON c.id = x.class_id
  JOIN public.subjects s   ON s.id = x.subject_id
  LEFT JOIN public.sections sec ON sec.id = x.section_id
  WHERE x.academic_year_id = _academic_year_id
    AND (_class_id IS NULL OR x.class_id = _class_id)
  ORDER BY c.display_order, s.subject_name;
$fn$;

-- ---------------------------------------------------------------------
-- 5. Subject directory
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.academics_subject_directory(uuid);
CREATE FUNCTION public.academics_subject_directory(_academic_year_id uuid)
RETURNS TABLE (
  subject_id     uuid,
  subject_name   text,
  subject_code   text,
  category       text,
  subject_type   text,
  is_active      boolean,
  classes_count  bigint,
  class_labels   text,
  teachers_count bigint,
  has_marks      boolean
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $fn$
  SELECT
    s.id,
    s.subject_name,
    s.subject_code::text,
    s.category,
    s.subject_type,
    s.is_active,
    (SELECT count(DISTINCT x.class_id) FROM public.class_subjects x
      WHERE x.subject_id = s.id AND x.academic_year_id = _academic_year_id AND x.is_active),
    (SELECT string_agg(DISTINCT c.class_name, ', ')
       FROM public.class_subjects x
       JOIN public.classes c ON c.id = x.class_id
      WHERE x.subject_id = s.id AND x.academic_year_id = _academic_year_id AND x.is_active),
    (SELECT count(DISTINCT ta.teacher_id) FROM public.teacher_assignments ta
      WHERE ta.subject_id = s.id AND ta.academic_year_id = _academic_year_id AND ta.is_active),
    EXISTS (SELECT 1 FROM public.marks m WHERE m.subject_id = s.id)
  FROM public.subjects s
  ORDER BY s.subject_name;
$fn$;

-- ---------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------
DO $$
DECLARE
  sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'academics_overview(uuid)',
    'academics_class_directory(uuid)',
    'academics_section_directory(uuid, uuid)',
    'academics_class_subjects(uuid, uuid)',
    'academics_subject_directory(uuid)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', sig);
  END LOOP;
END $$;

COMMIT;
