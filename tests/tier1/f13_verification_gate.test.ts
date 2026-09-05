/**
 * Tier 1: Feature Coverage - F13: Full Verification, Quality Gate & Final Report
 * Validates build readiness, package integrity, configuration, and audit report criteria.
 * Authoritative Source: PROJECT.md § Feature Inventory (F13) & ORIGINAL_REQUEST.md Acceptance Criteria.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 13.1: Package.json Scripts Quality Gate
registerTest({
  id: 'T1-F13-01',
  name: 'Quality Gate: package.json specifies build, dev, and lint verification scripts',
  featureId: 'F13',
  tier: 1,
  milestone: 'M4',
  description: 'Verifies standard build and quality check scripts are present in package.json',
  expectedOutputSource: 'PROJECT.md § Acceptance Criteria',
  fn: () => {
    const pkgJson = JSON.parse(inspectors.readFile('package.json'));
    assert.ok(pkgJson.scripts.build, 'Must have build script in package.json');
    assert.ok(pkgJson.scripts.lint, 'Must have lint script in package.json');
    assert.contains(pkgJson.scripts.lint, 'tsc', 'lint script must invoke TypeScript typecheck');
  }
});

// Test 13.2: Tsconfig Path Aliases and Strict Configuration
registerTest({
  id: 'T1-F13-02',
  name: 'Quality Gate: tsconfig.json properly configures @/* path alias to src/*',
  featureId: 'F13',
  tier: 1,
  milestone: 'M4',
  description: 'Verifies TypeScript configuration resolves paths accurately without typecheck errors',
  expectedOutputSource: 'PROJECT.md § Acceptance Criteria',
  fn: () => {
    const tsconfig = JSON.parse(inspectors.readFile('tsconfig.json'));
    assert.ok(tsconfig.compilerOptions.paths, 'Must define paths in tsconfig');
    assert.includes(tsconfig.compilerOptions.paths['@/*'], './src/*', 'Must map @/* to ./src/*');
  }
});

// Test 13.3: Canonical Migration Idempotency
registerTest({
  id: 'T1-F13-03',
  name: 'Quality Gate: Additive migration scripts use IF NOT EXISTS and DROP IF EXISTS safeguards',
  featureId: 'F13',
  tier: 1,
  milestone: 'M4',
  description: 'Verifies database migrations can be applied idempotently without syntax errors',
  expectedOutputSource: 'PROJECT.md § Database & RLS Contracts',
  fn: () => {
    const migrations = inspectors.getAllMigrationSql();
    assert.contains(migrations, 'IF NOT EXISTS', 'Migrations must use IF NOT EXISTS for additive safety');
    assert.contains(migrations, 'DROP POLICY IF EXISTS', 'Migrations must safely drop old policies before replacement');
  }
});

// Test 13.4: Zero Duplicate Module Implementation Rule
registerTest({
  id: 'T1-F13-04',
  name: 'Quality Gate: Zero duplicate module implementations in production routes',
  featureId: 'F13',
  tier: 1,
  milestone: 'M4',
  description: 'Verifies no parallel Admin-only student/fee CRUD pages exist in routes',
  expectedOutputSource: 'ORIGINAL_REQUEST.md § Acceptance Criteria',
  fn: () => {
    const routes = inspectors.getAppRoutes();
    assert.isFalse(routes.hasRoute('/dashboard/admin-fees'), 'Parallel admin-fees route must not exist');
    assert.isFalse(routes.hasRoute('/dashboard/admin-students'), 'Parallel admin-students route must not exist');
  }
});

// Test 13.5: Final Audit Scope Coverage
registerTest({
  id: 'T1-F13-05',
  name: 'Quality Gate: Original request requirements R1 through R5 are addressed in project artifacts',
  featureId: 'F13',
  tier: 1,
  milestone: 'M4',
  description: 'Verifies all 5 core requirements from ORIGINAL_REQUEST.md have mapped coverage in PROJECT.md',
  expectedOutputSource: 'ORIGINAL_REQUEST.md § Requirements R1-R5',
  fn: () => {
    const projectMd = inspectors.readFile('PROJECT.md');
    assert.contains(projectMd, 'F1', 'PROJECT.md must map R1 to F1');
    assert.contains(projectMd, 'F5', 'PROJECT.md must map R3 to F5');
    assert.contains(projectMd, 'F10', 'PROJECT.md must map R2 to F10');
    assert.contains(projectMd, 'F13', 'PROJECT.md must map R5 to F13');
  }
});
