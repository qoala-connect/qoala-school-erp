/**
 * Tier 1: Feature Coverage - F1: Route Security & Permission Guards
 * Validates that all operations routes in App.tsx enforce allowedPermission on <ProtectedRoute>.
 * Authoritative Source: PROJECT.md § Feature Inventory (F1) & § Interface Contracts.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 1.1: Transport Route Guard Contract
registerTest({
  id: 'T1-F1-01',
  name: 'Route Security: /dashboard/transport enforces transport.manage permission',
  featureId: 'F1',
  tier: 1,
  milestone: 'M1',
  description: 'Verifies that /dashboard/transport route is protected by transport.manage permission',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F1',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    assert.isTrue(routes.isProtected('/dashboard/transport'), 'Route /dashboard/transport must be wrapped in ProtectedRoute');
    const perm = routes.getRoutePermission('/dashboard/transport');
    assert.strictEqual(perm, 'transport.manage', 'Route /dashboard/transport must specify allowedPermission="transport.manage"');
  }
});

// Test 1.2: Library Route Guard Contract
registerTest({
  id: 'T1-F1-02',
  name: 'Route Security: /dashboard/library enforces library.manage permission',
  featureId: 'F1',
  tier: 1,
  milestone: 'M1',
  description: 'Verifies that /dashboard/library route is protected by library.manage permission',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F1',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    assert.isTrue(routes.isProtected('/dashboard/library'), 'Route /dashboard/library must be wrapped in ProtectedRoute');
    const perm = routes.getRoutePermission('/dashboard/library');
    assert.strictEqual(perm, 'library.manage', 'Route /dashboard/library must specify allowedPermission="library.manage"');
  }
});

// Test 1.3: Inventory Route Guard Contract
registerTest({
  id: 'T1-F1-03',
  name: 'Route Security: /dashboard/inventory enforces inventory.manage permission',
  featureId: 'F1',
  tier: 1,
  milestone: 'M1',
  description: 'Verifies that /dashboard/inventory route is protected by inventory.manage permission',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F1',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    assert.isTrue(routes.isProtected('/dashboard/inventory'), 'Route /dashboard/inventory must be wrapped in ProtectedRoute');
    const perm = routes.getRoutePermission('/dashboard/inventory');
    assert.strictEqual(perm, 'inventory.manage', 'Route /dashboard/inventory must specify allowedPermission="inventory.manage"');
  }
});

// Test 1.4: Hostel & Front Office Route Guards
registerTest({
  id: 'T1-F1-04',
  name: 'Route Security: Operations modules (hostel, front-office) enforce manage permissions',
  featureId: 'F1',
  tier: 1,
  milestone: 'M1',
  description: 'Verifies that /dashboard/hostel and /dashboard/front-office enforce specific manage permissions',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F1',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    assert.strictEqual(routes.getRoutePermission('/dashboard/hostel'), 'hostel.manage', 'hostel route must require hostel.manage');
    assert.strictEqual(routes.getRoutePermission('/dashboard/front-office'), 'front_office.manage', 'front-office route must require front_office.manage');
  }
});

// Test 1.5: Certificates & Communication Route Guards
registerTest({
  id: 'T1-F1-05',
  name: 'Route Security: Communication & Certificates routes enforce specific permission guards',
  featureId: 'F1',
  tier: 1,
  milestone: 'M1',
  description: 'Verifies that /dashboard/communication and /dashboard/certificates require communication.manage and certificates.manage',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F1',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    assert.strictEqual(routes.getRoutePermission('/dashboard/communication'), 'communication.manage', 'communication route must require communication.manage');
    assert.strictEqual(routes.getRoutePermission('/dashboard/certificates'), 'certificates.manage', 'certificates route must require certificates.manage');
  }
});
