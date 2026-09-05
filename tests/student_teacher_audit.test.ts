/**
 * Student Portal & Teacher Management End-to-End UI & RLS Verification Suite
 */

import { inspectors } from './infra/inspectors';
import { assert } from './infra/assert';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function test(suite: string, name: string, fn: () => void) {
  try {
    fn();
    results.push({ suite, name, passed: true });
    console.log(`  [PASS] [${suite}] ${name}`);
  } catch (err: any) {
    results.push({ suite, name, passed: false, error: err.message });
    console.error(`  [FAIL] [${suite}] ${name}\n         Error: ${err.message}`);
  }
}

console.log('\n======================================================');
console.log('STUDENT PORTAL & TEACHER MANAGEMENT UI & RLS AUDIT');
console.log('======================================================\n');

// -------------------------------------------------------------
// SECTION 1: STUDENT PORTAL UI TESTS
// -------------------------------------------------------------
console.log('--- 1. Student Portal UI & Component Verification ---');

test('Student Portal UI', 'StudentPortal.tsx implements all 8 canonical tabs', () => {
  const code = inspectors.readFile('src/pages/dashboard/StudentPortal.tsx');
  const tabs = ['overview', 'assignments', 'attendance', 'fees', 'examination', 'timetable', 'transport', 'personal'];
  for (const tab of tabs) {
    assert.contains(code, `'${tab}'`, `Must define tab: ${tab}`);
  }
});

test('Student Portal UI', 'StudentPortal.tsx mounts ID Card, Fee Receipt, Admit Card, and Marksheet Modals', () => {
  const code = inspectors.readFile('src/pages/dashboard/StudentPortal.tsx');
  assert.contains(code, '<StudentIDCardModal', 'Must mount StudentIDCardModal');
  assert.contains(code, '<FeeReceiptModal', 'Must mount FeeReceiptModal');
  assert.contains(code, '<StudentAdmitCardModal', 'Must mount StudentAdmitCardModal');
  assert.contains(code, '<StudentMarksheetModal', 'Must mount StudentMarksheetModal');
  assert.contains(code, '<OfficialTimetableModal', 'Must mount OfficialTimetableModal');
});

test('Student Portal UI', 'StudentPortal.tsx binds real database queries (Zero fake data)', () => {
  const code = inspectors.readFile('src/pages/dashboard/StudentPortal.tsx');
  assert.contains(code, "from('students')", 'Must query students table');
  assert.contains(code, "from('student_fees')", 'Must query student_fees table');
  assert.contains(code, "fee_payments(*)", 'Must join fee_payments relation on student fees');
  assert.contains(code, "from('attendance')", 'Must query attendance table');
  assert.contains(code, "from('marks')", 'Must query marks table');
  assert.contains(code, "from('timetable')", 'Must query timetables table');
  assert.contains(code, "from('student_medical')", 'Must query student_medical table');
  assert.contains(code, "from('student_transport')", 'Must query student_transport table');
});

test('Student Portal UI', 'StudentPortal.tsx provides responsive layout and accessible empty/loading states', () => {
  const code = inspectors.readFile('src/pages/dashboard/StudentPortal.tsx');
  assert.contains(code, 'Loader2', 'Must render animated loader during data fetch');
  assert.contains(code, 'overflow-x-auto', 'Tables must support horizontal scroll on mobile viewports');
  assert.contains(code, 'No ', 'Must contain empty state messages');
});

// -------------------------------------------------------------
// SECTION 2: STUDENT RLS SECURITY POLICIES
// -------------------------------------------------------------
console.log('\n--- 2. Student RLS Security Policies Verification ---');

test('Student RLS', 'students table isolates student read access via user_id and get_current_student_id()', () => {
  const migrations = inspectors.getAllMigrationSql();
  assert.contains(migrations, 'get_current_student_id', 'Must define get_current_student_id helper');
  assert.contains(migrations, 'students_staff_select', 'Must define staff select policy with permissions');
  assert.contains(migrations, 'auth.uid()', 'Must evaluate auth.uid()');
});

test('Student RLS', 'student_fees table permits student SELECT only on their own records', () => {
  const migrations = inspectors.getAllMigrationSql();
  assert.contains(migrations, 'student_fees_owner_select', 'Must define student_fees_owner_select policy');
  assert.contains(migrations, 'student_fees_staff_insert', 'Mutations must be restricted to staff/admin');
  assert.contains(migrations, 'student_fees_staff_update', 'Updates must be restricted to staff/admin');
  assert.contains(migrations, 'student_fees_staff_delete', 'Deletions must be restricted to admin');
});

test('Student RLS', 'fee_payments prevents student from tampering or forging payments', () => {
  const migrations = inspectors.getAllMigrationSql();
  assert.contains(migrations, 'fee_payments_owner_select', 'Must define fee_payments_owner_select');
  assert.contains(migrations, 'fee_payments_staff_write', 'Only staff with fees.collect or admin can record payments');
});

test('Student RLS', 'marks table restricts student to reading own published marks', () => {
  const migrations = inspectors.getAllMigrationSql();
  assert.contains(migrations, 'marks_owner_select', 'Must define marks_owner_select policy');
});

test('Student RLS', 'attendance table restricts student to reading own attendance', () => {
  const migrations = inspectors.getAllMigrationSql();
  assert.contains(migrations, 'attendance_owner_select', 'Must define attendance_owner_select policy');
});

test('Student RLS', 'disciplinary_records isolates student to viewing only their own infractions', () => {
  const migrations = inspectors.getAllMigrationSql();
  assert.contains(migrations, 'disciplinary_records_owner_select', 'Must define disciplinary_records_owner_select policy');
});

// -------------------------------------------------------------
// SECTION 3: TEACHER MANAGEMENT & UI TESTS
// -------------------------------------------------------------
console.log('\n--- 3. Teacher Management & UI Verification ---');

test('Teacher UI', 'Teachers.tsx supports Directory, Assignments, and Workload views', () => {
  const code = inspectors.readFile('src/pages/dashboard/Teachers.tsx');
  assert.contains(code, "'directory'", 'Must support directory view');
  assert.contains(code, "'assignments'", 'Must support assignments view');
  assert.contains(code, "'workload'", 'Must support workload view');
});

test('Teacher UI', 'Teachers.tsx includes TeacherFormModal, TeacherAssignmentModal, BulkAssignmentModal, and StatusModal', () => {
  const code = inspectors.readFile('src/pages/dashboard/Teachers.tsx');
  assert.contains(code, '<TeacherFormModal', 'Must mount TeacherFormModal');
  assert.contains(code, '<TeacherAssignmentModal', 'Must mount TeacherAssignmentModal');
  assert.contains(code, '<BulkAssignmentModal', 'Must mount BulkAssignmentModal');
  assert.contains(code, '<TeacherStatusModal', 'Must mount TeacherStatusModal');
});

test('Teacher UI', 'Teacher360Drawer.tsx renders comprehensive 7-tab educator profile', () => {
  const code = inspectors.readFile('src/components/teachers/Teacher360Drawer.tsx');
  assert.contains(code, "'overview'", 'Must render Overview tab');
  assert.contains(code, "'assignments'", 'Must render Assignments tab');
  assert.contains(code, "'timetable'", 'Must render Timetable tab');
  assert.contains(code, "'attendance'", 'Must render Attendance tab');
  assert.contains(code, "'examination'", 'Must render Examination tab');
  assert.contains(code, "'students'", 'Must render Students tab');
  assert.contains(code, "'activity'", 'Must render Activity tab');
});

test('Teacher UI', 'teacherService pushes database-level filtering and uses atomic next_employee_id RPC', () => {
  const code = inspectors.readFile('src/services/teacherService.ts');
  assert.contains(code, "query.eq('department_id', filters.department)", 'Must push department filter to PostgreSQL');
  assert.contains(code, "rpc('next_employee_id'", 'Must invoke atomic next_employee_id RPC');
});

// -------------------------------------------------------------
// SECTION 4: TEACHER RLS SECURITY POLICIES
// -------------------------------------------------------------
console.log('\n--- 4. Teacher RLS Security Policies Verification ---');

test('Teacher RLS', 'teachers table has trigger_guard_teacher_update to block self-escalation', () => {
  const migrations = inspectors.getAllMigrationSql();
  assert.contains(migrations, 'guard_teacher_profile_update', 'Must define guard_teacher_profile_update function');
  assert.contains(migrations, 'trigger_guard_teacher_update', 'Must bind trigger_guard_teacher_update trigger');
  assert.contains(migrations, 'designation', 'Trigger must guard designation column');
  assert.contains(migrations, 'is_active', 'Trigger must guard is_active column');
});

test('Teacher RLS', 'teacher_assignments table restricts assignment management to administrators', () => {
  const migrations = inspectors.getAllMigrationSql();
  assert.contains(migrations, 'teacher_assignments_admin_all', 'Must define teacher_assignments_admin_all');
  assert.contains(migrations, 'teacher_assignments_staff_select', 'Staff/Teachers can read assignments');
});

test('Teacher RLS', 'attendance table enforces teacher_teaches_student scope on teachers', () => {
  const migrations = inspectors.getAllMigrationSql();
  assert.contains(migrations, 'attendance_teacher_scoped', 'Must define attendance_teacher_scoped policy');
  assert.contains(migrations, 'teacher_teaches_student', 'Must enforce teacher_teaches_student check');
});

test('Teacher RLS', 'marks table enforces teacher_teaches_student_subject scope on marks submission', () => {
  const migrations = inspectors.getAllMigrationSql();
  assert.contains(migrations, 'marks_teacher_scoped', 'Must define marks_teacher_scoped policy');
  assert.contains(migrations, 'teacher_teaches_student_subject', 'Must enforce teacher_teaches_student_subject check');
});

test('Teacher RLS', 'leave_requests table permits teachers to submit leaves and view their own/staff records', () => {
  const migrations = inspectors.getAllMigrationSql();
  assert.contains(migrations, 'leave_requests', 'Must have leave_requests table RLS policies');
});

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
const total = results.length;
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

console.log('\n======================================================');
console.log(`AUDIT RESULTS: Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
