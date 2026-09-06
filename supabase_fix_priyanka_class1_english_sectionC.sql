-- Priyanka Chaurasia teaches English to the WHOLE of Class 1, but
-- teacher_assignments only had rows for sections A and B. The missing
-- section-C row makes every section-C mark fail the `marks` RLS policy
-- (teacher_teaches_student_subject) and aborts the whole submit batch.
-- Idempotent: only inserts if the row is absent.

INSERT INTO public.teacher_assignments
  (teacher_id, academic_year_id, class_id, section_id, subject_id, assignment_type, is_active)
SELECT
  '26defd66-64da-472d-b05b-7f80b469ced8',   -- Smt. Priyanka Chaurasia
  '22222222-2222-2222-2222-222222222222',   -- academic year 2026-27
  'debebccc-2ea0-4ee1-9825-1b1f6a5a8750',   -- Class 1
  '4e5df7f2-6e66-4c57-aa30-e58091464889',   -- Section C
  '0367a46d-e4fd-423b-99ba-501f6a62cf6c',   -- English
  'subject_teacher',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.teacher_assignments ta
  WHERE ta.teacher_id = '26defd66-64da-472d-b05b-7f80b469ced8'
    AND ta.class_id   = 'debebccc-2ea0-4ee1-9825-1b1f6a5a8750'
    AND ta.section_id = '4e5df7f2-6e66-4c57-aa30-e58091464889'
    AND ta.subject_id = '0367a46d-e4fd-423b-99ba-501f6a62cf6c'
);
