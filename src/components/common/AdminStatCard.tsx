import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminStatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  variant?: 'primary' | 'violet' | 'emerald' | 'amber' | 'rose' | 'sky';
  trend?: {
    value: string;
    isPositive: boolean;
  };
  onClick?: () => void;
  className?: string;
}

const STAT_VARIANTS = {
  primary: {
    iconBg: 'bg-blue-50 text-blue-700 border-blue-100',
    hoverBorder: 'hover:border-blue-300'
  },
  violet: {
    iconBg: 'bg-violet-50 text-violet-700 border-violet-100',
    hoverBorder: 'hover:border-violet-300'
  },
  emerald: {
    iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    hoverBorder: 'hover:border-emerald-300'
  },
  amber: {
    iconBg: 'bg-amber-50 text-amber-700 border-amber-100',
    hoverBorder: 'hover:border-amber-300'
  },
  rose: {
    iconBg: 'bg-rose-50 text-rose-700 border-rose-100',
    hoverBorder: 'hover:border-rose-300'
  },
  sky: {
    iconBg: 'bg-sky-50 text-sky-700 border-sky-100',
    hoverBorder: 'hover:border-sky-300'
  }
};

export function AdminStatCard({
  label,
  value,
  subtext,
  icon: Icon,
  variant = 'primary',
  trend,
  onClick,
  className
}: AdminStatCardProps) {
  const styles = STAT_VARIANTS[variant] || STAT_VARIANTS.primary;

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between transition-all duration-200",
        onClick && cn("cursor-pointer hover:shadow-xs", styles.hoverBorder),
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-slate-500 truncate">
          {label}
        </span>
        <div className={cn("p-1.5 rounded-lg border shrink-0", styles.iconBg)}>
          <Icon size={16} />
        </div>
      </div>

      <div>
        <div className="flex items-baseline gap-2">
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
            {value}
          </h3>
          {trend && (
            <span className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              trend.isPositive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            )}>
              {trend.isPositive ? '+' : ''}{trend.value}
            </span>
          )}
        </div>
        {subtext && (
          <p className="text-xs text-slate-500 font-normal mt-1 truncate">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}

export default AdminStatCard;
