-- =====================================================================
-- MIGRATION 18c — ACADEMICS TEACHING & LEARNING WORKFLOW: READ MODEL
-- =====================================================================
--
-- WHY THESE ARE FUNCTIONS RATHER THAN CLIENT QUERIES
--
--   Every figure the teaching screens show is a count across several
--   joins: how many of today's periods still need attendance, how far a
--   section has got through a subject, how many submissions are waiting
--   to be marked. Built in the browser that is a request per period per
--   figure. Built here it is one request, next to the data.
--
--   All of them are SECURITY INVOKER (the default), so row level security
--   applies to the caller exactly as it does to a direct select. None
--   expose a row the user could not already read. student_academic_dashboard
--   additionally refuses outright unless the caller is that student, a
--   linked parent, or staff.
--
--   Every one that is year-scoped takes the academic year as an argument.
--   There is no "current year" fallback inside the query.
--
-- ROLLBACK: supabase_academics_workflow_migration_18_rollback.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. academics_syllabus_tree
--    The unit -> chapter list for one class + subject, with the progress
--    of one section spliced in (null section = structure only).
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.academics_syllabus_tree(uuid, uuid, uuid, uuid);
CREATE FUNCTION public.academics_syllabus_tree(
  _academic_year_id uuid,
  _class_id         uuid,
  _subject_id       uuid,
  _section_id       uuid DEFAULT NULL
)
RETURNS TABLE (
  unit_id          uuid,
  unit_title       text,
  unit_sequence    integer,
  chapter_id       uuid,
  chapter_title    text,
  chapter_sequence integer,
  expected_hours   numeric,
  topic_count      bigint,
  progress_status  text,
  started_on       date,
  completed_on     date,
  progress_notes   text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $fn$
  SELECT
    u.id, u.title, u.sequence,
    c.id, c.title, c.sequence,
    c.expected_hours,
    (SELECT count(*) FROM public.syllabus_topics t WHERE t.chapter_id = c.id),
    COALESCE(sp.status, 'not_started'),
    sp.started_on,
    sp.completed_on,
    sp.notes
  FROM public.syllabus_units u
  LEFT JOIN public.syllabus_chapters c ON c.unit_id = u.id
  LEFT JOIN public.syllabus_progress sp
         ON sp.chapter_id = c.id
        AND _section_id IS NOT NULL
        AND sp.section_id = _section_id
  WHERE u.academic_year_id = _academic_year_id
    AND u.class_id = _class_id
    AND u.subject_id = _subject_id
  ORDER BY u.sequence, c.sequence NULLS LAST;
$fn$;

-- ---------------------------------------------------------------------
-- 2. academics_syllabus_coverage
--    Section-weighted completion per class + subject for a year.
--    expected = chapters x sections in the class; done = completed rows.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.academics_syllabus_coverage(uuid);
CREATE FUNCTION public.academics_syllabus_coverage(_academic_year_id uuid)
RETURNS TABLE (
  class_id            uuid,
  class_name          text,
  subject_id          uuid,
  subject_name        text,
  chapters_total      bigint,
  sections_in_class   bigint,
  completed_pairs     bigint,
  in_progress_pairs   bigint,
  percent_complete    numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $fn$
  WITH chapters AS (
    SELECT u.class_id, u.subject_id, c.id AS chapter_id
    FROM public.syllabus_units u
    JOIN public.syllabus_chapters c ON c.unit_id = u.id
    WHERE u.academic_year_id = _academic_year_id
  ),
  sec AS (
    SELECT cs.class_id, GREATEST(count(*), 1) AS n
    FROM public.class_sections cs
    WHERE cs.is_active
    GROUP BY cs.class_id
  ),
  prog AS (
    SELECT ch.class_id, ch.subject_id,
           count(*) FILTER (WHERE sp.status = 'completed')   AS done,
           count(*) FILTER (WHERE sp.status = 'in_progress') AS wip
    FROM chapters ch
    JOIN public.syllabus_progress sp ON sp.chapter_id = ch.chapter_id
    GROUP BY ch.class_id, ch.subject_id
  )
  SELECT
    ch.class_id,
    cl.class_name,
    ch.subject_id,
    s.subject_name,
    count(DISTINCT ch.chapter_id)                                   AS chapters_total,
    COALESCE(sec.n, 1)                                              AS sections_in_class,
    COALESCE(prog.done, 0)                                          AS completed_pairs,
    COALESCE(prog.wip, 0)                                           AS in_progress_pairs,
    ROUND(
      100.0 * COALESCE(prog.done, 0)
      / NULLIF(count(DISTINCT ch.chapter_id) * COALESCE(sec.n, 1), 0)
    , 1)                                                            AS percent_complete
  FROM chapters ch
  JOIN public.classes  cl ON cl.id = ch.class_id
  JOIN public.subjects s  ON s.id = ch.subject_id
  LEFT JOIN sec  ON sec.class_id = ch.class_id
  LEFT JOIN prog ON prog.class_id = ch.class_id AND prog.subject_id = ch.subject_id
  GROUP BY ch.class_id, cl.class_name, ch.subject_id, s.subject_name, sec.n, prog.done, prog.wip
  ORDER BY cl.class_name, s.subject_name;
$fn$;

-- ---------------------------------------------------------------------
-- 3. admin_syllabus_by_subject
--    The "Physics 82%" list on the admin monitor: one row per subject,
--    section-weighted across every class that teaches it.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_syllabus_by_subject(uuid);
CREATE FUNCTION public.admin_syllabus_by_subject(_academic_year_id uuid)
RETURNS TABLE (
  subject_id       uuid,
  subject_name     text,
  chapters_total   bigint,
  percent_complete numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $fn$
  SELECT
    subject_id,
    subject_name,
    SUM(chapters_total)::bigint,
    ROUND(
      100.0 * SUM(completed_pairs)
      / NULLIF(SUM(chapters_total * sections_in_class), 0)
    , 1)
  FROM public.academics_syllabus_coverage(_academic_year_id)
  GROUP BY subject_id, subject_name
  ORDER BY subject_name;
$fn$;

-- ---------------------------------------------------------------------
-- 4. teacher_today_classes
--    The teacher's periods for one date, with the state of each so the
--    card can show what is still outstanding.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.teacher_today_classes(uuid, date);
CREATE FUNCTION public.teacher_today_classes(
  _teacher_id uuid,
  _on_date    date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  slot_id            uuid,
  day                text,
  period_number      integer,
  start_time         text,
  end_time           text,
  class_id           uuid,
  class_name         text,
  section_id         uuid,
  section_name       text,
  subject_id         uuid,
  subject_name       text,
  subject_code       text,
  room               text,
  students_total     bigint,
  attendance_marked  boolean,
  lesson_plan_id     uuid,
  lesson_plan_status text,
  homework_count     bigint
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $fn$
  SELECT
    tt.id,
    tt.day,
    tt.period_number,
    to_char(tt.start_time, 'HH24:MI'),
    to_char(tt.end_time, 'HH24:MI'),
    tt.class_id,
    cl.class_name,
    tt.section_id,
    sec.section_name,
    tt.subject_id,
    subj.subject_name,
    subj.subject_code,
    COALESCE(tt.room_no, cs.room_no),
    (SELECT count(*) FROM public.students st
      WHERE st.class_id = tt.class_id AND st.section_id = tt.section_id AND st.status = 'active'),
    EXISTS (
      SELECT 1 FROM public.attendance a
      JOIN public.students st ON st.id = a.student_id
      WHERE st.class_id = tt.class_id AND st.section_id = tt.section_id
        AND a.attendance_date = _on_date
    ),
    lp.id,
    lp.status,
    (SELECT count(*) FROM public.assignments ag
      WHERE ag.teacher_id = _teacher_id
        AND ag.class_id = tt.class_id
        AND (ag.section_id = tt.section_id OR ag.section_id IS NULL)
        AND (ag.subject_id = tt.subject_id OR ag.subject_id IS NULL)
        AND ag.assigned_date = _on_date)
  FROM public.timetable tt
  JOIN public.classes  cl   ON cl.id = tt.class_id
  LEFT JOIN public.sections sec ON sec.id = tt.section_id
  LEFT JOIN public.subjects subj ON subj.id = tt.subject_id
  LEFT JOIN public.class_sections cs ON cs.class_id = tt.class_id AND cs.section_id = tt.section_id
  LEFT JOIN LATERAL (
    SELECT lp.id, lp.status
    FROM public.lesson_plans lp
    WHERE lp.teacher_id = _teacher_id
      AND lp.class_id = tt.class_id
      AND (lp.section_id = tt.section_id OR lp.section_id IS NULL)
      AND (lp.subject_id = tt.subject_id OR lp.subject_id IS NULL)
      AND lp.planned_date = _on_date
    ORDER BY lp.updated_at DESC
    LIMIT 1
  ) lp ON true
  WHERE tt.teacher_id = _teacher_id
    AND tt.day = (ARRAY['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from _on_date)::int + 1]
  ORDER BY tt.period_number NULLS LAST, tt.start_time;
$fn$;

-- ---------------------------------------------------------------------
-- 5. teacher_class_workspace
--    One row summarising a single class + section + subject for a date.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.teacher_class_workspace(uuid, uuid, uuid, uuid, uuid, date);
CREATE FUNCTION public.teacher_class_workspace(
  _teacher_id       uuid,
  _academic_year_id uuid,
  _class_id         uuid,
  _section_id       uuid,
  _subject_id       uuid,
  _on_date          date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  students_total      bigint,
  attendance_marked   boolean,
  present_count       bigint,
  absent_count        bigint,
  late_count          bigint,
  leave_count         bigint,
  lesson_plan         jsonb,
  pending_homework    bigint,
  chapters_total      bigint,
  chapters_completed  bigint,
  syllabus_percent    numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $fn$
  WITH roster AS (
    SELECT st.id
    FROM public.students st
    WHERE st.class_id = _class_id AND st.section_id = _section_id AND st.status = 'active'
  ),
  att AS (
    SELECT a.status
    FROM public.attendance a
    WHERE a.student_id IN (SELECT id FROM roster)
      AND a.attendance_date = _on_date
  ),
  chap AS (
    SELECT c.id
    FROM public.syllabus_units u
    JOIN public.syllabus_chapters c ON c.unit_id = u.id
    WHERE u.academic_year_id = _academic_year_id
      AND u.class_id = _class_id
      AND u.subject_id = _subject_id
  )
  SELECT
    (SELECT count(*) FROM roster),
    (SELECT count(*) FROM att) > 0,
    (SELECT count(*) FROM att WHERE lower(status) = 'present'),
    (SELECT count(*) FROM att WHERE lower(status) = 'absent'),
    (SELECT count(*) FROM att WHERE lower(status) = 'late'),
    (SELECT count(*) FROM att WHERE lower(status) IN ('leave', 'excused')),
    (SELECT to_jsonb(lp) FROM (
       SELECT id, topic, objectives, status, planned_date, completion_date,
              duration_minutes, teaching_method, resources, homework_text,
              outcome_notes, chapter_id
       FROM public.lesson_plans lp
       WHERE lp.teacher_id = _teacher_id
         AND lp.class_id = _class_id
         AND (lp.section_id = _section_id OR lp.section_id IS NULL)
         AND (lp.subject_id = _subject_id OR lp.subject_id IS NULL)
         AND lp.planned_date = _on_date
       ORDER BY lp.updated_at DESC
       LIMIT 1
     ) lp),
    (SELECT count(*) FROM public.assignments ag
      WHERE ag.teacher_id = _teacher_id
        AND ag.class_id = _class_id
        AND (ag.section_id = _section_id OR ag.section_id IS NULL)
        AND (ag.subject_id = _subject_id OR ag.subject_id IS NULL)
        AND ag.kind = 'homework'
        AND ag.status = 'published'
        AND ag.due_date >= _on_date),
    (SELECT count(*) FROM chap),
    (SELECT count(*) FROM public.syllabus_progress sp
      WHERE sp.chapter_id IN (SELECT id FROM chap)
        AND sp.section_id = _section_id
        AND sp.status = 'completed'),
    ROUND(
      100.0 * (SELECT count(*) FROM public.syllabus_progress sp
                WHERE sp.chapter_id IN (SELECT id FROM chap)
                  AND sp.section_id = _section_id
                  AND sp.status = 'completed')
      / NULLIF((SELECT count(*) FROM chap), 0)
    , 1);
$fn$;

-- ---------------------------------------------------------------------
-- 6. teacher_academic_summary
--    The teacher dashboard header counters.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.teacher_academic_summary(uuid, uuid, date);
CREATE FUNCTION public.teacher_academic_summary(
  _teacher_id       uuid,
  _academic_year_id uuid,
  _on_date          date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  my_classes            bigint,
  my_subjects           bigint,
  classes_today         bigint,
  pending_attendance    bigint,
  pending_lesson_plans  bigint,
  open_assignments      bigint,
  submissions_to_review bigint,
  syllabus_percent      numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $fn$
  WITH today AS (
    SELECT * FROM public.teacher_today_classes(_teacher_id, _on_date)
  ),
  cov AS (
    SELECT ta.subject_id, sc.percent_complete
    FROM public.teacher_assignments ta
    JOIN public.academics_syllabus_coverage(_academic_year_id) sc
      ON sc.class_id = ta.class_id AND sc.subject_id = ta.subject_id
    WHERE ta.teacher_id = _teacher_id AND ta.is_active
      AND ta.academic_year_id = _academic_year_id
  )
  SELECT
    (SELECT count(DISTINCT (class_id, section_id)) FROM public.teacher_assignments
      WHERE teacher_id = _teacher_id AND is_active AND academic_year_id = _academic_year_id),
    (SELECT count(DISTINCT subject_id) FROM public.teacher_assignments
      WHERE teacher_id = _teacher_id AND is_active AND academic_year_id = _academic_year_id
        AND subject_id IS NOT NULL),
    (SELECT count(*) FROM today),
    (SELECT count(*) FROM today WHERE NOT attendance_marked),
    (SELECT count(*) FROM today WHERE lesson_plan_id IS NULL OR lesson_plan_status <> 'completed'),
    (SELECT count(*) FROM public.assignments
      WHERE teacher_id = _teacher_id AND status = 'published' AND due_date >= _on_date),
    (SELECT count(*) FROM public.student_assignment_submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE a.teacher_id = _teacher_id AND s.status IN ('submitted', 'late')),
    (SELECT ROUND(AVG(percent_complete), 1) FROM cov);
$fn$;

-- ---------------------------------------------------------------------
-- 7. admin_academic_monitor
--    The admin's daily academic activity panel. Real records only.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_academic_monitor(uuid, date);
CREATE FUNCTION public.admin_academic_monitor(
  _academic_year_id uuid,
  _on_date          date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_classes            bigint,
  total_sections           bigint,
  total_subjects           bigint,
  total_teachers           bigint,
  classes_scheduled_today  bigint,
  attendance_completed     bigint,
  attendance_pending       bigint,
  lesson_plans_planned     bigint,
  lesson_plans_completed   bigint,
  homework_created_today   bigint,
  assignments_active       bigint,
  syllabus_percent_overall numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $fn$
  WITH day AS (
    SELECT (ARRAY['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from _on_date)::int + 1] AS d
  ),
  scheduled AS (
    SELECT DISTINCT tt.class_id, tt.section_id
    FROM public.timetable tt, day
    WHERE tt.day = day.d
      AND (tt.academic_year_id = _academic_year_id OR tt.academic_year_id IS NULL)
  ),
  sched_att AS (
    SELECT s.class_id, s.section_id,
           EXISTS (
             SELECT 1 FROM public.attendance a
             JOIN public.students st ON st.id = a.student_id
             WHERE st.class_id = s.class_id AND st.section_id = s.section_id
               AND a.attendance_date = _on_date
           ) AS marked
    FROM scheduled s
  )
  SELECT
    (SELECT count(*) FROM public.classes WHERE is_active),
    (SELECT count(*) FROM public.class_sections WHERE is_active),
    (SELECT count(*) FROM public.subjects WHERE is_active),
    (SELECT count(*) FROM public.teachers WHERE COALESCE(is_active, true)),
    (SELECT count(*) FROM scheduled),
    (SELECT count(*) FROM sched_att WHERE marked),
    (SELECT count(*) FROM sched_att WHERE NOT marked),
    (SELECT count(*) FROM public.lesson_plans WHERE planned_date = _on_date),
    (SELECT count(*) FROM public.lesson_plans WHERE planned_date = _on_date AND status = 'completed'),
    (SELECT count(*) FROM public.assignments WHERE assigned_date = _on_date),
    (SELECT count(*) FROM public.assignments WHERE status = 'published' AND due_date >= _on_date),
    (SELECT ROUND(
       100.0 * SUM(completed_pairs) / NULLIF(SUM(chapters_total * sections_in_class), 0), 1)
     FROM public.academics_syllabus_coverage(_academic_year_id));
$fn$;

-- ---------------------------------------------------------------------
-- 8. student_academic_dashboard
--    Refuses unless the caller is that student, a linked parent, or staff.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.student_academic_dashboard(uuid);
CREATE FUNCTION public.student_academic_dashboard(_student_id uuid)
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
  IF NOT (
       _student_id = public.get_current_student_id()
    OR _student_id = ANY (public.get_current_parent_student_ids())
    OR public.is_staff()
  ) THEN
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
