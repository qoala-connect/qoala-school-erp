import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Wallet, Search, Filter, Download, Plus, CheckCircle2, 
  Clock, AlertCircle, RefreshCcw, Receipt, Printer, Trash2, 
  TrendingUp, BarChart3, PieChart as PieChartIcon, History, 
  FileText, Users, Ban, Eye, CreditCard, ChevronRight, 
  Layers, Check, X, Loader2, ArrowUpRight, Smartphone, Building,
  ArrowUpDown, ArrowUp, ArrowDown, Activity, Sparkles, Zap, Radio
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { feeService } from '@/services/feeService';
import { 
  StudentFeeLedger, 
  FeeCategory, 
  FeePaymentRecord, 
  CollectFeeResult 
} from '@/types/fee';
import FeeCollectionModal from '@/components/fees/FeeCollectionModal';
import FeeReceiptModal from '@/components/fees/FeeReceiptModal';
import FeeVoidModal from '@/components/fees/FeeVoidModal';
import FeeStructureManager from '@/components/fees/FeeStructureManager';
import FeeReportsView from '@/components/fees/FeeReportsView';
import AdminHeader from '@/components/common/AdminHeader';
import AdminStatCard from '@/components/common/AdminStatCard';

const PIE_COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#6366F1'];

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-rose-50 text-rose-700 border-rose-200',
  overdue: 'bg-rose-100 text-rose-800 border-rose-300',
  waived: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function FeesPortal() {
  const { role, user, can } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isStudentOrParent = role === 'student' || role === 'parent';

  // Defense-in-depth: Redirect students/parents to their personal fee ledger
  useEffect(() => {
    if (isStudentOrParent) {
      navigate('/dashboard/portal?tab=fees', { replace: true });
    }
  }, [isStudentOrParent, navigate]);

  // Navigation Sub-workspaces
  const [activeTab, setActiveTab] = useState<'portal' | 'student_fees' | 'fee_structure' | 'recent_payments' | 'fee_reports'>('portal');

  // Master Data State
  const [fees, setFees] = useState<StudentFeeLedger[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([]);
  const [classes, setClasses] = useState<{ id: string; class_name: string }[]>([]);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);
  const [currentYear, setCurrentYear] = useState<{ id: string; name: string } | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRealtimeActive, setIsRealtimeActive] = useState(true);

  // Filters & Sorting State
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [quickFilter, setQuickFilter] = useState<'all' | 'defaulters' | 'critical' | 'partial' | 'paid'>('all');
  const [sortField, setSortField] = useState<'name' | 'class' | 'demand' | 'paid' | 'remaining' | 'status'>('remaining');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [yearFilter, setYearFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Modals State
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [collectTargetStudent, setCollectTargetStudent] = useState<any>(null);
  const [collectTargetFeeLedger, setCollectTargetFeeLedger] = useState<StudentFeeLedger | null>(null);

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptTargetFee, setReceiptTargetFee] = useState<any>(null);

  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidTargetPayment, setVoidTargetPayment] = useState<any>(null);

  // Sync activeTab with location.state passed from sidebar or deep links
  useEffect(() => {
    if (location.state?.activeTab) {
      const tab = location.state.activeTab;
      if (tab === 'student_fees' || tab === 'student-fees') setActiveTab('student_fees');
      else if (tab === 'recent_payments' || tab === 'recent-payments') setActiveTab('recent_payments');
      else if (tab === 'fee_structure' || tab === 'fee-structure') setActiveTab('fee_structure');
      else if (tab === 'fee_reports' || tab === 'fee-reports') setActiveTab('fee_reports');
      else if (tab === 'portal') setActiveTab('portal');
    }
    if (location.state?.selectedStudent) {
      setCollectTargetStudent(location.state.selectedStudent);
      if (location.state?.targetFeeLedger) {
        setCollectTargetFeeLedger(location.state.targetFeeLedger);
      }
      setIsCollectModalOpen(true);
    }
  }, [location.state]);

  useEffect(() => {
    loadAllData();

    // Supabase Realtime Channel: Listen for changes on fee tables for instant cross-device synchronization
    const channel = supabase
      .channel('fees-portal-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fee_payments' }, () => {
        loadAllData(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_fees' }, () => {
        loadAllData(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fee_categories' }, () => {
        loadAllData(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fee_structure' }, () => {
        loadAllData(false);
      })
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, user]);

  const loadAllData = async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) setIsLoading(true);
    setLoadError(null);
    try {
      const [feeData, cats, txData, clsData, yrData] = await Promise.all([
        feeService.fetchFees({
          academicYearFilter: yearFilter !== 'all' ? yearFilter : undefined,
          statusFilter: statusFilter !== 'all' ? statusFilter : undefined
        }),
        feeService.fetchFeeCategories(),
        feeService.fetchTransactions(),
        supabase.from('classes').select('id, class_name').order('class_name'),
        supabase.from('academic_years').select('id, name, is_current').order('start_date', { ascending: false })
      ]);

      setFees(feeData);
      setFeeCategories(cats);
      setTransactions(txData);

      if (clsData.data) {
        const sorted = clsData.data.sort((a, b) => (parseInt(a.class_name) || 0) - (parseInt(b.class_name) || 0));
        setClasses(sorted);
      }
      if (yrData.data) {
        setAcademicYears(yrData.data);
        const current = yrData.data.find((y: any) => y.is_current) || yrData.data[0];
        if (current) setCurrentYear(current);
      }
    } catch (err: any) {
      console.error('[FeesPortal] Load error:', err);
      setLoadError(err.message || 'Failed to load financial records from database.');
    } finally {
      if (showLoadingIndicator) setIsLoading(false);
    }
  };

  // Compute stats metrics dynamically from real database figures
  const metrics = useMemo(() => {
    const totalDemand = fees.reduce((acc, f) => acc + (f.net_amount || f.total_amount || 0), 0);
    const totalCollected = fees.reduce((acc, f) => acc + (f.amount_paid || 0), 0);
    const totalOutstanding = Math.max(0, totalDemand - totalCollected);
    const collectionRate = totalDemand > 0 ? Math.round((totalCollected / totalDemand) * 100) : 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const todayCollection = transactions
      .filter(t => t.payment_date === todayStr && !t.voided_at)
      .reduce((acc, t) => acc + Number(t.amount_paid || 0), 0);

    return {
      totalDemand,
      totalCollected,
      totalOutstanding,
      collectionRate,
      todayCollection,
      totalInvoices: fees.length,
      pendingInvoices: fees.filter(f => f.status !== 'paid').length
    };
  }, [fees, transactions]);

  const quickFilterCounts = useMemo(() => {
    return {
      all: fees.length,
      defaulters: fees.filter(f => f.remaining_amount > 0).length,
      critical: fees.filter(f => f.remaining_amount >= 5000).length,
      partial: fees.filter(f => f.amount_paid > 0 && f.remaining_amount > 0).length,
      paid: fees.filter(f => f.status === 'paid').length
    };
  }, [fees]);

  // Client-side multi-tier filter & sorting for Student Fee Directory
  const filteredFees = useMemo(() => {
    let result = fees.filter(f => {
      const s = search.toLowerCase().trim();
      const matchesSearch = !s || (
        (f.students?.name && f.students.name.toLowerCase().includes(s)) ||
        (f.students?.admission_number && f.students.admission_number.toLowerCase().includes(s)) ||
        (f.students?.roll_number && f.students.roll_number.toLowerCase().includes(s)) ||
        (f.students?.father_name && f.students.father_name.toLowerCase().includes(s)) ||
        (f.receipt_number && f.receipt_number.toLowerCase().includes(s))
      );

      const matchesClass = classFilter === 'all' || f.students?.class === classFilter || `Class ${f.students?.class}` === classFilter;
      const matchesSection = sectionFilter === 'all' || f.students?.section === sectionFilter;
      const matchesStatus = statusFilter === 'all' || f.status === statusFilter;

      let matchesQuick = true;
      if (quickFilter === 'defaulters') matchesQuick = f.remaining_amount > 0;
      else if (quickFilter === 'critical') matchesQuick = f.remaining_amount >= 5000;
      else if (quickFilter === 'partial') matchesQuick = f.amount_paid > 0 && f.remaining_amount > 0;
      else if (quickFilter === 'paid') matchesQuick = f.status === 'paid';

      return matchesSearch && matchesClass && matchesSection && matchesStatus && matchesQuick;
    });

    // Sort comparator
    result = [...result].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = (a.students?.name || '').localeCompare(b.students?.name || '');
      } else if (sortField === 'class') {
        const aCls = a.students?.class?.toLowerCase().includes('lkg') ? 0 : parseInt(a.students?.class || '0') || 0;
        const bCls = b.students?.class?.toLowerCase().includes('lkg') ? 0 : parseInt(b.students?.class || '0') || 0;
        comparison = aCls - bCls;
      } else if (sortField === 'demand') {
        comparison = (a.total_amount || 0) - (b.total_amount || 0);
      } else if (sortField === 'paid') {
        comparison = (a.amount_paid || 0) - (b.amount_paid || 0);
      } else if (sortField === 'remaining') {
        comparison = (a.remaining_amount || 0) - (b.remaining_amount || 0);
      } else if (sortField === 'status') {
        comparison = (a.status || '').localeCompare(b.status || '');
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [fees, search, classFilter, sectionFilter, statusFilter, quickFilter, sortField, sortOrder]);

  // Pagination for Student Fee Directory
  const totalPages = Math.ceil(filteredFees.length / pageSize) || 1;
  const paginatedFees = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredFees.slice(start, start + pageSize);
  }, [filteredFees, currentPage, pageSize]);

  // Dynamic unique classes from records
  const uniqueClasses = useMemo(() => {
    const set = new Set(fees.map(f => f.students?.class).filter(Boolean));
    return Array.from(set).sort((a: any, b: any) => {
      const aVal = a?.toLowerCase().includes('lkg') ? 0 : parseInt(a) || 99;
      const bVal = b?.toLowerCase().includes('lkg') ? 0 : parseInt(b) || 99;
      return aVal - bVal;
    });
  }, [fees]);

  // Dynamic unique sections from records
  const uniqueSections = useMemo(() => {
    const set = new Set<string>();
    fees.forEach(f => {
      if (f.students?.section) set.add(f.students.section);
    });
    return Array.from(set).sort();
  }, [fees]);

  // Recharts Monthly & Category Aggregations
  const chartData = useMemo(() => {
    const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const monthly = months.map(m => {
      const recs = fees.filter(f => {
        const dateStr = f.due_date || f.created_at;
        if (dateStr) {
          const mName = new Date(dateStr).toLocaleString('en-US', { month: 'short' });
          if (mName.toLowerCase() === m.toLowerCase()) return true;
        }
        if (f.month && f.month.toLowerCase().startsWith(m.toLowerCase())) return true;
        return false;
      });
      const Collected = recs.reduce((acc, f) => acc + (Number(f.amount_paid) || 0), 0);
      const Dues = recs.reduce((acc, f) => acc + (Number(f.remaining_amount) || 0), 0);
      return { name: m, Collected, Dues, Total: Collected + Dues };
    });

    const catMap: Record<string, number> = {};
    fees.forEach(f => {
      const name = f.category_name || 'Academic Fee';
      catMap[name] = (catMap[name] || 0) + (Number(f.amount_paid) || 0);
    });
    const categoryDistribution = Object.entries(catMap).map(([name, value]) => ({ name, value }));

    const modeMap: Record<string, number> = {};
    transactions.filter(t => !t.voided_at).forEach(t => {
      const m = (t.payment_mode || 'cash').toUpperCase();
      modeMap[m] = (modeMap[m] || 0) + Number(t.amount_paid || 0);
    });
    const modeDistribution = Object.entries(modeMap).map(([name, value]) => ({ name, value }));

    return { monthly, categoryDistribution, modeDistribution };
  }, [fees, transactions]);

  // Category-wise Realization Breakdown
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { name: string; demand: number; collected: number; dues: number; count: number }> = {};
    fees.forEach(f => {
      const cat = f.category_name || 'Academic Fee';
      if (!map[cat]) {
        map[cat] = { name: cat, demand: 0, collected: 0, dues: 0, count: 0 };
      }
      map[cat].demand += (f.net_amount || f.total_amount || 0);
      map[cat].collected += (f.amount_paid || 0);
      map[cat].dues += (f.remaining_amount || 0);
      map[cat].count += 1;
    });
    return Object.values(map);
  }, [fees]);

  // Class Collection Realization Matrix
  const classRealizationMatrix = useMemo(() => {
    const map: Record<string, { className: string; demand: number; collected: number; dues: number; count: number }> = {};
    fees.forEach(f => {
      const cls = f.students?.class || 'N/A';
      if (!map[cls]) {
        map[cls] = { className: cls.startsWith('Class') ? cls : `Class ${cls}`, demand: 0, collected: 0, dues: 0, count: 0 };
      }
      map[cls].demand += (f.net_amount || f.total_amount || 0);
      map[cls].collected += (f.amount_paid || 0);
      map[cls].dues += (f.remaining_amount || 0);
      map[cls].count += 1;
    });
    return Object.values(map).sort((a, b) => {
      const aNum = parseInt(a.className.replace(/\D/g, '')) || 0;
      const bNum = parseInt(b.className.replace(/\D/g, '')) || 0;
      return aNum - bNum;
    });
  }, [fees]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (filteredFees.length === 0) return toast.error('No fee records to export.');

    const headers = ['Receipt No', 'Admission No', 'Student Name', 'Class', 'Section', 'Fee Category', 'Academic Year', 'Total Demand (INR)', 'Paid (INR)', 'Outstanding (INR)', 'Status'];
    const rows = filteredFees.map(f => [
      f.receipt_number || '',
      f.students?.admission_number || '',
      f.students?.name || '',
      f.students?.class || '',
      f.students?.section || '',
      f.category_name,
      f.academic_year,
      f.total_amount,
      f.amount_paid,
      f.remaining_amount,
      f.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SDPS_Fee_Ledgers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredFees.length} fee ledgers to CSV.`);
  };

  const handlePaymentSuccess = (result: CollectFeeResult, student: any) => {
    loadAllData();
    // Prompt to view / print receipt
    setReceiptTargetFee({
      id: result.studentFeeId,
      receipt_number: result.receiptNumber,
      paid_amount: result.amountPaid,
      total_amount: result.netAmount,
      remaining_amount: result.balance,
      payment_date: new Date().toISOString().split('T')[0],
      category_name: 'Academic Fee',
      students: student
    });
    setIsReceiptModalOpen(true);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16 select-none">
      {/* 1. Master Toolbar Header */}
      <AdminHeader
        title="Institutional Finance & Fee Management"
        subtitle="Authoritative fee ledgers, cashier collection desk, grade structures & CBSE receipts."
        badge={{
          icon: Wallet,
          text: 'Treasury & Revenue Hub',
          variant: 'emerald'
        }}
        sessionBadge="Session: 2026-27"
        actions={
          <>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50/80 text-emerald-700 border border-emerald-200/80 rounded-xl text-[11px] font-bold shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Live DB Sync Active</span>
            </div>

            <button
              onClick={() => loadAllData(true)}
              disabled={isLoading}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
              title="Sync Financials Database"
            >
              <RefreshCcw className={cn("w-4 h-4", isLoading && "animate-spin text-emerald-600")} />
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>

            {!isStudentOrParent && can('fees.collect') && (
              <button
                onClick={() => {
                  setCollectTargetStudent(null);
                  setCollectTargetFeeLedger(null);
                  setIsCollectModalOpen(true);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" /> Collect Fee Payment
              </button>
            )}
          </>
        }
      />

      {/* 2. Top KPI Financial Cockpit Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <AdminStatCard
          label="Total Demand Billed"
          value={`₹${metrics.totalDemand.toLocaleString()}`}
          subtext={`${metrics.totalInvoices} ledger entries`}
          icon={Wallet}
          variant="primary"
        />
        <AdminStatCard
          label="Realized Collection"
          value={`₹${metrics.totalCollected.toLocaleString()}`}
          subtext={`${metrics.collectionRate}% collection realization`}
          icon={CheckCircle2}
          variant="emerald"
        />
        <AdminStatCard
          label="Outstanding Balance Dues"
          value={`₹${metrics.totalOutstanding.toLocaleString()}`}
          subtext={`${metrics.pendingInvoices} accounts with dues`}
          icon={AlertCircle}
          variant="rose"
        />
        <AdminStatCard
          label="Today's Realized Cashflow"
          value={`₹${metrics.todayCollection.toLocaleString()}`}
          subtext="Cleared cashier intake"
          icon={TrendingUp}
          variant="violet"
        />
      </div>

      {/* 3. Sub-Navigation Tabs Bar */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-2 shadow-xs flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveTab('portal')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
            activeTab === 'portal'
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          )}
        >
          <BarChart3 className="w-4 h-4" /> Financial Cockpit
        </button>

        <button
          onClick={() => setActiveTab('student_fees')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
            activeTab === 'student_fees'
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          )}
        >
          <Users className="w-4 h-4" /> Student Fee Directory & Ledgers
        </button>

        {!isStudentOrParent && (
          <button
            onClick={() => setActiveTab('fee_structure')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'fee_structure'
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <Layers className="w-4 h-4" /> Fee Structure Master
          </button>
        )}

        <button
          onClick={() => setActiveTab('recent_payments')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
            activeTab === 'recent_payments'
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          )}
        >
          <History className="w-4 h-4" /> Transaction History & Receipts ({transactions.length})
        </button>

        <button
          onClick={() => setActiveTab('fee_reports')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
            activeTab === 'fee_reports'
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          )}
        >
          <FileText className="w-4 h-4" /> Financial Statements & Defaulters
        </button>
      </div>

      {/* 4. Active Workspace Views */}

      {/* TAB 1: Financial Cockpit & Analytics */}
      {activeTab === 'portal' && (
        <div className="space-y-6">
          
          {/* Quick Action Workflow Hub Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => {
                setCollectTargetStudent(null);
                setCollectTargetFeeLedger(null);
                setIsCollectModalOpen(true);
              }}
              className="p-3.5 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl flex items-center justify-between shadow-xs transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Plus className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <span className="text-xs sm:text-sm font-semibold block leading-tight">Cashier Intake</span>
                  <span className="text-[11px] text-emerald-100 font-normal">Record Fee Payment</span>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-white/70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>

            <button
              onClick={() => setActiveTab('fee_reports')}
              className="p-3.5 bg-gradient-to-br from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-2xl flex items-center justify-between shadow-xs transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <span className="text-xs sm:text-sm font-semibold block leading-tight">Defaulters Roster</span>
                  <span className="text-[11px] text-rose-100 font-normal">{metrics.pendingInvoices} pending accounts</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/70 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              onClick={() => setActiveTab('recent_payments')}
              className="p-3.5 bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-2xl flex items-center justify-between shadow-xs transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Receipt className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <span className="text-xs sm:text-sm font-semibold block leading-tight">Audit Receipts</span>
                  <span className="text-[11px] text-violet-100 font-normal">{transactions.length} cleared entries</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/70 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              onClick={() => setActiveTab('fee_structure')}
              className="p-3.5 bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white rounded-2xl flex items-center justify-between shadow-xs transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Layers className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <span className="text-xs sm:text-sm font-semibold block leading-tight">Grade Matrix</span>
                  <span className="text-[11px] text-slate-300 font-normal">Fee Structures</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/70 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Revenue Velocity & Channels Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Monthly Trend Area Chart */}
            <div className="lg:col-span-2 bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                      <TrendingUp className="w-4 h-4" />
                    </span>
                    <h3 className="text-sm font-semibold text-slate-800">
                      Monthly Revenue Collection Velocity
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 font-normal mt-0.5">Realized collections vs outstanding dues across CBSE academic months</p>
                </div>

                <div className="flex items-center gap-4 text-xs font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-slate-600">Collected (₹{metrics.totalCollected.toLocaleString()})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-slate-600">Dues (₹{metrics.totalOutstanding.toLocaleString()})</span>
                  </div>
                </div>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.monthly}>
                    <defs>
                      <linearGradient id="colCollected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colDues" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} fontStyle="bold" />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={11} 
                      tickFormatter={(val) => val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : `₹${(val / 1000).toFixed(0)}k`} 
                    />
                    <Tooltip 
                      formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, '']}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                    />
                    <Area type="monotone" dataKey="Collected" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colCollected)" />
                    <Area type="monotone" dataKey="Dues" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colDues)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Payment Modes Pie Chart */}
            <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-display font-black text-slate-800 uppercase tracking-wider">
                  Payment Tender Breakdown
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Realized funds distribution by channel</p>
              </div>

              <div className="h-44 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.modeDistribution.length > 0 ? chartData.modeDistribution : [{ name: 'CASH', value: 100 }]}
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {(chartData.modeDistribution.length > 0 ? chartData.modeDistribution : [{ name: 'CASH', value: 100 }]).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                {chartData.modeDistribution.map((m, idx) => (
                  <div key={m.name} className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                    <div className="truncate">
                      <span className="text-[10px] text-slate-400 font-bold block">{m.name}</span>
                      <strong className="text-xs text-slate-900 font-mono">₹{m.value.toLocaleString()}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Fee Category Performance Matrix */}
          <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-display font-black text-slate-800 uppercase tracking-wider">
                  Fee Head Realization Matrix
                </h3>
                <p className="text-[11px] text-slate-400">Institutional collection realization performance by fee category</p>
              </div>
              <span className="text-xs font-bold text-slate-400">{categoryBreakdown.length} fee heads active</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {categoryBreakdown.map(cat => {
                const rate = cat.demand > 0 ? Math.round((cat.collected / cat.demand) * 100) : 0;
                return (
                  <div key={cat.name} className="p-4 bg-slate-50/70 border border-slate-200/70 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs truncate max-w-[180px]">{cat.name}</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[10px] font-black uppercase",
                        rate >= 80 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        rate >= 50 ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        "bg-rose-50 text-rose-700 border border-rose-200"
                      )}>
                        {rate}% Cleared
                      </span>
                    </div>

                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all duration-500", rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-500" : "bg-rose-500")}
                        style={{ width: `${Math.min(100, rate)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <div>
                        <span className="text-slate-400 text-[9px] uppercase font-bold block">Collected</span>
                        <strong className="text-emerald-700 font-mono">₹{cat.collected.toLocaleString()}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 text-[9px] uppercase font-bold block">Outstanding</span>
                        <strong className="text-rose-700 font-mono">₹{cat.dues.toLocaleString()}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Transaction Feed */}
          <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-display font-black text-slate-800 uppercase tracking-wider">
                Recent Cashier Transactions
              </h3>
              <button
                onClick={() => setActiveTab('recent_payments')}
                className="text-xs font-bold text-violet-600 hover:text-violet-800 flex items-center gap-1 cursor-pointer"
              >
                View All Receipts <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {transactions.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">No payment transactions recorded yet.</div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs font-medium">
                {transactions.slice(0, 5).map(t => (
                  <div key={t.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">
                          {t.student_fees?.students?.name || 'Student'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {t.receipt_number} • {t.payment_date} • Mode: <span className="uppercase">{t.payment_mode}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-extrabold text-emerald-700">₹{Number(t.amount_paid).toFixed(2)}</div>
                      {t.voided_at ? (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">VOIDED</span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">CLEARED</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Student Fee Directory & Ledger Management */}
      {activeTab === 'student_fees' && (
        <div className="space-y-4">
          
          {/* Quick Filter Status Badges Ribbon */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setQuickFilter('all'); setCurrentPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs",
                quickFilter === 'all'
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              All Ledgers ({quickFilterCounts.all})
            </button>
            <button
              onClick={() => { setQuickFilter('defaulters'); setCurrentPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5",
                quickFilter === 'defaulters'
                  ? "bg-rose-600 text-white"
                  : "bg-white border border-slate-200 text-rose-600 hover:bg-rose-50"
              )}
            >
              <AlertCircle className="w-3.5 h-3.5" /> Defaulters ({quickFilterCounts.defaulters})
            </button>
            <button
              onClick={() => { setQuickFilter('critical'); setCurrentPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5",
                quickFilter === 'critical'
                  ? "bg-rose-800 text-white"
                  : "bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100"
              )}
            >
              <Zap className="w-3.5 h-3.5" /> Critical (&gt; ₹5k) ({quickFilterCounts.critical})
            </button>
            <button
              onClick={() => { setQuickFilter('partial'); setCurrentPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5",
                quickFilter === 'partial'
                  ? "bg-amber-600 text-white"
                  : "bg-white border border-slate-200 text-amber-600 hover:bg-amber-50"
              )}
            >
              <Clock className="w-3.5 h-3.5" /> Partial ({quickFilterCounts.partial})
            </button>
            <button
              onClick={() => { setQuickFilter('paid'); setCurrentPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5",
                quickFilter === 'paid'
                  ? "bg-emerald-600 text-white"
                  : "bg-white border border-slate-200 text-emerald-600 hover:bg-emerald-50"
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Settled ({quickFilterCounts.paid})
            </button>
          </div>

          {/* Search & Multi-tier Filter Controls */}
          <div className="bg-white border border-slate-200/60 rounded-2xl p-4.5 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2.5 w-full md:w-auto flex-1">
              <div className="relative flex-1 sm:max-w-xs min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  placeholder="Search student, admission no, roll..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 text-slate-800 font-medium"
                />
              </div>

              <select
                value={classFilter}
                onChange={(e) => { setClassFilter(e.target.value); setCurrentPage(1); }}
                className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-bold outline-none cursor-pointer"
              >
                <option value="all">All Classes</option>
                {uniqueClasses.map(c => (
                  <option key={c} value={c}>{c.startsWith('Class') ? c : `Class ${c}`}</option>
                ))}
              </select>

              <select
                value={sectionFilter}
                onChange={(e) => { setSectionFilter(e.target.value); setCurrentPage(1); }}
                className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-bold outline-none cursor-pointer"
              >
                <option value="all">All Sections</option>
                {uniqueSections.map(sec => (
                  <option key={sec} value={sec}>Section {sec}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-bold outline-none cursor-pointer"
              >
                <option value="all">All Fee Status</option>
                <option value="paid">Fully Paid</option>
                <option value="partial">Partially Paid</option>
                <option value="pending">Pending / Due</option>
              </select>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-display font-black text-slate-800 uppercase tracking-wider">
                Student Fee Ledgers Roster
              </h3>
              <span className="text-xs font-bold text-slate-400">{filteredFees.length} ledgers found</span>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-48">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-2" />
                <span className="text-xs text-slate-500">Loading fee ledgers...</span>
              </div>
            ) : filteredFees.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400 space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
                <div className="font-bold text-slate-700">No student fee ledgers match current filters</div>
                <p>Try resetting filters or record a new fee payment.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-400 font-black">
                      <th 
                        onClick={() => {
                          setSortField('name');
                          setSortOrder(prev => sortField === 'name' ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
                        }}
                        className="py-2.5 px-3 cursor-pointer hover:text-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          Student Details {sortField === 'name' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-slate-800" /> : <ArrowDown className="w-3 h-3 text-slate-800" />)}
                        </div>
                      </th>
                      <th className="py-2.5 px-3">Admission & Roll</th>
                      <th 
                        onClick={() => {
                          setSortField('class');
                          setSortOrder(prev => sortField === 'class' ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
                        }}
                        className="py-2.5 px-3 cursor-pointer hover:text-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          Class & Section {sortField === 'class' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-slate-800" /> : <ArrowDown className="w-3 h-3 text-slate-800" />)}
                        </div>
                      </th>
                      <th className="py-2.5 px-3">Fee Head</th>
                      <th 
                        onClick={() => {
                          setSortField('demand');
                          setSortOrder(prev => sortField === 'demand' ? (prev === 'asc' ? 'desc' : 'asc') : 'desc');
                        }}
                        className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-800 transition-colors"
                      >
                        <div className="flex items-center justify-end gap-1">
                          Total Demand {sortField === 'demand' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-slate-800" /> : <ArrowDown className="w-3 h-3 text-slate-800" />)}
                        </div>
                      </th>
                      <th 
                        onClick={() => {
                          setSortField('paid');
                          setSortOrder(prev => sortField === 'paid' ? (prev === 'asc' ? 'desc' : 'asc') : 'desc');
                        }}
                        className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-800 transition-colors"
                      >
                        <div className="flex items-center justify-end gap-1">
                          Paid {sortField === 'paid' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-slate-800" /> : <ArrowDown className="w-3 h-3 text-slate-800" />)}
                        </div>
                      </th>
                      <th 
                        onClick={() => {
                          setSortField('remaining');
                          setSortOrder(prev => sortField === 'remaining' ? (prev === 'asc' ? 'desc' : 'asc') : 'desc');
                        }}
                        className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-800 transition-colors"
                      >
                        <div className="flex items-center justify-end gap-1">
                          Outstanding {sortField === 'remaining' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-slate-800" /> : <ArrowDown className="w-3 h-3 text-slate-800" />)}
                        </div>
                      </th>
                      <th 
                        onClick={() => {
                          setSortField('status');
                          setSortOrder(prev => sortField === 'status' ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
                        }}
                        className="py-2.5 px-3 cursor-pointer hover:text-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          Status {sortField === 'status' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-slate-800" /> : <ArrowDown className="w-3 h-3 text-slate-800" />)}
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {paginatedFees.map(fee => (
                      <tr key={fee.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{fee.students?.name || 'N/A'}</div>
                          <div className="text-[10px] text-slate-400">Father: {fee.students?.father_name || 'N/A'}</div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-mono font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded border border-violet-100 text-[11px]">
                            {fee.students?.admission_number || 'N/A'}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-800">Class {fee.students?.class} - {fee.students?.section}</span>
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-700">{fee.category_name}</span>
                          <div className="text-[10px] text-slate-400">Due: {fee.due_date || 'N/A'}</div>
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                          ₹{fee.total_amount.toFixed(2)}
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                          ₹{fee.amount_paid.toFixed(2)}
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-extrabold text-rose-700 text-sm">
                          ₹{fee.remaining_amount.toFixed(2)}
                        </td>

                        <td className="py-3 px-3">
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                            STATUS_STYLES[fee.status] || STATUS_STYLES.pending
                          )}>
                            {fee.status}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {fee.remaining_amount > 0 && !isStudentOrParent && (
                              <button
                                onClick={() => {
                                  setCollectTargetStudent(fee.students);
                                  setCollectTargetFeeLedger(fee);
                                  setIsCollectModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg transition-colors cursor-pointer shadow-2xs"
                              >
                                Pay
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setReceiptTargetFee(fee);
                                setIsReceiptModalOpen(true);
                              }}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              title="Print / View Receipt"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {filteredFees.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                <div className="text-slate-500 font-medium">
                  Showing <span className="font-bold text-slate-800">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                  <span className="font-bold text-slate-800">{Math.min(currentPage * pageSize, filteredFees.length)}</span> of{' '}
                  <span className="font-bold text-slate-800">{filteredFees.length}</span> ledgers
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg disabled:opacity-40 cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="px-2 font-bold text-slate-700">Page {currentPage} of {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Fee Structure Master */}
      {activeTab === 'fee_structure' && !isStudentOrParent && (
        <FeeStructureManager
          classes={classes.length > 0 ? classes : uniqueClasses.map(c => ({ id: c, class_name: c }))}
          academicYears={academicYears.length > 0 ? academicYears : [{ id: '2026-27', name: '2026-27' }]}
          currentAcademicYear={currentYear || { id: '2026-27', name: '2026-27' }}
        />
      )}

      {/* TAB 4: Transaction History & Receipts */}
      {activeTab === 'recent_payments' && (
        <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-display font-black text-slate-800 uppercase tracking-wider">
              Cashier Transaction Journal & Audit Trail
            </h3>
            <span className="text-xs font-bold text-slate-400">{transactions.length} transactions posted</span>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400">No payment transactions found in database.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-400 font-black">
                    <th className="py-2.5 px-3">Receipt Number</th>
                    <th className="py-2.5 px-3">Payment Date</th>
                    <th className="py-2.5 px-3">Student Particulars</th>
                    <th className="py-2.5 px-3">Payment Mode</th>
                    <th className="py-2.5 px-3 text-right">Amount Paid (INR)</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {transactions.map(t => (
                    <tr key={t.id} className={cn("hover:bg-slate-50 transition-colors", t.voided_at && "opacity-60 bg-rose-50/20")}>
                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded border border-violet-100 text-[11px]">
                          {t.receipt_number}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-600">{t.payment_date}</td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{t.student_fees?.students?.name || 'Student'}</div>
                        <div className="text-[10px] text-slate-400">
                          Class {t.student_fees?.students?.class}-{t.student_fees?.students?.section} • ADM: {t.student_fees?.students?.admission_number || 'N/A'}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="capitalize font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                          {t.payment_mode}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-700 text-sm">
                        ₹{Number(t.amount_paid).toFixed(2)}
                      </td>

                      <td className="py-3 px-3">
                        {t.voided_at ? (
                          <div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                              VOIDED
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-xs" title={t.void_reason}>
                              Reason: {t.void_reason}
                            </div>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                            CLEARED
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setReceiptTargetFee({
                                id: t.student_fee_id,
                                receipt_number: t.receipt_number,
                                transaction_id: t.transaction_id,
                                paid_amount: t.amount_paid,
                                total_amount: t.student_fees?.total_amount || t.amount_paid,
                                remaining_amount: (t.student_fees?.net_amount || t.student_fees?.total_amount || t.amount_paid) - t.amount_paid,
                                payment_date: t.payment_date,
                                payment_mode: t.payment_mode,
                                category_name: t.student_fees?.fee_categories?.category_name || 'Academic Fee',
                                students: t.student_fees?.students
                              });
                              setIsReceiptModalOpen(true);
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            title="Print Receipt"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {!t.voided_at && !isStudentOrParent && (
                            <button
                              onClick={() => {
                                setVoidTargetPayment(t);
                                setIsVoidModalOpen(true);
                              }}
                              className="p-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              title="Void Payment"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Financial Statements & Defaulters */}
      {activeTab === 'fee_reports' && (
        <FeeReportsView
          fees={fees}
          classes={classes.length > 0 ? classes : uniqueClasses.map(c => ({ id: c, class_name: c }))}
          onOpenCollectModal={(ledger) => {
            setCollectTargetStudent(ledger.students);
            setCollectTargetFeeLedger(ledger);
            setIsCollectModalOpen(true);
          }}
        />
      )}

      {/* MODALS */}
      <FeeCollectionModal
        isOpen={isCollectModalOpen}
        onClose={() => {
          setIsCollectModalOpen(false);
          setCollectTargetStudent(null);
          setCollectTargetFeeLedger(null);
        }}
        students={fees.map(f => f.students).filter(Boolean)}
        preSelectedStudent={collectTargetStudent}
        targetFeeLedger={collectTargetFeeLedger}
        feeCategories={feeCategories}
        currentAcademicYear={currentYear || { id: '2026-27', name: '2026-27' }}
        onPaymentSuccess={handlePaymentSuccess}
      />

      <FeeReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setReceiptTargetFee(null);
        }}
        fee={receiptTargetFee}
      />

      <FeeVoidModal
        isOpen={isVoidModalOpen}
        onClose={() => {
          setIsVoidModalOpen(false);
          setVoidTargetPayment(null);
        }}
        payment={voidTargetPayment}
        onSuccess={loadAllData}
      />

    </div>
  );
}
