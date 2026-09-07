-- =====================================================================
-- REALIGN exam_subjects.review_status FOR ALREADY-PUBLISHED EXAMS
-- =====================================================================
-- Symptom (reported): "I locked marks in Marks Verification but Result
-- Processing still shows the subjects as Draft — the two screens disagree."
--
-- Cause: saveExamSubject() used to `upsert(..., review_status:'draft')` on
-- conflict, so every time Subject Mapping was re-saved for an exam that
-- already had streams, all of those streams were reset to 'draft' — even
-- though their marks stayed status='approved' and their results stayed
-- processed + published. 132 streams are currently in this state:
--
--     review_status = 'draft'/'in_progress'
--     every non-null marks row status = 'approved'
--     exam.is_published = true, exam_results rows exist
--
-- Marks Verification derives 'in_progress' from (draft + entered), Result
-- Processing shows the raw 'draft', and "Run Result Calculation" refuses
-- with "No subject has been approved yet" — all for exams whose results
-- are already live to parents.
--
-- The service bug is fixed (saveExamSubject no longer clobbers the
-- workflow state of an existing row). This backfill repairs the rows that
-- already drifted, walking the workflow trigger's allowed transitions
-- (draft -> submitted -> approved) two hops at a time.
--
-- Targets ONLY streams that are unambiguously "done": published exam, has
-- processed results, has entered marks, and every entered mark is already
-- 'approved'/'locked'. In-flight exams are left untouched. Locked streams
-- are left untouched. Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Preview — the rows this script will move. Run on its own first.
-- ---------------------------------------------------------------------
WITH targets AS (
  SELECT es.exam_id, es.subject_id, es.subject_name, e.exam_name, e.class,
         es.review_status AS current_status
  FROM public.exam_subjects es
  JOIN public.exams e ON e.id = es.exam_id
  WHERE lower(coalesce(es.review_status, 'draft')) IN ('draft', 'in_progress')
    AND es.locked IS NOT TRUE
    AND e.is_published IS TRUE
    AND EXISTS (SELECT 1 FROM public.exam_results r WHERE r.exam_id = es.exam_id)
    AND EXISTS (
      SELECT 1 FROM public.marks m
      WHERE m.exam_id = es.exam_id AND m.subject_id = es.subject_id
        AND m.obtained_marks IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.marks m
      WHERE m.exam_id = es.exam_id AND m.subject_id = es.subject_id
        AND lower(coalesce(m.status, 'draft')) NOT IN ('approved', 'locked')
    )
)
SELECT class, exam_name, subject_name, current_status
FROM targets
ORDER BY exam_name, class, subject_name;

-- ---------------------------------------------------------------------
-- 1. Backfill — two hops, because trg_exam_subject_workflow only allows
--    draft -> submitted and submitted -> approved (no direct jump, and
--    no service-role bypass).
-- ---------------------------------------------------------------------
BEGIN;

-- Hop 1: draft / in_progress  ->  submitted
WITH targets AS (
  SELECT es.exam_id, es.subject_id
  FROM public.exam_subjects es
  JOIN public.exams e ON e.id = es.exam_id
  WHERE lower(coalesce(es.review_status, 'draft')) IN ('draft', 'in_progress')
    AND es.locked IS NOT TRUE
    AND e.is_published IS TRUE
    AND EXISTS (SELECT 1 FROM public.exam_results r WHERE r.exam_id = es.exam_id)
    AND EXISTS (
      SELECT 1 FROM public.marks m
      WHERE m.exam_id = es.exam_id AND m.subject_id = es.subject_id
        AND m.obtained_marks IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.marks m
      WHERE m.exam_id = es.exam_id AND m.subject_id = es.subject_id
        AND lower(coalesce(m.status, 'draft')) NOT IN ('approved', 'locked')
    )
)
UPDATE public.exam_subjects es
   SET review_status = 'submitted',
       reopen_reason = NULL
  FROM targets t
 WHERE es.exam_id = t.exam_id
   AND es.subject_id = t.subject_id;

-- Hop 2: submitted  ->  approved   (only the rows hop 1 just moved)
WITH targets AS (
  SELECT es.exam_id, es.subject_id
  FROM public.exam_subjects es
  JOIN public.exams e ON e.id = es.exam_id
  WHERE lower(coalesce(es.review_status, 'draft')) = 'submitted'
    AND es.locked IS NOT TRUE
    AND es.reviewed_at IS NULL          -- never carried a real admin review
    AND e.is_published IS TRUE
    AND EXISTS (SELECT 1 FROM public.exam_results r WHERE r.exam_id = es.exam_id)
    AND EXISTS (
      SELECT 1 FROM public.marks m
      WHERE m.exam_id = es.exam_id AND m.subject_id = es.subject_id
        AND m.obtained_marks IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.marks m
      WHERE m.exam_id = es.exam_id AND m.subject_id = es.subject_id
        AND lower(coalesce(m.status, 'draft')) NOT IN ('approved', 'locked')
    )
)
UPDATE public.exam_subjects es
   SET review_status = 'approved',
       reopen_reason = NULL,
       reviewed_at   = now()
  FROM targets t
 WHERE es.exam_id = t.exam_id
   AND es.subject_id = t.subject_id;

COMMIT;

-- ---------------------------------------------------------------------
-- 2. Verify — should return zero rows: no published exam with results
--    left carrying a draft/in_progress/submitted stream whose marks are
--    all approved.
-- ---------------------------------------------------------------------
SELECT e.class, e.exam_name, es.subject_name, es.review_status
FROM public.exam_subjects es
JOIN public.exams e ON e.id = es.exam_id
WHERE lower(coalesce(es.review_status, 'draft')) IN ('draft', 'in_progress', 'submitted')
  AND es.locked IS NOT TRUE
  AND e.is_published IS TRUE
  AND EXISTS (SELECT 1 FROM public.exam_results r WHERE r.exam_id = es.exam_id)
  AND EXISTS (
    SELECT 1 FROM public.marks m
    WHERE m.exam_id = es.exam_id AND m.subject_id = es.subject_id
      AND m.obtained_marks IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.marks m
    WHERE m.exam_id = es.exam_id AND m.subject_id = es.subject_id
      AND lower(coalesce(m.status, 'draft')) NOT IN ('approved', 'locked')
  )
ORDER BY e.exam_name, e.class, es.subject_name;
