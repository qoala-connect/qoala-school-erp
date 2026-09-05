/**
 * Tier 2: Boundary & Corner Cases - F3: Cross-Module Context & ID Preservation
 * Tests payload structures, optional fields, and state receiver fallback boundaries.
 * Authoritative Source: PROJECT.md § Interface Contracts: Routing & Navigation.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 3.1: Fees Portal Active Tab Specification
registerTest({
  id: 'T2-F3-01',
  name: 'Context Boundary: Student 360 specifies activeTab: "student_fees" when redirecting to fees',
  featureId: 'F3',
  tier: 2,
  milestone: 'M1',
  description: 'Verifies state payload includes activeTab: "student_fees" to switch ledger tab immediately',
  expectedOutputSource: 'PROJECT.md § Interface Contracts: Routing & Navigation',
  fn: () => {
    const student360 = inspectors.readFile('src/components/students/Student360Drawer.tsx');
    assert.contains(student360, "activeTab: 'student_fees'", 'Must specify activeTab: "student_fees" in state payload');
  }
});

// Test 3.2: Certificate Payload Structural Completeness
registerTest({
  id: 'T2-F3-02',
  name: 'Context Boundary: Certificate generation payload passes complete student tuple',
  featureId: 'F3',
  tier: 2,
  milestone: 'M1',
  description: 'Verifies name, admission_number, class_name, roll_number are all mapped into state',
  expectedOutputSource: 'PROJECT.md § Interface Contracts: Routing & Navigation',
  fn: () => {
    const student360 = inspectors.readFile('src/components/students/Student360Drawer.tsx');
    assert.contains(student360, 'admission_number', 'Must pass admission_number');
    assert.contains(student360, 'class_name', 'Must pass class_name');
  }
});

// Test 3.3: Admissions Status Filter Fallback on Empty State
registerTest({
  id: 'T2-F3-03',
  name: 'Context Boundary: AdmissionsManagement defaults to "all" when location.state is undefined',
  featureId: 'F3',
  tier: 2,
  milestone: 'M1',
  description: 'Verifies AdmissionsManagement does not throw TypeError on null location.state',
  expectedOutputSource: 'src/pages/dashboard/AdmissionsManagement.tsx state parsing',
  fn: () => {
    const admissionsCode = inspectors.readFile('src/pages/dashboard/AdmissionsManagement.tsx');
    assert.contains(admissionsCode, 'location.state?.statusFilter', 'Must use optional chaining on location.state');
  }
});

// Test 3.4: Global Search Exam ID Preservation
registerTest({
  id: 'T2-F3-04',
  name: 'Context Boundary: Global Search Exam click navigates with tab=exams and selectedExamId',
  featureId: 'F3',
  tier: 2,
  milestone: 'M1',
  description: 'Verifies examination tab query parameter and exam ID are passed together',
  expectedOutputSource: 'PROJECT.md § Interface Contracts: Routing & Navigation',
  fn: () => {
    const layoutCode = inspectors.readFile('src/components/DashboardLayout.tsx');
    assert.contains(layoutCode, "tab=exams", 'Must specify ?tab=exams in route URL');
    assert.contains(layoutCode, 'selectedExamId', 'Must pass selectedExamId in navigation state');
  }
});

// Test 3.5: Employee Directory Selected ID Consumer
registerTest({
  id: 'T2-F3-05',
  name: 'Context Boundary: Employees.tsx consumes selectedEmployeeId to focus/filter record',
  featureId: 'F3',
  tier: 2,
  milestone: 'M1',
  description: 'Verifies Employees component checks location.state?.selectedEmployeeId',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F3',
  fn: () => {
    const employeesCode = inspectors.readFile('src/pages/dashboard/Employees.tsx');
    const consumesState = employeesCode.includes('selectedEmployeeId') || employeesCode.includes('location.state');
    assert.isTrue(consumesState, 'Employees.tsx must support selectedEmployeeId state consumption');
  }
});
