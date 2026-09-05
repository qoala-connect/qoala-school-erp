-- =====================================================================
-- MIGRATION 05b — constrain what 05a backfilled
-- =====================================================================
-- Run only after reviewing the 05a backfill. At the time this was
-- applied the coverage was:
--
--   students        120 rows, 120 with class_id, section_id,
--                   academic_year_id and status. Zero unmatched.
--   exams             3 rows, all resolved ('10th'->10, '9th'->9)
--   sections          3 (A, B, C)   class_sections 24   academic_years 2
--
-- Because coverage is total, NOT NULL can be added without a data fix.
--
-- ALSO FIXES
--   assign_student_roll_number() computed MAX(roll_number) + 1 on a TEXT
--   column. String comparison makes '9' greater than '10', so the
--   sequence broke permanently once a class passed nine students and
--   began re-issuing numbers already taken.
--
-- ROLLBACK: supabase_academic_migration_05b_rollback.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Student lifecycle
-- ---------------------------------------------------------------------
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_status_check;
ALTER TABLE public.students
  ADD CONSTRAINT students_status_check
  CHECK (status IN ('active', 'inactive', 'transferred', 'graduated', 'withdrawn'));

ALTER TABLE public.students ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE public.students ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.students ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.students ALTER COLUMN updated_at SET NOT NULL;

-- ---------------------------------------------------------------------
-- 2. Referential integrity for the core entity
-- ---------------------------------------------------------------------
ALTER TABLE public.students ALTER COLUMN class_id         SET NOT NULL;
ALTER TABLE public.students ALTER COLUMN section_id       SET NOT NULL;
ALTER TABLE public.students ALTER COLUMN academic_year_id SET NOT NULL;

ALTER TABLE public.exams ALTER COLUMN class_id         SET NOT NULL;
ALTER TABLE public.exams ALTER COLUMN academic_year_id SET NOT NULL;

-- Roll numbers are unique within a class, section and year. The existing
-- constraint keys on the three text columns; this is the same rule
-- expressed against the ids, which is what the application will use.
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_roll_unique_by_id;
ALTER TABLE public.students
  ADD CONSTRAINT students_roll_unique_by_id
  UNIQUE (class_id, section_id, academic_year_id, roll_number);

-- ---------------------------------------------------------------------
-- 3. Roll number assignment that survives double digits
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_student_roll_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
DECLARE
  next_roll integer;
BEGIN
  IF NEW.roll_number IS NULL OR btrim(NEW.roll_number) = '' THEN
    -- Cast to integer before taking the maximum. As text, '9' sorts above
    -- '10' and the sequence stalls at 9 forever.
    SELECT coalesce(max(nullif(substring(s.roll_number FROM '[0-9]+'), '')::integer), 0) + 1
      INTO next_roll
      FROM public.students s
     WHERE s.class_id = NEW.class_id
       AND s.section_id = NEW.section_id
       AND s.academic_year_id = NEW.academic_year_id;

    NEW.roll_number := next_roll::text;
  END IF;

  RETURN NEW;
END;
$fn$;

-- ---------------------------------------------------------------------
-- 4. Changing a student's status, with an audit entry
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_student_status(
  _student_id uuid,
  _status     text,
  _reason     text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  actor uuid := auth.uid();
  old_status text;
  student_name text;
BEGIN
  IF NOT public.auth_has_permission('student.update') THEN
    RAISE EXCEPTION 'You do not have permission to change a student''s status'
      USING ERRCODE = '42501';
  END IF;

  IF _status NOT IN ('active', 'inactive', 'transferred', 'graduated', 'withdrawn') THEN
    RAISE EXCEPTION 'Unknown student status: %', _status USING ERRCODE = 'check_violation';
  END IF;

  SELECT status, name INTO old_status, student_name
  FROM public.students WHERE id = _student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That student does not exist' USING ERRCODE = 'no_data_found';
  END IF;

  IF old_status = _status THEN
    RETURN;
  END IF;

  UPDATE public.students
     SET status = _status, status_changed_at = now()
   WHERE id = _student_id;

  INSERT INTO public.audit_logs (user_id, user_email, action_type, table_name, record_id, old_values, new_values)
  VALUES (
    actor,
    (SELECT email FROM public.profiles WHERE id = actor),
    'STUDENT_STATUS_CHANGE', 'students', _student_id,
    jsonb_build_object('status', old_status),
    jsonb_build_object('status', _status, 'reason', _reason, 'name', student_name)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.set_student_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_student_status(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------
-- 5. One place that means "students currently on roll"
-- ---------------------------------------------------------------------
-- security_invoker so RLS applies to the caller, which is the mistake
-- corrected in the first security hotfix and must not recur.
CREATE OR REPLACE VIEW public.active_students
WITH (security_invoker = on) AS
SELECT s.*,
       c.class_name    AS class_name,
       sec.section_name AS section_label,
       ay.name          AS academic_year_name
FROM public.students s
JOIN public.classes c        ON c.id  = s.class_id
JOIN public.sections sec     ON sec.id = s.section_id
JOIN public.academic_years ay ON ay.id = s.academic_year_id
WHERE s.status = 'active';

COMMENT ON VIEW public.active_students IS
  'Students currently on roll, with class, section and year resolved. Use this for class lists, fee runs and attendance so leavers are excluded.';

REVOKE ALL ON public.active_students FROM anon;
GRANT SELECT ON public.active_students TO authenticated;

COMMIT;
