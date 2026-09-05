/**
 * Tier 3: Pairwise Cross-Feature Combinations - F1 + F4: Routes & Sidebar Alignment
 * Validates that Route Guard permissions in App.tsx align 1:1 with Sidebar Item permissions in DashboardLayout.tsx.
 * Authoritative Source: PROJECT.md § Feature Inventory (F1, F4) & § Interface Contracts.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 3.1: Admissions Route Permission aligns with Sidebar
registerTest({
  id: 'T3-F1-F4-01',
  name: 'Pairwise (F1+F4): Admissions route permission (student.create) matches sidebar item permission',
  featureId: 'F1',
  tier: 3,
  milestone: 'M1',
  description: 'Verifies /dashboard/admissions requires student.create in App.tsx and is gated by student.create in sidebar',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F1 & F4',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    const sidebar = inspectors.getSidebarConfig();
    const routePerm = routes.getRoutePermission('/dashboard/admissions');
    assert.strictEqual(routePerm, 'student.create', 'App.tsx route must require student.create');
    assert.contains(sidebar.rawContent, "permission: 'student.create'", 'Sidebar item must require student.create');
  }
});

// Test 3.2: Fees Route Permission aligns with Sidebar
registerTest({
  id: 'T3-F1-F4-02',
  name: 'Pairwise (F1+F4): Financials route permission (fees.view) matches sidebar category permission',
  featureId: 'F1',
  tier: 3,
  milestone: 'M1',
  description: 'Verifies /dashboard/fees requires fees.view in App.tsx and Financials category is gated on fees.view',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F1 & F4',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    const sidebar = inspectors.getSidebarConfig();
    const routePerm = routes.getRoutePermission('/dashboard/fees');
    assert.strictEqual(routePerm, 'fees.view', 'App.tsx route must require fees.view');
    assert.contains(sidebar.rawContent, "permission: 'fees.view'", 'Sidebar category must require fees.view');
  }
});

// Test 3.3: System Management Route Permission aligns with Sidebar
registerTest({
  id: 'T3-F1-F4-03',
  name: 'Pairwise (F1+F4): System route permission (settings.manage) matches sidebar category',
  featureId: 'F1',
  tier: 3,
  milestone: 'M1',
  description: 'Verifies /dashboard/system and sub-views require settings.manage and match sidebar permission',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F1 & F4',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    const sidebar = inspectors.getSidebarConfig();
    const routePerm = routes.getRoutePermission('/dashboard/system');
    assert.strictEqual(routePerm, 'settings.manage', 'App.tsx route must require settings.manage');
    assert.contains(sidebar.rawContent, "permission: 'settings.manage'", 'Sidebar must require settings.manage');
  }
});

// Test 3.4: Attendance Route Permission aligns with Sidebar
registerTest({
  id: 'T3-F1-F4-04',
  name: 'Pairwise (F1+F4): Attendance route permission (attendance.manage) matches sidebar item',
  featureId: 'F1',
  tier: 3,
  milestone: 'M1',
  description: 'Verifies /dashboard/attendance requires attendance.manage in App.tsx and in DashboardLayout.tsx',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F1 & F4',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    const sidebar = inspectors.getSidebarConfig();
    const routePerm = routes.getRoutePermission('/dashboard/attendance');
    assert.strictEqual(routePerm, 'attendance.manage', 'App.tsx route must require attendance.manage');
    assert.contains(sidebar.rawContent, "permission: 'attendance.manage'", 'Sidebar must require attendance.manage');
  }
});
