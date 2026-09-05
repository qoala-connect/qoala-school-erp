# School ERP Test Infrastructure & Architecture

## 1. Overview & Testing Philosophy

The School ERP testing infrastructure provides an enterprise-grade, opaque-box end-to-end test harness designed to validate all 13 core features (F1–F13) across the four implementation milestones (M1–M4).

The harness operates under strict **opaque-box principles**:
- Verifies observable application behaviors, router guards, state preservation contracts, and UI navigation hierarchies.
- Validates database schema integrity, PostgreSQL Row Level Security (RLS) policies, triggers, indexes, and database views directly against database catalog contracts and migration scripts.
- Verifies backend API endpoints, Gemini AI context grounding, and service-layer pagination and concurrency behaviors.
- Does not modify implementation source code; defects identified by the suite are surfaced as actionable escalations for implementation agents.

---

## 2. Directory & Component Layout

```
tests/
├── infra/
│   ├── types.ts                      # Core test types, TestResult, SuiteSummary, TierLevel, FeatureId
│   ├── assert.ts                     # Strict assertions (strictEqual, contains, throws, rejects, etc.)
│   ├── inspectors.ts                 # Opaque-box file, router, sidebar, context, and schema inspectors
│   └── runner.ts                     # Core runner engine with filtering, execution timing, and JSON reporting
├── tier1/                            # Tier 1: Feature Coverage (>=5 tests per feature F1–F13, 65 tests)
│   ├── f01_route_security.test.ts    # F1: Route security & allowedPermission guards
│   ├── f02_route_dedup.test.ts       # F2: Route deduplication & obsolete file cleanup
│   ├── f03_cross_module_ctx.test.ts  # F3: Cross-module router state & ID preservation
│   ├── f04_sidebar_align.test.ts     # F4: Admin sidebar alignment & search routing
│   ├── f05_rls_leaks.test.ts         # F5: Critical RLS write leak elimination
│   ├── f06_escalation_guard.test.ts  # F6: Privilege escalation & self-reactivation guards
│   ├── f07_role_lockouts.test.ts     # F7: Role lockout & silent failure elimination
│   ├── f08_db_indexing.test.ts       # F8: Foreign key indexing & view updates
│   ├── f09_ai_grounding.test.ts      # F9: AI server grounding query & service race condition fixes
│   ├── f10_action_buttons.test.ts    # F10: Action button interactivity & genuine operations
│   ├── f11_ui_consistency.test.ts    # F11: UI/UX consistency, breadcrumbs & state feedback
│   ├── f12_query_perf.test.ts        # F12: Query performance & bounded pagination
│   └── f13_verification_gate.test.ts # F13: Verification gate & production criteria
├── tier2/                            # Tier 2: Boundary & Corner Cases (>=5 tests per feature, 65 tests)
│   ├── f01_boundary.test.ts          # Authentication state, no-profile fallbacks, wildcard 404
│   ├── f02_boundary.test.ts          # History replace flags, deep alias resolution, suffix dedup
│   ├── f03_boundary.test.ts          # State fallbacks, optional parameters, tab activation
│   ├── f04_boundary.test.ts          # Search overlay blur timeout, collapsed mode labels
│   ├── f05_boundary.test.ts          # Multi-tenant isolation, family_id matching, WITH CHECK
│   ├── f06_boundary.test.ts          # SECURITY DEFINER, service_role exemptions, employee ID format
│   ├── f07_boundary.test.ts          # Role hierarchy (is_admin), union policies, counter safety
│   ├── f08_boundary.test.ts          # Days overdue formula, voided payment filters, security_invoker
│   ├── f09_boundary.test.ts          # Null status defaults, missing API keys, teacher deactivation
│   ├── f10_boundary.test.ts          # Form foreign key validation, date range bounds, tab isolation
│   ├── f11_boundary.test.ts          # Responsive breakpoint classes, toast notifications
│   ├── f12_boundary.test.ts          # Multi-filter query composition, promise concurrency
│   └── f13_boundary.test.ts          # ESM module structure, Vite bundle configs, JWT format
├── tier3/                            # Tier 3: Pairwise Cross-Feature Combinations (19 tests)
│   ├── f01_f04_routes_sidebar.test.ts       # Route permissions vs sidebar visibility alignment
│   ├── f03_f10_context_actions.test.ts      # State preservation triggering genuine module operations
│   ├── f05_f06_rls_triggers.test.ts         # Defense-in-depth: RLS policies + DB escalation triggers
│   ├── f07_f08_rbac_views.test.ts           # Unlocked roles querying canonical updated views
│   ├── f09_f12_ai_pagination.test.ts        # AI grounding queries and service pagination cohesion
│   └── f03_f11_context_breadcrumbs.test.ts  # Cross-module transitions updating breadcrumb trails
├── tier4/                            # Tier 4: Real-World Application Scenarios (15 tests)
│   ├── scenario1_student_onboarding_fees.test.ts    # Student Onboarding & Fee Enrollment Cycle
│   ├── scenario2_academic_term_exams.test.ts        # Academic Term Setup & CBSE Examination Cycle
│   ├── scenario3_rbac_user_governance.test.ts       # Administrative RBAC Governance & User Lifecycle
│   ├── scenario4_attendance_leaves_workflow.test.ts # Student Attendance & Leave Management Flow
│   └── scenario5_transport_logistics_flow.test.ts   # Operational Logistics & Asset Allocation Flow
├── run-all.ts                        # Master test runner entry point
└── reports/
    └── test-results.json             # Structured JSON report with execution metrics
```

---

## 3. Systematic 4-Tier Test Methodology

| Tier | Category | Minimum Requirement | Implemented Tests | Purpose |
|---|---|---|---|---|
| **Tier 1** | **Feature Coverage** | >=5 tests per feature (F1–F13) | **65 tests** | Verifies the primary happy-path contracts and core behaviors for all features. |
| **Tier 2** | **Boundary & Corner Cases** | >=5 tests per feature (F1–F13) | **65 tests** | Tests failure modes, edge inputs, missing states, unprivileged tampering, and error boundaries. |
| **Tier 3** | **Cross-Feature Combinations** | Pairwise interaction tests | **19 tests** | Verifies interactions between coupled features (e.g. F1+F4, F3+F10, F5+F6, F7+F8, F9+F12, F3+F11). |
| **Tier 4** | **Real-World Scenarios** | >=5 realistic workflows | **15 tests** | Validates end-to-end institutional workflows from admissions to graduation and financial audits. |
| **TOTAL** | | | **164 tests** | Complete coverage of the School ERP system contracts. |

---

## 4. Feature Coverage Matrix (F1–F13)

| # | Feature | Milestone | Tier 1 | Tier 2 | Tier 3 / 4 | Total Tests |
|---|---|---|---|---|---|---|
| **F1** | Route Security & Permission Guards | M1 | 5 | 5 | 4 | **14** |
| **F2** | Route Deduplication & Obsolete Cleanup | M1 | 5 | 5 | 1 | **11** |
| **F3** | Cross-Module Context & ID Preservation | M1 | 5 | 5 | 4 | **14** |
| **F4** | Admin Sidebar Alignment & Categorization | M1 | 5 | 5 | 0 | **10** |
| **F5** | Critical RLS Write Leak Elimination | M2 | 5 | 5 | 2 | **12** |
| **F6** | Privilege Escalation & Self-Reactivation Guard | M2 | 5 | 5 | 2 | **12** |
| **F7** | Role Lockout & Silent Failure Elimination | M2 | 5 | 5 | 4 | **14** |
| **F8** | Database Indexing & Relational Hardening | M2 | 5 | 5 | 0 | **10** |
| **F9** | AI Grounding & Service Query Fixes | M2 | 5 | 5 | 2 | **12** |
| **F10** | Action Button Interactivity & Real Operations | M3 | 5 | 5 | 11 | **21** |
| **F11** | UI/UX Consistency, Breadcrumbs & State Feedback | M3 | 5 | 5 | 3 | **13** |
| **F12** | Query Performance & Pagination | M3 | 5 | 5 | 1 | **11** |
| **F13** | Full Verification, Quality Gate & Final Report | M4 | 5 | 5 | 0 | **10** |
| **TOTAL** | | | **65** | **65** | **34** | **164** |

---

## 5. Test Runner Execution CLI

The test suite runs natively on Node.js using TypeScript execution via `tsx`:

### Full Suite Run:
```bash
npx tsx tests/run-all.ts
```

### Run by Specific Tier:
```bash
npx tsx tests/run-all.ts --tier=1
npx tsx tests/run-all.ts --tier=2
npx tsx tests/run-all.ts --tier=3
npx tsx tests/run-all.ts --tier=4
```

### Run by Specific Feature:
```bash
npx tsx tests/run-all.ts --feature=F1
npx tsx tests/run-all.ts --feature=F5
npx tsx tests/run-all.ts --feature=F10
```

### Filter by Test Name Substring:
```bash
npx tsx tests/run-all.ts --filter="Student 360"
```

### Custom Output Report Path:
```bash
npx tsx tests/run-all.ts --output=tests/reports/custom-results.json
```

---

## 6. Authoritative Expected Output Derivation

Every test case derives its expected output from explicit authoritative specifications:
1. **`PROJECT.md` Interface Contracts**: Navigation parameters, role hierarchies, and canonical table mapping.
2. **`ORIGINAL_REQUEST.md` Requirements R1–R5**: Acceptance criteria and audit deliverables.
3. **Database Architecture & PostgreSQL Catalogs**: Catalog definitions for `pg_policies`, `pg_trigger`, `pg_indexes`, and `pg_proc`.
4. **Explorer Survey Reports**: Verbatim code and line references documented in `.agents/explorer_survey_*/handoff.md`.
