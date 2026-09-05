# Module & UI Audit Report: Business Functions, Deduplication & Action Interactivity

**Auditor:** Teamwork ERP Business Module & UI Auditor  
**Scope:** Complete audit of 14 Business Modules, Duplicate/Parallel Views, UI Action Buttons, Interactivity Authenticity, Navigation Integrity, and UI/UX Consistency across the School ERP.  
**Date:** 2026-09-03  

---

## 1. Observation

### A. Business Function Mapping & Deduplication (ONE BUSINESS FUNCTION = ONE PRIMARY MODULE)

We audited every business function against the codebase routes, sidebar definitions, and component hierarchies:

| Business Function | Canonical Source of Truth | Route Path | Duplicate / Parallel / Orphaned Files Found | Navigation Status |
|---|---|---|---|---|
| **1. Admissions** | `src/pages/dashboard/AdmissionsManagement.tsx` | `/dashboard/admissions` | `src/components/admissions/EnquiriesPipeline.tsx` (648 lines, unreferenced CRM pipeline); `src/components/admissions/AdmissionReports.tsx` (390 lines, unreferenced charts); `src/pages/dashboard/FrontOfficeManagement.tsx:16` duplicates "Admissions Enquiries". Public intake form at `src/pages/Admissions.tsx` (`/admissions`). | Canonical in sidebar under Admissions ("Direct Enrollment" & "Pending Approvals"). |
| **2. Students** | `src/pages/dashboard/Students.tsx` | `/dashboard/students` | None for student CRUD. `Student360Drawer.tsx` (1,413 lines) provides central 360° workspace. Cross-module links exist but some drop query/state context (see Section B). | Canonical in sidebar under Students ("Student Directory & SIS" & "Alumni & Transferred"). |
| **3. Academics** | `src/pages/dashboard/AcademicsManagement.tsx` | `/dashboard/academics/:view` | None. Legacy routes (`/dashboard/academic-years`, `/dashboard/classes`, `/dashboard/sections`, `/dashboard/subjects`, `/dashboard/class-subjects`, `/dashboard/curriculum`, `/dashboard/academic-structure`, `/dashboard/timetable`) are cleanly redirected to `/dashboard/academics/:view` in `App.tsx:233-240`. | Canonical in sidebar under Academics (7 views: Overview, Years, Classes, Subjects, Class Subjects, Timetable, Structure). |
| **4. Teacher & Staff Management** | `src/pages/dashboard/Teachers.tsx` (Faculty) & `src/pages/dashboard/Employees.tsx` (Staff) | `/dashboard/teachers` & `/dashboard/employees` | Teaching faculty (`teachers` table) and non-teaching staff (`staff` table) are split. In `Analytics.tsx:287-298`, "Total Teachers" stat card navigates to `/dashboard/employees` instead of `/dashboard/teachers`. In `Employees.tsx:81`, `role` defaults to `'Teacher'` even though teachers belong to `teachers` table. | Canonical in sidebar under Faculty & Staff ("Teacher Directory & 360", "Academic Assignments", "Non-Teaching Staff"). |
| **5. Attendance** | `src/pages/dashboard/AttendanceEntry.tsx` | `/dashboard/attendance` | `src/pages/dashboard/SchoolCalendar.tsx` (`/dashboard/calendar`, unlisted in sidebar) duplicates the holiday calendar view from `AttendanceEntry.tsx`, but crashes due to schema mismatch (`holidays.date` does not exist; actual column is `start_date`). | Canonical in sidebar under Attendance ("Attendance Entry"). |
| **6. Examination** | `src/pages/dashboard/examination/ExaminationModule.tsx` | `/dashboard/examination` | `src/pages/dashboard/ExamManagement.tsx` (7 lines) and `src/pages/dashboard/MarksEntry.tsx` (7 lines) are legacy thin wrappers at `/dashboard/exam` and `/dashboard/marks`. 23 sub-routes exist in `App.tsx:344-366`. | Canonical in sidebar under CBSE Examination (Exams, Marks Entry, Results, Reports, Schedule, Analytics). |
| **7. Fees & Finance** | `src/pages/dashboard/FeesPortal.tsx` | `/dashboard/fees` | Directory `src/pages/dashboard/fees/` is completely empty. `server.ts:34` erroneously queries `supabase.from('fees')` instead of `from('student_fees')`, causing AI stats grounding to fail silently. | Canonical in sidebar under Financials (Hub, Collection, Structure, Transactions, Reports). |
| **8. Library** | `src/pages/dashboard/LibraryManagement.tsx` | `/dashboard/library` | Legacy redirect `/dashboard/library-management` -> `/dashboard/library`. Categories and Fines tabs are not backed by database tables. | Canonical in sidebar under Library (Catalog, Categories, Issues, Fines). |
| **9. Transport** | `src/pages/dashboard/TransportManagement.tsx` | `/dashboard/transport` | Legacy redirect `/dashboard/transport-management` -> `/dashboard/transport`. Transit Allotment form omits `student_id` foreign key. | Canonical in sidebar under Transport (Routes, Vehicles, Drivers, Allotments). |
| **10. Inventory** | `src/pages/dashboard/InventoryManagement.tsx` | `/dashboard/inventory` | Legacy redirect `/dashboard/inventory-management` -> `/dashboard/inventory`. Vendors and Purchase Orders tabs are mock/dead without DB tables. | Canonical in sidebar under Inventory & Assets (Assets, Stock, Vendors, Orders). |
| **11. Communication** | `src/pages/dashboard/CommunicationManagement.tsx` | `/dashboard/communication` | Legacy redirect `/dashboard/communication-management` -> `/dashboard/communication`. Push Alerts tab is mock/dead without DB table. | Canonical in sidebar under Communication (Notices, SMS, Email, Push). |
| **12. Certificates & ID** | `src/pages/dashboard/CertificateGenerator.tsx` | `/dashboard/certificates` | Legacy redirect `/dashboard/certificate-generator` -> `/dashboard/certificates`. ID Card modal co-located in `src/components/students/StudentIDCardModal.tsx`. | Canonical in sidebar under Certificates & ID ("Issue Credentials" & "Student ID Cards"). |
| **13. Reports** | `src/pages/dashboard/Reports.tsx` | `/dashboard/reports` | **CRITICAL:** `Reports.tsx` is completely non-functional mockup UI (120 lines) with zero interactive handlers. Real reports exist scattered inside module sub-views: `FeeReportsView.tsx`, `StudentReportsView.tsx`, `AnalyticsView.tsx`, `AttendanceEntry.tsx` (reports tab), and `AdmissionReports.tsx`. | Orphaned: Not listed in `DashboardLayout.tsx` sidebar! |
| **14. System / Settings** | `src/pages/dashboard/SystemManagement.tsx` | `/dashboard/system/:view` | **DUPLICATE & OBSOLETE:** `src/pages/dashboard/Settings.tsx` (175 lines, mock UI with fake toast-only save); `src/pages/dashboard/RoleAndUserManager.tsx` (408 lines, superseded by `UserDirectoryView.tsx` & `RolesPermissionsView.tsx`); `src/pages/dashboard/DatabaseManager.tsx` (954 lines, unrouted diagnostic tool). All 3 are still imported in `App.tsx:22, 29, 30`. | Canonical in sidebar under System ("Overview", "User Directory", "Roles & Permissions", "School Settings", "Audit Logs", "Security & Governance"). |

### B. Peripheral & Orphaned Modules Not in Sidebar Navigation

The following modules exist in `src/pages/dashboard/` and are defined as `<Route>` in `App.tsx`, but are **completely omitted** from the `DashboardLayout.tsx` sidebar:
1. `src/pages/dashboard/HostelManagement.tsx` (`/dashboard/hostel`): Linked only from a quick card in `Analytics.tsx:455`. Allocations and Visitors tabs lack DB tables.
2. `src/pages/dashboard/FrontOfficeManagement.tsx` (`/dashboard/front-office`): Manages visitor logs and general inquiries; duplicates admission inquiries.
3. `src/pages/dashboard/MedicalManagement.tsx` (`/dashboard/medical`): Linked from `Student360Drawer.tsx:1281`. Lacks `student_id` in form insert payload.
4. `src/pages/dashboard/DisciplineManagement.tsx` (`/dashboard/discipline`): Linked from `Student360Drawer.tsx:1314`. Duplicates Student 360 Discipline tab.
5. `src/pages/dashboard/OnlineClasses.tsx` (`/dashboard/online-classes`).
6. `src/pages/dashboard/SchoolCalendar.tsx` (`/dashboard/calendar`): Broken queries against `holidays`.
7. `src/pages/dashboard/AIAssistant.tsx` (`/dashboard/ai`): Static mock page; the live Gemini AI interface is floating in `GoogleAIBot.tsx`.
8. `src/pages/dashboard/Reports.tsx` (`/dashboard/reports`): Dead mock page.
9. `src/pages/dashboard/GoogleFormsManager.tsx` and `GoogleClassroomManager.tsx`: Imported in `App.tsx:27, 28`, but have **no Route** and no sidebar entry.

---

### C. Admin UI Action Button & Interactivity Audit

We verified every Admin-visible action button, modal, and table action across the 14 business modules:

#### 1. Verified Real Supabase Operations (CREATE, EDIT, DELETE, RPC, EXPORT, PRINT)
- **Admissions (`AdmissionsManagement.tsx`):**
  - "New Admission" button -> `AdmissionApplicationFormModal` -> calls `admissionService.createAdmission` (`supabase.from('admissions').insert([payload])`) -> **REAL**
  - "Bulk Approve" button -> `admissionService.approveAdmission` -> calls Postgres RPC `approve_admission` -> **REAL**
  - Row Action "Approve" (`Check`) -> `AdmissionApprovalsModal` -> calls Postgres RPC `approve_admission` -> **REAL**
  - Row Action "Reject" (`XCircle`) -> `AdmissionRejectModal` -> calls Postgres RPC `reject_admission` -> **REAL**
  - Row Action "Print Letter" (`Printer`) -> `AdmissionLetterModal` -> renders official admission letter -> **REAL**
  - Row Action "View 360" (`Eye`) -> `AdmissionDetailsDrawer` -> loads and displays application record and documents -> **REAL**
  - "Export CSV" -> generates CSV blob and triggers browser download -> **REAL**
  - "Sync Database" (`RefreshCcw`) -> calls `loadData()` -> **REAL**

- **Students (`Students.tsx`):**
  - "Admit New Student" button -> `StudentFormModal` -> calls Postgres RPC `create_student` -> **REAL**
  - Row Action "Edit" (`Edit`) -> `StudentFormModal` -> calls Postgres RPC `update_student` -> **REAL**
  - Row Action "Promote Class" (`TrendingUp`) -> `StudentPromotionModal` -> inserts to `student_promotions`, `student_class_history`, updates `students`, inserts to `student_activity` -> **REAL**
  - Row Action "Change Status" (`UserMinus`) -> `StudentStatusChangeModal` -> calls Postgres RPC `set_student_status` -> **REAL**
  - Row Action "Print ID Card" (`Printer`) -> `StudentIDCardModal` -> renders printable CBSE ID card with live SVG QR code -> **REAL**
  - Row Action "View 360" (`Eye`) -> `Student360Drawer` -> loads comprehensive 12-tab profile with live SQL queries across 10 tables -> **REAL**
  - "Export CSV" (All / Selected) -> generates CSV download -> **REAL**

- **Academics (`AcademicsManagement.tsx` & child views):**
  - Academic Years: Add (`saveAcademicYear`), Make Current (`setCurrentAcademicYear` RPC), Delete (`deleteAcademicYear`) -> **REAL**
  - Classes & Sections: Add/Edit/Delete Class (`saveClass`, `deleteClass`), Add/Edit Section -> **REAL**
  - Subjects: Add/Edit/Delete Subject (`saveSubject`, `deleteSubject`) -> **REAL**
  - Class-Subjects: Map/Unmap Subject to Class (`saveClassSubjectMapping`, `deleteClassSubjectMapping`) -> **REAL**
  - Timetable: Slot Add/Edit/Delete (`saveTimetableSlot`, `deleteTimetableSlot`) -> **REAL**

- **Teachers & Faculty (`Teachers.tsx`):**
  - Add/Edit Teacher -> `TeacherFormModal` -> `saveTeacher` -> **REAL**
  - Academic Assignment -> `TeacherAssignmentModal` -> `saveAssignment` -> **REAL**
  - Bulk Matrix Assignment -> `BulkAssignmentModal` -> `bulkAssignTeachers` -> **REAL**
  - Change Status -> `TeacherStatusModal` -> `updateTeacherStatus` -> **REAL**
  - View 360 Profile -> `Teacher360Drawer` -> **REAL**

- **Staff / Employees (`Employees.tsx`):**
  - Add/Edit Employee -> `supabase.from('staff').insert / update` -> **REAL**
  - End Employment (Delete button) -> calls Postgres RPC `set_staff_status` -> **REAL** (uses browser `window.prompt` for reason)

- **Attendance (`AttendanceEntry.tsx`):**
  - "Save Register" (`Save`) -> calls Postgres RPC `save_attendance` with bulk array -> **REAL**
  - Bulk Mark "Present All", "Absent All" -> updates local register state -> saved via RPC -> **REAL**
  - Remarks Modal -> persists note per student record in register payload -> **REAL**
  - Export CSV -> downloads attendance log -> **REAL**

- **Examination (`ExaminationModule.tsx` & `src/components/results/*`):**
  - "New Exam Assessment" -> `supabase.from('exams').insert / update` -> **REAL**
  - "Delete Exam" -> `supabase.from('exams').delete().eq('id', examId)` -> **REAL**
  - "Map Subjects & Teachers" -> `supabase.from('exam_subjects').insert / update` -> **REAL**
  - Marks Entry Save -> persists theory, internal, practical marks -> **REAL**
  - Result Processing & Grace Marks -> calculations and updates via `ResultProcessingView.tsx` -> **REAL**
  - Result Publication -> publication status toggles in `exams` table -> **REAL**
  - Print Datesheets & Admit Cards -> renders printable view with QR code -> **REAL**
  - CBSE Report Cards Hub -> generates consolidated marksheet / report cards -> **REAL**

- **Fees & Finance (`FeesPortal.tsx` & `src/components/fees/*`):**
  - "Collect Fee" -> `FeeCollectionModal` -> calls Postgres RPC `collect_fee` -> **REAL**
  - "Print Receipt" -> `FeeReceiptModal` -> prints official receipt with receipt number, payment mode, breakdown -> **REAL**
  - "Void Payment" -> `FeeVoidModal` -> calls Postgres RPC `void_fee_payment` with audit reason -> **REAL**
  - Fee Structure Manager -> `saveFeeCategory` and `saveFeeStructureItem` (`supabase.from('fee_structure').upsert`) -> **REAL**
  - Export Defaulters / CSV -> **REAL**

- **Certificates & ID (`CertificateGenerator.tsx`):**
  - "Issue Certificate" -> `supabase.from('certificates').insert([payload])` -> **REAL**
  - "Delete Certificate" -> `supabase.from('certificates').delete().eq('id', id)` -> **REAL**
  - "Download PDF" -> `jsPDF` + `html2canvasSafe` rendered certificate document -> **REAL**
  - Live QR code generator -> `QRCodeSVG` with verification token -> **REAL**

- **System Administration (`SystemManagement.tsx` & `src/components/system/*`):**
  - Create User -> `UserDirectoryView.tsx` -> Postgres RPC `create_erp_user` -> **REAL**
  - Reset Password -> `UserDirectoryView.tsx` -> Postgres RPC `admin_reset_user_password` -> **REAL**
  - Update Role -> `UserDirectoryView.tsx` -> Postgres RPC `admin_update_user_role` -> **REAL**
  - Toggle Active Status -> `UserDirectoryView.tsx` -> Postgres RPC `admin_toggle_user_status` -> **REAL**
  - Toggle Permission Grant -> `RolesPermissionsView.tsx` -> inserts/deletes in `role_permissions` -> **REAL**
  - Save School Settings -> `SchoolSettingsView.tsx` -> updates `school_settings` table -> **REAL**
  - View / Filter Audit Logs -> `AuditLogsView.tsx` -> queries `audit_logs` table -> **REAL**

---

#### 2. Identified Dead, Placeholder, Mock, or Broken Interactions
We identified 11 distinct fake, dead, or broken button/operation interactions in the Admin interface:

1. **`src/pages/dashboard/Reports.tsx` — 100% Dead UI Mockup:**
   - Line 55: `<button className="...">Scheduled Audits</button>` has **NO `onClick` handler**.
   - Line 90: `<button className="p-2 ..."><Download size={14} /></button>` for all 9 reports across Academic, Financial, and Staff has **NO `onClick` handler**.
   - Line 111: `<button className="...">Launch Export Engine</button>` has **NO `onClick` handler**.
   - The entire page is static mock HTML that performs zero operations.

2. **`src/pages/dashboard/Settings.tsx` — Fake Toast-Only Save:**
   - Lines 32–34:
     ```ts
     const handleSave = () => {
       toast.success('System preferences updated successfully');
     };
     ```
     Clicking "Commit Changes" shows a success toast but executes **zero database calls**. Hardcoded mock strings ("Latency: 24ms", "Project ais-dev-krnz"). The route `/dashboard/settings` already redirects to `/dashboard/system/settings`, leaving this page as obsolete dead code.

3. **`src/pages/dashboard/LibraryManagement.tsx` — Broken Categories & Fines Actions:**
   - In `handleSave` (lines 189–216): Only handles `activeTab === 'books'` and `activeTab === 'issues'`. For `categories` and `fines`, it executes **no database query**, shows `toast.success`, and closes the modal without saving anything.
   - In `handleDelete` (line 173):
     ```ts
     const table = activeTab === 'books' ? 'library_books' : 'book_issues';
     const { error } = await supabase.from(table).delete().eq('id', id);
     ```
     When deleting in `categories` or `fines`, it attempts to delete from `book_issues` using IDs like `cat-0` or `fine-xxx`, throwing a database error.

4. **`src/pages/dashboard/InventoryManagement.tsx` — Dead Vendors & Orders Tabs:**
   - Lines 91–120: `loadData()` only queries `assets` and `inventory`. `vendors` and `orders` are initialized to `[]` and never loaded from Supabase because tables `vendors` and `purchase_orders` do not exist.
   - Lines 139–172: `handleSave` only has branches for `assets` and `stock`. Adding a vendor or purchase order saves nothing.
   - Lines 770–805: Modal popup prompts the user to manually copy raw SQL schema into the Supabase SQL editor (`generateSQL()`).

5. **`src/pages/dashboard/CommunicationManagement.tsx` — Dead Push Alerts Tab:**
   - Lines 85–89: `loadData()` queries `notices`, `sms_logs`, `email_logs`. `pushAlerts` is never loaded from any table.
   - Lines 142–188: `handleSave` has no branch for `push`.
   - Lines 205–207: `handleDelete` defaults to `email_logs` when active tab is `push`.

6. **`src/pages/dashboard/TransportManagement.tsx` — Missing `student_id` Foreign Key on Allotment:**
   - Lines 231–236:
     ```ts
     const payload = {
       route_id: formData.route_id,
       vehicle_id: formData.vehicle_id,
       boarding_point: formData.boarding_point,
       pickup_time: formData.pickup_time
     };
     await supabase.from('student_transport').insert([payload]);
     ```
     The form takes student name and class as raw text inputs (`formData.student_class`), but **never prompts for a student or includes `student_id`** in the payload. Creating an allotment either violates foreign key constraints or creates an unlinked record.

7. **`src/pages/dashboard/MedicalManagement.tsx` — Missing `student_id` Foreign Key:**
   - Lines 142–165: Similar to Transport, the Add Medical Record form accepts a plain text student name and class string, but omits `student_id` from the `student_medical` insert payload.

8. **`src/pages/dashboard/SchoolCalendar.tsx` — Broken Schema Queries:**
   - Line 45: `order('date', { ascending: true })` fails because the column in `holidays` is named `start_date`.
   - Lines 60–65: Reads `h.name` and `h.is_restricted`, which do not exist in the `holidays` table (`title`, `start_date`, `end_date`, `is_national`). Causes database error on page load.

9. **`server.ts:34` — Wrong Table Name for AI Grounding:**
   - Line 34: `supabase.from('fees').select('id, status, amount, student_id')` fails because the database table is `student_fees`. The error is swallowed in `console.warn`, leaving Google Gemini grounding partially degraded.

10. **`src/pages/dashboard/Analytics.tsx` — Mismatched Navigation Target:**
    - Lines 286–298: Stat card labeled "Total Teachers" navigates to `/dashboard/employees` instead of `/dashboard/teachers`.

11. **`src/components/students/Student360Drawer.tsx` — Missing Route Context:**
    - Line 637 & 963: "Collect Fees" navigates to `/dashboard/fees` without passing student ID in router state.
    - Line 649 & 1044: "Marks" navigates to `/dashboard/marks` without exam/student context.
    - Line 1201: "Certificates" navigates to `/dashboard/certificates` without student context.

---

### D. UI/UX Consistency Audit

| Dimension | Findings & Compliance State | Affected Areas / Severity |
|---|---|---|
| **Page Headers** | Most pages use a consistent top banner with module title, description, badge, and primary action buttons. Academics and System have clean sub-view tab headers. Reports and Settings have inconsistent styling. | Low — Generally good visual hierarchy across core modules. |
| **Breadcrumbs** | **100% MISSING across the entire ERP.** Neither `DashboardLayout.tsx` nor individual module pages implement breadcrumb navigation (e.g. `Dashboard > Academics > Classes & Sections`). | **HIGH UI/UX Defect** — Violates Acceptance Criteria R4. |
| **Search & Filters** | Implemented consistently in Admissions, Students, Academics, Teachers, and Fees (multi-field client debounce, session/class/status dropdowns). Less granular in Library, Transport, and Inventory. | Medium — Core modules are strong; secondary modules have basic filters. |
| **Dense Data Tables** | Students, Admissions, Staff, Fees, and Exams use structured tables with avatar cells, status pills, checkbox selection, and responsive column models. | Low — High quality and consistent styling across major modules. |
| **Responsive Layouts** | `DashboardLayout.tsx` handles mobile drawer (slide-out overlay from 375px to 1024px) and collapsible desktop sidebar. Large data tables use horizontal scroll containers (`overflow-x-auto`). | Low — Responsive baseline is solid from 375px to 1920px desktop. |
| **Loading / Empty / Error States** | Strong implementations in Academics, System, Students, and Fees via `LoadingBlock`, `EmptyBlock`, and `ErrorBlock` with retry buttons. Weak in Reports (no states) and secondary modules (toast-only errors). | Medium — Secondary modules need standardized error/empty components. |

---

## 2. Logic Chain

1. **Rule of Architectural Cleanliness (ONE BUSINESS FUNCTION = ONE PRIMARY MODULE):**
   - Observations show that Academics (`/dashboard/academics/:view`) and System (`/dashboard/system/:view`) successfully consolidated previously fragmented routes using sub-paths and permanent redirects.
   - However, legacy pages remain in `src/pages/dashboard/`: `Settings.tsx` (replaced by `/dashboard/system/settings`), `RoleAndUserManager.tsx` (replaced by `/dashboard/system/users`), `DatabaseManager.tsx` (unrouted), and `Reports.tsx` (dead mockup).
   - In Examination, `/dashboard/exam` and `/dashboard/marks` still exist as separate files that wrap `ExaminationModule.tsx`, whereas canonical links use `/dashboard/examination?tab=...`.
   - In Attendance, `SchoolCalendar.tsx` duplicates the holiday calendar from `AttendanceEntry.tsx` with a broken query.
   - In Admissions, `EnquiriesPipeline.tsx` and `AdmissionReports.tsx` are unreferenced dead code, while Front Office duplicates inquiry logging.
   - **Deduction:** The ERP needs a final deduplication pass to remove obsolete files, redirect remaining alias routes to their canonical parents, and establish a single source of truth for each business function.

2. **Authenticity of UI Actions (Real Supabase vs Dead/Mock/Toast):**
   - Observations show that the core ERP modules (Admissions, Students, Academics, Teachers, Staff, Attendance, Exams, Fees, Certificates, System) execute **real Supabase operations** with PostgreSQL RPCs (`approve_admission`, `reject_admission`, `create_student`, `update_student`, `set_student_status`, `collect_fee`, `void_fee_payment`, `save_attendance`, `create_erp_user`, etc.).
   - However, secondary modules (Library Categories/Fines, Inventory Vendors/Orders, Communication Push Alerts, Reports) contain buttons that either have no click handler or mock `toast.success` without database persistence.
   - In Transport and Medical, records fail to insert correctly because `student_id` was omitted from form payloads.
   - In `server.ts`, querying `fees` instead of `student_fees` breaks AI grounding.
   - **Deduction:** The primary modules are production-grade, but secondary/peripheral modules contain placeholder or broken interactions that must either be implemented with real additive migrations or cleanly scoped/disabled to prevent user confusion.

3. **Navigation & Context Preservation:**
   - Observations show that while `DashboardLayout.tsx` provides role-based sidebar filtering and global search, cross-module links in `Student360Drawer.tsx` often omit student context parameters when navigating to Fees or Marks.
   - The "Total Teachers" stat card in `Analytics.tsx` mistakenly navigates to Staff (`/dashboard/employees`) instead of Faculty (`/dashboard/teachers`).
   - Breadcrumbs are completely absent from the application layout.
   - **Deduction:** Adding a centralized Breadcrumb bar in `DashboardLayout.tsx` and fixing router state parameter passing in `Student360Drawer` and `Analytics` will satisfy R2 and R4.

---

## 3. Caveats

1. **Database Direct Connectivity:** As a read-only explorer subagent, we inspected the schema via SQL migrations, TypeScript interfaces, and source code queries. Live database query validation via `supabase-postgres` tool is handled by peer agent `explorer_survey_db`.
2. **Third-Party Integrations:** Google Classroom and Google Forms managers require active OAuth2 credentials (`VITE_GOOGLE_CLIENT_ID`) and Google API tokens; because they are currently unrouted in `App.tsx`, their runtime behavior was evaluated statically.
3. **Hardware / Telephony Gateways:** SMS and Email dispatch in `CommunicationManagement.tsx` records logs to the database; actual SMS delivery depends on external gateway webhook/cron configurations not currently bound to local client code.

---

## 4. Conclusion & Actionable Roadmap

### A. Recommended File Deduplication & Consolidation (KEEP, MOVE, MERGE, REMOVE, REDIRECT, RENAME)

| File / Component | Action | Justification |
|---|---|---|
| `src/pages/dashboard/Reports.tsx` | **REMOVE / REDIRECT** | Completely dead static mockup. Redirect `/dashboard/reports` to the canonical module report hubs or replace with a real aggregated reports dashboard. |
| `src/pages/dashboard/Settings.tsx` | **REMOVE** | Obsolete mock settings page; `/dashboard/settings` already redirects to `/dashboard/system/settings`. Remove file and delete unused import in `App.tsx:22`. |
| `src/pages/dashboard/RoleAndUserManager.tsx` | **REMOVE** | Obsolete user manager; `/dashboard/users-roles` already redirects to `/dashboard/system/users`. Remove file and delete unused import in `App.tsx:30`. |
| `src/pages/dashboard/DatabaseManager.tsx` | **REMOVE** | Unrouted, unlisted 954-line file containing experimental SQL playground. Delete unused import in `App.tsx:29`. |
| `src/pages/dashboard/GoogleFormsManager.tsx` & `GoogleClassroomManager.tsx` | **REMOVE or ROUTE** | Imported in `App.tsx:27, 28` but not routed. Delete unused imports. |
| `src/pages/dashboard/ExamManagement.tsx` & `MarksEntry.tsx` | **REDIRECT** | Replace wrappers with clean `<Navigate to="/dashboard/examination?tab=exams" replace />` and `<Navigate to="/dashboard/examination?tab=marks" replace />` in `App.tsx`. |
| `src/pages/dashboard/SchoolCalendar.tsx` | **REDIRECT** | Redirect `/dashboard/calendar` to `/dashboard/attendance` (with `state: { activeTab: 'calendar' }`) which contains the functional, schema-compliant holiday calendar. |
| `src/pages/dashboard/fees/` (directory) | **REMOVE** | Empty directory. `FeesPortal.tsx` is the canonical fees hub. |
| `src/components/admissions/EnquiriesPipeline.tsx` & `AdmissionReports.tsx` | **MERGE or REMOVE** | Integrate into `AdmissionsManagement.tsx` as sub-tabs ("Applications", "Enquiries Pipeline", "Intake Reports") or delete if out of scope. |
| `src/pages/dashboard/FrontOfficeManagement.tsx` | **KEEP / MERGE** | Keep for visitor gate passes and courier logs; redirect admissions enquiries tab to `AdmissionsManagement`. |

### B. High-Priority Interaction Fixes (P0 - P1)
1. **Fix `server.ts:34`**: Change `supabase.from('fees')` to `supabase.from('student_fees')` to fix AI database grounding.
2. **Fix `Analytics.tsx:297`**: Change "Total Teachers" stat card click handler to navigate to `/dashboard/teachers` instead of `/dashboard/employees`.
3. **Fix `TransportManagement.tsx:231`**: Add student selection modal/dropdown to Transit Allotments so `student_id` is populated in the `student_transport` insert payload.
4. **Fix `MedicalManagement.tsx:142`**: Add student selector to the Medical Record modal to populate `student_id` in `student_medical`.
5. **Fix `Student360Drawer.tsx`**: Pass `{ state: { selectedStudentId: student.id } }` when navigating to Fees (`/dashboard/fees`) and Certificates (`/dashboard/certificates`).
6. **Add Central Breadcrumbs Component**: Implement a standard Breadcrumb bar in `DashboardLayout.tsx` rendering `Home > [Module] > [Sub-view]` dynamically based on `location.pathname`.
7. **Address Secondary Module Gaps**: For Library (Categories/Fines), Inventory (Vendors/Orders), and Communication (Push), either apply the missing database tables via additive migrations or scope tabs to read-only/disabled states with clear administrative notice.

---

## 5. Verification Method

To independently verify the observations and findings in this report:

1. **Verify Unused Imports in `App.tsx`:**
   ```powershell
   Select-String -Path "src/App.tsx" -Pattern "GoogleFormsManager|GoogleClassroomManager|DatabaseManager|RoleAndUserManager"
   ```
   *Expected:* Shows imports on lines 27–30 with no matching `<Route>` usage anywhere in the file.

2. **Verify Dead Buttons in `Reports.tsx`:**
   ```powershell
   Select-String -Path "src/pages/dashboard/Reports.tsx" -Pattern "onClick"
   ```
   *Expected:* Returns 0 matches. Every button on the page lacks an event handler.

3. **Verify Fake Toast-Only Save in `Settings.tsx`:**
   ```powershell
   Select-String -Path "src/pages/dashboard/Settings.tsx" -Pattern "supabase"
   ```
   *Expected:* Returns 0 matches. `handleSave` only triggers `toast.success`.

4. **Verify Missing `student_id` in Transport and Medical:**
   ```powershell
   Select-String -Path "src/pages/dashboard/TransportManagement.tsx" -Pattern "student_id"
   Select-String -Path "src/pages/dashboard/MedicalManagement.tsx" -Pattern "student_id"
   ```
   *Expected:* Returns 0 matches in insert/update handlers.

5. **Verify AI Grounding Bug in `server.ts`:**
   ```powershell
   Select-String -Path "server.ts" -Pattern "from\('fees'\)"
   ```
   *Expected:* Matches line 34 querying non-existent `fees` table instead of `student_fees`.

6. **Verify Zero Breadcrumbs:**
   ```powershell
   Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "breadcrumb|Breadcrumb"
   ```
   *Expected:* Returns 0 matches across the entire `src` tree.

7. **Verify TypeScript Compilation:**
   ```powershell
   npx tsc --noEmit
   ```
   *Expected:* Checks type integrity across the codebase.
