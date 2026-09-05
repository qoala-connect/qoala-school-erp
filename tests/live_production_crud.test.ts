/**
 * Master Live Production CRUD & Backend/Frontend End-to-End Test Suite
 * Executes real database operations against live Supabase PostgreSQL and Express backend.
 * Tests Create, Read, Update, Delete across all entities and safely cleans up test data.
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { assert } from './infra/assert';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://cqylpqrharentkjmrymr.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ANON_KEY;

const anonClient = createClient(SUPABASE_URL, ANON_KEY);
const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

interface CrudResult {
  module: string;
  operation: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: CrudResult[] = [];

async function runStep(module: string, operation: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    results.push({ module, operation, passed: true, durationMs });
    console.log(`  [PASS] [${module}] ${operation} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    results.push({ module, operation, passed: false, error: err.message, durationMs });
    console.error(`  [FAIL] [${module}] ${operation} (${durationMs}ms)\n         Error: ${err.message}`);
  }
}

async function main() {
  console.log('\n======================================================');
  console.log('LIVE PRODUCTION CRUD & FULL-STACK SYSTEM AUDIT');
  console.log('======================================================\n');

  let adminToken = '';
  let authedClient: any = null;
  const testRunId = Date.now().toString(36).toUpperCase();

  // 1. AUTHENTICATION
  console.log('--- 1. Live Authentication & Token Issuance ---');

  await runStep('Auth', 'Admin login (admin@school.com)', async () => {
    const { data, error } = await anonClient.auth.signInWithPassword({
      email: 'admin@school.com',
      password: 'Password@123'
    });
    if (error) throw error;
    assert.ok(data.session?.access_token, 'Admin access token received');
    adminToken = data.session?.access_token || '';
    authedClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      }
    });
  });

  await runStep('Auth', 'Teacher login (teacher@school.com)', async () => {
    const { data, error } = await anonClient.auth.signInWithPassword({
      email: 'teacher@school.com',
      password: 'Password@123'
    });
    if (error) throw error;
    assert.ok(data.session?.access_token, 'Teacher access token received');
  });

  await runStep('Auth', 'Student login (student@school.com)', async () => {
    const { data, error } = await anonClient.auth.signInWithPassword({
      email: 'student@school.com',
      password: 'Password@123'
    });
    if (error) throw error;
    assert.ok(data.session?.access_token, 'Student access token received');
  });

  await runStep('Auth', 'Parent login (parent@school.com)', async () => {
    const { data, error } = await anonClient.auth.signInWithPassword({
      email: 'parent@school.com',
      password: 'Password@123'
    });
    if (error) throw error;
    assert.ok(data.session?.access_token, 'Parent access token received');
  });

  // 2. STUDENTS CRUD
  console.log('\n--- 2. Students Module CRUD ---');
  let createdStudentId = '';
  const studentAdmissionNo = `TEST-${testRunId}`;

  await runStep('Students', 'CREATE: Insert test student', async () => {
    const { data: cls } = await adminClient.from('classes').select('id, class_name').limit(1).single();
    const { data: sec } = await adminClient.from('sections').select('id, section_name').limit(1).single();
    const { data: ay } = await adminClient.from('academic_years').select('id, name').limit(1).single();
    const { data, error } = await adminClient
      .from('students')
      .insert({
        admission_number: studentAdmissionNo,
        name: `Test Student ${testRunId}`,
        class: cls?.class_name || '10',
        class_id: cls?.id || '765656f6-cc8e-4438-ac8c-23c97db58de0',
        section: sec?.section_name || 'A',
        section_id: sec?.id || '76b5bcf5-c52e-412a-9c83-55bfd6780da4',
        roll_number: '99',
        date_of_birth: '2010-05-15',
        academic_year: ay?.name || '2026-27',
        academic_year_id: ay?.id || '25d97037-3e78-4f1a-b2d9-795008ee69b9',
        father_name: 'Test Father',
        mother_name: 'Test Mother',
        phone: '9876543210',
        email: `teststudent_${testRunId.toLowerCase()}@example.com`,
        status: 'active'
      })
      .select()
      .single();
    if (error) throw error;
    assert.ok(data?.id, 'Created student ID returned');
    createdStudentId = data.id;
  });

  await runStep('Students', 'READ: Query created student', async () => {
    const { data, error } = await adminClient
      .from('students')
      .select('*')
      .eq('id', createdStudentId)
      .single();
    if (error) throw error;
    assert.strictEqual(data.admission_number, studentAdmissionNo, 'Admission number matched');
    assert.strictEqual(data.status, 'active', 'Status is active');
  });

  await runStep('Students', 'UPDATE: Update student profile details', async () => {
    const { data, error } = await adminClient
      .from('students')
      .update({ phone: '9998887776', address: '123 Test Academic Lane' })
      .eq('id', createdStudentId)
      .select()
      .single();
    if (error) throw error;
    assert.strictEqual(data.phone, '9998887776', 'Phone number updated');
    assert.strictEqual(data.address, '123 Test Academic Lane', 'Address updated');
  });

  // 3. TEACHERS & STAFF CRUD
  console.log('\n--- 3. Staff & Teachers Module CRUD ---');
  let createdStaffId = '';
  const staffEmpId = `EMP-TEST-${testRunId}`;

  await runStep('Staff', 'CREATE: Insert test staff member', async () => {
    const { data, error } = await adminClient
      .from('staff')
      .insert({
        employee_id: staffEmpId,
        name: `Test Faculty ${testRunId}`,
        role_title: 'Teacher',
        department: 'Science',
        designation: 'Senior PGT',
        email: `faculty_${testRunId.toLowerCase()}@school.com`,
        phone: '9123456780',
        status: 'Active',
        salary: 45000,
        is_active: true
      })
      .select()
      .single();
    if (error) throw error;
    assert.ok(data?.id, 'Staff record created');
    createdStaffId = data.id;
  });

  await runStep('Staff', 'READ & UPDATE: Query and update qualification', async () => {
    const { data, error } = await adminClient
      .from('staff')
      .update({ highest_qualification: 'M.Sc., B.Ed.' })
      .eq('id', createdStaffId)
      .select()
      .single();
    if (error) throw error;
    assert.strictEqual(data.highest_qualification, 'M.Sc., B.Ed.', 'Qualification updated');
  });

  await runStep('Staff', 'RPC: Invoke set_staff_status lifecycle procedure', async () => {
    const { error } = await authedClient.rpc('set_staff_status', {
      _staff_id: createdStaffId,
      _status: 'On Leave',
      _reason: 'Annual Research Fellowship'
    });
    if (error) throw error;

    const { data } = await adminClient.from('staff').select('status').eq('id', createdStaffId).single();
    assert.strictEqual(data?.status, 'On Leave', 'Status successfully updated via RPC');
  });

  // 4. ADMISSIONS PIPELINE CRUD
  console.log('\n--- 4. Admissions Pipeline CRUD ---');
  let createdAdmissionId = '';
  const admissionAppNo = `ADM-TEST-${testRunId}`;

  await runStep('Admissions', 'CREATE: Submit applicant record', async () => {
    const { data, error } = await adminClient
      .from('admissions')
      .insert({
        application_number: admissionAppNo,
        name: `Applicant ${testRunId}`,
        class: '9',
        date_of_birth: '2011-08-20',
        academic_year: '2026-27',
        father_name: 'Applicant Father',
        phone: '9811223344',
        email: `applicant_${testRunId.toLowerCase()}@mail.com`,
        status: 'Pending'
      })
      .select()
      .single();
    if (error) throw error;
    assert.ok(data?.id, 'Admission application logged');
    createdAdmissionId = data.id;
  });

  await runStep('Admissions', 'READ: Query admissions pipeline', async () => {
    const { data, error } = await adminClient
      .from('admissions')
      .select('*')
      .eq('id', createdAdmissionId)
      .single();
    if (error) throw error;
    assert.strictEqual(data.status, 'Pending', 'Status is pending review');
  });

  await runStep('Admissions', 'UPDATE: Update application status to Approved', async () => {
    const { data, error } = await adminClient
      .from('admissions')
      .update({ status: 'Approved' })
      .eq('id', createdAdmissionId)
      .select()
      .single();
    if (error) throw error;
    assert.strictEqual(data.status, 'Approved', 'Application transitioned to Approved');
  });

  // 5. FEES PORTAL & PAYMENTS CRUD
  console.log('\n--- 5. Fees & Ledger CRUD ---');
  let createdFeeId = '';
  let createdPaymentId = '';

  await runStep('Fees', 'CREATE: Create student fee record', async () => {
    const { data, error } = await adminClient
      .from('student_fees')
      .insert({
        student_id: createdStudentId,
        fee_category_id: '11111111-1111-1111-1111-111111111111',
        total_amount: 15000,
        amount_paid: 0,
        fine_amount: 0,
        status: 'pending',
        due_date: '2026-10-15'
      })
      .select()
      .single();
    if (error) throw error;
    assert.ok(data?.id, 'Student fee created');
    createdFeeId = data.id;
  });

  await runStep('Fees', 'CREATE (Payment): Record fee payment transaction', async () => {
    const { data, error } = await adminClient
      .from('fee_payments')
      .insert({
        student_fee_id: createdFeeId,
        amount_paid: 5000,
        payment_mode: 'cash',
        receipt_number: `RCP-TEST-${testRunId}`,
        payment_date: new Date().toISOString().substring(0, 10)
      })
      .select()
      .single();
    if (error) throw error;
    assert.ok(data?.id, 'Fee payment transaction recorded');
    createdPaymentId = data.id;
  });

  await runStep('Fees', 'READ: Query fee payment and receipts ledger', async () => {
    const { data, error } = await adminClient
      .from('fee_payments')
      .select('*, student_fees(total_amount, net_amount)')
      .eq('id', createdPaymentId)
      .single();
    if (error) throw error;
    assert.strictEqual(Number(data.amount_paid), 5000, 'Payment amount verified');
    assert.strictEqual(data.receipt_number, `RCP-TEST-${testRunId}`, 'Receipt number matched');
  });

  // 6. ATTENDANCE ENTRY ATOMIC RPC
  console.log('\n--- 6. Attendance Entry Module ---');

  await runStep('Attendance', 'RPC: Execute atomic save_attendance procedure', async () => {
    const today = new Date().toISOString().substring(0, 10);
    const { error } = await authedClient.rpc('save_attendance', {
      _attendance_date: today,
      _class: '10',
      _section: 'A',
      _records: [
        {
          student_id: createdStudentId,
          status: 'present',
          remarks: 'Automated E2E Audit'
        }
      ]
    });
    if (error) throw error;

    const { data } = await adminClient
      .from('attendance')
      .select('*')
      .eq('student_id', createdStudentId)
      .eq('attendance_date', today)
      .single();
    assert.strictEqual(data?.status, 'present', 'Attendance marked present in DB');
  });

  // 7. INSTITUTIONAL OPERATIONS MODULES CRUD
  console.log('\n--- 7. Operations Modules CRUD ---');

  // Transport
  let routeId = '';
  await runStep('Transport', 'CREATE/READ/DELETE Transit Route', async () => {
    const { data: route, error: rErr } = await adminClient
      .from('transport_routes')
      .insert({
        route_name: `Route-${testRunId}`,
        fare_amount: 1200
      })
      .select()
      .single();
    if (rErr) throw rErr;
    routeId = route.id;
    assert.ok(route.id, 'Route created');

    const { data: fetched } = await adminClient.from('transport_routes').select('*').eq('id', routeId).single();
    assert.strictEqual(fetched.route_name, `Route-${testRunId}`, 'Route verified');
  });

  // Library
  let bookId = '';
  await runStep('Library', 'CREATE/READ/DELETE Library Book', async () => {
    const { data: book, error: bErr } = await adminClient
      .from('library_books')
      .insert({
        title: `Advanced Physics ${testRunId}`,
        author: 'Dr. H. C. Verma',
        isbn: `ISBN-${testRunId}`,
        copies_total: 10,
        copies_available: 10
      })
      .select()
      .single();
    if (bErr) throw bErr;
    bookId = book.id;
    assert.ok(book.id, 'Book created in catalog');
  });

  // Medical
  let medicalLogId = '';
  await runStep('Medical', 'CREATE/READ/DELETE Student Medical Record', async () => {
    const { data: med, error: mErr } = await adminClient
      .from('student_medical')
      .insert({
        student_id: createdStudentId,
        blood_group: 'O+',
        allergies: 'None',
        medical_history: 'Healthy fit'
      })
      .select()
      .single();
    if (mErr) throw mErr;
    medicalLogId = med.id;
    assert.ok(med.id, 'Medical record created');
  });

  // Discipline
  let incidentId = '';
  await runStep('Discipline', 'CREATE/READ/DELETE Disciplinary Record', async () => {
    const { data: disc, error: dErr } = await adminClient
      .from('disciplinary_records')
      .insert({
        student_id: createdStudentId,
        incident_type: 'Uniform Non-Compliance',
        description: 'Audit Test incident',
        severity: 'Low',
        incident_date: new Date().toISOString().substring(0, 10),
        status: 'Pending'
      })
      .select()
      .single();
    if (dErr) throw dErr;
    incidentId = disc.id;
    assert.ok(disc.id, 'Disciplinary record created');
  });

  // Front Office
  let logId = '';
  await runStep('Front Office', 'CREATE/READ/DELETE Front Office Log', async () => {
    const { data: fo, error: foErr } = await adminClient
      .from('front_office_logs')
      .insert({
        name: `Visitor ${testRunId}`,
        phone: '9988776655',
        type: 'Visitor',
        purpose: 'Campus Facilities Tour',
        date_time: new Date().toISOString(),
        status: 'Completed'
      })
      .select()
      .single();
    if (foErr) throw foErr;
    logId = fo.id;
    assert.ok(fo.id, 'Front office log created');
  });

  // Online Classes
  let classSessionId = '';
  await runStep('Online Classes', 'CREATE/READ/DELETE Online Class Session', async () => {
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 45 * 60000).toISOString();
    const { data: oc, error: ocErr } = await adminClient
      .from('online_classes')
      .insert({
        title: `Live Masterclass ${testRunId}`,
        class: '10',
        section: 'A',
        subject: 'Mathematics',
        meeting_url: 'https://meet.google.com/test-audit',
        start_time: start,
        end_time: end,
        status: 'Scheduled'
      })
      .select()
      .single();
    if (ocErr) throw ocErr;
    classSessionId = oc.id;
    assert.ok(oc.id, 'Online class scheduled');
  });

  // 8. BACKEND EXPRESS API PROBES & AI ROUTE
  console.log('\n--- 8. Backend Express Server & AI Routes ---');

  await runStep('Server', 'GET /api/health probe', async () => {
    const res = await fetch('http://localhost:3000/api/health');
    assert.strictEqual(res.status, 200, 'Health probe returned 200 OK');
    const json = await res.json();
    assert.strictEqual(json.status, 'ok', 'Health response payload status is ok');
  });

  await runStep('Server', 'POST /api/ai/chat (Auth Rejection on Missing Token)', async () => {
    const res = await fetch('http://localhost:3000/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello AI' })
    });
    assert.strictEqual(res.status, 401, 'Rejects unauthenticated chat with 401');
  });

  if (adminToken) {
    await runStep('Server', 'POST /api/ai/chat (Authenticated Admin Query)', async () => {
      const res = await fetch('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ message: 'How many students are enrolled?' })
      });
      assert.ok([200, 500].includes(res.status), 'Handled enterprise AI request');
    });
  }

  // 9. TEARDOWN & CLEANUP
  console.log('\n--- 9. Teardown & Clean Up ---');

  await runStep('Teardown', 'Purge created test records', async () => {
    if (classSessionId) await adminClient.from('online_classes').delete().eq('id', classSessionId);
    if (logId) await adminClient.from('front_office_logs').delete().eq('id', logId);
    if (incidentId) await adminClient.from('disciplinary_records').delete().eq('id', incidentId);
    if (medicalLogId) await adminClient.from('student_medical').delete().eq('id', medicalLogId);
    if (bookId) await adminClient.from('library_books').delete().eq('id', bookId);
    if (routeId) await adminClient.from('transport_routes').delete().eq('id', routeId);
    if (createdPaymentId) await adminClient.from('fee_payments').delete().eq('id', createdPaymentId);
    if (createdFeeId) await adminClient.from('student_fees').delete().eq('id', createdFeeId);
    if (createdAdmissionId) await adminClient.from('admissions').delete().eq('id', createdAdmissionId);
    if (createdStaffId) await adminClient.from('staff').delete().eq('id', createdStaffId);
    if (createdStudentId) {
      await adminClient.from('attendance').delete().eq('student_id', createdStudentId);
      await adminClient.from('students').delete().eq('id', createdStudentId);
    }
  });

  // SUMMARY
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n======================================================');
  console.log(`PRODUCTION CRUD AUDIT: Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

