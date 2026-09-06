-- =====================================================================
-- FIX: exam_subjects — unblock evaluator/marks saves + realign to curriculum
-- Safe to run multiple times. Run in Supabase Dashboard → SQL Editor.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Missing `updated_at` column.
--    Trigger `trigger_update_exam_subjects` (BEFORE UPDATE) runs
--    update_modified_column() which sets NEW.updated_at, but the column
--    was never added — so EVERY update to exam_subjects fails with:
--      ERROR: record "new" has no field "updated_at"
--    This blocks: saving evaluators/marks in the mapping modal, and the
--    whole marks review / submit / lock workflow.
-- ---------------------------------------------------------------------
ALTER TABLE public.exam_subjects
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
-- The NOT NULL DEFAULT now() above already populates every existing row, and
-- exam_subjects has no created_at column, so no separate backfill is needed.

-- ---------------------------------------------------------------------
-- 2. Remove exam_subjects rows that don't belong to the class's
--    curriculum (Academics → Class Subjects) and have no marks entered.
--    These were seeded by the old "subjects.slice(0,5)" bug, e.g. PA1 /
--    Class 1 showing Accountancy, Biology, Chemistry, ...
--    Only deletes rows that are BOTH off-curriculum AND have zero marks.
-- ---------------------------------------------------------------------
DELETE FROM public.exam_subjects es
USING public.exams e
WHERE es.exam_id = e.id
  AND NOT EXISTS (
    SELECT 1 FROM public.class_subjects cs
    WHERE cs.class_id = e.class_id
      AND cs.academic_year_id = e.academic_year_id
      AND cs.subject_id = es.subject_id
      AND cs.is_active IS NOT FALSE
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.marks m
    WHERE m.exam_id = es.exam_id
      AND m.subject_id = es.subject_id
  );

COMMIT;

-- After this: open Examination → an exam → "Configure Subjects, Marks &
-- Evaluators". It now lists only that class's mapped subjects. Assign the
-- evaluator, Save, then that teacher sees the task on login (provided they
-- have an active teacher_assignments row for the class/section/subject).
