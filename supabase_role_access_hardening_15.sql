-- =====================================================================
-- MIGRATION 15 — fee_payments / leave_requests wide-open RLS, receipt
-- counters, online_classes read/write split, teacher self-reactivation
-- guard, and atomic employee_id generation
-- =====================================================================
-- WHY
--   A follow-up audit (live login test + fresh full test-suite run +
--   direct inspection of pg_policies, not just prior migration file
--   text) found:
--
--   1. fee_payments still carries policy_admin_all_fee_payments —
--      USING (true) WITH CHECK (true) FOR ALL TO authenticated. ANY
--      signed-in user (a student, a parent, anyone) can currently read
--      every family's payment history and INSERT fake payment rows
--      directly, bypassing collect_fee() and its permission/receipt
--      logic entirely. This is worse than "accountants locked out" —
--      it is wide open.
--
--   2. leave_requests has the identical problem: policy_admin_all_
--      leave_requests is USING (true) WITH CHECK (true) FOR ALL. Any
--      authenticated user can read or write any other person's leave
--      request. Teachers marking the attendance register also have no
--      scoped way to see approved leaves (they'd need is_staff(), not
--      "true for everyone").
--
--   3. supabase_role_access_hardening_11.sql already wrote the correct
--      fee_payments / online_classes / teacher self-update-guard fixes,
--      but this file cannot confirm from here whether hardening_11-14
--      were ever applied live (a prior audit noted dashboard edits had
--      already drifted from tracked migration history once before).
--      Everything below is written DROP-IF-EXISTS / CREATE-OR-REPLACE
--      so it converges to the correct end state regardless of what, if
--      anything, already landed.
--
--   4. receipt_counters' policies (hardening_12) and the teacher guard
--      trigger (hardening_11, named teachers_guard_self_update) exist
--      under different identifiers than the ones this project's own
--      test suite checks for. Re-declared here under the canonical
--      names so the suite is a real regression guard going forward.
--
--   5. teacherService.ts generated employee_id from an in-memory
--      `SELECT id, {count:'exact'}` row count — classic TOCTOU race
--      under concurrent hiring. Replaced with a sequence-backed
--      SECURITY DEFINER function, seeded past the highest existing
--      TCH-#### value so it can't collide with data already assigned.
--
-- WHAT THIS DOES
--   Additive/idempotent only: DROP POLICY IF EXISTS + CREATE POLICY,
--   CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS + CREATE TRIGGER.
--   No table or column is dropped, no existing row is touched.
--
-- ROLLBACK
--   Reversible by re-creating the previous policy bodies recorded in
--   supabase_additive_migration.sql (fee_payments, leave_requests) and
--   supabase_role_access_hardening_11.sql/12.sql (online_classes,
--   receipt_counters, teacher guard).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. fee_payments — close the wide-open policy for real
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "policy_admin_all_fee_payments" ON public.fee_payments;
DROP POLICY IF EXISTS policy_admin_all_fee_payments ON public.fee_payments;
DROP POLICY IF EXISTS "fee_payments_admin_all" ON public.fee_payments;
DROP POLICY IF EXISTS fee_payments_admin_all ON public.fee_payments;
DROP POLICY IF EXISTS "fee_payments_staff_write" ON public.fee_payments;
DROP POLICY IF EXISTS fee_payments_staff_write ON public.fee_payments;
DROP POLICY IF EXISTS "fee_payments_staff_read" ON public.fee_payments;
DROP POLICY IF EXISTS fee_payments_staff_read ON public.fee_payments;
DROP POLICY IF EXISTS "fee_payments_staff_all" ON public.fee_payments;
DROP POLICY IF EXISTS "fee_payments_owner_select" ON public.fee_payments;

CREATE POLICY "fee_payments_staff_all" ON public.fee_payments
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('fees.collect'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('fees.collect'));

CREATE POLICY "fee_payments_staff_read" ON public.fee_payments
  FOR SELECT TO authenticated
  USING (public.auth_has_permission('fees.view'));

-- Student/parent ledger read — joins through student_fees to the
-- authenticated student's own row (sf.id = fee_payments.student_fee_id)
-- or, for a parent, any student sharing their family_id.
CREATE POLICY "fee_payments_owner_select" ON public.fee_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.student_fees sf
      JOIN public.students s ON s.id = sf.student_id
      WHERE sf.id = fee_payments.student_fee_id
        AND (
          s.user_id = auth.uid()
          OR s.family_id IN (SELECT p.family_id FROM public.parents p WHERE p.user_id = auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------------
-- 2. leave_requests — close the wide-open policy, add staff read for
--    the attendance register and an applicant self-service policy
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "policy_admin_all_leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS policy_admin_all_leave_requests ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_admin_all" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_staff_select" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_owner_all" ON public.leave_requests;

CREATE POLICY "leave_requests_admin_all" ON public.leave_requests
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Any staff role (not just admins) can read leave requests — this is
-- what lets a teacher see approved leaves while marking attendance.
CREATE POLICY "leave_requests_staff_select" ON public.leave_requests
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- The applicant themself (student, teacher, or non-teaching staff)
-- can view and submit their own request.
CREATE POLICY "leave_requests_owner_all" ON public.leave_requests
  FOR ALL TO authenticated
  USING (
    applicant_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
      UNION
      SELECT id FROM public.teachers WHERE user_id = auth.uid()
      UNION
      SELECT id FROM public.staff WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    applicant_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
      UNION
      SELECT id FROM public.teachers WHERE user_id = auth.uid()
      UNION
      SELECT id FROM public.staff WHERE user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 3. receipt_counters — re-declare under the canonical policy names
-- ---------------------------------------------------------------------

ALTER TABLE public.receipt_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receipt_counters_admin_all" ON public.receipt_counters;
CREATE POLICY "receipt_counters_admin_all" ON public.receipt_counters
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('fees.collect'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('fees.collect'));

DROP POLICY IF EXISTS "receipt_counters_staff_read" ON public.receipt_counters;
CREATE POLICY "receipt_counters_staff_read" ON public.receipt_counters
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- ---------------------------------------------------------------------
-- 4. online_classes — split read from write, drop the old ALL/true
--    policy under its exact historical name so the suite can confirm
--    it is gone
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "online_classes_staff_all" ON public.online_classes;
DROP POLICY IF EXISTS online_classes_staff_all ON public.online_classes;
DROP POLICY IF EXISTS "online_classes_read" ON public.online_classes;
DROP POLICY IF EXISTS "online_classes_read_enrolled" ON public.online_classes;
DROP POLICY IF EXISTS "online_classes_staff_insert" ON public.online_classes;
DROP POLICY IF EXISTS "online_classes_staff_update" ON public.online_classes;
DROP POLICY IF EXISTS "online_classes_staff_delete" ON public.online_classes;

-- Read stays broad for any authenticated user: class links/schedules are
-- low-sensitivity, and the route already requires academics.view. What
-- was actually broken was WRITE being open to everyone too.
CREATE POLICY "online_classes_read_enrolled" ON public.online_classes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "online_classes_staff_insert" ON public.online_classes
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "online_classes_staff_update" ON public.online_classes
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "online_classes_staff_delete" ON public.online_classes
  FOR DELETE TO authenticated USING (public.is_staff());

-- ---------------------------------------------------------------------
-- 5. disciplinary_records — student/parent self-read, scoped by family
--    (tightens the owner-select hardening_12 already added)
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "disciplinary_staff_all" ON public.disciplinary_records;
DROP POLICY IF EXISTS disciplinary_staff_all ON public.disciplinary_records;
CREATE POLICY "disciplinary_records_staff_all" ON public.disciplinary_records
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "disciplinary_records_owner_select" ON public.disciplinary_records;
CREATE POLICY "disciplinary_records_owner_select" ON public.disciplinary_records
  FOR SELECT TO authenticated
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.user_id = auth.uid()
         OR s.family_id IN (SELECT p.family_id FROM public.parents p WHERE p.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "front_office_staff_all" ON public.front_office_logs;
DROP POLICY IF EXISTS front_office_staff_all ON public.front_office_logs;
CREATE POLICY "front_office_logs_staff_all" ON public.front_office_logs
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ---------------------------------------------------------------------
-- 6. teachers — self-reactivation / self-escalation guard under the
--    canonical function and trigger names
-- ---------------------------------------------------------------------

DROP TRIGGER IF EXISTS teachers_guard_self_update ON public.teachers;
DROP TRIGGER IF EXISTS trigger_guard_teacher_update ON public.teachers;
DROP FUNCTION IF EXISTS public.guard_teacher_self_update();

CREATE OR REPLACE FUNCTION public.guard_teacher_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.designation IS DISTINCT FROM OLD.designation
       OR NEW.department IS DISTINCT FROM OLD.department
       OR NEW.department_id IS DISTINCT FROM OLD.department_id
       OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
       OR NEW.cbse_teaching_level IS DISTINCT FROM OLD.cbse_teaching_level
    THEN
      RAISE EXCEPTION
        'Only an administrator may change employment status, designation, department or employee ID'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_guard_teacher_update
  BEFORE UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.guard_teacher_profile_update();

-- ---------------------------------------------------------------------
-- 7. Atomic teacher employee_id generation — replaces the client-side
--    in-memory row count in teacherService.ts (a race condition under
--    concurrent hiring) with a sequence-backed RPC.
-- ---------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.teacher_employee_id_seq;

-- Seed the sequence past the highest already-assigned TCH-#### value so
-- this migration can never collide with existing employee_id data.
SELECT setval(
  'public.teacher_employee_id_seq',
  COALESCE(
    (SELECT max(substring(employee_id FROM 'TCH-(\d+)')::int)
     FROM public.teachers
     WHERE employee_id ~ '^TCH-\d+$'),
    0
  ) + 1,
  false
);

CREATE OR REPLACE FUNCTION public.next_employee_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 'TCH-' || lpad(nextval('public.teacher_employee_id_seq')::text, 4, '0');
$$;

REVOKE ALL ON FUNCTION public.next_employee_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_employee_id() TO authenticated;

COMMIT;
