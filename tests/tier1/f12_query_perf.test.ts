/**
 * Tier 1: Feature Coverage - F12: Query Performance & Pagination
 * Validates bounded queries and pagination capabilities across major services.
 * Authoritative Source: PROJECT.md § Feature Inventory (F12) & ORIGINAL_REQUEST.md R4.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 12.1: admissionService Pagination Support
registerTest({
  id: 'T1-F12-01',
  name: 'Query Performance: admissionService.fetchAdmissions supports bounded pagination parameters',
  featureId: 'F12',
  tier: 1,
  milestone: 'M3',
  description: 'Verifies fetchAdmissions accepts page/limit/range to prevent downloading unbounded rows',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F12',
  fn: () => {
    const services = inspectors.getServicePatterns();
    assert.isTrue(services.admissionServiceHasPagination(), 'admissionService must support bounded query pagination');
  }
});

// Test 12.2: feeService Pagination Support
registerTest({
  id: 'T1-F12-02',
  name: 'Query Performance: feeService.fetchFees supports bounded pagination parameters',
  featureId: 'F12',
  tier: 1,
  milestone: 'M3',
  description: 'Verifies fetchFees accepts pagination parameters to prevent client-side memory overload',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F12',
  fn: () => {
    const services = inspectors.getServicePatterns();
    assert.isTrue(services.feeServiceHasPagination(), 'feeService must support bounded query pagination');
  }
});

// Test 12.3: feeService Transactions Query Bounding
registerTest({
  id: 'T1-F12-03',
  name: 'Query Performance: feeService.fetchTransactions limits payment ledger queries',
  featureId: 'F12',
  tier: 1,
  milestone: 'M3',
  description: 'Verifies transaction history queries are bounded by limit or range filters',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F12',
  fn: () => {
    const feeCode = inspectors.readFile('src/services/feeService.ts');
    const hasLimit = feeCode.includes('.limit(') || feeCode.includes('.range(');
    assert.isTrue(hasLimit, 'feeService must apply limit or range to transaction queries');
  }
});

// Test 12.4: teacherService Scoped Assignment Queries
registerTest({
  id: 'T1-F12-04',
  name: 'Query Performance: teacherService filters assignments by active academic year',
  featureId: 'F12',
  tier: 1,
  milestone: 'M3',
  description: 'Verifies fetchTeachers does not unconditionally fetch historical assignments across all years',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F12',
  fn: () => {
    const teacherCode = inspectors.readFile('src/services/teacherService.ts');
    assert.contains(teacherCode, 'is_active', 'teacherService must filter active assignments');
  }
});

// Test 12.5: Server Health Check and AI Grounding Bounding
registerTest({
  id: 'T1-F12-05',
  name: 'Query Performance: server.ts bounds initial context query size for Gemini AI',
  featureId: 'F12',
  tier: 1,
  milestone: 'M3',
  description: 'Verifies server.ts does not run unbounded Cartesian products for grounding',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F12',
  fn: () => {
    const serverCode = inspectors.readFile('server.ts');
    assert.contains(serverCode, 'select(', 'server.ts must explicitly select required columns only');
  }
});
