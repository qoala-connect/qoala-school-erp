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
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { AdminHeader } from '@/components/common/AdminHeader';

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
      { name: 'Daily Cash Transaction', desc: 'Real-time record of all cash and digital receipts handled.', type: 'Financial' },
    ]
  },
  {
    title: 'Staff & Admin',
    icon: Users,
    reports: [
      { name: 'Teacher Workload Audit', desc: 'Class hours and academic responsibilities per staff member.', type: 'Admin' },
      { name: 'Facility Usage Report', desc: 'Smart room and computer lab schedule utilization.', type: 'Admin' },
      { name: 'Attendance Audit', desc: 'Yearly attendance trends for students and staff.', type: 'Admin' },
    ]
  }
];

export default function Reports() {
  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16 font-sans text-slate-800 antialiased">
      {/* 1. Header Toolbar */}
      <AdminHeader
        title="Reports & Analytics Center"
        subtitle="Generate, schedule, and export institutional data audits, academic indices, and financial statements."
        badge={{
          icon: BarChart3,
          text: 'Executive Auditing Hub',
          variant: 'primary'
        }}
        sessionBadge="Session: 2026-27"
        actions={
          <button className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            Scheduled Audits
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {REPORT_CATEGORIES.map((cat, idx) => (
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
                  <button className="p-2 bg-slate-50 hover:bg-white border border-slate-200/80 rounded-lg text-slate-400 hover:text-violet-600 transition-all">
                    <Download size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Custom Data Export Card */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-gradient-to-br from-violet-50/50 to-transparent border border-violet-100/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-xl space-y-2">
            <div className="w-10 h-10 bg-violet-100/60 rounded-xl flex items-center justify-center text-violet-600 border border-violet-200/40">
              <FileBox size={20} />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">Custom Data Export Builder</h2>
            <p className="text-slate-500 text-xs leading-relaxed font-medium">
              Cannot find the report you need? Mix and match datasets (Fee records, Exam marks, Attendance) 
              to create a custom CSV or PDF export.
            </p>
          </div>
          <button className="px-5 py-2.5 h-[38px] bg-violet-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-violet-700 shadow-md shadow-violet-600/10 active:scale-95 transition-all whitespace-nowrap">
            Launch Export Engine
          </button>
        </div>
      </div>
    </div>
  );
}

