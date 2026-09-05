import React from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Key, 
  UserCheck, 
  Clock, 
  Activity, 
  CheckCircle2, 
  Layers,
  ArrowRight,
  Database
} from 'lucide-react';
import { useAuth, ROLE_LABELS } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

export default function SecurityView({
  onNavigateView,
}: {
  onNavigateView: (viewId: string) => void;
}) {
  const { user, role, roleLabel } = useAuth();

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider border border-emerald-200">
                Active Security Boundary
              </span>
              <span className="text-xs text-slate-500 font-medium">PostgreSQL Row-Level Security Enforced</span>
            </div>
            <h2 className="text-sm font-bold text-slate-900 mt-1">Identity &amp; Access Governance Architecture</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Multi-tiered defense ensuring privilege separation, non-repudiation, and protected administrative boundaries.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-right shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Active Session Role</span>
            <span className="text-xs font-bold text-violet-700">{roleLabel}</span>
            <span className="text-[10px] text-slate-500 font-mono block">{user?.email}</span>
          </div>
        </div>
      </div>

      {/* Security Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pillar 1: Super Admin & Privilege Escalation Protection */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-violet-700 font-bold text-xs">
            <ShieldCheck size={16} />
            <h3>Super Admin &amp; Privilege Escalation Protection</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Administrative role modifications are governed by server-side PostgreSQL functions (<code className="text-violet-600 font-mono font-bold">set_user_role</code> and <code className="text-violet-600 font-mono font-bold">set_role_permission</code>).
          </p>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-slate-700">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Self-Demotion / Lockout Blocked:</strong> An administrator cannot alter their own role or remove administrative permissions from their active role.</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-slate-700">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Last Admin Safeguard:</strong> The system strictly refuses any attempt to demote or suspend the last active administrator.</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-slate-700">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Wildcard Isolation:</strong> Only verified <code className="font-mono font-bold">super_admin</code> accounts can grant or receive unrestricted (<code className="font-mono font-bold">*</code>) access.</span>
            </div>
          </div>
        </div>

        {/* Pillar 2: Zero Destructive Deletion Policy */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-amber-700 font-bold text-xs">
            <UserCheck size={16} />
            <h3>Account Lifecycle &amp; Historical Integrity</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            User accounts are never deleted blindly. Departing staff or students transition across managed lifecycle states.
          </p>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-slate-700">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Non-Destructive Archival:</strong> Historical marks, fee receipts, timetables, and audit records remain permanently intact when an account is disabled or archived.</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-slate-700">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Entity Linkage Preservation:</strong> Disabling an auth user retains the canonical Teacher or Student profile without breaking relational keys.</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-slate-700">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Instant Access Revocation:</strong> <code className="font-mono font-bold">account_is_active()</code> immediately rejects RLS and stored procedures for non-active states.</span>
            </div>
          </div>
        </div>

        {/* Pillar 3: Immutable Append-Only Audit Trail */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-rose-700 font-bold text-xs">
            <Activity size={16} />
            <h3>Immutable Append-Only Audit Trail</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Audit history is protected by trigger-level constraints refusing UPDATE and DELETE statements from any database user.
          </p>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-slate-700">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Database-Level Immutability:</strong> <code className="font-mono font-bold">guard_audit_log_immutable()</code> trigger blocks all mutation and truncation attempts.</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-slate-700">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>State Diff Capture:</strong> All critical administrative actions automatically record <code className="font-mono font-bold">old_values</code> and <code className="font-mono font-bold">new_values</code> in JSONB format.</span>
            </div>
          </div>
        </div>

        {/* Pillar 4: Session Governance & RLS Boundaries */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-cyan-700 font-bold text-xs">
            <Lock size={16} />
            <h3>Session Governance &amp; Backend Security</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Frontend UI checks (such as <code className="font-mono font-bold">&lt;Can&gt;</code>) provide UX guidance. PostgreSQL RLS policies enforce absolute data isolation.
          </p>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-slate-700">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Server-Side Row Level Security:</strong> Direct API or PostgREST calls cannot bypass permission policies.</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-slate-700">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Configurable Session Expiry:</strong> Idle session timeouts are managed in <code className="font-mono font-bold">system_settings</code>.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
