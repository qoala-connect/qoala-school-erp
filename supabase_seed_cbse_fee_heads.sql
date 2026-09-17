-- Seed the standard CBSE fee heads into fee_categories.
-- Safe to re-run: category_name is UNIQUE, so existing heads (e.g. the
-- current "Composite Annual Fee") are left untouched and duplicates are skipped.

-- Make sure the frequency CHECK constraint allows 'Term' / 'Quarterly'
-- (see supabase_fee_category_frequency_23.sql) before inserting Examination
-- Fee below -- otherwise the whole INSERT aborts with 23514 and nothing
-- gets added, even the rows with valid frequencies.
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

INSERT INTO public.fee_categories (category_name, frequency, amount, description, is_active)
VALUES
  ('Admission Fee', 'One-time', 5000, 'One-time registration & admission processing', true),
  ('Tuition Fee', 'Monthly', 3500, 'Academic instruction and classroom tuition', true),
  ('Development Fee', 'Annual', 4000, 'Infrastructure upkeep, campus development & annual maintenance', true),
  ('Caution Money (Refundable)', 'One-time', 2000, 'Refundable security deposit, adjusted or returned on withdrawal / course completion', true),
  ('Examination Fee', 'Term', 1200, 'CBSE terminal & summative assessments', true),
  ('Computer & Lab Fee', 'Annual', 2000, 'Science lab & computer lab equipment, consumables and upkeep', true),
  ('Library Fee', 'Annual', 800, 'Library books, periodicals & digital reading resources', true),
  ('Smart Class & Technology Fee', 'Annual', 1500, 'Digital smart-classroom infrastructure & ed-tech subscriptions', true),
  ('Annual Activity & Sports', 'Annual', 1800, 'Sports, co-curricular and annual events', true),
  ('Transport Fee', 'Monthly', 1500, 'School bus commute & fleet service', true)
ON CONFLICT (category_name) DO NOTHING;
