-- =====================================================================
-- FIX: marks_validate silently zeroed every single-score mark entry
-- =====================================================================
-- The trigger derived obtained_marks from the five CBSE component columns
-- and assigned the result unconditionally:
--
--     NEW.obtained_marks := total;
--
-- That is correct for the CBSE composite model, where the breakdown is the
-- source of truth. But the Marks Entry screen writes a single score straight
-- into obtained_marks and never touches the component columns, which default
-- to 0. So the trigger computed 0+0+0+0+0 and overwrote the score the teacher
-- had just typed. The write succeeded, the UI reported "Draft saved", and the
-- mark landed as 0.00 -- with the client-computed grade (e.g. 'A1') still
-- attached, since the trigger does not touch grade.
--
-- Fix: only derive obtained_marks when a component breakdown was actually
-- supplied. Otherwise the caller's score stands.
--
-- Composite rows are unaffected: when the components sum above zero the
-- behaviour is byte-for-byte what it was before.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.marks_validate()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  configured_max  integer;
  component_total numeric(6,2);
  final_score     numeric(6,2);
BEGIN
  component_total := round(
      coalesce(NEW.periodic_test_marks, 0)
    + coalesce(NEW.multiple_assessment_marks, 0)
    + coalesce(NEW.portfolio_marks, 0)
    + coalesce(NEW.subject_enrichment_marks, 0)
    + coalesce(NEW.annual_exam_marks, 0), 2);

  IF coalesce(NEW.is_absent, false) THEN
    -- An absent student scores nothing, whatever was typed.
    NEW.periodic_test_marks       := 0;
    NEW.multiple_assessment_marks := 0;
    NEW.portfolio_marks           := 0;
    NEW.subject_enrichment_marks  := 0;
    NEW.annual_exam_marks         := 0;
    final_score := 0;

  ELSIF component_total > 0 THEN
    -- CBSE composite entry: the breakdown is the source of truth.
    final_score := component_total;

  ELSE
    -- Single-score entry: no breakdown was given, so the score the caller
    -- supplied stands. Deriving it from the all-zero components is exactly
    -- what was blanking these rows.
    final_score := NEW.obtained_marks;
  END IF;

  SELECT es.max_marks INTO configured_max
  FROM public.exam_subjects es
  WHERE es.exam_id = NEW.exam_id AND es.subject_id = NEW.subject_id;

  IF configured_max IS NULL THEN
    RAISE EXCEPTION
      'That subject is not configured for this exam. Add it under the exam''s subjects before entering marks.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  NEW.max_marks      := configured_max;
  NEW.obtained_marks := final_score;

  IF coalesce(final_score, 0) > configured_max THEN
    RAISE EXCEPTION
      'Marks of % exceed the maximum of % configured for this subject',
      final_score, configured_max
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
