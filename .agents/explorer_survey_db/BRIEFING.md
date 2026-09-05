# BRIEFING — 2026-09-03T14:38:00Z

## Mission
Comprehensive Admin Database & Security audit: migrations, RLS policies, RBAC, FKs/indexes, query performance, and safe additive migration proposals.

## 🔒 My Identity
- Archetype: explorer
- Roles: Database & Security Researcher
- Working directory: d:/all_code/r.m.-memorial-public-school/.agents/explorer_survey_db
- Original parent: 0e9e073b-ea16-4a01-a740-bced5edebea4
- Milestone: Initial Explorer Survey — Database Schema, RLS & Query Performance

## 🔒 Key Constraints
- Read-only investigation — do NOT implement source changes directly
- Output structured findings to .agents/explorer_survey_db/handoff.md
- Produce safe, additive migration recommendations
- Keep messages concise, report via send_message to parent

## Current Parent
- Conversation ID: 0e9e073b-ea16-4a01-a740-bced5edebea4
- Updated: 2026-09-03T14:38:00Z

## Investigation State
- **Explored paths**:
  - PostgreSQL schema via live MCP connection (`supabase-postgres` tool `query`)
  - 25 Supabase migration files in project root
  - Frontend services: `src/services/admissionService.ts`, `academicsService.ts`, `feeService.ts`, `teacherService.ts`, `analyticsService.ts`
  - Core components: `DatabaseManager.tsx`, `Student360Drawer.tsx`, `AttendanceEntry.tsx`
  - RBAC functions, RLS policies, triggers, and views
- **Key findings**:
  1. 76 base tables, all with RLS enabled; 24 views with `security_invoker=on`.
  2. 3 Critical RLS leaks: `disciplinary_records` (`disciplinary_staff_all`), `front_office_logs` (`front_office_staff_all`), and `online_classes` (`online_classes_staff_all`) all have `USING (true) WITH CHECK (true)` allowing unpermitted client tampering.
  3. Privilege Escalation / Self-Reactivation: `profiles` trigger `guard_profile_role_change` checks only `NEW.role`, allowing suspended users to self-reactivate (`status = 'active'`) via `profiles_self_update`. Similarly, `teachers_self_update` allows teachers to update `status` and `is_active` without any guard trigger.
  4. Silent RLS Denials / Lockouts: `fee_payments` lacks owner select policy (students/parents cannot see payments/receipts) and lacks staff policy for accountants; `leave_requests` is admin-only, blocking teachers during attendance marking; `user_roles_admin_all`, `gallery_admin_all`, and `notices_admin_all` lock out `super_admin` and `principal`.
  5. Missing Policies: `receipt_counters` and `temp_inspect_results` have RLS enabled with 0 policies.
  6. Performance & Indexing: 22 foreign keys lack indexes (including `disciplinary_records.student_id` which affects Student 360); 7 redundant/duplicate index sets exist.
  7. Orphaned/Dead Schema: `fees` (0 rows) and `class_fee_structure` (3 rows) superseded by `student_fees` and `fee_structure`; `class_teachers` (4 rows) superseded by `teacher_assignments`; `temp_inspect_results` scratch table; views `fee_collection_summary` and `pending_fees_summary_view` brokenly query dead `fees` table.
  8. Fake UI Simulation: `DatabaseManager.tsx` catches `exec_sql` RPC error and fakes 100% successful migration in `localStorage`.
- **Unexplored areas**: None. Complete coverage achieved across all tables, policies, indexes, and services.

## Key Decisions Made
- Formulate complete, safe additive migration script to harden RLS, add missing FK indexes, and fix view dependencies.

## Artifact Index
- d:/all_code/r.m.-memorial-public-school/.agents/explorer_survey_db/handoff.md — Final 5-component report
- d:/all_code/r.m.-memorial-public-school/.agents/explorer_survey_db/progress.md — Liveness heartbeat
- d:/all_code/r.m.-memorial-public-school/.agents/explorer_survey_db/BRIEFING.md — Persistent context
- d:/all_code/r.m.-memorial-public-school/.agents/explorer_survey_db/DISPATCH.md — Received requests
