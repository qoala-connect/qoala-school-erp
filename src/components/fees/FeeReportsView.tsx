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
  const [selectedSection, setSelectedSection] = useState('All');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'moderate' | 'partial'>('all');
  const [activeReportTab, setActiveReportTab] = useState<'defaulters' | 'class_summary' | 'section_summary'>('defaulters');
  const [search, setSearch] = useState('');

  // Extract unique sections dynamically
  const uniqueSections = useMemo(() => {
    const set = new Set<string>();
    fees.forEach(f => {
      if (f.students?.section) set.add(f.students.section);
    });
    return Array.from(set).sort();
  }, [fees]);

  // Filtered dataset for reports
  const filteredFees = useMemo(() => {
    return fees.filter(f => {
      const matchesClass = selectedClass === 'All' || f.students?.class === selectedClass || `Class ${f.students?.class}` === selectedClass;
      const matchesSection = selectedSection === 'All' || f.students?.section === selectedSection;
      const matchesSearch = !search.trim() || (
        (f.students?.name && f.students.name.toLowerCase().includes(search.toLowerCase())) ||
        (f.students?.admission_number && f.students.admission_number.toLowerCase().includes(search.toLowerCase())) ||
        (f.students?.father_name && f.students.father_name.toLowerCase().includes(search.toLowerCase()))
      );

      return matchesClass && matchesSection && matchesSearch;
    });
  }, [fees, selectedClass, selectedSection, search]);

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

  // Class-wise aggregation (sorted naturally: LKG -> 1 -> ... -> 12)
  const classSummary = useMemo(() => {
    const map: Record<string, { className: string; demand: number; collected: number; dues: number; count: number; defaulters: number }> = {};

    classes.forEach(c => {
      map[c.class_name] = { className: c.class_name.startsWith('Class') ? c.class_name : `Class ${c.class_name}`, demand: 0, collected: 0, dues: 0, count: 0, defaulters: 0 };
    });

    fees.forEach(f => {
      const cls = f.students?.class || 'Unknown';
      if (!map[cls]) {
        map[cls] = { className: cls.startsWith('Class') ? cls : `Class ${cls}`, demand: 0, collected: 0, dues: 0, count: 0, defaulters: 0 };
      }
      const isMatch = (selectedClass === 'All' || f.students?.class === selectedClass) &&
                      (selectedSection === 'All' || f.students?.section === selectedSection);
      if (isMatch) {
        map[cls].demand += f.total_amount;
        map[cls].collected += f.amount_paid;
        map[cls].dues += f.remaining_amount;
        map[cls].count += 1;
        if (f.remaining_amount > 0) {
          map[cls].defaulters += 1;
        }
      }
    });

    return Object.values(map)
      .filter(cs => cs.count > 0 || selectedClass === 'All')
      .sort((a, b) => {
        const aVal = a.className.toLowerCase().includes('lkg') ? 0 : parseInt(a.className.replace(/\D/g, '')) || 99;
        const bVal = b.className.toLowerCase().includes('lkg') ? 0 : parseInt(b.className.replace(/\D/g, '')) || 99;
        return aVal - bVal;
      });
  }, [fees, classes, selectedClass, selectedSection]);

  // Section-wise aggregation (e.g. Class 1-A, Class 1-B, Class 1-C, etc.)
  const sectionSummary = useMemo(() => {
    const map: Record<string, { key: string; className: string; section: string; demand: number; collected: number; dues: number; count: number; defaulters: number }> = {};

    fees.forEach(f => {
      const cls = f.students?.class || 'Unknown';
      const sec = f.students?.section || 'A';
      const isMatch = (selectedClass === 'All' || cls === selectedClass) &&
                      (selectedSection === 'All' || sec === selectedSection);
      
      if (isMatch) {
        const key = `${cls}_${sec}`;
        if (!map[key]) {
          map[key] = {
            key,
            className: cls.startsWith('Class') ? cls : `Class ${cls}`,
            section: sec,
            demand: 0,
            collected: 0,
            dues: 0,
            count: 0,
            defaulters: 0
          };
        }
        map[key].demand += f.total_amount;
        map[key].collected += f.amount_paid;
        map[key].dues += f.remaining_amount;
        map[key].count += 1;
        if (f.remaining_amount > 0) {
          map[key].defaulters += 1;
        }
      }
    });

    return Object.values(map).sort((a, b) => {
      const aVal = a.className.toLowerCase().includes('lkg') ? 0 : parseInt(a.className.replace(/\D/g, '')) || 99;
      const bVal = b.className.toLowerCase().includes('lkg') ? 0 : parseInt(b.className.replace(/\D/g, '')) || 99;
      if (aVal !== bVal) return aVal - bVal;
      return a.section.localeCompare(b.section);
    });
  }, [fees, selectedClass, selectedSection]);

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
    } else if (activeReportTab === 'class_summary') {
      const headers = ['Class', 'Students Enrolled', 'Total Demand (INR)', 'Total Collected (INR)', 'Outstanding Dues (INR)', 'Defaulter Accounts', 'Collection Rate (%)'];
      const rows = classSummary.map(cs => [
        cs.className,
        cs.count,
        cs.demand,
        cs.collected,
        cs.dues,
        cs.defaulters,
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
    } else {
      const headers = ['Class', 'Section', 'Students Enrolled', 'Total Demand (INR)', 'Total Collected (INR)', 'Outstanding Dues (INR)', 'Defaulter Accounts', 'Collection Rate (%)'];
      const rows = sectionSummary.map(ss => [
        ss.className,
        ss.section,
        ss.count,
        ss.demand,
        ss.collected,
        ss.dues,
        ss.defaulters,
        ss.demand > 0 ? `${Math.round((ss.collected / ss.demand) * 100)}%` : '0%'
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Section_Fee_Breakdown_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Exported section-wise fee breakdown report.');
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
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 block truncate">Total Demand in Scope</span>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1.5 leading-tight">₹{reportMetrics.totalDemand.toLocaleString()}</div>
          <span className="text-xs text-slate-400 font-normal mt-1 block">{filteredFees.length} fee ledgers</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-xs font-medium text-emerald-600 block truncate">Total Realized Collection</span>
          <div className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1.5 leading-tight">₹{reportMetrics.totalCollected.toLocaleString()}</div>
          <span className="text-xs text-emerald-600 font-medium mt-1 block">{reportMetrics.collectionRate}% realization rate</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-xs font-medium text-rose-600 block truncate">Outstanding Balance Dues</span>
          <div className="text-xl sm:text-2xl font-bold text-rose-700 mt-1.5 leading-tight">₹{reportMetrics.totalDues.toLocaleString()}</div>
          <span className="text-xs text-rose-600 font-medium mt-1 block">{reportMetrics.defaultersCount} pending accounts</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-xs font-medium text-violet-600 block truncate">Defaulter Rate</span>
          <div className="text-xl sm:text-2xl font-bold text-violet-700 mt-1.5 leading-tight">
            {filteredFees.length > 0 ? `${Math.round((reportMetrics.defaultersCount / filteredFees.length) * 100)}%` : '0%'}
          </div>
          <span className="text-xs text-slate-400 font-normal mt-1 block">Enrolled in scope</span>
        </div>
      </div>

      {/* 2. Controls & Tab Switcher */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveReportTab('defaulters')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeReportTab === 'defaulters'
                ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Fee Defaulters Roster ({defaulters.length})
          </button>
          <button
            onClick={() => setActiveReportTab('class_summary')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeReportTab === 'class_summary'
                ? 'bg-violet-50 text-violet-700 border border-violet-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Class-Wise Summary ({classSummary.length})
          </button>
          <button
            onClick={() => setActiveReportTab('section_summary')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeReportTab === 'section_summary'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Section-Wise Breakdown ({sectionSummary.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {activeReportTab === 'defaulters' && (
            <>
              <div className="relative flex-1 sm:w-48">
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

          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-700 outline-none cursor-pointer"
          >
            <option value="All">All Sections</option>
            {uniqueSections.map(sec => (
              <option key={sec} value={sec}>Section {sec}</option>
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
        ) : activeReportTab === 'class_summary' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-400 font-black">
                  <th className="py-2.5 px-3">Class / Grade</th>
                  <th className="py-2.5 px-3 text-center">Enrolled</th>
                  <th className="py-2.5 px-3 text-right">Total Demand (₹)</th>
                  <th className="py-2.5 px-3 text-right text-emerald-600">Total Collected (₹)</th>
                  <th className="py-2.5 px-3 text-right text-rose-600">Outstanding Balance (₹)</th>
                  <th className="py-2.5 px-3 text-center text-amber-600">Defaulters</th>
                  <th className="py-2.5 px-3 text-right">Realization Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {classSummary.map(cs => {
                  const rate = cs.demand > 0 ? Math.round((cs.collected / cs.demand) * 100) : 0;
                  return (
                    <tr key={cs.className} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900">{cs.className}</td>
                      <td className="py-3 px-3 text-center text-slate-500 font-mono font-bold">{cs.count}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">₹{cs.demand.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">₹{cs.collected.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-700">₹{cs.dues.toLocaleString()}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-amber-700">
                        {cs.defaulters > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-extrabold border border-amber-200">
                            {cs.defaulters}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold text-[11px]">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          rate >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          rate >= 50 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-rose-50 text-rose-700 border border-rose-200'
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
        ) : (
          /* Section-Wise Breakdown Table */
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-400 font-black">
                  <th className="py-2.5 px-3">Class & Section</th>
                  <th className="py-2.5 px-3 text-center">Enrolled</th>
                  <th className="py-2.5 px-3 text-right">Total Demand (₹)</th>
                  <th className="py-2.5 px-3 text-right text-emerald-600">Total Collected (₹)</th>
                  <th className="py-2.5 px-3 text-right text-rose-600">Outstanding Balance (₹)</th>
                  <th className="py-2.5 px-3 text-center text-amber-600">Defaulters</th>
                  <th className="py-2.5 px-3 text-right">Realization Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {sectionSummary.map(ss => {
                  const rate = ss.demand > 0 ? Math.round((ss.collected / ss.demand) * 100) : 0;
                  return (
                    <tr key={ss.key} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900">{ss.className}</span>
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-black border border-slate-200">
                          Sec {ss.section}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-500 font-mono font-bold">{ss.count}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">₹{ss.demand.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">₹{ss.collected.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-700">₹{ss.dues.toLocaleString()}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold">
                        {ss.defaulters > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-extrabold border border-amber-200">
                            {ss.defaulters}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold text-[11px]">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          rate >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          rate >= 50 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-rose-50 text-rose-700 border border-rose-200'
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
