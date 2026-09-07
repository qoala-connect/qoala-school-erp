-- =====================================================================
-- INVENTORY MIGRATION 34 — vendors, purchase orders, and the columns the
-- Inventory screen was already asking the user to fill in
-- =====================================================================
-- The Assets, Equipment & Inventory page ships four tabs. Only two of
-- them had anywhere to store what the user typed:
--
--   * Vendors Directory  — no table existed. loadData() never fetched
--     vendors, handleSave() had no branch for them, so the tab was
--     permanently empty and "Add Record" silently discarded the form.
--   * Purchase Orders    — same, and the PO form's vendor dropdown was
--     fed from that empty list, so it could not even be submitted.
--   * Fixed Assets       — the form asks for "Quantity Count" but
--     assets had no quantity column; the table rendered a hardcoded
--     "1 units" for every asset.
--   * Consumable Stock   — the form asks for an Item Code and a Unit
--     Price. inventory has unit_price but the page never wrote it and
--     displayed a hardcoded 100; there was no code column at all, so
--     the code was faked from the row's uuid.
--
-- This adds the two missing tables and the three missing columns, with
-- the same RLS shape the existing inventory tables use
-- (is_admin() OR auth_has_permission('inventory.manage')).
--
-- ROLLBACK: supabase_inventory_module_34_rollback.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Columns the existing forms already collect
-- ---------------------------------------------------------------------
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_quantity_check') THEN
    ALTER TABLE public.assets ADD CONSTRAINT assets_quantity_check CHECK (quantity >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.assets.quantity IS
  'Units held under one asset tag (a set of 40 lab stools is one row, quantity 40).';

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS item_code varchar(40);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_item_code_key') THEN
    ALTER TABLE public.inventory ADD CONSTRAINT inventory_item_code_key UNIQUE (item_code);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. Vendors directory
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendors (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name    varchar(160) NOT NULL UNIQUE,
  contact_person varchar(120),
  phone          varchar(40),
  email          varchar(160),
  address        text,
  status         text NOT NULL DEFAULT 'Active'
                 CHECK (status IN ('Active', 'Blacklisted')),
  school_id      uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  is_active      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

COMMENT ON TABLE public.vendors IS
  'Approved suppliers for school purchasing. Blacklisted vendors are kept, not deleted, so historical purchase orders still name who supplied the goods.';

-- ---------------------------------------------------------------------
-- 3. Purchase orders
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code    varchar(40) NOT NULL UNIQUE,
  vendor_id     uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  -- Denormalised on purpose: a PO must keep naming its supplier even if
  -- the vendor row is later removed from the directory.
  vendor_name   varchar(160) NOT NULL,
  item_ordered  text NOT NULL,
  quantity      integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  total_price   numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (total_price >= 0),
  status        text NOT NULL DEFAULT 'Draft'
                CHECK (status IN ('Draft', 'Sent', 'Received', 'Cancelled')),
  delivery_date date,
  school_id     uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_orders_vendor_idx ON public.purchase_orders (vendor_id);
CREATE INDEX IF NOT EXISTS purchase_orders_status_idx ON public.purchase_orders (status);

-- ---------------------------------------------------------------------
-- 4. updated_at maintenance, matching trigger_update_assets
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_update_vendors ON public.vendors;
CREATE TRIGGER trigger_update_vendors
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

DROP TRIGGER IF EXISTS trigger_update_purchase_orders ON public.purchase_orders;
CREATE TRIGGER trigger_update_purchase_orders
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- ---------------------------------------------------------------------
-- 5. RLS — same gate as assets and inventory. anon gets nothing.
-- ---------------------------------------------------------------------
ALTER TABLE public.vendors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.vendors         FROM anon;
REVOKE ALL ON public.purchase_orders FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;

DROP POLICY IF EXISTS vendors_manager_all ON public.vendors;
CREATE POLICY vendors_manager_all ON public.vendors
  FOR ALL TO authenticated
  USING      ((SELECT public.is_admin()) OR (SELECT public.auth_has_permission('inventory.manage')))
  WITH CHECK ((SELECT public.is_admin()) OR (SELECT public.auth_has_permission('inventory.manage')));

DROP POLICY IF EXISTS purchase_orders_manager_all ON public.purchase_orders;
CREATE POLICY purchase_orders_manager_all ON public.purchase_orders
  FOR ALL TO authenticated
  USING      ((SELECT public.is_admin()) OR (SELECT public.auth_has_permission('inventory.manage')))
  WITH CHECK ((SELECT public.is_admin()) OR (SELECT public.auth_has_permission('inventory.manage')));

COMMIT;

NOTIFY pgrst, 'reload schema';
