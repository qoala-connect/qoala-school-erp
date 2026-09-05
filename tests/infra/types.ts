/**
 * Test Infrastructure Type Definitions
 * School ERP Opaque-Box E2E Testing Suite
 */

export type FeatureId =
  | 'F1'
  | 'F2'
  | 'F3'
  | 'F4'
  | 'F5'
  | 'F6'
  | 'F7'
  | 'F8'
  | 'F9'
  | 'F10'
  | 'F11'
  | 'F12'
  | 'F13';

export type TierLevel = 1 | 2 | 3 | 4;

export type MilestoneId = 'M1' | 'M2' | 'M3' | 'M4';

export interface TestCase {
  id: string;
  name: string;
  featureId: FeatureId;
  tier: TierLevel;
  milestone: MilestoneId;
  description: string;
  expectedOutputSource: string;
  fn: () => void | Promise<void>;
}

export type TestStatus = 'PASSED' | 'FAILED' | 'SKIPPED';

export interface TestResult {
  id: string;
  name: string;
  featureId: FeatureId;
  tier: TierLevel;
  milestone: MilestoneId;
  status: TestStatus;
  durationMs: number;
  error?: {
    message: string;
    stack?: string;
    expected?: any;
    actual?: any;
  };
}

export interface SuiteSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  tierBreakdown: Record<TierLevel, { total: number; passed: number; failed: number }>;
  featureBreakdown: Record<FeatureId, { total: number; passed: number; failed: number }>;
  results: TestResult[];
}
