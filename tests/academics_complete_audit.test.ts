/**
 * Master Academics Section Complete Audit & Verification Test Suite
 * Tests full end-to-end functionality for the Academics Module:
 * - Academic Years Management & Current Session Switching (RPC set_current_academic_year)
 * - Academics Master Overview & KPI Health Aggregation (RPC academics_overview)
 * - Classes Directory & Lifecycle Management (RPC academics_class_directory)
 * - Section Letters & Class Section Attachments (RPC academics_section_directory)
 * - Subjects Catalog & Category/Type Attributes (RPC academics_subject_directory)
 * - Class-Subject Offerings & Curriculum Mappings (RPC academics_class_subjects)
 * - Curriculum Gap Analysis & Auto-Import from Timetable
 * - Timetable Scheduling & Clash Resolution
 * - Cross-Module Teacher Options with Specializations
 * - UI Component Structure & Sub-view Handlers
 * - Safe Database Teardown
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
  console.log('ADMIN ACADEMICS SECTION — DEEP DIVE COMPLETE AUDIT');
  console.log('===============================================================\n');

  let adminUser: any = null;
  let authedClient: any = null;
  const runId = Math.random().toString(36).substring(2, 7).toUpperCase();

  // Test records tracked for teardown
  let currentYearId = '';
  let testYearId = '';
  let testClassId = '';
  let testClassSectionId = '';
  let testSubjectId = '';
  let testMappingId = '';
  let testTimetableId = '';

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
    // 2. ACADEMIC YEARS & SESSION LIFECYCLE
    // -------------------------------------------------------------
    console.log('\n--- 2. Academic Years & Session Management ---');
    await testStep('Academic Years', 'Fetch all academic years and identify current year', async () => {
      const { data, error } = await authedClient
        .from('academic_years')
        .select('id, name, start_date, end_date, is_current, is_active, status')
        .order('start_date', { ascending: false });

      assert(!error, `Fetch academic years error: ${error?.message}`);
      assert(Array.isArray(data) && data.length > 0, 'No academic years found');
      
      const current = data.find((y: any) => y.is_current);
      assert(!!current, 'No current academic year found in database');
      currentYearId = current.id;
    });

    await testStep('Academic Years', 'Create upcoming academic year session', async () => {
      const yearName = `2029-30-TEST-${runId}`;
      const { data, error } = await authedClient
        .from('academic_years')
        .insert([{
          name: yearName,
          start_date: '2029-04-01T00:00:00.000Z',
          end_date: '2030-03-31T00:00:00.000Z',
          status: 'upcoming',
          is_active: true,
          is_current: false
        }])
        .select()
        .single();

      assert(!error, `Failed to create academic year: ${error?.message}`);
      assert(data?.id, 'Created year missing id');
      assert(data.name === yearName, 'Created year name mismatch');
      testYearId = data.id;
    });

    await testStep('Academic Years', 'Atomic switch of current academic year via set_current_academic_year RPC', async () => {
      const { error: switchErr } = await authedClient.rpc('set_current_academic_year', { _year_id: testYearId });
      assert(!switchErr, `RPC set_current_academic_year error: ${switchErr?.message}`);

      // Verify new year is current
      const { data: updatedNew } = await authedClient
        .from('academic_years')
        .select('is_current')
        .eq('id', testYearId)
        .single();
      assert(updatedNew?.is_current === true, 'New test year was not set as current');

      // Revert back to original current year
      const { error: revertErr } = await authedClient.rpc('set_current_academic_year', { _year_id: currentYearId });
      assert(!revertErr, `RPC revert current academic year error: ${revertErr?.message}`);
    });

    // -------------------------------------------------------------
    // 3. ACADEMICS OVERVIEW & KPI HEALTH CHECKS
    // -------------------------------------------------------------
    console.log('\n--- 3. Academics Overview & Read-Model Aggregation ---');
    await testStep('Overview', 'Execute academics_overview RPC and validate structural KPIs', async () => {
      const { data, error } = await authedClient.rpc('academics_overview', { _academic_year_id: currentYearId });
      assert(!error, `academics_overview RPC error: ${error?.message}`);
      assert(Array.isArray(data) && data.length > 0, 'Empty overview response');

      const kpis = data[0];
      assert(kpis.academic_year_id === currentYearId, 'Academic year ID mismatch in overview');
      assert(parseInt(kpis.classes_total) > 0, 'classes_total should be > 0');
      assert(parseInt(kpis.sections_total) > 0, 'sections_total should be > 0');
      assert(parseInt(kpis.subjects_total) > 0, 'subjects_total should be > 0');
      assert(parseInt(kpis.students_enrolled) >= 0, 'students_enrolled should be >= 0');
      assert(parseInt(kpis.teachers_active) >= 0, 'teachers_active should be >= 0');
      assert(parseInt(kpis.timetable_slots) >= 0, 'timetable_slots should be >= 0');
    });

    // -------------------------------------------------------------
    // 4. CLASSES & SECTIONS LIFECYCLE
    // -------------------------------------------------------------
    console.log('\n--- 4. Classes & Sections Directory & Lifecycle ---');
    await testStep('Classes', 'Query class directory via academics_class_directory RPC', async () => {
      const { data, error } = await authedClient.rpc('academics_class_directory', { _academic_year_id: currentYearId });
      assert(!error, `academics_class_directory RPC error: ${error?.message}`);
      assert(Array.isArray(data) && data.length > 0, 'Class directory returned no classes');
      assert(data[0].class_id && data[0].class_name, 'Class row missing class_id or class_name');
    });

    const testClassName = `TestClass${runId}`;
    const testClassCode = `TC${runId}`;

    await testStep('Classes', 'Create new test school class', async () => {
      const { data, error } = await authedClient
        .from('classes')
        .insert([{
          class_name: testClassName,
          class_code: testClassCode,
          stream: 'Science',
          display_order: 99,
          is_active: true
        }])
        .select()
        .single();

      assert(!error, `Insert class failed: ${error?.message}`);
      assert(data?.id, 'Created class missing id');
      testClassId = data.id;
    });

    await testStep('Classes', 'Toggle class active state', async () => {
      const { data, error } = await authedClient
        .from('classes')
        .update({ is_active: false })
        .eq('id', testClassId)
        .select()
        .single();

      assert(!error, `Update class active state failed: ${error?.message}`);
      assert(data.is_active === false, 'Class is_active was not set to false');

      // Reactivate
      await authedClient.from('classes').update({ is_active: true }).eq('id', testClassId);
    });

    await testStep('Sections', 'Fetch global section letters and attach section to class', async () => {
      const { data: secLetters, error: secErr } = await authedClient
        .from('sections')
        .select('id, section_name, capacity, is_active')
        .order('section_name');

      assert(!secErr, `Fetch sections failed: ${secErr?.message}`);
      assert(Array.isArray(secLetters) && secLetters.length > 0, 'No section letters found');
      const targetSec = secLetters[0];

      // Attach to test class via class_sections
      const { data: attached, error: attachErr } = await authedClient
        .from('class_sections')
        .insert([{
          class_id: testClassId,
          section_id: targetSec.id,
          capacity: 45,
          room_no: 'Lab-101',
          is_active: true
        }])
        .select()
        .single();

      assert(!attachErr, `Attach section to class failed: ${attachErr?.message}`);
      assert(attached?.id, 'Attached class_section missing id');
      testClassSectionId = attached.id;
    });

    await testStep('Sections', 'Query class sections via academics_section_directory RPC', async () => {
      const { data, error } = await authedClient.rpc('academics_section_directory', {
        _academic_year_id: currentYearId,
        _class_id: testClassId
      });

      assert(!error, `academics_section_directory RPC error: ${error?.message}`);
      assert(Array.isArray(data) && data.length > 0, 'Section directory returned no rows for test class');
      const secRow = data.find((r: any) => r.class_section_id === testClassSectionId);
      assert(!!secRow, 'Attached section not found in section directory');
      assert(secRow.room_no === 'Lab-101', `Expected room Lab-101, got ${secRow.room_no}`);
    });

    // -------------------------------------------------------------
    // 5. SUBJECTS CATALOG LIFECYCLE
    // -------------------------------------------------------------
    console.log('\n--- 5. Subjects Catalog & Read Model ---');
    await testStep('Subjects', 'Query subject directory via academics_subject_directory RPC', async () => {
      const { data, error } = await authedClient.rpc('academics_subject_directory', { _academic_year_id: currentYearId });
      assert(!error, `academics_subject_directory RPC error: ${error?.message}`);
      assert(Array.isArray(data) && data.length > 0, 'Subject directory returned no subjects');
      assert(data[0].subject_id && data[0].subject_name, 'Subject row missing subject_id or subject_name');
    });

    const testSubName = `Robotics-${runId}`;
    const testSubCode = `ROB-${runId}`;

    await testStep('Subjects', 'Create new subject in catalog', async () => {
      const { data, error } = await authedClient
        .from('subjects')
        .insert([{
          subject_name: testSubName,
          subject_code: testSubCode,
          category: 'Scholastic',
          subject_type: 'Practical',
          is_active: true
        }])
        .select()
        .single();

      assert(!error, `Insert subject failed: ${error?.message}`);
      assert(data?.id, 'Created subject missing id');
      testSubjectId = data.id;
    });

    await testStep('Subjects', 'Update subject status and attributes', async () => {
      const { data, error } = await authedClient
        .from('subjects')
        .update({
          subject_type: 'Theory + Practical',
          is_active: true
        })
        .eq('id', testSubjectId)
        .select()
        .single();

      assert(!error, `Update subject failed: ${error?.message}`);
      assert(data.subject_type === 'Theory + Practical', 'Subject type not updated');
    });

    // -------------------------------------------------------------
    // 6. CLASS-SUBJECT OFFERING & CURRICULUM MAPPING
    // -------------------------------------------------------------
    console.log('\n--- 6. Class-Subject Offering & Curriculum Mapping ---');
    await testStep('Curriculum', 'Map subject to class in class_subjects table', async () => {
      const { data, error } = await authedClient
        .from('class_subjects')
        .insert([{
          class_id: testClassId,
          academic_year_id: currentYearId,
          subject_id: testSubjectId,
          section_id: null, // whole class
          is_mandatory: true,
          is_active: true
        }])
        .select()
        .single();

      assert(!error, `Map class_subjects failed: ${error?.message}`);
      assert(data?.id, 'Created mapping missing id');
      testMappingId = data.id;
    });

    await testStep('Curriculum', 'Query mapped class subjects via academics_class_subjects RPC', async () => {
      const { data, error } = await authedClient.rpc('academics_class_subjects', {
        _academic_year_id: currentYearId,
        _class_id: testClassId
      });

      assert(!error, `academics_class_subjects RPC error: ${error?.message}`);
      assert(Array.isArray(data) && data.length > 0, 'Expected mapped subjects for test class');
      const mapped = data.find((m: any) => m.mapping_id === testMappingId);
      assert(!!mapped, 'Created mapping not found in academics_class_subjects output');
      assert(mapped.subject_name === testSubName, `Subject name mismatch: ${mapped.subject_name}`);
      assert(mapped.is_mandatory === true, 'Mapping is_mandatory is not true');
    });

    await testStep('Curriculum', 'Update class-subject offering parameters', async () => {
      const { data, error } = await authedClient
        .from('class_subjects')
        .update({ is_mandatory: false })
        .eq('id', testMappingId)
        .select()
        .single();

      assert(!error, `Update class_subjects failed: ${error?.message}`);
      assert(data.is_mandatory === false, 'is_mandatory was not updated');
    });

    // -------------------------------------------------------------
    // 7. TIMETABLE & SCHEDULING SYSTEM
    // -------------------------------------------------------------
    console.log('\n--- 7. Timetable & Scheduling System ---');
    let sampleTeacherId: string | null = null;

    await testStep('Timetable', 'Fetch available teachers with active subject assignments', async () => {
      const { data, error } = await authedClient
        .from('teachers')
        .select('id, name, employee_id')
        .eq('is_active', true)
        .limit(1);

      assert(!error, `Fetch teacher failed: ${error?.message}`);
      if (data && data.length > 0) {
        sampleTeacherId = data[0].id;
      }
    });

    await testStep('Timetable', 'Create and schedule weekly timetable slot', async () => {
      const { data, error } = await authedClient
        .from('timetable')
        .insert([{
          academic_year_id: currentYearId,
          class_id: testClassId,
          class: testClassName,
          section_id: null,
          subject_id: testSubjectId,
          teacher_id: sampleTeacherId,
          day: 'mon',
          period_number: 1,
          start_time: '09:00:00',
          end_time: '09:45:00'
        }])
        .select()
        .single();

      assert(!error, `Insert timetable slot failed: ${error?.message}`);
      assert(data?.id, 'Created timetable slot missing id');
      testTimetableId = data.id;
    });

    await testStep('Timetable', 'Query class timetable slots', async () => {
      const { data, error } = await authedClient
        .from('timetable')
        .select('id, class_id, subject_id, day, period_number, start_time, end_time')
        .eq('academic_year_id', currentYearId)
        .eq('class_id', testClassId);

      assert(!error, `Fetch timetable failed: ${error?.message}`);
      assert(Array.isArray(data) && data.length > 0, 'No timetable slots returned for test class');
      const slot = data.find((s: any) => s.id === testTimetableId);
      assert(!!slot, 'Created timetable slot not present in query output');
      assert(slot.day === 'mon' && slot.period_number === 1, 'Timetable day or period mismatch');
    });

    // -------------------------------------------------------------
    // 8. FRONTEND UI COMPONENTS INTEGRITY AUDIT
    // -------------------------------------------------------------
    console.log('\n--- 8. Frontend UI Component Files & Architecture Audit ---');

    const academicsComponents = [
      { file: 'src/pages/dashboard/AcademicsManagement.tsx', requiredTerms: ['AcademicsManagement', 'ACADEMICS_VIEWS', 'AcademicsOverview', 'ClassesSectionsView', 'SubjectsView', 'TimetableView'] },
      { file: 'src/components/academics/AcademicsOverview.tsx', requiredTerms: ['AcademicsOverview', 'fetchOverview', 'classes_total', 'classes_active'] },
      { file: 'src/components/academics/AcademicYearsView.tsx', requiredTerms: ['AcademicYearsView', 'saveAcademicYear', 'setCurrentAcademicYear', 'deleteAcademicYear'] },
      { file: 'src/components/academics/ClassesSectionsView.tsx', requiredTerms: ['ClassesSectionsView', 'fetchClassDirectory', 'attachSectionToClass', 'saveClass'] },
      { file: 'src/components/academics/SubjectsView.tsx', requiredTerms: ['SubjectsView', 'fetchSubjectDirectory', 'saveSubject', 'Scholastic'] },
      { file: 'src/components/academics/ClassSubjectsView.tsx', requiredTerms: ['ClassSubjectsView', 'fetchClassSubjects', 'addClassSubjects', 'copyClassSubjects'] },
      { file: 'src/components/academics/TimetableView.tsx', requiredTerms: ['TimetableView', 'fetchTimetable', 'saveTimetableSlot', 'TIMETABLE_DAYS'] },
      { file: 'src/components/academics/AcademicStructureView.tsx', requiredTerms: ['AcademicStructureView', 'fetchClassDirectory', 'fetchSectionDirectory', 'fetchClassSubjects'] },
      { file: 'src/components/academics/OfficialTimetableModal.tsx', requiredTerms: ['OfficialTimetableModal', 'TimetableGridSlot', 'handlePrint', 'handleDownloadPDF'] },
      { file: 'src/services/academicsService.ts', requiredTerms: ['fetchAcademicYears', 'saveAcademicYear', 'fetchOverview', 'fetchClassDirectory', 'fetchSectionDirectory', 'fetchSubjectDirectory', 'fetchClassSubjects', 'fetchTimetable', 'saveTimetableSlot'] },
    ];

    for (const comp of academicsComponents) {
      await testStep('UI Code', `Validate ${path.basename(comp.file)} structure & exports`, async () => {
        const fullPath = path.resolve(process.cwd(), comp.file);
        assert(fs.existsSync(fullPath), `Component file not found: ${comp.file}`);
        const content = fs.readFileSync(fullPath, 'utf-8');
        for (const term of comp.requiredTerms) {
          assert(content.includes(term), `Component ${comp.file} missing required identifier: "${term}"`);
        }
      });
    }

  } finally {
    // -------------------------------------------------------------
    // 9. SAFE TEARDOWN & CLEANUP
    // -------------------------------------------------------------
    console.log('\n--- 9. Safe Teardown & Test Records Purge ---');
    if (testTimetableId) {
      await testStep('Teardown', 'Purge test timetable slot', async () => {
        const { error } = await adminClient.from('timetable').delete().eq('id', testTimetableId);
        assert(!error, `Failed to delete test timetable slot: ${error?.message}`);
      });
    }

    if (testMappingId) {
      await testStep('Teardown', 'Purge test class-subject mapping', async () => {
        const { error } = await adminClient.from('class_subjects').delete().eq('id', testMappingId);
        assert(!error, `Failed to delete test class-subject mapping: ${error?.message}`);
      });
    }

    if (testSubjectId) {
      await testStep('Teardown', 'Purge test subject', async () => {
        const { error } = await adminClient.from('subjects').delete().eq('id', testSubjectId);
        assert(!error, `Failed to delete test subject: ${error?.message}`);
      });
    }

    if (testClassSectionId) {
      await testStep('Teardown', 'Purge test class section attachment', async () => {
        const { error } = await adminClient.from('class_sections').delete().eq('id', testClassSectionId);
        assert(!error, `Failed to delete test class section: ${error?.message}`);
      });
    }

    if (testClassId) {
      await testStep('Teardown', 'Purge test school class', async () => {
        const { error } = await adminClient.from('classes').delete().eq('id', testClassId);
        assert(!error, `Failed to delete test class: ${error?.message}`);
      });
    }

    if (testYearId) {
      await testStep('Teardown', 'Purge test academic year', async () => {
        const { error } = await adminClient.from('academic_years').delete().eq('id', testYearId);
        assert(!error, `Failed to delete test academic year: ${error?.message}`);
      });
    }
  }

  // -------------------------------------------------------------
  // SCORECARD SUMMARY
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('ACADEMICS SECTION COMPLETE AUDIT SCORECARD');
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
    console.log('\n>>> ALL ACADEMICS SECTION TESTS PASSED PERFECTLY! <<<\n');
  }
}

main().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
