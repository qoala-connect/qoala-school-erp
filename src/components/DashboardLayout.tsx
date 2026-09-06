import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  Wallet, 
  BarChart3, 
  Settings, 
  LogOut,
  Search,
  Bell,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  AppWindow,
  CalendarCheck,
  ClipboardList,
  FileSpreadsheet,
  BookOpen,
  Database,
  ShieldAlert,
  Briefcase,
  Award,
  Bus,
  Library,
  Home as HomeIcon,
  Layers,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AcademicYearProvider, useAcademicYear } from '@/context/AcademicYearContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import GoogleAIBot from './GoogleAIBot';
import { SchoolCrest } from './SchoolLogo';

interface SidebarItemProps {
  icon: any;
  label: string;
  path: string;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
  key?: string;
}

function SidebarItem({ icon: Icon, label, path, active, collapsed, onClick }: SidebarItemProps) {
  return (
    <Link to={path} onClick={onClick}>
      <motion.div
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-[10px] transition-all group relative",
          active 
            ? "bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-sm shadow-blue-600/15" 
            : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/60"
        )}
      >
        <Icon className={cn("w-4 h-4 flex-shrink-0 transition-transform", !active && "group-hover:scale-105")} />
        {!collapsed && (
          <span className="font-semibold text-xs tracking-tight">{label}</span>
        )}
        {active && (
          <motion.div 
            layoutId="sidebar-active"
            className="absolute left-[-16px] w-1 h-5 bg-blue-600 rounded-r-full"
          />
        )}
      </motion.div>
    </Link>
  );
}

interface BreadcrumbCategory {
  title: string;
  items: { label: string; path: string }[];
}

/**
 * Derives "Dashboard / Section / Page" from the same nav config that builds
 * the sidebar, matched against the current route — one source of truth, no
 * per-page wiring required.
 */
function Breadcrumbs({ categories, pathname }: { categories: BreadcrumbCategory[]; pathname: string }) {
  if (pathname === '/dashboard') return null;

  let match: { categoryTitle: string; itemLabel: string } | null = null;
  for (const cat of categories) {
    const item = cat.items.find(i => i.path === pathname);
    if (item) {
      match = { categoryTitle: cat.title, itemLabel: item.label };
      break;
    }
  }
  if (!match) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-3 select-none">
      <Link to="/dashboard" className="hover:text-slate-700 transition-colors">Dashboard</Link>
      <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
      <span className="text-slate-500">{match.categoryTitle}</span>
      <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
      <span className="text-slate-700">{match.itemLabel}</span>
    </nav>
  );
}

/**
 * The dashboard chrome. Split from the default export so that everything
 * inside it, the sidebar included, sits under AcademicYearProvider and
 * can read the selected academic year.
 */
function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, role, roleLabel, can, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isStudentOrParent = role === 'student' || role === 'parent';

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/login');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  const studentSidebarCategories = [
    {
      title: 'My Student Portal',
      icon: GraduationCap,
      permission: null,
      items: [
        { label: 'My Dashboard & Profile', path: '/dashboard', permission: null },
        { label: 'Homework', path: '/dashboard/portal?tab=homework', permission: null },
        { label: 'Assignments', path: '/dashboard/portal?tab=assignments', permission: null },
        { label: 'Syllabus & Progress', path: '/dashboard/portal?tab=syllabus', permission: null },
        { label: 'My Attendance', path: '/dashboard/portal', state: { tab: 'attendance' }, permission: null },
        { label: 'Fee Invoices & Receipts', path: '/dashboard/portal', state: { tab: 'fees' }, permission: null },
        { label: 'Report Cards & Results', path: '/dashboard/portal', state: { tab: 'examination' }, permission: null },
        { label: 'Class Timetable', path: '/dashboard/portal', state: { tab: 'timetable' }, permission: null },
        { label: 'Transport & Route', path: '/dashboard/portal', state: { tab: 'transport' }, permission: null },
      ]
    },
    {
      title: 'Learning & Calendar',
      icon: BookOpen,
      permission: null,
      items: [
        { label: 'School Calendar', path: '/dashboard/calendar', permission: null },
        { label: 'AI Study Tutor', path: '/dashboard/ai', permission: null },
      ]
    }
  ];

  const sidebarCategories: {
    title: string;
    icon: any;
    permission: string | null;
    items: {
      label: string;
      path: string;
      state?: any;
      permission: string | null;
    }[];
  }[] = [
    {
      title: 'Admissions',
      icon: GraduationCap,
      permission: null,
      items: [
        { label: 'Direct Enrollment', path: '/dashboard/admissions', permission: 'student.create' },
        { label: 'Pending Approvals', path: '/dashboard/admissions', state: { statusFilter: 'Pending' }, permission: 'student.create' },
        { label: 'Front Office', path: '/dashboard/front-office', permission: 'front_office.manage' }
      ]
    },
    {
      title: 'Students',
      icon: Users,
      permission: 'student.list',
      items: [
        { label: 'Student Directory & SIS', path: '/dashboard/students', permission: 'student.list' },
        { label: 'Alumni & Transferred', path: '/dashboard/students', state: { statusFilter: 'all' }, permission: 'student.list' },
        { label: 'Medical', path: '/dashboard/medical', permission: 'medical.manage' },
        { label: 'Discipline', path: '/dashboard/discipline', permission: 'discipline.manage' }
      ]
    },
    {
      // The teacher's own workspace. Every entry is gated on
      // academics.teach, so the whole group is hidden from roles that
      // do not run a classroom. The database scopes every read and write
      // inside it to the signed-in teacher.
      title: 'My Teaching',
      icon: GraduationCap,
      permission: 'academics.teach',
      items: [
        { label: "Today's Classes", path: '/dashboard/teaching/today', permission: 'academics.teach' },
        { label: 'My Classes', path: '/dashboard/teaching/classes', permission: 'academics.teach' },
        { label: 'Lesson Plans', path: '/dashboard/teaching/lessons', permission: 'academics.teach' },
        { label: 'Homework & Assignments', path: '/dashboard/teaching/work', permission: 'academics.teach' },
        { label: 'Marks Entry', path: '/dashboard/teaching/marks', permission: 'academics.teach' },
        { label: 'Syllabus Progress', path: '/dashboard/teaching/syllabus', permission: 'academics.teach' },
      ]
    },
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
        { label: 'Curriculum & Syllabus', path: '/dashboard/academics/curriculum', permission: null },
        { label: 'Timetable', path: '/dashboard/academics/timetable', permission: null },
        { label: 'Academic Monitor', path: '/dashboard/academics/monitor', permission: null },
        { label: 'Academic Structure', path: '/dashboard/academics/structure', permission: null },
        { label: 'School Calendar', path: '/dashboard/calendar', permission: null }
      ]
    },
    {
      title: 'Attendance',
      icon: CalendarCheck,
      permission: null,
      items: [
        { label: 'Attendance Entry', path: '/dashboard/attendance', permission: 'attendance.manage' }
      ]
    },
    {
      title: 'CBSE Examination',
      icon: ClipboardList,
      permission: 'results.view',
      items: [
        { label: 'Dashboard', path: '/dashboard/examination?tab=dashboard', permission: 'results.view' },
        { label: 'Exams & Assessments', path: '/dashboard/examination?tab=exams', permission: 'results.publish' },
        { label: 'Exam Schedule', path: '/dashboard/examination?tab=schedule', permission: 'results.view' },
        { label: 'Admit Cards', path: '/dashboard/examination?tab=admit-cards', permission: 'results.view' },
        { label: 'Seating Plan', path: '/dashboard/examination?tab=seating-plan', permission: 'results.view' },
        { label: 'Invigilation', path: '/dashboard/examination?tab=invigilation', permission: 'results.view' },
        { label: 'Exam Attendance', path: '/dashboard/examination?tab=exam-attendance', permission: 'results.view' },
        { label: 'Marks Entry', path: '/dashboard/examination?tab=marks-entry', permission: 'results.view' },
        { label: 'Marks Verification', path: '/dashboard/examination?tab=marks-verification', permission: 'results.publish' },
        { label: 'Result Processing', path: '/dashboard/examination?tab=result-processing', permission: 'results.publish' },
        { label: 'Report Cards', path: '/dashboard/examination?tab=report-cards', permission: 'results.view' },
        { label: 'Result Publishing', path: '/dashboard/examination?tab=result-publishing', permission: 'results.publish' },
        { label: 'Performance Analytics', path: '/dashboard/examination?tab=analytics', permission: 'results.view' },
        { label: 'Examination Settings', path: '/dashboard/examination?tab=settings', permission: 'results.publish' }
      ]
    },
    {
      title: 'Financials',
      icon: Wallet,
      permission: 'fees.view',
      items: [
        { label: 'Fee Overview & Hub', path: '/dashboard/fees', state: { activeTab: 'portal' }, permission: 'fees.view' },
        { label: 'Fee Collection & Ledgers', path: '/dashboard/fees', state: { activeTab: 'student_fees' }, permission: 'fees.collect' },
        { label: 'Fee Structure Master', path: '/dashboard/fees', state: { activeTab: 'fee_structure' }, permission: 'fees.view' },
        { label: 'Recent Transactions', path: '/dashboard/fees', state: { activeTab: 'recent_payments' }, permission: 'fees.view' },
        { label: 'Fee Reports & Overdues', path: '/dashboard/fees', state: { activeTab: 'fee_reports' }, permission: 'fees.view' }
      ]
    },
    {
      title: 'Faculty & Staff',
      icon: Briefcase,
      permission: null,
      items: [
        { label: 'Teacher Directory & 360', path: '/dashboard/teachers', permission: 'teacher.view' },
        { label: 'Academic Assignments', path: '/dashboard/teachers', state: { activeTab: 'assignments' }, permission: 'teacher.view' },
        { label: 'Non-Teaching Staff', path: '/dashboard/employees', permission: 'staff.view' }
      ]
    },
    {
      title: 'Library',
      icon: Library,
      permission: 'library.manage',
      items: [
        { label: 'Book Catalog', path: '/dashboard/library', state: { activeTab: 'books' }, permission: 'library.manage' },
        { label: 'Subject Categories', path: '/dashboard/library', state: { activeTab: 'categories' }, permission: 'library.manage' },
        { label: 'Borrowing Ledger', path: '/dashboard/library', state: { activeTab: 'issues' }, permission: 'library.manage' },
        { label: 'Overdue Fines', path: '/dashboard/library', state: { activeTab: 'fines' }, permission: 'library.manage' }
      ]
    },
    {
      title: 'Transport',
      icon: Bus,
      permission: 'transport.manage',
      items: [
        { label: 'Transit Routes', path: '/dashboard/transport', state: { activeTab: 'routes' }, permission: 'transport.manage' },
        { label: 'Fleet Vehicles', path: '/dashboard/transport', state: { activeTab: 'vehicles' }, permission: 'transport.manage' },
        { label: 'Certified Drivers', path: '/dashboard/transport', state: { activeTab: 'drivers' }, permission: 'transport.manage' },
        { label: 'Transit Allotments', path: '/dashboard/transport', state: { activeTab: 'allotments' }, permission: 'transport.manage' }
      ]
    },
    {
      title: 'Inventory & Assets',
      icon: Layers,
      permission: 'inventory.manage',
      items: [
        { label: 'Fixed Assets', path: '/dashboard/inventory', state: { activeTab: 'assets' }, permission: 'inventory.manage' },
        { label: 'Consumable Stock', path: '/dashboard/inventory', state: { activeTab: 'stock' }, permission: 'inventory.manage' },
        { label: 'Vendors Directory', path: '/dashboard/inventory', state: { activeTab: 'vendors' }, permission: 'inventory.manage' },
        { label: 'Purchase Orders', path: '/dashboard/inventory', state: { activeTab: 'orders' }, permission: 'inventory.manage' }
      ]
    },
    {
      title: 'Operations',
      icon: HomeIcon,
      permission: 'hostel.manage',
      items: [
        { label: 'Hostel', path: '/dashboard/hostel', permission: 'hostel.manage' }
      ]
    },
    {
      title: 'Communication',
      icon: MessageSquare,
      permission: 'communication.manage',
      items: [
        { label: 'Official Notices', path: '/dashboard/communication', state: { activeTab: 'notices' }, permission: 'communication.manage' },
        { label: 'SMS Campaigns', path: '/dashboard/communication', state: { activeTab: 'sms' }, permission: 'communication.manage' },
        { label: 'Email Broadcasts', path: '/dashboard/communication', state: { activeTab: 'email' }, permission: 'communication.manage' },
        { label: 'App Push Alerts', path: '/dashboard/communication', state: { activeTab: 'push' }, permission: 'communication.manage' }
      ]
    },
    {
      title: 'Certificates & ID',
      icon: Award,
      permission: null,
      items: [
        { label: 'Issue Credentials', path: '/dashboard/certificates', permission: 'certificates.manage' },
        { label: 'Student ID Cards', path: '/dashboard/students', state: { openIdCards: true }, permission: 'student.list' }
      ]
    },
    {
      title: 'Reports',
      icon: BarChart3,
      permission: 'reports.view',
      items: [
        { label: 'Reports', path: '/dashboard/reports', permission: 'reports.view' }
      ]
    },
    {
      title: 'System',
      icon: Settings,
      permission: 'settings.manage',
      items: [
        { label: 'Overview', path: '/dashboard/system/overview', permission: 'settings.manage' },
        { label: 'User Directory', path: '/dashboard/system/users', permission: 'users.manage' },
        { label: 'Roles & Permissions', path: '/dashboard/system/roles', permission: 'settings.manage' },
        { label: 'School Settings', path: '/dashboard/system/settings', permission: 'settings.manage' },
        { label: 'Audit Logs', path: '/dashboard/system/audit', permission: 'audit.view' },
        { label: 'Security & Governance', path: '/dashboard/system/security', permission: 'settings.manage' },
      ]
    }
  ];

  // Expanded accordion logic
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Auto-expand active path category on mount/location change
  useEffect(() => {
    sidebarCategories.forEach(cat => {
      const hasActiveChild = cat.items.some(item => location.pathname === item.path);
      if (hasActiveChild) {
        setExpandedSections(prev => ({ ...prev, [cat.title]: true }));
      }
    });
  }, [location.pathname]);

  const toggleSection = (title: string) => {
    if (collapsed) {
      setCollapsed(false);
    }
    setExpandedSections(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  // Filter categories and their items by current user permissions
  const categoriesToRender = isStudentOrParent ? studentSidebarCategories : sidebarCategories;

  const filteredCategories = categoriesToRender.map(cat => {
    const items = cat.items.filter(item => {
      if (!item.permission) return true;
      return can(item.permission);
    });
    return {
      ...cat,
      items
    };
  }).filter(cat => {
    if (!cat.permission) return cat.items.length > 0;
    return can(cat.permission) && cat.items.length > 0;
  });

  // Global Search logic
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [allExams, setAllExams] = useState<any[]>([]);

  // Notifications & User Menu States
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; content?: string; publish_date?: string; is_read?: boolean }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const { data: noticesData } = await supabase
          .from('notices')
          .select('id, title, description, created_at')
          .order('created_at', { ascending: false })
          .limit(6);
        if (noticesData && noticesData.length > 0) {
          setNotifications(noticesData.map((n: any) => ({
            id: n.id,
            title: n.title,
            content: n.description || n.content || '',
            publish_date: n.created_at || n.publish_date || '',
            is_read: false
          })));
          setUnreadCount(noticesData.length);
        }
      } catch (err) {
        console.warn('Failed to load notices for notifications popover:', err);
      }
    }
    fetchNotifications();
  }, []);

  // Close notifications and user menu on click outside
  useEffect(() => {
    function handleGlobalClick(e: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleGlobalClick);
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, []);

  useEffect(() => {
    async function fetchSearchContext() {
      // Never load or expose directory index of other students or staff to students / parents
      if (isStudentOrParent) {
        setAllStudents([]);
        setAllEmployees([]);
        return;
      }
      try {
        const { data: stds } = await supabase.from('students').select('id, name, roll_number, admission_number, class').eq('status', 'active').limit(150);
        if (stds) setAllStudents(stds);

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

        const { data: exms } = await supabase.from('exams').select('id, exam_name, class').limit(30);
        if (exms) setAllExams(exms);
      } catch (err) {
        console.warn('Failed to load global search context:', err);
      }
    }
    fetchSearchContext();
  }, [isStudentOrParent]);

  const filteredSearch = React.useMemo(() => {
    if (!searchQuery) return { students: [], employees: [], exams: [] };
    const q = searchQuery.toLowerCase();
    return {
      students: allStudents.filter(s => 
        (s.name && s.name.toLowerCase().includes(q)) || 
        (s.roll_number && s.roll_number.toLowerCase().includes(q)) || 
        (s.admission_number && s.admission_number.toLowerCase().includes(q)) ||
        (s.class && s.class.toLowerCase().includes(q))
      ).slice(0, 5),
      employees: allEmployees.filter(e => 
        (e.name && e.name.toLowerCase().includes(q)) || 
        (e.employee_id && e.employee_id.toLowerCase().includes(q)) || 
        (e.designation && e.designation.toLowerCase().includes(q)) ||
        (e.role && e.role.toLowerCase().includes(q))
      ).slice(0, 5),
      exams: allExams.filter(e => 
        (e.exam_name && e.exam_name.toLowerCase().includes(q)) || 
        (e.class && e.class.toLowerCase().includes(q))
      ).slice(0, 5)
    };
  }, [searchQuery, allStudents, allEmployees, allExams]);

  const sidebarContent = (isMobile: boolean = false) => (
    <>
      <div className="flex items-center justify-between px-1 mb-5 overflow-hidden shrink-0 mt-0.5">
        <Link 
          to="/" 
          title="St. Joseph's School ERP Portal"
          className={cn(
            "flex items-center group rounded-xl transition-all",
            collapsed && !isMobile ? "justify-center w-full py-1" : "gap-2.5"
          )}
        >
          <div className="w-9 h-9 rounded-full p-0.5 bg-white shadow-xs border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
            <img 
              src="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/logo_icon.JPG"
              alt="St. Joseph’s School Crest"
              className="w-full h-full object-contain rounded-full"
              onError={(e) => {
                (e.target as HTMLElement).setAttribute('src', 'https://sjsbrlschool.edu.in/favicon.png');
              }}
            />
          </div>
          {(!collapsed || isMobile) && (
            <div className="flex flex-col min-w-0 leading-none">
              <span className="font-serif font-black text-[#061f3d] text-xs tracking-tight leading-tight truncate group-hover:text-blue-700 transition-colors">
                ST. JOSEPH’S SCHOOL
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[8px] font-extrabold text-[#1a73e8] tracking-wider uppercase truncate">
                  Barhalganj • ERP
                </span>
                <span className="w-1 h-1 rounded-full bg-amber-500 inline-block shrink-0" />
                <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-tight shrink-0">
                  CBSE
                </span>
              </div>
            </div>
          )}
        </Link>
        {isMobile && (
          <button 
            onClick={() => setMobileOpen(false)}
            className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-all"
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {/* Main Dashboard Single View */}
        <SidebarItem 
          icon={LayoutDashboard}
          label="Dashboard"
          path="/dashboard"
          active={location.pathname === '/dashboard'}
          collapsed={isMobile ? false : collapsed}
          onClick={() => isMobile && setMobileOpen(false)}
        />

        {/* Categories Accordion */}
        {filteredCategories.map((cat) => {
          const CategoryIcon = cat.icon;
          const isExpanded = !!expandedSections[cat.title];
          const hasActiveChild = cat.items.some(item => location.pathname === item.path);

          return (
            <div key={cat.title} className="space-y-1">
              {/* Category Header Button */}
              <button
                onClick={() => toggleSection(cat.title)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-[10px] transition-all text-left",
                  hasActiveChild && !isExpanded
                    ? "bg-blue-50 text-blue-700 font-bold border border-blue-100/50"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/60"
                )}
              >
                <div className="flex items-center gap-3">
                  <CategoryIcon className="w-4 h-4 flex-shrink-0" />
                  {(!collapsed || isMobile) && (
                    <span className="font-semibold text-xs tracking-tight">{cat.title}</span>
                  )}
                </div>
                {(!collapsed || isMobile) && (
                  <ChevronDown 
                    size={14} 
                    className={cn("text-slate-400 transition-transform", isExpanded && "rotate-180")} 
                  />
                )}
              </button>

              {/* Sub-items Render */}
              {isExpanded && (!collapsed || isMobile) && (
                <div className="pl-7 space-y-1 border-l border-slate-100 ml-5">
                  {cat.items.map((sub) => {
                    const isSubActive = location.pathname === sub.path && 
                      (!sub.state || Object.keys(sub.state).every(k => location.state?.[k] === sub.state[k]));
                    return (
                      <Link 
                        key={sub.label} 
                        to={sub.path} 
                        state={sub.state}
                        onClick={() => isMobile && setMobileOpen(false)}
                        className={cn(
                          "block py-1.5 px-2.5 rounded-lg text-[11px] font-medium transition-all",
                          isSubActive
                            ? "text-blue-700 bg-blue-50 font-bold"
                            : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="pt-2 mt-2 border-t border-slate-100 space-y-1 shrink-0">
        {(!collapsed || isMobile) && (
          <AcademicYearBadge />
        )}
        {can('settings.manage') && (
          <SidebarItem 
            icon={Settings} 
            label="System" 
            path="/dashboard/system/overview" 
            active={location.pathname.startsWith('/dashboard/system')} 
            collapsed={isMobile ? false : collapsed}
            onClick={() => isMobile && setMobileOpen(false)}
          />
        )}
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-[10px] transition-all"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {(!collapsed || isMobile) && <span className="font-semibold text-xs tracking-tight">Logout</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-700 font-sans">
      
      {/* 1. Desktop Sidebar (hidden on mobile/tablet) */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 240 }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        className="h-full bg-white border-r border-slate-200/60 hidden lg:flex flex-col p-3 relative z-40 overflow-hidden shadow-sm shrink-0"
      >
        {sidebarContent(false)}

        {/* Sidebar Collapse Button */}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="absolute bottom-10 right-0 translate-x-1/2 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center hover:bg-slate-50 transition-all text-slate-400 shadow-sm z-50"
        >
          {collapsed ? <ChevronRight size={12} /> : <BarChart3 size={12} className="rotate-90" />}
        </button>
      </motion.aside>

      {/* 2. Mobile Sidebar Overlay Drawer (Drawer + Backdrop) */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-slate-950 z-40 lg:hidden"
            />
            
            {/* Drawer Sidebar */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="fixed top-0 bottom-0 left-0 w-[280px] h-full bg-white flex flex-col p-5 z-50 shadow-2xl border-r border-slate-100 lg:hidden"
            >
              {sidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* 3. Main Content Container */}
      <main className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        
        {/* Top Header */}
        <header className="h-14 shrink-0 border-b border-slate-200/50 flex items-center justify-between px-3 sm:px-4 lg:px-5 relative z-30 bg-white/80 backdrop-blur-md">
          
          {/* Header Left (Hamburger on mobile, Search bar on desktop) */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {/* Hamburger Button */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>
 
            {/* Quick Title on Mobile, Search bar on Desktop */}
            <div className="hidden sm:flex items-center gap-3 group flex-1 max-w-xs md:max-w-sm relative">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-[#1a73e8] transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search records..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  className="bg-slate-50 border border-slate-200/60 rounded-full py-1.5 pl-9 pr-3 text-[11px] outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#1a73e8] transition-all w-full text-slate-800 placeholder:text-slate-400 font-medium"
                />
              </div>

              {/* Dynamic Global Search Overlay */}
              {isSearchFocused && (
                <div className="absolute top-[42px] left-0 right-0 bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden z-50 p-4 max-h-[350px] overflow-y-auto w-[350px]">
                  {searchQuery ? (
                    <div className="space-y-4">
                      {/* Students Results */}
                      {filteredSearch.students.length > 0 && (
                        <div>
                          <div className="text-[9px] font-black text-violet-600 uppercase tracking-widest mb-1.5 pl-1">Students</div>
                          <div className="space-y-1">
                            {filteredSearch.students.map(s => (
                              <button
                                key={s.id}
                                onClick={() => navigate('/dashboard/students', { state: { selectedStudentId: s.id } })}
                                className="w-full text-left p-2 rounded-xl hover:bg-slate-50 transition-all flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer"
                              >
                                <span>{s.name} <span className="text-[10px] text-slate-400 font-medium ml-1">({s.class})</span></span>
                                <span className="text-[9px] text-slate-400 font-mono">Roll: {s.roll_number || 'N/A'}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Employees Results */}
                      {filteredSearch.employees.length > 0 && (
                        <div>
                          <div className="text-[9px] font-black text-violet-600 uppercase tracking-widest mb-1.5 pl-1">Teachers & Staff</div>
                          <div className="space-y-1">
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
                          </div>
                        </div>
                      )}

                      {/* Exams Results */}
                      {filteredSearch.exams.length > 0 && (
                        <div>
                          <div className="text-[9px] font-black text-violet-600 uppercase tracking-widest mb-1.5 pl-1">Exams & Assessments</div>
                          <div className="space-y-1">
                            {filteredSearch.exams.map(ex => (
                              <button
                                key={ex.id}
                                onClick={() => navigate('/dashboard/examination?tab=exams', { state: { selectedExamId: ex.id } })}
                                className="w-full text-left p-2 rounded-xl hover:bg-slate-50 transition-all flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer"
                              >
                                <span>{ex.exam_name}</span>
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{ex.class}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {filteredSearch.students.length === 0 && filteredSearch.employees.length === 0 && filteredSearch.exams.length === 0 && (
                        <div className="text-center py-6 text-slate-400 text-xs font-medium">
                          No matching records found.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1">Quick Actions</div>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => navigate('/dashboard/examination?tab=marks')}
                          className="p-2.5 rounded-xl border border-slate-150 hover:border-violet-200 hover:bg-violet-50/20 text-left text-xs font-bold text-slate-700 flex items-center gap-2 transition-all cursor-pointer"
                        >
                          <ClipboardList size={14} className="text-violet-500" />
                          Marks Entry
                        </button>
                        <button 
                          onClick={() => navigate('/dashboard/attendance')}
                          className="p-2.5 rounded-xl border border-slate-150 hover:border-violet-200 hover:bg-violet-50/20 text-left text-xs font-bold text-slate-700 flex items-center gap-2 transition-all cursor-pointer"
                        >
                          <CalendarCheck size={14} className="text-indigo-500" />
                          Take Attendance
                        </button>
                        <button 
                          onClick={() => navigate('/dashboard/fees')}
                          className="p-2.5 rounded-xl border border-slate-150 hover:border-violet-200 hover:bg-violet-50/20 text-left text-xs font-bold text-slate-700 flex items-center gap-2 transition-all cursor-pointer"
                        >
                          <Wallet size={14} className="text-emerald-500" />
                          Collect Fees
                        </button>
                        <button 
                          onClick={() => navigate('/dashboard/admissions')}
                          className="p-2.5 rounded-xl border border-slate-150 hover:border-violet-200 hover:bg-violet-50/20 text-left text-xs font-bold text-slate-700 flex items-center gap-2 transition-all cursor-pointer"
                        >
                          <GraduationCap size={14} className="text-amber-500" />
                          New Admission
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
 
            {/* Compact Mobile Title */}
            <div className="sm:hidden flex items-center gap-1.5">
              <div className="bg-gradient-to-tr from-violet-600 to-indigo-600 p-1 rounded-md">
                <GraduationCap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-display font-black text-slate-900 text-[11px] tracking-tight uppercase leading-none">
                SJS
              </span>
            </div>
          </div>
 
          {/* Header Right (Notifications, User avatar, role info) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Notification Popover Button & Dropdown */}
            <div className="relative" ref={notificationsRef}>
              <button 
                onClick={() => setIsNotificationsOpen(prev => !prev)}
                aria-label="View notifications and circulars"
                aria-expanded={isNotificationsOpen}
                className="relative w-8 h-8 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all border border-slate-200/40 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <Bell className="w-3.5 h-3.5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white" />
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-10 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200/80 z-50 overflow-hidden"
                  >
                    <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Official Notices & Alerts</h4>
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => setUnreadCount(0)}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400 font-medium">
                          No recent notices or alerts at this time.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className="p-3 hover:bg-slate-50/80 transition-colors text-left group"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <h5 className="text-xs font-bold text-slate-800 group-hover:text-blue-700 transition-colors line-clamp-1">
                                {n.title}
                              </h5>
                              {n.publish_date && (
                                <span className="text-[9.5px] text-slate-400 font-mono shrink-0">
                                  {new Date(n.publish_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                </span>
                              )}
                            </div>
                            {n.content && (
                              <p className="text-[11px] text-slate-500 font-normal line-clamp-2 mt-1">
                                {n.content}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="p-2 bg-slate-50/50 border-t border-slate-100 text-center">
                      <Link
                        to="/dashboard/communication"
                        onClick={() => setIsNotificationsOpen(false)}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 block py-1"
                      >
                        Open Communication Center →
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Interactive User Avatar Menu */}
            <div className="relative pl-3 border-l border-slate-100" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(prev => !prev)}
                aria-label="User account menu"
                aria-expanded={isUserMenuOpen}
                className="flex items-center gap-2 cursor-pointer group focus:outline-none"
              >
                <div className="text-right hidden md:block">
                  <div className="text-xs font-semibold text-slate-800 tracking-tight uppercase leading-none group-hover:text-blue-700 transition-colors">
                    {user?.email?.split('@')[0] || 'GUEST USER'}
                  </div>
                  <div className="text-[8.5px] font-semibold text-violet-600 uppercase tracking-wider mt-0.5 leading-none">
                    {roleLabel}
                  </div>
                </div>
                {/*
                  Drawn locally from the user's initial. This used to request a
                  cartoon from api.dicebear.com with the signed-in user's email
                  address in the query string, sending every staff member's email
                  to a third party on every page load.
                */}
                <div
                  className="w-8 h-8 rounded-full border border-violet-100 shadow-2xs overflow-hidden shrink-0 bg-linear-to-br from-blue-500 to-violet-600 text-white flex items-center justify-center text-[11px] font-black uppercase select-none group-hover:ring-2 group-hover:ring-blue-500/20 transition-all"
                  aria-label="User avatar"
                >
                  {(user?.email?.trim()?.charAt(0) || 'U').toUpperCase()}
                </div>
              </button>

              <AnimatePresence>
                {isUserMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-11 w-52 bg-white rounded-2xl shadow-xl border border-slate-200/80 z-50 overflow-hidden py-1.5 text-xs font-semibold"
                  >
                    <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50/50">
                      <div className="font-bold text-slate-800 truncate">{user?.email}</div>
                      <div className="text-[10px] text-violet-600 font-extrabold uppercase mt-0.5">{roleLabel}</div>
                    </div>

                    {isStudentOrParent ? (
                      <Link
                        to="/dashboard/portal"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 transition-colors"
                      >
                        <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                        <span>My Student Portal</span>
                      </Link>
                    ) : (
                      <Link
                        to="/dashboard"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 transition-colors"
                      >
                        <LayoutDashboard className="w-3.5 h-3.5 text-blue-600" />
                        <span>Executive Dashboard</span>
                      </Link>
                    )}

                    {can('settings.manage') && (
                      <Link
                        to="/dashboard/system/settings"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5 text-slate-500" />
                        <span>School Settings</span>
                      </Link>
                    )}

                    <div className="border-t border-slate-100 my-1" />

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-rose-50 flex items-center gap-2 text-rose-600 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-600" />
                      <span>Sign Out</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>
 
        {/* Scrollable Viewport (Responsive Padding) */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 lg:p-5 relative custom-scrollbar bg-[#F8FAFC]">
          <Breadcrumbs categories={filteredCategories} pathname={location.pathname} />
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Google Gemini AI Bot Floating Assistant */}
        <GoogleAIBot />
      </main>
    </div>
  );
}

/**
 * The academic year the dashboard is looking at.
 *
 * This used to be the literal string 2026-27 in the markup, so the
 * sidebar told every user the school was in 2026-27 whatever the
 * database said, and it would have gone on saying so into 2027.
 */
function AcademicYearBadge() {
  const { selectedYear, isLoading, isViewingHistory } = useAcademicYear();

  return (
    <div className={cn(
      'mb-2 mx-1 p-2 border rounded-[10px]',
      isViewingHistory
        ? 'bg-amber-50 border-amber-200'
        : 'bg-gradient-to-br from-[#1a73e8]/5 to-[#061f3d]/10 border-[#1a73e8]/15'
    )}>
      <div className={cn(
        'text-[9px] font-black uppercase tracking-widest',
        isViewingHistory ? 'text-amber-700' : 'text-[#1a73e8]'
      )}>
        {isViewingHistory ? 'Viewing' : 'Academic Year'}
      </div>
      <div className="text-xs font-bold text-slate-800 mt-0.5">
        {isLoading ? 'Loading…' : selectedYear?.name ?? 'Not configured'}
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AcademicYearProvider>
      <DashboardShell>{children}</DashboardShell>
    </AcademicYearProvider>
  );
}
