# BRIEFING — 2026-09-03T14:52:00Z

## Mission
Formulate exact, concrete, line-by-line edit instructions for src/components/DashboardLayout.tsx for Admin Sidebar Alignment & Navigation (Feature F4)

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: d:/all_code/r.m.-memorial-public-school/.agents/explorer_m1_sidebar
- Original parent: 0e9e073b-ea16-4a01-a740-bced5edebea4
- Milestone: Milestone 1: Core Navigation & Route Reconciliation (F4)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Plan exact, concrete, line-by-line edit instructions for src/components/DashboardLayout.tsx for the Worker
- Produce 5-component handoff report

## Current Parent
- Conversation ID: 0e9e073b-ea16-4a01-a740-bced5edebea4
- Updated: not yet

## Investigation State
- **Explored paths**:
  - src/components/DashboardLayout.tsx (inspected sidebarCategories lines 108-265, search context lines 305-356, search render lines 560-664)
  - src/App.tsx (inspected routes lines 150-370)
  - src/components/Can.tsx (inspected PERMISSION_CATALOGUE lines 47-59)
  - supabase_rbac_migration_02b.sql (inspected role permissions)
  - src/pages/dashboard/HostelManagement.tsx (inspected tabs & structure)
  - src/pages/dashboard/Reports.tsx (inspected categories & header)
  - src/pages/dashboard/Teachers.tsx (inspected view modes and state)
  - src/pages/dashboard/Analytics.tsx (inspected navigation links)
- **Key findings**:
  - 5 modules missing from sidebarCategories: FrontOfficeManagement (/dashboard/front-office), SchoolCalendar (/dashboard/calendar), HostelManagement (/dashboard/hostel), MedicalManagement (/dashboard/medical), DisciplineManagement (/dashboard/discipline), Reports (/dashboard/reports).
  - Global Search unconditionally navigates to /dashboard/employees on employee click; doesn't distinguish teachers from staff.
  - Exam click in Global Search already specifies /dashboard/examination?tab=exams with selectedExamId state.
  - Quick action Marks Entry links to legacy /dashboard/marks instead of canonical /dashboard/examination?tab=marks.
  - Existing imports include Home as HomeIcon and BarChart3; no new icon imports required.
  - Baseline `npm run lint` (`tsc --noEmit`) passes with 0 errors.
- **Unexplored areas**: None; full file analysis complete.

## Key Decisions Made
- Mount FrontOfficeManagement under Admissions as 'Front Office Desk' with permission 'student.create' (accessible to receptionists, principals, admins).
- Mount SchoolCalendar under Academics as 'School Calendar' with permission null.
- Mount MedicalManagement ('Student Health & Medical') and DisciplineManagement ('Disciplinary Records') under Students with permission 'student.view' (accessible to faculty and admins; also documented Operations alternative).
- Mount HostelManagement under new Operations category as 'Hostel Management' with permission 'hostel.manage' using HomeIcon.
- Mount Reports under Reports category as 'Reports Center' with permission 'reports.view' using BarChart3.
- In Global Search: tag employees on fetch with role: 'Teacher' / role: 'Staff'; on click check e.role === 'Teacher' || e.department === 'Teaching' and navigate to /dashboard/teachers with selectedTeacherId, else /dashboard/employees with selectedEmployeeId.

## Artifact Index
- handoff.md — Complete 5-component report with line-by-line diffs
- progress.md — Heartbeat and activity log
- DISPATCH.md — Received instructions
