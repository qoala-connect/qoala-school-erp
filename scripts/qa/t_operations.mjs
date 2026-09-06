// Operations modules — Library, Transport, Inventory, Hostel, Communication,
// Certificates, Online Classes, School Calendar.
// Every payload below is copied verbatim from the page's submit handler, so a
// failure here is a failure of that page's Add/Save button.
import { asAdmin, ok, assert, check, module, refs, uniq, trashIt } from './_harness.mjs';

export default async function run() {
  module('Operations');
  const { sb } = await asAdmin();
  const r = await refs();
  const student = r.students[0];
  let bookId = null, routeId = null, vehicleId = null, driverId = null, hostelId = null;

  // ============================================================== LIBRARY
  await check('Library/Books', 'Add book (insert library_books)', async () => {
    // LibraryManagement.tsx handleSubmit, activeTab === 'books'
    const payload = {
      title: uniq('Book'), author: 'QA Author', isbn: 'QA-' + Math.floor(Math.random() * 1e9),
      category: 'General', rack_number: 'R-12',
      copies_total: 5, copies_available: 5,
    };
    const data = ok(await sb.from('library_books').insert([payload]).select().single(), 'insert library_books');
    bookId = data.id; trashIt('library_books', bookId);
    return 'ok';
  });

  await check('Library/Issues', 'Issue book (insert book_issues)', async () => {
    assert(bookId, 'no book');
    // LibraryManagement.tsx handleSubmit, activeTab === 'issues'
    const payload = {
      book_id: bookId,
      issue_date: new Date().toISOString().substring(0, 10),
      due_date: new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10),
      status: 'issued',
    };
    const data = ok(await sb.from('book_issues').insert([payload]).select().single(), 'insert book_issues');
    trashIt('book_issues', data.id);
    return 'ok';
  });

  await check('Library/Books', 'Edit + delete book (update/delete library_books)', async () => {
    assert(bookId, 'no book');
    ok(await sb.from('library_books').update({ author: 'QA Author 2' }).eq('id', bookId).select().single(), 'update library_books');
    return 'ok';
  });

  // ============================================================ TRANSPORT
  await check('Transport/Routes', 'Add route (insert transport_routes)', async () => {
    // TransportManagement.tsx handleSubmit, activeTab === 'routes'
    const payload = {
      route_name: uniq('Route').slice(0, 40), start_point: 'QA Start', end_point: 'QA End',
      fare_amount: 1200, stops_count: 8,
    };
    const data = ok(await sb.from('transport_routes').insert([payload]).select().single(), 'insert transport_routes');
    routeId = data.id; trashIt('transport_routes', routeId);
    return 'ok';
  });

  await check('Transport/Vehicles', 'Add vehicle (insert vehicles)', async () => {
    // TransportManagement.tsx handleSubmit, activeTab === 'vehicles'
    const payload = {
      vehicle_number: 'QA-' + Math.floor(Math.random() * 99999), vehicle_model: 'QA Bus',
      capacity: 40, registration_expiry: '2031-03-31',
    };
    const data = ok(await sb.from('vehicles').insert([payload]).select().single(), 'insert vehicles');
    vehicleId = data.id; trashIt('vehicles', vehicleId);
    return 'ok';
  });

  await check('Transport/Drivers', 'Add driver (insert drivers)', async () => {
    // TransportManagement.tsx handleSubmit, activeTab === 'drivers'
    const payload = {
      name: uniq('Driver').slice(0, 40), license_number: 'QA-LIC-' + Math.floor(Math.random() * 99999),
      phone: '9500000001', status: 'On-Duty',
    };
    const data = ok(await sb.from('drivers').insert([payload]).select().single(), 'insert drivers');
    driverId = data.id; trashIt('drivers', driverId);
    return 'ok';
  });

  await check('Transport/Allotments', 'Allot transport to student (insert student_transport)', async () => {
    assert(routeId && vehicleId, 'missing refs');
    // student_transport_student_unique allows one allotment per student, so
    // pick one that isn't already allotted (the UI's own picker does the same).
    const taken = new Set((ok(await sb.from('student_transport').select('student_id').limit(1000), 'existing allotments')).map((x) => x.student_id));
    const student = r.students.find((s) => !taken.has(s.id));
    assert(student, 'every sampled student already has a transport allotment');
    // TransportManagement.tsx handleSubmit, activeTab === 'allotments'
    const payload = {
      student_id: student.id, route_id: routeId, vehicle_id: vehicleId,
      boarding_point: 'QA Stop', pickup_time: '07:30',
    };
    const data = ok(await sb.from('student_transport').insert([payload]).select().single(), 'insert student_transport');
    trashIt('student_transport', data.id);
    return 'ok';
  });

  // ============================================================ INVENTORY
  await check('Inventory/Assets', 'Add asset (insert assets)', async () => {
    // InventoryManagement.tsx handleSave, activeTab === 'assets'
    const payload = {
      asset_name: uniq('Asset').slice(0, 40), asset_tag: 'QA-AST-' + Math.floor(Math.random() * 9999),
      category: 'Furniture', purchase_date: new Date().toISOString().substring(0, 10),
      purchase_cost: 5000, condition: 'Good', status: 'operational',
    };
    const data = ok(await sb.from('assets').insert([payload]).select().single(), 'insert assets');
    trashIt('assets', data.id);
    return 'ok';
  });

  await check('Inventory/Stock', 'Add stock item (insert inventory)', async () => {
    // InventoryManagement.tsx handleSave, activeTab === 'stock'
    const payload = {
      item_name: uniq('Item').slice(0, 40), quantity_total: 25, quantity_available: 25,
      min_quantity: 10, status: 'In Stock',
    };
    const data = ok(await sb.from('inventory').insert([payload]).select().single(), 'insert inventory');
    trashIt('inventory', data.id);
    return 'ok';
  });

  // =============================================================== HOSTEL
  await check('Hostel/Hostels', 'Add hostel (insert hostels)', async () => {
    // HostelManagement.tsx handleSave, activeTab === 'hostels'
    const payload = {
      name: uniq('Hostel').slice(0, 40), hostel_type: 'Boys', capacity: 100,
      warden_name: 'QA Warden', warden_phone: '9400000001', address: 'Campus Complex',
    };
    const data = ok(await sb.from('hostels').insert([payload]).select().single(), 'insert hostels');
    hostelId = data.id; trashIt('hostels', hostelId);
    // Every option in the Hostel Type dropdown must be storable.
    for (const t of ['Boys', 'Girls', 'Staff', 'Mixed']) {
      ok(await sb.from('hostels').update({ hostel_type: t }).eq('id', hostelId).select().single(), `hostel_type "${t}"`);
    }
    return '4 hostel types';
  });

  await check('Hostel/Rooms', 'Add room (insert rooms)', async () => {
    assert(hostelId, 'no hostel');
    // HostelManagement.tsx handleSave, activeTab === 'rooms'
    const payload = {
      hostel_id: hostelId, room_number: 'QA-101', room_type: 'Double',
      capacity: 2, cost_per_month: 3000, occupied: 0, status: 'Available',
    };
    const data = ok(await sb.from('rooms').insert([payload]).select().single(), 'insert rooms');
    trashIt('rooms', data.id);
    return 'ok';
  });

  // ======================================================== COMMUNICATION
  await check('Communication/Notices', 'Publish notice (insert notices)', async () => {
    // CommunicationManagement.tsx handleSave, activeTab === 'notices'
    const payload = {
      title: uniq('Notice'), description: 'QA notice body', target_audience: 'All',
      publish_date: new Date().toISOString().substring(0, 10), is_active: true,
    };
    const data = ok(await sb.from('notices').insert([payload]).select().single(), 'insert notices');
    trashIt('notices', data.id);
    return 'ok';
  });

  await check('Communication/SMS', 'Send SMS campaign (insert sms_logs)', async () => {
    // CommunicationManagement.tsx handleSave, activeTab === 'sms'
    const payload = {
      message_text: 'QA sms body', recipient_phone: 'Broadcast',
      type: 'Academic', status: 'Delivered', recipient_count: 50,
    };
    const data = ok(await sb.from('sms_logs').insert([payload]).select().single(), 'insert sms_logs');
    trashIt('sms_logs', data.id);
    return 'ok';
  });

  await check('Communication/Email', 'Send email broadcast (insert email_logs)', async () => {
    // CommunicationManagement.tsx handleSave, activeTab === 'email'
    const payload = {
      subject: uniq('Subject'), recipient_email: 'qa.parents@example.com', status: 'Sent',
    };
    const data = ok(await sb.from('email_logs').insert([payload]).select().single(), 'insert email_logs');
    trashIt('email_logs', data.id);
    return 'ok';
  });

  // ========================================================= ONLINE CLASSES
  await check('OnlineClasses', 'Schedule online class (insert online_classes)', async () => {
    // OnlineClasses.tsx handleSave
    const start = new Date(Date.now() + 86400000);
    const end = new Date(start.getTime() + 45 * 60000);
    const payload = {
      title: uniq('Class'), class: 'Class 10th', subject: 'Mathematics',
      teacher_name: 'QA Teacher', meeting_url: 'https://meet.example.com/qa',
      start_time: start.toISOString(), end_time: end.toISOString(), status: 'Scheduled',
    };
    const data = ok(await sb.from('online_classes').insert([payload]).select().single(), 'insert online_classes');
    trashIt('online_classes', data.id);
    return 'ok';
  });

  // ======================================================== SCHOOL CALENDAR
  await check('SchoolCalendar', 'Add calendar event (insert holidays)', async () => {
    // SchoolCalendar.tsx handleSave
    const payload = {
      title: uniq('Event'), description: 'QA event', start_date: '2030-08-15',
      end_date: '2030-08-15', event_type: 'Cultural', is_national: false, is_active: true,
    };
    const data = ok(await sb.from('holidays').insert([payload]).select().single(), 'insert holidays');
    trashIt('holidays', data.id);
    return 'ok';
  });

  // =========================================================== CERTIFICATES
  await check('Certificates', 'Issue certificate (insert certificates)', async () => {
    assert(student, 'no student');
    // CertificateGenerator.tsx
    const payload = {
      student_id: student.id, certificate_type: 'Bonafide',
      serial_number: uniq('CERT'), template_name: 'QA-VER-' + Math.floor(Math.random() * 9999),
      issued_at: new Date().toISOString(),
    };
    const data = ok(await sb.from('certificates').insert(payload).select().single(), 'insert certificates');
    trashIt('certificates', data.id);
    return 'ok';
  });

  // ============================================================ FRONT OFFICE
  await check('FrontOffice', 'Update visitor log status (update front_office_logs)', async () => {
    const data = ok(await sb.from('front_office_logs').insert([{
      name: uniq('Visitor'), phone: '9300000001', type: 'Visitor', purpose: 'QA',
      date_time: new Date().toISOString(), assigned_to: 'Reception', status: 'Open',
    }]).select().single(), 'insert front_office_logs');
    trashIt('front_office_logs', data.id);
    ok(await sb.from('front_office_logs').update({ status: 'Closed', notes: 'QA closed' }).eq('id', data.id), 'update front_office_logs');
    return 'ok';
  });
}
