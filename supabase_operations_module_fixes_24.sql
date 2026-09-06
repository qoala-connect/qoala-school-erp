-- Migration 24: add the columns the Operations pages collect but never had.
--
-- Nine Add/Save buttons were completely non-functional. Each page's submit
-- handler posted keys with no matching column, so PostgREST rejected the whole
-- row with PGRST204 ("Could not find the '<x>' column of '<table>'") and nothing
-- was ever saved:
--
--   Library     -> Add book              'available_copies'
--   Transport   -> Add route             'stops_count'
--   Transport   -> Add driver            'status'
--   Inventory   -> Add asset             'asset_code'
--   Inventory   -> Add stock item        'min_quantity'
--   Hostel      -> Add hostel            'type'
--   Hostel      -> Add room              (blocked by hostel)
--   Comms       -> Publish notice        'content'
--   Comms       -> Send SMS campaign     'message'
--   Calendar    -> Add calendar event    'academic_year'
--
-- The fix is split in two. Where the table already had a well-named equivalent
-- column, the page code is corrected to use it (copies_total/copies_available,
-- asset_tag, quantity_total, hostel_type, cost_per_month, description,
-- message_text, title/start_date) — see the matching commits in src/pages.
-- This migration covers the other half: fields the UI genuinely collects and
-- displays but that had no home in the schema at all.

-- Library: shelf location is shown in the catalog table and edited in the form.
ALTER TABLE public.library_books
  ADD COLUMN IF NOT EXISTS rack_number text;

-- Transport: number of stops on a route, shown on the route card.
ALTER TABLE public.transport_routes
  ADD COLUMN IF NOT EXISTS stops_count integer NOT NULL DEFAULT 0;

-- Transport: drivers have a duty state distinct from the is_active soft-delete.
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS status character varying NOT NULL DEFAULT 'On-Duty';

-- Inventory: physical condition of a fixed asset.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS condition text NOT NULL DEFAULT 'Good';

-- Inventory: reorder threshold and derived stock state for consumables.
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS min_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'In Stock';

-- Hostel: warden contact details captured on the hostel form.
ALTER TABLE public.hostels
  ADD COLUMN IF NOT EXISTS warden_name text,
  ADD COLUMN IF NOT EXISTS warden_phone text;

-- Hostel: room occupancy type and availability state.
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS room_type text NOT NULL DEFAULT 'Double',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Available';

-- Communication: notices are targeted and scheduled, and can be retired.
ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS target_audience text NOT NULL DEFAULT 'All',
  ADD COLUMN IF NOT EXISTS publish_date date,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Communication: SMS campaigns carry a category and a recipient fan-out count.
ALTER TABLE public.sms_logs
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'Academic',
  ADD COLUMN IF NOT EXISTS recipient_count integer NOT NULL DEFAULT 1;

-- Calendar: the event-type dropdown offers six kinds
-- (Holiday / Exam / Cultural / Sports / Meeting / Academic). They were being
-- squashed into the single is_national boolean, so five of the six were lost on
-- save and every event read back as either "Meeting" or "Holiday".
ALTER TABLE public.holidays
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'Holiday';
