# Empirical Challenger Report: Milestone 1 Verification (Challenger M1-1 Gen 2)

**Challenger**: Challenger M1-1 (Gen 2)  
**Target Milestone**: Milestone 1 (Features F1, F2, F3, F4)  
**Artifact Directory**: `d:/all_code/r.m.-memorial-public-school/.agents/challenger_m1_1_gen2`  
**Date**: 2026-09-03  
**Final Verdict**: **REJECT**  

---

## Challenge Summary

- **Overall Risk Assessment**: **CRITICAL**
- **Core Violations Found**:
  1. **Unauthorized Traps in Sidebar Navigation**: 6 entire categories (`Library`, `Transport`, `Inventory & Assets`, `Communication`) and individual items (`Front Office Desk`, `Student Health & Medical`, `Disciplinary Records`, `School Calendar`, `Issue Credentials`, and the footer `System` link) present clickable links to non-admin roles that immediately navigate to `/unauthorized` due to permission mismatches between `DashboardLayout.tsx` and `App.tsx`.
  2. **Administrative Lockout on 6 Operations Routes**: `App.tsx` guards `/dashboard/front-office`, `/dashboard/medical`, `/dashboard/discipline`, `/dashboard/communication`, `/dashboard/calendar`, and `/dashboard/online-classes` with permissions (`front_office.manage`, `medical.manage`, `discipline.manage`, `communication.manage`, `academics.view`) that were never seeded for the `admin` role in `supabase_rbac_migration_02b.sql`. Standard `admin` accounts are locked out of their own administrative modules.
  3. **Receptionist Role Lockout from Front Office Desk**: Receptionists are granted `student.create` in the database and sidebar, but `App.tsx:309` gates `/dashboard/front-office` on `front_office.manage`. Receptionists are denied access with `/unauthorized`.
  4. **Global Search Context Drop in Faculty Directory**: `DashboardLayout.tsx:623` passes `{ state: { selectedTeacherId: e.id } }` when routing to `/dashboard/teachers`, but `src/pages/dashboard/Teachers.tsx` completely ignores `selectedTeacherId` across its entire implementation, failing to filter, highlight, or open the teacher record.

---

## 1. Observation

### 1.1 Sidebar vs Route Guard Permission Mismatches (`src/components/DashboardLayout.tsx` vs `src/App.tsx`)

Direct inspection of `src/components/DashboardLayout.tsx:119-285` and `src/App.tsx:222-313` reveals severe permission divergence between what the sidebar displays and what the route guards require:

1. **Operations Categories Left Ungated (`permission: null`) in Sidebar**:
   - `src/components/DashboardLayout.tsx:204-213`:
     ```tsx
     {
       title: 'Library',
       icon: Library,
       permission: null,
       items: [
         { label: 'Book Catalog', path: '/dashboard/library', state: { activeTab: 'books' }, permission: null },
         { label: 'Subject Categories', path: '/dashboard/library', state: { activeTab: 'categories' }, permission: null },
         { label: 'Borrowing Ledger', path: '/dashboard/library', state: { activeTab: 'issues' }, permission: null },
         { label: 'Overdue Fines', path: '/dashboard/library', state: { activeTab: 'fines' }, permission: null }
       ]
     }
     ```
     vs `src/App.tsx:230-235`:
     ```tsx
     <Route 
       path="/dashboard/library" 
       element={
         <ProtectedRoute allowedPermission="library.manage">
           <DashboardLayout children={<LibraryManagement />} />
         </ProtectedRoute>
       } 
     />
     ```
   - `src/components/DashboardLayout.tsx:215-224`:
     Category `Transport` (`permission: null`, items `permission: null`) vs `src/App.tsx:222-227`: `/dashboard/transport` requires `allowedPermission="transport.manage"`.
   - `src/components/DashboardLayout.tsx:226-235`:
     Category `Inventory & Assets` (`permission: null`, items `permission: null`) vs `src/App.tsx:246-251`: `/dashboard/inventory` requires `allowedPermission="inventory.manage"`.
   - `src/components/DashboardLayout.tsx:245-254`:
     Category `Communication` (`permission: null`, items `permission: null`) vs `src/App.tsx:254-259`: `/dashboard/communication` requires `allowedPermission="communication.manage"`.
   - `src/components/DashboardLayout.tsx:256-263`:
     Category `Certificates & ID` item `Issue Credentials` (`path: '/dashboard/certificates'`, `permission: null`) vs `src/App.tsx:262-267`: `/dashboard/certificates` requires `allowedPermission="certificates.manage"`.

2. **Sub-Item Permission Divergence in Newly Mounted Modules**:
   - `src/components/DashboardLayout.tsx:126`:
     `{ label: 'Front Office Desk', path: '/dashboard/front-office', permission: 'student.create' }`
     vs `src/App.tsx:307-312`:
     `<Route path="/dashboard/front-office" element={<ProtectedRoute allowedPermission="front_office.manage"><DashboardLayout children={<FrontOfficeManagement />} /></ProtectedRoute>} />`
   - `src/components/DashboardLayout.tsx:136`:
     `{ label: 'Student Health & Medical', path: '/dashboard/medical', permission: 'student.view' }`
     vs `src/App.tsx:291-296`:
     `<Route path="/dashboard/medical" element={<ProtectedRoute allowedPermission="medical.manage"><DashboardLayout children={<MedicalManagement />} /></ProtectedRoute>} />`
   - `src/components/DashboardLayout.tsx:137`:
     `{ label: 'Disciplinary Records', path: '/dashboard/discipline', permission: 'student.view' }`
     vs `src/App.tsx:299-304`:
     `<Route path="/dashboard/discipline" element={<ProtectedRoute allowedPermission="discipline.manage"><DashboardLayout children={<DisciplineManagement />} /></ProtectedRoute>} />`
   - `src/components/DashboardLayout.tsx:157`:
     `{ label: 'School Calendar', path: '/dashboard/calendar', permission: null }`
     vs `src/App.tsx:283-288`:
     `<Route path="/dashboard/calendar" element={<ProtectedRoute allowedPermission="academics.view"><DashboardLayout children={<SchoolCalendar />} /></ProtectedRoute>} />`

3. **Unconditionally Rendered Footer Item**:
   - `src/components/DashboardLayout.tsx:491-498`:
     ```tsx
     <SidebarItem 
       icon={Settings} 
       label="System" 
       path="/dashboard/system/overview" 
       active={location.pathname.startsWith('/dashboard/system')} 
       collapsed={isMobile ? false : collapsed}
       onClick={() => isMobile && setMobileOpen(false)}
     />
     ```
     Rendered in JSX without any `can('settings.manage')` guard.
     vs `src/App.tsx:177-182`:
     `<Route path="/dashboard/system/:view" element={<ProtectedRoute allowedPermission="settings.manage"><DashboardLayout children={<SystemManagement />} /></ProtectedRoute>} />`

### 1.2 Administrative Role Seeding Defect (`supabase_rbac_migration_02b.sql`)

Direct inspection of `supabase_rbac_migration_02b.sql:97-106`:
```sql
  ('admin','student.view'),('admin','student.list'),('admin','student.create'),
  ('admin','student.update'),('admin','student.delete'),
  ('admin','teacher.view'),('admin','teacher.create'),('admin','teacher.edit'),('admin','teacher.delete'),
  ('admin','staff.view'),('admin','attendance.manage'),
  ('admin','fees.collect'),('admin','fees.view'),('admin','fees.refund'),
  ('admin','results.publish'),('admin','results.view'),
  ('admin','reports.view'),('admin','reports.export'),
  ('admin','settings.manage'),('admin','database.manage'),('admin','academics.manage'),
  ('admin','inventory.manage'),('admin','certificates.manage'),('admin','documents.manage'),
  ('admin','library.manage'),('admin','transport.manage'),('admin','hostel.manage'),
```
- Role `'super_admin'` is granted `'*'`.
- Role `'admin'` is granted only the 27 explicit strings listed above.
- Role `'admin'` DOES NOT possess:
  - `front_office.manage`
  - `medical.manage`
  - `discipline.manage`
  - `communication.manage`
  - `academics.view`
- In `src/context/AuthContext.tsx:175-178`:
  ```tsx
  const can = useCallback(
    (permission: string) => permissions.has('*') || permissions.has(permission),
    [permissions]
  );
  ```
  Since `role = 'admin'` does not have `*` and lacks these specific strings, `can(permission)` returns `false`.

### 1.3 Receptionist Role Seeding Defect (`supabase_rbac_migration_02b.sql:135`)
```sql
  ('receptionist','student.view'),('receptionist','student.list'),('receptionist','student.create'),
```
- Role `'receptionist'` only has `student.view`, `student.list`, and `student.create`.
- Role `'receptionist'` lacks `front_office.manage`.

### 1.4 Global Search State Ingestion Failure in `Teachers.tsx`

Direct inspection of `src/components/DashboardLayout.tsx:622-626`:
```tsx
if (e.role === 'Teacher' || e.department === 'Teaching') {
  navigate('/dashboard/teachers', { state: { selectedTeacherId: e.id } });
} else {
  navigate('/dashboard/employees', { state: { selectedEmployeeId: e.id } });
}
```
Inspection of `src/pages/dashboard/Teachers.tsx:35-88`:
```tsx
interface TeachersNavState {
  activeTab?: ViewMode;
  assign?: AssignmentPrefill;
}
...
  const consumedNavState = useRef<unknown>(null);
  useEffect(() => {
    if (location.pathname !== TEACHERS_PATH) return;
    const nav = location.state as TeachersNavState | null;
    if (!nav || consumedNavState.current === nav) return;
    consumedNavState.current = nav;

    if (nav.activeTab) setActiveTab(nav.activeTab);
    if (nav.assign) {
      setSelectedTeacher(null);
      setAssignPrefill(nav.assign);
      setIsAssignOpen(true);
    }
  }, [location.pathname, location.state]);
```
- A complete scan of all 725 lines of `src/pages/dashboard/Teachers.tsx` confirms that string `selectedTeacherId` NEVER appears.
- When an administrator searches for a teacher in Global Search and clicks the result, `selectedTeacherId` is completely ignored. The faculty directory renders with default pagination and filters, failing to select, focus, or display the searched teacher.
- In contrast, `src/pages/dashboard/Employees.tsx:124-137` consumes `location.state?.selectedEmployeeId` properly:
  ```tsx
  useEffect(() => {
    const empId = location.state?.selectedEmployeeId;
    if (empId) {
      setSelectedEmployeeIds([empId]);
      setSelectedEmployeeFilter(empId);
    }
  }, [location.state?.selectedEmployeeId]);
  ```

---

## 2. Logic Chain

1. **Failure Mode 1: Unauthorized Traps via Broken Navigation Matrix**
   - `src/components/DashboardLayout.tsx:311-323` filters sidebar categories and sub-items using `item.permission ? can(item.permission) : true`.
   - When `item.permission` is `null`, the item is unconditionally retained in `filteredCategories` for all authenticated users.
   - Therefore, roles such as `teacher`, `student`, `parent`, `accountant`, `librarian`, `transport_manager`, `hostel_warden`, and `receptionist` see categories and links for `Library`, `Transport`, `Inventory & Assets`, `Communication`, `School Calendar`, `Issue Credentials`, and the footer `System` link.
   - When any such user clicks any of these links, the browser pushes the corresponding route (`/dashboard/library`, `/dashboard/transport`, `/dashboard/inventory`, `/dashboard/communication`, `/dashboard/calendar`, `/dashboard/certificates`, `/dashboard/system/overview`).
   - In `src/App.tsx`, these routes are protected by `allowedPermission` (`library.manage`, `transport.manage`, `inventory.manage`, `communication.manage`, `academics.view`, `certificates.manage`, `settings.manage`).
   - In `src/App.tsx:75`:
     ```tsx
     if (allowedPermission && !can(allowedPermission)) {
       return <Navigate to="/unauthorized" replace />;
     }
     ```
   - Because the user does not hold these permissions, `can(allowedPermission)` returns `false`.
   - The user is redirected to `/unauthorized`.
   - **Conclusion**: The UI misleads users by offering visible navigation items that immediately fail closed with an unauthorized access error.

2. **Failure Mode 2: Administrative Lockout from 6 Operations Modules**
   - In `App.tsx`, Worker M1 assigned newly invented permission strings to 6 routes:
     - `/dashboard/front-office` -> `front_office.manage`
     - `/dashboard/medical` -> `medical.manage`
     - `/dashboard/discipline` -> `discipline.manage`
     - `/dashboard/communication` -> `communication.manage`
     - `/dashboard/calendar` -> `academics.view`
     - `/dashboard/online-classes` -> `academics.view`
   - In PostgreSQL `role_permissions` (seeded in `supabase_rbac_migration_02b.sql:97-106`), the `admin` role has `academics.manage`, `inventory.manage`, etc., but does NOT have any of the 5 strings above.
   - Only `super_admin` has `'*'`.
   - For an `admin` user, `can('front_office.manage')`, `can('medical.manage')`, `can('discipline.manage')`, `can('communication.manage')`, and `can('academics.view')` all evaluate to `false`.
   - **Conclusion**: School administrators (`admin` role) are locked out of Front Office Desk, Student Medical, Disciplinary Records, Communication Hub, School Calendar, and Online Classes.

3. **Failure Mode 3: Receptionist Lockout from Front Office Desk**
   - Worker M1 explicitly justified mounting `Front Office Desk` under `Admissions` in `worker_m1/handoff.md:43` to give receptionists immediate desk access.
   - The sidebar item was given `permission: 'student.create'`, which receptionists possess.
   - But the route in `App.tsx:309` was given `allowedPermission="front_office.manage"`, which receptionists DO NOT possess.
   - **Conclusion**: Receptionists see "Front Office Desk", click it, and receive an Unauthorized screen.

4. **Failure Mode 4: Asymmetric Global Search State Consumption**
   - `PROJECT.md:41` specifies:
     `Global Search -> Employees: If role === 'Teacher', navigate to /dashboard/teachers with { state: { selectedTeacherId: id } }. If staff, navigate to /dashboard/employees with { state: { selectedEmployeeId: id } }.`
   - `DashboardLayout.tsx:623` passes `{ state: { selectedTeacherId: e.id } }`.
   - `Teachers.tsx` fails to implement the receiving side of this contract. It never checks `location.state.selectedTeacherId`.
   - **Conclusion**: Global search to teachers drops the selected context upon navigation.

---

## 3. Caveats

- `super_admin` possesses the wildcard permission `'*'` and is unaffected by the missing specific permission grants. However, the system cannot require all administrative staff to operate as `super_admin`, violating the principle of least privilege and RBAC separation.
- Frontend route compilation and Vite production builds succeed with code 0 (`tsc --noEmit` and `npm run build`), proving that these defects are logical, structural, and authorization mismatches rather than syntax or type errors.

---

## 4. Conclusion & Actionable Mitigations

Milestone 1 is **REJECTED**. The implementation in `src/App.tsx`, `src/components/DashboardLayout.tsx`, and `src/pages/dashboard/Teachers.tsx` must be corrected before advancing to Milestone 2.

### Required Remediations:

1. **Align Sidebar Categories and Item Permissions in `src/components/DashboardLayout.tsx`**:
   - `Library`: Set category `permission: 'library.manage'`, or set item permissions to `'library.manage'`.
   - `Transport`: Set category `permission: 'transport.manage'`, or set item permissions to `'transport.manage'`.
   - `Inventory & Assets`: Set category `permission: 'inventory.manage'`, or set item permissions to `'inventory.manage'`.
   - `Communication`: Set category `permission: 'communication.manage'`, or set item permissions to `'communication.manage'`.
   - `Certificates & ID -> Issue Credentials`: Set `permission: 'certificates.manage'`.
   - `Students -> Student Health & Medical`: Set `permission: 'medical.manage'`.
   - `Students -> Disciplinary Records`: Set `permission: 'discipline.manage'`.
   - `Admissions -> Front Office Desk`: Set `permission: 'front_office.manage'`.
   - `Academics -> School Calendar`: Set `permission: 'academics.view'`.
   - `Footer System Link`: Gate with `<Can permission="settings.manage">` so non-admin roles do not see a dead link to `/dashboard/system/overview`.

2. **Synchronize Route Permissions with Role Grants**:
   - Either add `front_office.manage`, `medical.manage`, `discipline.manage`, `communication.manage`, and `academics.view` to the `admin` role (and appropriate staff roles like `receptionist`) in an additive migration or in `DEFAULT_ROLE_PERMISSIONS`/`Can.tsx`, OR align the route guards in `App.tsx` to existing permissions (`settings.manage`, `academics.manage`, `student.create`).

3. **Consume `selectedTeacherId` in `src/pages/dashboard/Teachers.tsx`**:
   - Add `selectedTeacherId?: string` to `TeachersNavState`.
   - In `useEffect`, when `location.state?.selectedTeacherId` is present:
     - Set `searchQuery` or a dedicated `selectedTeacherFilter` to filter the table to that teacher, OR automatically invoke `handleOpen360(matchedTeacher)` to open the Teacher 360 Workspace drawer.

---

## 5. Verification Method

### Test Matrix: Empirical Role Navigation & Permission Walk

| Role | Action / Navigation Target | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| `teacher` | Click "Library" in Sidebar | Item should not be visible to teachers | Item is visible; clicking navigates to `/dashboard/library` -> redirects to `/unauthorized` | **FAIL** |
| `teacher` | Click "Transport" in Sidebar | Item should not be visible to teachers | Item is visible; clicking navigates to `/dashboard/transport` -> redirects to `/unauthorized` | **FAIL** |
| `teacher` | Click "Inventory & Assets" in Sidebar | Item should not be visible to teachers | Item is visible; clicking navigates to `/dashboard/inventory` -> redirects to `/unauthorized` | **FAIL** |
| `teacher` | Click "Communication" in Sidebar | Item should not be visible to teachers | Item is visible; clicking navigates to `/dashboard/communication` -> redirects to `/unauthorized` | **FAIL** |
| `teacher` | Click "Student Health & Medical" in Sidebar | If viewable, route must allow access; else hide link | Item is visible (via `student.view`); route requires `medical.manage` -> redirects to `/unauthorized` | **FAIL** |
| `teacher` | Click "Disciplinary Records" in Sidebar | If viewable, route must allow access; else hide link | Item is visible (via `student.view`); route requires `discipline.manage` -> redirects to `/unauthorized` | **FAIL** |
| `teacher` | Click "System" in Sidebar Footer | Link should only render for administrators | Link renders unconditionally; clicking redirects to `/unauthorized` | **FAIL** |
| `receptionist` | Click "Front Office Desk" in Sidebar | Navigates to `/dashboard/front-office` and displays Front Office desk | Item renders (via `student.create`); route requires `front_office.manage` -> redirects to `/unauthorized` | **FAIL** |
| `admin` | Navigate to `/dashboard/front-office` | Administrator accesses Front Office Desk | `admin` lacks `front_office.manage` -> redirects to `/unauthorized` | **FAIL** |
| `admin` | Navigate to `/dashboard/medical` | Administrator accesses Medical module | `admin` lacks `medical.manage` -> redirects to `/unauthorized` | **FAIL** |
| `admin` | Navigate to `/dashboard/discipline` | Administrator accesses Discipline module | `admin` lacks `discipline.manage` -> redirects to `/unauthorized` | **FAIL** |
| `admin` | Navigate to `/dashboard/communication` | Administrator accesses Communication module | `admin` lacks `communication.manage` -> redirects to `/unauthorized` | **FAIL** |
| `admin` | Navigate to `/dashboard/calendar` | Administrator accesses School Calendar | `admin` lacks `academics.view` -> redirects to `/unauthorized` | **FAIL** |
| Any user | Search Teacher in Global Search & Click | Navigates to `/dashboard/teachers` and focuses/highlights/opens the selected teacher | Navigates to `/dashboard/teachers`, passes `selectedTeacherId`, but `Teachers.tsx` ignores it | **FAIL** |
| Any user | Search Staff in Global Search & Click | Navigates to `/dashboard/employees` and focuses/filters the selected employee | Navigates to `/dashboard/employees` and filters table by `selectedEmployeeId` | **PASS** |
| Unauthenticated | Navigate to any `/dashboard/*` route | Redirects to `/login` | `ProtectedRoute` executes `if (!user) return <Navigate to="/login" replace />` | **PASS** |
| Legacy Route | Navigate to `/dashboard/marks` or `/dashboard/exam` | Redirects to `/dashboard/examination` | `App.tsx:156-157` executes `<Navigate to="/dashboard/examination" replace />` | **PASS** |

### Code Inspection Command Checklist

To verify these findings directly:
1. Inspect `src/components/DashboardLayout.tsx:204-263` for `permission: null` on sensitive operation categories.
2. Inspect `src/components/DashboardLayout.tsx:491-498` for ungated `<SidebarItem ... label="System" ... />`.
3. Inspect `src/components/DashboardLayout.tsx:126, 136, 137, 157` vs `src/App.tsx:283-312` for permission mismatches.
4. Inspect `supabase_rbac_migration_02b.sql:97-106` to verify that `admin` lacks `front_office.manage`, `medical.manage`, `discipline.manage`, `communication.manage`, and `academics.view`.
5. Inspect `src/pages/dashboard/Teachers.tsx:35-88` to verify that `selectedTeacherId` is completely unhandled.
