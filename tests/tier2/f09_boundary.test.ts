/**
 * Tier 2: Boundary & Corner Cases - F9: AI Grounding & Service Query Fixes
 * Tests edge cases in AI system prompts, empty datasets, and teacher lifecycle transitions.
 * Authoritative Source: PROJECT.md § Feature Inventory (F9) & server.ts.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 9.1: server.ts Null Status Fallback in Admissions Aggregation
registerTest({
  id: 'T2-F9-01',
  name: 'AI Grounding Boundary: server.ts defaults missing status to "Pending" during reduce',
  featureId: 'F9',
  tier: 2,
  milestone: 'M2',
  description: 'Verifies reduce accumulator does not fail when admission status is null or undefined',
  expectedOutputSource: 'server.ts:43 admissionsByStatus reduce fallback',
  fn: () => {
    const serverCode = inspectors.readFile('server.ts');
    assert.contains(
      serverCode,
      "const st = a.status || 'Pending'",
      'server.ts must default missing admission status to Pending'
    );
  }
});

// Test 9.2: server.ts API Key Absence Handling
registerTest({
  id: 'T2-F9-02',
  name: 'AI Service Boundary: server.ts handles missing GEMINI_API_KEY gracefully',
  featureId: 'F9',
  tier: 2,
  milestone: 'M2',
  description: 'Verifies server emits helpful error if GEMINI_API_KEY is missing on chat invoke',
  expectedOutputSource: 'server.ts:80-84 API key check',
  fn: () => {
    const serverCode = inspectors.readFile('server.ts');
    assert.contains(serverCode, 'GEMINI_API_KEY', 'server.ts must verify GEMINI_API_KEY');
    assert.contains(serverCode, 'status(500)', 'server.ts must return 500 error on missing key');
  }
});

// Test 9.3: Teacher Employee ID Format Boundary
registerTest({
  id: 'T2-F9-03',
  name: 'Service Boundary: Teacher employee ID adheres to uppercase alphanumeric prefix',
  featureId: 'F9',
  tier: 2,
  milestone: 'M2',
  description: 'Verifies employee_id follows standard school identifier pattern TCH-XXXX. Generation moved from a client-side in-memory count (a race condition) to the DB-side next_employee_id() sequence function, so the TCH- prefix now lives in the migration SQL rather than teacherService.ts.',
  expectedOutputSource: 'src/services/teacherService.ts + next_employee_id() migration',
  fn: () => {
    const teacherCode = inspectors.readFile('src/services/teacherService.ts');
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(teacherCode, 'next_employee_id', 'teacherService.ts must call the atomic next_employee_id() RPC');
    assert.contains(migrations, 'TCH-', 'next_employee_id() must generate the TCH- prefixed format');
  }
});

// Test 9.4: Teacher Lifecycle Assignment Deactivation Boundary
registerTest({
  id: 'T2-F9-04',
  name: 'Service Boundary: Archiving or resigning a teacher automatically deactivates active assignments',
  featureId: 'F9',
  tier: 2,
  milestone: 'M2',
  description: 'Verifies changeTeacherStatus marks teacher_assignments as inactive when teacher departs',
  expectedOutputSource: 'src/services/teacherService.ts:260-270 changeTeacherStatus',
  fn: () => {
    const teacherCode = inspectors.readFile('src/services/teacherService.ts');
    assert.contains(teacherCode, "newStatus === 'Archived'", 'Must check Archived status');
    assert.contains(teacherCode, "newStatus === 'Resigned'", 'Must check Resigned status');
    assert.contains(teacherCode, "from('teacher_assignments').update({ is_active: false })", 'Must deactivate assignments');
  }
});

// Test 9.5: Express Port and Health Endpoint Boundary
registerTest({
  id: 'T2-F9-05',
  name: 'Server Boundary: server.ts provides an accessible /api/health probe endpoint',
  featureId: 'F9',
  tier: 2,
  milestone: 'M2',
  description: 'Verifies server.ts exports /api/health responding with status: ok',
  expectedOutputSource: 'server.ts:16-18 Health route',
  fn: () => {
    const serverCode = inspectors.readFile('server.ts');
    assert.contains(serverCode, "app.get('/api/health'", 'server.ts must define /api/health endpoint');
    assert.contains(serverCode, "status: 'ok'", 'Health probe must return status: ok');
  }
});
