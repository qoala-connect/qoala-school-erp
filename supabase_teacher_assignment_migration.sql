-- =====================================================================
-- ENTERPRISE TEACHER MANAGEMENT & ACADEMIC ASSIGNMENT MIGRATION
-- Canonical Teacher Source of Truth + Academic Assignments + Cross-Module Alignment
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. DEPARTMENTS SEEDING
-- ---------------------------------------------------------------------
INSERT INTO public.departments (id, department_name, code, is_active, created_at, updated_at)
VALUES 
    (gen_random_uuid(), 'Mathematics', 'MATH', true, now(), now()),
    (gen_random_uuid(), 'Science & Technology', 'SCI', true, now(), now()),
    (gen_random_uuid(), 'Languages & Literature', 'LANG', true, now(), now()),
    (gen_random_uuid(), 'Social Sciences & Humanities', 'SST', true, now(), now()),
    (gen_random_uuid(), 'Computer Science & ICT', 'ICT', true, now(), now()),
    (gen_random_uuid(), 'Primary Wing', 'PRM', true, now(), now())
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. EXPAND AND UPGRADE TEACHERS TABLE
-- ---------------------------------------------------------------------
ALTER TABLE public.teachers
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS employee_id TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS photo_url TEXT,
    ADD COLUMN IF NOT EXISTS gender TEXT,
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS joining_date DATE,
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active',
    ADD COLUMN IF NOT EXISTS designation TEXT DEFAULT 'Teacher',
    ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'Teaching Faculty',
    ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS highest_qualification TEXT,
    ADD COLUMN IF NOT EXISTS experience_years INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50) DEFAULT 'Full-Time',
    ADD COLUMN IF NOT EXISTS cbse_teaching_level VARCHAR(20) DEFAULT 'TGT',
    ADD COLUMN IF NOT EXISTS ctet_qualified BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
    ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
    ADD COLUMN IF NOT EXISTS blood_group TEXT,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Unique constraint on employee_id if not null
CREATE UNIQUE INDEX IF NOT EXISTS uq_teachers_employee_id ON public.teachers(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teachers_user_id ON public.teachers(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teachers_status ON public.teachers(status, is_active);

-- ---------------------------------------------------------------------
-- 3. CONSOLIDATE TEACHERS FROM STAFF AND SET CANONICAL DATA
-- ---------------------------------------------------------------------

-- Update Alok Kumar with staff details and link to teacher auth account
UPDATE public.teachers
SET 
    employee_id = 'EMP-0004',
    email = 'alok.kumar@rajsdps.com',
    user_id = 'f504736a-e2a7-4a45-a0f6-fa0cfe090b33', -- Link to test teacher account
    designation = 'Senior PGT Mathematics',
    department = 'Mathematics',
    highest_qualification = 'M.Sc., B.Ed.',
    experience_years = 12,
    joining_date = '2020-07-01',
    status = 'Active',
    is_active = true,
    cbse_teaching_level = 'PGT',
    ctet_qualified = true,
    employment_type = 'Full-Time',
    gender = 'Male'
WHERE id = '3bf0b2f0-b2b6-4302-bb9e-b2fe0d36ffa0';

-- Update Suraj Kumar
UPDATE public.teachers
SET 
    employee_id = 'EMP-0008',
    email = 'suraj.kumar@rajsdps.com',
    designation = 'TGT Science',
    department = 'Science & Technology',
    highest_qualification = 'M.Sc. Physics, B.Ed.',
    experience_years = 8,
    joining_date = '2022-04-15',
    status = 'Active',
    is_active = true,
    cbse_teaching_level = 'TGT',
    ctet_qualified = true,
    employment_type = 'Full-Time',
    gender = 'Male'
WHERE id = '4c7a9679-4812-465c-aae4-d3ae76bb6e54';

-- Update Anjali Singh
UPDATE public.teachers
SET 
    employee_id = 'EMP-0006',
    email = 'anjali.singh@rajsdps.com',
    designation = 'TGT English',
    department = 'Languages & Literature',
    highest_qualification = 'M.A. English, B.Ed.',
    experience_years = 6,
    joining_date = '2023-01-10',
    status = 'Active',
    is_active = true,
    cbse_teaching_level = 'TGT',
    ctet_qualified = true,
    employment_type = 'Full-Time',
    gender = 'Female'
WHERE id = 'c031979a-fd21-4af9-9104-ad39707b4050';

-- Consolidate 'satyam' from staff table into teachers table
INSERT INTO public.teachers (
    id, name, phone, qualification, subject_id, employee_id, email, 
    designation, department, highest_qualification, experience_years, 
    joining_date, status, is_active, cbse_teaching_level, ctet_qualified, employment_type, gender, created_at
)
VALUES (
    '6039c098-e25f-449c-81a1-81de745d5a5b',
    'Satyam Sharma',
    '+91 98765 43210',
    'B.Tech CS, MCA',
    (SELECT id FROM public.subjects WHERE subject_name = 'Computer Science' LIMIT 1),
    'EMP-0001',
    'satyam@gmail.com',
    'PGT Computer Science',
    'Computer Science & ICT',
    'MCA, B.Tech',
    5,
    '2024-03-01',
    'Active',
    true,
    'PGT',
    false,
    'Full-Time',
    'Male',
    now()
)
ON CONFLICT (id) DO UPDATE SET
    employee_id = EXCLUDED.employee_id,
    email = EXCLUDED.email,
    designation = EXCLUDED.designation,
    department = EXCLUDED.department,
    status = EXCLUDED.status,
    is_active = EXCLUDED.is_active;

-- ---------------------------------------------------------------------
-- 4. CREATE CANONICAL TEACHER ASSIGNMENTS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teacher_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    assignment_type VARCHAR(50) NOT NULL DEFAULT 'subject_teacher' 
        CHECK (assignment_type IN ('subject_teacher', 'class_teacher', 'both', 'assistant_teacher', 'examiner')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Unique index to prevent duplicate subject assignments for a teacher in same class/section/year
CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_assignment_subject 
    ON public.teacher_assignments(teacher_id, academic_year_id, class_id, section_id, subject_id, assignment_type);

-- Partial unique index: A class-section can only have ONE active class teacher per academic year!
CREATE UNIQUE INDEX IF NOT EXISTS uq_single_active_class_teacher 
    ON public.teacher_assignments(academic_year_id, class_id, section_id) 
    WHERE assignment_type IN ('class_teacher', 'both') AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_lookup 
    ON public.teacher_assignments(academic_year_id, class_id, section_id);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher 
    ON public.teacher_assignments(teacher_id, is_active);

-- ---------------------------------------------------------------------
-- 5. TRIGGER FOR SYNCING CLASS_SECTIONS CLASS TEACHER
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_class_section_teacher()
RETURNS TRIGGER AS $$
DECLARE
    curr_yr_id UUID;
BEGIN
    -- Check if assignment is for current academic year
    SELECT id INTO curr_yr_id FROM public.academic_years WHERE is_current = true LIMIT 1;

    IF (NEW.assignment_type IN ('class_teacher', 'both') AND NEW.is_active = true) THEN
        IF (NEW.academic_year_id = curr_yr_id) THEN
            UPDATE public.class_sections
            SET class_teacher_id = NEW.teacher_id, updated_at = now()
            WHERE class_id = NEW.class_id AND section_id = NEW.section_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_class_section_teacher ON public.teacher_assignments;
CREATE TRIGGER trg_sync_class_section_teacher
    AFTER INSERT OR UPDATE ON public.teacher_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_class_section_teacher();

-- ---------------------------------------------------------------------
-- 6. SEED AUTHENTIC TEACHER ASSIGNMENTS (2026-27)
-- ---------------------------------------------------------------------
DO $$
DECLARE
    yr_id UUID := '22222222-2222-2222-2222-222222222222'; -- 2026-27
    cls_10 UUID;
    cls_9 UUID;
    cls_8 UUID;
    sec_a UUID;
    sec_b UUID;
    sub_math UUID;
    sub_sci UUID;
    sub_eng UUID;
    sub_cs UUID;
    sub_sst UUID;
    t_alok UUID := '3bf0b2f0-b2b6-4302-bb9e-b2fe0d36ffa0';
    t_suraj UUID := '4c7a9679-4812-465c-aae4-d3ae76bb6e54';
    t_anjali UUID := 'c031979a-fd21-4af9-9104-ad39707b4050';
    t_satyam UUID := '6039c098-e25f-449c-81a1-81de745d5a5b';
BEGIN
    SELECT id INTO cls_10 FROM public.classes WHERE class_name = '10' LIMIT 1;
    SELECT id INTO cls_9 FROM public.classes WHERE class_name = '9' LIMIT 1;
    SELECT id INTO cls_8 FROM public.classes WHERE class_name = '8' LIMIT 1;
    
    SELECT id INTO sec_a FROM public.sections WHERE section_name = 'A' LIMIT 1;
    SELECT id INTO sec_b FROM public.sections WHERE section_name = 'B' LIMIT 1;

    SELECT id INTO sub_math FROM public.subjects WHERE subject_name = 'Mathematics' LIMIT 1;
    SELECT id INTO sub_sci FROM public.subjects WHERE subject_name = 'Science' LIMIT 1;
    SELECT id INTO sub_eng FROM public.subjects WHERE subject_name = 'English' LIMIT 1;
    SELECT id INTO sub_cs FROM public.subjects WHERE subject_name = 'Computer Science' LIMIT 1;
    SELECT id INTO sub_sst FROM public.subjects WHERE subject_name = 'Social Science' LIMIT 1;

    -- Alok Kumar: Class Teacher 10-A, Math Teacher 10-A & 9-A
    INSERT INTO public.teacher_assignments (teacher_id, academic_year_id, class_id, section_id, subject_id, assignment_type)
    VALUES 
        (t_alok, yr_id, cls_10, sec_a, sub_math, 'both'),
        (t_alok, yr_id, cls_9, sec_a, sub_math, 'subject_teacher')
    ON CONFLICT DO NOTHING;

    -- Suraj Kumar: Class Teacher 9-B, Science Teacher 10-A & 9-B
    INSERT INTO public.teacher_assignments (teacher_id, academic_year_id, class_id, section_id, subject_id, assignment_type)
    VALUES 
        (t_suraj, yr_id, cls_9, sec_b, sub_sci, 'both'),
        (t_suraj, yr_id, cls_10, sec_a, sub_sci, 'subject_teacher')
    ON CONFLICT DO NOTHING;

    -- Anjali Singh: Class Teacher 8-A, English Teacher 10-A & 8-A
    INSERT INTO public.teacher_assignments (teacher_id, academic_year_id, class_id, section_id, subject_id, assignment_type)
    VALUES 
        (t_anjali, yr_id, cls_8, sec_a, sub_eng, 'both'),
        (t_anjali, yr_id, cls_10, sec_a, sub_eng, 'subject_teacher')
    ON CONFLICT DO NOTHING;

    -- Satyam Sharma: Computer Science Teacher 10-A & 9-A
    IF (sub_cs IS NOT NULL) THEN
        INSERT INTO public.teacher_assignments (teacher_id, academic_year_id, class_id, section_id, subject_id, assignment_type)
        VALUES 
            (t_satyam, yr_id, cls_10, sec_a, sub_cs, 'subject_teacher'),
            (t_satyam, yr_id, cls_9, sec_a, sub_cs, 'subject_teacher')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Sync class_sections class teachers for current active year
    UPDATE public.class_sections SET class_teacher_id = t_alok WHERE class_id = cls_10 AND section_id = sec_a;
    UPDATE public.class_sections SET class_teacher_id = t_suraj WHERE class_id = cls_9 AND section_id = sec_b;
    UPDATE public.class_sections SET class_teacher_id = t_anjali WHERE class_id = cls_8 AND section_id = sec_a;

END $$;

-- ---------------------------------------------------------------------
-- 7. TIMETABLE INTEGRATION
-- ---------------------------------------------------------------------
-- Ensure timetable teacher_id references teachers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'timetable_teacher_id_fkey' AND table_name = 'timetable'
    ) THEN
        ALTER TABLE public.timetable
            ADD CONSTRAINT timetable_teacher_id_fkey 
            FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Seed some timetable teacher assignments for Class 10
UPDATE public.timetable
SET teacher_id = '3bf0b2f0-b2b6-4302-bb9e-b2fe0d36ffa0' -- Alok Kumar (Math)
WHERE class = '10' AND subject_id = (SELECT id FROM public.subjects WHERE subject_name = 'Mathematics' LIMIT 1);

UPDATE public.timetable
SET teacher_id = '4c7a9679-4812-465c-aae4-d3ae76bb6e54' -- Suraj Kumar (Science)
WHERE class = '10' AND subject_id = (SELECT id FROM public.subjects WHERE subject_name = 'Science' LIMIT 1);

-- ---------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------------------
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

-- Teachers RLS
DROP POLICY IF EXISTS teachers_admin_write ON public.teachers;
DROP POLICY IF EXISTS teachers_staff_select ON public.teachers;
DROP POLICY IF EXISTS teachers_self_select ON public.teachers;
DROP POLICY IF EXISTS teachers_read_all ON public.teachers;
DROP POLICY IF EXISTS teachers_admin_all ON public.teachers;
DROP POLICY IF EXISTS teachers_self_update ON public.teachers;

CREATE POLICY teachers_read_all ON public.teachers
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY teachers_admin_all ON public.teachers
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY teachers_self_update ON public.teachers
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR id = auth.uid())
    WITH CHECK (user_id = auth.uid() OR id = auth.uid());

-- Teacher Assignments RLS
DROP POLICY IF EXISTS teacher_assignments_read_all ON public.teacher_assignments;
DROP POLICY IF EXISTS teacher_assignments_admin_all ON public.teacher_assignments;

CREATE POLICY teacher_assignments_read_all ON public.teacher_assignments
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY teacher_assignments_admin_all ON public.teacher_assignments
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

COMMIT;
