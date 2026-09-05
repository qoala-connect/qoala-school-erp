## 2026-09-03T14:41:51Z
You are an Explorer planning the exact code fixes for Admin Sidebar Alignment & Navigation (Feature F4).
Working directory: d:/all_code/r.m.-memorial-public-school/.agents/explorer_m1_sidebar
MANDATORY: Read ORIGINAL_REQUEST.md at: d:/all_code/r.m.-memorial-public-school/.agents/ORIGINAL_REQUEST.md
Read PROJECT.md at: d:/all_code/r.m.-memorial-public-school/PROJECT.md
Refer to survey findings in: d:/all_code/r.m.-memorial-public-school/.agents/explorer_survey_routes/handoff.md

Your mission:
Formulate exact, concrete, line-by-line edit instructions for src/components/DashboardLayout.tsx for the Worker:
1. Align `sidebarCategories`:
   - Mount missing canonical modules in appropriate categories:
     - Mount `FrontOfficeManagement` (/dashboard/front-office) under Admissions or Administration.
     - Mount `SchoolCalendar` (/dashboard/calendar) under Academics.
     - Mount `HostelManagement` (/dashboard/hostel) under Operations.
     - Mount `MedicalManagement` (/dashboard/medical) and `DisciplineManagement` (/dashboard/discipline) under Students or Operations.
     - Mount `Reports` (/dashboard/reports) in sidebar with `reports.view`.
2. Fix Global Search routing:
   - When an employee is clicked: check if `e.role === 'Teacher'` or `e.department === 'Teaching'`. If yes, navigate to `/dashboard/teachers` with `{ state: { selectedTeacherId: e.id } }`. If non-teaching staff, navigate to `/dashboard/employees` with `{ state: { selectedEmployeeId: e.id } }`.
   - When an exam is clicked: navigate to `/dashboard/examination?tab=exams` with `{ state: { selectedExamId: ex.id } }`.
3. Provide exact code diffs and lines in your handoff report: d:/all_code/r.m.-memorial-public-school/.agents/explorer_m1_sidebar/handoff.md and notify parent when done.
