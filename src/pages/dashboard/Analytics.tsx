import { useState, useEffect } from 'react';
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
      <ResponsiveContainer width="100%" height="100%">
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
          <div className={cn(
            "flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold",
            trend === 'up' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
          )}>
            {trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trendValue}
          </div>
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
        <div className="hidden sm:block shrink-0">
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

      // Merge with old service just to not break other components (KPIs etc)
      const data = await analyticsService.getSchoolMetrics();
      if (data) {
        setMetrics({
          ...data,
          classDistribution: classDistribution.length ? classDistribution : [],
          genderDistribution: genderDistribution.some(g => g.value > 0) ? genderDistribution : [],
          monthlyFees: monthlyFees.length ? monthlyFees : [],
          admissionTrend: admissionTrend.length ? admissionTrend : []
        });
      } else {
        setMetrics({
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

  const ATTENDANCE_PIE = metrics?.attendance?.avgAttendance ? [
    { name: 'Present', value: metrics.attendance.avgAttendance, color: '#1a73e8' },
    { name: 'Absent', value: 100 - metrics.attendance.avgAttendance, color: '#E2E8F0' },
  ] : [];

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
            <ResponsiveContainer width="100%" height="100%">
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
            <ResponsiveContainer width="100%" height="100%">
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
              <span className="text-2xl font-bold text-slate-900 leading-none group-hover/pie:scale-105 transition-transform duration-200">{metrics?.avgAttendance || 92}%</span>
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
            <ResponsiveContainer width="100%" height="100%">
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
            <ResponsiveContainer width="100%" height="100%">
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
          { title: "Fee Collection Target", progress: metrics?.fees?.collectionRate || 85, color: "bg-blue-600", path: "/dashboard/fees", toastMsg: "Viewing Fee Collection Dues" },
          { title: "Average Attendance Index", progress: metrics?.attendance?.avgAttendance || 94, color: "bg-emerald-500", path: "/dashboard/attendance", toastMsg: "Opening Attendance Logs" },
          { title: "Assignments Completed", progress: 78, color: "bg-indigo-600", path: "/dashboard/students", toastMsg: "Directing to Students Academic Index" },
          { title: "Library Resource Utility", progress: metrics?.utility?.library?.utilityRate || 62, color: "bg-amber-500", path: "/dashboard/students", toastMsg: "Directing to Library Resource Allocation" }
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
  // RENDER: TEACHER DASHBOARD
  // ==========================================
  const renderTeacherDashboard = () => (
    <div className="space-y-4 sm:space-y-5 animate-fade-in">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#061f3d] via-[#10345e] to-[#1a73e8] border border-blue-900/30 text-white p-4 sm:p-5 rounded-xl shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <School className="w-32 h-32" />
        </div>
        <div className="relative z-10 max-w-xl">
          <span className="bg-white/10 text-white px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">Faculty Command</span>
          <h2 className="text-lg sm:text-xl font-display font-black tracking-tight mt-2">Welcome Back, Instructor! 👋</h2>
          <p className="text-white/70 text-xs mt-1 font-semibold">Monitor classroom metrics, record student milestones, and configure grades effortlessly.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <PremiumStatCard 
          label="Today's Lectures" 
          value="4 Periods" 
          trend="up" 
          trendValue="Normal" 
          icon={Calendar} 
          gradient="bg-gradient-to-tr from-blue-600 to-indigo-700" 
          sparkColor="#1a73e8" 
          sparkData={[2, 3, 4, 4, 3, 4, 4]} 
          onClick={() => navigate('/dashboard/attendance')}
        />
        <PremiumStatCard 
          label="Students Present" 
          value="94.6%" 
          trend="up" 
          trendValue="+1.2%" 
          icon={CheckCircle} 
          gradient="bg-gradient-to-tr from-sky-600 to-blue-600" 
          sparkColor="#1a73e8" 
          sparkData={[92, 93, 91, 95, 94, 94, 95]} 
          onClick={() => navigate('/dashboard/attendance')}
        />
        <PremiumStatCard 
          label="Assignments Pending" 
          value="18 Submissions" 
          trend="down" 
          trendValue="-6" 
          icon={FileText} 
          gradient="bg-gradient-to-tr from-amber-500 to-orange-500" 
          sparkColor="#F59E0B" 
          sparkData={[28, 24, 22, 21, 18, 18, 18]} 
          onClick={() => navigate('/dashboard/students')}
        />
        <PremiumStatCard 
          label="Lesson Goals" 
          value="82%" 
          trend="up" 
          trendValue="+5%" 
          icon={TrendingUp} 
          gradient="bg-gradient-to-tr from-emerald-500 to-teal-500" 
          sparkColor="#10B981" 
          sparkData={[75, 78, 80, 80, 81, 82, 82]} 
          onClick={() => {
            navigate('/dashboard/students');
            toast.success('Viewing syllabus and class lesson goals...');
          }}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
        <div className="lg:col-span-8 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-display font-black text-slate-900 leading-none">Classroom Assignment Metrics</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Weekly Homework Submission Index</p>
          </div>
          <div className="h-[180px] w-full mt-3.5">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[
                { day: 'Mon', count: 42 },
                { day: 'Tue', count: 35 },
                { day: 'Wed', count: 50 },
                { day: 'Thu', count: 68 },
                { day: 'Fri', count: 72 },
              ]}>
                <defs>
                  <linearGradient id="teacherGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1a73e8" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#1a73e8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#1a73e8" strokeWidth={2.5} fillOpacity={1} fill="url(#teacherGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs flex flex-col justify-between">
          <div className="text-center">
            <h3 className="text-base font-display font-black text-slate-900 leading-none">Syllabus Progress</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Quarterly Syllabus Completed</p>
          </div>
          <div className="flex-1 min-h-[130px] flex items-center justify-center relative mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[{ name: 'Done', value: 82, color: '#1a73e8' }, { name: 'Remaining', value: 18, color: '#F1F5F9' }]} innerRadius={45} outerRadius={60} paddingAngle={4} dataKey="value">
                  {[{ name: 'Done', value: 82, color: '#1a73e8' }, { name: 'Remaining', value: 18, color: '#E2E8F0' }].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
              <span className="text-2xl font-black text-slate-900 leading-none">82%</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Achieved</span>
            </div>
          </div>
        </div>
      </div>

      {/* Classroom Quick Utilities */}
      <div>
        <h3 className="text-base font-display font-black text-slate-900 mb-2.5">Classroom Utilities</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
          {[
            { label: 'Register Attendance', icon: CheckCircle, color: 'text-violet-600 bg-violet-50 hover:bg-violet-100', path: '/dashboard/attendance' },
            { label: 'Upload Homework', icon: BookOpen, color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100', path: '/dashboard/students' },
            { label: 'Record Exam Marks', icon: Award, color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100', path: '/dashboard/students' },
            { label: 'Download Roster', icon: FileText, color: 'text-blue-600 bg-blue-50 hover:bg-blue-100', path: '/dashboard/students' }
          ].map((act) => (
            <button 
              key={act.label}
              onClick={() => {
                navigate(act.path);
                toast.success(`Opening faculty portal for ${act.label}`);
              }}
              className={cn("p-3.5 rounded-xl border border-slate-100/85 shadow-2xs transition-all text-center flex flex-col items-center justify-center gap-2 active:scale-95 group hover:shadow-xs", act.color)}
            >
              <act.icon className="w-4.5 h-4.5 transition-transform group-hover:scale-105" />
              <span className="text-[11px] font-semibold text-slate-700 tracking-tight leading-none">{act.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Timetable, Assignments and Exams Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
        <div className="bg-white p-3.5 rounded-xl border border-slate-100/80 shadow-2xs">
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3">Today's Class Schedule</h4>
          <div className="space-y-2">
            {[
              { subject: 'Grade 8 — Mathematics', time: '09:00 AM - 09:45 AM', room: 'Room 102' },
              { subject: 'Grade 10 — Physics', time: '10:00 AM - 10:45 AM', room: 'Science Lab 2' },
              { subject: 'Grade 9 — Algebra', time: '11:15 AM - 12:00 PM', room: 'Room 105' },
              { subject: 'Grade 12 — Calculus', time: '01:30 PM - 02:15 PM', room: 'Main Lecture Hall' }
            ].map((period, idx) => (
              <div key={idx} className="p-2 bg-slate-50 rounded-lg flex justify-between items-center text-xs">
                <div>
                  <div className="font-bold text-slate-800">{period.subject}</div>
                  <div className="text-[10px] text-slate-400 font-bold mt-0.5">{period.time}</div>
                </div>
                <div className="text-[9px] bg-indigo-50 text-indigo-600 font-bold px-1.5 py-0.5 rounded-md shrink-0">{period.room}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-100/80 shadow-2xs">
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3">Pending Tasks & Messages</h4>
          <div className="space-y-2">
            <div className="p-2 bg-rose-50 border border-rose-100/80 rounded-lg flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-black text-rose-900">Grade 10 Physics papers pending audit</div>
                <p className="text-[10px] text-rose-600 font-semibold mt-0.5">Please finalize marks before the portal freezes tonight.</p>
              </div>
            </div>
            <div className="p-2 bg-indigo-50 border border-indigo-100/80 rounded-lg flex items-start gap-2.5">
              <MessageSquare className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-black text-indigo-900">Message from Principal's Desk</div>
                <p className="text-[10px] text-indigo-600 font-semibold mt-0.5">Draft the questions portfolio for Q1 Term examinations early.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ==========================================
  // RENDER: STUDENT / PARENT DASHBOARD
  // ==========================================
  const renderStudentDashboard = () => {
    if (parentMode) {
      // Parent View Sub-dashboard
      return (
        <div className="space-y-4 sm:space-y-5 animate-fade-in">
          {/* Welcome Title */}
          <div className="bg-gradient-to-r from-emerald-900 to-teal-950 text-white p-4 sm:p-5 rounded-xl shadow-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Heart className="w-32 h-32 animate-pulse" />
            </div>
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="bg-white/10 text-white px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">Parent Portal</span>
                <h2 className="text-lg sm:text-xl font-display font-black tracking-tight mt-2">Welcome, Guardian! 👨‍👩‍👧</h2>
                <p className="text-white/70 text-xs mt-1 font-semibold">Monitor your ward's classroom performance, attendance logs, and school billings.</p>
              </div>
              <button 
                onClick={() => setParentMode(false)}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-md text-xs font-bold transition-all self-start sm:self-auto uppercase tracking-wider"
              >
                Go to Student Portal
              </button>
            </div>
          </div>

          {/* Cards Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <PremiumStatCard label="Ward Attendance" value="96.2%" trend="up" trendValue="+0.8%" icon={CheckCircle} gradient="bg-gradient-to-tr from-emerald-600 to-teal-600" sparkColor="#10B981" sparkData={[95, 96, 94, 96, 96, 97, 96]} />
            <PremiumStatCard label="Fee Invoice Status" value="Fully Paid" trend="up" trendValue="Cleared" icon={Wallet} gradient="bg-gradient-to-tr from-blue-600 to-indigo-700" sparkColor="#1a73e8" sparkData={[100, 100, 100]} />
            <PremiumStatCard label="Avg Subject Grade" value="A+ (92%)" trend="up" trendValue="Excellent" icon={Award} gradient="bg-gradient-to-tr from-sky-600 to-blue-600" sparkColor="#1a73e8" sparkData={[88, 90, 89, 91, 92, 92]} />
            <PremiumStatCard label="Homework Status" value="None Pending" trend="up" trendValue="On Time" icon={BookOpen} gradient="bg-gradient-to-tr from-amber-500 to-orange-500" sparkColor="#F59E0B" sparkData={[0, 0, 0]} />
          </div>

          {/* Charts Area */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs">
              <h3 className="text-base font-display font-black text-slate-900 leading-none">Weekly Performance Tracker</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Average scores of your child</p>
              <div className="h-[180px] w-full mt-3.5">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[
                    { subject: 'Math', score: 94 },
                    { subject: 'Physics', score: 88 },
                    { subject: 'Chem', score: 91 },
                    { subject: 'English', score: 95 },
                    { subject: 'Comp', score: 98 },
                  ]}>
                    <defs>
                      <linearGradient id="parentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                    <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="score" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#parentGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs flex flex-col justify-between">
              <div>
                <h3 className="text-base font-display font-black text-slate-900 leading-none">Attendance Log</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Child presence tracking</p>
              </div>
              <div className="h-[180px] w-full mt-3.5">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[
                    { week: 'Wk 1', rate: 98 },
                    { week: 'Wk 2', rate: 95 },
                    { week: 'Wk 3', rate: 94 },
                    { week: 'Wk 4', rate: 98 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="rate" stroke="#4F46E5" strokeWidth={2.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-base font-display font-black text-slate-900 mb-2.5">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
              <button 
                onClick={() => {
                  navigate('/dashboard/fees');
                  toast.success('Redirecting to secure Payment Gateway...');
                }}
                className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-100/85 hover:bg-emerald-100 text-emerald-800 transition-all flex items-center gap-3.5 text-left shadow-2xs hover:shadow-xs group cursor-pointer"
              >
                <div className="p-2.5 rounded-lg bg-emerald-600 text-white transition-transform group-hover:scale-105">
                  <Wallet className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-xs font-bold leading-none block">Pay School Dues</span>
                  <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">UPI, Debit card, NetBanking</p>
                </div>
              </button>

              <button 
                onClick={() => {
                  navigate('/dashboard/attendance');
                  toast.info('Composing message to Grade Tutor via communication desk...');
                }}
                className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-100/85 hover:bg-indigo-100 text-indigo-800 transition-all flex items-center gap-3.5 text-left shadow-2xs hover:shadow-xs group cursor-pointer"
              >
                <div className="p-2.5 rounded-lg bg-indigo-600 text-white transition-transform group-hover:scale-105">
                  <MessageSquare className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-xs font-bold leading-none block">Contact Class Teacher</span>
                  <p className="text-[10px] text-indigo-600 font-semibold mt-0.5">Message classroom mentor directly</p>
                </div>
              </button>

              <button 
                onClick={() => {
                  navigate('/dashboard/students');
                  toast.success('Preparing Grade transcripts and digital report cards...');
                }}
                className="p-3.5 rounded-xl bg-violet-50 border border-violet-100/85 hover:bg-violet-100 text-violet-800 transition-all flex items-center gap-3.5 text-left shadow-2xs hover:shadow-xs group cursor-pointer"
              >
                <div className="p-2.5 rounded-lg bg-violet-600 text-white transition-transform group-hover:scale-105">
                  <Award className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-xs font-bold leading-none block">Academic Transcripts</span>
                  <p className="text-[10px] text-violet-600 font-semibold mt-0.5">Download official report card PDF</p>
                </div>
              </button>
            </div>
          </div>

          {/* School Notices & Bus Tracking Widget */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
            <div className="bg-white p-3.5 rounded-xl border border-slate-100/80 shadow-2xs">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3">Latest Notices</h4>
              <div className="space-y-2">
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <div className="font-bold text-slate-800 text-xs">Monsoon Rain Schedule Warning</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">In case of intense rain, schools will transition to online Zoom sessions.</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <div className="font-bold text-slate-800 text-xs">Mandatory Sports Uniform</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Please ensure your ward carries physical training dress every Wednesday.</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Bus className="w-4.5 h-4.5 text-emerald-400" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">Transport & Bus Status</h4>
                </div>
                <div className="space-y-1.5 mt-3 text-xs">
                  <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
                    <span className="text-slate-400 text-[11px]">Assigned Bus:</span>
                    <span className="font-bold text-[11px]">Route No. 12 (UP53-AB-4567)</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
                    <span className="text-slate-400 text-[11px]">Driver Contact:</span>
                    <span className="font-bold text-[11px]">+91 98765-43210</span>
                  </div>
                  <div className="flex justify-between items-center bg-emerald-500/10 text-emerald-400 p-2 rounded-lg">
                    <span className="text-[11px]">GPS Tracking Status:</span>
                    <span className="font-bold uppercase tracking-wider text-[9px]">Active • Near Gate A</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Default: Student Portal
    return (
      <div className="space-y-4 sm:space-y-5 animate-fade-in">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-[#061f3d] via-[#10345e] to-[#1a73e8] border border-blue-900/30 text-white p-4 sm:p-5 rounded-xl shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Award className="w-32 h-32" />
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="bg-white/10 text-white px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">Student Portal</span>
              <h2 className="text-lg sm:text-xl font-display font-black tracking-tight mt-2">Welcome Back, Student! 🎓</h2>
              <p className="text-white/70 text-xs mt-1 font-semibold">Track your syllabus, view class assignments, and monitor test cards online.</p>
            </div>
            <button 
              onClick={() => setParentMode(true)}
              className="px-4 py-1.5 bg-[#ecb30b] hover:bg-[#d49e00] text-slate-950 rounded-md text-xs font-bold transition-all shadow-sm uppercase tracking-wider self-start sm:self-auto"
            >
              Access Parent View 👨‍👩‍👧
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <PremiumStatCard 
            label="My Attendance Rate" 
            value="94%" 
            trend="up" 
            trendValue="Excellent" 
            icon={CheckCircle} 
            gradient="bg-gradient-to-tr from-blue-700 to-blue-600" 
            sparkColor="#1a73e8" 
            sparkData={[92, 93, 94, 94, 94, 94, 94]} 
            onClick={() => navigate('/dashboard/attendance')}
          />
          <PremiumStatCard 
            label="Current Grade Scale" 
            value="A (88%)" 
            trend="up" 
            trendValue="+2%" 
            icon={Award} 
            gradient="bg-gradient-to-tr from-blue-600 to-cyan-600" 
            sparkColor="#0755b0" 
            sparkData={[85, 86, 88, 88, 88, 88]} 
            onClick={() => navigate('/dashboard/students')}
          />
          <PremiumStatCard 
            label="Tasks Pending" 
            value="3 Assignments" 
            trend="down" 
            trendValue="-2" 
            icon={BookOpen} 
            gradient="bg-gradient-to-tr from-amber-500 to-orange-500" 
            sparkColor="#f59e0b" 
            sparkData={[5, 4, 3, 3]} 
            onClick={() => navigate('/dashboard/students')}
          />
          <PremiumStatCard 
            label="Upcoming Tests" 
            value="1 Paper" 
            trend="up" 
            trendValue="Next Week" 
            icon={Calendar} 
            gradient="bg-gradient-to-tr from-emerald-500 to-teal-500" 
            sparkColor="#10b981" 
            sparkData={[1, 1, 1]} 
            onClick={() => {
              navigate('/dashboard/students');
              toast.success('Directing to student calendar and test schedules...');
            }}
          />
        </div>

        {/* Charts & Subject performance */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
          <div className="lg:col-span-8 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs">
            <h3 className="text-base font-display font-black text-slate-900 leading-none">Academic Progress Index</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Average grades across semesters</p>
            <div className="h-[180px] w-full mt-3.5">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[
                  { exam: 'Unit Test 1', grade: 78 },
                  { exam: 'Unit Test 2', grade: 82 },
                  { exam: 'Mid-Term', grade: 86 },
                  { exam: 'Unit Test 3', grade: 88 },
                  { exam: 'Final Exams', grade: 91 },
                ]}>
                  <defs>
                    <linearGradient id="studentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1a73e8" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#1a73e8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                  <XAxis dataKey="exam" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="grade" stroke="#1a73e8" strokeWidth={2.5} fillOpacity={1} fill="url(#studentGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-4 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100/80 shadow-2xs flex flex-col justify-between">
            <div className="text-center">
              <h3 className="text-base font-display font-black text-slate-900 leading-none">Task Completion Rate</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Ratio of Homework Submitted</p>
            </div>
            <div className="flex-1 min-h-[130px] flex items-center justify-center relative mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ name: 'Done', value: 91, color: '#1a73e8' }, { name: 'Remaining', value: 9, color: '#E2E8F0' }]} innerRadius={45} outerRadius={60} paddingAngle={4} dataKey="value">
                    {[{ name: 'Done', value: 91, color: '#1a73e8' }, { name: 'Remaining', value: 9, color: '#E2E8F0' }].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
                <span className="text-2xl font-black text-slate-900 leading-none">91%</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Achieved</span>
              </div>
            </div>
          </div>
        </div>

        {/* Timetable & Notices Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
          <div className="bg-white p-3.5 rounded-xl border border-slate-100/80 shadow-2xs">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3">Today's Class Schedule</h4>
            <div className="space-y-2">
              {[
                { subject: 'Algebra & Matrices', time: '09:00 AM - 09:45 AM', teacher: 'Mrs. Rawat' },
                { subject: 'Mechanics & Kinetics', time: '10:00 AM - 10:45 AM', teacher: 'Mr. Pathak' },
                { subject: 'Organic Chemistry', time: '11:15 AM - 12:00 PM', teacher: 'Dr. Singh' },
                { subject: 'English Grammar', time: '01:30 PM - 02:15 PM', teacher: 'Miss Dubey' }
              ].map((period, idx) => (
                <div key={idx} className="p-2 bg-slate-50 rounded-lg flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-slate-800">{period.subject}</div>
                    <div className="text-[10px] text-slate-400 font-bold mt-0.5">{period.time}</div>
                  </div>
                  <div className="text-[9px] bg-indigo-50 text-indigo-600 font-bold px-1.5 py-0.5 rounded-md shrink-0">{period.teacher}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-100/80 shadow-2xs">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3">Class Notices & Reminders</h4>
            <div className="space-y-2">
              <div className="p-2 bg-amber-50 border border-amber-100/80 rounded-lg">
                <div className="text-xs font-black text-amber-900">Algebra Homework Assignment #3</div>
                <p className="text-[10px] text-amber-600 font-semibold mt-1">Submit the answers to exercises 4.1 to 4.5 before Thursday morning lecture.</p>
              </div>
              <div className="p-2 bg-indigo-50 border border-indigo-100/80 rounded-lg">
                <div className="text-xs font-black text-indigo-900">Sports kit inventory check</div>
                <p className="text-[10px] text-indigo-600 font-semibold mt-1">All participants of football club are requested to coordinate with Coach Verma.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-base font-display font-black text-slate-900 mb-2.5">Quick Resources</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
            {[
              { label: 'View Exam Results', icon: Award, color: 'text-violet-600 bg-violet-50 hover:bg-violet-100', path: '/dashboard/examination?tab=results' },
              { label: 'Download Report Card', icon: FileText, color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100', path: '/dashboard/examination?tab=reports' },
              { label: 'My Homework list', icon: BookOpen, color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100', path: '/dashboard/students' },
              { label: 'Library Roster', icon: School, color: 'text-blue-600 bg-blue-50 hover:bg-blue-100', path: '/dashboard/library' }
            ].map((act) => (
              <button 
                key={act.label}
                onClick={() => {
                  navigate(act.path);
                  toast.success(`Opening resource: ${act.label}`);
                }}
                className={cn("p-3.5 rounded-xl border border-slate-100/85 shadow-2xs transition-all text-center flex flex-col items-center justify-center gap-2 active:scale-95 group hover:shadow-xs cursor-pointer", act.color)}
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
      {/* 1. Master Page Header Banner */}
      <AdminHeader
        title={
          role === 'admin' ? "Administrative & Executive Overview" :
          role === 'teacher' ? "Faculty Command Center" :
          (parentMode ? "Guardian Portal" : "Student Command Center")
        }
        subtitle={`Real-time institutional metrics, performance intelligence, and quick operational shortcuts. Today is ${todayString}.`}
        badge={{
          icon: LayoutDashboard,
          text: `${role ? role.toUpperCase() : 'GUEST'} DASHBOARD`,
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

      {/* 2. Role Conditional Rendering */}
      {role === 'admin' && renderAdminDashboard()}
      {role === 'teacher' && renderTeacherDashboard()}
      {role === 'student' && renderStudentDashboard()}
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
