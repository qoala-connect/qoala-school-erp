/**
 * Tier 2: Boundary & Corner Cases - F7: Role Lockout & Silent Failure Elimination
 * Tests policy coverage across applicant types, voided records, and administrative role hierarchies.
 * Authoritative Source: PROJECT.md § Database & RLS Contracts & § Interface Contracts.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 7.1: is_admin() Hierarchy Definition
registerTest({
  id: 'T2-F7-01',
  name: 'Role Hierarchy Boundary: is_admin() includes super_admin, admin, and principal',
  featureId: 'F7',
  tier: 2,
  milestone: 'M2',
  description: 'Verifies is_admin() function contract includes all three leadership roles',
  expectedOutputSource: 'PROJECT.md § Database & RLS Contracts',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(migrations, "'super_admin'", 'is_admin() must check super_admin');
    assert.contains(migrations, "'admin'", 'is_admin() must check admin');
    assert.contains(migrations, "'principal'", 'is_admin() must check principal');
  }
});

// Test 7.2: Leave Requests Multi-Applicant Union Policy
registerTest({
  id: 'T2-F7-02',
  name: 'Leave Requests Boundary: leave_requests policy covers students, teachers, and non-teaching staff',
  featureId: 'F7',
  tier: 2,
  milestone: 'M2',
  description: 'Verifies applicant manage policy uses UNION across students, teachers, and staff tables',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F7',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(migrations, 'SELECT id FROM public.students WHERE user_id = auth.uid()');
    assert.contains(migrations, 'SELECT id FROM public.teachers WHERE user_id = auth.uid()');
    assert.contains(migrations, 'SELECT id FROM public.staff WHERE user_id = auth.uid()');
  }
});

// Test 7.3: Fee Payments Owner Verification via Student Fees Join
registerTest({
  id: 'T2-F7-03',
  name: 'Fee Payments Boundary: Owner policy matches student_fee_id to authenticated student or parent',
  featureId: 'F7',
  tier: 2,
  milestone: 'M2',
  description: 'Verifies EXISTS subquery checks student_fee_id relationship to user_id or family_id',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F7',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(migrations, 'sf.id = fee_payments.student_fee_id', 'Must join student_fees to fee_payments');
    assert.contains(migrations, 's.family_id IN', 'Must check parent family relationship');
  }
});

// Test 7.4: Receipt Counters Admin Permissions
registerTest({
  id: 'T2-F7-04',
  name: 'Receipt Counters Boundary: receipt_counters is manageable by all administrators',
  featureId: 'F7',
  tier: 2,
  milestone: 'M2',
  description: 'Verifies receipt_counters policy grants ALL to authenticated users satisfying is_admin()',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F7',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(
      migrations,
      'CREATE POLICY "receipt_counters_admin_all" ON public.receipt_counters',
      'Must create receipt_counters_admin_all policy'
    );
  }
});

// Test 7.5: Elimination of Fragile Text Cast in user_roles
registerTest({
  id: 'T2-F7-05',
  name: 'User Roles Boundary: user_roles policy does not use fragile (get_user_role() = \'admin\'::text)',
  featureId: 'F7',
  tier: 2,
  milestone: 'M2',
  description: 'Verifies user_roles uses is_admin() rather than fragile single-string text match',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F7',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.notContains(
      migrations,
      "USING ((get_user_role() = 'admin'::text))",
      'Must eliminate single-string admin check on user_roles'
    );
  }
});
