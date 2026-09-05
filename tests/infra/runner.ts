/**
 * School ERP Test Runner Engine
 * Executes test suites across Tiers 1-4, measures execution, and outputs reports.
 */

import { TestCase, TestResult, SuiteSummary, TierLevel, FeatureId } from './types';
import fs from 'fs';
import path from 'path';

export class TestRegistry {
  private static instance: TestRegistry;
  private tests: TestCase[] = [];

  private constructor() {}

  static getInstance(): TestRegistry {
    if (!TestRegistry.instance) {
      TestRegistry.instance = new TestRegistry();
    }
    return TestRegistry.instance;
  }

  register(testCase: TestCase) {
    this.tests.push(testCase);
  }

  getTests(): TestCase[] {
    return [...this.tests];
  }

  clear() {
    this.tests = [];
  }
}

export function registerTest(testCase: TestCase) {
  TestRegistry.getInstance().register(testCase);
}

export async function runAllTests(options: {
  tierFilter?: TierLevel;
  featureFilter?: FeatureId;
  namePattern?: string;
  outputPath?: string;
} = {}): Promise<SuiteSummary> {
  const allTests = TestRegistry.getInstance().getTests();
  const startTime = Date.now();

  const filtered = allTests.filter(t => {
    if (options.tierFilter && t.tier !== options.tierFilter) return false;
    if (options.featureFilter && t.featureId !== options.featureFilter) return false;
    if (options.namePattern && !t.name.toLowerCase().includes(options.namePattern.toLowerCase())) return false;
    return true;
  });

  const results: TestResult[] = [];
  const tierBreakdown: Record<TierLevel, { total: number; passed: number; failed: number }> = {
    1: { total: 0, passed: 0, failed: 0 },
    2: { total: 0, passed: 0, failed: 0 },
    3: { total: 0, passed: 0, failed: 0 },
    4: { total: 0, passed: 0, failed: 0 }
  };

  const featureBreakdown: Record<FeatureId, { total: number; passed: number; failed: number }> = {
    F1: { total: 0, passed: 0, failed: 0 },
    F2: { total: 0, passed: 0, failed: 0 },
    F3: { total: 0, passed: 0, failed: 0 },
    F4: { total: 0, passed: 0, failed: 0 },
    F5: { total: 0, passed: 0, failed: 0 },
    F6: { total: 0, passed: 0, failed: 0 },
    F7: { total: 0, passed: 0, failed: 0 },
    F8: { total: 0, passed: 0, failed: 0 },
    F9: { total: 0, passed: 0, failed: 0 },
    F10: { total: 0, passed: 0, failed: 0 },
    F11: { total: 0, passed: 0, failed: 0 },
    F12: { total: 0, passed: 0, failed: 0 },
    F13: { total: 0, passed: 0, failed: 0 }
  };

  console.log('\n================================================================');
  console.log('       SCHOOL ERP OPAQUE-BOX E2E TEST SUITE RUNNER');
  console.log('================================================================');
  console.log(`Discovered ${allTests.length} registered tests.`);
  console.log(`Executing ${filtered.length} tests matching filters...\n`);

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const t of filtered) {
    tierBreakdown[t.tier].total++;
    featureBreakdown[t.featureId].total++;

    const tStart = Date.now();
    try {
      await t.fn();
      const durationMs = Date.now() - tStart;
      passed++;
      tierBreakdown[t.tier].passed++;
      featureBreakdown[t.featureId].passed++;

      results.push({
        id: t.id,
        name: t.name,
        featureId: t.featureId,
        tier: t.tier,
        milestone: t.milestone,
        status: 'PASSED',
        durationMs
      });

      console.log(`  [PASS] [Tier ${t.tier}] [${t.featureId}] ${t.name} (${durationMs}ms)`);
    } catch (err: any) {
      const durationMs = Date.now() - tStart;
      failed++;
      tierBreakdown[t.tier].failed++;
      featureBreakdown[t.featureId].failed++;

      results.push({
        id: t.id,
        name: t.name,
        featureId: t.featureId,
        tier: t.tier,
        milestone: t.milestone,
        status: 'FAILED',
        durationMs,
        error: {
          message: err?.message || String(err),
          stack: err?.stack,
          expected: err?.expected,
          actual: err?.actual
        }
      });

      console.log(`  [FAIL] [Tier ${t.tier}] [${t.featureId}] ${t.name} (${durationMs}ms)`);
      console.log(`         Error: ${err?.message || err}`);
      if (err?.expected !== undefined && err?.actual !== undefined) {
        console.log(`         Expected: ${JSON.stringify(err.expected)}`);
        console.log(`         Actual:   ${JSON.stringify(err.actual)}`);
      }
    }
  }

  const totalDurationMs = Date.now() - startTime;

  console.log('\n================================================================');
  console.log('                     TEST EXECUTION SUMMARY');
  console.log('================================================================');
  console.log(`Total: ${filtered.length} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);
  console.log(`Total Duration: ${(totalDurationMs / 1000).toFixed(2)}s\n`);

  console.log('--- Breakdown by Tier ---');
  for (let tier = 1; tier <= 4; tier++) {
    const b = tierBreakdown[tier as TierLevel];
    console.log(`  Tier ${tier}: Total=${b.total}, Passed=${b.passed}, Failed=${b.failed}`);
  }

  console.log('\n--- Breakdown by Feature (F1 - F13) ---');
  for (let i = 1; i <= 13; i++) {
    const fId = `F${i}` as FeatureId;
    const b = featureBreakdown[fId];
    console.log(`  ${fId.padEnd(4)}: Total=${b.total}, Passed=${b.passed}, Failed=${b.failed}`);
  }

  const summary: SuiteSummary = {
    total: filtered.length,
    passed,
    failed,
    skipped,
    durationMs: totalDurationMs,
    tierBreakdown,
    featureBreakdown,
    results
  };

  // Write JSON report if requested
  const outPath = options.outputPath || path.resolve(process.cwd(), 'tests/reports/test-results.json');
  try {
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf-8');
    console.log(`\nDetailed report written to: ${outPath}`);
  } catch (err: any) {
    console.warn(`Could not save report file: ${err.message}`);
  }

  return summary;
}
