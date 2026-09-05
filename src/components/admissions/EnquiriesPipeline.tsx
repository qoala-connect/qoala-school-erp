import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Search, 
  Plus, 
  Download, 
  Calendar, 
  Phone, 
  Mail, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  Edit3, 
  Trash2, 
  UserCheck, 
  Sparkles, 
  Filter, 
  Layers, 
  Table, 
  Flame, 
  ChevronRight,
  Send,
  AlertCircle,
  Building,
  X
} from 'lucide-react';
import { AdmissionEnquiry, EnquiryStatus, EnquirySource, LeadPriority } from '@/types/admission';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface EnquiriesPipelineProps {
  enquiries: AdmissionEnquiry[];
  onSaveEnquiry: (enquiry: Partial<AdmissionEnquiry>, editingId?: string) => void;
  onDeleteEnquiry: (id: string) => void;
  onConvertToApplication: (enquiry: AdmissionEnquiry) => void;
  onExportCSV: (data: any[], filename: string) => void;
}

const PIPELINE_COLUMNS: { id: EnquiryStatus; label: string; color: string; border: string; bg: string }[] = [
  { id: 'New', label: '1. New Leads', color: 'text-blue-700', border: 'border-blue-200', bg: 'bg-blue-50/70' },
  { id: 'Contacted', label: '2. Contacted / Call Back', color: 'text-indigo-700', border: 'border-indigo-200', bg: 'bg-indigo-50/70' },
  { id: 'Campus Tour', label: '3. Campus Tour Done', color: 'text-amber-700', border: 'border-amber-200', bg: 'bg-amber-50/70' },
  { id: 'Assessment Scheduled', label: '4. Assessment Scheduled', color: 'text-purple-700', border: 'border-purple-200', bg: 'bg-purple-50/70' },
  { id: 'Converted', label: '5. Converted to Application', color: 'text-emerald-700', border: 'border-emerald-200', bg: 'bg-emerald-50/70' },
  { id: 'Dropped', label: '6. Dropped / Closed', color: 'text-slate-600', border: 'border-slate-200', bg: 'bg-slate-100/70' }
];

export default function EnquiriesPipeline({
  enquiries,
  onSaveEnquiry,
  onDeleteEnquiry,
  onConvertToApplication,
  onExportCSV
}: EnquiriesPipelineProps) {
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState<AdmissionEnquiry | null>(null);
  const [selectedForLog, setSelectedForLog] = useState<AdmissionEnquiry | null>(null);
  const [newRemarkText, setNewRemarkText] = useState('');

  const [formState, setFormState] = useState<Partial<AdmissionEnquiry>>({
    parent_name: '',
    child_name: '',
    phone: '',
    email: '',
    target_class: '1st',
    source: 'Walk-in',
    status: 'New',
    priority: 'Medium',
    notes: '',
    follow_up_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    assigned_to: 'Admissions Desk',
    previous_school: ''
  });

  const openNewModal = () => {
    setEditingEnquiry(null);
    setFormState({
      parent_name: '',
      child_name: '',
      phone: '',
      email: '',
      target_class: '1st',
      source: 'Walk-in',
      status: 'New',
      priority: 'Medium',
      notes: '',
      follow_up_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      assigned_to: 'Admissions Desk',
      previous_school: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (enq: AdmissionEnquiry) => {
    setEditingEnquiry(enq);
    setFormState(enq);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.parent_name || !formState.phone) {
      toast.error('Parent Name and Contact Phone are required.');
      return;
    }
    onSaveEnquiry(formState, editingEnquiry?.id);
    setIsModalOpen(false);
  };

  const handleAddRemark = (enq: AdmissionEnquiry) => {
    if (!newRemarkText.trim()) return;
    const newRemark = {
      id: `rem-${Date.now()}`,
      date: new Date().toISOString(),
      author: 'Admissions Counselor',
      text: newRemarkText.trim()
    };
    const updatedHistory = [...(enq.remarks_history || []), newRemark];
    onSaveEnquiry({ remarks_history: updatedHistory }, enq.id);
    setNewRemarkText('');
    toast.success('Communication note appended to lead profile.');
  };

  // Filter Logic
  const filtered = enquiries.filter(e => {
    const matchSearch = e.parent_name.toLowerCase().includes(search.toLowerCase()) ||
                        e.child_name.toLowerCase().includes(search.toLowerCase()) ||
                        e.phone.includes(search);
    const matchSource = sourceFilter === 'all' || e.source === sourceFilter;
    const matchPriority = priorityFilter === 'all' || e.priority === priorityFilter;
    const matchGrade = gradeFilter === 'all' || e.target_class === gradeFilter;
    return matchSearch && matchSource && matchPriority && matchGrade;
  });

  const getPriorityBadge = (p: LeadPriority) => {
    switch (p) {
      case 'High':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-50 text-rose-600 border border-rose-200"><Flame size={10} /> Hot Lead</span>;
      case 'Medium':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-50 text-amber-600 border border-amber-200">Warm</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200">Standard</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Top CRM Toolbar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search parent name, child name, or mobile number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </div>

        {/* Filters & View Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Priority */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="High">Hot / High Priority</option>
            <option value="Medium">Warm Priority</option>
            <option value="Low">Standard</option>
          </select>

          {/* Source */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer"
          >
            <option value="all">All Inflow Channels</option>
            <option value="Walk-in">Walk-in Visit</option>
            <option value="Phone Call">Phone Call</option>
            <option value="Website">Website Form</option>
            <option value="Parent Referral">Parent Referral</option>
            <option value="Social Media">Social Media</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                "p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                viewMode === 'kanban' ? "bg-white text-violet-700 shadow-xs" : "text-slate-500 hover:text-slate-900"
              )}
              title="Pipeline Board"
            >
              <Layers size={14} />
              <span className="hidden sm:inline">Pipeline</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                viewMode === 'table' ? "bg-white text-violet-700 shadow-xs" : "text-slate-500 hover:text-slate-900"
              )}
              title="Table Grid"
            >
              <Table size={14} />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>

          <button
            onClick={openNewModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>Log Parent Lead</span>
          </button>

          <button
            onClick={() => onExportCSV(filtered, 'SDPS_Admission_Leads')}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            title="Export Leads to CSV"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      {/* KANBAN PIPELINE VIEW */}
      {viewMode === 'kanban' && (
        <div className="flex gap-4 items-start overflow-x-auto pb-4 pt-1 scrollbar-thin">
          {PIPELINE_COLUMNS.map((col) => {
            const columnLeads = filtered.filter(e => e.status === col.id);
            return (
              <div 
                key={col.id} 
                className={cn(
                  "w-80 shrink-0 rounded-2xl border p-3.5 flex flex-col gap-3 min-h-[460px] transition-all shadow-2xs",
                  col.bg,
                  col.border
                )}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80">
                  <h4 className={cn("text-[11px] font-black uppercase tracking-wider", col.color)}>
                    {col.label}
                  </h4>
                  <span className="w-5 h-5 rounded-full bg-white text-slate-800 font-bold text-[10px] flex items-center justify-center shadow-2xs border border-slate-200/80">
                    {columnLeads.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-0.5">
                  {columnLeads.length === 0 ? (
                    <div className="h-32 border border-dashed border-slate-300/80 rounded-xl flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase">
                      No leads in stage
                    </div>
                  ) : (
                    columnLeads.map((enq) => (
                      <motion.div
                        key={enq.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-3.5 bg-white border border-slate-200/90 rounded-xl shadow-2xs hover:shadow-sm transition-all space-y-3 text-xs group"
                      >
                        {/* Card Top */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md border border-slate-200/60 inline-block">
                              Class {enq.target_class}
                            </span>
                            <h5 className="font-bold text-slate-900 mt-1.5 leading-snug">{enq.child_name || 'Prospective Student'}</h5>
                            <p className="text-[11px] text-slate-500 font-medium">Guardian: {enq.parent_name}</p>
                          </div>
                          <div className="shrink-0">
                            {getPriorityBadge(enq.priority)}
                          </div>
                        </div>

                        {/* Contact & Channel */}
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                          <span className="font-mono text-slate-800 flex items-center gap-1.5 font-bold">
                            <Phone size={11} className="text-violet-600 shrink-0" />
                            {enq.phone}
                          </span>
                          <span className="font-semibold text-slate-400 text-[10px] bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                            {enq.source}
                          </span>
                        </div>

                        {/* Notes preview */}
                        {enq.notes && (
                          <p className="text-[11px] text-slate-600 line-clamp-2 italic bg-slate-50/80 p-2 rounded-lg border border-slate-100 leading-relaxed">
                            "{enq.notes}"
                          </p>
                        )}

                        {/* Follow up & Actions */}
                        <div className="flex items-center justify-between pt-2 text-[11px] border-t border-slate-50">
                          <span className="text-amber-700 font-bold flex items-center gap-1 text-[10px]">
                            <Clock size={11} className="shrink-0" />
                            <span>{enq.follow_up_date || 'No Date'}</span>
                          </span>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {enq.status !== 'Converted' && (
                              <button
                                onClick={() => onConvertToApplication(enq)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[9px] uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-xs whitespace-nowrap"
                                title="Convert to Admission Application"
                              >
                                <ArrowRight size={10} />
                                <span>Convert</span>
                              </button>
                            )}

                            <button
                              onClick={() => openEditModal(enq)}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                              title="Edit Lead"
                            >
                              <Edit3 size={13} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ENTERPRISE TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[1000px] border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200/90 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 min-w-[220px]">Student & Parent</th>
                  <th className="py-3.5 px-4 min-w-[170px]">Contact & Channel</th>
                  <th className="py-3.5 px-4 min-w-[100px]">Target Grade</th>
                  <th className="py-3.5 px-4 min-w-[120px]">Lead Priority</th>
                  <th className="py-3.5 px-4 min-w-[160px]">Pipeline Status</th>
                  <th className="py-3.5 px-4 min-w-[240px]">Follow-Up & Notes</th>
                  <th className="py-3.5 px-4 min-w-[150px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-slate-400">
                      <div className="space-y-1.5">
                        <p className="font-bold text-slate-600 text-sm">No enquiry records match your query.</p>
                        <p className="text-xs text-slate-400">Clear your search filters or click "Log Parent Lead" above to record a new inbound lead.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((enq) => (
                    <tr key={enq.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. Student & Parent */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xs border border-violet-200 shrink-0">
                            {enq.child_name ? enq.child_name[0] : 'P'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{enq.child_name || 'Prospective Student'}</p>
                            <p className="text-[11px] text-slate-500 font-medium truncate">Parent: {enq.parent_name}</p>
                          </div>
                        </div>
                      </td>

                      {/* 2. Contact & Channel */}
                      <td className="py-3.5 px-4">
                        <p className="font-mono font-bold text-slate-900 whitespace-nowrap">{enq.phone}</p>
                        <span className="inline-block mt-0.5 text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-semibold border border-slate-200/50">
                          {enq.source}
                        </span>
                      </td>

                      {/* 3. Target Grade */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-bold rounded-lg text-[11px] border border-slate-200/60">
                          Class {enq.target_class}
                        </span>
                      </td>

                      {/* 4. Priority */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getPriorityBadge(enq.priority)}
                      </td>

                      {/* 5. Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                          enq.status === 'Converted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          enq.status === 'Dropped' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                          'bg-violet-50 text-violet-700 border-violet-200'
                        )}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {enq.status}
                        </span>
                      </td>

                      {/* 6. Follow-up & Notes */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <p className="text-[11px] text-slate-700 font-medium line-clamp-2 max-w-xs">{enq.notes || 'No discussion notes logged'}</p>
                          <p className="text-[10px] text-amber-700 font-bold flex items-center gap-1 whitespace-nowrap">
                            <Clock size={11} className="shrink-0" />
                            <span>Follow up: {enq.follow_up_date || 'N/A'}</span>
                          </p>
                        </div>
                      </td>

                      {/* 7. Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {enq.status !== 'Converted' && (
                            <button
                              onClick={() => onConvertToApplication(enq)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all shadow-xs cursor-pointer whitespace-nowrap"
                              title="Convert to Formal Application"
                            >
                              <ArrowRight size={12} />
                              <span>Convert</span>
                            </button>
                          )}

                          <button
                            onClick={() => openEditModal(enq)}
                            className="p-1.5 hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                            title="Edit Lead"
                          >
                            <Edit3 size={14} />
                          </button>

                          <button
                            onClick={() => onDeleteEnquiry(enq.id)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="Delete Lead"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: LOG / EDIT LEAD (Centered with non-clipping viewport) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs flex justify-center items-start">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-auto sm:my-6 flex flex-col max-h-[92vh]"
            >
              <div className="flex justify-between items-center border-b border-slate-100 px-6 py-4 bg-slate-900 text-white shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-violet-600 text-white rounded-xl shrink-0">
                    <MessageSquare size={16} />
                  </div>
                  <div>
                    <h3 className="font-black text-white text-sm">
                      {editingEnquiry ? 'Edit Parent Lead Profile' : 'Log New Parent Lead & Enquiry'}
                    </h3>
                    <p className="text-[11px] text-slate-300">Record inbound student query details for follow-up.</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">Parent / Guardian Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formState.parent_name || ''}
                      onChange={(e) => setFormState({ ...formState, parent_name: e.target.value })}
                      placeholder="e.g. Ramesh Sharma"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">Child's Name</label>
                    <input
                      type="text"
                      value={formState.child_name || ''}
                      onChange={(e) => setFormState({ ...formState, child_name: e.target.value })}
                      placeholder="e.g. Aarav Sharma"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">Contact Phone *</label>
                    <input
                      type="tel"
                      required
                      value={formState.phone || ''}
                      onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                      placeholder="Mobile number"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">Target Grade</label>
                    <select
                      value={formState.target_class || '1st'}
                      onChange={(e) => setFormState({ ...formState, target_class: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500/20"
                    >
                      {['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'].map(c => (
                        <option key={c} value={c}>Class {c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">Lead Source</label>
                    <select
                      value={formState.source || 'Walk-in'}
                      onChange={(e) => setFormState({ ...formState, source: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500/20"
                    >
                      <option value="Walk-in">Walk-in Visit</option>
                      <option value="Phone Call">Phone Call</option>
                      <option value="Website">Website Portal</option>
                      <option value="Parent Referral">Parent Referral</option>
                      <option value="Social Media">Social Media</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">Pipeline Status</label>
                    <select
                      value={formState.status || 'New'}
                      onChange={(e) => setFormState({ ...formState, status: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500/20"
                    >
                      <option value="New">1. New Lead</option>
                      <option value="Contacted">2. Contacted / Call Back</option>
                      <option value="Campus Tour">3. Campus Tour</option>
                      <option value="Assessment Scheduled">4. Assessment Scheduled</option>
                      <option value="Converted">5. Converted</option>
                      <option value="Dropped">6. Dropped</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">Lead Urgency</label>
                    <select
                      value={formState.priority || 'Medium'}
                      onChange={(e) => setFormState({ ...formState, priority: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500/20"
                    >
                      <option value="High">Hot (Immediate)</option>
                      <option value="Medium">Warm</option>
                      <option value="Low">Standard</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Next Scheduled Follow-Up Date</label>
                  <input
                    type="date"
                    value={formState.follow_up_date || ''}
                    onChange={(e) => setFormState({ ...formState, follow_up_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Parent Queries / Discussion Notes</label>
                  <textarea
                    rows={3}
                    value={formState.notes || ''}
                    onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                    placeholder="e.g. Enquired regarding CBSE syllabus, bus transportation routes, and sibling discount."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs shadow-md cursor-pointer"
                  >
                    {editingEnquiry ? 'Save Lead Changes' : 'Record New Enquiry'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
