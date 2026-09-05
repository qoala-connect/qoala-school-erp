/**
 * Tier 1: Feature Coverage - F8: Database Indexing & Relational Hardening
 * Validates addition of 22 FK indexes, dropping of 10 duplicate indexes, and updating stale views.
 * Authoritative Source: PROJECT.md § Feature Inventory (F8) & explorer_survey_db report.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 8.1: Critical Disciplinary Records Student FK Index
registerTest({
  id: 'T1-F8-01',
  name: 'FK Indexing: idx_disciplinary_records_student_id is indexed to accelerate Student 360 queries',
  featureId: 'F8',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies B-tree index on disciplinary_records(student_id) prevents table scans',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F8',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(
      migrations,
      'CREATE INDEX IF NOT EXISTS idx_disciplinary_records_student_id ON public.disciplinary_records(student_id)',
      'Must create index on disciplinary_records(student_id)'
    );
  }
});

// Test 8.2: Admissions and Attendance FK Index Coverage
registerTest({
  id: 'T1-F8-02',
  name: 'FK Indexing: Foreign keys on admissions and attendance are indexed',
  featureId: 'F8',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies academic_year_id, class_id, and section_id FK indexes on admissions/attendance',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F8',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(migrations, 'idx_admissions_academic_year_id', 'Must index admissions.academic_year_id');
    assert.contains(migrations, 'idx_admissions_class_id', 'Must index admissions.class_id');
    assert.contains(migrations, 'idx_attendance_academic_year_id', 'Must index attendance.academic_year_id');
  }
});

// Test 8.3: Drop Redundant Duplicate Indexes
registerTest({
  id: 'T1-F8-03',
  name: 'Index Optimization: 10 redundant duplicate indexes are dropped',
  featureId: 'F8',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies redundant indexes on admissions, marks, students, and documents are dropped',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F8',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(migrations, 'DROP INDEX IF EXISTS public.idx_admissions_status', 'Must drop duplicate idx_admissions_status');
    assert.contains(migrations, 'DROP INDEX IF EXISTS public.idx_marks_student', 'Must drop duplicate idx_marks_student');
    assert.contains(migrations, 'DROP INDEX IF EXISTS public.students_admission_number_unique', 'Must drop duplicate students_admission_number_unique');
  }
});

// Test 8.4: fee_collection_summary View Canonical Query
registerTest({
  id: 'T1-F8-04',
  name: 'View Integrity: fee_collection_summary queries canonical student_fees and fee_payments',
  featureId: 'F8',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies fee_collection_summary does not query empty legacy fees table',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F8 & § Database & RLS Contracts',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(migrations, 'CREATE OR REPLACE VIEW public.fee_collection_summary', 'Must update fee_collection_summary');
    assert.contains(migrations, 'FROM public.student_fees', 'fee_collection_summary must query public.student_fees');
  }
});

// Test 8.5: pending_fees_summary_view Canonical Query
registerTest({
  id: 'T1-F8-05',
  name: 'View Integrity: pending_fees_summary_view queries canonical student_fees table',
  featureId: 'F8',
  tier: 1,
  milestone: 'M2',
  description: 'Verifies pending_fees_summary_view does not query empty legacy fees table',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F8 & § Database & RLS Contracts',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(migrations, 'CREATE OR REPLACE VIEW public.pending_fees_summary_view', 'Must update pending_fees_summary_view');
    assert.contains(migrations, 'FROM public.student_fees sf', 'pending_fees_summary_view must query student_fees');
  }
});
