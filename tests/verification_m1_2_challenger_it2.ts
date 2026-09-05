/**
 * Challenger M1-2 (Iteration 2) Empirical Verification Harness
 * Tests parameter preservation and navigation integrity in Teachers.tsx and Student360Drawer.tsx,
 * as well as DashboardLayout.tsx sidebar alignment and route security.
 */
import fs from 'fs';
import path from 'path';

export interface TestResult {
  testId: string;
  name: string;
  passed: boolean;
  details: string;
}

export const results: TestResult[] = [];

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

// -------------------------------------------------------------
// 1. Teachers.tsx Parameter Preservation & Cross-Module Ingestion
// -------------------------------------------------------------
const teachersCode = read('src/pages/dashboard/Teachers.tsx');
const sidebarCode = read('src/components/DashboardLayout.tsx');

// Test 1: Global Search Routes Teacher with selectedTeacherId
const searchRoutesTeacher = sidebarCode.includes("navigate('/dashboard/teachers', { state: { selectedTeacherId: e.id } })");
assert(
  searchRoutesTeacher,
  'CHAL-M1-IT2-01',
  'Global Search routes faculty to /dashboard/teachers with selectedTeacherId',
  'DashboardLayout.tsx does not pass { selectedTeacherId: e.id } to /dashboard/teachers',
  'DashboardLayout.tsx correctly discriminates faculty (role/department) and routes with selectedTeacherId'
);

// Test 2: TeachersNavState interface declares selectedTeacherId
const teachersDeclaresNavState = teachersCode.includes('selectedTeacherId?: string;') &&
  teachersCode.includes('interface TeachersNavState');
assert(
  teachersDeclaresNavState,
  'CHAL-M1-IT2-02',
  'TeachersNavState interface includes selectedTeacherId',
  'Teachers.tsx interface TeachersNavState does not declare selectedTeacherId?: string',
  'Teachers.tsx interface TeachersNavState properly defines selectedTeacherId'
);

// Test 3: Teachers component initializes selectedTeacherFilter from location.state
const teachersInitsFilterState = teachersCode.includes('const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string | null>(') &&
  teachersCode.includes('(location.state as any)?.selectedTeacherId ?? null');
assert(
  teachersInitsFilterState,
  'CHAL-M1-IT2-03',
  'Teachers.tsx initializes selectedTeacherFilter state from location.state',
  'Teachers.tsx fails to initialize selectedTeacherFilter from location.state',
  'Teachers.tsx initializes selectedTeacherFilter directly from (location.state as any)?.selectedTeacherId'
);

// Test 4: Reactive useEffect synchronizes location.state.selectedTeacherId and sets activeTab to directory
const teachersReactiveEffect = teachersCode.includes('const teacherId = (location.state as any)?.selectedTeacherId;') &&
  teachersCode.includes('setSelectedTeacherFilter(teacherId);') &&
  teachersCode.includes("setActiveTab('directory');");
assert(
  teachersReactiveEffect,
  'CHAL-M1-IT2-04',
  'Teachers.tsx reactive useEffect updates filter and activates directory tab',
  'Teachers.tsx does not reactively sync location.state.selectedTeacherId or activate directory tab',
  'Teachers.tsx reactively listens to location.state, updates filter, and ensures directory tab is active'
);

// Test 5: Navigation consumption ref handles selectedTeacherId without double-render loops
const teachersConsumedRef = teachersCode.includes('const consumedNavState = useRef<unknown>(null);') &&
  teachersCode.includes('if (nav.selectedTeacherId) {') &&
  teachersCode.includes('setSelectedTeacherFilter(nav.selectedTeacherId);');
assert(
  teachersConsumedRef,
  'CHAL-M1-IT2-05',
  'Teachers.tsx consumedNavState guards one-time navigation ingestion',
  'Teachers.tsx lacks consumedNavState guard for selectedTeacherId',
  'Teachers.tsx guards navigation state consumption with consumedNavState ref to avoid duplicate state sets'
);

// Test 6: filteredTeachers filters matching both teacher ID and employee_id
const teachersFilteringLogic = teachersCode.includes('if (selectedTeacherFilter) {') &&
  teachersCode.includes('const matched = list.filter(t => t.id === selectedTeacherFilter || t.employee_id === selectedTeacherFilter);') &&
  teachersCode.includes('if (matched.length > 0) {') &&
  teachersCode.includes('list = matched;');
assert(
  teachersFilteringLogic,
  'CHAL-M1-IT2-06',
  'Teachers.tsx filters directory list by teacher ID and employee ID',
  'Teachers.tsx does not filter by both t.id and t.employee_id, or lacks fallback',
  'Teachers.tsx matches both UUID id and human-readable employee_id with graceful non-empty fallback'
);

// Test 7: Teachers.tsx displays dismissible search filter banner with Show All reset
const teachersFilterBanner = teachersCode.includes('{selectedTeacherFilter && (') &&
  teachersCode.includes('Filtered to selected teacher from search.') &&
  teachersCode.includes('Show All Teachers') &&
  teachersCode.includes('onClick={() => setSelectedTeacherFilter(null)}');
assert(
  teachersFilterBanner,
  'CHAL-M1-IT2-07',
  'Teachers.tsx displays dismissible filter banner with Show All Teachers reset button',
  'Teachers.tsx does not render filter notification banner or Show All Teachers reset action',
  'Teachers.tsx renders violet filter banner with interactive setSelectedTeacherFilter(null) reset'
);

// Test 8: Teachers.tsx table row highlights matched teacher
const teachersRowHighlight = teachersCode.includes('const isSelected = selectedTeacherFilter === t.id || selectedTeacherFilter === t.employee_id;') &&
  teachersCode.includes('isSelected && "bg-violet-50/60 ring-1 ring-violet-200"');
assert(
  teachersRowHighlight,
  'CHAL-M1-IT2-08',
  'Teachers.tsx table row applies highlight styling for selected teacher',
  'Teachers.tsx table row does not highlight matched teacher with violet ring/bg',
  'Teachers.tsx applies isSelected condition with bg-violet-50/60 ring-1 ring-violet-200 styling'
);

// -------------------------------------------------------------
// 2. Student360Drawer.tsx Canonical Marks Entry Navigation
// -------------------------------------------------------------
const student360Code = read('src/components/students/Student360Drawer.tsx');

// Test 9: Overview Quick Action "Marks Entry" navigates to /dashboard/examination?tab=marks
const overviewMarksEntry = student360Code.includes("onClick={() => navigate('/dashboard/examination?tab=marks')}") &&
  student360Code.includes('<ClipboardList size={13} /> Marks Entry');
assert(
  overviewMarksEntry,
  'CHAL-M1-IT2-09',
  'Student360Drawer Overview quick action navigates to /dashboard/examination?tab=marks',
  'Student360Drawer Overview does not navigate to /dashboard/examination?tab=marks',
  'Student360Drawer Overview Marks Entry button correctly triggers navigate("/dashboard/examination?tab=marks")'
);

// Test 10: Tab 6 (Examination & Grades) "Open Marks Entry" navigates to /dashboard/examination?tab=marks
const tab6MarksEntry = student360Code.includes("onClick={() => navigate('/dashboard/examination?tab=marks')}") &&
  student360Code.includes('<ExternalLink size={12} /> Open Marks Entry');
assert(
  tab6MarksEntry,
  'CHAL-M1-IT2-10',
  'Student360Drawer Tab 6 Examination & Grades navigates to /dashboard/examination?tab=marks',
  'Student360Drawer Tab 6 does not navigate to /dashboard/examination?tab=marks',
  'Student360Drawer Tab 6 Open Marks Entry button navigates to canonical /dashboard/examination?tab=marks'
);

// Test 11: Complete elimination of deprecated /dashboard/marks route in Student360Drawer
const deprecatedMarksInS360 = student360Code.includes("'/dashboard/marks'") || student360Code.includes('"/dashboard/marks"');
assert(
  !deprecatedMarksInS360,
  'CHAL-M1-IT2-11',
  'Zero references to deprecated /dashboard/marks in Student360Drawer',
  'Student360Drawer still contains references to deprecated /dashboard/marks',
  'Student360Drawer has 0 occurrences of deprecated /dashboard/marks'
);

// Test 12: ExaminationModule consumes tab=marks and mounts ResultsView
const examModuleCode = read('src/pages/dashboard/examination/ExaminationModule.tsx');
const examModuleHandlesMarksTab = examModuleCode.includes("const tabParam = searchParams.get('tab');") &&
  examModuleCode.includes("{currentTab === 'marks' && (") &&
  examModuleCode.includes('<ResultsView');
assert(
  examModuleHandlesMarksTab,
  'CHAL-M1-IT2-12',
  'ExaminationModule.tsx consumes tab=marks query parameter and renders ResultsView',
  'ExaminationModule does not parse tab=marks or render ResultsView',
  'ExaminationModule reads searchParams.get("tab") and renders ResultsView when currentTab === "marks"'
);

// -------------------------------------------------------------
// 3. DashboardLayout Sidebar Alignment & Security Remediation
// -------------------------------------------------------------

// Test 13: Canonical Labels in DashboardLayout
const frontOfficeMounted = sidebarCode.includes("label: 'Front Office'") && sidebarCode.includes("path: '/dashboard/front-office'");
const hostelMounted = sidebarCode.includes("label: 'Hostel'") && sidebarCode.includes("path: '/dashboard/hostel'");
const medicalMounted = sidebarCode.includes("label: 'Medical'") && sidebarCode.includes("path: '/dashboard/medical'");
const disciplineMounted = sidebarCode.includes("label: 'Discipline'") && sidebarCode.includes("path: '/dashboard/discipline'");
const reportsMounted = sidebarCode.includes("label: 'Reports'") && sidebarCode.includes("path: '/dashboard/reports'");

assert(
  frontOfficeMounted && hostelMounted && medicalMounted && disciplineMounted && reportsMounted,
  'CHAL-M1-IT2-13',
  'Sidebar items match canonical labels Front Office, Hostel, Medical, Discipline, Reports',
  'One or more sidebar labels do not match canonical test suite specifications',
  'All 5 sidebar module items match exact canonical labels and target paths'
);

// Test 14: Category & Item Permission Guards in DashboardLayout
const libraryGuarded = sidebarCode.includes("title: 'Library'") && sidebarCode.includes("permission: 'library.manage'");
const transportGuarded = sidebarCode.includes("title: 'Transport'") && sidebarCode.includes("permission: 'transport.manage'");
const inventoryGuarded = sidebarCode.includes("title: 'Inventory & Assets'") && sidebarCode.includes("permission: 'inventory.manage'");
const communicationGuarded = sidebarCode.includes("title: 'Communication'") && sidebarCode.includes("permission: 'communication.manage'");
const hostelGuarded = sidebarCode.includes("title: 'Operations'") && sidebarCode.includes("permission: 'hostel.manage'");
const systemGuarded = sidebarCode.includes("{can('settings.manage') && (") && sidebarCode.includes("title: 'System'");

assert(
  libraryGuarded && transportGuarded && inventoryGuarded && communicationGuarded && hostelGuarded && systemGuarded,
  'CHAL-M1-IT2-14',
  'Sidebar categories and System footer item are protected by strict permission checks',
  'Sidebar categories or System footer item lack proper permission checks, causing unauthorized traps',
  'All administrative categories and System footer are strictly guarded with role/permission checks'
);

// -------------------------------------------------------------
// Print Summary
// -------------------------------------------------------------
const passedCount = results.filter(r => r.passed).length;
const failedCount = results.filter(r => !r.passed).length;

console.log(`\n======================================================`);
console.log(`Challenger M1-2 (Iteration 2) Verification Suite`);
console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
console.log(`======================================================\n`);

results.forEach(r => {
  console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.testId}: ${r.name}`);
  console.log(`       ${r.details}`);
});

export default { total: results.length, passed: passedCount, failed: failedCount, results };
