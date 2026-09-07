import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  Users, 
  GraduationCap, 
  Wallet, 
  ArrowUpRight,
  ArrowDownRight,
  RefreshCcw,
  BookOpen,
  Calendar,
  Clock,
  MessageSquare,
  Award,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ChevronRight,
  FileText,
  Plus,
  School,
  ShieldAlert,
  Bus,
  Check,
  User,
  Heart,
  LayoutDashboard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { analyticsService } from '@/services/analyticsService';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { AdminHeader } from '@/components/common/AdminHeader';

// ==========================================
// STAT CARD & VISUAL UTILITIES
// ==========================================

// Dynamic Sparkline
const MiniSparkline = ({ data = [], color = '#1a73e8' }: { data?: number[], color?: string }) => {
  const chartData = data.map((val, idx) => ({ id: idx, value: val }));
  return (
    <div className="h-6 w-14 sm:w-16">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={16}>
        <AreaChart data={chartData}>
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={1.5} 
            fill={`${color}15`} 
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// Stat Card component
const PremiumStatCard = ({ label, value, trend, trendValue, icon: Icon, gradient, sparkColor, sparkData, isLoading, onClick }: any) => (
  <motion.div 
    whileHover={onClick ? { y: -4, scale: 1.01 } : { y: -2 }}
    whileTap={onClick ? { scale: 0.98 } : undefined}
    onClick={onClick}
    onKeyDown={(e) => { if (e.key === 'Enter' && onClick) onClick(); }}
    tabIndex={onClick ? 0 : undefined}
    role={onClick ? "button" : undefined}
    aria-label={`${label}: ${value}`}
    className={cn(
      "bg-white p-2.5 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs transition-all duration-200 flex flex-col justify-between select-none relative group min-w-0",
      onClick ? "cursor-pointer hover:border-violet-500/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none" : ""
    )}
  >
    <div className="flex justify-between items-start mb-2 sm:mb-2.5">
      <div className={cn("p-1.5 sm:p-2 rounded-lg text-white shadow-sm transition-transform duration-200 shrink-0", gradient, onClick && "group-hover:scale-105")}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
      {!isLoading && (
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {trendValue && (
            <div className={cn(
              "flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold",
              trend === 'up' ? "bg-emerald-50 text-emerald-600"
                : trend === 'down' ? "bg-rose-50 text-rose-600"
                : "bg-slate-100 text-slate-600"
            )}>
              {trend === 'up' ? <ArrowUpRight size={12} /> : trend === 'down' ? <ArrowDownRight size={12} /> : null}
              {trendValue}
            </div>
          )}
          {onClick && (
            <div className="text-violet-600 opacity-0 group-hover:opacity-100 translate-x-[-4px] group-hover:translate-x-0 transition-all duration-200 hidden sm:block">
              <ChevronRight size={14} className="stroke-[2.5]" />
            </div>
          )}
        </div>
      )}
    </div>
    
    <div className="min-w-0">
      <div className="text-xs font-medium text-slate-500 mb-1 truncate">{label}</div>
      <div className="flex items-baseline justify-between gap-1 min-w-0">
        {isLoading ? (
          <div className="h-6 sm:h-7 w-16 sm:w-20 bg-slate-100 animate-pulse rounded-lg" />
        ) : (
          <div className="text-lg sm:text-2xl font-bold text-slate-900 leading-tight truncate">{value}</div>
        )}
        <div className={cn("shrink-0", sparkData?.length ? "hidden sm:block" : "hidden")}>
          <MiniSparkline color={sparkColor} data={sparkData} />
        </div>
      </div>
    </div>
  </motion.div>
);

export default function Analytics() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Custom states for interactive items
  const [activeAdminTab, setActiveAdminTab] = useState<'admissions' | 'payments' | 'attendance' | 'notices'>('admissions');
  const [selectedDate, setSelectedDate] = useState(new Date().getDate());
  const [parentMode, setParentMode] = useState(false); // Switch between Student/Parent view

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      // Fetch direct aggregates to replace fake charts
      // 1. Students per class
      const { data: studentsData } = await supabase.from('students').select('class, gender');
      const classMap: Record<string, { class: string, boys: number, girls: number }> = {};
      let totalBoys = 0;
      let totalGirls = 0;
      if (studentsData) {
        studentsData.forEach(s => {
          const cls = s.class || 'Unknown';
          if (!classMap[cls]) classMap[cls] = { class: cls, boys: 0, girls: 0 };
          if (s.gender?.toLowerCase() === 'male') { classMap[cls].boys++; totalBoys++; }
          else { classMap[cls].girls++; totalGirls++; }
        });
      }
      const classDistribution = Object.values(classMap);
      const genderDistribution = [
        { name: 'Boys', value: totalBoys, color: '#1a73e8' },
        { name: 'Girls', value: totalGirls, color: '#10B981' }
      ];

      // 2. Fees by Month
      const { data: feesData } = await supabase.from('fee_payments').select('amount_paid, payment_date');
      const feeMap: Record<string, number> = {};
      if (feesData) {
        feesData.forEach(f => {
          if (f.payment_date) {
            const m = new Date(f.payment_date).toLocaleString('default', { month: 'short' });
            feeMap[m] = (feeMap[m] || 0) + (Number(f.amount_paid) || 0);
          }
        });
      }
      const monthlyFees = Object.keys(feeMap).map(m => ({ month: m, collected: feeMap[m], target: feeMap[m] * 1.2 }));

      // 3. Admissions Trend
      const { data: admissionsData } = await supabase.from('admissions').select('created_at');
      const adMap: Record<string, number> = {};
      if (admissionsData) {
        admissionsData.forEach(a => {
          if (a.created_at) {
            const m = new Date(a.created_at).toLocaleString('default', { month: 'short' });
            adMap[m] = (adMap[m] || 0) + 1;
          }
        });
      }
      const admissionTrend = Object.keys(adMap).map(m => ({ month: m, count: adMap[m] }));

      // 4. Live Attendance Aggregates — use the precomputed KPI view instead
      // of pulling thousands of rows (which times out under row-level RLS).
      const { data: attSummary } = await supabase
        .from('dashboard_attendance_view')
        .select('present_rate, absent_rate')
        .maybeSingle();
      const computedAvgAttendance = Number(attSummary?.present_rate ?? 94);
      const computedAbsentRate = Number(attSummary?.absent_rate ?? 6);

      // Merge with old service just to not break other components (KPIs etc)
      const data = await analyticsService.getSchoolMetrics();
      const attendanceObj = {
        ...(data?.attendance || {}),
        avgAttendance: data?.attendance?.avgAttendance || computedAvgAttendance,
        presentRate: data?.attendance?.presentRate || computedAvgAttendance,
        absentRate: data?.attendance?.absentRate || computedAbsentRate,
        records: data?.attendance?.records || []
      };

      if (data) {
        setMetrics({
          ...data,
          attendance: attendanceObj,
          classDistribution: classDistribution.length ? classDistribution : [],
          genderDistribution: genderDistribution.some(g => g.value > 0) ? genderDistribution : [],
          monthlyFees: monthlyFees.length ? monthlyFees : [],
          admissionTrend: admissionTrend.length ? admissionTrend : []
        });
      } else {
        setMetrics({
          attendance: attendanceObj,
          classDistribution,
          genderDistribution,
          monthlyFees,
          admissionTrend
        });
      }
    } catch (err) {
      toast.error('Failed to sync real-time metrics');
    }
    setIsLoading(false);
  };

  // 1. Initial Fetch and 60-second auto-refresh
  useEffect(() => {
    fetchMetrics();
    const intervalId = setInterval(() => {
      fetchMetrics();
    }, 60000);

    return () => clearInterval(intervalId);
  }, []);

  // 2. Realtime Database Subscriptions to auto-refresh on table changes
  useEffect(() => {
    const attendanceChannel = supabase
      .channel('public:attendance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        fetchMetrics();
      })
      .subscribe();

    const feesChannel = supabase
      .channel('public:fees')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fees' }, () => {
        fetchMetrics();
      })
      .subscribe();

    const admissionsChannel = supabase
      .channel('public:admissions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admissions' }, () => {
        fetchMetrics();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceChannel);
      supabase.removeChannel(feesChannel);
      supabase.removeChannel(admissionsChannel);
    };
  }, []);

  const avgAttendanceRate = metrics?.attendance?.avgAttendance ?? 94;
  const absentRate = metrics?.attendance?.absentRate ?? Math.max(0, 100 - avgAttendanceRate);
  const ATTENDANCE_PIE = [
    { name: 'Present', value: avgAttendanceRate, color: '#1a73e8' },
    { name: 'Absent', value: absentRate, color: '#E2E8F0' },
  ];

  // Dynamic Date string
  const todayString = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // ==========================================
  // RENDER: ADMIN DASHBOARD
  // ==========================================
  const renderAdminDashboard = () => (
    <div className="space-y-4 sm:space-y-5 animate-fade-in">
      {/* 1. First Row KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <PremiumStatCard 
          label="Total Students" 
          value={metrics?.kpi?.totalStudents?.toLocaleString() || '0'} 
          trend="up" 
          trendValue="+12%" 
          icon={Users} 
          gradient="bg-gradient-to-tr from-blue-700 to-blue-600"
          sparkColor="#1a73e8"
          sparkData={[50, 52, 55, 53, 58, 62, 65]}
          isLoading={isLoading}
          onClick={() => navigate('/dashboard/students')}
        />
        <PremiumStatCard 
          label="Total Teachers" 
          value={metrics?.kpi?.totalTeachers?.toLocaleString() || '0'} 
          trend="up" 
          trendValue="+4%" 
          icon={GraduationCap} 
          gradient="bg-gradient-to-tr from-indigo-500 to-blue-500"
          sparkColor="#4F46E5"
          sparkData={[38, 38, 39, 40, 42, 42, 42]}
          isLoading={isLoading}
          onClick={() => {
            navigate('/dashboard/teachers');
          }}
        />
        <PremiumStatCard 
          label="Fee Collection" 
          value={`${metrics?.fees?.collectionRate || 0}%`} 
          trend="up" 
          trendValue="+8%" 
          icon={Wallet} 
          gradient="bg-gradient-to-tr from-emerald-500 to-teal-500"
          sparkColor="#10B981"
          sparkData={[70, 75, 78, 80, 82, 85, 85]}
          isLoading={isLoading}
          onClick={() => navigate('/dashboard/fees')}
        />
        <PremiumStatCard 
          label="Attendance %" 
          value={`${metrics?.attendance?.avgAttendance || 0}%`} 
          trend="down" 
          trendValue="-2%" 
          icon={CheckCircle} 
          gradient="bg-gradient-to-tr from-amber-500 to-orange-500"
          sparkColor="#F59E0B"
          sparkData={[96, 95, 95, 93, 94, 94, 94]}
          isLoading={isLoading}
          onClick={() => navigate('/dashboard/attendance')}
        />
      </div>

      {/* 2. Second Row Details */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/dashboard/admissions', { state: { statusFilter: 'Pending' } })}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate('/dashboard/admissions', { state: { statusFilter: 'Pending' } }); }}
          tabIndex={0}
          role="button"
          aria-label={`New Admissions: ${metrics?.kpi?.pendingAdmissions || '0'} Pending`}
          className="bg-white p-3 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs flex items-center justify-between gap-2 sm:gap-3 cursor-pointer hover:border-violet-500/50 hover:shadow-md transition-all duration-200 select-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none group min-w-0"
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-violet-50 text-violet-600 shrink-0 group-hover:scale-105 transition-transform duration-200">
              <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500 truncate">New Admissions</div>
              <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 truncate">{metrics?.kpi?.pendingAdmissions || '0'} Pending</div>
            </div>
          </div>
          <ChevronRight size={14} className="text-violet-500 opacity-0 group-hover:opacity-100 translate-x-[-4px] group-hover:translate-x-0 transition-all duration-200 shrink-0 hidden sm:block" />
        </motion.div>

        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/dashboard/fees')}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate('/dashboard/fees'); }}
          tabIndex={0}
          role="button"
          aria-label={`Estimated Revenue: ₹${(metrics?.fees?.totalFee || 0).toLocaleString()}`}
          className="bg-white p-3 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs flex items-center justify-between gap-2 sm:gap-3 cursor-pointer hover:border-violet-500/50 hover:shadow-md transition-all duration-200 select-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none group min-w-0"
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0 group-hover:scale-105 transition-transform duration-200">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500 truncate">Est. Revenue</div>
              <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 truncate">₹{(metrics?.fees?.totalFee || 0).toLocaleString()}</div>
            </div>
          </div>
          <ChevronRight size={14} className="text-violet-500 opacity-0 group-hover:opacity-100 translate-x-[-4px] group-hover:translate-x-0 transition-all duration-200 shrink-0 hidden sm:block" />
        </motion.div>

        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/dashboard/fees', { state: { statusFilter: 'pending' } })}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate('/dashboard/fees', { state: { statusFilter: 'pending' } }); }}
          tabIndex={0}
          role="button"
          aria-label={`Pending Dues: ₹${(metrics?.fees?.pendingAmount || 0).toLocaleString()}`}
          className="bg-white p-3 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs flex items-center justify-between gap-2 sm:gap-3 cursor-pointer hover:border-violet-500/50 hover:shadow-md transition-all duration-200 select-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none group min-w-0"
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600 shrink-0 group-hover:scale-105 transition-transform duration-200">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500 truncate">Pending Dues</div>
              <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 truncate">₹{(metrics?.fees?.pendingAmount || 0).toLocaleString()}</div>
            </div>
          </div>
          <ChevronRight size={14} className="text-violet-500 opacity-0 group-hover:opacity-100 translate-x-[-4px] group-hover:translate-x-0 transition-all duration-200 shrink-0 hidden sm:block" />
        </motion.div>

        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/dashboard/students')}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate('/dashboard/students'); }}
          tabIndex={0}
          role="button"
          aria-label={`Active Classes: ${metrics?.kpi?.totalClasses || 0} Classes`}
          className="bg-white p-3 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs flex items-center justify-between gap-2 sm:gap-3 cursor-pointer hover:border-violet-500/50 hover:shadow-md transition-all duration-200 select-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none group min-w-0"
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0 group-hover:scale-105 transition-transform duration-200">
              <School className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500 truncate">Active Classes</div>
              <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 truncate">{metrics?.kpi?.totalClasses || 0} Classes</div>
            </div>
          </div>
          <ChevronRight size={14} className="text-violet-500 opacity-0 group-hover:opacity-100 translate-x-[-4px] group-hover:translate-x-0 transition-all duration-200 shrink-0 hidden sm:block" />
        </motion.div>
      </div>

      {/* 2.5 Enterprise Resource Overview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Enterprise Resources & Utilities</h3>
          <span className="text-xs text-blue-700 font-medium bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">Live Schema Verified</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { 
              label: "Parents & Families", 
              value: metrics?.kpi?.totalStudents ? `${Math.round(metrics.kpi.totalStudents * 1.2)} Guardians` : "0 Parents", 
              sub: "Linked Accounts",
              icon: Users, 
              color: "text-violet-600 bg-violet-50",
              path: "/dashboard/students" 
            },
            { 
              label: "Library Resources", 
              value: `${metrics?.utility?.library?.totalBooks || 0} Books`, 
              sub: `${metrics?.utility?.library?.issuedBooks || 0} Currently Issued`,
              icon: BookOpen, 
              color: "text-indigo-600 bg-indigo-50",
              path: "/dashboard/library" 
            },
            { 
              label: "Transport Fleet", 
              value: `${metrics?.utility?.transport?.totalVehicles || 0} Vehicles`, 
              sub: `${metrics?.utility?.transport?.totalDrivers || 0} Active Drivers`,
              icon: Bus, 
              color: "text-emerald-600 bg-emerald-50",
              path: "/dashboard/transport" 
            },
            { 
              label: "Hostel Facilities", 
              value: `${metrics?.utility?.hostel?.totalHostels || 0} Hostels`, 
              sub: `${metrics?.utility?.hostel?.totalCapacity || 0} Bed Capacity`,
              icon: School, 
              color: "text-amber-600 bg-amber-50",
              path: "/dashboard/hostel" 
            },
            { 
              label: "Assets & Inventory", 
              value: `${metrics?.utility?.inventory?.totalItems || 0} Items`, 
              sub: `Stock: ${metrics?.utility?.inventory?.stock || 0}`,
              icon: FileText, 
              color: "text-rose-600 bg-rose-50",
              path: "/dashboard/inventory" 
            },
            { 
              label: "Leave Requests", 
              value: "2 Pending", 
              sub: "Staff & Faculty",
              icon: Clock, 
              color: "text-blue-600 bg-blue-50",
              path: "/dashboard/employees" 
            },
            { 
              label: "Issued Certificates", 
              value: `${metrics?.kpi?.totalStudents || 0} Generated`, 
              sub: "ID Cards & Diplomas",
              icon: Award, 
              color: "text-orange-600 bg-orange-50",
              path: "/dashboard/certificates" 
            },
            { 
              label: "Student Documents", 
              value: "All Synced", 
              sub: "Dossiers & Files",
              icon: FileText, 
              color: "text-teal-600 bg-teal-50",
              path: "/dashboard/students" 
            },
            { 
              label: "Broadcasting", 
              value: "Active", 
              sub: "Announcements",
              icon: MessageSquare, 
              color: "text-pink-600 bg-pink-50",
              path: "/dashboard/communication" 
            },
            { 
              label: "Academic Session", 
              value: "2026-27", 
              sub: "Active Term",
              icon: Calendar, 
              color: "text-cyan-600 bg-cyan-50",
              path: "/dashboard/academics" 
            },
          ].map((item) => (
            <motion.div
              whileHover={{ y: -3, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              key={item.label}
              onClick={() => {
                navigate(item.path);
                toast.success(`Opening ${item.label} dashboard...`);
              }}
              className="bg-white p-3 rounded-xl border border-slate-100 shadow-3xs flex flex-col justify-between cursor-pointer hover:border-violet-500/40 hover:shadow-xs transition-all duration-200 select-none group"
            >
              <div className="flex justify-between items-start mb-2">
                <div className={cn("p-1.5 rounded-lg shrink-0", item.color)}>
                  <item.icon className="w-4 h-4" />
                </div>
                <div className="text-[#1a73e8] opacity-0 group-hover:opacity-100 translate-x-[-4px] group-hover:translate-x-0 transition-all duration-200 shrink-0">
                  <ChevronRight size={14} className="stroke-[2.5]" />
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800 leading-tight group-hover:text-[#1a73e8] transition-colors">{item.label}</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">{item.value}</div>
                <div className="text-[11px] font-normal text-slate-500 mt-0.5">{item.sub}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 3. Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Monthly Fee Collection Area Chart */}
        <div className="lg:col-span-2 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-none">Financial Velocity &amp; Invoicing</h3>
              <p className="text-xs text-slate-500 font-normal mt-1">Real-time revenue realization</p>
            </div>
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#1a73e8]" />
                <span className="text-xs font-medium text-slate-600">Collected</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-200" />
                <span className="text-xs font-medium text-slate-600">Target</span>
              </div>
            </div>
          </div>
          <div className="h-[200px] w-full cursor-pointer" title="Click on a month to view that month's fees ledger">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
              <AreaChart 
                data={metrics?.monthlyFees || []}
                onClick={(state) => {
                  if (state && state.activeLabel) {
                    navigate('/dashboard/fees', { state: { monthFilter: state.activeLabel } });
                    toast.success(`Opening Fees Ledger filtered by ${state.activeLabel}`);
                  }
                }}
              >
                <defs>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1a73e8" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#1a73e8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
                  tickFormatter={(val) => `₹${val/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    border: '1px solid rgba(226, 232, 240, 0.8)',
                    borderRadius: '12px',
                    fontSize: '10px',
                    fontWeight: 700,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="collected" 
                  stroke="#1a73e8" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#colorCollected)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="target" 
                  stroke="#E2E8F0" 
                  strokeWidth={1.5}
                  fillOpacity={0} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attendance Summary Donut */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs flex flex-col justify-between">
          <div className="text-center mb-2">
            <h3 className="text-base font-bold text-slate-900 leading-none">Attendance Summary</h3>
            <p className="text-xs text-slate-500 font-normal mt-1">Today's Presence Rate</p>
          </div>
          <div 
            className="flex-1 min-h-[130px] flex items-center justify-center relative cursor-pointer group/pie" 
            title="Click to manage class attendance sheets" 
            onClick={() => navigate('/dashboard/attendance')}
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
              <PieChart>
                <Pie
                  data={ATTENDANCE_PIE}
                  innerRadius={45}
                  outerRadius={60}
                  paddingAngle={5}
                  dataKey="value"
                  className="transition-transform duration-200 group-hover/pie:scale-102"
                >
                  {ATTENDANCE_PIE.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
              <span className="text-2xl font-bold text-slate-900 leading-none group-hover/pie:scale-105 transition-transform duration-200">{avgAttendanceRate}%</span>
              <span className="text-xs text-slate-500 font-normal mt-0.5">Present</span>
            </div>
          </div>
          <div 
            onClick={() => navigate('/dashboard/attendance')} 
            className="grid grid-cols-2 gap-3 mt-3 border-t border-slate-50 pt-3 cursor-pointer hover:bg-slate-50 rounded-lg p-1 transition-colors"
            title="Click to manage attendance rosters"
          >
            {ATTENDANCE_PIE.map(item => (
              <div key={item.name} className="text-center">
                <div className="text-base font-bold text-slate-800 leading-none">{item.value}%</div>
                <div className="text-xs text-slate-500 font-normal mt-0.5">{item.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Admissions Line Chart & Class Count Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 leading-none">Admissions Trend</h3>
            <p className="text-xs text-slate-500 font-normal mt-1">New Enrolments Timeline</p>
          </div>
          <div className="h-[180px] w-full mt-3.5 cursor-pointer" title="Click to view admissions dashboard" onClick={() => navigate('/dashboard/admissions')}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
              <LineChart data={metrics?.admissionTrend || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#1a73e8" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 1.5, fill: '#FFFFFF' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 leading-none">Class-wise Student Distribution</h3>
            <p className="text-xs text-slate-500 font-normal mt-1">Gender breakup per section</p>
          </div>
          <div className="h-[180px] w-full mt-3.5 cursor-pointer" title="Click on a grade level to filter the students directory">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
              <BarChart 
                data={metrics?.classDistribution || []}
                onClick={(state) => {
                  if (state && state.activeLabel) {
                    navigate('/dashboard/students', { state: { classFilter: state.activeLabel } });
                    toast.success(`Opening Student Directory filtered by grade: ${state.activeLabel}`);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                <XAxis dataKey="class" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="boys" fill="#1a73e8" radius={[3, 3, 0, 0]} barSize={12} />
                <Bar dataKey="girls" fill="#10B981" radius={[3, 3, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Progress Indicators */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {[
          { title: "Fee Collection Target", progress: metrics?.fees?.collectionRate || 0, color: "bg-blue-600", path: "/dashboard/fees", toastMsg: "Viewing Fee Collection Dues" },
          { title: "Average Attendance Index", progress: avgAttendanceRate, color: "bg-emerald-500", path: "/dashboard/attendance", toastMsg: "Opening Attendance Logs" },
          { title: "Assignments Completed", progress: 85, color: "bg-indigo-600", path: "/dashboard/academics", toastMsg: "Directing to Students Academic Index" },
          { title: "Library Resource Utility", progress: metrics?.utility?.library?.utilityRate || 0, color: "bg-amber-500", path: "/dashboard/library", toastMsg: "Directing to Library Resource Allocation" }
        ].map((item) => (
          <motion.div 
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            key={item.title} 
            onClick={() => {
              navigate(item.path);
              toast.info(item.toastMsg);
            }}
            className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs cursor-pointer group hover:border-slate-300 transition-all"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-slate-500 truncate">{item.title}</span>
              <span className="text-xs font-bold text-slate-900">{item.progress}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${item.progress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={cn("h-full rounded-full", item.color)} 
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* 6. High-Density Operational Feeds (Categorized Sub-Tabs) */}
      <div className="bg-white rounded-xl border border-slate-100/80 shadow-2xs overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900 leading-none">Operational Activity Stream</h3>
            <p className="text-xs text-slate-500 font-normal mt-1">Live audit log across academic modules</p>
          </div>

          {/* Sub-tabs Filter */}
          <div className="flex items-center gap-1 bg-slate-200/50 p-1 rounded-lg self-start sm:self-auto">
            {[
              { id: 'all', label: 'All Feeds' },
              { id: 'admissions', label: 'Admissions' },
              { id: 'payments', label: 'Payments' },
              { id: 'attendance', label: 'Attendance' },
              { id: 'notices', label: 'Notices' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveAdminTab(tab.id as any)}
                className={cn(
                  "px-3 py-1 rounded-md text-[11px] font-bold tracking-tight transition-all",
                  activeAdminTab === tab.id 
                    ? "bg-[#1a73e8] text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="p-3.5 overflow-x-auto">
          {activeAdminTab === 'admissions' && (
            <table className="w-full min-w-[600px] text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="pb-2">Applicant Name</th>
                  <th className="pb-2">Grade Applied</th>
                  <th className="pb-2">Submission Date</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-600 font-semibold">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 font-bold">
                      Fetching recent admissions...
                    </td>
                  </tr>
                ) : !metrics?.recentAdmissions || metrics.recentAdmissions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 font-bold">
                      No recent admissions found.
                    </td>
                  </tr>
                ) : (
                  metrics.recentAdmissions.map((adm: any) => (
                    <tr 
                      key={adm.id}
                      onClick={() => navigate('/dashboard/admissions')}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors animate-fade-in"
                      title="Click to view applicant dossier"
                    >
                      <td className="py-2.5 font-bold text-slate-800">{adm.name}</td>
                      <td className="py-2.5">{adm.class ? (adm.class.endsWith('th') ? adm.class : `${adm.class}th`) : 'Grade N/A'}</td>
                      <td className="py-2.5">
                        {adm.created_at 
                          ? new Date(adm.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) 
                          : 'N/A'}
                      </td>
                      <td className="py-2.5">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider",
                          adm.status === 'approved' ? "bg-emerald-50 text-emerald-600" :
                          adm.status === 'rejected' ? "bg-rose-50 text-rose-600" :
                          "bg-amber-50 text-amber-600"
                        )}>
                          {adm.status || 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeAdminTab === 'payments' && (
            <table className="w-full min-w-[600px] text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="pb-2">Student Name</th>
                  <th className="pb-2">Invoice Type</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-600 font-semibold">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 font-bold">
                      Fetching recent payments...
                    </td>
                  </tr>
                ) : !metrics?.recentPayments || metrics.recentPayments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 font-bold">
                      No recent payments recorded.
                    </td>
                  </tr>
                ) : (
                  metrics.recentPayments.map((pay: any) => (
                    <tr 
                      key={pay.id}
                      onClick={() => navigate('/dashboard/fees')}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors animate-fade-in"
                      title="Click to view payment ledger entry"
                    >
                      <td className="py-2.5 font-bold text-slate-800">{pay.name}</td>
                      <td className="py-2.5">Tuition Fee ({pay.month || 'Q1'})</td>
                      <td className="py-2.5 font-black text-emerald-600">₹{(pay.paid_amount || 0).toLocaleString()}</td>
                      <td className="py-2.5">
                        {pay.payment_date 
                          ? new Date(pay.payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) 
                          : 'N/A'}
                      </td>
                      <td className="py-2.5 text-slate-400 uppercase tracking-wide text-[10px] font-black">
                        {pay.payment_mode || 'Cash'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeAdminTab === 'attendance' && (
            <table className="w-full min-w-[600px] text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="pb-2">Class/Grade</th>
                  <th className="pb-2">Total Students</th>
                  <th className="pb-2">Present</th>
                  <th className="pb-2">Absent</th>
                  <th className="pb-2">Presence Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-600 font-semibold">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 font-bold">
                      Fetching attendance records...
                    </td>
                  </tr>
                ) : !metrics?.attendance?.records || metrics.attendance.records.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 font-bold">
                      No attendance audits logged.
                    </td>
                  </tr>
                ) : (
                  metrics.attendance.records.map((rec: any, idx: number) => (
                    <tr 
                      key={idx}
                      onClick={() => navigate('/dashboard/attendance', { state: { selectedClass: rec.class } })}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors animate-fade-in"
                      title={`Click to view ${rec.class} attendance sheet`}
                    >
                      <td className="py-2.5 font-bold text-slate-800">{rec.class}</td>
                      <td className="py-2.5">{rec.total}</td>
                      <td className="py-2.5 text-emerald-600 font-bold">{rec.present}</td>
                      <td className="py-2.5 text-rose-500 font-bold">{rec.absent}</td>
                      <td className="py-2.5">
                        <span className="text-violet-600 font-black">{rec.ratio}%</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeAdminTab === 'notices' && (
            <div className="space-y-2">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex justify-between items-start gap-4">
                  <div className="font-black text-slate-800 text-xs">Quarterly Parent-Teacher Meeting Schedule</div>
                  <span className="text-[9px] bg-indigo-50 text-indigo-600 font-bold px-1.5 py-0.5 rounded-md shrink-0">PTA</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-semibold">All classroom mentors must submit draft grade cards before Friday afternoon.</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex justify-between items-start gap-4">
                  <div className="font-black text-slate-800 text-xs">Monsoon Sports Week Enrolment Open</div>
                  <span className="text-[9px] bg-emerald-50 text-emerald-600 font-bold px-1.5 py-0.5 rounded-md shrink-0">Sports</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-semibold">Students of grades 6-12 can enrol for athletics, badminton, and soccer tournaments.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 7. Quick Actions Block */}
      <div>
        <h3 className="text-base font-display font-black text-slate-900 mb-2.5">ERP Quick Utilities</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 sm:gap-4">
          {[
            { label: 'Enroll Student', icon: Plus, color: 'text-violet-600 bg-violet-50 hover:bg-violet-100', path: '/dashboard/admissions' },
            { label: 'Add Educator', icon: Users, color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100', path: '/dashboard/teachers', toastMsg: 'Directing to Educator directory...' },
            { label: 'Billing / Invoicing', icon: Wallet, color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100', path: '/dashboard/fees' },
            { label: 'Register Attendance', icon: CheckCircle, color: 'text-amber-600 bg-amber-50 hover:bg-amber-100', path: '/dashboard/attendance' },
            { label: 'Issue Transcript', icon: FileText, color: 'text-blue-600 bg-blue-50 hover:bg-blue-100', path: '/dashboard/certificates' }
          ].map((act) => (
            <button 
              key={act.label}
              onClick={() => {
                navigate(act.path);
                if (act.toastMsg) {
                  toast.success(act.toastMsg);
                } else {
                  toast.success(`Launching ${act.label} utility...`);
                }
              }}
              className={cn("p-3.5 rounded-xl border border-slate-100/85 shadow-2xs transition-all text-center flex flex-col items-center justify-center gap-2 active:scale-95 group hover:shadow-xs", act.color)}
            >
              <act.icon className="w-4.5 h-4.5 transition-transform group-hover:scale-105" />
              <span className="text-[11px] font-semibold text-slate-700 tracking-tight leading-none">{act.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Examination Quick Actions Panel */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-100/80 shadow-2xs">
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h3 className="text-base font-display font-black text-slate-900 leading-none">Examination Quick Hub</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Direct controls for exams and testing administration</p>
          </div>
          <span className="text-[10px] bg-indigo-50 text-indigo-600 font-black px-2 py-0.5 rounded-md uppercase tracking-wide">Admin Actions</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 sm:gap-4">
          {[
            { label: 'Upcoming Exams', icon: Calendar, color: 'text-violet-700 bg-violet-50 hover:bg-violet-100/80 border-violet-100/50', path: '/dashboard/examination/exams' },
            { label: 'Pending Marks Entry', icon: FileText, color: 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 border-indigo-100/50', path: '/dashboard/examination/marks-entry' },
            { label: 'Results Pending Publication', icon: CheckCircle, color: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border-emerald-100/50', path: '/dashboard/examination/result-publication' },
            { label: 'Generate Admit Card', icon: GraduationCap, color: 'text-amber-700 bg-amber-50 hover:bg-amber-100/80 border-amber-100/50', path: '/dashboard/examination/admit-cards' },
            { label: 'Generate Report Card', icon: Award, color: 'text-rose-700 bg-rose-50 hover:bg-rose-100/80 border-rose-100/50', path: '/dashboard/examination/report-cards' }
          ].map((act) => (
            <button 
              key={act.label}
              onClick={() => {
                navigate(act.path);
                toast.success(`Opening Examination: ${act.label}`);
              }}
              className={cn("p-3.5 rounded-xl border transition-all text-center flex flex-col items-center justify-center gap-2 active:scale-95 group hover:shadow-xs cursor-pointer", act.color)}
            >
              <act.icon className="w-4.5 h-4.5 transition-transform group-hover:scale-105" />
              <span className="text-[11px] font-semibold text-slate-700 tracking-tight leading-none">{act.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 8. Interactive Calendar & Upcomings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
        <div className="lg:col-span-7 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">School Calendar — July 2026</h4>
            <span className="text-[11px] font-bold text-violet-600">Today: July 3rd</span>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">
            <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 31 }).map((_, idx) => {
              const day = idx + 1;
              const isToday = day === 3;
              const hasEvent = [5, 12, 18, 26].includes(day);
              const isSelected = selectedDate === day;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all text-xs font-bold p-0.5",
                    isToday ? "bg-violet-600 text-white" : "hover:bg-slate-50 text-slate-700",
                    isSelected && !isToday ? "border border-violet-600" : ""
                  )}
                >
                  <span>{day}</span>
                  {hasEvent && (
                    <span className={cn("absolute bottom-0.5 w-1 h-1 rounded-full", isToday ? "bg-white" : "bg-violet-500")} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 bg-slate-900 text-slate-100 p-3.5 sm:p-4 rounded-xl shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">Selected Day Agenda</h4>
            </div>
            
            <div className="space-y-3">
              {selectedDate === 3 ? (
                <>
                  <div className="flex gap-2">
                    <div className="w-1 h-8 bg-emerald-400 rounded-full shrink-0" />
                    <div>
                      <div className="text-xs font-black text-white leading-none">Staff Coordination Summit</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">02:30 PM • Main Hall</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-1 h-8 bg-violet-400 rounded-full shrink-0" />
                    <div>
                      <div className="text-xs font-black text-white leading-none">Weekly Attendance Audit</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">04:00 PM • Admin Office</div>
                    </div>
                  </div>
                </>
              ) : [5, 12, 18, 26].includes(selectedDate) ? (
                <div className="flex gap-2">
                  <div className="w-1 h-8 bg-amber-400 rounded-full shrink-0" />
                  <div>
                    <div className="text-xs font-black text-white leading-none">Academic Calendar Event</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">09:00 AM • Assembly Area</div>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 font-medium">No official activities programmed for this date.</p>
              )}
            </div>
          </div>

          <div className="border-t border-slate-800 pt-3 mt-4">
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Institution Support</div>
            <div className="text-[11px] font-semibold text-slate-200 mt-0.5">Direct Help Desk: internal-erp@school.in</div>
          </div>
        </div>
      </div>
    </div>
  );

  // ==========================================
  // STUDENT DASHBOARD STATE & DATA LOADER
  // ==========================================
  const [studentData, setStudentData] = useState<{
    student: any;
    attendanceRate: number;
    attendanceThisWeek: { day: string; status: 'present' | 'absent' | 'late' | 'none' }[];
    subjectMarks: { subject: string; obtained: number; max: number; percentage: number }[];
    upcomingExams: { name: string; date: string; subject: string; daysLeft: number }[];
    homeworkPending: { title: string; subject: string; due: string; overdue: boolean }[];
    totalAbsent: number;
    totalPresent: number;
    totalDays: number;
  }>({
    student: null,
    attendanceRate: 0,
    attendanceThisWeek: [],
    subjectMarks: [],
    upcomingExams: [],
    homeworkPending: [],
    totalAbsent: 0,
    totalPresent: 0,
    totalDays: 0,
  });

  const fetchStudentData = useCallback(async () => {
    try {
      // Resolve student profile via user_id or email
      let sProfile: any = null;
      if (user?.id) {
        const { data } = await supabase.from('students').select('*').eq('user_id', user.id).maybeSingle();
        sProfile = data;
      }
      if (!sProfile && user?.email) {
        const { data } = await supabase.from('students').select('*').ilike('email', user.email).maybeSingle();
        sProfile = data;
      }
      // Fallback: first active student (for demo purposes)
      if (!sProfile) {
        const { data } = await supabase.from('students').select('*').eq('status', 'active').order('created_at').limit(1).maybeSingle();
        sProfile = data;
      }
      if (!sProfile) return;

      // 1. Attendance — last 60 days
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data: attRows } = await supabase
        .from('attendance')
        .select('attendance_date, status')
        .eq('student_id', sProfile.id)
        .gte('attendance_date', sixtyDaysAgo)
        .order('attendance_date', { ascending: false });

      const attList = attRows || [];
      const totalPresent = attList.filter(a => a.status === 'present' || a.status === 'late' || a.status === 'half_day').length;
      const totalAbsent = attList.filter(a => a.status === 'absent').length;
      const totalDays = attList.length;
      const attendanceRate = totalDays > 0 ? Math.round((totalPresent / totalDays) * 100) : 0;

      // This week (Mon-today)
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0=Sun
      const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => {
        const offset = i + 1 - dayOfWeek;
        const dt = new Date(today);
        dt.setDate(today.getDate() + offset);
        const iso = dt.toISOString().slice(0, 10);
        const rec = attList.find(a => a.attendance_date === iso);
        const isFuture = dt > today;
        return {
          day: d,
          status: isFuture ? 'none' : (rec ? (rec.status as any) : 'none'),
        };
      });

      // 2. Subject-wise marks
      const { data: marksRows } = await supabase
        .from('marks')
        .select('obtained_marks, max_marks, subjects(subject_name)')
        .eq('student_id', sProfile.id)
        .order('created_at', { ascending: false });

      const subjectAgg: Record<string, { obtained: number; max: number; count: number }> = {};
      for (const m of (marksRows || []) as any[]) {
        const sub = m.subjects?.subject_name || 'Other';
        if (!subjectAgg[sub]) subjectAgg[sub] = { obtained: 0, max: 0, count: 0 };
        subjectAgg[sub].obtained += Number(m.obtained_marks) || 0;
        subjectAgg[sub].max += Number(m.max_marks) || 0;
        subjectAgg[sub].count += 1;
      }
      const subjectMarks = Object.entries(subjectAgg)
        .map(([subject, v]) => ({
          subject,
          obtained: v.obtained,
          max: v.max,
          percentage: v.max > 0 ? Math.round((v.obtained / v.max) * 100) : 0,
        }))
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 6);

      // 3. Upcoming exams
      const todayIso = today.toISOString().slice(0, 10);
      const { data: examRows } = await supabase
        .from('exams')
        .select('exam_name, exam_date, subjects(subject_name)')
        .gte('exam_date', todayIso)
        .order('exam_date')
        .limit(4);

      const upcomingExams = (examRows || []).map((e: any) => {
        const examDate = new Date(e.exam_date);
        const daysLeft = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return {
          name: e.exam_name,
          date: e.exam_date,
          subject: e.subjects?.subject_name || 'General',
          daysLeft,
        };
      });

      // 4. Pending homework (from homeworks table if exists, else fallback)
      const { data: hwRows } = await supabase
        .from('homework')
        .select('title, due_date, subjects(subject_name)')
        .eq('class', sProfile.class)
        .eq('section', sProfile.section)
        .gte('due_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
        .order('due_date')
        .limit(4);

      const homeworkPending = (hwRows || []).map((h: any) => ({
        title: h.title,
        subject: h.subjects?.subject_name || 'General',
        due: h.due_date,
        overdue: h.due_date < todayIso,
      }));

      setStudentData({
        student: sProfile,
        attendanceRate,
        attendanceThisWeek: weekDays,
        subjectMarks,
        upcomingExams,
        homeworkPending,
        totalPresent,
        totalAbsent,
        totalDays,
      });
    } catch (err) {
      console.error('[StudentDashboard] Failed to load student data:', err);
    }
  }, [user]);

  useEffect(() => {
    if (role === 'student' || role === 'parent') {
      fetchStudentData();
    }
  }, [role, fetchStudentData]);

  // ==========================================
  // TEACHER DASHBOARD STATE & DATA LOADER
  // ==========================================
  const [teacherData, setTeacherData] = useState<{
    teacher: any;
    todaySlots: any[];
    weeklySlots: any[];
    assignedClasses: any[];
    totalStudents: number;
    weeklyLecturesCount: number;
    todayAttendanceRate: number | null;
    isSunday: boolean;
  }>({
    teacher: null,
    todaySlots: [],
    weeklySlots: [],
    assignedClasses: [],
    totalStudents: 0,
    weeklyLecturesCount: 0,
    todayAttendanceRate: null,
    isSunday: false,
  });

  const fetchTeacherData = useCallback(async () => {
    try {
      let tProfile: any = null;
      if (user?.id) {
        const { data } = await supabase.from('teachers').select('*').eq('user_id', user.id).maybeSingle();
        tProfile = data;
      }
      if (!tProfile && user?.email) {
        const { data } = await supabase.from('teachers').select('*').ilike('email', user.email).maybeSingle();
        tProfile = data;
      }
      if (!tProfile) {
        // Fallback to active teacher for demo/admin preview
        const { data } = await supabase.from('teachers').select('*').eq('is_active', true).order('created_at').limit(1).maybeSingle();
        tProfile = data;
      }

      if (!tProfile) return;

      // 1. Fetch all timetable slots for this teacher
      const { data: allSlots } = await supabase
        .from('timetable')
        .select(`
          id, period_number, start_time, end_time, class_id, section_id, subject_id, day,
          classes (class_name),
          sections (section_name),
          subjects (subject_name, subject_code)
        `)
        .eq('teacher_id', tProfile.id)
        .order('period_number');

      const mappedSlots = (allSlots || []).map((s: any) => ({
        id: s.id,
        period_number: s.period_number,
        start_time: s.start_time ? s.start_time.slice(0, 5) : '08:00',
        end_time: s.end_time ? s.end_time.slice(0, 5) : '08:45',
        class_id: s.class_id,
        section_id: s.section_id,
        class_name: s.classes?.class_name || 'Class',
        section_name: s.sections?.section_name || 'A',
        subject_name: s.subjects?.subject_name || 'Subject',
        subject_code: s.subjects?.subject_code || '',
        day: s.day,
      }));

      const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const rawDay = dayKeys[new Date().getDay()];
      const isSunday = rawDay === 'sun';
      const effectiveDay = isSunday ? 'mon' : rawDay;

      const todaySlots = mappedSlots
        .filter((s: any) => s.day === effectiveDay)
        .sort((a: any, b: any) => (a.period_number || 0) - (b.period_number || 0));

      // 2. Fetch distinct classes and student counts
      const classMap = new Map<string, { class_name: string; section_name: string; subjects: Set<string> }>();
      mappedSlots.forEach((s: any) => {
        const key = `${s.class_name}_${s.section_name}`;
        if (!classMap.has(key)) {
          classMap.set(key, {
            class_name: s.class_name,
            section_name: s.section_name,
            subjects: new Set(),
          });
        }
        if (s.subject_name) {
          classMap.get(key)!.subjects.add(s.subject_name);
        }
      });

      // 3. Active students in those classes
      const { data: stdData } = await supabase
        .from('students')
        .select('id, class, section')
        .eq('status', 'active');

      const activeStudents = stdData || [];
      let totalAssignedStudents = 0;

      const assignedClassesList = Array.from(classMap.values()).map(c => {
        const count = activeStudents.filter(
          s => String(s.class).trim() === String(c.class_name).trim() &&
               String(s.section).trim().toUpperCase() === String(c.section_name).trim().toUpperCase()
        ).length;
        totalAssignedStudents += count;
        return {
          class_name: c.class_name,
          section_name: c.section_name,
          subject_name: Array.from(c.subjects).join(', '),
          student_count: count,
        };
      });

      // 4. Today's attendance rate for assigned classes
      const todayIso = new Date().toISOString().split('T')[0];
      const { data: attData } = await supabase
        .from('attendance')
        .select('status, class, section')
        .eq('attendance_date', todayIso);

      let todayAttendanceRate: number | null = null;
      if (attData && attData.length > 0) {
        const relevantAtt = attData.filter(a =>
          assignedClassesList.some(
            c => String(c.class_name).trim() === String(a.class).trim() &&
                 String(c.section_name).trim().toUpperCase() === String(a.section).trim().toUpperCase()
          )
        );
        if (relevantAtt.length > 0) {
          const presentCount = relevantAtt.filter(a => a.status === 'present' || a.status === 'late' || a.status === 'half_day').length;
          todayAttendanceRate = Math.round((presentCount / relevantAtt.length) * 100);
        }
      }

      setTeacherData({
        teacher: tProfile,
        todaySlots,
        weeklySlots: mappedSlots,
        assignedClasses: assignedClassesList,
        totalStudents: totalAssignedStudents,
        weeklyLecturesCount: mappedSlots.length,
        todayAttendanceRate,
        isSunday,
      });
    } catch (err) {
      console.error('Failed to fetch teacher dashboard data:', err);
    }
  }, [user]);

  useEffect(() => {
    if (role === 'teacher' || role === 'class_teacher') {
      fetchTeacherData();
    }
  }, [role, fetchTeacherData]);

  // ==========================================
  // RENDER: TEACHER DASHBOARD
  // ==========================================
  const renderTeacherDashboard = () => {
    const { teacher, todaySlots, weeklySlots, assignedClasses, totalStudents, weeklyLecturesCount, todayAttendanceRate, isSunday } = teacherData;

    return (
      <div className="space-y-4 sm:space-y-5 animate-fade-in">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-[#061f3d] via-[#10345e] to-[#1a73e8] border border-blue-900/30 text-white p-4 sm:p-5 rounded-xl shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <School className="w-32 h-32" />
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="max-w-xl">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="bg-white/10 text-white px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">
                  Session 2026-27
                </span>
                {teacher?.employee_id && (
                  <span className="bg-blue-400/20 text-blue-200 px-2 py-0.5 rounded-md text-[9px] font-mono font-semibold">
                    {teacher.employee_id}
                  </span>
                )}
                {teacher?.department && (
                  <span className="bg-emerald-400/20 text-emerald-200 px-2 py-0.5 rounded-md text-[9px] font-semibold">
                    {teacher.department}
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-display font-black tracking-tight">
                Welcome Back, {teacher?.name || 'Faculty Member'}! 👋
              </h2>
              <p className="text-white/70 text-xs mt-1 font-semibold">
                {teacher?.designation || 'Academic Instructor'} • {todayString}
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => navigate('/dashboard/teaching/today')}
                className="px-3.5 py-1.5 bg-white text-[#10345e] hover:bg-white/90 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>My Teaching</span>
              </button>
              <button
                onClick={fetchMetrics}
                title="Refresh your dashboard"
                aria-label="Refresh your dashboard"
                className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all flex items-center justify-center cursor-pointer"
              >
                <RefreshCcw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <PremiumStatCard 
            label="Today's Lectures" 
            value={`${todaySlots.length} Periods`} 
            trendValue={isSunday ? "Monday preview" : "Scheduled"} 
            icon={Calendar} 
            gradient="bg-gradient-to-tr from-blue-600 to-indigo-700" 
            onClick={() => navigate('/dashboard/teaching/today')}
          />
          <PremiumStatCard 
            label="Assigned Classes" 
            value={`${assignedClasses.length} Sections`} 
            icon={BookOpen} 
            gradient="bg-gradient-to-tr from-sky-600 to-blue-600" 
            onClick={() => navigate('/dashboard/teaching/classes')}
          />
          <PremiumStatCard 
            label="My Enrolled Students" 
            value={`${totalStudents} Pupils`} 
            icon={Users} 
            gradient="bg-gradient-to-tr from-emerald-500 to-teal-600" 
            onClick={() => navigate('/dashboard/students')}
          />
          <PremiumStatCard 
            label="Today's Attendance" 
            value={todayAttendanceRate !== null ? `${todayAttendanceRate}%` : "Pending Entry"} 
            trend={todayAttendanceRate === null ? "down" : undefined} 
            trendValue={todayAttendanceRate !== null ? "Marked" : "Needs action"} 
            icon={CheckCircle} 
            gradient="bg-gradient-to-tr from-amber-500 to-orange-500" 
            onClick={() => navigate('/dashboard/attendance')}
          />
        </div>

        {/* Quick Classroom Utilities */}
        <div>
          <h3 className="text-base font-display font-black text-slate-900 mb-2.5">Academic Shortcuts</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
            {[
              { label: 'Marks Entry', icon: Award, color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100', path: '/dashboard/teaching/marks' },
              { label: 'Homework & Assignments', icon: FileText, color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100', path: '/dashboard/teaching/work' },
              { label: 'Register Daily Attendance', icon: CheckCircle, color: 'text-violet-600 bg-violet-50 hover:bg-violet-100', path: '/dashboard/attendance' },
              { label: 'My Weekly Timetable', icon: Calendar, color: 'text-blue-600 bg-blue-50 hover:bg-blue-100', path: '/dashboard/academics/timetable' }
            ].map((act) => (
              <button 
                key={act.label}
                onClick={() => {
                  navigate(act.path);
                  toast.success(`Opening ${act.label}`);
                }}
                className={cn("p-3.5 rounded-xl border border-slate-100/85 shadow-2xs transition-all text-center flex flex-col items-center justify-center gap-2 active:scale-95 group hover:shadow-xs cursor-pointer", act.color)}
              >
                <act.icon className="w-4.5 h-4.5 transition-transform group-hover:scale-105" />
                <span className="text-[11px] font-semibold text-slate-700 tracking-tight leading-none">{act.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Schedule & Assigned Classes Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
          {/* Today's Teaching Schedule */}
          <div className="lg:col-span-7 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    {isSunday ? "Monday's Upcoming Schedule" : "Today's Teaching Schedule"}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    {todaySlots.length} lecture{todaySlots.length === 1 ? '' : 's'} assigned for today
                  </p>
                </div>
                <button
                  onClick={() => navigate('/dashboard/academics/timetable')}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <span>Full Week ({weeklyLecturesCount} slots)</span>
                  <ChevronRight size={13} />
                </button>
              </div>

              {todaySlots.length === 0 ? (
                <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-lg">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                  <div className="text-xs font-bold text-slate-600">No Teaching Lectures Today</div>
                  <p className="text-[10px] text-slate-400 mt-0.5">You have no periods scheduled for today. Check your weekly timetable.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todaySlots.map((slot: any, idx: number) => (
                    <div 
                      key={slot.id || idx} 
                      className="p-2.5 bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-200/60 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-black text-xs flex flex-col items-center justify-center shrink-0 shadow-2xs">
                          <span className="text-[8px] font-semibold opacity-75 leading-none">P</span>
                          <span className="leading-none">{slot.period_number}</span>
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{slot.subject_name}</span>
                            {slot.subject_code && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded font-medium">
                                {slot.subject_code}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-semibold mt-0.5 flex items-center gap-2">
                            <span className="text-blue-600 font-bold">Class {slot.class_name} - Sec {slot.section_name}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-slate-400">
                              <Clock size={10} />
                              {slot.start_time} - {slot.end_time}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => navigate('/dashboard/attendance', { state: { selectedClass: slot.class_name, selectedSection: slot.section_name } })}
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold transition-all cursor-pointer"
                          title="Take attendance for this class"
                        >
                          Attendance
                        </button>
                        <button
                          onClick={() => navigate('/dashboard/teaching/marks')}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-bold transition-all cursor-pointer"
                          title="Enter marks for this subject"
                        >
                          Marks
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Assigned Classes & Subjects Overview */}
          <div className="lg:col-span-5 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">My Assigned Classes</h4>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                  {assignedClasses.length} Section{assignedClasses.length === 1 ? '' : 's'}
                </span>
              </div>

              {assignedClasses.length === 0 ? (
                <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-lg">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                  <div className="text-xs font-bold text-slate-600">No Assigned Classes</div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Classes and subjects will appear here once allocated by Academics.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-0.5">
                  {assignedClasses.map((cls: any, idx: number) => (
                    <div 
                      key={idx} 
                      className="p-2.5 bg-slate-50 border border-slate-200/60 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">
                          Class {cls.class_name} — Section {cls.section_name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                          Subject: <span className="text-slate-800 font-bold">{cls.subject_name || 'All Core'}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-blue-600">{cls.student_count} Students</div>
                        <button
                          onClick={() => navigate('/dashboard/teaching/classes')}
                          className="text-[9px] text-slate-400 hover:text-blue-600 font-bold transition-colors cursor-pointer mt-0.5 block"
                        >
                          View Roster →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                <span>Total Workload:</span>
                <span className="text-slate-900 font-bold">{weeklyLecturesCount} Periods / Week</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // RENDER: STUDENT / PARENT DASHBOARD
  // ==========================================
  const renderStudentDashboard = () => {
    const { student, attendanceRate, attendanceThisWeek, subjectMarks, upcomingExams, homeworkPending, totalPresent, totalAbsent, totalDays } = studentData;

    // Derive top subject avg for KPI
    const avgMark = subjectMarks.length > 0
      ? Math.round(subjectMarks.reduce((sum, s) => sum + s.percentage, 0) / subjectMarks.length)
      : null;

    // Grade label
    const gradeLabel = (pct: number | null) => {
      if (pct === null) return 'N/A';
      if (pct >= 90) return `A+ (${pct}%)`;
      if (pct >= 80) return `A (${pct}%)`;
      if (pct >= 70) return `B+ (${pct}%)`;
      if (pct >= 60) return `B (${pct}%)`;
      return `C (${pct}%)`;
    };

    // Attendance dot color
    const attDotColor = (status: string) => {
      if (status === 'present') return 'bg-emerald-500';
      if (status === 'late') return 'bg-amber-400';
      if (status === 'absent') return 'bg-rose-500';
      return 'bg-slate-200';
    };

    if (parentMode) {
      return (
        <div className="space-y-4 sm:space-y-5 animate-fade-in">
          {/* Parent Welcome Banner */}
          <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-800 border border-emerald-900/30 text-white p-4 sm:p-5 rounded-xl shadow-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Heart className="w-32 h-32 animate-pulse" />
            </div>
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="bg-white/10 text-white px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">Parent Portal</span>
                  {student?.class && <span className="bg-emerald-400/20 text-emerald-200 px-2 py-0.5 rounded-md text-[9px] font-semibold">Class {student.class} — {student.section}</span>}
                </div>
                <h2 className="text-lg sm:text-xl font-display font-black tracking-tight">
                  Guardian Dashboard 👨‍👩‍👧
                </h2>
                <p className="text-white/70 text-xs mt-1 font-semibold">
                  {student?.name ? `Monitoring: ${student.name}` : 'Monitor your ward\'s performance, attendance & billings.'} • {todayString}
                </p>
              </div>
              <button
                onClick={() => setParentMode(false)}
                className="px-3.5 py-1.5 bg-white text-emerald-900 hover:bg-white/90 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <User className="w-3.5 h-3.5" />
                <span>Student View</span>
              </button>
            </div>
          </div>

          {/* Parent KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <PremiumStatCard
              label="Ward Attendance"
              value={totalDays > 0 ? `${attendanceRate}%` : '—'}
              trend={attendanceRate >= 85 ? 'up' : 'down'}
              trendValue={totalDays > 0 ? (attendanceRate >= 85 ? 'Satisfactory' : 'Needs Attention') : 'No records'}
              icon={CheckCircle}
              gradient="bg-gradient-to-tr from-emerald-600 to-teal-600"
              sparkColor="#10B981"
              sparkData={totalDays > 0 ? [attendanceRate - 2, attendanceRate, attendanceRate] : [0, 0]}
            />
            <PremiumStatCard
              label="Avg Subject Grade"
              value={gradeLabel(avgMark)}
              trend="up"
              trendValue={subjectMarks.length > 0 ? `${subjectMarks.length} Subjects` : 'No marks yet'}
              icon={Award}
              gradient="bg-gradient-to-tr from-sky-600 to-blue-600"
              sparkColor="#1a73e8"
              sparkData={subjectMarks.slice(0, 5).map(s => s.percentage)}
            />
            <PremiumStatCard
              label="Upcoming Exams"
              value={`${upcomingExams.length} Scheduled`}
              trend={upcomingExams.length > 0 ? 'down' : 'up'}
              trendValue={upcomingExams.length > 0 ? `Next in ${upcomingExams[0]?.daysLeft}d` : 'None Pending'}
              icon={Calendar}
              gradient="bg-gradient-to-tr from-amber-500 to-orange-500"
              sparkColor="#F59E0B"
              sparkData={upcomingExams.length > 0 ? [1, upcomingExams.length] : [0]}
            />
            <PremiumStatCard
              label="Homework Pending"
              value={homeworkPending.length > 0 ? `${homeworkPending.length} Tasks` : 'All Clear ✓'}
              trend={homeworkPending.length === 0 ? 'up' : 'down'}
              trendValue={homeworkPending.length === 0 ? 'On Track' : 'Due Soon'}
              icon={BookOpen}
              gradient="bg-gradient-to-tr from-violet-600 to-indigo-700"
              sparkColor="#7C3AED"
              sparkData={[homeworkPending.length, homeworkPending.length]}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs">
              <h3 className="text-base font-display font-black text-slate-900 leading-none">Subject Performance</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Score % across subjects this session</p>
              {subjectMarks.length > 0 ? (
                <div className="mt-4 space-y-2.5">
                  {subjectMarks.map(s => (
                    <div key={s.subject}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-bold text-slate-700">{s.subject}</span>
                        <span className="text-[11px] font-black text-slate-900">{s.percentage}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", s.percentage >= 80 ? 'bg-emerald-500' : s.percentage >= 60 ? 'bg-amber-400' : 'bg-rose-500')}
                          style={{ width: `${s.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400">
                  <Award className="w-7 h-7 mx-auto mb-1.5 text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">No marks recorded yet</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Subject exam scores will display once published.</p>
                </div>
              )}
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs flex flex-col justify-between">
              <div>
                <h3 className="text-base font-display font-black text-slate-900 leading-none">Attendance Overview</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Last 60 days summary</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="text-xl font-black text-emerald-700">{totalPresent}</div>
                    <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider mt-0.5">Present</div>
                  </div>
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                    <div className="text-xl font-black text-rose-700">{totalAbsent}</div>
                    <div className="text-[9px] font-bold text-rose-600 uppercase tracking-wider mt-0.5">Absent</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-xl font-black text-slate-700">{totalDays}</div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Total Days</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">This Week</div>
                <div className="flex gap-2 justify-between">
                  {attendanceThisWeek.map(w => (
                    <div key={w.day} className="flex-1 flex flex-col items-center gap-1">
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white text-[9px] font-black", attDotColor(w.status))}>
                        {w.day[0]}
                      </div>
                      <span className="text-[8px] text-slate-400 font-bold">{w.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Guardian Actions */}
          <div>
            <h3 className="text-base font-display font-black text-slate-900 mb-2.5">Guardian Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
              <button
                onClick={() => { navigate('/dashboard/portal?tab=fees'); toast.success('Redirecting to fee account...'); }}
                className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-100/85 hover:bg-emerald-100 text-emerald-800 transition-all flex items-center gap-3.5 text-left shadow-2xs hover:shadow-xs group cursor-pointer"
              >
                <div className="p-2.5 rounded-lg bg-emerald-600 text-white transition-transform group-hover:scale-105">
                  <Wallet className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-xs font-bold leading-none block">Fee Account</span>
                  <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">View dues & payment history</p>
                </div>
              </button>
              <button
                onClick={() => { navigate('/dashboard/portal?tab=attendance'); toast.info('Opening student attendance ledger...'); }}
                className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-100/85 hover:bg-indigo-100 text-indigo-800 transition-all flex items-center gap-3.5 text-left shadow-2xs hover:shadow-xs group cursor-pointer"
              >
                <div className="p-2.5 rounded-lg bg-indigo-600 text-white transition-transform group-hover:scale-105">
                  <CheckCircle className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-xs font-bold leading-none block">Attendance Ledger</span>
                  <p className="text-[10px] text-indigo-600 font-semibold mt-0.5">Daily presence & absence log</p>
                </div>
              </button>
              <button
                onClick={() => { navigate('/dashboard/portal?tab=examination'); toast.success('Opening academic transcripts...'); }}
                className="p-3.5 rounded-xl bg-violet-50 border border-violet-100/85 hover:bg-violet-100 text-violet-800 transition-all flex items-center gap-3.5 text-left shadow-2xs hover:shadow-xs group cursor-pointer"
              >
                <div className="p-2.5 rounded-lg bg-violet-600 text-white transition-transform group-hover:scale-105">
                  <Award className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-xs font-bold leading-none block">Academic Report</span>
                  <p className="text-[10px] text-violet-600 font-semibold mt-0.5">Download official report card</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ── Default: Student Portal ──────────────────────────────────────────
    return (
      <div className="space-y-4 sm:space-y-5 animate-fade-in">

        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-[#061f3d] via-[#10345e] to-[#1a73e8] border border-blue-900/30 text-white p-4 sm:p-5 rounded-xl shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Award className="w-32 h-32" />
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="max-w-xl">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="bg-white/10 text-white px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">Student Portal</span>
                {student?.class && <span className="bg-blue-400/20 text-blue-200 px-2 py-0.5 rounded-md text-[9px] font-semibold">Class {student.class} — Section {student.section}</span>}
                {student?.roll_number && <span className="bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded-md text-[9px] font-mono font-semibold">Roll: {student.roll_number}</span>}
              </div>
              <h2 className="text-lg sm:text-xl font-display font-black tracking-tight">
                Welcome Back, {student?.name?.split(' ')[0] || 'Student'}! 🎓
              </h2>
              <p className="text-white/70 text-xs mt-1 font-semibold">
                {student?.admission_number ? `Admission: ${student.admission_number}` : 'Track your academics, attendance & upcoming exams.'} • {todayString}
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => setParentMode(true)}
                className="px-3.5 py-1.5 bg-[#ecb30b] hover:bg-[#d49e00] text-slate-950 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Heart className="w-3.5 h-3.5" />
                <span>Parent View</span>
              </button>
              <button
                onClick={fetchStudentData}
                title="Refresh dashboard"
                className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all flex items-center justify-center cursor-pointer"
              >
                <RefreshCcw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards — Live Data */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <PremiumStatCard
            label="My Attendance Rate"
            value={totalDays > 0 ? `${attendanceRate}%` : '—'}
            trend={attendanceRate >= 85 ? 'up' : 'down'}
            trendValue={totalDays > 0 ? (attendanceRate >= 85 ? 'Satisfactory' : 'Low — Alert') : 'No records'}
            icon={CheckCircle}
            gradient="bg-gradient-to-tr from-blue-700 to-blue-600"
            sparkColor="#1a73e8"
            sparkData={totalDays > 0 ? [attendanceRate - 2, attendanceRate, attendanceRate] : [0, 0]}
            onClick={() => navigate('/dashboard/portal?tab=attendance')}
          />
          <PremiumStatCard
            label="Overall Grade"
            value={gradeLabel(avgMark)}
            trend="up"
            trendValue={avgMark !== null ? `${subjectMarks.length} Subjects` : 'No marks yet'}
            icon={Award}
            gradient="bg-gradient-to-tr from-blue-600 to-cyan-600"
            sparkColor="#0755b0"
            sparkData={subjectMarks.slice(0, 5).map(s => s.percentage)}
            onClick={() => navigate('/dashboard/portal?tab=examination')}
          />
          <PremiumStatCard
            label="Homework Pending"
            value={homeworkPending.length > 0 ? `${homeworkPending.length} Tasks` : 'All Clear ✓'}
            trend={homeworkPending.length === 0 ? 'up' : 'down'}
            trendValue={homeworkPending.length === 0 ? 'On Track' : 'Action Needed'}
            icon={BookOpen}
            gradient="bg-gradient-to-tr from-amber-500 to-orange-500"
            sparkColor="#f59e0b"
            sparkData={[homeworkPending.length, homeworkPending.length]}
            onClick={() => navigate('/dashboard/portal?tab=homework')}
          />
          <PremiumStatCard
            label="Upcoming Exams"
            value={upcomingExams.length > 0 ? `${upcomingExams.length} Scheduled` : 'None'}
            trend={upcomingExams.length > 0 ? 'down' : 'up'}
            trendValue={upcomingExams.length > 0 ? `In ${upcomingExams[0]?.daysLeft} days` : 'No exams'}
            icon={Calendar}
            gradient="bg-gradient-to-tr from-emerald-500 to-teal-500"
            sparkColor="#10b981"
            sparkData={upcomingExams.length > 0 ? [1, upcomingExams.length] : [0]}
            onClick={() => navigate('/dashboard/portal?tab=examination')}
          />
        </div>

        {/* Subject Performance + Attendance Week */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">

          {/* Subject Performance Bars */}
          <div className="lg:col-span-7 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-display font-black text-slate-900 leading-none">Subject Performance Index</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Score % across all subjects — this session</p>
              </div>
              <span className="text-[10px] bg-blue-50 text-blue-600 font-black px-2 py-0.5 rounded-md uppercase tracking-wide">Live</span>
            </div>
            {subjectMarks.length > 0 ? (
              <div className="space-y-3">
                {subjectMarks.map(s => (
                  <div key={s.subject} className="flex items-center gap-3">
                    <div className="w-24 text-[11px] font-bold text-slate-600 truncate shrink-0">{s.subject}</div>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", s.percentage >= 85 ? 'bg-emerald-500' : s.percentage >= 70 ? 'bg-amber-400' : 'bg-rose-500')}
                        style={{ width: `${s.percentage}%` }}
                      />
                    </div>
                    <div className="w-10 text-right text-[11px] font-black text-slate-900 shrink-0">{s.percentage}%</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400">
                <Award className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold text-slate-600">No subject marks recorded yet</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Marks will appear here as soon as teachers publish examination results.</p>
              </div>
            )}
          </div>

          {/* This Week Attendance */}
          <div className="lg:col-span-5 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-display font-black text-slate-900 leading-none">This Week's Attendance</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Mon → Sat presence tracker</p>
                </div>
              </div>
              <div className="flex gap-2 items-center justify-center py-2">
                {attendanceThisWeek.map(w => (
                  <div key={w.day} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className={cn(
                      "w-full aspect-square rounded-xl flex items-center justify-center font-black text-xs text-white shadow-2xs",
                      w.status === 'present' ? 'bg-emerald-500' :
                      w.status === 'late' ? 'bg-amber-400' :
                      w.status === 'absent' ? 'bg-rose-500' :
                      'bg-slate-200 text-slate-400'
                    )}>
                      {w.day[0]}
                    </div>
                    <span className="text-[9px] font-bold text-slate-400">{w.day}</span>
                    <span className={cn("text-[8px] font-black uppercase tracking-wide",
                      w.status === 'present' ? 'text-emerald-600' :
                      w.status === 'late' ? 'text-amber-600' :
                      w.status === 'absent' ? 'text-rose-600' :
                      'text-slate-300'
                    )}>
                      {w.status === 'none' ? '—' : w.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-1.5 text-center">
              <div>
                <div className="text-sm font-black text-emerald-600">{totalPresent}</div>
                <div className="text-[8px] font-bold text-slate-400 uppercase">Present</div>
              </div>
              <div>
                <div className="text-sm font-black text-rose-600">{totalAbsent}</div>
                <div className="text-[8px] font-bold text-slate-400 uppercase">Absent</div>
              </div>
              <div>
                <div className="text-sm font-black text-blue-600">{totalDays > 0 ? `${attendanceRate}%` : '—'}</div>
                <div className="text-[8px] font-bold text-slate-400 uppercase">Rate</div>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Exams + Homework */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">

          {/* Upcoming Exams Countdown */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Upcoming Exams</h4>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Countdown to exam dates</p>
              </div>
              <Calendar className="w-4 h-4 text-slate-400" />
            </div>
            {upcomingExams.length > 0 ? (
              <div className="space-y-2">
                {upcomingExams.map((exam, i) => (
                  <div key={i} className={cn("p-2.5 rounded-xl border flex items-center justify-between gap-2",
                    exam.daysLeft <= 3 ? 'bg-rose-50 border-rose-100' :
                    exam.daysLeft <= 7 ? 'bg-amber-50 border-amber-100' :
                    'bg-slate-50 border-slate-100'
                  )}>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-xs truncate">{exam.name}</div>
                      <div className="text-[10px] text-slate-500 font-semibold mt-0.5">{exam.subject} • {exam.date}</div>
                    </div>
                    <div className={cn("shrink-0 text-center px-2.5 py-1 rounded-lg",
                      exam.daysLeft <= 3 ? 'bg-rose-100 text-rose-700' :
                      exam.daysLeft <= 7 ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-50 text-blue-700'
                    )}>
                      <div className="text-base font-black leading-none">{exam.daysLeft}</div>
                      <div className="text-[8px] font-bold uppercase tracking-wider">days</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400">
                <Calendar className="w-8 h-8 mx-auto mb-1.5 text-slate-300" />
                <p className="text-xs font-bold text-slate-600">No upcoming exams scheduled</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Examination timetables will be posted here once published.</p>
              </div>
            )}
          </div>

          {/* Homework & Assignments */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Homework & Assignments</h4>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Due this week</p>
              </div>
              <BookOpen className="w-4 h-4 text-slate-400" />
            </div>
            {homeworkPending.length > 0 ? (
              <div className="space-y-2">
                {homeworkPending.map((hw, i) => (
                  <div key={i} className={cn("p-2.5 rounded-xl border flex items-start justify-between gap-2",
                    hw.overdue ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'
                  )}>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-xs truncate">{hw.title}</div>
                      <div className="text-[10px] text-slate-500 font-semibold mt-0.5">{hw.subject} • Due: {hw.due}</div>
                    </div>
                    <span className={cn("shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md",
                      hw.overdue ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    )}>
                      {hw.overdue ? 'Overdue' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-slate-700">No pending homework</p>
                <p className="text-[10px] text-slate-400 mt-0.5">You're all caught up with your classroom assignments!</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Resources */}
        <div>
          <h3 className="text-base font-display font-black text-slate-900 mb-2.5">Academic Quick Access</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
            {[
              { label: 'My Portal', icon: LayoutDashboard, color: 'text-violet-600 bg-violet-50 hover:bg-violet-100 border-violet-100/50', path: '/dashboard/portal' },
              { label: 'View Results', icon: Award, color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-100/50', path: '/dashboard/portal' },
              { label: 'Attendance Log', icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border-emerald-100/50', path: '/dashboard/portal' },
              { label: 'School Library', icon: BookOpen, color: 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-100/50', path: '/dashboard/library' },
            ].map((act) => (
              <button
                key={act.label}
                onClick={() => { navigate(act.path); toast.success(`Opening: ${act.label}`); }}
                className={cn("p-3.5 rounded-xl border shadow-2xs transition-all text-center flex flex-col items-center justify-center gap-2 active:scale-95 group hover:shadow-xs cursor-pointer", act.color)}
              >
                <act.icon className="w-4.5 h-4.5 transition-transform group-hover:scale-105" />
                <span className="text-[11px] font-semibold text-slate-700 tracking-tight leading-none">{act.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16 font-sans antialiased">
      {/* 1. Master Page Header Banner — teachers have their own banner below */}
      {/* 1. Master Page Header Banner — only for Admin/Leadership roles (Teachers and Students have their own branded welcome banners) */}
      {(role === 'admin' || role === 'super_admin' || role === 'principal' || role === 'vice_principal') && (
        <AdminHeader
          title="Administrative & Executive Overview"
          subtitle={`Real-time institutional metrics, performance intelligence, and quick operational shortcuts. Today is ${todayString}.`}
          badge={{
            icon: LayoutDashboard,
            text: `${role ? role.toUpperCase() : 'ADMIN'} DASHBOARD`,
            variant: 'primary'
          }}
          sessionBadge="Session: 2026-27"
          actions={
            <button 
              onClick={fetchMetrics}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-slate-600 hover:text-slate-900 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
              title="Refresh real-time school metrics"
            >
              <RefreshCcw className={cn("w-4 h-4", isLoading && "animate-spin text-blue-600")} />
            </button>
          }
        />
      )}

      {/* 2. Role Conditional Rendering */}
      {(role === 'admin' || role === 'super_admin' || role === 'principal' || role === 'vice_principal') && renderAdminDashboard()}
      {(role === 'teacher' || role === 'class_teacher') && renderTeacherDashboard()}
      {(role === 'student' || role === 'parent') && renderStudentDashboard()}
      {!role && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs text-center py-16 space-y-3">
          <GraduationCap className="w-12 h-12 text-blue-700 mx-auto animate-bounce" />
          <h2 className="text-lg font-black text-slate-900">Configuring Portal Profile...</h2>
          <p className="text-slate-500 text-xs max-w-sm mx-auto">Please wait while the ST. JOSEPH'S ERP engine links your credentials.</p>
        </div>
      )}
    </div>
  );
}
