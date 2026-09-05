-- =====================================================================
-- MIGRATION 16 — Missing FK indexes, redundant duplicate indexes, and
-- the two stale fee-summary views still reading the legacy table shape
-- =====================================================================
-- WHY
--   The prior audit (PROJECT.md F8) found 22 unindexed foreign keys, 10
--   redundant duplicate indexes, and two dashboard views written before
--   the fee schema settled on student_fees/fee_payments as canonical.
--   No SQL file in this repo had actually addressed any of it yet.
--
--   This file covers every FK column this project's own test suite
--   checks by name, plus student_transport's two FKs (confirmed real
--   columns from the live query code in TransportManagement.tsx). It
--   deliberately does NOT guess at index names beyond what's been
--   confirmed to exist in tracked code/schema — a CREATE INDEX on a
--   column that turns out not to exist would abort this whole
--   transaction, and there's no live DB access from here to check the
--   remaining ~13 FK columns the original audit counted. Whoever runs
--   this with dashboard/psql access should follow up with:
--     SELECT conrelid::regclass, conname, pg_get_constraintdef(oid)
--     FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace;
--   against unindexed FKs to close the rest.
--
-- WHAT THIS DOES
--   CREATE INDEX IF NOT EXISTS (additive), DROP INDEX IF EXISTS for the
--   3 named duplicates, CREATE OR REPLACE VIEW for the two fee views
--   (WITH (security_invoker = on), matching this project's other 24
--   views per PROJECT.md).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Missing foreign-key indexes
-- ---------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_disciplinary_records_student_id ON public.disciplinary_records(student_id);

CREATE INDEX IF NOT EXISTS idx_admissions_academic_year_id ON public.admissions(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_admissions_class_id ON public.admissions(class_id);

CREATE INDEX IF NOT EXISTS idx_attendance_academic_year_id ON public.attendance(academic_year_id);

CREATE INDEX IF NOT EXISTS idx_timetable_class_id ON public.timetable(class_id);
CREATE INDEX IF NOT EXISTS idx_timetable_section_id ON public.timetable(section_id);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_class_id ON public.teacher_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_section_id ON public.teacher_assignments(section_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_subject_id ON public.teacher_assignments(subject_id);

CREATE INDEX IF NOT EXISTS idx_student_transport_route_id ON public.student_transport(route_id);
CREATE INDEX IF NOT EXISTS idx_student_transport_vehicle_id ON public.student_transport(vehicle_id);

-- ---------------------------------------------------------------------
-- 2. Redundant duplicate indexes named in the original audit
-- ---------------------------------------------------------------------

DROP INDEX IF EXISTS public.idx_admissions_status;
DROP INDEX IF EXISTS public.idx_marks_student;
DROP INDEX IF EXISTS public.students_admission_number_unique;

-- ---------------------------------------------------------------------
-- 3. Stale fee-summary views — rebuilt against the canonical
--    student_fees / fee_payments tables
-- ---------------------------------------------------------------------

CREATE OR REPLACE VIEW public.fee_collection_summary
WITH (security_invoker = on) AS
SELECT
  s.class,
  s.section,
  count(DISTINCT sf.id)                                        AS total_fee_records,
  COALESCE(sum(sf.net_amount), 0)                               AS total_net_receivable,
  COALESCE(sum(fp.amount_paid), 0)                              AS total_collected,
  COALESCE(sum(sf.net_amount), 0) - COALESCE(sum(fp.amount_paid), 0) AS total_outstanding
FROM public.student_fees sf
JOIN public.students s ON s.id = sf.student_id
LEFT JOIN public.fee_payments fp
  ON fp.student_fee_id = sf.id AND fp.voided_at IS NULL
GROUP BY s.class, s.section;

COMMENT ON VIEW public.fee_collection_summary IS
  'Collected vs outstanding fee totals by class/section. Rebuilt against student_fees/fee_payments — the legacy fees table it originally targeted is empty.';

REVOKE ALL ON public.fee_collection_summary FROM anon;
GRANT SELECT ON public.fee_collection_summary TO authenticated;

CREATE OR REPLACE VIEW public.pending_fees_summary_view
WITH (security_invoker = on) AS
SELECT
  sf.id                                    AS student_fee_id,
  sf.student_id,
  s.name                                   AS student_name,
  s.class,
  s.section,
  sf.net_amount,
  sf.amount_paid,
  (sf.net_amount - sf.amount_paid)         AS balance_due,
  sf.due_date,
  sf.status,
  (CURRENT_DATE - sf.due_date) AS days_overdue
FROM public.student_fees sf
JOIN public.students s ON s.id = sf.student_id
WHERE sf.status <> 'paid';

COMMENT ON VIEW public.pending_fees_summary_view IS
  'One row per outstanding (pending/partial) student_fees record with days overdue. Rebuilt against student_fees — the legacy fees table it originally targeted is empty.';

REVOKE ALL ON public.pending_fees_summary_view FROM anon;
GRANT SELECT ON public.pending_fees_summary_view TO authenticated;

COMMIT;
