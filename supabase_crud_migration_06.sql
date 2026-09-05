-- =====================================================================
-- MIGRATION 06 — student and staff CRUD, and storage policies
-- =====================================================================
-- PROBLEMS THIS SOLVES
--
--   1. Students could only be listed. There was no create, no edit and,
--      until migration 05, no way to represent a leaver. Admission was
--      the only path a student could enter by.
--
--   2. Staff add and edit have NEVER worked. The form in Employees.tsx
--      writes five columns that do not exist on the staff table:
--        department, designation, cbse_teaching_level,
--        ctet_qualified, highest_qualification
--      Every save failed with "Could not find the 'cbse_teaching_level'
--      column", and the UI reported a generic "Insert failed" that hid it.
--      Verified against the live database before writing this.
--
--   3. Employees.tsx deletes staff records outright. Employment history
--      is not something a school should be able to erase from a table row.
--
--   4. Three storage buckets (gallery, school-assets, library-covers)
--      have NO policies at all, so nothing can be uploaded to them.
--
-- ROLLBACK: supabase_crud_migration_06_rollback.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. The staff columns the application has always tried to write
-- ---------------------------------------------------------------------
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS employee_id           text,
  ADD COLUMN IF NOT EXISTS designation           text,
  ADD COLUMN IF NOT EXISTS department            text,
  ADD COLUMN IF NOT EXISTS highest_qualification text,
  ADD COLUMN IF NOT EXISTS cbse_teaching_level   text,
  ADD COLUMN IF NOT EXISTS ctet_qualified        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS employment_type       text,
  ADD COLUMN IF NOT EXISTS experience_years      integer,
  ADD COLUMN IF NOT EXISTS gender                text,
  ADD COLUMN IF NOT EXISTS date_of_birth         date,
  ADD COLUMN IF NOT EXISTS address               text,
  ADD COLUMN IF NOT EXISTS photo_url             text,
  ADD COLUMN IF NOT EXISTS status_changed_at     timestamptz;

ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_employee_id_key;
ALTER TABLE public.staff ADD CONSTRAINT staff_employee_id_key UNIQUE (employee_id);

ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_cbse_level_check;
ALTER TABLE public.staff ADD CONSTRAINT staff_cbse_level_check
  CHECK (cbse_teaching_level IS NULL OR cbse_teaching_level IN ('PGT', 'TGT', 'PRT'));

ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_employment_type_check;
ALTER TABLE public.staff ADD CONSTRAINT staff_employment_type_check
  CHECK (employment_type IS NULL OR employment_type IN ('Full-Time', 'Part-Time', 'Contract', 'Temporary'));

-- The form offers a ten-step lifecycle (Application .. Retirement) while
-- the table allowed four values, so anything other than Terminated was
-- flattened to Active. This is the vocabulary an employment record
-- actually needs.
ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_status_check;
ALTER TABLE public.staff ADD CONSTRAINT staff_status_check
  CHECK (status IN ('Active', 'Probation', 'On Leave', 'Suspended', 'Resigned', 'Retired', 'Terminated'));

-- Give existing staff a stable employee id.
UPDATE public.staff
SET employee_id = 'EMP-' || upper(substring(id::text FROM 1 FOR 8))
WHERE employee_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_staff_status ON public.staff (status);

-- ---------------------------------------------------------------------
-- 2. Creating and updating a student
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_student(
  _name             text,
  _father_name      text,
  _date_of_birth    date,
  _class_id         uuid,
  _section_id       uuid,
  _academic_year_id uuid    DEFAULT NULL,
  _mother_name      text    DEFAULT NULL,
  _gender           text    DEFAULT NULL,
  _phone            text    DEFAULT NULL,
  _email            text    DEFAULT NULL,
  _address          text    DEFAULT NULL,
  _category         text    DEFAULT 'General',
  _roll_number      text    DEFAULT NULL,
  _allow_duplicate  boolean DEFAULT false
)
RETURNS TABLE (student_id uuid, admission_number text, roll_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  year_id uuid := coalesce(_academic_year_id, (SELECT id FROM public.academic_years WHERE is_current LIMIT 1));
  actor   uuid := auth.uid();
  dupe    record;
  created public.students;
BEGIN
  IF NOT public.auth_has_permission('student.create') THEN
    RAISE EXCEPTION 'You do not have permission to admit students' USING ERRCODE = '42501';
  END IF;

  IF _name IS NULL OR btrim(_name) = '' THEN
    RAISE EXCEPTION 'The student''s name is required' USING ERRCODE = 'check_violation';
  END IF;
  IF _father_name IS NULL OR btrim(_father_name) = '' THEN
    RAISE EXCEPTION 'The father''s name is required' USING ERRCODE = 'check_violation';
  END IF;
  IF _date_of_birth IS NULL OR _date_of_birth >= CURRENT_DATE THEN
    RAISE EXCEPTION 'Enter a valid date of birth in the past' USING ERRCODE = 'check_violation';
  END IF;
  IF year_id IS NULL THEN
    RAISE EXCEPTION 'No academic year is marked as current' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.classes  WHERE id = _class_id) THEN
    RAISE EXCEPTION 'Choose a valid class' USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sections WHERE id = _section_id) THEN
    RAISE EXCEPTION 'Choose a valid section' USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Duplicate detection: same child, same year. Overridable, because
  -- two pupils genuinely can share a name and birthday.
  IF NOT _allow_duplicate THEN
    SELECT s.admission_number, s.name INTO dupe
    FROM public.students s
    WHERE lower(btrim(s.name)) = lower(btrim(_name))
      AND lower(btrim(s.father_name)) = lower(btrim(_father_name))
      AND s.date_of_birth = _date_of_birth
      AND s.academic_year_id = year_id
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION
        'A student with the same name, father''s name and date of birth already exists this year (admission number %). Confirm to add anyway.',
        dupe.admission_number
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  INSERT INTO public.students (
    name, father_name, mother_name, date_of_birth, gender,
    class_id, section_id, academic_year_id,
    class, section, academic_year,
    phone, email, address, category, roll_number, status
  )
  SELECT
    btrim(_name), btrim(_father_name), nullif(btrim(coalesce(_mother_name,'')),''),
    _date_of_birth, _gender,
    _class_id, _section_id, year_id,
    -- The text columns are kept in step while the UI still reads them.
    c.class_name, sec.section_name, ay.name,
    nullif(btrim(coalesce(_phone,'')),''), nullif(btrim(coalesce(_email,'')),''),
    nullif(btrim(coalesce(_address,'')),''), coalesce(_category, 'General'),
    _roll_number, 'active'
  FROM public.classes c, public.sections sec, public.academic_years ay
  WHERE c.id = _class_id AND sec.id = _section_id AND ay.id = year_id
  RETURNING * INTO created;

  INSERT INTO public.audit_logs (user_id, user_email, action_type, table_name, record_id, new_values)
  VALUES (actor, (SELECT email FROM public.profiles WHERE id = actor),
          'STUDENT_CREATED', 'students', created.id,
          jsonb_build_object('name', created.name, 'admission_number', created.admission_number,
                             'class', created.class, 'section', created.section));

  RETURN QUERY SELECT created.id, created.admission_number::text, created.roll_number::text;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.update_student(
  _student_id    uuid,
  _name          text DEFAULT NULL,
  _father_name   text DEFAULT NULL,
  _mother_name   text DEFAULT NULL,
  _date_of_birth date DEFAULT NULL,
  _gender        text DEFAULT NULL,
  _class_id      uuid DEFAULT NULL,
  _section_id    uuid DEFAULT NULL,
  _phone         text DEFAULT NULL,
  _email         text DEFAULT NULL,
  _address       text DEFAULT NULL,
  _category      text DEFAULT NULL,
  _roll_number   text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  actor  uuid := auth.uid();
  before public.students;
BEGIN
  IF NOT public.auth_has_permission('student.update') THEN
    RAISE EXCEPTION 'You do not have permission to edit students' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO before FROM public.students WHERE id = _student_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That student does not exist' USING ERRCODE = 'no_data_found';
  END IF;

  IF _date_of_birth IS NOT NULL AND _date_of_birth >= CURRENT_DATE THEN
    RAISE EXCEPTION 'Enter a valid date of birth in the past' USING ERRCODE = 'check_violation';
  END IF;

  -- NULL means "leave unchanged", the lesson from the fee migration.
  UPDATE public.students s
  SET name           = coalesce(nullif(btrim(_name), ''), s.name),
      father_name    = coalesce(nullif(btrim(_father_name), ''), s.father_name),
      mother_name    = coalesce(_mother_name, s.mother_name),
      date_of_birth  = coalesce(_date_of_birth, s.date_of_birth),
      gender         = coalesce(_gender, s.gender),
      class_id       = coalesce(_class_id, s.class_id),
      section_id     = coalesce(_section_id, s.section_id),
      phone          = coalesce(_phone, s.phone),
      email          = coalesce(_email, s.email),
      address        = coalesce(_address, s.address),
      category       = coalesce(_category, s.category),
      roll_number    = coalesce(nullif(btrim(_roll_number), ''), s.roll_number),
      class          = coalesce((SELECT class_name   FROM public.classes  WHERE id = _class_id),   s.class),
      section        = coalesce((SELECT section_name FROM public.sections WHERE id = _section_id), s.section)
  WHERE s.id = _student_id;

  INSERT INTO public.audit_logs (user_id, user_email, action_type, table_name, record_id, old_values, new_values)
  VALUES (actor, (SELECT email FROM public.profiles WHERE id = actor),
          'STUDENT_UPDATED', 'students', _student_id,
          jsonb_build_object('name', before.name, 'class', before.class, 'section', before.section,
                             'phone', before.phone, 'roll_number', before.roll_number),
          (SELECT jsonb_build_object('name', name, 'class', class, 'section', section,
                                     'phone', phone, 'roll_number', roll_number)
             FROM public.students WHERE id = _student_id));
END;
$fn$;

-- ---------------------------------------------------------------------
-- 3. Staff status instead of deletion
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_staff_status(
  _staff_id uuid,
  _status   text,
  _reason   text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  actor uuid := auth.uid();
  before record;
BEGIN
  IF NOT public.auth_has_permission('teacher.edit') THEN
    RAISE EXCEPTION 'You do not have permission to change employment status' USING ERRCODE = '42501';
  END IF;

  IF _status NOT IN ('Active','Probation','On Leave','Suspended','Resigned','Retired','Terminated') THEN
    RAISE EXCEPTION 'Unknown employment status: %', _status USING ERRCODE = 'check_violation';
  END IF;

  SELECT id, name, status INTO before FROM public.staff WHERE id = _staff_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That employee does not exist' USING ERRCODE = 'no_data_found';
  END IF;

  UPDATE public.staff
     SET status = _status,
         is_active = (_status IN ('Active','Probation','On Leave')),
         status_changed_at = now()
   WHERE id = _staff_id;

  INSERT INTO public.audit_logs (user_id, user_email, action_type, table_name, record_id, old_values, new_values)
  VALUES (actor, (SELECT email FROM public.profiles WHERE id = actor),
          'STAFF_STATUS_CHANGE', 'staff', _staff_id,
          jsonb_build_object('status', before.status),
          jsonb_build_object('status', _status, 'reason', _reason, 'name', before.name));
END;
$fn$;

-- ---------------------------------------------------------------------
-- 4. Privileges
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_student(text,text,date,uuid,uuid,uuid,text,text,text,text,text,text,text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_student(uuid,text,text,text,date,text,uuid,uuid,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_staff_status(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_student(text,text,date,uuid,uuid,uuid,text,text,text,text,text,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_student(uuid,text,text,text,date,text,uuid,uuid,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_staff_status(uuid,text,text) TO authenticated;

-- Employment and enrolment history are not row-level deletable.
REVOKE DELETE ON public.staff    FROM anon, authenticated;
REVOKE DELETE ON public.students FROM anon, authenticated;

COMMIT;

-- ---------------------------------------------------------------------
-- 5. Storage policies for the three buckets that had none
-- ---------------------------------------------------------------------
-- Outside the transaction: these mirror the pattern already used
-- correctly on student-documents and student-photos.

DROP POLICY IF EXISTS gallery_public_read   ON storage.objects;
DROP POLICY IF EXISTS gallery_staff_write   ON storage.objects;
DROP POLICY IF EXISTS assets_public_read    ON storage.objects;
DROP POLICY IF EXISTS assets_staff_write    ON storage.objects;
DROP POLICY IF EXISTS covers_public_read    ON storage.objects;
DROP POLICY IF EXISTS covers_staff_write    ON storage.objects;

CREATE POLICY gallery_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'gallery');
CREATE POLICY gallery_staff_write ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'gallery' AND public.is_staff())
  WITH CHECK (bucket_id = 'gallery' AND public.is_staff());

CREATE POLICY assets_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'school-assets');
CREATE POLICY assets_staff_write ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'school-assets' AND public.is_admin())
  WITH CHECK (bucket_id = 'school-assets' AND public.is_admin());

CREATE POLICY covers_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'library-covers');
CREATE POLICY covers_staff_write ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'library-covers' AND public.is_staff())
  WITH CHECK (bucket_id = 'library-covers' AND public.is_staff());

-- The gallery bucket accepted any file of any size.
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
WHERE id = 'gallery' AND file_size_limit IS NULL;
