import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, Plus, Search, Filter, Download, Printer, Edit2, Trash2, 
  RefreshCw, Check, X, Shield, Users, Bed, HelpCircle, FileText,
  Save, SlidersHorizontal, ArrowLeft, Calendar, Database, UserCheck, Key
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast, Toaster } from 'sonner';
import { AdminHeader } from '@/components/common/AdminHeader';
import { AdminStatCard } from '@/components/common/AdminStatCard';

interface Hostel {
  id: string;
  name: string;
  type: 'Boys' | 'Girls' | 'Staff' | 'Mixed';
  capacity: number;
  warden_name: string;
  warden_phone: string;
  address: string;
}

interface HostelRoom {
  id: string;
  hostel_id: string;
  room_no: string;
  type: 'Single' | 'Double' | 'Triple' | 'Dormitory';
  capacity: number;
  occupied: number;
  rent_monthly: number;
  facilities: string[];
}

interface StudentAllocation {
  id: string;
  student_name: string;
  student_roll: string;
  hostel_id: string;
  room_id: string;
  allocated_date: string;
  food_preference: 'Veg' | 'Non-Veg' | 'Jain';
  status: 'Active' | 'Vacated';
}

interface HostelVisitor {
  id: string;
  visitor_name: string;
  relation: string;
  student_name: string;
  phone: string;
  purpose: string;
  entry_time: string;
  exit_time?: string;
}

type TabType = 'hostels' | 'rooms' | 'allocations' | 'visitors';

export default function HostelManagement() {
  const [activeTab, setActiveTab] = useState<TabType>('hostels');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  // States
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [allocations, setAllocations] = useState<StudentAllocation[]>([]);
  const [visitors, setVisitors] = useState<HostelVisitor[]>([]);

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
      const [hostelsRes, roomsRes] = await Promise.all([
        supabase.from('hostels').select('*').order('name'),
        supabase.from('rooms').select('*').order('room_number')
      ]);

      if (hostelsRes.data) {
        setHostels(hostelsRes.data.map((h: any) => ({
          id: h.id,
          name: h.name || 'Hostel Block',
          type: h.type || 'Boys',
          capacity: Number(h.capacity || 100),
          warden_name: h.warden_name || 'Hostel Warden',
          warden_phone: h.warden_phone || 'N/A',
          address: h.address || 'Campus Complex'
        })));
      }

      if (roomsRes.data) {
        setRooms(roomsRes.data.map((r: any) => ({
          id: r.id,
          hostel_id: r.hostel_id || '',
          room_no: r.room_number || '101',
          type: (r.room_type as any) || 'Double',
          capacity: Number(r.capacity || 2),
          occupied: Number(r.current_occupancy || 0),
          rent_monthly: Number(r.rent_amount || 3000),
          facilities: ['Wi-Fi', 'Wardrobe', 'Study Table']
        })));
      }

    } catch (error: any) {
      console.error('Error fetching hostel data:', error);
      setErrorState(error.message || 'Failed to load hostel records');
      toast.error('Unable to load hostel data from database.');
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
      if (activeTab === 'hostels') {
        const payload: any = {
          name: formData.name,
          type: formData.type || 'Boys',
          capacity: Number(formData.capacity || 100),
          warden_name: formData.warden_name,
          warden_phone: formData.warden_phone,
          address: formData.address || 'Campus Complex'
        };

        if (editingItem) {
          const { error } = await supabase.from('hostels').update(payload).eq('id', editingItem.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('hostels').insert([payload]);
          if (error) throw error;
        }
      } else if (activeTab === 'rooms') {
        const payload: any = {
          hostel_id: formData.hostel_id,
          room_number: formData.room_no,
          room_type: formData.type || 'Double',
          capacity: Number(formData.capacity || 2),
          rent_amount: Number(formData.rent_monthly || 3000),
          status: 'Available'
        };

        if (editingItem) {
          const { error } = await supabase.from('rooms').update(payload).eq('id', editingItem.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('rooms').insert([payload]);
          if (error) throw error;
        }
      }

      toast.success(editingItem ? 'Record updated successfully!' : 'Record added successfully!');
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
      const table = activeTab === 'hostels' ? 'hostels' : 'rooms';
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
    if (activeTab === 'hostels') {
      csvContent += "ID,Name,Type,Capacity,Warden Name,Warden Phone,Address\n";
      const records = hostels.filter(h => selectedItems.includes(h.id));
      records.forEach(r => {
        csvContent += `"${r.id}","${r.name}","${r.type}",${r.capacity},"${r.warden_name}","${r.warden_phone}","${r.address}"\n`;
      });
    } else if (activeTab === 'rooms') {
      csvContent += "ID,Hostel,Room No,Room Type,Capacity,Occupied,Monthly Rent,Facilities\n";
      const records = rooms.filter(r => selectedItems.includes(r.id));
      records.forEach(r => {
        const hName = hostels.find(h => h.id === r.hostel_id)?.name || r.hostel_id;
        csvContent += `"${r.id}","${hName}","${r.room_no}","${r.type}",${r.capacity},${r.occupied},${r.rent_monthly},"${r.facilities.join(', ')}"\n`;
      });
    } else if (activeTab === 'allocations') {
      csvContent += "ID,Student Name,Roll,Hostel,Room,Allocated Date,Food Preference,Status\n";
      const records = allocations.filter(a => selectedItems.includes(a.id));
      records.forEach(r => {
        const hName = hostels.find(h => h.id === r.hostel_id)?.name || r.hostel_id;
        const rNo = rooms.find(rm => rm.id === r.room_id)?.room_no || r.room_id;
        csvContent += `"${r.id}","${r.student_name}","${r.student_roll}","${hName}","${rNo}","${r.allocated_date}","${r.food_preference}","${r.status}"\n`;
      });
    } else if (activeTab === 'visitors') {
      csvContent += "ID,Visitor Name,Relation,Student Name,Phone,Purpose,Entry Time,Exit Time\n";
      const records = visitors.filter(v => selectedItems.includes(v.id));
      records.forEach(r => {
        csvContent += `"${r.id}","${r.visitor_name}","${r.relation}","${r.student_name}","${r.phone}","${r.purpose}","${r.entry_time}","${r.exit_time || ''}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ST_JOSEPHS_HOSTEL_${activeTab.toUpperCase()}_EXPORT.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${selectedItems.length} records to Excel CSV!`);
  };

  const handlePrint = () => {
    window.print();
  };

  // Filters
  const filteredHostels = useMemo(() => {
    return hostels.filter(h => {
      const q = (searchQuery || '').toLowerCase();
      const matchesSearch = (h.name || '').toLowerCase().includes(q) || 
                            (h.warden_name || '').toLowerCase().includes(q) ||
                            (h.address || '').toLowerCase().includes(q);
      const matchesType = typeFilter === 'all' || h.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [hostels, searchQuery, typeFilter]);

  const filteredRooms = useMemo(() => {
    return rooms.filter(r => {
      const q = (searchQuery || '').toLowerCase();
      const hName = hostels.find(h => h.id === r.hostel_id)?.name || '';
      const matchesSearch = (r.room_no || '').includes(searchQuery) || 
                            (r.type || '').toLowerCase().includes(q) ||
                            hName.toLowerCase().includes(q);
      const matchesType = typeFilter === 'all' || r.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [rooms, hostels, searchQuery, typeFilter]);

  const filteredAllocations = useMemo(() => {
    return allocations.filter(a => {
      const q = (searchQuery || '').toLowerCase();
      const hName = hostels.find(h => h.id === a.hostel_id)?.name || '';
      const matchesSearch = (a.student_name || '').toLowerCase().includes(q) || 
                            (a.student_roll || '').includes(searchQuery) ||
                            hName.toLowerCase().includes(q);
      const matchesType = typeFilter === 'all' || a.status === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [allocations, hostels, searchQuery, typeFilter]);

  const filteredVisitors = useMemo(() => {
    return visitors.filter(v => {
      const q = (searchQuery || '').toLowerCase();
      const matchesSearch = (v.visitor_name || '').toLowerCase().includes(q) || 
                            (v.student_name || '').toLowerCase().includes(q) ||
                            (v.purpose || '').toLowerCase().includes(q);
      return matchesSearch;
    });
  }, [visitors, searchQuery]);

  const toggleSelectAll = () => {
    let currentIds: string[] = [];
    if (activeTab === 'hostels') currentIds = filteredHostels.map(h => h.id);
    else if (activeTab === 'rooms') currentIds = filteredRooms.map(r => r.id);
    else if (activeTab === 'allocations') currentIds = filteredAllocations.map(a => a.id);
    else if (activeTab === 'visitors') currentIds = filteredVisitors.map(v => v.id);

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
-- ST. JOSEPH'S SCHOOL, BARHALGANJ - HOSTEL SCHEMAS
-- ADDITIVE PRODUCTION MIGRATIONS
-- ==========================================================

CREATE TABLE IF NOT EXISTS hostels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('Boys', 'Girls', 'Staff', 'Mixed')),
  capacity INTEGER NOT NULL DEFAULT 100,
  warden_name TEXT,
  warden_phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hostel_rooms (
  id TEXT PRIMARY KEY,
  hostel_id TEXT REFERENCES hostels(id) ON DELETE CASCADE,
  room_no TEXT NOT NULL,
  type TEXT CHECK (type IN ('Single', 'Double', 'Triple', 'Dormitory')),
  capacity INTEGER DEFAULT 2,
  occupied INTEGER DEFAULT 0,
  rent_monthly NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  facilities TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hostel_allocations (
  id TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  student_roll TEXT NOT NULL,
  hostel_id TEXT REFERENCES hostels(id) ON DELETE CASCADE,
  room_id TEXT REFERENCES hostel_rooms(id) ON DELETE CASCADE,
  allocated_date DATE DEFAULT CURRENT_DATE,
  food_preference TEXT CHECK (food_preference IN ('Veg', 'Non-Veg', 'Jain')),
  status TEXT CHECK (status IN ('Active', 'Vacated')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hostel_visitors (
  id TEXT PRIMARY KEY,
  visitor_name TEXT NOT NULL,
  relation TEXT NOT NULL,
  student_name TEXT NOT NULL,
  phone TEXT,
  purpose TEXT,
  entry_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  exit_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`;
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16 text-slate-700 font-sans antialiased">
      <Toaster position="top-right" richColors />

      {/* 1. Header Toolbar */}
      <AdminHeader
        title="Hostel & Residential Accommodation"
        subtitle="Track building registrations, room quotas, pupil room allocations, wardens, food services, and logs for visitors and guardians."
        badge={{
          icon: Home,
          text: 'Hostel Residency Hub',
          variant: 'violet'
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
              <Plus className="w-4 h-4" /> Add Record
            </button>
          </>
        }
      />

      {/* 2. Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AdminStatCard
          label="Total Residents"
          value={allocations.filter(a => a.status === 'Active').length}
          subtext="Active Occupants"
          icon={Users}
          variant="emerald"
        />
        <AdminStatCard
          label="Total Hostels"
          value={hostels.length}
          subtext="Buildings Registered"
          icon={Home}
          variant="primary"
        />
        <AdminStatCard
          label="Rooms Vacant"
          value={rooms.filter(r => r.occupied < r.capacity).length}
          subtext="Available Rooms"
          icon={Bed}
          variant="violet"
        />
        <AdminStatCard
          label="Active Visitors"
          value={visitors.filter(v => !v.exit_time).length}
          subtext="Pending checkout"
          icon={UserCheck}
          variant="amber"
        />
      </div>

      {/* 3. Segmented Navigation Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 shadow-2xs overflow-x-auto">
        <nav className="flex items-center gap-1 min-w-max" aria-label="Hostel Navigation Sections">
          {[
            { id: 'hostels', label: 'Hostel Buildings', icon: Home },
            { id: 'rooms', label: 'Room Registers', icon: Bed },
            { id: 'allocations', label: 'Pupil Occupancy', icon: Users },
            { id: 'visitors', label: 'Visitors Log', icon: UserCheck }
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
                <tab.icon className={cn("w-4 h-4 shrink-0", active ? "text-violet-400" : "text-slate-400")} />
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
            placeholder="Search details, names, codes..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold outline-none focus:border-slate-800"
          />
        </div>

        <div>
          {activeTab === 'hostels' && (
            <select 
              value={typeFilter} 
              onChange={e => setTypeFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="all">All Hostel Types</option>
              <option value="Boys">Boys Hostel</option>
              <option value="Girls">Girls Hostel</option>
              <option value="Staff">Staff Quarters</option>
              <option value="Mixed">Mixed block</option>
            </select>
          )}

          {activeTab === 'rooms' && (
            <select 
              value={typeFilter} 
              onChange={e => setTypeFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="all">All Room Types</option>
              <option value="Single">Single Bedroom</option>
              <option value="Double">Double Share</option>
              <option value="Triple">Triple Share</option>
              <option value="Dormitory">Dormitory</option>
            </select>
          )}

          {activeTab === 'allocations' && (
            <select 
              value={typeFilter} 
              onChange={e => setTypeFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="all">All Allotments</option>
              <option value="Active">Active Occupants</option>
              <option value="Vacated">Vacated History</option>
            </select>
          )}
        </div>

        <div className="flex justify-end gap-2 shrink-0">
          <button 
            onClick={handlePrint}
            className="px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Print Registry
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
          <table className="w-full text-left text-xs font-semibold">
            <thead>
              <tr className="bg-slate-900 text-white uppercase text-[9px] tracking-wider border-b border-slate-800">
                <th className="py-3.5 px-4 text-center w-12">
                  <input 
                    type="checkbox" 
                    onChange={toggleSelectAll}
                    checked={
                      activeTab === 'hostels' ? (selectedItems.length === filteredHostels.length && filteredHostels.length > 0) :
                      activeTab === 'rooms' ? (selectedItems.length === filteredRooms.length && filteredRooms.length > 0) :
                      activeTab === 'allocations' ? (selectedItems.length === filteredAllocations.length && filteredAllocations.length > 0) :
                      (selectedItems.length === filteredVisitors.length && filteredVisitors.length > 0)
                    }
                    className="cursor-pointer"
                  />
                </th>
                {activeTab === 'hostels' && (
                  <>
                    <th className="py-3.5 px-4">Hostel Building</th>
                    <th className="py-3.5 px-4">Target Type</th>
                    <th className="py-3.5 px-4">Capacity</th>
                    <th className="py-3.5 px-4">Warden Details</th>
                    <th className="py-3.5 px-4">Address</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </>
                )}
                {activeTab === 'rooms' && (
                  <>
                    <th className="py-3.5 px-4">Room Standard</th>
                    <th className="py-3.5 px-4">Hostel Wing</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4">Quota Ratio</th>
                    <th className="py-3.5 px-4">Rent (Monthly)</th>
                    <th className="py-3.5 px-4">Facilities</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </>
                )}
                {activeTab === 'allocations' && (
                  <>
                    <th className="py-3.5 px-4">Student Occupant</th>
                    <th className="py-3.5 px-4">Hostel Assigned</th>
                    <th className="py-3.5 px-4">Room No</th>
                    <th className="py-3.5 px-4">Allotment Date</th>
                    <th className="py-3.5 px-4">Mess Preference</th>
                    <th className="py-3.5 px-4">Current Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </>
                )}
                {activeTab === 'visitors' && (
                  <>
                    <th className="py-3.5 px-4">Visitor Log</th>
                    <th className="py-3.5 px-4">Relation</th>
                    <th className="py-3.5 px-4">Student Visted</th>
                    <th className="py-3.5 px-4">Contact Phone</th>
                    <th className="py-3.5 px-4">Purpose</th>
                    <th className="py-3.5 px-4">In / Out Time</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {/* 1. HOSTELS TAB */}
              {activeTab === 'hostels' && (
                filteredHostels.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400 text-xs">No hostels matching criteria.</td></tr>
                ) : (
                  filteredHostels.map(h => (
                    <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 text-center">
                        <input type="checkbox" checked={selectedItems.includes(h.id)} onChange={() => toggleSelectItem(h.id)} className="cursor-pointer" />
                      </td>
                      <td className="py-4 px-4 font-black text-slate-900 uppercase">{h.name}</td>
                      <td className="py-4 px-4">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase",
                          h.type === 'Boys' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                          h.type === 'Girls' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-50 text-slate-600'
                        )}>{h.type}</span>
                      </td>
                      <td className="py-4 px-4 font-bold">{h.capacity} Pupils</td>
                      <td className="py-4 px-4">
                        <p className="font-bold text-slate-800">{h.warden_name}</p>
                        <p className="text-[10px] font-mono text-slate-400">{h.warden_phone}</p>
                      </td>
                      <td className="py-4 px-4 text-slate-500 font-medium">{h.address}</td>
                      <td className="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button onClick={() => handleEdit(h)} className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(h.id)} className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))
                )
              )}

              {/* 2. ROOMS TAB */}
              {activeTab === 'rooms' && (
                filteredRooms.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-slate-400 text-xs">No rooms matching criteria.</td></tr>
                ) : (
                  filteredRooms.map(r => {
                    const hName = hostels.find(h => h.id === r.hostel_id)?.name || 'Unknown Building';
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-4 text-center">
                          <input type="checkbox" checked={selectedItems.includes(r.id)} onChange={() => toggleSelectItem(r.id)} className="cursor-pointer" />
                        </td>
                        <td className="py-4 px-4 font-black text-slate-900">Room #{r.room_no}</td>
                        <td className="py-4 px-4 font-bold text-slate-600 uppercase">{hName}</td>
                        <td className="py-4 px-4 font-bold">{r.type}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-slate-800">{r.occupied}/{r.capacity}</span>
                            <span className="text-[10px] text-slate-400">Filled</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 font-mono font-bold text-slate-900">₹{r.rent_monthly} / mo</td>
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-1">
                            {r.facilities.map(f => (
                              <span key={f} className="px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded text-[9px] font-black border border-slate-150">{f}</span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button onClick={() => handleEdit(r)} className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(r.id)} className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    );
                  })
                )
              )}

              {/* 3. ALLOCATIONS TAB */}
              {activeTab === 'allocations' && (
                filteredAllocations.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-slate-400 text-xs">No active residence allot records found.</td></tr>
                ) : (
                  filteredAllocations.map(a => {
                    const hName = hostels.find(h => h.id === a.hostel_id)?.name || 'Unknown Building';
                    const rNo = rooms.find(rm => rm.id === a.room_id)?.room_no || 'N/A';
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-4 text-center">
                          <input type="checkbox" checked={selectedItems.includes(a.id)} onChange={() => toggleSelectItem(a.id)} className="cursor-pointer" />
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-black text-slate-900 uppercase">{a.student_name}</p>
                          <p className="text-[10px] font-mono text-slate-400">Roll: {a.student_roll}</p>
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-600 uppercase">{hName}</td>
                        <td className="py-4 px-4 font-mono font-black text-indigo-600">Room {rNo}</td>
                        <td className="py-4 px-4 font-medium text-slate-500">{a.allocated_date}</td>
                        <td className="py-4 px-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-black uppercase border",
                            a.food_preference === 'Veg' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'
                          )}>{a.food_preference}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                            a.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-400'
                          )}>{a.status}</span>
                        </td>
                        <td className="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button onClick={() => handleEdit(a)} className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(a.id)} className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    );
                  })
                )
              )}

              {/* 4. VISITORS LOG TAB */}
              {activeTab === 'visitors' && (
                filteredVisitors.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-slate-400 text-xs">No active visitor logs.</td></tr>
                ) : (
                  filteredVisitors.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 text-center">
                        <input type="checkbox" checked={selectedItems.includes(v.id)} onChange={() => toggleSelectItem(v.id)} className="cursor-pointer" />
                      </td>
                      <td className="py-4 px-4 font-black text-slate-900 uppercase">{v.visitor_name}</td>
                      <td className="py-4 px-4 font-bold text-slate-500">{v.relation}</td>
                      <td className="py-4 px-4 font-black text-slate-800 uppercase">{v.student_name}</td>
                      <td className="py-4 px-4 font-mono text-slate-400">{v.phone}</td>
                      <td className="py-4 px-4 text-slate-600 font-medium">{v.purpose}</td>
                      <td className="py-4 px-4">
                        <p className="text-[10px] font-bold text-emerald-600">IN: {v.entry_time}</p>
                        {v.exit_time ? (
                          <p className="text-[10px] font-bold text-slate-400">OUT: {v.exit_time}</p>
                        ) : (
                          <button 
                            onClick={async () => {
                              const timeStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
                              const updated = visitors.map(vis => vis.id === v.id ? { ...vis, exit_time: timeStr } : vis);
                              setVisitors(updated);
                              toast.success('Visitor checked out successfully!');
                              await loadData();
                            }}
                            className="mt-1 px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[9px] font-black rounded border border-rose-100 cursor-pointer uppercase"
                          >
                            Mark Checkout
                          </button>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button onClick={() => handleEdit(v)} className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(v.id)} className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
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
                  <h3 className="font-display font-black uppercase text-sm">PostgreSQL Hostels Migration Schema</h3>
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
                  {editingItem ? 'Edit Accomodation Record' : `Register New ${activeTab.replace('s', '').toUpperCase()}`}
                </h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
              
              <form onSubmit={handleSave} className="p-5 space-y-4">
                {/* 1. HOSTELS FORM */}
                {activeTab === 'hostels' && (
                  <div className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Hostel Building Name</label>
                      <input required type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Newton Boys Hostel" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-800" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Hostel Type</label>
                        <select required value={formData.type || 'Boys'} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none">
                          <option value="Boys">Boys Block</option>
                          <option value="Girls">Girls Block</option>
                          <option value="Staff">Staff block</option>
                          <option value="Mixed">Mixed block</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Total Capacity</label>
                        <input required type="number" value={formData.capacity || ''} onChange={e => setFormData({...formData, capacity: Number(e.target.value)})} placeholder="e.g. 150" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-800" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Warden Name</label>
                        <input type="text" value={formData.warden_name || ''} onChange={e => setFormData({...formData, warden_name: e.target.value})} placeholder="e.g. Shri R. K. Dubey" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-800" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Warden Phone</label>
                        <input type="text" value={formData.warden_phone || ''} onChange={e => setFormData({...formData, warden_phone: e.target.value})} placeholder="+91 94510 xxxxx" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-800" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Address / Location</label>
                      <input type="text" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="e.g. West Campus Corner" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-800" />
                    </div>
                  </div>
                )}

                {/* 2. ROOMS FORM */}
                {activeTab === 'rooms' && (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Hostel Wing</label>
                        <select required value={formData.hostel_id || hostels[0]?.id || ''} onChange={e => setFormData({...formData, hostel_id: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none">
                          {hostels.map(h => (
                            <option key={h.id} value={h.id}>{h.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Room Number</label>
                        <input required type="text" value={formData.room_no || ''} onChange={e => setFormData({...formData, room_no: e.target.value})} placeholder="e.g. 101" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-800" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1 col-span-2">
                        <label className="text-[10px] font-black uppercase text-slate-400">Room Sharing Type</label>
                        <select required value={formData.type || 'Double'} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none">
                          <option value="Single">Single Bedroom</option>
                          <option value="Double">Double Share</option>
                          <option value="Triple">Triple Share</option>
                          <option value="Dormitory">Dormitory Block</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Monthly Rent</label>
                        <input required type="number" value={formData.rent_monthly || ''} onChange={e => setFormData({...formData, rent_monthly: Number(e.target.value)})} placeholder="₹3500" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-800" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Max Bed Quota</label>
                        <input required type="number" value={formData.capacity || ''} onChange={e => setFormData({...formData, capacity: Number(e.target.value)})} placeholder="e.g. 2" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-800" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Currently Occupied</label>
                        <input required type="number" value={formData.occupied || 0} onChange={e => setFormData({...formData, occupied: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-800" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Facilities (comma-separated)</label>
                      <input type="text" value={formData.facilities ? formData.facilities.join(', ') : ''} onChange={e => setFormData({...formData, facilities: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} placeholder="e.g. AC, Wi-Fi, Geyser" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-800" />
                    </div>
                  </div>
                )}

                {/* 3. ALLOCATIONS FORM */}
                {activeTab === 'allocations' && (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Student Full Name</label>
                        <input required type="text" value={formData.student_name || ''} onChange={e => setFormData({...formData, student_name: e.target.value})} placeholder="e.g. Aditya Dubey" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-800" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Pupil Roll ID</label>
                        <input required type="text" value={formData.student_roll || ''} onChange={e => setFormData({...formData, student_roll: e.target.value})} placeholder="e.g. 2026-042" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-800" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Hostel Block</label>
                        <select required value={formData.hostel_id || hostels[0]?.id || ''} onChange={e => setFormData({...formData, hostel_id: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none">
                          {hostels.map(h => (
                            <option key={h.id} value={h.id}>{h.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Room Quota</label>
                        <select required value={formData.room_id || rooms[0]?.id || ''} onChange={e => setFormData({...formData, room_id: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none">
                          {rooms.map(r => (
                            <option key={r.id} value={r.id}>Room {r.room_no} ({r.type})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Allotment Date</label>
                        <input required type="date" value={formData.allocated_date || ''} onChange={e => setFormData({...formData, allocated_date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Mess Mess Preference</label>
                        <select required value={formData.food_preference || 'Veg'} onChange={e => setFormData({...formData, food_preference: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none">
                          <option value="Veg">Vegetarian Mess</option>
                          <option value="Non-Veg">Non-Vegetarian Mess</option>
                          <option value="Jain">Jain Pure Mess</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Status</label>
                      <select required value={formData.status || 'Active'} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none">
                        <option value="Active">Active Occupant</option>
                        <option value="Vacated">Vacated Residency</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* 4. VISITORS FORM */}
                {activeTab === 'visitors' && (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Visitor Name</label>
                        <input required type="text" value={formData.visitor_name || ''} onChange={e => setFormData({...formData, visitor_name: e.target.value})} placeholder="e.g. Smt. Sunita Kumari" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-800" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Relation</label>
                        <input required type="text" value={formData.relation || ''} onChange={e => setFormData({...formData, relation: e.target.value})} placeholder="e.g. Mother" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-800" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Student Visited</label>
                        <input required type="text" value={formData.student_name || ''} onChange={e => setFormData({...formData, student_name: e.target.value})} placeholder="e.g. Divya Kumari" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-800" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Contact Mobile</label>
                        <input required type="text" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+91 99999 xxxxx" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-800" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Purpose of Visit</label>
                      <input required type="text" value={formData.purpose || ''} onChange={e => setFormData({...formData, purpose: e.target.value})} placeholder="e.g. Sweets delivery & health check" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-800" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Entry Time (YYYY-MM-DD HH:MM)</label>
                        <input required type="text" value={formData.entry_time || ''} onChange={e => setFormData({...formData, entry_time: e.target.value})} placeholder="2026-07-06 11:15" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Exit Time (Optional)</label>
                        <input type="text" value={formData.exit_time || ''} onChange={e => setFormData({...formData, exit_time: e.target.value})} placeholder="2026-07-06 15:30" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none" />
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
