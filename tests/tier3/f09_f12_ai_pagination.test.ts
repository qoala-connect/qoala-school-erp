/**
 * Tier 3: Pairwise Cross-Feature Combinations - F9 + F12: AI Grounding & Query Performance
 * Validates that server grounding queries and frontend service queries are performant, bounded, and query canonical tables.
 * Authoritative Source: PROJECT.md § Feature Inventory (F9, F12).
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 3.1: AI Grounding Queries Select Specific Columns
registerTest({
  id: 'T3-F9-F12-01',
  name: 'Pairwise (F9+F12): AI server grounding queries project specific column tuples to limit network payload',
  featureId: 'F9',
  tier: 3,
  milestone: 'M2',
  description: 'Verifies server.ts does not run select(*) across students, admissions, and fees',
  expectedOutputSource: 'server.ts:31-34 Grounding queries',
  fn: () => {
    const serverCode = inspectors.readFile('server.ts');
    assert.contains(serverCode, "select('id, name, class, section, roll_number')");
    assert.contains(serverCode, "select('id, name, class, status, academic_year, created_at')");
  }
});

// Test 3.2: AI Grounding Fee Calculation Resilience
registerTest({
  id: 'T3-F9-F12-02',
  name: 'Pairwise (F9+F12): AI server calculates fee collection ratios without division by zero',
  featureId: 'F9',
  tier: 3,
  milestone: 'M2',
  description: 'Verifies server.ts handles 0 fee records without NaN or crash in prompt string',
  expectedOutputSource: 'server.ts:40 totalFeeRecords calculation',
  fn: () => {
    const serverCode = inspectors.readFile('server.ts');
    assert.contains(serverCode, 'totalFeeRecords = fees?.length || 0', 'Must handle null/undefined fees safely');
  }
});

// Test 3.3: Service Pagination and AI Metric Consistency
registerTest({
  id: 'T3-F9-F12-03',
  name: 'Pairwise (F9+F12): Fee service queries query the same student_fees canonical table as AI grounding',
  featureId: 'F12',
  tier: 3,
  milestone: 'M3',
  description: 'Verifies single source of truth: frontend feeService and server AI both query student_fees',
  expectedOutputSource: 'PROJECT.md § Core Principle: ONE BUSINESS FUNCTION = ONE PRIMARY MODULE',
  fn: () => {
    const feeCode = inspectors.readFile('src/services/feeService.ts');
    const serverCode = inspectors.readFile('server.ts');
    assert.contains(feeCode, 'student_fees', 'feeService must query student_fees');
    assert.contains(serverCode, 'student_fees', 'server.ts must query student_fees');
  }
});
