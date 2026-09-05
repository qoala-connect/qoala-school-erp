/**
 * Tier 2: Boundary & Corner Cases - F1: Route Security & Permission Guards
 * Tests boundary conditions for authentication state, missing profiles, case sensitivity, and route fallbacks.
 * Authoritative Source: PROJECT.md § Architecture & ProtectedRoute component contract in App.tsx.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 2.1: ProtectedRoute Fail-Closed on no-profile
registerTest({
  id: 'T2-F1-01',
  name: 'Route Security Boundary: ProtectedRoute fails closed when errorKind is "no-profile"',
  featureId: 'F1',
  tier: 2,
  milestone: 'M1',
  description: 'Verifies ProtectedRoute redirects to /unauthorized when account has no profile/role row',
  expectedOutputSource: 'src/App.tsx:78 ProtectedRoute implementation',
  fn: () => {
    const appCode = inspectors.readFile('src/App.tsx');
    assert.contains(
      appCode,
      "errorKind === 'no-profile' || !role",
      'ProtectedRoute must explicitly fail-closed on no-profile or null role'
    );
    assert.contains(
      appCode,
      '<Navigate to="/unauthorized" replace />',
      'Must redirect to /unauthorized when role is missing'
    );
  }
});

// Test 2.2: ProtectedRoute Unauthenticated Redirect Boundary
registerTest({
  id: 'T2-F1-02',
  name: 'Route Security Boundary: ProtectedRoute redirects unauthenticated sessions to /login',
  featureId: 'F1',
  tier: 2,
  milestone: 'M1',
  description: 'Verifies null user redirects immediately to login with replace flag',
  expectedOutputSource: 'src/App.tsx:72 ProtectedRoute implementation',
  fn: () => {
    const appCode = inspectors.readFile('src/App.tsx');
    assert.contains(
      appCode,
      '!user',
      'ProtectedRoute must check for absence of authenticated user'
    );
    assert.contains(
      appCode,
      '<Navigate to="/login" replace />',
      'Must navigate to /login with replace flag'
    );
  }
});

// Test 2.3: Wildcard 404 Route Boundary
registerTest({
  id: 'T2-F1-03',
  name: 'Route Security Boundary: Unmatched URLs fall through to NotFound component via path="*"' ,
  featureId: 'F1',
  tier: 2,
  milestone: 'M1',
  description: 'Verifies wildcard route * is registered at root router level',
  expectedOutputSource: 'src/App.tsx:369 Route fallback',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    assert.isTrue(routes.hasRoute('*'), 'App.tsx must register wildcard * fallback route');
    const wildcard = routes.getRoute('*');
    assert.contains(wildcard!.elementSnippet, 'NotFound', 'Wildcard route must render NotFound component');
  }
});

// Test 2.4: Examination Sub-routes Granular Permission Boundary
registerTest({
  id: 'T2-F1-04',
  name: 'Route Security Boundary: Examination sub-routes enforce specific publish vs view privileges',
  featureId: 'F1',
  tier: 2,
  milestone: 'M1',
  description: 'Verifies exams, schedule, and result-publication require results.publish while others require results.view',
  expectedOutputSource: 'src/App.tsx:344-366 Examination Submenu Routes',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    assert.strictEqual(routes.getRoutePermission('/dashboard/examination/exams'), 'results.publish');
    assert.strictEqual(routes.getRoutePermission('/dashboard/examination/schedule'), 'results.publish');
    assert.strictEqual(routes.getRoutePermission('/dashboard/examination/result-publication'), 'results.publish');
    assert.strictEqual(routes.getRoutePermission('/dashboard/examination/dashboard'), 'results.view');
  }
});

// Test 2.5: Deep Academics View Sub-path Permission Boundary
registerTest({
  id: 'T2-F1-05',
  name: 'Route Security Boundary: Academics dynamic path /dashboard/academics/:view is protected',
  featureId: 'F1',
  tier: 2,
  milestone: 'M1',
  description: 'Verifies parameterized subviews cannot be accessed without authenticated session',
  expectedOutputSource: 'src/App.tsx:224-230 Academics Route',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    assert.isTrue(routes.isProtected('/dashboard/academics/:view'), 'Parameterized academics route must be protected');
  }
});
