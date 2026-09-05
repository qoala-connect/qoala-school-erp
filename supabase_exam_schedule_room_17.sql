-- =====================================================================
-- MIGRATION 17 — exam_subjects.room column
-- =====================================================================
-- WHY
--   DatesheetsView.tsx already collects an "Exam Venue" field when an
--   admin schedules a subject slot, and AdmitCardsView / the student
--   portal admit card already display a room/venue column — but
--   exam_subjects never had a column to persist it, so the venue typed
--   into the form silently vanished on save and the admit card always
--   fell back to a synthesized "Desk #<roll number>". exam_date,
--   start_time and duration already existed (supabase_results_migration.sql);
--   this adds the one missing column so the whole schedule round-trips.
--
-- WHAT THIS DOES
--   Additive: one nullable column, no data touched.
-- =====================================================================

BEGIN;

ALTER TABLE public.exam_subjects
  ADD COLUMN IF NOT EXISTS room text;

-- ---------------------------------------------------------------------
-- Teacher gradebook review workflow (Submit / Verify / Reopen)
-- ---------------------------------------------------------------------
-- WHY: ExaminationModule.tsx's "Teacher Tasks" board had Submit/Verify/
-- Reopen buttons that only ever mutated local React state — the status
-- shown reverted the moment the page re-fetched real data, because
-- nothing was persisted. entered_count/total_students already give a
-- correct "draft/in_progress/submitted" status for free; this adds the
-- two columns needed for the explicit review step on top of that
-- (an exam controller verifying a submission, or reopening it with a
-- reason for the teacher to see).
ALTER TABLE public.exam_subjects
  ADD COLUMN IF NOT EXISTS review_status text
    CHECK (review_status IN ('pending', 'submitted', 'verified', 'reopened')) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reopen_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- ---------------------------------------------------------------------
-- Result-locking (ResultProcessingView's 4th publication stage)
-- ---------------------------------------------------------------------
-- WHY: the Draft -> Verified -> Published stages already correctly
-- re-derive from exam_results.published on load. "Locked" was the one
-- stage with nowhere to persist to, so it silently reverted to
-- "Published" on every refresh despite the toast claiming results were
-- "strictly protected". One flag per exam (not per exam_results row,
-- since locking is a whole-exam decision) is enough to make the status
-- itself real; it does not by itself add RLS enforcement blocking marks
-- edits while locked — that's a separate follow-up if wanted.
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS locked boolean DEFAULT false;

-- ---------------------------------------------------------------------
-- disciplinary_records: demerit_points column + real student link
-- ---------------------------------------------------------------------
-- WHY: DisciplineManagement.tsx's Add/Edit form lets staff type a demerit
-- point value, but it was never in the insert/update payload — every
-- record was hardcoded to display "5" on load regardless of what was
-- entered or what's actually in the row. Also, records were created with
-- only a free-text student_name (no student_id FK), so the
-- disciplinary_records_owner_select policy added in migration 15 (which
-- filters by student_id) could never match a real student/parent to
-- their own record.
ALTER TABLE public.disciplinary_records
  ADD COLUMN IF NOT EXISTS demerit_points integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;

COMMIT;
