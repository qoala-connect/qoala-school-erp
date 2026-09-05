# Original User Request

## Initial Request — 2026-09-03T14:13:18Z

Comprehensive enterprise-grade audit, verification, deduplication, RBAC/RLS tightening, navigation alignment, database validation, and quality overhaul of the School ERP from the primary perspective of the Admin role.

Working directory: d:/all_code/r.m.-memorial-public-school
Integrity mode: development

## Requirements

### R1. Complete Codebase & Architecture Inspection (No Assumptions)
- Thoroughly inspect all routes, layout/sidebar navigation, authentication, role guards, Supabase database schema, RLS policies, migrations, services, hooks, and UI components.
- Identify the exact administrative roles (e.g. `super_admin`, `admin`, `principal`, `accountant`, etc.), permissions, and route guards.
- Map the single source of truth for every business function (Admissions, Students, Academics, Teacher Management, Attendance, Examination, Fees & Finance, Library, Transport, Inventory, Communication, Certificates/ID, Reports, System/Settings). Enforce the rule: **ONE BUSINESS FUNCTION = ONE PRIMARY MODULE** (no duplicate Admin-specific CRUD pages or tables).

### R2. Navigation, Sidebar, and Action Button Audit
- Audit the Admin sidebar: categorize every navigation item (KEEP, MOVE, MERGE, REMOVE, REDIRECT, RENAME) to eliminate clutter and duplication.
- Audit all Admin-visible UI interactions: buttons, links, dropdowns, table actions, cards, and tabs. Verify that all clickable elements execute their intended operations (Create, Edit, Delete/Archive, View, Approve, Reject, Assign, Export, Print) without dead links or fake interactions.
- Ensure cross-module navigation preserves correct IDs and always points to the central source-of-truth module (e.g. Student 360, Fees, Attendance, Examination).

### R3. Database, RBAC, RLS, and Security Hardening
- Audit database schema, foreign keys, indexes, constraints, and RLS policies for every Admin workflow.
- Ensure Admin operations have appropriate data integrity checks, correct foreign key relations, and safe RLS policies without accidentally granting unpermitted access to non-administrative roles or causing silent failures.
- If database adjustments are needed, create safe, additive migrations that preserve existing data.

### R4. UI/UX Consistency, Performance, and Error Handling
- Ensure consistent page headers, breadcrumbs, search/filters, dense data tables, responsive layouts (from 375px mobile to 1920px desktop), and actionable empty/loading/error states across all Admin-accessible modules.
- Eliminate duplicate API calls, N+1 query patterns, and unbounded queries.

### R5. Comprehensive Verification, Regression Testing & Final Audit Report
- Run build, TypeScript compilation, linting, and automated tests.
- Verify regressions across other roles (Teacher, Accountant, Student, Parent, etc.).
- Deliver a comprehensive Final Audit Report and Scorecard (covering categories 0–10, summary of good/broken/missing/duplicated items, button & navigation audits, database schema changes, migrations, and final production readiness status P0—P3).

## Acceptance Criteria

### Quality & Architecture
- [ ] TypeScript type checks (`tsc --noEmit` or `npm run typecheck`) pass with 0 errors.
- [ ] Production build (`npm run build` or `vite build`) completes successfully with 0 build errors.
- [ ] Linting (`npm run lint`) passes with 0 blocking errors.
- [ ] Zero duplicate module implementations (e.g. no parallel Admin-only student/fee CRUD when canonical modules exist).
- [ ] All clickable buttons, quick actions, cards, and links across Admin views perform real operations or navigate to genuine canonical routes with preserved IDs.

### Security & Database
- [ ] Database queries, RLS policies, and route guards accurately enforce administrative privileges without exposing sensitive operations to unauthorized roles.
- [ ] Safe, additive migrations are provided for any schema adjustments.
- [ ] Proper loading, empty, and error feedback across all major Admin mutations.

### Documentation & Reporting
- [ ] Detailed final report delivered covering Sections A through L, Final Scorecard (0–10), and Production Status (READY / NOT READY with P0–P3 blockers).