-- Teachers may enter marks (marks_teacher_scoped) but exam_subjects is
-- writable only by the exam office, so a teacher's "submit for review" used to
-- update 0 rows and raise nothing: review_status stayed draft and the stream
-- never reached the admin verification queue. These two definer functions are
-- the only workflow transitions a teacher can make, and they are narrow —
-- forward only, never on a locked stream, never approve/lock, and only on the
-- stream the teacher is the assigned evaluator for.

CREATE OR REPLACE FUNCTION public.marks_stream_actor(_row public.exam_subjects)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN public.is_admin() OR public.auth_has_permission('results.publish') THEN 'office'
    WHEN public.get_current_teacher_id() IS NOT NULL
     AND _row.teacher_id = public.get_current_teacher_id() THEN 'evaluator'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.marks_stream_mark_in_progress(_exam_id uuid, _subject_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.exam_subjects%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.exam_subjects
   WHERE exam_id = _exam_id AND subject_id = _subject_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No exam subject for this exam and subject' USING ERRCODE = 'P0002';
  END IF;

  IF public.marks_stream_actor(v_row) IS NULL THEN
    RAISE EXCEPTION 'Only the assigned evaluator or the examination office may enter these marks'
      USING ERRCODE = '42501';
  END IF;

  -- Advisory only: never disturb a stream that has moved past entry.
  IF v_row.locked OR v_row.review_status IS DISTINCT FROM 'draft' THEN
    RETURN v_row.review_status;
  END IF;

  UPDATE public.exam_subjects SET review_status = 'in_progress'
   WHERE exam_id = _exam_id AND subject_id = _subject_id AND review_status = 'draft';
  RETURN 'in_progress';
END;
$$;

CREATE OR REPLACE FUNCTION public.marks_stream_submit_for_review(_exam_id uuid, _subject_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row   public.exam_subjects%ROWTYPE;
  v_actor text;
BEGIN
  SELECT * INTO v_row FROM public.exam_subjects
   WHERE exam_id = _exam_id AND subject_id = _subject_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No exam subject for this exam and subject' USING ERRCODE = 'P0002';
  END IF;

  v_actor := public.marks_stream_actor(v_row);
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Only the assigned evaluator or the examination office may submit these marks'
      USING ERRCODE = '42501';
  END IF;

  IF v_row.locked THEN
    RAISE EXCEPTION 'These marks are locked and cannot be resubmitted' USING ERRCODE = '42501';
  END IF;

  IF v_row.review_status NOT IN ('draft', 'in_progress', 'returned') THEN
    RAISE EXCEPTION 'These marks are already % and cannot be resubmitted', v_row.review_status
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.exam_subjects
     SET review_status = 'submitted',
         reviewed_at   = NULL,
         reviewed_by   = NULL,
         reopen_reason = NULL
   WHERE exam_id = _exam_id AND subject_id = _subject_id;

  UPDATE public.marks
     SET status = 'submitted', updated_by = auth.uid(), updated_at = now()
   WHERE exam_id = _exam_id AND subject_id = _subject_id;

  RETURN 'submitted';
END;
$$;

REVOKE ALL ON FUNCTION public.marks_stream_actor(public.exam_subjects) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marks_stream_mark_in_progress(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marks_stream_submit_for_review(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marks_stream_mark_in_progress(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marks_stream_submit_for_review(uuid, uuid) TO authenticated;
