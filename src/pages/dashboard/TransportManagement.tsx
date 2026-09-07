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
  vehicle_id: string; // the bus that runs this line
}

interface FleetVehicle {
  id: string;
  vehicle_no: string; // e.g. UP-53-AT-9021
  model: string; // e.g. Tata Winger / School Bus
  capacity: number;
  status: 'Active' | 'Maintenance' | 'Retired';
  registration_expiry: string;
  insurance_expiry: string;
  last_service_date: string;
  gps_device_id: string;
}

interface DriverProfile {
  id: string;
  name: string;
  license_no: string;
  license_expiry: string;
  phone: string;
  address: string;
  experience_years: number;
  vehicle_id: string; // the bus this driver is behind the wheel of
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
  drop_time: string;
}

// A document within this many days of lapsing gets flagged in the fleet and
// driver tables — the school needs warning before a bus is off the road.
const EXPIRY_WARNING_DAYS = 60;

const daysUntil = (date?: string) => {
  if (!date) return null;
  const diff = new Date(`${String(date).slice(0, 10)}T00:00:00`).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime();
  return Math.round(diff / 86400000);
};

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

      // supabase-js resolves rather than throws, so a failed request arrives as
      // `.error`. Unchecked, a broken query was indistinguishable from an
      // empty fleet.
      for (const [what, res] of [
        ['routes', routesRes], ['vehicles', vehRes], ['drivers', drvRes], ['allotments', altRes]
      ] as const) {
        if (res.error) throw new Error(`${what}: ${res.error.message}`);
      }

      setStudents((stdRes.data || []).map((s: any) => ({
        id: s.id, name: s.name || 'Student', class: s.class || '', section: s.section || ''
      })));

      setRoutes((routesRes.data || []).map((r: any) => ({
        id: r.id,
        name: r.route_name || 'Route',
        start_point: r.start_point || 'Start',
        end_point: r.end_point || 'School Campus',
        fare_amount: Number(r.fare_amount || 0),
        stops_count: Number(r.stops_count || 0),
        vehicle_id: r.vehicle_id || ''
      })));

      setVehicles((vehRes.data || []).map((v: any) => ({
        id: v.id,
        vehicle_no: v.vehicle_number || 'N/A',
        model: v.vehicle_model || 'Bus',
        capacity: Number(v.capacity || 30),
        // Real column now. This used to read a `status` that did not exist on
        // the table, so every bus in the fleet rendered as GPS "Offline".
        status: (v.status || 'Active') as FleetVehicle['status'],
        registration_expiry: v.registration_expiry || '',
        // Insurance and registration are separate documents; the page used to
        // print the registration date under the insurance heading.
        insurance_expiry: v.insurance_expiry || '',
        last_service_date: v.last_service_date || '',
        gps_device_id: v.gps_device_id || ''
      })));

      setDrivers((drvRes.data || []).map((d: any) => ({
        id: d.id,
        name: d.name || 'Driver',
        license_no: d.license_number || 'N/A',
        license_expiry: d.license_expiry || '',
        phone: d.phone || 'N/A',
        address: d.address || '',
        experience_years: Number(d.experience_years || 0),
        vehicle_id: d.vehicle_id || '',
        status: (d.status === 'On-Leave' ? 'On-Leave' : 'On-Duty') as DriverProfile['status']
      })));

      setAllotments((altRes.data || []).map((a: any) => ({
        id: a.id,
        student_id: a.student_id || a.students?.id || '',
        student_name: a.students?.name || 'Student',
        student_class: a.students?.class ? `Grade ${a.students.class}-${a.students.section || 'A'}` : 'N/A',
        route_id: a.route_id || '',
        vehicle_id: a.vehicle_id || '',
        boarding_point: a.boarding_point || a.pickup_point || 'Campus',
        pickup_time: a.pickup_time || '07:30 AM',
        drop_time: a.drop_time || ''
      })));

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
    setFormData(
      activeTab === 'vehicles' ? { status: 'Active', capacity: 30 } :
      activeTab === 'drivers' ? { status: 'On-Duty', experience_years: 0 } :
      activeTab === 'routes' ? { stops_count: 1, fare_amount: 0 } :
      { pickup_time: '07:30 AM', drop_time: '03:30 PM' }
    );
    setShowAddModal(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setFormData({ ...item });
    setShowAddModal(true);
  };

  const TABLE_FOR_TAB: Record<TabType, string> = {
    routes: 'transport_routes',
    vehicles: 'vehicles',
    drivers: 'drivers',
    allotments: 'student_transport'
  };

  // Retiring a route or a bus that children are still booked onto would strand
  // them, so say how many and make the caller confirm that specifically.
  const ridersOn = (ids: string[]) =>
    allotments.filter(a => ids.includes(activeTab === 'routes' ? a.route_id : a.vehicle_id)).length;

  const confirmRetire = (ids: string[]) => {
    if (activeTab === 'routes' || activeTab === 'vehicles') {
      const riders = ridersOn(ids);
      if (riders > 0) {
        return window.confirm(
          `${riders} student${riders === 1 ? ' is' : 's are'} still allotted to ` +
          `${ids.length === 1 ? 'this' : 'these'} ${activeTab === 'routes' ? 'route' : 'vehicle'}${ids.length === 1 ? '' : 's'}. ` +
          `Deleting will leave ${riders === 1 ? 'that allotment' : 'those allotments'} without transport. Continue?`
        );
      }
    }
    return window.confirm(`Delete ${ids.length === 1 ? 'this transport record' : `these ${ids.length} fleet records`}?`);
  };

  const handleDelete = async (id: string) => {
    if (!confirmRetire([id])) return;

    try {
      const { error } = await supabase.from(TABLE_FOR_TAB[activeTab]).delete().eq('id', id);
      if (error) throw error;

      toast.success('Transport record deleted successfully!');
      setSelectedItems(prev => prev.filter(i => i !== id));
      await loadData();
    } catch (err: any) {
      toast.error('Deletion failed: ' + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let error = null;

      if (activeTab === 'routes') {
        const payload = {
          route_name: formData.name,
          start_point: formData.start_point,
          end_point: formData.end_point,
          fare_amount: Number(formData.fare_amount || 0),
          stops_count: Number(formData.stops_count || 1),
          vehicle_id: formData.vehicle_id || null
        };
        ({ error } = editingItem
          ? await supabase.from('transport_routes').update(payload).eq('id', editingItem.id)
          : await supabase.from('transport_routes').insert([payload]));
      } else if (activeTab === 'vehicles') {
        const payload = {
          vehicle_number: formData.vehicle_no,
          vehicle_model: formData.model,
          capacity: Number(formData.capacity || 30),
          status: formData.status || 'Active',
          registration_expiry: formData.registration_expiry || null,
          insurance_expiry: formData.insurance_expiry || null,
          last_service_date: formData.last_service_date || null,
          gps_device_id: formData.gps_device_id || null
        };
        ({ error } = editingItem
          ? await supabase.from('vehicles').update(payload).eq('id', editingItem.id)
          : await supabase.from('vehicles').insert([payload]));
      } else if (activeTab === 'drivers') {
        const payload = {
          name: formData.name,
          license_number: formData.license_no,
          license_expiry: formData.license_expiry || null,
          phone: formData.phone,
          address: formData.address || null,
          experience_years: Number(formData.experience_years || 0),
          // One driver per bus: clear anyone else already assigned to it below.
          vehicle_id: formData.vehicle_id || null,
          status: formData.status || 'On-Duty'
        };
        let savedId = editingItem?.id;
        if (editingItem) {
          ({ error } = await supabase.from('drivers').update(payload).eq('id', editingItem.id));
        } else {
          const res = await supabase.from('drivers').insert([payload]).select('id').single();
          error = res.error;
          savedId = res.data?.id;
        }
        if (!error && payload.vehicle_id && savedId) {
          await supabase.from('drivers').update({ vehicle_id: null })
            .eq('vehicle_id', payload.vehicle_id).neq('id', savedId);
        }
      } else if (activeTab === 'allotments') {
        if (!formData.student_id) {
          toast.error('Please select an enrolled student for this allotment.');
          setIsSubmitting(false);
          return;
        }
        const payload = {
          student_id: formData.student_id,
          route_id: formData.route_id || null,
          // The bus follows the route unless one was picked explicitly.
          vehicle_id: formData.vehicle_id
            || routes.find(r => r.id === formData.route_id)?.vehicle_id
            || null,
          boarding_point: formData.boarding_point,
          pickup_time: formData.pickup_time,
          drop_time: formData.drop_time || null
        };
        ({ error } = editingItem
          ? await supabase.from('student_transport').update(payload).eq('id', editingItem.id)
          : await supabase.from('student_transport').insert([payload]));

        // student_transport_student_unique — one allotment per student.
        if (error && /duplicate key|unique/i.test(error.message)) {
          throw new Error('That student already has a transport allotment. Edit the existing one instead.');
        }
      }

      if (error) throw error;

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
    if (!confirmRetire(selectedItems)) return;

    try {
      const { error } = await supabase.from(TABLE_FOR_TAB[activeTab]).delete().in('id', selectedItems);
      if (error) throw error;

      setSelectedItems([]);
      toast.success('Selected records deleted successfully!');
      await loadData();
    } catch (err: any) {
      toast.error('Bulk deletion failed: ' + err.message);
    }
  };

  // Export action — real CSV of whichever tab is active, built from the same
  // filtered rows already on screen. This used to be a 1-second fake spinner
  // that announced a download and produced no file.
  const handleExport = () => {
    const q = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    let header = '';
    let rows: string[] = [];
    let filename = '';

    if (activeTab === 'routes') {
      header = 'Route,Start Point,End Point,Stops,Fare,Vehicle,Driver,Students\n';
      rows = filteredRoutes.map(r => {
        const v = vehicles.find(x => x.id === r.vehicle_id);
        return [r.name, r.start_point, r.end_point, r.stops_count, r.fare_amount,
          v?.vehicle_no || '', driverForVehicle(r.vehicle_id)?.name || '', ridersOnRoute(r.id)].map(q).join(',');
      });
      filename = 'Transit_Routes';
    } else if (activeTab === 'vehicles') {
      header = 'Vehicle No,Model,Capacity,Allotted,Status,GPS Device,Registration Expiry,Insurance Expiry,Last Service\n';
      rows = filteredVehicles.map(v => [v.vehicle_no, v.model, v.capacity, ridersOnVehicle(v.id),
        v.status, v.gps_device_id, v.registration_expiry, v.insurance_expiry, v.last_service_date].map(q).join(','));
      filename = 'Fleet_Vehicles';
    } else if (activeTab === 'drivers') {
      header = 'Driver,License No,License Expiry,Phone,Address,Experience (yrs),Assigned Vehicle,Duty Status\n';
      rows = filteredDrivers.map(d => [d.name, d.license_no, d.license_expiry, d.phone, d.address,
        d.experience_years, vehicles.find(v => v.id === d.vehicle_id)?.vehicle_no || '', d.status].map(q).join(','));
      filename = 'Certified_Drivers';
    } else {
      header = 'Student,Class,Route,Vehicle,Driver,Boarding Point,Pick-Up,Drop\n';
      rows = filteredAllotments.map(a => [a.student_name, a.student_class,
        routes.find(r => r.id === a.route_id)?.name || '',
        vehicles.find(v => v.id === a.vehicle_id)?.vehicle_no || '',
        driverForVehicle(a.vehicle_id)?.name || '',
        a.boarding_point, a.pickup_time, a.drop_time].map(q).join(','));
      filename = 'Transit_Allotments';
    }

    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    toast.success('Export downloaded.');
  };

  // Print Action
  const handlePrint = () => {
    window.print();
  };

  // A route's crew is derived, never stored twice: the route names the bus,
  // and the driver is whoever is assigned to that bus.
  const driverForVehicle = (vehicleId: string) =>
    vehicleId ? drivers.find(d => d.vehicle_id === vehicleId) : undefined;

  const ridersOnVehicle = (vehicleId: string) =>
    allotments.filter(a => a.vehicle_id === vehicleId).length;

  const ridersOnRoute = (routeId: string) =>
    allotments.filter(a => a.route_id === routeId).length;

  // Documents about to lapse, across both the fleet and the driver roster.
  const expiringSoon = useMemo(() => {
    const near = (d?: string) => {
      const n = daysUntil(d);
      return n !== null && n <= EXPIRY_WARNING_DAYS;
    };
    return [
      ...vehicles.filter(v => near(v.insurance_expiry) || near(v.registration_expiry)),
      ...drivers.filter(d => near(d.license_expiry))
    ];
  }, [vehicles, drivers]);

  // A student can hold only one allotment (student_transport_student_unique),
  // so the picker offers the unallotted — plus whoever is being edited.
  const selectableStudents = useMemo(() => {
    const taken = new Set(allotments.map(a => a.student_id));
    if (editingItem?.student_id) taken.delete(editingItem.student_id);
    return students.filter(s => !taken.has(s.id));
  }, [students, allotments, editingItem]);

  // Filtered lists for rendering
  const filteredRoutes = useMemo(() => {
    return routes.filter(r => 
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.start_point.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.end_point.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [routes, searchQuery]);

  const filteredVehicles = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return vehicles.filter(v =>
      (v.vehicle_no.toLowerCase().includes(q) || v.model.toLowerCase().includes(q)) &&
      (statusFilter === 'all' || v.status === statusFilter)
    );
  }, [vehicles, searchQuery, statusFilter]);

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

      {/* Load failure — previously recorded in state but never shown, so a
          broken query looked exactly like an empty fleet. */}
      {errorState && (
        <div className="flex items-start gap-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold">Fleet records could not be loaded</p>
            <p className="text-[11px] font-medium text-rose-600/80 mt-0.5">{errorState}</p>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1 bg-white border border-rose-200 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-rose-600 hover:text-white transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminStatCard
          label="Registered Routes"
          value={routes.length}
          subtext={`${routes.reduce((a, r) => a + r.stops_count, 0)} stops covered`}
          icon={MapPin}
          variant="emerald"
        />
        <AdminStatCard
          label="Fleet On Road"
          value={vehicles.filter(v => v.status === 'Active').length}
          subtext={`${vehicles.filter(v => v.status !== 'Active').length} off road of ${vehicles.length} total`}
          icon={Bus}
          variant="primary"
        />
        <AdminStatCard
          label="Transit Allotments"
          value={allotments.length}
          subtext={`${vehicles.reduce((a, v) => a + v.capacity, 0)} seats in fleet`}
          icon={User}
          variant="violet"
        />
        <AdminStatCard
          label="Papers Expiring"
          value={expiringSoon.length}
          subtext={`Within ${EXPIRY_WARNING_DAYS} days — licences & insurance`}
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
          {activeTab === 'vehicles' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-semibold text-slate-600 outline-none h-[38px] cursor-pointer"
            >
              <option value="all">All Fleet States</option>
              <option value="Active">Active</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Retired">Retired</option>
            </select>
          )}

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
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned Crew</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Stops</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Riders</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Route Fare</th>
                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 text-xs">
                  {filteredRoutes.map((route) => {
                    const bus = vehicles.find(v => v.id === route.vehicle_id);
                    const driver = driverForVehicle(route.vehicle_id);
                    return (
                    <tr key={route.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-4 px-6">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(route.id)}
                          onChange={() => handleToggleSelectOne(route.id)}
                          className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                        />
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Bus className="w-4 h-4 text-violet-500 shrink-0" />
                          {route.name}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-semibold text-slate-500">
                        {route.start_point}
                        <span className="block text-[10px] text-slate-400 font-medium">to {route.end_point}</span>
                      </td>
                      <td className="py-4 px-4">
                        {bus ? (
                          <>
                            <span className="font-mono font-bold text-violet-600">{bus.vehicle_no}</span>
                            <span className="block text-[10px] font-semibold text-slate-500">
                              {driver ? driver.name : <span className="text-amber-600">No driver assigned</span>}
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Unassigned</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center font-bold text-slate-600">{route.stops_count}</td>
                      <td className="py-4 px-4 text-center font-bold text-slate-600">{ridersOnRoute(route.id)}</td>
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
                    );
                  })}
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
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Model / Driver</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Seat Occupancy</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Fleet State</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Insurance / Registration</th>
                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 text-xs">
                  {filteredVehicles.map((v) => {
                    const driver = driverForVehicle(v.id);
                    const riders = ridersOnVehicle(v.id);
                    const insuranceIn = daysUntil(v.insurance_expiry);
                    const regIn = daysUntil(v.registration_expiry);
                    return (
                    <tr key={v.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-4 px-6">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(v.id)}
                          onChange={() => handleToggleSelectOne(v.id)}
                          className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                        />
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-violet-600 uppercase tracking-wider">
                        {v.vehicle_no}
                        {v.gps_device_id && (
                          <span className="block text-[9px] text-slate-400 font-medium normal-case tracking-normal">{v.gps_device_id}</span>
                        )}
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-800">
                        {v.model}
                        <span className="block text-[10px] font-semibold text-slate-500">
                          {driver ? driver.name : <span className="text-amber-600">No driver assigned</span>}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={cn(
                          "font-bold",
                          riders > v.capacity ? "text-rose-600" : "text-slate-600"
                        )}>
                          {riders} / {v.capacity}
                        </span>
                        <span className="block text-[9px] text-slate-400 mt-0.5">
                          {riders > v.capacity ? `${riders - v.capacity} over capacity` : `${v.capacity - riders} seats free`}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border inline-flex items-center justify-center gap-1",
                          v.status === 'Active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          v.status === 'Maintenance' ? "bg-amber-50 text-amber-600 border-amber-100" :
                          "bg-slate-100 text-slate-500 border-slate-200"
                        )}>
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            v.status === 'Active' ? "bg-emerald-500 animate-pulse" :
                            v.status === 'Maintenance' ? "bg-amber-500" : "bg-slate-400"
                          )} />
                          {v.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center font-mono text-[11px]">
                        <span className={cn(
                          "font-bold",
                          insuranceIn === null ? "text-slate-300" :
                          insuranceIn < 0 ? "text-rose-600" :
                          insuranceIn <= EXPIRY_WARNING_DAYS ? "text-amber-600" : "text-slate-500"
                        )}>
                          {v.insurance_expiry || 'Not on file'}
                          {insuranceIn !== null && insuranceIn < 0 && ' · lapsed'}
                        </span>
                        <span className={cn(
                          "block text-[10px]",
                          regIn !== null && regIn < 0 ? "text-rose-500" : "text-slate-400"
                        )}>
                          Reg: {v.registration_expiry || 'Not on file'}
                        </span>
                      </td>
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
                    );
                  })}
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
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Licence / Validity</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Mobile Contact</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned Bus</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Duty Status</th>
                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 text-xs">
                  {filteredDrivers.map((driver) => {
                    const bus = vehicles.find(v => v.id === driver.vehicle_id);
                    const route = routes.find(r => r.vehicle_id === driver.vehicle_id);
                    const licenceIn = daysUntil(driver.license_expiry);
                    return (
                    <tr key={driver.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-4 px-6">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(driver.id)}
                          onChange={() => handleToggleSelectOne(driver.id)}
                          className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                        />
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400 shrink-0" />
                          <div>
                            {driver.name}
                            <span className="block text-[10px] font-medium text-slate-400">
                              {driver.experience_years > 0 ? `${driver.experience_years} yrs experience` : 'Experience not on file'}
                              {driver.address ? ` · ${driver.address}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-mono text-slate-500">{driver.license_no}</span>
                        <span className={cn(
                          "block text-[10px] font-bold",
                          licenceIn === null ? "text-slate-300" :
                          licenceIn < 0 ? "text-rose-600" :
                          licenceIn <= EXPIRY_WARNING_DAYS ? "text-amber-600" : "text-slate-400"
                        )}>
                          {driver.license_expiry
                            ? licenceIn !== null && licenceIn < 0
                              ? `Expired ${driver.license_expiry}`
                              : `Valid to ${driver.license_expiry}`
                            : 'Expiry not on file'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center font-mono font-semibold text-slate-600">{driver.phone}</td>
                      <td className="py-4 px-4">
                        {bus ? (
                          <>
                            <span className="font-mono font-bold text-violet-600">{bus.vehicle_no}</span>
                            <span className="block text-[10px] font-medium text-slate-400">{route?.name || 'No route assigned'}</span>
                          </>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unassigned</span>
                        )}
                      </td>
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
                    );
                  })}
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
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehicle / Driver</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Boarding Point Stop</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Pick-Up / Drop</th>
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
                        <td className="py-4 px-4 font-semibold text-violet-600">{r?.name || 'Unassigned'}</td>
                        <td className="py-4 px-4">
                          <span className="font-mono font-bold text-slate-500">{v?.vehicle_no || 'Unassigned'}</span>
                          <span className="block text-[10px] font-medium text-slate-400">
                            {driverForVehicle(a.vehicle_id)?.name || 'No driver'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center font-bold text-slate-600">{a.boarding_point}</td>
                        <td className="py-4 px-4 text-center">
                          <span className="font-mono text-emerald-600 font-extrabold inline-flex items-center gap-1">
                            <Clock size={11} /> {a.pickup_time}
                          </span>
                          <span className="block text-[10px] font-mono font-bold text-slate-400 mt-0.5">
                            {a.drop_time ? `Drop ${a.drop_time}` : 'Drop not set'}
                          </span>
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
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Bus Serving This Route</label>
                      <select
                        value={formData.vehicle_id || ''}
                        onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                      >
                        <option value="">Not assigned yet...</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.vehicle_no} — {v.model} ({v.capacity} seats)
                          </option>
                        ))}
                      </select>
                      {/* The crew follows the bus, so naming it here names the driver too. */}
                      <p className="text-[10px] text-slate-400 font-medium pl-1">
                        {formData.vehicle_id
                          ? `Driver on this bus: ${driverForVehicle(formData.vehicle_id)?.name || 'none assigned yet'}`
                          : 'The route’s driver is whoever is assigned to the bus you pick.'}
                      </p>
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
                          min={1}
                          value={formData.capacity || 20}
                          onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Fleet State</label>
                        <select
                          value={formData.status || 'Active'}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        >
                          <option value="Active">Active — on road</option>
                          <option value="Maintenance">Maintenance — off road</option>
                          <option value="Retired">Retired — out of service</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Insurance and registration lapse on different dates; the
                          page used to store one and label it the other. */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Insurance Expiry Date</label>
                        <input
                          type="date"
                          value={formData.insurance_expiry || ''}
                          onChange={(e) => setFormData({ ...formData, insurance_expiry: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Registration Expiry Date</label>
                        <input
                          type="date"
                          value={formData.registration_expiry || ''}
                          onChange={(e) => setFormData({ ...formData, registration_expiry: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Last Serviced On</label>
                        <input
                          type="date"
                          value={formData.last_service_date || ''}
                          onChange={(e) => setFormData({ ...formData, last_service_date: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">GPS Device ID</label>
                        <input
                          type="text"
                          placeholder="e.g. GPS-TRK-1080"
                          value={formData.gps_device_id || ''}
                          onChange={(e) => setFormData({ ...formData, gps_device_id: e.target.value })}
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
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Licence Valid Until</label>
                        <input
                          type="date"
                          value={formData.license_expiry || ''}
                          onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Mobile Number</label>
                        <input
                          type="tel"
                          required
                          inputMode="tel"
                          placeholder="e.g. 9450881215"
                          value={formData.phone || ''}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all h-[36px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Years of Experience</label>
                        <input
                          type="number"
                          min={0}
                          value={formData.experience_years ?? 0}
                          onChange={(e) => setFormData({ ...formData, experience_years: parseInt(e.target.value) })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Residential Address</label>
                      <input
                        type="text"
                        placeholder="e.g. Gola Bazar, Gorakhpur"
                        value={formData.address || ''}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all h-[36px]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Assigned Bus</label>
                        <select
                          value={formData.vehicle_id || ''}
                          onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        >
                          <option value="">Not assigned yet...</option>
                          {vehicles.map(v => {
                            const held = drivers.find(d => d.vehicle_id === v.id && d.id !== editingItem?.id);
                            return (
                              <option key={v.id} value={v.id}>
                                {v.vehicle_no}{held ? ` — reassign from ${held.name}` : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="space-y-1">
                        {/* The status column existed and drove the roster badge and
                            filter, but no control ever set it. */}
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Duty Status</label>
                        <select
                          value={formData.status || 'On-Duty'}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        >
                          <option value="On-Duty">On-Duty</option>
                          <option value="On-Leave">On-Leave</option>
                        </select>
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
                        {selectableStudents.map(s => (
                          <option key={s.id} value={s.id}>{s.name} — Class {s.class}{s.section ? `-${s.section}` : ''}</option>
                        ))}
                      </select>
                      {/* One allotment per student, so those already on a bus are
                          not offered again — editing reaches them instead. */}
                      <p className="text-[10px] text-slate-400 font-medium pl-1">
                        {selectableStudents.length} of {students.length} students are not yet allotted transport.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Allotted Route</label>
                        <select
                          value={formData.route_id || ''}
                          onChange={(e) => {
                            // Picking a route puts the child on that route's bus
                            // unless the operator overrides it below.
                            const route = routes.find(r => r.id === e.target.value);
                            setFormData({ ...formData, route_id: e.target.value, vehicle_id: route?.vehicle_id || '' });
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        >
                          <option value="">Select Route...</option>
                          {routes.map(r => (
                            <option key={r.id} value={r.id}>{r.name} — ₹{r.fare_amount.toLocaleString()}/mo</option>
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
                          {vehicles.map(v => {
                            const free = v.capacity - ridersOnVehicle(v.id);
                            return (
                              <option key={v.id} value={v.id}>
                                {v.vehicle_no} — {free > 0 ? `${free} seats free` : 'full'}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                    {formData.vehicle_id && (
                      <p className="text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
                        Driver on this bus:{' '}
                        <span className="font-black text-slate-700">
                          {driverForVehicle(formData.vehicle_id)?.name || 'none assigned'}
                        </span>
                        {driverForVehicle(formData.vehicle_id)?.phone
                          ? ` · ${driverForVehicle(formData.vehicle_id)?.phone}`
                          : ''}
                        {(() => {
                          const bus = vehicles.find(v => v.id === formData.vehicle_id);
                          if (!bus) return null;
                          const free = bus.capacity - ridersOnVehicle(bus.id);
                          return free <= 0 ? (
                            <span className="block text-rose-600 mt-0.5">
                              This bus is already at capacity ({bus.capacity} seats).
                            </span>
                          ) : null;
                        })()}
                      </p>
                    )}
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
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">Afternoon Drop Time</label>
                      <input
                        type="text"
                        placeholder="e.g. 03:30 PM"
                        value={formData.drop_time || ''}
                        onChange={(e) => setFormData({ ...formData, drop_time: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all h-[36px]"
                      />
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
