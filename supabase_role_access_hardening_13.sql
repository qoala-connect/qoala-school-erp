-- =====================================================================
-- MIGRATION 13 — Complete Teacher & Student Security Lockdown
-- =====================================================================
-- 1. Revoke 'teacher.view' from 'teacher' and 'class_teacher' roles.
-- 2. Scoped table writes away from blanket is_staff() to explicit perms:
--    - admissions: student.create / is_admin
--    - assets, inventory: inventory.manage / is_admin
--    - certificates: certificates.manage / is_admin
--    - documents: documents.manage / is_admin
--    - drivers, vehicles, transport_routes, student_transport: transport.manage / is_admin
--    - front_office_logs: front_office.manage / is_admin
--    - grading_rules: results.publish / is_admin
--    - hostels: hostel.manage / is_admin
--    - library_books, book_issues: library.manage / is_admin
--    - rooms: academics.manage / is_admin
--    - student_promotions, student_transfers, student_alumni: student.update / is_admin
--    - teachers: restrict select to teacher.view / is_admin or own profile
--    - teacher_assignments: restrict select to teacher.view / is_admin or own assignments
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Remove 'teacher.view' from teacher & class_teacher in role_permissions
-- ---------------------------------------------------------------------
DELETE FROM public.role_permissions 
WHERE role IN ('teacher', 'class_teacher') 
  AND permission = 'teacher.view';

-- ---------------------------------------------------------------------
-- 2. Tighten 'teachers' and 'teacher_assignments' read access
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS teachers_staff_select ON public.teachers;
CREATE POLICY teachers_staff_select ON public.teachers
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.auth_has_permission('teacher.view')
    OR user_id = auth.uid()
    OR id = auth.uid()
  );

DROP POLICY IF EXISTS teacher_assignments_staff_select ON public.teacher_assignments;
CREATE POLICY teacher_assignments_staff_select ON public.teacher_assignments
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.auth_has_permission('teacher.view')
    OR teacher_id = public.get_current_teacher_id()
  );

-- ---------------------------------------------------------------------
-- 3. Admissions: Staff write locked to student.create / is_admin
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS admissions_staff_all ON public.admissions;

CREATE POLICY admissions_staff_read ON public.admissions
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('student.create') OR public.auth_has_permission('front_office.manage'));

CREATE POLICY admissions_staff_write ON public.admissions
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('student.create'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('student.create'));

-- ---------------------------------------------------------------------
-- 4. Inventory & Assets: Locked to inventory.manage / is_admin
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS assets_staff_all ON public.assets;
CREATE POLICY assets_manager_all ON public.assets
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('inventory.manage'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('inventory.manage'));

DROP POLICY IF EXISTS inventory_staff_all ON public.inventory;
CREATE POLICY inventory_manager_all ON public.inventory
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('inventory.manage'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('inventory.manage'));

-- ---------------------------------------------------------------------
-- 5. Certificates & Documents: Locked to certificates.manage / documents.manage
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS certificates_staff_all ON public.certificates;
CREATE POLICY certificates_manager_all ON public.certificates
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('certificates.manage'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('certificates.manage'));

DROP POLICY IF EXISTS documents_staff_all ON public.documents;
CREATE POLICY documents_manager_all ON public.documents
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('documents.manage'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('documents.manage'));

-- ---------------------------------------------------------------------
-- 6. Transport: Locked to transport.manage / is_admin
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS transport_routes_staff_all ON public.transport_routes;
CREATE POLICY transport_routes_manager_all ON public.transport_routes
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('transport.manage'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('transport.manage'));

DROP POLICY IF EXISTS drivers_staff_all ON public.drivers;
CREATE POLICY drivers_manager_all ON public.drivers
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('transport.manage'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('transport.manage'));

DROP POLICY IF EXISTS vehicles_staff_all ON public.vehicles;
CREATE POLICY vehicles_manager_all ON public.vehicles
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('transport.manage'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('transport.manage'));

DROP POLICY IF EXISTS student_transport_staff_all ON public.student_transport;
CREATE POLICY student_transport_manager_all ON public.student_transport
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('transport.manage'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('transport.manage'));

-- ---------------------------------------------------------------------
-- 7. Library: Locked to library.manage / is_admin
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS library_books_staff_all ON public.library_books;
CREATE POLICY library_books_manager_all ON public.library_books
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('library.manage'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('library.manage'));

DROP POLICY IF EXISTS book_issues_staff_all ON public.book_issues;
CREATE POLICY book_issues_manager_all ON public.book_issues
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('library.manage'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('library.manage'));

-- ---------------------------------------------------------------------
-- 8. Front Office & Hostels: Locked to respective manager perms
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS front_office_logs_staff_all ON public.front_office_logs;
CREATE POLICY front_office_logs_manager_all ON public.front_office_logs
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('front_office.manage'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('front_office.manage'));

DROP POLICY IF EXISTS hostels_staff_all ON public.hostels;
CREATE POLICY hostels_manager_all ON public.hostels
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('hostel.manage'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('hostel.manage'));

-- ---------------------------------------------------------------------
-- 9. Grading Rules & Rooms
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS grading_rules_staff_all ON public.grading_rules;
CREATE POLICY grading_rules_admin_write ON public.grading_rules
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('results.publish'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('results.publish'));
CREATE POLICY grading_rules_read ON public.grading_rules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS rooms_staff_all ON public.rooms;
CREATE POLICY rooms_admin_all ON public.rooms
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('academics.manage'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('academics.manage'));

-- ---------------------------------------------------------------------
-- 10. Student Promotions, Transfers, Alumni: Locked to student.update / is_admin
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS student_promotions_staff_all ON public.student_promotions;
CREATE POLICY student_promotions_admin_all ON public.student_promotions
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('student.update'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('student.update'));

DROP POLICY IF EXISTS student_transfers_staff_all ON public.student_transfers;
CREATE POLICY student_transfers_admin_all ON public.student_transfers
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('student.update'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('student.update'));

DROP POLICY IF EXISTS student_alumni_staff_all ON public.student_alumni;
CREATE POLICY student_alumni_admin_all ON public.student_alumni
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.auth_has_permission('student.update'))
  WITH CHECK (public.is_admin() OR public.auth_has_permission('student.update'));

COMMIT;
