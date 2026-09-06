-- Migration 20: align admissions.status check constraint with the application pipeline.
--
-- Defect: the Admissions Kanban board, the status filter dropdown and the
-- approvals workflow all offer the 11 stages declared by AdmissionStatus in
-- src/types/admission.ts, but the table only permitted 'Pending' | 'Approved' |
-- 'Rejected'. Every intermediate stage-change button failed with
--   23514 new row for relation "admissions" violates check constraint
--         "admissions_status_check"
-- Widen the constraint to the full pipeline vocabulary.

ALTER TABLE public.admissions
  DROP CONSTRAINT IF EXISTS admissions_status_check;

ALTER TABLE public.admissions
  ADD CONSTRAINT admissions_status_check CHECK (
    status = ANY (ARRAY[
      'Pending'::text,
      'In Review'::text,
      'Under Review'::text,
      'Interview Scheduled'::text,
      'Documents Verification'::text,
      'Approved'::text,
      'Student Created'::text,
      'Waitlisted'::text,
      'Rejected'::text,
      'Withdrawn'::text,
      'Cancelled'::text
    ])
  );
