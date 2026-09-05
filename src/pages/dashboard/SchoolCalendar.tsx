import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, Plus, Search, Filter, Download, Printer, Edit2, Trash2, 
  RefreshCw, Check, X, Tag, Info, CalendarCheck, Clock, Layers,
  AlertCircle, Save, SlidersHorizontal, ArrowLeft, Trash, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast, Toaster } from 'sonner';
import { AdminHeader } from '@/components/common/AdminHeader';
import { AdminStatCard } from '@/components/common/AdminStatCard';

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  event_type: 'Holiday' | 'Exam' | 'Cultural' | 'Sports' | 'Meeting' | 'Academic';
  color_tag: string; // HEX or color class e.g. '#1a73e8'
}

export default function SchoolCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
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
        .from('holidays')
        .select('*')
        .order('start_date', { ascending: true });
      
      if (error) throw error;

      const typeToColor: Record<string, string> = {
        'Holiday': '#EF4444',
        'Exam': '#F59E0B',
        'Cultural': '#8B5CF6',
        'Sports': '#10B981',
        'Meeting': '#3B82F6',
        'Academic': '#EC4899'
      };

      const mapped = (data || []).map((h: any) => ({
        id: h.id,
        title: h.name || 'School Event',
        description: h.description || 'Academic Calendar Notice',
        start_date: h.date || new Date().toISOString().substring(0, 10),
        end_date: h.end_date || h.date || new Date().toISOString().substring(0, 10),
        event_type: (h.is_restricted ? 'Meeting' : 'Holiday') as any,
        color_tag: h.is_restricted ? '#3B82F6' : '#EF4444'
      }));

      setEvents(mapped);
    } catch (err: any) {
      console.error('Error fetching calendar holidays:', err);
      setErrorState(err.message || 'Failed to load school calendar');
      toast.error('Unable to load calendar events from database.');
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
      title: '',
      description: '',
      start_date: new Date().toISOString().substring(0, 10),
      end_date: new Date().toISOString().substring(0, 10),
      event_type: 'Holiday',
      color_tag: '#EF4444'
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (item: CalendarEvent) => {
    setEditingItem(item);
    setFormData({
      ...item
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      const { error } = await supabase.from('holidays').delete().eq('id', id);
      if (error) throw error;

      setSelectedItems(prev => prev.filter(item => item !== id));
      toast.success('Event removed from academic calendar');
      await loadData();
    } catch (err: any) {
      toast.error('Deletion failed: ' + err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (!window.confirm(`Delete ${selectedItems.length} selected events?`)) return;

    try {
      const { error } = await supabase.from('holidays').delete().in('id', selectedItems);
      if (error) throw error;

      setSelectedItems([]);
      toast.success('Selected events deleted');
      await loadData();
    } catch (err: any) {
      toast.error('Bulk deletion failed: ' + err.message);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.start_date) {
      toast.error('Please enter event title and start date');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        name: formData.title,
        description: formData.description || '',
        date: formData.start_date,
        end_date: formData.end_date || formData.start_date,
        is_restricted: formData.event_type === 'Meeting',
        academic_year: '2026-2027'
      };

      if (editingItem) {
        const { error } = await supabase
          .from('holidays')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
        toast.success('Calendar event updated');
      } else {
        const { error } = await supabase
          .from('holidays')
          .insert([payload]);
        if (error) throw error;
        toast.success('New event added to calendar');
      }

      setShowAddModal(false);
      await loadData();
    } catch (err: any) {
      toast.error('Failed to save event: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    const header = 'ID,Event Title,Description,Start Date,End Date,Event Type,Color\n';
    const rows = events.map(e => 
      `"${e.id}","${e.title}","${e.description}","${e.start_date}","${e.end_date}","${e.event_type}","${e.color_tag}"`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Academic_Calendar_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Calendar data exported');
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
              const updated = [...parsed, ...events];
              setEvents(updated);
              toast.success(`Imported ${parsed.length} events from JSON`);
            }
          } else {
            const lines = text.split('\n').filter(Boolean);
            const imported: CalendarEvent[] = [];
            for (let i = 1; i < lines.length; i++) {
              const parts = lines[i].split(',').map((p: string) => p.replace(/^"|"$/g, '').trim());
              if (parts.length >= 4) {
                imported.push({
                  id: parts[0] || `imported_${Date.now()}_${i}`,
                  title: parts[1] || 'Imported Event',
                  description: parts[2] || '',
                  start_date: parts[3] || new Date().toISOString().substring(0, 10),
                  end_date: parts[4] || parts[3] || new Date().toISOString().substring(0, 10),
                  event_type: (parts[5] as any) || 'Holiday',
                  color_tag: parts[6] || '#EF4444'
                });
              }
            }
            if (imported.length > 0) {
              const updated = [...imported, ...events];
              setEvents(updated);
              toast.success(`Imported ${imported.length} events from CSV`);
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
          <title>St. Joseph’s School Calendar</title>
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
          <h1>OFFICIAL SCHOOL ACADEMIC CALENDAR & EVENTS</h1>
          <p>Generated on ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>Event Title</th>
                <th>Type</th>
                <th>Description</th>
                <th>Starts</th>
                <th>Ends</th>
              </tr>
            </thead>
            <tbody>
              ${events.map(e => `
                <tr>
                  <td><strong>${e.title}</strong></td>
                  <td>${e.event_type}</td>
                  <td>${e.description}</td>
                  <td>${e.start_date}</td>
                  <td>${e.end_date}</td>
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

  // Filter & search logic
  const filteredEvents = useMemo(() => {
    return events.filter(item => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.event_type.toLowerCase().includes(query);
      
      const matchesType = typeFilter === 'all' || item.event_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [events, searchQuery, typeFilter]);

  const paginatedEvents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEvents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEvents, currentPage]);

  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedItems.length === paginatedEvents.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(paginatedEvents.map(e => e.id));
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
        title="Institutional Academic Calendar & Events"
        subtitle="Plan holidays, schedule parent-teacher meetings, track CBSE examinations, and view academic milestones."
        badge={{
          icon: Calendar,
          text: 'Academic Schedules',
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
              title="Refresh calendar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Calendar Event
            </button>
          </>
        }
      />

      {/* 2. Overview Categories */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <AdminStatCard
          label="Holidays"
          value={events.filter(e => e.event_type === 'Holiday').length}
          subtext="Official breaks"
          icon={Calendar}
          variant="rose"
        />
        <AdminStatCard
          label="Exams"
          value={events.filter(e => e.event_type === 'Exam').length}
          subtext="Evaluation terms"
          icon={CalendarCheck}
          variant="amber"
        />
        <AdminStatCard
          label="Cultural"
          value={events.filter(e => e.event_type === 'Cultural').length}
          subtext="Celebrations & fests"
          icon={Tag}
          variant="violet"
        />
        <AdminStatCard
          label="Sports"
          value={events.filter(e => e.event_type === 'Sports').length}
          subtext="Tournaments"
          icon={Layers}
          variant="emerald"
        />
        <AdminStatCard
          label="Meetings"
          value={events.filter(e => e.event_type === 'Meeting').length}
          subtext="PTMs & conferences"
          icon={Clock}
          variant="primary"
        />
        <AdminStatCard
          label="Academic"
          value={events.filter(e => e.event_type === 'Academic').length}
          subtext="Term milestones"
          icon={Info}
          variant="sky"
        />
      </div>

      {/* Filter panel */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search event title, context, or description..."
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
            <option value="all">All Events</option>
            <option value="Holiday">Holidays & Vacations</option>
            <option value="Exam">Examinations</option>
            <option value="Cultural">Cultural Days</option>
            <option value="Sports">Sports Events</option>
            <option value="Meeting">Parent & Staff Meetings</option>
            <option value="Academic">Academic Milestones</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {selectedItems.length > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3.5 h-[38px] bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-600 hover:text-white rounded-xl text-xs font-bold transition-all"
            >
              <Trash className="w-3.5 h-3.5" />
              Retire Events ({selectedItems.length})
            </button>
          )}

          <button 
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 h-[38px] border border-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-bold transition-all hover:bg-slate-50"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Calendar
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
            Excel Ledger
          </button>
        </div>
      </div>

      {/* Main Roster Grid */}
      <div className="bg-white border border-slate-200/60 shadow-sm rounded-[24px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="p-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={paginatedEvents.length > 0 && selectedItems.length === paginatedEvents.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                  />
                </th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Event Name & Details</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Start Date</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">End Date</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider">Event Type</th>
                <th className="p-4 text-xs font-extrabold text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedEvents.length > 0 ? (
                paginatedEvents.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/30 transition-all">
                    <td className="p-4 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedItems.includes(item.id)}
                        onChange={() => toggleSelectItem(item.id)}
                        className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-4 max-w-sm">
                      <div className="flex gap-3">
                        <div 
                          className="w-1.5 rounded-full shrink-0" 
                          style={{ backgroundColor: item.color_tag }} 
                        />
                        <div>
                          <strong className="text-slate-800 text-xs block font-bold">{item.title}</strong>
                          <span className="text-[10px] text-slate-400 font-semibold mt-1 block leading-normal">{item.description}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" />
                        {new Date(item.start_date).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" />
                        {new Date(item.end_date).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="p-4">
                      <span 
                        className="status-pill text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider"
                        style={{ color: item.color_tag, backgroundColor: `${item.color_tag}10` }}
                      >
                        {item.event_type}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-violet-600 transition-all"
                          title="Modify Event"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-all"
                          title="Remove Event"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="max-w-md mx-auto space-y-2">
                      <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-500">No events found in this date cycle.</p>
                      <p className="text-[10px] text-slate-400 font-medium">Click "Add Calendar Event" to populate the schedule.</p>
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
              Showing page {currentPage} of {totalPages} ({filteredEvents.length} records total)
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
                {editingItem ? 'Modify Calendar Event' : 'Schedule New Event / holiday'}
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
                  Event Title <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text"
                  required
                  placeholder="e.g., Diwali Holidays / Annual Athletic Meet"
                  value={formData.title || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                  Event Description
                </label>
                <textarea 
                  rows={3}
                  placeholder="Provide context, dress codes, holidays rules, timings or class scope..."
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Starts Date <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="date"
                    required
                    value={formData.start_date || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-semibold cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Ends Date <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="date"
                    required
                    value={formData.end_date || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-semibold cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                  Event / holiday Category
                </label>
                <select
                  value={formData.event_type || 'Holiday'}
                  onChange={(e) => setFormData(prev => ({ ...prev, event_type: e.target.value as any }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-semibold cursor-pointer"
                >
                  <option value="Holiday">Holiday & Vacations (Red color)</option>
                  <option value="Exam">Examinations & Tests (Yellow color)</option>
                  <option value="Cultural">Cultural Days & Activities (Purple color)</option>
                  <option value="Sports">Sports Events & Practice (Green color)</option>
                  <option value="Meeting">Parent & Staff Meetings (Blue color)</option>
                  <option value="Academic">Academic Milestones & Orientations (Pink color)</option>
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
                  {isSubmitting ? 'Saving...' : 'Save Event'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
