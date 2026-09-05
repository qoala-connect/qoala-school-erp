-- =====================================================================
-- MIGRATION 04 — attendance and marks: no more delete-then-insert
-- =====================================================================
-- PROBLEMS THIS SOLVES
--
--   1. Both modules saved by deleting every row for the class and date,
--      or for the exam, then inserting the new set, from the browser and
--      with no transaction. A failure between the two steps left the
--      register or the mark sheet permanently empty, with no recovery
--      and no audit trail. Both tables already carry the unique keys an
--      upsert needs, so the delete was never necessary.
--
--   2. MarksEntry loaded EVERY mark in the database with no exam filter,
--      collapsed them into one map keyed by student and subject, then
--      deleted one exam and rewrote it from that mixed state. Saving one
--      exam could therefore write another exam's marks over it.
--
--   3. marks hardcoded max_marks = 100 in the client and ignored
--      exam_subjects.max_marks entirely. Nothing checked that a score
--      fell within the configured maximum.
--
--   4. The CHECK constraints on marks hardcode one CBSE weighting
--      (10 / 5 / 5 / 5 / 80) for every subject in every exam, regardless
--      of what exam_subjects configures.
--
--   5. attendance held four columns: id, student_id, attendance_date,
--      status. No class, section, academic year, who marked it, or when.
--      Class-wise reporting had to join back to the student's CURRENT
--      class, so historical attendance silently re-attributed itself
--      when a student was promoted. 'late' was not a permitted status
--      despite being required.
--
-- SAFETY
--   Additive. attendance and marks both hold zero rows, so no backfill
--   can lose data. The hardcoded CHECK constraints are replaced with a
--   trigger that validates against the exam's own configuration.
--
-- ROLLBACK: supabase_attendance_marks_migration_04_rollback.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. attendance: record enough to be a real register
-- ---------------------------------------------------------------------
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS class            text,
  ADD COLUMN IF NOT EXISTS section          text,
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marked_by        uuid,
  ADD COLUMN IF NOT EXISTS remarks          text,
  ADD COLUMN IF NOT EXISTS created_at       timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.attendance.class IS
  'Class as it was on the attendance date. Stored rather than joined so a promotion does not rewrite history.';

-- 'late' and 'half_day' are real states a school records.
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present', 'absent', 'late', 'leave', 'half_day'));

-- Two identical unique constraints cost an extra index on every write.
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_student_id_attendance_date_key;

CREATE INDEX IF NOT EXISTS idx_attendance_date_class ON public.attendance (attendance_date, class, section);

DROP TRIGGER IF EXISTS trigger_update_attendance ON public.attendance;
CREATE TRIGGER trigger_update_attendance
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- ---------------------------------------------------------------------
-- 2. marks: validate against the exam's own configuration
-- ---------------------------------------------------------------------
ALTER TABLE public.marks
  ADD COLUMN IF NOT EXISTS entered_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- These encode one CBSE weighting for every subject in every exam. The
-- component caps belong to the exam configuration, not to the schema.
ALTER TABLE public.marks DROP CONSTRAINT IF EXISTS marks_periodic_test_marks_check;
ALTER TABLE public.marks DROP CONSTRAINT IF EXISTS marks_multiple_assessment_marks_check;
ALTER TABLE public.marks DROP CONSTRAINT IF EXISTS marks_portfolio_marks_check;
ALTER TABLE public.marks DROP CONSTRAINT IF EXISTS marks_subject_enrichment_marks_check;
ALTER TABLE public.marks DROP CONSTRAINT IF EXISTS marks_annual_exam_marks_check;

-- Components may not be negative. Their upper bound is the exam's.
ALTER TABLE public.marks DROP CONSTRAINT IF EXISTS marks_components_nonnegative;
ALTER TABLE public.marks
  ADD CONSTRAINT marks_components_nonnegative CHECK (
    coalesce(periodic_test_marks, 0)        >= 0 AND
    coalesce(multiple_assessment_marks, 0)  >= 0 AND
    coalesce(portfolio_marks, 0)            >= 0 AND
    coalesce(subject_enrichment_marks, 0)   >= 0 AND
    coalesce(annual_exam_marks, 0)          >= 0 AND
    coalesce(obtained_marks, 0)             >= 0
  );

/**
 * Derives obtained_marks from the five components, pulls max_marks from
 * the exam's own configuration, and refuses a score above it.
 */
CREATE OR REPLACE FUNCTION public.marks_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
DECLARE
  configured_max integer;
  total          numeric(6,2);
BEGIN
  total := round(
      coalesce(NEW.periodic_test_marks, 0)
    + coalesce(NEW.multiple_assessment_marks, 0)
    + coalesce(NEW.portfolio_marks, 0)
    + coalesce(NEW.subject_enrichment_marks, 0)
    + coalesce(NEW.annual_exam_marks, 0), 2);

  -- An absent student scores nothing, whatever was typed.
  IF coalesce(NEW.is_absent, false) THEN
    NEW.periodic_test_marks       := 0;
    NEW.multiple_assessment_marks := 0;
    NEW.portfolio_marks           := 0;
    NEW.subject_enrichment_marks  := 0;
    NEW.annual_exam_marks         := 0;
    total := 0;
  END IF;

  SELECT es.max_marks INTO configured_max
  FROM public.exam_subjects es
  WHERE es.exam_id = NEW.exam_id AND es.subject_id = NEW.subject_id;

  IF configured_max IS NULL THEN
    RAISE EXCEPTION
      'That subject is not configured for this exam. Add it under the exam''s subjects before entering marks.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  NEW.max_marks     := configured_max;
  NEW.obtained_marks := total;

  IF total > configured_max THEN
    RAISE EXCEPTION
      'Marks of % exceed the maximum of % configured for this subject',
      total, configured_max
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS marks_validate ON public.marks;
CREATE TRIGGER marks_validate
  BEFORE INSERT OR UPDATE ON public.marks
  FOR EACH ROW EXECUTE FUNCTION public.marks_validate();

-- ---------------------------------------------------------------------
-- 3. save_attendance() — one atomic upsert for a whole register
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_attendance(
  _attendance_date date,
  _class           text,
  _section         text,
  _records         jsonb
)
RETURNS TABLE (saved integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  year_id uuid := (SELECT id FROM public.academic_years WHERE is_current LIMIT 1);
  actor   uuid := auth.uid();
  n       integer;
BEGIN
  IF NOT public.auth_has_permission('attendance.manage') THEN
    RAISE EXCEPTION 'You do not have permission to record attendance'
      USING ERRCODE = '42501';
  END IF;

  IF _attendance_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Attendance cannot be recorded for a future date'
      USING ERRCODE = 'check_violation';
  END IF;

  IF _records IS NULL OR jsonb_array_length(_records) = 0 THEN
    RAISE EXCEPTION 'No attendance records were supplied' USING ERRCODE = 'no_data_found';
  END IF;

  -- One statement. Nothing is deleted, so a failure leaves the existing
  -- register exactly as it was.
  WITH incoming AS (
    SELECT (r->>'student_id')::uuid AS student_id,
           r->>'status'             AS status,
           nullif(r->>'remarks','') AS remarks
    FROM jsonb_array_elements(_records) AS r
  ),
  upserted AS (
    INSERT INTO public.attendance AS a
      (student_id, attendance_date, status, class, section, academic_year_id, marked_by, remarks)
    SELECT i.student_id, _attendance_date, i.status, _class, _section, year_id, actor, i.remarks
    FROM incoming i
    JOIN public.students s ON s.id = i.student_id
    ON CONFLICT (student_id, attendance_date) DO UPDATE
      SET status           = EXCLUDED.status,
          class            = EXCLUDED.class,
          section          = EXCLUDED.section,
          academic_year_id = EXCLUDED.academic_year_id,
          marked_by        = EXCLUDED.marked_by,
          remarks          = EXCLUDED.remarks,
          updated_at       = now()
    RETURNING 1
  )
  SELECT count(*)::int INTO n FROM upserted;

  INSERT INTO public.audit_logs (user_id, user_email, action_type, table_name, new_values)
  VALUES (
    actor,
    (SELECT email FROM public.profiles WHERE id = actor),
    'ATTENDANCE_SAVED', 'attendance',
    jsonb_build_object('date', _attendance_date, 'class', _class, 'section', _section, 'records', n)
  );

  RETURN QUERY SELECT n;
END;
$fn$;

-- ---------------------------------------------------------------------
-- 4. save_marks() — one atomic upsert for an exam's mark sheet
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_marks(_exam_id uuid, _records jsonb)
RETURNS TABLE (saved integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  actor uuid := auth.uid();
  n     integer;
BEGIN
  IF NOT public.auth_has_permission('results.publish') THEN
    RAISE EXCEPTION 'You do not have permission to enter marks'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.exams WHERE id = _exam_id) THEN
    RAISE EXCEPTION 'That exam does not exist' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF _records IS NULL OR jsonb_array_length(_records) = 0 THEN
    RAISE EXCEPTION 'No marks were supplied' USING ERRCODE = 'no_data_found';
  END IF;

  WITH incoming AS (
    SELECT (r->>'student_id')::uuid AS student_id,
           (r->>'subject_id')::uuid AS subject_id,
           coalesce((r->>'periodic_test_marks')::numeric, 0)       AS pt,
           coalesce((r->>'multiple_assessment_marks')::numeric, 0) AS ma,
           coalesce((r->>'portfolio_marks')::numeric, 0)           AS pf,
           coalesce((r->>'subject_enrichment_marks')::numeric, 0)  AS se,
           coalesce((r->>'annual_exam_marks')::numeric, 0)         AS ae,
           coalesce((r->>'is_absent')::boolean, false)             AS absent
    FROM jsonb_array_elements(_records) AS r
  ),
  upserted AS (
    INSERT INTO public.marks AS m
      (exam_id, student_id, subject_id,
       periodic_test_marks, multiple_assessment_marks, portfolio_marks,
       subject_enrichment_marks, annual_exam_marks, is_absent,
       max_marks, obtained_marks, entered_by)
    SELECT _exam_id, i.student_id, i.subject_id,
           i.pt, i.ma, i.pf, i.se, i.ae, i.absent,
           0, 0,  -- both are overwritten by the marks_validate trigger
           actor
    FROM incoming i
    ON CONFLICT (exam_id, student_id, subject_id) DO UPDATE
      SET periodic_test_marks       = EXCLUDED.periodic_test_marks,
          multiple_assessment_marks = EXCLUDED.multiple_assessment_marks,
          portfolio_marks           = EXCLUDED.portfolio_marks,
          subject_enrichment_marks  = EXCLUDED.subject_enrichment_marks,
          annual_exam_marks         = EXCLUDED.annual_exam_marks,
          is_absent                 = EXCLUDED.is_absent,
          entered_by                = EXCLUDED.entered_by,
          updated_at                = now()
    RETURNING 1
  )
  SELECT count(*)::int INTO n FROM upserted;

  INSERT INTO public.audit_logs (user_id, user_email, action_type, table_name, record_id, new_values)
  VALUES (
    actor,
    (SELECT email FROM public.profiles WHERE id = actor),
    'MARKS_SAVED', 'marks', _exam_id,
    jsonb_build_object('exam_id', _exam_id, 'records', n)
  );

  RETURN QUERY SELECT n;
END;
$fn$;

-- ---------------------------------------------------------------------
-- 5. Privileges: the functions are the only write path
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.save_attendance(date, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_marks(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_attendance(date, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_marks(uuid, jsonb) TO authenticated;

REVOKE DELETE ON public.attendance FROM anon, authenticated;
REVOKE DELETE ON public.marks      FROM anon, authenticated;
REVOKE ALL    ON public.attendance FROM anon;
REVOKE ALL    ON public.marks      FROM anon;

COMMIT;
