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
  description: 'Verifies the grounding queries do not run select(*) across students/admissions. This logic lives in src/server/aiTools.ts (server.ts is now a thin route). Admissions grounding there uses select(\'id\', { count: \'exact\' }) — a head-count query that fetches even less than a fixed column list — so that is checked as the (stricter) equivalent instead of the exact legacy string.',
  expectedOutputSource: 'src/server/aiTools.ts',
  fn: () => {
    const services = inspectors.getServicePatterns();
    assert.contains(services.aiToolsCode(), "select('id, name, class, section, roll_number')", 'aiTools.ts must project specific student columns');
    assert.contains(services.aiToolsCode(), "{ count: 'exact' }", 'aiTools.ts must use a bounded head-count query for admissions totals');
  }
});

// Test 3.2: AI Grounding Fee Calculation Resilience
registerTest({
  id: 'T3-F9-F12-02',
  name: 'Pairwise (F9+F12): AI server calculates fee collection ratios without division by zero',
  featureId: 'F9',
  tier: 3,
  milestone: 'M2',
  description: 'Verifies the fee-collection-ratio calculation handles zero billed records without NaN or a crash. Relocated to src/server/aiTools.ts, which guards the division with a `> 0 ? ... : fallback` ternary rather than the legacy `fees?.length || 0` idiom — checked for that guard instead.',
  expectedOutputSource: 'src/server/aiTools.ts collectionEfficiency calculation',
  fn: () => {
    const services = inspectors.getServicePatterns();
    assert.contains(services.aiToolsCode(), 'totalBilled > 0 ?', 'aiTools.ts must guard the fee collection ratio against division by zero');
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
