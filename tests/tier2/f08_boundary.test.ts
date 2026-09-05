/**
 * Tier 2: Boundary & Corner Cases - F8: Database Indexing & Relational Hardening
 * Tests foreign key coverage across secondary modules, view void filtering, and security invoker settings.
 * Authoritative Source: PROJECT.md § Feature Inventory (F8) & explorer_survey_db report.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 8.1: Timetable & Teacher Assignment FK Indexing
registerTest({
  id: 'T2-F8-01',
  name: 'FK Indexing Boundary: Timetable and Teacher Assignment foreign keys have B-tree indexes',
  featureId: 'F8',
  tier: 2,
  milestone: 'M2',
  description: 'Verifies timetable(class_id, section_id) and teacher_assignments(class_id, section_id, subject_id) are indexed',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F8',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(migrations, 'idx_timetable_class_id');
    assert.contains(migrations, 'idx_timetable_section_id');
    assert.contains(migrations, 'idx_teacher_assignments_class_id');
    assert.contains(migrations, 'idx_teacher_assignments_section_id');
    assert.contains(migrations, 'idx_teacher_assignments_subject_id');
  }
});

// Test 8.2: Transport and Fleet FK Indexing
registerTest({
  id: 'T2-F8-02',
  name: 'FK Indexing Boundary: Student transport route_id and vehicle_id are indexed',
  featureId: 'F8',
  tier: 2,
  milestone: 'M2',
  description: 'Verifies student_transport foreign keys are indexed for logistics reporting',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F8',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(migrations, 'idx_student_transport_route_id');
    assert.contains(migrations, 'idx_student_transport_vehicle_id');
  }
});

// Test 8.3: fee_collection_summary Voided Payment Filtering
registerTest({
  id: 'T2-F8-03',
  name: 'View Boundary: fee_collection_summary filters out voided payments (voided_at IS NULL)',
  featureId: 'F8',
  tier: 2,
  milestone: 'M2',
  description: 'Verifies collected revenue excludes voided payments from ledger totals',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F8',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(
      migrations,
      'fp.voided_at IS NULL',
      'fee_collection_summary must filter fp.voided_at IS NULL'
    );
  }
});

// Test 8.4: pending_fees_summary_view Days Overdue Calculation
registerTest({
  id: 'T2-F8-04',
  name: 'View Boundary: pending_fees_summary_view calculates days_overdue accurately',
  featureId: 'F8',
  tier: 2,
  milestone: 'M2',
  description: 'Verifies (CURRENT_DATE - sf.due_date) calculation for pending and partial invoices',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F8',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(
      migrations,
      '(CURRENT_DATE - sf.due_date) AS days_overdue',
      'Must compute days_overdue using (CURRENT_DATE - sf.due_date)'
    );
  }
});

// Test 8.5: Views Configured with security_invoker = on
registerTest({
  id: 'T2-F8-05',
  name: 'View Security Boundary: Views enforce security_invoker = on to inherit caller RLS',
  featureId: 'F8',
  tier: 2,
  milestone: 'M2',
  description: 'Verifies view definitions include WITH (security_invoker = on)',
  expectedOutputSource: 'PROJECT.md § Architecture: 24 views (security_invoker = on)',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(migrations, 'WITH (security_invoker = on)', 'Views must specify WITH (security_invoker = on)');
  }
});
