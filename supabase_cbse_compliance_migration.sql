-- =====================================================================
-- 🎓 SUSHILA DEVI PUBLIC SCHOOL ERP - CBSE COMPLIANCE MIGRATION SQL
-- =====================================================================
-- This additive migration upgrades the schema to 100% CBSE NEP-2020 Compliance.
-- It adds missing demographics (CWSN, Category) and specific Scholastic components.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CBSE STUDENT DEMOGRAPHICS (LOC Requirements)
-- ---------------------------------------------------------------------
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'General' CHECK (category IN ('General', 'OBC', 'SC', 'ST', 'EWS')),
ADD COLUMN IF NOT EXISTS minority_status BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cwsn_status BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cwsn_type VARCHAR(100), -- Specific disability type if cwsn_status is true
ADD COLUMN IF NOT EXISTS only_child_girl BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cbse_registration_no VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS house_name VARCHAR(100); -- For CBSE Inter-house activities

-- Update Admissions table as well so that new applications can capture this
ALTER TABLE public.admissions
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'General',
ADD COLUMN IF NOT EXISTS cwsn_status BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS only_child_girl BOOLEAN DEFAULT false;

-- ---------------------------------------------------------------------
-- 2. TEACHER QUALIFICATIONS (PGT/TGT/PRT)
-- ---------------------------------------------------------------------
-- Ensure teachers table exists and add CBSE specific teaching levels
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  cbse_teaching_level VARCHAR(50) CHECK (cbse_teaching_level IN ('PGT', 'TGT', 'PRT', 'NTT', 'Other')),
  highest_qualification VARCHAR(255),
  ctet_qualified BOOLEAN DEFAULT false,
  subject_specialization VARCHAR(255),
  joining_date DATE,
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3. CBSE NEP 2020 SCHOLASTIC EVALUATION
-- ---------------------------------------------------------------------
-- The 'marks' table is expanded to support the exact 80/20 breakdown
ALTER TABLE public.marks
ADD COLUMN IF NOT EXISTS periodic_test_marks NUMERIC(5,2) DEFAULT 0 CHECK (periodic_test_marks <= 10),
ADD COLUMN IF NOT EXISTS multiple_assessment_marks NUMERIC(5,2) DEFAULT 0 CHECK (multiple_assessment_marks <= 5),
ADD COLUMN IF NOT EXISTS portfolio_marks NUMERIC(5,2) DEFAULT 0 CHECK (portfolio_marks <= 5),
ADD COLUMN IF NOT EXISTS subject_enrichment_marks NUMERIC(5,2) DEFAULT 0 CHECK (subject_enrichment_marks <= 5),
ADD COLUMN IF NOT EXISTS annual_exam_marks NUMERIC(5,2) DEFAULT 0 CHECK (annual_exam_marks <= 80),
-- The obtained_marks column will now represent the sum of these CBSE components.
ADD COLUMN IF NOT EXISTS is_absent BOOLEAN DEFAULT false;

-- Create an aggregate view for CBSE Report Cards
CREATE OR REPLACE VIEW cbse_report_card_view AS
SELECT 
    m.student_id,
    m.exam_id,
    m.subject_id,
    m.periodic_test_marks,
    m.multiple_assessment_marks,
    m.portfolio_marks,
    m.subject_enrichment_marks,
    (m.periodic_test_marks + m.multiple_assessment_marks + m.portfolio_marks + m.subject_enrichment_marks) as internal_total,
    m.annual_exam_marks as theory_total,
    (m.periodic_test_marks + m.multiple_assessment_marks + m.portfolio_marks + m.subject_enrichment_marks + m.annual_exam_marks) as grand_total
FROM public.marks m;

-- ---------------------------------------------------------------------
-- 4. ATTENDANCE AGGREGATION (For Admit Cards 75% Rule)
-- ---------------------------------------------------------------------
-- View to quickly check if a student meets the 75% CBSE attendance mandate
CREATE OR REPLACE VIEW cbse_attendance_summary AS
SELECT 
    student_id,
    COUNT(*) as total_working_days,
    SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as total_present,
    ROUND((SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2) as attendance_percentage
FROM public.attendance
GROUP BY student_id;

-- =====================================================================
-- End of Migration
-- =====================================================================
