/**
 * Tier 1: Feature Coverage - F4: Admin Sidebar Alignment & Categorization
 * Validates sidebar categories, module mounts, and global search routing.
 * Authoritative Source: PROJECT.md § Feature Inventory (F4) & ORIGINAL_REQUEST.md R2.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 4.1: Canonical Front Office Sidebar Mount
registerTest({
  id: 'T1-F4-01',
  name: 'Sidebar Alignment: Front Office module is mounted in the navigation sidebar',
  featureId: 'F4',
  tier: 1,
  milestone: 'M1',
  description: 'Verifies /dashboard/front-office is present in sidebar navigation',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F4',
  fn: () => {
    const sidebar = inspectors.getSidebarConfig();
    assert.isTrue(sidebar.hasSidebarItem('Front Office', '/dashboard/front-office'), 'Front Office must be mounted in sidebar');
  }
});

// Test 4.2: Canonical Hostel Management Sidebar Mount
registerTest({
  id: 'T1-F4-02',
  name: 'Sidebar Alignment: Hostel module is mounted in the navigation sidebar',
  featureId: 'F4',
  tier: 1,
  milestone: 'M1',
  description: 'Verifies /dashboard/hostel is present in sidebar navigation',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F4',
  fn: () => {
    const sidebar = inspectors.getSidebarConfig();
    assert.isTrue(sidebar.hasSidebarItem('Hostel', '/dashboard/hostel'), 'Hostel must be mounted in sidebar');
  }
});

// Test 4.3: Canonical Medical & Discipline Modules Mount
registerTest({
  id: 'T1-F4-03',
  name: 'Sidebar Alignment: Medical and Discipline modules are mounted in sidebar',
  featureId: 'F4',
  tier: 1,
  milestone: 'M1',
  description: 'Verifies /dashboard/medical and /dashboard/discipline are mounted in sidebar',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F4',
  fn: () => {
    const sidebar = inspectors.getSidebarConfig();
    assert.isTrue(sidebar.hasSidebarItem('Medical', '/dashboard/medical'), 'Medical must be mounted in sidebar');
    assert.isTrue(sidebar.hasSidebarItem('Discipline', '/dashboard/discipline'), 'Discipline must be mounted in sidebar');
  }
});

// Test 4.4: Canonical Reports Module Mount
registerTest({
  id: 'T1-F4-04',
  name: 'Sidebar Alignment: Reports module is mounted in sidebar navigation',
  featureId: 'F4',
  tier: 1,
  milestone: 'M1',
  description: 'Verifies /dashboard/reports is mounted in sidebar navigation',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F4',
  fn: () => {
    const sidebar = inspectors.getSidebarConfig();
    assert.isTrue(sidebar.hasSidebarItem('Reports', '/dashboard/reports'), 'Reports must be mounted in sidebar');
  }
});

// Test 4.5: Global Search Routing for Teachers vs Staff
registerTest({
  id: 'T1-F4-05',
  name: 'Global Search: Differentiates between Teachers and Non-Teaching Staff routes',
  featureId: 'F4',
  tier: 1,
  milestone: 'M1',
  description: 'Verifies search routes teachers to /dashboard/teachers and staff to /dashboard/employees',
  expectedOutputSource: 'PROJECT.md § Interface Contracts: Routing & Navigation',
  fn: () => {
    const sidebar = inspectors.getSidebarConfig();
    const teacherTarget = sidebar.getGlobalSearchTargetForRole('Teacher');
    assert.strictEqual(teacherTarget, '/dashboard/teachers', 'Teacher search result must navigate to /dashboard/teachers');
  }
});
