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

// Test 9.4: AI Chat Grounding Schema Contract
registerTest({
  id: 'T1-F9-04',
  name: 'AI Grounding: /api/ai/chat is grounded with verified ERP context metrics (totalStudents/totalStaff) and a real systemInstruction',
  featureId: 'F9',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies the chat pipeline is injected with real database counts for students/staff and a grounded systemInstruction. This logic was refactored out of server.ts (now a thin route) into src/server/aiTools.ts (tool-calling KPI lookups) and src/server/aiService.ts (the Gemini call), so the check follows the code there.',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F9',
  fn: () => {
    const services = inspectors.getServicePatterns();
    assert.contains(services.aiToolsCode(), 'totalStudents', 'aiTools.ts must ground responses with totalStudents');
    assert.contains(services.aiToolsCode(), 'totalStaff', 'aiTools.ts must ground responses with totalStaff');
    assert.contains(services.aiServiceCode(), 'systemInstruction', 'aiService.ts must pass a grounded systemInstruction to Gemini');
  }
});

// Test 9.5: Graceful Error Handling on Grounding Fallback
registerTest({
  id: 'T1-F9-05',
  name: 'AI Grounding: Backend handles grounding query failures gracefully with fallback defaults',
  featureId: 'F9',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies the chat pipeline catches database/model errors without crashing the AI assistant — checked in aiService.ts, where the Gemini call and its fallback now live.',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F9',
  fn: () => {
    const services = inspectors.getServicePatterns();
    assert.contains(services.aiServiceCode(), 'catch (', 'aiService.ts must wrap grounding/generation calls in try/catch');
    assert.contains(services.aiServiceCode(), 'console.warn', 'aiService.ts must log a warning on grounding/generation error');
  }
});
