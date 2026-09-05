/**
 * Master Test Suite Runner - School ERP E2E Opaque-Box Test Harness
 * Loads all tests across Tiers 1-4 and executes them systematically.
 */

// Import Infrastructure
import { runAllTests } from './infra/runner';
import { TierLevel, FeatureId } from './infra/types';

// Import Tier 1 Tests (Feature Coverage F1 - F13)
import './tier1/f01_route_security.test';
import './tier1/f02_route_dedup.test';
import './tier1/f03_cross_module_ctx.test';
import './tier1/f04_sidebar_align.test';
import './tier1/f05_rls_leaks.test';
import './tier1/f06_escalation_guard.test';
import './tier1/f07_role_lockouts.test';
import './tier1/f08_db_indexing.test';
import './tier1/f09_ai_grounding.test';
import './tier1/f10_action_buttons.test';
import './tier1/f11_ui_consistency.test';
import './tier1/f12_query_perf.test';
import './tier1/f13_verification_gate.test';

// Import Tier 2 Tests (Boundary & Corner Cases F1 - F13)
import './tier2/f01_boundary.test';
import './tier2/f02_boundary.test';
import './tier2/f03_boundary.test';
import './tier2/f04_boundary.test';
import './tier2/f05_boundary.test';
import './tier2/f06_boundary.test';
import './tier2/f07_boundary.test';
import './tier2/f08_boundary.test';
import './tier2/f09_boundary.test';
import './tier2/f10_boundary.test';
import './tier2/f11_boundary.test';
import './tier2/f12_boundary.test';
import './tier2/f13_boundary.test';

// Import Tier 3 Tests (Pairwise Combinations)
import './tier3/f01_f04_routes_sidebar.test';
import './tier3/f03_f10_context_actions.test';
import './tier3/f05_f06_rls_triggers.test';
import './tier3/f07_f08_rbac_views.test';
import './tier3/f09_f12_ai_pagination.test';
import './tier3/f03_f11_context_breadcrumbs.test';

// Import Tier 4 Tests (Real-World Scenarios)
import './tier4/scenario1_student_onboarding_fees.test';
import './tier4/scenario2_academic_term_exams.test';
import './tier4/scenario3_rbac_user_governance.test';
import './tier4/scenario4_attendance_leaves_workflow.test';
import './tier4/scenario5_transport_logistics_flow.test';

// CLI Argument Parsing
function parseArgs() {
  const args = process.argv.slice(2);
  let tierFilter: TierLevel | undefined;
  let featureFilter: FeatureId | undefined;
  let namePattern: string | undefined;
  let outputPath: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--tier=')) {
      const val = parseInt(arg.replace('--tier=', ''), 10);
      if ([1, 2, 3, 4].includes(val)) tierFilter = val as TierLevel;
    } else if (arg.startsWith('--feature=')) {
      featureFilter = arg.replace('--feature=', '').toUpperCase() as FeatureId;
    } else if (arg.startsWith('--filter=')) {
      namePattern = arg.replace('--filter=', '');
    } else if (arg.startsWith('--output=')) {
      outputPath = arg.replace('--output=', '');
    }
  }

  return { tierFilter, featureFilter, namePattern, outputPath };
}

async function main() {
  const options = parseArgs();
  try {
    const summary = await runAllTests(options);
    if (summary.failed > 0) {
      console.error(`\nSuite completed with ${summary.failed} failing tests.`);
      process.exitCode = 1;
    } else {
      console.log(`\nAll ${summary.passed} tests PASSED successfully!`);
      process.exitCode = 0;
    }
  } catch (err: any) {
    console.error('Fatal execution error:', err);
    process.exitCode = 1;
  }
}

main();
