## 2026-09-03T14:41:51Z
You are an Explorer planning the exact code fixes for Cross-Module Context & Parameter Preservation (Feature F3).
Working directory: d:/all_code/r.m.-memorial-public-school/.agents/explorer_m1_context
MANDATORY: Read ORIGINAL_REQUEST.md at: d:/all_code/r.m.-memorial-public-school/.agents/ORIGINAL_REQUEST.md
Read PROJECT.md at: d:/all_code/r.m.-memorial-public-school/PROJECT.md
Refer to survey findings in: d:/all_code/r.m.-memorial-public-school/.agents/explorer_survey_routes/handoff.md and explorer_survey_modules/handoff.md

Your mission:
Formulate exact, concrete, line-by-line edit instructions for cross-module linkages and receivers for the Worker:
1. `src/components/students/Student360Drawer.tsx`:
   - In "Collect Fees" buttons (lines 637 & 963), pass `{ state: { activeTab: 'student_fees', selectedStudent: student } }` when navigating to `/dashboard/fees`.
   - In "Issue Certificate" button (line 1201), pass `{ state: { student: { name: student.full_name, admission_number: student.admission_number, class_name: student.class, roll_number: student.roll_number } } }` when navigating to `/dashboard/certificates`.
2. `src/pages/dashboard/Analytics.tsx`:
   - Fix misrouted Quick Actions and Stat Cards:
     - 'View Exam Results' -> `/dashboard/examination?tab=results`
     - 'Download Report Card' -> `/dashboard/examination?tab=reports`
     - 'Library Roster' -> `/dashboard/library`
     - 'Add Educator' (line 954) -> `/dashboard/teachers`
     - 'Total Teachers' stat card (line 287-298) -> `/dashboard/teachers`
3. `src/pages/dashboard/AdmissionsManagement.tsx`:
   - Read `location.state?.statusFilter` using `useLocation()` and initialize or update `statusFilter` so sidebar "Pending Approvals" actually filters to Pending applications.
4. `src/pages/dashboard/CertificateGenerator.tsx`:
   - Read `location.state?.student` using `useLocation()` to populate student details in state instead of hardcoded mock data.
5. `src/pages/dashboard/Employees.tsx`:
   - Read `location.state?.selectedEmployeeId` using `useLocation()` and highlight or filter to the selected employee.
6. `src/pages/dashboard/examination/ExaminationModule.tsx`:
   - Read `location.state?.selectedExamId` using `useLocation()` and activate the relevant exam.
7. Write your complete handoff report with exact before/after snippets to: d:/all_code/r.m.-memorial-public-school/.agents/explorer_m1_context/handoff.md and notify parent when done.
