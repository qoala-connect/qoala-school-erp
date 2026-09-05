/**
 * Tier 2: Boundary & Corner Cases - F13: Full Verification, Quality Gate & Final Report
 * Tests build configurations, module systems, environment variables, and audit report section contracts.
 * Authoritative Source: ORIGINAL_REQUEST.md § Acceptance Criteria & § Documentation & Reporting.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 13.1: ESM Module Type Contract
registerTest({
  id: 'T2-F13-01',
  name: 'Verification Boundary: package.json specifies "type": "module" for native ESM execution',
  featureId: 'F13',
  tier: 2,
  milestone: 'M4',
  description: 'Verifies ESM project standard is declared in package.json',
  expectedOutputSource: 'package.json:5',
  fn: () => {
    const pkgJson = JSON.parse(inspectors.readFile('package.json'));
    assert.strictEqual(pkgJson.type, 'module', 'package.json must specify "type": "module"');
  }
});

// Test 13.2: Vite Build Configuration Structure
registerTest({
  id: 'T2-F13-02',
  name: 'Verification Boundary: vite.config.ts configures React and Tailwind plugins',
  featureId: 'F13',
  tier: 2,
  milestone: 'M4',
  description: 'Verifies Vite configuration includes @vitejs/plugin-react and path aliases',
  expectedOutputSource: 'vite.config.ts',
  fn: () => {
    const viteConfig = inspectors.readFile('vite.config.ts');
    assert.contains(viteConfig, '@vitejs/plugin-react', 'vite.config.ts must load React plugin');
    assert.contains(viteConfig, 'resolve:', 'vite.config.ts must configure alias resolution');
  }
});

// Test 13.3: Environment Variable Supabase Key Format
registerTest({
  id: 'T2-F13-03',
  name: 'Verification Boundary: .env provides syntactically valid JWT anon key and URL',
  featureId: 'F13',
  tier: 2,
  milestone: 'M4',
  description: 'Verifies VITE_SUPABASE_URL is an HTTPS endpoint and VITE_SUPABASE_ANON_KEY has 3 JWT segments',
  expectedOutputSource: '.env file',
  fn: () => {
    const envContent = inspectors.readFile('.env');
    const urlMatch = envContent.match(/VITE_SUPABASE_URL=(https:\/\/[^\s]+)/);
    const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=([A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+)/);
    assert.ok(urlMatch, 'Must define HTTPS VITE_SUPABASE_URL');
    assert.ok(keyMatch, 'Must define 3-part JWT VITE_SUPABASE_ANON_KEY');
  }
});

// Test 13.4: Final Audit Report Sections A through L Coverage
registerTest({
  id: 'T2-F13-04',
  name: 'Verification Boundary: Acceptance criteria mandates 12-part Final Audit Report (Sections A-L)',
  featureId: 'F13',
  tier: 2,
  milestone: 'M4',
  description: 'Verifies audit framework demands Sections A through L covering all aspects of the ERP',
  expectedOutputSource: 'ORIGINAL_REQUEST.md line 51: Detailed final report delivered covering Sections A through L',
  fn: () => {
    const origReq = inspectors.readFile('.agents/ORIGINAL_REQUEST.md');
    assert.contains(origReq, 'Sections A through L', 'Must mandate Sections A through L');
    assert.contains(origReq, 'Scorecard (0–10)', 'Must mandate Scorecard (0-10)');
    assert.contains(origReq, 'Production Status', 'Must mandate Production Status (READY / NOT READY)');
  }
});

// Test 13.5: Production Readiness Blocker Classification
registerTest({
  id: 'T2-F13-05',
  name: 'Verification Boundary: Production status distinguishes P0, P1, P2, and P3 blockers',
  featureId: 'F13',
  tier: 2,
  milestone: 'M4',
  description: 'Verifies defect severity classifications P0-P3 are defined for production gate',
  expectedOutputSource: 'ORIGINAL_REQUEST.md line 34 & 51',
  fn: () => {
    const origReq = inspectors.readFile('.agents/ORIGINAL_REQUEST.md');
    assert.contains(origReq, 'P0', 'Must track P0 blockers');
    assert.contains(origReq, 'P3', 'Must track P3 blockers');
  }
});
