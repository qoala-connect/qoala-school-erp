-- =====================================================================
-- RECONCILE marks.status WITH exam_subjects.review_status
-- =====================================================================
-- saveMarksDraft used to write a flat `status = 'draft'` onto every marks row
-- it touched. When an administrator moderated a subject that was already
-- submitted or approved, that downgraded the rows underneath a stream whose
-- review_status stayed put — so `marks.status` and `exam_subjects.review_status`
-- disagreed, and anything reading the row-level status saw work that had been
-- verified as though it were an untouched draft.
--
-- The service no longer does this (it carries the stream's status forward), but
-- rows written before that fix are still drifted. This backfill realigns them.
--
-- Read-only preview first, then the update. Safe to re-run: it only touches
-- rows that actually disagree.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Preview — how many rows drifted, and in which direction.
--    Run this on its own first and eyeball the result.
-- ---------------------------------------------------------------------
SELECT
  es.review_status                       AS stream_status,
  coalesce(m.status, '(null)')           AS mark_status,
  count(*)                               AS rows_affected
FROM public.marks m
JOIN public.exam_subjects es
  ON es.exam_id = m.exam_id
 AND es.subject_id = m.subject_id
WHERE lower(coalesce(es.review_status, 'draft')) IN ('submitted', 'returned', 'approved', 'locked')
  AND coalesce(m.status, 'draft') IS DISTINCT FROM
      lower(coalesce(es.review_status, 'draft'))
GROUP BY 1, 2
ORDER BY rows_affected DESC;

-- ---------------------------------------------------------------------
-- 2. Backfill.
--
--    Only streams that have moved past entry are realigned. A stream still in
--    'draft' or 'in_progress' is left alone: 'in_progress' is a stream-only
--    state with no marks.status equivalent, and 'draft' rows are already correct.
--
--    The freeze trigger (enforce_marks_not_frozen) exempts admin / results.publish
--    callers, so run this as the service role or as an exam-office account.
-- ---------------------------------------------------------------------
BEGIN;

UPDATE public.marks m
   SET status     = lower(es.review_status),
       updated_at = now()
  FROM public.exam_subjects es
 WHERE es.exam_id = m.exam_id
   AND es.subject_id = m.subject_id
   AND lower(coalesce(es.review_status, 'draft')) IN ('submitted', 'returned', 'approved', 'locked')
   AND coalesce(m.status, 'draft') IS DISTINCT FROM lower(coalesce(es.review_status, 'draft'));

COMMIT;

-- ---------------------------------------------------------------------
-- 3. Verify — this should return zero rows.
-- ---------------------------------------------------------------------
SELECT m.exam_id, m.subject_id, m.status, es.review_status
FROM public.marks m
JOIN public.exam_subjects es
  ON es.exam_id = m.exam_id
 AND es.subject_id = m.subject_id
WHERE lower(coalesce(es.review_status, 'draft')) IN ('submitted', 'returned', 'approved', 'locked')
  AND coalesce(m.status, 'draft') IS DISTINCT FROM lower(coalesce(es.review_status, 'draft'))
LIMIT 50;
