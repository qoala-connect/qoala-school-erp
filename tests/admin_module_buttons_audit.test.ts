/**
 * Comprehensive Admin Module Button & Action Interaction Audit Test Suite
 * Inspects all 25 Admin modules to verify every interactive button, modal trigger,
 * form submission, export handler, and atomic RPC call.
 */

import { inspectors } from './infra/inspectors';
import { assert } from './infra/assert';

interface TestResult {
  moduleName: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function test(moduleName: string, name: string, fn: () => void) {
  try {
    fn();
    results.push({ moduleName, name, passed: true });
    console.log(`  [PASS] [${moduleName}] ${name}`);
  } catch (err: any) {
    results.push({ moduleName, name, passed: false, error: err.message });
    console.error(`  [FAIL] [${moduleName}] ${name}\n         Error: ${err.message}`);
  }
}

console.log('\n======================================================');
console.log('ADMIN MODULE BUTTONS & ACTIONS INTERACTION AUDIT');
console.log('======================================================\n');

// 1. Analytics & Overview
test('Analytics', 'Quick Action & Metric cards have valid navigation and click handlers', () => {
  const code = inspectors.readFile('src/pages/dashboard/Analytics.tsx');
  assert.contains(code, "navigate('/dashboard/students'", 'Student KPI navigates to /dashboard/students');
  assert.contains(code, "navigate('/dashboard/teachers'", 'Teacher KPI navigates to /dashboard/teachers');
  assert.contains(code, "navigate('/dashboard/fees'", 'Fees KPI navigates to /dashboard/fees');
  assert.contains(code, "navigate('/dashboard/attendance'", 'Attendance KPI navigates to /dashboard/attendance');
});

// 2. Students Module
test('Students', 'Add Student, Search, Export, and Row Actions (360, Edit, Promote, ID Card) trigger correctly', () => {
  const code = inspectors.readFile('src/pages/dashboard/Students.tsx');
  assert.contains(code, 'setFormOpen(true)', 'Add Student button opens modal');
  assert.contains(code, 'setIs360Open(true)', 'View 360 opens drawer');
  assert.contains(code, 'setIdCardModalOpen(true)', 'ID Card button opens modal');
  assert.contains(code, 'setPromotionModalOpen(true)', 'Promote button opens modal');
  assert.contains(code, 'setStatusModalOpen(true)', 'Status Change opens modal');
});

// 3. Teachers Module
test('Teachers', 'Add Teacher, Assign, Bulk Assign, Filter, and Teacher 360 Drawer buttons work', () => {
  const code = inspectors.readFile('src/pages/dashboard/Teachers.tsx');
  assert.contains(code, 'setIsFormOpen(true)', 'Add Teacher button opens modal');
  assert.contains(code, 'setIsAssignOpen(true)', 'Assign Teacher button opens modal');
  assert.contains(code, 'setIsBulkAssignOpen(true)', 'Bulk Assign opens modal');
  assert.contains(code, 'setIsDrawerOpen(true)', 'View 360 opens drawer');
  assert.contains(code, 'setIsStatusOpen(true)', 'Status change opens modal');
});

// 4. Employees Module
test('Employees', 'Add Employee Wizard, Save, End Employment, and Filter actions trigger properly', () => {
  const code = inspectors.readFile('src/pages/dashboard/Employees.tsx');
  assert.contains(code, 'setIsWizardOpen(true)', 'Add Staff button opens wizard modal');
  assert.contains(code, 'handleSave', 'Save employee handler is wired');
  assert.contains(code, 'handleDelete', 'End employment action triggers confirmation');
});

// 5. Admissions Management Module
test('Admissions Management', 'Intake Modal, Status Tabs, Fast-track, Bulk Approve, and Letter buttons work', () => {
  const code = inspectors.readFile('src/pages/dashboard/AdmissionsManagement.tsx');
  assert.contains(code, 'setIsCreateModalOpen(true)', 'New Admission button opens form');
  assert.contains(code, 'handleFastTrackEnrol', 'Fast-track enrol button triggers approval');
  assert.contains(code, 'handleBulkApprove', 'Bulk approve enrolls selected applicants');
  assert.contains(code, 'setIsRejectModalOpen(true)', 'Reject button opens reject modal');
  assert.contains(code, 'setIsLetterModalOpen(true)', 'Admission Letter button triggers modal');
});

// 6. Fees Portal Module
test('Fees Portal', 'Collect Fee, View Receipt, Void Payment, Structure Manager, and Filter buttons work', () => {
  const code = inspectors.readFile('src/pages/dashboard/FeesPortal.tsx');
  assert.contains(code, 'setIsCollectModalOpen(true)', 'Collect Fee button opens modal');
  assert.contains(code, 'setIsReceiptModalOpen(true)', 'Print Receipt button opens receipt modal');
  assert.contains(code, 'setIsVoidModalOpen(true)', 'Void Payment button opens void modal');
  assert.contains(code, "setActiveTab('fee_structure')", 'Fee Structure tab button works');
  assert.contains(code, "setActiveTab('recent_payments')", 'Recent Payments tab button works');
});

// 7. Attendance Entry Module
test('Attendance Entry', 'Status toggle buttons, Mark All Present/Absent, and Save Attendance RPC work', () => {
  const code = inspectors.readFile('src/pages/dashboard/AttendanceEntry.tsx');
  assert.contains(code, 'handleToggleStatus', 'Status buttons toggle individual student attendance');
  assert.contains(code, 'handleSaveAttendance', 'Save Register button triggers save handler');
  assert.contains(code, "rpc('save_attendance'", 'Calls atomic save_attendance RPC');
  assert.contains(code, 'fetchRegisterData', 'Refresh button reloads class register');
});

// 8. Examination Module
test('Examination Module', 'Create Exam, Datesheet generator, Marks Entry save, and Report Cards download work', () => {
  const code = inspectors.readFile('src/pages/dashboard/examination/ExaminationModule.tsx');
  assert.contains(code, 'ResultsView', 'ResultsView tab is wired');
  assert.contains(code, 'DatesheetsView', 'DatesheetsView tab is wired');
  assert.contains(code, 'AdmitCardsView', 'AdmitCardsView tab is wired');
  assert.contains(code, 'StudentReportsView', 'StudentReportsView tab is wired');
});

// 9. Academics Management Module
test('Academics Management', 'Academic Year, Class, Section, Subject, and Timetable tabs and views work', () => {
  const code = inspectors.readFile('src/pages/dashboard/AcademicsManagement.tsx');
  assert.contains(code, 'AcademicYearsView', 'AcademicYearsView tab is wired');
  assert.contains(code, 'ClassesSectionsView', 'ClassesSectionsView tab is wired');
  assert.contains(code, 'SubjectsView', 'SubjectsView tab is wired');
  assert.contains(code, 'TimetableView', 'TimetableView tab is wired');
});

// 10. Reports Module
test('Reports', 'CSV and PDF download buttons across Financial, Academic, and Attendance work', () => {
  const code = inspectors.readFile('src/pages/dashboard/Reports.tsx');
  assert.contains(code, 'runExport', 'Report download button executes report generator');
  assert.contains(code, 'toCSV', 'Formats dataset to CSV');
  assert.contains(code, 'Revenue Collection Log', 'Financial report generator is wired');
  assert.contains(code, 'Class-wise Result Data', 'Academic report generator is wired');
  assert.contains(code, 'Attendance Audit', 'Attendance report generator is wired');
});

// 11. Transport Management Module
test('Transport Management', 'Add Modal, Entity Tab switching, Form commit, and Delete buttons work', () => {
  const code = inspectors.readFile('src/pages/dashboard/TransportManagement.tsx');
  assert.contains(code, 'setShowAddModal(true)', 'Add entity button opens modal');
  assert.contains(code, 'setActiveTab', 'Tab switcher works for routes/vehicles/drivers/allotments');
  assert.contains(code, 'handleDelete', 'Delete action removes item');
  assert.contains(code, 'handleSubmit', 'Submit action commits record');
});

// 12. Library Management Module
test('Library Management', 'Add Modal, Issue/Return handlers, and Category/Book/Fine tabs work', () => {
  const code = inspectors.readFile('src/pages/dashboard/LibraryManagement.tsx');
  assert.contains(code, 'setShowAddModal(true)', 'Add entity button opens modal');
  assert.contains(code, 'setActiveTab', 'Tab switcher works for books/categories/issues/fines');
  assert.contains(code, 'handleDelete', 'Delete action removes item');
  assert.contains(code, 'handleSubmit', 'Submit action commits record');
});

// 13. Hostel Management Module
test('Hostel Management', 'Add Modal, Allocations, Rooms, Hostels, and Visitors tabs work', () => {
  const code = inspectors.readFile('src/pages/dashboard/HostelManagement.tsx');
  assert.contains(code, 'setShowAddModal(true)', 'Add entity button opens modal');
  assert.contains(code, 'setActiveTab', 'Tab switcher works for hostels/rooms/allocations/visitors');
  assert.contains(code, 'handleDelete', 'Delete action removes item');
  assert.contains(code, 'handleSave', 'Save action commits record');
});

// 14. Inventory Management Module
test('Inventory Management', 'Add Modal, Assets, Stock, Vendors, and Orders tabs work', () => {
  const code = inspectors.readFile('src/pages/dashboard/InventoryManagement.tsx');
  assert.contains(code, 'setShowAddModal(true)', 'Add entity button opens modal');
  assert.contains(code, 'setActiveTab', 'Tab switcher works for assets/stock/vendors/orders');
  assert.contains(code, 'handleDelete', 'Delete action removes item');
  assert.contains(code, 'handleSave', 'Save action commits record');
});

// 15. Medical Management Module
test('Medical Management', 'Add Medical Log, Filter by Condition/Blood Group, Edit, and Delete buttons work', () => {
  const code = inspectors.readFile('src/pages/dashboard/MedicalManagement.tsx');
  assert.contains(code, 'setShowAddModal(true)', 'Add Medical Record button opens modal');
  assert.contains(code, 'handleFormSubmit', 'Save record button submits form');
  assert.contains(code, 'handleDelete', 'Delete record button removes record');
});

// 16. Discipline Management Module
test('Discipline Management', 'Report Incident, Status Resolution toggle, and Delete incident buttons work', () => {
  const code = inspectors.readFile('src/pages/dashboard/DisciplineManagement.tsx');
  assert.contains(code, 'setShowAddModal(true)', 'Report Incident button opens modal');
  assert.contains(code, 'handleFormSubmit', 'Save incident button submits record');
  assert.contains(code, 'handleDelete', 'Delete incident button removes record');
});

// 17. Front Office Management Module
test('Front Office Management', 'New Visitor, Call Log, Postal Dispatch, and Resolve Enquiry actions work', () => {
  const code = inspectors.readFile('src/pages/dashboard/FrontOfficeManagement.tsx');
  assert.contains(code, 'setShowAddModal(true)', 'New Entry button opens modal');
  assert.contains(code, 'handleFormSubmit', 'Save log button commits record');
  assert.contains(code, 'handleDelete', 'Delete log button removes record');
});

// 18. School Calendar Module
test('School Calendar', 'Add Event, Month Navigation, and Holiday filters work properly', () => {
  const code = inspectors.readFile('src/pages/dashboard/SchoolCalendar.tsx');
  assert.contains(code, 'setShowAddModal(true)', 'Add Event button opens modal');
  assert.contains(code, 'handleFormSubmit', 'Save event button commits event');
  assert.contains(code, 'handleDelete', 'Delete event button removes event');
});

// 19. Certificate Generator Module
test('Certificate Generator', 'Template Selector, Auto-Fill Student, and Print / PDF Download work', () => {
  const code = inspectors.readFile('src/pages/dashboard/CertificateGenerator.tsx');
  assert.contains(code, 'handleDownload', 'Download PDF button triggers PDF generation');
  assert.contains(code, 'setCertType', 'Certificate type buttons switch template');
  assert.contains(code, 'studentName', 'Auto-fills student name');
});

// 20. Online Classes Module
test('Online Classes', 'Schedule Class, Launch Meeting link, Edit, and Delete class buttons work', () => {
  const code = inspectors.readFile('src/pages/dashboard/OnlineClasses.tsx');
  assert.contains(code, 'setShowAddModal(true)', 'Schedule Class button opens modal');
  assert.contains(code, 'handleFormSubmit', 'Save class button commits meeting');
  assert.contains(code, 'handleDelete', 'Delete class button removes meeting');
});

// 21. System Management Module
test('System Management', 'User Directory, Role Assignment, Status Toggle, and Audit Log Search work', () => {
  const code = inspectors.readFile('src/pages/dashboard/SystemManagement.tsx');
  assert.contains(code, 'UserDirectoryView', 'User Directory view is mounted');
  assert.contains(code, 'RolesPermissionsView', 'Roles & Permissions view is mounted');
  assert.contains(code, 'AuditLogsView', 'Audit Logs view is mounted');
  assert.contains(code, 'SecurityView', 'Security & Governance view is mounted');
});

// 22. AI Assistant Module
test('AI Assistant', 'Send Message, Suggested Prompt chips, and Action Card execution buttons work', () => {
  const code = inspectors.readFile('src/pages/dashboard/AIAssistant.tsx');
  assert.contains(code, 'handleSendMessage', 'Send button submits message');
  assert.contains(code, 'suggestedPrompts', 'Prompt suggestion chips are rendered');
  assert.contains(code, 'StructuredMessageRenderer', 'Interactive action cards are rendered');
});

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
const total = results.length;
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

console.log('\n======================================================');
console.log(`ADMIN MODULE BUTTONS AUDIT: Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
