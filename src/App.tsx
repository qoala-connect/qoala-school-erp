import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';

// Static imports for core public/auth pages
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Unauthorized from '@/pages/Unauthorized';
import SessionExpired from '@/pages/SessionExpired';
import Maintenance from '@/pages/Maintenance';
import NotFound from '@/pages/NotFound';
import Admissions from '@/pages/Admissions';
import DashboardLayout from '@/components/DashboardLayout';

// Lazy-loaded dashboard and operational modules for optimal chunking
const Analytics = lazy(() => import('@/pages/dashboard/Analytics'));
const Students = lazy(() => import('@/pages/dashboard/Students'));
const Teachers = lazy(() => import('@/pages/dashboard/Teachers'));
const Employees = lazy(() => import('@/pages/dashboard/Employees'));
const AdmissionsManagement = lazy(() => import('@/pages/dashboard/AdmissionsManagement'));
const FeesPortal = lazy(() => import('@/pages/dashboard/FeesPortal'));
const Reports = lazy(() => import('@/pages/dashboard/Reports'));
const AttendanceEntry = lazy(() => import('@/pages/dashboard/AttendanceEntry'));
const MarketingLanding = lazy(() => import('@/pages/MarketingLanding'));
const AboutUs = lazy(() => import('@/pages/AboutUs'));
const SystemManagement = lazy(() => import('@/pages/dashboard/SystemManagement'));
const CertificateGenerator = lazy(() => import('@/pages/dashboard/CertificateGenerator'));
const AcademicsManagement = lazy(() => import('@/pages/dashboard/AcademicsManagement'));
const TransportManagement = lazy(() => import('@/pages/dashboard/TransportManagement'));
const LibraryManagement = lazy(() => import('@/pages/dashboard/LibraryManagement'));
const HostelManagement = lazy(() => import('@/pages/dashboard/HostelManagement'));
const InventoryManagement = lazy(() => import('@/pages/dashboard/InventoryManagement'));
const CommunicationManagement = lazy(() => import('@/pages/dashboard/CommunicationManagement'));
const OnlineClasses = lazy(() => import('@/pages/dashboard/OnlineClasses'));
const SchoolCalendar = lazy(() => import('@/pages/dashboard/SchoolCalendar'));
const MedicalManagement = lazy(() => import('@/pages/dashboard/MedicalManagement'));
const DisciplineManagement = lazy(() => import('@/pages/dashboard/DisciplineManagement'));
const FrontOfficeManagement = lazy(() => import('@/pages/dashboard/FrontOfficeManagement'));
const AIAssistant = lazy(() => import('@/pages/dashboard/AIAssistant'));
const ExaminationModule = lazy(() => import('@/pages/dashboard/examination/ExaminationModule'));
const StudentPortal = lazy(() => import('@/pages/dashboard/StudentPortal'));

const RouteLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh] w-full">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
  </div>
);

/**
 * Smart role-based dashboard landing page.
 * Students and parents land directly on their private Student Portal.
 * Administrators, teachers, and staff land on the Executive Analytics Dashboard.
 */
const DashboardHome = () => {
  const { role } = useAuth();
  if (role === 'student' || role === 'parent') {
    return <StudentPortal />;
  }
  return <Analytics />;
};

/**
 * Route guard.
 *
 * The role and permission set come from the database via AuthContext.
 * Nothing here reads localStorage, so a route cannot be unlocked by
 * editing browser state. Even if it could, every query behind these
 * routes is independently gated by row level security.
 */
const ProtectedRoute = ({
  children,
  allowedPermission
}: {
  children: React.ReactNode,
  allowedPermission?: string
}) => {
  const { user, role, can, isLoading, errorKind } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1a73e8]"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Signed in, but the account has no profile row and therefore no role.
  // Fail closed rather than falling back to a default role.
  if (errorKind === 'no-profile' || !role) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (allowedPermission && !can(allowedPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/presentation" element={<MarketingLanding />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/session-expired" element={<SessionExpired />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/admissions" element={<Admissions />} />
          
          {/* Dashboard Protected Routes */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardLayout children={<DashboardHome />} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/portal" 
            element={
              <ProtectedRoute>
                <DashboardLayout children={<StudentPortal />} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/students" 
            element={
              <ProtectedRoute allowedPermission="student.list">
                <DashboardLayout children={<Students />} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/teachers" 
            element={
              <ProtectedRoute allowedPermission="teacher.view">
                <DashboardLayout children={<Teachers />} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/employees" 
            element={
              <ProtectedRoute allowedPermission="staff.view">
                <DashboardLayout children={<Employees />} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/admissions" 
            element={
              <ProtectedRoute allowedPermission="student.create">
                <DashboardLayout children={<AdmissionsManagement />} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/fees" 
            element={
              <ProtectedRoute allowedPermission="fees.view">
                <DashboardLayout children={<FeesPortal />} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/attendance" 
            element={
              <ProtectedRoute allowedPermission="attendance.manage">
                <DashboardLayout children={<AttendanceEntry />} />
              </ProtectedRoute>
            } 
          />
          {/* Legacy Examination redirects */}
          <Route path="/dashboard/marks" element={<Navigate to="/dashboard/examination" replace />} />
          <Route path="/dashboard/exam" element={<Navigate to="/dashboard/examination" replace />} />
          <Route 
            path="/dashboard/reports" 
            element={
              <ProtectedRoute allowedPermission="reports.view">
                <DashboardLayout children={<Reports />} />
              </ProtectedRoute>
            } 
          />
          
          {/* Centralized Enterprise System Administration Module */}
          <Route 
            path="/dashboard/system" 
            element={
              <ProtectedRoute allowedPermission="settings.manage">
                <DashboardLayout children={<SystemManagement />} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/system/:view" 
            element={
              <ProtectedRoute allowedPermission="settings.manage">
                <DashboardLayout children={<SystemManagement />} />
              </ProtectedRoute>
            } 
          />

          {/* Legacy System & Admin redirects */}
          <Route path="/dashboard/users-roles" element={<Navigate to="/dashboard/system/users" replace />} />
          <Route path="/dashboard/settings" element={<Navigate to="/dashboard/system/settings" replace />} />
          <Route path="/dashboard/audit" element={<Navigate to="/dashboard/system/audit" replace />} />
          {/*
            Academics addresses its views through the path so each one can
            be linked to, bookmarked and reloaded. The bare /dashboard/academics
            still resolves, redirecting to the overview, so existing links
            and the sidebar's router-state navigation keep working.
          */}
          <Route 
            path="/dashboard/academics" 
            element={
              <ProtectedRoute>
                <DashboardLayout children={<AcademicsManagement />} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/academics/:view" 
            element={
              <ProtectedRoute>
                <DashboardLayout children={<AcademicsManagement />} />
              </ProtectedRoute>
            } 
          />
          {/* The academic structure used to be reachable from several
              guessable paths. They now resolve to the one module that owns it. */}
          <Route path="/dashboard/academic-years"   element={<Navigate to="/dashboard/academics/years" replace />} />
          <Route path="/dashboard/classes"          element={<Navigate to="/dashboard/academics/classes" replace />} />
          <Route path="/dashboard/sections"         element={<Navigate to="/dashboard/academics/classes" replace />} />
          <Route path="/dashboard/subjects"         element={<Navigate to="/dashboard/academics/subjects" replace />} />
          <Route path="/dashboard/class-subjects"   element={<Navigate to="/dashboard/academics/class-subjects" replace />} />
          <Route path="/dashboard/curriculum"       element={<Navigate to="/dashboard/academics/class-subjects" replace />} />
          <Route path="/dashboard/academic-structure" element={<Navigate to="/dashboard/academics/structure" replace />} />
          <Route path="/dashboard/timetable"        element={<Navigate to="/dashboard/academics/timetable" replace />} />
          <Route 
            path="/dashboard/transport" 
            element={
              <ProtectedRoute allowedPermission="transport.manage">
                <DashboardLayout children={<TransportManagement />} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/library" 
            element={
              <ProtectedRoute allowedPermission="library.manage">
                <DashboardLayout children={<LibraryManagement />} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/hostel" 
            element={
              <ProtectedRoute allowedPermission="hostel.manage">
                <DashboardLayout children={<HostelManagement />} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/inventory" 
            element={
              <ProtectedRoute allowedPermission="inventory.manage">
                <DashboardLayout children={<InventoryManagement />} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/communication" 
            element={
              <ProtectedRoute allowedPermission="communication.manage">
                <DashboardLayout children={<CommunicationManagement />} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/certificates" 
            element={
              <ProtectedRoute allowedPermission="certificates.manage">
                <DashboardLayout children={<CertificateGenerator />} />
              </ProtectedRoute>
            } 
          />
          <Route path="/dashboard/library-management" element={<Navigate to="/dashboard/library" replace />} />
          <Route path="/dashboard/transport-management" element={<Navigate to="/dashboard/transport" replace />} />
          <Route path="/dashboard/inventory-management" element={<Navigate to="/dashboard/inventory" replace />} />
          <Route path="/dashboard/communication-management" element={<Navigate to="/dashboard/communication" replace />} />
          <Route path="/dashboard/certificate-generator" element={<Navigate to="/dashboard/certificates" replace />} />
          <Route 
            path="/dashboard/online-classes" 
            element={
              <ProtectedRoute allowedPermission="academics.view">
                <DashboardLayout children={<OnlineClasses />} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/calendar" 
            element={
              <ProtectedRoute allowedPermission="academics.view">
                <DashboardLayout children={<SchoolCalendar />} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/medical" 
            element={
              <ProtectedRoute allowedPermission="medical.manage">
                <DashboardLayout children={<MedicalManagement />} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/discipline" 
            element={
              <ProtectedRoute allowedPermission="discipline.manage">
                <DashboardLayout children={<DisciplineManagement />} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/front-office" 
            element={
              <ProtectedRoute allowedPermission="front_office.manage">
                <DashboardLayout children={<FrontOfficeManagement />} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/ai" 
            element={
              <ProtectedRoute>
                <DashboardLayout children={<AIAssistant />} />
              </ProtectedRoute>
            } 
          />

          {/* Examination Canonical & Submenu Routes */}
          <Route path="/dashboard/examination" element={<ProtectedRoute allowedPermission="results.view"><DashboardLayout children={<ExaminationModule />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/dashboard" element={<ProtectedRoute allowedPermission="results.view"><DashboardLayout children={<ExaminationModule view="dashboard" />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/exam-types" element={<ProtectedRoute allowedPermission="results.view"><DashboardLayout children={<ExaminationModule view="exam-types" />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/exams" element={<ProtectedRoute allowedPermission="results.publish"><DashboardLayout children={<ExaminationModule view="exams" />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/schedule" element={<ProtectedRoute allowedPermission="results.publish"><DashboardLayout children={<ExaminationModule view="schedule" />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/subject-mapping" element={<ProtectedRoute allowedPermission="results.view"><DashboardLayout children={<ExaminationModule view="subject-mapping" />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/seating-plan" element={<ProtectedRoute allowedPermission="results.view"><DashboardLayout children={<ExaminationModule view="seating-plan" />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/hall-allocation" element={<ProtectedRoute allowedPermission="results.view"><DashboardLayout children={<ExaminationModule view="hall-allocation" />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/invigilator-assignment" element={<ProtectedRoute allowedPermission="results.view"><DashboardLayout children={<ExaminationModule view="invigilator-assignment" />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/marks-entry" element={<ProtectedRoute allowedPermission="results.view"><DashboardLayout children={<ExaminationModule view="marks-entry" />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/marks-verification" element={<ProtectedRoute allowedPermission="results.view"><DashboardLayout children={<ExaminationModule view="marks-verification" />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/grace-marks" element={<ProtectedRoute allowedPermission="results.view"><DashboardLayout children={<ExaminationModule view="grace-marks" />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/grade-rules" element={<ProtectedRoute allowedPermission="results.view"><DashboardLayout children={<ExaminationModule view="grade-rules" />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/result-processing" element={<ProtectedRoute allowedPermission="results.publish"><DashboardLayout children={<ExaminationModule view="result-processing" />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/result-publication" element={<ProtectedRoute allowedPermission="results.publish"><DashboardLayout children={<ExaminationModule view="result-publication" />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/report-cards" element={<ProtectedRoute allowedPermission="results.view"><DashboardLayout children={<ExaminationModule view="report-cards" />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/admit-cards" element={<ProtectedRoute allowedPermission="results.view"><DashboardLayout children={<ExaminationModule view="admit-cards" />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/hall-tickets" element={<ProtectedRoute allowedPermission="results.view"><DashboardLayout children={<ExaminationModule view="hall-tickets" />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/merit-list" element={<ProtectedRoute allowedPermission="results.view"><DashboardLayout children={<ExaminationModule view="merit-list" />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/rank-list" element={<ProtectedRoute allowedPermission="results.view"><DashboardLayout children={<ExaminationModule view="rank-list" />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/certificates" element={<ProtectedRoute allowedPermission="student.view"><DashboardLayout children={<ExaminationModule view="certificates" />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/reports" element={<ProtectedRoute allowedPermission="results.view"><DashboardLayout children={<ExaminationModule view="reports" />} /></ProtectedRoute>} />
          <Route path="/dashboard/examination/analytics" element={<ProtectedRoute allowedPermission="results.view"><DashboardLayout children={<ExaminationModule view="analytics" />} /></ProtectedRoute>} />
          
          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
