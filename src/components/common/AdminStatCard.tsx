import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminStatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  variant?: 'primary' | 'violet' | 'emerald' | 'amber' | 'rose' | 'sky';
  badge?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  onClick?: () => void;
  className?: string;
}

const STAT_VARIANTS = {
  primary: {
    iconBg: 'bg-blue-50 text-blue-600 border-blue-100',
    topBar: 'bg-blue-500',
    hoverBorder: 'hover:border-blue-300 hover:shadow-blue-500/5'
  },
  violet: {
    iconBg: 'bg-violet-50 text-violet-600 border-violet-100',
    topBar: 'bg-violet-500',
    hoverBorder: 'hover:border-violet-300 hover:shadow-violet-500/5'
  },
  emerald: {
    iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    topBar: 'bg-emerald-500',
    hoverBorder: 'hover:border-emerald-300 hover:shadow-emerald-500/5'
  },
  amber: {
    iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
    topBar: 'bg-amber-500',
    hoverBorder: 'hover:border-amber-300 hover:shadow-amber-500/5'
  },
  rose: {
    iconBg: 'bg-rose-50 text-rose-600 border-rose-100',
    topBar: 'bg-rose-500',
    hoverBorder: 'hover:border-rose-300 hover:shadow-rose-500/5'
  },
  sky: {
    iconBg: 'bg-sky-50 text-sky-600 border-sky-100',
    topBar: 'bg-sky-500',
    hoverBorder: 'hover:border-sky-300 hover:shadow-sky-500/5'
  }
};

export function AdminStatCard({
  label,
  value,
  subtext,
  icon: Icon,
  variant = 'primary',
  badge,
  trend,
  onClick,
  className
}: AdminStatCardProps) {
  const styles = STAT_VARIANTS[variant] || STAT_VARIANTS.primary;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-4.5 shadow-2xs flex flex-col justify-between transition-all duration-200 overflow-hidden",
        onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : "",
        styles.hoverBorder,
        className
      )}
    >
      {/* Top subtle micro-accent bar */}
      <div className={cn("absolute top-0 left-0 right-0 h-[2.5px] opacity-80 group-hover:opacity-100 transition-opacity", styles.topBar)} />

      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold font-sans text-slate-500 truncate tracking-tight">
          {label}
        </span>
        <div className={cn("p-2 rounded-xl border shrink-0 transition-transform duration-200 group-hover:scale-105", styles.iconBg)}>
          <Icon size={16} />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-xl sm:text-2xl font-bold font-sans text-slate-900 leading-tight tracking-tight tabular-nums">
            {value}
          </div>
          {badge && (
            <span className="text-[10px] font-bold font-sans px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60 shrink-0">
              {badge}
            </span>
          )}
          {trend && (
            <span className={cn(
              "text-[10px] font-bold font-sans px-2 py-0.5 rounded-md border shrink-0",
              trend.isPositive ? "bg-emerald-50 text-emerald-700 border-emerald-200/60" : "bg-rose-50 text-rose-700 border-rose-200/60"
            )}>
              {trend.isPositive ? '↑ ' : '↓ '}{trend.value}
            </span>
          )}
        </div>
        {subtext && (
          <p className="text-[11px] font-sans text-slate-500 font-medium truncate">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}

export default AdminStatCard;
