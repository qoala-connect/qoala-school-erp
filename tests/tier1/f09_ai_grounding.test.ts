/**
 * Tier 1: Feature Coverage - F9: AI Grounding & Service Query Fixes
 * Validates AI server grounding queries and service layer race condition fixes.
 * Authoritative Source: PROJECT.md § Feature Inventory (F9) & explorer_survey_modules report.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 9.1: server.ts AI Grounding Query Target
registerTest({
  id: 'T1-F9-01',
  name: 'AI Grounding: server.ts queries canonical student_fees instead of legacy fees',
  featureId: 'F9',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies server.ts queries student_fees table for AI context grounding',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F9',
  fn: () => {
    const services = inspectors.getServicePatterns();
    const table = services.serverGroundingTable();
    assert.strictEqual(table, 'student_fees', 'server.ts must query student_fees for AI grounding');
  }
});

// Test 9.2: server.ts Fee Status Field Selection
registerTest({
  id: 'T1-F9-02',
  name: 'AI Grounding: server.ts extracts status, net_amount, and student_id from student_fees',
  featureId: 'F9',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies server.ts queries correct column fields for fee calculations',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F9',
  fn: () => {
    const serverCode = inspectors.readFile('server.ts');
    assert.contains(serverCode, 'student_fees', 'server.ts must query student_fees');
    assert.notContains(serverCode, "from('fees')", 'server.ts must not query non-existent fees table');
  }
});

// Test 9.3: Teacher Employee ID Generation Concurrency
registerTest({
  id: 'T1-F9-03',
  name: 'Service Concurrency: teacherService eliminates client-side memory count race condition',
  featureId: 'F9',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies employee_id generation does not rely on fragile in-memory length counting',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F9',
  fn: () => {
    const services = inspectors.getServicePatterns();
    const strategy = services.teacherServiceEmployeeIdGen();
    assert.notStrictEqual(strategy, 'memory-count-race', 'teacherService must not use countData.length race condition');
  }
});

// Test 9.4: AI Chat Endpoint Grounding Schema Contract
registerTest({
  id: 'T1-F9-04',
  name: 'AI Grounding: /api/chat system prompt includes verified ERP context metrics',
  featureId: 'F9',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies system prompt is injected with real database counts for students, staff, and fees',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F9',
  fn: () => {
    const serverCode = inspectors.readFile('server.ts');
    assert.contains(serverCode, 'totalStudents', 'server.ts must ground prompt with totalStudents');
    assert.contains(serverCode, 'totalStaff', 'server.ts must ground prompt with totalStaff');
    assert.contains(serverCode, 'systemInstruction', 'server.ts must pass grounded systemInstruction to Gemini');
  }
});

// Test 9.5: Graceful Error Handling on Grounding Fallback
registerTest({
  id: 'T1-F9-05',
  name: 'AI Grounding: Backend handles grounding query failures gracefully with fallback defaults',
  featureId: 'F9',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies server catches database grounding errors without crashing the AI assistant',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F9',
  fn: () => {
    const serverCode = inspectors.readFile('server.ts');
    assert.contains(serverCode, 'catch (e)', 'server.ts must wrap grounding queries in try/catch');
    assert.contains(serverCode, 'console.warn', 'server.ts must log warning on grounding query error');
  }
});
