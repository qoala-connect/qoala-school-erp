-- §31: a teacher could read all 507 student records.
--
-- students_staff_select granted the whole roster to anything is_staff() covers,
-- which includes 'teacher' and 'class_teacher'. Marks and results were already
-- teacher-scoped (teacher_teaches_student_subject), but the student roster was
-- not, so a teacher could enumerate every child in the school.
--
-- Teachers are now scoped to the students in the class+section combinations
-- they hold an active assignment for (any subject, so class teachers keep the
-- full section). Every other staff role is unchanged.

BEGIN;

DROP POLICY IF EXISTS students_staff_select ON public.students;

CREATE POLICY students_staff_select
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN public.is_teacher() THEN public.teacher_teaches_student(id)
      ELSE (public.is_staff() OR public.auth_has_permission('student.list'))
    END
  );

COMMIT;
