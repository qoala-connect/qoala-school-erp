// Seeds the Assets, Equipment & Inventory module with a plausible starting
// register for St. Joseph's School, Barhalganj: fixed assets, consumable
// stock, the vendors that supply them, and purchase orders across every
// status the UI filters on.
//
//   node scripts/seed_inventory.mjs          -- insert what is missing
//   node scripts/seed_inventory.mjs --reset  -- wipe these tables first
//
// Idempotent: rows are matched on their natural key (asset_tag, item_name,
// vendor_name, order_code) and updated in place, so re-running it will not
// duplicate the register.
import { admin } from './qa/_client.mjs';

const sb = admin();
const reset = process.argv.includes('--reset');

const VENDORS = [
  { vendor_name: 'Vardhan Furnitures & Interiors', contact_person: 'Manoj Vardhan',  phone: '+91 98391 42210', email: 'sales@vardhanfurnitures.in',  address: 'Golghar, Gorakhpur (U.P.)',    status: 'Active' },
  { vendor_name: 'Shreeji Scientific Suppliers',   contact_person: 'Dr. Alok Pandey', phone: '+91 94150 77324', email: 'orders@shreejiscientific.com', address: 'Bank Road, Gorakhpur (U.P.)',  status: 'Active' },
  { vendor_name: 'Navdeep Stationers',             contact_person: 'Ritu Navdeep',    phone: '+91 99356 11804', email: 'navdeepstationers@gmail.com',  address: 'Barhalganj Bazaar, Gorakhpur', status: 'Active' },
  { vendor_name: 'Precision Sports House',         contact_person: 'Imran Siddiqui',  phone: '+91 97928 66150', email: 'contact@precisionsports.in',   address: 'Civil Lines, Gorakhpur (U.P.)', status: 'Active' },
  { vendor_name: 'Anmol Infotech Systems',         contact_person: 'Saurabh Anmol',   phone: '+91 90440 20918', email: 'support@anmolinfotech.co.in',  address: 'Mohaddipur, Gorakhpur (U.P.)', status: 'Active' },
  { vendor_name: 'Kaveri Electricals',             contact_person: 'Deepak Kaveri',   phone: '+91 88539 40027', email: 'kaveri.electricals@gmail.com', address: 'Ghantaghar, Gorakhpur (U.P.)', status: 'Blacklisted' },
];

const ASSETS = [
  { asset_tag: 'AST-FUR-001', asset_name: 'Student Desk & Bench (Two-Seater)', category: 'Furniture',     quantity: 240, purchase_date: '2024-04-12', purchase_cost: 384000, condition: 'Good',      location: 'Junior Wing Classrooms', status: 'operational' },
  { asset_tag: 'AST-FUR-002', asset_name: 'Staff Room Workstation Table',      category: 'Furniture',     quantity: 18,  purchase_date: '2024-06-02', purchase_cost: 106200, condition: 'Excellent', location: 'Staff Room',             status: 'operational' },
  { asset_tag: 'AST-FUR-003', asset_name: 'Steel Almirah (Records)',           category: 'Furniture',     quantity: 12,  purchase_date: '2023-08-19', purchase_cost: 96000,  condition: 'Good',      location: 'Administrative Block',   status: 'operational' },
  { asset_tag: 'AST-ELE-001', asset_name: 'Interactive Smart Board 75 inch',   category: 'Electronics',   quantity: 8,   purchase_date: '2025-05-28', purchase_cost: 512000, condition: 'Excellent', location: 'Senior Wing Classrooms', status: 'operational' },
  { asset_tag: 'AST-ELE-002', asset_name: 'Desktop Computer (i5 / 8GB)',       category: 'Electronics',   quantity: 32,  purchase_date: '2024-07-15', purchase_cost: 928000, condition: 'Good',      location: 'Computer Laboratory',    status: 'operational' },
  { asset_tag: 'AST-ELE-003', asset_name: 'Ceiling Fan 1200mm',                category: 'Electronics',   quantity: 96,  purchase_date: '2023-03-10', purchase_cost: 153600, condition: 'Good',      location: 'Campus Wide',            status: 'operational' },
  { asset_tag: 'AST-ELE-004', asset_name: 'Public Address System (Amplifier)', category: 'Electronics',   quantity: 2,   purchase_date: '2022-11-04', purchase_cost: 48000,  condition: 'Damaged',   location: 'Assembly Ground',        status: 'under maintenance' },
  { asset_tag: 'AST-LAB-001', asset_name: 'Compound Microscope (Monocular)',   category: 'Lab Equipment', quantity: 24,  purchase_date: '2024-09-21', purchase_cost: 216000, condition: 'Excellent', location: 'Biology Laboratory',     status: 'operational' },
  { asset_tag: 'AST-LAB-002', asset_name: 'Physics Optical Bench Set',         category: 'Lab Equipment', quantity: 10,  purchase_date: '2024-09-21', purchase_cost: 74000,  condition: 'Good',      location: 'Physics Laboratory',     status: 'operational' },
  { asset_tag: 'AST-LAB-003', asset_name: 'Chemistry Fume Hood',               category: 'Lab Equipment', quantity: 2,   purchase_date: '2023-01-30', purchase_cost: 118000, condition: 'Good',      location: 'Chemistry Laboratory',   status: 'operational' },
  { asset_tag: 'AST-SPT-001', asset_name: 'Cricket Kit (Complete)',            category: 'Sports',        quantity: 6,   purchase_date: '2025-06-11', purchase_cost: 84000,  condition: 'Excellent', location: 'Sports Store',           status: 'operational' },
  { asset_tag: 'AST-SPT-002', asset_name: 'Basketball Pole & Board',           category: 'Sports',        quantity: 4,   purchase_date: '2022-08-08', purchase_cost: 92000,  condition: 'Damaged',   location: 'Basketball Court',       status: 'damaged' },
  { asset_tag: 'AST-SPT-003', asset_name: 'Table Tennis Board (Foldable)',     category: 'Sports',        quantity: 3,   purchase_date: '2024-12-02', purchase_cost: 51000,  condition: 'Good',      location: 'Indoor Games Hall',      status: 'operational' },
  { asset_tag: 'AST-OTH-001', asset_name: 'Water Purifier (RO, 100 LPH)',      category: 'Other',         quantity: 5,   purchase_date: '2024-02-17', purchase_cost: 137500, condition: 'Good',      location: 'Campus Wide',            status: 'operational' },
  { asset_tag: 'AST-OTH-002', asset_name: 'Diesel Generator 62.5 KVA',         category: 'Other',         quantity: 1,   purchase_date: '2021-05-25', purchase_cost: 465000, condition: 'Good',      location: 'Generator Room',         status: 'operational' },
  { asset_tag: 'AST-OTH-003', asset_name: 'Wooden Notice Board 6x4',           category: 'Other',         quantity: 14,  purchase_date: '2020-07-13', purchase_cost: 25200,  condition: 'Scrapped',  location: 'Corridors',              status: 'written off' },
];

// quantity_available <= quantity_total is enforced by a check constraint.
const STOCK = [
  { item_code: 'STK-STA-001', item_name: 'Attendance Register (200 pages)', item_category: 'Stationery',   quantity_total: 180,  quantity_available: 142,  min_quantity: 60,   unit_price: 145 },
  { item_code: 'STK-STA-002', item_name: 'A4 Copier Paper (Ream)',          item_category: 'Stationery',   quantity_total: 240,  quantity_available: 96,   min_quantity: 100,  unit_price: 285 },
  { item_code: 'STK-STA-003', item_name: 'Whiteboard Marker (Black)',       item_category: 'Stationery',   quantity_total: 600,  quantity_available: 385,  min_quantity: 150,  unit_price: 28 },
  { item_code: 'STK-STA-004', item_name: 'Chalk Box (Dustless, 100 pcs)',   item_category: 'Stationery',   quantity_total: 120,  quantity_available: 34,   min_quantity: 40,   unit_price: 62 },
  { item_code: 'STK-EXM-001', item_name: 'CBSE Answer Booklet (32 pages)',  item_category: 'Examination',  quantity_total: 4000, quantity_available: 2650, min_quantity: 1000, unit_price: 12 },
  { item_code: 'STK-EXM-002', item_name: 'Report Card Folder',              item_category: 'Examination',  quantity_total: 900,  quantity_available: 900,  min_quantity: 200,  unit_price: 38 },
  { item_code: 'STK-LAB-001', item_name: 'Glass Test Tube (Borosilicate)',  item_category: 'Laboratory',   quantity_total: 500,  quantity_available: 318,  min_quantity: 150,  unit_price: 22 },
  { item_code: 'STK-LAB-002', item_name: 'Litmus Paper Booklet',            item_category: 'Laboratory',   quantity_total: 80,   quantity_available: 0,    min_quantity: 25,   unit_price: 95 },
  { item_code: 'STK-HYG-001', item_name: 'Liquid Hand Wash (5 L Can)',      item_category: 'Housekeeping', quantity_total: 60,   quantity_available: 21,   min_quantity: 24,   unit_price: 480 },
  { item_code: 'STK-HYG-002', item_name: 'Floor Disinfectant (5 L Can)',    item_category: 'Housekeeping', quantity_total: 48,   quantity_available: 30,   min_quantity: 20,   unit_price: 395 },
  { item_code: 'STK-MED-001', item_name: 'First Aid Refill Kit',            item_category: 'Medical',      quantity_total: 25,   quantity_available: 9,    min_quantity: 10,   unit_price: 850 },
  { item_code: 'STK-SPT-001', item_name: 'Shuttlecock (Feather, Tube)',     item_category: 'Sports',       quantity_total: 90,   quantity_available: 52,   min_quantity: 30,   unit_price: 320 },
];

// `vendor` is resolved to vendor_id after the vendors upsert.
const ORDERS = [
  { order_code: 'PO-2026-001', vendor: 'Shreeji Scientific Suppliers',   item_ordered: 'Compound Microscope (Monocular) x 12, prepared slide sets',  quantity: 12,   total_price: 108000, status: 'Received',  delivery_date: '2026-06-18' },
  { order_code: 'PO-2026-002', vendor: 'Navdeep Stationers',             item_ordered: 'A4 copier paper, whiteboard markers, chalk boxes',           quantity: 460,  total_price: 96420,  status: 'Received',  delivery_date: '2026-07-02' },
  { order_code: 'PO-2026-003', vendor: 'Anmol Infotech Systems',         item_ordered: 'Interactive Smart Board 75 inch with wall mount',            quantity: 4,    total_price: 256000, status: 'Sent',      delivery_date: null },
  { order_code: 'PO-2026-004', vendor: 'Precision Sports House',         item_ordered: 'Basketball pole & board replacement units',                  quantity: 2,    total_price: 46000,  status: 'Sent',      delivery_date: null },
  { order_code: 'PO-2026-005', vendor: 'Navdeep Stationers',             item_ordered: 'CBSE answer booklets for Term-2 assessments',                quantity: 3000, total_price: 36000,  status: 'Draft',     delivery_date: null },
  { order_code: 'PO-2026-006', vendor: 'Vardhan Furnitures & Interiors', item_ordered: 'Student desk & bench (two-seater) for new Class 6 section',  quantity: 40,   total_price: 64000,  status: 'Draft',     delivery_date: null },
  { order_code: 'PO-2026-007', vendor: 'Kaveri Electricals',             item_ordered: 'Ceiling fan 1200mm x 24 - cancelled, vendor blacklisted',    quantity: 24,   total_price: 38400,  status: 'Cancelled', delivery_date: null },
  { order_code: 'PO-2026-008', vendor: 'Shreeji Scientific Suppliers',   item_ordered: 'Glass test tubes, litmus booklets, lab consumables refill',  quantity: 380,  total_price: 18960,  status: 'Sent',      delivery_date: null },
];

const stockStatus = (available, min) =>
  available <= 0 ? 'Out of Stock' : available <= min ? 'Low Stock' : 'In Stock';

async function upsert(table, rows, conflictKey) {
  const { data, error } = await sb.from(table).upsert(rows, { onConflict: conflictKey }).select();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

async function main() {
  if (reset) {
    for (const t of ['purchase_orders', 'vendors', 'inventory', 'assets']) {
      const { error } = await sb.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw new Error(`reset ${t}: ${error.message}`);
    }
    console.log('reset: cleared purchase_orders, vendors, inventory, assets');
  }

  const vendors = await upsert('vendors', VENDORS, 'vendor_name');
  console.log(`vendors          : ${vendors.length}`);

  const assets = await upsert('assets', ASSETS, 'asset_tag');
  console.log(`assets           : ${assets.length}`);

  const stock = await upsert(
    'inventory',
    STOCK.map((s) => ({ ...s, status: stockStatus(s.quantity_available, s.min_quantity) })),
    'item_name'
  );
  console.log(`inventory        : ${stock.length}`);

  const vendorId = new Map(vendors.map((v) => [v.vendor_name, v.id]));
  const orders = await upsert(
    'purchase_orders',
    ORDERS.map(({ vendor, ...o }) => ({ ...o, vendor_name: vendor, vendor_id: vendorId.get(vendor) ?? null })),
    'order_code'
  );
  console.log(`purchase_orders  : ${orders.length}`);

  const assetValue = assets.reduce((a, x) => a + Number(x.purchase_cost || 0), 0);
  const stockValue = stock.reduce((a, x) => a + Number(x.unit_price || 0) * Number(x.quantity_available || 0), 0);
  const lowStock = stock.filter((x) => Number(x.quantity_available) <= Number(x.min_quantity)).length;
  console.log(`\nasset valuation  : Rs.${assetValue.toLocaleString('en-IN')}`);
  console.log(`stock on hand    : Rs.${Math.round(stockValue).toLocaleString('en-IN')}`);
  console.log(`low/out of stock : ${lowStock} of ${stock.length} items`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
