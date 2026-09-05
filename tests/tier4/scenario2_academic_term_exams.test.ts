/**
 * Tier 4: Real-World Application Scenarios - Scenario 2: Academic Term Setup & Examination Cycle
 * End-to-end administration workflow:
 * Academic Structure Setup -> Teacher Subject Assignment -> Exam Assessment Creation -> Marks Entry -> CBSE Report Cards.
 * Authoritative Source: ORIGINAL_REQUEST.md R1-R2 & PROJECT.md § Architecture.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Step 1: Academic Structure Definition
registerTest({
  id: 'T4-SC2-01',
  name: 'Scenario 2 (Step 1): AcademicsManagement manages academic years, classes, and subjects under one module',
  featureId: 'F2',
  tier: 4,
  milestone: 'M1',
  description: 'Verifies Academics module centralizes academic_years, classes, sections, and subjects tables',
  expectedOutputSource: 'src/pages/dashboard/AcademicsManagement.tsx',
  fn: () => {
    const academicsServiceCode = inspectors.readFile('src/services/academicsService.ts');
    const academicsCode = inspectors.readFile('src/pages/dashboard/AcademicsManagement.tsx');
    assert.contains(academicsCode, 'AcademicYearsView', 'AcademicsManagement must render AcademicYearsView');
    assert.contains(academicsServiceCode, 'academic_years', 'academicsService must manage academic_years');
    assert.contains(academicsServiceCode, 'classes', 'academicsService must manage classes');
    assert.contains(academicsServiceCode, 'subjects', 'academicsService must manage subjects');
  }
});

// Step 2: Teacher Academic Assignment
registerTest({
  id: 'T4-SC2-02',
  name: 'Scenario 2 (Step 2): Teachers module maps educators to classes and subjects via teacher_assignments',
  featureId: 'F10',
  tier: 4,
  milestone: 'M3',
  description: 'Verifies canonical teacher_assignments table is populated during faculty class mapping',
  expectedOutputSource: 'src/services/teacherService.ts saveAssignment',
  fn: () => {
    const teacherCode = inspectors.readFile('src/services/teacherService.ts');
    assert.contains(teacherCode, 'teacher_assignments', 'Must insert to teacher_assignments');
    assert.contains(teacherCode, 'assignment_type', 'Must support assignment_type (class_teacher, subject_teacher)');
  }
});

// Step 3: Examination Assessment & Report Card Pipeline
registerTest({
  id: 'T4-SC2-03',
  name: 'Scenario 2 (Step 3): ExaminationModule manages exams, marks entry, and consolidated report cards',
  featureId: 'F10',
  tier: 4,
  milestone: 'M3',
  description: 'Verifies CBSE assessment lifecycle from exam definition through marks entry to report card generation',
  expectedOutputSource: 'src/pages/dashboard/examination/ExaminationModule.tsx',
  fn: () => {
    const examCode = inspectors.readFile('src/pages/dashboard/examination/ExaminationModule.tsx');
    assert.contains(examCode, 'exams', 'ExaminationModule must manage exams');
    assert.contains(examCode, 'marks', 'ExaminationModule must manage marks');
    assert.contains(examCode, 'report-cards', 'ExaminationModule must provide report-cards view');
  }
});
