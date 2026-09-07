-- ---------------------------------------------------------------------
-- 32. TRANSPORT MODULE — fleet condition, driver credentials, route crew
-- ---------------------------------------------------------------------
-- TransportManagement.tsx renders a "GPS Tracking State" badge off
-- `vehicles.status` and an "Insurance Expiry" column off registration_expiry.
-- Neither held what the page claimed:
--   * vehicles.status did not exist, so every vehicle rendered Offline, and
--   * insurance and registration are different documents with different dates,
--     so the page was showing one under the other's name.
--
-- The fleet also had no crew wiring at all. student_transport carried
-- driver_name/driver_phone as loose text while the drivers table sat empty, so
-- the Certified Drivers tab was blank even though five drivers were named on
-- 248 allotments. The link is modelled once, not twice:
--   drivers.vehicle_id          (already existed) — the bus a driver drives
--   transport_routes.vehicle_id (new)             — the bus serving a route
-- and a route's driver is derived from the two, so they cannot disagree.
--
-- Additive only: every column is nullable or defaulted.

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS insurance_expiry DATE,
  ADD COLUMN IF NOT EXISTS last_service_date DATE,
  ADD COLUMN IF NOT EXISTS gps_device_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_status_check') THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_status_check
      CHECK (status IN ('Active', 'Maintenance', 'Retired'));
  END IF;
END $$;

-- Driver credentials the Certified Drivers tab collects and audits.
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS license_expiry DATE,
  ADD COLUMN IF NOT EXISTS experience_years INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_status_check') THEN
    ALTER TABLE public.drivers
      ADD CONSTRAINT drivers_status_check
      CHECK (status IN ('On-Duty', 'On-Leave'));
  END IF;
END $$;

-- Which bus runs this route. The driver follows from drivers.vehicle_id.
ALTER TABLE public.transport_routes
  ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL;

-- The allotment table tracked only the morning pick-up.
ALTER TABLE public.student_transport
  ADD COLUMN IF NOT EXISTS drop_time TEXT;

CREATE INDEX IF NOT EXISTS idx_drivers_vehicle_id ON public.drivers(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_transport_routes_vehicle_id ON public.transport_routes(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_student_transport_route_id ON public.student_transport(route_id);
CREATE INDEX IF NOT EXISTS idx_student_transport_vehicle_id ON public.student_transport(vehicle_id);
