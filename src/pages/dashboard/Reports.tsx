import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  FileBox,
  BarChart3,
  Download,
  ChevronRight,
  FileText,
  Users,
  Wallet,
  GraduationCap,
  Calendar,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { AdminHeader } from '@/components/common/AdminHeader';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------

/** Flattens one level of joined-relation objects (e.g. `students: {name, class}`
 *  becomes `students_name`, `students_class`) so nested Supabase selects turn
 *  into sane CSV columns instead of "[object Object]". */
function flattenRow(row: Record<string, any>): Record<string, string | number> {
  const flat: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      flat[key] = '';
    } else if (Array.isArray(value)) {
      flat[key] = value.length;
    } else if (typeof value === 'object') {
      for (const [subKey, subValue] of Object.entries(value)) {
        if (subValue === null || subValue === undefined || typeof subValue === 'object') continue;
        flat[`${key}_${subKey}`] = subValue as string | number;
      }
    } else {
      flat[key] = value;
    }
  }
  return flat;
}

function toCSV(rows: Record<string, any>[]): string {
  if (!rows.length) return 'No records found for this report.\n';
  const flatRows = rows.map(flattenRow);
  const headers = Array.from(flatRows.reduce((set, r) => {
    Object.keys(r).forEach(k => set.add(k));
    return set;
  }, new Set<string>()));

  const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    headers.join(','),
    ...flatRows.map(r => headers.map(h => escape(r[h])).join(','))
  ];
  return lines.join('\n');
}

function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------
// Report data sources — each returns the rows that get written to CSV
// ---------------------------------------------------------------------

async function fetchMarksWithStudents() {
  const { data, error } = await supabase
    .from('marks')
    .select('obtained_marks, max_marks, students(name, class, section, admission_number), subjects(subject_name)')
    .limit(2000);
  if (error) throw error;
  return data || [];
}

const REPORT_EXPORTERS: Record<string, () => Promise<Record<string, any>[]>> = {
  'Class-wise Result Data': fetchMarksWithStudents,

  'Subject Performance Index': async () => {
    const rows = await fetchMarksWithStudents();
    const bySubject = new Map<string, { total_obtained: number; total_max: number; entries: number }>();
    for (const r of rows as any[]) {
      const subject = r.subjects?.subject_name || 'Unassigned';
      const bucket = bySubject.get(subject) || { total_obtained: 0, total_max: 0, entries: 0 };
      bucket.total_obtained += Number(r.obtained_marks) || 0;
      bucket.total_max += Number(r.max_marks) || 0;
      bucket.entries += 1;
      bySubject.set(subject, bucket);
    }
    return Array.from(bySubject.entries()).map(([subject, b]) => ({
      subject,
      entries: b.entries,
      average_percent: b.total_max > 0 ? ((b.total_obtained / b.total_max) * 100).toFixed(1) : '0.0'
    }));
  },

  'Student Honor Roll': async () => {
    const rows = await fetchMarksWithStudents();
    const byStudent = new Map<string, { name: string; class: string; section: string; total_obtained: number; total_max: number }>();
    for (const r of rows as any[]) {
      const key = r.students?.admission_number || r.students?.name || 'unknown';
      const bucket = byStudent.get(key) || {
        name: r.students?.name || 'Unknown',
        class: r.students?.class || '',
        section: r.students?.section || '',
        total_obtained: 0,
        total_max: 0
      };
      bucket.total_obtained += Number(r.obtained_marks) || 0;
      bucket.total_max += Number(r.max_marks) || 0;
      byStudent.set(key, bucket);
    }
    return Array.from(byStudent.values())
      .map(b => ({ ...b, average_percent: b.total_max > 0 ? (b.total_obtained / b.total_max) * 100 : 0 }))
      .sort((a, b) => b.average_percent - a.average_percent)
      .slice(0, 30)
      .map(b => ({ ...b, average_percent: b.average_percent.toFixed(1) }));
  },

  'Revenue Collection Log': async () => {
    const { data, error } = await supabase
      .from('fee_payments')
      .select('payment_date, amount_paid')
      .is('voided_at', null)
      .limit(5000);
    if (error) throw error;
    const byMonth = new Map<string, number>();
    for (const r of data || []) {
      const month = (r.payment_date || '').slice(0, 7) || 'unknown';
      byMonth.set(month, (byMonth.get(month) || 0) + (Number(r.amount_paid) || 0));
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total_collected]) => ({ month, total_collected: total_collected.toFixed(2) }));
  },

  'Overdue Fee Statements': async () => {
    const { data, error } = await supabase
      .from('student_fees')
      .select('due_date, net_amount, amount_paid, status, students(name, class, section, phone)')
      .neq('status', 'paid')
      .order('due_date', { ascending: true })
      .limit(2000);
    if (error) throw error;
    return data || [];
  },

  'Daily Cash Transaction': async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('fee_payments')
      .select('payment_date, amount_paid, payment_mode, receipt_number, student_fees(students(name, class))')
      .gte('payment_date', today)
      .is('voided_at', null)
      .limit(2000);
    if (error) throw error;
    return data || [];
  },

  'Teacher Workload Audit': async () => {
    const { data, error } = await supabase
      .from('teacher_assignments')
      .select('teacher_id, teachers(name, employee_id)')
      .eq('is_active', true)
      .limit(5000);
    if (error) throw error;
    const byTeacher = new Map<string, { teacher: string; employee_id: string; assigned_classes: number }>();
    for (const r of data || []) {
      const key = r.teacher_id;
      const bucket = byTeacher.get(key) || {
        teacher: (r as any).teachers?.name || 'Unassigned',
        employee_id: (r as any).teachers?.employee_id || '',
        assigned_classes: 0
      };
      bucket.assigned_classes += 1;
      byTeacher.set(key, bucket);
    }
    return Array.from(byTeacher.values()).sort((a, b) => b.assigned_classes - a.assigned_classes);
  },

  'Facility & Asset Register': async () => {
    const { data, error } = await supabase.from('assets').select('*').limit(2000);
    if (error) throw error;
    return data || [];
  },

  'Attendance Audit': async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('attendance')
      .select('class, section, status')
      .gte('attendance_date', thirtyDaysAgo)
      .limit(10000);
    if (error) throw error;
    const byClass = new Map<string, { class_section: string; present: number; total: number }>();
    for (const r of data || []) {
      const key = `${r.class || '?'}-${r.section || '?'}`;
      const bucket = byClass.get(key) || { class_section: key, present: 0, total: 0 };
      bucket.total += 1;
      if (r.status === 'present' || r.status === 'late') bucket.present += 1;
      byClass.set(key, bucket);
    }
    return Array.from(byClass.values()).map(b => ({
      ...b,
      attendance_percent: b.total > 0 ? ((b.present / b.total) * 100).toFixed(1) : '0.0'
    }));
  }
};

const CUSTOM_DATASETS: Record<string, () => Promise<Record<string, any>[]>> = {
  'Fee Records': async () => {
    const { data, error } = await supabase
      .from('student_fees')
      .select('status, total_amount, net_amount, amount_paid, due_date, students(name, class, section)')
      .limit(2000);
    if (error) throw error;
    return data || [];
  },
  'Exam Marks': fetchMarksWithStudents,
  Attendance: async () => {
    const { data, error } = await supabase
      .from('attendance')
      .select('attendance_date, status, class, section, students(name, admission_number)')
      .order('attendance_date', { ascending: false })
      .limit(2000);
    if (error) throw error;
    return data || [];
  }
};

const REPORT_CATEGORIES = [
  {
    title: 'Academic Reports',
    icon: GraduationCap,
    reports: [
      { name: 'Class-wise Result Data', desc: 'Detailed marksheet and pass/fail statistics for all classes.', type: 'Academic' },
      { name: 'Subject Performance Index', desc: 'Average performance trends across various subjects.', type: 'Academic' },
      { name: 'Student Honor Roll', desc: 'List of top-performing students across the institution.', type: 'Academic' },
    ]
  },
  {
    title: 'Financial Reports',
    icon: Wallet,
    reports: [
      { name: 'Revenue Collection Log', desc: 'Monthly breakdown of fees collected vs pending dues.', type: 'Financial' },
      { name: 'Overdue Fee Statements', desc: 'List of students with pending balances and fine logs.', type: 'Financial' },
      { name: 'Daily Cash Transaction', desc: "Today's record of cash and digital receipts handled.", type: 'Financial' },
    ]
  },
  {
    title: 'Staff & Admin',
    icon: Users,
    reports: [
      { name: 'Teacher Workload Audit', desc: 'Class hours and academic responsibilities per staff member.', type: 'Admin' },
      { name: 'Facility & Asset Register', desc: 'Institutional assets and fixed facility inventory.', type: 'Admin' },
      { name: 'Attendance Audit', desc: 'Last 30 days of attendance trends by class.', type: 'Admin' },
    ]
  }
];

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export default function Reports() {
  const [pendingReport, setPendingReport] = useState<string | null>(null);
  const [exportAllRunning, setExportAllRunning] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [pendingDataset, setPendingDataset] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const runExport = async (reportName: string) => {
    const exporter = REPORT_EXPORTERS[reportName];
    if (!exporter) return;
    setLastError(null);
    setPendingReport(reportName);
    try {
      const rows = await exporter();
      downloadCSV(`${slug(reportName)}_${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows));
    } catch (err: any) {
      setLastError(`${reportName}: ${err?.message || 'export failed'}`);
    } finally {
      setPendingReport(null);
    }
  };

  const runExportAll = async () => {
    setExportAllRunning(true);
    setLastError(null);
    for (const cat of REPORT_CATEGORIES) {
      for (const report of cat.reports) {
        try {
          const rows = await REPORT_EXPORTERS[report.name]();
          downloadCSV(`${slug(report.name)}_${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows));
        } catch (err: any) {
          setLastError(`${report.name}: ${err?.message || 'export failed'}`);
        }
        // Stagger downloads slightly — most browsers throttle/block a burst
        // of simultaneous auto-downloads from one click.
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
    setExportAllRunning(false);
  };

  const runDatasetExport = async (dataset: string) => {
    const exporter = CUSTOM_DATASETS[dataset];
    if (!exporter) return;
    setLastError(null);
    setPendingDataset(dataset);
    try {
      const rows = await exporter();
      downloadCSV(`${slug(dataset)}_export_${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows));
    } catch (err: any) {
      setLastError(`${dataset}: ${err?.message || 'export failed'}`);
    } finally {
      setPendingDataset(null);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16 font-sans text-slate-800 antialiased">
      {/* 1. Header Toolbar */}
      <AdminHeader
        title="Reports & Analytics Center"
        subtitle="Generate and export institutional data audits, academic indices, and financial statements."
        badge={{
          icon: BarChart3,
          text: 'Executive Auditing Hub',
          variant: 'primary'
        }}
        sessionBadge="Session: 2026-27"
        actions={
          <button
            onClick={runExportAll}
            disabled={exportAllRunning}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-60"
          >
            {exportAllRunning ? <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" /> : <Calendar className="w-3.5 h-3.5 text-slate-500" />}
            {exportAllRunning ? 'Exporting All...' : 'Export All Reports'}
          </button>
        }
      />

      {lastError && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {lastError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {REPORT_CATEGORIES.map((cat) => (
          <div key={cat.title} className="p-5 bg-white border border-slate-200/60 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-violet-50 rounded-xl border border-violet-100/60">
                <cat.icon className="w-4 h-4 text-violet-600" />
              </div>
              <h2 className="text-sm font-extrabold text-slate-900">{cat.title}</h2>
            </div>

            <div className="grid gap-2">
              {cat.reports.map((report) => (
                <div
                  key={report.name}
                  className="group p-3 rounded-xl hover:bg-slate-50 transition-all border border-slate-200/40 flex justify-between items-start gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black text-violet-600 uppercase tracking-widest bg-violet-50 border border-violet-100/60 px-2 py-0.5 rounded">
                        {report.type}
                      </span>
                      <h4 className="font-extrabold text-xs text-slate-800 group-hover:text-violet-600 transition-colors">
                        {report.name}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500 leading-normal font-medium max-w-sm">
                      {report.desc}
                    </p>
                  </div>
                  <button
                    onClick={() => runExport(report.name)}
                    disabled={pendingReport === report.name}
                    title={`Download ${report.name} as CSV`}
                    className="p-2 bg-slate-50 hover:bg-white border border-slate-200/80 rounded-lg text-slate-400 hover:text-violet-600 transition-all disabled:opacity-60"
                  >
                    {pendingReport === report.name ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Custom Data Export Card */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-gradient-to-br from-violet-50/50 to-transparent border border-violet-100/40 shadow-sm space-y-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="max-w-xl space-y-2">
              <div className="w-10 h-10 bg-violet-100/60 rounded-xl flex items-center justify-center text-violet-600 border border-violet-200/40">
                <FileBox size={20} />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900">Custom Data Export Builder</h2>
              <p className="text-slate-500 text-xs leading-relaxed font-medium">
                Cannot find the report you need? Pull a raw CSV export straight from Fee records, Exam marks, or Attendance.
              </p>
            </div>
            <button
              onClick={() => setBuilderOpen(o => !o)}
              className="px-5 py-2.5 h-[38px] bg-violet-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-violet-700 shadow-md shadow-violet-600/10 active:scale-95 transition-all whitespace-nowrap flex items-center gap-2"
            >
              {builderOpen ? 'Hide Export Engine' : 'Launch Export Engine'}
              <ChevronRight size={14} className={cn('transition-transform', builderOpen && 'rotate-90')} />
            </button>
          </div>

          {builderOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex flex-wrap gap-2.5 pt-4 border-t border-violet-100/60"
            >
              {Object.keys(CUSTOM_DATASETS).map((dataset) => (
                <button
                  key={dataset}
                  onClick={() => runDatasetExport(dataset)}
                  disabled={pendingDataset === dataset}
                  className="px-4 py-2 bg-white border border-violet-200/60 rounded-xl text-violet-700 font-bold text-xs flex items-center gap-2 hover:bg-violet-50 transition-all disabled:opacity-60"
                >
                  {pendingDataset === dataset ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                  Export {dataset}
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
