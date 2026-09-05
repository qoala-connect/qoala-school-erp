import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, Plus, Search, Filter, Download, Printer, Edit2, Trash2, 
  RefreshCw, Check, X, ShieldAlert, User, Layers, Calendar, Activity,
  AlertCircle, Save, SlidersHorizontal, ArrowLeft, Trash, FileText, Phone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast, Toaster } from 'sonner';
import { AdminHeader } from '@/components/common/AdminHeader';
import { AdminStatCard } from '@/components/common/AdminStatCard';

interface MedicalRecord {
  id: string;
  student_name: string;
  class_name: string;
  blood_group: string;
  allergies: string;
  vaccinations: string;
  height_cm: number;
  weight_kg: number;
  emergency_contact: string;
  status: 'Fit' | 'Under-Medical-Care' | 'Chronic-Condition';
}

export default function MedicalManagement() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
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
      const { data, error } = await supabase
        .from('student_medical')
        .select('*, students(id, name, class, section)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      const mapped: MedicalRecord[] = (data || []).map((m: any) => ({
        id: m.id,
        student_name: m.students?.name || 'Student Member',
        class_name: m.students?.class ? `Class ${m.students.class}` : 'General',
        blood_group: m.blood_group || 'O+',
        allergies: m.allergies || 'None',
        vaccinations: 'Complete',
        height_cm: Number(m.height_cm || 160),
        weight_kg: Number(m.weight_kg || 50),
        emergency_contact: m.emergency_contact || 'Campus Clinic',
        status: (m.medical_conditions ? 'Under-Medical-Care' : 'Fit') as 'Fit' | 'Under-Medical-Care' | 'Chronic-Condition'
      }));

      setRecords(mapped);
    } catch (err: any) {
      console.error('Error fetching student_medical records:', err);
      setErrorState(err.message || 'Failed to load medical records');
      toast.error('Unable to load medical records from database.');
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
      student_name: '',
      class_name: 'Class 10th',
      blood_group: 'A+',
      allergies: 'None',
      vaccinations: 'All Standard Vaccinations Complete',
      height_cm: 160,
      weight_kg: 55,
      emergency_contact: '',
      status: 'Fit'
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (item: MedicalRecord) => {
    setEditingItem(item);
    setFormData({
      ...item
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this health record?')) return;
    try {
      const { error } = await supabase.from('student_medical').delete().eq('id', id);
      if (error) throw error;

      setSelectedItems(prev => prev.filter(item => item !== id));
      toast.success('Medical record removed');
      await loadData();
    } catch (err: any) {
      toast.error('Deletion failed: ' + err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (!window.confirm(`Delete ${selectedItems.length} selected medical records?`)) return;

    try {
      const { error } = await supabase.from('student_medical').delete().in('id', selectedItems);
      if (error) throw error;

      setSelectedItems([]);
      toast.success('Selected medical files deleted');
      await loadData();
    } catch (err: any) {
      toast.error('Bulk deletion failed: ' + err.message);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.blood_group) {
      toast.error('Please specify blood group and details');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        blood_group: formData.blood_group || 'O+',
        allergies: formData.allergies || 'None',
        height_cm: Number(formData.height_cm || 160),
        weight_kg: Number(formData.weight_kg || 55),
        emergency_contact: formData.emergency_contact || 'Campus Clinic',
        medical_conditions: formData.status === 'Under-Medical-Care' ? 'Requires monitoring' : null,
        remarks: 'Health record verified'
      };

      if (editingItem) {
        const { error } = await supabase
          .from('student_medical')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
        toast.success('Student medical file updated');
      } else {
        const { error } = await supabase
          .from('student_medical')
          .insert([payload]);
        if (error) throw error;
        toast.success('Student health card registered');
      }

      setShowAddModal(false);
      await loadData();
    } catch (err: any) {
      toast.error('Failed to save medical file: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    const header = 'ID,Student Name,Class,Blood Group,Allergies,Vaccinations,Height (cm),Weight (kg),Emergency Contact,Status\n';
    const rows = records.map(r => 
      `"${r.id}","${r.student_name}","${r.class_name}","${r.blood_group}","${r.allergies}","${r.vaccinations}","${r.height_cm}","${r.weight_kg}","${r.emergency_contact}","${r.status}"`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Medical_Logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Medical log exported successfully');
  };

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
          if (file.name.endsWith('.json')) {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              const updated = [...parsed, ...records];
              setRecords(updated);
              toast.success(`Imported ${parsed.length} records from JSON`);
            }
          } else {
            const lines = text.split('\n').filter(Boolean);
            const imported: MedicalRecord[] = [];
            for (let i = 1; i < lines.length; i++) {
              const parts = lines[i].split(',').map((p: string) => p.replace(/^"|"$/g, '').trim());
              if (parts.length >= 5) {
                imported.push({
                  id: parts[0] || `med_${Date.now()}_${i}`,
                  student_name: parts[1] || 'Imported Student',
                  class_name: parts[2] || 'Class 10th',
                  blood_group: parts[3] || 'O+',
                  allergies: parts[4] || 'None',
                  vaccinations: parts[5] || 'Complete',
                  height_cm: Number(parts[6]) || 155,
                  weight_kg: Number(parts[7]) || 50,
                  emergency_contact: parts[8] || 'Emergency Number',
                  status: (parts[9] as any) || 'Fit'
                });
              }
            }
            if (imported.length > 0) {
              const updated = [...imported, ...records];
              setRecords(updated);
              toast.success(`Imported ${imported.length} medical cards from CSV`);
            }
          }
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
          <title>Student Health Ledger - St. Joseph’s School</title>
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
          <h1>ST. JOSEPH'S SCHOOL CLINIC & HEALTH LEDGER</h1>
          <p>Generated on ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Class</th>
                <th>Blood Group</th>
                <th>Allergies</th>
                <th>Vaccinations</th>
                <th>Height / Weight</th>
                <th>Emergency Contacts</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${records.map(r => `
                <tr>
                  <td><strong>${r.student_name}</strong></td>
                  <td>${r.class_name}</td>
                  <td>${r.blood_group}</td>
                  <td>${r.allergies}</td>
                  <td>${r.vaccinations}</td>
                  <td>${r.height_cm} cm / ${r.weight_kg} kg</td>
                  <td>${r.emergency_contact}</td>
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
        item.allergies.toLowerCase().includes(query) ||
        item.blood_group.toLowerCase().includes(query) ||
        item.class_name.toLowerCase().includes(query);
      
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [records, searchQuery, statusFilter]);

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
        title="Student Health & Medical Care"
        subtitle="Track student wellness cards, allergies database, required vaccinations checklist, and clinical infirmary logs."
        badge={{
          icon: Heart,
          text: 'Infirmary & Health Desk',
          variant: 'primary'
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
              title="Refresh medical files"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create Medical File
            </button>
          </>
        }
      />

      {/* 2. Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminStatCard
          label="Active Profiles"
          value={records.length}
          subtext="Registered student health cards"
          icon={Heart}
          variant="primary"
        />
        <AdminStatCard
          label="Chronic Conditions"
          value={records.filter(r => r.status === 'Chronic-Condition').length}
          subtext="Requires critical monitoring"
          icon={ShieldAlert}
          variant="rose"
        />
        <AdminStatCard
          label="Under Recovery / Obs"
          value={records.filter(r => r.status === 'Under-Medical-Care').length}
          subtext="Recent clinic visits"
          icon={Activity}
          variant="amber"
        />
        <AdminStatCard
          label="Declared General Fit"
          value={records.filter(r => r.status === 'Fit').length}
          subtext="General checkup cleared"
          icon={Check}
          variant="emerald"
        />
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by student name, allergies, class, blood type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-medium h-[38px]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-semibold text-slate-600 outline-none h-[38px] cursor-pointer"
          >
            <option value="all">All Health Profiles</option>
            <option value="Fit">Fit / Standard Clearance</option>
            <option value="Under-Medical-Care">Under Observation / Care</option>
            <option value="Chronic-Condition">Critical (Asthma / Chronic Allergies)</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {selectedItems.length > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3.5 h-[38px] bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-600 hover:text-white rounded-xl text-xs font-bold transition-all"
            >
              <Trash className="w-3.5 h-3.5" />
              Retire Cards ({selectedItems.length})
            </button>
          )}

          <button 
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 h-[38px] border border-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-bold transition-all hover:bg-slate-50"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Health Cards
          </button>

          <button 
            onClick={handleImport}
            className="flex items-center gap-1.5 px-3.5 h-[38px] border border-dashed border-rose-300 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            Import CSV
          </button>

          <button 
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 h-[38px] bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-600 hover:text-white transition-all rounded-xl text-xs font-bold"
          >
            <Download className="w-3.5 h-3.5" />
            Excel Export
          </button>
        </div>
      </div>

      {/* Grid Roster Table */}
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
                    className="rounded border-slate-300 text-rose-500 focus:ring-rose-500 cursor-pointer"
                  />
                </th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Student & Class</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Blood Group</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Allergies & Contraindications</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Height / Weight</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Emergency Contacts</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Medical Status</th>
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
                        className="rounded border-slate-300 text-rose-500 focus:ring-rose-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-4">
                      <div>
                        <span className="font-bold text-slate-800 text-xs block">{item.student_name}</span>
                        <span className="text-[10px] text-slate-400 font-semibold mt-0.5">{item.class_name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-extrabold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-100/50">
                        {item.blood_group}
                      </span>
                    </td>
                    <td className="p-4 max-w-[200px]">
                      <div className="space-y-0.5">
                        <span className="text-xs text-slate-700 block font-semibold truncate" title={item.allergies}>
                          <strong>Allergies: </strong>{item.allergies}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium block truncate" title={item.vaccinations}>
                          <strong>Immunization: </strong>{item.vaccinations}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-xs font-semibold text-slate-600">
                      {item.height_cm} cm / {item.weight_kg} kg
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                        <Phone size={12} className="text-slate-400 shrink-0" />
                        {item.emergency_contact}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "status-pill text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider",
                        item.status === 'Fit' ? 'bg-emerald-50 text-emerald-600' :
                        item.status === 'Chronic-Condition' ? 'bg-rose-50 text-rose-600' :
                        'bg-amber-50 text-amber-600'
                      )}>
                        {item.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-600 transition-all"
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
                      <p className="text-xs font-bold text-slate-500">No student wellness files found.</p>
                      <p className="text-[10px] text-slate-400 font-medium">Click "Create Medical File" to populate student diagnostics card.</p>
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
                    currentPage === i + 1 ? "bg-rose-600 text-white" : "bg-slate-50 hover:bg-slate-100 text-slate-500"
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
                {editingItem ? 'Edit Health Profile' : 'Register New Medical File'}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Student Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g., Aarav Mishra"
                    value={formData.student_name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, student_name: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Student Class / Grade
                  </label>
                  <select
                    value={formData.class_name || 'Class 12th'}
                    onChange={(e) => setFormData(prev => ({ ...prev, class_name: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-semibold cursor-pointer"
                  >
                    {['Class 1st', 'Class 2nd', 'Class 3rd', 'Class 5th', 'Class 10th', 'Class 12th'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Blood Group
                  </label>
                  <select
                    value={formData.blood_group || 'A+'}
                    onChange={(e) => setFormData(prev => ({ ...prev, blood_group: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-semibold cursor-pointer"
                  >
                    {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Height (cm)
                  </label>
                  <input 
                    type="number"
                    value={formData.height_cm || 160}
                    onChange={(e) => setFormData(prev => ({ ...prev, height_cm: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Weight (kg)
                  </label>
                  <input 
                    type="number"
                    value={formData.weight_kg || 55}
                    onChange={(e) => setFormData(prev => ({ ...prev, weight_kg: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                  Active Allergies / Medical Exclusions
                </label>
                <input 
                  type="text"
                  placeholder="e.g., Peanuts allergy, Lactose Intolerant, Asthmatic, Penicillin exclusion..."
                  value={formData.allergies || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, allergies: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                  Vaccinations History Checklist
                </label>
                <input 
                  type="text"
                  placeholder="e.g., MMR, Polio Boosters Complete"
                  value={formData.vaccinations || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, vaccinations: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Emergency contact detail <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g., +91-98765-43210 (Father)"
                    value={formData.emergency_contact || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    General Wellness Clearance Status
                  </label>
                  <select
                    value={formData.status || 'Fit'}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-semibold cursor-pointer"
                  >
                    <option value="Fit">Fit / Clear</option>
                    <option value="Under-Medical-Care">Under Observation / Care</option>
                    <option value="Chronic-Condition">Critical Monitoring (Asthma / Chronic)</option>
                  </select>
                </div>
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
                  className="flex items-center gap-2 px-4 h-[38px] bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-md shadow-rose-500/15 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {isSubmitting ? 'Saving...' : 'Save File'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
