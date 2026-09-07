import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Layers, Plus, Search, Filter, Download, Printer, Edit2, Trash2, 
  RefreshCw, Check, X, ShieldAlert, DollarSign, Package, ShoppingCart,
  Truck, Archive, FileText, Save, SlidersHorizontal, ArrowLeft, Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { AdminHeader } from '@/components/common/AdminHeader';
import { AdminStatCard } from '@/components/common/AdminStatCard';

interface Asset {
  id: string;
  code: string;
  name: string;
  category: 'Furniture' | 'Electronics' | 'Lab Equipment' | 'Sports' | 'Other';
  quantity: number;
  purchase_date: string;
  condition: 'Excellent' | 'Good' | 'Damaged' | 'Scrapped';
  value: number;
}

interface StockItem {
  id: string;
  code: string;
  name: string;
  quantity: number;
  reorder_level: number;
  unit_price: number;
  status: 'In-Stock' | 'Low-Stock' | 'Out-of-Stock';
}

interface Vendor {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  status: 'Active' | 'Blacklisted';
}

interface PurchaseOrder {
  id: string;
  order_code: string;
  vendor_name: string;
  item_ordered: string;
  quantity: number;
  total_price: number;
  status: 'Draft' | 'Sent' | 'Received' | 'Cancelled';
  delivery_date?: string;
}

type TabType = 'assets' | 'stock' | 'vendors' | 'orders';

const RECORD_LABEL: Record<TabType, string> = {
  assets: 'Fixed Asset',
  stock: 'Stock Item',
  vendors: 'Vendor',
  orders: 'Purchase Order'
};

export default function InventoryManagement() {
  const location = useLocation();
  const requestedTab = (location.state as any)?.activeTab as TabType | undefined;
  const [activeTab, setActiveTab] = useState<TabType>(requestedTab || 'assets');

  useEffect(() => {
    if (requestedTab && ['assets', 'stock', 'vendors', 'orders'].includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  // States
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

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
      const [assetsRes, invRes, vendorsRes, ordersRes] = await Promise.all([
        supabase.from('assets').select('*').order('asset_name'),
        supabase.from('inventory').select('*').order('item_name'),
        supabase.from('vendors').select('*').order('vendor_name'),
        supabase.from('purchase_orders').select('*').order('order_code')
      ]);

      const firstError = [assetsRes, invRes, vendorsRes, ordersRes].find(r => r.error)?.error;
      if (firstError) throw firstError;

      if (assetsRes.data) {
        setAssets(assetsRes.data.map((a: any) => ({
          id: a.id,
          code: a.asset_tag || 'AST-001',
          name: a.asset_name || 'Campus Asset',
          category: (a.category as any) || 'Furniture',
          quantity: Number(a.quantity ?? 1),
          purchase_date: a.purchase_date || new Date().toISOString().substring(0, 10),
          condition: (a.condition as any) || 'Good',
          value: Number(a.purchase_cost || 0)
        })));
      }

      if (invRes.data) {
        setStock(invRes.data.map((i: any) => {
          // The register tracks what is on hand, not what was ever bought:
          // quantity_available is the figure the storekeeper reorders against.
          const available = Number(i.quantity_available ?? i.quantity_total ?? 0);
          const reorder = Number(i.min_quantity ?? 0);
          return {
            id: i.id,
            code: i.item_code || `STK-${String(i.id).substring(0, 6).toUpperCase()}`,
            name: i.item_name || 'Stock Item',
            quantity: available,
            reorder_level: reorder,
            unit_price: Number(i.unit_price || 0),
            status: available <= 0 ? 'Out-of-Stock' : available <= reorder ? 'Low-Stock' : 'In-Stock'
          };
        }));
      }

      if (vendorsRes.data) {
        setVendors(vendorsRes.data.map((v: any) => ({
          id: v.id,
          name: v.vendor_name || 'Supplier',
          contact_person: v.contact_person || '--',
          phone: v.phone || '--',
          email: v.email || '--',
          address: v.address || '--',
          status: (v.status as any) || 'Active'
        })));
      }

      if (ordersRes.data) {
        setOrders(ordersRes.data.map((o: any) => ({
          id: o.id,
          order_code: o.order_code,
          vendor_name: o.vendor_name || 'Unassigned Vendor',
          item_ordered: o.item_ordered || '--',
          quantity: Number(o.quantity || 0),
          total_price: Number(o.total_price || 0),
          status: (o.status as any) || 'Draft',
          delivery_date: o.delivery_date || undefined
        })));
      }

    } catch (error: any) {
      console.error('Error fetching inventory tables:', error);
      setErrorState(error.message || 'Failed to load inventory records');
      toast.error('Unable to load inventory data from database.');
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
      if (activeTab === 'assets') {
        const payload: any = {
          asset_name: formData.name,
          asset_tag: formData.code,
          category: formData.category || 'Furniture',
          purchase_date: formData.purchase_date || new Date().toISOString().substring(0, 10),
          purchase_cost: Number(formData.value || 0),
          quantity: Number(formData.quantity || 1),
          condition: formData.condition || 'Good',
          // assets.status vocabulary is operational | under maintenance | damaged | written off.
          status: 'operational'
        };

        if (editingItem) {
          const { error } = await supabase.from('assets').update(payload).eq('id', editingItem.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('assets').insert([payload]);
          if (error) throw error;
        }
      } else if (activeTab === 'stock') {
        const onHand = Number(formData.quantity || 0);
        const reorder = Number(formData.reorder_level || 0);
        const payload: any = {
          item_code: formData.code || null,
          item_name: formData.name,
          quantity_total: onHand,
          quantity_available: onHand,
          min_quantity: reorder,
          unit_price: Number(formData.unit_price || 0),
          // inventory.status uses a spaced vocabulary; the table's own badge
          // vocabulary is hyphenated, so the two must not be interchanged.
          status: onHand <= 0 ? 'Out of Stock' : onHand <= reorder ? 'Low Stock' : 'In Stock'
        };

        if (editingItem) {
          const { error } = await supabase.from('inventory').update(payload).eq('id', editingItem.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('inventory').insert([payload]);
          if (error) throw error;
        }
      } else if (activeTab === 'vendors') {
        const payload: any = {
          vendor_name: formData.name,
          contact_person: formData.contact_person || null,
          phone: formData.phone || null,
          email: formData.email || null,
          address: formData.address || null,
          status: formData.status || 'Active'
        };

        if (editingItem) {
          const { error } = await supabase.from('vendors').update(payload).eq('id', editingItem.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('vendors').insert([payload]);
          if (error) throw error;
        }
      } else if (activeTab === 'orders') {
        const vendorName = formData.vendor_name || vendors[0]?.name || '';
        const payload: any = {
          order_code: formData.order_code,
          // vendor_id links the PO to the directory; vendor_name is stored
          // alongside it so a delisted supplier is still named on the order.
          vendor_id: vendors.find(v => v.name === vendorName)?.id || null,
          vendor_name: vendorName,
          item_ordered: formData.item_ordered,
          quantity: Number(formData.quantity || 1),
          total_price: Number(formData.total_price || 0),
          status: formData.status || 'Draft',
          delivery_date: formData.delivery_date || null
        };

        if (editingItem) {
          const { error } = await supabase.from('purchase_orders').update(payload).eq('id', editingItem.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('purchase_orders').insert([payload]);
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
      const table =
        activeTab === 'assets'  ? 'assets' :
        activeTab === 'stock'   ? 'inventory' :
        activeTab === 'vendors' ? 'vendors' : 'purchase_orders';
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
    if (activeTab === 'assets') {
      csvContent += "ID,Code,Asset Name,Category,Quantity,Purchase Date,Condition,Estimated Value (INR)\n";
      const records = assets.filter(a => selectedItems.includes(a.id));
      records.forEach(r => {
        csvContent += `"${r.id}","${r.code}","${r.name}","${r.category}",${r.quantity},"${r.purchase_date}","${r.condition}",${r.value}\n`;
      });
    } else if (activeTab === 'stock') {
      csvContent += "ID,Code,Item Name,Stock Qty,Reorder Qty,Unit Price,Status\n";
      const records = stock.filter(s => selectedItems.includes(s.id));
      records.forEach(r => {
        csvContent += `"${r.id}","${r.code}","${r.name}",${r.quantity},${r.reorder_level},${r.unit_price},"${r.status}"\n`;
      });
    } else if (activeTab === 'vendors') {
      csvContent += "ID,Vendor Name,Contact Person,Phone,Email,Address,Status\n";
      const records = vendors.filter(v => selectedItems.includes(v.id));
      records.forEach(r => {
        csvContent += `"${r.id}","${r.name}","${r.contact_person}","${r.phone}","${r.email}","${r.address}","${r.status}"\n`;
      });
    } else if (activeTab === 'orders') {
      csvContent += "ID,Order Code,Vendor Name,Items,Quantity,Total Cost,Status,Delivered Date\n";
      const records = orders.filter(o => selectedItems.includes(o.id));
      records.forEach(r => {
        csvContent += `"${r.id}","${r.order_code}","${r.vendor_name}","${r.item_ordered}",${r.quantity},${r.total_price},"${r.status}","${r.delivery_date || ''}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ST_JOSEPHS_INVENTORY_${activeTab.toUpperCase()}_EXPORT.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${selectedItems.length} records to Excel CSV!`);
  };

  const handlePrint = () => {
    window.print();
  };

  // Filters
  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            a.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || a.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [assets, searchQuery, categoryFilter]);

  const filteredStock = useMemo(() => {
    return stock.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            s.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || s.status === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [stock, searchQuery, categoryFilter]);

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            v.contact_person.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || v.status === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [vendors, searchQuery, categoryFilter]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchesSearch = o.order_code.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            o.vendor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            o.item_ordered.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || o.status === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [orders, searchQuery, categoryFilter]);

  const toggleSelectAll = () => {
    let currentIds: string[] = [];
    if (activeTab === 'assets') currentIds = filteredAssets.map(a => a.id);
    else if (activeTab === 'stock') currentIds = filteredStock.map(s => s.id);
    else if (activeTab === 'vendors') currentIds = filteredVendors.map(v => v.id);
    else if (activeTab === 'orders') currentIds = filteredOrders.map(o => o.id);

    if (selectedItems.length === currentIds.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(currentIds);
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  // Mirrors what the module actually reads and writes. It used to print a
  // set of inventory_* tables that exist nowhere in the database, so anyone
  // who ran it got four empty tables the page never touches.
  const generateSQL = () => {
    return `-- ==========================================================
-- ST. JOSEPH'S SCHOOL, BARHALGANJ - INVENTORY SCHEMA
-- Tables this module reads and writes.
-- Applied by supabase_inventory_module_34.sql
-- ==========================================================

-- Fixed assets registry
CREATE TABLE IF NOT EXISTS public.assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_name    varchar NOT NULL,
  asset_tag     varchar UNIQUE,
  category      varchar,
  quantity      integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  condition     text NOT NULL DEFAULT 'Good',
  status        varchar DEFAULT 'operational'
                CHECK (status IN ('operational','under maintenance','damaged','written off')),
  purchase_date date,
  purchase_cost numeric(12,2) DEFAULT 0.00,
  location      varchar,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Consumable stock register
CREATE TABLE IF NOT EXISTS public.inventory (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code          varchar(40) UNIQUE,
  item_name          varchar NOT NULL UNIQUE,
  item_category      varchar,
  quantity_total     integer DEFAULT 0 CHECK (quantity_total >= 0),
  quantity_available integer DEFAULT 0,
  min_quantity       integer NOT NULL DEFAULT 0,
  unit_price         numeric DEFAULT 0.00,
  status             text NOT NULL DEFAULT 'In Stock',
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  CHECK (quantity_available >= 0 AND quantity_available <= quantity_total)
);

-- Approved suppliers
CREATE TABLE IF NOT EXISTS public.vendors (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name    varchar(160) NOT NULL UNIQUE,
  contact_person varchar(120),
  phone          varchar(40),
  email          varchar(160),
  address        text,
  status         text NOT NULL DEFAULT 'Active'
                 CHECK (status IN ('Active','Blacklisted')),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- Purchase orders raised against those suppliers
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code    varchar(40) NOT NULL UNIQUE,
  vendor_id     uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name   varchar(160) NOT NULL,
  item_ordered  text NOT NULL,
  quantity      integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  total_price   numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (total_price >= 0),
  status        text NOT NULL DEFAULT 'Draft'
                CHECK (status IN ('Draft','Sent','Received','Cancelled')),
  delivery_date date,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- All four are gated on: is_admin() OR auth_has_permission('inventory.manage')`;
  };

  const netAssetValue = useMemo(() => {
    return assets.reduce((sum, item) => sum + item.value, 0);
  }, [assets]);

  // Consumables are valued at what is still on the shelf, not what was bought.
  const stockOnHandValue = useMemo(() => {
    return stock.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  }, [stock]);

  const openOrdersValue = useMemo(() => {
    return orders
      .filter(o => o.status === 'Draft' || o.status === 'Sent')
      .reduce((sum, o) => sum + o.total_price, 0);
  }, [orders]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16 text-slate-700 font-sans antialiased">
{/* 1. Header Toolbar */}
      <AdminHeader
        title="Assets, Equipment & Inventory"
        subtitle="Supervise school physical assets, laboratory equipment, sports gear, consumable stationery items, vendors directories, and purchase orders."
        badge={{
          icon: Package,
          text: 'Inventory Logistics',
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
              <Plus className="w-4 h-4" /> Add Record
            </button>
          </>
        }
      />

      {/* 2. Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AdminStatCard
          label="Total Asset Valuation"
          value={`₹${netAssetValue.toLocaleString('en-IN')}`}
          subtext={`${assets.length} tagged assets - stock on hand Rs.${Math.round(stockOnHandValue).toLocaleString('en-IN')}`}
          icon={Package}
          variant="emerald"
        />
        <AdminStatCard
          label="Low-Stock Alerts"
          value={stock.filter(s => s.status !== 'In-Stock').length}
          subtext="Items needing reorder"
          icon={ShieldAlert}
          variant="rose"
        />
        <AdminStatCard
          label="Active Vendors"
          value={vendors.filter(v => v.status === 'Active').length}
          subtext={`${vendors.length} in supplier directory`}
          icon={Truck}
          variant="primary"
        />
        <AdminStatCard
          label="Pending Orders"
          value={orders.filter(o => o.status === 'Sent' || o.status === 'Draft').length}
          subtext={`Rs.${Math.round(openOrdersValue).toLocaleString('en-IN')} committed`}
          icon={ShoppingCart}
          variant="violet"
        />
      </div>

      {/* 3. Segmented Navigation Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 shadow-2xs overflow-x-auto">
        <nav className="flex items-center gap-1 min-w-max" aria-label="Inventory Navigation Sections">
          {[
            { id: 'assets', label: 'Fixed Assets', icon: Package },
            { id: 'stock', label: 'Consumable Stock', icon: Archive },
            { id: 'vendors', label: 'Vendors Directory', icon: Truck },
            { id: 'orders', label: 'Purchase Orders', icon: ShoppingCart }
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as TabType); setSelectedItems([]); setCategoryFilter('all'); }}
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
            placeholder="Search codes, items, supplier details..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold outline-none focus:border-slate-800"
          />
        </div>

        <div>
          {activeTab === 'assets' && (
            <select 
              value={categoryFilter} 
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="all">All Asset Categories</option>
              <option value="Furniture">Furniture</option>
              <option value="Electronics">Electronics</option>
              <option value="Lab Equipment">Lab Equipment</option>
              <option value="Sports">Sports Equipment</option>
              <option value="Other">Other Assets</option>
            </select>
          )}

          {activeTab === 'stock' && (
            <select 
              value={categoryFilter} 
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="all">All Stock Status</option>
              <option value="In-Stock">In-Stock</option>
              <option value="Low-Stock">Low-Stock Alert</option>
              <option value="Out-of-Stock">Out-of-Stock</option>
            </select>
          )}

          {activeTab === 'vendors' && (
            <select 
              value={categoryFilter} 
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="all">All Suppliers Status</option>
              <option value="Active">Active Partners</option>
              <option value="Blacklisted">Blacklisted</option>
            </select>
          )}

          {activeTab === 'orders' && (
            <select 
              value={categoryFilter} 
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="all">All Purchase Orders</option>
              <option value="Draft">Draft POs</option>
              <option value="Sent">Sent (Pending Delivery)</option>
              <option value="Received">Delivered / Completed</option>
              <option value="Cancelled">Cancelled PO</option>
            </select>
          )}
        </div>

        <div className="flex justify-end gap-2 shrink-0">
          <button 
            onClick={handlePrint}
            className="px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Print Inventory
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
                      activeTab === 'assets' ? (selectedItems.length === filteredAssets.length && filteredAssets.length > 0) :
                      activeTab === 'stock' ? (selectedItems.length === filteredStock.length && filteredStock.length > 0) :
                      activeTab === 'vendors' ? (selectedItems.length === filteredVendors.length && filteredVendors.length > 0) :
                      (selectedItems.length === filteredOrders.length && filteredOrders.length > 0)
                    }
                    className="cursor-pointer"
                  />
                </th>
                {activeTab === 'assets' && (
                  <>
                    <th className="py-3.5 px-4">Asset Code & Name</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Quantity</th>
                    <th className="py-3.5 px-4">Condition</th>
                    <th className="py-3.5 px-4">Purchase Date</th>
                    <th className="py-3.5 px-4">Estimated Value</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </>
                )}
                {activeTab === 'stock' && (
                  <>
                    <th className="py-3.5 px-4">Item Code & Name</th>
                    <th className="py-3.5 px-4">Stock Qty Available</th>
                    <th className="py-3.5 px-4">Reorder Level</th>
                    <th className="py-3.5 px-4">Unit Price</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </>
                )}
                {activeTab === 'vendors' && (
                  <>
                    <th className="py-3.5 px-4">Supplier / Vendor</th>
                    <th className="py-3.5 px-4">Contact Person</th>
                    <th className="py-3.5 px-4">Phone Number</th>
                    <th className="py-3.5 px-4">Email</th>
                    <th className="py-3.5 px-4">Office Address</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </>
                )}
                {activeTab === 'orders' && (
                  <>
                    <th className="py-3.5 px-4">PO Code</th>
                    <th className="py-3.5 px-4">Vendor Partner</th>
                    <th className="py-3.5 px-4">Item ordered details</th>
                    <th className="py-3.5 px-4">Qty</th>
                    <th className="py-3.5 px-4">Total Cost</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Delivery Date</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {/* 1. ASSETS TAB */}
              {activeTab === 'assets' && (
                filteredAssets.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-slate-400 text-xs">No assets matching criteria.</td></tr>
                ) : (
                  filteredAssets.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 text-center">
                        <input type="checkbox" checked={selectedItems.includes(a.id)} onChange={() => toggleSelectItem(a.id)} className="cursor-pointer" />
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-black text-slate-950 uppercase">{a.name}</p>
                        <p className="text-[10px] font-mono text-slate-400">{a.code}</p>
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-600">{a.category}</td>
                      <td className="py-4 px-4 font-extrabold text-slate-800">{a.quantity} units</td>
                      <td className="py-4 px-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                          a.condition === 'Excellent' ? 'bg-emerald-50 text-emerald-600' :
                          a.condition === 'Good' ? 'bg-blue-50 text-blue-600' :
                          a.condition === 'Damaged' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                        )}>{a.condition}</span>
                      </td>
                      <td className="py-4 px-4 text-slate-500">{a.purchase_date}</td>
                      <td className="py-4 px-4 font-mono font-black text-slate-900">₹{a.value.toLocaleString('en-IN')}</td>
                      <td className="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button onClick={() => handleEdit(a)} className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(a.id)} className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))
                )
              )}

              {/* 2. STOCK TAB */}
              {activeTab === 'stock' && (
                filteredStock.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400 text-xs">No consumable items registered.</td></tr>
                ) : (
                  filteredStock.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 text-center">
                        <input type="checkbox" checked={selectedItems.includes(s.id)} onChange={() => toggleSelectItem(s.id)} className="cursor-pointer" />
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-black text-slate-950 uppercase">{s.name}</p>
                        <p className="text-[10px] font-mono text-slate-400">{s.code}</p>
                      </td>
                      <td className="py-4 px-4 font-black text-slate-800">{s.quantity} units</td>
                      <td className="py-4 px-4 font-bold text-slate-500">{s.reorder_level} Min</td>
                      <td className="py-4 px-4 font-mono font-bold">₹{s.unit_price}</td>
                      <td className="py-4 px-4">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border",
                          s.status === 'In-Stock' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          s.status === 'Low-Stock' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100'
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

              {/* 3. VENDORS TAB */}
              {activeTab === 'vendors' && (
                filteredVendors.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-slate-400 text-xs">No suppliers matching criteria.</td></tr>
                ) : (
                  filteredVendors.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 text-center">
                        <input type="checkbox" checked={selectedItems.includes(v.id)} onChange={() => toggleSelectItem(v.id)} className="cursor-pointer" />
                      </td>
                      <td className="py-4 px-4 font-black text-slate-955 uppercase">{v.name}</td>
                      <td className="py-4 px-4 font-bold text-slate-600">{v.contact_person}</td>
                      <td className="py-4 px-4 font-mono font-bold">{v.phone}</td>
                      <td className="py-4 px-4 text-slate-500">{v.email}</td>
                      <td className="py-4 px-4 text-slate-400 font-medium">{v.address}</td>
                      <td className="py-4 px-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                          v.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                        )}>{v.status}</span>
                      </td>
                      <td className="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button onClick={() => handleEdit(v)} className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(v.id)} className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))
                )
              )}

              {/* 4. PURCHASE ORDERS TAB */}
              {activeTab === 'orders' && (
                filteredOrders.length === 0 ? (
                  <tr><td colSpan={9} className="py-8 text-center text-slate-400 text-xs">No PO records registered.</td></tr>
                ) : (
                  filteredOrders.map(o => (
                    <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 text-center">
                        <input type="checkbox" checked={selectedItems.includes(o.id)} onChange={() => toggleSelectItem(o.id)} className="cursor-pointer" />
                      </td>
                      <td className="py-4 px-4 font-mono font-black text-indigo-600">{o.order_code}</td>
                      <td className="py-4 px-4 font-black text-slate-800 uppercase">{o.vendor_name}</td>
                      <td className="py-4 px-4 text-slate-600 font-medium">{o.item_ordered}</td>
                      <td className="py-4 px-4 font-extrabold">{o.quantity} units</td>
                      <td className="py-4 px-4 font-mono font-black text-slate-900">₹{o.total_price.toLocaleString('en-IN')}</td>
                      <td className="py-4 px-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                          o.status === 'Draft' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                          o.status === 'Sent' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                          o.status === 'Received' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600'
                        )}>{o.status}</span>
                      </td>
                      <td className="py-4 px-4 text-slate-400 font-bold">{o.delivery_date || '--'}</td>
                      <td className="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button onClick={() => handleEdit(o)} className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(o.id)} className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
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
                  <h3 className="font-display font-black uppercase text-sm">PostgreSQL Inventory Migration Schema</h3>
                </div>
                <button onClick={() => setShowMigrationSql(false)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Apply this additive database schema structure into your Supabase SQL editor to enable native persistence across all stock metrics:
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
                  {editingItem ? `Edit ${RECORD_LABEL[activeTab]}` : `Add New ${RECORD_LABEL[activeTab]}`}
                </h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
              
              <form onSubmit={handleSave} className="p-5 space-y-4">
                {/* 1. ASSETS FORM */}
                {activeTab === 'assets' && (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Asset Code</label>
                        <input required type="text" value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} placeholder="e.g. AST-FUR-11" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-800" />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className="text-[10px] font-black uppercase text-slate-400">Asset Name</label>
                        <input required type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Smart Projector" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Category</label>
                        <select required value={formData.category || 'Furniture'} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none">
                          <option value="Furniture">Furniture</option>
                          <option value="Electronics">Electronics</option>
                          <option value="Lab Equipment">Lab Equipment</option>
                          <option value="Sports">Sports Equipment</option>
                          <option value="Other">Other Assets</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Quantity Count</label>
                        <input required type="number" value={formData.quantity || ''} onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} placeholder="e.g. 10" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Condition Status</label>
                        <select required value={formData.condition || 'Good'} onChange={e => setFormData({...formData, condition: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none">
                          <option value="Excellent">Excellent</option>
                          <option value="Good">Good</option>
                          <option value="Damaged">Damaged / Repair needed</option>
                          <option value="Scrapped">Scrapped / Dead</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Estimated Valuation (₹)</label>
                        <input required type="number" value={formData.value || ''} onChange={e => setFormData({...formData, value: Number(e.target.value)})} placeholder="e.g. 55000" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Purchase Date</label>
                      <input required type="date" value={formData.purchase_date || ''} onChange={e => setFormData({...formData, purchase_date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none" />
                    </div>
                  </div>
                )}

                {/* 2. STOCK FORM */}
                {activeTab === 'stock' && (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Item Code</label>
                        <input required type="text" value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} placeholder="STK-WCH-01" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none" />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className="text-[10px] font-black uppercase text-slate-400">Item Name</label>
                        <input required type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Attendance Registers" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Stock Available</label>
                        <input required type="number" value={formData.quantity || 0} onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Reorder Level</label>
                        <input required type="number" value={formData.reorder_level || 10} onChange={e => setFormData({...formData, reorder_level: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Unit Price (₹)</label>
                        <input required type="number" value={formData.unit_price || ''} onChange={e => setFormData({...formData, unit_price: Number(e.target.value)})} placeholder="150" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800" />
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. VENDORS FORM */}
                {activeTab === 'vendors' && (
                  <div className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Supplier Enterprise Name</label>
                      <input required type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Vardhan Furnitures" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Contact Person</label>
                        <input required type="text" value={formData.contact_person || ''} onChange={e => setFormData({...formData, contact_person: e.target.value})} placeholder="Shri Manoj Vardhan" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Contact Mobile</label>
                        <input required type="text" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+91 98391 xxxxx" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Official Email</label>
                        <input required type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="sales@vardhan.com" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Status</label>
                        <select required value={formData.status || 'Active'} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-700">
                          <option value="Active">Approved Vendor</option>
                          <option value="Blacklisted">Blacklisted</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Address Location</label>
                      <input required type="text" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="e.g. Golghar, Gorakhpur" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800" />
                    </div>
                  </div>
                )}

                {/* 4. PURCHASE ORDERS FORM */}
                {activeTab === 'orders' && (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">PO Code</label>
                        <input required type="text" value={formData.order_code || ''} onChange={e => setFormData({...formData, order_code: e.target.value})} placeholder="PO-2026-025" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Vendor Partner</label>
                        <select required value={formData.vendor_name || vendors[0]?.name || ''} onChange={e => setFormData({...formData, vendor_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-700">
                          {vendors.map(v => (
                            <option key={v.id} value={v.name}>{v.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Items Ordered Details</label>
                      <input required type="text" value={formData.item_ordered || ''} onChange={e => setFormData({...formData, item_ordered: e.target.value})} placeholder="e.g. Compound Microscope, Slides" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Total Quantity</label>
                        <input required type="number" value={formData.quantity || ''} onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} placeholder="e.g. 50" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Total Cost (₹)</label>
                        <input required type="number" value={formData.total_price || ''} onChange={e => setFormData({...formData, total_price: Number(e.target.value)})} placeholder="e.g. 45000" className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">PO Status</label>
                        <select required value={formData.status || 'Draft'} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-700">
                          <option value="Draft">Draft PO</option>
                          <option value="Sent">Sent to Vendor</option>
                          <option value="Received">Goods Received</option>
                          <option value="Cancelled">Cancelled PO</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Delivery Date (If completed)</label>
                      <input type="date" value={formData.delivery_date || ''} onChange={e => setFormData({...formData, delivery_date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-800" />
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
