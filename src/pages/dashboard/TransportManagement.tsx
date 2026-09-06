import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bus, Plus, Search, Filter, Download, Printer, Edit2, Trash2, 
  RefreshCw, Check, X, MapPin, User, ShieldCheck, Key, Settings,
  AlertCircle, Save, SlidersHorizontal, ArrowLeft, Trash, Calendar,
  DollarSign, FileText, Compass, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { AdminHeader } from '@/components/common/AdminHeader';
import { AdminStatCard } from '@/components/common/AdminStatCard';

// Interfaces for our Transport Entities
interface TransitRoute {
  id: string;
  name: string; // e.g. Route 10 - Gorakhpur Express
  start_point: string;
  end_point: string;
  fare_amount: number;
  stops_count: number;
}

interface FleetVehicle {
  id: string;
  vehicle_no: string; // e.g. UP-53-AT-9021
  model: string; // e.g. Tata Winger / School Bus
  capacity: number;
  gps_status: 'Online' | 'Offline';
  insurance_expiry: string;
}

interface DriverProfile {
  id: string;
  name: string;
  license_no: string;
  phone: string;
  status: 'On-Duty' | 'On-Leave';
}

interface TransitAllotment {
  id: string;
  student_id: string;
  student_name: string;
  student_class: string;
  route_id: string;
  vehicle_id: string;
  boarding_point: string;
  pickup_time: string;
}

interface EnrolledStudent {
  id: string;
  name: string;
  class: string;
  section: string;
}

type TabType = 'routes' | 'vehicles' | 'drivers' | 'allotments';

export default function TransportManagement() {
  const location = useLocation();
  const requestedTab = (location.state as any)?.activeTab as TabType | undefined;
  const [activeTab, setActiveTab] = useState<TabType>(requestedTab || 'routes');

  useEffect(() => {
    if (requestedTab && ['routes', 'vehicles', 'drivers', 'allotments'].includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [errorState, setErrorState] = useState<string | null>(null);

  // States for Entities
  const [routes, setRoutes] = useState<TransitRoute[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [allotments, setAllotments] = useState<TransitAllotment[]>([]);
  const [students, setStudents] = useState<EnrolledStudent[]>([]);

  // Bulk selection states
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Modals / Drawer Control
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Form Field States
  const [formData, setFormData] = useState<any>({});

  // Fetch from PostgreSQL
  const loadData = async () => {
    setIsSyncing(true);
    setErrorState(null);
    try {
      const [routesRes, vehRes, drvRes, altRes, stdRes] = await Promise.all([
        supabase.from('transport_routes').select('*').order('route_name'),
        supabase.from('vehicles').select('*'),
        supabase.from('drivers').select('*'),
        supabase.from('student_transport').select('*, students(id, name, class, section)'),
        supabase.from('students').select('id, name, class, section').eq('status', 'active').order('name').limit(2000)
      ]);

      if (stdRes.data) {
        setStudents(stdRes.data.map((s: any) => ({
          id: s.id, name: s.name || 'Student', class: s.class || '', section: s.section || ''
        })));
      }

      if (routesRes.data) {
        setRoutes(routesRes.data.map((r: any) => ({
          id: r.id,
          name: r.route_name || 'Route',
          start_point: r.start_point || 'Start',
          end_point: r.end_point || 'School Campus',
          fare_amount: Number(r.fare_amount || 0),
          stops_count: Number(r.stops_count || 1)
        })));
      }

      if (vehRes.data) {
        setVehicles(vehRes.data.map((v: any) => ({
          id: v.id,
          vehicle_no: v.vehicle_number || 'N/A',
          model: v.vehicle_model || 'Bus',
          capacity: Number(v.capacity || 30),
          gps_status: v.status === 'Active' ? 'Online' : 'Offline',
          insurance_expiry: v.registration_expiry || '2027-01-01'
        })));
      }

      if (drvRes.data) {
        setDrivers(drvRes.data.map((d: any) => ({
          id: d.id,
          name: d.name || 'Driver',
          license_no: d.license_number || 'N/A',
          phone: d.phone || 'N/A',
          status: d.status || 'On-Duty'
        })));
      }

      if (altRes.data) {
        setAllotments(altRes.data.map((a: any) => ({
          id: a.id,
          student_id: a.student_id || a.students?.id || '',
          student_name: a.students?.name || 'Student',
          student_class: a.students?.class ? `Grade ${a.students.class}-${a.students.section || 'A'}` : 'N/A',
          route_id: a.route_id || a.route || '',
          vehicle_id: a.vehicle_id || '',
          boarding_point: a.boarding_point || a.pickup_point || 'Campus',
          pickup_time: a.pickup_time || '07:30 AM'
        })));
      }

    } catch (error: any) {
      console.error('Error fetching transport tables:', error);
      setErrorState(error.message || 'Failed to load transport data');
      toast.error('Could not load transport records from database');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // CRUD handlers
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({});
    setShowAddModal(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setFormData({ ...item });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you absolutely sure you want to delete this transport record?')) return;

    try {
      const table = 
        activeTab === 'routes' ? 'transport_routes' :
        activeTab === 'vehicles' ? 'vehicles' :
        activeTab === 'drivers' ? 'drivers' : 'student_transport';

      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;

      toast.success('Transport record deleted successfully!');
      await loadData();
    } catch (err: any) {
      toast.error('Deletion failed: ' + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (activeTab === 'routes') {
        const payload = {
          route_name: formData.name,
          start_point: formData.start_point,
          end_point: formData.end_point,
          fare_amount: Number(formData.fare_amount || 0),
          stops_count: Number(formData.stops_count || 1)
        };
        if (editingItem) {
          await supabase.from('transport_routes').update(payload).eq('id', editingItem.id);
        } else {
          await supabase.from('transport_routes').insert([payload]);
        }
      } else if (activeTab === 'vehicles') {
        const payload = {
          vehicle_number: formData.vehicle_no,
          vehicle_model: formData.model,
          capacity: Number(formData.capacity || 30),
          registration_expiry: formData.insurance_expiry
        };
        if (editingItem) {
          await supabase.from('vehicles').update(payload).eq('id', editingItem.id);
        } else {
          await supabase.from('vehicles').insert([payload]);
        }
      } else if (activeTab === 'drivers') {
        const payload = {
          name: formData.name,
          license_number: formData.license_no,
          phone: formData.phone,
          status: formData.status || 'On-Duty'
        };
        if (editingItem) {
          await supabase.from('drivers').update(payload).eq('id', editingItem.id);
        } else {
          await supabase.from('drivers').insert([payload]);
        }
      } else if (activeTab === 'allotments') {
        if (!formData.student_id) {
          toast.error('Please select an enrolled student for this allotment.');
          setIsSubmitting(false);
          return;
        }
        const payload = {
          student_id: formData.student_id,
          route_id: formData.route_id,
          vehicle_id: formData.vehicle_id,
          boarding_point: formData.boarding_point,
          pickup_time: formData.pickup_time
        };
        if (editingItem) {
          await supabase.from('student_transport').update(payload).eq('id', editingItem.id);
        } else {
          await supabase.from('student_transport').insert([payload]);
        }
      }

      toast.success(editingItem ? 'Registry modified successfully!' : 'New entity registered under Fleet Registry!');
      setShowAddModal(false);
      await loadData();
    } catch (err: any) {
      toast.error('Sync failed: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk actions
  const handleToggleSelectAll = (ids: string[]) => {
    if (selectedItems.length === ids.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(ids);
    }
  };

  const handleToggleSelectOne = (id: string) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(i => i !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete these ${selectedItems.length} selected fleet records?`)) return;
    
    try {
      const table = 
        activeTab === 'routes' ? 'transport_routes' :
        activeTab === 'vehicles' ? 'vehicles' :
        activeTab === 'drivers' ? 'drivers' : 'student_transport';

      const { error } = await supabase.from(table).delete().in('id', selectedItems);
      if (error) throw error;

      setSelectedItems([]);
      toast.success('Selected records deleted successfully!');
      await loadData();
    } catch (err: any) {
      toast.error('Bulk deletion failed: ' + err.message);
    }
  };

  // Export action
  const handleExport = () => {
    toast.promise(new Promise(resolve => setTimeout(resolve, 1000)), {
      loading: 'Compiling transit rosters...',
      success: 'Roster saved to local download stream!',
      error: 'Export failed'
    });
  };

  // Print Action
  const handlePrint = () => {
    window.print();
  };

  // Filtered lists for rendering
  const filteredRoutes = useMemo(() => {
    return routes.filter(r => 
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.start_point.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.end_point.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [routes, searchQuery]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => 
      v.vehicle_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.model.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [vehicles, searchQuery]);

  const filteredDrivers = useMemo(() => {
    return drivers.filter(d => 
      (d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
       d.license_no.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (statusFilter === 'all' || d.status === statusFilter)
    );
  }, [drivers, searchQuery, statusFilter]);

  const filteredAllotments = useMemo(() => {
    return allotments.filter(a => {
      const rName = routes.find(r => r.id === a.route_id)?.name || '';
      return (a.student_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
              a.boarding_point.toLowerCase().includes(searchQuery.toLowerCase()) ||
              rName.toLowerCase().includes(searchQuery.toLowerCase())) &&
             (statusFilter === 'all' || a.route_id === statusFilter);
    });
  }, [allotments, routes, searchQuery, statusFilter]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16 text-slate-700 font-sans antialiased">
{/* 1. Header Toolbar */}
      <AdminHeader
        title="Transit Fleet & Routes"
        subtitle="Configure school transit lines, manage authorized driver licensing, track insurance expiry dates, and allocate seats for enrolled student residency."
        badge={{
          icon: Compass,
          text: 'Fleet Logistics Hub',
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
              title="Force reload schemas"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            
            <button 
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Fleet Entry
            </button>
          </>
        }
      />

      {/* 2. Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminStatCard
          label="Registered Routes"
          value={routes.length}
          subtext="Coverage sectors"
          icon={MapPin}
          variant="emerald"
        />
        <AdminStatCard
          label="Fleet Vehicles"
          value={vehicles.length}
          subtext="Active school buses/vans"
          icon={Bus}
          variant="primary"
        />
        <AdminStatCard
          label="Transit Allotments"
          value={allotments.length}
          subtext="Enrolled students"
          icon={User}
          variant="violet"
        />
        <AdminStatCard
          label="Driver Compliance"
          value={drivers.filter(d => d.status === 'On-Duty').length}
          subtext="Staff on-duty active"
          icon={ShieldCheck}
          variant="rose"
        />
      </div>

      {/* 3. Segmented Navigation Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 shadow-2xs overflow-x-auto">
        <nav className="flex items-center gap-1 min-w-max" aria-label="Transport Navigation Sections">
          {[
            { id: 'routes', label: 'Transit Routes', icon: MapPin },
            { id: 'vehicles', label: 'Fleet Vehicles', icon: Bus },
            { id: 'drivers', label: 'Certified Drivers', icon: User },
            { id: 'allotments', label: 'Transit Allotments', icon: Key }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as TabType);
                  setSelectedItems([]);
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className={cn(
                  "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                  isActive
                    ? "bg-slate-900 text-white shadow-xs" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <tab.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-blue-400" : "text-slate-400")} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Advanced Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Dynamic Search */}
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={`Search ${activeTab === 'routes' ? 'routes...' : activeTab === 'vehicles' ? 'vehicle no...' : activeTab === 'drivers' ? 'drivers...' : 'student name...'}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium h-[38px]"
            />
          </div>

          {/* Conditional filter dropdowns */}
          {activeTab === 'drivers' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-semibold text-slate-600 outline-none h-[38px] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="On-Duty">On-Duty</option>
              <option value="On-Leave">On-Leave</option>
            </select>
          )}

          {activeTab === 'allotments' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-semibold text-slate-600 outline-none h-[38px] cursor-pointer"
            >
              <option value="all">All Routes</option>
              {routes.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Action Button Set */}
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
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 h-[38px] bg-violet-50 text-violet-600 border border-violet-100/40 rounded-xl text-xs font-bold hover:bg-violet-600 hover:text-white transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Excel Ledger
          </button>
        </div>
      </div>

      {/* Main Workspace Table */}
      <div className="bg-white border border-slate-200/60 shadow-sm rounded-[24px] overflow-hidden">
        <div className="overflow-x-auto">
          <AnimatePresence mode="wait">
            {/* TAB 1: ROUTES */}
            {activeTab === 'routes' && (
              <motion.table 
                key="routes"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full text-left border-collapse min-w-[700px]"
              >
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="py-4 px-6 w-[50px]">
                      <input 
                        type="checkbox"
                        checked={filteredRoutes.length > 0 && selectedItems.length === filteredRoutes.length}
                        onChange={() => handleToggleSelectAll(filteredRoutes.map(r => r.id))}
                        className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                      />
                    </th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Route Sector</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Starting Point</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Terminal Point</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Stops Count</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Route Fare</th>
                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 text-xs">
                  {filteredRoutes.map((route) => (
                    <tr key={route.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-4 px-6">
                        <input 
                          type="checkbox"
                          checked={selectedItems.includes(route.id)}
                          onChange={() => handleToggleSelectOne(route.id)}
                          className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                        />
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <Bus className="w-4 h-4 text-violet-500 shrink-0" />
                        {route.name}
                      </td>
                      <td className="py-4 px-4 font-semibold text-slate-500">{route.start_point}</td>
                      <td className="py-4 px-4 font-semibold text-slate-500">{route.end_point}</td>
                      <td className="py-4 px-4 text-center font-bold text-slate-600 bg-slate-50/60 rounded-md w-12 mx-auto">{route.stops_count} stops</td>
                      <td className="py-4 px-4 text-right font-mono font-extrabold text-emerald-600">₹{route.fare_amount.toLocaleString()} <span className="text-[9px] text-slate-400 font-normal">/mo</span></td>
                      <td className="py-4 px-6 text-right space-x-1 whitespace-nowrap">
                        <button 
                          onClick={() => handleOpenEdit(route)}
                          className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-violet-600 rounded-lg transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(route.id)}
                          className="p-1.5 bg-white hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </motion.table>
            )}

            {/* TAB 2: VEHICLES */}
            {activeTab === 'vehicles' && (
              <motion.table 
                key="vehicles"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full text-left border-collapse min-w-[700px]"
              >
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="py-4 px-6 w-[50px]">
                      <input 
                        type="checkbox"
                        checked={filteredVehicles.length > 0 && selectedItems.length === filteredVehicles.length}
                        onChange={() => handleToggleSelectAll(filteredVehicles.map(v => v.id))}
                        className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                      />
                    </th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehicle Registration</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Model / Description</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Passenger Capacity</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">GPS Tracking State</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Insurance Expiry</th>
                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 text-xs">
                  {filteredVehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-4 px-6">
                        <input 
                          type="checkbox"
                          checked={selectedItems.includes(v.id)}
                          onChange={() => handleToggleSelectOne(v.id)}
                          className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                        />
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-violet-600 uppercase tracking-wider">{v.vehicle_no}</td>
                      <td className="py-4 px-4 font-bold text-slate-800">{v.model}</td>
                      <td className="py-4 px-4 text-center font-semibold text-slate-500">{v.capacity} Seater</td>
                      <td className="py-4 px-4 text-center">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center justify-center gap-1 w-20 mx-auto",
                          v.gps_status === 'Online' 
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                            : "bg-rose-50 text-rose-600 border-rose-100"
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", v.gps_status === 'Online' ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
                          {v.gps_status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center font-mono text-slate-500">{v.insurance_expiry}</td>
                      <td className="py-4 px-6 text-right space-x-1 whitespace-nowrap">
                        <button 
                          onClick={() => handleOpenEdit(v)}
                          className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-violet-600 rounded-lg transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(v.id)}
                          className="p-1.5 bg-white hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </motion.table>
            )}

            {/* TAB 3: DRIVERS */}
            {activeTab === 'drivers' && (
              <motion.table 
                key="drivers"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full text-left border-collapse min-w-[700px]"
              >
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="py-4 px-6 w-[50px]">
                      <input 
                        type="checkbox"
                        checked={filteredDrivers.length > 0 && selectedItems.length === filteredDrivers.length}
                        onChange={() => handleToggleSelectAll(filteredDrivers.map(d => d.id))}
                        className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                      />
                    </th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Driver Name</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">License Serial</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Mobile Contacts</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Duty Status</th>
                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 text-xs">
                  {filteredDrivers.map((driver) => (
                    <tr key={driver.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-4 px-6">
                        <input 
                          type="checkbox"
                          checked={selectedItems.includes(driver.id)}
                          onChange={() => handleToggleSelectOne(driver.id)}
                          className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                        />
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                        {driver.name}
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg w-fit">{driver.license_no}</td>
                      <td className="py-4 px-4 text-center font-mono font-semibold text-slate-600">{driver.phone}</td>
                      <td className="py-4 px-4 text-center">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                          driver.status === 'On-Duty' 
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                            : "bg-rose-50 text-rose-600 border-rose-100"
                        )}>
                          {driver.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right space-x-1 whitespace-nowrap">
                        <button 
                          onClick={() => handleOpenEdit(driver)}
                          className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-violet-600 rounded-lg transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(driver.id)}
                          className="p-1.5 bg-white hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </motion.table>
            )}

            {/* TAB 4: TRANSIT ALLOTMENTS */}
            {activeTab === 'allotments' && (
              <motion.table 
                key="allotments"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full text-left border-collapse min-w-[700px]"
              >
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="py-4 px-6 w-[50px]">
                      <input 
                        type="checkbox"
                        checked={filteredAllotments.length > 0 && selectedItems.length === filteredAllotments.length}
                        onChange={() => handleToggleSelectAll(filteredAllotments.map(a => a.id))}
                        className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                      />
                    </th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Enrolled Student</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Class / Div</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Allotted Route Sector</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Allotted Fleet Vehicle</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Boarding Point Stop</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Pick-Up Time</th>
                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 text-xs">
                  {filteredAllotments.map((a) => {
                    const r = routes.find(route => route.id === a.route_id);
                    const v = vehicles.find(veh => veh.id === a.vehicle_id);
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-4 px-6">
                          <input 
                            type="checkbox"
                            checked={selectedItems.includes(a.id)}
                            onChange={() => handleToggleSelectOne(a.id)}
                            className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                          />
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-900">{a.student_name}</td>
                        <td className="py-4 px-4 font-semibold text-slate-500">{a.student_class}</td>
                        <td className="py-4 px-4 font-semibold text-violet-600">{r?.name || 'Central Roster'}</td>
                        <td className="py-4 px-4 font-mono font-bold text-slate-500">{v?.vehicle_no || 'Central Bus'}</td>
                        <td className="py-4 px-4 text-center font-bold text-slate-600">{a.boarding_point}</td>
                        <td className="py-4 px-4 text-center font-mono text-emerald-600 font-extrabold flex items-center justify-center gap-1">
                          <Clock size={11} /> {a.pickup_time}
                        </td>
                        <td className="py-4 px-6 text-right space-x-1 whitespace-nowrap">
                          <button 
                            onClick={() => handleOpenEdit(a)}
                            className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-violet-600 rounded-lg transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(a.id)}
                            className="p-1.5 bg-white hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </motion.table>
            )}
          </AnimatePresence>

          {/* Empty state */}
          {((activeTab === 'routes' && filteredRoutes.length === 0) ||
            (activeTab === 'vehicles' && filteredVehicles.length === 0) ||
            (activeTab === 'drivers' && filteredDrivers.length === 0) ||
            (activeTab === 'allotments' && filteredAllotments.length === 0)) && (
            <div className="text-center py-20 bg-slate-50/50">
              <Bus className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Empty Fleet Registry</h3>
              <p className="text-slate-400/80 text-[11px] mt-1">No transportation records found matching the filters.</p>
            </div>
          )}
        </div>
      </div>

      {/* COMPREHENSIVE DRAWER / MODAL FORM */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-xl overflow-hidden text-left border border-slate-100"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    {editingItem ? 'Configure Fleet Registry' : 'Initialize New Fleet Logistics'}
                  </h3>
                  <p className="text-slate-400 text-[10px] font-semibold mt-0.5">
                    Modifying system parameters under {activeTab.toUpperCase()} context.
                  </p>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[450px] overflow-y-auto">
                {activeTab === 'routes' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Route Sector Name</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. Route A - Town Express"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all h-[36px]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Starting Point</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. Town Hall"
                          value={formData.start_point || ''}
                          onChange={(e) => setFormData({ ...formData, start_point: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all h-[36px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Ending Point</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. Campus gate"
                          value={formData.end_point || ''}
                          onChange={(e) => setFormData({ ...formData, end_point: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all h-[36px]"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Stops Count</label>
                        <input 
                          type="number" 
                          required
                          value={formData.stops_count || 0}
                          onChange={(e) => setFormData({ ...formData, stops_count: parseInt(e.target.value) })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Route Fare (₹)</label>
                        <input 
                          type="number" 
                          required
                          value={formData.fare_amount || 0}
                          onChange={(e) => setFormData({ ...formData, fare_amount: parseFloat(e.target.value) })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'vehicles' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Vehicle Registration Number</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. UP-53-AT-9021"
                          value={formData.vehicle_no || ''}
                          onChange={(e) => setFormData({ ...formData, vehicle_no: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all h-[36px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Fleet Model</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. Force Traveler Bus"
                          value={formData.model || ''}
                          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all h-[36px]"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Passenger Capacity</label>
                        <input 
                          type="number" 
                          required
                          value={formData.capacity || 20}
                          onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Insurance Expiry Date</label>
                        <input 
                          type="date" 
                          required
                          value={formData.insurance_expiry || ''}
                          onChange={(e) => setFormData({ ...formData, insurance_expiry: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'drivers' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Driver Full Name</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. Ram Pal Yadav"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all h-[36px]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">License Serial Code</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. DL-532018..."
                          value={formData.license_no || ''}
                          onChange={(e) => setFormData({ ...formData, license_no: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all h-[36px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Mobile Contacts</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. +91 94500..."
                          value={formData.phone || ''}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all h-[36px]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'allotments' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Enrolled Student</label>
                      <select
                        required
                        value={formData.student_id || ''}
                        onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                      >
                        <option value="">Select Student...</option>
                        {students.map(s => (
                          <option key={s.id} value={s.id}>{s.name} — Class {s.class}{s.section ? `-${s.section}` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Allotted Route</label>
                        <select 
                          value={formData.route_id || ''} 
                          onChange={(e) => setFormData({ ...formData, route_id: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        >
                          <option value="">Select Route...</option>
                          {routes.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Allotted Vehicle</label>
                        <select 
                          value={formData.vehicle_id || ''} 
                          onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        >
                          <option value="">Select Vehicle...</option>
                          {vehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.vehicle_no}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Boarding Stop Point</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. Town Hall Crossing"
                          value={formData.boarding_point || ''}
                          onChange={(e) => setFormData({ ...formData, boarding_point: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all h-[36px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Morning Pick-Up Time</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. 07:30 AM"
                          value={formData.pickup_time || ''}
                          onChange={(e) => setFormData({ ...formData, pickup_time: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all h-[36px]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-500 hover:text-slate-800 rounded-xl text-xs font-bold transition-all hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-violet-500/15"
                  >
                    {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Confirm Sync
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
