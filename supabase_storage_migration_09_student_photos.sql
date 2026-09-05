-- =====================================================================
-- MIGRATION 09 — missing storage.objects RLS policy for student-photos
-- =====================================================================
-- The `student-photos` bucket was seeded in supabase_additive_migration.sql
-- (public, 5MB limit, jpeg/png) and migration 06's comment claims it
-- "already" has policies like gallery/school-assets/library-covers, but no
-- CREATE POLICY for it was ever tracked. With storage RLS enabled and no
-- matching policy, every browser upload to this bucket is denied, and the
-- frontend silently falls back to embedding a base64 copy of the photo
-- directly in students.photo_url instead of using Storage.
--
-- This adds the same public-read / staff-write pattern already used for
-- gallery, school-assets and library-covers.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS student_photos_public_read ON storage.objects;
DROP POLICY IF EXISTS student_photos_staff_write ON storage.objects;

CREATE POLICY student_photos_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'student-photos');

CREATE POLICY student_photos_staff_write ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'student-photos' AND public.is_staff())
  WITH CHECK (bucket_id = 'student-photos' AND public.is_staff());
