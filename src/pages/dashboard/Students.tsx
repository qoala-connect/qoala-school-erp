import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Users, Search, Plus, Download, RefreshCcw, Eye, Edit,
  UserMinus, TrendingUp, Printer, GraduationCap, Phone,
  CheckCircle2, AlertTriangle, Loader2, MoreVertical, X,
  SlidersHorizontal, ChevronDown, ChevronUp, ArrowUpDown,
  ArrowUp, ArrowDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Student, StudentStatus } from '@/types/student';
import StudentFormModal, { StudentFormValues } from '@/components/students/StudentFormModal';
import Student360Drawer from '@/components/students/Student360Drawer';
import StudentIDCardModal from '@/components/students/StudentIDCardModal';
import StudentPromotionModal from '@/components/students/StudentPromotionModal';
import StudentStatusChangeModal from '@/components/students/StudentStatusChangeModal';
import { useAuth } from '@/context/AuthContext';
import AdminHeader from '@/components/common/AdminHeader';
import AdminStatCard from '@/components/common/AdminStatCard';

const STATUS_STYLES: Record<StudentStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'bg-slate-100 text-slate-600 border-slate-200',
  transferred: 'bg-sky-50 text-sky-700 border-sky-200',
  graduated: 'bg-violet-50 text-violet-700 border-violet-200',
  withdrawn: 'bg-rose-50 text-rose-700 border-rose-200',
};

type SortField = 'name' | 'class' | 'roll_number' | 'admission_number' | 'status' | null;
type SortDir = 'asc' | 'desc';

export default function Students() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, can } = useAuth();

  // Defense-in-depth: Redirect students / parents directly to their private portal
  useEffect(() => {
    if (role === 'student' || role === 'parent') {
      navigate('/dashboard', { replace: true });
    }
  }, [role, navigate]);

  // Master Data State
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<{ id: string; class_name: string }[]>([]);
  const [sections, setSections] = useState<{ id: string; section_name: string }[]>([]);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters State
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('All');
  const [sectionFilter, setSectionFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<string>(location.state?.statusFilter || 'active');
  const [sessionFilter, setSessionFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [genderFilter, setGenderFilter] = useState('All');
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Sort State
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Selection & Pagination State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Row action menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLTableSectionElement>(null);

  // Modals & Drawers State
  const [selected360Student, setSelected360Student] = useState<Student | null>(null);
  const [is360Open, setIs360Open] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Partial<StudentFormValues> | null>(null);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusTargetStudent, setStatusTargetStudent] = useState<Student | null>(null);

  const [promotionModalOpen, setPromotionModalOpen] = useState(false);
  const [promotionTargetStudent, setPromotionTargetStudent] = useState<Student | null>(null);

  const [idCardModalOpen, setIdCardModalOpen] = useState(false);
  const [idCardTargetStudent, setIdCardTargetStudent] = useState<Student | null>(null);

  // Close action menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    fetchMetadata();
    fetchStudents();
  }, []);

  // Handle location state navigation (e.g. from Global Search or Sidebar)
  useEffect(() => {
    if (location.state?.selectedStudentId && students.length > 0) {
      const match = students.find(s => s.id === location.state.selectedStudentId);
      if (match) {
        setSelected360Student(match);
        setIs360Open(true);
      }
    } else if (location.state?.openIdCards && students.length > 0 && !idCardModalOpen) {
      setIdCardTargetStudent(students[0]);
      setIdCardModalOpen(true);
    }
    // Honour incoming statusFilter from sidebar navigation
    if (location.state?.statusFilter) {
      setStatusFilter(location.state.statusFilter);
    }
  }, [location.state, students]);

  const fetchMetadata = async () => {
    try {
      const [c, s, y] = await Promise.all([
        supabase.from('classes').select('id, class_name').order('class_name'),
        supabase.from('sections').select('id, section_name').order('section_name'),
        supabase.from('academic_years').select('id, name').order('start_date', { ascending: false }),
      ]);
      const sorted = (c.data || []).sort(
        (a, b) => (parseInt(a.class_name.replace(/\D/g, ''), 10) || 0) - (parseInt(b.class_name.replace(/\D/g, ''), 10) || 0)
      );
      setClasses(sorted);
      setSections(s.data || []);
      setAcademicYears(y.data || []);
    } catch (err) {
      console.warn('Metadata fetch warning:', err);
    }
  };

  const fetchStudents = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // Selective columns only — no select('*')
      const { data, error } = await supabase
        .from('students')
        .select(
          'id, admission_number, roll_number, name, father_name, mother_name, ' +
          'date_of_birth, gender, class, section, class_id, section_id, ' +
          'academic_year, academic_year_id, phone, email, address, category, ' +
          'status, status_changed_at, aadhaar_last4, photo_url, user_id, ' +
          'minority_status, cwsn_status, cwsn_type, only_child_girl, ' +
          'cbse_registration_no, house_name, created_at, updated_at'
        )
        .order('class', { ascending: true })
        .order('roll_number', { ascending: true });

      if (error) throw error;
      setStudents((data || []) as unknown as Student[]);
    } catch (error: any) {
      console.error('[Students] Load failed:', error);
      setLoadError(error.message || 'Could not load student directory from database.');
    } finally {
      setIsLoading(false);
    }
  };

  // Derive unique classes from DB classes state (or fallback from data)
  const uniqueClasses = useMemo(() => {
    if (classes.length > 0) return classes.map(c => c.class_name);
    const set = new Set(students.map(s => s.class));
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  }, [classes, students]);

  // Derive unique sections from DB sections state
  const uniqueSections = useMemo(() => {
    if (sections.length > 0) return sections.map(s => s.section_name);
    const set = new Set(students.map(s => s.section).filter(Boolean));
    return Array.from(set).sort();
  }, [sections, students]);

  // Client-side multi-field filtering (all filters — no DB round-trip per filter change)
  const filteredStudents = useMemo(() => {
    const s = search.toLowerCase().trim();
    return students.filter(student => {
      const matchesSearch = !s ||
        (student.name && student.name.toLowerCase().includes(s)) ||
        (student.admission_number && student.admission_number.toLowerCase().includes(s)) ||
        (student.roll_number && student.roll_number.toLowerCase().includes(s)) ||
        (student.father_name && student.father_name.toLowerCase().includes(s)) ||
        (student.phone && student.phone.includes(s)) ||
        (student.email && student.email.toLowerCase().includes(s));

      const matchesClass = classFilter === 'All' || student.class === classFilter || `Class ${student.class}` === classFilter;
      const matchesSection = sectionFilter === 'All' || student.section === sectionFilter;
      const matchesCategory = categoryFilter === 'All' || student.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || statusFilter === 'All' || student.status === statusFilter;
      const matchesSession = sessionFilter === 'All' || student.academic_year === sessionFilter;
      const matchesGender = genderFilter === 'All' || student.gender?.toLowerCase() === genderFilter.toLowerCase();

      return matchesSearch && matchesClass && matchesSection && matchesCategory && matchesStatus && matchesSession && matchesGender;
    });
  }, [students, search, classFilter, sectionFilter, categoryFilter, statusFilter, sessionFilter, genderFilter]);

  // Sorting
  const sortedStudents = useMemo(() => {
    if (!sortField) return filteredStudents;
    return [...filteredStudents].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      if (sortField === 'name') { aVal = a.name || ''; bVal = b.name || ''; }
      else if (sortField === 'class') {
        aVal = parseInt(a.class?.replace(/\D/g, '') || '0') || 0;
        bVal = parseInt(b.class?.replace(/\D/g, '') || '0') || 0;
      }
      else if (sortField === 'roll_number') { aVal = parseInt(a.roll_number || '0') || 0; bVal = parseInt(b.roll_number || '0') || 0; }
      else if (sortField === 'admission_number') { aVal = a.admission_number || ''; bVal = b.admission_number || ''; }
      else if (sortField === 'status') { aVal = a.status || ''; bVal = b.status || ''; }

      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      }
      return sortDir === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal;
    });
  }, [filteredStudents, sortField, sortDir]);

  // Pagination
  const totalPages = Math.ceil(sortedStudents.length / pageSize) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedStudents.slice(start, start + pageSize);
  }, [sortedStudents, currentPage, pageSize]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = students.length;
    const active = students.filter(s => s.status === 'active').length;
    const boys = students.filter(s => s.status === 'active' && s.gender?.toLowerCase() === 'male').length;
    const girls = students.filter(s => s.status === 'active' && s.gender?.toLowerCase() === 'female').length;
    const leavers = students.filter(s => s.status !== 'active').length;
    return { total, active, boys, girls, leavers };
  }, [students]);

  // Active filter count for badge
  const activeFilterCount = [
    classFilter !== 'All',
    sectionFilter !== 'All',
    categoryFilter !== 'All',
    genderFilter !== 'All',
    sessionFilter !== 'All',
    statusFilter !== 'active' && statusFilter !== 'All',
  ].filter(Boolean).length;

  // Sort toggle helper
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-violet-600" /> : <ArrowDown className="w-3 h-3 text-violet-600" />;
  };

  // Action Handlers
  const handleOpenEdit = (student: Student) => {
    setEditingStudent({
      id: student.id,
      name: student.name ?? '',
      father_name: student.father_name ?? '',
      mother_name: student.mother_name ?? '',
      date_of_birth: student.date_of_birth ?? '',
      gender: student.gender ?? 'male',
      class_id: student.class_id ?? '',
      section_id: student.section_id ?? '',
      academic_year_id: student.academic_year_id ?? '',
      phone: student.phone ?? '',
      email: student.email ?? '',
      address: student.address ?? '',
      category: student.category ?? 'General',
      roll_number: student.roll_number ?? '',
      aadhaar_last4: student.aadhaar_last4 ?? '',
      minority_status: student.minority_status ?? false,
      cwsn_status: student.cwsn_status ?? false,
      only_child_girl: student.only_child_girl ?? false,
      cbse_registration_no: student.cbse_registration_no ?? '',
      house_name: student.house_name ?? 'Tagore House',
    });
    setFormOpen(true);
    setOpenMenuId(null);
  };

  const handleExportCSV = (selectedOnly = false) => {
    const list = selectedOnly
      ? filteredStudents.filter(s => selectedIds.includes(s.id))
      : sortedStudents;

    if (list.length === 0) {
      toast.error('No students to export.');
      return;
    }

    const headers = ['Admission No', 'Roll No', 'Student Name', 'Class', 'Section', 'Gender', 'Academic Year', 'Father Name', 'Phone', 'Category', 'Status'];
    const rows = list.map(s => [
      s.admission_number,
      s.roll_number || '',
      s.name,
      s.class,
      s.section,
      s.gender || '',
      s.academic_year,
      s.father_name,
      s.phone || '',
      s.category || 'General',
      s.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SDPS_Student_Directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${list.length} student records to CSV.`);
  };

  const resetAllFilters = () => {
    setSearch('');
    setClassFilter('All');
    setSectionFilter('All');
    setStatusFilter('active');
    setCategoryFilter('All');
    setSessionFilter('All');
    setGenderFilter('All');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16">
      {/* 1. Header Toolbar */}
      <AdminHeader
        title="Student Information System (SIS)"
        subtitle="Enterprise student directory, CBSE compliant records, academic enrollment & 360° student dossiers."
        badge={{
          icon: Users,
          text: 'Student Directory Hub',
          variant: 'primary'
        }}
        sessionBadge="Session: 2026-27"
        actions={
          <>
            <button
              onClick={fetchStudents}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
              title="Sync Database"
            >
              <RefreshCcw className={cn("w-4 h-4", isLoading && "animate-spin text-blue-600")} />
            </button>

            <button
              onClick={() => handleExportCSV(false)}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>

            {can('student.create') && (
              <button
                onClick={() => { setEditingStudent(null); setFormOpen(true); }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" /> Admit Student
              </button>
            )}
          </>
        }
      />

      {/* 2. KPI Summary Cards — 5 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <AdminStatCard
          label="Total Enrolled"
          value={metrics.total}
          subtext="All records in database"
          icon={Users}
          variant="primary"
        />
        <AdminStatCard
          label="Active On-Roll"
          value={metrics.active}
          subtext="Currently attending"
          icon={CheckCircle2}
          variant="emerald"
        />
        <AdminStatCard
          label="Boys On-Roll"
          value={metrics.boys}
          subtext={metrics.active > 0 ? `${Math.round((metrics.boys / metrics.active) * 100)}% of active` : '0%'}
          icon={GraduationCap}
          variant="sky"
        />
        <AdminStatCard
          label="Girls On-Roll"
          value={metrics.girls}
          subtext={metrics.active > 0 ? `${Math.round((metrics.girls / metrics.active) * 100)}% of active` : '0%'}
          icon={GraduationCap}
          variant="violet"
        />
        <AdminStatCard
          label="Alumni & Leavers"
          value={metrics.leavers}
          subtext="TC / Graduated / Withdrawn"
          icon={AlertTriangle}
          variant="amber"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* 3. Search & Filters Bar */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-xs space-y-3">
        {/* Primary row: search + status + class + toggle */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            {search && (
              <button
                onClick={() => { setSearch(''); setCurrentPage(1); }}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search by name, admission no, roll, father, phone..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-8 text-xs outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 text-slate-800 font-medium"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-bold outline-none cursor-pointer"
          >
            <option value="active">Active On-Roll</option>
            <option value="transferred">Transferred (TC)</option>
            <option value="graduated">Graduated / Alumni</option>
            <option value="withdrawn">Withdrawn</option>
            <option value="inactive">Inactive / Suspended</option>
            <option value="all">All Statuses</option>
          </select>

          {/* Class filter */}
          <select
            value={classFilter}
            onChange={(e) => { setClassFilter(e.target.value); setCurrentPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-bold outline-none cursor-pointer"
          >
            <option value="All">All Classes</option>
            {uniqueClasses.map(c => (
              <option key={c} value={c}>{c.startsWith('Class') ? c : `Class ${c}`}</option>
            ))}
          </select>

          {/* More Filters toggle */}
          <button
            onClick={() => setShowMoreFilters(v => !v)}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer",
              showMoreFilters || activeFilterCount > 0
                ? "bg-violet-50 border-violet-200 text-violet-700"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            More Filters
            {activeFilterCount > 0 && (
              <span className="bg-violet-600 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
            {showMoreFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={resetAllFilters}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <X className="w-3 h-3" /> Clear All
            </button>
          )}
        </div>

        {/* Expanded More Filters row */}
        {showMoreFilters && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            {/* Section filter — from DB */}
            <select
              value={sectionFilter}
              onChange={(e) => { setSectionFilter(e.target.value); setCurrentPage(1); }}
              className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-bold outline-none cursor-pointer"
            >
              <option value="All">All Sections</option>
              {uniqueSections.map(s => (
                <option key={s} value={s}>Section {s}</option>
              ))}
            </select>

            {/* Academic Session */}
            <select
              value={sessionFilter}
              onChange={(e) => { setSessionFilter(e.target.value); setCurrentPage(1); }}
              className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-bold outline-none cursor-pointer"
            >
              <option value="All">All Sessions</option>
              {academicYears.map(y => (
                <option key={y.id} value={y.name}>{y.name}</option>
              ))}
            </select>

            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
              className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-bold outline-none cursor-pointer"
            >
              <option value="All">All Categories</option>
              <option value="General">General</option>
              <option value="OBC">OBC</option>
              <option value="SC">SC</option>
              <option value="ST">ST</option>
              <option value="EWS">EWS</option>
            </select>

            {/* Gender filter */}
            <select
              value={genderFilter}
              onChange={(e) => { setGenderFilter(e.target.value); setCurrentPage(1); }}
              className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-bold outline-none cursor-pointer"
            >
              <option value="All">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        )}

        {/* Bulk Selection Action Bar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-500">{selectedIds.length} selected</span>
            <button
              onClick={() => handleExportCSV(true)}
              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> Export Selected
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
            >
              Deselect
            </button>
          </div>
        )}
      </div>

      {/* 4. Enterprise Data Table */}
      <div className="bg-white border border-slate-200/60 rounded-2xl shadow-xs overflow-hidden">
        {/* Table Header Row */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-violet-600" />
            <h3 className="text-sm font-display font-black text-slate-800 uppercase tracking-wider">Student Registry</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400">{sortedStudents.length} students</span>
            {sortField && (
              <button
                onClick={() => { setSortField(null); setSortDir('asc'); }}
                className="text-[10px] font-bold text-violet-600 hover:underline cursor-pointer flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear sort
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-violet-600 animate-spin mb-3" />
            <p className="text-xs text-slate-500 font-medium">Loading student roster from database...</p>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4 space-y-3">
            <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Database query failed</h3>
            <p className="text-xs text-slate-500 max-w-sm">{loadError}</p>
            <button onClick={fetchStudents} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer">
              Retry Query
            </button>
          </div>
        ) : sortedStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4 space-y-3">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No students match current criteria</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              {students.length === 0
                ? 'No students have been enrolled in this database yet.'
                : 'Try adjusting the filters or switching the status filter to "All Statuses".'}
            </p>
            <button
              onClick={resetAllFilters}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 text-[10px] uppercase tracking-wider text-slate-400 font-black bg-slate-50/60">
                  <th className="py-3 px-4 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === paginatedStudents.length && paginatedStudents.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(paginatedStudents.map(s => s.id));
                        else setSelectedIds([]);
                      }}
                      className="rounded text-violet-600 focus:ring-violet-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1.5 font-black uppercase hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      Student <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="py-3 px-3">
                    <button
                      onClick={() => handleSort('admission_number')}
                      className="flex items-center gap-1.5 font-black uppercase hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      Admission / Roll <SortIcon field="admission_number" />
                    </button>
                  </th>
                  <th className="py-3 px-3">
                    <button
                      onClick={() => handleSort('class')}
                      className="flex items-center gap-1.5 font-black uppercase hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      Class <SortIcon field="class" />
                    </button>
                  </th>
                  <th className="py-3 px-3 hidden lg:table-cell">Session</th>
                  <th className="py-3 px-3">Parent / Contact</th>
                  <th className="py-3 px-3 hidden md:table-cell">Category</th>
                  <th className="py-3 px-3">
                    <button
                      onClick={() => handleSort('status')}
                      className="flex items-center gap-1.5 font-black uppercase hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      Status <SortIcon field="status" />
                    </button>
                  </th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium" ref={menuRef}>
                {paginatedStudents.map((student) => {
                  const isSelected = selectedIds.includes(student.id);
                  const isMenuOpen = openMenuId === student.id;

                  return (
                    <tr
                      key={student.id}
                      className={cn(
                        "hover:bg-slate-50/80 transition-colors group cursor-pointer",
                        isSelected && "bg-violet-50/40"
                      )}
                      onClick={() => {
                        setSelected360Student(student);
                        setIs360Open(true);
                      }}
                    >
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds(prev => [...prev, student.id]);
                            else setSelectedIds(prev => prev.filter(id => id !== student.id));
                          }}
                          className="rounded text-violet-600 focus:ring-violet-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs overflow-hidden">
                            {student.photo_url ? (
                              <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              student.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-violet-700 transition-colors">
                              {student.name}
                            </div>
                            <div className="text-[10px] text-slate-400 capitalize mt-0.5">
                              DOB: {student.date_of_birth} • {student.gender || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="font-mono font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded border border-violet-100 text-[11px]">
                          {student.admission_number}
                        </span>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Roll: {student.roll_number || 'N/A'}
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="font-bold text-slate-800">Class {student.class} - {student.section}</span>
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">{student.house_name || 'Tagore House'}</div>
                      </td>

                      <td className="py-3.5 px-3 hidden lg:table-cell">
                        <span className="font-bold text-slate-600">{student.academic_year}</span>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-800">{student.father_name}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 font-medium mt-0.5">
                          <Phone className="w-2.5 h-2.5 text-slate-400" /> {student.phone || 'N/A'}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 hidden md:table-cell">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          student.category === 'General' ? 'bg-slate-100 text-slate-600' :
                          student.category === 'OBC' ? 'bg-blue-50 text-blue-600' :
                          'bg-purple-50 text-purple-600'
                        }`}>
                          {student.category || 'General'}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                          STATUS_STYLES[student.status] || STATUS_STYLES.inactive
                        )}>
                          {student.status}
                        </span>
                      </td>

                      {/* 3-dot Action Menu */}
                      <td className="py-3.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block">
                          <button
                            onClick={() => setOpenMenuId(isMenuOpen ? null : student.id)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                            title="Actions"
                            aria-label="Student actions"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {isMenuOpen && (
                            <div className="absolute right-0 top-8 z-50 w-48 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden text-xs">
                              <button
                                onClick={() => { setSelected360Student(student); setIs360Open(true); setOpenMenuId(null); }}
                                className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 font-bold transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-violet-600" /> View 360° Profile
                              </button>
                              <button
                                onClick={() => handleOpenEdit(student)}
                                className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 font-bold transition-colors cursor-pointer"
                              >
                                <Edit className="w-3.5 h-3.5 text-slate-500" /> Edit Student
                              </button>
                              <button
                                onClick={() => { setPromotionTargetStudent(student); setPromotionModalOpen(true); setOpenMenuId(null); }}
                                className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 font-bold transition-colors cursor-pointer"
                              >
                                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Promote Class
                              </button>
                              <button
                                onClick={() => { setIdCardTargetStudent(student); setIdCardModalOpen(true); setOpenMenuId(null); }}
                                className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 font-bold transition-colors cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5 text-indigo-600" /> Print ID Card
                              </button>
                              <div className="border-t border-slate-100 mt-0.5" />
                              <button
                                onClick={() => { setStatusTargetStudent(student); setStatusModalOpen(true); setOpenMenuId(null); }}
                                className="w-full px-4 py-2.5 text-left hover:bg-rose-50 flex items-center gap-2.5 text-rose-600 font-bold transition-colors cursor-pointer"
                              >
                                <UserMinus className="w-3.5 h-3.5" /> Change Status
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {sortedStudents.length > 0 && !isLoading && !loadError && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 text-xs bg-slate-50/40">
            <div className="text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-bold text-slate-800">{Math.min(currentPage * pageSize, sortedStudents.length)}</span> of{' '}
              <span className="font-bold text-slate-800">{sortedStudents.length}</span> students
            </div>

            <div className="flex items-center gap-3">
              {/* Page size selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold outline-none cursor-pointer text-slate-700"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Previous
                </button>
                <span className="px-2 font-bold text-slate-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Modals & Lifecycle Dialogs */}
      <Student360Drawer
        isOpen={is360Open}
        onClose={() => {
          setIs360Open(false);
          setSelected360Student(null);
        }}
        student={selected360Student}
        onEdit={(stu) => {
          setIs360Open(false);
          handleOpenEdit(stu);
        }}
        onChangeStatus={(stu) => {
          setStatusTargetStudent(stu);
          setStatusModalOpen(true);
        }}
        onPromote={(stu) => {
          setPromotionTargetStudent(stu);
          setPromotionModalOpen(true);
        }}
        onPrintID={(stu) => {
          setIdCardTargetStudent(stu);
          setIdCardModalOpen(true);
        }}
        onRefresh={fetchStudents}
      />

      <StudentFormModal
        open={formOpen}
        initial={editingStudent}
        onClose={() => setFormOpen(false)}
        onSaved={fetchStudents}
      />

<StudentStatusChangeModal
        isOpen={statusModalOpen}
        onClose={() => {
          setStatusModalOpen(false);
          setStatusTargetStudent(null);
        }}
        student={statusTargetStudent}
        onSuccess={fetchStudents}
      />

      <StudentPromotionModal
        isOpen={promotionModalOpen}
        onClose={() => {
          setPromotionModalOpen(false);
          setPromotionTargetStudent(null);
        }}
        student={promotionTargetStudent}
        onSuccess={fetchStudents}
      />

      <StudentIDCardModal
        isOpen={idCardModalOpen}
        onClose={() => {
          setIdCardModalOpen(false);
          setIdCardTargetStudent(null);
        }}
        student={idCardTargetStudent}
      />
    </div>
  );
}
