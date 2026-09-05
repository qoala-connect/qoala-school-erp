-- =====================================================================
-- ROLLBACK for migrations 07a, 07b and 07c
-- =====================================================================
--
-- Run this to put the academic schema back the way it was before the
-- Academics work. It restores the previous policies and constraints and
-- removes what 07 added.
--
-- READ THIS FIRST
--
--   Reverting section 3 restores write access to classes, sections,
--   subjects and academic_years for every role is_staff() covers, which
--   includes teacher, librarian and receptionist. That is the security
--   defect 07b closed. Revert it only if a specific workflow depended on
--   it, and put a narrower policy in its place.
--
--   The added columns are dropped, so the data in class_code,
--   display_order, stream, category, subject_type, is_active, status,
--   class_subjects.class_id / academic_year_id / section_id and
--   timetable.class_id / section_id / period_number is lost. The
--   original text columns were never modified, so nothing that existed
--   before 07 is affected.
--
--   Section 1 of 07b deactivated two duplicate subjects and deleted one
--   orphaned exam_subjects row. Those are data changes, not schema, and
--   are NOT reverted here. Reactivate the subjects by hand if wanted:
--     UPDATE public.subjects SET is_active = true
--      WHERE subject_name IN ('English Literature','Social Studies');
--   (Only meaningful before section 5 below drops is_active.)
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Read model
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.academics_overview(uuid);
DROP FUNCTION IF EXISTS public.academics_class_directory(uuid);
DROP FUNCTION IF EXISTS public.academics_section_directory(uuid, uuid);
DROP FUNCTION IF EXISTS public.academics_class_subjects(uuid, uuid);
DROP FUNCTION IF EXISTS public.academics_subject_directory(uuid);

-- ---------------------------------------------------------------------
-- 2. Guards, triggers and the year switch
-- ---------------------------------------------------------------------
DROP TRIGGER  IF EXISTS trg_guard_class_delete          ON public.classes;
DROP TRIGGER  IF EXISTS trg_guard_subject_delete        ON public.subjects;
DROP TRIGGER  IF EXISTS trg_guard_academic_year_delete  ON public.academic_years;
DROP TRIGGER  IF EXISTS trg_guard_class_section_delete  ON public.class_sections;
DROP FUNCTION IF EXISTS public.fn_guard_class_delete();
DROP FUNCTION IF EXISTS public.fn_guard_subject_delete();
DROP FUNCTION IF EXISTS public.fn_guard_academic_year_delete();
DROP FUNCTION IF EXISTS public.fn_guard_class_section_delete();
DROP FUNCTION IF EXISTS public.set_current_academic_year(uuid);

DROP TRIGGER  IF EXISTS trg_class_subjects_sync_text ON public.class_subjects;
DROP TRIGGER  IF EXISTS trg_timetable_sync_text      ON public.timetable;
DROP FUNCTION IF EXISTS public.fn_class_subjects_sync_text();
DROP FUNCTION IF EXISTS public.fn_timetable_sync_text();

DROP TRIGGER IF EXISTS trg_classes_updated_at        ON public.classes;
DROP TRIGGER IF EXISTS trg_subjects_updated_at       ON public.subjects;
DROP TRIGGER IF EXISTS trg_sections_updated_at       ON public.sections;
DROP TRIGGER IF EXISTS trg_academic_years_updated_at ON public.academic_years;

-- ---------------------------------------------------------------------
-- 3. Row level security, back to the is_staff() rule
-- ---------------------------------------------------------------------
-- WARNING: this restores write access for every staff role. See above.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['classes','sections','class_sections','subjects','class_subjects','academic_years','lesson_plans','timetable']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_academics_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_academics_write', t);
  END LOOP;
END $$;

CREATE POLICY classes_read              ON public.classes        FOR SELECT TO authenticated USING (true);
CREATE POLICY classes_staff_write       ON public.classes        FOR ALL    TO authenticated USING (is_staff()) WITH CHECK (is_staff());
CREATE POLICY sections_read             ON public.sections       FOR SELECT TO authenticated USING (true);
CREATE POLICY sections_staff_write      ON public.sections       FOR ALL    TO authenticated USING (is_staff()) WITH CHECK (is_staff());
CREATE POLICY class_sections_read       ON public.class_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY class_sections_staff_write ON public.class_sections FOR ALL   TO authenticated USING (is_staff()) WITH CHECK (is_staff());
CREATE POLICY subjects_read             ON public.subjects       FOR SELECT TO authenticated USING (true);
CREATE POLICY subjects_staff_write      ON public.subjects       FOR ALL    TO authenticated USING (is_staff()) WITH CHECK (is_staff());
CREATE POLICY class_subjects_admin_all  ON public.class_subjects FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY class_subjects_staff_read ON public.class_subjects FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY academic_years_staff_all  ON public.academic_years FOR ALL    TO authenticated USING (is_staff()) WITH CHECK (is_staff());
CREATE POLICY lesson_plans_staff_all    ON public.lesson_plans   FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY timetable_admin_all       ON public.timetable      FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY timetable_teacher_select  ON public.timetable      FOR SELECT TO authenticated USING (is_staff());

DROP POLICY IF EXISTS class_teachers_admin_read ON public.class_teachers;
CREATE POLICY "Admins manage class teachers" ON public.class_teachers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Teachers read own classes" ON public.class_teachers
  FOR SELECT TO authenticated USING (teacher_id = auth.uid());
COMMENT ON TABLE public.class_teachers IS NULL;

-- ---------------------------------------------------------------------
-- 4. Constraints and indexes
-- ---------------------------------------------------------------------
DROP INDEX IF EXISTS uq_class_subject_offering;
DROP INDEX IF EXISTS uq_single_current_academic_year;
DROP INDEX IF EXISTS idx_classes_display_order;
DROP INDEX IF EXISTS idx_classes_active;
DROP INDEX IF EXISTS idx_subjects_active;
DROP INDEX IF EXISTS idx_students_academic_year_id;
DROP INDEX IF EXISTS idx_students_year_class_section;
DROP INDEX IF EXISTS idx_class_subjects_class_year;
DROP INDEX IF EXISTS idx_class_subjects_subject;
DROP INDEX IF EXISTS idx_timetable_class_section;

ALTER TABLE public.classes        DROP CONSTRAINT IF EXISTS classes_class_code_key;
ALTER TABLE public.sections       DROP CONSTRAINT IF EXISTS sections_section_name_key;
ALTER TABLE public.subjects       DROP CONSTRAINT IF EXISTS subjects_category_check;
ALTER TABLE public.subjects       DROP CONSTRAINT IF EXISTS subjects_type_check;
ALTER TABLE public.academic_years DROP CONSTRAINT IF EXISTS academic_years_status_check;
ALTER TABLE public.academic_years DROP CONSTRAINT IF EXISTS academic_years_dates_check;

ALTER TABLE public.exam_subjects  DROP CONSTRAINT IF EXISTS exam_subjects_subject_id_fkey;
ALTER TABLE public.exam_subjects
  ADD CONSTRAINT exam_subjects_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

ALTER TABLE public.class_subjects DROP CONSTRAINT IF EXISTS class_subjects_subject_id_fkey;
ALTER TABLE public.class_subjects
  ADD CONSTRAINT class_subjects_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

ALTER TABLE public.timetable DROP CONSTRAINT IF EXISTS timetable_teacher_id_fkey;
ALTER TABLE public.timetable
  ADD CONSTRAINT timetable_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- 5. Columns added by 07a
-- ---------------------------------------------------------------------
ALTER TABLE public.classes DROP COLUMN IF EXISTS class_code,
                           DROP COLUMN IF EXISTS display_order,
                           DROP COLUMN IF EXISTS stream,
                           DROP COLUMN IF EXISTS is_active,
                           DROP COLUMN IF EXISTS created_at,
                           DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.subjects DROP COLUMN IF EXISTS category,
                            DROP COLUMN IF EXISTS subject_type,
                            DROP COLUMN IF EXISTS is_active,
                            DROP COLUMN IF EXISTS created_at,
                            DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.class_sections DROP COLUMN IF EXISTS capacity,
                                  DROP COLUMN IF EXISTS room_no,
                                  DROP COLUMN IF EXISTS is_active;

ALTER TABLE public.class_subjects DROP COLUMN IF EXISTS class_id,
                                  DROP COLUMN IF EXISTS academic_year_id,
                                  DROP COLUMN IF EXISTS section_id,
                                  DROP COLUMN IF EXISTS is_mandatory,
                                  DROP COLUMN IF EXISTS is_active,
                                  DROP COLUMN IF EXISTS updated_at,
                                  DROP COLUMN IF EXISTS created_by;

ALTER TABLE public.timetable DROP COLUMN IF EXISTS class_id,
                             DROP COLUMN IF EXISTS section_id,
                             DROP COLUMN IF EXISTS period_number;

ALTER TABLE public.academic_years DROP COLUMN IF EXISTS status,
                                  DROP COLUMN IF EXISTS created_by;

COMMIT;
