import React from 'react';
import { cn } from '@/lib/utils';
import { AppRole, ROLE_LABELS } from '@/context/AuthContext';
import { AccountStatus } from '@/services/systemService';
import { 
  Shield, 
  ShieldAlert, 
  UserCheck, 
  UserX, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw
} from 'lucide-react';

export const PRIVILEGED_ROLES: ReadonlySet<AppRole> = new Set<AppRole>([
  'super_admin',
  'admin',
  'principal',
]);

export function RoleBadge({ role }: { role: AppRole }) {
  const isPrivileged = PRIVILEGED_ROLES.has(role);
  const isSuper = role === 'super_admin';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-tight',
        isSuper
          ? 'bg-purple-100 text-purple-800 border border-purple-200'
          : isPrivileged
          ? 'bg-amber-100 text-amber-800 border border-amber-200'
          : 'bg-slate-100 text-slate-700 border border-slate-200'
      )}
    >
      {isPrivileged ? <Shield size={10} className="shrink-0" /> : null}
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

export function StatusBadge({ status }: { status: AccountStatus }) {
  switch (status) {
    case 'active':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 size={10} /> Active
        </span>
      );
    case 'invited':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
          <Clock size={10} /> Invited
        </span>
      );
    case 'suspended':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
          <AlertCircle size={10} /> Suspended
        </span>
      );
    case 'disabled':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
          <UserX size={10} /> Disabled
        </span>
      );
    case 'archived':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-300">
          <UserX size={10} /> Archived
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
          {status}
        </span>
      );
  }
}

export function EntityBadge({
  type,
  label,
  code,
}: {
  type: 'teacher' | 'student' | 'staff' | null;
  label: string | null;
  code: string | null;
}) {
  if (!type || !label) {
    return <span className="text-slate-400 text-xs italic">Unlinked</span>;
  }

  const typeConfig = {
    teacher: { label: 'Teacher', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    student: { label: 'Student', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    staff: { label: 'Staff', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  }[type];

  return (
    <div className="flex flex-col items-start gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className={cn('px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider border', typeConfig.bg)}>
          {typeConfig.label}
        </span>
        <span className="text-xs font-semibold text-slate-800">{label}</span>
      </div>
      {code && <span className="text-[10px] text-slate-400 font-mono">ID: {code}</span>}
    </div>
  );
}

export function PaginationBar({
  totalCount,
  pageSize,
  currentPage,
  onPageChange,
  isLoading,
}: {
  totalCount: number;
  pageSize: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalCount, currentPage * pageSize);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-100 text-xs">
      <div className="text-slate-500 font-medium">
        Showing <span className="font-bold text-slate-800">{startItem}</span> to{' '}
        <span className="font-bold text-slate-800">{endItem}</span> of{' '}
        <span className="font-bold text-slate-800">{totalCount}</span> entries
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isLoading}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="px-3 py-1 font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || isLoading}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export function SystemLoadingBlock({ message = 'Loading administrative data…' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200/80 p-8 text-center">
      <Loader2 className="w-8 h-8 text-violet-600 animate-spin mb-3" />
      <p className="text-xs font-bold text-slate-700">{message}</p>
      <p className="text-[11px] text-slate-400 mt-1">Verifying server-side security policies…</p>
    </div>
  );
}

export function SystemErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center max-w-lg mx-auto my-8 shadow-xs">
      <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3">
        <ShieldAlert size={24} />
      </div>
      <h3 className="text-sm font-bold text-slate-900 mb-1">Administrative Request Error</h3>
      <p className="text-xs text-slate-500 mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
        >
          <RefreshCw size={13} /> Try again
        </button>
      )}
    </div>
  );
}
