import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building, Plus, Search, Filter, Download, Printer, Edit2, Trash2, 
  RefreshCw, Check, X, User, Phone, ShieldCheck, Mail, Send,
  AlertCircle, Save, SlidersHorizontal, ArrowLeft, Trash, FileText, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast, Toaster } from 'sonner';
import { AdminHeader } from '@/components/common/AdminHeader';
import { AdminStatCard } from '@/components/common/AdminStatCard';

interface FrontOfficeLog {
  id: string;
  name: string;
  phone: string;
  type: 'Visitor' | 'Call' | 'Postal' | 'Enquiry';
  purpose: string;
  date_time: string;
  assigned_to: string;
  status: 'Pending' | 'Completed' | 'Resolved';
}

export default function FrontOfficeManagement() {
  const [logs, setLogs] = useState<FrontOfficeLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  // Pagination & selection
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<FrontOfficeLog | null>(null);
  const [formData, setFormData] = useState<Partial<FrontOfficeLog>>({});

  const loadData = async () => {
    setIsSyncing(true);
    setErrorState(null);
    try {
      const { data, error } = await supabase
        .from('front_office_logs')
        .select('*')
        .order('date_time', { ascending: false });
      
      if (error) throw error;
      setLogs(data || []);
    } catch (err: any) {
      console.error('Error fetching front_office_logs:', err);
      setErrorState(err.message || 'Failed to load front office records');
      toast.error('Unable to load front office records from database.');
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
      name: '',
      phone: '',
      type: 'Visitor',
      purpose: '',
      date_time: new Date().toISOString().substring(0, 16),
      assigned_to: 'Admissions Desk',
      status: 'Pending'
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (item: FrontOfficeLog) => {
    setEditingItem(item);
    setFormData({
      ...item,
      date_time: new Date(item.date_time).toISOString().substring(0, 16)
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this front office log?')) return;
    try {
      const { error } = await supabase.from('front_office_logs').delete().eq('id', id);
      if (error) throw error;
      toast.success('Front office record removed');
      setSelectedItems(prev => prev.filter(item => item !== id));
      await loadData();
    } catch (err: any) {
      toast.error('Deletion failed: ' + err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (!window.confirm(`Delete ${selectedItems.length} selected records?`)) return;

    try {
      const { error } = await supabase.from('front_office_logs').delete().in('id', selectedItems);
      if (error) throw error;
      setSelectedItems([]);
      toast.success('Selected records deleted');
      await loadData();
    } catch (err: any) {
      toast.error('Bulk deletion failed: ' + err.message);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.purpose) {
      toast.error('Please fill in name, phone number, and purpose');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        name: formData.name,
        phone: formData.phone,
        type: formData.type || 'Visitor',
        purpose: formData.purpose,
        date_time: new Date(formData.date_time || '').toISOString(),
        assigned_to: formData.assigned_to || 'Admissions Desk',
        status: formData.status || 'Pending'
      };

      if (editingItem) {
        const { error } = await supabase
          .from('front_office_logs')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
        toast.success('Front office log updated');
      } else {
        const { error } = await supabase
          .from('front_office_logs')
          .insert([payload]);
        if (error) throw error;
        toast.success('Front office log registered');
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
    const header = 'ID,Name,Phone,Type,Purpose,Date & Time,Assigned Desk,Status\n';
    const rows = logs.map(l => 
      `"${l.id}","${l.name}","${l.phone}","${l.type}","${l.purpose}","${new Date(l.date_time).toLocaleString()}","${l.assigned_to}","${l.status}"`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Front_Office_Records_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Logs exported successfully');
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
              const updated = [...parsed, ...logs];
              setLogs(updated);
              toast.success(`Imported ${parsed.length} records from JSON`);
            }
          } else {
            const lines = text.split('\n').filter(Boolean);
            const imported: FrontOfficeLog[] = [];
            for (let i = 1; i < lines.length; i++) {
              const parts = lines[i].split(',').map((p: string) => p.replace(/^"|"$/g, '').trim());
              if (parts.length >= 5) {
                imported.push({
                  id: parts[0] || `fo_${Date.now()}_${i}`,
                  name: parts[1] || 'Imported Entry',
                  phone: parts[2] || '',
                  type: (parts[3] as any) || 'Visitor',
                  purpose: parts[4] || 'General Enquiries',
                  date_time: parts[5] ? new Date(parts[5]).toISOString() : new Date().toISOString(),
                  assigned_to: parts[6] || 'Front Desk',
                  status: (parts[7] as any) || 'Pending'
                });
              }
            }
            if (imported.length > 0) {
              const updated = [...imported, ...logs];
              setLogs(updated);
              toast.success(`Imported ${imported.length} logs from CSV`);
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
          <title>Front Office Reception Ledger</title>
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
          <h1>ST. JOSEPH'S RECEPTION & FRONT OFFICE LOGS</h1>
          <p>Generated on ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>Contact Name</th>
                <th>Phone No</th>
                <th>Log Type</th>
                <th>Purpose & Details</th>
                <th>Logged At</th>
                <th>Assigned Dept</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(l => `
                <tr>
                  <td><strong>${l.name}</strong></td>
                  <td>${l.phone}</td>
                  <td>${l.type}</td>
                  <td>${l.purpose}</td>
                  <td>${new Date(l.date_time).toLocaleString()}</td>
                  <td>${l.assigned_to}</td>
                  <td>${l.status}</td>
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
  const filteredLogs = useMemo(() => {
    return logs.filter(item => {
      const query = (searchQuery || '').toLowerCase();
      const matchesSearch = 
        (item.name || '').toLowerCase().includes(query) ||
        (item.phone || '').toLowerCase().includes(query) ||
        (item.purpose || '').toLowerCase().includes(query) ||
        (item.assigned_to || '').toLowerCase().includes(query);
      
      const matchesType = typeFilter === 'all' || item.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [logs, searchQuery, typeFilter, statusFilter]);

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, currentPage]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedItems.length === paginatedLogs.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(paginatedLogs.map(l => l.id));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16 font-sans antialiased text-slate-800">
      <Toaster position="top-center" richColors />

      {/* 1. Header Toolbar */}
      <AdminHeader
        title="Reception, Visitors & Front Office"
        subtitle="Register visitor gate passes, log incoming office phone calls, postal courier receipts, and general admission enquiries."
        badge={{
          icon: Building,
          text: 'Front Office Desk',
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
              title="Refresh logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Office Entry
            </button>
          </>
        }
      />

      {/* 2. Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminStatCard
          label="Gate Visitors Today"
          value={logs.filter(l => l.type === 'Visitor').length}
          subtext="Logged gate passes"
          icon={User}
          variant="primary"
        />
        <AdminStatCard
          label="Admissions Enquiries"
          value={logs.filter(l => l.type === 'Enquiry').length}
          subtext="New admission calls/emails"
          icon={Mail}
          variant="amber"
        />
        <AdminStatCard
          label="Pending Follow-ups"
          value={logs.filter(l => l.status === 'Pending').length}
          subtext="Requires office callback"
          icon={Clock}
          variant="rose"
        />
        <AdminStatCard
          label="Cleared Items"
          value={logs.filter(l => l.status === 'Completed' || l.status === 'Resolved').length}
          subtext="Completed interactions"
          icon={Check}
          variant="emerald"
        />
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by visitor name, phone, purpose, desk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium h-[38px]"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-semibold text-slate-600 outline-none h-[38px] cursor-pointer"
          >
            <option value="all">All Channels</option>
            <option value="Visitor">Physical Visitors</option>
            <option value="Call">Phone Interactions</option>
            <option value="Postal">Postal & Couriers</option>
            <option value="Enquiry">General Enquiries</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-semibold text-slate-600 outline-none h-[38px] cursor-pointer"
          >
            <option value="all">All Resolutions</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
            <option value="Resolved">Resolved</option>
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

      {/* Table block */}
      <div className="bg-white border border-slate-200/60 shadow-sm rounded-[24px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="p-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={paginatedLogs.length > 0 && selectedItems.length === paginatedLogs.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                  />
                </th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Contact Details</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Channel Type</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Purpose / Subject</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Logged Date & Time</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Assigned Office/Desk</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.length > 0 ? (
                paginatedLogs.map((item) => (
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
                        <span className="font-bold text-slate-800 text-xs block">{item.name}</span>
                        <span className="text-[10px] text-slate-400 font-semibold mt-0.5 flex items-center gap-1">
                          <Phone size={11} />
                          {item.phone}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "status-pill text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border tracking-wider",
                        item.type === 'Visitor' ? 'bg-violet-50 text-violet-600 border-violet-100' :
                        item.type === 'Enquiry' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        item.type === 'Postal' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                        'bg-blue-50 text-blue-600 border-blue-100'
                      )}>
                        {item.type}
                      </span>
                    </td>
                    <td className="p-4 max-w-[200px]">
                      <span className="text-xs text-slate-700 block font-semibold truncate" title={item.purpose}>
                        {item.purpose}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Clock size={13} className="text-slate-400" />
                        {new Date(item.date_time).toLocaleString()}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-semibold text-slate-600">
                        {item.assigned_to}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "status-pill text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider",
                        item.status === 'Completed' || item.status === 'Resolved' ? 'bg-emerald-50 text-emerald-600' :
                        'bg-amber-50 text-amber-600 animate-pulse'
                      )}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-violet-600 transition-all"
                          title="Modify Log"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-all"
                          title="Remove Log"
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
                      <p className="text-xs font-bold text-slate-500">No office logs found.</p>
                      <p className="text-[10px] text-slate-400 font-medium">Use "Add Office Entry" to log phone calls, visitors, or couriers.</p>
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
              Showing page {currentPage} of {totalPages} ({filteredLogs.length} records total)
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
                {editingItem ? 'Edit Office Log' : 'Add Front Office / Visitor Entry'}
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
                    Contact Name / Courier Company <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g., Karan Malhotra"
                    value={formData.name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g., +91-98765-43210"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Entry Type
                  </label>
                  <select
                    value={formData.type || 'Visitor'}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-semibold cursor-pointer"
                  >
                    <option value="Visitor">Visitor (Gate Pass Required)</option>
                    <option value="Call">Phone Interaction / Callback</option>
                    <option value="Postal">Postal & Couriers Packages</option>
                    <option value="Enquiry">General Enquiries / Admissions</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Assigned Desk / Office
                  </label>
                  <select
                    value={formData.assigned_to || 'Admissions Desk'}
                    onChange={(e) => setFormData(prev => ({ ...prev, assigned_to: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-semibold cursor-pointer"
                  >
                    <option value="Admissions Desk">Admissions Desk</option>
                    <option value="Principal Office">Principal Office</option>
                    <option value="Inventory Store">Inventory Store</option>
                    <option value="School Clinic">School Clinic</option>
                    <option value="Accounts Section">Accounts Section</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Date & Time
                  </label>
                  <input 
                    type="datetime-local"
                    value={formData.date_time || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, date_time: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-semibold cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Interaction Status
                  </label>
                  <select
                    value={formData.status || 'Pending'}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-semibold cursor-pointer"
                  >
                    <option value="Pending">Pending (Open)</option>
                    <option value="Completed">Completed (Signed Off)</option>
                    <option value="Resolved">Resolved (Handed Over)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                  Purpose / Details of interaction <span className="text-rose-500">*</span>
                </label>
                <textarea 
                  rows={3}
                  required
                  placeholder="e.g., Courier containing science textbooks delivered to accounts dept, parents came to request admission forms..."
                  value={formData.purpose || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium resize-none"
                />
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
                  {isSubmitting ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
