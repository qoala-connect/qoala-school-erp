import React, { useState } from 'react';
import { 
  User, 
  Calendar, 
  Wallet, 
  Award, 
  Clock, 
  Bell, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpRight, 
  ShieldCheck, 
  Sparkles,
  Loader2,
  TrendingUp,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface StructuredPayload {
  type: 'student_card' | 'attendance_table' | 'fee_summary' | 'marks_table' | 'timetable_grid' | 'kpi_cards' | 'notice_list' | 'action_card' | 'generic_list';
  title: string;
  data: any;
}

interface Props {
  payload: StructuredPayload;
  accessToken?: string | null;
  onActionComplete?: () => void;
}

export default function StructuredMessageRenderer({ payload, accessToken, onActionComplete }: Props) {
  const { type, title, data } = payload;
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [actionDone, setActionDone] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Handle Action Execution (Confirm & Apply)
  const handleExecuteAction = async () => {
    if (!accessToken) {
      toast.error('You must be logged in to execute actions.');
      return;
    }

    setIsExecutingAction(true);
    try {
      const res = await fetch('/api/ai/action/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          actionType: data.actionType,
          parameters: data.parameters
        })
      });

      const resData = await res.json();
      if (!res.ok || resData.error) {
        throw new Error(resData.error || 'Failed to execute action');
      }

      setActionDone(true);
      setActionMessage(resData.message || 'Action executed successfully!');
      toast.success(resData.message || 'Action executed successfully!');
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      console.error('[Action Execution Error]:', err);
      toast.error(err.message || 'Could not execute action.');
    } finally {
      setIsExecutingAction(false);
    }
  };

  // 1. STUDENT 360 CARD
  if (type === 'student_card') {
    const students = Array.isArray(data) ? data : [data];
    if (students.length === 0) return null;

    return (
      <div className="space-y-2.5 my-2">
        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase text-blue-700">
          <User size={13} />
          <span>{title || 'Student Profile'}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {students.map((s, idx) => (
            <div key={s.id || idx} className="p-3 bg-white border border-blue-100 rounded-xl shadow-3xs flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                {s.photo_url ? (
                  <img src={s.photo_url} alt={s.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  s.name?.charAt(0)?.toUpperCase() || 'S'
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{s.name}</h4>
                  <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-extrabold uppercase">
                    {s.status || 'Active'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                  Class: <strong className="text-slate-700">{s.class}-{s.section}</strong> • Roll: <strong className="text-slate-700 font-mono">#{s.roll_number || 'N/A'}</strong>
                </p>
                <div className="text-[9.5px] text-slate-400 truncate mt-0.5">
                  Adm: <span className="font-mono text-slate-600">{s.admission_number}</span>
                  {s.father_name && <span> • Father: {s.father_name}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. ATTENDANCE TABLE & STATS
  if (type === 'attendance_table') {
    const { percentage, present, absent, total, absentStudents, logs } = data;
    const rate = percentage !== undefined ? percentage : (total ? Math.round((present / total) * 100) : null);

    return (
      <div className="p-3.5 bg-gradient-to-br from-slate-50 to-blue-50/40 border border-blue-100/80 rounded-2xl my-2 space-y-3 shadow-3xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <Calendar size={14} className="text-blue-600" />
            <span>{title || 'Attendance Summary'}</span>
          </div>
          <span className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-extrabold",
            rate === null ? "bg-slate-100 text-slate-600" : rate >= 75 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
          )}>
            {rate === null ? 'No data' : `${rate}% Attendance`}
          </span>
        </div>

        {/* Metric Pill Grid */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 bg-white rounded-xl border border-slate-200/80">
            <span className="text-[9.5px] font-bold text-slate-400 uppercase block">Total Days</span>
            <span className="font-black text-slate-800">{total ?? (data.presentCount != null && data.absentCount != null ? data.presentCount + data.absentCount : '—')}</span>
          </div>
          <div className="p-2 bg-emerald-50/80 rounded-xl border border-emerald-100">
            <span className="text-[9.5px] font-bold text-emerald-600 uppercase block">Present</span>
            <span className="font-black text-emerald-700">{present ?? data.presentCount ?? '—'}</span>
          </div>
          <div className="p-2 bg-rose-50/80 rounded-xl border border-rose-100">
            <span className="text-[9.5px] font-bold text-rose-600 uppercase block">Absent</span>
            <span className="font-black text-rose-700">{absent ?? data.absentCount ?? '—'}</span>
          </div>
        </div>

        {/* Absent Students List if available */}
        {Array.isArray(absentStudents) && absentStudents.length > 0 && (
          <div className="p-2 bg-rose-50/60 border border-rose-100 rounded-xl text-[10.5px]">
            <span className="font-bold text-rose-700 block mb-0.5">Absent Students:</span>
            <span className="text-rose-900 font-medium">{absentStudents.join(', ')}</span>
          </div>
        )}

        {/* Recent logs */}
        {Array.isArray(logs) && logs.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-slate-200/60 text-[10px]">
            <span className="font-bold text-slate-500 uppercase text-[9px] block">Recent Attendance Logs:</span>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {logs.slice(0, 8).map((l: any, i: number) => (
                <span
                  key={i}
                  className={cn(
                    "px-2 py-0.5 rounded-lg font-mono font-bold flex items-center gap-1 border",
                    l.status === 'present' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    l.status === 'absent' ? "bg-rose-50 text-rose-700 border-rose-200" :
                    "bg-amber-50 text-amber-700 border-amber-200"
                  )}
                >
                  <span>{l.attendance_date || 'Date'}</span>:
                  <span className="uppercase">{l.status}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. FEE SUMMARY CARD
  if (type === 'fee_summary') {
    const { totalBilled, totalPaid, balance, status, defaulters } = data;

    return (
      <div className="p-3.5 bg-gradient-to-br from-slate-50 to-violet-50/40 border border-violet-100 rounded-2xl my-2 space-y-3 shadow-3xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <Wallet size={14} className="text-violet-600" />
            <span>{title || 'Fee Status'}</span>
          </div>
          <span className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase",
            balance === 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          )}>
            {balance === 0 ? 'Fully Cleared' : `Pending Due`}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 bg-white rounded-xl border border-slate-200">
            <span className="text-[9.5px] font-bold text-slate-400 uppercase block">Total Billed</span>
            <span className="font-black text-slate-800">₹{(totalBilled || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
            <span className="text-[9.5px] font-bold text-emerald-600 uppercase block">Total Paid</span>
            <span className="font-black text-emerald-700">₹{(totalPaid || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="p-2 bg-amber-50 rounded-xl border border-amber-100">
            <span className="text-[9.5px] font-bold text-amber-600 uppercase block">Balance</span>
            <span className="font-black text-amber-800">₹{(balance || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>

        {Array.isArray(defaulters) && defaulters.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-violet-100 text-[10.5px]">
            <span className="font-bold text-amber-700 block text-[10px]">Pending Student Accounts:</span>
            <div className="space-y-1">
              {defaulters.slice(0, 4).map((d: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-slate-700 bg-white p-1.5 rounded-lg border border-slate-200">
                  <span>{d.studentName} (Class {d.class})</span>
                  <span className="font-bold font-mono text-rose-600">₹{d.due.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 4. MARKS & RESULT TABLE
  if (type === 'marks_table') {
    const { grade, percentage, division, marks } = data;
    const marksList = Array.isArray(marks) ? marks : [];

    return (
      <div className="p-3.5 bg-white border border-indigo-100 rounded-2xl my-2 space-y-3 shadow-3xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <Award size={14} className="text-indigo-600" />
            <span>{title || 'Examination Marksheet'}</span>
          </div>
          {grade && (
            <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full text-[10px] font-black">
              Grade {grade} ({percentage != null ? `${percentage}%` : 'N/A'})
            </span>
          )}
        </div>

        {marksList.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[9px]">
                  <th className="py-1">Subject</th>
                  <th className="py-1 text-center">Score</th>
                  <th className="py-1 text-right">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {marksList.map((m: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-1.5 font-bold text-slate-800">
                      {m.subject || 'Subject'}
                      {m.studentName && <span className="block text-[9.5px] text-slate-400 font-normal">{m.studentName} (Class {m.class})</span>}
                    </td>
                    <td className="py-1.5 text-center font-mono font-bold text-indigo-600">
                      {m.obtained !== null ? m.obtained : 'N/A'}
                    </td>
                    <td className="py-1.5 text-right font-mono text-slate-400">{m.max || 100}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // 5. TIMETABLE GRID
  if (type === 'timetable_grid') {
    const slots = Array.isArray(data.slots) ? data.slots : [];

    return (
      <div className="p-3.5 bg-white border border-sky-100 rounded-2xl my-2 space-y-3 shadow-3xs">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
          <Clock size={14} className="text-sky-600" />
          <span>{title || 'Academic Schedule'}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {slots.slice(0, 6).map((slot: any, idx: number) => (
            <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200/70 rounded-xl space-y-0.5 text-xs">
              <div className="flex items-center justify-between text-[10px] font-mono text-sky-600 font-bold">
                <span>Period {slot.period_number || idx + 1}</span>
                <span className="text-slate-400">{slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}</span>
              </div>
              <h5 className="font-bold text-slate-800 truncate">{slot.subjects?.subject_name || slot.class || 'Subject'}</h5>
              {slot.teachers?.name && (
                <p className="text-[10px] text-slate-500 truncate">{slot.teachers.name}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 6. EXECUTIVE KPI CARDS
  if (type === 'kpi_cards') {
    const cards = Array.isArray(data) ? data : [];

    return (
      <div className="space-y-2 my-2">
        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase text-blue-700">
          <TrendingUp size={13} />
          <span>{title || 'Executive KPIs'}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {cards.map((c: any, idx: number) => (
            <div key={idx} className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-3xs">
              <span className="text-[9.5px] font-bold text-slate-400 uppercase block truncate">{c.label}</span>
              <span className="text-base font-black text-slate-900 block mt-0.5">{c.value}</span>
              <span className="text-[9px] font-extrabold text-emerald-600 block mt-0.5">{c.trend}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 7. NOTICES LIST
  if (type === 'notice_list') {
    const notices = Array.isArray(data) ? data : [];

    return (
      <div className="p-3 bg-gradient-to-br from-blue-50/60 to-indigo-50/60 border border-blue-100 rounded-2xl my-2 space-y-2.5 shadow-3xs">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
          <Bell size={14} className="text-blue-600" />
          <span>{title || 'School Circulars'}</span>
        </div>
        <div className="space-y-2">
          {notices.map((n: any, idx: number) => (
            <div key={idx} className="p-2.5 bg-white rounded-xl border border-blue-100/80 space-y-0.5 text-xs">
              <div className="flex items-center justify-between">
                <h5 className="font-bold text-slate-900">{n.title}</h5>
                <span className="text-[9px] font-mono text-blue-600 font-bold">
                  {n.created_at ? new Date(n.created_at).toLocaleDateString('en-IN') : 'Official'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">{n.description}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 8. ACTION CONFIRMATION CARD (Safe 2-Step Write Protocol)
  if (type === 'action_card') {
    const { actionType, title: actTitle, description, parameters } = data;

    return (
      <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl my-2 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-500 text-white rounded-lg shadow-xs">
            <AlertTriangle size={16} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-amber-950 uppercase tracking-tight">
              Action Confirmation Required
            </h4>
            <p className="text-[11px] text-amber-800 font-medium">{actTitle || 'ERP Write Action'}</p>
          </div>
        </div>

        <p className="text-xs text-slate-700 bg-white/80 p-2.5 rounded-xl border border-amber-100 leading-relaxed font-normal">
          {description}
        </p>

        {actionDone ? (
          <div className="p-2.5 bg-emerald-100 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-bold">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{actionMessage || 'Action executed successfully and recorded in ERP ledger.'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleExecuteAction}
              disabled={isExecutingAction}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isExecutingAction ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Applying Changes...
                </>
              ) : (
                <>
                  <CheckCircle2 size={13} />
                  Confirm &amp; Apply
                </>
              )}
            </button>
            <span className="text-[10px] text-slate-500">
              Review before applying to live database.
            </span>
          </div>
        )}
      </div>
    );
  }

  return null;
}
