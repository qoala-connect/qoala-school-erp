-- Migration 25: align hostels.hostel_type with the Hostel Management dropdown.
--
-- Defect: the "Hostel Type" <select> offers Boys | Girls | Staff | Mixed, but the
-- constraint only accepted the lowercase trio 'boys' | 'girls' | 'co-ed'. Every
-- option failed on save with
--   23514 violates check constraint "hostels_hostel_type_check"
-- Two separate mismatches: letter case, and two options ("Staff" quarters and
-- "Mixed" block) that had no counterpart at all.
--
-- The lowercase legacy values stay valid so existing rows keep satisfying the
-- constraint.

ALTER TABLE public.hostels
  DROP CONSTRAINT IF EXISTS hostels_hostel_type_check;

ALTER TABLE public.hostels
  ADD CONSTRAINT hostels_hostel_type_check CHECK (
    (hostel_type)::text = ANY (ARRAY[
      -- legacy values already stored
      'boys'::text, 'girls'::text, 'co-ed'::text,
      -- values offered by the Hostel Type dropdown
      'Boys'::text, 'Girls'::text, 'Staff'::text, 'Mixed'::text
    ])
  );
