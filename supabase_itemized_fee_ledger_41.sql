-- =====================================================================
-- ITEMIZE fee billing for newly enrolled students
-- =====================================================================
-- Today every student gets ONE lumped "Composite Annual Fee" row per year:
-- the auto-ledger trigger sums every fee_structure line item for the class
-- into a single number, once, regardless of each category's own billing
-- frequency. There is no way to show "Tuition - Apr", "Tuition - May" or
-- any other per-head, per-period breakdown, because no such rows exist.
--
-- This migration replaces the generator (create_student_fee_ledger_for,
-- called by both the AFTER INSERT trigger on students and
-- backfill_student_fee_ledgers) with an itemized one: one student_fees row
-- per active fee_structure line item for the student's class, split into
-- one row per billing period:
--
--   frequency = 'Monthly'    -> 12 rows (one per month of the academic year)
--   frequency = 'Quarterly'  -> 4 rows  (one per quarter)
--   anything else            -> 1 row   (Annual / Term / Term-wise / One-time)
--
-- IMPORTANT - read before applying:
-- fee_structure.amount is now treated as the PER-PERIOD amount (what the old
-- generator already implied by billing it once with no multiplier). That
-- means a class's total annual liability goes UP for anyone billed under
-- this generator: a "Monthly PS1,100" head that used to contribute PS1,100
-- once a year now correctly contributes PS1,100 x 12 = PS13,200. Check every
-- Monthly/Quarterly amount in Fee Structure Master reads as "per month" /
-- "per quarter" before this goes live - if any of them were actually typed
-- as an annual total, halve/twelfth them there first.
--
-- SCOPE - deliberately narrow:
--   * Only ever fires for a student with ZERO existing student_fees rows for
--     the year (same guard the old generator used) - so it can NEVER touch
--     the 536 students who already have a lumped ledger with real payments.
--   * backfill_student_fee_ledgers() only picks up active students who still
--     have no ledger at all - same guarantee.
--   * No retrofit of existing ledgers is included here. If you want an
--     explicit, opt-in, one-student-at-a-time way to convert an existing
--     lumped ledger later, that is a separate, deliberate feature - ask for
--     it when you are ready; it is not part of this migration.
--
-- Safe to re-run: CREATE OR REPLACE + the same never-double-bill guard.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.create_student_fee_ledger_for(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s            students%ROWTYPE;
  v_year_id    uuid;
  v_struct_yr  uuid;      -- year whose fee_structure prices this student
  v_year_start date;
  v_due_base   date;      -- fallback due date for non-split (annual/term/etc) heads
  r            record;    -- one fee_structure line item, joined to its category
  v_periods    int;
  v_i          int;
  v_period_due date;
BEGIN
  SELECT * INTO s FROM students WHERE id = p_student_id;
  IF NOT FOUND OR COALESCE(s.status, 'active') <> 'active' THEN RETURN; END IF;

  v_year_id := s.academic_year_id;
  IF v_year_id IS NULL THEN
    SELECT id INTO v_year_id FROM academic_years WHERE name = s.academic_year;
  END IF;
  IF v_year_id IS NULL THEN
    SELECT id INTO v_year_id FROM academic_years WHERE is_current ORDER BY start_date DESC LIMIT 1;
  END IF;
  IF v_year_id IS NULL THEN RETURN; END IF;

  -- Never double-bill: ANY existing row for this student+year (lumped or
  -- itemized) means a ledger already exists. Leave it alone -- this is what
  -- keeps the 536 already-billed students untouched by this migration.
  IF EXISTS (SELECT 1 FROM student_fees WHERE student_id = s.id AND academic_year_id = v_year_id) THEN
    RETURN;
  END IF;

  -- Prefer the fee structure published for the student's own year; if that
  -- year has no structure yet, price off the current year's structure.
  v_struct_yr := v_year_id;
  IF NOT EXISTS (
    SELECT 1 FROM fee_structure f JOIN classes c ON c.id = f.class_id
    WHERE (f.class_id = s.class_id OR c.class_name = s.class) AND f.academic_year_id = v_struct_yr
  ) THEN
    SELECT id INTO v_struct_yr FROM academic_years WHERE is_current ORDER BY start_date DESC LIMIT 1;
  END IF;

  SELECT start_date INTO v_year_start FROM academic_years WHERE id = v_struct_yr;
  v_year_start := COALESCE(v_year_start, date_trunc('year', CURRENT_DATE)::date);

  -- Cohort-aligned due date for heads that are not split by period (mirrors
  -- the old generator's fallback).
  SELECT MAX(due_date) INTO v_due_base FROM student_fees WHERE academic_year_id = v_year_id;
  IF v_due_base IS NULL THEN
    v_due_base := v_year_start + 60;
  END IF;

  FOR r IN
    SELECT fc.id AS category_id, fc.frequency, fs.amount
    FROM fee_structure fs
    JOIN classes c ON c.id = fs.class_id
    JOIN fee_categories fc ON fc.id = fs.fee_category_id
    WHERE (fs.class_id = s.class_id OR c.class_name = s.class)
      AND fs.academic_year_id = v_struct_yr
      AND fc.is_active IS NOT FALSE
      AND fs.amount > 0          -- an unconfigured (0) head bills nothing, not 12 zero rows
  LOOP
    v_periods := CASE r.frequency
      WHEN 'Monthly'   THEN 12
      WHEN 'Quarterly' THEN 4
      ELSE 1
    END;

    FOR v_i IN 0 .. v_periods - 1 LOOP
      v_period_due := CASE v_periods
        WHEN 12 THEN (v_year_start + (v_i || ' months')::interval)::date
        WHEN 4  THEN (v_year_start + ((v_i * 3) || ' months')::interval)::date
        ELSE v_due_base
      END;

      INSERT INTO student_fees (
        student_id, fee_category_id, total_amount, discount_amount,
        scholarship_amount, fine_amount, amount_paid,
        due_date, status, academic_year_id
      ) VALUES (
        s.id, r.category_id, r.amount, 0, 0, 0, 0,
        v_period_due, 'pending', v_year_id
      );
    END LOOP;
  END LOOP;

  -- No fee_structure at all for this class -> nothing inserted; the student
  -- stays unbilled until an admin publishes one and re-runs the backfill.
END;
$$;

-- The trigger function now just delegates -- one generator, one behaviour,
-- whether it's a fresh enrollment or the backfill sweep below.
CREATE OR REPLACE FUNCTION public.create_student_fee_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(NEW.status, 'active') = 'active' THEN
    PERFORM public.create_student_fee_ledger_for(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger wiring unchanged -- still AFTER INSERT on students, still only
-- ever fires for a brand-new row.
DROP TRIGGER IF EXISTS trg_create_student_fee_ledger ON public.students;
CREATE TRIGGER trg_create_student_fee_ledger
AFTER INSERT ON public.students
FOR EACH ROW EXECUTE FUNCTION public.create_student_fee_ledger();

REVOKE ALL ON FUNCTION public.create_student_fee_ledger_for(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_student_fee_ledger_for(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- Verify: run this against a class that has a published fee structure, on
-- a throwaway/test student with no ledger yet, to see the itemized rows
-- land before relying on it for real admissions.
--
--   select public.create_student_fee_ledger_for('<test-student-uuid>');
--   select fc.category_name, fc.frequency, sf.total_amount, sf.due_date
--   from public.student_fees sf join public.fee_categories fc on fc.id = sf.fee_category_id
--   where sf.student_id = '<test-student-uuid>' order by fc.category_name, sf.due_date;
-- ---------------------------------------------------------------------
