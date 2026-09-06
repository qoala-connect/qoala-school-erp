import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Download,
  XCircle,
  Phone,
  RefreshCcw,
  GraduationCap,
  Plus,
  ClipboardList,
  Eye,
  Printer,
  Check,
  AlertTriangle,
  X,
  Edit3,
  MoreVertical,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  UserCheck,
  Users,
  Clock,
  FileCheck2,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  LayoutGrid,
  ListFilter,
  BarChart3,
  Copy,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  Calendar,
  Layers,
  Send,
  SlidersHorizontal,
  CheckCheck,
  Columns3,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { AdmissionRecord, AdmissionStatus } from '@/types/admission';
import { admissionService } from '@/services/admissionService';
import AdmissionLetterModal from '@/components/admissions/AdmissionLetterModal';
import AdmissionDetailsDrawer from '@/components/admissions/AdmissionDetailsDrawer';
import AdmissionRejectModal from '@/components/admissions/AdmissionRejectModal';
import AdmissionApplicationFormModal from '@/components/admissions/AdmissionApplicationFormModal';
import { StatusBadge, Avatar, filterCls } from '@/components/admissions/AdmissionUI';
import { AdminHeader } from '@/components/common/AdminHeader';
import { AdminStatCard } from '@/components/common/AdminStatCard';
import { useLocation, useNavigate } from 'react-router-dom';

type SortField = 'name' | 'class' | 'created_at' | 'status' | null;
type SortDir = 'asc' | 'desc';
type ViewMode = 'table' | 'kanban' | 'analytics';

export type ColumnKey = 'applicant' | 'class' | 'session' | 'guardian' | 'documents' | 'status' | 'applied_on' | 'actions';

export interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  description: string;
  alwaysVisible?: boolean;
}

export const ALL_COLUMNS: ColumnDefinition[] = [
  { key: 'applicant', label: 'Applicant Details', description: 'Name, photo, tracking ID & caste category', alwaysVisible: true },
  { key: 'class', label: 'Class & Section', description: 'Assigned grade and section' },
  { key: 'session', label: 'Academic Session', description: 'Target academic year' },
  { key: 'guardian', label: 'Guardian & Contact', description: 'Father name, direct phone & WhatsApp' },
  { key: 'documents', label: 'Verification Progress', description: 'Uploaded & verified document status' },
  { key: 'status', label: 'Application Status', description: 'Pipeline lifecycle badge' },
  { key: 'applied_on', label: 'Submission Date', description: 'Original application timestamp' },
  { key: 'actions', label: 'Quick Actions', description: 'Enrol, print, view, more menu', alwaysVisible: true },
];

const DEFAULT_VISIBLE_COLUMNS: Record<ColumnKey, boolean> = {
  applicant: true,
  class: true,
  session: false,
  guardian: true,
  documents: true,
  status: true,
  applied_on: true,
  actions: true,
};

function formatDate(dateStr: string) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function appNumber(admission: AdmissionRecord) {
  return admission.application_number || `SJS-${admission.id.slice(0, 8).toUpperCase()}`;
}

export default function AdmissionsManagement() {
  const { role, can } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Master data
  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isCompactDensity, setIsCompactDensity] = useState(false);

  // Column Visibility state with localStorage persistence
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(() => {
    try {
      const saved = localStorage.getItem('sjs_admissions_table_columns_v2');
      if (saved) return { ...DEFAULT_VISIBLE_COLUMNS, ...JSON.parse(saved) };
    } catch {
      // fallback
    }
    return DEFAULT_VISIBLE_COLUMNS;
  });

  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  const toggleColumn = (key: ColumnKey) => {
    if (key === 'applicant' || key === 'actions') return; // mandatory
    setVisibleColumns(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('sjs_admissions_table_columns_v2', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const applyPreset = (preset: 'default' | 'compact' | 'contact' | 'audit' | 'all') => {
    let presetCols: Record<ColumnKey, boolean>;
    if (preset === 'compact') {
      presetCols = { applicant: true, class: true, session: false, guardian: false, documents: false, status: true, applied_on: false, actions: true };
    } else if (preset === 'contact') {
      presetCols = { applicant: true, class: true, session: false, guardian: true, documents: false, status: true, applied_on: false, actions: true };
    } else if (preset === 'audit') {
      presetCols = { applicant: true, class: true, session: true, guardian: true, documents: true, status: true, applied_on: true, actions: true };
    } else if (preset === 'all') {
      presetCols = { applicant: true, class: true, session: true, guardian: true, documents: true, status: true, applied_on: true, actions: true };
    } else {
      presetCols = DEFAULT_VISIBLE_COLUMNS;
    }
    setVisibleColumns(presetCols);
    try {
      localStorage.setItem('sjs_admissions_table_columns_v2', JSON.stringify(presetCols));
    } catch {}
    toast.success(`Applied ${preset.toUpperCase()} column view preset`);
  };
  // Reference metadata
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>(() => location.state?.statusFilter || 'all');
  const [academicYearFilter, setAcademicYearFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Sort
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Selection & Pagination
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Row action menu
  const [openMenu, setOpenMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Modals & Drawers
  const [selectedDrawerRecord, setSelectedDrawerRecord] = useState<AdmissionRecord | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedRejectRecord, setSelectedRejectRecord] = useState<AdmissionRecord | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedLetterRecord, setSelectedLetterRecord] = useState<AdmissionRecord | null>(null);
  const [isLetterModalOpen, setIsLetterModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AdmissionRecord | null>(null);

  const openEditModal = (admission: AdmissionRecord) => {
    setEditingRecord(admission);
    setIsCreateModalOpen(true);
  };

  // Close column picker on outside interaction
  useEffect(() => {
    if (!isColumnPickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setIsColumnPickerOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsColumnPickerOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isColumnPickerOpen]);

  // Close action menu on outside interaction
  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [openMenu]);

  // Sync state filter if navigated from sidebar
  useEffect(() => {
    if (location.state?.statusFilter) {
      setStatusFilter(location.state.statusFilter);
    }
  }, [location.state?.statusFilter]);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [admList, refData] = await Promise.all([
        admissionService.fetchAdmissions({}),
        admissionService.fetchReferenceData()
      ]);

      setAdmissions(admList);
      setSelectedDrawerRecord(prev => {
        if (!prev) return null;
        return admList.find(a => a.id === prev.id) || prev;
      });
      setClasses(refData.classes.sort((a: any, b: any) =>
        (parseInt(a.class_name?.replace(/\D/g, '') || '0') || 0) - (parseInt(b.class_name?.replace(/\D/g, '') || '0') || 0)
      ));
      setSections(refData.sections);
      setAcademicYears(refData.academicYears);
    } catch (err: any) {
      console.error('[AdmissionsManagement.loadData] Error:', err);
      setLoadError(err.message || 'Failed to load admissions from database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Multi-field search and filter
  const filteredAdmissions = useMemo(() => {
    const s = search.toLowerCase().trim();
    return admissions.filter(item => {
      const matchesSearch = !s ||
        (item.name && item.name.toLowerCase().includes(s)) ||
        (item.application_number && item.application_number.toLowerCase().includes(s)) ||
        (item.father_name && item.father_name.toLowerCase().includes(s)) ||
        (item.mother_name && item.mother_name.toLowerCase().includes(s)) ||
        (item.phone && item.phone.includes(s)) ||
        (item.email && item.email.toLowerCase().includes(s));

      const matchesClass = classFilter === 'all' || item.class === classFilter || `Class ${item.class}` === classFilter;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesYear = academicYearFilter === 'all' || item.academic_year === academicYearFilter;
      const matchesCategory = categoryFilter === 'all' || (item.category || 'General') === categoryFilter;

      return matchesSearch && matchesClass && matchesStatus && matchesYear && matchesCategory;
    });
  }, [admissions, search, classFilter, statusFilter, academicYearFilter, categoryFilter]);

  // Sort
  const sortedAdmissions = useMemo(() => {
    if (!sortField) return filteredAdmissions;
    return [...filteredAdmissions].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      if (sortField === 'name') { aVal = a.name || ''; bVal = b.name || ''; }
      else if (sortField === 'class') {
        aVal = parseInt(a.class?.replace(/\D/g, '') || '0') || 0;
        bVal = parseInt(b.class?.replace(/\D/g, '') || '0') || 0;
      }
      else if (sortField === 'created_at') {
        aVal = a.created_at || '';
        bVal = b.created_at || '';
      }
      else if (sortField === 'status') { aVal = a.status || ''; bVal = b.status || ''; }

      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      }
      return sortDir === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal;
    });
  }, [filteredAdmissions, sortField, sortDir]);

  // Pagination
  const totalPages = Math.ceil(sortedAdmissions.length / pageSize) || 1;
  const paginatedAdmissions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedAdmissions.slice(start, start + pageSize);
  }, [sortedAdmissions, currentPage, pageSize]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = admissions.length;
    const pending = admissions.filter(a => a.status === 'Pending').length;
    const review = admissions.filter(a => a.status === 'Under Review' || a.status === 'Documents Verification' || a.status === 'In Review' || a.status === 'Interview Scheduled').length;
    const approved = admissions.filter(a => a.status === 'Approved' || a.status === 'Student Created').length;
    const rejected = admissions.filter(a => a.status === 'Rejected' || a.status === 'Cancelled').length;
    return { total, pending, review, approved, rejected };
  }, [admissions]);

  const summaryCards: { key: string; label: string; hint: string; value: number; icon: any; variant: 'primary' | 'amber' | 'sky' | 'emerald' | 'rose' }[] = [
    { key: 'all', label: 'Total Queue', hint: 'All applications', value: metrics.total, icon: ClipboardList, variant: 'primary' },
    { key: 'Pending', label: 'Pending Review', hint: 'Awaiting action', value: metrics.pending, icon: Clock, variant: 'amber' },
    { key: 'Under Review', label: 'In Verification', hint: 'Docs & interview', value: metrics.review, icon: FileCheck2, variant: 'sky' },
    { key: 'Student Created', label: 'Enrolled in SIS', hint: 'Confirmed students', value: metrics.approved, icon: UserCheck, variant: 'emerald' },
    { key: 'Rejected', label: 'Rejected', hint: 'Archived records', value: metrics.rejected, icon: XCircle, variant: 'rose' },
  ];

  // Copy helper
  const handleCopyAppNo = (num: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(num);
    setCopiedId(num);
    toast.success(`Copied application ID: ${num}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Sort toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setCurrentPage(1);
  };

  const SortButton = ({ field, label, className }: { field: SortField; label: string; className?: string }) => {
    const active = sortField === field;
    return (
      <button
        onClick={() => handleSort(field)}
        aria-label={`Sort by ${label}`}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors cursor-pointer hover:bg-slate-200/60 font-bold',
          active ? 'text-blue-800 bg-blue-50' : 'text-slate-600',
          className
        )}
      >
        <span>{label}</span>
        {!active
          ? <ArrowUpDown className="w-3 h-3 opacity-40" />
          : sortDir === 'asc'
            ? <ArrowUp className="w-3 h-3 text-blue-700" />
            : <ArrowDown className="w-3 h-3 text-blue-700" />}
      </button>
    );
  };

  const resetAllFilters = () => {
    setSearch('');
    setClassFilter('all');
    setStatusFilter('all');
    setAcademicYearFilter('all');
    setCategoryFilter('all');
    setCurrentPage(1);
  };

  const openDrawerFor = (admission: AdmissionRecord) => {
    setSelectedDrawerRecord(admission);
    setIsDrawerOpen(true);
  };

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds(prev => checked ? [...prev, id] : prev.filter(x => x !== id));
  };

  // Single Click Fast-Track Enrol
  const handleFastTrackEnrol = async (admission: AdmissionRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    toast.loading(`Fast-tracking enrolment for ${admission.name}…`, { id: `enrol-${admission.id}` });
    try {
      const res = await admissionService.approveAdmission(admission.id, admission.section || 'A', null);
      toast.success(`${admission.name} enrolled with roll no. ${res?.roll_number || 'auto-assigned'}!`, { id: `enrol-${admission.id}` });
      await loadData();
    } catch (err: any) {
      toast.error(`Enrolment failed: ${err.message}`, { id: `enrol-${admission.id}` });
    }
  };

  // Bulk approve
  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;

    const targets = admissions.filter(a => selectedIds.includes(a.id));
    const pendingOnly = targets.filter(a => a.status !== 'Approved' && a.status !== 'Student Created' && a.status !== 'Rejected');

    if (pendingOnly.length === 0) {
      toast.error('Selected applications are already processed.');
      return;
    }

    toast.loading(`Enrolling ${pendingOnly.length} candidates…`, { id: 'bulk-approve' });
    let successCount = 0;
    for (const admission of pendingOnly) {
      try {
        await admissionService.approveAdmission(admission.id, admission.section || 'A', null);
        successCount++;
      } catch (err) {
        console.error(`Error approving ${admission.id}:`, err);
      }
    }
    toast.success(`Successfully enrolled ${successCount} of ${pendingOnly.length} students!`, { id: 'bulk-approve' });
    setSelectedIds([]);
    await loadData();
  };

  // Export CSV
  const handleExportCSV = (selectedOnly = false) => {
    const list = selectedOnly
      ? sortedAdmissions.filter(a => selectedIds.includes(a.id))
      : sortedAdmissions;

    if (list.length === 0) {
      toast.error('No records available to export.');
      return;
    }
    const headers = ['Application No', 'Student Name', 'Class', 'Section', 'Academic Year', 'Father Name', 'Phone', 'Email', 'Category', 'Status', 'Applied On'];
    const rows = list.map(a => [
      a.application_number || `SJS-${a.id.slice(0, 8)}`,
      a.name,
      a.class,
      a.section || 'A',
      a.academic_year,
      a.father_name,
      a.phone || '',
      a.email || '',
      a.category || 'General',
      a.status,
      formatDate(a.created_at)
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SJS_Admissions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${list.length} admission records to CSV.`);
  };

  const handleOpenMenu = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    if (openMenu?.id === id) { setOpenMenu(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 224;
    const menuHeight = 220;
    const spaceBelow = window.innerHeight - rect.bottom;
    setOpenMenu({
      id,
      top: spaceBelow < menuHeight ? Math.max(8, rect.top - menuHeight - 6) : rect.bottom + 6,
      left: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)),
    });
  };

  const openMenuRecord = openMenu ? paginatedAdmissions.find(a => a.id === openMenu.id) : null;
  const allPageSelected = paginatedAdmissions.length > 0 && paginatedAdmissions.every(a => selectedIds.includes(a.id));
  const somePageSelected = paginatedAdmissions.some(a => selectedIds.includes(a.id));

  const documentProgress = (admission: AdmissionRecord) => {
    const docs = admission.documents || [];
    return { verified: docs.filter(d => d.status === 'Verified').length, total: docs.length };
  };

  const filterChips = [
    statusFilter !== 'all' && { label: `Status: ${statusFilter}`, clear: () => setStatusFilter('all') },
    classFilter !== 'all' && { label: `Class ${classFilter}`, clear: () => setClassFilter('all') },
    academicYearFilter !== 'all' && { label: `Session ${academicYearFilter}`, clear: () => setAcademicYearFilter('all') },
    categoryFilter !== 'all' && { label: `Category: ${categoryFilter}`, clear: () => setCategoryFilter('all') },
    search.trim() !== '' && { label: `“${search.trim()}”`, clear: () => setSearch('') },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  // Kanban Stage Definition
  const kanbanColumns = [
    { id: 'Pending', label: '1. New Enquiries & Pending', statusKey: 'Pending', color: 'border-amber-400 bg-amber-500/10 text-amber-700' },
    { id: 'Under Review', label: '2. Under Verification', statusKey: 'Under Review', color: 'border-blue-500 bg-blue-500/10 text-blue-700' },
    { id: 'Interview Scheduled', label: '3. Interview & Assessment', statusKey: 'Interview Scheduled', color: 'border-indigo-500 bg-indigo-500/10 text-indigo-700' },
    { id: 'Student Created', label: '4. Enrolled in SIS', statusKey: 'Student Created', color: 'border-emerald-500 bg-emerald-500/10 text-emerald-700' },
    { id: 'Rejected', label: '5. Archived / Rejected', statusKey: 'Rejected', color: 'border-rose-400 bg-rose-500/10 text-rose-700' },
  ];

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16 font-sans text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
{/* 1. Header Toolbar */}
      <AdminHeader
        title="Admissions Management"
        subtitle="Enterprise admissions pipeline: enquiry queue, document audit, SMS/call parent follow-up, and direct SIS enrolment."
        badge={{
          icon: GraduationCap,
          text: 'Admissions Desk',
          variant: 'primary'
        }}
        sessionBadge="Session: 2026-27"
        actions={
          <>
            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  viewMode === 'table' ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                )}
                title="Table View"
              >
                <ClipboardList className="w-3.5 h-3.5" /> Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  viewMode === 'kanban' ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                )}
                title="Kanban Board View"
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Pipeline Board
              </button>
            </div>

            <button
              onClick={loadData}
              aria-label="Refresh admissions data"
              title="Refresh data"
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
            >
              <RefreshCcw className={cn('w-4 h-4', isLoading && 'animate-spin text-blue-600')} />
            </button>

            <button
              onClick={() => handleExportCSV(false)}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" /> New Application
            </button>
          </>
        }
      />

      {/* 2. Pipeline Summary Cards — 5 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {summaryCards.map(card => {
          const isActive = statusFilter === card.key;
          return (
            <AdminStatCard
              key={card.key}
              label={card.label}
              value={isLoading ? '...' : card.value}
              subtext={card.hint}
              icon={card.icon}
              variant={card.variant}
              onClick={() => { setStatusFilter(card.key); setCurrentPage(1); }}
              className={cn(
                isActive && 'ring-2 ring-blue-600 border-blue-600 bg-blue-50/20 shadow-xs'
              )}
            />
          );
        })}
      </div>

      {/* 3. Search & filters */}
      <section className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5" aria-label="Search and filter applications">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              aria-label="Search applications"
              placeholder="Search student name, application tracking no, father name, phone, email or address…"
              className="w-full bg-slate-50/60 hover:bg-white focus:bg-white border border-slate-200/90 rounded-2xl py-2.5 pl-11 pr-10 text-xs sm:text-sm text-slate-800 font-semibold placeholder:font-normal placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 shadow-xs"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setCurrentPage(1); }}
                aria-label="Clear search"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex gap-2.5">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              aria-label="Filter by status"
              className={cn(filterCls, 'w-full lg:w-auto')}
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Review">In Review</option>
              <option value="Under Review">Under Review</option>
              <option value="Interview Scheduled">Interview Scheduled</option>
              <option value="Documents Verification">Docs Verification</option>
              <option value="Approved">Approved</option>
              <option value="Student Created">Enrolled in SIS</option>
              <option value="Waitlisted">Waitlisted</option>
              <option value="Rejected">Rejected</option>
              <option value="Withdrawn">Withdrawn</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            <select
              value={classFilter}
              onChange={(e) => { setClassFilter(e.target.value); setCurrentPage(1); }}
              aria-label="Filter by class"
              className={cn(filterCls, 'w-full lg:w-auto')}
            >
              <option value="all">All Classes</option>
              {classes.map((c: any) => (
                <option key={c.id} value={c.class_name}>Class {c.class_name}</option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
              aria-label="Filter by category"
              className={cn(filterCls, 'w-full lg:w-auto')}
            >
              <option value="all">All Categories</option>
              <option value="General">General</option>
              <option value="OBC">OBC</option>
              <option value="SC">SC</option>
              <option value="ST">ST</option>
              <option value="EWS">EWS</option>
            </select>

            <select
              value={academicYearFilter}
              onChange={(e) => { setAcademicYearFilter(e.target.value); setCurrentPage(1); }}
              aria-label="Filter by academic session"
              className={cn(filterCls, 'w-full lg:w-auto')}
            >
              <option value="all">All Sessions</option>
              {academicYears.map((y: any) => (
                <option key={y.id} value={y.name}>{y.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Applied filters chips */}
        {filterChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">Active Filters:</span>
            {filterChips.map((chip, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 bg-blue-50 border border-blue-200/80 text-blue-800 rounded-xl text-xs font-bold shadow-2xs">
                {chip.label}
                <button
                  onClick={() => { chip.clear(); setCurrentPage(1); }}
                  aria-label={`Remove filter ${chip.label}`}
                  className="p-0.5 rounded-md hover:bg-blue-200/60 text-blue-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
            <button
              onClick={resetAllFilters}
              className="ml-2 text-xs font-bold text-slate-500 hover:text-rose-600 underline underline-offset-2 cursor-pointer transition-colors"
            >
              Clear all
            </button>
          </div>
        )}
      </section>

      {/* 4. Bulk selection floating bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 text-white rounded-3xl px-6 py-4 shadow-2xl border border-blue-700/50 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <span className="text-xs sm:text-sm font-bold flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            {selectedIds.length} candidate{selectedIds.length > 1 ? 's' : ''} selected
          </span>

          <div className="h-4 w-px bg-white/20" />

          {can('student.create') && (
            <button
              onClick={handleBulkApprove}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-600/30 hover:scale-102"
            >
              <Check className="w-4 h-4" /> Approve &amp; Enrol in SIS
            </button>
          )}

          <button
            onClick={() => handleExportCSV(true)}
            className="px-4 py-2 bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>

          <button
            onClick={() => setSelectedIds([])}
            className="px-3 py-2 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* 5. VIEW MODE: KANBAN PIPELINE BOARD */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 items-start">
          {kanbanColumns.map(col => {
            const colRecords = filteredAdmissions.filter(a => {
              if (col.statusKey === 'Pending') return a.status === 'Pending';
              if (col.statusKey === 'Under Review') return a.status === 'Under Review' || a.status === 'In Review' || a.status === 'Documents Verification';
              if (col.statusKey === 'Interview Scheduled') return a.status === 'Interview Scheduled';
              if (col.statusKey === 'Student Created') return a.status === 'Approved' || a.status === 'Student Created';
              if (col.statusKey === 'Rejected') return a.status === 'Rejected' || a.status === 'Cancelled';
              return false;
            });

            return (
              <div key={col.id} className="bg-slate-100/80 rounded-3xl p-4 border border-slate-200/80 flex flex-col min-h-[500px]">
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-3 h-3 rounded-full border-2', col.color)} />
                    <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider font-sans">{col.label}</h3>
                  </div>
                  <span className="text-xs font-black text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                    {colRecords.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
                  {colRecords.map(adm => {
                    const isEnrolled = adm.status === 'Approved' || adm.status === 'Student Created';
                    return (
                      <div
                        key={adm.id}
                        onClick={() => openDrawerFor(adm)}
                        className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-[10px] font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            {appNumber(adm)}
                          </span>
                          <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                            Class {adm.class}
                          </span>
                        </div>

                        <h4 className="font-bold text-sm text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                          {adm.name}
                        </h4>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          Father: {adm.father_name || 'Guardian'}
                        </p>

                        <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1 font-medium">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {adm.phone || 'No phone'}
                          </span>

                          {!isEnrolled && (
                            <button
                              type="button"
                              onClick={(e) => handleFastTrackEnrol(adm, e)}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg font-bold text-[10px] flex items-center gap-1 transition-colors"
                            >
                              ⚡ Enrol
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {colRecords.length === 0 && (
                    <div className="text-center py-12 text-slate-400 text-xs italic">
                      No applications in this stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. VIEW MODE: DATA TABLE */}
      {viewMode === 'table' && (
        <section className="bg-white border border-slate-200/80 rounded-3xl shadow-xs overflow-hidden">
          {/* Table Toolbar Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3 min-w-0">
              <span className="p-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-200/80 shrink-0">
                <ClipboardList className="w-4 h-4" />
              </span>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate font-sans">Applications Queue</h2>
              <span className="text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200/80 rounded-full px-2.5 py-0.5 tabular-nums shrink-0">
                {sortedAdmissions.length} Total Records
              </span>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Column Selector Dropdown Menu */}
              <div className="relative" ref={columnPickerRef}>
                <button
                  type="button"
                  onClick={() => setIsColumnPickerOpen(!isColumnPickerOpen)}
                  className={cn(
                    'text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer shadow-xs',
                    isColumnPickerOpen
                      ? 'bg-blue-50 border-blue-300 text-blue-800 ring-2 ring-blue-600/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  )}
                  title="Customize visible columns"
                >
                  <Columns3 className="w-3.5 h-3.5 text-blue-700" />
                  <span>Columns</span>
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-900 text-[10px] font-black">
                    {Object.values(visibleColumns).filter(Boolean).length}/{ALL_COLUMNS.length}
                  </span>
                </button>

                {/* Column Selection Dropdown */}
                {isColumnPickerOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-3.5 text-xs animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2.5">
                      <div>
                        <h4 className="font-bold text-slate-900">Table Columns</h4>
                        <p className="text-[11px] text-slate-500">Pick which columns to show</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => applyPreset('default')}
                        className="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
                        title="Reset to default columns"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset
                      </button>
                    </div>

                    {/* Presets */}
                    <div className="mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                        Quick Views:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => applyPreset('compact')}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          Compact
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('contact')}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          Contacts
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('audit')}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          Full Audit
                        </button>
                      </div>
                    </div>

                    {/* Column Checkbox List */}
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      {ALL_COLUMNS.map(col => {
                        const isChecked = visibleColumns[col.key];
                        const isDisabled = col.alwaysVisible;
                        return (
                          <label
                            key={col.key}
                            className={cn(
                              'flex items-start gap-2.5 p-1.5 rounded-xl transition-colors select-none',
                              isDisabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50 cursor-pointer'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isDisabled}
                              onChange={() => toggleColumn(col.key)}
                              className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <div className="min-w-0">
                              <span className="font-bold text-slate-800 block text-xs leading-none">
                                {col.label}
                                {isDisabled && <span className="ml-1 text-[10px] text-slate-400 font-normal">(Required)</span>}
                              </span>
                              <span className="text-[10px] text-slate-400 mt-0.5 block leading-tight">{col.description}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Density Toggle */}
              <button
                type="button"
                onClick={() => setIsCompactDensity(!isCompactDensity)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 cursor-pointer shadow-xs"
                title="Toggle Row Density"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isCompactDensity ? 'Compact' : 'Comfortable'}</span>
              </button>

              {sortField && sortField !== 'created_at' && (
                <button
                  onClick={() => { setSortField('created_at'); setSortDir('desc'); }}
                  className="text-xs font-bold text-slate-500 hover:text-blue-700 flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                >
                  <ChevronsUpDown className="w-3.5 h-3.5" /> Reset sort
                </button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="divide-y divide-slate-100" aria-busy="true" aria-label="Loading applications">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 sm:px-6 py-4.5">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-slate-100 rounded-lg animate-pulse w-44 max-w-[45%]" />
                    <div className="h-2.5 bg-slate-100 rounded-lg animate-pulse w-32 max-w-[30%]" />
                  </div>
                  <div className="hidden sm:block h-7 w-24 bg-slate-100 rounded-full animate-pulse" />
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <span className="p-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 mb-4">
                <AlertTriangle className="w-6 h-6" />
              </span>
              <h3 className="text-sm font-bold text-slate-900">Could not load admissions</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1.5">{loadError}</p>
              <button
                onClick={loadData}
                className="mt-4 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-md"
              >
                <RefreshCcw className="w-4 h-4" /> Try again
              </button>
            </div>
          ) : sortedAdmissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <span className="p-3.5 rounded-2xl bg-slate-50 text-slate-400 border border-slate-200 mb-4 shadow-xs">
                <GraduationCap className="w-7 h-7" />
              </span>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                {admissions.length === 0 ? 'No applications yet' : 'No applications found'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1.5">
                {admissions.length === 0
                  ? 'New admission applications will appear here as soon as they are submitted online or at the counter.'
                  : 'Try a different status, class or session, or clear the filters to view all records.'}
              </p>
              {admissions.length === 0 ? (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-4 px-5 py-2.5 bg-gradient-to-r from-blue-900 to-blue-700 text-white rounded-2xl text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-md shadow-blue-900/25"
                >
                  <Plus className="w-4 h-4" /> New Application
                </button>
              ) : (
                <button
                  onClick={resetAllFilters}
                  className="mt-4 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-bold cursor-pointer shadow-xs"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop / tablet enterprise table with crystal-clear column geometry and zero awkward clipping */}
              <div className="hidden lg:block w-full overflow-hidden">
                <table className="w-full text-left table-fixed border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] uppercase tracking-wider text-slate-500 font-extrabold select-none">
                      <th scope="col" className="py-3.5 pl-5 pr-2 w-12 text-center">
                        <input
                          type="checkbox"
                          aria-label="Select all applications on this page"
                          checked={allPageSelected}
                          ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds(paginatedAdmissions.map(a => a.id));
                            else setSelectedIds([]);
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                      {visibleColumns.applicant && (
                        <th scope="col" className="py-3.5 px-3 min-w-[200px]"><SortButton field="name" label="Applicant" /></th>
                      )}
                      {visibleColumns.class && (
                        <th scope="col" className="py-3.5 px-3 w-28"><SortButton field="class" label="Class & Sec" /></th>
                      )}
                      {visibleColumns.session && (
                        <th scope="col" className="py-3.5 px-3 w-28">Session</th>
                      )}
                      {visibleColumns.guardian && (
                        <th scope="col" className="py-3.5 px-3 min-w-[170px]">Guardian & Contact</th>
                      )}
                      {visibleColumns.documents && (
                        <th scope="col" className="py-3.5 px-3 w-32">Verification</th>
                      )}
                      {visibleColumns.status && (
                        <th scope="col" className="py-3.5 px-3 w-32"><SortButton field="status" label="Status" /></th>
                      )}
                      {visibleColumns.applied_on && (
                        <th scope="col" className="py-3.5 px-3 w-28"><SortButton field="created_at" label="Applied On" /></th>
                      )}
                      {visibleColumns.actions && (
                        <th scope="col" className="py-3.5 pr-5 pl-3 w-40 text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginatedAdmissions.map((admission) => {
                      const isSelected = selectedIds.includes(admission.id);
                      const { verified, total } = documentProgress(admission);
                      const isEnrolled = admission.status === 'Approved' || admission.status === 'Student Created';
                      const isPending = admission.status === 'Pending';

                      return (
                        <tr
                          key={admission.id}
                          tabIndex={0}
                          onClick={() => openDrawerFor(admission)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target === e.currentTarget) openDrawerFor(admission);
                          }}
                          className={cn(
                            'group cursor-pointer transition-all duration-150 hover:bg-blue-50/30',
                            isSelected && 'bg-blue-50/60 hover:bg-blue-50/80'
                          )}
                        >
                          <td className={cn('pl-5 pr-2 text-center', isCompactDensity ? 'py-2.5' : 'py-3.5')} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              aria-label={`Select application of ${admission.name}`}
                              checked={isSelected}
                              onChange={(e) => toggleRow(admission.id, e.target.checked)}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>

                          {visibleColumns.applicant && (
                            <td className={cn('px-3', isCompactDensity ? 'py-2.5' : 'py-3.5')}>
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs ring-2 ring-blue-900/10">
                                  {admission.photo_url ? (
                                    <img src={admission.photo_url} alt="" className="w-full h-full object-cover rounded-2xl" />
                                  ) : (
                                    (admission.name || '?').charAt(0).toUpperCase()
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs sm:text-[13px] font-extrabold text-slate-900 group-hover:text-blue-700 transition-colors truncate font-sans flex items-center gap-1.5">
                                    <span className="truncate">{admission.name}</span>
                                    {admission.category && admission.category !== 'General' && (
                                      <span className="px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-900 border border-amber-200/80 text-[10px] font-black shrink-0 tracking-tight">
                                        {admission.category}
                                      </span>
                                    )}
                                    {admission.only_child_girl && (
                                      <span className="text-[11px] shrink-0" title="Single Girl Child">⭐</span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 truncate">
                                    <button
                                      type="button"
                                      onClick={(e) => handleCopyAppNo(appNumber(admission), e)}
                                      className="font-mono font-bold text-blue-900 bg-blue-50 hover:bg-blue-100/80 px-2 py-0.5 rounded-md border border-blue-200/60 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                                      title="Click to copy tracking ID"
                                    >
                                      {copiedId === appNumber(admission) ? <CheckCheck className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-blue-400" />}
                                      <span>{appNumber(admission)}</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          )}

                          {visibleColumns.class && (
                            <td className={cn('px-3', isCompactDensity ? 'py-2.5' : 'py-3.5')}>
                              <div className="text-xs sm:text-[13px] font-bold text-slate-900 whitespace-nowrap">Class {admission.class}</div>
                              <div className="text-[11px] font-semibold text-slate-500 mt-0.5 whitespace-nowrap">
                                <span className="px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                                  Section {admission.section || 'A'}
                                </span>
                              </div>
                            </td>
                          )}

                          {visibleColumns.session && (
                            <td className={cn('px-3', isCompactDensity ? 'py-2.5' : 'py-3.5')}>
                              <span className="text-xs font-semibold text-slate-700 whitespace-nowrap bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80">
                                {admission.academic_year}
                              </span>
                            </td>
                          )}

                          {visibleColumns.guardian && (
                            <td className={cn('px-3', isCompactDensity ? 'py-2.5' : 'py-3.5')}>
                              <div className="text-xs sm:text-[13px] font-bold text-slate-800 truncate" title={admission.father_name}>
                                {admission.father_name}
                              </div>
                              <div className="text-[11px] text-slate-600 flex items-center gap-1.5 mt-1 font-medium">
                                {admission.phone ? (
                                  <>
                                    <a
                                      href={`tel:${admission.phone}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex items-center gap-1 text-slate-700 hover:text-blue-700 hover:underline font-mono text-[11px]"
                                      title="Call Parent"
                                    >
                                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span>{admission.phone}</span>
                                    </a>
                                    <a
                                      href={`https://wa.me/91${admission.phone.replace(/\D/g, '')}?text=Hello%20from%20St.%20Joseph%27s%20School%20Barhalganj%20regarding%20admission%20application%20${appNumber(admission)}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="p-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors shrink-0"
                                      title="WhatsApp Message"
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                    </a>
                                  </>
                                ) : (
                                  <span className="text-slate-400 text-xs italic">No phone</span>
                                )}
                              </div>
                            </td>
                          )}

                          {visibleColumns.documents && (
                            <td className={cn('px-3', isCompactDensity ? 'py-2.5' : 'py-3.5')}>
                              {total > 0 ? (
                                <div className="w-28 space-y-1">
                                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-700">
                                    <span className="font-mono">{verified}/{total} Verified</span>
                                    <span className={cn(verified === total ? 'text-emerald-700 font-extrabold' : 'text-amber-600 font-semibold')}>
                                      {verified === total ? 'Done' : 'Pending'}
                                    </span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden ring-1 ring-slate-200/50">
                                    <div
                                      className={cn('h-full rounded-full transition-all duration-300', verified === total ? 'bg-emerald-500' : 'bg-amber-400')}
                                      style={{ width: `${Math.round((verified / total) * 100)}%` }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 font-medium italic">No docs</span>
                              )}
                            </td>
                          )}

                          {visibleColumns.status && (
                            <td className={cn('px-3', isCompactDensity ? 'py-2.5' : 'py-3.5')}>
                              <StatusBadge status={admission.status} size="sm" />
                              {isEnrolled && admission.student_id && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate('/dashboard/students', { state: { selectedStudentId: admission.student_id } });
                                  }}
                                  className="mt-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <UserCheck className="w-3 h-3" /> View SIS
                                </button>
                              )}
                            </td>
                          )}

                          {visibleColumns.applied_on && (
                            <td className={cn('px-3', isCompactDensity ? 'py-2.5' : 'py-3.5')}>
                              <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">{formatDate(admission.created_at)}</span>
                            </td>
                          )}

                          {visibleColumns.actions && (
                            <td className={cn('pr-5 pl-3 text-right', isCompactDensity ? 'py-2.5' : 'py-3.5')} onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                {/* 1-Click Fast-Track Enrol Button for Pending */}
                                {isPending && can('student.create') && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleFastTrackEnrol(admission, e)}
                                    title="Fast-Track Direct Enrolment into SIS"
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs hover:scale-102 shrink-0"
                                  >
                                    <Check className="w-3 h-3 stroke-[3]" />
                                    <span>Enrol</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => openDrawerFor(admission)}
                                  title="Quick View Details"
                                  className="p-1.5 rounded-xl text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer shrink-0"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedLetterRecord(admission);
                                    setIsLetterModalOpen(true);
                                  }}
                                  title="Print Official Admission Slip / Letter"
                                  className="p-1.5 rounded-xl text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer shrink-0"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>

                                <button
                                  onClick={(e) => handleOpenMenu(e, admission.id)}
                                  aria-label={`Actions for ${admission.name}`}
                                  aria-haspopup="menu"
                                  aria-expanded={openMenu?.id === admission.id}
                                  className={cn(
                                    'p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer shrink-0',
                                    openMenu?.id === admission.id && 'bg-slate-100 text-slate-800'
                                  )}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <ul className="lg:hidden divide-y divide-slate-100">
                {paginatedAdmissions.map((admission) => {
                  const isSelected = selectedIds.includes(admission.id);
                  const { verified, total } = documentProgress(admission);
                  return (
                    <li key={admission.id} className={cn('px-5 py-4', isSelected && 'bg-blue-50/50')}>
                      <div className="flex items-start gap-3.5">
                        <input
                          type="checkbox"
                          aria-label={`Select application of ${admission.name}`}
                          checked={isSelected}
                          onChange={(e) => toggleRow(admission.id, e.target.checked)}
                          className="mt-2 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                        />

                        <button
                          onClick={() => openDrawerFor(admission)}
                          className="flex-1 min-w-0 text-left cursor-pointer"
                        >
                          <div className="flex items-start gap-3">
                            <Avatar name={admission.name} photoUrl={admission.photo_url} className="w-10 h-10 text-sm rounded-2xl" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-slate-900 truncate">{admission.name}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[11px] font-mono font-bold text-blue-900 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100 truncate">
                                  {appNumber(admission)}
                                </span>
                                <StatusBadge status={admission.status} size="sm" className="shrink-0 ml-auto sm:ml-0" />
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-500 font-medium">
                                <span className="font-bold text-slate-800">Class {admission.class} · {admission.section || 'A'}</span>
                                <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" />{admission.phone || 'No phone'}</span>
                                {total > 0 && (
                                  <span className={cn('font-bold', verified === total ? 'text-emerald-700' : 'text-amber-600')}>
                                    Docs {verified}/{total}
                                  </span>
                                )}
                                <span>{formatDate(admission.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={(e) => handleOpenMenu(e, admission.id)}
                          aria-label={`Actions for ${admission.name}`}
                          aria-haspopup="menu"
                          className="p-2 -mr-1 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-800 cursor-pointer shrink-0"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/50 text-xs sm:text-[13px]">
                <p className="text-slate-500 order-2 sm:order-1 font-medium">
                  Showing <span className="font-bold text-slate-800 tabular-nums">{(currentPage - 1) * pageSize + 1}</span>–
                  <span className="font-bold text-slate-800 tabular-nums">{Math.min(currentPage * pageSize, sortedAdmissions.length)}</span> of{' '}
                  <span className="font-bold text-slate-800 tabular-nums">{sortedAdmissions.length}</span> records
                </p>

                <div className="flex items-center gap-3 order-1 sm:order-2">
                  <label className="flex items-center gap-1.5 text-slate-500 font-semibold text-xs">
                    <span className="hidden sm:inline">Rows per page</span>
                    <select
                      value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                      aria-label="Rows per page"
                      className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 outline-none cursor-pointer focus:border-blue-600"
                    >
                      <option value={15}>15</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </label>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      aria-label="Previous page"
                      className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 text-slate-600 font-medium tabular-nums whitespace-nowrap text-xs">
                      Page <strong className="text-slate-900">{currentPage}</strong> of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      aria-label="Next page"
                      className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* Row action menu portal */}
      {openMenu && openMenuRecord && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ top: openMenu.top, left: openMenu.left }}
          className="fixed z-[60] w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-900/15 overflow-hidden py-1.5 text-xs font-semibold animate-in fade-in zoom-in-95 duration-150"
        >
          {(() => {
            const admission = openMenuRecord;
            const isEnrolled = admission.status === 'Approved' || admission.status === 'Student Created';
            const isRejected = admission.status === 'Rejected' || admission.status === 'Cancelled';
            const itemCls = 'w-full px-4 py-2.5 text-left flex items-center gap-2.5 transition-colors cursor-pointer';
            return (
              <>
                <button
                  role="menuitem"
                  onClick={() => { openDrawerFor(admission); setOpenMenu(null); }}
                  className={cn(itemCls, 'text-slate-700 hover:bg-slate-50')}
                >
                  <Eye className="w-4 h-4 text-slate-400" /> View full details
                </button>

                <button
                  role="menuitem"
                  onClick={() => { openEditModal(admission); setOpenMenu(null); }}
                  className={cn(itemCls, 'text-slate-700 hover:bg-slate-50')}
                >
                  <Edit3 className="w-4 h-4 text-slate-400" /> Edit application
                </button>

                {!isEnrolled && !isRejected && can('student.create') && (
                  <>
                    <button
                      role="menuitem"
                      onClick={(e) => { handleFastTrackEnrol(admission, e); setOpenMenu(null); }}
                      className={cn(itemCls, 'text-emerald-700 hover:bg-emerald-50')}
                    >
                      <Check className="w-4 h-4 text-emerald-600" /> Fast-Track Enrol in SIS
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { setSelectedRejectRecord(admission); setIsRejectModalOpen(true); setOpenMenu(null); }}
                      className={cn(itemCls, 'text-rose-700 hover:bg-rose-50')}
                    >
                      <XCircle className="w-4 h-4 text-rose-500" /> Reject application
                    </button>
                  </>
                )}

                <button
                  role="menuitem"
                  onClick={() => { setSelectedLetterRecord(admission); setIsLetterModalOpen(true); setOpenMenu(null); }}
                  className={cn(itemCls, 'text-slate-700 hover:bg-slate-50')}
                >
                  <Printer className="w-4 h-4 text-slate-400" /> Print admission letter
                </button>

                <button
                  role="menuitem"
                  onClick={(e) => { handleCopyAppNo(appNumber(admission), e); setOpenMenu(null); }}
                  className={cn(itemCls, 'text-slate-700 hover:bg-slate-50')}
                >
                  <Copy className="w-4 h-4 text-slate-400" /> Copy tracking ID
                </button>

                {isEnrolled && admission.student_id && (
                  <>
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      role="menuitem"
                      onClick={() => { navigate('/dashboard/students', { state: { selectedStudentId: admission.student_id } }); setOpenMenu(null); }}
                      className={cn(itemCls, 'text-blue-700 hover:bg-blue-50')}
                    >
                      <Users className="w-4 h-4 text-blue-600" /> Open student in SIS
                    </button>
                  </>
                )}
              </>
            );
          })()}
        </div>,
        document.body
      )}

      {/* Modals & Drawers */}
      <AdmissionApplicationFormModal
        isOpen={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); setEditingRecord(null); }}
        onSuccess={loadData}
        classes={classes}
        sections={sections}
        academicYears={academicYears}
        editRecord={editingRecord}
      />

      <AdmissionDetailsDrawer
        isOpen={isDrawerOpen}
        onClose={() => { setIsDrawerOpen(false); setSelectedDrawerRecord(null); }}
        admission={selectedDrawerRecord}
        onRefresh={loadData}
        onOpenRejectModal={(rec) => { setSelectedRejectRecord(rec); setIsRejectModalOpen(true); }}
        onOpenLetterModal={(rec) => { setSelectedLetterRecord(rec); setIsLetterModalOpen(true); }}
      />

      <AdmissionRejectModal
        isOpen={isRejectModalOpen}
        onClose={() => { setIsRejectModalOpen(false); setSelectedRejectRecord(null); }}
        admission={selectedRejectRecord}
        onSuccess={loadData}
      />

      {selectedLetterRecord && (
        <AdmissionLetterModal
          isOpen={isLetterModalOpen}
          onClose={() => { setIsLetterModalOpen(false); setSelectedLetterRecord(null); }}
          record={selectedLetterRecord}
        />
      )}
    </div>
  );
}
