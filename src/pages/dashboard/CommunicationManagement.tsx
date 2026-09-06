import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Plus, Search, Filter, Download, Printer, Edit2, Trash2, 
  RefreshCw, Check, X, Bell, Mail, Send, Radio, FileText, CheckCircle2,
  AlertCircle, Sparkles, Database, Save, SlidersHorizontal, ArrowLeft, Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { AdminHeader } from '@/components/common/AdminHeader';
import { AdminStatCard } from '@/components/common/AdminStatCard';

interface Notice {
  id: string;
  title: string;
  author: string;
  publish_date: string;
  audience: 'All' | 'Students' | 'Staff' | 'Parents';
  description: string;
  attachments?: string[];
}

interface SmsLog {
  id: string;
  category: 'Security' | 'Academic' | 'Fee Reminder' | 'Attendance';
  message: string;
  recipient_count: number;
  dispatch_time: string;
  status: 'Sent' | 'Failed' | 'Delivered';
}

interface EmailBroadcast {
  id: string;
  subject: string;
  target_group: string;
  sender: string;
  status: 'Sent' | 'Draft' | 'Failed';
  sent_date: string;
}

interface PushAlert {
  id: string;
  title: string;
  message: string;
  sent_date: string;
  clicks: number;
}

type TabType = 'notices' | 'sms' | 'email' | 'push';

export default function CommunicationManagement() {
  const location = useLocation();
  const requestedTab = (location.state as any)?.activeTab as TabType | undefined;
  const [activeTab, setActiveTab] = useState<TabType>(requestedTab || 'notices');

  useEffect(() => {
    if (requestedTab && ['notices', 'sms', 'email', 'push'].includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const [searchQuery, setSearchQuery] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  // States
  const [notices, setNotices] = useState<Notice[]>([]);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [emails, setEmails] = useState<EmailBroadcast[]>([]);
  const [pushAlerts, setPushAlerts] = useState<PushAlert[]>([]);

  // Selection
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [showMigrationSql, setShowMigrationSql] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const loadData = async () => {
    setIsSyncing(true);
    setErrorState(null);
    try {
      const [noticesRes, smsRes, emailRes] = await Promise.all([
        supabase.from('notices').select('*').order('created_at', { ascending: false }),
        // sms_logs / email_logs timestamp their rows with sent_at, not created_at.
        supabase.from('sms_logs').select('*').order('sent_at', { ascending: false }),
        supabase.from('email_logs').select('*').order('sent_at', { ascending: false })
      ]);

      if (noticesRes.data) {
        setNotices(noticesRes.data.map((n: any) => ({
          id: n.id,
          title: n.title || 'School Notice',
          author: n.created_by || 'Admin Office',
          publish_date: n.publish_date || n.created_at || new Date().toISOString().substring(0, 10),
          audience: n.target_audience || 'All',
          description: n.description || '',
          attachments: []
        })));
      }

      if (smsRes.data) {
        setSmsLogs(smsRes.data.map((s: any) => ({
          id: s.id,
          category: s.type || 'Academic',
          message: s.message_text || '',
          recipient_count: Number(s.recipient_count || 1),
          dispatch_time: s.sent_at || new Date().toISOString(),
          status: s.status || 'Delivered'
        })));
      }

      if (emailRes.data) {
        setEmails(emailRes.data.map((em: any) => ({
          id: em.id,
          subject: em.subject || 'Broadcast',
          target_group: em.recipient_email || 'General',
          sender: 'admin@school.com',
          status: em.status || 'Sent',
          sent_date: em.sent_at || new Date().toISOString().substring(0, 10)
        })));
      }

    } catch (error: any) {
      console.error('Error loading communication data:', error);
      setErrorState(error.message || 'Failed to load communication records');
      toast.error('Unable to load communication data from database.');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (activeTab === 'notices') {
        const payload: any = {
          title: formData.title,
          description: formData.description,
          target_audience: formData.audience || 'All',
          publish_date: formData.publish_date || new Date().toISOString().substring(0, 10),
          is_active: true
        };

        if (editingItem) {
          const { error } = await supabase.from('notices').update(payload).eq('id', editingItem.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('notices').insert([payload]);
          if (error) throw error;
        }
      } else if (activeTab === 'sms') {
        const payload: any = {
          message_text: formData.message,
          // recipient_phone is NOT NULL; a campaign fans out to a group rather
          // than one number, so record the group label it was sent to.
          recipient_phone: formData.target_group || 'Broadcast',
          type: formData.category || 'Academic',
          status: 'Delivered',
          recipient_count: Number(formData.recipient_count || 50)
        };

        if (editingItem) {
          const { error } = await supabase.from('sms_logs').update(payload).eq('id', editingItem.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('sms_logs').insert([payload]);
          if (error) throw error;
        }
      } else if (activeTab === 'email') {
        const payload: any = {
          subject: formData.subject,
          recipient_email: formData.target_group,
          status: 'Sent'
        };

        if (editingItem) {
          const { error } = await supabase.from('email_logs').update(payload).eq('id', editingItem.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('email_logs').insert([payload]);
          if (error) throw error;
        }
      }

      toast.success(editingItem ? 'Notice updated successfully!' : 'Broadcast successfully dispatched!');
      setShowAddModal(false);
      setEditingItem(null);
      setFormData({});
      await loadData();
    } catch (err: any) {
      toast.error('Sync failure: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      const table = activeTab === 'notices' ? 'notices' : activeTab === 'sms' ? 'sms_logs' : 'email_logs';
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;

      toast.success('Record successfully removed.');
      setSelectedItems(prev => prev.filter(item => item !== id));
      await loadData();
    } catch (err: any) {
      toast.error('Removal failed: ' + err.message);
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData(item);
    setShowAddModal(true);
  };

  const handleBulkExportCSV = () => {
    if (selectedItems.length === 0) {
      toast.error('Please select records to export first.');
      return;
    }
    let csvContent = "data:text/csv;charset=utf-8,";
    if (activeTab === 'notices') {
      csvContent += "ID,Notice Title,Author,Publish Date,Target Audience,Content Description\n";
      const records = notices.filter(n => selectedItems.includes(n.id));
      records.forEach(r => {
        csvContent += `"${r.id}","${r.title}","${r.author}","${r.publish_date}","${r.audience}","${r.description}"\n`;
      });
    } else if (activeTab === 'sms') {
      csvContent += "ID,Campaign Category,SMS Message,Count,Dispatched,Status\n";
      const records = smsLogs.filter(s => selectedItems.includes(s.id));
      records.forEach(r => {
        csvContent += `"${r.id}","${r.category}","${r.message}",${r.recipient_count},"${r.dispatch_time}","${r.status}"\n`;
      });
    } else if (activeTab === 'email') {
      csvContent += "ID,Subject Circular,Target Group,Sender Email,Status,Sent Date\n";
      const records = emails.filter(em => selectedItems.includes(em.id));
      records.forEach(r => {
        csvContent += `"${r.id}","${r.subject}","${r.target_group}","${r.sender}","${r.status}","${r.sent_date}"\n`;
      });
    } else if (activeTab === 'push') {
      csvContent += "ID,Alert Title,Notification Message,Clicks Count,Date Dispatched\n";
      const records = pushAlerts.filter(p => selectedItems.includes(p.id));
      records.forEach(r => {
        csvContent += `"${r.id}","${r.title}","${r.message}",${r.clicks},"${r.sent_date}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ST_JOSEPHS_COMMUNICATION_${activeTab.toUpperCase()}_EXPORT.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${selectedItems.length} broadcasts to Excel CSV!`);
  };

  const handlePrint = () => {
    window.print();
  };

  // Filters
  const filteredNotices = useMemo(() => {
    return notices.filter(n => {
      const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            n.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            n.author.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAudience = audienceFilter === 'all' || n.audience === audienceFilter;
      return matchesSearch && matchesAudience;
    });
  }, [notices, searchQuery, audienceFilter]);

  const filteredSms = useMemo(() => {
    return smsLogs.filter(s => {
      const matchesSearch = s.message.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            s.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = audienceFilter === 'all' || s.status === audienceFilter;
      return matchesSearch && matchesCategory;
    });
  }, [smsLogs, searchQuery, audienceFilter]);

  const filteredEmails = useMemo(() => {
    return emails.filter(em => {
      const matchesSearch = em.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            em.target_group.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            em.sender.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = audienceFilter === 'all' || em.status === audienceFilter;
      return matchesSearch && matchesCategory;
    });
  }, [emails, searchQuery, audienceFilter]);

  const filteredPush = useMemo(() => {
    return pushAlerts.filter(p => {
      const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.message.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [pushAlerts, searchQuery]);

  const toggleSelectAll = () => {
    let currentIds: string[] = [];
    if (activeTab === 'notices') currentIds = filteredNotices.map(n => n.id);
    else if (activeTab === 'sms') currentIds = filteredSms.map(s => s.id);
    else if (activeTab === 'email') currentIds = filteredEmails.map(em => em.id);
    else if (activeTab === 'push') currentIds = filteredPush.map(p => p.id);

    if (selectedItems.length === currentIds.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(currentIds);
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const generateSQL = () => {
    return `-- ==========================================================
-- ST. JOSEPH'S SCHOOL, BARHALGANJ - COMMUNICATION SCHEMAS
-- ADDITIVE PRODUCTION MIGRATIONS
-- ==========================================================

CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  publish_date DATE DEFAULT CURRENT_DATE,
  audience TEXT CHECK (audience IN ('All', 'Students', 'Staff', 'Parents')),
  description TEXT NOT NULL,
  attachments TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sms_logs (
  id TEXT PRIMARY KEY,
  category TEXT CHECK (category IN ('Security', 'Academic', 'Fee Reminder', 'Attendance')),
  message TEXT NOT NULL,
  recipient_count INTEGER NOT NULL,
  dispatch_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status TEXT CHECK (status IN ('Sent', 'Failed', 'Delivered')) DEFAULT 'Sent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_broadcasts (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  target_group TEXT NOT NULL,
  sender TEXT NOT NULL,
  status TEXT CHECK (status IN ('Sent', 'Draft', 'Failed')) DEFAULT 'Sent',
  sent_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS push_alerts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_date DATE DEFAULT CURRENT_DATE,
  clicks INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`;
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16 text-slate-700 font-sans antialiased">
{/* 1. Header Toolbar */}
      <AdminHeader
        title="Noticeboard & Broadcast Campaigns"
        subtitle="Broadcast school notices, urgent bulletins, security alerts, fee deadlines, attendance push logs, and email newsletters to guardians."
        badge={{
          icon: MessageSquare,
          text: 'Communication Broadcast Desk',
          variant: 'primary'
        }}
        sessionBadge="Session: 2026-27"
        actions={
          <>
            <button 
              onClick={() => setShowMigrationSql(true)}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Database className="w-3.5 h-3.5 text-slate-500" /> Verify SQL Schema
            </button>
            <button 
              onClick={() => { setEditingItem(null); setFormData({}); setShowAddModal(true); }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <Plus className="w-4 h-4" /> Compose Broadcast
            </button>
          </>
        }
      />

      {/* 2. Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AdminStatCard
          label="Total Notices Published"
          value={notices.length}
          subtext="Active Board"
          icon={FileText}
          variant="emerald"
        />
        <AdminStatCard
          label="SMS Outbox Sent"
          value={smsLogs.reduce((sum, s) => sum + s.recipient_count, 0)}
          subtext="Dispatched SMS"
          icon={MessageSquare}
          variant="primary"
        />
        <AdminStatCard
          label="Email Newsletters"
          value={emails.filter(e => e.status === 'Sent').length}
          subtext="Delivered Inboxes"
          icon={Mail}
          variant="violet"
        />
        <AdminStatCard
          label="Push App Clicks"
          value={pushAlerts.reduce((sum, p) => sum + p.clicks, 0)}
          subtext="Total Conversions"
          icon={Bell}
          variant="amber"
        />
      </div>

      {/* 3. Segmented Navigation Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 shadow-2xs overflow-x-auto">
        <nav className="flex items-center gap-1 min-w-max" aria-label="Communication Navigation Sections">
          {[
            { id: 'notices', label: 'Official Notices', icon: FileText },
            { id: 'sms', label: 'SMS Campaigns', icon: MessageSquare },
            { id: 'email', label: 'Email Broadcasts', icon: Mail },
            { id: 'push', label: 'App Push Alerts', icon: Bell }
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as TabType); setSelectedItems([]); }}
                className={cn(
                  "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                  active 
                    ? "bg-slate-900 text-white shadow-xs" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <tab.icon className={cn("w-4 h-4 shrink-0", active ? "text-blue-400" : "text-slate-400")} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* FILTER CONTROL DECK */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-3xs grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search titles, authors, keywords..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold outline-none focus:border-slate-800"
          />
        </div>

        <div>
          {activeTab === 'notices' && (
            <select 
              value={audienceFilter} 
              onChange={e => setAudienceFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="all">All Notice Audiences</option>
              <option value="All">Everyone (Public)</option>
              <option value="Students">Students Only</option>
              <option value="Staff">Faculty / Staff</option>
              <option value="Parents">Parents / Guardians</option>
            </select>
          )}

          {activeTab === 'sms' && (
            <select 
              value={audienceFilter} 
              onChange={e => setAudienceFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="all">All SMS Statuses</option>
              <option value="Delivered">Delivered</option>
              <option value="Failed">Failed Outbox</option>
            </select>
          )}

          {activeTab === 'email' && (
            <select 
              value={audienceFilter} 
              onChange={e => setAudienceFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="all">All Email Statuses</option>
              <option value="Sent">Sent Circulars</option>
              <option value="Draft">Draft Newsletters</option>
            </select>
          )}
        </div>

        <div className="flex justify-end gap-2 shrink-0">
          <button 
            onClick={handlePrint}
            className="px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Print Logs
          </button>
          <button 
            onClick={handleBulkExportCSV}
            className="px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-500" /> Export CSV
          </button>
        </div>
      </div>

      {/* BULK ACTIONS BANNER */}
      {selectedItems.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">
            Selected <span className="font-black text-sm text-slate-900">{selectedItems.length}</span> records for batch export.
          </span>
          <button 
            onClick={handleBulkExportCSV}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            Export Selection
          </button>
        </div>
      )}

      {/* DYNAMIC DATA REGISTRY TABLE */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-3xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-semibold font-sans">
            <thead>
              <tr className="bg-slate-900 text-white uppercase text-[9px] tracking-wider border-b border-slate-800">
                <th className="py-3.5 px-4 text-center w-12">
                  <input 
                    type="checkbox" 
                    onChange={toggleSelectAll}
                    checked={
                      activeTab === 'notices' ? (selectedItems.length === filteredNotices.length && filteredNotices.length > 0) :
                      activeTab === 'sms' ? (selectedItems.length === filteredSms.length && filteredSms.length > 0) :
                      activeTab === 'email' ? (selectedItems.length === filteredEmails.length && filteredEmails.length > 0) :
                      (selectedItems.length === filteredPush.length && filteredPush.length > 0)
                    }
                    className="cursor-pointer"
                  />
                </th>
                {activeTab === 'notices' && (
                  <>
                    <th className="py-3.5 px-4">Notice Title & Details</th>
                    <th className="py-3.5 px-4">Author</th>
                    <th className="py-3.5 px-4">Publish Date</th>
                    <th className="py-3.5 px-4">Target Audience</th>
                    <th className="py-3.5 px-4">Notice Preview</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </>
                )}
                {activeTab === 'sms' && (
                  <>
                    <th className="py-3.5 px-4">Campaign Category</th>
                    <th className="py-3.5 px-4">Message Body</th>
                    <th className="py-3.5 px-4">Recipients</th>
                    <th className="py-3.5 px-4">Dispatch Date</th>
                    <th className="py-3.5 px-4">Gateway Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </>
                )}
                {activeTab === 'email' && (
                  <>
                    <th className="py-3.5 px-4">Subject Circular</th>
                    <th className="py-3.5 px-4">Target Audience Group</th>
                    <th className="py-3.5 px-4">Sender ID</th>
                    <th className="py-3.5 px-4">Date Dispatched</th>
                    <th className="py-3.5 px-4">Delivery Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </>
                )}
                {activeTab === 'push' && (
                  <>
                    <th className="py-3.5 px-4">Alert Title</th>
                    <th className="py-3.5 px-4">Alert Message Body</th>
                    <th className="py-3.5 px-4">Date Dispatched</th>
                    <th className="py-3.5 px-4">Conversions (Clicks)</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {/* 1. NOTICES TAB */}
              {activeTab === 'notices' && (
                filteredNotices.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400 text-xs">No notices matching criteria.</td></tr>
                ) : (
                  filteredNotices.map(n => (
                    <tr key={n.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 text-center">
                        <input type="checkbox" checked={selectedItems.includes(n.id)} onChange={() => toggleSelectItem(n.id)} className="cursor-pointer" />
                      </td>
                      <td className="py-4 px-4 font-black text-slate-950 uppercase">{n.title}</td>
                      <td className="py-4 px-4 font-bold text-slate-600">{n.author}</td>
                      <td className="py-4 px-4 font-bold text-slate-500">{n.publish_date}</td>
                      <td className="py-4 px-4">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border",
                          n.audience === 'All' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                          n.audience === 'Students' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                          n.audience === 'Staff' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                        )}>{n.audience}</span>
                      </td>
                      <td className="py-4 px-4 max-w-xs truncate text-slate-400 font-medium">{n.description}</td>
                      <td className="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button onClick={() => handleEdit(n)} className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(n.id)} className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))
                )
              )}

              {/* 2. SMS TAB */}
              {activeTab === 'sms' && (
                filteredSms.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400 text-xs">No SMS logs available.</td></tr>
                ) : (
                  filteredSms.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 text-center">
                        <input type="checkbox" checked={selectedItems.includes(s.id)} onChange={() => toggleSelectItem(s.id)} className="cursor-pointer" />
                      </td>
                      <td className="py-4 px-4 font-black text-slate-900">{s.category}</td>
                      <td className="py-4 px-4 max-w-sm truncate text-slate-600 font-medium">{s.message}</td>
                      <td className="py-4 px-4 font-bold text-indigo-600">{s.recipient_count} Parents</td>
                      <td className="py-4 px-4 text-slate-500 font-bold">{s.dispatch_time}</td>
                      <td className="py-4 px-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                          s.status === 'Delivered' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600'
                        )}>{s.status}</span>
                      </td>
                      <td className="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button onClick={() => handleEdit(s)} className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(s.id)} className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))
                )
              )}

              {/* 3. EMAIL TAB */}
              {activeTab === 'email' && (
                filteredEmails.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400 text-xs">No email circulars registered.</td></tr>
                ) : (
                  filteredEmails.map(em => (
                    <tr key={em.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 text-center">
                        <input type="checkbox" checked={selectedItems.includes(em.id)} onChange={() => toggleSelectItem(em.id)} className="cursor-pointer" />
                      </td>
                      <td className="py-4 px-4 font-black text-slate-900 uppercase">{em.subject}</td>
                      <td className="py-4 px-4 font-bold text-slate-600">{em.target_group}</td>
                      <td className="py-4 px-4 font-mono text-slate-400">{em.sender}</td>
                      <td className="py-4 px-4 font-medium text-slate-500">{em.sent_date}</td>
                      <td className="py-4 px-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                          em.status === 'Sent' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                        )}>{em.status}</span>
                      </td>
                      <td className="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button onClick={() => handleEdit(em)} className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(em.id)} className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))
                )
              )}

              {/* 4. PUSH ALERTS TAB */}
              {activeTab === 'push' && (
                filteredPush.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-400 text-xs">No push notifications sent.</td></tr>
                ) : (
                  filteredPush.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 text-center">
                        <input type="checkbox" checked={selectedItems.includes(p.id)} onChange={() => toggleSelectItem(p.id)} className="cursor-pointer" />
                      </td>
                      <td className="py-4 px-4 font-black text-slate-900 uppercase">{p.title}</td>
                      <td className="py-4 px-4 text-slate-600 font-medium">{p.message}</td>
                      <td className="py-4 px-4 font-medium text-slate-500">{p.sent_date}</td>
                      <td className="py-4 px-4 font-mono font-black text-indigo-600">{p.clicks} clicks</td>
                      <td className="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button onClick={() => handleEdit(p)} className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(p.id)} className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SQL SCHEMA CODE PANEL MODAL */}
      <AnimatePresence>
        {showMigrationSql && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-5 border-b border-slate-800 flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-display font-black uppercase text-sm">PostgreSQL Communication Migration Schema</h3>
                </div>
                <button onClick={() => setShowMigrationSql(false)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Apply this additive database schema structure into your Supabase SQL editor to enable native persistence across all lodging modules:
                </p>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-y-auto max-h-72 font-mono text-[10px] text-emerald-300 whitespace-pre">
                  {generateSQL()}
                </div>
                <div className="flex justify-end gap-2">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(generateSQL());
                      toast.success('Migration SQL copied to clipboard!');
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black cursor-pointer uppercase select-none shadow-md shadow-emerald-600/10"
                  >
                    Copy SQL Migration
                  </button>
                  <button onClick={() => setShowMigrationSql(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold cursor-pointer">Close</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD/EDIT MODAL DRAWER */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100"
            >
              <div className="p-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white">
                <h3 className="font-display font-black uppercase text-xs">
                  {editingItem ? 'Edit Circular Notice' : `Dispatch New ${activeTab.toUpperCase()}`}
                </h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
              
              <form onSubmit={handleSave} className="p-5 space-y-4">
                {/* 1. NOTICES FORM */}
                {activeTab === 'notices' && (
                  <div className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Notice Heading Title</label>
                      <input required type="text" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Science Exhibition Registrations" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-800" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Target Audience</label>
                        <select required value={formData.audience || 'All'} onChange={e => setFormData({...formData, audience: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none">
                          <option value="All">Everyone (Public Notice)</option>
                          <option value="Students">Students Only</option>
                          <option value="Staff">Faculty & Instructors</option>
                          <option value="Parents">Parents / Guardians</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Notice Date</label>
                        <input required type="date" value={formData.publish_date || ''} onChange={e => setFormData({...formData, publish_date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Author Desk</label>
                      <input required type="text" value={formData.author || 'Principal Office'} onChange={e => setFormData({...formData, author: e.target.value})} placeholder="e.g. Principal Office" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Notice Body Content</label>
                      <textarea required value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Write fully detailed official circular..." rows={4} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none" />
                    </div>
                  </div>
                )}

                {/* 2. SMS FORM */}
                {activeTab === 'sms' && (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">SMS Category</label>
                        <select required value={formData.category || 'Security'} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-700">
                          <option value="Security">Security Broadcast</option>
                          <option value="Academic">Academic Notice</option>
                          <option value="Fee Reminder">Fee Reminder Log</option>
                          <option value="Attendance">Attendance Notification</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Gateway Recipients</label>
                        <input required type="number" value={formData.recipient_count || ''} onChange={e => setFormData({...formData, recipient_count: Number(e.target.value)})} placeholder="e.g. 540" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">SMS Campaign Message (Max 160 Characters)</label>
                      <textarea required maxLength={160} value={formData.message || ''} onChange={e => setFormData({...formData, message: e.target.value})} placeholder="Dear Parent, school roll call is modified starting tomorrow..." rows={3} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Dispatch Date/Time</label>
                        <input required type="text" value={formData.dispatch_time || '2026-07-06 10:15'} onChange={e => setFormData({...formData, dispatch_time: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-850" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Gateway Status</label>
                        <select required value={formData.status || 'Delivered'} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-700">
                          <option value="Delivered">Delivered</option>
                          <option value="Sent">Sent (Processing)</option>
                          <option value="Failed">Failed (No balance)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. EMAIL FORM */}
                {activeTab === 'email' && (
                  <div className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Email Circular Subject Line</label>
                      <input required type="text" value={formData.subject || ''} onChange={e => setFormData({...formData, subject: e.target.value})} placeholder="e.g. Dispatch of High-Res Digital Report Cards" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Sender Address</label>
                        <input required type="email" value={formData.sender || 'principal@rajsdps.com'} onChange={e => setFormData({...formData, sender: e.target.value})} placeholder="principal@rajsdps.com" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Target Segment Group</label>
                        <input required type="text" value={formData.target_group || ''} onChange={e => setFormData({...formData, target_group: e.target.value})} placeholder="e.g. Grade 12 Parents" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Date Sent</label>
                        <input required type="date" value={formData.sent_date || ''} onChange={e => setFormData({...formData, sent_date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Status</label>
                        <select required value={formData.status || 'Sent'} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-700">
                          <option value="Sent">Sent circular</option>
                          <option value="Draft">Save as draft</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. PUSH ALERTS FORM */}
                {activeTab === 'push' && (
                  <div className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Push Alert Header Title</label>
                      <input required type="text" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Term 2 Admit Cards Live" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Push Notification Message Body</label>
                      <textarea required value={formData.message || ''} onChange={e => setFormData({...formData, message: e.target.value})} placeholder="Download your hall ticket directly..." rows={3} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Date Sent</label>
                        <input required type="date" value={formData.sent_date || ''} onChange={e => setFormData({...formData, sent_date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Clicks Logged</label>
                        <input type="number" value={formData.clicks || 0} onChange={e => setFormData({...formData, clicks: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                  <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-black uppercase select-none cursor-pointer">
                    {isSubmitting ? 'Synchronizing...' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-150 text-slate-600 rounded-xl text-xs font-bold cursor-pointer">Cancel</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
