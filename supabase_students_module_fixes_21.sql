-- Migration 21: make the Students-group forms persist what they collect.
--
-- Three defects found by driving the admin UI's own write paths:
--
-- 1. Medical Management -> "Save health card" was 100% broken. The page reads
--    m.height_cm / m.weight_kg / m.emergency_contact / m.medical_conditions and
--    writes the same keys, but none of those columns existed:
--      PGRST204 Could not find the 'emergency_contact' column of 'student_medical'
--    PostgREST rejects the whole row, so no medical record could ever be saved.
--
-- 2. Discipline Management -> "Log incident" was 100% broken for the same reason:
--      PGRST204 Could not find the 'demerit_points' column of 'disciplinary_records'
--    demerit_points is collected in the form, sent by the CSV importer and emitted
--    by the CSV exporter, so the column is genuinely part of the model.
--
-- 3. Student 360 -> "Link document" rejected every option in its own dropdown.
--    The dropdown offers Birth Certificate / Transfer Certificate / Previous
--    Marksheet / Aadhaar Card / Medical Fitness / Special Achievement, but the
--    check constraint only allowed the legacy slugs 'aadhaar' | 'tc' | 'marksheet':
--      23514 violates check constraint "student_documents_document_type_check"

-- 1 ------------------------------------------------------------ student_medical
ALTER TABLE public.student_medical
  ADD COLUMN IF NOT EXISTS height_cm          numeric,
  ADD COLUMN IF NOT EXISTS weight_kg          numeric,
  ADD COLUMN IF NOT EXISTS emergency_contact  text,
  ADD COLUMN IF NOT EXISTS medical_conditions text,
  ADD COLUMN IF NOT EXISTS remarks            text;

-- 2 -------------------------------------------------------- disciplinary_records
ALTER TABLE public.disciplinary_records
  ADD COLUMN IF NOT EXISTS demerit_points integer NOT NULL DEFAULT 0;

-- 3 ----------------------------------------------------------- student_documents
-- Keep the legacy slugs valid so existing rows still satisfy the constraint,
-- and add the labels the Student 360 dropdown actually submits.
ALTER TABLE public.student_documents
  DROP CONSTRAINT IF EXISTS student_documents_document_type_check;

ALTER TABLE public.student_documents
  ADD CONSTRAINT student_documents_document_type_check CHECK (
    document_type = ANY (ARRAY[
      -- legacy values already present in the table
      'aadhaar'::text, 'tc'::text, 'marksheet'::text,
      -- values offered by the Student 360 "Link document" dropdown
      'Birth Certificate'::text,
      'Transfer Certificate'::text,
      'Previous Marksheet'::text,
      'Aadhaar Card'::text,
      'Medical Fitness'::text,
      'Special Achievement'::text,
      'Other'::text
    ])
  );
