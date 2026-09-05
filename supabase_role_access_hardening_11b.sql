-- =====================================================================
-- MIGRATION 11b — exams / exam_subjects / report_templates: follow-up
-- =====================================================================
-- Migration 11 scoped marks/attendance/exam_results/co_scholastic write
-- access away from blanket is_staff() and removed the 'results.publish'
-- grant from teacher/class_teacher. But exams, exam_subjects and
-- report_templates (exam-term creation, subject-to-exam mapping, and
-- report-card template management — the "Exams & Teacher Mapping" and
-- config screens, admin/exam-office territory) were still gated by
-- is_staff(), which still includes plain teacher/class_teacher and every
-- other staff role. A teacher's "Create Exam Term" button would have
-- kept working at the database layer even after losing results.publish.
-- =====================================================================

BEGIN;

DROP POLICY IF EXISTS exams_staff_write ON public.exams;
CREATE POLICY exams_admin_write ON public.exams
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('results.publish'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('results.publish'));
-- exams_read (true) is unchanged — exam terms/dates are low-sensitivity
-- reference data everyone with a dashboard needs to see.

DROP POLICY IF EXISTS exam_subjects_staff_all ON public.exam_subjects;
CREATE POLICY exam_subjects_admin_write ON public.exam_subjects
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('results.publish'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('results.publish'));
CREATE POLICY exam_subjects_read ON public.exam_subjects
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS report_templates_staff_all ON public.report_templates;
CREATE POLICY report_templates_admin_write ON public.report_templates
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('results.publish'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('results.publish'));
CREATE POLICY report_templates_read ON public.report_templates
  FOR SELECT TO authenticated USING (true);

COMMIT;
