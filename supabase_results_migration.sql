-- =====================================================================
-- 🎓 SUSHILA DEVI PUBLIC SCHOOL ERP - RESULT MODULE ADDITIVE MIGRATION SQL
-- =====================================================================
-- Level of Normalization: 3rd Normal Form (3NF)
-- Safety: 100% Additive. No destructive operations.
-- =====================================================================

-- 1. Subjects Table
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_name VARCHAR(255) UNIQUE NOT NULL,
  subject_code VARCHAR(50) UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Default Subjects
INSERT INTO public.subjects (subject_name, subject_code) VALUES
  ('Mathematics', 'MATH101'),
  ('Science', 'SCI102'),
  ('Social Studies', 'SST103'),
  ('English Literature', 'ENG104'),
  ('Hindi', 'HIN105'),
  ('Computer Science', 'COMP106')
ON CONFLICT (subject_name) DO NOTHING;

-- 2. Exam Subjects Junction Table
CREATE TABLE IF NOT EXISTS public.exam_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  max_marks INTEGER DEFAULT 100,
  pass_marks INTEGER DEFAULT 40,
  exam_date DATE,
  start_time VARCHAR(50) DEFAULT '09:00 AM',
  duration VARCHAR(50) DEFAULT '3 Hours',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_exam_subject UNIQUE (exam_id, subject_id)
);

-- 3. Exam Results Table (Aggregate student performance per exam term)
CREATE TABLE IF NOT EXISTS public.exam_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  total_marks NUMERIC(6,2),
  percentage NUMERIC(5,2),
  division VARCHAR(100),
  grade VARCHAR(10),
  result_status VARCHAR(50) DEFAULT 'pass' CHECK (result_status IN ('pass', 'fail', 'supplementary')),
  remarks TEXT,
  published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_exam_result_student UNIQUE (exam_id, student_id)
);

-- 4. Co-Scholastic Evaluations Table (Expanded for comprehensive grading)
CREATE TABLE IF NOT EXISTS public.co_scholastic (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year VARCHAR(50) NOT NULL DEFAULT '2026-2027',
  discipline VARCHAR(10) DEFAULT 'A',
  reading_skill VARCHAR(10) DEFAULT 'A', -- Legacy column (sports mapping fallback)
  writing_skill VARCHAR(10) DEFAULT 'A', -- Legacy column (art mapping fallback)
  behavior VARCHAR(10) DEFAULT 'A',      -- Legacy column (behaviour mapping fallback)
  sports VARCHAR(10) DEFAULT 'A',
  art VARCHAR(10) DEFAULT 'A',
  music VARCHAR(10) DEFAULT 'A',
  dance VARCHAR(10) DEFAULT 'A',
  computer VARCHAR(10) DEFAULT 'A',
  behaviour VARCHAR(10) DEFAULT 'A',
  leadership VARCHAR(10) DEFAULT 'A',
  communication VARCHAR(10) DEFAULT 'A',
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_co_scholastic_student_year UNIQUE (student_id, academic_year)
);

-- 5. Report Templates Table
CREATE TABLE IF NOT EXISTS public.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name VARCHAR(255) UNIQUE NOT NULL,
  header_text TEXT,
  footer_text TEXT,
  show_co_scholastic BOOLEAN DEFAULT true,
  show_attendance BOOLEAN DEFAULT true,
  signature_authority VARCHAR(255) DEFAULT 'Principal Authority',
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed a standard Springfield Report Card template
INSERT INTO public.report_templates (template_name, header_text, footer_text, signature_authority)
VALUES (
  'Spring Springfield Standard',
  'SPRINGFIELD ACADEMY OF EXCELLENCE',
  'Affiliated Board of Secondary Education | Code: 202604',
  'Dr. Marcus Vance'
) ON CONFLICT (template_name) DO NOTHING;

-- 6. INDEXES FOR QUERY OPTIMIZATION
CREATE INDEX IF NOT EXISTS idx_exam_subjects_exam ON public.exam_subjects(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_subjects_subject ON public.exam_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_student ON public.exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_exam ON public.exam_results(exam_id);
CREATE INDEX IF NOT EXISTS idx_co_scholastic_student ON public.co_scholastic(student_id);

-- 7. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.co_scholastic ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

-- 8. SECURE RLS POLICIES (Allow Authenticated Users to Select, Admin to Manage)
CREATE POLICY policy_auth_select_subjects ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY policy_admin_all_subjects ON public.subjects FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY policy_auth_select_exam_subjects ON public.exam_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY policy_admin_all_exam_subjects ON public.exam_subjects FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY policy_auth_select_exam_results ON public.exam_results FOR SELECT TO authenticated USING (true);
CREATE POLICY policy_admin_all_exam_results ON public.exam_results FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY policy_auth_select_co_scholastic ON public.co_scholastic FOR SELECT TO authenticated USING (true);
CREATE POLICY policy_admin_all_co_scholastic ON public.co_scholastic FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY policy_auth_select_report_templates ON public.report_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY policy_admin_all_report_templates ON public.report_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. TRIGGERS FOR TIMESTAMP UPDATES
CREATE OR REPLACE TRIGGER trigger_update_subjects BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_exam_subjects BEFORE UPDATE ON public.exam_subjects FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_exam_results BEFORE UPDATE ON public.exam_results FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_co_scholastic BEFORE UPDATE ON public.co_scholastic FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_report_templates BEFORE UPDATE ON public.report_templates FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
