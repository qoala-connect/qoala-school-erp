# Handoff Report: Cross-Module Context & Parameter Preservation (Feature F3)

**Author:** Explorer Agent (`explorer_m1_context`)  
**Target:** Worker Implementer  
**Scope:** Exact line-by-line edit instructions for cross-module linkages and state receivers across 6 primary ERP components.  
**Date:** 2026-09-03  

---

## 1. Observation

Direct code inspection of the 6 target files and their associated caller/receiver interfaces revealed the following exact lines and context drops:

### 1.1 `src/components/students/Student360Drawer.tsx`
- **Lines 636–641:**
  ```tsx
  <button
    onClick={() => navigate('/dashboard/fees')}
    className="px-3 py-1.5 bg-white hover:bg-violet-100 text-violet-800 border border-violet-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs"
  >
    <Wallet size={13} /> Collect Fees
  </button>
  ```
  *Defect:* Navigates to `/dashboard/fees` without passing `activeTab` or `selectedStudent`. In `FeesPortal.tsx:92–95`, opening the collection modal requires `location.state?.selectedStudent`.
- **Lines 962–967:**
  ```tsx
  <button
    onClick={() => navigate('/dashboard/fees')}
    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
  >
    <ExternalLink size={12} /> Collect Fees in Portal
  </button>
  ```
  *Defect:* Same context drop as line 637.
- **Lines 1200–1205:**
  ```tsx
  <button
    onClick={() => navigate('/dashboard/certificates')}
    className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
  >
    <Award size={12} /> Issue Certificate / TC
  </button>
  ```
  *Defect:* Navigates to `/dashboard/certificates` without student metadata, forcing Certificate Generator to display hardcoded mock data.

### 1.2 `src/pages/dashboard/Analytics.tsx`
- **Lines 286–299:**
  ```tsx
  <PremiumStatCard 
    label="Total Teachers" 
    value={metrics?.kpi?.totalTeachers?.toLocaleString() || '0'} 
    ...
    onClick={() => {
      navigate('/dashboard/employees');
    }}
  />
  ```
  *Defect:* "Total Teachers" card navigates to `/dashboard/employees` (non-teaching staff) instead of canonical faculty directory `/dashboard/teachers`.
- **Line 954:**
  ```tsx
  { label: 'Add Educator', icon: Users, color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100', path: '/dashboard/employees', toastMsg: 'Directing to Educator directory...' },
  ```
  *Defect:* Points to `/dashboard/employees` instead of `/dashboard/teachers`.
- **Lines 1646–1649:**
  ```tsx
  { label: 'View Exam Results', icon: Award, color: 'text-violet-600 bg-violet-50 hover:bg-violet-100', path: '/dashboard/students' },
  { label: 'Download Report Card', icon: FileText, color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100', path: '/dashboard/students' },
  { label: 'My Homework list', icon: BookOpen, color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100', path: '/dashboard/students' },
  { label: 'Library Roster', icon: School, color: 'text-blue-600 bg-blue-50 hover:bg-blue-100', path: '/dashboard/students' }
  ```
  *Defect:* 'View Exam Results', 'Download Report Card', and 'Library Roster' all misroute to `/dashboard/students` instead of their respective canonical destinations.

### 1.3 `src/pages/dashboard/AdmissionsManagement.tsx`
- **Line 45:** `import { Link } from 'react-router-dom';` (`useLocation` is not imported).
- **Line 60:** `const [statusFilter, setStatusFilter] = useState('all');`
- **Lines 83–90 & 105–107:** `loadData()` passes `statusFilter` to `admissionService.fetchAdmissions({ statusFilter, ... })`.
- **Sidebar Caller (`src/components/DashboardLayout.tsx:125`):**
  Passes `path: '/dashboard/admissions', state: { statusFilter: 'Pending' }`.
  *Defect:* `AdmissionsManagement` never reads `location.state`, so clicking "Pending Approvals" in the sidebar loads all statuses rather than filtering to Pending.

### 1.4 `src/pages/dashboard/CertificateGenerator.tsx`
- **Lines 1–36:** `useLocation` is not imported.
- **Lines 59–69:**
  ```tsx
  const [studentName, setStudentName] = useState('Sneha Gupta');
  const [admissionNo, setAdmissionNo] = useState('SD-2026-0894');
  const [rollNo, setRollNo] = useState('24');
  const [classSection, setClassSection] = useState('Class X-A');
  const [fatherName, setFatherName] = useState('Rajesh Gupta');
  const [motherName, setMotherName] = useState('Suman Gupta');
  const [dob, setDob] = useState('2011-04-12');
  ```
  *Defect:* The certificate fields default to hardcoded mock data and never consume `location.state?.student`.

### 1.5 `src/pages/dashboard/Employees.tsx`
- **Lines 1–6:** `useLocation` is not imported.
- **Lines 64–70:** `selectedEmployeeIds` is managed as a string array, but defaults to `[]`.
- **Global Search Caller (`src/components/DashboardLayout.tsx:592`):**
  `onClick={() => navigate('/dashboard/employees', { state: { selectedEmployeeId: e.id } })}`
  *Defect:* `selectedEmployeeId` is ignored upon landing; neither highlighting nor filtering occurs.

### 1.6 `src/pages/dashboard/examination/ExaminationModule.tsx`
- **Line 2:** `useLocation` is imported.
- **Line 67:** `const location = useLocation();` is instantiated.
- **Lines 120–124:** `marksTargetExamId`, `marksTargetSubjectId`, and `marksTargetClass` are defined, but `location.state?.selectedExamId` is never inspected.
- **Global Search Caller (`src/components/DashboardLayout.tsx:611`):**
  `onClick={() => navigate('/dashboard/examination?tab=exams', { state: { selectedExamId: ex.id } })}`
  *Defect:* The exam list renders all exams with no visual indicator or activation for `selectedExamId`.

---

## 2. Logic Chain

1. **Parameter Preservation Principle:** In an integrated School ERP, navigation links from summary cards, search overlays, and 360 profile drawers must deliver the user directly to the targeted entity within the canonical module with immediate visual feedback (pre-selection, modal trigger, or filter).
2. **Student 360 -> Fees Integration:**
   - In `FeesPortal.tsx:83–96`, the receiver specifically checks:
     `if (location.state?.activeTab) { ... }`
     `if (location.state?.selectedStudent) { setCollectTargetStudent(location.state.selectedStudent); setIsCollectModalOpen(true); }`
   - Therefore, passing `{ state: { activeTab: 'student_fees', selectedStudent: student } }` from both "Collect Fees" buttons in `Student360Drawer.tsx` automatically routes to the Fee Collection tab, binds the active student, and pops open the payment collection dialog.
3. **Student 360 -> Certificate Generator Integration:**
   - `CertificateGenerator.tsx` accepts student attributes: name, admission number, roll number, class & section, father name, mother name, and date of birth.
   - Passing `student` object in `location.state` and consuming it via `useLocation()` populates these fields directly upon component mount, replacing hardcoded mock strings ("Sneha Gupta") with genuine student credentials.
4. **Analytics Dashboard Link Realignment:**
   - Quick action paths pointing to `/dashboard/students` for exam results and library roster are copy-paste remnants.
   - Realigning paths to canonical URLs (`/dashboard/examination?tab=results`, `/dashboard/examination?tab=reports`, `/dashboard/library`, and `/dashboard/teachers`) restores genuine cross-module navigation.
5. **Admissions Pending Filter:**
   - The sidebar item "Pending Approvals" passes `state: { statusFilter: 'Pending' }`.
   - Initializing `statusFilter` state with `location.state?.statusFilter || 'all'` and listening to `location.state?.statusFilter` in an effect ensures both initial page loads and sidebar transitions immediately filter applications to Pending.
6. **Employees & Staff Search Highlighting & Filtering:**
   - Reading `location.state?.selectedEmployeeId` in `Employees.tsx` allows setting `selectedEmployeeIds([empId])` (which adds violet row highlight `bg-violet-50/40` and checks the row checkbox) AND filtering the displayed employees list with a dismissible banner ("Filtered to selected employee from search [Show All Staff]").
7. **Examination Module Exam Activation:**
   - When navigating from Global Search with `selectedExamId`, setting `selectedExamId` in `ExaminationModule.tsx` adds an active visual highlight (`ring-2 ring-violet-500/40 bg-violet-50/70`) and a "Selected" badge in the exams table, calls `loadMarksForExam(selectedExamId)`, and pre-fills `initialExamId` in the marks entry view.

---

## 3. Concrete Line-by-Line Edit Instructions for Worker

### Task 1: `src/components/students/Student360Drawer.tsx`

#### Edit 1.1: "Collect Fees" Button (Line 637)
**Target:** `src/components/students/Student360Drawer.tsx:636–641`

```tsx
<<<< BEFORE (Line 636-641)
                        <button
                          onClick={() => navigate('/dashboard/fees')}
                          className="px-3 py-1.5 bg-white hover:bg-violet-100 text-violet-800 border border-violet-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs"
                        >
                          <Wallet size={13} /> Collect Fees
                        </button>
==== AFTER
                        <button
                          onClick={() => navigate('/dashboard/fees', { state: { activeTab: 'student_fees', selectedStudent: student } })}
                          className="px-3 py-1.5 bg-white hover:bg-violet-100 text-violet-800 border border-violet-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <Wallet size={13} /> Collect Fees
                        </button>
>>>>
```

#### Edit 1.2: "Collect Fees in Portal" Button (Line 963)
**Target:** `src/components/students/Student360Drawer.tsx:962–967`

```tsx
<<<< BEFORE (Line 962-967)
                        <button
                          onClick={() => navigate('/dashboard/fees')}
                          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <ExternalLink size={12} /> Collect Fees in Portal
                        </button>
==== AFTER
                        <button
                          onClick={() => navigate('/dashboard/fees', { state: { activeTab: 'student_fees', selectedStudent: student } })}
                          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <ExternalLink size={12} /> Collect Fees in Portal
                        </button>
>>>>
```

#### Edit 1.3: "Issue Certificate / TC" Button (Line 1201)
**Target:** `src/components/students/Student360Drawer.tsx:1200–1205`

```tsx
<<<< BEFORE (Line 1200-1205)
                        <button
                          onClick={() => navigate('/dashboard/certificates')}
                          className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Award size={12} /> Issue Certificate / TC
                        </button>
==== AFTER
                        <button
                          onClick={() => navigate('/dashboard/certificates', {
                            state: {
                              student: {
                                id: student.id,
                                name: (student as any).full_name || student.name,
                                admission_number: student.admission_number,
                                class_name: student.class,
                                roll_number: student.roll_number,
                                father_name: student.father_name,
                                mother_name: student.mother_name,
                                date_of_birth: student.date_of_birth,
                                section: student.section
                              }
                            }
                          })}
                          className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Award size={12} /> Issue Certificate / TC
                        </button>
>>>>
```

---

### Task 2: `src/pages/dashboard/Analytics.tsx`

#### Edit 2.1: "Total Teachers" Stat Card Navigation (Lines 296–298)
**Target:** `src/pages/dashboard/Analytics.tsx:286–299`

```tsx
<<<< BEFORE (Line 296-298)
          onClick={() => {
            navigate('/dashboard/employees');
          }}
==== AFTER
          onClick={() => {
            navigate('/dashboard/teachers');
          }}
>>>>
```

#### Edit 2.2: "Add Educator" Quick Action (Line 954)
**Target:** `src/pages/dashboard/Analytics.tsx:952–956`

```tsx
<<<< BEFORE (Line 954)
            { label: 'Add Educator', icon: Users, color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100', path: '/dashboard/employees', toastMsg: 'Directing to Educator directory...' },
==== AFTER
            { label: 'Add Educator', icon: Users, color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100', path: '/dashboard/teachers', toastMsg: 'Directing to Educator directory...' },
>>>>
```

#### Edit 2.3: Quick Action Resource Destinations (Lines 1645–1650)
**Target:** `src/pages/dashboard/Analytics.tsx:1645–1650`

```tsx
<<<< BEFORE (Line 1645-1650)
            {[
              { label: 'View Exam Results', icon: Award, color: 'text-violet-600 bg-violet-50 hover:bg-violet-100', path: '/dashboard/students' },
              { label: 'Download Report Card', icon: FileText, color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100', path: '/dashboard/students' },
              { label: 'My Homework list', icon: BookOpen, color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100', path: '/dashboard/students' },
              { label: 'Library Roster', icon: School, color: 'text-blue-600 bg-blue-50 hover:bg-blue-100', path: '/dashboard/students' }
            ].map((act) => (
==== AFTER
            {[
              { label: 'View Exam Results', icon: Award, color: 'text-violet-600 bg-violet-50 hover:bg-violet-100', path: '/dashboard/examination?tab=results' },
              { label: 'Download Report Card', icon: FileText, color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100', path: '/dashboard/examination?tab=reports' },
              { label: 'My Homework list', icon: BookOpen, color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100', path: '/dashboard/students' },
              { label: 'Library Roster', icon: School, color: 'text-blue-600 bg-blue-50 hover:bg-blue-100', path: '/dashboard/library' }
            ].map((act) => (
>>>>
```

---

### Task 3: `src/pages/dashboard/AdmissionsManagement.tsx`

#### Edit 3.1: Import `useLocation`
**Target:** `src/pages/dashboard/AdmissionsManagement.tsx:45`

```tsx
<<<< BEFORE (Line 45)
import { Link } from 'react-router-dom';
==== AFTER
import { Link, useLocation } from 'react-router-dom';
>>>>
```

#### Edit 3.2: Read `location` and Initialize `statusFilter` from State
**Target:** `src/pages/dashboard/AdmissionsManagement.tsx:47–62`

```tsx
<<<< BEFORE (Line 47-62)
export default function AdmissionsManagement() {
  const { role } = useAuth();
  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Reference Metadata
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);

  // Search and Filters
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
==== AFTER
export default function AdmissionsManagement() {
  const { role } = useAuth();
  const location = useLocation();
  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Reference Metadata
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);

  // Search and Filters (pre-filled from location.state if navigated e.g. from Sidebar 'Pending Approvals')
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>(() => location.state?.statusFilter || 'all');
>>>>
```

#### Edit 3.3: Add Sync `useEffect` for `location.state?.statusFilter`
**Target:** Insert after line 62 (`const [selectedIds, setSelectedIds] = useState<string[]>([]);`):

```tsx
<<<< BEFORE
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Modals & Drawers
==== AFTER
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Sync statusFilter if user clicks a sidebar shortcut while already on the admissions page
  useEffect(() => {
    if (location.state?.statusFilter) {
      setStatusFilter(location.state.statusFilter);
    }
  }, [location.state?.statusFilter]);
  
  // Modals & Drawers
>>>>
```

---

### Task 4: `src/pages/dashboard/CertificateGenerator.tsx`

#### Edit 4.1: Import `useLocation`
**Target:** `src/pages/dashboard/CertificateGenerator.tsx:1`

```tsx
<<<< BEFORE (Line 1)
import { useState, useEffect, useRef } from 'react';
==== AFTER
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
>>>>
```

#### Edit 4.2: Initialize Fields from `location.state?.student` and Add Auto-Populate Effect
**Target:** `src/pages/dashboard/CertificateGenerator.tsx:53–70`

```tsx
<<<< BEFORE (Line 53-70)
export default function CertificateGenerator() {
  // Core Selection
  const [certType, setCertType] = useState<CertificateType>('excellence');
  const [theme, setTheme] = useState<BorderTheme>('navy_gold');
  const [layout, setLayout] = useState<'landscape' | 'portrait'>('landscape');
  
  // Custom Content Fields
  const [studentName, setStudentName] = useState('Sneha Gupta');
  const [admissionNo, setAdmissionNo] = useState('SD-2026-0894');
  const [rollNo, setRollNo] = useState('24');
  const [classSection, setClassSection] = useState('Class X-A');
  const [fatherName, setFatherName] = useState('Rajesh Gupta');
  const [motherName, setMotherName] = useState('Suman Gupta');
  const [dob, setDob] = useState('2011-04-12');
  const [dateOfIssue, setDateOfIssue] = useState(new Date().toISOString().split('T')[0]);
  const [academicYear, setAcademicYear] = useState('2026-27');
==== AFTER
export default function CertificateGenerator() {
  const location = useLocation();
  const navStudent = location.state?.student;

  // Core Selection
  const [certType, setCertType] = useState<CertificateType>('excellence');
  const [theme, setTheme] = useState<BorderTheme>('navy_gold');
  const [layout, setLayout] = useState<'landscape' | 'portrait'>('landscape');
  
  // Custom Content Fields (pre-filled from Student 360 if available, with graceful fallbacks)
  const [studentName, setStudentName] = useState(() => navStudent?.name || navStudent?.full_name || 'Sneha Gupta');
  const [admissionNo, setAdmissionNo] = useState(() => navStudent?.admission_number || navStudent?.admissionNo || 'SD-2026-0894');
  const [rollNo, setRollNo] = useState(() => navStudent?.roll_number || navStudent?.rollNo || '24');
  const [classSection, setClassSection] = useState(() => {
    if (navStudent?.class_name) {
      return navStudent.class_name.startsWith('Class ') ? navStudent.class_name : `Class ${navStudent.class_name}`;
    }
    if (navStudent?.class) {
      return `Class ${navStudent.class}${navStudent.section ? `-${navStudent.section}` : ''}`;
    }
    return 'Class X-A';
  });
  const [fatherName, setFatherName] = useState(() => navStudent?.father_name || 'Rajesh Gupta');
  const [motherName, setMotherName] = useState(() => navStudent?.mother_name || 'Suman Gupta');
  const [dob, setDob] = useState(() => navStudent?.date_of_birth || '2011-04-12');
  const [dateOfIssue, setDateOfIssue] = useState(new Date().toISOString().split('T')[0]);
  const [academicYear, setAcademicYear] = useState('2026-27');
>>>>
```

#### Edit 4.3: Add Sync `useEffect` for Dynamic Updates
**Target:** Insert after line 96 (`const certRef = useRef<HTMLDivElement>(null);`):

```tsx
<<<< BEFORE
  const certRef = useRef<HTMLDivElement>(null);

  // Load active students from Supabase
==== AFTER
  const certRef = useRef<HTMLDivElement>(null);

  // Sync student credentials when navigated with state (e.g. from Student 360 Drawer)
  useEffect(() => {
    const s = location.state?.student;
    if (s) {
      if (s.id) setSelectedStudentId(s.id);
      if (s.name || s.full_name) setStudentName(s.name || s.full_name);
      if (s.admission_number || s.admissionNo) setAdmissionNo(s.admission_number || s.admissionNo);
      if (s.roll_number || s.rollNo) setRollNo(s.roll_number || s.rollNo);
      if (s.class_name) {
        setClassSection(s.class_name.startsWith('Class ') ? s.class_name : `Class ${s.class_name}`);
      } else if (s.class) {
        setClassSection(`Class ${s.class}${s.section ? `-${s.section}` : ''}`);
      }
      if (s.father_name) setFatherName(s.father_name);
      if (s.mother_name) setMotherName(s.mother_name);
      if (s.date_of_birth) setDob(s.date_of_birth);
      if (s.academic_year) setAcademicYear(s.academic_year);
      toast.success(`Loaded certificate details for ${s.name || s.full_name || 'selected student'}`);
    }
  }, [location.state]);

  // Load active students from Supabase
>>>>
```

---

### Task 5: `src/pages/dashboard/Employees.tsx`

#### Edit 5.1: Import `useLocation`
**Target:** `src/pages/dashboard/Employees.tsx:1`

```tsx
<<<< BEFORE (Line 1)
import React, { useState, useEffect } from 'react';
==== AFTER
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
>>>>
```

#### Edit 5.2: Instantiate `location` and State for Selected Employee
**Target:** `src/pages/dashboard/Employees.tsx:64–70`

```tsx
<<<< BEFORE (Line 64-70)
export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Partial<Employee> | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
==== AFTER
export default function Employees() {
  const location = useLocation();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Partial<Employee> | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
>>>>
```

#### Edit 5.3: Add Effect and Filter Memo for `selectedEmployeeId`
**Target:** Insert after line 118 (`useEffect(() => { fetchEmployees(); }, []);`):

```tsx
<<<< BEFORE
  useEffect(() => {
    fetchEmployees();
  }, []);

  const [isSaving, setIsSaving] = useState(false);
==== AFTER
  useEffect(() => {
    fetchEmployees();
  }, []);

  // Handle incoming cross-module selection (e.g. from Global Search)
  useEffect(() => {
    const empId = location.state?.selectedEmployeeId;
    if (empId) {
      setSelectedEmployeeIds([empId]);
      setSelectedEmployeeFilter(empId);
    }
  }, [location.state?.selectedEmployeeId]);

  // Filter employees when navigated to a specific record from Global Search
  const displayedEmployees = useMemo(() => {
    if (!selectedEmployeeFilter) return employees;
    const matched = employees.filter(e => e.id === selectedEmployeeFilter || e.employee_id === selectedEmployeeFilter);
    return matched.length > 0 ? matched : employees;
  }, [employees, selectedEmployeeFilter]);

  const [isSaving, setIsSaving] = useState(false);
>>>>
```

#### Edit 5.4: Render Filter Notice and Pass `displayedEmployees` to `StaffTable`
**Target:** `src/pages/dashboard/Employees.tsx:256–269`

```tsx
<<<< BEFORE (Line 256-269)
      {loading ? (
        <div className="text-center text-slate-500 py-10">Loading...</div>
      ) : (
        <StaffTable 
          employees={employees}
          selectedEmployeeIds={selectedEmployeeIds}
          onToggleSelectEmployee={toggleSelectEmployee}
          onToggleSelectAll={toggleSelectAll}
          onSelectEmployee={(emp) => { setEditingEmp(emp); setIsWizardOpen(true); }}
          onEditEmployee={(emp) => { setEditingEmp(emp); setIsWizardOpen(true); }}
          onDeleteEmployee={handleDelete}
          setIsWizardOpen={setIsWizardOpen}
        />
      )}
==== AFTER
      {selectedEmployeeFilter && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-center justify-between text-xs text-violet-800 animate-fadeIn">
          <span className="font-semibold">
            Filtered to selected employee from Global Search.
          </span>
          <button 
            onClick={() => { setSelectedEmployeeFilter(null); setSelectedEmployeeIds([]); }} 
            className="font-bold underline text-violet-700 hover:text-violet-900 cursor-pointer"
          >
            Show All Staff
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-500 py-10">Loading...</div>
      ) : (
        <StaffTable 
          employees={displayedEmployees}
          selectedEmployeeIds={selectedEmployeeIds}
          onToggleSelectEmployee={toggleSelectEmployee}
          onToggleSelectAll={toggleSelectAll}
          onSelectEmployee={(emp) => { setEditingEmp(emp); setIsWizardOpen(true); }}
          onEditEmployee={(emp) => { setEditingEmp(emp); setIsWizardOpen(true); }}
          onDeleteEmployee={handleDelete}
          setIsWizardOpen={setIsWizardOpen}
        />
      )}
>>>>
```

---

### Task 6: `src/pages/dashboard/examination/ExaminationModule.tsx`

#### Edit 6.1: Initialize `selectedExamId` State and Auto-Activate Effect
**Target:** `src/pages/dashboard/examination/ExaminationModule.tsx:120–125`

```tsx
<<<< BEFORE (Line 120-125)
  // Active marks filter state
  const [marksTargetExamId, setMarksTargetExamId] = useState<string>('');
  const [marksTargetSubjectId, setMarksTargetSubjectId] = useState<string>('');
  const [marksTargetClass, setMarksTargetClass] = useState<string>('All');
==== AFTER
  // Active marks filter state & incoming selection from Global Search
  const [selectedExamId, setSelectedExamId] = useState<string | null>(() => location.state?.selectedExamId || null);
  const [marksTargetExamId, setMarksTargetExamId] = useState<string>(() => location.state?.selectedExamId || '');
  const [marksTargetSubjectId, setMarksTargetSubjectId] = useState<string>('');
  const [marksTargetClass, setMarksTargetClass] = useState<string>('All');

  // Activate exam if navigated from Global Search or external link
  useEffect(() => {
    const examId = location.state?.selectedExamId;
    if (examId) {
      setSelectedExamId(examId);
      setMarksTargetExamId(examId);
      loadMarksForExam(examId);
      const target = exams.find(e => e.id === examId);
      if (target) {
        setMarksTargetClass(target.class);
      }
    }
  }, [location.state?.selectedExamId, exams]);
>>>>
```

#### Edit 6.2: Add Visual Highlight and Badge in Exams Table
**Target:** `src/pages/dashboard/examination/ExaminationModule.tsx:834–845`

```tsx
<<<< BEFORE (Line 834-845)
                        exams.map(ex => {
                          const mappedCount = examSubjects.filter(es => es.exam_id === ex.id).length;
                          return (
                            <tr key={ex.id} className="hover:bg-slate-50/40 transition-colors">
                              <td className="py-3 px-5 font-bold text-slate-900 flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-violet-50 text-violet-600">
                                  <GraduationCap size={14} />
                                </div>
                                <span>{ex.exam_name}</span>
                              </td>
==== AFTER
                        exams.map(ex => {
                          const mappedCount = examSubjects.filter(es => es.exam_id === ex.id).length;
                          const isSelected = selectedExamId === ex.id;
                          return (
                            <tr 
                              key={ex.id} 
                              className={cn(
                                "hover:bg-slate-50/40 transition-colors", 
                                isSelected && "bg-violet-50/80 ring-2 ring-violet-500/40 font-bold"
                              )}
                            >
                              <td className="py-3 px-5 font-bold text-slate-900 flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-violet-50 text-violet-600">
                                  <GraduationCap size={14} />
                                </div>
                                <span>{ex.exam_name}</span>
                                {isSelected && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-violet-600 text-white shadow-2xs">
                                    Active Focus
                                  </span>
                                )}
                              </td>
>>>>
```

#### Edit 6.3: Pass Active Exam to Marks View
**Target:** `src/pages/dashboard/examination/ExaminationModule.tsx:917`

```tsx
<<<< BEFORE (Line 917)
              initialExamId={marksTargetExamId}
==== AFTER
              initialExamId={marksTargetExamId || selectedExamId || undefined}
>>>>
```

---

## 4. Caveats

1. **Global Search Teacher vs Staff Routing (`DashboardLayout.tsx:318–323, 592`):**
   - In `DashboardLayout.tsx`, search results currently merge `staff` and `teachers` into `allEmployees` without an explicit differentiator, routing both to `/dashboard/employees`.
   - While `Employees.tsx` will now gracefully handle the employee ID if found in `staff`, faculty members in the `teachers` table will not appear in the `staff` table. A future enhancement in `DashboardLayout.tsx` should distinguish teachers and route them to `/dashboard/teachers` with `{ state: { selectedTeacherId: id } }`.
2. **TanStack Table Default Sorter:**
   - In `StaffTable.tsx`, TanStack Table uses column sorting. Passing `displayedEmployees` filtered to the single matching record ensures the selected employee is displayed regardless of active sort orders or table pagination boundaries.
3. **Transient Router State:**
   - React Router DOM `location.state` is ephemeral across full browser reloads. Initializing component states via lazy initializers (`useState(() => location.state?.x || fallback)`) ensures immediate synchronization upon navigation without UI flicker.

---

## 5. Conclusion

- All 6 target files have been completely audited and analyzed.
- Every broken parameter bridge (Student 360 -> Fees, Student 360 -> Certificates, Analytics quick action misdirections, Admissions status filter, Employees search selection, and Examination exam activation) has a concrete, type-safe drop-in solution.
- The Worker can apply these edits directly line-by-line with zero architectural ambiguity.

---

## 6. Verification Method

To independently verify these fixes after application:

1. **TypeScript Type Check:**
   ```powershell
   npx tsc --noEmit
   ```
   *Expected:* 0 errors.

2. **Vite Production Build:**
   ```powershell
   npm run build
   ```
   *Expected:* Builds successfully without chunk errors.

3. **Behavioral E2E Verification:**
   - Open Student 360 Drawer -> Click "Collect Fees": `/dashboard/fees` opens with the Fee Collection modal automatically displayed for the selected student.
   - Open Student 360 Drawer -> Click "Issue Certificate": `/dashboard/certificates` opens with the student's name, roll number, admission number, and class pre-filled.
   - Click "Pending Approvals" in sidebar: `/dashboard/admissions` opens with the status dropdown pre-selected to "Pending" and only pending applications listed.
   - In Global Search, search for an employee and click: `/dashboard/employees` displays the selected employee highlighted with a "Filtered from search" notice.
   - In Global Search, search for an exam and click: `/dashboard/examination?tab=exams` opens with the selected exam highlighted with an "Active Focus" badge.
   - On the Analytics dashboard, click "Total Teachers": verifies routing to `/dashboard/teachers`.
   - On the Analytics dashboard, click "View Exam Results" & "Download Report Card": verifies routing to `/dashboard/examination?tab=results` and `/dashboard/examination?tab=reports`.
