import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, Download, Filter, Search, 
  AlertCircle, CheckCircle2, TrendingUp, Users, Phone,
  MessageSquare, Smartphone, Send, ArrowUpRight
} from 'lucide-react';
import { toast } from 'sonner';
import { StudentFeeLedger } from '@/types/fee';

interface FeeReportsViewProps {
  fees: StudentFeeLedger[];
  classes: { id: string; class_name: string }[];
  onOpenCollectModal?: (ledger: StudentFeeLedger) => void;
}

export default function FeeReportsView({
  fees,
  classes,
  onOpenCollectModal
}: FeeReportsViewProps) {
  const [selectedClass, setSelectedClass] = useState('All');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'moderate' | 'partial'>('all');
  const [activeReportTab, setActiveReportTab] = useState<'defaulters' | 'class_summary'>('defaulters');
  const [search, setSearch] = useState('');

  // Filtered dataset for reports
  const filteredFees = useMemo(() => {
    return fees.filter(f => {
      const matchesClass = selectedClass === 'All' || f.students?.class === selectedClass || `Class ${f.students?.class}` === selectedClass;
      const matchesSearch = !search.trim() || (
        (f.students?.name && f.students.name.toLowerCase().includes(search.toLowerCase())) ||
        (f.students?.admission_number && f.students.admission_number.toLowerCase().includes(search.toLowerCase())) ||
        (f.students?.father_name && f.students.father_name.toLowerCase().includes(search.toLowerCase()))
      );

      return matchesClass && matchesSearch;
    });
  }, [fees, selectedClass, search]);

  // Defaulters List (Students with remaining > 0)
  const defaulters = useMemo(() => {
    return filteredFees
      .filter(f => f.remaining_amount > 0)
      .filter(f => {
        if (severityFilter === 'critical') return f.remaining_amount >= 5000;
        if (severityFilter === 'moderate') return f.remaining_amount < 5000 && f.remaining_amount >= 1000;
        if (severityFilter === 'partial') return f.amount_paid > 0 && f.remaining_amount > 0;
        return true;
      });
  }, [filteredFees, severityFilter]);

  // Class-wise aggregation
  const classSummary = useMemo(() => {
    const map: Record<string, { className: string; demand: number; collected: number; dues: number; count: number }> = {};

    classes.forEach(c => {
      map[c.class_name] = { className: `Class ${c.class_name}`, demand: 0, collected: 0, dues: 0, count: 0 };
    });

    fees.forEach(f => {
      const cls = f.students?.class || 'Unknown';
      if (!map[cls]) {
        map[cls] = { className: `Class ${cls}`, demand: 0, collected: 0, dues: 0, count: 0 };
      }
      map[cls].demand += f.total_amount;
      map[cls].collected += f.amount_paid;
      map[cls].dues += f.remaining_amount;
      map[cls].count += 1;
    });

    return Object.values(map);
  }, [fees, classes]);

  // Overall report metrics
  const reportMetrics = useMemo(() => {
    const totalDemand = filteredFees.reduce((acc, f) => acc + f.total_amount, 0);
    const totalCollected = filteredFees.reduce((acc, f) => acc + f.amount_paid, 0);
    const totalDues = filteredFees.reduce((acc, f) => acc + f.remaining_amount, 0);
    const collectionRate = totalDemand > 0 ? Math.round((totalCollected / totalDemand) * 100) : 0;
    return { totalDemand, totalCollected, totalDues, collectionRate, defaultersCount: defaulters.length };
  }, [filteredFees, defaulters]);

  const handleExportCSV = () => {
    if (activeReportTab === 'defaulters') {
      if (defaulters.length === 0) return toast.error('No defaulter records to export.');

      const headers = ['Admission No', 'Student Name', 'Class', 'Section', 'Father Name', 'Phone', 'Fee Head', 'Total Demand', 'Paid', 'Outstanding Due', 'Due Date'];
      const rows = defaulters.map(d => [
        d.students?.admission_number || '',
        d.students?.name || '',
        d.students?.class || '',
        d.students?.section || '',
        d.students?.father_name || '',
        d.students?.phone || '',
        d.category_name,
        d.total_amount,
        d.amount_paid,
        d.remaining_amount,
        d.due_date || ''
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Fee_Defaulters_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Exported ${defaulters.length} fee defaulter records.`);
    } else {
      const headers = ['Class', 'Total Demand (INR)', 'Total Collected (INR)', 'Outstanding Dues (INR)', 'Collection Rate (%)'];
      const rows = classSummary.map(cs => [
        cs.className,
        cs.demand,
        cs.collected,
        cs.dues,
        cs.demand > 0 ? `${Math.round((cs.collected / cs.demand) * 100)}%` : '0%'
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Class_Fee_Summary_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Exported class-wise fee collection summary.');
    }
  };

  const handleSendWhatsAppReminder = (d: StudentFeeLedger) => {
    const phone = d.students?.phone?.replace(/\D/g, '');
    if (!phone) {
      toast.error('Parent contact number is not registered for this student.');
      return;
    }
    const studentName = d.students?.name || 'Student';
    const amountDue = d.remaining_amount.toFixed(2);
    const feeHead = d.category_name || 'Academic Fee';
    const msg = encodeURIComponent(
      `Dear Parent, This is a gentle reminder from SDPS School regarding the outstanding fee of Rs. ${amountDue} for ${studentName} (Class ${d.students?.class || ''}-${d.students?.section || ''}, Fee Head: ${feeHead}). Kindly clear the pending balance at your earliest convenience. Thank you.`
    );
    const waUrl = `https://wa.me/91${phone.length === 10 ? phone : phone.slice(-10)}?text=${msg}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="space-y-5">
      
      {/* 1. Report KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Demand in Scope</span>
          <div className="text-xl font-display font-black text-slate-800 mt-1">₹{reportMetrics.totalDemand.toLocaleString()}</div>
          <span className="text-[10px] text-slate-400 font-medium">{filteredFees.length} fee ledgers</span>
        </div>

        <div className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 block">Total Realized Collection</span>
          <div className="text-xl font-display font-black text-emerald-700 mt-1">₹{reportMetrics.totalCollected.toLocaleString()}</div>
          <span className="text-[10px] text-emerald-600 font-bold">{reportMetrics.collectionRate}% realization rate</span>
        </div>

        <div className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block">Outstanding Balance Dues</span>
          <div className="text-xl font-display font-black text-rose-700 mt-1">₹{reportMetrics.totalDues.toLocaleString()}</div>
          <span className="text-[10px] text-rose-600 font-bold">{reportMetrics.defaultersCount} pending accounts</span>
        </div>

        <div className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-violet-500 block">Defaulter Rate</span>
          <div className="text-xl font-display font-black text-violet-700 mt-1">
            {filteredFees.length > 0 ? `${Math.round((reportMetrics.defaultersCount / filteredFees.length) * 100)}%` : '0%'}
          </div>
          <span className="text-[10px] text-violet-600 font-medium">Of enrolled students in scope</span>
        </div>
      </div>

      {/* 2. Controls & Tab Switcher */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveReportTab('defaulters')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeReportTab === 'defaulters'
                ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Fee Defaulters Roster ({defaulters.length})
          </button>
          <button
            onClick={() => setActiveReportTab('class_summary')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeReportTab === 'class_summary'
                ? 'bg-violet-50 text-violet-700 border border-violet-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Class-Wise Collection Summary
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {activeReportTab === 'defaulters' && (
            <>
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search defaulter name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 pl-8 pr-3 text-xs outline-none focus:ring-1 focus:ring-violet-500 text-slate-800"
                />
              </div>

              <select
                value={severityFilter}
                onChange={(e: any) => setSeverityFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">All Dues Amounts</option>
                <option value="critical">Critical Dues (&gt; ₹5,000)</option>
                <option value="moderate">Moderate Dues (₹1k - ₹5k)</option>
                <option value="partial">Partially Paid Ledgers</option>
              </select>
            </>
          )}

          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-700 outline-none cursor-pointer"
          >
            <option value="All">All Classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.class_name}>Class {c.class_name}</option>
            ))}
          </select>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* 3. Table Views */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs">
        {activeReportTab === 'defaulters' ? (
          defaulters.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
              <h4 className="text-xs font-bold text-slate-800">No outstanding fee dues!</h4>
              <p className="text-[11px] text-slate-400">All student accounts in this criteria are fully cleared.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-400 font-black">
                    <th className="py-2.5 px-3">Student Details</th>
                    <th className="py-2.5 px-3">Class & Section</th>
                    <th className="py-2.5 px-3">Parent / Contact</th>
                    <th className="py-2.5 px-3">Fee Head</th>
                    <th className="py-2.5 px-3 text-right">Total Demand</th>
                    <th className="py-2.5 px-3 text-right">Amount Paid</th>
                    <th className="py-2.5 px-3 text-right text-rose-600 font-extrabold">Outstanding Due</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {defaulters.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{d.students?.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">ADM: {d.students?.admission_number || 'N/A'}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-800">Class {d.students?.class} - {d.students?.section}</span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-800 font-bold">{d.students?.father_name || 'N/A'}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Phone className="w-2.5 h-2.5 text-slate-400" /> {d.students?.phone || 'N/A'}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-700">{d.category_name}</span>
                        <div className="text-[10px] text-slate-400">Due: {d.due_date || 'N/A'}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">₹{d.total_amount.toFixed(2)}</td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-700 font-bold">₹{d.amount_paid.toFixed(2)}</td>
                      <td className="py-3 px-3 text-right font-mono text-rose-700 font-extrabold text-sm">
                        ₹{d.remaining_amount.toFixed(2)}
                        {d.remaining_amount >= 5000 && (
                          <span className="block text-[9px] font-black uppercase text-rose-600 bg-rose-50 px-1 py-0.2 rounded mt-0.5">CRITICAL</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {d.students?.phone && (
                            <button
                              onClick={() => handleSendWhatsAppReminder(d)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                              title="Send WhatsApp Payment Reminder"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onOpenCollectModal && d.students && (
                            <button
                              onClick={() => onOpenCollectModal(d)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                            >
                              Pay Dues
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-400 font-black">
                  <th className="py-2.5 px-3">Class / Grade</th>
                  <th className="py-2.5 px-3 text-right">Total Demand (₹)</th>
                  <th className="py-2.5 px-3 text-right text-emerald-600">Total Collected (₹)</th>
                  <th className="py-2.5 px-3 text-right text-rose-600">Outstanding Balance (₹)</th>
                  <th className="py-2.5 px-3 text-right">Realization Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {classSummary.map(cs => {
                  const rate = cs.demand > 0 ? Math.round((cs.collected / cs.demand) * 100) : 0;
                  return (
                    <tr key={cs.className} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900">{cs.className}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">₹{cs.demand.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">₹{cs.collected.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-700">₹{cs.dues.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          rate >= 80 ? 'bg-emerald-50 text-emerald-700' :
                          rate >= 50 ? 'bg-amber-50 text-amber-700' :
                          'bg-rose-50 text-rose-700'
                        }`}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
