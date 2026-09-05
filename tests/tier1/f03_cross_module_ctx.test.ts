/**
 * Tier 1: Feature Coverage - F3: Cross-Module Context & ID Preservation
 * Validates that cross-module navigations preserve IDs and pass proper state contracts.
 * Authoritative Source: PROJECT.md § Feature Inventory (F3) & § Interface Contracts.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 3.1: Student 360 -> Fees Context Contract
registerTest({
  id: 'T1-F3-01',
  name: 'Context Preservation: Student 360 passes student context when navigating to Fees',
  featureId: 'F3',
  tier: 1,
  milestone: 'M1',
  description: 'Verifies Student360Drawer passes selectedStudent or student ID to FeesPortal',
  expectedOutputSource: 'PROJECT.md § Interface Contracts: Routing & Navigation',
  fn: () => {
    const ctx = inspectors.getContextContracts();
    assert.isTrue(ctx.student360PassesFeeContext(), 'Student360Drawer must pass selected student context to FeesPortal');
  }
});

// Test 3.2: Student 360 -> Certificates Context Contract
registerTest({
  id: 'T1-F3-02',
  name: 'Context Preservation: Student 360 passes student details to CertificateGenerator',
  featureId: 'F3',
  tier: 1,
  milestone: 'M1',
  description: 'Verifies Student360Drawer passes name, admission_number, class, roll_number to Certificates',
  expectedOutputSource: 'PROJECT.md § Interface Contracts: Routing & Navigation',
  fn: () => {
    const ctx = inspectors.getContextContracts();
    assert.isTrue(ctx.student360PassesCertContext(), 'Student360Drawer must pass student payload to CertificateGenerator');
  }
});

// Test 3.3: Analytics Stat Card Target for Teachers
registerTest({
  id: 'T1-F3-03',
  name: 'Context Routing: Analytics "Total Teachers" navigates to /dashboard/teachers',
  featureId: 'F3',
  tier: 1,
  milestone: 'M1',
  description: 'Verifies Total Teachers card does not route to staff/employees but to /dashboard/teachers',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F3',
  fn: () => {
    const ctx = inspectors.getContextContracts();
    const target = ctx.analyticsTotalTeachersTarget();
    assert.strictEqual(target, '/dashboard/teachers', 'Total Teachers card must route to /dashboard/teachers');
  }
});

// Test 3.4: Admissions Status Filter Context Receiver
registerTest({
  id: 'T1-F3-04',
  name: 'Context Receiver: AdmissionsManagement reads statusFilter from router state',
  featureId: 'F3',
  tier: 1,
  milestone: 'M1',
  description: 'Verifies AdmissionsManagement consumes location.state.statusFilter to filter pending applications',
  expectedOutputSource: 'PROJECT.md § Interface Contracts: Routing & Navigation',
  fn: () => {
    const ctx = inspectors.getContextContracts();
    assert.isTrue(ctx.admissionsReadsStatusFilter(), 'AdmissionsManagement must read location.state.statusFilter');
  }
});

// Test 3.5: CertificateGenerator Student Details Receiver
registerTest({
  id: 'T1-F3-05',
  name: 'Context Receiver: CertificateGenerator populates student details from router state',
  featureId: 'F3',
  tier: 1,
  milestone: 'M1',
  description: 'Verifies CertificateGenerator consumes location.state.student to populate form fields',
  expectedOutputSource: 'PROJECT.md § Interface Contracts: Routing & Navigation',
  fn: () => {
    const ctx = inspectors.getContextContracts();
    assert.isTrue(ctx.certificatesReadsStudentState(), 'CertificateGenerator must read location.state.student');
  }
});
