# BRIEFING — 2026-09-03T14:33:00Z

## Mission
Comprehensive audit of routes, layouts, navigation, auth & role guards for the Admin role in School ERP.

## 🔒 My Identity
- Archetype: explorer
- Roles: Codebase Researcher (routes, layout, navigation, auth & role guards)
- Working directory: d:/all_code/r.m.-memorial-public-school/.agents/explorer_survey_routes
- Original parent: 0e9e073b-ea16-4a01-a740-bced5edebea4
- Milestone: Explorer Survey Routes & Auth

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Inspect router configuration, layouts, sidebar/navbar, auth & role guards
- Categorize navigation items (KEEP, MOVE, MERGE, REMOVE, REDIRECT, RENAME)
- Check cross-module navigation paths & ID preservation
- Produce self-contained handoff.md with 5-component structure

## Current Parent
- Conversation ID: 0e9e073b-ea16-4a01-a740-bced5edebea4
- Updated: 2026-09-03T14:33:00Z

## Investigation State
- **Explored paths**:
  - `src/App.tsx` (all 73 routes, redirects, ProtectedRoute)
  - `src/context/AuthContext.tsx` (AppRole union, can(), my_permissions RPC)
  - `src/components/Can.tsx` (Can, usePermission, PERMISSION_CATALOGUE)
  - `src/components/DashboardLayout.tsx` (Sidebar categories, search overlay, quick actions, header)
  - `src/components/Navbar.tsx` (Public navigation)
  - `src/pages/dashboard/AcademicsManagement.tsx` (URL sub-view architecture)
  - `src/pages/dashboard/SystemManagement.tsx` (Sub-views and RBAC)
  - `src/pages/dashboard/Students.tsx` and `Student360Drawer.tsx`
  - `src/pages/dashboard/FeesPortal.tsx` and `FeeStructureManager.tsx`
  - `src/pages/dashboard/examination/ExaminationModule.tsx`
  - `src/pages/dashboard/Teachers.tsx` and `Employees.tsx`
  - `src/pages/dashboard/AttendanceEntry.tsx`
  - `src/pages/dashboard/AdmissionsManagement.tsx`
  - `src/pages/dashboard/CertificateGenerator.tsx`
  - Orphaned pages: `DatabaseManager.tsx`, `RoleAndUserManager.tsx`, `GoogleClassroomManager.tsx`, `GoogleFormsManager.tsx`, `Settings.tsx`, `SeatingPlanView.tsx`, `EnquiriesPipeline.tsx`, `AdmissionReports.tsx`
  - Missing from sidebar: `HostelManagement.tsx`, `Reports.tsx`, `FrontOfficeManagement.tsx`, `SchoolCalendar.tsx`, `MedicalManagement.tsx`, `DisciplineManagement.tsx`, `OnlineClasses.tsx`, `AIAssistant.tsx`
- **Key findings**:
  - Multiple ID preservation failures (Student 360 -> Fees drops student context, Global Search -> Employees drops employee/teacher context, Global Search -> Exams drops exam ID, Analytics quick actions misrouted).
  - Orphaned & duplicate components documented.
  - Inconsistent route guards on Operations modules (`library`, `transport`, `inventory`, `communication`, `certificates`, `hostel` have NO permission guards on routes or sidebar items).
  - Fragile router-state tab selection in Financials and Operations modules.
- **Unexplored areas**: None. Codebase survey complete.

## Key Decisions Made
- Proceeding to draft exhaustive, structured handoff.md following 5-component protocol.

## Artifact Index
- handoff.md — Comprehensive findings and recommendations
