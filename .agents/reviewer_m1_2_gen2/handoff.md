# Independent Quality & Adversarial Review Report: Milestone 1

**Reviewer:** Reviewer M1-2 (Gen 2)  
**Roles:** Reviewer, Adversarial Critic  
**Date:** 2026-09-03  
**Target Milestone:** Milestone 1 (Features F1, F2, F3, F4)  
**Implementation Agent Under Review:** Worker M1  
**Verdict:** **REQUEST_CHANGES**  

---

## Review Summary

While Worker M1 has delivered high-quality code in several key areas—such as clean TypeScript compilation (`npx tsc --noEmit` exited 0), successful production bundling (`npm run build` exited 0 with 3280 modules transformed), complete removal of 5 obsolete files, and robust cross-module router state contracts—an independent adversarial review specifically targeting non-administrative roles (teachers, staff, students, parents) reveals **critical authorization regressions** and **sidebar-to-route permission mismatches** that break core navigation for non-admin users.

Specifically:
1. **Critical Route Lockout (`academics.view`)**: `/dashboard/calendar` and `/dashboard/online-classes` in `src/App.tsx` were guarded by `allowedPermission="academics.view"`. In the canonical database permissions seed (`supabase_rbac_migration_02b.sql`), **no standard role** (not `teacher`, `class_teacher`, `accountant`, `staff`, `student`, `parent`, or even `admin`/`principal`) possesses `academics.view`. Meanwhile, in `DashboardLayout.tsx:157`, "School Calendar" is exposed to all authenticated users with `permission: null`. Consequently, every teacher, staff member, parent, student, and administrator (except `super_admin` who has `*`) who clicks "School Calendar" in the sidebar is immediately kicked to `/unauthorized`.
2. **Sidebar-to-Route Permission Mismatches**: In `src/components/DashboardLayout.tsx`, items for "Front Office Desk", "Student Health & Medical", and "Disciplinary Records" are gated on different permissions (`student.create`, `student.view`, `student.view`) than their corresponding route guards in `src/App.tsx` (`front_office.manage`, `medical.manage`, `discipline.manage`). Users with read access (e.g. teachers, class teachers, students, parents) see Medical and Discipline in the sidebar, but clicking them leads directly to a 403 / unauthorized error.
3. **Context Shortcut Disconnect**: In `src/components/students/Student360Drawer.tsx:649`, the "Marks Entry" shortcut still navigates to `/dashboard/marks` without tab context, bypassing the canonical `/dashboard/examination?tab=marks`.

---

## 1. Observation

### 1.1. Build and Static Verification Observations
- **TypeScript Typecheck**:
  Command: `npx tsc --noEmit`
  Result: Exited with code 0 (0 errors).
- **Production Bundle**:
  Command: `npm run build`
  Result: Exited with code 0 (3280 modules transformed; generated `dist/assets/index-VMowmlln.js` [3,261.74 kB] and `dist/server.cjs` [10.5 kB]).
- **Orphaned File Deletion**:
  Verified the complete absence of:
  - `src/pages/dashboard/Settings.tsx` (0 matches)
  - `src/pages/dashboard/RoleAndUserManager.tsx` (0 matches)
  - `src/pages/dashboard/DatabaseManager.tsx` (0 matches)
  - `src/pages/dashboard/ExamManagement.tsx` (0 matches)
  - `src/pages/dashboard/MarksEntry.tsx` (0 matches)

### 1.2. Codebase Discrepancies & Direct Line Quotes
1. **School Calendar Route vs Sidebar Permission Mismatch**:
   - In `src/App.tsx:283-289`:
     ```tsx
     <Route 
       path="/dashboard/calendar" 
       element={
         <ProtectedRoute allowedPermission="academics.view">
           <DashboardLayout children={<SchoolCalendar />} />
         </ProtectedRoute>
       } 
     />
     ```
   - In `src/components/DashboardLayout.tsx:146-158`:
     ```tsx
     title: 'Academics',
     icon: BookOpen,
     permission: null,
     items: [
       ...
       { label: 'School Calendar', path: '/dashboard/calendar', permission: null }
     ]
     ```
   - In `supabase_rbac_migration_02b.sql:94-142`:
     `academics.view` is NOT granted to `teacher`, `class_teacher`, `office_staff`, `accountant`, `student`, `parent`, `admin`, or `principal`. Only `super_admin` (`*`) possesses it.
2. **Medical & Discipline Permission Mismatches**:
   - In `src/App.tsx:291-305`:
     ```tsx
     <Route path="/dashboard/medical" element={<ProtectedRoute allowedPermission="medical.manage"><DashboardLayout children={<MedicalManagement />} /></ProtectedRoute>} />
     <Route path="/dashboard/discipline" element={<ProtectedRoute allowedPermission="discipline.manage"><DashboardLayout children={<DisciplineManagement />} /></ProtectedRoute>} />
     ```
   - In `src/components/DashboardLayout.tsx:130-139`:
     ```tsx
     title: 'Students',
     icon: Users,
     permission: 'student.view',
     items: [
       { label: 'Student Directory & SIS', path: '/dashboard/students', permission: 'student.list' },
       { label: 'Alumni & Transferred', path: '/dashboard/students', state: { statusFilter: 'all' }, permission: 'student.list' },
       { label: 'Student Health & Medical', path: '/dashboard/medical', permission: 'student.view' },
       { label: 'Disciplinary Records', path: '/dashboard/discipline', permission: 'student.view' }
     ]
     ```
   - In `supabase_rbac_migration_02b.sql:119-142`:
     `teacher`, `class_teacher`, `student`, `parent`, `receptionist`, `office_staff` all hold `student.view`.
3. **Front Office Desk Permission Mismatches**:
   - In `src/App.tsx:307-313`:
     ```tsx
     <Route path="/dashboard/front-office" element={<ProtectedRoute allowedPermission="front_office.manage"><DashboardLayout children={<FrontOfficeManagement />} /></ProtectedRoute>} />
     ```
   - In `src/components/DashboardLayout.tsx:119-127`:
     ```tsx
     title: 'Admissions',
     icon: GraduationCap,
     permission: 'student.create',
     items: [
       { label: 'Direct Enrollment', path: '/dashboard/admissions', permission: 'student.create' },
       { label: 'Pending Approvals', path: '/dashboard/admissions', state: { statusFilter: 'Pending' }, permission: 'student.create' },
       { label: 'Front Office Desk', path: '/dashboard/front-office', permission: 'student.create' }
     ]
     ```
4. **Student 360 Drawer Shortcut Context Drop**:
   - In `src/components/students/Student360Drawer.tsx:649-653`:
     ```tsx
     <button
       onClick={() => navigate('/dashboard/marks')}
       className="px-3 py-1.5 bg-white hover:bg-violet-100 text-violet-800 border border-violet-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs"
     >
       <ClipboardList size={13} /> Marks Entry
     </button>
     ```
     Points to legacy redirect `/dashboard/marks` without `?tab=marks`.

---

## 2. Logic Chain

1. **Premise 1 (Calendar Access Contract)**:
   Per `PROJECT.md` and the explicit architecture comment in `DashboardLayout.tsx:141-145`: "Reading is open to any signed-in user; the write controls inside each view are gated on academics.manage, and row level security enforces that independently."
   School Calendar is intended to provide open access to school schedules for students, teachers, and staff.
2. **Premise 2 (Route Protection vs RBAC Reality)**:
   Worker M1 placed `allowedPermission="academics.view"` on `/dashboard/calendar` and `/dashboard/online-classes` in `App.tsx`. Because `academics.view` is nonexistent in `role_permissions` for any regular role, `can('academics.view')` returns `false` for all non-super-admin users.
3. **Inference 1 (Calendar Regression)**:
   Any teacher, student, parent, or staff member clicking "School Calendar" in the sidebar triggers `ProtectedRoute` evaluation in `App.tsx:75` (`if (allowedPermission && !can(allowedPermission)) return <Navigate to="/unauthorized" replace />;`) and gets thrown to `/unauthorized`.
4. **Premise 3 (Sidebar Alignment Contract)**:
   In `DashboardLayout.tsx:311-323`, sidebar items are filtered using `can(item.permission)`. If an item's permission check passes, the UI displays the clickable navigation link.
5. **Inference 2 (Dead Links / 403 Traps)**:
   By assigning `student.view` to "Student Health & Medical" and "Disciplinary Records", any role with `student.view` (e.g. teachers, students, parents) sees these tools in their sidebar. When clicked, navigation to `/dashboard/medical` and `/dashboard/discipline` fails at the route level because `medical.manage` and `discipline.manage` are required. This creates dead links / trap routes in direct violation of `ORIGINAL_REQUEST.md` R2.
6. **Integrity Evaluation**:
   Worker M1 did not hardcode test results, fabricate verification outputs, or create dummy facades. The failures stem from permission string divergence between routes, sidebar definitions, and RBAC seeds, not intentional circumvention.

---

## 3. Detailed Findings

### [Critical] Finding 1: Broken School Calendar & Online Classes Access for Non-Admin Roles
- **What**: `/dashboard/calendar` and `/dashboard/online-classes` lock out teachers, staff, students, parents, and admins with an `/unauthorized` error.
- **Where**: `src/App.tsx:277, 285`
- **Why**: Guarded with `allowedPermission="academics.view"`. No standard role possesses `academics.view` in `role_permissions`. Meanwhile, `DashboardLayout.tsx:157` exposes the calendar link to all users with `permission: null`.
- **Required Fix**:
  - In `src/App.tsx:283-289`, change `/dashboard/calendar` to use bare `<ProtectedRoute>` (without `allowedPermission`), allowing all authenticated users to read the school calendar, matching `/dashboard/academics`.
  - In `src/App.tsx:275-281`, adjust `/dashboard/online-classes` to require `academics.manage` (or bare `<ProtectedRoute>` with internal view permissions), or ensure teachers are granted access.

### [Major] Finding 2: Sidebar Navigation vs Route Guard Permission Mismatches
- **What**: Non-administrative users (teachers, students, parents) see sidebar links that redirect to `/unauthorized` when clicked.
- **Where**: `src/components/DashboardLayout.tsx:126, 136, 137`
- **Why**:
  - `Front Office Desk`: Sidebar checks `student.create`, but route requires `front_office.manage`.
  - `Student Health & Medical`: Sidebar checks `student.view`, but route requires `medical.manage`.
  - `Disciplinary Records`: Sidebar checks `student.view`, but route requires `discipline.manage`.
- **Required Fix**:
  - Align sidebar item permissions with the route guards:
    - Set `Front Office Desk` permission to `'front_office.manage'`.
    - Set `Student Health & Medical` permission to `'medical.manage'`.
    - Set `Disciplinary Records` permission to `'discipline.manage'`.

### [Minor] Finding 3: Student 360 Marks Entry Shortcut Context Omission
- **What**: "Marks Entry" shortcut navigates to generic `/dashboard/marks` instead of specific `/dashboard/examination?tab=marks`.
- **Where**: `src/components/students/Student360Drawer.tsx:649`
- **Why**: While `/dashboard/marks` redirects to `/dashboard/examination`, it defaults to the overview tab instead of opening marks entry directly.
- **Required Fix**: Update `onClick={() => navigate('/dashboard/examination?tab=marks')}`.

---

## 4. Adversarial Challenge Report

### Challenge Summary
**Overall Risk Assessment**: HIGH (Non-administrative role regression)

### Challenge 1: The Non-SuperAdmin Calendar Lockout
- **Assumption Challenged**: All users with sidebar calendar access can view the calendar.
- **Attack Scenario**: Log in as a teacher (`role: 'teacher'`) or student (`role: 'student'`). Click "Academics" -> "School Calendar".
- **Blast Radius**: 100% of non-super-admin users cannot access the school calendar or online classes.
- **Mitigation**: Remove `allowedPermission="academics.view"` from `/dashboard/calendar` in `src/App.tsx`.

### Challenge 2: Privilege Trap on Student Health and Discipline Links
- **Assumption Challenged**: If a navigation link appears in the sidebar, clicking it takes the user to a functional page.
- **Attack Scenario**: Log in as a student or parent. The "Students" menu displays "Student Health & Medical" and "Disciplinary Records" because the account has `student.view`. Clicking either link triggers route rejection (`medical.manage` / `discipline.manage`) and bounces the user to `/unauthorized`.
- **Blast Radius**: Degraded UX, confusion, and unauthorized error loops for regular users.
- **Mitigation**: Gate sidebar items on their actual operational manage permissions (`medical.manage`, `discipline.manage`).

### Stress Test Results Table
| Scenario | Target Role | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| View School Calendar | `teacher` | Render School Calendar view | Redirects to `/unauthorized` | **FAIL** |
| View School Calendar | `student` | Render School Calendar view | Redirects to `/unauthorized` | **FAIL** |
| Access Online Classes | `teacher` | Render Online Classes view | Redirects to `/unauthorized` | **FAIL** |
| Click "Disciplinary Records" in sidebar | `student` | Item hidden OR accessible | Item shown, navigation causes `/unauthorized` | **FAIL** |
| Click "Student Health & Medical" in sidebar | `parent` | Item hidden OR accessible | Item shown, navigation causes `/unauthorized` | **FAIL** |
| TypeScript Compilation | N/A | Exits code 0 | Exited code 0 | **PASS** |
| Production Bundle Build | N/A | Exits code 0 | Exited code 0 (3280 modules) | **PASS** |
| Student 360 -> Fees Context | `admin` | Auto-opens student ledger | Auto-opens student ledger | **PASS** |
| Global Search -> Teacher Routing | `admin` | Routes to `/dashboard/teachers` | Routes to `/dashboard/teachers` | **PASS** |
| Global Search -> Staff Routing | `admin` | Routes to `/dashboard/employees` | Routes to `/dashboard/employees` | **PASS** |

---

## 5. Integrity Check

- **Hardcoded test results or expected outputs in source code**: None found.
- **Dummy or facade implementations**: None found. Real database queries, RPCs, and state managers are hooked up.
- **Shortcuts bypassing task**: None found.
- **Fabricated verification outputs**: None found. Both `tsc` and `vite build` independently verified and passed.
- **Self-certifying work**: Clean.
- **Integrity Status**: **CLEAN (NO INTEGRITY VIOLATION)**.

---

## 6. Caveats

1. **Milestone M2 Database RBAC Migrations**:
   The permission catalogue in PostgreSQL will receive updates during Milestone M2 (e.g. adding `communication.manage`, `front_office.manage`). However, UI routing and sidebar permissions within Milestone 1 must remain internally consistent and must not regress non-admin roles on existing working modules like Calendar and Online Classes.
2. **Live Runtime Supabase Execution**:
   Live database requests were analyzed based on canonical migration SQL files (`supabase_rbac_migration_02b.sql`) and static code inspection.

---

## 7. Conclusion & Actionable Next Steps

Worker M1 demonstrated commendable precision in deleting dead files, wiring complex router state parameters, and establishing clean type-checking and bundling. However, because Milestone 1 introduced regressions that lock non-administrative roles out of key features and create 403-redirect traps in the sidebar, the verdict is **REQUEST_CHANGES**.

### Concrete Actions Required from Worker M1:
1. **Fix `src/App.tsx` Route Guards**:
   - Change `/dashboard/calendar` from `<ProtectedRoute allowedPermission="academics.view">` to `<ProtectedRoute>`.
   - Update `/dashboard/online-classes` to match appropriate access permissions.
2. **Align `src/components/DashboardLayout.tsx` Sidebar Permissions**:
   - Change `Front Office Desk` from `student.create` to `front_office.manage`.
   - Change `Student Health & Medical` from `student.view` to `medical.manage`.
   - Change `Disciplinary Records` from `student.view` to `discipline.manage`.
3. **Fix `src/components/students/Student360Drawer.tsx`**:
   - Line 649: Update `navigate('/dashboard/marks')` to `navigate('/dashboard/examination?tab=marks')`.

---

## 8. Verification Method

To independently verify these findings:
1. **Inspect Permission Seeds**:
   View `supabase_rbac_migration_02b.sql:94-142` and verify that `academics.view` does not exist for `teacher`, `student`, `parent`, or `admin`.
2. **Inspect Route vs Sidebar Discrepancies**:
   Compare `src/App.tsx:283-313` with `src/components/DashboardLayout.tsx:119-158`.
3. **Execute Build Verification**:
   ```powershell
   npx tsc --noEmit
   npm run build
   ```
