-- =====================================================================
-- RBAC MIGRATION 02a — extend the app_role enum
-- =====================================================================
-- Must run on its own, BEFORE 02b. PostgreSQL does not allow a newly
-- added enum value to be used in the same transaction that adds it.
--
-- Existing values (admin, teacher, student, parent) are untouched.
-- This is purely additive: no row changes, no drops.
--
-- ROLLBACK: PostgreSQL cannot remove an enum value. Rolling this back
-- means recreating the type, which 02b_rollback does not attempt.
-- Unused enum values are harmless, so this step is left in place.
-- =====================================================================

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'principal';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vice_principal';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'class_teacher';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accountant';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'librarian';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'transport_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hostel_warden';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'exam_controller';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'receptionist';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'office_staff';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hr';
