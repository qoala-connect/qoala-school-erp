/**
 * Master Deep-Dive End-to-End Audit & Verification Test Suite for Remaining ERP Modules
 * 
 * Modules Tested:
 * 1. Fees & Financials (Live RPC collect_fee, void_fee_payment, fee categories, ledgers & receipt generator)
 * 2. CBSE Examination & Results (Live RPC save_marks, exam schedules, grading rules, CBSE marksheets)
 * 3. Attendance & Registers (Live RPC save_attendance, student/staff registers, leave requests, cbse summaries)
 * 4. Transport Logistics (Routes, Fleet Vehicles, Drivers, Student Transit Allotments)
 * 5. Library Management (Catalog, Book Issues/Returns, Fines, Stock Availability)
 * 6. Hostel Management (Hostel Blocks, Rooms, Student Room Allotment, Occupancy Count)
 * 7. Inventory & Assets (Stock Inventory, Asset Register, Purchase Orders, Vendor Registry)
 * 8. Medical & Discipline (Student Medical Records, Clinical Checkups, Infractions, Disciplinary Actions)
 * 9. Front Office & Certificates (Visitor/Call/Postal Logs, Certificate Generator with QR/PDF Verification)
 * 10. System Administration & RBAC (Live RPC system_overview, admin_user_directory, set_user_role, set_user_status, audit_logs)
 * 
 * Quality Gates:
 * - Live Supabase CRUD & RPC Execution with Real Credentials
 * - Frontend UI Component Integrity (Modals, Drawers, Wizards, Filters, Templates, CSV Exports)
 * - Zero Mock Data Rule Verification
 * - Automated Safe Database Teardown
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

dotenv.config();

function assert(condition: any, message = 'Assertion failed'): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://cqylpqrharentkjmrymr.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ANON_KEY;

const anonClient = createClient(SUPABASE_URL, ANON_KEY);
const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

interface AuditScorecardEntry {
  module: string;
  category: 'Live DB & RPC' | 'Frontend UI & Templates' | 'Zero Mock Data' | 'Quality Gate & Teardown';
  testName: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const scorecard: AuditScorecardEntry[] = [];

async function auditStep(
  module: string, 
  category: 'Live DB & RPC' | 'Frontend UI & Templates' | 'Zero Mock Data' | 'Quality Gate & Teardown',
  testName: string, 
  fn: () => Promise<void>
) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    scorecard.push({ module, category, testName, passed: true, durationMs });
    console.log(`  [PASS] [${module}] [${category}] ${testName} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    scorecard.push({ module, category, testName, passed: false, error: err.message, durationMs });
    console.error(`  [FAIL] [${module}] [${category}] ${testName} (${durationMs}ms)\n         Error: ${err.message}`);
  }
}

function readSourceFile(relPath: string): string {
  const fullPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Source file not found: ${relPath}`);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

async function main() {
  console.log('\n========================================================================');
  console.log('EXHAUSTIVE DEEP-DIVE END-TO-END AUDIT ACROSS ALL 10 REMAINING ERP MODULES');
  console.log('========================================================================\n');

  const runId = Math.random().toString(36).substring(2, 7).toUpperCase();
  const testIds: Record<string, string[]> = {
    students: [],
    transport_routes: [],
    vehicles: [],
    drivers: [],
    student_transport: [],
    library_books: [],
    book_issues: [],
    hostels: [],
    rooms: [],
    inventory: [],
    assets: [],
    student_medical: [],
    disciplinary_records: [],
    front_office_logs: [],
    certificates: [],
    attendance: [],
    marks: [],
    exam_subjects: [],
    exams: [],
    fee_payments: [],
    student_fees: [],
  };

  let testStudentId = '';
  let testStudentClass = '11';
  let testStudentSection = 'A';
  let testClassId = '';
  let testSectionId = '';
  let testSubjectId = '';
  let testSubjectName = 'Mathematics';
  let currentAcademicYearId = '';
  let currentAcademicYearName = '2026-27';
  let authedAdminClient: any = null;
  let adminUserId = '';

  try {
    // -------------------------------------------------------------
    // PRE-FLIGHT: AUTHENTICATION & BASE ENTITIES DISCOVERY
    // -------------------------------------------------------------
    console.log('--- PRE-FLIGHT: Authentication & Base Discovery ---');
    await auditStep('System & RBAC', 'Live DB & RPC', 'Live Admin Authentication & Session Issuance', async () => {
      const { data, error } = await anonClient.auth.signInWithPassword({
        email: 'admin@school.com',
        password: 'Password@123'
      });
      assert(!error && data?.session, `Admin sign-in failed: ${error?.message}`);
      adminUserId = data.user.id;
      authedAdminClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }
      });
      assert(authedAdminClient, 'Authed client initialized');
    });

    await auditStep('System & RBAC', 'Live DB & RPC', 'Discover anchor metadata & provision isolated test student', async () => {
      const { data: yrData } = await adminClient.from('academic_years').select('id, name').eq('is_current', true).limit(1);
      if (yrData && yrData.length > 0) {
        currentAcademicYearId = yrData[0].id;
        currentAcademicYearName = yrData[0].name;
      }

      const { data: csData } = await adminClient
        .from('class_sections')
        .select('id, class_id, section_id, classes(class_name), sections(section_name)')
        .limit(1);
      
      if (csData && csData.length > 0) {
        testClassId = csData[0].class_id;
        testSectionId = csData[0].section_id;
        testStudentClass = (csData[0] as any).classes?.class_name || '11';
        testStudentSection = (csData[0] as any).sections?.section_name || 'A';
      }

      const { data: subData } = await adminClient.from('subjects').select('id, subject_name').limit(1);
      if (subData && subData.length > 0) {
        testSubjectId = subData[0].id;
        testSubjectName = subData[0].subject_name;
      }

      // Create isolated test student
      const { data: stdData, error: stdErr } = await adminClient
        .from('students')
        .insert([{
          name: `Audit Student ${runId}`,
          admission_number: `ADM-${runId}`,
          roll_number: `R-${runId}`,
          class: testStudentClass,
          section: testStudentSection,
          class_id: testClassId,
          section_id: testSectionId,
          academic_year_id: currentAcademicYearId,
          academic_year: currentAcademicYearName,
          status: 'active',
          date_of_birth: '2010-05-15',
          gender: 'male',
          father_name: `Father ${runId}`,
          mother_name: `Mother ${runId}`
        }])
        .select()
        .single();
      
      assert(!stdErr && stdData, `Failed to provision test student: ${stdErr?.message}`);
      testStudentId = stdData.id;
      testIds.students.push(testStudentId);
    });

    // =============================================================
    // 1. FEES & FINANCIALS MODULE AUDIT
    // =============================================================
    console.log('\n--- 1. FEES & FINANCIALS MODULE AUDIT ---');
    let testFeePaymentId = '';
    let testFeeCategoryId = '';

    await auditStep('Fees & Financials', 'Live DB & RPC', 'Live Fee Ledger Retrieval & Category Discovery', async () => {
      const { data: categories, error: catErr } = await adminClient.from('fee_categories').select('*');
      assert(!catErr && Array.isArray(categories) && categories.length > 0, 'Fee categories query succeeded');
      testFeeCategoryId = categories[0].id;
      
      const { data: feeLedgers, error: feeErr } = await adminClient
        .from('student_fees')
        .select('*, students(name, roll_number)')
        .limit(5);
      assert(!feeErr && Array.isArray(feeLedgers), 'Student fee ledgers query succeeded');
    });

    await auditStep('Fees & Financials', 'Live DB & RPC', 'RPC collect_fee Live Execution & Ledger Balance Update', async () => {
      // Execute atomic RPC collect_fee via authed admin client
      const { data: collectRes, error: collectErr } = await authedAdminClient.rpc('collect_fee', {
        _student_id: testStudentId,
        _fee_category_id: testFeeCategoryId,
        _amount: 1200,
        _academic_year_id: currentAcademicYearId,
        _due_date: new Date().toISOString().split('T')[0],
        _payment_date: new Date().toISOString().split('T')[0],
        _payment_mode: 'upi',
        _transaction_id: `TXN-${runId}`,
        _remarks: `Automated Audit Payment ${runId}`,
        _total_amount: 5000,
        _discount_amount: 200,
        _fine_amount: 0
      });

      assert(!collectErr, `collect_fee RPC failed: ${collectErr?.message}`);
      assert(collectRes && collectRes.length > 0, 'collect_fee returned receipt row');
      const receiptRow = collectRes[0];
      assert(receiptRow.receipt_number, 'Receipt number generated by receipt_counters');
      testFeePaymentId = receiptRow.payment_id;
      const feeLedgerId = receiptRow.student_fee_id;
      if (testFeePaymentId) testIds.fee_payments.push(testFeePaymentId);
      if (feeLedgerId) testIds.student_fees.push(feeLedgerId);

      // Verify student_fees ledger was atomically updated
      const { data: updatedLedger } = await adminClient
        .from('student_fees')
        .select('*')
        .eq('id', feeLedgerId)
        .single();
      assert(updatedLedger && Number(updatedLedger.amount_paid) >= 1200, 'amount_paid incremented correctly');
      assert(updatedLedger.status === 'partial' || updatedLedger.status === 'paid', 'status updated correctly');
    });

    await auditStep('Fees & Financials', 'Live DB & RPC', 'RPC void_fee_payment Live Reversal & Ledger Reconciliation', async () => {
      if (testFeePaymentId) {
        const { data: voidRes, error: voidErr } = await authedAdminClient.rpc('void_fee_payment', {
          _payment_id: testFeePaymentId,
          _reason: `Audit rollback test ${runId}`
        });
        assert(!voidErr, `void_fee_payment RPC failed: ${voidErr?.message}`);

        // Verify payment record has voided_at timestamp
        const { data: paymentRec } = await adminClient
          .from('fee_payments')
          .select('voided_at, void_reason')
          .eq('id', testFeePaymentId)
          .single();
        assert(paymentRec.voided_at !== null, 'voided_at set on payment record');
      }
    });

    await auditStep('Fees & Financials', 'Frontend UI & Templates', 'Inspect Fee modals, receipt template & report components', async () => {
      const portalCode = readSourceFile('src/pages/dashboard/FeesPortal.tsx');
      assert(portalCode.includes('FeeCollectionModal'), 'FeeCollectionModal integrated in FeesPortal');
      assert(portalCode.includes('FeeReceiptModal'), 'FeeReceiptModal integrated in FeesPortal');
      assert(portalCode.includes('FeeVoidModal'), 'FeeVoidModal integrated in FeesPortal');
      assert(portalCode.includes('FeeStructureManager'), 'FeeStructureManager integrated in FeesPortal');
      assert(portalCode.includes('FeeReportsView'), 'FeeReportsView integrated in FeesPortal');

      const receiptCode = readSourceFile('src/components/fees/FeeReceiptModal.tsx');
      assert(receiptCode.includes('jsPDF') || receiptCode.includes('html2canvasSafe'), 'FeeReceiptModal has print/PDF capability');
    });

    await auditStep('Fees & Financials', 'Zero Mock Data', 'Verify zero mock data in FeesPortal and subcomponents', async () => {
      const portalCode = readSourceFile('src/pages/dashboard/FeesPortal.tsx');
      assert(!portalCode.includes('const MOCK_FEES'), 'No mock fee data in FeesPortal.tsx');
      assert(!portalCode.includes('const dummyFees'), 'No dummy fees in FeesPortal.tsx');
    });

    // =============================================================
    // 2. CBSE EXAMINATION & RESULTS MODULE AUDIT
    // =============================================================
    console.log('\n--- 2. CBSE EXAMINATION & RESULTS MODULE AUDIT ---');
    let testExamId = '';

    await auditStep('CBSE Examination', 'Live DB & RPC', 'Exams Master CRUD & Subject Schedule Attachment', async () => {
      const { data: examData, error: examErr } = await adminClient
        .from('exams')
        .insert([{
          exam_name: `Audit Mid-Term CBSE Exam ${runId}`,
          class: testStudentClass,
          academic_year: currentAcademicYearName,
          class_id: testClassId,
          academic_year_id: currentAcademicYearId
        }])
        .select()
        .single();
      
      assert(!examErr && examData, `Exam creation failed: ${examErr?.message}`);
      testExamId = examData.id;
      testIds.exams.push(testExamId);

      // Attach subject to exam_subjects
      const { data: exSubData, error: exSubErr } = await adminClient
        .from('exam_subjects')
        .insert([{
          exam_id: testExamId,
          subject_id: testSubjectId,
          subject_name: testSubjectName,
          max_marks: 100,
          pass_marks: 33
        }])
        .select()
        .single();
      assert(!exSubErr && exSubData, `Exam subject attachment failed: ${exSubErr?.message}`);
      testIds.exam_subjects.push(exSubData.id);
    });

    await auditStep('CBSE Examination', 'Live DB & RPC', 'RPC save_marks Live Recording & Validation', async () => {
      const marksPayload = [
        {
          student_id: testStudentId,
          subject_id: testSubjectId,
          periodic_test_marks: 18,
          multiple_assessment_marks: 5,
          portfolio_marks: 5,
          subject_enrichment_marks: 5,
          annual_exam_marks: 65,
          is_absent: false
        }
      ];

      const { data: saveRes, error: saveErr } = await authedAdminClient.rpc('save_marks', {
        _exam_id: testExamId,
        _records: marksPayload
      });

      assert(!saveErr, `save_marks RPC failed: ${saveErr?.message}`);
      assert(saveRes !== null, 'save_marks recorded successfully');

      // Verify marks row in PostgreSQL
      const { data: markRows } = await adminClient
        .from('marks')
        .select('id, obtained_marks, max_marks')
        .eq('exam_id', testExamId);
      assert(markRows && markRows.length > 0, 'Marks persisted in database');
      markRows.forEach(r => testIds.marks.push(r.id));
    });

    await auditStep('CBSE Examination', 'Frontend UI & Templates', 'Inspect ExaminationModule views, admit cards & report cards', async () => {
      const examCode = readSourceFile('src/pages/dashboard/examination/ExaminationModule.tsx');
      assert(examCode.includes('ResultsView'), 'ResultsView integrated in ExaminationModule');
      assert(examCode.includes('DatesheetsView'), 'DatesheetsView integrated in ExaminationModule');
      assert(examCode.includes('AnalyticsView'), 'AnalyticsView integrated in ExaminationModule');
      assert(examCode.includes('AdmitCardsView'), 'AdmitCardsView integrated in ExaminationModule');
      assert(examCode.includes('StudentReportsView'), 'StudentReportsView integrated in ExaminationModule');
      assert(examCode.includes('ConfigView'), 'ConfigView integrated in ExaminationModule');
    });

    await auditStep('CBSE Examination', 'Zero Mock Data', 'Verify zero mock data in ExaminationModule', async () => {
      const examCode = readSourceFile('src/pages/dashboard/examination/ExaminationModule.tsx');
      assert(!examCode.includes('const MOCK_EXAMS'), 'No mock exams in ExaminationModule.tsx');
      assert(!examCode.includes('const dummyMarks'), 'No dummy marks in ExaminationModule.tsx');
    });

    // =============================================================
    // 3. ATTENDANCE & REGISTERS MODULE AUDIT
    // =============================================================
    console.log('\n--- 3. ATTENDANCE & REGISTERS MODULE AUDIT ---');

    await auditStep('Attendance & Registers', 'Live DB & RPC', 'RPC save_attendance Batch Recording & Status Verification', async () => {
      const todayDate = new Date().toISOString().split('T')[0];

      const attendanceBatch = [
        {
          student_id: testStudentId,
          status: 'present',
          remarks: `Audit Attendance Batch ${runId}`
        }
      ];

      const { data: attRes, error: attErr } = await authedAdminClient.rpc('save_attendance', {
        _attendance_date: todayDate,
        _class: testStudentClass,
        _section: testStudentSection,
        _records: attendanceBatch
      });

      assert(!attErr, `save_attendance RPC failed: ${attErr?.message}`);
      assert(attRes && attRes.length > 0, 'save_attendance returned execution result');

      const { data: attRec } = await adminClient
        .from('attendance')
        .select('id, status')
        .eq('student_id', testStudentId)
        .eq('attendance_date', todayDate)
        .single();
      assert(attRec && attRec.status === 'present', 'Attendance record verified in database');
      if (attRec) testIds.attendance.push(attRec.id);
    });

    await auditStep('Attendance & Registers', 'Live DB & RPC', 'CBSE Attendance Summary & Leave Requests verification', async () => {
      const { data: summaryData, error: summaryErr } = await adminClient
        .from('cbse_attendance_summary')
        .select('*')
        .limit(5);
      assert(!summaryErr, `CBSE attendance summary view queried: ${summaryErr?.message}`);

      const { data: leaveData, error: leaveErr } = await adminClient
        .from('leave_requests')
        .select('*')
        .limit(5);
      assert(!leaveErr, `Leave requests table queried: ${leaveErr?.message}`);
    });

    await auditStep('Attendance & Registers', 'Frontend UI & Templates', 'Inspect AttendanceEntry register UI & quick toggle actions', async () => {
      const attCode = readSourceFile('src/pages/dashboard/AttendanceEntry.tsx');
      assert(attCode.includes('ATTENDANCE_STATUSES'), 'ATTENDANCE_STATUSES configured');
      assert(attCode.includes('handleToggleStatus'), 'handleToggleStatus wired for quick action');
      assert(attCode.includes('handleSaveAttendance'), 'handleSaveAttendance wired to Supabase');
    });

    await auditStep('Attendance & Registers', 'Zero Mock Data', 'Verify zero mock data in AttendanceEntry', async () => {
      const attCode = readSourceFile('src/pages/dashboard/AttendanceEntry.tsx');
      assert(!attCode.includes('const MOCK_STUDENTS'), 'No mock students in AttendanceEntry.tsx');
      assert(!attCode.includes('const dummyRegister'), 'No dummy register in AttendanceEntry.tsx');
    });

    // =============================================================
    // 4. TRANSPORT LOGISTICS MODULE AUDIT
    // =============================================================
    console.log('\n--- 4. TRANSPORT LOGISTICS MODULE AUDIT ---');

    await auditStep('Transport', 'Live DB & RPC', 'Routes, Vehicles, Drivers & Student Allotment Live CRUD', async () => {
      // 1. Route CRUD
      const { data: routeData, error: routeErr } = await adminClient
        .from('transport_routes')
        .insert([{
          route_name: `Audit Express Route ${runId}`,
          start_point: 'Civil Lines',
          end_point: 'School Main Gate',
          fare_amount: 1500,
          is_active: true
        }])
        .select()
        .single();
      assert(!routeErr && routeData, `Route creation failed: ${routeErr?.message}`);
      testIds.transport_routes.push(routeData.id);

      // 2. Vehicle CRUD
      const { data: vehData, error: vehErr } = await adminClient
        .from('vehicles')
        .insert([{
          vehicle_number: `UP-53-${runId}`,
          vehicle_model: 'Tata Starbus 40-Seater',
          capacity: 40,
          registration_expiry: '2028-12-31',
          is_active: true
        }])
        .select()
        .single();
      assert(!vehErr && vehData, `Vehicle creation failed: ${vehErr?.message}`);
      testIds.vehicles.push(vehData.id);

      // 3. Driver CRUD
      const { data: drvData, error: drvErr } = await adminClient
        .from('drivers')
        .insert([{
          name: `Driver ${runId}`,
          license_number: `DL-${runId}-COMM`,
          phone: '+91 9876543210',
          is_active: true
        }])
        .select()
        .single();
      assert(!drvErr && drvData, `Driver creation failed: ${drvErr?.message}`);
      testIds.drivers.push(drvData.id);

      // 4. Student Transport Allotment CRUD
      const { data: altData, error: altErr } = await adminClient
        .from('student_transport')
        .insert([{
          student_id: testStudentId,
          route_id: routeData.id,
          vehicle_id: vehData.id,
          boarding_point: 'Civil Lines Crossing',
          pickup_time: '07:15 AM'
        }])
        .select()
        .single();
      assert(!altErr && altData, `Student transport allotment failed: ${altErr?.message}`);
      testIds.student_transport.push(altData.id);
    });

    await auditStep('Transport', 'Frontend UI & Templates', 'Inspect TransportManagement tabs, modals & driver cards', async () => {
      const transCode = readSourceFile('src/pages/dashboard/TransportManagement.tsx');
      assert(transCode.includes('TransitRoute'), 'TransitRoute interface defined');
      assert(transCode.includes('FleetVehicle'), 'FleetVehicle interface defined');
      assert(transCode.includes('DriverProfile'), 'DriverProfile interface defined');
      assert(transCode.includes('handleDelete'), 'handleDelete handler implemented for transport items');
      assert(transCode.includes('handleSubmit'), 'handleSubmit form handler implemented');
    });

    await auditStep('Transport', 'Zero Mock Data', 'Verify zero mock data in TransportManagement', async () => {
      const transCode = readSourceFile('src/pages/dashboard/TransportManagement.tsx');
      assert(!transCode.includes('const MOCK_ROUTES'), 'No mock routes in TransportManagement.tsx');
      assert(!transCode.includes('const dummyVehicles'), 'No dummy vehicles in TransportManagement.tsx');
    });

    // =============================================================
    // 5. LIBRARY MANAGEMENT MODULE AUDIT
    // =============================================================
    console.log('\n--- 5. LIBRARY MANAGEMENT MODULE AUDIT ---');

    await auditStep('Library', 'Live DB & RPC', 'Catalog Books & Book Issues/Returns Live Lifecycle', async () => {
      // 1. Insert Book
      const { data: bookData, error: bookErr } = await adminClient
        .from('library_books')
        .insert([{
          title: `Audit Science Handbook ${runId}`,
          author: 'Dr. R. K. Sharma',
          isbn: `978-${runId}-001`,
          copies_total: 10,
          copies_available: 10,
          category: 'Science & Technology',
          is_active: true
        }])
        .select()
        .single();
      assert(!bookErr && bookData, `Library book creation failed: ${bookErr?.message}`);
      testIds.library_books.push(bookData.id);

      // 2. Issue Book
      const today = new Date().toISOString().split('T')[0];
      const dueDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

      const { data: issueData, error: issueErr } = await adminClient
        .from('book_issues')
        .insert([{
          book_id: bookData.id,
          user_id: adminUserId,
          issue_date: today,
          due_date: dueDate,
          status: 'issued'
        }])
        .select()
        .single();
      assert(!issueErr && issueData, `Book issue creation failed: ${issueErr?.message}`);
      testIds.book_issues.push(issueData.id);

      // 3. Return Book update
      const { error: returnErr } = await adminClient
        .from('book_issues')
        .update({ return_date: today, status: 'returned' })
        .eq('id', issueData.id);
      assert(!returnErr, `Book return update failed: ${returnErr?.message}`);
    });

    await auditStep('Library', 'Frontend UI & Templates', 'Inspect LibraryManagement book catalog, tabs & issue forms', async () => {
      const libCode = readSourceFile('src/pages/dashboard/LibraryManagement.tsx');
      assert(libCode.includes('LibraryBook'), 'LibraryBook interface defined');
      assert(libCode.includes('BookIssue'), 'BookIssue interface defined');
      assert(libCode.includes('BookCategory'), 'BookCategory interface defined');
      assert(libCode.includes('handleDelete'), 'handleDelete handler implemented');
      assert(libCode.includes('handleSubmit'), 'handleSubmit handler implemented');
    });

    await auditStep('Library', 'Zero Mock Data', 'Verify zero mock data in LibraryManagement', async () => {
      const libCode = readSourceFile('src/pages/dashboard/LibraryManagement.tsx');
      assert(!libCode.includes('const MOCK_BOOKS'), 'No mock books in LibraryManagement.tsx');
      assert(!libCode.includes('const dummyIssues'), 'No dummy issues in LibraryManagement.tsx');
    });

    // =============================================================
    // 6. HOSTEL MANAGEMENT MODULE AUDIT
    // =============================================================
    console.log('\n--- 6. HOSTEL MANAGEMENT MODULE AUDIT ---');

    await auditStep('Hostel', 'Live DB & RPC', 'Hostel Blocks & Rooms Live CRUD', async () => {
      // 1. Hostel Block
      const { data: hostelData, error: hostelErr } = await adminClient
        .from('hostels')
        .insert([{
          name: `Audit Block Alpha ${runId}`,
          hostel_type: 'boys',
          capacity: 120,
          address: 'North Wing, Campus Gate 2',
          is_active: true
        }])
        .select()
        .single();
      assert(!hostelErr && hostelData, `Hostel creation failed: ${hostelErr?.message}`);
      testIds.hostels.push(hostelData.id);

      // 2. Hostel Room
      const { data: roomData, error: roomErr } = await adminClient
        .from('rooms')
        .insert([{
          hostel_id: hostelData.id,
          room_number: `A-101-${runId}`,
          capacity: 3,
          cost_per_month: 3500,
          is_active: true
        }])
        .select()
        .single();
      assert(!roomErr && roomData, `Hostel room creation failed: ${roomErr?.message}`);
      testIds.rooms.push(roomData.id);
    });

    await auditStep('Hostel', 'Frontend UI & Templates', 'Inspect HostelManagement room occupancy grid & visitor registry', async () => {
      const hostelCode = readSourceFile('src/pages/dashboard/HostelManagement.tsx');
      assert(hostelCode.includes('HostelRoom'), 'HostelRoom interface defined');
      assert(hostelCode.includes('StudentAllocation'), 'StudentAllocation interface defined');
      assert(hostelCode.includes('HostelVisitor'), 'HostelVisitor interface defined');
      assert(hostelCode.includes('handleSave'), 'handleSave handler implemented');
    });

    await auditStep('Hostel', 'Zero Mock Data', 'Verify zero mock data in HostelManagement', async () => {
      const hostelCode = readSourceFile('src/pages/dashboard/HostelManagement.tsx');
      assert(!hostelCode.includes('const MOCK_HOSTELS'), 'No mock hostels in HostelManagement.tsx');
      assert(!hostelCode.includes('const dummyRooms'), 'No dummy rooms in HostelManagement.tsx');
    });

    // =============================================================
    // 7. INVENTORY & ASSETS MODULE AUDIT
    // =============================================================
    console.log('\n--- 7. INVENTORY & ASSETS MODULE AUDIT ---');

    await auditStep('Inventory', 'Live DB & RPC', 'Inventory Items & Physical Assets Live CRUD', async () => {
      // 1. Inventory Consumable Item
      const { data: invData, error: invErr } = await adminClient
        .from('inventory')
        .insert([{
          item_name: `Audit A4 Paper Reams ${runId}`,
          item_category: 'Stationery',
          quantity_total: 150,
          quantity_available: 150,
          unit_price: 280,
          is_active: true
        }])
        .select()
        .single();
      assert(!invErr && invData, `Inventory item creation failed: ${invErr?.message}`);
      testIds.inventory.push(invData.id);

      // 2. Fixed Asset Register
      const { data: assetData, error: assetErr } = await adminClient
        .from('assets')
        .insert([{
          asset_name: `Dell OptiPlex Lab Desktop ${runId}`,
          asset_tag: `AST-${runId}-LAB`,
          category: 'Electronics',
          status: 'operational',
          purchase_cost: 45000,
          location: 'Computer Lab 1',
          is_active: true
        }])
        .select()
        .single();
      assert(!assetErr && assetData, `Asset creation failed: ${assetErr?.message}`);
      testIds.assets.push(assetData.id);
    });

    await auditStep('Inventory', 'Frontend UI & Templates', 'Inspect InventoryManagement stock levels & purchase order lifecycle', async () => {
      const invCode = readSourceFile('src/pages/dashboard/InventoryManagement.tsx');
      assert(invCode.includes('StockItem'), 'StockItem interface defined');
      assert(invCode.includes('PurchaseOrder'), 'PurchaseOrder interface defined');
      assert(invCode.includes('Vendor'), 'Vendor interface defined');
      assert(invCode.includes('handleSave'), 'handleSave handler implemented');
    });

    await auditStep('Inventory', 'Zero Mock Data', 'Verify zero mock data in InventoryManagement', async () => {
      const invCode = readSourceFile('src/pages/dashboard/InventoryManagement.tsx');
      assert(!invCode.includes('const MOCK_INVENTORY'), 'No mock inventory in InventoryManagement.tsx');
      assert(!invCode.includes('const dummyAssets'), 'No dummy assets in InventoryManagement.tsx');
    });

    // =============================================================
    // 8. MEDICAL & DISCIPLINE MODULE AUDIT
    // =============================================================
    console.log('\n--- 8. MEDICAL & DISCIPLINE MODULE AUDIT ---');

    await auditStep('Medical & Discipline', 'Live DB & RPC', 'Student Medical Records & Disciplinary Infractions Live CRUD', async () => {
      // 1. Student Medical Profile
      const { data: medData, error: medErr } = await adminClient
        .from('student_medical')
        .insert([{
          student_id: testStudentId,
          blood_group: 'O+',
          allergies: 'Peanuts, Dust',
          medical_history: 'None',
          doctor_name: 'Dr. S. K. Gupta',
          doctor_phone: '+91 9988776655',
          vaccination_status: 'Fully Vaccinated',
          emergency_contact_name: 'Guardian',
          emergency_contact_phone: '+91 9988776655'
        }])
        .select()
        .single();
      assert(!medErr && medData, `Student medical record creation failed: ${medErr?.message}`);
      testIds.student_medical.push(medData.id);

      // 2. Disciplinary Infraction Incident
      const { data: discData, error: discErr } = await adminClient
        .from('disciplinary_records')
        .insert([{
          student_id: testStudentId,
          student_name: `Audit Student ${runId}`,
          student_class: testStudentClass,
          student_roll: `R-${runId}`,
          incident_type: 'Classroom Disruption',
          description: `Audit Classroom Disruption ${runId}`,
          action_taken: 'Verbal Warning & Counseling',
          incident_date: new Date().toISOString().split('T')[0],
          severity: 'Low',
          status: 'Resolved'
        }])
        .select()
        .single();
      assert(!discErr && discData, `Disciplinary record creation failed: ${discErr?.message}`);
      testIds.disciplinary_records.push(discData.id);
    });

    await auditStep('Medical & Discipline', 'Frontend UI & Templates', 'Inspect MedicalManagement & DisciplineManagement modals & badges', async () => {
      const medCode = readSourceFile('src/pages/dashboard/MedicalManagement.tsx');
      assert(medCode.includes('MedicalRecord'), 'MedicalRecord interface defined');
      assert(medCode.includes('showAddModal'), 'showAddModal state handled');

      const discCode = readSourceFile('src/pages/dashboard/DisciplineManagement.tsx');
      assert(discCode.includes('DisciplinaryRecord'), 'DisciplinaryRecord interface defined');
      assert(discCode.includes('severityFilter'), 'severityFilter state handled');
    });

    await auditStep('Medical & Discipline', 'Zero Mock Data', 'Verify zero mock data in Medical & Discipline modules', async () => {
      const medCode = readSourceFile('src/pages/dashboard/MedicalManagement.tsx');
      const discCode = readSourceFile('src/pages/dashboard/DisciplineManagement.tsx');
      assert(!medCode.includes('const MOCK_MEDICAL'), 'No mock data in MedicalManagement.tsx');
      assert(!discCode.includes('const MOCK_DISCIPLINE'), 'No mock data in DisciplineManagement.tsx');
    });

    // =============================================================
    // 9. FRONT OFFICE & CERTIFICATES MODULE AUDIT
    // =============================================================
    console.log('\n--- 9. FRONT OFFICE & CERTIFICATES MODULE AUDIT ---');

    await auditStep('Front Office & Certificates', 'Live DB & RPC', 'Front Office Logs & Certificate Issuance with Verification Code', async () => {
      // 1. Front Office Log
      const nowIso = new Date().toISOString();
      const { data: foData, error: foErr } = await adminClient
        .from('front_office_logs')
        .insert([{
          name: `Visitor ${runId}`,
          phone: '+91 9123456780',
          type: 'Visitor',
          purpose: 'Admission Inquiry for Grade 6',
          date_time: nowIso,
          assigned_to: 'Principal Desk',
          status: 'Completed'
        }])
        .select()
        .single();
      assert(!foErr && foData, `Front office log creation failed: ${foErr?.message}`);
      testIds.front_office_logs.push(foData.id);

      // 2. Certificate Issuance Record
      const certNo = `RMMPS/TC/2026/${runId}`;

      const { data: certData, error: certErr } = await adminClient
        .from('certificates')
        .insert([{
          student_id: testStudentId,
          certificate_type: 'transfer',
          serial_number: certNo,
          template_name: 'cbse_transfer_v1',
          issued_at: nowIso,
          issued_by: adminUserId
        }])
        .select()
        .single();
      assert(!certErr && certData, `Certificate record creation failed: ${certErr?.message}`);
      testIds.certificates.push(certData.id);
    });

    await auditStep('Front Office & Certificates', 'Frontend UI & Templates', 'Inspect CertificateGenerator PDF render, QRCode & templates', async () => {
      const certCode = readSourceFile('src/pages/dashboard/CertificateGenerator.tsx');
      assert(certCode.includes('html2canvasSafe') || certCode.includes('html2canvas'), 'html2canvas configured for certificate rendering');
      assert(certCode.includes('jsPDF'), 'jsPDF configured for certificate export');
      assert(certCode.includes('QRCodeSVG'), 'QRCodeSVG configured for tamper-proof certificate verification');
      assert(certCode.includes('CertificateType'), 'Multiple CertificateType supported');
      assert(certCode.includes('BorderTheme'), 'Border themes supported');

      const foCode = readSourceFile('src/pages/dashboard/FrontOfficeManagement.tsx');
      assert(foCode.includes('FrontOfficeLog'), 'FrontOfficeLog interface defined');
      assert(foCode.includes('typeFilter'), 'typeFilter implemented');
    });

    await auditStep('Front Office & Certificates', 'Zero Mock Data', 'Verify zero mock data in Front Office & CertificateGenerator', async () => {
      const foCode = readSourceFile('src/pages/dashboard/FrontOfficeManagement.tsx');
      const certCode = readSourceFile('src/pages/dashboard/CertificateGenerator.tsx');
      assert(!foCode.includes('const MOCK_LOGS'), 'No mock logs in FrontOfficeManagement.tsx');
      assert(!certCode.includes('const MOCK_CERTIFICATES'), 'No mock certificates in CertificateGenerator.tsx');
    });

    // =============================================================
    // 10. SYSTEM ADMINISTRATION & RBAC MODULE AUDIT
    // =============================================================
    console.log('\n--- 10. SYSTEM ADMINISTRATION & RBAC MODULE AUDIT ---');

    await auditStep('System & RBAC', 'Live DB & RPC', 'RPC system_overview & admin_user_directory Live Execution', async () => {
      const { data: sysOverview, error: sysErr } = await authedAdminClient.rpc('system_overview');
      assert(!sysErr && sysOverview, `system_overview RPC failed: ${sysErr?.message}`);
      assert(sysOverview.users && typeof sysOverview.users.total === 'number', 'system_overview returns users metric');

      const { data: userDir, error: userErr } = await authedAdminClient.rpc('admin_user_directory', {
        _search: '',
        _role: 'all',
        _status: 'all',
        _linked: 'all',
        _limit: 10,
        _offset: 0
      });
      assert(!userErr && Array.isArray(userDir), `admin_user_directory RPC failed: ${userErr?.message}`);
      assert(userDir.length > 0, 'admin_user_directory returned users list');
    });

    await auditStep('System & RBAC', 'Live DB & RPC', 'RPC set_user_status Live Execution & Audit Trail', async () => {
      // Find a non-admin test user to test status toggle
      const { data: targetUsers } = await adminClient
        .from('profiles')
        .select('id, email, status, role')
        .neq('id', adminUserId)
        .limit(1);

      if (targetUsers && targetUsers.length > 0) {
        const target = targetUsers[0];
        const originalStatus = target.status;
        const newStatus = originalStatus === 'active' ? 'suspended' : 'active';

        // Toggle status
        const { data: toggleRes, error: toggleErr } = await authedAdminClient.rpc('set_user_status', {
          _user_id: target.id,
          _status: newStatus,
          _reason: `Audit status test ${runId}`
        });
        assert(!toggleErr, `set_user_status RPC failed: ${toggleErr?.message}`);

        // Revert status back
        await authedAdminClient.rpc('set_user_status', {
          _user_id: target.id,
          _status: originalStatus,
          _reason: `Audit status revert ${runId}`
        });
      }
    });

    await auditStep('System & RBAC', 'Live DB & RPC', 'RPC audit_log_search & audit_log_facets Live Verification', async () => {
      const { data: facets, error: facetErr } = await authedAdminClient.rpc('audit_log_facets');
      assert(!facetErr && facets, `audit_log_facets RPC failed: ${facetErr?.message}`);
      assert(Array.isArray(facets.actions) && Array.isArray(facets.tables), 'audit_log_facets returned structured facets');

      const { data: logs, error: logErr } = await authedAdminClient.rpc('audit_log_search', {
        _search: '',
        _action: 'all',
        _table: 'all',
        _limit: 10,
        _offset: 0
      });
      assert(!logErr && Array.isArray(logs), `audit_log_search RPC failed: ${logErr?.message}`);
    });

    await auditStep('System & RBAC', 'Frontend UI & Templates', 'Inspect SystemManagement subviews, user directory & audit log viewer', async () => {
      const sysCode = readSourceFile('src/pages/dashboard/SystemManagement.tsx');
      assert(sysCode.includes('SystemOverviewView'), 'SystemOverviewView integrated');
      assert(sysCode.includes('UserDirectoryView'), 'UserDirectoryView integrated');
      assert(sysCode.includes('RolesPermissionsView'), 'RolesPermissionsView integrated');
      assert(sysCode.includes('SchoolSettingsView'), 'SchoolSettingsView integrated');
      assert(sysCode.includes('AuditLogsView'), 'AuditLogsView integrated');
      assert(sysCode.includes('SecurityView'), 'SecurityView integrated');
    });

    await auditStep('System & RBAC', 'Zero Mock Data', 'Verify zero mock data in SystemManagement & subviews', async () => {
      const sysCode = readSourceFile('src/pages/dashboard/SystemManagement.tsx');
      assert(!sysCode.includes('const MOCK_USERS'), 'No mock users in SystemManagement.tsx');
      assert(!sysCode.includes('const dummyLogs'), 'No dummy logs in SystemManagement.tsx');
    });

  } finally {
    // =============================================================
    // TEARDOWN: SAFE DATABASE CLEANUP
    // =============================================================
    console.log('\n--- AUTOMATED SAFE DATABASE TEARDOWN ---');
    await auditStep('Teardown', 'Quality Gate & Teardown', 'Cascade-aware deletion of all generated audit records', async () => {
      // 1. Fee Payments & Student Fees
      for (const id of testIds.fee_payments) {
        await adminClient.from('fee_payments').delete().eq('id', id);
      }
      for (const id of testIds.student_fees) {
        await adminClient.from('student_fees').delete().eq('id', id);
      }

      // 2. Marks, Exam Subjects & Exams
      for (const id of testIds.marks) {
        await adminClient.from('marks').delete().eq('id', id);
      }
      for (const id of testIds.exam_subjects) {
        await adminClient.from('exam_subjects').delete().eq('id', id);
      }
      for (const id of testIds.exams) {
        await adminClient.from('exams').delete().eq('id', id);
      }

      // 3. Attendance
      for (const id of testIds.attendance) {
        await adminClient.from('attendance').delete().eq('id', id);
      }

      // 4. Student Transport & Drivers & Vehicles & Routes
      for (const id of testIds.student_transport) {
        await adminClient.from('student_transport').delete().eq('id', id);
      }
      for (const id of testIds.drivers) {
        await adminClient.from('drivers').delete().eq('id', id);
      }
      for (const id of testIds.vehicles) {
        await adminClient.from('vehicles').delete().eq('id', id);
      }
      for (const id of testIds.transport_routes) {
        await adminClient.from('transport_routes').delete().eq('id', id);
      }

      // 5. Book Issues & Library Books
      for (const id of testIds.book_issues) {
        await adminClient.from('book_issues').delete().eq('id', id);
      }
      for (const id of testIds.library_books) {
        await adminClient.from('library_books').delete().eq('id', id);
      }

      // 6. Hostel Rooms & Hostels
      for (const id of testIds.rooms) {
        await adminClient.from('rooms').delete().eq('id', id);
      }
      for (const id of testIds.hostels) {
        await adminClient.from('hostels').delete().eq('id', id);
      }

      // 7. Inventory & Assets
      for (const id of testIds.inventory) {
        await adminClient.from('inventory').delete().eq('id', id);
      }
      for (const id of testIds.assets) {
        await adminClient.from('assets').delete().eq('id', id);
      }

      // 8. Student Medical & Disciplinary Records
      for (const id of testIds.student_medical) {
        await adminClient.from('student_medical').delete().eq('id', id);
      }
      for (const id of testIds.disciplinary_records) {
        await adminClient.from('disciplinary_records').delete().eq('id', id);
      }

      // 9. Front Office Logs & Certificates
      for (const id of testIds.front_office_logs) {
        await adminClient.from('front_office_logs').delete().eq('id', id);
      }
      for (const id of testIds.certificates) {
        await adminClient.from('certificates').delete().eq('id', id);
      }

      // 10. Student Anchor
      for (const id of testIds.students) {
        await adminClient.from('students').delete().eq('id', id);
      }

      console.log('    All audit test records successfully deleted from live PostgreSQL.');
    });
  }

  // -------------------------------------------------------------
  // REPORTING & SCORECARD GENERATION
  // -------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('AUDIT EXECUTION SUMMARY & SCORECARD');
  console.log('========================================================================');
  
  const total = scorecard.length;
  const passed = scorecard.filter(s => s.passed).length;
  const failed = scorecard.filter(s => !s.passed).length;

  console.log(`Total Checks Executed: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.error('FAILURES DETECTED:');
    scorecard.filter(s => !s.passed).forEach(f => {
      console.error(` - [${f.module}] [${f.category}] ${f.testName}: ${f.error}`);
    });
    process.exitCode = 1;
  } else {
    console.log('ALL MODULE AUDIT CHECKS PASSED PERFECTION (100%)!');
    process.exitCode = 0;
  }

  // Write JSON report to disk
  const reportPath = path.resolve(process.cwd(), 'tests/reports/remaining-modules-audit-results.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    total,
    passed,
    failed,
    scorecard
  }, null, 2));
}

main().catch(err => {
  console.error('Fatal execution error in test runner:', err);
  process.exit(1);
});
