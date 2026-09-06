-- Two blockers in the Admin → Process Result → Publish → Student/Parent path.
--
-- (1) Same defect already fixed on exam_subjects: `update_modified_column()`
--     BEFORE UPDATE triggers assign NEW.updated_at on tables that have no
--     updated_at column, so EVERY update raises 42703. On exam_results this
--     breaks publishExamResults() (UPDATE ... SET published = true), i.e.
--     results could never be published. co_scholastic has the same defect.
--
-- (2) processClassResults() writes result_status as
--       'PASS' | 'COMPARTMENT' | 'FAIL' | 'WITHHELD'
--     but exam_results_result_status_check only allowed lowercase
--     ('pass','fail'), so every upsert raised 23514. The whole class is
--     upserted in one statement, so a single row killed the entire run and
--     nothing could ever be processed.
--
-- Legacy rows are normalised to upper case so the admin badge colouring
-- (which compares against 'PASS'/'COMPARTMENT'/'FAIL'/'WITHHELD') matches.

BEGIN;

-- (1) missing updated_at columns the triggers depend on
ALTER TABLE public.exam_results
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.co_scholastic
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- (2) result_status domain
ALTER TABLE public.exam_results
  DROP CONSTRAINT IF EXISTS exam_results_result_status_check;

ALTER TABLE public.exam_results
  ADD CONSTRAINT exam_results_result_status_check
  CHECK (upper(result_status) IN ('PASS', 'FAIL', 'COMPARTMENT', 'WITHHELD'));

UPDATE public.exam_results
   SET result_status = upper(result_status)
 WHERE result_status IS NOT NULL
   AND result_status <> upper(result_status);

COMMIT;
