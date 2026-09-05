/**
 * Master Admissions Complete Audit & Verification Test Suite
 * Tests full end-to-end functionality for the Admin Admissions Management Module:
 * - Data Services & Reference Metadata Fetching
 * - Multi-field Filtering, Search & Pagination
 * - Application Intake Lifecycle (Creation with documents & payload)
 * - Document Audit & Status Verification Workflow
 * - Fast-Track Enrolment & SIS Student Record Creation (RPC approve_admission)
 * - Application Rejection with Reason & Audit Trail (RPC reject_admission)
 * - UI Component Structure & Handler Verification
 * - Automated Database Teardown
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

interface AuditStepResult {
  suite: string;
  testCase: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: AuditStepResult[] = [];

async function testStep(suite: string, testCase: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    results.push({ suite, testCase, passed: true, durationMs });
    console.log(`  [PASS] [${suite}] ${testCase} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    results.push({ suite, testCase, passed: false, error: err.message, durationMs });
    console.error(`  [FAIL] [${suite}] ${testCase} (${durationMs}ms)\n         Error: ${err.message}`);
  }
}

async function main() {
  console.log('\n===============================================================');
  console.log('ADMIN ADMISSIONS SECTION — DEEP DIVE COMPLETE AUDIT');
  console.log('===============================================================\n');

  let adminUser: any = null;
  let authedClient: any = null;
  const runId = Math.random().toString(36).substring(2, 7).toUpperCase();
  
  // Track created records for safe teardown
  const createdAdmissionIds: string[] = [];
  const createdStudentIds: string[] = [];

  let testClass: any = null;
  let testSection: any = null;
  let testYear: any = null;

  try {
    // -------------------------------------------------------------
    // 1. ADMIN AUTHENTICATION
    // -------------------------------------------------------------
    console.log('--- 1. Admin Authentication & Session ---');
    await testStep('Auth', 'Admin sign-in with credentials', async () => {
      const { data, error } = await anonClient.auth.signInWithPassword({
        email: 'admin@school.com',
        password: 'Password@123'
      });
      assert(!error && data?.session, `Admin sign-in failed: ${error?.message}`);
      adminUser = data.user;
      authedClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }
      });
    });

    // -------------------------------------------------------------
    // 2. REFERENCE METADATA & DATA FETCHING
    // -------------------------------------------------------------
    console.log('\n--- 2. Reference Metadata & Admissions Fetch ---');
    await testStep('Data Fetch', 'Fetch Classes, Sections, and Academic Years reference data', async () => {
      const [classesRes, sectionsRes, yearsRes] = await Promise.all([
        authedClient.from('classes').select('id, class_name').order('class_name'),
        authedClient.from('sections').select('id, section_name, capacity').order('section_name'),
        authedClient.from('academic_years').select('id, name, is_current, start_date, end_date').order('start_date', { ascending: false }),
      ]);

      assert(!classesRes.error, `Classes fetch error: ${classesRes.error?.message}`);
      assert(classesRes.data && classesRes.data.length > 0, 'No classes found');
      testClass = classesRes.data[0];

      assert(!sectionsRes.error, `Sections fetch error: ${sectionsRes.error?.message}`);
      assert(sectionsRes.data && sectionsRes.data.length > 0, 'No sections found');
      testSection = sectionsRes.data[0];

      assert(!yearsRes.error, `Years fetch error: ${yearsRes.error?.message}`);
      assert(yearsRes.data && yearsRes.data.length > 0, 'No academic years found');
      testYear = yearsRes.data.find((y: any) => y.is_current) || yearsRes.data[0];
    });

    await testStep('Data Fetch', 'Fetch Admissions Queue with joined Student relations', async () => {
      const { data, error } = await authedClient
        .from('admissions')
        .select(`
          *,
          students:student_id (
            id,
            admission_number,
            roll_number,
            class,
            section,
            name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      assert(!error, `Admissions query failed: ${error?.message}`);
      assert(Array.isArray(data), 'Admissions data is not an array');
    });

    // -------------------------------------------------------------
    // 3. APPLICATION INTAKE & CREATION WORKFLOW
    // -------------------------------------------------------------
    console.log('\n--- 3. Application Intake & Creation Workflow ---');
    let testAdmission1Id = '';
    const applicantName1 = `Audit Student Alpha ${runId}`;

    await testStep('Intake', 'Create new complete admission application (Status: Pending)', async () => {
      const appNum = `SJS/ADM/${testYear.name}/${runId}01`;
      const docsPayload = [
        { id: 'doc-1', name: 'Birth Certificate', type: 'Certificate', status: 'Pending' },
        { id: 'doc-2', name: 'Transfer Certificate (TC)', type: 'Academic', status: 'Pending' },
        { id: 'doc-3', name: 'Previous School Marksheet', type: 'Academic', status: 'Pending' },
        { id: 'doc-4', name: 'Aadhaar Card / ID Proof', type: 'Identification', status: 'Verified' },
        { id: 'doc-5', name: 'Passport Size Photograph', type: 'Photo', status: 'Verified', url: 'https://example.com/photo.jpg' },
      ];

      const newRecordPayload = {
        application_number: appNum,
        name: applicantName1,
        father_name: `Guardian Alpha ${runId}`,
        mother_name: `Mother Alpha ${runId}`,
        date_of_birth: '2016-05-12',
        gender: 'male',
        class: testClass.class_name,
        class_id: testClass.id,
        section: testSection.section_name,
        section_id: testSection.id,
        academic_year: testYear.name,
        academic_year_id: testYear.id,
        phone: '9876543210',
        email: `alpha_${runId.toLowerCase()}@example.com`,
        address: '123 Academic Enclave, Civil Lines',
        aadhaar_last4: '4589',
        category: 'General',
        cwsn_status: false,
        only_child_girl: false,
        previous_school: 'Delhi Public Preparatory',
        previous_class: 'Kindergarten',
        previous_marks: 'A+',
        transfer_certificate_no: `TC-${runId}-01`,
        blood_group: 'O+',
        emergency_contact: '9876543210',
        religion: 'Hinduism',
        nationality: 'Indian',
        father_occupation: 'Engineer',
        mother_occupation: 'Professor',
        documents: docsPayload,
        status: 'Pending',
        notes: 'Priority admission test intake candidate',
      };

      const { data, error } = await authedClient
        .from('admissions')
        .insert([newRecordPayload])
        .select()
        .single();

      assert(!error, `Failed to insert admission application: ${error?.message}`);
      assert(data && data.id, 'Created admission missing ID');
      assert(data.status === 'Pending', `Expected status 'Pending', got ${data.status}`);
      assert(data.name === applicantName1, 'Name mismatch');
      assert(Array.isArray(data.documents) && data.documents.length === 5, 'Documents JSONB not preserved');

      testAdmission1Id = data.id;
      createdAdmissionIds.push(data.id);
    });

    // -------------------------------------------------------------
    // 4. MULTI-FIELD SEARCH & FILTERING VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 4. Search & Filtering Verification ---');
    await testStep('Search/Filter', 'Search application by partial applicant name', async () => {
      const { data, error } = await authedClient
        .from('admissions')
        .select('id, name, application_number')
        .ilike('name', `%${applicantName1}%`);

      assert(!error, `Name search error: ${error?.message}`);
      assert(data && data.length >= 1, 'Expected at least 1 record matching applicant name');
      assert(data.some((d: any) => d.id === testAdmission1Id), 'Created record not found in search results');
    });

    await testStep('Search/Filter', 'Filter by status (Pending) and academic year', async () => {
      const { data, error } = await authedClient
        .from('admissions')
        .select('id, status, academic_year')
        .eq('status', 'Pending')
        .eq('academic_year', testYear.name);

      assert(!error, `Filter query error: ${error?.message}`);
      assert(data && data.some((d: any) => d.id === testAdmission1Id), 'Record not present in status/year filter');
    });

    // -------------------------------------------------------------
    // 5. APPLICATION UPDATE & DOCUMENT VERIFICATION WORKFLOW
    // -------------------------------------------------------------
    console.log('\n--- 5. Application Update & Document Verification ---');
    await testStep('Update/Docs', 'Update application details and category', async () => {
      const { data, error } = await authedClient
        .from('admissions')
        .update({
          category: 'OBC',
          notes: 'Updated category verification completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', testAdmission1Id)
        .select()
        .single();

      assert(!error, `Update failed: ${error?.message}`);
      assert(data.category === 'OBC', `Expected category 'OBC', got ${data.category}`);
    });

    await testStep('Update/Docs', 'Verify document using verify_admission_document RPC', async () => {
      const { data, error } = await authedClient.rpc('verify_admission_document', {
        _admission_id: testAdmission1Id,
        _document_id: 'doc-1',
        _status: 'Verified',
        _remarks: 'Original Birth Certificate physically verified by Admissions Officer'
      });

      assert(!error, `verify_admission_document RPC error: ${error?.message}`);
      
      // Query back to double-check documents JSONB
      const { data: record, error: fetchErr } = await authedClient
        .from('admissions')
        .select('documents')
        .eq('id', testAdmission1Id)
        .single();

      assert(!fetchErr, `Fetch error: ${fetchErr?.message}`);
      const birthDoc = record.documents.find((d: any) => d.id === 'doc-1');
      assert(birthDoc && birthDoc.status === 'Verified', 'Document doc-1 status is not Verified');
      assert(birthDoc.remarks?.includes('physically verified'), 'Document remarks not updated');
    });

    // -------------------------------------------------------------
    // 6. FAST-TRACK ENROLMENT & SIS STUDENT CREATION (approve_admission)
    // -------------------------------------------------------------
    console.log('\n--- 6. Fast-Track Enrolment & SIS Integration ---');
    let enrolledStudentId = '';

    await testStep('Enrolment', 'Approve admission & atomically create SIS student record', async () => {
      const { data, error } = await authedClient.rpc('approve_admission', {
        _admission_id: testAdmission1Id,
        _section_name: testSection.section_name,
        _roll_number: null // auto-assign
      });

      assert(!error, `approve_admission RPC error: ${error?.message}`);
      assert(data && data.length > 0, 'RPC returned empty response');
      const enrolled = data[0];
      assert(enrolled.student_id, 'Enrolled response missing student_id');
      assert(enrolled.status === 'Approved', `Expected status Approved, got ${enrolled.status}`);
      
      enrolledStudentId = enrolled.student_id;
      createdStudentIds.push(enrolled.student_id);

      // Verify the admissions table was updated
      const { data: admRecord, error: admErr } = await authedClient
        .from('admissions')
        .select('id, status, student_id, reviewed_by, reviewed_at')
        .eq('id', testAdmission1Id)
        .single();

      assert(!admErr, `Admissions fetch error: ${admErr?.message}`);
      assert(admRecord.status === 'Approved', `Admissions table status expected Approved, got ${admRecord.status}`);
      assert(admRecord.student_id === enrolledStudentId, 'Linked student_id mismatch in admissions table');
      assert(admRecord.reviewed_by === adminUser.id, 'reviewed_by not set to admin user');

      // Verify the student record in public.students
      const { data: stuRecord, error: stuErr } = await authedClient
        .from('students')
        .select('id, name, father_name, admission_number, roll_number, class, section, academic_year')
        .eq('id', enrolledStudentId)
        .single();

      assert(!stuErr, `Students fetch error: ${stuErr?.message}`);
      assert(stuRecord.name === applicantName1, `Student name mismatch: ${stuRecord.name}`);
      assert(stuRecord.admission_number, 'Student admission_number not generated');
      assert(stuRecord.roll_number, 'Student roll_number not generated');
    });

    await testStep('Enrolment', 'Verify idempotency: re-approving returns existing student without duplicating', async () => {
      const { data, error } = await authedClient.rpc('approve_admission', {
        _admission_id: testAdmission1Id,
        _section_name: testSection.section_name,
        _roll_number: null
      });

      assert(!error, `Idempotent approve_admission error: ${error?.message}`);
      assert(data && data.length > 0, 'RPC returned empty response on duplicate call');
      assert(data[0].student_id === enrolledStudentId, 'Idempotent call produced a different student ID');
    });

    // -------------------------------------------------------------
    // 7. APPLICATION REJECTION WORKFLOW (reject_admission)
    // -------------------------------------------------------------
    console.log('\n--- 7. Rejection & Audit Workflow ---');
    let testAdmission2Id = '';
    const applicantName2 = `Audit Student Beta ${runId}`;

    await testStep('Rejection', 'Create second test application for rejection audit', async () => {
      const appNum = `SJS/ADM/${testYear.name}/${runId}02`;
      const { data, error } = await authedClient
        .from('admissions')
        .insert([{
          application_number: appNum,
          name: applicantName2,
          father_name: `Guardian Beta ${runId}`,
          date_of_birth: '2015-09-20',
          gender: 'female',
          class: testClass.class_name,
          academic_year: testYear.name,
          phone: '9123456780',
          status: 'Pending',
        }])
        .select()
        .single();

      assert(!error, `Insert failed: ${error?.message}`);
      testAdmission2Id = data.id;
      createdAdmissionIds.push(data.id);
    });

    await testStep('Rejection', 'Reject application with explicit audit reason via reject_admission RPC', async () => {
      const rejectionReason = 'Candidate did not meet age criteria for Class 1 (Underage by 4 months)';
      const { data, error } = await authedClient.rpc('reject_admission', {
        _admission_id: testAdmission2Id,
        _reason: rejectionReason
      });

      assert(!error, `reject_admission RPC error: ${error?.message}`);
      assert(data === true, 'reject_admission did not return true');

      // Verify admissions table status and rejection metadata
      const { data: record, error: fetchErr } = await authedClient
        .from('admissions')
        .select('status, rejection_reason, rejected_by, rejected_at')
        .eq('id', testAdmission2Id)
        .single();

      assert(!fetchErr, `Fetch error: ${fetchErr?.message}`);
      assert(record.status === 'Rejected', `Expected status Rejected, got ${record.status}`);
      assert(record.rejection_reason === rejectionReason, 'Rejection reason mismatch');
      assert(record.rejected_by === adminUser.id, 'rejected_by not set to admin user');
      assert(record.rejected_at, 'rejected_at timestamp missing');
    });

    // -------------------------------------------------------------
    // 8. AUDIT LOGS VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 8. Audit Logs Verification ---');
    await testStep('Audit Logs', 'Verify ADMISSION_APPROVED and ADMISSION_REJECTED logs recorded in audit_logs', async () => {
      const { data, error } = await adminClient
        .from('audit_logs')
        .select('*')
        .in('record_id', [testAdmission1Id, testAdmission2Id])
        .order('created_at', { ascending: false });

      assert(!error, `Audit logs query error: ${error?.message}`);
      const approvedLog = data?.find((l: any) => l.action_type === 'ADMISSION_APPROVED' && l.record_id === testAdmission1Id);
      const rejectedLog = data?.find((l: any) => l.action_type === 'ADMISSION_REJECTED' && l.record_id === testAdmission2Id);

      assert(!!approvedLog, 'Missing ADMISSION_APPROVED audit log');
      assert(!!rejectedLog, 'Missing ADMISSION_REJECTED audit log');
    });

    // -------------------------------------------------------------
    // 9. FRONTEND UI COMPONENTS INTEGRITY AUDIT
    // -------------------------------------------------------------
    console.log('\n--- 9. Frontend UI Component Files & Architecture Audit ---');

    const admissionsComponents = [
      { file: 'src/pages/dashboard/AdmissionsManagement.tsx', requiredTerms: ['AdmissionsManagement', 'kanban', 'handleFastTrackEnrol', 'handleBulkApprove', 'handleExportCSV', 'ALL_COLUMNS'] },
      { file: 'src/components/admissions/AdmissionApplicationFormModal.tsx', requiredTerms: ['AdmissionApplicationFormModal', 'STEPS', 'REQUIRED_FIELDS', 'directEnroll', 'handleSubmit'] },
      { file: 'src/components/admissions/AdmissionRejectModal.tsx', requiredTerms: ['AdmissionRejectModal', 'QUICK_REASONS', 'rejectAdmission', 'handleSubmit'] },
      { file: 'src/components/admissions/AdmissionLetterModal.tsx', requiredTerms: ['AdmissionLetterModal', 'Official Admission Letter', 'handlePrint', 'QRCodeSVG'] },
      { file: 'src/components/admissions/AdmissionDetailsDrawer.tsx', requiredTerms: ['AdmissionDetailsDrawer', 'handleApprove', 'handleVerifyDoc', 'documents'] },
      { file: 'src/components/admissions/AdmissionUI.tsx', requiredTerms: ['StatusBadge', 'Avatar', 'ModalShell', 'Field'] },
      { file: 'src/services/admissionService.ts', requiredTerms: ['fetchAdmissions', 'fetchReferenceData', 'createAdmission', 'updateAdmission', 'approveAdmission', 'rejectAdmission', 'updateDocumentVerification'] },
    ];

    for (const comp of admissionsComponents) {
      await testStep('UI Code', `Validate ${path.basename(comp.file)} structure & handlers`, async () => {
        const fullPath = path.resolve(process.cwd(), comp.file);
        assert(fs.existsSync(fullPath), `Component file not found: ${comp.file}`);
        const content = fs.readFileSync(fullPath, 'utf-8');
        for (const term of comp.requiredTerms) {
          assert(content.includes(term), `Component ${comp.file} missing required identifier/handler: "${term}"`);
        }
      });
    }

  } finally {
    // -------------------------------------------------------------
    // 10. SAFE TEARDOWN & CLEANUP
    // -------------------------------------------------------------
    console.log('\n--- 10. Safe Teardown & Test Records Purge ---');
    if (createdStudentIds.length > 0) {
      await testStep('Teardown', `Purge ${createdStudentIds.length} test students`, async () => {
        // Unlink student_id from admissions first
        await adminClient
          .from('admissions')
          .update({ student_id: null })
          .in('student_id', createdStudentIds);

        const { error } = await adminClient
          .from('students')
          .delete()
          .in('id', createdStudentIds);
        assert(!error, `Failed to delete test students: ${error?.message}`);
      });
    }

    if (createdAdmissionIds.length > 0) {
      await testStep('Teardown', `Purge ${createdAdmissionIds.length} test admissions`, async () => {
        const { error } = await adminClient
          .from('admissions')
          .delete()
          .in('id', createdAdmissionIds);
        assert(!error, `Failed to delete test admissions: ${error?.message}`);
      });
    }
  }

  // -------------------------------------------------------------
  // SCORECARD SUMMARY
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('ADMISSIONS SECTION COMPLETE AUDIT SCORECARD');
  console.log('===============================================================');

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Total Test Cases : ${total}`);
  console.log(`Passed           : ${passed}`);
  console.log(`Failed           : ${failed}`);
  console.log(`Success Rate     : ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.error('\nFAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.error(`  - [${r.suite}] ${r.testCase}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n>>> ALL ADMISSION SECTION TESTS PASSED PERFECTLY! <<<\n');
  }
}

main().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
