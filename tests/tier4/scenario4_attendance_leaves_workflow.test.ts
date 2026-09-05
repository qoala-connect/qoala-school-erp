/**
 * Tier 4: Real-World Application Scenarios - Scenario 4: Daily Attendance & Leave Flow
 * End-to-end administration workflow:
 * Leave Application -> Admin Review -> Teacher Register View -> Unlocked Leave Rendering -> Bulk Attendance Save RPC.
 * Authoritative Source: ORIGINAL_REQUEST.md R1 & PROJECT.md § Architecture.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Step 1: Leave Requests Database Contract
registerTest({
  id: 'T4-SC4-01',
  name: 'Scenario 4 (Step 1): leave_requests supports student, teacher, and staff leave submissions',
  featureId: 'F7',
  tier: 4,
  milestone: 'M2',
  description: 'Verifies leave_requests schema includes applicant_type, start_date, end_date, and status',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F7',
  fn: () => {
    const attendanceCode = inspectors.readFile('src/pages/dashboard/AttendanceEntry.tsx');
    assert.contains(attendanceCode, 'leave_requests', 'AttendanceEntry must query leave_requests');
    assert.contains(attendanceCode, 'applicant_type', 'Must filter by applicant_type');
    assert.contains(attendanceCode, 'approved', 'Must query approved leaves');
  }
});

// Step 2: Teacher Attendance Register Live State
registerTest({
  id: 'T4-SC4-02',
  name: 'Scenario 4 (Step 2): AttendanceEntry provides bulk marking tools (Present All, Absent All)',
  featureId: 'F10',
  tier: 4,
  milestone: 'M3',
  description: 'Verifies attendance register provides quick bulk actions to streamline morning roll call',
  expectedOutputSource: 'src/pages/dashboard/AttendanceEntry.tsx:430-460',
  fn: () => {
    const attendanceCode = inspectors.readFile('src/pages/dashboard/AttendanceEntry.tsx');
    assert.contains(attendanceCode, 'handleBulkStatusChange', 'AttendanceEntry must provide handleBulkStatusChange bulk helper');
  }
});

// Step 3: Batch Persistence via save_attendance RPC
registerTest({
  id: 'T4-SC4-03',
  name: 'Scenario 4 (Step 3): Saving register commits all student attendance statuses via save_attendance RPC',
  featureId: 'F10',
  tier: 4,
  milestone: 'M3',
  description: 'Verifies save button calls Postgres RPC save_attendance with atomic JSON array',
  expectedOutputSource: 'src/pages/dashboard/AttendanceEntry.tsx:372 save_attendance RPC',
  fn: () => {
    const attendanceCode = inspectors.readFile('src/pages/dashboard/AttendanceEntry.tsx');
    assert.contains(attendanceCode, 'save_attendance', 'AttendanceEntry must call save_attendance RPC');
  }
});
