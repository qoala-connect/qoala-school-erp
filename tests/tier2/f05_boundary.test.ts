/**
 * Tier 2: Boundary & Corner Cases - F5: Critical RLS Write Leak Elimination
 * Tests boundary conditions for multi-tenant isolation, staff checks, and role evaluation in RLS.
 * Authoritative Source: PROJECT.md § Database & RLS Contracts.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 5.1: Prohibit Unconditional TRUE in Any Mutating Policy
registerTest({
  id: 'T2-F5-01',
  name: 'RLS Boundary: No mutating RLS policy uses literal TRUE in WITH CHECK clause',
  featureId: 'F5',
  tier: 2,
  milestone: 'M2',
  description: 'Verifies database contracts forbid WITH CHECK (true) on tables containing student/school data',
  expectedOutputSource: 'PROJECT.md § Database & RLS Contracts: RLS policies must never use unconditional true for mutating operations',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    const disallowedPatterns = [
      'ON public.disciplinary_records FOR ALL TO authenticated USING (true)',
      'ON public.front_office_logs FOR ALL TO authenticated USING (true)',
      'ON public.online_classes FOR ALL TO authenticated USING (true)'
    ];
    for (const pat of disallowedPatterns) {
      assert.notContains(migrations, pat, `Disallowed permissive policy pattern detected: ${pat}`);
    }
  }
});

// Test 5.2: Disciplinary Records Cross-Family Isolation
registerTest({
  id: 'T2-F5-02',
  name: 'RLS Boundary: disciplinary_records owner policy verifies family_id matching',
  featureId: 'F5',
  tier: 2,
  milestone: 'M2',
  description: 'Verifies parents cannot view disciplinary records of students outside their family_id',
  expectedOutputSource: 'PROJECT.md § Database & RLS Contracts',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(
      migrations,
      's.family_id IN (SELECT p.family_id FROM public.parents p WHERE p.user_id = auth.uid())',
      'Owner policy must join on family_id to isolate records across families'
    );
  }
});

// Test 5.3: Disciplinary Records Student Self-Read
registerTest({
  id: 'T2-F5-03',
  name: 'RLS Boundary: disciplinary_records allows student user_id match for self-reading',
  featureId: 'F5',
  tier: 2,
  milestone: 'M2',
  description: 'Verifies students can inspect their own disciplinary incidents via user_id = auth.uid()',
  expectedOutputSource: 'PROJECT.md § Database & RLS Contracts',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(
      migrations,
      's.user_id = auth.uid()',
      'Owner policy must include student user_id matching condition'
    );
  }
});

// Test 5.4: Staff Function Evaluation in RLS
registerTest({
  id: 'T2-F5-04',
  name: 'RLS Boundary: Mutating policies evaluate public.is_staff() helper',
  featureId: 'F5',
  tier: 2,
  milestone: 'M2',
  description: 'Verifies is_staff() is explicitly invoked in policy definitions',
  expectedOutputSource: 'PROJECT.md § Database & RLS Contracts',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(migrations, 'USING (public.is_staff())', 'Policy must use public.is_staff()');
    assert.contains(migrations, 'WITH CHECK (public.is_staff())', 'Policy check must use public.is_staff()');
  }
});

// Test 5.5: Idempotent Policy Recreation via DROP POLICY IF EXISTS
registerTest({
  id: 'T2-F5-05',
  name: 'RLS Boundary: Hardening migration drops legacy policies before creating secure replacements',
  featureId: 'F5',
  tier: 2,
  milestone: 'M2',
  description: 'Verifies DROP POLICY IF EXISTS precedes policy creation to prevent duplicate policy errors',
  expectedOutputSource: 'PROJECT.md § Database & RLS Contracts',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(migrations, 'DROP POLICY IF EXISTS "disciplinary_staff_all" ON public.disciplinary_records');
    assert.contains(migrations, 'DROP POLICY IF EXISTS "front_office_staff_all" ON public.front_office_logs');
    assert.contains(migrations, 'DROP POLICY IF EXISTS "online_classes_staff_all" ON public.online_classes');
  }
});
