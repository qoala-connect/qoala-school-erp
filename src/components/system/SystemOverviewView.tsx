import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  fetchSystemOverview, 
  SystemOverviewData 
} from '@/services/systemService';
import { SystemLoadingBlock, SystemErrorBlock } from './shared';
import { 
  Users, 
  ShieldCheck, 
  CalendarRange, 
  Activity, 
  Link2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  UserCheck, 
  UserX, 
  ArrowRight,
  RefreshCw,
  Sparkles,
  Lock,
  FileSpreadsheet,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

export default function SystemOverviewView({
  onNavigateView,
}: {
  onNavigateView: (viewId: string) => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<SystemOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const overview = await fetchSystemOverview();
      setData(overview);
    } catch (err: any) {
      console.error('[SystemOverview] fetch failed:', err);
      setError(err?.message || 'Could not load system overview');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return <SystemLoadingBlock message="Loading enterprise system metrics…" />;
  }

  if (error || !data) {
    return <SystemErrorBlock message={error || 'Failed to load system metrics'} onRetry={load} />;
  }

  return (
    <div className="space-y-4">
      {/* 1. Academic Year Context Banner */}
      <div className="bg-gradient-to-r from-violet-900 to-indigo-950 text-white rounded-2xl p-5 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-black tracking-widest uppercase border border-violet-400/20">
                Active Context
              </span>
              <span className="text-xs text-violet-200 font-medium">Canonical Academic Year</span>
            </div>
            <h2 className="text-xl font-bold mt-1 tracking-tight">
              {data.academic_year ? data.academic_year.name : 'No Active Academic Year'}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Academic structure is owned by Academics. System reads this context to govern user scopes and cross-module permissions.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate('/dashboard/academics/years')}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/10 transition-colors flex items-center gap-1.5"
            >
              <CalendarRange size={13} />
              Manage Years in Academics
            </button>
            <button
              onClick={load}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/10 transition-colors"
              title="Refresh Metrics"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Users */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Total Accounts
            </span>
            <div className="p-2 rounded-xl bg-violet-50 text-violet-600">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{data.users.total}</span>
            <span className="text-xs font-bold text-emerald-600">
              {data.users.active} active
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>{data.users.signed_in_7d} active (7d)</span>
            <button
              onClick={() => onNavigateView('users')}
              className="text-violet-600 font-bold hover:underline flex items-center gap-0.5"
            >
              Directory <ArrowRight size={10} />
            </button>
          </div>
        </div>

        {/* Roles & Administrators */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Security Roles
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{data.roles.in_use}</span>
            <span className="text-xs text-slate-400 font-medium">roles in use</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>{data.roles.administrators} Administrators</span>
            <button
              onClick={() => onNavigateView('roles')}
              className="text-amber-700 font-bold hover:underline flex items-center gap-0.5"
            >
              Matrix <ArrowRight size={10} />
            </button>
          </div>
        </div>

        {/* Permission Grants */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Permission Grants
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Lock size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{data.permissions.grants}</span>
            <span className="text-xs font-bold text-indigo-600">
              {data.permissions.distinct} unique
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>{data.permissions.roles_granted} roles configured</span>
            <button
              onClick={() => onNavigateView('roles')}
              className="text-indigo-600 font-bold hover:underline flex items-center gap-0.5"
            >
              Audit <ArrowRight size={10} />
            </button>
          </div>
        </div>

        {/* Audit Log Activity */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Audit Events (7d)
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <Activity size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{data.audit.last_7d}</span>
            <span className="text-xs font-bold text-rose-600">
              {data.audit.security_7d} security
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>{data.audit.last_24h} in last 24h</span>
            <button
              onClick={() => onNavigateView('audit')}
              className="text-rose-600 font-bold hover:underline flex items-center gap-0.5"
            >
              Logs <ArrowRight size={10} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Detailed Operational Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left: Account Lifecycle Breakdown (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">User Account Lifecycle</h3>
              <p className="text-[11px] text-slate-500">
                Safe identity lifecycle management with zero destructive user deletion.
              </p>
            </div>
            <button
              onClick={() => onNavigateView('users')}
              className="text-xs font-bold text-violet-600 hover:underline inline-flex items-center gap-1"
            >
              Manage Directory <ArrowRight size={12} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
              <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] font-bold">
                <CheckCircle2 size={13} /> Active
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">{data.users.active}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Permitted normal access</div>
            </div>

            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
              <div className="flex items-center gap-1.5 text-blue-700 text-[11px] font-bold">
                <Clock size={13} /> Invited
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">{data.users.invited}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Awaiting initial sign-in</div>
            </div>

            <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
              <div className="flex items-center gap-1.5 text-amber-700 text-[11px] font-bold">
                <AlertTriangle size={13} /> Suspended
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">{data.users.suspended}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Temporarily blocked</div>
            </div>

            <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl">
              <div className="flex items-center gap-1.5 text-rose-700 text-[11px] font-bold">
                <UserX size={13} /> Disabled
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">{data.users.disabled}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Blocked indefinitely</div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-1.5 text-slate-700 text-[11px] font-bold">
                <UserX size={13} /> Archived
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">{data.users.archived}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Departed, history kept</div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-1.5 text-slate-700 text-[11px] font-bold">
                <Clock size={13} /> Never Signed In
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">{data.users.never_signed_in}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">No login session yet</div>
            </div>
          </div>
        </div>

        {/* Right: Entity Linkage Health (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Entity Linkage Health</h3>
            <p className="text-[11px] text-slate-500">
              ERP login accounts connected to existing business records.
            </p>
          </div>

          <div className="space-y-3">
            {/* Teachers */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-600" />
                  Teachers
                </span>
                <span>
                  {data.linkage.teachers_linked} / {data.linkage.teachers_total} linked
                </span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full rounded-full transition-all"
                  style={{ 
                    width: `${data.linkage.teachers_total > 0 ? (data.linkage.teachers_linked / data.linkage.teachers_total) * 100 : 0}%` 
                  }}
                />
              </div>
            </div>

            {/* Staff */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-cyan-600" />
                  Non-Teaching Staff
                </span>
                <span>
                  {data.linkage.staff_linked} / {data.linkage.staff_total} linked
                </span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="bg-cyan-600 h-full rounded-full transition-all"
                  style={{ 
                    width: `${data.linkage.staff_total > 0 ? (data.linkage.staff_linked / data.linkage.staff_total) * 100 : 0}%` 
                  }}
                />
              </div>
            </div>

            {/* Students */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-600" />
                  Students
                </span>
                <span>
                  {data.linkage.students_linked} / {data.linkage.students_total} linked
                </span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full rounded-full transition-all"
                  style={{ 
                    width: `${data.linkage.students_total > 0 ? (data.linkage.students_linked / data.linkage.students_total) * 100 : 0}%` 
                  }}
                />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 4. Administrative Fast-Action Shortcuts */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
          Administrative Control Centers
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigateView('users')}
            className="p-3.5 rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50/20 text-left transition-all group"
          >
            <div className="flex items-center justify-between text-violet-600 font-bold text-xs">
              <span className="flex items-center gap-2">
                <Users size={16} /> User Directory
              </span>
              <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Search accounts, assign roles, manage lifecycles, and link entities.
            </p>
          </button>

          <button
            onClick={() => onNavigateView('roles')}
            className="p-3.5 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/20 text-left transition-all group"
          >
            <div className="flex items-center justify-between text-amber-700 font-bold text-xs">
              <span className="flex items-center gap-2">
                <ShieldCheck size={16} /> RBAC Matrix
              </span>
              <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Configure fine-grained module permissions across all 16 system roles.
            </p>
          </button>

          <button
            onClick={() => onNavigateView('settings')}
            className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 text-left transition-all group"
          >
            <div className="flex items-center justify-between text-indigo-600 font-bold text-xs">
              <span className="flex items-center gap-2">
                <Settings size={16} /> School Settings
              </span>
              <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Configure school identity, official branding, affiliation, and timezones.
            </p>
          </button>

          <button
            onClick={() => onNavigateView('audit')}
            className="p-3.5 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50/20 text-left transition-all group"
          >
            <div className="flex items-center justify-between text-rose-600 font-bold text-xs">
              <span className="flex items-center gap-2">
                <Activity size={16} /> Audit Trail
              </span>
              <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Inspect immutable audit history with before/after state diffing.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
