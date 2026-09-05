import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  fetchRolePermissions, 
  toggleRolePermission,
  fetchSystemOverview 
} from '@/services/systemService';
import { useAuth, AppRole, ROLE_LABELS } from '@/context/AuthContext';
import { PERMISSION_CATALOGUE } from '@/components/Can';
import { 
  RoleBadge, 
  SystemLoadingBlock, 
  SystemErrorBlock, 
  PRIVILEGED_ROLES 
} from './shared';
import { toast } from 'sonner';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Check, 
  Loader2, 
  RefreshCw, 
  Info, 
  Lock,
  Sparkles,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ALL_ROLES = Object.keys(ROLE_LABELS) as AppRole[];

export default function RolesPermissionsView() {
  const { user: currentUser, role: currentRole, can, refresh: refreshMyPermissions } = useAuth();
  const isSuperAdmin = currentRole === 'super_admin';
  const canManage = can('settings.manage') || can('users.manage');

  const [grants, setGrants] = useState<Record<string, Set<string>>>({});
  const [roleCounts, setRoleCounts] = useState<Partial<Record<AppRole, number>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [grantsData, overviewData] = await Promise.all([
        fetchRolePermissions(),
        fetchSystemOverview().catch(() => null),
      ]);
      setGrants(grantsData);
    } catch (err: any) {
      console.error('[RolesPermissions] load failed:', err);
      setError(err?.message || 'Could not load role permissions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggle = async (role: AppRole, permission: string, granted: boolean) => {
    // Guards
    if (role === 'super_admin') {
      toast.info('Super Admin holds the wildcard grant (*) and is permanently granted all permissions.');
      return;
    }

    if (role === currentRole && !granted && (permission === 'settings.manage' || permission === 'users.manage')) {
      toast.error(`You cannot remove ${permission} from your own role. Ask another administrator.`);
      return;
    }

    const key = `${role}:${permission}`;
    setSavingKey(key);

    // Optimistic update
    setGrants(prev => {
      const next = { ...prev };
      const set = new Set(next[role] ?? []);
      granted ? set.add(permission) : set.delete(permission);
      next[role] = set;
      return next;
    });

    try {
      await toggleRolePermission(role, permission, granted);
      toast.success(
        `${granted ? 'Granted' : 'Revoked'} ${permission} for ${ROLE_LABELS[role]}`
      );

      // Refresh current session permissions if affecting own role
      if (role === currentRole) {
        await refreshMyPermissions();
      }
    } catch (err: any) {
      console.error('[RolesPermissions] toggle failed:', err);
      // Revert optimistic update
      setGrants(prev => {
        const next = { ...prev };
        const set = new Set(next[role] ?? []);
        granted ? set.delete(permission) : set.add(permission);
        next[role] = set;
        return next;
      });
      toast.error(
        err.code === '42501'
          ? 'Permission denied: Database refused permission change.'
          : err.message || 'Could not update permission'
      );
    } finally {
      setSavingKey(null);
    }
  };

  if (isLoading) {
    return <SystemLoadingBlock message="Loading enterprise RBAC permission matrix…" />;
  }

  if (error) {
    return <SystemErrorBlock message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-4">
      {/* Header Info Box */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Role-Based Access Control (RBAC) Matrix</h2>
            <p className="text-[11px] text-slate-500">
              Fine-grained permission gating across all ERP modules. Enforced server-side by PostgreSQL Row-Level Security.
            </p>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 self-start"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        {!canManage && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
            <Info size={14} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">View Only Mode:</span> Modifying permissions requires the <span className="font-mono font-bold">settings.manage</span> permission.
            </div>
          </div>
        )}

        {/* Roles chip list */}
        <div className="pt-2 border-t border-slate-100">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
            Active System Roles
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ALL_ROLES.map(r => (
              <RoleBadge key={r} role={r} />
            ))}
          </div>
        </div>
      </div>

      {/* Permission Matrix Tables Grouped by Domain */}
      <div className="space-y-4">
        {PERMISSION_CATALOGUE.map(group => (
          <div
            key={group.group}
            className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs"
          >
            <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={13} className="text-violet-600" />
                {group.group} Permissions
              </h3>
              <span className="text-[10px] text-slate-400 font-bold">
                {group.permissions.length} action{group.permissions.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="text-xs min-w-[950px] w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100 bg-white">
                    <th className="py-2.5 px-4 font-bold sticky left-0 bg-white z-10 w-64">
                      Permission Key
                    </th>
                    {ALL_ROLES.map(r => (
                      <th
                        key={r}
                        className={cn(
                          'py-2.5 px-2 font-bold text-center whitespace-nowrap text-[10px]',
                          PRIVILEGED_ROLES.has(r) ? 'text-amber-800' : 'text-slate-600'
                        )}
                      >
                        {ROLE_LABELS[r]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {group.permissions.map(perm => (
                    <tr key={perm} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-700 font-semibold sticky left-0 bg-white z-10 shadow-xs">
                        {perm}
                      </td>
                      {ALL_ROLES.map(role => {
                        const isSuper = role === 'super_admin';
                        const isGranted = isSuper || (grants[role]?.has(perm) ?? false);
                        const key = `${role}:${perm}`;
                        const isBusy = savingKey === key;

                        return (
                          <td key={role} className="py-2.5 px-2 text-center">
                            {isSuper ? (
                              <div className="w-5 h-5 rounded-md bg-purple-100 border border-purple-300 text-purple-700 flex items-center justify-center mx-auto" title="Super Admin wildcard (*)">
                                <Lock size={10} />
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={!canManage || isBusy}
                                onClick={() => handleToggle(role, perm, !isGranted)}
                                aria-label={`${isGranted ? 'Revoke' : 'Grant'} ${perm} for ${ROLE_LABELS[role]}`}
                                className={cn(
                                  'w-5 h-5 rounded-md border flex items-center justify-center mx-auto transition-all disabled:opacity-40 disabled:cursor-not-allowed',
                                  isGranted
                                    ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                                    : 'bg-white border-slate-200 text-transparent hover:border-slate-400'
                                )}
                              >
                                {isBusy ? (
                                  <Loader2 size={10} className="animate-spin text-slate-500" />
                                ) : (
                                  <Check size={11} strokeWidth={3} />
                                )}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
