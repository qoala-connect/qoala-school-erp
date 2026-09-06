-- Migration 23: align fee_categories.frequency with the Fee Structure Manager.
--
-- Defect: the "Billing Frequency" dropdown in Fees -> Fee Structure Master offers
--   Monthly | Quarterly | Term (Per Term / Term-wise) | Annual | One-time
-- but the check constraint only allowed
--   One-time | Monthly | Term-wise | Annual | Variable
-- so picking "Quarterly" or "Term" failed on save with
--   23514 violates check constraint "fee_categories_frequency_check"
-- This also broke the built-in default-category seeder, whose "Examination Fee"
-- entry ships with frequency 'Term'.
--
-- 'Term-wise' and 'Variable' stay valid: existing rows use 'Term-wise', and
-- 'Variable' is still referenced by older fee migrations.

ALTER TABLE public.fee_categories
  DROP CONSTRAINT IF EXISTS fee_categories_frequency_check;

ALTER TABLE public.fee_categories
  ADD CONSTRAINT fee_categories_frequency_check CHECK (
    (frequency)::text = ANY (ARRAY[
      'One-time'::text,
      'Monthly'::text,
      'Quarterly'::text,
      'Term'::text,
      'Term-wise'::text,
      'Annual'::text,
      'Variable'::text
    ])
  );
