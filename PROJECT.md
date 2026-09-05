# Project: School ERP Admin Audit, Deduplication & Security Hardening

## Architecture
The School ERP is a React 18 + Vite + TypeScript single-page application backed by PostgreSQL and Supabase.
- **Routing & Layout**: React Router DOM v6, `DashboardLayout.tsx` with collapsible sidebar, role-based navigation guards via `ProtectedRoute.tsx` and `Can.tsx`.
- **Authentication & RBAC**: PostgreSQL enum `app_role` (16 roles), database-level `role_permissions` table, `is_admin()`, `is_staff()`, `auth_has_permission()`, and frontend `useAuth()`.
- **Database Architecture**: PostgreSQL public schema with 76 base tables (100% RLS enabled) and 24 views (`security_invoker = on`).
- **Core Principle**: **ONE BUSINESS FUNCTION = ONE PRIMARY MODULE**. Every business domain has exactly one canonical primary module; no duplicate Admin CRUD pages or divergent tables.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Route Security & Permission Guards | Enforce `allowedPermission` on all operations routes in `App.tsx` (/dashboard/transport, /dashboard/library, /dashboard/inventory, /dashboard/hostel, /dashboard/communication, /dashboard/certificates, /dashboard/front-office, etc.) | M1 | Survey (Routes Explorer) |
| F2 | Route Deduplication & Obsolete Cleanup | Remove thin shims (/dashboard/exam, /dashboard/marks), remove unreferenced imports (DatabaseManager, RoleAndUserManager, GoogleClassroomManager, GoogleFormsManager), remove/retire dead mockup files (Settings.tsx, RoleAndUserManager.tsx, DatabaseManager.tsx) | M1 | Survey (Routes & Modules) |
| F3 | Cross-Module Context & ID Preservation | Fix context drops: Student 360 -> Fees (pass student ID), Global Search -> Employees/Teachers (preserve selectedEmployeeId & route to /dashboard/teachers for faculty), Global Search -> Exams, Analytics Quick Actions misdirections, Admissions state filter, Student 360 -> Certificates (pass student credentials) | M1 | Survey (Routes Explorer) |
| F4 | Admin Sidebar Alignment & Categorization | Align `DashboardLayout.tsx` sidebar items according to KEEP/MOVE/MERGE/REMOVE/REDIRECT/RENAME audit; mount missing canonical modules (Hostel, Front Office, Reports, Calendar, Medical, Discipline) | M1 | Survey (Routes & Modules) |
| F5 | Critical RLS Write Leak Elimination | Fix `disciplinary_records`, `front_office_logs`, and `online_classes` RLS policies from `USING (true) WITH CHECK (true)` to staff/admin role checks | M2 | Survey (DB Explorer) |
| F6 | Privilege Escalation & Self-Reactivation Guard | Fix `guard_profile_role_change` trigger on `profiles` to block status mutation by non-admins; add trigger on `teachers` to prevent self-escalation on status/is_active/designation | M2 | Survey (DB Explorer) |
| F7 | Role Lockout & Silent Failure Elimination | Fix `fee_payments` RLS for accountants and add owner select policy; fix `leave_requests` RLS for teachers; fix `gallery`, `notices`, `user_roles` legacy role checks for super_admin & principal; fix `receipt_counters` RLS | M2 | Survey (DB Explorer) |
| F8 | Database Indexing & Relational Hardening | Add 22 missing foreign key B-tree indexes; drop 10 redundant duplicate indexes; update stale views (`fee_collection_summary`, `pending_fees_summary_view`) to query `student_fees` | M2 | Survey (DB Explorer) |
| F9 | AI Grounding & Service Query Fixes | Fix `server.ts:34` query from non-existent `fees` to `student_fees`; fix teacherService employee_id generation race condition | M2 | Survey (DB & Modules) |
| F10 | Action Button Interactivity & Real Operations | Replace fake toast-only saves and dead mockups (`Reports.tsx` real report downloads; `TransportManagement.tsx` student_id linking; `MedicalManagement.tsx` student_id linking; `SchoolCalendar.tsx` holiday column fix; clean up dead mock tabs in Library/Inventory/Communication) | M3 | Survey (Modules Explorer) |
| F11 | UI/UX Consistency, Breadcrumbs & State Feedback | Add breadcrumb navigation across all Admin pages; ensure consistent dense tables, responsive layouts (375px to 1920px), and clear loading/empty/error states | M3 | Survey (Modules Explorer) |
| F12 | Query Performance & Pagination | Introduce bounded queries/pagination for unbounded fetches in `admissionService`, `feeService`, and `teacherService` | M3 | Survey (DB Explorer) |
| F13 | Full Verification, Quality Gate & Final Report | 0 TypeScript errors (`tsc --noEmit`), 0 build errors (`npm run build`), 0 lint blockers (`npm run lint`), passing E2E test suite, and comprehensive Final Audit Report (Sections A through L, Scorecard 0-10, Production Readiness) | M4 | Survey & ORIGINAL_REQUEST |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Suite Track | Design opaque-box test infrastructure and Tiers 1-4 test cases covering all features F1-F13; publish TEST_READY.md | none | DONE |
| M1 | Navigation Alignment, Route Security & Deduplication | F1, F2, F3, F4 | none | DONE |
| M2 | Database, Schema, RBAC, RLS & Security Hardening | F5, F6, F7, F8, F9 | none | DONE |
| M3 | UI/UX Consistency, Action Authenticity & Performance | F10, F11, F12 | M1, M2 | DONE |
| M4 | Verification, Quality Gate & Comprehensive Audit Report | F13, pass 100% E2E tests, audit sections A-L | E2E, M1, M2, M3 | DONE |

## Interface Contracts
### Routing & Navigation
- Route guards in `App.tsx` must use `allowedPermission` strings mapped to PostgreSQL `role_permissions` (e.g. `transport.manage`, `library.manage`, `inventory.manage`, `hostel.manage`, `communication.manage`, `certificates.manage`).
- Navigation state contracts:
  - Student 360 -> Fees: `navigate('/dashboard/fees', { state: { activeTab: 'student_fees', selectedStudent: student } })`. `FeesPortal.tsx` must auto-select student and open collection modal.
  - Global Search -> Employees: If role === 'Teacher', navigate to `/dashboard/teachers` with `{ state: { selectedTeacherId: id } }`. If staff, navigate to `/dashboard/employees` with `{ state: { selectedEmployeeId: id } }`.
  - Global Search -> Exams: `navigate('/dashboard/examination?tab=exams', { state: { selectedExamId: id } })`. `ExaminationModule.tsx` must open/highlight selected exam.
  - Admissions Filter: `navigate('/dashboard/admissions', { state: { statusFilter: 'Pending' } })`. `AdmissionsManagement.tsx` reads `location.state.statusFilter`.
  - Student 360 -> Certificates: `navigate('/dashboard/certificates', { state: { student: { name, admission_number, class_name, roll_number } } })`. `CertificateGenerator.tsx` populates certificate fields with these values.

### Database & RLS Contracts
- `is_admin()` returns true for `super_admin`, `admin`, `principal`.
- `is_staff()` includes all school employees.
- RLS policies must never use unconditional `true` for mutating operations (`INSERT`, `UPDATE`, `DELETE`).
- Canonical tables: `student_fees` (not `fees`), `fee_structure` (not `class_fee_structure`), `teacher_assignments` (not `class_teachers`).

## Code Layout
- `src/App.tsx`: Central router configuration and permission guards.
- `src/components/layout/DashboardLayout.tsx`: Top bar, search overlay, and role-based sidebar.
- `src/pages/dashboard/`: Primary canonical module views.
- `src/components/`: Modular child views, modals, drawers, and tabs.
- `src/services/`: Supabase query and RPC service layer.
- `supabase/migrations/`: Canonical SQL migration files.
