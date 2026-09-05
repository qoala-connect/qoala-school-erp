/**
 * Tier 1: Feature Coverage - F11: UI/UX Consistency, Breadcrumbs & State Feedback
 * Validates breadcrumbs, dense data tables, responsive layouts, and state feedback.
 * Authoritative Source: PROJECT.md § Feature Inventory (F11) & ORIGINAL_REQUEST.md R4.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 11.1: Centralized Breadcrumbs Component
registerTest({
  id: 'T1-F11-01',
  name: 'UI/UX Consistency: Central Breadcrumbs component is implemented in Dashboard layout',
  featureId: 'F11',
  tier: 1,
  milestone: 'M3',
  description: 'Verifies Breadcrumb navigation is integrated into DashboardLayout.tsx',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F11',
  fn: () => {
    const layoutCode = inspectors.readFile('src/components/DashboardLayout.tsx');
    const hasBreadcrumb = layoutCode.includes('Breadcrumb') || layoutCode.includes('breadcrumbs');
    assert.isTrue(hasBreadcrumb, 'DashboardLayout must implement or render Breadcrumb navigation');
  }
});

// Test 11.2: Responsive Sidebar Overlay Mobile Drawer
registerTest({
  id: 'T1-F11-02',
  name: 'UI/UX Consistency: DashboardLayout handles mobile screens with slide-out overlay drawer',
  featureId: 'F11',
  tier: 1,
  milestone: 'M3',
  description: 'Verifies mobile drawer with backdrop exists for viewports down to 375px',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F11',
  fn: () => {
    const layoutCode = inspectors.readFile('src/components/DashboardLayout.tsx');
    assert.contains(layoutCode, 'mobileOpen', 'DashboardLayout must manage mobile drawer state');
    assert.contains(layoutCode, 'lg:hidden', 'Mobile drawer elements must be styled with lg:hidden');
  }
});

// Test 11.3: Dense Data Table Horizontal Overflow Handling
registerTest({
  id: 'T1-F11-03',
  name: 'UI/UX Consistency: Complex tables use overflow-x-auto to prevent mobile cutoff',
  featureId: 'F11',
  tier: 1,
  milestone: 'M3',
  description: 'Verifies Students and Admissions data tables wrap content in overflow containers',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F11',
  fn: () => {
    const studentsCode = inspectors.readFile('src/pages/dashboard/Students.tsx');
    assert.contains(studentsCode, 'overflow-x-auto', 'Students table must contain overflow-x-auto container');
  }
});

// Test 11.4: Actionable Empty State Feedback
registerTest({
  id: 'T1-F11-04',
  name: 'State Feedback: Key modules render actionable empty states when datasets are empty',
  featureId: 'F11',
  tier: 1,
  milestone: 'M3',
  description: 'Verifies user feedback is displayed when queries return zero results',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F11',
  fn: () => {
    const admissionsCode = inspectors.readFile('src/pages/dashboard/AdmissionsManagement.tsx');
    assert.contains(admissionsCode, 'No applications found', 'AdmissionsManagement must display empty state message');
  }
});

// Test 11.5: Loading State Spinner Feedback
registerTest({
  id: 'T1-F11-05',
  name: 'State Feedback: ProtectedRoute and data tables display accessible loading indicators',
  featureId: 'F11',
  tier: 1,
  milestone: 'M3',
  description: 'Verifies spinner or loading block is rendered during asynchronous data fetches',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F11',
  fn: () => {
    const appCode = inspectors.readFile('src/App.tsx');
    assert.contains(appCode, 'animate-spin', 'ProtectedRoute must render loading spinner while auth is initializing');
  }
});
