import React from 'react';
import { Search, X, SlidersHorizontal, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterOption {
  label: string;
  value: string;
}

interface FilterSelect {
  id: string;
  label?: string;
  value: string;
  onChange: (val: string) => void;
  options: FilterOption[];
  icon?: any;
}

interface AdminToolbarProps {
  search?: {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
  };
  filters?: FilterSelect[];
  extraFiltersToggle?: {
    isOpen: boolean;
    onToggle: () => void;
    activeCount?: number;
  };
  onRefresh?: () => void;
  isRefreshing?: boolean;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function AdminToolbar({
  search,
  filters = [],
  extraFiltersToggle,
  onRefresh,
  isRefreshing,
  actions,
  children,
  className
}: AdminToolbarProps) {
  return (
    <div className={cn(
      "bg-white border border-slate-200/80 p-3 rounded-2xl shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3",
      className
    )}>
      {/* Left side: Search & Dropdowns */}
      <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
        {search && (
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder || "Search records..."}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
            {search.value && (
              <button
                type="button"
                onClick={() => search.onChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {filters.map((f) => (
          <select
            key={f.id}
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer focus:border-blue-500 focus:bg-white transition-all shrink-0"
          >
            {f.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}

        {extraFiltersToggle && (
          <button
            type="button"
            onClick={extraFiltersToggle.onToggle}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer",
              extraFiltersToggle.isOpen || (extraFiltersToggle.activeCount && extraFiltersToggle.activeCount > 0)
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100"
            )}
          >
            <SlidersHorizontal size={13} />
            <span>Filters</span>
            {extraFiltersToggle.activeCount && extraFiltersToggle.activeCount > 0 ? (
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] flex items-center justify-center font-black">
                {extraFiltersToggle.activeCount}
              </span>
            ) : null}
          </button>
        )}

        {children}
      </div>

      {/* Right side: Actions & Refresh */}
      <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-slate-200/80 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCcw size={14} className={cn(isRefreshing && "animate-spin text-blue-600")} />
          </button>
        )}
        {actions}
      </div>
    </div>
  );
}

export default AdminToolbar;
