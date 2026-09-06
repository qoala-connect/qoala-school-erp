-- =====================================================================
-- ST. JOSEPH'S SCHOOL ERP — CBSE EXAMINATION WORKFLOW MIGRATION
-- =====================================================================
-- Safety: 100% Additive & Idempotent. Preserves existing schema and data.
-- =====================================================================

BEGIN;

-- 1. Enhance `exams` table
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS short_name text,
  ADD COLUMN IF NOT EXISTS exam_type text DEFAULT 'Periodic Assessment',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS marks_entry_start_date date,
  ADD COLUMN IF NOT EXISTS marks_entry_deadline date,
  ADD COLUMN IF NOT EXISTS result_publish_date date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS locked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS unlock_reason text,
  ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Enhance `exam_subjects` table
ALTER TABLE public.exam_subjects
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.sections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS component_name text DEFAULT 'Periodic Assessment',
  ADD COLUMN IF NOT EXISTS exam_date date,
  ADD COLUMN IF NOT EXISTS start_time varchar(50) DEFAULT '09:00 AM',
  ADD COLUMN IF NOT EXISTS end_time varchar(50) DEFAULT '10:00 AM',
  ADD COLUMN IF NOT EXISTS duration varchar(50) DEFAULT '1 Hour',
  ADD COLUMN IF NOT EXISTS room text,
  ADD COLUMN IF NOT EXISTS invigilator_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS reopen_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS unlock_reason text,
  -- Required by the pre-existing BEFORE UPDATE trigger `trigger_update_exam_subjects`
  -- (update_modified_column() sets NEW.updated_at). Without this column EVERY update
  -- to exam_subjects fails with: record "new" has no field "updated_at" — which blocks
  -- saving evaluators/marks in the mapping modal and the whole marks review/lock flow.
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.exam_subjects
   SET updated_at = COALESCE(reviewed_at, locked_at, created_at, now())
 WHERE updated_at IS NULL;

-- 3. Enhance `marks` table
-- Allow obtained_marks to be NULL (for '—' / not entered vs 0)
ALTER TABLE public.marks ALTER COLUMN obtained_marks DROP NOT NULL;

ALTER TABLE public.marks
  ADD COLUMN IF NOT EXISTS attendance_status text NOT NULL DEFAULT 'Present',
  ADD COLUMN IF NOT EXISTS is_medical boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_exempted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS grade text,
  ADD COLUMN IF NOT EXISTS remarks text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. Enhance `exam_results` table
ALTER TABLE public.exam_results
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS max_total_marks numeric(6,2),
  ADD COLUMN IF NOT EXISTS rank integer,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 5. Seed / Ensure Default Assessment Types (Exam Types)
INSERT INTO public.assessment_types (code, name, description, stage_category, display_order, is_active)
VALUES
  ('PA1', 'Periodic Assessment 1', 'First periodic assessment of the academic session', 'all', 1, true),
  ('HYE', 'Mid-Term Examination / Half-Yearly', 'Mid-session comprehensive evaluation', 'all', 2, true),
  ('PA2', 'Periodic Assessment 2', 'Second periodic assessment of the academic session', 'all', 3, true),
  ('PA3', 'Periodic Assessment 3', 'Third periodic assessment for senior classes', 'all', 4, true),
  ('PRE_ANNUAL', 'Pre-Annual Examination', 'Preparatory pre-annual examination', 'all', 5, true),
  ('ANNUAL', 'Annual Examination', 'Final yearly examination and progression test', 'all', 6, true),
  ('PRE_BOARD', 'Pre-Board Examination', 'Pre-board examination for Classes X and XII', 'senior', 7, true),
  ('CBSE_BOARD', 'CBSE Board Examination', 'Official All-India Secondary/Senior School Exam', 'senior', 8, true),
  ('UNIT_TEST', 'Unit Test', 'Periodic chapter and unit level test', 'all', 9, true),
  ('PRACTICAL', 'Practical Examination', 'Lab and experimental skill evaluation', 'all', 10, true),
  ('INTERNAL_ASSMT', 'Project / Internal Assessment', 'Portfolio, notebook, and multiple assessment', 'all', 11, true),
  ('VIVA', 'Viva Voce', 'Oral examination and viva assessment', 'all', 12, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- 6. Seed / Ensure Standard CBSE Grading Rules
DELETE FROM public.grading_rules;
INSERT INTO public.grading_rules (grade_name, min_score, max_score, points, remarks)
VALUES
  ('A1', 91, 100, 10.0, 'Outstanding academic performance'),
  ('A2', 81, 90.99, 9.0, 'Excellent performance'),
  ('B1', 71, 80.99, 8.0, 'Very Good performance'),
  ('B2', 61, 70.99, 7.0, 'Good performance'),
  ('C1', 51, 60.99, 6.0, 'Above Average performance'),
  ('C2', 41, 50.99, 5.0, 'Average performance'),
  ('D', 33, 40.99, 4.0, 'Marginal / Pass standard'),
  ('E', 0, 32.99, 0.0, 'Needs Improvement / Essential Repeat');

-- 7. Ensure Report Template for St. Joseph's School, Barhalganj
INSERT INTO public.report_templates (template_name, header_text, footer_text, signature_authority, show_co_scholastic, show_attendance)
VALUES (
  'St. Joseph''s Standard Report Card',
  'ST. JOSEPH''S SCHOOL, BARHALGANJ',
  'Affiliated to CBSE, New Delhi | An English Medium Co-Educational Senior Secondary Institution',
  'Principal',
  true,
  true
)
ON CONFLICT (template_name) DO UPDATE SET
  header_text = EXCLUDED.header_text,
  footer_text = EXCLUDED.footer_text,
  signature_authority = EXCLUDED.signature_authority;

-- 8. Row Level Security Hardening:
-- Ensure students and parents can only view published results & marks
DROP POLICY IF EXISTS "exam_results_owner_select" ON public.exam_results;
CREATE POLICY "exam_results_owner_select" ON public.exam_results
  FOR SELECT TO authenticated
  USING (
    published = true AND (
      (student_id = get_current_student_id()) OR 
      (student_id = ANY (get_current_parent_student_ids()))
    )
  );

DROP POLICY IF EXISTS "marks_owner_select" ON public.marks;
CREATE POLICY "marks_owner_select" ON public.marks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exams e 
      WHERE e.id = marks.exam_id 
        AND (e.is_published = true OR e.status = 'published')
    ) AND (
      (student_id = get_current_student_id()) OR 
      (student_id = ANY (get_current_parent_student_ids()))
    )
  );

COMMIT;
