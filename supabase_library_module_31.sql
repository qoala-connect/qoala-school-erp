-- ---------------------------------------------------------------------
-- 31. LIBRARY MODULE — borrower identity + fine settlement
-- ---------------------------------------------------------------------
-- LibraryManagement.tsx collects a borrower name and role on the issue
-- form and reads them back in the Borrowing Ledger, and Student360Drawer's
-- library tab filters issues by the student. None of those columns existed
-- on book_issues, so:
--   * the page's `book_issues -> students(name)` embed failed outright
--     ("Could not find a relationship"), leaving the ledger permanently
--     empty, and
--   * the drawer's `borrower_name.ilike` filter errored on a missing column.
--
-- Fines were also inferred from return_date, which conflated "the book came
-- back" with "the penalty was paid". fine_paid separates the two.
--
-- Additive only: every column is nullable or defaulted, so existing rows and
-- existing inserts keep working.

ALTER TABLE public.book_issues
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS borrower_name TEXT,
  ADD COLUMN IF NOT EXISTS borrower_role TEXT NOT NULL DEFAULT 'Student',
  ADD COLUMN IF NOT EXISTS fine_paid BOOLEAN NOT NULL DEFAULT false;

-- Role vocabulary matches the select in the issue form.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'book_issues_borrower_role_check'
  ) THEN
    ALTER TABLE public.book_issues
      ADD CONSTRAINT book_issues_borrower_role_check
      CHECK (borrower_role IN ('Student', 'Staff'));
  END IF;
END $$;

-- The drawer and the ledger both look issues up by borrower.
CREATE INDEX IF NOT EXISTS idx_book_issues_student_id ON public.book_issues(student_id);
CREATE INDEX IF NOT EXISTS idx_book_issues_status ON public.book_issues(status);
CREATE INDEX IF NOT EXISTS idx_library_books_category ON public.library_books(category);

-- rack_number arrived in migration 24; restated here so a fresh database
-- provisioned from this file alone still matches what the catalog renders.
ALTER TABLE public.library_books
  ADD COLUMN IF NOT EXISTS rack_number TEXT;
