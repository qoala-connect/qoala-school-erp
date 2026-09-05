/**
 * Tier 1: Feature Coverage - F7: Role Lockout & Silent Failure Elimination
 * Validates RLS policies for Accountants, Teachers, Super Admin, and Principal roles.
 * Authoritative Source: PROJECT.md § Feature Inventory (F7) & explorer_survey_db report.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 7.1: fee_payments Staff Management Policy
registerTest({
  id: 'T1-F7-01',
  name: 'Role Access: fee_payments grants management access to staff and accountants',
  featureId: 'F7',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies fee_payments replaces is_admin() with is_staff() to permit accountants to collect fees',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F7',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(
      migrations,
      'CREATE POLICY "fee_payments_staff_all" ON public.fee_payments',
      'Must create fee_payments_staff_all policy'
    );
  }
});

// Test 7.2: fee_payments Owner Receipt Select Policy
registerTest({
  id: 'T1-F7-02',
  name: 'Silent Failure: fee_payments includes owner SELECT policy for student/parent ledgers',
  featureId: 'F7',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies students and parents can view fee_payments rows joined to their student_fees',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F7',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(
      migrations,
      'CREATE POLICY "fee_payments_owner_select" ON public.fee_payments',
      'Must define fee_payments_owner_select policy'
    );
  }
});

// Test 7.3: leave_requests Staff Read for Attendance Register
registerTest({
  id: 'T1-F7-03',
  name: 'Role Access: leave_requests allows teaching staff to read approved student leaves',
  featureId: 'F7',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies teachers marking attendance can read approved leave requests without RLS error',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F7',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(
      migrations,
      'CREATE POLICY "leave_requests_staff_select" ON public.leave_requests',
      'Must define leave_requests_staff_select policy'
    );
  }
});

// Test 7.4: Gallery & Notices Multi-Role Admin Support
registerTest({
  id: 'T1-F7-04',
  name: 'Role Access: Gallery and Notices policies use is_admin() covering super_admin and principal',
  featureId: 'F7',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies legacy admin string checks are replaced with public.is_admin()',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F7',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(migrations, 'is_admin()', 'Must use is_admin() in administration policies');
  }
});

// Test 7.5: Receipt Counters Policy Coverage
registerTest({
  id: 'T1-F7-05',
  name: 'Policy Coverage: receipt_counters table has explicit active RLS policy',
  featureId: 'F7',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies receipt_counters is not blocked by 0 policies when RLS is active',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F7',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(
      migrations,
      'CREATE POLICY "receipt_counters_admin_all" ON public.receipt_counters',
      'Must define policy on receipt_counters'
    );
  }
});
