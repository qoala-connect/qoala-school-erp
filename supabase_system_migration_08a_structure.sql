-- =====================================================================
-- SYSTEM MIGRATION 08a — structure
-- =====================================================================
-- Gives the System module the tables and columns it needs to be the
-- identity, configuration and audit centre of the ERP.
--
-- WHAT THIS IS NOT
--   It creates no second user table, no second role table, no second
--   permission table and no second academic-year table. profiles is
--   still the one identity, profiles.role the one role, role_permissions
--   the one grant table and academic_years (owned by Academics) the one
--   place a year is defined. This migration only fills gaps in them.
--
-- WHAT IT ADDS
--   1. profiles: an account lifecycle (invited/active/suspended/
--      disabled/archived) plus created_at/updated_at, so an account can
--      be shut off without deleting the person's history.
--   2. system_settings: the school identity and global configuration the
--      ERP currently hardcodes in 30-odd components. Constrained to
--      exactly one row and seeded with the values those components use,
--      so behaviour does not change until an administrator edits them.
--   3. audit_logs: the indexes an audit screen needs to page and filter
--      without a sequential scan.
--
-- SAFETY
--   Additive only. No table is dropped, no row is deleted, every new
--   column has a default or is nullable. Safe to re-run.
--
-- ROLLBACK: supabase_system_migration_08_rollback.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. profiles — account lifecycle
-- ---------------------------------------------------------------------
-- profiles held only (id, role, name, email). There was no way to shut
-- off an account: the only options were leaving it fully active or
-- deleting the row, and deleting it orphans every audit entry, mark and
-- fee receipt that references the user. A status column is the missing
-- middle.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status            text        NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_reason     text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_by uuid,
  ADD COLUMN IF NOT EXISTS created_at        timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_status_check
      CHECK (status IN ('invited','active','suspended','disabled','archived'));
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.status IS
  'Account lifecycle. invited = created, never signed in. active = normal. suspended = temporarily blocked, reversible. disabled = blocked indefinitely. archived = the person has left. Historical records are never removed for any of these.';

-- Backfill created_at from the authentication record rather than leaving
-- every existing account stamped with the migration time.
UPDATE public.profiles p
SET created_at = u.created_at
FROM auth.users u
WHERE u.id = p.id AND p.created_at > u.created_at;

-- One account per email address. Checked for duplicates before adding;
-- there are none. Blank emails are excluded because the legacy default
-- for the column is the empty string.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique
  ON public.profiles (lower(email)) WHERE email <> '';

CREATE INDEX IF NOT EXISTS idx_profiles_role   ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles (status);

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- ---------------------------------------------------------------------
-- 2. system_settings — the school identity, once
-- ---------------------------------------------------------------------
-- The table existed with six columns and zero rows, and nothing in the
-- application read it. School name, address and branding are instead
-- written out by hand in Settings, the certificate generator, the ID
-- card modal, the admission letter, the login page and the AI assistant,
-- which is why two different names for the school are currently in the
-- codebase. This makes one row the answer.

ALTER TABLE public.system_settings
  -- identity
  ADD COLUMN IF NOT EXISTS school_code           text,
  ADD COLUMN IF NOT EXISTS school_website        text,
  ADD COLUMN IF NOT EXISTS principal_name        text,
  -- affiliation
  ADD COLUMN IF NOT EXISTS affiliation_board     text,
  ADD COLUMN IF NOT EXISTS affiliation_number    text,
  -- branding, used by ID cards, receipts, report cards and certificates
  ADD COLUMN IF NOT EXISTS brand_primary_color   text,
  ADD COLUMN IF NOT EXISTS brand_accent_color    text,
  ADD COLUMN IF NOT EXISTS document_header_note  text,
  ADD COLUMN IF NOT EXISTS document_footer_note  text,
  -- global formatting
  ADD COLUMN IF NOT EXISTS timezone              text,
  ADD COLUMN IF NOT EXISTS date_format           text,
  ADD COLUMN IF NOT EXISTS currency_code         text,
  ADD COLUMN IF NOT EXISTS locale                text,
  ADD COLUMN IF NOT EXISTS default_page_size     integer,
  -- bookkeeping
  ADD COLUMN IF NOT EXISTS updated_by            uuid,
  -- exactly-one-row marker, see the unique index below
  ADD COLUMN IF NOT EXISTS is_singleton          boolean NOT NULL DEFAULT true;

-- Exactly one row. Without this, "the settings" is whichever row a query
-- happens to return first, which is how configuration silently forks.
CREATE UNIQUE INDEX IF NOT EXISTS system_settings_singleton
  ON public.system_settings (is_singleton);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.system_settings'::regclass AND conname = 'system_settings_singleton_true'
  ) THEN
    ALTER TABLE public.system_settings
      ADD CONSTRAINT system_settings_singleton_true CHECK (is_singleton);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.system_settings'::regclass AND conname = 'system_settings_page_size_check'
  ) THEN
    ALTER TABLE public.system_settings
      ADD CONSTRAINT system_settings_page_size_check
      CHECK (default_page_size IS NULL OR default_page_size BETWEEN 10 AND 200);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.system_settings'::regclass AND conname = 'system_settings_timeout_check'
  ) THEN
    ALTER TABLE public.system_settings
      ADD CONSTRAINT system_settings_timeout_check
      CHECK (session_timeout_minutes IS NULL OR session_timeout_minutes BETWEEN 5 AND 1440);
  END IF;
END $$;

-- Seed with the values the application currently hardcodes, so nothing
-- changes on screen until an administrator edits them deliberately.
INSERT INTO public.system_settings (
  school_name, school_address,
  affiliation_board, timezone, date_format, currency_code, locale,
  default_page_size, session_timeout_minutes, mfa_enabled,
  brand_primary_color, brand_accent_color
)
SELECT
  'Sushila Devi Public School', 'Barhalganj, Gorakhpur, Uttar Pradesh',
  'CBSE', 'Asia/Kolkata', 'DD/MM/YYYY', 'INR', 'en-IN',
  25, 60, false,
  '#6D28D9', '#4F46E5'
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings);

COMMENT ON TABLE public.system_settings IS
  'The one row of school-wide configuration. Canonical source for school identity and branding: ID cards, receipts, report cards, certificates and the admission letter must read it rather than restating the school name. Academic years are NOT here; Academics owns academic_years.';

-- ---------------------------------------------------------------------
-- 3. audit_logs — indexes an audit screen can actually page on
-- ---------------------------------------------------------------------
-- The only index was on table_name. Every audit view sorts by time and
-- filters by actor or action, so each of those was a sequential scan
-- over a table designed to grow without bound.

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
  ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
  ON public.audit_logs (action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_created
  ON public.audit_logs (table_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record
  ON public.audit_logs (record_id) WHERE record_id IS NOT NULL;

COMMENT ON TABLE public.audit_logs IS
  'Append-only record of administrative and security-relevant actions. Written exclusively by SECURITY DEFINER functions. UPDATE and DELETE are refused by a trigger and no role holds those privileges; see migration 08b.';

-- ---------------------------------------------------------------------
-- 4. activity_logs — say plainly that it is dead
-- ---------------------------------------------------------------------
-- Created by the additive migration, never written to (0 rows), never
-- read by any code. It duplicates audit_logs. It is NOT dropped, because
-- dropping a table to tidy the schema is exactly the change that turns
-- out to have had a consumer. It is labelled instead.
COMMENT ON TABLE public.activity_logs IS
  'DEPRECATED and unused (0 rows, no reader in the application). audit_logs is the audit trail. Retained rather than dropped; write nothing new here.';

COMMIT;
