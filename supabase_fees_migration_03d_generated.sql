-- =====================================================================
-- FEES MIGRATION 03d — net_amount is a GENERATED column, not trigger-set
-- =====================================================================
-- FOUND BY TEST, AND IT CORRECTS AN AUDIT FINDING.
--
-- student_fees.net_amount was already a STORED GENERATED column:
--
--     GENERATED ALWAYS AS
--       (GREATEST(0.00, total_amount - discount_amount - scholarship_amount))
--     STORED
--
-- The audit reported it as "nullable with no default and no trigger,
-- so the balance renders as NaN". That was wrong: it has always been
-- computed by PostgreSQL. information_schema.columns does not surface a
-- generation expression, so the schema dump did not show it.
--
-- The consequence for migration 03: a generated column silently ignores
-- any assignment from a BEFORE trigger, so
--     NEW.net_amount := total + fine - discount - scholarship
-- was discarded, and the original expression, which predates
-- fine_amount and does not mention it, was used instead.
--
-- Effect: every late fee was dropped from the payable amount.
--     total 4000, discount 500, fine 100  ->  net 3500, not 3600
-- A parent would have been billed 100 short, and the fee would have
-- closed as fully paid while the late fee was never collected.
--
-- FIX
--   1. Redefine the generated expression to include fine_amount. This is
--      the right mechanism: PostgreSQL computes it on every write and no
--      code path can bypass it.
--   2. Stop assigning net_amount in the trigger. The trigger now only
--      derives `status`, computing the same expression locally because a
--      generated column is not yet populated during a BEFORE trigger.
--   3. Keep the explicit over-discount check. GREATEST(0.00, ...) clamps
--      a negative to zero, which would otherwise hide a discount larger
--      than the fee.
--
-- ROLLBACK: supabase_fees_migration_03d_rollback.sql
-- =====================================================================

BEGIN;

-- PostgreSQL 17 can redefine a generated expression in place; this
-- rewrites the table and recomputes every existing row.
ALTER TABLE public.student_fees
  ALTER COLUMN net_amount
  SET EXPRESSION AS (
    GREATEST(
      0.00,
      total_amount + fine_amount - discount_amount - scholarship_amount
    )
  );

COMMENT ON COLUMN public.student_fees.net_amount IS
  'Amount actually payable: total + fine - discount - scholarship, clamped at zero. GENERATED ALWAYS by PostgreSQL; it cannot be set by application code or by a trigger.';

CREATE OR REPLACE FUNCTION public.student_fees_compute_net()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
DECLARE
  -- net_amount is GENERATED, so it is not yet populated in a BEFORE
  -- trigger. The same expression is evaluated here purely to decide
  -- status; the stored value is still produced by PostgreSQL.
  v_total numeric(12,2) := coalesce(NEW.total_amount, 0);
  v_fine  numeric(12,2) := coalesce(NEW.fine_amount, 0);
  v_disc  numeric(12,2) := coalesce(NEW.discount_amount, 0);
  v_schol numeric(12,2) := coalesce(NEW.scholarship_amount, 0);
  v_paid  numeric(12,2) := coalesce(NEW.amount_paid, 0);
  v_net   numeric(12,2);
BEGIN
  IF (v_total + v_fine - v_disc - v_schol) < 0 THEN
    RAISE EXCEPTION
      'Discount and scholarship (%) exceed the fee plus late fee (%)',
      v_disc + v_schol, v_total + v_fine
      USING ERRCODE = 'check_violation';
  END IF;

  v_net := round(v_total + v_fine - v_disc - v_schol, 2);

  IF v_paid >= v_net AND v_net > 0 THEN
    NEW.status := 'paid';
  ELSIF v_paid > 0 THEN
    NEW.status := 'partial';
  ELSE
    NEW.status := 'pending';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS student_fees_compute_net ON public.student_fees;
CREATE TRIGGER student_fees_compute_net
  BEFORE INSERT OR UPDATE ON public.student_fees
  FOR EACH ROW EXECUTE FUNCTION public.student_fees_compute_net();

COMMIT;
