// Transport module — routes, fleet, driver roster and student allotments.
// Every query and payload below mirrors TransportManagement.tsx, so a failure
// here is a failure of that page.
import { asAdmin, ok, assert, check, module, refs, uniq, trashIt } from './_harness.mjs';

const day = 86400000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

export default async function run() {
  module('Transport');
  const { sb } = await asAdmin();
  const r = await refs();
  let routeId = null;
  let vehicleId = null;
  let driverId = null;
  let otherDriverId = null;
  let allotId = null;

  await check('Transport', 'Page load reads every fleet table', async () => {
    // TransportManagement.tsx loadData()
    const routes = ok(await sb.from('transport_routes').select('*').order('route_name'), 'select transport_routes');
    const vehicles = ok(await sb.from('vehicles').select('*'), 'select vehicles');
    const drivers = ok(await sb.from('drivers').select('*'), 'select drivers');
    const allots = ok(await sb.from('student_transport').select('*, students(id, name, class, section)'), 'select student_transport + embed');
    assert(routes.length > 0, 'no routes — run scripts/seed_transport.mjs');
    assert(drivers.length > 0, 'driver roster is empty — run scripts/seed_transport.mjs');
    assert(allots.length > 0, 'no allotments');
    return `${routes.length} routes, ${vehicles.length} vehicles, ${drivers.length} drivers, ${allots.length} allotments`;
  });

  await check('Transport/Vehicles', 'Fleet state and both document dates persist', async () => {
    // The page's GPS badge reads vehicles.status, which did not exist before.
    const payload = {
      vehicle_number: 'QA-' + Math.floor(Math.random() * 99999),
      vehicle_model: 'QA Bus',
      capacity: 40,
      status: 'Maintenance',
      registration_expiry: '2031-03-31',
      insurance_expiry: '2029-08-15',
      last_service_date: iso(Date.now() - 10 * day),
      gps_device_id: 'QA-GPS-1',
    };
    const data = ok(await sb.from('vehicles').insert([payload]).select().single(), 'insert vehicles');
    vehicleId = data.id;
    trashIt('vehicles', vehicleId);
    assert(data.status === 'Maintenance', 'status not stored');
    assert(data.insurance_expiry === '2029-08-15', 'insurance_expiry not stored');
    assert(data.registration_expiry === '2031-03-31', 'registration must stay distinct from insurance');
    assert(data.insurance_expiry !== data.registration_expiry, 'insurance and registration collapsed into one date');
    return 'ok';
  });

  await check('Transport/Vehicles', 'Fleet state vocabulary is enforced', async () => {
    const res = await sb.from('vehicles').insert([{ vehicle_number: 'QA-BAD-' + Date.now(), status: 'Teleporting' }]);
    assert(res.error, 'an unknown fleet state was accepted');
    return 'rejected as expected';
  });

  await check('Transport/Drivers', 'Driver saves name, number, licence and address', async () => {
    assert(vehicleId, 'no vehicle');
    // TransportManagement.tsx handleSubmit, activeTab === 'drivers'
    const payload = {
      name: uniq('QA Driver').slice(0, 40),
      license_number: 'QA-LIC-' + Math.floor(Math.random() * 99999),
      license_expiry: iso(Date.now() + 200 * day),
      phone: '9500000001',
      address: 'QA Nagar, Gorakhpur',
      experience_years: 12,
      vehicle_id: vehicleId,
      status: 'On-Duty',
    };
    const data = ok(await sb.from('drivers').insert([payload]).select().single(), 'insert drivers');
    driverId = data.id;
    trashIt('drivers', driverId);
    assert(data.phone === '9500000001', 'phone not stored');
    assert(data.address === 'QA Nagar, Gorakhpur', 'address not stored');
    assert(data.experience_years === 12, 'experience not stored');
    assert(data.license_expiry, 'licence expiry not stored');
    assert(data.vehicle_id === vehicleId, 'bus assignment not stored');
    return 'ok';
  });

  await check('Transport/Drivers', 'Duty status vocabulary is enforced', async () => {
    const res = await sb.from('drivers').insert([{
      name: 'QA Bad Status', license_number: 'QA-BAD-' + Date.now(), status: 'Napping',
    }]);
    assert(res.error, 'an unknown duty status was accepted');
    return 'rejected as expected';
  });

  await check('Transport/Drivers', 'Assigning a bus releases its previous driver', async () => {
    assert(vehicleId && driverId, 'no driver');
    const second = ok(await sb.from('drivers').insert([{
      name: uniq('QA Driver B').slice(0, 40),
      license_number: 'QA-LIC-' + Math.floor(Math.random() * 99999),
      phone: '9500000002', status: 'On-Duty', vehicle_id: vehicleId,
    }]).select().single(), 'insert second driver');
    otherDriverId = second.id;
    trashIt('drivers', otherDriverId);

    // The page clears anyone else holding that bus, so the derived
    // route -> vehicle -> driver chain can never return two drivers.
    ok(await sb.from('drivers').update({ vehicle_id: null }).eq('vehicle_id', vehicleId).neq('id', otherDriverId), 'release previous driver');

    const holders = ok(await sb.from('drivers').select('id').eq('vehicle_id', vehicleId), 'reread holders');
    assert(holders.length === 1, `expected exactly one driver on the bus, got ${holders.length}`);
    assert(holders[0].id === otherDriverId, 'the wrong driver kept the bus');
    return 'one driver per bus';
  });

  await check('Transport/Routes', 'Route carries its serving bus', async () => {
    assert(vehicleId, 'no vehicle');
    const payload = {
      route_name: uniq('QA Route').slice(0, 40),
      start_point: 'QA Start', end_point: 'QA End',
      fare_amount: 1200, stops_count: 8, vehicle_id: vehicleId,
    };
    const data = ok(await sb.from('transport_routes').insert([payload]).select().single(), 'insert transport_routes');
    routeId = data.id;
    trashIt('transport_routes', routeId);
    assert(data.vehicle_id === vehicleId, 'route vehicle not stored');
    return 'ok';
  });

  await check('Transport/Routes', 'Route crew derives through the bus', async () => {
    assert(routeId, 'no route');
    // routes.vehicle_id -> drivers.vehicle_id, the page's driverForVehicle().
    const route = ok(await sb.from('transport_routes').select('vehicle_id').eq('id', routeId).single(), 'reread route');
    const crew = ok(await sb.from('drivers').select('id, name').eq('vehicle_id', route.vehicle_id), 'derive driver');
    assert(crew.length === 1, `expected one driver for the route, got ${crew.length}`);
    return crew[0].name;
  });

  await check('Transport/Allotments', 'Allot a student with pick-up and drop', async () => {
    assert(routeId && vehicleId, 'missing refs');
    const taken = new Set(ok(await sb.from('student_transport').select('student_id').limit(2000), 'existing allotments').map((x) => x.student_id));
    const student = r.students.find((s) => !taken.has(s.id));
    assert(student, 'every sampled student already has an allotment');

    const payload = {
      student_id: student.id, route_id: routeId, vehicle_id: vehicleId,
      boarding_point: 'QA Crossing', pickup_time: '07:30 AM', drop_time: '03:30 PM',
    };
    const data = ok(await sb.from('student_transport').insert([payload]).select().single(), 'insert student_transport');
    allotId = data.id;
    trashIt('student_transport', allotId);
    assert(data.drop_time === '03:30 PM', 'drop time not stored');
    return 'ok';
  });

  await check('Transport/Allotments', 'A student cannot hold two allotments', async () => {
    assert(allotId, 'no allotment');
    const existing = ok(await sb.from('student_transport').select('student_id').eq('id', allotId).single(), 'reread allotment');
    const res = await sb.from('student_transport').insert([{
      student_id: existing.student_id, route_id: routeId, vehicle_id: vehicleId,
      boarding_point: 'QA Duplicate', pickup_time: '08:00 AM',
    }]);
    assert(res.error, 'a duplicate allotment was accepted');
    return 'rejected as expected';
  });

  await check('Transport/Allotments', 'Ledger resolves student, route, vehicle and driver', async () => {
    assert(allotId, 'no allotment');
    const row = ok(await sb.from('student_transport').select('*, students(id, name, class, section)').eq('id', allotId).single(), 'select allotment + embed');
    assert(row.students?.name, 'students embed did not resolve');
    const route = ok(await sb.from('transport_routes').select('route_name, vehicle_id').eq('id', row.route_id).single(), 'route lookup');
    const crew = ok(await sb.from('drivers').select('name, phone').eq('vehicle_id', row.vehicle_id), 'driver lookup');
    assert(route.route_name, 'route did not resolve');
    assert(crew.length === 1 && crew[0].phone, 'driver name and number did not resolve');
    return `${row.students.name} -> ${route.route_name} -> ${crew[0].name}`;
  });

  await check('Transport/Vehicles', 'Seat occupancy counts real riders', async () => {
    assert(vehicleId, 'no vehicle');
    const bus = ok(await sb.from('vehicles').select('capacity').eq('id', vehicleId).single(), 'read capacity');
    const riders = ok(await sb.from('student_transport').select('id').eq('vehicle_id', vehicleId), 'count riders');
    assert(riders.length >= 1, 'the seeded rider was not counted');
    return `${riders.length}/${bus.capacity} seats taken`;
  });
}
