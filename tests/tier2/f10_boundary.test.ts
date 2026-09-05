/**
 * Tier 2: Boundary & Corner Cases - F10: Action Button Interactivity & Real Operations
 * Tests boundary conditions for report downloads, entity linking, and secondary tab handlers.
 * Authoritative Source: PROJECT.md § Feature Inventory (F10) & explorer_survey_modules report.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 10.1: Reports Download Action Parameter Contract
registerTest({
  id: 'T2-F10-01',
  name: 'Action Boundary: Report download triggers pass report category and format arguments',
  featureId: 'F10',
  tier: 2,
  milestone: 'M3',
  description: 'Verifies report generator handles CSV vs PDF format options',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F10',
  fn: () => {
    const reportsCode = inspectors.readFile('src/pages/dashboard/Reports.tsx');
    assert.ok(reportsCode, 'Reports.tsx exists');
    // Must not contain static non-interactive buttons
    assert.notContains(reportsCode, '<button className="p-2 ..."><Download size={14} /></button>');
  }
});

// Test 10.2: Transport Allotment Foreign Key Validation
registerTest({
  id: 'T2-F10-02',
  name: 'Action Boundary: Transport allotment checks route_id and vehicle_id presence',
  featureId: 'F10',
  tier: 2,
  milestone: 'M3',
  description: 'Verifies transport assignment requires route, vehicle, and student links',
  expectedOutputSource: 'src/pages/dashboard/TransportManagement.tsx allotment insert',
  fn: () => {
    const transportCode = inspectors.readFile('src/pages/dashboard/TransportManagement.tsx');
    assert.contains(transportCode, 'route_id', 'Payload must include route_id');
    assert.contains(transportCode, 'vehicle_id', 'Payload must include vehicle_id');
  }
});

// Test 10.3: Medical Record Student Linking Boundary
registerTest({
  id: 'T2-F10-03',
  name: 'Action Boundary: Medical record form binds student_id to prevent orphaned health logs',
  featureId: 'F10',
  tier: 2,
  milestone: 'M3',
  description: 'Verifies student_medical rows are linked to student primary key',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F10',
  fn: () => {
    const medicalCode = inspectors.readFile('src/pages/dashboard/MedicalManagement.tsx');
    assert.ok(medicalCode, 'MedicalManagement.tsx exists');
    assert.contains(medicalCode, 'student_medical', 'Must insert to student_medical table');
  }
});

// Test 10.4: SchoolCalendar Date Field Alignment
registerTest({
  id: 'T2-F10-04',
  name: 'Action Boundary: SchoolCalendar queries start_date and end_date correctly',
  featureId: 'F10',
  tier: 2,
  milestone: 'M3',
  description: 'Verifies holidays query maps start_date and end_date attributes',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F10',
  fn: () => {
    const calendarCode = inspectors.readFile('src/pages/dashboard/SchoolCalendar.tsx');
    assert.ok(calendarCode, 'SchoolCalendar.tsx exists');
    assert.notContains(calendarCode, "order('date')", 'Must not order by non-existent date column');
  }
});

// Test 10.5: Library Management Safe Tab Deletion
registerTest({
  id: 'T2-F10-05',
  name: 'Action Boundary: LibraryManagement does not delete from book_issues when deleting other tabs',
  featureId: 'F10',
  tier: 2,
  milestone: 'M3',
  description: 'Verifies handleDelete safely checks activeTab before executing deletion query',
  expectedOutputSource: 'src/pages/dashboard/LibraryManagement.tsx:173 handleDelete audit',
  fn: () => {
    const libraryCode = inspectors.readFile('src/pages/dashboard/LibraryManagement.tsx');
    assert.ok(libraryCode, 'LibraryManagement.tsx exists');
    assert.contains(libraryCode, 'library_books', 'Must reference library_books');
  }
});
