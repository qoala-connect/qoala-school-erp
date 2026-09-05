/**
 * Tier 2: Boundary & Corner Cases - F2: Route Deduplication & Obsolete Cleanup
 * Tests corner cases for history replacement, deep aliases, and obsolete file retirement.
 * Authoritative Source: PROJECT.md § Feature Inventory (F2) & § Architecture.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 2.1: Redirect History Replacement Flag
registerTest({
  id: 'T2-F2-01',
  name: 'Route Dedup Boundary: Legacy redirects specify replace flag to prevent back-button loops',
  featureId: 'F2',
  tier: 2,
  milestone: 'M1',
  description: 'Verifies <Navigate replace /> is used so browser history does not trap users in infinite redirect loops',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F2',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    const redirects = routes.routes.filter(r => r.elementSnippet.includes('Navigate'));
    assert.greaterThan(redirects.length, 5, 'Must have multiple legacy redirects registered');
    for (const r of redirects) {
      assert.contains(r.elementSnippet, 'replace', `Redirect for ${r.path} must specify replace attribute`);
    }
  }
});

// Test 2.2: Academic Structure Deep Alias Resolution
registerTest({
  id: 'T2-F2-02',
  name: 'Route Dedup Boundary: Deep academic paths resolve to canonical /dashboard/academics/:view',
  featureId: 'F2',
  tier: 2,
  milestone: 'M1',
  description: 'Verifies /dashboard/academic-structure and /dashboard/timetable redirect into Academics module',
  expectedOutputSource: 'src/App.tsx:233-240 Academic structure redirects',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    assert.isTrue(routes.hasRedirect('/dashboard/academic-structure', '/dashboard/academics/structure'));
    assert.isTrue(routes.hasRedirect('/dashboard/timetable', '/dashboard/academics/timetable'));
  }
});

// Test 2.3: Legacy System & Governance Redirects
registerTest({
  id: 'T2-F2-03',
  name: 'Route Dedup Boundary: Legacy system paths redirect to /dashboard/system/:view',
  featureId: 'F2',
  tier: 2,
  milestone: 'M1',
  description: 'Verifies /dashboard/audit, /dashboard/settings, and /dashboard/users-roles redirect cleanly',
  expectedOutputSource: 'src/App.tsx:206-208 System redirects',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    assert.isTrue(routes.hasRedirect('/dashboard/audit', '/dashboard/system/audit'));
    assert.isTrue(routes.hasRedirect('/dashboard/settings', '/dashboard/system/settings'));
    assert.isTrue(routes.hasRedirect('/dashboard/users-roles', '/dashboard/system/users'));
  }
});

// Test 2.4: Peripheral Management Suffix Dedup
registerTest({
  id: 'T2-F2-04',
  name: 'Route Dedup Boundary: Verbose *-management paths redirect to clean nouns',
  featureId: 'F2',
  tier: 2,
  milestone: 'M1',
  description: 'Verifies /dashboard/library-management, transport-management, etc. redirect to short clean URLs',
  expectedOutputSource: 'src/App.tsx:289-293 Clean URL aliases',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    assert.isTrue(routes.hasRedirect('/dashboard/library-management', '/dashboard/library'));
    assert.isTrue(routes.hasRedirect('/dashboard/transport-management', '/dashboard/transport'));
    assert.isTrue(routes.hasRedirect('/dashboard/inventory-management', '/dashboard/inventory'));
    assert.isTrue(routes.hasRedirect('/dashboard/communication-management', '/dashboard/communication'));
  }
});

// Test 2.5: Physical File Retirement of Obsolete Mockups
registerTest({
  id: 'T2-F2-05',
  name: 'Route Dedup Boundary: Dead mockup files (DatabaseManager, RoleAndUserManager) are retired',
  featureId: 'F2',
  tier: 2,
  milestone: 'M1',
  description: 'Verifies obsolete mockups are removed or safely deprecated from dashboard components',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F2',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    // Verify they are not imported in App.tsx
    assert.notContains(routes.rawContent, 'from \'@/pages/dashboard/DatabaseManager\'');
    assert.notContains(routes.rawContent, 'from \'@/pages/dashboard/RoleAndUserManager\'');
  }
});
