-- =====================================================================
-- MIGRATION 07b — ACADEMICS: PERMISSIONS, INTEGRITY, READ MODEL
-- =====================================================================
--
-- THE SECURITY DEFECT THIS CLOSES
--
--   Every write policy on the academic master tables was gated on
--   is_staff(), which returns true for teacher, class_teacher,
--   librarian, receptionist, transport_manager and nine other roles.
--   Signing in as the seeded teacher account and issuing a plain
--   PostgREST insert created rows in classes, sections, subjects and
--   academic_years, and the matching delete removed them. A teacher
--   could rename Class 8, delete a subject, or add a second academic
--   year, and nothing in the database stopped it.
--
--   The permission that should have been the gate already exists:
--   academics.manage, held only by admin, principal and super_admin.
--   Reads stay open to every authenticated user, because a student who
--   cannot read academic_years cannot be shown their own timetable —
--   which is the state academic_years was in, gated on is_staff().
--
-- THE INTEGRITY DEFECTS THIS CLOSES
--
--   Deleting a subject cascaded into exam_subjects, so removing a
--   subject from Academics silently destroyed the subject rows of every
--   exam that used it. Both paths are now RESTRICT and the UI
--   deactivates instead of deleting.
--
--   timetable.teacher_id referenced auth.users while every query in the
--   application joins it to teachers.id, so every slot rendered as
--   Unassigned. All thirty rows hold NULL, so the reference can be
--   corrected without touching data.
--
--   class_teachers is a legacy duplicate of teacher_assignments. Its
--   teacher_id references auth.users, and two of its four rows name a
--   student account as the class teacher of 10-A and 9-B. Nothing in the
--   application reads it. It is marked deprecated and closed to writes
--   rather than dropped, so the rows remain available for inspection.
--
-- ROLLBACK: supabase_academics_migration_07_rollback.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Duplicate subjects in the master list
-- ---------------------------------------------------------------------
-- 'English Literature' duplicates 'English'; 'Social Studies' duplicates
-- 'Social Science'. Neither duplicate is referenced by class_subjects,
-- exam_subjects, marks, timetable, teacher_assignments or teachers, so
-- they are deactivated rather than deleted: the row survives for audit,
-- and nothing can select it going forward.
UPDATE public.subjects
   SET is_active = false
 WHERE subject_name IN ('English Literature', 'Social Studies')
   AND NOT EXISTS (SELECT 1 FROM public.class_subjects      x WHERE x.subject_id = subjects.id)
   AND NOT EXISTS (SELECT 1 FROM public.exam_subjects       x WHERE x.subject_id = subjects.id)
   AND NOT EXISTS (SELECT 1 FROM public.marks               x WHERE x.subject_id = subjects.id)
   AND NOT EXISTS (SELECT 1 FROM public.timetable           x WHERE x.subject_id = subjects.id)
   AND NOT EXISTS (SELECT 1 FROM public.teacher_assignments x WHERE x.subject_id = subjects.id)
   AND NOT EXISTS (SELECT 1 FROM public.teachers            x WHERE x.subject_id = subjects.id);

-- An exam_subjects row naming 'Sanskrit' by text, with no subject_id and
-- pointing at an exam that does not exist. This is Examination having
-- named a subject instead of referencing one.
DELETE FROM public.exam_subjects es
 WHERE es.subject_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.exams e WHERE e.id = es.exam_id);

-- Anything still unlinked is matched to the canonical subject by name so
-- Examination stops carrying its own copy of the subject list.
UPDATE public.exam_subjects es
   SET subject_id = s.id
  FROM public.subjects s
 WHERE es.subject_id IS NULL
   AND lower(btrim(es.subject_name)) = lower(s.subject_name);

-- ---------------------------------------------------------------------
-- 2. Referential integrity
-- ---------------------------------------------------------------------
ALTER TABLE public.exam_subjects  DROP CONSTRAINT IF EXISTS exam_subjects_subject_id_fkey;
ALTER TABLE public.exam_subjects
  ADD CONSTRAINT exam_subjects_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE RESTRICT;

ALTER TABLE public.class_subjects DROP CONSTRAINT IF EXISTS class_subjects_subject_id_fkey;
ALTER TABLE public.class_subjects
  ADD CONSTRAINT class_subjects_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE RESTRICT;

-- timetable.teacher_id must name a teacher, not an auth user.
ALTER TABLE public.timetable DROP CONSTRAINT IF EXISTS timetable_teacher_id_fkey;
ALTER TABLE public.timetable
  ADD CONSTRAINT timetable_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;

-- One row per class, year, subject and section. section_id is NULL for a
-- whole-class offering, so NULLS NOT DISTINCT is required or the same
-- whole-class subject could be added to a class any number of times.
DROP INDEX IF EXISTS uq_class_subject_offering;
CREATE UNIQUE INDEX uq_class_subject_offering
  ON public.class_subjects (class_id, academic_year_id, subject_id, section_id)
  NULLS NOT DISTINCT;

-- ---------------------------------------------------------------------
-- 3. Retire class_teachers
-- ---------------------------------------------------------------------
COMMENT ON TABLE public.class_teachers IS
  'DEPRECATED. Superseded by teacher_assignments, which is year-scoped, section-aware and references teachers.id. This table references auth.users and contains rows naming a student account as a class teacher. Retained read-only for audit; do not read it from application code.';

ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage class teachers" ON public.class_teachers;
DROP POLICY IF EXISTS "Teachers read own classes"    ON public.class_teachers;
DROP POLICY IF EXISTS class_teachers_admin_read      ON public.class_teachers;

CREATE POLICY class_teachers_admin_read ON public.class_teachers
  FOR SELECT TO authenticated USING (public.is_admin());

-- ---------------------------------------------------------------------
-- 4. Row level security on the academic master
-- ---------------------------------------------------------------------
-- Read: any authenticated user. Write: academics.manage only.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['classes','sections','class_sections','subjects','class_subjects','academic_years','lesson_plans']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_staff_write', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_staff_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_staff_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_academics_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_academics_write', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      t || '_academics_read', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      || 'USING (public.auth_has_permission(''academics.manage'')) '
      || 'WITH CHECK (public.auth_has_permission(''academics.manage''))',
      t || '_academics_write', t);
  END LOOP;
END $$;

-- Timetable follows the same rule as the rest of the academic structure
-- rather than admin-only, so a principal can maintain it.
ALTER TABLE public.timetable ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS timetable_admin_all       ON public.timetable;
DROP POLICY IF EXISTS timetable_teacher_select  ON public.timetable;
DROP POLICY IF EXISTS timetable_academics_read  ON public.timetable;
DROP POLICY IF EXISTS timetable_academics_write ON public.timetable;

CREATE POLICY timetable_academics_read ON public.timetable
  FOR SELECT TO authenticated USING (true);

CREATE POLICY timetable_academics_write ON public.timetable
  FOR ALL TO authenticated
  USING (public.auth_has_permission('academics.manage'))
  WITH CHECK (public.auth_has_permission('academics.manage'));

-- ---------------------------------------------------------------------
-- 5. Switching the current academic year
-- ---------------------------------------------------------------------
-- The unique index allows one is_current row, so clearing and setting
-- must happen together. Doing it from the client takes two round trips
-- and leaves a window with no current year, which every year-scoped
-- query reads as "no data".
CREATE OR REPLACE FUNCTION public.set_current_academic_year(_year_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  yr_name text;
  old_id  uuid;
BEGIN
  IF NOT public.auth_has_permission('academics.manage') THEN
    RAISE EXCEPTION 'You do not have permission to change the academic year'
      USING ERRCODE = '42501';
  END IF;

  SELECT name INTO yr_name FROM public.academic_years WHERE id = _year_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That academic year does not exist' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT id INTO old_id FROM public.academic_years WHERE is_current;

  IF old_id IS NOT DISTINCT FROM _year_id THEN
    RETURN;
  END IF;

  UPDATE public.academic_years
     SET is_current = false,
         status     = CASE WHEN end_date < CURRENT_DATE THEN 'completed' ELSE status END
   WHERE is_current;

  UPDATE public.academic_years
     SET is_current = true, is_active = true, status = 'active'
   WHERE id = _year_id;

  INSERT INTO public.audit_logs (user_id, user_email, action_type, table_name, record_id, old_values, new_values)
  VALUES (
    auth.uid(),
    (SELECT email FROM public.profiles WHERE id = auth.uid()),
    'ACADEMIC_YEAR_SWITCH', 'academic_years', _year_id,
    jsonb_build_object('previous_current', old_id),
    jsonb_build_object('current', _year_id, 'name', yr_name)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.set_current_academic_year(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_current_academic_year(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 6. Refusing a delete that would take history with it
-- ---------------------------------------------------------------------
-- The foreign keys already stop a class or section that holds students
-- from being deleted, but they report it as a constraint violation the
-- user cannot act on. These raise the reason instead, and cover the
-- cases no foreign key does.
CREATE OR REPLACE FUNCTION public.fn_guard_class_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.students WHERE class_id = OLD.id;
  IF n > 0 THEN
    RAISE EXCEPTION 'Class % still has % student(s) enrolled. Deactivate it instead of deleting it.',
      OLD.class_name, n USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT count(*) INTO n FROM public.exams WHERE class_id = OLD.id;
  IF n > 0 THEN
    RAISE EXCEPTION 'Class % is referenced by % exam(s). Deactivate it instead of deleting it.',
      OLD.class_name, n USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT count(*) INTO n FROM public.teacher_assignments WHERE class_id = OLD.id;
  IF n > 0 THEN
    RAISE EXCEPTION 'Class % has % teacher assignment(s). Remove them from Teacher Management first.',
      OLD.class_name, n USING ERRCODE = 'foreign_key_violation';
  END IF;

  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_guard_class_delete ON public.classes;
CREATE TRIGGER trg_guard_class_delete BEFORE DELETE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_class_delete();

CREATE OR REPLACE FUNCTION public.fn_guard_subject_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.marks WHERE subject_id = OLD.id;
  IF n > 0 THEN
    RAISE EXCEPTION 'Subject % has % marks record(s) against it. Deactivate it instead of deleting it.',
      OLD.subject_name, n USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT count(*) INTO n FROM public.class_subjects WHERE subject_id = OLD.id;
  IF n > 0 THEN
    RAISE EXCEPTION 'Subject % is mapped to % class(es). Remove those mappings first.',
      OLD.subject_name, n USING ERRCODE = 'foreign_key_violation';
  END IF;

  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_guard_subject_delete ON public.subjects;
CREATE TRIGGER trg_guard_subject_delete BEFORE DELETE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_subject_delete();

CREATE OR REPLACE FUNCTION public.fn_guard_academic_year_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
DECLARE
  n integer;
BEGIN
  IF OLD.is_current THEN
    RAISE EXCEPTION 'The current academic year cannot be deleted. Make another year current first.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT count(*) INTO n FROM public.students WHERE academic_year_id = OLD.id;
  IF n > 0 THEN
    RAISE EXCEPTION 'Academic year % holds the enrolment of % student(s). Archive it instead of deleting it.',
      OLD.name, n USING ERRCODE = 'foreign_key_violation';
  END IF;

  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_guard_academic_year_delete ON public.academic_years;
CREATE TRIGGER trg_guard_academic_year_delete BEFORE DELETE ON public.academic_years
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_academic_year_delete();

CREATE OR REPLACE FUNCTION public.fn_guard_class_section_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
DECLARE
  n integer;
  cname text;
  sname text;
BEGIN
  SELECT count(*) INTO n FROM public.students
   WHERE class_id = OLD.class_id AND section_id = OLD.section_id;

  IF n > 0 THEN
    SELECT c.class_name, s.section_name INTO cname, sname
      FROM public.classes c, public.sections s
     WHERE c.id = OLD.class_id AND s.id = OLD.section_id;
    RAISE EXCEPTION 'Section %-% still has % student(s). Deactivate it instead of deleting it.',
      cname, sname, n USING ERRCODE = 'foreign_key_violation';
  END IF;

  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_guard_class_section_delete ON public.class_sections;
CREATE TRIGGER trg_guard_class_section_delete BEFORE DELETE ON public.class_sections
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_class_section_delete();

COMMIT;
