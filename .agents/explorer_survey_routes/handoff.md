# Handoff Report: Routes, Layout, Auth & Role Guards Audit

## Executive Summary
This report provides a comprehensive, read-only architectural survey of the routing, navigation, authentication, role-based access control (RBAC), and cross-module state preservation across the School ERP, analyzed from the primary perspective of the **Admin** and administrative leadership roles (`super_admin`, `admin`, `principal`).

---

## 1. Observation

### 1.1 Router Configuration (`src/App.tsx`)
In `src/App.tsx`, React Router DOM v6 (`BrowserRouter`, `Routes`, `Route`, `Navigate`) defines 73 route entries.
- **Route Guard**: `ProtectedRoute` (`src/App.tsx:55-87`):
  ```tsx
  const ProtectedRoute = ({ children, allowedPermission }: { children: React.ReactNode, allowedPermission?: string }) => {
    const { user, role, can, isLoading, errorKind } = useAuth();
    if (isLoading) return <Spinner />;
    if (!user) return <Navigate to="/login" replace />;
    if (errorKind === 'no-profile' || !role) return <Navigate to="/unauthorized" replace />;
    if (allowedPermission && !can(allowedPermission)) return <Navigate to="/unauthorized" replace />;
    return <>{children}</>;
  };
  ```
- **Public Routes (No Auth Guard)**:
  - `/` -> `<Home />`
  - `/about` -> `<AboutUs />`
  - `/presentation` -> `<MarketingLanding />`
  - `/login` -> `<Login />`
  - `/forgot-password` -> `<ForgotPassword />`
  - `/reset-password` -> `<ResetPassword />`
  - `/unauthorized` -> `<Unauthorized />`
  - `/session-expired` -> `<SessionExpired />`
  - `/maintenance` -> `<Maintenance />`
  - `/admissions` -> `<Admissions />`
  - `*` -> `<NotFound />`
- **Dashboard Protected Routes with Strict Permission Guards**:
  - `/dashboard` -> `<Analytics />` (No `allowedPermission`; accessible to any authenticated user with a profile)
  - `/dashboard/students` -> `<Students />` (Guarded by `student.view`)
  - `/dashboard/teachers` -> `<Teachers />` (Guarded by `teacher.view`)
  - `/dashboard/employees` -> `<Employees />` (Guarded by `staff.view`)
  - `/dashboard/admissions` -> `<AdmissionsManagement />` (Guarded by `student.create`)
  - `/dashboard/fees` -> `<FeesPortal />` (Guarded by `fees.view`)
  - `/dashboard/attendance` -> `<AttendanceEntry />` (Guarded by `attendance.manage`)
  - `/dashboard/reports` -> `<Reports />` (Guarded by `reports.view`)
  - `/dashboard/system` & `/dashboard/system/:view` -> `<SystemManagement />` (Guarded by `settings.manage`)
- **Dashboard Protected Routes with Missing Permission Guards (`allowedPermission` undefined)**:
  - `/dashboard/academics` & `/dashboard/academics/:view` -> `<AcademicsManagement />` (Unguarded read view; mutations checked internally via `academics.manage`)
  - `/dashboard/transport` -> `<TransportManagement />` (Unguarded)
  - `/dashboard/library` -> `<LibraryManagement />` (Unguarded)
  - `/dashboard/hostel` -> `<HostelManagement />` (Unguarded)
  - `/dashboard/inventory` -> `<InventoryManagement />` (Unguarded)
  - `/dashboard/communication` -> `<CommunicationManagement />` (Unguarded)
  - `/dashboard/certificates` -> `<CertificateGenerator />` (Unguarded)
  - `/dashboard/online-classes` -> `<OnlineClasses />` (Unguarded)
  - `/dashboard/calendar` -> `<SchoolCalendar />` (Unguarded)
  - `/dashboard/medical` -> `<MedicalManagement />` (Unguarded)
  - `/dashboard/discipline` -> `<DisciplineManagement />` (Unguarded)
  - `/dashboard/front-office` -> `<FrontOfficeManagement />` (Unguarded)
  - `/dashboard/ai` -> `<AIAssistant />` (Unguarded)
- **Duplicate & Legacy Examination Routes**:
  - `/dashboard/exam` -> renders `<ExamManagement />` (Guarded by `results.publish`). `src/pages/dashboard/ExamManagement.tsx:5` contains only: `return <ExaminationModule view="exams" />;`
  - `/dashboard/marks` -> renders `<MarksEntry />` (Guarded by `results.view`). `src/pages/dashboard/MarksEntry.tsx:5` contains only: `return <ExaminationModule view="marks-entry" />;`
  - `/dashboard/examination` through `/dashboard/examination/analytics`: 24 granular sub-routes in `App.tsx:344-366` rendering `<ExaminationModule view="..." />`.
- **Legacy Path Redirects in `App.tsx`**:
  - `/dashboard/users-roles` -> `<Navigate to="/dashboard/system/users" replace />`
  - `/dashboard/settings` -> `<Navigate to="/dashboard/system/settings" replace />`
  - `/dashboard/audit` -> `<Navigate to="/dashboard/system/audit" replace />`
  - `/dashboard/academic-years` -> `/dashboard/academics/years`
  - `/dashboard/classes`, `/dashboard/sections` -> `/dashboard/academics/classes`
  - `/dashboard/subjects` -> `/dashboard/academics/subjects`
  - `/dashboard/class-subjects`, `/dashboard/curriculum` -> `/dashboard/academics/class-subjects`
  - `/dashboard/academic-structure` -> `/dashboard/academics/structure`
  - `/dashboard/timetable` -> `/dashboard/academics/timetable`
  - `/dashboard/library-management` -> `/dashboard/library`
  - `/dashboard/transport-management` -> `/dashboard/transport`
  - `/dashboard/inventory-management` -> `/dashboard/inventory`
  - `/dashboard/communication-management` -> `/dashboard/communication`
  - `/dashboard/certificate-generator` -> `/dashboard/certificates`
- **Orphaned Imports in `App.tsx:27-30`**:
  - `import GoogleFormsManager from '@/pages/dashboard/GoogleFormsManager';`
  - `import GoogleClassroomManager from '@/pages/dashboard/GoogleClassroomManager';`
  - `import DatabaseManager from '@/pages/dashboard/DatabaseManager';`
  - `import RoleAndUserManager from '@/pages/dashboard/RoleAndUserManager';`
  None of these 4 imported components are referenced anywhere in `App.tsx` routes.

---

### 1.2 Layout and Navigation Components (`src/components/DashboardLayout.tsx`)
In `src/components/DashboardLayout.tsx`:
- **Sidebar Categories (`sidebarCategories` lines 118-265)**:
  1. **Admissions** (`student.create`):
     - `Direct Enrollment`: path `/dashboard/admissions`, permission `student.create`
     - `Pending Approvals`: path `/dashboard/admissions`, state `{ statusFilter: 'Pending' }`, permission `student.create`
  2. **Students** (`student.view`):
     - `Student Directory & SIS`: path `/dashboard/students`, permission `student.list`
     - `Alumni & Transferred`: path `/dashboard/students`, state `{ statusFilter: 'all' }`, permission `student.list`
  3. **Academics** (`null`):
     - `Overview`, `Academic Years`, `Classes & Sections`, `Subjects`, `Class Subjects`, `Timetable`, `Academic Structure`: path `/dashboard/academics/:view`, permission `null`
  4. **Attendance** (`null`):
     - `Attendance Entry`: path `/dashboard/attendance`, permission `attendance.manage`
  5. **CBSE Examination** (`results.view`):
     - `Exams & Assessments`: `/dashboard/examination?tab=exams`, permission `results.view`
     - `CBSE Marks Entry`: `/dashboard/examination?tab=marks`, permission `results.publish`
     - `Result Processing & Publish`: `/dashboard/examination?tab=results`, permission `results.view`
     - `Report Cards Hub`: `/dashboard/examination?tab=reports`, permission `results.view`
     - `Schedule & Admit Cards`: `/dashboard/examination?tab=schedule`, permission `results.view`
     - `Performance Analytics`: `/dashboard/examination?tab=analytics`, permission `results.view`
  6. **Financials** (`fees.view`):
     - `Fee Overview & Hub`: `/dashboard/fees`, state `{ activeTab: 'portal' }`, permission `fees.view`
     - `Fee Collection & Ledgers`: `/dashboard/fees`, state `{ activeTab: 'student_fees' }`, permission `fees.collect`
     - `Fee Structure Master`: `/dashboard/fees`, state `{ activeTab: 'fee_structure' }`, permission `fees.view`
     - `Recent Transactions`: `/dashboard/fees`, state `{ activeTab: 'recent_payments' }`, permission `fees.view`
     - `Fee Reports & Overdues`: `/dashboard/fees`, state `{ activeTab: 'fee_reports' }`, permission `fees.view`
  7. **Faculty & Staff** (`null`):
     - `Teacher Directory & 360`: `/dashboard/teachers`, permission `teacher.view`
     - `Academic Assignments`: `/dashboard/teachers`, state `{ activeTab: 'assignments' }`, permission `teacher.view`
     - `Non-Teaching Staff`: `/dashboard/employees`, permission `staff.view`
  8. **Library** (`null`):
     - `Book Catalog`, `Subject Categories`, `Borrowing Ledger`, `Overdue Fines`: `/dashboard/library`, state `{ activeTab: ... }`, permission `null`
  9. **Transport** (`null`):
     - `Transit Routes`, `Fleet Vehicles`, `Certified Drivers`, `Transit Allotments`: `/dashboard/transport`, state `{ activeTab: ... }`, permission `null`
  10. **Inventory & Assets** (`null`):
      - `Fixed Assets`, `Consumable Stock`, `Vendors Directory`, `Purchase Orders`: `/dashboard/inventory`, state `{ activeTab: ... }`, permission `null`
  11. **Communication** (`null`):
      - `Official Notices`, `SMS Campaigns`, `Email Broadcasts`, `App Push Alerts`: `/dashboard/communication`, state `{ activeTab: ... }`, permission `null`
  12. **Certificates & ID** (`null`):
      - `Issue Credentials`: `/dashboard/certificates`, permission `null`
      - `Student ID Cards`: `/dashboard/students`, state `{ openIdCards: true }`, permission `student.list`
  13. **System** (`settings.manage` - pinned in footer):
      - `Overview`: `/dashboard/system/overview`, permission `settings.manage`
      - `User Directory`: `/dashboard/system/users`, permission `users.manage`
      - `Roles & Permissions`: `/dashboard/system/roles`, permission `settings.manage`
      - `School Settings`: `/dashboard/system/settings`, permission `settings.manage`
      - `Audit Logs`: `/dashboard/system/audit`, permission `audit.view`
      - `Security & Governance`: `/dashboard/system/security`, permission `settings.manage`
- **Modules Routed in `App.tsx` but OMITTED from Sidebar**:
  1. `HostelManagement` (`/dashboard/hostel`)
  2. `Reports` (`/dashboard/reports`)
  3. `FrontOfficeManagement` (`/dashboard/front-office`)
  4. `SchoolCalendar` (`/dashboard/calendar`)
  5. `MedicalManagement` (`/dashboard/medical`)
  6. `DisciplineManagement` (`/dashboard/discipline`)
  7. `OnlineClasses` (`/dashboard/online-classes`)
  8. `AIAssistant` (`/dashboard/ai`)
- **Global Search Overlay (`DashboardLayout.tsx:306-356, 560-664`)**:
  - Searches students, employees (merged from `teachers` and `staff`), and exams.
  - When a student is clicked: `navigate('/dashboard/students', { state: { selectedStudentId: s.id } })`
  - When an employee is clicked: `navigate('/dashboard/employees', { state: { selectedEmployeeId: e.id } })`
  - When an exam is clicked: `navigate('/dashboard/examination?tab=exams', { state: { selectedExamId: ex.id } })`
  - Quick actions in search: Marks Entry (`/dashboard/marks`, state `{ view: 'results' }`), Take Attendance (`/dashboard/attendance`), Collect Fees (`/dashboard/fees`), New Admission (`/dashboard/admissions`).
- **Floating AI Bot**:
  - Mounted via `<GoogleAIBot />` in `DashboardLayout.tsx:722`.

---

### 1.3 Authentication & Authorization Architecture
- **PostgreSQL Database (`supabase_rbac_migration_02b.sql`)**:
  - `app_role` enum (`supabase_rbac_migration_02a_enum.sql`):
    `'super_admin'`, `'admin'`, `'principal'`, `'vice_principal'`, `'teacher'`, `'class_teacher'`, `'exam_controller'`, `'accountant'`, `'librarian'`, `'transport_manager'`, `'hostel_warden'`, `'receptionist'`, `'office_staff'`, `'hr'`, `'student'`, `'parent'`.
  - Administrative roles helper function (`is_admin()`):
    ```sql
    CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean ...
    SELECT public.current_user_role() IN ('super_admin','admin','principal');
    ```
  - Staff helper function (`is_staff()`): includes all 14 non-student/parent roles.
  - Database permission table: `role_permissions (role, permission)` with wildcard `'*'` granted to `super_admin`.
  - Authoritative check: `auth_has_permission(text)` and RPC `my_permissions()`.
- **Frontend Auth (`src/context/AuthContext.tsx`)**:
  - Reads `profiles.role` and executes `supabase.rpc('my_permissions')` on sign-in.
  - `can(permission)` evaluates `permissions.has('*') || permissions.has(permission)`.
  - Never reads or trusts `localStorage`.
- **Permission Catalog (`src/components/Can.tsx:47-57`)**:
  - 9 permission groups: Students, Teachers & staff, Attendance, Fees, Examinations, Reports, Academics, Operations, Administration.

---

### 1.4 Cross-Module Navigation & Context / ID Preservation
Direct code inspection reveals specific broken linkages and lost state:
1. **Student 360 Drawer -> Fees**:
   - `Student360Drawer.tsx:637`: `<button onClick={() => navigate('/dashboard/fees')}>`
   - `Student360Drawer.tsx:963`: `<button onClick={() => navigate('/dashboard/fees')}>` ("Collect Fees in Portal")
   - *Observation*: Neither call passes `student` or `student.id`. In `FeesPortal.tsx:92-95`, modal auto-opening requires `location.state?.selectedStudent`. The student context is completely dropped.
2. **Global Search -> Employees**:
   - `DashboardLayout.tsx:592`: `onClick={() => navigate('/dashboard/employees', { state: { selectedEmployeeId: e.id } })}`
   - *Observation*: In `src/pages/dashboard/Employees.tsx`, `useLocation` is NOT imported. The `selectedEmployeeId` is ignored. Furthermore, clicking a teacher routes to `/dashboard/employees` instead of `/dashboard/teachers`.
3. **Global Search -> Exams**:
   - `DashboardLayout.tsx:611`: `onClick={() => navigate('/dashboard/examination?tab=exams', { state: { selectedExamId: ex.id } })}`
   - *Observation*: In `ExaminationModule.tsx`, `location.state` is not referenced anywhere. The exam ID is dropped.
4. **Analytics Dashboard Quick Actions**:
   - `Analytics.tsx:1646`: `label: 'View Exam Results' -> path: '/dashboard/students'` (Points to students instead of `/dashboard/examination?tab=results`)
   - `Analytics.tsx:1647`: `label: 'Download Report Card' -> path: '/dashboard/students'` (Points to students instead of `/dashboard/examination?tab=reports`)
   - `Analytics.tsx:1649`: `label: 'Library Roster' -> path: '/dashboard/students'` (Points to students instead of `/dashboard/library`)
   - `Analytics.tsx:954`: `label: 'Add Educator' -> path: '/dashboard/employees'` (Points to non-teaching staff instead of `/dashboard/teachers`)
5. **Student 360 Drawer -> Certificates**:
   - `Student360Drawer.tsx:1201`: `onClick={() => navigate('/dashboard/certificates')}`
   - *Observation*: In `CertificateGenerator.tsx`, `useLocation` is not imported. The student's name, roll number, admission number, and class are not passed, so the certificate generator defaults to hardcoded mock data ("Sneha Gupta").
6. **Sidebar "Pending Approvals" -> Admissions**:
   - `DashboardLayout.tsx:125`: `path: '/dashboard/admissions', state: { statusFilter: 'Pending' }`
   - *Observation*: In `AdmissionsManagement.tsx`, `useLocation` is not imported. `statusFilter` defaults to `'all'` and ignores the navigation state.
7. **Sidebar "Student ID Cards" -> Students**:
   - `DashboardLayout.tsx:249`: `path: '/dashboard/students', state: { openIdCards: true }`
   - `Students.tsx:81-84`: `if (location.state?.openIdCards && students.length > 0) setIdCardTargetStudent(students[0]);`
   - *Observation*: Hardcodes opening ID card for `students[0]` rather than presenting an ID card batch / selection workflow.
8. **Student 360 Drawer -> Attendance Register**:
   - `Student360Drawer.tsx:643`: passes `{ selectedClass: student.class, selectedSection: student.section, selectedStudentId: student.id, activeTab: 'register' }`.
   - *Observation*: In `AttendanceEntry.tsx:157-160`, `selectedClass` and `selectedSection` are handled, but `selectedStudentId` is ignored and does not filter or highlight the student.
9. **Global Search Quick Action "Marks Entry"**:
   - `DashboardLayout.tsx:633`: `onClick={() => navigate('/dashboard/marks', { state: { view: 'results' } })}`
   - `MarksEntry.tsx` renders `<ExaminationModule view="marks-entry" />`, completely ignoring `{ view: 'results' }`.

---

## 2. Logic Chain

### 2.1 Router and Route Guard Logic
1. `App.tsx` wraps all dashboard routes in `<ProtectedRoute allowedPermission="...">`.
2. When `allowedPermission` is omitted, `ProtectedRoute` only checks `!user || !role`.
3. Modules such as Transport, Library, Hostel, Inventory, Communication, Certificates, Medical, Discipline, and Front Office have NO `allowedPermission` on their routes in `App.tsx`.
4. Therefore, any signed-in user with any valid role (e.g. `student`, `parent`, `receptionist`) can directly access `/dashboard/transport`, `/dashboard/inventory`, `/dashboard/communication`, etc., bypassing intended operational boundaries.
5. In contrast, `AcademicsManagement` and `SystemManagement` explicitly implement defense-in-depth:
   - `AcademicsManagement` permits read access but gates all mutations on `can('academics.manage')`.
   - `SystemManagement` gates the entire module on `settings.manage` or `users.manage`.
   - *Conclusion*: Operations routes must either specify their dedicated permission (`library.manage`, `transport.manage`, `hostel.manage`, `inventory.manage`) in `App.tsx` or handle read/write role gating within their page components.

### 2.2 Navigation Tab URL vs Router State Logic
1. In `AcademicsManagement` (`/dashboard/academics/:view`) and `SystemManagement` (`/dashboard/system/:view`), sub-sections are part of the URL pathname.
2. In `FeesPortal`, `LibraryManagement`, `TransportManagement`, `InventoryManagement`, and `CommunicationManagement`, sub-sections are addressed through React Router `location.state: { activeTab: '...' }`.
3. When a user bookmarks, refreshes, or shares a link (or when browser history navigates backward/forward), `location.state` is wiped or stale.
4. This causes the user to be dumped back onto the default tab (e.g. `portal` in Fees, `books` in Library), creating UI friction and broken expectations.
5. *Conclusion*: All multi-tab dashboard modules must adopt the canonical URL parameterization pattern (`/dashboard/<module>/:view` or `?tab=<view>`) pioneered by Academics and System.

### 2.3 Orphaned Code vs Single Source of Truth
1. The project requirement mandates: **ONE BUSINESS FUNCTION = ONE PRIMARY MODULE**.
2. For Examinations:
   - Canonical module: `src/pages/dashboard/examination/ExaminationModule.tsx`.
   - `ExamManagement.tsx` (7 lines) and `MarksEntry.tsx` (7 lines) are legacy shims that duplicate route elements.
   - `src/components/results/SeatingPlanView.tsx` (816 lines, 36KB) is a complete, polished sub-module that is never mounted in `ExaminationModule.tsx`.
3. For System Administration:
   - Canonical module: `src/pages/dashboard/SystemManagement.tsx` backed by `src/components/system/*`.
   - `RoleAndUserManager.tsx` (408 lines, 17KB) and `Settings.tsx` (175 lines, 8KB) are obsolete duplicate pages.
4. For Admissions:
   - `EnquiriesPipeline.tsx` (32KB) and `AdmissionReports.tsx` (18KB) exist in `src/components/admissions/` but are never mounted in `AdmissionsManagement.tsx`.
5. For Database Management:
   - `DatabaseManager.tsx` (954 lines, 47KB) is unrouted and orphaned.
6. *Conclusion*: Eliminating or properly wiring these orphaned components will drastically streamline the codebase, eliminate duplicate maintenance, and unlock unrendered core features.

---

## 3. Categorization of Admin Navigation Items

The following table provides the required audit action (**KEEP, MOVE, MERGE, REMOVE, REDIRECT, RENAME**) for every Admin-visible navigation item across the sidebar, public header, and internal routes.

| Current Label | Current Path / State | Icon | Permission Guard | Target Component / View | Audit Action | Actionable Recommendation |
|---|---|---|---|---|---|---|
| **Dashboard** | `/dashboard` | `LayoutDashboard` | None (`user`) | `Analytics.tsx` | **KEEP** | Central admin overview. Retain as canonical hub. |
| **Direct Enrollment** | `/dashboard/admissions` | `GraduationCap` | `student.create` | `AdmissionsManagement.tsx` | **RENAME / MOVE** | Rename to "Enrollment Form" and pass `state: { openEnrollmentModal: true }` or add tab `?tab=enroll` so clicking actually opens the enrollment form instead of the admissions list. |
| **Pending Approvals** | `/dashboard/admissions` `state: { statusFilter: 'Pending' }` | `GraduationCap` | `student.create` | `AdmissionsManagement.tsx` | **KEEP / FIX** | Keep item, but update `AdmissionsManagement.tsx` to read `location.state?.statusFilter` or use query param `/dashboard/admissions?status=pending`. |
| *Enquiries Pipeline* | *None (Unmounted)* | `MessageSquare` | `student.create` | `EnquiriesPipeline.tsx` | **MOVE (ADD)** | Add new sidebar item under Admissions: "Enquiry Pipeline" -> `/dashboard/admissions?tab=enquiries` to surface this 32KB component. |
| **Student Directory & SIS** | `/dashboard/students` | `Users` | `student.list` | `Students.tsx` | **KEEP** | Primary student 360 / directory. Align route guard in `App.tsx` to `student.view` or `student.list`. |
| **Alumni & Transferred** | `/dashboard/students` `state: { statusFilter: 'all' }` | `Users` | `student.list` | `Students.tsx` | **RENAME / FIX** | Rename to "All Records & Alumni", update to pass `{ statusFilter: 'inactive' }` or use URL param `/dashboard/students?status=all`. |
| **Academics: Overview** | `/dashboard/academics/overview` | `BookOpen` | None | `AcademicsOverview.tsx` | **KEEP** | Canonical academic overview. |
| **Academics: Academic Years** | `/dashboard/academics/years` | `BookOpen` | None | `AcademicYearsView.tsx` | **KEEP** | Canonical academic years master. |
| **Academics: Classes & Sections** | `/dashboard/academics/classes` | `BookOpen` | None | `ClassesSectionsView.tsx` | **KEEP** | Canonical class/section structure. |
| **Academics: Subjects** | `/dashboard/academics/subjects` | `BookOpen` | None | `SubjectsView.tsx` | **KEEP** | Canonical master subject catalog. |
| **Academics: Class Subjects** | `/dashboard/academics/class-subjects` | `BookOpen` | None | `ClassSubjectsView.tsx` | **KEEP** | Canonical subject mapping per class. |
| **Academics: Timetable** | `/dashboard/academics/timetable` | `BookOpen` | None | `TimetableView.tsx` | **KEEP** | Canonical timetable builder. |
| **Academics: Academic Structure** | `/dashboard/academics/structure` | `BookOpen` | None | `AcademicStructureView.tsx` | **MERGE / REDIRECT** | Merge into "Classes & Sections" or "Overview" to avoid redundancy with the Classes/Sections view. |
| **Attendance Entry** | `/dashboard/attendance` | `CalendarCheck` | `attendance.manage` | `AttendanceEntry.tsx` | **RENAME / EXPAND** | Rename to "Daily Register". Add sub-items: "Attendance History" (`?tab=history`) and "Attendance Reports" (`?tab=reports`). |
| **Exams & Assessments** | `/dashboard/examination?tab=exams` | `ClipboardList` | `results.view` | `ExaminationModule.tsx` | **KEEP** | Master exam management. |
| **CBSE Marks Entry** | `/dashboard/examination?tab=marks` | `ClipboardList` | `results.publish` | `ExaminationModule.tsx` | **KEEP** | Canonical marks entry workspace. |
| **Result Processing & Publish**| `/dashboard/examination?tab=results` | `ClipboardList` | `results.view` | `ExaminationModule.tsx` | **KEEP** | Canonical results compilation. |
| **Report Cards Hub** | `/dashboard/examination?tab=reports` | `ClipboardList` | `results.view` | `ExaminationModule.tsx` | **KEEP** | Official CBSE report cards generator. |
| **Schedule & Admit Cards** | `/dashboard/examination?tab=schedule` | `ClipboardList` | `results.view` | `ExaminationModule.tsx` | **KEEP** | Datesheets and student hall tickets. |
| **Performance Analytics** | `/dashboard/examination?tab=analytics`| `ClipboardList` | `results.view` | `ExaminationModule.tsx` | **KEEP** | Exam performance charts. |
| *Seating & Hall Plan* | *None (Unmounted)* | `Grid` | `results.view` | `SeatingPlanView.tsx` | **MOVE (ADD)** | Mount `SeatingPlanView.tsx` into `ExaminationModule.tsx` and add sidebar sub-item: "Exam Seating & Halls". |
| **Fee Overview & Hub** | `/dashboard/fees` `state: { activeTab: 'portal' }` | `Wallet` | `fees.view` | `FeesPortal.tsx` | **KEEP** | Financials executive summary. Migrate to URL subpath `/dashboard/fees/overview`. |
| **Fee Collection & Ledgers** | `/dashboard/fees` `state: { activeTab: 'student_fees' }` | `Wallet` | `fees.collect` | `FeesPortal.tsx` | **KEEP** | Student fee collection desk. Migrate to `/dashboard/fees/collection`. |
| **Fee Structure Master** | `/dashboard/fees` `state: { activeTab: 'fee_structure' }` | `Wallet` | `fees.view` | `FeeStructureManager.tsx`| **KEEP** | Class-wise fee heads. Migrate to `/dashboard/fees/structure`. Restrict mutation buttons to `is_admin()`. |
| **Recent Transactions** | `/dashboard/fees` `state: { activeTab: 'recent_payments' }` | `Wallet` | `fees.view` | `FeesPortal.tsx` | **KEEP** | Transaction audit trail. Migrate to `/dashboard/fees/transactions`. |
| **Fee Reports & Overdues** | `/dashboard/fees` `state: { activeTab: 'fee_reports' }` | `Wallet` | `fees.view` | `FeeReportsView.tsx` | **MERGE** | Keep as sub-view, but link to centralized `/dashboard/reports`. |
| **Teacher Directory & 360** | `/dashboard/teachers` | `Briefcase` | `teacher.view` | `Teachers.tsx` | **KEEP** | Faculty directory and 360 profile drawer. |
| **Academic Assignments** | `/dashboard/teachers` `state: { activeTab: 'assignments' }` | `Briefcase` | `teacher.view` | `Teachers.tsx` | **KEEP** | Teacher-class-subject allocation. |
| **Non-Teaching Staff** | `/dashboard/employees` | `Briefcase` | `staff.view` | `Employees.tsx` | **KEEP** | Non-instructional staff directory. |
| **Library (Catalog/Issues/Fines)**| `/dashboard/library` `state: { activeTab: ... }` | `Library` | None (`null`) | `LibraryManagement.tsx` | **KEEP / GUARD** | Add permission guard `library.manage` in `App.tsx` and `DashboardLayout.tsx`. Migrate tabs to URL params. |
| **Transport (Routes/Fleet/Drivers)**| `/dashboard/transport` `state: { activeTab: ... }` | `Bus` | None (`null`) | `TransportManagement.tsx`| **KEEP / GUARD** | Add permission guard `transport.manage` in `App.tsx` and `DashboardLayout.tsx`. Migrate tabs to URL params. |
| *Hostel Management* | `/dashboard/hostel` *(Missing in sidebar)* | `Home` | None (`null`) | `HostelManagement.tsx` | **MOVE (ADD)** | Add "Hostel & Housing" category to sidebar with permission `hostel.manage`. |
| **Inventory & Assets** | `/dashboard/inventory` `state: { activeTab: ... }` | `Layers` | None (`null`) | `InventoryManagement.tsx`| **KEEP / GUARD** | Add permission guard `inventory.manage` in `App.tsx` and `DashboardLayout.tsx`. Migrate tabs to URL params. |
| **Communication** | `/dashboard/communication` `state: { activeTab: ... }` | `MessageSquare`| None (`null`) | `CommunicationManagement.tsx`| **KEEP / GUARD** | Add permission guard in `App.tsx` and `DashboardLayout.tsx`. Migrate tabs to URL params. |
| **Issue Credentials** | `/dashboard/certificates` | `Award` | None (`null`) | `CertificateGenerator.tsx`| **KEEP / GUARD** | Add permission guard `certificates.manage` in `App.tsx`. Update component to accept pre-fill state from Student 360. |
| **Student ID Cards** | `/dashboard/students` `state: { openIdCards: true }` | `Award` | `student.list` | `StudentIDCardModal.tsx` | **MERGE / MOVE** | Keep under Students, but improve trigger to open multi-student batch printing instead of defaulting to `students[0]`. |
| *Reports Center* | `/dashboard/reports` *(Missing in sidebar)* | `BarChart3` | `reports.view` | `Reports.tsx` | **MOVE (ADD)** | Add "Reports & Analytics" category to sidebar with permission `reports.view`. |
| *School Calendar* | `/dashboard/calendar` *(Missing in sidebar)* | `Calendar` | None (`null`) | `SchoolCalendar.tsx` | **MOVE (ADD)** | Add "Calendar & Events" to sidebar (or embed into Academics). |
| *Front Office Desk* | `/dashboard/front-office` *(Missing in sidebar)*| `Building` | None (`null`) | `FrontOfficeManagement.tsx`| **MOVE (ADD)**| Add "Front Office" to sidebar with permission `receptionist` / `admin`. |
| *Student Health & Medical* | `/dashboard/medical` *(Missing in sidebar)* | `Heart` | None (`null`) | `MedicalManagement.tsx` | **MERGE** | Add sub-link under Students module or integrate as drawer/tab. |
| *Disciplinary Records* | `/dashboard/discipline` *(Missing in sidebar)*| `ShieldAlert` | None (`null`) | `DisciplineManagement.tsx`| **MERGE** | Add sub-link under Students module or integrate as drawer/tab. |
| *Online Classes* | `/dashboard/online-classes` *(Missing in sidebar)*| `Video` | None (`null`) | `OnlineClasses.tsx` | **MERGE** | Integrate as a tab under Academics or embed under Timetable. |
| *AI Assistant* | `/dashboard/ai` *(Missing in sidebar)* | `Sparkles` | None (`null`) | `AIAssistant.tsx` | **MERGE** | Retire full-page route `/dashboard/ai` in favor of the persistent `<GoogleAIBot />` drawer. |
| **System: Overview** | `/dashboard/system/overview` | `LayoutDashboard`| `settings.manage`| `SystemOverviewView.tsx`| **KEEP** | Central admin system diagnostics. |
| **System: User Directory** | `/dashboard/system/users` | `Users` | `users.manage` | `UserDirectoryView.tsx` | **KEEP** | User provisioning and role assignment. |
| **System: Roles & Permissions**| `/dashboard/system/roles` | `ShieldCheck` | `settings.manage`| `RolesPermissionsView.tsx`| **KEEP** | Matrix editor for `role_permissions`. |
| **System: School Settings** | `/dashboard/system/settings` | `Settings` | `settings.manage`| `SchoolSettingsView.tsx` | **KEEP** | School branding, address, session defaults. |
| **System: Audit Logs** | `/dashboard/system/audit` | `Activity` | `audit.view` | `AuditLogsView.tsx` | **KEEP** | Append-only system audit logging. |
| **System: Security & Governance**| `/dashboard/system/security` | `Lock` | `settings.manage`| `SecurityView.tsx` | **KEEP** | RLS security policies & encryption audit. |
| **Legacy: Exam Management** | `/dashboard/exam` | N/A | `results.publish` | `ExamManagement.tsx` | **REDIRECT** | Route should redirect to `/dashboard/examination?tab=exams`. Delete `ExamManagement.tsx`. |
| **Legacy: Marks Entry** | `/dashboard/marks` | N/A | `results.view` | `MarksEntry.tsx` | **REDIRECT** | Route should redirect to `/dashboard/examination?tab=marks`. Delete `MarksEntry.tsx`. |
| **Legacy: Settings Page** | `/dashboard/settings` | N/A | Redirect | `Settings.tsx` | **REMOVE** | Redirect is already in `App.tsx:207`. Delete unrouted file `src/pages/dashboard/Settings.tsx`. |
| **Legacy: RoleAndUserManager**| Unrouted | N/A | Unrouted | `RoleAndUserManager.tsx`| **REMOVE** | Delete unrouted file `src/pages/dashboard/RoleAndUserManager.tsx`. |
| **Legacy: DatabaseManager** | Unrouted | N/A | Unrouted | `DatabaseManager.tsx` | **REMOVE / MOVE** | Delete or move to `scripts/admin_tools/`. |
| **Legacy: GoogleClassroom** | Unrouted | N/A | Unrouted | `GoogleClassroomManager.tsx`| **REMOVE** | Unrouted, unmaintained file. Delete. |
| **Legacy: GoogleForms** | Unrouted | N/A | Unrouted | `GoogleFormsManager.tsx` | **REMOVE** | Unrouted, unmaintained file. Delete. |

---

## 4. Caveats
1. **Network / Backend Live Verification**:
   - Investigation was performed strictly via codebase static analysis and local file inspection without modifying database rows.
   - Database tables corresponding to orphaned modules (`online_classes`, `disciplinary_records`, `student_medical`, `front_office_logs`) exist in migration files, but production data volume in these tables was not queried.
2. **Third-Party API Integrations**:
   - Google Classroom and Google Forms managers rely on client IDs and external OAuth tokens which are not configured in environment variables.
3. **No Code Written**:
   - As an explorer agent in read-only mode, no production source code was modified. All recommendations are packaged for implementer execution.

---

## 5. Conclusion

1. **Architecture & RBAC Maturity**:
   - The foundation of RBAC (`profiles.role`, `role_permissions`, `auth_has_permission()`, `is_admin()`, and `AuthContext.tsx`) is secure and follows best practices. Roles and permissions are strictly enforced server-side via Supabase Row Level Security.
2. **Route Guard Gaps**:
   - Ten operational and utility routes (`/dashboard/transport`, `/dashboard/library`, `/dashboard/inventory`, `/dashboard/hostel`, `/dashboard/communication`, `/dashboard/certificates`, etc.) lack `allowedPermission` props on their `<ProtectedRoute>` wrappers in `App.tsx`, leaving them accessible to non-administrative roles.
3. **Navigation & State Fragility**:
   - Tab-based sub-navigation in Financials and Operations depends on transient React Router state (`location.state`), which is destroyed on page reload or bookmarking.
   - The Academics and System modules already have the correct URL-driven design pattern (`/dashboard/<module>/:view`); Financials, Attendance, and Operations must be brought into alignment.
4. **Cross-Module Link Failures**:
   - Student 360 -> Fee Collection drops student ID.
   - Global Search -> Employee directory drops employee ID and misroutes teachers.
   - Global Search -> Exams drops exam ID.
   - Analytics dashboard buttons misroute to Students instead of Examination and Library.
   - Admissions Management ignores `statusFilter` from incoming router state.
5. **Code Bloat & Orphaned Features**:
   - ~120KB of high-value components (`SeatingPlanView.tsx`, `EnquiriesPipeline.tsx`, `AdmissionReports.tsx`) are orphaned despite matching routes or domain needs.
   - ~100KB of obsolete/unrouted code (`DatabaseManager.tsx`, `RoleAndUserManager.tsx`, `Settings.tsx`, `GoogleClassroomManager.tsx`, `GoogleFormsManager.tsx`) can be safely eliminated.

---

## 6. Verification Method

To independently verify all findings in this report:

1. **Verify Route Definitions and Unused Imports**:
   - Inspect `src/App.tsx:27-30` to confirm imports of `DatabaseManager`, `RoleAndUserManager`, `GoogleClassroomManager`, and `GoogleFormsManager`.
   - Inspect `src/App.tsx:242-341` to confirm missing `allowedPermission` on Operations routes.
2. **Verify Student 360 Context Drop**:
   - Inspect `src/components/students/Student360Drawer.tsx:637, 963` to confirm `navigate('/dashboard/fees')` is invoked without passing `student` state.
   - Inspect `src/pages/dashboard/FeesPortal.tsx:92-95` to confirm `selectedStudent` in `location.state` is required to open the collection modal.
3. **Verify Global Search Employee Misroute & Dropped ID**:
   - Inspect `src/components/DashboardLayout.tsx:592` where `navigate('/dashboard/employees', { state: { selectedEmployeeId: e.id } })` is called for both teachers and staff.
   - Inspect `src/pages/dashboard/Employees.tsx` to verify `useLocation` is never imported.
4. **Verify Admissions Navigation State Ignored**:
   - Inspect `src/components/DashboardLayout.tsx:125` where `{ statusFilter: 'Pending' }` is passed.
   - Inspect `src/pages/dashboard/AdmissionsManagement.tsx:58-60` to verify `location.state` is never read.
5. **Verify Orphaned Examination Components**:
   - Inspect `src/components/results/SeatingPlanView.tsx` (816 lines).
   - Inspect `src/pages/dashboard/examination/ExaminationModule.tsx:40-50` to confirm `SeatingPlanView` is never imported or rendered.
6. **Verify Analytics Quick Action Misroutes**:
   - Inspect `src/pages/dashboard/Analytics.tsx:1646-1649` to confirm 'View Exam Results', 'Download Report Card', and 'Library Roster' all route to `/dashboard/students`.
