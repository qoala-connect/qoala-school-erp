-- =====================================================================
-- "I approved an admission but the student is not in the directory."
--
-- Two independent causes, both fixed here.
--
-- 1. Twenty admissions carry status 'Approved' with student_id NULL. They
--    have reviewed_at and reviewed_by NULL across two identical timestamps,
--    so they were bulk-written straight to 'Approved' and never went
--    through approve_admission(). The Admissions board counts them under
--    "Enrolled in SIS" while no student exists, so they can never appear in
--    the directory. Backfilled below, and blocked from recurring.
--
-- 2. Editing an approved admission did not move the student. Admission
--    'vishal' was approved into Class 4 at 05:49 and the application was
--    then edited to Class 5 at 05:50; the student stayed in Class 4. The
--    admission says one class, the directory says another, and looking
--    under the class the application shows finds nobody.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Keep an approved admission and its student in step.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_student_from_admission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_class_id   uuid;
  v_section_id uuid;
  v_class_name text;
  v_sec_name   text;
BEGIN
  IF NEW.student_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only react when the placement actually changed.
  IF NEW.class    IS NOT DISTINCT FROM OLD.class
 AND NEW.section  IS NOT DISTINCT FROM OLD.section
 AND NEW.class_id IS NOT DISTINCT FROM OLD.class_id
 AND NEW.section_id IS NOT DISTINCT FROM OLD.section_id THEN
    RETURN NEW;
  END IF;

  -- Resolve the class: prefer the explicit FK, else the text the user sees,
  -- tolerating the "12th" / "3rd" forms the application form allows.
  v_class_id := NEW.class_id;
  IF v_class_id IS NULL AND NEW.class IS NOT NULL THEN
    SELECT c.id INTO v_class_id FROM classes c
    WHERE lower(trim(c.class_name)) = lower(trim(NEW.class))
    LIMIT 1;
    IF v_class_id IS NULL THEN
      SELECT c.id INTO v_class_id FROM classes c
      WHERE lower(trim(c.class_name)) =
            lower(trim(regexp_replace(NEW.class, '(st|nd|rd|th)$', '', 'i')))
      LIMIT 1;
    END IF;
  END IF;

  v_section_id := NEW.section_id;
  IF v_section_id IS NULL AND NEW.section IS NOT NULL THEN
    SELECT s.id INTO v_section_id FROM sections s
    WHERE lower(trim(s.section_name)) = lower(trim(NEW.section))
    LIMIT 1;
  END IF;

  -- Unresolvable placement: leave the student alone rather than guessing.
  IF v_class_id IS NULL OR v_section_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT class_name INTO v_class_name FROM classes  WHERE id = v_class_id;
  SELECT section_name INTO v_sec_name FROM sections WHERE id = v_section_id;

  UPDATE students
     SET class_id   = v_class_id,
         section_id = v_section_id,
         class      = v_class_name,
         section    = v_sec_name,
         updated_at = now()
   WHERE id = NEW.student_id
     AND (class_id IS DISTINCT FROM v_class_id OR section_id IS DISTINCT FROM v_section_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_student_from_admission ON public.admissions;
CREATE TRIGGER trg_sync_student_from_admission
AFTER UPDATE ON public.admissions
FOR EACH ROW EXECUTE FUNCTION public.sync_student_from_admission();

-- ---------------------------------------------------------------------
-- 2. Backfill the approved-but-studentless applications.
--    approve_admission() accepts current_user = 'postgres', which is what
--    this migration runs as, and is idempotent for rows already linked.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  r record;
  n int := 0;
  failed int := 0;
BEGIN
  FOR r IN
    SELECT id, name, section FROM admissions
    WHERE status ILIKE 'approved' AND student_id IS NULL
    ORDER BY created_at
  LOOP
    BEGIN
      PERFORM public.approve_admission(r.id, COALESCE(NULLIF(trim(r.section), ''), 'A'), NULL);
      n := n + 1;
    EXCEPTION WHEN others THEN
      failed := failed + 1;
      RAISE WARNING 'could not enrol admission % (%): %', r.id, r.name, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'backfilled % admission(s), % failed', n, failed;
END $$;

-- ---------------------------------------------------------------------
-- 3. Stop an application being marked Approved with no student behind it.
--    approve_admission() sets status and student_id in one UPDATE, so the
--    legitimate path is unaffected; only a bare status write is refused.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_admission_has_student()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status ILIKE 'approved' AND NEW.student_id IS NULL THEN
    RAISE EXCEPTION
      'An application cannot be marked Approved without enrolling the student. Use the Approve action, which creates the student record.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_admission_has_student ON public.admissions;
CREATE TRIGGER trg_enforce_admission_has_student
BEFORE INSERT OR UPDATE ON public.admissions
FOR EACH ROW EXECUTE FUNCTION public.enforce_admission_has_student();

SELECT count(*) FILTER (WHERE status ILIKE 'approved' AND student_id IS NULL) AS still_orphaned,
       count(*) FILTER (WHERE status ILIKE 'approved')                        AS approved_total
FROM admissions;
