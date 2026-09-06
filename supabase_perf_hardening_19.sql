-- =====================================================================
-- PERF HARDENING 19 — RLS initplan, FK indexes, duplicate indexes, ANALYZE
-- =====================================================================
--
-- 1. auth_rls_initplan: rewrite every RLS policy so a call to auth.uid(),
--    a helper (is_admin / is_staff / is_teacher / get_current_*_id /
--    auth_has_permission / account_is_active / current_user_role) or
--    current_setting() is wrapped in a scalar sub-select. Postgres then
--    evaluates it ONCE per statement (InitPlan) instead of once per row.
--    Purely mechanical; the boolean result is identical.
--
-- 2. unindexed_foreign_keys: add covering btree indexes for the FK
--    columns on the hot join paths (teacher_assignments, timetable,
--    students, attendance, class_subjects, exams, exam_results,
--    exam_subjects, marks).
--
-- 3. duplicate_index: drop one of each identical pair the advisor found.
--
-- 4. ANALYZE the tables the recent data rebuilds touched, so the planner
--    has fresh statistics.
--
-- Reversible: policy bodies are only re-wrapped (re-running is a no-op);
-- the dropped indexes are recreated in the rollback; new indexes use
-- IF NOT EXISTS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Wrap volatile-looking calls in RLS policy expressions
-- ---------------------------------------------------------------------
DO $$
DECLARE
  pol   record;
  nq    text;
  nc    text;
  wrap  text;
  -- Scalar-returning calls only. get_current_parent_student_ids() is left
  -- alone: it returns uuid[] and is used as ANY(fn()), where wrapping it in
  -- a scalar sub-select breaks the type (uuid = uuid[]).
  fns   text[] := ARRAY[
    'auth.uid()', 'auth.jwt()', 'auth.role()',
    'is_admin()', 'is_staff_user()', 'is_staff()', 'is_teacher()', 'is_super_admin()',
    'account_is_active()', 'current_user_role()',
    'get_current_student_id()', 'get_current_teacher_id()'
  ];
  f text;
BEGIN
  FOR pol IN
    SELECT n.nspname AS schemaname, c.relname AS tablename, p.polname AS policyname,
           pg_get_expr(p.polqual, p.polrelid)      AS qual,
           pg_get_expr(p.polwithcheck, p.polrelid) AS withcheck
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
  LOOP
    nq := pol.qual;
    nc := pol.withcheck;

    FOREACH f IN ARRAY fns LOOP
      wrap := '(SELECT ' || f || ')';
      IF nq IS NOT NULL THEN nq := replace(nq, f, wrap); END IF;
      IF nc IS NOT NULL THEN nc := replace(nc, f, wrap); END IF;
    END LOOP;

    -- auth_has_permission('x'::text)  ->  (SELECT auth_has_permission('x'::text))
    IF nq IS NOT NULL THEN
      nq := regexp_replace(nq, 'auth_has_permission\(([^()]*)\)', '(SELECT auth_has_permission(\1))', 'g');
    END IF;
    IF nc IS NOT NULL THEN
      nc := regexp_replace(nc, 'auth_has_permission\(([^()]*)\)', '(SELECT auth_has_permission(\1))', 'g');
    END IF;

    -- collapse any accidental double wrap from a previous run
    IF nq IS NOT NULL THEN
      nq := regexp_replace(nq, '\(SELECT \(SELECT ([a-z_]+\.[a-z_]+\(\)|[a-z_]+\([^()]*\))\)\)', '(SELECT \1)', 'g');
    END IF;
    IF nc IS NOT NULL THEN
      nc := regexp_replace(nc, '\(SELECT \(SELECT ([a-z_]+\.[a-z_]+\(\)|[a-z_]+\([^()]*\))\)\)', '(SELECT \1)', 'g');
    END IF;

    IF nq IS DISTINCT FROM pol.qual OR nc IS DISTINCT FROM pol.withcheck THEN
      EXECUTE format('ALTER POLICY %I ON public.%I%s%s',
        pol.policyname, pol.tablename,
        CASE WHEN nq IS NOT NULL THEN ' USING (' || nq || ')' ELSE '' END,
        CASE WHEN nc IS NOT NULL THEN ' WITH CHECK (' || nc || ')' ELSE '' END);
      RAISE NOTICE 'rewrapped policy %.%', pol.tablename, pol.policyname;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2. Covering indexes for foreign keys on hot join paths
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_class    ON public.teacher_assignments (class_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_section  ON public.teacher_assignments (section_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_subject  ON public.teacher_assignments (subject_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_lookup   ON public.teacher_assignments (academic_year_id, class_id, section_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_timetable_class              ON public.timetable (class_id);
CREATE INDEX IF NOT EXISTS idx_timetable_section            ON public.timetable (section_id);
CREATE INDEX IF NOT EXISTS idx_timetable_day_period         ON public.timetable (day, period_number);
CREATE INDEX IF NOT EXISTS idx_students_section             ON public.students (section_id);
CREATE INDEX IF NOT EXISTS idx_students_class_section_stat  ON public.students (class_id, section_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_year              ON public.attendance (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date              ON public.attendance (attendance_date);
CREATE INDEX IF NOT EXISTS idx_class_subjects_year          ON public.class_subjects (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_section       ON public.class_subjects (section_id);
CREATE INDEX IF NOT EXISTS idx_exams_year                   ON public.exams (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_exams_class                  ON public.exams (class_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_class           ON public.exam_results (class_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_year            ON public.exam_results (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_exam_subjects_class          ON public.exam_subjects (class_id);
CREATE INDEX IF NOT EXISTS idx_exam_subjects_section        ON public.exam_subjects (section_id);
CREATE INDEX IF NOT EXISTS idx_exam_subjects_teacher        ON public.exam_subjects (teacher_id);
CREATE INDEX IF NOT EXISTS idx_marks_updated_by             ON public.marks (updated_by);

-- ---------------------------------------------------------------------
-- 3. Drop exact-duplicate indexes (keep one of each pair)
-- ---------------------------------------------------------------------
-- Plain (non-constraint) duplicate indexes only. The two UNIQUE pairs
-- (admissions placement, students admission_number) are left alone
-- because one side backs a constraint and DROP INDEX would fail.
DROP INDEX IF EXISTS public.admissions_status_idx;
DROP INDEX IF EXISTS public.co_scholastic_student_id_idx;
DROP INDEX IF EXISTS public.exam_results_exam_id_idx;
DROP INDEX IF EXISTS public.exam_results_student_id_idx;
DROP INDEX IF EXISTS public.fees_student_id_idx;
DROP INDEX IF EXISTS public.marks_exam_id_idx;
DROP INDEX IF EXISTS public.marks_student_id_idx;
DROP INDEX IF EXISTS public.idx_student_documents_student_id;
DROP INDEX IF EXISTS public.students_class_idx;

-- ---------------------------------------------------------------------
-- 4. Refresh planner statistics on the rebuilt tables
-- ---------------------------------------------------------------------
ANALYZE public.timetable;
ANALYZE public.assignments;
ANALYZE public.student_assignment_submissions;
ANALYZE public.marks;
ANALYZE public.exam_results;
ANALYZE public.syllabus_units;
ANALYZE public.syllabus_chapters;
ANALYZE public.syllabus_topics;
ANALYZE public.syllabus_progress;
ANALYZE public.lesson_plans;
ANALYZE public.teacher_assignments;
ANALYZE public.class_sections;
ANALYZE public.students;
