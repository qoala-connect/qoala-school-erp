import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, Plus, Search, Filter, Download, Printer, Edit2, Trash2, 
  RefreshCw, Check, X, User, Layers, Calendar, Award, AlertTriangle,
  Save, SlidersHorizontal, ArrowLeft, Trash, FileText, ChevronRight, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast, Toaster } from 'sonner';
import { AdminHeader } from '@/components/common/AdminHeader';
import { AdminStatCard } from '@/components/common/AdminStatCard';

interface DisciplinaryRecord {
  id: string;
  student_id: string;
  student_name: string;
  class_name: string;
  infraction: string; // e.g. Unexcused absence/exam misconduct
  action_taken: string; // e.g. Parental meeting/Suspension
  demerit_points: number;
  action_date: string;
  severity: 'Low' | 'Medium' | 'High';
  status: 'Pending' | 'Resolved' | 'Escalated';
}

interface EnrolledStudent {
  id: string;
  name: string;
  class: string;
  section: string;
}

export default function DisciplineManagement() {
  const [records, setRecords] = useState<DisciplinaryRecord[]>([]);
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  // Pagination & selection
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState<any>({});

  const loadData = async () => {
    setIsSyncing(true);
    setErrorState(null);
    try {
      const [recordsRes, studentsRes] = await Promise.all([
        supabase.from('disciplinary_records').select('*').order('incident_date', { ascending: false }),
        supabase.from('students').select('id, name, class, section').eq('status', 'active').order('name').limit(2000)
      ]);

      if (recordsRes.error) throw recordsRes.error;

      if (studentsRes.data) {
        setStudents(studentsRes.data.map((s: any) => ({
          id: s.id, name: s.name || 'Student', class: s.class || '', section: s.section || ''
        })));
      }

      // Map DB columns to interface
      const mapped = (recordsRes.data || []).map((r: any) => ({
        id: r.id,
        student_id: r.student_id || '',
        student_name: r.student_name || 'Student',
        class_name: r.student_class || 'Class',
        infraction: r.description || r.incident_type || '',
        action_taken: r.action_taken || 'Under Review',
        demerit_points: Number(r.demerit_points) || 0,
        action_date: r.incident_date || new Date().toISOString().substring(0, 10),
        severity: r.severity || 'Medium',
        status: r.status || 'Pending'
      }));
      setRecords(mapped);
    } catch (err: any) {
      console.error('Error loading disciplinary records:', err);
      setErrorState(err.message || 'Failed to load disciplinary records');
      toast.error('Unable to load disciplinary records from database.');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      student_id: '',
      infraction: '',
      action_taken: '',
      demerit_points: 5,
      action_date: new Date().toISOString().substring(0, 10),
      severity: 'Medium',
      status: 'Pending'
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (item: DisciplinaryRecord) => {
    setEditingItem(item);
    setFormData({
      ...item
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this incident log?')) return;
    try {
      const { error } = await supabase.from('disciplinary_records').delete().eq('id', id);
      if (error) throw error;
      setSelectedItems(prev => prev.filter(item => item !== id));
      toast.success('Incident log removed');
      await loadData();
    } catch (err: any) {
      toast.error('Deletion failed: ' + err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (!window.confirm(`Delete ${selectedItems.length} selected disciplinary logs?`)) return;

    try {
      const { error } = await supabase.from('disciplinary_records').delete().in('id', selectedItems);
      if (error) throw error;
      setSelectedItems([]);
      toast.success('Selected logs deleted');
      await loadData();
    } catch (err: any) {
      toast.error('Bulk deletion failed: ' + err.message);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.student_id || !formData.infraction || !formData.action_taken) {
      toast.error('Please select the student, and fill in infraction and actions taken');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedStudent = students.find(s => s.id === formData.student_id);
      const payload: any = {
        student_id: formData.student_id,
        student_name: selectedStudent?.name || formData.student_name,
        student_class: selectedStudent ? `Class ${selectedStudent.class}${selectedStudent.section ? `-${selectedStudent.section}` : ''}` : (formData.class_name || 'Class 10th'),
        incident_type: formData.infraction.substring(0, 50) || 'Misconduct',
        description: formData.infraction,
        action_taken: formData.action_taken,
        demerit_points: Number(formData.demerit_points) || 0,
        severity: formData.severity || 'Medium',
        incident_date: formData.action_date || new Date().toISOString().substring(0, 10),
        status: formData.status || 'Pending'
      };

      if (editingItem) {
        const { error } = await supabase
          .from('disciplinary_records')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
        toast.success('Disciplinary log updated');
      } else {
        const { error } = await supabase
          .from('disciplinary_records')
          .insert([payload]);
        if (error) throw error;
        toast.success('Disciplinary incident logged');
      }

      setShowAddModal(false);
      await loadData();
    } catch (err: any) {
      toast.error('Failed to save log: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    const header = 'ID,Student Name,Class,Infraction,Action Taken,Demerits,Action Date,Severity,Status\n';
    const rows = records.map(r => 
      `"${r.id}","${r.student_name}","${r.class_name}","${r.infraction}","${r.action_taken}","${r.demerit_points}","${r.action_date}","${r.severity}","${r.status}"`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Disciplinary_Logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Logs exported successfully');
  };

  // Resolves each imported row to a real student_id by exact name match
  // and inserts into disciplinary_records for real — previously this only
  // spliced parsed rows into local React state, so imported records
  // vanished the moment loadData() re-ran or the page refreshed.
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async (event: any) => {
        try {
          const text = event.target.result;
          let rows: Array<{ student_name: string; infraction: string; action_taken: string; demerit_points: number; action_date: string; severity: string; status: string }> = [];

          if (file.name.endsWith('.json')) {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              rows = parsed.map((p: any) => ({
                student_name: p.student_name || '',
                infraction: p.infraction || 'Infraction detail',
                action_taken: p.action_taken || 'Under Review',
                demerit_points: Number(p.demerit_points) || 0,
                action_date: p.action_date || new Date().toISOString().substring(0, 10),
                severity: p.severity || 'Medium',
                status: p.status || 'Pending'
              }));
            }
          } else {
            const lines = text.split('\n').filter(Boolean);
            for (let i = 1; i < lines.length; i++) {
              const parts = lines[i].split(',').map((p: string) => p.replace(/^"|"$/g, '').trim());
              if (parts.length >= 5) {
                rows.push({
                  student_name: parts[1] || '',
                  infraction: parts[3] || 'Infraction detail',
                  action_taken: parts[4] || 'Under Review',
                  demerit_points: Number(parts[5]) || 0,
                  action_date: parts[6] || new Date().toISOString().substring(0, 10),
                  severity: parts[7] || 'Medium',
                  status: parts[8] || 'Pending'
                });
              }
            }
          }

          const matched = rows
            .map(r => ({ row: r, student: students.find(s => s.name.toLowerCase() === r.student_name.toLowerCase()) }))
            .filter(m => m.student);
          const unmatchedCount = rows.length - matched.length;

          if (matched.length === 0) {
            toast.error('No rows matched an enrolled student by name — nothing imported.');
            return;
          }

          const payload = matched.map(({ row, student }) => ({
            student_id: student!.id,
            student_name: student!.name,
            student_class: `Class ${student!.class}${student!.section ? `-${student!.section}` : ''}`,
            incident_type: row.infraction.substring(0, 50),
            description: row.infraction,
            action_taken: row.action_taken,
            demerit_points: row.demerit_points,
            severity: row.severity,
            incident_date: row.action_date,
            status: row.status
          }));

          const { error } = await supabase.from('disciplinary_records').insert(payload);
          if (error) throw error;

          toast.success(`Imported ${matched.length} incident${matched.length === 1 ? '' : 's'}${unmatchedCount > 0 ? ` (${unmatchedCount} skipped — no matching student name)` : ''}.`);
          await loadData();
        } catch (err: any) {
          toast.error('Import error: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Student Disciplinary Ledger</title>
          <style>
            body { font-family: sans-serif; padding: 25px; color: #333; }
            h1 { font-size: 20px; text-transform: uppercase; margin-bottom: 2px; }
            p { font-size: 11px; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 11px; }
            th { background-color: #f5f5f5; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>ST. JOSEPH'S SCHOOL DISCIPLINE & DEMERIT ROSTER</h1>
          <p>Generated on ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Class</th>
                <th>Infraction logged</th>
                <th>Action Taken</th>
                <th>Demerits</th>
                <th>Incident Date</th>
                <th>Severity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${records.map(r => `
                <tr>
                  <td><strong>${r.student_name}</strong></td>
                  <td>${r.class_name}</td>
                  <td>${r.infraction}</td>
                  <td>${r.action_taken}</td>
                  <td>${r.demerit_points} Points</td>
                  <td>${r.action_date}</td>
                  <td>${r.severity}</td>
                  <td>${r.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Filter & search
  const filteredRecords = useMemo(() => {
    return records.filter(item => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        item.student_name.toLowerCase().includes(query) ||
        item.infraction.toLowerCase().includes(query) ||
        item.action_taken.toLowerCase().includes(query) ||
        item.class_name.toLowerCase().includes(query);
      
      const matchesSeverity = severityFilter === 'all' || item.severity === severityFilter;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesSeverity && matchesStatus;
    });
  }, [records, searchQuery, severityFilter, statusFilter]);

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRecords, currentPage]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedItems.length === paginatedRecords.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(paginatedRecords.map(r => r.id));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16 font-sans antialiased text-slate-800">
      <Toaster position="top-right" richColors />

      {/* 1. Header Toolbar */}
      <AdminHeader
        title="Student Conduct & Discipline Ledger"
        subtitle="Log student code of conduct infractions, demerit points ledger, parent warnings, and rehabilitation statuses."
        badge={{
          icon: ShieldAlert,
          text: 'Discipline & Proctorial Desk',
          variant: 'rose'
        }}
        sessionBadge="Session: 2026-27"
        actions={
          <>
            <button 
              onClick={loadData}
              className={cn(
                "p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/80 rounded-xl transition-all cursor-pointer shadow-2xs",
                isSyncing && "animate-spin text-blue-600"
              )}
              title="Refresh discipline logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Log Disciplinary Action
            </button>
          </>
        }
      />

      {/* 2. Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminStatCard
          label="Cumulative Incidents"
          value={records.length}
          subtext="Logged conduct items"
          icon={ShieldAlert}
          variant="primary"
        />
        <AdminStatCard
          label="Unresolved / Pending"
          value={records.filter(r => r.status === 'Pending').length}
          subtext="Awaiting parent response"
          icon={AlertTriangle}
          variant="amber"
        />
        <AdminStatCard
          label="Escalated Cases"
          value={records.filter(r => r.status === 'Escalated').length}
          subtext="Board review required"
          icon={X}
          variant="rose"
        />
        <AdminStatCard
          label="Resolved Cases"
          value={records.filter(r => r.status === 'Resolved').length}
          subtext="Cleansed conduct file"
          icon={Check}
          variant="emerald"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by student, class, infraction description, action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium h-[38px]"
            />
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-semibold text-slate-600 outline-none h-[38px] cursor-pointer"
          >
            <option value="all">All Severity</option>
            <option value="Low">Low (Detentions / Duties)</option>
            <option value="Medium">Medium (Parent warnings)</option>
            <option value="High">High (Paper cancellations / Suspensions)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-semibold text-slate-600 outline-none h-[38px] cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Resolved">Resolved</option>
            <option value="Escalated">Escalated</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {selectedItems.length > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3.5 h-[38px] bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-600 hover:text-white rounded-xl text-xs font-bold transition-all"
            >
              <Trash className="w-3.5 h-3.5" />
              Retire Selected ({selectedItems.length})
            </button>
          )}

          <button 
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 h-[38px] border border-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-bold transition-all hover:bg-slate-50"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Ledger
          </button>

          <button 
            onClick={handleImport}
            className="flex items-center gap-1.5 px-3.5 h-[38px] border border-dashed border-violet-300 text-violet-600 hover:bg-violet-50 rounded-xl text-xs font-bold transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            Import CSV
          </button>

          <button 
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 h-[38px] bg-violet-50 text-violet-600 border border-violet-100/40 rounded-xl text-xs font-bold hover:bg-violet-600 hover:text-white transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Excel Export
          </button>
        </div>
      </div>

      {/* Incident logs list */}
      <div className="bg-white border border-slate-200/60 shadow-sm rounded-[24px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="p-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={paginatedRecords.length > 0 && selectedItems.length === paginatedRecords.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                  />
                </th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Student Name</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Infraction Details</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Action Imposed</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Action Date</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Severity / Demerits</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Resolution Status</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRecords.length > 0 ? (
                paginatedRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/30 transition-all">
                    <td className="p-4 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedItems.includes(item.id)}
                        onChange={() => toggleSelectItem(item.id)}
                        className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-4">
                      <div>
                        <span className="font-bold text-slate-800 text-xs block">{item.student_name}</span>
                        <span className="text-[10px] text-slate-400 font-semibold mt-0.5">{item.class_name}</span>
                      </div>
                    </td>
                    <td className="p-4 max-w-[200px]">
                      <span className="text-xs text-slate-700 block font-semibold truncate" title={item.infraction}>
                        {item.infraction}
                      </span>
                    </td>
                    <td className="p-4 max-w-[200px]">
                      <span className="text-xs text-slate-600 block truncate font-medium" title={item.action_taken}>
                        {item.action_taken}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" />
                        {new Date(item.action_date).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <span className={cn(
                          "status-pill text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border",
                          item.severity === 'High' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                          item.severity === 'Medium' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                          'bg-slate-50 text-slate-500 border-slate-100'
                        )}>
                          {item.severity}
                        </span>
                        <span className="text-[10px] font-extrabold text-slate-400 block tracking-tight font-mono">
                          {item.demerit_points} Demerits
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "status-pill text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider",
                        item.status === 'Resolved' ? 'bg-emerald-50 text-emerald-600' :
                        item.status === 'Escalated' ? 'bg-rose-50 text-rose-600 animate-pulse' :
                        'bg-amber-50 text-amber-600'
                      )}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-violet-600 transition-all"
                          title="Modify Record"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-all"
                          title="Remove Record"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="max-w-md mx-auto space-y-2">
                      <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-500">No disciplinary incidents logged.</p>
                      <p className="text-[10px] text-slate-400 font-medium">Use "Log Disciplinary Action" to register conduct entries.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Showing page {currentPage} of {totalPages} ({filteredRecords.length} records total)
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 rounded-md text-xs font-bold text-slate-500 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer",
                    currentPage === i + 1 ? "bg-violet-600 text-white" : "bg-slate-50 hover:bg-slate-100 text-slate-500"
                  )}
                >
                  {i + 1}
                </button>
              ))}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 rounded-md text-xs font-bold text-slate-500 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit/Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl border border-slate-100 w-full max-w-lg shadow-2xl overflow-hidden"
          >
            <div className="bg-slate-50/50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                {editingItem ? 'Edit Disciplinary Log' : 'Log Disciplinary Code Violation'}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                  Enrolled Student <span className="text-rose-500">*</span>
                </label>
                {editingItem ? (
                  <div className="w-full bg-slate-100 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-600 font-semibold">
                    {formData.student_name} {formData.class_name ? `— ${formData.class_name}` : ''}
                  </div>
                ) : (
                  <select
                    required
                    value={formData.student_id || ''}
                    onChange={(e) => setFormData((prev: any) => ({ ...prev, student_id: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium cursor-pointer"
                  >
                    <option value="">Select Student...</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.name} — Class {s.class}{s.section ? `-${s.section}` : ''}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                  Infraction logged <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text"
                  required
                  placeholder="e.g., Examination misconduct / damaging science equipment"
                  value={formData.infraction || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, infraction: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                  Action Taken / Imposed <span className="text-rose-500">*</span>
                </label>
                <textarea 
                  rows={2}
                  required
                  placeholder="e.g., Warning letter dispatched, laboratory privileges suspended..."
                  value={formData.action_taken || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, action_taken: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Demerit Points
                  </label>
                  <input 
                    type="number"
                    min="0"
                    value={formData.demerit_points || 5}
                    onChange={(e) => setFormData(prev => ({ ...prev, demerit_points: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Incident Date
                  </label>
                  <input 
                    type="date"
                    value={formData.action_date || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, action_date: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-semibold cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Severity Tier
                  </label>
                  <select
                    value={formData.severity || 'Medium'}
                    onChange={(e) => setFormData(prev => ({ ...prev, severity: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-semibold cursor-pointer"
                  >
                    <option value="Low">Low (Detention)</option>
                    <option value="Medium">Medium (Warning)</option>
                    <option value="High">High (Suspension / Board)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                  Resolution Status
                </label>
                <select
                  value={formData.status || 'Pending'}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-semibold cursor-pointer"
                >
                  <option value="Pending">Pending (Open)</option>
                  <option value="Resolved">Resolved (Cleared)</option>
                  <option value="Escalated">Escalated (Critical)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 h-[38px] bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-md shadow-violet-500/15 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {isSubmitting ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
