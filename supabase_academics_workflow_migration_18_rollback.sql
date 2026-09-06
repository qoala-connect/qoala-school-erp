-- =====================================================================
-- ROLLBACK — MIGRATION 18 (Academics teaching & learning workflow)
-- =====================================================================
--
-- Reverses 18a / 18b / 18c. Drops the new tables, the added columns,
-- the added policies, the read-model functions and the two permission
-- grants, and restores the pre-18 RLS policies on lesson_plans,
-- assignments and student_assignment_submissions.
--
-- Data in syllabus_* and in the added columns is lost. The legacy
-- text columns on assignments (class, section) are untouched throughout,
-- so nothing that read them before is affected by the rollback.
-- =====================================================================

BEGIN;

-- ---- 18e: restore save_attendance() without the teacher-scope guard
CREATE OR REPLACE FUNCTION public.save_attendance(
  _attendance_date date, _class text, _section text, _records jsonb
)
RETURNS TABLE(saved integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  year_id uuid := (SELECT id FROM public.academic_years WHERE is_current LIMIT 1);
  actor   uuid := auth.uid();
  n       integer;
BEGIN
  IF NOT public.auth_has_permission('attendance.manage') THEN
    RAISE EXCEPTION 'You do not have permission to record attendance' USING ERRCODE = '42501';
  END IF;
  IF _attendance_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Attendance cannot be recorded for a future date' USING ERRCODE = 'check_violation';
  END IF;
  IF _records IS NULL OR jsonb_array_length(_records) = 0 THEN
    RAISE EXCEPTION 'No attendance records were supplied' USING ERRCODE = 'no_data_found';
  END IF;
  WITH incoming AS (
    SELECT (r->>'student_id')::uuid AS student_id, r->>'status' AS status, nullif(r->>'remarks','') AS remarks
    FROM jsonb_array_elements(_records) AS r
  ),
  upserted AS (
    INSERT INTO public.attendance AS a
      (student_id, attendance_date, status, class, section, academic_year_id, marked_by, remarks)
    SELECT i.student_id, _attendance_date, i.status, _class, _section, year_id, actor, i.remarks
    FROM incoming i JOIN public.students s ON s.id = i.student_id
    ON CONFLICT (student_id, attendance_date) DO UPDATE
      SET status = EXCLUDED.status, class = EXCLUDED.class, section = EXCLUDED.section,
          academic_year_id = EXCLUDED.academic_year_id, marked_by = EXCLUDED.marked_by,
          remarks = EXCLUDED.remarks, updated_at = now()
    RETURNING 1
  )
  SELECT count(*)::int INTO n FROM upserted;
  INSERT INTO public.audit_logs (user_id, user_email, action_type, table_name, new_values)
  VALUES (actor, (SELECT email FROM public.profiles WHERE id = actor),
    'ATTENDANCE_SAVED', 'attendance',
    jsonb_build_object('date', _attendance_date, 'class', _class, 'section', _section, 'records', n));
  RETURN QUERY SELECT n;
END;
$function$;

-- ---- 18d: covering indexes -----------------------------------------
DROP INDEX IF EXISTS public.idx_assignments_section_id;
DROP INDEX IF EXISTS public.idx_lesson_plans_section_id;
DROP INDEX IF EXISTS public.idx_submissions_reviewed_by;

-- ---- 18c: read-model functions ---------------------------------------
DROP FUNCTION IF EXISTS public.student_academic_dashboard(uuid);
DROP FUNCTION IF EXISTS public.admin_academic_monitor(uuid, date);
DROP FUNCTION IF EXISTS public.teacher_academic_summary(uuid, uuid, date);
DROP FUNCTION IF EXISTS public.teacher_class_workspace(uuid, uuid, uuid, uuid, uuid, date);
DROP FUNCTION IF EXISTS public.teacher_today_classes(uuid, date);
DROP FUNCTION IF EXISTS public.admin_syllabus_by_subject(uuid);
DROP FUNCTION IF EXISTS public.academics_syllabus_coverage(uuid);
DROP FUNCTION IF EXISTS public.academics_syllabus_tree(uuid, uuid, uuid, uuid);

-- ---- 18b: policies on the new tables --------------------------------
DROP POLICY IF EXISTS syllabus_units_read           ON public.syllabus_units;
DROP POLICY IF EXISTS syllabus_units_admin_write    ON public.syllabus_units;
DROP POLICY IF EXISTS syllabus_chapters_read        ON public.syllabus_chapters;
DROP POLICY IF EXISTS syllabus_chapters_admin_write ON public.syllabus_chapters;
DROP POLICY IF EXISTS syllabus_topics_read          ON public.syllabus_topics;
DROP POLICY IF EXISTS syllabus_topics_admin_write   ON public.syllabus_topics;
DROP POLICY IF EXISTS syllabus_progress_read          ON public.syllabus_progress;
DROP POLICY IF EXISTS syllabus_progress_admin_write   ON public.syllabus_progress;
DROP POLICY IF EXISTS syllabus_progress_teacher_write ON public.syllabus_progress;

-- ---- 18b: restore lesson_plans to its pre-18 policies --------------
DROP POLICY IF EXISTS lesson_plans_read        ON public.lesson_plans;
DROP POLICY IF EXISTS lesson_plans_admin_all   ON public.lesson_plans;
DROP POLICY IF EXISTS lesson_plans_teacher_own ON public.lesson_plans;
CREATE POLICY lesson_plans_academics_read ON public.lesson_plans
  FOR SELECT TO authenticated USING (true);
CREATE POLICY lesson_plans_academics_write ON public.lesson_plans
  FOR ALL TO authenticated
  USING (auth_has_permission('academics.manage'))
  WITH CHECK (auth_has_permission('academics.manage'));

-- ---- 18b: restore assignments to its pre-18 policies --------------
DROP POLICY IF EXISTS assignments_staff_read   ON public.assignments;
DROP POLICY IF EXISTS assignments_student_read ON public.assignments;
DROP POLICY IF EXISTS assignments_parent_read  ON public.assignments;
DROP POLICY IF EXISTS assignments_admin_all    ON public.assignments;
DROP POLICY IF EXISTS assignments_teacher_own  ON public.assignments;
CREATE POLICY assignments_read ON public.assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY assignments_staff_write ON public.assignments
  FOR ALL TO authenticated
  USING (is_admin() OR is_teacher())
  WITH CHECK (is_admin() OR is_teacher());

-- ---- 18b: restore student_assignment_submissions staff policy -----
DROP POLICY IF EXISTS student_assignment_submissions_admin_all     ON public.student_assignment_submissions;
DROP POLICY IF EXISTS student_assignment_submissions_teacher_scope ON public.student_assignment_submissions;
CREATE POLICY student_assignment_submissions_staff_all ON public.student_assignment_submissions
  FOR ALL TO authenticated
  USING (is_admin() OR is_teacher())
  WITH CHECK (is_admin() OR is_teacher());

-- ---- 18a: triggers and helper --------------------------------------
DROP TRIGGER  IF EXISTS trg_assignments_sync_keys ON public.assignments;
DROP FUNCTION IF EXISTS public.fn_assignments_sync_keys();

-- ---- 18a: added columns ------------------------------------------------
ALTER TABLE public.student_assignment_submissions
  DROP CONSTRAINT IF EXISTS student_assignment_submissions_status_check,
  DROP COLUMN IF EXISTS reviewed_at,
  DROP COLUMN IF EXISTS reviewed_by;

ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_kind_check,
  DROP CONSTRAINT IF EXISTS assignments_status_check,
  DROP COLUMN IF EXISTS kind,
  DROP COLUMN IF EXISTS assigned_date,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS academic_year_id,
  DROP COLUMN IF EXISTS class_id,
  DROP COLUMN IF EXISTS section_id,
  DROP COLUMN IF EXISTS created_by;

ALTER TABLE public.lesson_plans
  DROP CONSTRAINT IF EXISTS lesson_plans_status_check,
  DROP COLUMN IF EXISTS section_id,
  DROP COLUMN IF EXISTS academic_year_id,
  DROP COLUMN IF EXISTS chapter_id,
  DROP COLUMN IF EXISTS duration_minutes,
  DROP COLUMN IF EXISTS teaching_method,
  DROP COLUMN IF EXISTS resources,
  DROP COLUMN IF EXISTS homework_text,
  DROP COLUMN IF EXISTS outcome_notes,
  DROP COLUMN IF EXISTS created_by;

ALTER TABLE public.timetable DROP COLUMN IF EXISTS room_no;

-- ---- 18a: new tables -------------------------------------------------
DROP TABLE IF EXISTS public.syllabus_progress;
DROP TABLE IF EXISTS public.syllabus_topics;
DROP TABLE IF EXISTS public.syllabus_chapters;
DROP TABLE IF EXISTS public.syllabus_units;

-- ---- 18a: permission grants ---------------------------------------
DELETE FROM public.role_permissions WHERE permission IN ('academics.teach', 'academics.view');

COMMIT;
