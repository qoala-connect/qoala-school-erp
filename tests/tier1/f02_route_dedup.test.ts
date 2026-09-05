/**
 * Tier 1: Feature Coverage - F2: Route Deduplication & Obsolete Cleanup
 * Validates removal of duplicate route shims and cleanup of unreferenced imports.
 * Authoritative Source: PROJECT.md § Feature Inventory (F2) & ORIGINAL_REQUEST.md R1.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 2.1: Deprecation of /dashboard/exam shim
registerTest({
  id: 'T1-F2-01',
  name: 'Route Dedup: /dashboard/exam redirects to canonical /dashboard/examination',
  featureId: 'F2',
  tier: 1,
  milestone: 'M1',
  description: 'Verifies /dashboard/exam is replaced by a permanent redirect to /dashboard/examination',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F2',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    const isRedirected = routes.hasRedirect('/dashboard/exam', '/dashboard/examination');
    assert.isTrue(isRedirected, '/dashboard/exam must redirect to /dashboard/examination');
  }
});

// Test 2.2: Deprecation of /dashboard/marks shim
registerTest({
  id: 'T1-F2-02',
  name: 'Route Dedup: /dashboard/marks redirects to canonical /dashboard/examination',
  featureId: 'F2',
  tier: 1,
  milestone: 'M1',
  description: 'Verifies /dashboard/marks is replaced by a permanent redirect to /dashboard/examination',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F2',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    const isRedirected = routes.hasRedirect('/dashboard/marks', '/dashboard/examination');
    assert.isTrue(isRedirected, '/dashboard/marks must redirect to /dashboard/examination');
  }
});

// Test 2.3: Elimination of unreferenced Google Classroom/Forms imports
registerTest({
  id: 'T1-F2-03',
  name: 'Route Dedup: GoogleClassroomManager and GoogleFormsManager imports are removed from App.tsx',
  featureId: 'F2',
  tier: 1,
  milestone: 'M1',
  description: 'Verifies unrouted Google integration manager imports are removed from router index',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F2',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    assert.notContains(routes.rawContent, 'GoogleClassroomManager', 'App.tsx must not import GoogleClassroomManager');
    assert.notContains(routes.rawContent, 'GoogleFormsManager', 'App.tsx must not import GoogleFormsManager');
  }
});

// Test 2.4: Elimination of unreferenced DatabaseManager and RoleAndUserManager imports
registerTest({
  id: 'T1-F2-04',
  name: 'Route Dedup: DatabaseManager and RoleAndUserManager imports are removed from App.tsx',
  featureId: 'F2',
  tier: 1,
  milestone: 'M1',
  description: 'Verifies deprecated manager imports are excised from App.tsx',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F2',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    assert.notContains(routes.rawContent, 'DatabaseManager', 'App.tsx must not import DatabaseManager');
    assert.notContains(routes.rawContent, 'RoleAndUserManager', 'App.tsx must not import RoleAndUserManager');
  }
});

// Test 2.5: One Business Function = One Primary Module enforcement
registerTest({
  id: 'T1-F2-05',
  name: 'Route Dedup: Core business modules map to single canonical route parents',
  featureId: 'F2',
  tier: 1,
  milestone: 'M1',
  description: 'Verifies canonical modules exist for Examination, Academics, System, and Fees',
  expectedOutputSource: 'PROJECT.md § Core Principle: ONE BUSINESS FUNCTION = ONE PRIMARY MODULE',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    assert.isTrue(routes.hasRoute('/dashboard/examination'), 'Must have canonical /dashboard/examination route');
    assert.isTrue(routes.hasRoute('/dashboard/academics/:view'), 'Must have canonical /dashboard/academics/:view route');
    assert.isTrue(routes.hasRoute('/dashboard/system/:view'), 'Must have canonical /dashboard/system/:view route');
    assert.isTrue(routes.hasRoute('/dashboard/fees'), 'Must have canonical /dashboard/fees route');
  }
});
