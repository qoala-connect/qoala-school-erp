/**
 * Seeds the Transport module: driver roster, fleet condition, route crew.
 *
 * Usage:  node scripts/seed_transport.mjs           (insert / refresh)
 *         node scripts/seed_transport.mjs --reset   (drop seeded drivers first)
 *
 * The five drivers here are the ones already named in free text on the 248
 * existing student_transport rows — this promotes them to real driver records,
 * puts each behind the wheel of the bus they were already driving, and wires
 * every route to that bus. Vehicles get the registration / insurance / service
 * dates the Fleet tab claims to display but never had.
 *
 * Idempotent: drivers are keyed by licence number, routes and vehicles are
 * matched on the natural keys already in the database.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const day = 86400000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const today = Date.now();

// vehicle_number -> condition. Registration and insurance are separate
// documents, and one bus is deliberately parked for servicing so the fleet
// filters and the GPS badge have both states to show.
const FLEET = {
  'UP-53-BT-1080': { status: 'Active', registration_expiry: iso(today + 400 * day), insurance_expiry: iso(today + 210 * day), last_service_date: iso(today - 24 * day), gps_device_id: 'GPS-TRK-1080' },
  'UP-53-BT-2140': { status: 'Active', registration_expiry: iso(today + 640 * day), insurance_expiry: iso(today + 96 * day), last_service_date: iso(today - 11 * day), gps_device_id: 'GPS-TRK-2140' },
  'UP-53-BT-3948': { status: 'Active', registration_expiry: iso(today + 290 * day), insurance_expiry: iso(today + 41 * day), last_service_date: iso(today - 38 * day), gps_device_id: 'GPS-TRK-3948' },
  'UP-53-BT-4512': { status: 'Maintenance', registration_expiry: iso(today + 150 * day), insurance_expiry: iso(today - 12 * day), last_service_date: iso(today - 2 * day), gps_device_id: 'GPS-TRK-4512' },
  'UP-53-BT-5820': { status: 'Active', registration_expiry: iso(today + 520 * day), insurance_expiry: iso(today + 305 * day), last_service_date: iso(today - 47 * day), gps_device_id: 'GPS-TRK-5820' },
};

// Drivers, each matched to the bus they already drive on the allotment rows.
const DRIVERS = [
  { name: 'Sri Ramashankar Yadav', phone: '9450881215', license_number: 'UP53-20140018221', vehicle_number: 'UP-53-BT-1080', address: 'Gola Bazar, Gorakhpur', experience_years: 14, status: 'On-Duty', license_expiry: iso(today + 430 * day) },
  { name: 'Sri Vinod Kumar Sharma', phone: '9838123456', license_number: 'UP53-20120009874', vehicle_number: 'UP-53-BT-2140', address: 'Gagaha Bazar, Gorakhpur', experience_years: 17, status: 'On-Duty', license_expiry: iso(today + 118 * day) },
  { name: 'Sri Munna Nishad', phone: '9918765432', license_number: 'UP53-20170031145', vehicle_number: 'UP-53-BT-3948', address: 'Dohrighat Road, Mau', experience_years: 9, status: 'On-Duty', license_expiry: iso(today + 690 * day) },
  { name: 'Sri Rajendra Prasad', phone: '7388112233', license_number: 'UP53-20090004562', vehicle_number: 'UP-53-BT-4512', address: 'Belghat, Gorakhpur', experience_years: 21, status: 'On-Leave', license_expiry: iso(today + 58 * day) },
  { name: 'Sri Subhash Maurya', phone: '9628998877', license_number: 'UP53-20160026718', vehicle_number: 'UP-53-BT-5820', address: 'Barhalganj Town, Gorakhpur', experience_years: 11, status: 'On-Duty', license_expiry: iso(today + 275 * day) },
];

// route_name prefix -> stops on that line, and the bus that runs it.
const ROUTE_PLAN = {
  'Route 1': { stops_count: 9, vehicle_number: 'UP-53-BT-1080' },
  'Route 2': { stops_count: 7, vehicle_number: 'UP-53-BT-2140' },
  'Route 3': { stops_count: 11, vehicle_number: 'UP-53-BT-3948' },
  'Route 4': { stops_count: 6, vehicle_number: 'UP-53-BT-4512' },
  'Route 5': { stops_count: 5, vehicle_number: 'UP-53-BT-5820' },
};

async function reset() {
  const { data } = await sb.from('drivers').select('id').in('license_number', DRIVERS.map((d) => d.license_number));
  const ids = (data || []).map((d) => d.id);
  if (ids.length) await sb.from('drivers').delete().in('id', ids);
  console.log(`reset: removed ${ids.length} seeded drivers`);
}

async function seedFleet() {
  const { data: vehicles, error } = await sb.from('vehicles').select('id, vehicle_number, capacity');
  if (error) throw new Error('vehicles: ' + error.message);

  for (const v of vehicles) {
    const spec = FLEET[v.vehicle_number];
    if (!spec) continue;
    const { error: uErr } = await sb.from('vehicles').update(spec).eq('id', v.id);
    if (uErr) throw new Error(`vehicle ${v.vehicle_number}: ${uErr.message}`);
  }
  const active = Object.values(FLEET).filter((f) => f.status === 'Active').length;
  console.log(`fleet: ${vehicles.length} vehicles dated, ${active} active / ${vehicles.length - active} in maintenance`);
  return vehicles;
}

async function seedDrivers(vehicles) {
  const byNumber = Object.fromEntries(vehicles.map((v) => [v.vehicle_number, v.id]));
  const rows = DRIVERS.map(({ vehicle_number, ...d }) => ({
    ...d,
    vehicle_id: byNumber[vehicle_number] || null,
    is_active: true,
  }));

  const { error } = await sb.from('drivers').upsert(rows, { onConflict: 'license_number' });
  if (error) throw new Error('drivers: ' + error.message);

  const { data } = await sb.from('drivers').select('id, name, status, vehicle_id');
  const onDuty = data.filter((d) => d.status === 'On-Duty').length;
  console.log(`drivers: ${data.length} on the roster - ${onDuty} on duty, ${data.length - onDuty} on leave`);
  return data;
}

async function seedRoutes(vehicles) {
  const byNumber = Object.fromEntries(vehicles.map((v) => [v.vehicle_number, v.id]));
  const { data: routes, error } = await sb.from('transport_routes').select('id, route_name');
  if (error) throw new Error('routes: ' + error.message);

  for (const r of routes) {
    const key = Object.keys(ROUTE_PLAN).find((k) => r.route_name.startsWith(k));
    if (!key) continue;
    const plan = ROUTE_PLAN[key];
    const { error: uErr } = await sb.from('transport_routes').update({
      stops_count: plan.stops_count,
      vehicle_id: byNumber[plan.vehicle_number] || null,
    }).eq('id', r.id);
    if (uErr) throw new Error(`route ${r.route_name}: ${uErr.message}`);
  }
  console.log(`routes: ${routes.length} lines crewed and given stop counts`);
  return routes;
}

// The 248 existing allotments only carry a morning pick-up. Give each one the
// matching afternoon drop, 8 hours after the pick-up slot.
async function seedDropTimes() {
  const { data, error } = await sb.from('student_transport').select('id, pickup_time, drop_time');
  if (error) throw new Error('allotments: ' + error.message);

  const dropFor = (pickup) => {
    const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(pickup || '').trim());
    if (!m) return '03:15 PM';
    let h = Number(m[1]) % 12;
    const mins = m[2];
    // Morning pick-up + 8h lands in the afternoon; keep it on a 12h clock.
    h = (h + 8) % 12 || 12;
    return `${String(h).padStart(2, '0')}:${mins} PM`;
  };

  let updated = 0;
  for (const a of data) {
    if (a.drop_time) continue;
    const { error: uErr } = await sb.from('student_transport').update({ drop_time: dropFor(a.pickup_time) }).eq('id', a.id);
    if (uErr) throw new Error(`allotment ${a.id}: ${uErr.message}`);
    updated++;
  }
  console.log(`allotments: ${updated} drop times filled (${data.length} total)`);
}

if (process.argv.includes('--reset')) await reset();
const vehicles = await seedFleet();
await seedDrivers(vehicles);
await seedRoutes(vehicles);
await seedDropTimes();
console.log('transport seed complete');
