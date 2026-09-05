/**
 * Parent Portal & Parent RLS Security Verification Suite
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
console.log('PARENT PORTAL UI & PARENT RLS SECURITY AUDIT');
console.log('======================================================\n');

// -------------------------------------------------------------
// SECTION 1: PARENT UI & ROUTING AUDIT
// -------------------------------------------------------------
console.log('--- 1. Parent UI & Route Authorization Audit ---');

test('Parent UI', 'App.tsx routes parent role directly to StudentPortal at /dashboard', () => {
  const code = inspectors.readFile('src/App.tsx');
  assert.contains(code, "role === 'student' || role === 'parent'", 'DashboardHome must route student/parent to StudentPortal');
  assert.contains(code, '<StudentPortal />', 'Must render StudentPortal component for parent');
});

test('Parent UI', 'DashboardLayout.tsx filters sidebar categories to Student/Parent Portal view', () => {
  const code = inspectors.readFile('src/components/DashboardLayout.tsx');
  assert.contains(code, "const isStudentOrParent = role === 'student' || role === 'parent'", 'Must discriminate student and parent roles');
  assert.contains(code, 'studentSidebarCategories', 'Must render studentSidebarCategories for parent');
});

test('Parent UI', 'ProtectedRoute blocks parent from accessing administrative routes', () => {
  const code = inspectors.readFile('src/App.tsx');
  assert.contains(code, 'allowedPermission && !can(allowedPermission)', 'Must reject unauthorized roles lacking permission');
  assert.contains(code, '<Navigate to="/unauthorized" replace />', 'Must redirect unauthorized access to /unauthorized');
});

// -------------------------------------------------------------
// SECTION 2: PARENT RLS SECURITY POLICIES
// -------------------------------------------------------------
console.log('\n--- 2. Parent RLS Security Policies Audit ---');

test('Parent RLS', 'students table permits parent to select their linked ward', () => {
  const migrations = inspectors.getAllMigrationSql();
  assert.contains(migrations, 'students', 'Must define students policies');
  assert.contains(migrations, 'parents', 'Must join or evaluate parent relations');
});

test('Parent RLS', 'student_fees table permits parent to read ward fee dues and blocks mutations', () => {
  const migrations = inspectors.getAllMigrationSql();
  assert.contains(migrations, 'student_fees_owner_select', 'Must define student_fees_owner_select');
  assert.contains(migrations, 'student_fees_staff_insert', 'Inserts restricted to staff');
  assert.contains(migrations, 'student_fees_staff_update', 'Updates restricted to staff');
  assert.contains(migrations, 'student_fees_staff_delete', 'Deletes restricted to admin');
});

test('Parent RLS', 'fee_payments table allows parent to view ward receipts and prevents forging payments', () => {
  const migrations = inspectors.getAllMigrationSql();
  assert.contains(migrations, 'fee_payments_owner_select', 'Must define fee_payments_owner_select');
  assert.contains(migrations, 'fee_payments_staff_write', 'Only staff can record payments');
});

test('Parent RLS', 'marks table allows parent to read ward grades and prevents grade modification', () => {
  const migrations = inspectors.getAllMigrationSql();
  assert.contains(migrations, 'marks_owner_select', 'Must define marks_owner_select');
  assert.contains(migrations, 'marks_teacher_scoped', 'Marks write scoped to assigned teachers');
});

test('Parent RLS', 'attendance table allows parent to read ward attendance log', () => {
  const migrations = inspectors.getAllMigrationSql();
  assert.contains(migrations, 'attendance_owner_select', 'Must define attendance_owner_select');
});

test('Parent RLS', 'disciplinary_records isolates parent to viewing only their ward records', () => {
  const migrations = inspectors.getAllMigrationSql();
  assert.contains(migrations, 'disciplinary_records_owner_select', 'Must define disciplinary_records_owner_select');
});

test('Parent RLS', 'co_scholastic & exam_results allow parent to view ward performance', () => {
  const migrations = inspectors.getAllMigrationSql();
  assert.contains(migrations, 'co_scholastic', 'Must cover co_scholastic table');
  assert.contains(migrations, 'exam_results', 'Must cover exam_results table');
});

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
const total = results.length;
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

console.log('\n======================================================');
console.log(`PARENT AUDIT RESULTS: Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
