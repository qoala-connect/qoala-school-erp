/**
 * Tier 1: Feature Coverage - F10: Action Button Interactivity & Real Operations
 * Validates removal of fake toast-only saves and replacement with genuine operations.
 * Authoritative Source: PROJECT.md § Feature Inventory (F10) & ORIGINAL_REQUEST.md R2.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 10.1: Reports.tsx Action Interactivity
registerTest({
  id: 'T1-F10-01',
  name: 'Action Interactivity: Reports.tsx buttons execute real download/export handlers',
  featureId: 'F10',
  tier: 1,
  milestone: 'M3',
  description: 'Verifies report download and export buttons are bound to onClick handlers',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F10',
  fn: () => {
    const actions = inspectors.getActionInteractivity();
    assert.isTrue(actions.reportsHasActiveClickHandlers(), 'Reports.tsx must have active onClick handlers on export buttons');
  }
});

// Test 10.2: Transport Allotment Student Foreign Key
registerTest({
  id: 'T1-F10-02',
  name: 'Action Authenticity: TransportManagement includes student_id in student_transport payload',
  featureId: 'F10',
  tier: 1,
  milestone: 'M3',
  description: 'Verifies Transit Allotment form links record to actual student_id foreign key',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F10',
  fn: () => {
    const actions = inspectors.getActionInteractivity();
    assert.isTrue(actions.transportHasStudentId(), 'TransportManagement must populate student_id on insert');
  }
});

// Test 10.3: Medical Management Student Foreign Key
registerTest({
  id: 'T1-F10-03',
  name: 'Action Authenticity: MedicalManagement includes student_id in student_medical payload',
  featureId: 'F10',
  tier: 1,
  milestone: 'M3',
  description: 'Verifies Add Medical Record form links record to actual student_id foreign key',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F10',
  fn: () => {
    const actions = inspectors.getActionInteractivity();
    assert.isTrue(actions.medicalHasStudentId(), 'MedicalManagement must populate student_id on insert');
  }
});

// Test 10.4: SchoolCalendar Holiday Column Query Fix
registerTest({
  id: 'T1-F10-04',
  name: 'Action Authenticity: SchoolCalendar queries valid start_date column on holidays table',
  featureId: 'F10',
  tier: 1,
  milestone: 'M3',
  description: 'Verifies SchoolCalendar does not query non-existent date column',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F10',
  fn: () => {
    const actions = inspectors.getActionInteractivity();
    assert.isTrue(actions.calendarUsesStartDate(), 'SchoolCalendar must query start_date on holidays');
  }
});

// Test 10.5: Elimination of Fake Toast-Only Save in Settings.tsx
registerTest({
  id: 'T1-F10-05',
  name: 'Action Authenticity: Settings.tsx fake toast-only save is eliminated or retired',
  featureId: 'F10',
  tier: 1,
  milestone: 'M3',
  description: 'Verifies dead Settings.tsx mockup is eliminated in favor of canonical SystemManagement',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F10 & § Core Principle',
  fn: () => {
    const actions = inspectors.getActionInteractivity();
    assert.isFalse(actions.settingsHasFakeToastOnly(), 'Must not maintain fake toast-only save without database persistence');
  }
});
