-- =====================================================================
-- Auto-create a fee ledger when a student is enrolled.
--
-- Problem: the Fees "Student Fee Directory" is built from student_fees
-- rows (FeesPortal.tsx derives its student list from the fee records,
-- not from the students table). Enrolling a student inserts into
-- students only -- neither approve_admission() nor create_student()
-- touches student_fees -- so a newly enrolled student is invisible in
-- the Fees module until someone creates a ledger by hand.
--
-- Fix: a trigger on students that generates the ledger row, mirroring
-- the convention every existing row already follows (one row per
-- student, "Composite Annual Fee" category, amount = the sum of the
-- admin-configured fee_structure line items for that class + year).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.create_student_fee_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_year_id   uuid;
  v_amount_yr uuid;
  v_total     numeric;
  v_category  uuid;
  v_due       date;
BEGIN
  -- Only active enrollments get billed.
  IF COALESCE(NEW.status, 'active') <> 'active' THEN
    RETURN NEW;
  END IF;

  -- Resolve the student's academic year (text name -> uuid), falling
  -- back to the school's current year when the student carries none.
  v_year_id := NEW.academic_year_id;
  IF v_year_id IS NULL THEN
    SELECT id INTO v_year_id FROM academic_years WHERE name = NEW.academic_year;
  END IF;
  IF v_year_id IS NULL THEN
    SELECT id INTO v_year_id FROM academic_years WHERE is_current ORDER BY start_date DESC LIMIT 1;
  END IF;
  IF v_year_id IS NULL THEN
    RETURN NEW;  -- no academic year configured; nothing to bill against
  END IF;

  -- Never double-bill: skip if this student already has a ledger for the year.
  IF EXISTS (
    SELECT 1 FROM student_fees
    WHERE student_id = NEW.id AND academic_year_id = v_year_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Prefer the fee structure published for the student's own year; if that
  -- year has no structure yet, price off the current year's structure.
  v_amount_yr := v_year_id;
  IF NOT EXISTS (
    SELECT 1 FROM fee_structure f JOIN classes c ON c.id = f.class_id
    WHERE (f.class_id = NEW.class_id OR c.class_name = NEW.class) AND f.academic_year_id = v_amount_yr
  ) THEN
    SELECT id INTO v_amount_yr FROM academic_years WHERE is_current ORDER BY start_date DESC LIMIT 1;
  END IF;

  SELECT COALESCE(SUM(f.amount), 0) INTO v_total
  FROM fee_structure f
  JOIN classes c ON c.id = f.class_id
  WHERE (f.class_id = NEW.class_id OR c.class_name = NEW.class) AND f.academic_year_id = v_amount_yr;

  -- No fee structure for this class at all -> leave the student unbilled
  -- rather than inventing an amount. Admin publishes the structure, then
  -- backfill_student_fee_ledgers() picks them up.
  IF v_total IS NULL OR v_total <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_category FROM fee_categories WHERE category_name = 'Composite Annual Fee' LIMIT 1;
  IF v_category IS NULL THEN
    SELECT id INTO v_category FROM fee_categories ORDER BY category_name LIMIT 1;
  END IF;
  IF v_category IS NULL THEN
    RETURN NEW;
  END IF;

  -- Align the due date with the cohort already billed for that year.
  SELECT MAX(due_date) INTO v_due FROM student_fees WHERE academic_year_id = v_year_id;
  IF v_due IS NULL THEN
    SELECT start_date + 60 INTO v_due FROM academic_years WHERE id = v_year_id;
  END IF;
  v_due := COALESCE(v_due, CURRENT_DATE + 30);

  INSERT INTO student_fees (
    student_id, fee_category_id, total_amount, discount_amount,
    scholarship_amount, fine_amount, amount_paid,
    due_date, status, academic_year_id
  ) VALUES (
    NEW.id, v_category, v_total, 0, 0, 0, 0,
    v_due, 'pending', v_year_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_student_fee_ledger ON public.students;
CREATE TRIGGER trg_create_student_fee_ledger
AFTER INSERT ON public.students
FOR EACH ROW EXECUTE FUNCTION public.create_student_fee_ledger();

-- ---------------------------------------------------------------------
-- Backfill: bill every active student who has no ledger for their year.
-- Safe to re-run; also the recovery path after an admin publishes a fee
-- structure for a class that previously had none.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.backfill_student_fee_ledgers()
RETURNS TABLE (student_id uuid, student_name text, class text, billed numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT s.* FROM students s
    WHERE COALESCE(s.status, 'active') = 'active'
      AND NOT EXISTS (SELECT 1 FROM student_fees f WHERE f.student_id = s.id)
    ORDER BY s.created_at
  LOOP
    PERFORM public.create_student_fee_ledger_for(r.id);
  END LOOP;

  RETURN QUERY
  SELECT s.id, s.name::text, s.class::text, sf.net_amount
  FROM students s
  JOIN student_fees sf ON sf.student_id = s.id
  WHERE sf.created_at > now() - interval '1 minute';
END;
$$;

-- Reuse the trigger body for an existing row by replaying it as an insert-shaped call.
CREATE OR REPLACE FUNCTION public.create_student_fee_ledger_for(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_year_id   uuid;
  v_amount_yr uuid;
  v_total     numeric;
  v_category  uuid;
  v_due       date;
  s           students%ROWTYPE;
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

  IF EXISTS (SELECT 1 FROM student_fees WHERE student_id = s.id AND academic_year_id = v_year_id) THEN
    RETURN;
  END IF;

  v_amount_yr := v_year_id;
  IF NOT EXISTS (
    SELECT 1 FROM fee_structure f JOIN classes c ON c.id = f.class_id
    WHERE (f.class_id = s.class_id OR c.class_name = s.class) AND f.academic_year_id = v_amount_yr
  ) THEN
    SELECT id INTO v_amount_yr FROM academic_years WHERE is_current ORDER BY start_date DESC LIMIT 1;
  END IF;

  SELECT COALESCE(SUM(f.amount), 0) INTO v_total
  FROM fee_structure f JOIN classes c ON c.id = f.class_id
  WHERE (f.class_id = s.class_id OR c.class_name = s.class) AND f.academic_year_id = v_amount_yr;
  IF v_total IS NULL OR v_total <= 0 THEN RETURN; END IF;

  SELECT id INTO v_category FROM fee_categories WHERE category_name = 'Composite Annual Fee' LIMIT 1;
  IF v_category IS NULL THEN
    SELECT id INTO v_category FROM fee_categories ORDER BY category_name LIMIT 1;
  END IF;
  IF v_category IS NULL THEN RETURN; END IF;

  SELECT MAX(due_date) INTO v_due FROM student_fees WHERE academic_year_id = v_year_id;
  IF v_due IS NULL THEN
    SELECT start_date + 60 INTO v_due FROM academic_years WHERE id = v_year_id;
  END IF;
  v_due := COALESCE(v_due, CURRENT_DATE + 30);

  INSERT INTO student_fees (
    student_id, fee_category_id, total_amount, discount_amount,
    scholarship_amount, fine_amount, amount_paid,
    due_date, status, academic_year_id
  ) VALUES (
    s.id, v_category, v_total, 0, 0, 0, 0, v_due, 'pending', v_year_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_student_fee_ledgers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.backfill_student_fee_ledgers() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_student_fee_ledger_for(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_student_fee_ledger_for(uuid) TO authenticated, service_role;

SELECT * FROM public.backfill_student_fee_ledgers();
