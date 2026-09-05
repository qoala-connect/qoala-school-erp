-- =====================================================================
-- FEES MIGRATION 03b — fix collect_fee() parameter defaults
-- =====================================================================
-- FOUND BY TEST.
--
-- collect_fee() declared:
--     _discount_amount numeric DEFAULT 0,
--     _fine_amount     numeric DEFAULT 0
--
-- so a caller that omitted them (a settling payment, which supplies only
-- the amount) hit:
--     coalesce(_discount_amount, discount_amount)  ->  coalesce(0, 500) -> 0
--
-- and the stored discount and late fee were reset to zero on every
-- subsequent payment. That is the same defect the audit reported in the
-- original browser code, reintroduced here in a different shape: the
-- fee row was being rewritten by a payment that had no business
-- changing it.
--
-- The defaults become NULL so "not supplied" means "leave unchanged",
-- which is what coalesce() was already written to express. The insert
-- path still treats NULL as 0.
--
-- ROLLBACK: re-apply supabase_fees_migration_03.sql, which contains the
-- previous definition.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.collect_fee(
  _student_id       uuid,
  _fee_category_id  uuid,
  _amount           numeric,
  _payment_mode     text    DEFAULT 'cash',
  _academic_year_id uuid    DEFAULT NULL,
  _total_amount     numeric DEFAULT NULL,
  _discount_amount  numeric DEFAULT NULL,   -- was 0
  _fine_amount      numeric DEFAULT NULL,   -- was 0
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
  year_id uuid := coalesce(_academic_year_id, (SELECT id FROM public.academic_years WHERE is_current LIMIT 1));
  due     date := coalesce(_due_date, CURRENT_DATE);
  paid_on date := coalesce(_payment_date, CURRENT_DATE);
  fee     public.student_fees;
  receipt text;
  new_id  uuid;
  actor   uuid := auth.uid();
BEGIN
  IF NOT public.auth_has_permission('fees.collect') THEN
    RAISE EXCEPTION 'You do not have permission to collect fees' USING ERRCODE = '42501';
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero' USING ERRCODE = 'check_violation';
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
    -- Only fields the caller explicitly supplied are changed. A plain
    -- payment leaves the fee's own figures exactly as they were.
    IF _total_amount IS NOT NULL OR _discount_amount IS NOT NULL OR _fine_amount IS NOT NULL THEN
      UPDATE public.student_fees
         SET total_amount    = round(coalesce(_total_amount,    total_amount),    2),
             discount_amount = round(coalesce(_discount_amount, discount_amount), 2),
             fine_amount     = round(coalesce(_fine_amount,     fine_amount),     2)
       WHERE id = fee.id
      RETURNING * INTO fee;
    END IF;
  END IF;

  IF round(_amount, 2) > (fee.net_amount - fee.amount_paid) THEN
    RAISE EXCEPTION 'Payment of % exceeds the outstanding balance of %',
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
      'total_amount', fee.total_amount,
      'discount_amount', fee.discount_amount,
      'fine_amount', fee.fine_amount,
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

REVOKE ALL ON FUNCTION public.collect_fee(uuid,uuid,numeric,text,uuid,numeric,numeric,numeric,date,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.collect_fee(uuid,uuid,numeric,text,uuid,numeric,numeric,numeric,date,date,text,text) TO authenticated;

-- PostgREST caches the function signature; without this the old defaults
-- keep being applied to calls that omit a parameter.
NOTIFY pgrst, 'reload schema';
