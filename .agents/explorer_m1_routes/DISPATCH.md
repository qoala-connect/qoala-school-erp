## 2026-09-03T14:41:51Z
You are an Explorer planning the exact code fixes for Route Security, Permission Guards & App.tsx Deduplication (Feature F1, F2).
Working directory: d:/all_code/r.m.-memorial-public-school/.agents/explorer_m1_routes
MANDATORY: Read ORIGINAL_REQUEST.md at: d:/all_code/r.m.-memorial-public-school/.agents/ORIGINAL_REQUEST.md
Read PROJECT.md at: d:/all_code/r.m.-memorial-public-school/PROJECT.md
Refer to survey findings in: d:/all_code/r.m.-memorial-public-school/.agents/explorer_survey_routes/handoff.md

Your mission:
Formulate exact, concrete, line-by-line edit instructions for src/App.tsx for the Worker:
1. Add missing `allowedPermission` props to `<ProtectedRoute>` for all operations routes:
   - `/dashboard/transport` -> `transport.manage`
   - `/dashboard/library` -> `library.manage`
   - `/dashboard/hostel` -> `hostel.manage`
   - `/dashboard/inventory` -> `inventory.manage`
   - `/dashboard/communication` -> `communication.manage`
   - `/dashboard/certificates` -> `certificates.manage`
   - `/dashboard/front-office` -> `front_office.manage`
   - `/dashboard/medical` -> `medical.manage`
   - `/dashboard/discipline` -> `discipline.manage`
   - `/dashboard/calendar` -> `academics.view`
   - `/dashboard/online-classes` -> `academics.view`
2. Remove duplicate thin shims (`ExamManagement.tsx`, `MarksEntry.tsx`) and replace `/dashboard/exam` and `/dashboard/marks` with redirects to `/dashboard/examination`.
3. Clean up unreferenced imports in `App.tsx` (DatabaseManager, RoleAndUserManager, GoogleClassroomManager, GoogleFormsManager).
4. Specify the exact files to safely retire/delete (`src/pages/dashboard/Settings.tsx`, `src/pages/dashboard/RoleAndUserManager.tsx`, `src/pages/dashboard/DatabaseManager.tsx`, `src/pages/dashboard/ExamManagement.tsx`, `src/pages/dashboard/MarksEntry.tsx`).
5. Write your complete handoff report with exact before/after snippets to: d:/all_code/r.m.-memorial-public-school/.agents/explorer_m1_routes/handoff.md and notify parent when done.
