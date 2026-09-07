-- ROLLBACK for supabase_inventory_module_34.sql.
-- Drops the vendors / purchase_orders tables and the three added columns.
-- Any vendor and purchase-order records entered since the migration are
-- lost, so export them first if they matter.

BEGIN;

DROP TABLE IF EXISTS public.purchase_orders;
DROP TABLE IF EXISTS public.vendors;

ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_item_code_key;
ALTER TABLE public.inventory DROP COLUMN IF EXISTS item_code;

ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_quantity_check;
ALTER TABLE public.assets DROP COLUMN IF EXISTS quantity;

COMMIT;

NOTIFY pgrst, 'reload schema';
