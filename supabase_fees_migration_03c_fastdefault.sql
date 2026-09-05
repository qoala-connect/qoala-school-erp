-- =====================================================================
-- FEES MIGRATION 03c — remove the fast-default on fine_amount/amount_paid
-- =====================================================================
-- FOUND BY TEST.
--
-- Migration 03 added two columns as:
--     ADD COLUMN fine_amount numeric(12,2) NOT NULL DEFAULT 0.00
--     ADD COLUMN amount_paid numeric(12,2) NOT NULL DEFAULT 0.00
--
-- PostgreSQL optimises that form by NOT rewriting the table: it records
-- the default as a per-column "missing value" (pg_attribute.atthasmissing
-- = true, attmissingval = {0.00}) and synthesises it on read.
--
-- The BEFORE INSERT trigger then read NEW.fine_amount as the missing
-- value 0.00 rather than the value actually supplied, so:
--
--     total 4000, discount 500, fine 100  ->  net computed as 3500
--                                             (correct answer: 3600)
--
-- The row still STORED fine_amount = 100, so the error was invisible in
-- the data and only showed up in the derived total. Every late fee would
-- have been silently dropped from what a parent was asked to pay.
--
-- Recreating the trigger did not help, because the missing value lives on
-- the column, not in a cached plan. ALTER COLUMN ... TYPE to the same type
-- is skipped by PostgreSQL and does not rewrite either.
--
-- FIX: drop and re-add both columns with NO default, backfill, then
-- attach the default and NOT NULL separately. A default applied by
-- ALTER COLUMN SET DEFAULT never creates a missing value.
--
-- DATA IMPACT
--   fine_amount  is re-derived as 0; both columns are only meaningful on
--                fee rows, and student_fees holds no production rows.
--   amount_paid  is a cache of fee_payments and is recomputed below from
--                the payments themselves, so it cannot drift.
--   No payment record is touched.
--
-- ROLLBACK: supabase_fees_migration_03c_rollback.sql
-- =====================================================================

BEGIN;

ALTER TABLE public.student_fees DROP CONSTRAINT IF EXISTS student_fees_fine_amount_check;

ALTER TABLE public.student_fees DROP COLUMN IF EXISTS fine_amount;
ALTER TABLE public.student_fees DROP COLUMN IF EXISTS amount_paid;

-- No DEFAULT on ADD COLUMN: this is the whole point.
ALTER TABLE public.student_fees ADD COLUMN fine_amount numeric(12,2);
ALTER TABLE public.student_fees ADD COLUMN amount_paid numeric(12,2);

UPDATE public.student_fees SET fine_amount = 0.00 WHERE fine_amount IS NULL;

-- Recompute the payment cache from the payments themselves rather than
-- assuming zero, so any existing receipts stay correctly reflected.
UPDATE public.student_fees sf
SET amount_paid = coalesce((
  SELECT sum(p.amount_paid) FROM public.fee_payments p
  WHERE p.student_fee_id = sf.id AND p.voided_at IS NULL
), 0.00);

ALTER TABLE public.student_fees ALTER COLUMN fine_amount SET DEFAULT 0.00;
ALTER TABLE public.student_fees ALTER COLUMN amount_paid SET DEFAULT 0.00;
ALTER TABLE public.student_fees ALTER COLUMN fine_amount SET NOT NULL;
ALTER TABLE public.student_fees ALTER COLUMN amount_paid SET NOT NULL;

ALTER TABLE public.student_fees
  ADD CONSTRAINT student_fees_fine_amount_check CHECK (fine_amount >= 0.00);

COMMENT ON COLUMN public.student_fees.amount_paid IS
  'Cached sum of non-voided fee_payments. Maintained by trigger; never write it directly.';
COMMENT ON COLUMN public.student_fees.fine_amount IS
  'Late fee added to this charge. Included in net_amount.';

-- Recompute net_amount and status on every existing row now that the
-- trigger can actually see fine_amount.
UPDATE public.student_fees SET updated_at = now();

COMMIT;
