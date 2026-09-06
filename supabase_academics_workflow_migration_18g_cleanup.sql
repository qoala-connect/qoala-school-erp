-- =====================================================================
-- MIGRATION 18g — POST-18 CLEANUP
-- =====================================================================
--
-- 1. Drop three indexes 18a/18d created that exactly duplicate the
--    UNIQUE-constraint indexes on the same columns (flagged by the
--    performance advisor's duplicate_index check):
--      idx_syllabus_units_scope     == syllabus_units_unique_seq
--      idx_syllabus_chapters_unit   == syllabus_chapters_unique_seq
--      idx_syllabus_topics_chapter  == syllabus_topics_unique_seq
--    and idx_syllabus_progress_chapter, a redundant left-prefix of
--    syllabus_progress_unique (chapter_id, section_id).
--
-- 2. Remove four leftover near-empty exam shells that predate this work
--    ("Periodic Assessment 1" / "Periodic Test 1 / Unit Test 1" for
--    classes 1-2 with 0-4 mark rows). One of them was published with a
--    single stray student's marks by 18's mark regeneration; its marks,
--    results and subject rows go with it.
-- =====================================================================

BEGIN;

DROP INDEX IF EXISTS public.idx_syllabus_units_scope;
DROP INDEX IF EXISTS public.idx_syllabus_chapters_unit;
DROP INDEX IF EXISTS public.idx_syllabus_topics_chapter;
DROP INDEX IF EXISTS public.idx_syllabus_progress_chapter;

-- keep a plain chapter_id index for progress joins that don't use section_id
CREATE INDEX IF NOT EXISTS idx_syllabus_progress_chapter_only
  ON public.syllabus_progress (chapter_id);

WITH junk AS (
  SELECT e.id
  FROM public.exams e
  WHERE e.exam_name IN ('Periodic Assessment 1', 'Periodic Test 1 / Unit Test 1')
    AND (SELECT count(*) FROM public.marks m WHERE m.exam_id = e.id) < 20
)
DELETE FROM public.exam_results  WHERE exam_id IN (SELECT id FROM junk);
WITH junk AS (
  SELECT e.id FROM public.exams e
  WHERE e.exam_name IN ('Periodic Assessment 1', 'Periodic Test 1 / Unit Test 1')
    AND (SELECT count(*) FROM public.marks m WHERE m.exam_id = e.id) < 20
)
DELETE FROM public.marks         WHERE exam_id IN (SELECT id FROM junk);
WITH junk AS (
  SELECT e.id FROM public.exams e
  WHERE e.exam_name IN ('Periodic Assessment 1', 'Periodic Test 1 / Unit Test 1')
    AND (SELECT count(*) FROM public.marks m WHERE m.exam_id = e.id) < 20
)
DELETE FROM public.exam_subjects WHERE exam_id IN (SELECT id FROM junk);
DELETE FROM public.exams e
 WHERE e.exam_name IN ('Periodic Assessment 1', 'Periodic Test 1 / Unit Test 1')
   AND NOT EXISTS (SELECT 1 FROM public.marks m WHERE m.exam_id = e.id);

COMMIT;
