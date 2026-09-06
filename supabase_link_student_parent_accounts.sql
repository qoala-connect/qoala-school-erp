-- STUDENT / PARENT are the last two roles in the exam workflow, and they were
-- entirely non-functional: RLS is correct (students_owner_select,
-- exam_results_owner_select) but the identity linkage it depends on was empty —
-- students.user_id was set on 2 rows, students.family_id on none, and the
-- parents table had 0 rows. So every student/parent login resolved to no
-- student and the portal showed "account not linked".
--
-- Part A adds the missing production mechanism: auto-link a login to its
-- student record by email whenever a profile is created or its email changes.
-- Part B is clearly-marked development seed linking so the flow is testable.

BEGIN;

-- ---------------------------------------------------------------------
-- A. Auto-link mechanism (production)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_profile_to_student()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role = 'student' AND NEW.email IS NOT NULL THEN
    UPDATE public.students s
       SET user_id = NEW.id
     WHERE lower(s.email) = lower(NEW.email)
       AND s.user_id IS DISTINCT FROM NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_profile_to_student ON public.profiles;
CREATE TRIGGER trg_link_profile_to_student
  AFTER INSERT OR UPDATE OF email, role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.link_profile_to_student();

-- Backfill any existing student logins whose email matches a student record.
UPDATE public.students s
   SET user_id = p.id
  FROM public.profiles p
 WHERE p.role = 'student'
   AND p.email IS NOT NULL
   AND lower(s.email) = lower(p.email)
   AND s.user_id IS DISTINCT FROM p.id;

-- ---------------------------------------------------------------------
-- B. Development seed linkage  [DEV SEED — safe to delete]
--    Links the demo logins to one real student so the
--    Admin -> Teacher -> Result -> Student/Parent flow can be walked end to end.
--    Student chosen: Shivam Kurmi, Class 1 Sec B (Priyanka's English section).
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_student   uuid := 'f937841c-6261-46ab-84d7-7f9bdf936698';  -- Shivam Kurmi
  v_stu_user  uuid;
  v_par_user  uuid;
  v_family    uuid;
BEGIN
  SELECT id INTO v_stu_user FROM public.profiles WHERE lower(email) = 'student@school.com';
  SELECT id INTO v_par_user FROM public.profiles WHERE lower(email) = 'parent@school.com';

  IF v_stu_user IS NOT NULL THEN
    UPDATE public.students SET user_id = v_stu_user WHERE id = v_student;
  END IF;

  IF v_par_user IS NOT NULL THEN
    SELECT family_id INTO v_family FROM public.students WHERE id = v_student;
    IF v_family IS NULL THEN
      INSERT INTO public.families (family_code)
      VALUES ('SJS/FAM/DEMO/0001')
      RETURNING id INTO v_family;
      UPDATE public.students SET family_id = v_family WHERE id = v_student;
    END IF;

    INSERT INTO public.parents (user_id, family_id, father_name, father_email, is_active)
    SELECT v_par_user, v_family, s.father_name, 'parent@school.com', true
      FROM public.students s WHERE s.id = v_student
    ON CONFLICT DO NOTHING;

    UPDATE public.parents
       SET family_id = v_family, is_active = true
     WHERE user_id = v_par_user;
  END IF;
END $$;

COMMIT;
