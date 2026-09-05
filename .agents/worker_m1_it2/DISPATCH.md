# Worker M1 Iteration 2 Dispatch: M1 Remediation

Working directory: d:/all_code/r.m.-memorial-public-school/.agents/worker_m1_it2
MANDATORY: Read ORIGINAL_REQUEST.md at d:/all_code/r.m.-memorial-public-school/.agents/ORIGINAL_REQUEST.md
Read PROJECT.md at d:/all_code/r.m.-memorial-public-school/PROJECT.md
Read soft handoff at d:/all_code/r.m.-memorial-public-school/.agents/orchestrator_1/handoff.md

Tasks:
1. `src/components/DashboardLayout.tsx`:
   - Align labels to match test suite in `tests/tier1/f04_sidebar_align.test.ts`:
     - Label `'Front Office'` (from `'Front Office Desk'`), permission: `'front_office.manage'`
     - Label `'Hostel'` (from `'Hostel Management'`), permission: `'hostel.manage'`
     - Label `'Medical'` (from `'Student Health & Medical'`), permission: `'medical.manage'`
     - Label `'Discipline'` (from `'Disciplinary Records'`), permission: `'discipline.manage'`
     - Label `'Reports'` (from `'Reports Center'`), permission: `'reports.view'`
   - Align category permissions to prevent unauthorized traps for non-admin roles:
     - `Library`: `permission: 'library.manage'`
     - `Transport`: `permission: 'transport.manage'`
     - `Inventory & Assets`: `permission: 'inventory.manage'`
     - `Communication`: `permission: 'communication.manage'`
     - `Certificates & ID` item `Issue Credentials`: `permission: 'certificates.manage'`
     - Footer `System`: conditionally render only when `can('settings.manage')` is true.
2. `src/pages/dashboard/Teachers.tsx`:
   - Import `useLocation` from `react-router-dom`.
   - Ingest `location.state?.selectedTeacherId`.
   - When present, filter or highlight the teacher in the list with a dismissible banner ("Filtered to selected teacher from search [Show All Teachers]"), mirroring the pattern in `Employees.tsx`.
3. `src/components/students/Student360Drawer.tsx:649`:
   - Update Overview marks shortcut from `/dashboard/marks` to `/dashboard/examination?tab=marks`.

Mandatory Integrity Warning:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Verification:
- Run `npx tsc --noEmit` -> 0 errors.
- Run `npm run build` -> 0 errors.
- Run `npx tsx tests/run-all.ts --feature=F4` -> 100% pass.
- Write handoff report to `d:/all_code/r.m.-memorial-public-school/.agents/worker_m1_it2/handoff.md`.

## 2026-09-03T16:33:22Z
You are Worker M1 (Iteration 2) executing remediation for Milestone 1.
Working directory: d:/all_code/r.m.-memorial-public-school/.agents/worker_m1_it2
MANDATORY: Read ORIGINAL_REQUEST.md at: d:/all_code/r.m.-memorial-public-school/.agents/ORIGINAL_REQUEST.md
Read PROJECT.md at: d:/all_code/r.m.-memorial-public-school/PROJECT.md
Read DISPATCH.md at: d:/all_code/r.m.-memorial-public-school/.agents/worker_m1_it2/DISPATCH.md
Read soft handoff at: d:/all_code/r.m.-memorial-public-school/.agents/orchestrator_1/handoff.md

Your exclusive write ownership for this iteration:
1. `src/components/DashboardLayout.tsx`
2. `src/pages/dashboard/Teachers.tsx`
3. `src/components/students/Student360Drawer.tsx`

