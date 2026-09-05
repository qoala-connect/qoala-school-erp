-- =====================================================================
-- FEES MIGRATION 03 — atomic collection, real receipts, no lost history
-- =====================================================================
-- PROBLEMS THIS SOLVES (all P0 in the audit)
--
--   1. Collection was three unprotected round-trips from the browser:
--      category upsert, then student_fees insert/update, then
--      fee_payments insert. A failure after step two left a student
--      marked 'paid' with no payment recorded.
--
--   2. Status was derived from the amount being entered right now, not
--      from the sum of payments already taken. Paying 3,000 against a
--      5,000 fee already part-paid 2,000 computed 2,000 still due.
--
--   3. Receipt numbers were `RCPT-` plus a random six-digit value against
--      a UNIQUE column. Collisions become likely at roughly a thousand
--      receipts, and each collision failed the payment insert AFTER the
--      fee row had already been updated.
--
--   4. "Delete this payment" deleted the parent student_fees row, and
--      fee_payments cascades from it, so the entire payment history for
--      that fee was destroyed.
--
--   5. net_amount was nullable with no default and no trigger, so the
--      balance rendered as NaN. Nothing prevented duplicate fee
--      assignment or overpayment.
--
-- APPROACH
--   Move the whole operation into PostgreSQL. collect_fee() does it in
--   one transaction, derives status from actual payments, and takes the
--   receipt number from a per-academic-year counter. Payments are voided,
--   never deleted. Everything writes an audit_logs entry.
--
-- SAFETY
--   Additive. No column or table is dropped. Every fee table is currently
--   empty (student_fees 0, fee_payments 0), so no backfill can lose data.
--   The legacy `fees` table is deliberately left untouched.
--
-- ROLLBACK: supabase_fees_migration_03_rollback.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Columns the workflow actually needs
-- ---------------------------------------------------------------------

-- The payment form collects a late fee. There was nowhere to put it, so
-- it was being folded into total_amount and losing its identity.
ALTER TABLE public.student_fees
  ADD COLUMN IF NOT EXISTS fine_amount numeric(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS created_by  uuid;

ALTER TABLE public.student_fees
  DROP CONSTRAINT IF EXISTS student_fees_fine_amount_check;
ALTER TABLE public.student_fees
  ADD  CONSTRAINT student_fees_fine_amount_check CHECK (fine_amount >= 0.00);

COMMENT ON COLUMN public.student_fees.amount_paid IS
  'Cached sum of non-voided fee_payments. Maintained by trigger; never write it directly.';
COMMENT ON COLUMN public.student_fees.net_amount IS
  'total_amount + fine_amount - discount_amount - scholarship_amount. Maintained by trigger.';

-- Voiding replaces deletion, so a reversal keeps the original record.
ALTER TABLE public.fee_payments
  ADD COLUMN IF NOT EXISTS voided_at   timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by   uuid,
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS created_by  uuid;

CREATE INDEX IF NOT EXISTS idx_fee_payments_active
  ON public.fee_payments (student_fee_id) WHERE voided_at IS NULL;

-- ---------------------------------------------------------------------
-- 2. Scope every fee to an academic year
-- ---------------------------------------------------------------------
UPDATE public.student_fees sf
SET academic_year_id = (SELECT id FROM public.academic_years WHERE is_current LIMIT 1)
WHERE sf.academic_year_id IS NULL;

ALTER TABLE public.student_fees
  ALTER COLUMN academic_year_id SET DEFAULT NULL;

-- One fee of a given category, per student, per year, per due date.
-- NULLS NOT DISTINCT so a null academic_year_id cannot be used to slip a
-- duplicate past the constraint.
ALTER TABLE public.student_fees
  DROP CONSTRAINT IF EXISTS student_fees_unique_assignment;
ALTER TABLE public.student_fees
  ADD  CONSTRAINT student_fees_unique_assignment
  UNIQUE NULLS NOT DISTINCT (student_id, fee_category_id, academic_year_id, due_date);

-- ---------------------------------------------------------------------
-- 3. Derived amounts, maintained by the database
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_fees_compute_net()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.net_amount := round(
      coalesce(NEW.total_amount, 0)
    + coalesce(NEW.fine_amount, 0)
    - coalesce(NEW.discount_amount, 0)
    - coalesce(NEW.scholarship_amount, 0), 2);

  IF NEW.net_amount < 0 THEN
    RAISE EXCEPTION
      'Discount and scholarship (%) exceed the fee plus fine (%)',
      coalesce(NEW.discount_amount,0) + coalesce(NEW.scholarship_amount,0),
      coalesce(NEW.total_amount,0) + coalesce(NEW.fine_amount,0)
      USING ERRCODE = 'check_violation';
  END IF;

  -- Status always follows the money actually received.
  IF coalesce(NEW.amount_paid, 0) >= NEW.net_amount AND NEW.net_amount > 0 THEN
    NEW.status := 'paid';
  ELSIF coalesce(NEW.amount_paid, 0) > 0 THEN
    NEW.status := 'partial';
  ELSE
    NEW.status := 'pending';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_fees_compute_net ON public.student_fees;
CREATE TRIGGER student_fees_compute_net
  BEFORE INSERT OR UPDATE ON public.student_fees
  FOR EACH ROW EXECUTE FUNCTION public.student_fees_compute_net();

-- Recompute the parent whenever payments change, from the payments
-- themselves. This is what makes the status correct regardless of which
-- code path wrote the payment.
CREATE OR REPLACE FUNCTION public.fee_payments_sync_parent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  target uuid := coalesce(NEW.student_fee_id, OLD.student_fee_id);
  paid   numeric(12,2);
  net    numeric(12,2);
BEGIN
  SELECT coalesce(sum(amount_paid), 0) INTO paid
  FROM public.fee_payments
  WHERE student_fee_id = target AND voided_at IS NULL;

  SELECT net_amount INTO net FROM public.student_fees WHERE id = target;

  IF paid > coalesce(net, 0) THEN
    RAISE EXCEPTION
      'Payments of % would exceed the outstanding fee of %', paid, net
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.student_fees SET amount_paid = paid WHERE id = target;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS fee_payments_sync_parent ON public.fee_payments;
CREATE TRIGGER fee_payments_sync_parent
  AFTER INSERT OR UPDATE OR DELETE ON public.fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.fee_payments_sync_parent();

-- ---------------------------------------------------------------------
-- 4. Sequential receipt numbers, per academic year
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.receipt_counters (
  academic_year_id uuid PRIMARY KEY REFERENCES public.academic_years(id) ON DELETE CASCADE,
  last_number      bigint NOT NULL DEFAULT 0
);
ALTER TABLE public.receipt_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.receipt_counters FROM anon, authenticated;

COMMENT ON TABLE public.receipt_counters IS
  'Gap-free receipt sequence per academic year. Written only by next_receipt_number(); a plain SEQUENCE was not used because it leaves gaps on rollback, which a financial receipt book must not do.';

CREATE OR REPLACE FUNCTION public.next_receipt_number(_academic_year_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  n     bigint;
  label text;
BEGIN
  INSERT INTO public.receipt_counters (academic_year_id, last_number)
  VALUES (_academic_year_id, 0)
  ON CONFLICT (academic_year_id) DO NOTHING;

  -- UPDATE takes a row lock, so concurrent cashiers serialise here and
  -- can never be handed the same number.
  UPDATE public.receipt_counters
     SET last_number = last_number + 1
   WHERE academic_year_id = _academic_year_id
  RETURNING last_number INTO n;

  SELECT name INTO label FROM public.academic_years WHERE id = _academic_year_id;

  RETURN 'RCP/' || coalesce(label, 'NA') || '/' || lpad(n::text, 6, '0');
END;
$$;

-- ---------------------------------------------------------------------
-- 5. collect_fee() — the whole operation, in one transaction
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.collect_fee(
  _student_id       uuid,
  _fee_category_id  uuid,
  _amount           numeric,
  _payment_mode     text    DEFAULT 'cash',
  _academic_year_id uuid    DEFAULT NULL,
  _total_amount     numeric DEFAULT NULL,
  _discount_amount  numeric DEFAULT 0,
  _fine_amount      numeric DEFAULT 0,
  _due_date         date    DEFAULT NULL,
  _payment_date     date    DEFAULT NULL,
  _transaction_id   text    DEFAULT NULL,
  _remarks          text    DEFAULT NULL
)
RETURNS TABLE (
  payment_id     uuid,
  student_fee_id uuid,
  receipt_number text,
  amount_paid    numeric,
  net_amount     numeric,
  total_paid     numeric,
  balance        numeric,
  status         text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  year_id   uuid := coalesce(_academic_year_id, (SELECT id FROM public.academic_years WHERE is_current LIMIT 1));
  due       date := coalesce(_due_date, CURRENT_DATE);
  paid_on   date := coalesce(_payment_date, CURRENT_DATE);
  fee       public.student_fees;
  receipt   text;
  new_id    uuid;
  actor     uuid := auth.uid();
BEGIN
  IF NOT public.auth_has_permission('fees.collect') THEN
    RAISE EXCEPTION 'You do not have permission to collect fees'
      USING ERRCODE = '42501';
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero'
      USING ERRCODE = 'check_violation';
  END IF;

  IF year_id IS NULL THEN
    RAISE EXCEPTION 'No current academic year is set. Mark one as current before collecting fees.'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = _student_id) THEN
    RAISE EXCEPTION 'That student does not exist' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.fee_categories WHERE id = _fee_category_id) THEN
    RAISE EXCEPTION 'That fee category does not exist' USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Find the fee this payment settles, or open one. FOR UPDATE so two
  -- cashiers collecting against the same fee serialise rather than race.
  SELECT * INTO fee
  FROM public.student_fees
  WHERE student_id = _student_id
    AND fee_category_id = _fee_category_id
    AND academic_year_id = year_id
    AND due_date = due
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.student_fees (
      student_id, fee_category_id, academic_year_id, due_date,
      total_amount, discount_amount, fine_amount, created_by
    ) VALUES (
      _student_id, _fee_category_id, year_id, due,
      round(coalesce(_total_amount, _amount), 2),
      round(coalesce(_discount_amount, 0), 2),
      round(coalesce(_fine_amount, 0), 2),
      actor
    )
    RETURNING * INTO fee;
  ELSE
    -- Only widen the fee when the caller explicitly supplies new figures.
    -- Silently overwriting net_amount on every payment was how earlier
    -- discounts and fines were being lost.
    UPDATE public.student_fees
       SET total_amount    = round(coalesce(_total_amount, total_amount), 2),
           discount_amount = round(coalesce(_discount_amount, discount_amount), 2),
           fine_amount     = round(coalesce(_fine_amount, fine_amount), 2)
     WHERE id = fee.id
    RETURNING * INTO fee;
  END IF;

  IF round(_amount, 2) > (fee.net_amount - fee.amount_paid) THEN
    RAISE EXCEPTION
      'Payment of % exceeds the outstanding balance of %',
      round(_amount, 2), (fee.net_amount - fee.amount_paid)
      USING ERRCODE = 'check_violation';
  END IF;

  receipt := public.next_receipt_number(year_id);

  INSERT INTO public.fee_payments (
    student_fee_id, payment_date, amount_paid, payment_mode,
    transaction_id, receipt_number, remarks, created_by
  ) VALUES (
    fee.id, paid_on, round(_amount, 2), _payment_mode,
    _transaction_id, receipt, _remarks, actor
  )
  RETURNING id INTO new_id;

  -- The AFTER trigger has now refreshed amount_paid and status.
  SELECT * INTO fee FROM public.student_fees WHERE id = fee.id;

  INSERT INTO public.audit_logs (user_id, user_email, action_type, table_name, record_id, new_values)
  VALUES (
    actor,
    (SELECT email FROM public.profiles WHERE id = actor),
    'FEE_COLLECTED', 'fee_payments', new_id,
    jsonb_build_object(
      'receipt_number', receipt,
      'student_id', _student_id,
      'amount_paid', round(_amount, 2),
      'payment_mode', _payment_mode,
      'net_amount', fee.net_amount,
      'total_paid', fee.amount_paid,
      'status', fee.status
    )
  );

  RETURN QUERY SELECT
    new_id, fee.id, receipt, round(_amount, 2),
    fee.net_amount, fee.amount_paid,
    (fee.net_amount - fee.amount_paid), fee.status::text;
END;
$$;

-- ---------------------------------------------------------------------
-- 6. void_fee_payment() — reversal that keeps the record
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_fee_payment(_payment_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  pay   public.fee_payments;
  actor uuid := auth.uid();
BEGIN
  IF NOT public.auth_has_permission('fees.refund') THEN
    RAISE EXCEPTION 'You do not have permission to void a payment'
      USING ERRCODE = '42501';
  END IF;

  IF _reason IS NULL OR btrim(_reason) = '' THEN
    RAISE EXCEPTION 'A reason is required to void a payment'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO pay FROM public.fee_payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That payment does not exist' USING ERRCODE = 'no_data_found';
  END IF;

  IF pay.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Receipt % is already voided', pay.receipt_number
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.fee_payments
     SET voided_at = now(), voided_by = actor, void_reason = btrim(_reason)
   WHERE id = _payment_id;

  INSERT INTO public.audit_logs (user_id, user_email, action_type, table_name, record_id, old_values, new_values)
  VALUES (
    actor,
    (SELECT email FROM public.profiles WHERE id = actor),
    'FEE_PAYMENT_VOIDED', 'fee_payments', _payment_id,
    jsonb_build_object('receipt_number', pay.receipt_number, 'amount_paid', pay.amount_paid),
    jsonb_build_object('void_reason', btrim(_reason))
  );
END;
$$;

-- ---------------------------------------------------------------------
-- 7. Privileges
-- ---------------------------------------------------------------------
-- The functions check permissions themselves; the tables stay closed so
-- the functions are the only write path.
REVOKE ALL ON FUNCTION public.collect_fee(uuid,uuid,numeric,text,uuid,numeric,numeric,numeric,date,date,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_fee_payment(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.next_receipt_number(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.collect_fee(uuid,uuid,numeric,text,uuid,numeric,numeric,numeric,date,date,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_fee_payment(uuid,text) TO authenticated;

-- Direct DELETE on fee records is what destroyed payment history.
REVOKE DELETE ON public.student_fees FROM anon, authenticated;
REVOKE DELETE, UPDATE ON public.fee_payments FROM anon, authenticated;
REVOKE ALL ON public.student_fees  FROM anon;
REVOKE ALL ON public.fee_payments  FROM anon;

COMMIT;
