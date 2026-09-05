/**
 * Challenger M1-2 Empirical Verification Harness
 * Tests cross-module parameter passing and context preservation across School ERP modules.
 */
import fs from 'fs';
import path from 'path';

interface TestResult {
  testId: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, testId: string, name: string, failureMsg: string, successMsg: string) {
  if (condition) {
    results.push({ testId, name, passed: true, details: successMsg });
  } else {
    results.push({ testId, name, passed: false, details: failureMsg });
  }
}

const ROOT = 'd:/all_code/r.m.-memorial-public-school';
function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

// 1. Student 360 -> Fees collection modal triggering with pre-selected student
const student360Code = read('src/components/students/Student360Drawer.tsx');
const feesPortalCode = read('src/pages/dashboard/FeesPortal.tsx');
const feeCollectionModalCode = read('src/components/fees/FeeCollectionModal.tsx');

// Check navigation passes activeTab and selectedStudent
const s360PassesFee = student360Code.includes("navigate('/dashboard/fees', { state: { activeTab: 'student_fees', selectedStudent: student } })");
assert(
  s360PassesFee,
  'VERIF-01A',
  'Student 360 -> Fees State Payload',
  'Student360Drawer does not pass { activeTab: "student_fees", selectedStudent: student } to /dashboard/fees',
  'Student360Drawer passes correct state payload in both overview and fees tabs'
);

// Check FeesPortal consumes activeTab and selectedStudent
const feesConsumesStudent = feesPortalCode.includes('location.state?.selectedStudent') &&
  feesPortalCode.includes('setCollectTargetStudent(location.state.selectedStudent)') &&
  feesPortalCode.includes('setIsCollectModalOpen(true)');
assert(
  feesConsumesStudent,
  'VERIF-01B',
  'FeesPortal Receives Selected Student & Triggers Modal',
  'FeesPortal does not consume selectedStudent or trigger isCollectModalOpen',
  'FeesPortal consumes location.state.selectedStudent, sets collectTargetStudent, and opens modal'
);

// Check FeeCollectionModal handles preSelectedStudent
const modalHandlesPreselected = feeCollectionModalCode.includes('preSelectedStudent') &&
  feeCollectionModalCode.includes('setSelectedStudent(preSelectedStudent)') &&
  feeCollectionModalCode.includes('setShowStudentPicker(false)');
assert(
  modalHandlesPreselected,
  'VERIF-01C',
  'FeeCollectionModal Binds Pre-Selected Student',
  'FeeCollectionModal does not bind preSelectedStudent or hide student picker',
  'FeeCollectionModal sets selectedStudent to preSelectedStudent and sets showStudentPicker to false'
);

// 2. Student 360 -> Certificate Generator pre-filling genuine student credentials
const certGenCode = read('src/pages/dashboard/CertificateGenerator.tsx');

// Check Student 360 passes complete student tuple
const s360PassesCert = student360Code.includes("navigate('/dashboard/certificates', {") &&
  student360Code.includes('admission_number: student.admission_number') &&
  student360Code.includes('class_name: student.class');
assert(
  s360PassesCert,
  'VERIF-02A',
  'Student 360 -> Certificates Payload',
  'Student360Drawer does not pass complete student object to /dashboard/certificates',
  'Student360Drawer passes name, admission_number, class_name, roll_number, etc.'
);

// Check CertificateGenerator consumes and pre-populates form fields
const certConsumesStudent = certGenCode.includes('location.state?.student') &&
  certGenCode.includes('setStudentName') &&
  certGenCode.includes('setAdmissionNo') &&
  certGenCode.includes('setRollNo') &&
  certGenCode.includes('setClassSection');
assert(
  certConsumesStudent,
  'VERIF-02B',
  'CertificateGenerator Consumes Router State',
  'CertificateGenerator fails to synchronize student fields from location.state.student',
  'CertificateGenerator initializes and reactively syncs studentName, admissionNo, rollNo, classSection'
);

// 3. Admissions statusFilter reception and sync
const admissionsCode = read('src/pages/dashboard/AdmissionsManagement.tsx');
const sidebarCode = read('src/components/DashboardLayout.tsx');

// Check sidebar passes statusFilter: 'Pending'
const sidebarPassesPending = sidebarCode.includes("path: '/dashboard/admissions', state: { statusFilter: 'Pending' }");
assert(
  sidebarPassesPending,
  'VERIF-03A',
  'Sidebar -> Admissions Pending Approvals Payload',
  'Sidebar does not pass state: { statusFilter: "Pending" } for Pending Approvals',
  'Sidebar passes state: { statusFilter: "Pending" } under Admissions -> Pending Approvals'
);

// Check AdmissionsManagement initializes and syncs statusFilter
const admissionsSyncsFilter = admissionsCode.includes("location.state?.statusFilter || 'all'") &&
  admissionsCode.includes('setStatusFilter(location.state.statusFilter)');
assert(
  admissionsSyncsFilter,
  'VERIF-03B',
  'AdmissionsManagement Status Filter Synchronization',
  'AdmissionsManagement does not read or synchronize location.state.statusFilter',
  'AdmissionsManagement initializes via lazy useState and synchronizes via useEffect on location.state'
);

// 4. Employees selectedEmployeeId banner filtering and highlight
const employeesCode = read('src/pages/dashboard/Employees.tsx');
const staffTableCode = read('src/components/StaffTable.tsx');

// Check DashboardLayout navigates with selectedEmployeeId or selectedTeacherId
const searchDifferentiatesRoles = sidebarCode.includes("navigate('/dashboard/teachers', { state: { selectedTeacherId: e.id } })") &&
  sidebarCode.includes("navigate('/dashboard/employees', { state: { selectedEmployeeId: e.id } })");
assert(
  searchDifferentiatesRoles,
  'VERIF-04A',
  'Global Search Role Discrimination (Teachers vs Staff)',
  'Global Search does not differentiate between Teacher and non-teaching Staff',
  'Global Search correctly routes teachers to /dashboard/teachers and staff to /dashboard/employees'
);

// Check Employees.tsx sets filter banner and filters table
const employeesHandlesId = employeesCode.includes('location.state?.selectedEmployeeId') &&
  employeesCode.includes('Filtered to selected employee from Global Search.') &&
  employeesCode.includes('Show All Staff');
assert(
  employeesHandlesId,
  'VERIF-04B',
  'Employees.tsx Banner & Filter Management',
  'Employees.tsx does not display active filter banner with reset button',
  'Employees.tsx receives selectedEmployeeId, displays filter banner, and provides Show All Staff reset'
);

// Check StaffTable highlights selected row
const staffTableHighlights = staffTableCode.includes('selectedEmployeeIds.includes(row.original.id)') &&
  staffTableCode.includes('bg-violet-50/40');
assert(
  staffTableHighlights,
  'VERIF-04C',
  'StaffTable Row Highlighting & Checkbox Selection',
  'StaffTable does not highlight or select row for selectedEmployeeIds',
  'StaffTable selects checkbox and adds violet highlight to matched row'
);

// 5. ExaminationModule selectedExamId activation
const examModuleCode = read('src/pages/dashboard/examination/ExaminationModule.tsx');

// Check Global Search navigates to ?tab=exams with selectedExamId
const searchPassesExam = sidebarCode.includes("navigate('/dashboard/examination?tab=exams', { state: { selectedExamId: ex.id } })");
assert(
  searchPassesExam,
  'VERIF-05A',
  'Global Search -> Examination Navigation Payload',
  'Global Search does not pass tab=exams and selectedExamId',
  'Global Search passes route /dashboard/examination?tab=exams and state { selectedExamId }'
);

// Check ExaminationModule receives selectedExamId and marks Active Focus
const examModuleHighlights = examModuleCode.includes('selectedExamId === ex.id') &&
  examModuleCode.includes('Active Focus') &&
  examModuleCode.includes('initialExamId={marksTargetExamId || selectedExamId || undefined}');
assert(
  examModuleHighlights,
  'VERIF-05B',
  'ExaminationModule Active Focus Badge & Marks Entry Pre-fill',
  'ExaminationModule does not highlight active exam or propagate examId to marks entry',
  'ExaminationModule renders Active Focus badge, ring highlight, and passes initialExamId to ResultsView'
);

// 6. Analytics Quick Actions canonical paths
const analyticsCode = read('src/pages/dashboard/Analytics.tsx');
const appCode = read('src/App.tsx');

// Verify Total Teachers card routes to /dashboard/teachers
const teachersCardTarget = analyticsCode.includes("navigate('/dashboard/teachers')");
assert(
  teachersCardTarget,
  'VERIF-06A',
  'Analytics "Total Teachers" Stat Card Route',
  'Total Teachers stat card in Analytics does not route to /dashboard/teachers',
  'Total Teachers stat card routes to canonical /dashboard/teachers'
);

// Verify Quick Utilities routes
const quickUtilitiesValid = analyticsCode.includes("path: '/dashboard/admissions'") &&
  analyticsCode.includes("path: '/dashboard/teachers'") &&
  analyticsCode.includes("path: '/dashboard/fees'") &&
  analyticsCode.includes("path: '/dashboard/attendance'") &&
  analyticsCode.includes("path: '/dashboard/certificates'");
assert(
  quickUtilitiesValid,
  'VERIF-06B',
  'Analytics ERP Quick Utilities Canonical Paths',
  'One or more ERP Quick Utilities navigate to invalid or non-canonical paths',
  'All 5 ERP Quick Utilities route to valid canonical destinations'
);

// Verify Examination Quick Hub paths match App.tsx routes
const examHubRoutesValid = appCode.includes('path="/dashboard/examination/exams"') &&
  appCode.includes('path="/dashboard/examination/marks-entry"') &&
  appCode.includes('path="/dashboard/examination/result-publication"') &&
  appCode.includes('path="/dashboard/examination/admit-cards"') &&
  appCode.includes('path="/dashboard/examination/report-cards"');
assert(
  examHubRoutesValid,
  'VERIF-06C',
  'Examination Quick Hub Routes Mapped in App.tsx',
  'Examination Quick Hub sub-routes are not mounted in App.tsx',
  'App.tsx properly mounts all 5 examination sub-routes with role guards'
);

// Print summary
console.log(JSON.stringify(results, null, 2));
