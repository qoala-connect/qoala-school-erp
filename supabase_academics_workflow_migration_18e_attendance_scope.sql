-- =====================================================================
-- MIGRATION 18e — SCOPE save_attendance() TO THE TEACHER'S OWN CLASSES
-- =====================================================================
--
-- THE DEFECT THIS CLOSES
--
--   save_attendance() is SECURITY DEFINER and gated only on
--   auth_has_permission('attendance.manage'). Every teacher and
--   class_teacher holds that permission, so any of them could record or
--   overwrite attendance for ANY class in the school by calling the RPC
--   directly with a different _class / _section — the row level security
--   on the attendance table (attendance_teacher_scoped) never runs
--   because the definer context bypasses it.
--
--   The teaching workspace added in migration 18 drives this RPC from a
--   screen that only ever shows a teacher their own periods, so the UI
--   is safe, but the API was not.
--
-- THE FIX
--
--   When the caller is a teacher (and not also an admin or office role),
--   require an active teacher_assignments row linking them to the class
--   and section they are trying to mark. Admins, vice-principals,
--   principals and office_staff are unaffected — they mark any class as
--   before.
--
--   Everything else about the function is unchanged: same signature,
--   same single-statement upsert, same audit row.
--
-- ROLLBACK: restore the previous body (also kept in
--   supabase_academics_workflow_migration_18_rollback.sql).
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.save_attendance(
  _attendance_date date,
  _class text,
  _section text,
  _records jsonb
)
RETURNS TABLE(saved integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  year_id uuid := (SELECT id FROM public.academic_years WHERE is_current LIMIT 1);
  actor   uuid := auth.uid();
  n       integer;
BEGIN
  IF NOT public.auth_has_permission('attendance.manage') THEN
    RAISE EXCEPTION 'You do not have permission to record attendance'
      USING ERRCODE = '42501';
  END IF;

  -- A subject / class teacher may only mark a class they are assigned to.
  -- Admins and office staff (is_admin() true, or attendance.manage without
  -- is_teacher()) keep full reach.
  IF public.is_teacher() AND NOT public.is_admin() THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.teacher_assignments ta
      JOIN public.classes  c   ON c.id = ta.class_id
      JOIN public.sections sec ON sec.id = ta.section_id
      WHERE ta.teacher_id = public.get_current_teacher_id()
        AND ta.is_active
        AND c.class_name    = _class
        AND sec.section_name = _section
    ) THEN
      RAISE EXCEPTION 'You are not assigned to %-%; you cannot record its attendance', _class, _section
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF _attendance_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Attendance cannot be recorded for a future date'
      USING ERRCODE = 'check_violation';
  END IF;

  IF _records IS NULL OR jsonb_array_length(_records) = 0 THEN
    RAISE EXCEPTION 'No attendance records were supplied' USING ERRCODE = 'no_data_found';
  END IF;

  WITH incoming AS (
    SELECT (r->>'student_id')::uuid AS student_id,
           r->>'status'             AS status,
           nullif(r->>'remarks','') AS remarks
    FROM jsonb_array_elements(_records) AS r
  ),
  upserted AS (
    INSERT INTO public.attendance AS a
      (student_id, attendance_date, status, class, section, academic_year_id, marked_by, remarks)
    SELECT i.student_id, _attendance_date, i.status, _class, _section, year_id, actor, i.remarks
    FROM incoming i
    JOIN public.students s ON s.id = i.student_id
    ON CONFLICT (student_id, attendance_date) DO UPDATE
      SET status           = EXCLUDED.status,
          class            = EXCLUDED.class,
          section          = EXCLUDED.section,
          academic_year_id = EXCLUDED.academic_year_id,
          marked_by        = EXCLUDED.marked_by,
          remarks          = EXCLUDED.remarks,
          updated_at       = now()
    RETURNING 1
  )
  SELECT count(*)::int INTO n FROM upserted;

  INSERT INTO public.audit_logs (user_id, user_email, action_type, table_name, new_values)
  VALUES (
    actor,
    (SELECT email FROM public.profiles WHERE id = actor),
    'ATTENDANCE_SAVED', 'attendance',
    jsonb_build_object('date', _attendance_date, 'class', _class, 'section', _section, 'records', n)
  );

  RETURN QUERY SELECT n;
END;
$function$;

COMMIT;
