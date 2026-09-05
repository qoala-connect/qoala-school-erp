import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  ShieldCheck, 
  Settings, 
  Activity, 
  Lock,
  ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { AdminHeader } from '@/components/common/AdminHeader';
import SystemOverviewView from '@/components/system/SystemOverviewView';
import UserDirectoryView from '@/components/system/UserDirectoryView';
import RolesPermissionsView from '@/components/system/RolesPermissionsView';
import SchoolSettingsView from '@/components/system/SchoolSettingsView';
import AuditLogsView from '@/components/system/AuditLogsView';
import SecurityView from '@/components/system/SecurityView';

export const SYSTEM_VIEWS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'User Directory', icon: Users },
  { id: 'roles', label: 'Roles & Permissions', icon: ShieldCheck },
  { id: 'settings', label: 'School Settings', icon: Settings },
  { id: 'audit', label: 'Audit Logs', icon: Activity },
  { id: 'security', label: 'Security & Governance', icon: Lock },
] as const;

export type SystemViewId = typeof SYSTEM_VIEWS[number]['id'];

const VALID_VIEWS = new Set<string>(SYSTEM_VIEWS.map(v => v.id));

export default function SystemManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ view?: string }>();
  const { can, roleLabel } = useAuth();

  const legacyTab = (location.state as any)?.activeTab as string | undefined;

  const view: SystemViewId = useMemo(() => {
    if (params.view && VALID_VIEWS.has(params.view)) return params.view as SystemViewId;
    if (legacyTab && VALID_VIEWS.has(legacyTab)) return legacyTab as SystemViewId;
    return 'overview';
  }, [params.view, legacyTab]);

  const isOnSystemPath = location.pathname.startsWith('/dashboard/system');

  useEffect(() => {
    if (!isOnSystemPath) return;
    if (!params.view || !VALID_VIEWS.has(params.view)) {
      navigate(`/dashboard/system/${view}`, { replace: true, state: location.state });
    }
  }, [isOnSystemPath, params.view, view, navigate, location.state]);

  const goToView = (next: string) => navigate(`/dashboard/system/${next}`);

  const mayManage = can('settings.manage') || can('users.manage');

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16">
      {/* 1. Module Header */}
      <AdminHeader
        title="System Administration & Security"
        subtitle="Enterprise management of users, RBAC permissions, school configuration, security controls, and append-only audit logging."
        badge={{
          icon: ShieldCheck,
          text: 'Control Center',
          variant: 'violet'
        }}
        sessionBadge="Session: 2026-27"
        actions={
          <div className="flex items-center gap-2">
            {!mayManage && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-[10px] font-black text-amber-800 uppercase tracking-widest shadow-2xs">
                <ShieldAlert size={12} aria-hidden="true" /> View Only
              </span>
            )}
            <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-700 shadow-2xs">
              Role: {roleLabel}
            </span>
          </div>
        }
      />

      {/* 2. Segmented Navigation Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 shadow-2xs overflow-x-auto">
        <nav
          className="flex items-center gap-1 min-w-max"
          aria-label="System Administration Sections"
        >
          {SYSTEM_VIEWS.map(v => {
            const isActive = view === v.id;
            return (
              <button
                key={v.id}
                onClick={() => goToView(v.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer',
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )}
              >
                <v.icon size={14} className={isActive ? 'text-violet-400' : 'text-slate-400'} aria-hidden="true" />
                <span>{v.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* 3. Render Active Sub-View */}
      <div>
        {view === 'overview' && <SystemOverviewView onNavigateView={goToView} />}
        {view === 'users' && <UserDirectoryView />}
        {view === 'roles' && <RolesPermissionsView />}
        {view === 'settings' && <SchoolSettingsView />}
        {view === 'audit' && <AuditLogsView />}
        {view === 'security' && <SecurityView onNavigateView={goToView} />}
      </div>
    </div>
  );
}
