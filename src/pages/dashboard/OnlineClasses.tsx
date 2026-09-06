import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Video, Plus, Search, Filter, Download, Printer, Edit2, Trash2, 
  RefreshCw, Check, X, Calendar, Clock, Link as LinkIcon, User, Layers,
  AlertCircle, Save, SlidersHorizontal, ArrowLeft, Trash, MonitorPlay, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface OnlineClass {
  id: string;
  topic: string;
  class_name: string;
  subject_name: string;
  teacher_name: string;
  date_time: string;
  duration_minutes: number;
  join_url: string;
  status: 'Scheduled' | 'Live' | 'Completed' | 'Cancelled';
}

export default function OnlineClasses() {
  const [classesList, setClassesList] = useState<OnlineClass[]>([]);
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
        .from('online_classes')
        .select('*')
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      
      const mapped = (data || []).map((r: any) => ({
        id: r.id,
        topic: r.title || 'Live Class',
        class_name: r.class || 'Class 10th',
        subject_name: r.subject || 'General',
        teacher_name: r.teacher_name || 'Instructor',
        date_time: r.start_time || new Date().toISOString(),
        duration_minutes: r.end_time && r.start_time ? Math.round((new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 60000) : 45,
        join_url: r.meeting_url || 'https://meet.google.com/',
        status: r.status || 'Scheduled'
      }));
      setClassesList(mapped);
    } catch (err: any) {
      console.error('Error loading online classes:', err);
      setErrorState(err.message || 'Failed to load online classes');
      toast.error('Unable to load online classes from database.');
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
      topic: '',
      class_name: 'Class 10th',
      subject_name: '',
      teacher_name: '',
      date_time: new Date().toISOString().substring(0, 16),
      duration_minutes: 45,
      join_url: 'https://meet.google.com/',
      status: 'Scheduled'
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (item: OnlineClass) => {
    setEditingItem(item);
    setFormData({
      ...item,
      date_time: new Date(item.date_time).toISOString().substring(0, 16)
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to retire this online class?')) return;
    try {
      const { error } = await supabase.from('online_classes').delete().eq('id', id);
      if (error) throw error;
      setSelectedItems(prev => prev.filter(item => item !== id));
      toast.success('Online class removed successfully');
      await loadData();
    } catch (err: any) {
      toast.error('Deletion failed: ' + err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (!window.confirm(`Retire ${selectedItems.length} selected class sessions?`)) return;

    try {
      const { error } = await supabase.from('online_classes').delete().in('id', selectedItems);
      if (error) throw error;
      setSelectedItems([]);
      toast.success('Selected class sessions removed');
      await loadData();
    } catch (err: any) {
      toast.error('Bulk deletion failed: ' + err.message);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.topic || !formData.subject_name || !formData.teacher_name || !formData.join_url) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const startTime = new Date(formData.date_time || Date.now());
      const duration = Number(formData.duration_minutes || 45);
      const endTime = new Date(startTime.getTime() + duration * 60000);

      const payload: any = {
        title: formData.topic,
        class: formData.class_name || 'Class 10th',
        subject: formData.subject_name,
        teacher_name: formData.teacher_name,
        meeting_url: formData.join_url,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: formData.status || 'Scheduled'
      };

      if (editingItem) {
        const { error } = await supabase
          .from('online_classes')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
        toast.success('Online class schedule updated');
      } else {
        const { error } = await supabase
          .from('online_classes')
          .insert([payload]);
        if (error) throw error;
        toast.success('New online class scheduled successfully');
      }

      setShowAddModal(false);
      await loadData();
    } catch (err: any) {
      toast.error('Failed to save online class: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    const header = 'ID,Topic,Class,Subject,Teacher,Date & Time,Duration (Mins),Join URL,Status\n';
    const rows = classesList.map(c => 
      `"${c.id}","${c.topic}","${c.class_name}","${c.subject_name}","${c.teacher_name}","${new Date(c.date_time).toLocaleString()}","${c.duration_minutes}","${c.join_url}","${c.status}"`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `School_Online_Classes_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Classes ledger exported successfully');
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
              const updated = [...parsed, ...classesList];
              setClassesList(updated);
              toast.success(`Imported ${parsed.length} sessions from JSON`);
            }
          } else {
            const lines = text.split('\n').filter(Boolean);
            const imported: OnlineClass[] = [];
            // Skip header
            for (let i = 1; i < lines.length; i++) {
              const parts = lines[i].split(',').map((p: string) => p.replace(/^"|"$/g, '').trim());
              if (parts.length >= 5) {
                imported.push({
                  id: parts[0] || `imported_${Date.now()}_${i}`,
                  topic: parts[1] || 'Imported Class Topic',
                  class_name: parts[2] || 'Class 10th',
                  subject_name: parts[3] || 'General Subject',
                  teacher_name: parts[4] || 'Faculty Member',
                  date_time: parts[5] ? new Date(parts[5]).toISOString() : new Date().toISOString(),
                  duration_minutes: Number(parts[6]) || 45,
                  join_url: parts[7] || 'https://meet.google.com/',
                  status: (parts[8] as any) || 'Scheduled'
                });
              }
            }
            if (imported.length > 0) {
              const updated = [...imported, ...classesList];
              setClassesList(updated);
              toast.success(`Imported ${imported.length} classes from CSV`);
            }
          }
        } catch (err: any) {
          toast.error('Import parsing error: ' + err.message);
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
          <title>Online Classes Schedule Ledger</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            h1 { font-size: 18px; text-transform: uppercase; margin-bottom: 2px; }
            p { font-size: 11px; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 11px; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .status { font-weight: bold; text-transform: uppercase; font-size: 9px; }
          </style>
        </head>
        <body>
          <h1>ST. JOSEPH'S ONLINE CLASSES ROSTER</h1>
          <p>Generated on ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>Topic</th>
                <th>Class</th>
                <th>Subject</th>
                <th>Teacher</th>
                <th>Scheduled Date & Time</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${classesList.map(c => `
                <tr>
                  <td><strong>${c.topic}</strong></td>
                  <td>${c.class_name}</td>
                  <td>${c.subject_name}</td>
                  <td>${c.teacher_name}</td>
                  <td>${new Date(c.date_time).toLocaleString()}</td>
                  <td>${c.duration_minutes} Mins</td>
                  <td><span class="status">${c.status}</span></td>
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

  // Filtered and searched result set
  const filteredClasses = useMemo(() => {
    return classesList.filter(item => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        item.topic.toLowerCase().includes(query) ||
        item.subject_name.toLowerCase().includes(query) ||
        item.teacher_name.toLowerCase().includes(query) ||
        item.class_name.toLowerCase().includes(query);
      
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [classesList, searchQuery, statusFilter]);

  // Paginated set
  const paginatedClasses = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredClasses.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredClasses, currentPage]);

  const totalPages = Math.ceil(filteredClasses.length / itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedItems.length === paginatedClasses.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(paginatedClasses.map(c => c.id));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <MonitorPlay className="w-6 h-6 text-violet-600 shrink-0" />
            Online Classes
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Manage live digital streams, schedule lectures, and configure video meeting URLs.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 h-[38px] bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-md shadow-violet-500/15 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          Schedule Live Stream
        </button>
      </div>

      {/* Summary indicators */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Live Classes', value: classesList.filter(c => c.status === 'Live').length, desc: 'Currently broadcasting', icon: Video, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
          { label: 'Upcoming', value: classesList.filter(c => c.status === 'Scheduled').length, desc: 'Scheduled webinars', icon: Calendar, color: 'bg-violet-50 text-violet-600 border-violet-100' },
          { label: 'Completed', value: classesList.filter(c => c.status === 'Completed').length, desc: 'Past streams archived', icon: Check, color: 'bg-slate-50 text-slate-600 border-slate-100' },
          { label: 'Cancellation Rate', value: classesList.filter(c => c.status === 'Cancelled').length, desc: 'Cancelled meetings', icon: X, color: 'bg-rose-50 text-rose-600 border-rose-100' },
        ].map((card, idx) => (
          <div key={idx} className="bg-white border border-slate-200/60 rounded-2xl p-4 flex items-center gap-4 shadow-2xs">
            <div className={cn("p-3 rounded-xl border shrink-0", card.color)}>
              <card.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider leading-none">{card.label}</p>
              <h3 className="text-lg font-black text-slate-900 mt-1.5 leading-none">{card.value}</h3>
              <p className="text-[9px] text-slate-400 font-semibold mt-1">{card.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter and action bar */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search lectures, topics, classes or instructors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium h-[38px]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-semibold text-slate-600 outline-none h-[38px] cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Live">Live / Active</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {selectedItems.length > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3.5 h-[38px] bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-600 hover:text-white rounded-xl text-xs font-bold transition-all"
            >
              <Trash className="w-3.5 h-3.5" />
              Retire ({selectedItems.length})
            </button>
          )}

          <button 
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 h-[38px] border border-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-bold transition-all hover:bg-slate-50"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Schedule
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

      {/* Roster list */}
      <div className="bg-white border border-slate-200/60 shadow-sm rounded-[24px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="p-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={paginatedClasses.length > 0 && selectedItems.length === paginatedClasses.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                  />
                </th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Topic / Subject</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Assigned Class</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Faculty / Instructor</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Scheduled Date & Duration</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Broadcast Status</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedClasses.length > 0 ? (
                paginatedClasses.map((item) => (
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
                        <span className="font-bold text-slate-800 text-xs block">{item.topic}</span>
                        <span className="text-[10px] text-violet-600 font-semibold mt-0.5 inline-block bg-violet-50 px-2 py-0.5 rounded-full">{item.subject_name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Layers size={13} className="text-slate-400" />
                        {item.class_name}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                        <User size={13} className="text-slate-400" />
                        {item.teacher_name}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-400" />
                          {new Date(item.date_time).toLocaleDateString()} at {new Date(item.date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                          <Clock size={11} />
                          Duration: {item.duration_minutes} Minutes
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "status-pill uppercase font-extrabold tracking-wider text-[9px] px-2.5 py-1 rounded-full",
                        item.status === 'Live' ? 'bg-emerald-50 text-emerald-600' :
                        item.status === 'Scheduled' ? 'bg-violet-50 text-violet-600' :
                        item.status === 'Completed' ? 'bg-slate-50 text-slate-500' :
                        'bg-rose-50 text-rose-500'
                      )}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.status === 'Live' && (
                          <a 
                            href={item.join_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="h-[30px] px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                          >
                            <MonitorPlay size={12} />
                            Launch Stream
                          </a>
                        )}
                        <button 
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-[#1a73e8] transition-all"
                          title="Modify Class"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-all"
                          title="Remove Class"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="max-w-md mx-auto space-y-2">
                      <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-500">No active online classes matching your filter.</p>
                      <p className="text-[10px] text-slate-400 font-medium">Use the "Schedule Live Stream" button to plan digital sessions.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Showing page {currentPage} of {totalPages} ({filteredClasses.length} records total)
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
                {editingItem ? 'Edit Class Schedule' : 'Schedule Live Stream Lecture'}
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
                  Lecture Topic / Title <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text"
                  required
                  placeholder="e.g., Intro to Coordinate Geometry"
                  value={formData.topic || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Academic Class
                  </label>
                  <select
                    value={formData.class_name || 'Class 12th'}
                    onChange={(e) => setFormData(prev => ({ ...prev, class_name: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-semibold cursor-pointer"
                  >
                    {['Class 1st', 'Class 2nd', 'Class 3rd', 'Class 5th', 'Class 10th', 'Class 12th'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Subject Name <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g., Mathematics"
                    value={formData.subject_name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, subject_name: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Faculty / Lecturer <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g., Dr. R. K. Sharma"
                    value={formData.teacher_name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, teacher_name: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Duration (Minutes)
                  </label>
                  <input 
                    type="number"
                    min="1"
                    value={formData.duration_minutes || 45}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Scheduled Start Date & Time <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="datetime-local"
                    required
                    value={formData.date_time || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, date_time: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status || 'Scheduled'}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-semibold cursor-pointer"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="Live">Live / Active</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                  Video Meeting / stream URL <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="url"
                  required
                  placeholder="https://meet.google.com/..."
                  value={formData.join_url || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, join_url: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium"
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
                  {isSubmitting ? 'Saving...' : 'Save Class'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
