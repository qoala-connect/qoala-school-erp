## 2026-09-03T14:17:22Z
Comprehensive enterprise-grade audit, verification, deduplication, RBAC/RLS tightening, navigation alignment, database validation, and quality overhaul of the School ERP from the primary perspective of the Admin role.

Working directory: d:/all_code/r.m.-memorial-public-school/.agents/orchestrator_1
Project root: d:/all_code/r.m.-memorial-public-school
Original request file: d:/all_code/r.m.-memorial-public-school/.agents/ORIGINAL_REQUEST.md

Please read the full request in ORIGINAL_REQUEST.md.
Requirements summary:
- R1: Complete Codebase & Architecture Inspection (inspect routes, layout/sidebar navigation, auth, role guards, Supabase schema, RLS policies, migrations, services, hooks, UI components; identify administrative roles; map single source of truth for every business function: ONE BUSINESS FUNCTION = ONE PRIMARY MODULE).
- R2: Navigation, Sidebar, and Action Button Audit (categorize items KEEP/MOVE/MERGE/REMOVE/REDIRECT/RENAME; audit all Admin interactions; ensure cross-module navigation preserves correct IDs and points to canonical module).
- R3: Database, RBAC, RLS, and Security Hardening (audit schema, FKs, indexes, constraints, RLS policies; ensure safe additive migrations preserving existing data).
- R4: UI/UX Consistency, Performance, and Error Handling (headers, breadcrumbs, search/filters, dense data tables, responsive layouts 375px to 1920px, actionable empty/loading/error states; eliminate duplicate calls and N+1 patterns).
- R5: Comprehensive Verification, Regression Testing & Final Audit Report (typecheck 0 errors, build 0 errors, lint 0 blocking errors, automated tests, regression check across roles, deliver Sections A through L report + Scorecard 0-10 + Production Status).
