-- =====================================================================
-- MIGRATION 18f — TIGHTEN student_academic_dashboard() AUTH GUARD
-- =====================================================================
--
-- The guard added in 18c used
--   IF NOT (_student_id = get_current_student_id() OR ...) THEN RAISE
-- When the caller is a parent (get_current_student_id() returns NULL),
-- `_student_id = NULL` is NULL, `NULL OR false OR false` is NULL, and
-- `IF NOT NULL` does not fire — so a parent asking for a child that is
-- not theirs got an empty result instead of an explicit "not authorised"
-- error. The row level security on the underlying tables still returned
-- nothing, so no data leaked, but the call should fail loudly.
--
-- This rewrites the guard with NULL-safe comparisons.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.student_academic_dashboard(_student_id uuid)
RETURNS TABLE (
  student_id          uuid,
  class_id            uuid,
  section_id          uuid,
  academic_year_id    uuid,
  today_timetable     jsonb,
  pending_homework    bigint,
  pending_assignments bigint,
  attendance_percent  numeric,
  syllabus            jsonb
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $fn$
DECLARE
  _class    uuid;
  _section  uuid;
  _year     uuid;
  _weekday  text;
BEGIN
  IF _student_id IS DISTINCT FROM public.get_current_student_id()
     AND NOT (_student_id = ANY (public.get_current_parent_student_ids()))
     AND NOT public.is_staff()
  THEN
    RAISE EXCEPTION 'Not authorised to read this student''s academic record'
      USING ERRCODE = '42501';
  END IF;

  SELECT s.class_id, s.section_id, s.academic_year_id
    INTO _class, _section, _year
  FROM public.students s WHERE s.id = _student_id;

  IF _class IS NULL THEN
    RETURN;
  END IF;

  _weekday := (ARRAY['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from CURRENT_DATE)::int + 1];

  RETURN QUERY
  SELECT
    _student_id,
    _class,
    _section,
    _year,
    COALESCE((
      SELECT jsonb_agg(t ORDER BY t.period_number NULLS LAST, t.start_time)
      FROM (
        SELECT tt.period_number,
               to_char(tt.start_time, 'HH24:MI') AS start_time,
               to_char(tt.end_time, 'HH24:MI')   AS end_time,
               subj.subject_name,
               tch.name AS teacher_name,
               COALESCE(tt.room_no, cs.room_no) AS room
        FROM public.timetable tt
        LEFT JOIN public.subjects subj ON subj.id = tt.subject_id
        LEFT JOIN public.teachers tch  ON tch.id = tt.teacher_id
        LEFT JOIN public.class_sections cs ON cs.class_id = tt.class_id AND cs.section_id = tt.section_id
        WHERE tt.class_id = _class
          AND (tt.section_id = _section OR tt.section_id IS NULL)
          AND tt.day = _weekday
      ) t
    ), '[]'::jsonb),
    (SELECT count(*) FROM public.assignments a
      WHERE a.class_id = _class
        AND (a.section_id = _section OR a.section_id IS NULL)
        AND a.kind = 'homework' AND a.status <> 'draft'
        AND a.due_date >= CURRENT_DATE
        AND NOT EXISTS (SELECT 1 FROM public.student_assignment_submissions s
                         WHERE s.assignment_id = a.id AND s.student_id = _student_id)),
    (SELECT count(*) FROM public.assignments a
      WHERE a.class_id = _class
        AND (a.section_id = _section OR a.section_id IS NULL)
        AND a.kind = 'assignment' AND a.status <> 'draft'
        AND a.due_date >= CURRENT_DATE
        AND NOT EXISTS (SELECT 1 FROM public.student_assignment_submissions s
                         WHERE s.assignment_id = a.id AND s.student_id = _student_id)),
    (SELECT ROUND(
        100.0 * count(*) FILTER (WHERE lower(status) IN ('present', 'late'))
        / NULLIF(count(*), 0), 1)
      FROM public.attendance a WHERE a.student_id = _student_id),
    COALESCE((
      SELECT jsonb_agg(x ORDER BY x.subject_name)
      FROM (
        SELECT sc.subject_name, sc.percent_complete AS percent
        FROM public.academics_syllabus_coverage(_year) sc
        WHERE sc.class_id = _class
      ) x
    ), '[]'::jsonb);
END;
$fn$;

COMMIT;
