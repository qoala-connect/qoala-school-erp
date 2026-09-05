# Handoff Report: Admin Sidebar Alignment & Navigation (Feature F4)

## Executive Summary
This report provides concrete, line-by-line edit instructions for `src/components/DashboardLayout.tsx` to align the Admin sidebar categories (`sidebarCategories`), mount all 6 missing canonical modules (`FrontOfficeManagement`, `SchoolCalendar`, `HostelManagement`, `MedicalManagement`, `DisciplineManagement`, and `Reports`), and correct the Global Search employee routing (`/dashboard/teachers` for instructional staff vs. `/dashboard/employees` for non-instructional staff with ID preservation).

---

## 1. Observation

### 1.1 Current Sidebar Configuration (`src/components/DashboardLayout.tsx:108-265`)
The current `sidebarCategories` array contains 13 top-level items:
1. **Admissions** (`lines 119-127`): contains only `Direct Enrollment` and `Pending Approvals`. Missing `FrontOfficeManagement` (`/dashboard/front-office`).
2. **Students** (`lines 128-136`): contains only `Student Directory & SIS` and `Alumni & Transferred`. Missing `MedicalManagement` (`/dashboard/medical`) and `DisciplineManagement` (`/dashboard/discipline`).
3. **Academics** (`lines 137-155`): contains 7 views (`Overview`, `Academic Years`, `Classes & Sections`, `Subjects`, `Class Subjects`, `Timetable`, `Academic Structure`). Missing `SchoolCalendar` (`/dashboard/calendar`).
4. **Attendance** (`lines 156-163`): contains `Attendance Entry`.
5. **CBSE Examination** (`lines 164-176`): contains 6 sub-items.
6. **Financials** (`lines 177-188`): contains 5 sub-items.
7. **Faculty & Staff** (`lines 189-198`): contains `Teacher Directory & 360`, `Academic Assignments`, `Non-Teaching Staff`.
8. **Library** (`lines 199-209`): contains 4 sub-items.
9. **Transport** (`lines 210-220`): contains 4 sub-items.
10. **Inventory & Assets** (`lines 221-231`): contains 4 sub-items.
11. **Communication** (`lines 232-242`): contains 4 sub-items.
12. **Certificates & ID** (`lines 243-251`): contains `Issue Credentials`, `Student ID Cards`.
13. **System** (`lines 252-264`): contains 6 sub-items.

**Missing Canonical Modules in Sidebar**:
- `FrontOfficeManagement` (`/dashboard/front-office`)
- `SchoolCalendar` (`/dashboard/calendar`)
- `HostelManagement` (`/dashboard/hostel`)
- `MedicalManagement` (`/dashboard/medical`)
- `DisciplineManagement` (`/dashboard/discipline`)
- `Reports` (`/dashboard/reports`)

### 1.2 Unused Imports in `src/components/DashboardLayout.tsx`
- Line 28: `Home as HomeIcon` is imported from `lucide-react` but never referenced anywhere in `DashboardLayout.tsx`.
- Line 8: `BarChart3` is imported from `lucide-react` and only used for the sidebar collapse button at line 497. It is readily available for the `Reports` category icon.

### 1.3 Global Search Routing (`src/components/DashboardLayout.tsx:318-324, 588-619`)
- In `fetchSearchContext()` (`lines 318-324`):
  ```tsx
  const [staffData, teachersData] = await Promise.all([
    supabase.from('staff').select('id, name, employee_id, designation'),
    supabase.from('teachers').select('id, name, employee_id, designation, department')
  ]);
  const combined = [...(teachersData.data || []), ...(staffData.data || [])];
  if (combined.length > 0) setAllEmployees(combined);
  ```
  Neither list explicitly sets a `role` field on the objects.
- In Global Search Employees Render (`lines 589-598`):
  ```tsx
  {filteredSearch.employees.map(e => (
    <button
      key={e.id}
      onClick={() => navigate('/dashboard/employees', { state: { selectedEmployeeId: e.id } })}
      className="..."
    >
  ```
  When any employee (including a Teacher) is clicked, navigation unconditionally targets `/dashboard/employees` with `{ state: { selectedEmployeeId: e.id } }`. Teachers are never routed to `/dashboard/teachers`, and `selectedTeacherId` is not passed.
- In Global Search Exams Render (`lines 608-618`):
  ```tsx
  {filteredSearch.exams.map(ex => (
    <button
      key={ex.id}
      onClick={() => navigate('/dashboard/examination?tab=exams', { state: { selectedExamId: ex.id } })}
      className="..."
    >
  ```
  This already specifies `/dashboard/examination?tab=exams` with `{ state: { selectedExamId: ex.id } }`.
- In Quick Actions (`line 633`):
  `onClick={() => navigate('/dashboard/marks', { state: { view: 'results' } })}` points to the legacy `/dashboard/marks` shim rather than canonical `/dashboard/examination?tab=marks`.

### 1.4 Baseline TypeScript Status
Command `npm run lint` (`tsc --noEmit`) completed with exit code 0 and zero errors.

---

## 2. Logic Chain

### 2.1 Sidebar Category Placement Logic
1. **FrontOfficeManagement (`/dashboard/front-office`)**:
   - In `supabase_rbac_migration_02b.sql:135`, the `receptionist` role is granted `student.view`, `student.list`, and `student.create`. Receptionists do NOT have `settings.manage` (Administration).
   - If mounted under Administration (`settings.manage`), receptionists would be blocked by `can(cat.permission)`.
   - Admissions has `permission: 'student.create'`.
   - Therefore, mounting `FrontOfficeManagement` under **Admissions** (`{ label: 'Front Office Desk', path: '/dashboard/front-office', permission: 'student.create' }`) provides seamless access to receptionists, principals, and admins alike.
2. **SchoolCalendar (`/dashboard/calendar`)**:
   - In `App.tsx:303-309`, `/dashboard/calendar` is an open-read view for all authenticated users.
   - Academics owns class timetables, academic years, and curriculum schedules.
   - Academics in `sidebarCategories` has `permission: null`.
   - Therefore, mounting `{ label: 'School Calendar', path: '/dashboard/calendar', permission: null }` under **Academics** integrates holiday/event schedules directly into the academic domain without permission lockouts.
3. **HostelManagement (`/dashboard/hostel`)**:
   - In `src/components/Can.tsx:55`, `hostel.manage` is an authoritative permission under the `'Operations'` group (`['library.manage', 'transport.manage', 'hostel.manage', 'inventory.manage']`).
   - In `Analytics.tsx:450-456`, Hostel Facilities is part of school utility operations alongside Transport and Inventory.
   - Therefore, mounting a new category `title: 'Operations'` with `icon: HomeIcon` and `permission: 'hostel.manage'` containing `{ label: 'Hostel Management', path: '/dashboard/hostel', permission: 'hostel.manage' }` perfectly fulfills the specification.
4. **MedicalManagement (`/dashboard/medical`) and DisciplineManagement (`/dashboard/discipline`)**:
   - In PostgreSQL, medical data lives in `student_medical` and discipline data lives in `disciplinary_records`, both foreign-keyed to `student_id`.
   - Faculty members and teachers have `student.view` but do NOT have `hostel.manage` or operations write permissions.
   - Mounting under **Students** (`permission: 'student.view'`):
     - `{ label: 'Student Health & Medical', path: '/dashboard/medical', permission: 'student.view' }`
     - `{ label: 'Disciplinary Records', path: '/dashboard/discipline', permission: 'student.view' }`
   - This ensures teachers and administrators can view and manage student health and disciplinary records directly from the student workflow.
5. **Reports (`/dashboard/reports`)**:
   - In `App.tsx:179-185`, `/dashboard/reports` is protected by `reports.view`.
   - In `Can.tsx:53`, the permission group `'Reports'` contains `['reports.view', 'reports.export']`.
   - In `supabase_rbac_migration_02b.sql`, `reports.view` is granted to `admin`, `principal`, `vice_principal`, `accountant`, `exam_controller`, and `office_staff`.
   - Therefore, mounting a new category `title: 'Reports'` with `icon: BarChart3` and `permission: 'reports.view'` containing `{ label: 'Reports Center', path: '/dashboard/reports', permission: 'reports.view' }` makes institutional reporting accessible to all analytical roles.

### 2.2 Global Search Navigation Logic
1. In `fetchSearchContext()`, the combined employee array merges records from `teachers` and `staff`.
2. By explicitly mapping `role: 'Teacher'` and `department: t.department || 'Teaching'` onto the items from `teachers`, and `role: 'Staff'` onto items from `staff`, every employee record carries unambiguous role metadata.
3. In the employee click handler, evaluating:
   ```ts
   if (e.role === 'Teacher' || e.department === 'Teaching') {
     navigate('/dashboard/teachers', { state: { selectedTeacherId: e.id } });
   } else {
     navigate('/dashboard/employees', { state: { selectedEmployeeId: e.id } });
   }
   ```
   ensures teachers land on `/dashboard/teachers` with `selectedTeacherId`, while non-instructional staff land on `/dashboard/employees` with `selectedEmployeeId`.

---

## 3. Caveats
1. **Alternative Placement for Medical & Discipline**:
   If an operator desires Medical and Discipline under `Operations` instead of `Students`, the `Operations` category can be defined with `permission: null`, housing Hostel (`hostel.manage`), Medical (`student.view`), and Discipline (`student.view`). However, the Primary Recommendation places them under `Students` because teachers have `student.view` and need student records, whereas `Operations` is primarily utility/facilities management.
2. **Receiving Component State Handling**:
   `DashboardLayout.tsx` sends `{ state: { selectedTeacherId: e.id } }` and `{ state: { selectedExamId: ex.id } }`. The corresponding receiver pages (`Teachers.tsx`, `Employees.tsx`, `ExaminationModule.tsx`) must read these parameters from `useLocation().state` (this is handled in parallel by Feature F3 / Explorer `explorer_m1_context`).

---

## 4. Conclusion & Concrete Instructions for Worker

The worker should apply the following exact modifications to `src/components/DashboardLayout.tsx`:

### Edit Step 1: Update `sidebarCategories`

#### Target File: `src/components/DashboardLayout.tsx`

#### 1A. Admissions Category (`lines 119-127`)
**Before:**
```tsx
    {
      title: 'Admissions',
      icon: GraduationCap,
      permission: 'student.create',
      items: [
        { label: 'Direct Enrollment', path: '/dashboard/admissions', permission: 'student.create' },
        { label: 'Pending Approvals', path: '/dashboard/admissions', state: { statusFilter: 'Pending' }, permission: 'student.create' }
      ]
    },
```
**After:**
```tsx
    {
      title: 'Admissions',
      icon: GraduationCap,
      permission: 'student.create',
      items: [
        { label: 'Direct Enrollment', path: '/dashboard/admissions', permission: 'student.create' },
        { label: 'Pending Approvals', path: '/dashboard/admissions', state: { statusFilter: 'Pending' }, permission: 'student.create' },
        { label: 'Front Office Desk', path: '/dashboard/front-office', permission: 'student.create' }
      ]
    },
```

#### 1B. Students Category (`lines 128-136`)
**Before:**
```tsx
    {
      title: 'Students',
      icon: Users,
      permission: 'student.view',
      items: [
        { label: 'Student Directory & SIS', path: '/dashboard/students', permission: 'student.list' },
        { label: 'Alumni & Transferred', path: '/dashboard/students', state: { statusFilter: 'all' }, permission: 'student.list' }
      ]
    },
```
**After:**
```tsx
    {
      title: 'Students',
      icon: Users,
      permission: 'student.view',
      items: [
        { label: 'Student Directory & SIS', path: '/dashboard/students', permission: 'student.list' },
        { label: 'Alumni & Transferred', path: '/dashboard/students', state: { statusFilter: 'all' }, permission: 'student.list' },
        { label: 'Student Health & Medical', path: '/dashboard/medical', permission: 'student.view' },
        { label: 'Disciplinary Records', path: '/dashboard/discipline', permission: 'student.view' }
      ]
    },
```

#### 1C. Academics Category (`lines 137-155`)
**Before:**
```tsx
    {
      // Academics owns the academic structure, so every part of it is a
      // view inside this one module rather than a sidebar entry of its
      // own. Reading is open to any signed-in user; the write controls
      // inside each view are gated on academics.manage, and row level
      // security enforces that independently.
      title: 'Academics',
      icon: BookOpen,
      permission: null,
      items: [
        { label: 'Overview', path: '/dashboard/academics/overview', permission: null },
        { label: 'Academic Years', path: '/dashboard/academics/years', permission: null },
        { label: 'Classes & Sections', path: '/dashboard/academics/classes', permission: null },
        { label: 'Subjects', path: '/dashboard/academics/subjects', permission: null },
        { label: 'Class Subjects', path: '/dashboard/academics/class-subjects', permission: null },
        { label: 'Timetable', path: '/dashboard/academics/timetable', permission: null },
        { label: 'Academic Structure', path: '/dashboard/academics/structure', permission: null }
      ]
    },
```
**After:**
```tsx
    {
      // Academics owns the academic structure, so every part of it is a
      // view inside this one module rather than a sidebar entry of its
      // own. Reading is open to any signed-in user; the write controls
      // inside each view are gated on academics.manage, and row level
      // security enforces that independently.
      title: 'Academics',
      icon: BookOpen,
      permission: null,
      items: [
        { label: 'Overview', path: '/dashboard/academics/overview', permission: null },
        { label: 'Academic Years', path: '/dashboard/academics/years', permission: null },
        { label: 'Classes & Sections', path: '/dashboard/academics/classes', permission: null },
        { label: 'Subjects', path: '/dashboard/academics/subjects', permission: null },
        { label: 'Class Subjects', path: '/dashboard/academics/class-subjects', permission: null },
        { label: 'Timetable', path: '/dashboard/academics/timetable', permission: null },
        { label: 'Academic Structure', path: '/dashboard/academics/structure', permission: null },
        { label: 'School Calendar', path: '/dashboard/calendar', permission: null }
      ]
    },
```

#### 1D. Insert Operations Category (Hostel) after Inventory & Assets (`line 231`)
**Before:**
```tsx
    {
      title: 'Inventory & Assets',
      icon: Layers,
      permission: null,
      items: [
        { label: 'Fixed Assets', path: '/dashboard/inventory', state: { activeTab: 'assets' }, permission: null },
        { label: 'Consumable Stock', path: '/dashboard/inventory', state: { activeTab: 'stock' }, permission: null },
        { label: 'Vendors Directory', path: '/dashboard/inventory', state: { activeTab: 'vendors' }, permission: null },
        { label: 'Purchase Orders', path: '/dashboard/inventory', state: { activeTab: 'orders' }, permission: null }
      ]
    },
    {
      title: 'Communication',
```
**After:**
```tsx
    {
      title: 'Inventory & Assets',
      icon: Layers,
      permission: null,
      items: [
        { label: 'Fixed Assets', path: '/dashboard/inventory', state: { activeTab: 'assets' }, permission: null },
        { label: 'Consumable Stock', path: '/dashboard/inventory', state: { activeTab: 'stock' }, permission: null },
        { label: 'Vendors Directory', path: '/dashboard/inventory', state: { activeTab: 'vendors' }, permission: null },
        { label: 'Purchase Orders', path: '/dashboard/inventory', state: { activeTab: 'orders' }, permission: null }
      ]
    },
    {
      title: 'Operations',
      icon: HomeIcon,
      permission: 'hostel.manage',
      items: [
        { label: 'Hostel Management', path: '/dashboard/hostel', permission: 'hostel.manage' }
      ]
    },
    {
      title: 'Communication',
```

#### 1E. Insert Reports Category after Certificates & ID (`line 251`)
**Before:**
```tsx
    {
      title: 'Certificates & ID',
      icon: Award,
      permission: null,
      items: [
        { label: 'Issue Credentials', path: '/dashboard/certificates', permission: null },
        { label: 'Student ID Cards', path: '/dashboard/students', state: { openIdCards: true }, permission: 'student.list' }
      ]
    },
    {
      title: 'System',
```
**After:**
```tsx
    {
      title: 'Certificates & ID',
      icon: Award,
      permission: null,
      items: [
        { label: 'Issue Credentials', path: '/dashboard/certificates', permission: null },
        { label: 'Student ID Cards', path: '/dashboard/students', state: { openIdCards: true }, permission: 'student.list' }
      ]
    },
    {
      title: 'Reports',
      icon: BarChart3,
      permission: 'reports.view',
      items: [
        { label: 'Reports Center', path: '/dashboard/reports', permission: 'reports.view' }
      ]
    },
    {
      title: 'System',
```

---

### Edit Step 2: Global Search Data Fetching & Routing

#### 2A. Update `fetchSearchContext()` (`lines 318-324`)
**Before:**
```tsx
        const [staffData, teachersData] = await Promise.all([
          supabase.from('staff').select('id, name, employee_id, designation'),
          supabase.from('teachers').select('id, name, employee_id, designation, department')
        ]);
        const combined = [...(teachersData.data || []), ...(staffData.data || [])];
        if (combined.length > 0) setAllEmployees(combined);
```
**After:**
```tsx
        const [staffData, teachersData] = await Promise.all([
          supabase.from('staff').select('id, name, employee_id, designation'),
          supabase.from('teachers').select('id, name, employee_id, designation, department')
        ]);
        const teachersList = (teachersData.data || []).map(t => ({
          ...t,
          role: 'Teacher',
          department: t.department || 'Teaching'
        }));
        const staffList = (staffData.data || []).map(s => ({
          ...s,
          role: 'Staff'
        }));
        const combined = [...teachersList, ...staffList];
        if (combined.length > 0) setAllEmployees(combined);
```

#### 2B. Update Global Search Employee Click Handler (`lines 589-598`)
**Before:**
```tsx
                            {filteredSearch.employees.map(e => (
                              <button
                                key={e.id}
                                onClick={() => navigate('/dashboard/employees', { state: { selectedEmployeeId: e.id } })}
                                className="w-full text-left p-2 rounded-xl hover:bg-slate-50 transition-all flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer"
                              >
                                <span>{e.name} <span className="text-[10px] text-slate-400 font-medium ml-1">({e.designation || e.role})</span></span>
                                <span className="text-[9px] text-slate-400 font-mono">{e.employee_id || 'N/A'}</span>
                              </button>
                            ))}
```
**After:**
```tsx
                            {filteredSearch.employees.map(e => (
                              <button
                                key={e.id}
                                onClick={() => {
                                  if (e.role === 'Teacher' || e.department === 'Teaching') {
                                    navigate('/dashboard/teachers', { state: { selectedTeacherId: e.id } });
                                  } else {
                                    navigate('/dashboard/employees', { state: { selectedEmployeeId: e.id } });
                                  }
                                }}
                                className="w-full text-left p-2 rounded-xl hover:bg-slate-50 transition-all flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer"
                              >
                                <span>{e.name} <span className="text-[10px] text-slate-400 font-medium ml-1">({e.designation || e.role})</span></span>
                                <span className="text-[9px] text-slate-400 font-mono">{e.employee_id || 'N/A'}</span>
                              </button>
                            ))}
```

#### 2C. Update Quick Action "Marks Entry" (`line 633`)
**Before:**
```tsx
                        <button 
                          onClick={() => navigate('/dashboard/marks', { state: { view: 'results' } })}
                          className="p-2.5 rounded-xl border border-slate-150 hover:border-violet-200 hover:bg-violet-50/20 text-left text-xs font-bold text-slate-700 flex items-center gap-2 transition-all cursor-pointer"
                        >
                          <ClipboardList size={14} className="text-violet-500" />
                          Marks Entry
                        </button>
```
**After:**
```tsx
                        <button 
                          onClick={() => navigate('/dashboard/examination?tab=marks')}
                          className="p-2.5 rounded-xl border border-slate-150 hover:border-violet-200 hover:bg-violet-50/20 text-left text-xs font-bold text-slate-700 flex items-center gap-2 transition-all cursor-pointer"
                        >
                          <ClipboardList size={14} className="text-violet-500" />
                          Marks Entry
                        </button>
```

---

## 5. Verification Method

### 5.1 Static Verification
1. Run TypeScript compilation:
   ```powershell
   npm run lint
   ```
   Must exit with code 0 and zero type errors.
2. Run Vite build:
   ```powershell
   npm run build
   ```
   Must produce production bundle without build failures.

### 5.2 Behavioral Verification
1. **Sidebar Navigation**:
   - Log in as `admin`.
   - Verify that expanding "Admissions" reveals "Front Office Desk", and clicking navigates to `/dashboard/front-office`.
   - Verify that expanding "Students" reveals "Student Health & Medical" and "Disciplinary Records", navigating to `/dashboard/medical` and `/dashboard/discipline`.
   - Verify that expanding "Academics" reveals "School Calendar", navigating to `/dashboard/calendar`.
   - Verify that expanding "Operations" reveals "Hostel Management", navigating to `/dashboard/hostel`.
   - Verify that expanding "Reports" reveals "Reports Center", navigating to `/dashboard/reports`.
   - Verify that on visiting `/dashboard/front-office`, the "Admissions" accordion item is auto-expanded and active.
2. **RBAC Filtering**:
   - Log in as a role without `hostel.manage` (e.g. `teacher`): verify "Operations" is not visible in the sidebar.
   - Log in as `receptionist`: verify "Admissions" -> "Front Office Desk" is visible; "Financials" and "System" are hidden.
3. **Global Search Employee Clicks**:
   - Type teacher name in the search bar: click the result. Verify route navigated is `/dashboard/teachers` and `location.state.selectedTeacherId` matches the clicked teacher's ID.
   - Type non-teaching staff name: click the result. Verify route navigated is `/dashboard/employees` and `location.state.selectedEmployeeId` matches the clicked employee's ID.
4. **Global Search Exam Clicks**:
   - Click an exam result: verify route navigated is `/dashboard/examination?tab=exams` with `location.state.selectedExamId`.
