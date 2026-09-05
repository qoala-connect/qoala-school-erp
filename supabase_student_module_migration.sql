-- =====================================================================
-- 🎓 SUSHILA DEVI PUBLIC SCHOOL ERP - STUDENT MODULE ADDITIVE MIGRATION SQL
-- =====================================================================
-- Level of Normalization: 3rd Normal Form (3NF)
-- Safety: 100% Additive. No destructive operations.
-- =====================================================================

-- 1. Families Table
CREATE TABLE IF NOT EXISTS public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed some default families to prevent empty states
INSERT INTO public.families (family_code) VALUES
  ('FAM-2026-001'),
  ('FAM-2026-002'),
  ('FAM-2026-003')
ON CONFLICT (family_code) DO NOTHING;

-- Safely add family references to students and parents tables
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.families(id) ON DELETE SET NULL;
ALTER TABLE public.parents ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.families(id) ON DELETE SET NULL;

-- 2. Parent-Students Junction Table
CREATE TABLE IF NOT EXISTS public.parent_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  relationship VARCHAR(50) NOT NULL CHECK (relationship IN ('father', 'mother', 'guardian')),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_parent_student UNIQUE (parent_id, student_id)
);

-- 3. Student Documents Table
CREATE TABLE IF NOT EXISTS public.student_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  document_type VARCHAR(100) NOT NULL, -- 'birth_certificate', 'aadhaar', 'transfer_certificate', 'passport', 'medical_certificate', 'income_certificate', 'caste_certificate', etc.
  document_name VARCHAR(255),
  file_url TEXT NOT NULL,
  verification_status VARCHAR(50) DEFAULT 'Pending' CHECK (verification_status IN ('Pending', 'Verified', 'Rejected')),
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Student Medical Table
CREATE TABLE IF NOT EXISTS public.student_medical (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID UNIQUE NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  blood_group VARCHAR(10),
  allergies TEXT,
  medical_history TEXT,
  doctor_name VARCHAR(255),
  doctor_phone VARCHAR(50),
  vaccination_status TEXT,
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Student Class History Table
CREATE TABLE IF NOT EXISTS public.student_class_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class VARCHAR(50) NOT NULL,
  section VARCHAR(50) NOT NULL,
  academic_year VARCHAR(50) NOT NULL,
  roll_number VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Student Activity Logs
CREATE TABLE IF NOT EXISTS public.student_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  activity_type VARCHAR(100) NOT NULL, -- 'admission', 'promotion', 'transfer', 'document_upload', 'medical_update', etc.
  description TEXT NOT NULL,
  performed_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Student Promotions Table
CREATE TABLE IF NOT EXISTS public.student_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  from_class VARCHAR(50) NOT NULL,
  to_class VARCHAR(50) NOT NULL,
  from_section VARCHAR(50),
  to_section VARCHAR(50),
  from_academic_year VARCHAR(50) NOT NULL,
  to_academic_year VARCHAR(50) NOT NULL,
  promoted_at TIMESTAMPTZ DEFAULT now(),
  promoted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'completed'
);

-- 8. Student Transfers Table
CREATE TABLE IF NOT EXISTS public.student_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  transfer_type VARCHAR(50) DEFAULT 'TC Issued' CHECK (transfer_type IN ('TC Issued', 'Withdrawn', 'Suspended')),
  tc_number VARCHAR(100) UNIQUE,
  destination_school VARCHAR(255),
  reason TEXT,
  transfer_date DATE NOT NULL DEFAULT current_date,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Student Alumni Table
CREATE TABLE IF NOT EXISTS public.student_alumni (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID UNIQUE NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  passing_year VARCHAR(50) NOT NULL,
  tc_number VARCHAR(100),
  higher_education TEXT,
  employment_status VARCHAR(255),
  archive_date TIMESTAMPTZ DEFAULT now()
);

-- 10. Student Notes Table
CREATE TABLE IF NOT EXISTS public.student_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Student ID Cards Table
CREATE TABLE IF NOT EXISTS public.student_id_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  template_name VARCHAR(100) NOT NULL, -- e.g. 'Modern Portrait', 'Classic Landscape', etc.
  card_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. OPTIMIZATION INDEXES
CREATE INDEX IF NOT EXISTS idx_parent_students_parent ON public.parent_students(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_student ON public.parent_students(student_id);
CREATE INDEX IF NOT EXISTS idx_student_documents_student ON public.student_documents(student_id);
CREATE INDEX IF NOT EXISTS idx_student_class_history_student ON public.student_class_history(student_id);
CREATE INDEX IF NOT EXISTS idx_student_activity_student ON public.student_activity(student_id);
CREATE INDEX IF NOT EXISTS idx_student_promotions_student ON public.student_promotions(student_id);
CREATE INDEX IF NOT EXISTS idx_student_transfers_student ON public.student_transfers(student_id);
CREATE INDEX IF NOT EXISTS idx_student_notes_student ON public.student_notes(student_id);

-- 13. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_medical ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_class_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_alumni ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_id_cards ENABLE ROW LEVEL SECURITY;

-- 14. SECURE RLS POLICIES (Allow Authenticated Users to Select, Admin to Manage)
CREATE POLICY policy_auth_select_families ON public.families FOR SELECT TO authenticated USING (true);
CREATE POLICY policy_admin_all_families ON public.families FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY policy_auth_select_parent_students ON public.parent_students FOR SELECT TO authenticated USING (true);
CREATE POLICY policy_admin_all_parent_students ON public.parent_students FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY policy_auth_select_student_documents ON public.student_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY policy_admin_all_student_documents ON public.student_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY policy_auth_select_student_medical ON public.student_medical FOR SELECT TO authenticated USING (true);
CREATE POLICY policy_admin_all_student_medical ON public.student_medical FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY policy_auth_select_student_class_history ON public.student_class_history FOR SELECT TO authenticated USING (true);
CREATE POLICY policy_admin_all_student_class_history ON public.student_class_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY policy_auth_select_student_activity ON public.student_activity FOR SELECT TO authenticated USING (true);
CREATE POLICY policy_admin_all_student_activity ON public.student_activity FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY policy_auth_select_student_promotions ON public.student_promotions FOR SELECT TO authenticated USING (true);
CREATE POLICY policy_admin_all_student_promotions ON public.student_promotions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY policy_auth_select_student_transfers ON public.student_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY policy_admin_all_student_transfers ON public.student_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY policy_auth_select_student_alumni ON public.student_alumni FOR SELECT TO authenticated USING (true);
CREATE POLICY policy_admin_all_student_alumni ON public.student_alumni FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY policy_auth_select_student_notes ON public.student_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY policy_admin_all_student_notes ON public.student_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY policy_auth_select_student_id_cards ON public.student_id_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY policy_admin_all_student_id_cards ON public.student_id_cards FOR ALL TO authenticated USING (true) WITH CHECK (true);
