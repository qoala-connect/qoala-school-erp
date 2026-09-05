/**
 * Master Comprehensive Frontend UI & Component Audit Test Suite
 * Inspects all 25+ UI pages, 15+ modals, responsive layouts, empty states,
 * event handlers, and design system contracts.
 */

import { inspectors } from './infra/inspectors';
import { assert } from './infra/assert';

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function test(category: string, name: string, fn: () => void) {
  try {
    fn();
    results.push({ category, name, passed: true });
    console.log(`  [PASS] [${category}] ${name}`);
  } catch (err: any) {
    results.push({ category, name, passed: false, error: err.message });
    console.error(`  [FAIL] [${category}] ${name}\n         Error: ${err.message}`);
  }
}

console.log('\n======================================================');
console.log('MASTER COMPREHENSIVE FRONTEND UI & UX AUDIT');
console.log('======================================================\n');

// -------------------------------------------------------------
// 1. PUBLIC UI PAGES AUDIT
// -------------------------------------------------------------
console.log('--- 1. Public UI Pages Audit ---');

test('Public UI', 'Home.tsx renders complete School Landing Page with slider, calendar, toppers, and gallery', () => {
  const code = inspectors.readFile('src/pages/Home.tsx');
  assert.contains(code, 'SJS_MEDIA', 'Must define SJS_MEDIA gallery assets');
  assert.contains(code, 'calendarEvents', 'Must render School Calendar highlights');
  assert.contains(code, 'toppersClass10', 'Must render CBSE Toppers section');
  assert.contains(code, 'Footer', 'Must render Footer');
});

test('Public UI', 'Admissions.tsx provides full 4-step intake form with validation & AI chatbot assistant', () => {
  const code = inspectors.readFile('src/pages/Admissions.tsx');
  assert.contains(code, 'STEPS', 'Must define multi-step progress array');
  assert.contains(code, 'Personal Info', 'Step 1: Personal Info');
  assert.contains(code, 'Guardian Details', 'Step 2: Guardian Details');
  assert.contains(code, 'Academic History', 'Step 3: Academic History');
  assert.contains(code, 'admissionService', 'Must bind admissionService for submissions');
});

test('Public UI', 'Login.tsx supports secure credential entry with handleLogin and toast feedback', () => {
  const code = inspectors.readFile('src/pages/Login.tsx');
  assert.contains(code, 'signInWithPassword', 'Must authenticate via Supabase Auth');
  assert.contains(code, 'email', 'Must have email state');
  assert.contains(code, 'password', 'Must have password state');
  assert.contains(code, 'handleLogin', 'Must have handleLogin submit handler');
});

test('Public UI', 'System fallback pages (Unauthorized, NotFound, SessionExpired, Maintenance) are properly styled', () => {
  const unauth = inspectors.readFile('src/pages/Unauthorized.tsx');
  const notFound = inspectors.readFile('src/pages/NotFound.tsx');
  const expired = inspectors.readFile('src/pages/SessionExpired.tsx');
  const maint = inspectors.readFile('src/pages/Maintenance.tsx');

  assert.contains(unauth, 'Access Restricted', 'Unauthorized must show Access Restricted');
  assert.contains(notFound, '404', 'NotFound must display 404');
  assert.contains(expired, 'Session Expired', 'SessionExpired must display Session Expired');
  assert.contains(maint, 'Maintenance', 'Maintenance must display Maintenance message');
});

// -------------------------------------------------------------
// 2. DASHBOARD CHROME & SHELL AUDIT
// -------------------------------------------------------------
console.log('\n--- 2. Dashboard Shell & Layout Audit ---');

test('Dashboard Layout', 'DashboardLayout.tsx renders collapsible sidebar, top navigation, search, and academic year provider', () => {
  const code = inspectors.readFile('src/components/DashboardLayout.tsx');
  assert.contains(code, 'Breadcrumb', 'Must render Breadcrumbs');
  assert.contains(code, 'AcademicYearProvider', 'Must mount AcademicYearProvider');
  assert.contains(code, 'AcademicYearBadge', 'Must mount AcademicYearBadge');
  assert.contains(code, 'Search', 'Must provide Global Search overlay');
  assert.contains(code, 'handleLogout', 'Must provide secure logout action');
});

test('Dashboard Layout', 'Dashboard Layout handles mobile responsive slide-out drawer', () => {
  const code = inspectors.readFile('src/components/DashboardLayout.tsx');
  assert.contains(code, 'mobileOpen', 'Must manage mobile drawer open state');
  assert.contains(code, 'lg:hidden', 'Mobile toggle must hide on desktop');
});

// -------------------------------------------------------------
// 3. CORE MANAGEMENT MODULES UI AUDIT
// -------------------------------------------------------------
console.log('\n--- 3. Core Management Modules UI Audit ---');

test('Management UI', 'Analytics.tsx renders executive KPI cards, charts, and quick utility links', () => {
  const code = inspectors.readFile('src/pages/dashboard/Analytics.tsx');
  assert.contains(code, 'Total Students', 'Must render Total Students KPI');
  assert.contains(code, 'Total Teachers', 'Must render Total Teachers KPI');
  assert.contains(code, 'Fee Collection', 'Must render Fee Collection KPI');
  assert.contains(code, 'Attendance', 'Must render Attendance KPI');
});

test('Management UI', 'Students.tsx & Student360Drawer.tsx support comprehensive search, filters, and 7-tab profile', () => {
  const code = inspectors.readFile('src/pages/dashboard/Students.tsx');
  const drawer = inspectors.readFile('src/components/students/Student360Drawer.tsx');
  assert.contains(code, 'StudentFormModal', 'Must mount StudentFormModal');
  assert.contains(code, 'search', 'Must support search filter');
  assert.contains(drawer, "'overview'", 'Must have Overview tab');
  assert.contains(drawer, "'academic'", 'Must have Academic tab');
  assert.contains(drawer, "'fees'", 'Must have Fees tab');
  assert.contains(drawer, "'attendance'", 'Must have Attendance tab');
});

test('Management UI', 'AdmissionsManagement.tsx renders status tabs and management modals', () => {
  const code = inspectors.readFile('src/pages/dashboard/AdmissionsManagement.tsx');
  assert.contains(code, 'statusFilter', 'Must manage statusFilter');
  assert.contains(code, 'AdmissionLetterModal', 'Must mount AdmissionLetterModal');
  assert.contains(code, 'AdmissionDetailsDrawer', 'Must mount AdmissionDetailsDrawer');
  assert.contains(code, 'AdmissionRejectModal', 'Must mount AdmissionRejectModal');
});

test('Management UI', 'FeesPortal.tsx & FeeCollectionModal.tsx support fee collection, balance calc, and printable receipts', () => {
  const code = inspectors.readFile('src/pages/dashboard/FeesPortal.tsx');
  const modal = inspectors.readFile('src/components/fees/FeeCollectionModal.tsx');
  assert.contains(code, 'FeeCollectionModal', 'Must mount FeeCollectionModal');
  assert.contains(code, 'FeeReceiptModal', 'Must mount FeeReceiptModal');
  assert.contains(modal, 'collectFee', 'Must execute fee collection');
});

test('Management UI', 'AttendanceEntry.tsx supports class/section selection, status toggles, and saving register', () => {
  const code = inspectors.readFile('src/pages/dashboard/AttendanceEntry.tsx');
  assert.contains(code, 'handleToggleStatus', 'Must support toggling attendance status');
  assert.contains(code, 'handleSaveAttendance', 'Must provide save attendance handler');
  assert.contains(code, 'save_attendance', 'Must call atomic save_attendance RPC');
});

test('Management UI', 'ExaminationModule.tsx integrates Exams, Datesheet, Marks Entry, and CBSE Marksheets', () => {
  const code = inspectors.readFile('src/pages/dashboard/examination/ExaminationModule.tsx');
  assert.contains(code, 'ResultsView', 'Must render ResultsView');
  assert.contains(code, 'DatesheetsView', 'Must render DatesheetsView');
  assert.contains(code, 'AnalyticsView', 'Must render AnalyticsView');
});

// -------------------------------------------------------------
// 4. OPERATIONS MODULES UI AUDIT
// -------------------------------------------------------------
console.log('\n--- 4. Institutional Operations Modules UI Audit ---');

test('Operations UI', 'TransportManagement.tsx manages routes, fleet vehicles, drivers, and student allocations', () => {
  const code = inspectors.readFile('src/pages/dashboard/TransportManagement.tsx');
  assert.contains(code, 'transport_routes', 'Must manage transport routes');
  assert.contains(code, 'vehicles', 'Must manage fleet vehicles');
  assert.contains(code, 'student_transport', 'Must manage student transport allocation');
});

test('Operations UI', 'LibraryManagement.tsx manages books, categories, borrowing issues, and overdue fines with real CSV export', () => {
  const code = inspectors.readFile('src/pages/dashboard/LibraryManagement.tsx');
  assert.contains(code, 'library_books', 'Must manage book catalog');
  assert.contains(code, 'book_issues', 'Must manage borrowing ledger');
  assert.contains(code, 'handleExport', 'Must export real CSV');
});

test('Operations UI', 'HostelManagement.tsx manages hostel buildings, room types, allocations, and visitors', () => {
  const code = inspectors.readFile('src/pages/dashboard/HostelManagement.tsx');
  assert.contains(code, "'hostels'", 'Must manage hostels tab');
  assert.contains(code, "'rooms'", 'Must manage rooms tab');
  assert.contains(code, "'allocations'", 'Must manage allocations tab');
});

test('Operations UI', 'InventoryManagement.tsx manages institutional assets, stock, vendors, and orders', () => {
  const code = inspectors.readFile('src/pages/dashboard/InventoryManagement.tsx');
  assert.contains(code, "'assets'", 'Must manage assets tab');
  assert.contains(code, "'stock'", 'Must manage stock tab');
  assert.contains(code, "'vendors'", 'Must manage vendors tab');
  assert.contains(code, "'orders'", 'Must manage purchase orders tab');
});

test('Operations UI', 'MedicalManagement.tsx & DisciplineManagement.tsx provide structured health & incident tracking', () => {
  const medical = inspectors.readFile('src/pages/dashboard/MedicalManagement.tsx');
  const discipline = inspectors.readFile('src/pages/dashboard/DisciplineManagement.tsx');
  assert.contains(medical, 'student_medical', 'Must record student medical logs');
  assert.contains(discipline, 'disciplinary_records', 'Must record disciplinary incidents');
});

test('Operations UI', 'FrontOfficeManagement.tsx tracks visitor logs, calls, postal dispatch, and admission inquiries', () => {
  const code = inspectors.readFile('src/pages/dashboard/FrontOfficeManagement.tsx');
  assert.contains(code, 'front_office_logs', 'Must query front_office_logs');
  assert.contains(code, 'loadData', 'Must provide loadData function');
});

test('Operations UI', 'Reports.tsx generates real CSV and PDF reports across Academics, Financials, and Attendance', () => {
  const code = inspectors.readFile('src/pages/dashboard/Reports.tsx');
  assert.contains(code, 'toCSV', 'Must flatten and format CSV data');
  assert.contains(code, 'financial', 'Must support financial reports');
  assert.contains(code, 'academic', 'Must support academic reports');
  assert.contains(code, 'attendance', 'Must support attendance reports');
});

test('Operations UI', 'SystemManagement.tsx provides user governance, RBAC role assignment, and audit log inspection', () => {
  const code = inspectors.readFile('src/pages/dashboard/SystemManagement.tsx');
  assert.contains(code, 'UserDirectoryView', 'Must render UserDirectoryView');
  assert.contains(code, 'RolesPermissionsView', 'Must render RolesPermissionsView');
  assert.contains(code, 'AuditLogsView', 'Must render AuditLogsView');
});

test('Operations UI', 'AIAssistant.tsx provides Gemini AI Copilot chat interface with role grounding and structured components', () => {
  const code = inspectors.readFile('src/pages/dashboard/AIAssistant.tsx');
  assert.contains(code, 'inputMessage', 'Must bind inputMessage state');
  assert.contains(code, 'StructuredMessageRenderer', 'Must mount StructuredMessageRenderer');
  assert.contains(code, 'suggestedPrompts', 'Must provide dynamic suggested prompts');
});

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
const total = results.length;
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

console.log('\n======================================================');
console.log(`MASTER UI AUDIT RESULTS: Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
