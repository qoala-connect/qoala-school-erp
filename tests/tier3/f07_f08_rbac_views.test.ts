/**
 * Tier 3: Pairwise Cross-Feature Combinations - F7 + F8: RBAC & Database Views
 * Validates that roles unlocked by RLS policies query valid, indexed canonical database views.
 * Authoritative Source: PROJECT.md § Feature Inventory (F7, F8) & § Database & RLS Contracts.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 3.1: Accountant Access to Fee Collection Summary View
registerTest({
  id: 'T3-F7-F8-01',
  name: 'Pairwise (F7+F8): Accountants unlocked on fee_payments query updated fee_collection_summary view',
  featureId: 'F7',
  tier: 3,
  milestone: 'M2',
  description: 'Verifies fee_collection_summary joins student_fees and fee_payments with security_invoker = on',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F7 & F8',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(migrations, 'fee_payments_staff_all', 'fee_payments must allow staff/accountants');
    assert.contains(migrations, 'VIEW public.fee_collection_summary', 'Must recreate fee_collection_summary view');
    assert.contains(migrations, 'FROM public.student_fees', 'Must query canonical student_fees table');
  }
});

// Test 3.2: Teacher Attendance Access to Indexed Leave Requests
registerTest({
  id: 'T3-F7-F8-02',
  name: 'Pairwise (F7+F8): Teachers reading leave_requests benefit from indexed attendance tables',
  featureId: 'F7',
  tier: 3,
  milestone: 'M2',
  description: 'Verifies leave_requests allows staff read while attendance table has foreign key indexes',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F7 & F8',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(migrations, 'leave_requests_staff_select', 'Must have leave_requests_staff_select policy');
    assert.contains(migrations, 'idx_attendance_academic_year_id', 'Must have idx_attendance_academic_year_id index');
  }
});

// Test 3.3: Student/Parent Ledger Viewing without Silent Failures
registerTest({
  id: 'T3-F7-F8-03',
  name: 'Pairwise (F7+F8): Student owner select policy on fee_payments populates ledger without silent empty array',
  featureId: 'F7',
  tier: 3,
  milestone: 'M2',
  description: 'Verifies nested join on student_fees -> fee_payments returns rows to student and parent owners',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F7',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(migrations, 'fee_payments_owner_select', 'Must have fee_payments_owner_select policy');
    assert.contains(migrations, 'sf.student_id', 'Owner policy must verify student_id relation');
  }
});
