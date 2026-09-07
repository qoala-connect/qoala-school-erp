-- =====================================================================
-- GRANT TEACHERS READ-ONLY VISIBILITY INTO STUDENT FEES
-- =====================================================================
-- By request: a teacher opening a student's 360 profile should see the
-- real fee balance, not be blocked from it. Previously neither 'teacher'
-- nor 'class_teacher' held fees.view, so student_fees_staff_read (RLS)
-- returned zero rows for them with no error — which the UI then read as
-- "confirmed zero due" instead of "not visible to this role"
-- (Student360Drawer.tsx now distinguishes the two, gated on fees.view,
-- but the honest fix is giving teachers real visibility rather than
-- hiding the section from them).
--
-- fees.view is READ-ONLY: the separate fees.collect permission is what
-- gates actually recording a payment (fee_payments_staff_write,
-- student_fees_staff_update), and neither role gets that here. A teacher
-- can now see what a student owes; only admin/office/accountant/
-- principal/vice_principal can still collect or modify it.
--
-- This also surfaces the sidebar's "Financials" section for teachers
-- (Fee Overview & Hub, Fee Structure Master, Recent Transactions, Fee
-- Reports & Overdues all key off fees.view) — "Fee Collection & Ledgers"
-- stays hidden since that item is gated on fees.collect specifically.
-- =====================================================================

INSERT INTO public.role_permissions (role, permission)
VALUES
  ('teacher', 'fees.view'),
  ('class_teacher', 'fees.view')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------
SELECT role, permission FROM public.role_permissions
WHERE permission = 'fees.view'
ORDER BY role;
