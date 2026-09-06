import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  badge?: {
    icon?: LucideIcon;
    text: string;
    variant?: 'primary' | 'violet' | 'emerald' | 'amber' | 'neutral' | 'rose' | 'sky';
  };
  sessionBadge?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const BADGE_VARIANTS = {
  primary: 'bg-blue-50 text-blue-700 border-blue-100',
  violet: 'bg-violet-50 text-violet-700 border-violet-100',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  rose: 'bg-rose-50 text-rose-700 border-rose-100',
  sky: 'bg-sky-50 text-sky-700 border-sky-100',
  neutral: 'bg-slate-50 text-slate-700 border-slate-200/80',
};

export function AdminHeader({
  title,
  subtitle,
  badge,
  sessionBadge,
  actions,
  children,
  className
}: AdminHeaderProps) {
  const BadgeIcon = badge?.icon;
  const badgeStyle = BADGE_VARIANTS[badge?.variant || 'primary'];

  return (
    <div className={cn(
      "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs",
      className
    )}>
      <div className="min-w-0">
        {(badge || sessionBadge) && (
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {badge && (
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1",
                badgeStyle
              )}>
                {BadgeIcon && <BadgeIcon size={11} className="shrink-0" />}
                <span>{badge.text}</span>
              </span>
            )}
            {badge && sessionBadge && <span className="text-slate-300">•</span>}
            {sessionBadge && (
              <span className="text-[11px] font-mono text-slate-500 font-semibold">
                Session: {sessionBadge.replace(/^Session:\s*/i, '')}
              </span>
            )}
          </div>
        )}
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-slate-500 text-xs mt-0.5 max-w-3xl leading-relaxed">
            {subtitle}
          </p>
        )}
        {children}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}

export default AdminHeader;
