# Worker M2 Dispatch: Database, Schema, RBAC, RLS & Security Hardening

Working directory: d:/all_code/r.m.-memorial-public-school/.agents/worker_m2
MANDATORY: Read ORIGINAL_REQUEST.md at d:/all_code/r.m.-memorial-public-school/.agents/ORIGINAL_REQUEST.md
Read PROJECT.md at d:/all_code/r.m.-memorial-public-school/PROJECT.md
Read DB Survey Handoff at d:/all_code/r.m.-memorial-public-school/.agents/explorer_survey_db/handoff.md

Your exclusive write ownership:
1. `supabase/migrations/20260903_admin_database_security_hardening.sql` (create this migration file with the complete SQL migration from explorer_survey_db/handoff.md Section 3).
2. Live Supabase database application (execute the migration SQL against the live database).
3. `server.ts` (fix line 34 query from 'fees' to 'student_fees').
4. `src/services/teacherService.ts` (fix employee_id generation race condition).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Verification:
- Run `npx tsc --noEmit` -> 0 errors.
- Run `npm run build` -> 0 errors.
- Run E2E tests:
  - `npx tsx tests/run-all.ts --feature=F5`
  - `npx tsx tests/run-all.ts --feature=F6`
  - `npx tsx tests/run-all.ts --feature=F7`
  - `npx tsx tests/run-all.ts --feature=F8`
  - `npx tsx tests/run-all.ts --feature=F9`
- Write your complete handoff report to `d:/all_code/r.m.-memorial-public-school/.agents/worker_m2/handoff.md`.

## 2026-09-03T16:53:27Z
You are Worker M2 implementing Milestone 2: Database, Schema, RBAC, RLS & Security Hardening (Features F5, F6, F7, F8, F9).
Working directory: d:/all_code/r.m.-memorial-public-school/.agents/worker_m2
MANDATORY: Read ORIGINAL_REQUEST.md at: d:/all_code/r.m.-memorial-public-school/.agents/ORIGINAL_REQUEST.md
Read PROJECT.md at: d:/all_code/r.m.-memorial-public-school/PROJECT.md
Read DISPATCH.md at: d:/all_code/r.m.-memorial-public-school/.agents/worker_m2/DISPATCH.md
Read DB Survey Handoff at: d:/all_code/r.m.-memorial-public-school/.agents/explorer_survey_db/handoff.md

Your tasks:
1. Create canonical migration file `supabase/migrations/20260903_admin_database_security_hardening.sql` containing the complete additive migration from Section 3 of `explorer_survey_db/handoff.md` (hardening RLS policies on disciplinary_records, front_office_logs, online_classes, fee_payments, leave_requests, gallery, notices, user_roles, receipt_counters; guarding profiles trigger and teachers trigger; indexing 22 FKs; dropping 10 duplicate indexes; updating views fee_collection_summary and pending_fees_summary_view).
2. Execute/apply this migration to the database using Supabase CLI, psql, or a node execution script with postgres/supabase credentials, verifying every statement succeeds.
3. Update `server.ts:34`: change `supabase.from('fees')` to `supabase.from('student_fees')`.
4. Update `src/services/teacherService.ts:241`: replace memory count generation for `employee_id` with safe generation (e.g. max sequence query or timestamp/random collision-resistant sequence).
5. Verification:
   - `npx tsc --noEmit`
   - `npm run build`
   - `npx tsx tests/run-all.ts --feature=F5`
   - `npx tsx tests/run-all.ts --feature=F6`
   - `npx tsx tests/run-all.ts --feature=F7`
   - `npx tsx tests/run-all.ts --feature=F8`
   - `npx tsx tests/run-all.ts --feature=F9`

