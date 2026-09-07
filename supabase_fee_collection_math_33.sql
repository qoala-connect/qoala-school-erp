-- =====================================================================
-- FEES MIGRATION 33 — collection totals stop counting voided receipts
-- =====================================================================
-- FOUND BY TEST against live data.
--
-- Every fee roll-up view read collections straight off fee_payments:
--
--     COALESCE(sum(fp.amount_paid), 0.00) AS total_collection
--
-- Two defects follow from that.
--
-- 1. VOIDED RECEIPTS STILL COUNT AS MONEY COLLECTED. void_fee_payment()
--    stamps voided_at and rolls student_fees.amount_paid back, but the
--    views never filtered on voided_at. On the live database that made
--    dashboard_fee_view report 9,919,671.19 collected against a real
--    9,910,671.17 -- exactly the one voided receipt of 9,000.02 -- and
--    dashboard_fee_monthly showed the October bucket as fully settled
--    (fee 9,000.02 / collected 9,000.02 / pending 0) while the ledger it
--    came from is still 'pending' with amount_paid = 0. A cashier who
--    voids a wrong receipt sees the dashboard refuse to move.
--
-- 2. JOIN FAN-OUT INFLATES WHAT WAS BILLED. Joining student_fees to
--    fee_payments and then summing sf.net_amount counts a ledger once per
--    payment against it, so a fee settled in three instalments was billed
--    three times over in the totals. Collection rate then reads far lower
--    than it is, and it drifts further every time a parent pays in parts.
--
-- FIX: read collections from student_fees.amount_paid, which the
-- fee_payments_sync_parent trigger already maintains as
-- sum(amount_paid) WHERE voided_at IS NULL -- verified equal on all 533
-- live ledgers. That removes the fee_payments join entirely, so both the
-- voided rows and the fan-out go with it. Outstanding is clamped per
-- ledger rather than on the grand total, so one overpaid ledger cannot
-- mask another's dues.
--
-- Column names, order and types are unchanged, so CREATE OR REPLACE
-- keeps the existing grants and the security_invoker = false setting
-- from supabase_fix_dashboard_views_timeout.sql.
--
-- ROLLBACK: supabase_fee_collection_math_33_rollback.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Institution-wide fee KPIs (Analytics dashboard cards)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.dashboard_fee_view AS
SELECT
  (SELECT count(*)
     FROM public.fee_payments
    WHERE voided_at IS NULL)                                   AS total_receipts,
  (SELECT COALESCE(sum(net_amount), 0.00)
     FROM public.student_fees)                                 AS total_fee,
  (SELECT COALESCE(sum(amount_paid), 0.00)
     FROM public.student_fees)                                 AS total_collection,
  (SELECT COALESCE(sum(GREATEST(net_amount - amount_paid, 0.00)), 0.00)
     FROM public.student_fees)                                 AS pending_amount,
  (SELECT count(*)
     FROM public.student_fees
    WHERE status::text = 'paid')                               AS paid_students,
  (SELECT count(*)
     FROM public.student_fees
    WHERE status::text = 'pending')                            AS pending_students,
  (SELECT count(*)
     FROM public.student_fees
    WHERE status::text = 'partial')                            AS partial_students;

COMMENT ON VIEW public.dashboard_fee_view IS
  'School-wide fee KPIs. Collections come from student_fees.amount_paid, which the fee_payments_sync_parent trigger keeps equal to the sum of non-voided receipts; never sum fee_payments here or voided receipts are counted as money in hand.';

-- ---------------------------------------------------------------------
-- 2. Month-by-month billed vs collected (Analytics area chart)
--    Both series are bucketed by the ledger's due month, so a bar reads
--    "of what fell due in this month, this much has been collected".
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.dashboard_fee_monthly AS
SELECT
  ay.name                                                       AS academic_year,
  to_char((sf.due_date)::timestamp with time zone, 'Mon'::text) AS month,
  COALESCE(sum(sf.net_amount), 0.00)                            AS total_fee,
  COALESCE(sum(sf.amount_paid), 0.00)                           AS total_collection,
  COALESCE(sum(GREATEST(sf.net_amount - sf.amount_paid, 0.00)), 0.00) AS pending
FROM public.student_fees sf
  LEFT JOIN public.academic_years ay ON sf.academic_year_id = ay.id
GROUP BY ay.name,
         to_char((sf.due_date)::timestamp with time zone, 'Mon'::text),
         EXTRACT(month FROM sf.due_date)
ORDER BY EXTRACT(month FROM sf.due_date);

-- ---------------------------------------------------------------------
-- 3. Recent cashier receipts feed — a voided receipt is not a receipt
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.dashboard_recent_payments AS
SELECT
  fp.id,
  s.name,
  s.class,
  to_char((sf.due_date)::timestamp with time zone, 'Mon'::text) AS month,
  fp.amount_paid AS paid_amount,
  fp.payment_mode,
  fp.payment_date,
  fp.receipt_number
FROM public.fee_payments fp
  JOIN public.student_fees sf ON fp.student_fee_id = sf.id
  JOIN public.students s      ON sf.student_id = s.id
WHERE fp.voided_at IS NULL
ORDER BY fp.payment_date DESC NULLS LAST
LIMIT 20;

-- ---------------------------------------------------------------------
-- 4. Class-wise realisation summary (Fee Reports)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_fee_collection_summary AS
SELECT
  c.class_name,
  COALESCE(count(sf.id), 0::bigint)                             AS total_receivables,
  COALESCE(sum(sf.total_amount), 0.00)                          AS total_gross_billed,
  COALESCE(sum(sf.discount_amount + sf.scholarship_amount), 0.00) AS total_concessions,
  COALESCE(sum(sf.net_amount), 0.00)                            AS total_net_receivables,
  COALESCE(sum(sf.amount_paid), 0.00)                           AS total_amount_collected,
  COALESCE(sum(GREATEST(sf.net_amount - sf.amount_paid, 0.00)), 0.00) AS total_outstanding_dues
FROM public.classes c
  LEFT JOIN public.students s      ON s.class = c.class_name
  LEFT JOIN public.student_fees sf ON sf.student_id = s.id
GROUP BY c.class_name;

COMMIT;
