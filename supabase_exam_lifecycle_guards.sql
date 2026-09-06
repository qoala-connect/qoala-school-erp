-- =====================================================================
-- EXAMINATION LIFECYCLE GUARDS (server-side, cannot be bypassed by the client)
-- =====================================================================
-- Spec §2 / §31 / §44 / §45: status changes must follow the documented state
-- machine, must carry a reason where required, and locked/approved marks must
-- not be editable. Until now every status was writable to any value by anyone
-- who passed the RLS write check, so a crafted request could jump straight to
-- 'approved' or reopen a locked subject silently.
--
-- All three guards are BEFORE triggers, so they apply to the REST API, the
-- service layer and psql alike.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Ordering helper for the exam-level pipeline
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.exam_status_rank(_s text)
RETURNS int
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE lower(coalesce(_s, 'draft'))
    WHEN 'draft'            THEN 0
    WHEN 'scheduled'        THEN 1
    WHEN 'marks_entry_open' THEN 2
    WHEN 'review'           THEN 3
    WHEN 'locked'           THEN 4
    WHEN 'result_processed' THEN 5
    WHEN 'published'        THEN 6
    ELSE -1
  END;
$$;

-- ---------------------------------------------------------------------
-- 1. exam_subjects.review_status — the marks workflow state machine
--
--      draft       -> in_progress | submitted
--      in_progress -> draft | submitted
--      submitted   -> approved | returned
--      returned    -> in_progress | submitted
--      approved    -> locked | returned
--      locked      -> approved                (unlock, reason required)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_exam_subject_workflow()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  old_s text := lower(coalesce(OLD.review_status, 'draft'));
  new_s text := lower(coalesce(NEW.review_status, 'draft'));
  ok    boolean;
BEGIN
  IF old_s = new_s THEN
    ok := true;
  ELSE
    ok := CASE old_s
      WHEN 'draft'       THEN new_s IN ('in_progress', 'submitted')
      WHEN 'in_progress' THEN new_s IN ('draft', 'submitted')
      WHEN 'submitted'   THEN new_s IN ('approved', 'returned')
      WHEN 'returned'    THEN new_s IN ('in_progress', 'submitted')
      WHEN 'approved'    THEN new_s IN ('locked', 'returned')
      WHEN 'locked'      THEN new_s = 'approved'
      ELSE false
    END;
  END IF;

  IF NOT ok THEN
    RAISE EXCEPTION 'Invalid marks workflow transition: % -> %', old_s, new_s
      USING ERRCODE = 'check_violation';
  END IF;

  -- Returning for correction must say why (§15)
  IF new_s = 'returned' AND old_s <> 'returned'
     AND coalesce(btrim(NEW.reopen_reason), '') = '' THEN
    RAISE EXCEPTION 'A reason is required when returning marks for correction'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Unlocking must say why, and only from a locked row (§17)
  IF OLD.locked IS TRUE AND NEW.locked IS DISTINCT FROM TRUE
     AND coalesce(btrim(NEW.unlock_reason), '') = '' THEN
    RAISE EXCEPTION 'A reason is required when unlocking marks'
      USING ERRCODE = 'check_violation';
  END IF;

  -- locked flag and review_status must agree
  IF NEW.locked IS TRUE AND new_s <> 'locked' THEN
    RAISE EXCEPTION 'A locked subject must have review_status = locked'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exam_subject_workflow ON public.exam_subjects;
CREATE TRIGGER trg_exam_subject_workflow
  BEFORE UPDATE ON public.exam_subjects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_exam_subject_workflow();

-- ---------------------------------------------------------------------
-- 2. exams.status — forward-only along the pipeline.
--    Intermediate states may be skipped (the app jumps draft ->
--    result_processed), but the pipeline can never run backwards. The single
--    permitted reversal is published -> result_processed, i.e. un-publishing,
--    so a published result is never silently rewritten (§45.5).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_exam_status_flow()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  old_r int := public.exam_status_rank(OLD.status);
  new_r int := public.exam_status_rank(NEW.status);
BEGIN
  IF new_r = -1 THEN
    RAISE EXCEPTION 'Unknown exam status: %', NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF new_r < old_r
     AND NOT (lower(OLD.status) = 'published' AND lower(NEW.status) = 'result_processed') THEN
    RAISE EXCEPTION 'Exam status cannot move backwards: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- is_published must track the published state
  IF lower(coalesce(NEW.status, '')) = 'published' AND NEW.is_published IS DISTINCT FROM TRUE THEN
    NEW.is_published := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exam_status_flow ON public.exams;
CREATE TRIGGER trg_exam_status_flow
  BEFORE UPDATE OF status ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.enforce_exam_status_flow();

-- ---------------------------------------------------------------------
-- 3. Marks are frozen once their subject is approved or locked (§45.4).
--    Exam-office staff (is_admin / results.publish) are exempt because the
--    approve and lock routines themselves stamp the marks rows afterwards.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_marks_not_frozen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  frozen boolean;
BEGIN
  IF public.is_admin() OR public.auth_has_permission('results.publish') THEN
    RETURN NEW;
  END IF;

  SELECT (es.locked IS TRUE
          OR lower(coalesce(es.review_status, 'draft')) IN ('approved', 'locked'))
    INTO frozen
    FROM public.exam_subjects es
   WHERE es.exam_id = NEW.exam_id
     AND es.subject_id = NEW.subject_id
   LIMIT 1;

  IF coalesce(frozen, false) THEN
    RAISE EXCEPTION 'These marks have been approved/locked and can no longer be edited'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marks_not_frozen ON public.marks;
CREATE TRIGGER trg_marks_not_frozen
  BEFORE INSERT OR UPDATE ON public.marks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_marks_not_frozen();

COMMIT;
