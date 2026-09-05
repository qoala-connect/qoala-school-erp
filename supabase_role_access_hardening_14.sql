-- =====================================================================
-- MIGRATION 14 — Tighten Student Sub-Tables & Legacy Fees
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Legacy fees table: Gated to fees.collect / is_admin
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS fees_staff_all ON public.fees;
CREATE POLICY fees_manager_all ON public.fees
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('fees.collect'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('fees.collect'));
CREATE POLICY fees_read ON public.fees
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('fees.view'));

-- ---------------------------------------------------------------------
-- 2. student_documents: Read by staff/owner, write by admin/student.update
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS student_documents_staff_all ON public.student_documents;
CREATE POLICY student_documents_staff_select ON public.student_documents
  FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY student_documents_admin_write ON public.student_documents
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('student.update'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('student.update'));

-- ---------------------------------------------------------------------
-- 3. student_id_cards & student_cards: Read by staff/owner, write by admin/student.update
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS student_id_cards_staff_all ON public.student_id_cards;
CREATE POLICY student_id_cards_staff_select ON public.student_id_cards
  FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY student_id_cards_admin_write ON public.student_id_cards
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('student.update'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('student.update'));

DROP POLICY IF EXISTS student_cards_staff_all ON public.student_cards;
CREATE POLICY student_cards_staff_select ON public.student_cards
  FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY student_cards_admin_write ON public.student_cards
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('student.update'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('student.update'));

-- ---------------------------------------------------------------------
-- 4. student_medical: Read by staff/owner, write by admin/medical.manage
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS student_medical_staff_all ON public.student_medical;
CREATE POLICY student_medical_staff_select ON public.student_medical
  FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY student_medical_admin_write ON public.student_medical
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('medical.manage') OR public.auth_has_permission('student.update'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('medical.manage') OR public.auth_has_permission('student.update'));

-- ---------------------------------------------------------------------
-- 5. student_class_history & student_activity: Read by staff/owner, write by admin/student.update
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS student_class_history_staff_all ON public.student_class_history;
CREATE POLICY student_class_history_staff_select ON public.student_class_history
  FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY student_class_history_admin_write ON public.student_class_history
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('student.update'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('student.update'));

DROP POLICY IF EXISTS student_activity_staff_all ON public.student_activity;
CREATE POLICY student_activity_staff_select ON public.student_activity
  FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY student_activity_admin_write ON public.student_activity
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('student.update'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('student.update'));

-- ---------------------------------------------------------------------
-- 6. student_notes: Read by staff/owner, write by teachers/admin
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS student_notes_staff_all ON public.student_notes;
CREATE POLICY student_notes_staff_select ON public.student_notes
  FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY student_notes_staff_write ON public.student_notes
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_teacher() OR public.auth_has_permission('student.update'))
  WITH CHECK (public.is_admin() OR public.is_teacher() OR public.auth_has_permission('student.update'));

COMMIT;
