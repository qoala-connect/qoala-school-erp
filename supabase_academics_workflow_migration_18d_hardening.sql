-- =====================================================================
-- MIGRATION 18d — ACADEMICS TEACHING & LEARNING WORKFLOW: HARDENING
-- Covering indexes for the foreign keys 18a added, so the performance
-- advisor's unindexed_foreign_keys finding is closed for these tables.
-- =====================================================================

BEGIN;

CREATE INDEX IF NOT EXISTS idx_assignments_section_id
  ON public.assignments (section_id);

CREATE INDEX IF NOT EXISTS idx_lesson_plans_section_id
  ON public.lesson_plans (section_id);

CREATE INDEX IF NOT EXISTS idx_submissions_reviewed_by
  ON public.student_assignment_submissions (reviewed_by);

-- (academic_year_id on both tables is already covered by idx_assignments_year
--  and idx_lesson_plans_year from 18a.)

COMMIT;
