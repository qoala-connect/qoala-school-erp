import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  fetchUserDirectory, 
  changeUserRole, 
  changeUserStatus, 
  linkUserToEntity, 
  unlinkUserFromEntity, 
  fetchLinkableEntities, 
  UserDirectoryItem, 
  AccountStatus, 
  LinkableEntity 
} from '@/services/systemService';
import { useAuth, AppRole, ROLE_LABELS } from '@/context/AuthContext';
import { 
  RoleBadge, 
  StatusBadge, 
  EntityBadge, 
  PaginationBar, 
  SystemLoadingBlock, 
  SystemErrorBlock,
  PRIVILEGED_ROLES 
} from './shared';
import { toast } from 'sonner';
import {
  Search,
  Filter,
  Users,
  Link as LinkIcon,
  Unlink,
  ShieldAlert,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  X,
  Plus,
  Shield,
  UserCheck,
  UserX,
  UserPlus,
  KeyRound,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

const ALL_ROLES = Object.keys(ROLE_LABELS) as AppRole[];
const ALL_STATUSES: AccountStatus[] = ['active', 'invited', 'suspended', 'disabled', 'archived'];

export default function UserDirectoryView() {
  const { user: currentUser, can, refresh: refreshMyPermissions } = useAuth();
  const canManageUsers = can('users.manage') || can('settings.manage');

  // Directory query state
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [linkedFilter, setLinkedFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Data state
  const [users, setUsers] = useState<UserDirectoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // In-flight action tracking
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Modals state
  const [statusModalUser, setStatusModalUser] = useState<UserDirectoryItem | null>(null);
  const [statusDraft, setStatusDraft] = useState<AccountStatus>('active');
  const [statusReason, setStatusReason] = useState('');
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  const [linkModalUser, setLinkModalUser] = useState<UserDirectoryItem | null>(null);
  const [linkType, setLinkType] = useState<'teacher' | 'staff' | 'student'>('teacher');
  const [linkCandidates, setLinkCandidates] = useState<LinkableEntity[]>([]);
  const [linkSearch, setLinkSearch] = useState('');
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [isSavingLink, setIsSavingLink] = useState(false);

  // Account lifecycle (create / password / delete) — served by the API,
  // which holds the service-role key; the browser never sees it.
  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', full_name: '', role: 'teacher' as AppRole, password: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [pwdUser, setPwdUser] = useState<UserDirectoryItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isSavingPwd, setIsSavingPwd] = useState(false);

  const adminApi = async (path: string, init: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    const res = await fetch('/api/admin' + path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (data.session?.access_token || ''),
        ...(init.headers || {}),
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Request failed');
    return body;
  };

  const handleCreateUser = async () => {
    if (!newUser.email.trim() || newUser.password.length < 8) {
      toast.error('Enter an email and a password of at least 8 characters.');
      return;
    }
    setIsCreating(true);
    try {
      await adminApi('/users', { method: 'POST', body: JSON.stringify(newUser) });
      toast.success('Account created for ' + newUser.email);
      setCreateOpen(false);
      setNewUser({ email: '', full_name: '', role: 'teacher' as AppRole, password: '' });
      await loadDirectory();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleResetPassword = async () => {
    if (!pwdUser || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    setIsSavingPwd(true);
    try {
      await adminApi('/users/' + pwdUser.id + '/password', { method: 'POST', body: JSON.stringify({ password: newPassword }) });
      toast.success('Password updated for ' + pwdUser.email);
      setPwdUser(null);
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingPwd(false);
    }
  };

  const handleDeleteUser = async (target: UserDirectoryItem) => {
    if (!window.confirm('Permanently delete the account ' + target.email + '? This cannot be undone.')) return;
    setUpdatingUserId(target.id);
    try {
      await adminApi('/users/' + target.id, { method: 'DELETE' });
      toast.success('Account deleted.');
      await loadDirectory();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const loadDirectory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { users: list, totalCount: count } = await fetchUserDirectory({
        search: search.trim(),
        role: roleFilter,
        status: statusFilter,
        linked: linkedFilter,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setUsers(list);
      setTotalCount(count);
    } catch (err: any) {
      console.error('[UserDirectory] fetch failed:', err);
      setError(err?.message || 'Failed to load user directory');
    } finally {
      setIsLoading(false);
    }
  }, [search, roleFilter, statusFilter, linkedFilter, page]);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  // Handle role change
  const handleRoleChange = async (targetUser: UserDirectoryItem, nextRole: AppRole) => {
    if (targetUser.role === nextRole) return;

    if (targetUser.id === currentUser?.id) {
      const confirmed = window.confirm(
        'You are modifying your own role. You may lose administrative privileges immediately. Are you sure?'
      );
      if (!confirmed) return;
    }

    setUpdatingUserId(targetUser.id);
    try {
      await changeUserRole(targetUser.id, nextRole);
      toast.success(`Role updated for ${targetUser.email} to ${ROLE_LABELS[nextRole]}`);
      
      setUsers(prev =>
        prev.map(u => (u.id === targetUser.id ? { ...u, role: nextRole } : u))
      );

      if (targetUser.id === currentUser?.id) {
        await refreshMyPermissions();
      }
    } catch (err: any) {
      console.error('[UserDirectory] changeRole failed:', err);
      toast.error(
        err.code === '42501'
          ? 'Permission denied: Server refused role modification.'
          : err.message || 'Could not change role'
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Open Status Change Modal
  const openStatusModal = (userItem: UserDirectoryItem) => {
    setStatusModalUser(userItem);
    setStatusDraft(userItem.status);
    setStatusReason(userItem.status_reason || '');
  };

  // Submit Status Change
  const submitStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalUser) return;

    if (statusDraft !== 'active' && statusDraft !== 'invited' && !statusReason.trim()) {
      toast.error('Please provide a reason when suspending, disabling, or archiving an account.');
      return;
    }

    setIsSavingStatus(true);
    try {
      await changeUserStatus(statusModalUser.id, statusDraft, statusReason.trim());
      toast.success(`Account status for ${statusModalUser.email} updated to ${statusDraft.toUpperCase()}`);
      
      setUsers(prev =>
        prev.map(u =>
          u.id === statusModalUser.id
            ? { ...u, status: statusDraft, status_reason: statusReason.trim() }
            : u
        )
      );

      setStatusModalUser(null);
    } catch (err: any) {
      console.error('[UserDirectory] changeStatus failed:', err);
      toast.error(err?.message || 'Failed to update account status');
    } finally {
      setIsSavingStatus(false);
    }
  };

  // Open Link Modal
  const openLinkModal = (userItem: UserDirectoryItem) => {
    setLinkModalUser(userItem);
    const initialType = userItem.role === 'teacher' ? 'teacher' : userItem.role === 'student' ? 'student' : 'staff';
    setLinkType(initialType);
    setSelectedEntityId(null);
    setLinkSearch('');
  };

  // Load linkable candidate entities
  const loadCandidates = useCallback(async () => {
    if (!linkModalUser) return;
    setIsLoadingCandidates(true);
    try {
      const candidates = await fetchLinkableEntities(linkType, linkSearch.trim());
      setLinkCandidates(candidates);
    } catch (err: any) {
      console.error('[UserDirectory] fetchLinkableEntities failed:', err);
      toast.error('Failed to load candidate entities');
    } finally {
      setIsLoadingCandidates(false);
    }
  }, [linkModalUser, linkType, linkSearch]);

  useEffect(() => {
    if (linkModalUser) {
      loadCandidates();
    }
  }, [linkModalUser, linkType, loadCandidates]);

  // Submit Link Entity
  const submitLinkEntity = async () => {
    if (!linkModalUser || !selectedEntityId) {
      toast.error('Please select an entity to link.');
      return;
    }

    setIsSavingLink(true);
    try {
      await linkUserToEntity(linkModalUser.id, linkType, selectedEntityId);
      toast.success('User successfully linked to business entity!');
      setLinkModalUser(null);
      await loadDirectory();
    } catch (err: any) {
      console.error('[UserDirectory] linkEntity failed:', err);
      toast.error(err?.message || 'Failed to link entity');
    } finally {
      setIsSavingLink(false);
    }
  };

  // Handle Unlink Entity
  const handleUnlink = async (targetUser: UserDirectoryItem) => {
    if (!targetUser.linked_type || !targetUser.linked_id) return;

    const confirmed = window.confirm(
      `Are you sure you want to unlink ${targetUser.email} from ${targetUser.linked_label}? Neither record will be deleted.`
    );
    if (!confirmed) return;

    setUpdatingUserId(targetUser.id);
    try {
      await unlinkUserFromEntity(targetUser.linked_type, targetUser.linked_id);
      toast.success('Entity unlinked successfully');
      setUsers(prev =>
        prev.map(u =>
          u.id === targetUser.id
            ? { ...u, linked_type: null, linked_id: null, linked_label: null, linked_code: null }
            : u
        )
      );
    } catch (err: any) {
      console.error('[UserDirectory] unlink failed:', err);
      toast.error(err?.message || 'Failed to unlink entity');
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls Toolbar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">User Account Directory</h2>
            <p className="text-[11px] text-slate-500">
              Canonical ERP login accounts, role assignments, lifecycles, and linked business identities.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start">
          {canManageUsers && (
            <button
              onClick={() => setCreateOpen(true)}
              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
            >
              <UserPlus size={12} /> New account
            </button>
          )}
          <button
            onClick={loadDirectory}
            disabled={isLoading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 self-start disabled:opacity-50"
          >
            <RefreshCw size={12} className={cn(isLoading && 'animate-spin')} />
            Refresh
          </button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 pt-2 border-t border-slate-100">
          <div className="lg:col-span-5 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, email, admission #, employee #…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
            />
          </div>

          <div className="lg:col-span-2">
            <select
              value={roleFilter}
              onChange={e => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-violet-500"
            >
              <option value="all">All Roles</option>
              {ALL_ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-violet-500"
            >
              <option value="all">All Statuses</option>
              {ALL_STATUSES.map(st => (
                <option key={st} value={st}>{st.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <select
              value={linkedFilter}
              onChange={e => {
                setLinkedFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-violet-500"
            >
              <option value="all">All Entity Linkages</option>
              <option value="teacher">Linked Teachers</option>
              <option value="student">Linked Students</option>
              <option value="staff">Linked Staff</option>
              <option value="none">Unlinked Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      {isLoading && users.length === 0 ? (
        <SystemLoadingBlock message="Querying user directory…" />
      ) : error ? (
        <SystemErrorBlock message={error} onRetry={loadDirectory} />
      ) : (
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[850px]">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">User Account</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Lifecycle Status</th>
                  <th className="py-3 px-3">Linked Business Record</th>
                  <th className="py-3 px-3">Last Sign-In</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-slate-600">No matching user accounts found</p>
                      <p className="text-[11px] mt-0.5">Try adjusting your search query or filters.</p>
                    </td>
                  </tr>
                ) : (
                  users.map(u => {
                    const isSelf = u.id === currentUser?.id;
                    const isBusy = updatingUserId === u.id;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* User Identity */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">{u.name || 'Unnamed User'}</span>
                              {isSelf && (
                                <span className="px-1.5 py-0.2 rounded bg-violet-100 text-violet-700 text-[9px] font-black uppercase">
                                  YOU
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono">{u.email}</span>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <select
                              value={u.role}
                              disabled={!canManageUsers || isBusy}
                              onChange={e => handleRoleChange(u, e.target.value as AppRole)}
                              className={cn(
                                'text-xs py-1 px-2 rounded-lg border font-semibold outline-none transition-colors cursor-pointer',
                                PRIVILEGED_ROLES.has(u.role)
                                  ? 'bg-amber-50/80 border-amber-300 text-amber-900 font-bold'
                                  : 'bg-white border-slate-200 text-slate-700'
                              )}
                            >
                              {ALL_ROLES.map(r => (
                                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                              ))}
                            </select>
                            {isBusy && <Loader2 size={12} className="animate-spin text-slate-400" />}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <StatusBadge status={u.status} />
                            {canManageUsers && (
                              <button
                                onClick={() => openStatusModal(u)}
                                className="text-[10px] text-slate-400 hover:text-slate-700 font-bold underline"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Linked Entity */}
                        <td className="py-3 px-3">
                          <EntityBadge
                            type={u.linked_type}
                            label={u.linked_label}
                            code={u.linked_code}
                          />
                        </td>

                        {/* Last Sign-in */}
                        <td className="py-3 px-3">
                          {u.last_sign_in_at ? (
                            <div className="text-[11px] text-slate-600">
                              {new Date(u.last_sign_in_at).toLocaleDateString()}
                              <span className="text-[10px] text-slate-400 block">
                                {new Date(u.last_sign_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Never signed in</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {u.linked_type ? (
                              <button
                                onClick={() => handleUnlink(u)}
                                disabled={!canManageUsers || isBusy}
                                className="p-1.5 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors"
                                title="Unlink Business Entity"
                              >
                                <Unlink size={13} />
                              </button>
                            ) : (
                              <button
                                onClick={() => openLinkModal(u)}
                                disabled={!canManageUsers || isBusy}
                                className="px-2 py-1 rounded-lg border border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-slate-600 hover:text-violet-700 text-[11px] font-bold transition-colors inline-flex items-center gap-1"
                                title="Link to Teacher, Staff, or Student"
                              >
                                <LinkIcon size={11} /> Link Record
                              </button>
                            )}
                            {canManageUsers && (
                              <>
                                <button
                                  onClick={() => { setPwdUser(u); setNewPassword(''); }}
                                  disabled={isBusy}
                                  className="p-1.5 rounded-lg border border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-slate-500 hover:text-violet-700 transition-colors"
                                  title="Change password"
                                >
                                  <KeyRound size={13} />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  disabled={isBusy || u.id === currentUser?.id}
                                  className="p-1.5 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors disabled:opacity-40"
                                  title={u.id === currentUser?.id ? 'You cannot delete your own account' : 'Delete account'}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <PaginationBar
            totalCount={totalCount}
            pageSize={pageSize}
            currentPage={page}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* 4. MODAL: Account Lifecycle Status Change */}
      {statusModalUser && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Shield size={16} className="text-violet-600" />
                Change Account Status
              </div>
              <button
                onClick={() => setStatusModalUser(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submitStatusChange} className="space-y-4">
              <div>
                <span className="text-[11px] text-slate-500 block">Target Account:</span>
                <span className="text-xs font-bold text-slate-900">{statusModalUser.name}</span>
                <span className="text-[11px] text-slate-500 font-mono block">{statusModalUser.email}</span>
              </div>

              {PRIVILEGED_ROLES.has(statusModalUser.role) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                  <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Privileged Account Warning:</span> This account holds an administrative role ({ROLE_LABELS[statusModalUser.role]}). The database will reject this action if this is the last active administrator.
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 block">Account Status</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {ALL_STATUSES.map(st => (
                    <label
                      key={st}
                      className={cn(
                        'flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-colors',
                        statusDraft === st
                          ? 'border-violet-600 bg-violet-50/40 font-bold text-violet-900'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="status_choice"
                          value={st}
                          checked={statusDraft === st}
                          onChange={() => setStatusDraft(st)}
                          className="text-violet-600 focus:ring-0"
                        />
                        <span>{st.toUpperCase()}</span>
                      </div>
                      <StatusBadge status={st} />
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Reason for Change {statusDraft !== 'active' && <span className="text-rose-500">*</span>}
                </label>
                <textarea
                  rows={2}
                  value={statusReason}
                  onChange={e => setStatusReason(e.target.value)}
                  placeholder="Provide context for this status change (recorded in audit trail)…"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusModalUser(null)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingStatus}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingStatus ? <Loader2 size={13} className="animate-spin" /> : null}
                  Commit Status Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: Link User to Existing Business Entity */}
      {linkModalUser && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <LinkIcon size={16} className="text-indigo-600" />
                Link Account to Business Entity
              </div>
              <button
                onClick={() => setLinkModalUser(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[11px] text-slate-500 block">Connecting User Account:</span>
                <span className="text-xs font-bold text-slate-900">{linkModalUser.name}</span>
                <span className="text-[11px] text-slate-500 font-mono block">{linkModalUser.email}</span>
              </div>

              {/* Type Switcher */}
              <div className="flex gap-2">
                {(['teacher', 'staff', 'student'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setLinkType(t);
                      setSelectedEntityId(null);
                    }}
                    className={cn(
                      'flex-1 py-1.5 px-2 rounded-xl text-xs font-bold border transition-colors capitalize',
                      linkType === t
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    )}
                  >
                    {t}s
                  </button>
                ))}
              </div>

              {/* Search candidate records */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  type="text"
                  value={linkSearch}
                  onChange={e => setLinkSearch(e.target.value)}
                  placeholder={`Search unlinked ${linkType}s by name or code…`}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Candidate Selection Box */}
              <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                {isLoadingCandidates ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <Loader2 size={16} className="animate-spin mx-auto mb-1 text-indigo-600" />
                    Searching records…
                  </div>
                ) : linkCandidates.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No unlinked {linkType} records found matching that query.
                  </div>
                ) : (
                  linkCandidates.map(c => (
                    <div
                      key={c.id}
                      onClick={() => setSelectedEntityId(c.id)}
                      className={cn(
                        'p-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors',
                        selectedEntityId === c.id
                          ? 'bg-indigo-50/60 font-bold text-indigo-900'
                          : 'hover:bg-slate-50 text-slate-700'
                      )}
                    >
                      <div>
                        <div className="font-bold text-slate-800">{c.label}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ID: {c.code || 'N/A'} {c.detail ? `• ${c.detail}` : ''}
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="candidate"
                        checked={selectedEntityId === c.id}
                        onChange={() => setSelectedEntityId(c.id)}
                        className="text-indigo-600"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setLinkModalUser(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedEntityId || isSavingLink}
                onClick={submitLinkEntity}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingLink ? <Loader2 size={13} className="animate-spin" /> : null}
                Connect Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create account */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[3px] flex items-center justify-center p-4" onMouseDown={() => !isCreating && setCreateOpen(false)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-5 space-y-4" onMouseDown={e => e.stopPropagation()}>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Create login account</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">The account is confirmed immediately and can sign in straight away.</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</label>
                <input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="name@rajsdps.com" className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Full name</label>
                <input type="text" value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} placeholder="Kumari Anjali Singh" className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Role</label>
                <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as AppRole })} className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500">
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Temporary password</label>
                <input type="text" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="At least 8 characters" className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setCreateOpen(false)} disabled={isCreating} className="flex-1 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold disabled:opacity-50">Cancel</button>
              <button onClick={handleCreateUser} disabled={isCreating} className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
                {isCreating && <Loader2 size={13} className="animate-spin" />}
                {isCreating ? 'Creating…' : 'Create account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change password */}
      {pwdUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[3px] flex items-center justify-center p-4" onMouseDown={() => !isSavingPwd && setPwdUser(null)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-5 space-y-4" onMouseDown={e => e.stopPropagation()}>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Change password</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{pwdUser.email}</p>
            </div>
            <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password, at least 8 characters" className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
            <div className="flex gap-2">
              <button onClick={() => setPwdUser(null)} disabled={isSavingPwd} className="flex-1 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold disabled:opacity-50">Cancel</button>
              <button onClick={handleResetPassword} disabled={isSavingPwd} className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
                {isSavingPwd && <Loader2 size={13} className="animate-spin" />}
                {isSavingPwd ? 'Saving…' : 'Update password'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
