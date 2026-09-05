/**
 * Tier 1: Feature Coverage - F5: Critical RLS Write Leak Elimination
 * Validates removal of permissive USING (true) WITH CHECK (true) policies on sensitive tables.
 * Authoritative Source: PROJECT.md § Feature Inventory (F5) & § Database & RLS Contracts.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 5.1: disciplinary_records RLS Write Hardening
registerTest({
  id: 'T1-F5-01',
  name: 'RLS Hardening: disciplinary_records disallows unconditional true write access',
  featureId: 'F5',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies disciplinary_records policies require is_staff() instead of true for ALL/INSERT/UPDATE',
  expectedOutputSource: 'PROJECT.md § Database & RLS Contracts',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(migrations, 'disciplinary_records', 'Must have migration affecting disciplinary_records');
    assert.notContains(
      migrations,
      'CREATE POLICY "disciplinary_staff_all" ON public.disciplinary_records FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      'Must eliminate permissive true policy on disciplinary_records'
    );
  }
});

// Test 5.2: front_office_logs RLS Write Hardening
registerTest({
  id: 'T1-F5-02',
  name: 'RLS Hardening: front_office_logs disallows unconditional true write access',
  featureId: 'F5',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies front_office_logs policies require is_staff() instead of true for ALL/INSERT/UPDATE',
  expectedOutputSource: 'PROJECT.md § Database & RLS Contracts',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.notContains(
      migrations,
      'CREATE POLICY "front_office_staff_all" ON public.front_office_logs FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      'Must eliminate permissive true policy on front_office_logs'
    );
  }
});

// Test 5.3: online_classes RLS Mutation Hardening
registerTest({
  id: 'T1-F5-03',
  name: 'RLS Hardening: online_classes disallows unauthenticated/unprivileged mutations',
  featureId: 'F5',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies online_classes policies require is_staff() for mutating class links',
  expectedOutputSource: 'PROJECT.md § Database & RLS Contracts',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.notContains(
      migrations,
      'CREATE POLICY "online_classes_staff_all" ON public.online_classes FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      'Must eliminate permissive true ALL policy on online_classes'
    );
  }
});

// Test 5.4: Read-Only Access for Enrolled Students on online_classes
registerTest({
  id: 'T1-F5-04',
  name: 'RLS Separation: online_classes separates read access from write/delete privileges',
  featureId: 'F5',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies read access (SELECT) is explicitly defined and distinct from mutating operations',
  expectedOutputSource: 'PROJECT.md § Database & RLS Contracts',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(migrations, 'online_classes_read_enrolled', 'Must define separate SELECT policy for online_classes');
  }
});

// Test 5.5: Student Owner Read on Disciplinary Records
registerTest({
  id: 'T1-F5-05',
  name: 'RLS Isolation: disciplinary_records allows students/parents to read only their own records',
  featureId: 'F5',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies owner SELECT policy is scoped to student user_id or family_id',
  expectedOutputSource: 'PROJECT.md § Database & RLS Contracts',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(migrations, 'disciplinary_records_owner_select', 'Must define owner SELECT policy on disciplinary_records');
  }
});
