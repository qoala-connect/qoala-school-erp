-- =====================================================================
-- ST. JOSEPH'S SCHOOL ERP — COMPREHENSIVE CBSE EXAMINATION MODULE MIGRATION
-- =====================================================================
-- Safety: 100% Additive & Idempotent. Preserves existing schema and data.
-- =====================================================================

BEGIN;

-- 1. Ensure `rooms` table has default exam rooms/halls
INSERT INTO public.rooms (room_number, room_type, capacity, is_active, status)
VALUES
  ('Room 101', 'Classroom', 30, true, 'Available'),
  ('Room 102', 'Classroom', 30, true, 'Available'),
  ('Room 103', 'Classroom', 30, true, 'Available'),
  ('Room 104', 'Classroom', 30, true, 'Available'),
  ('Room 105', 'Classroom', 35, true, 'Available'),
  ('Room 106', 'Classroom', 35, true, 'Available'),
  ('Hall A (Main Auditorium)', 'Auditorium', 60, true, 'Available'),
  ('Hall B (Senior Wing)', 'Exam Hall', 45, true, 'Available'),
  ('Science Lab 1', 'Laboratory', 30, true, 'Available'),
  ('Computer Lab', 'Laboratory', 30, true, 'Available')
ON CONFLICT DO NOTHING;

-- 2. Create `seating_plans` table if not exists
CREATE TABLE IF NOT EXISTS public.seating_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid REFERENCES public.exams(id) ON DELETE CASCADE,
  exam_subject_id uuid REFERENCES public.exam_subjects(id) ON DELETE SET NULL,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  room_name text NOT NULL,
  exam_date date,
  start_time text,
  rows_count integer NOT NULL DEFAULT 6,
  cols_count integer NOT NULL DEFAULT 6,
  total_capacity integer NOT NULL DEFAULT 36,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Create `seating_assignments` table if not exists
CREATE TABLE IF NOT EXISTS public.seating_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seating_plan_id uuid NOT NULL REFERENCES public.seating_plans(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  seat_number text NOT NULL,
  row_num integer NOT NULL,
  col_num integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_plan_seat UNIQUE (seating_plan_id, seat_number),
  CONSTRAINT uq_plan_student UNIQUE (seating_plan_id, student_id)
);

-- 4. Create `invigilation_assignments` table if not exists
CREATE TABLE IF NOT EXISTS public.invigilation_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  exam_subject_id uuid REFERENCES public.exam_subjects(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  room_name text,
  exam_date date,
  start_time text,
  end_time text,
  reporting_time text,
  duty_type text DEFAULT 'Chief Invigilator',
  status text DEFAULT 'assigned',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Add indexes for high-speed lookups
CREATE INDEX IF NOT EXISTS idx_seating_plans_exam ON public.seating_plans(exam_id);
CREATE INDEX IF NOT EXISTS idx_seating_assignments_plan ON public.seating_assignments(seating_plan_id);
CREATE INDEX IF NOT EXISTS idx_seating_assignments_student ON public.seating_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_invigilation_exam ON public.invigilation_assignments(exam_id);
CREATE INDEX IF NOT EXISTS idx_invigilation_teacher ON public.invigilation_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_invigilation_date ON public.invigilation_assignments(exam_date);

-- 6. Enable RLS and establish security policies
ALTER TABLE public.seating_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invigilation_assignments ENABLE ROW LEVEL SECURITY;

-- Seating plans policies
DROP POLICY IF EXISTS "seating_plans_select" ON public.seating_plans;
CREATE POLICY "seating_plans_select" ON public.seating_plans
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "seating_plans_admin_manage" ON public.seating_plans;
CREATE POLICY "seating_plans_admin_manage" ON public.seating_plans
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('results.publish') OR public.auth_has_permission('results.view'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('results.publish'));

-- Seating assignments policies
DROP POLICY IF EXISTS "seating_assignments_select" ON public.seating_assignments;
CREATE POLICY "seating_assignments_select" ON public.seating_assignments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "seating_assignments_admin_manage" ON public.seating_assignments;
CREATE POLICY "seating_assignments_admin_manage" ON public.seating_assignments
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('results.publish') OR public.auth_has_permission('results.view'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('results.publish'));

-- Invigilation policies
DROP POLICY IF EXISTS "invigilation_select" ON public.invigilation_assignments;
CREATE POLICY "invigilation_select" ON public.invigilation_assignments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "invigilation_admin_manage" ON public.invigilation_assignments;
CREATE POLICY "invigilation_admin_manage" ON public.invigilation_assignments
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('results.publish') OR public.auth_has_permission('results.view'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('results.publish'));

COMMIT;
