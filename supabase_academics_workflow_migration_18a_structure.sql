-- =====================================================================
-- MIGRATION 18a — ACADEMICS TEACHING & LEARNING WORKFLOW: STRUCTURE
-- Additive schema + backfill. No column is dropped, renamed or retyped.
-- =====================================================================
--
-- WHAT THIS ADDS
--
--   The Academics module already owns the academic STRUCTURE (years,
--   classes, sections, subjects, the class-subject offering and the
--   timetable). It has no model for the DAILY TEACHING that hangs off
--   that structure. This migration adds it:
--
--     syllabus_units / syllabus_chapters / syllabus_topics
--                       the curriculum an admin configures per class and
--                       subject for a year. Ordered by an explicit
--                       sequence, never hard-coded in the frontend.
--
--     syllabus_progress a teacher's record of how far a section has got
--                       through each chapter (not_started / in_progress /
--                       completed), with optional dates and notes.
--
--   and extends three thin tables that already exist:
--
--     lesson_plans      gains section, year, an optional link to the
--                       syllabus chapter, duration, method, resources,
--                       the homework given, and post-class notes.
--
--     assignments       gains a kind ('homework' vs the heavier
--                       'assignment'), an assigned date, a publish
--                       status, the academic year, and uuid class /
--                       section columns beside the legacy text ones. A
--                       trigger keeps the two in step so nothing reading
--                       the text columns breaks.
--
--     student_assignment_submissions  gains reviewed_at / reviewed_by so
--                       "the teacher has looked at this" is a fact, not a
--                       guess from whether marks are null.
--
--   timetable gains room_no (the UI falls back to class_sections.room_no
--   when a slot does not override it).
--
-- PERMISSIONS
--   academics.teach   new. Held by the roles that run a classroom:
--                     teacher, class_teacher, vice_principal, principal,
--                     admin. Gates every teacher-workspace write.
--   academics.view    new. Held by every role including student and
--                     parent. Two routes in App.tsx already reference it;
--                     it did not exist, so those routes were only
--                     reachable by super_admin's '*'.
--   academics.manage  unchanged (admin, principal; super_admin via '*').
--
-- RLS for the new and changed tables is in 18b. Read-model functions are
-- in 18c.
--
-- ROLLBACK: supabase_academics_workflow_migration_18_rollback.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. syllabus_units — the curriculum's top level
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.syllabus_units (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id  uuid NOT NULL REFERENCES public.academic_years (id) ON DELETE CASCADE,
  class_id          uuid NOT NULL REFERENCES public.classes (id)        ON DELETE CASCADE,
  subject_id        uuid NOT NULL REFERENCES public.subjects (id)       ON DELETE CASCADE,
  title             text NOT NULL,
  sequence          integer NOT NULL DEFAULT 1,
  description       text,
  created_by        uuid DEFAULT auth.uid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT syllabus_units_seq_positive CHECK (sequence >= 1),
  CONSTRAINT syllabus_units_unique_seq
    UNIQUE (academic_year_id, class_id, subject_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_syllabus_units_year    ON public.syllabus_units (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_units_class   ON public.syllabus_units (class_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_units_subject ON public.syllabus_units (subject_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_units_scope
  ON public.syllabus_units (academic_year_id, class_id, subject_id, sequence);

DROP TRIGGER IF EXISTS trg_syllabus_units_updated_at ON public.syllabus_units;
CREATE TRIGGER trg_syllabus_units_updated_at BEFORE UPDATE ON public.syllabus_units
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

COMMENT ON TABLE public.syllabus_units IS
  'Curriculum unit for a class + subject in a year, owned by Academics. Configured by an admin (academics.manage). Ordered by sequence.';

-- ---------------------------------------------------------------------
-- 2. syllabus_chapters
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.syllabus_chapters (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id        uuid NOT NULL REFERENCES public.syllabus_units (id) ON DELETE CASCADE,
  title          text NOT NULL,
  sequence       integer NOT NULL DEFAULT 1,
  description    text,
  expected_hours numeric(5,1),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT syllabus_chapters_seq_positive CHECK (sequence >= 1),
  CONSTRAINT syllabus_chapters_unique_seq UNIQUE (unit_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_syllabus_chapters_unit ON public.syllabus_chapters (unit_id, sequence);

DROP TRIGGER IF EXISTS trg_syllabus_chapters_updated_at ON public.syllabus_chapters;
CREATE TRIGGER trg_syllabus_chapters_updated_at BEFORE UPDATE ON public.syllabus_chapters
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

COMMENT ON TABLE public.syllabus_chapters IS
  'Chapter within a syllabus unit. Deleting the unit deletes its chapters.';

-- ---------------------------------------------------------------------
-- 3. syllabus_topics
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.syllabus_topics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id  uuid NOT NULL REFERENCES public.syllabus_chapters (id) ON DELETE CASCADE,
  title       text NOT NULL,
  sequence    integer NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT syllabus_topics_seq_positive CHECK (sequence >= 1),
  CONSTRAINT syllabus_topics_unique_seq UNIQUE (chapter_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_syllabus_topics_chapter ON public.syllabus_topics (chapter_id, sequence);

DROP TRIGGER IF EXISTS trg_syllabus_topics_updated_at ON public.syllabus_topics;
CREATE TRIGGER trg_syllabus_topics_updated_at BEFORE UPDATE ON public.syllabus_topics
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

COMMENT ON TABLE public.syllabus_topics IS
  'Topic within a syllabus chapter. Deleting the chapter deletes its topics.';

-- ---------------------------------------------------------------------
-- 4. syllabus_progress — one row per chapter per section
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.syllabus_progress (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id    uuid NOT NULL REFERENCES public.syllabus_chapters (id) ON DELETE CASCADE,
  section_id    uuid NOT NULL REFERENCES public.sections (id)          ON DELETE CASCADE,
  teacher_id    uuid REFERENCES public.teachers (id)                   ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'not_started'
                CHECK (status IN ('not_started', 'in_progress', 'completed')),
  started_on    date,
  completed_on  date,
  notes         text,
  updated_by    uuid DEFAULT auth.uid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT syllabus_progress_unique UNIQUE (chapter_id, section_id)
);

CREATE INDEX IF NOT EXISTS idx_syllabus_progress_chapter ON public.syllabus_progress (chapter_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_progress_section ON public.syllabus_progress (section_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_progress_teacher ON public.syllabus_progress (teacher_id);

DROP TRIGGER IF EXISTS trg_syllabus_progress_updated_at ON public.syllabus_progress;
CREATE TRIGGER trg_syllabus_progress_updated_at BEFORE UPDATE ON public.syllabus_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

COMMENT ON TABLE public.syllabus_progress IS
  'How far a section has got through a syllabus chapter. Written by the subject teacher (academics.teach) or an admin (academics.manage).';

-- ---------------------------------------------------------------------
-- 5. timetable — room per slot
-- ---------------------------------------------------------------------
ALTER TABLE public.timetable
  ADD COLUMN IF NOT EXISTS room_no text;

COMMENT ON COLUMN public.timetable.room_no IS
  'Room for this slot. When null the UI falls back to class_sections.room_no.';

-- ---------------------------------------------------------------------
-- 6. lesson_plans — the fields a real plan needs
-- ---------------------------------------------------------------------
ALTER TABLE public.lesson_plans
  ADD COLUMN IF NOT EXISTS section_id        uuid REFERENCES public.sections (id)          ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS academic_year_id  uuid REFERENCES public.academic_years (id)    ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chapter_id        uuid REFERENCES public.syllabus_chapters (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duration_minutes  integer DEFAULT 40,
  ADD COLUMN IF NOT EXISTS teaching_method   text,
  ADD COLUMN IF NOT EXISTS resources         text,
  ADD COLUMN IF NOT EXISTS homework_text     text,
  ADD COLUMN IF NOT EXISTS outcome_notes     text,
  ADD COLUMN IF NOT EXISTS created_by        uuid DEFAULT auth.uid();

-- Normalise status to a small lowercase set. The table has no rows today,
-- so this cannot conflict with data; the guard keeps it honest going forward.
UPDATE public.lesson_plans SET status = lower(status) WHERE status IS NOT NULL;
ALTER TABLE public.lesson_plans ALTER COLUMN status SET DEFAULT 'planned';
ALTER TABLE public.lesson_plans DROP CONSTRAINT IF EXISTS lesson_plans_status_check;
ALTER TABLE public.lesson_plans
  ADD CONSTRAINT lesson_plans_status_check
  CHECK (status IN ('draft', 'planned', 'completed'));

CREATE INDEX IF NOT EXISTS idx_lesson_plans_teacher_date ON public.lesson_plans (teacher_id, planned_date);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_class_section ON public.lesson_plans (class_id, section_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_chapter      ON public.lesson_plans (chapter_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_year         ON public.lesson_plans (academic_year_id);

COMMENT ON COLUMN public.lesson_plans.chapter_id IS
  'Optional link to the syllabus chapter this lesson covers.';

-- ---------------------------------------------------------------------
-- 7. assignments — homework vs assignment, status, year, uuid keys
-- ---------------------------------------------------------------------
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS kind             text,
  ADD COLUMN IF NOT EXISTS assigned_date    date,
  ADD COLUMN IF NOT EXISTS status           text,
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS class_id         uuid REFERENCES public.classes (id)        ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS section_id       uuid REFERENCES public.sections (id)       ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by       uuid DEFAULT auth.uid();

-- Backfill the uuid keys from the legacy text columns.
UPDATE public.assignments a
   SET class_id = c.id
  FROM public.classes c
 WHERE a.class_id IS NULL
   AND c.class_name = a.class;

UPDATE public.assignments a
   SET section_id = s.id
  FROM public.sections s
 WHERE a.section_id IS NULL
   AND a.section IS NOT NULL
   AND s.section_name = a.section;

UPDATE public.assignments a
   SET academic_year_id = (SELECT id FROM public.academic_years WHERE is_current LIMIT 1)
 WHERE a.academic_year_id IS NULL;

-- The rows that exist pre-date the homework concept: every one carries
-- max_marks and has graded submissions behind it, so they are the heavier
-- 'assignment'. New rows default to the lightweight 'homework'.
UPDATE public.assignments SET kind = 'assignment' WHERE kind IS NULL;
UPDATE public.assignments SET status = 'published' WHERE status IS NULL;
UPDATE public.assignments SET assigned_date = created_at::date WHERE assigned_date IS NULL;

ALTER TABLE public.assignments ALTER COLUMN kind          SET DEFAULT 'homework';
ALTER TABLE public.assignments ALTER COLUMN kind          SET NOT NULL;
ALTER TABLE public.assignments ALTER COLUMN status        SET DEFAULT 'published';
ALTER TABLE public.assignments ALTER COLUMN status        SET NOT NULL;
ALTER TABLE public.assignments ALTER COLUMN assigned_date SET DEFAULT CURRENT_DATE;
ALTER TABLE public.assignments ALTER COLUMN assigned_date SET NOT NULL;

ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_kind_check;
ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_kind_check CHECK (kind IN ('homework', 'assignment'));
ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_status_check;
ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_status_check CHECK (status IN ('draft', 'published', 'closed'));

CREATE INDEX IF NOT EXISTS idx_assignments_class_section ON public.assignments (class_id, section_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher       ON public.assignments (teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_subject       ON public.assignments (subject_id);
CREATE INDEX IF NOT EXISTS idx_assignments_year          ON public.assignments (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_assignments_kind_status   ON public.assignments (kind, status);

COMMENT ON COLUMN public.assignments.kind IS
  'homework = lightweight daily work; assignment = structured, usually graded piece.';

-- Keep the legacy text class / section in step with the uuid keys, so a
-- writer that only sets one side stays consistent and nothing reading the
-- text columns (older portal code) breaks.
CREATE OR REPLACE FUNCTION public.fn_assignments_sync_keys()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.class_id IS NULL AND NEW.class IS NOT NULL THEN
    SELECT id INTO NEW.class_id FROM public.classes WHERE class_name = NEW.class LIMIT 1;
  END IF;
  IF NEW.class_id IS NOT NULL AND (NEW.class IS NULL OR NEW.class = '') THEN
    SELECT class_name INTO NEW.class FROM public.classes WHERE id = NEW.class_id;
  END IF;
  IF NEW.section_id IS NULL AND NEW.section IS NOT NULL THEN
    SELECT id INTO NEW.section_id FROM public.sections WHERE section_name = NEW.section LIMIT 1;
  END IF;
  IF NEW.section_id IS NOT NULL AND (NEW.section IS NULL OR NEW.section = '') THEN
    SELECT section_name INTO NEW.section FROM public.sections WHERE id = NEW.section_id;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_assignments_sync_keys ON public.assignments;
CREATE TRIGGER trg_assignments_sync_keys
  BEFORE INSERT OR UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.fn_assignments_sync_keys();

-- ---------------------------------------------------------------------
-- 8. student_assignment_submissions — record the review
-- ---------------------------------------------------------------------
ALTER TABLE public.student_assignment_submissions
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.teachers (id) ON DELETE SET NULL;

-- Existing rows use the legacy 'graded' label; normalise it to 'reviewed'
-- and stamp reviewed_at so the new status CHECK below can be applied.
UPDATE public.student_assignment_submissions
   SET status = 'reviewed',
       reviewed_at = COALESCE(reviewed_at, submitted_at, now())
 WHERE status = 'graded';
UPDATE public.student_assignment_submissions
   SET status = 'submitted'
 WHERE status IS NULL OR status NOT IN ('submitted', 'late', 'reviewed', 'returned');

ALTER TABLE public.student_assignment_submissions DROP CONSTRAINT IF EXISTS student_assignment_submissions_status_check;
ALTER TABLE public.student_assignment_submissions
  ADD CONSTRAINT student_assignment_submissions_status_check
  CHECK (status IN ('submitted', 'late', 'reviewed', 'returned'));

CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON public.student_assignment_submissions (assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student    ON public.student_assignment_submissions (student_id);

-- ---------------------------------------------------------------------
-- 9. Permissions
-- ---------------------------------------------------------------------
-- role_permissions is a plain (role, permission) grant table read by
-- my_permissions(). Insert the grants directly; set_role_permission()
-- cannot be used here because it requires an admin caller and this runs
-- as the migration role.
INSERT INTO public.role_permissions (role, permission)
SELECT r::public.app_role, 'academics.teach'
FROM (VALUES ('teacher'), ('class_teacher'), ('vice_principal'), ('principal'), ('admin')) AS t(r)
ON CONFLICT (role, permission) DO NOTHING;

INSERT INTO public.role_permissions (role, permission)
SELECT r::public.app_role, 'academics.view'
FROM (VALUES
  ('super_admin'), ('admin'), ('principal'), ('vice_principal'),
  ('teacher'), ('class_teacher'), ('exam_controller'), ('accountant'),
  ('librarian'), ('transport_manager'), ('hostel_warden'), ('receptionist'),
  ('office_staff'), ('hr'), ('student'), ('parent')
) AS t(r)
ON CONFLICT (role, permission) DO NOTHING;

COMMIT;
