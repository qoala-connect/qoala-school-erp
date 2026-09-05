import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdmissionStatus } from '@/types/admission';

/* ------------------------------------------------------------------ *
 * Shared presentation layer for the Admissions module.
 * Keeps status colours, form controls and dialog chrome identical
 * across the pipeline table, drawer and every modal.
 * ------------------------------------------------------------------ */

type Tone = 'slate' | 'amber' | 'indigo' | 'emerald' | 'rose' | 'violet';

const TONE_CLASSES: Record<Tone, string> = {
  slate: 'bg-slate-50 text-slate-600 border-slate-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
};

export const STATUS_META: Record<AdmissionStatus, { label: string; tone: Tone }> = {
  'Pending': { label: 'Pending', tone: 'amber' },
  'In Review': { label: 'In Review', tone: 'indigo' },
  'Under Review': { label: 'Under Review', tone: 'indigo' },
  'Interview Scheduled': { label: 'Interview Scheduled', tone: 'indigo' },
  'Documents Verification': { label: 'Docs Verification', tone: 'indigo' },
  'Approved': { label: 'Approved', tone: 'emerald' },
  'Student Created': { label: 'Enrolled', tone: 'emerald' },
  'Waitlisted': { label: 'Waitlisted', tone: 'violet' },
  'Rejected': { label: 'Rejected', tone: 'rose' },
  'Withdrawn': { label: 'Withdrawn', tone: 'slate' },
  'Cancelled': { label: 'Cancelled', tone: 'rose' },
};

export function statusTone(status: AdmissionStatus): string {
  return TONE_CLASSES[STATUS_META[status]?.tone ?? 'amber'];
}

export function StatusBadge({
  status,
  className,
  size = 'md',
}: {
  status: AdmissionStatus;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const meta = STATUS_META[status] ?? { label: status, tone: 'amber' as Tone };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
        TONE_CLASSES[meta.tone],
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/** Applicant avatar — photo when available, initial otherwise. */
export function Avatar({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center font-semibold shrink-0 overflow-hidden',
        className || 'w-9 h-9 text-sm'
      )}
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        (name || '?').charAt(0).toUpperCase()
      )}
    </div>
  );
}

/* --------------------------- Form controls --------------------------- */

export const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5';

export const controlCls =
  'w-full rounded-2xl border border-slate-200/90 bg-slate-50/60 px-4 py-2.5 text-sm font-semibold text-slate-800 ' +
  'placeholder:font-normal placeholder:text-slate-400 outline-none transition-all duration-200 shadow-xs ' +
  'hover:bg-white hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 disabled:opacity-60';

export const inputCls = controlCls;
export const selectCls = cn(
  controlCls,
  'cursor-pointer pr-10 appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%23475569%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E")] bg-[length:1.15rem_1.15rem] bg-[right_0.85rem_center] bg-no-repeat'
);
export const textareaCls = cn(controlCls, 'resize-none leading-relaxed min-h-[90px]');

/** Compact control used inside toolbars and filter rows. */
export const filterCls =
  'rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 ' +
  'outline-none transition-all cursor-pointer hover:border-slate-300 shadow-xs ' +
  'focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10';

/** Applied to an input/select/textarea whose value failed validation. */
export const errorControlCls =
  'border-rose-400 bg-rose-50/50 focus:border-rose-600 focus:ring-rose-500/15';

export function Field({
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <label className={cn(labelCls, error && 'text-rose-600')}>
        {label} {required && <span className="text-rose-500 font-bold">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 mt-1">
          <span aria-hidden="true">•</span> {error}
        </p>
      ) : (
        hint && <p className="text-[11px] text-slate-400 leading-relaxed mt-1">{hint}</p>
      )}
    </div>
  );
}

/** Grouped block of related fields inside a form or detail view. */
export function SectionBlock({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-5', className)}>
      <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
        {Icon && (
          <span className="mt-0.5 p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200/80 shrink-0">
            <Icon className="w-4 h-4" />
          </span>
        )}
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight font-sans">{title}</h3>
          {description && <p className="text-xs text-slate-500 mt-0.5 font-medium">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Read-only label/value pair used in detail panels. */
export function DetailItem({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value?: React.ReactNode;
  icon?: React.ElementType;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 block">{label}</span>
      <span className="text-[13px] font-semibold text-slate-800 flex items-start gap-1.5 mt-0.5 break-words">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />}
        {value || <span className="font-normal text-slate-400">Not provided</span>}
      </span>
    </div>
  );
}

/* --------------------------- Dialog chrome --------------------------- */

/** Closes on Escape and locks background scroll while open. */
export function useDialogBehaviour(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);
}

const SIZE_CLASSES: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
};

/**
 * Standard modal frame: light header with icon tile, scrollable body and
 * a pinned footer. Closes on Escape, backdrop click and the X button.
 */
export function ModalShell({
  isOpen,
  onClose,
  icon: Icon,
  title,
  subtitle,
  size = 'lg',
  tone = 'violet',
  headerActions,
  subHeader,
  footer,
  children,
  bodyClassName,
  contentClassName,
  align = 'center',
}: {
  isOpen: boolean;
  onClose: () => void;
  icon?: React.ElementType;
  title: string;
  subtitle?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  tone?: Tone;
  headerActions?: React.ReactNode;
  subHeader?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
  contentClassName?: string;
  align?: 'center' | 'start';
}) {
  useDialogBehaviour(isOpen, onClose);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={onClose}
          className={cn(
            'fixed inset-0 z-50 flex justify-center overflow-y-auto bg-slate-950/60 backdrop-blur-md p-3 sm:p-6',
            align === 'center' ? 'items-center' : 'items-start'
          )}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 14 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onMouseDown={(e) => e.stopPropagation()}
            className={cn(
              'bg-white border border-slate-200/90 rounded-3xl w-full shadow-2xl shadow-blue-950/20 overflow-hidden flex flex-col max-h-[92vh] my-auto',
              SIZE_CLASSES[size],
              contentClassName
            )}
          >
            {/* Top Multi-Color Institutional Accent Stripe */}
            <div className="h-1.5 w-full bg-gradient-to-r from-blue-700 via-amber-400 to-emerald-500 shrink-0" />

            <header className="flex items-start justify-between gap-4 px-5 sm:px-7 py-4.5 border-b border-slate-100 bg-slate-50/60 shrink-0">
              <div className="flex items-center gap-3.5 min-w-0">
                {Icon && (
                  <span className="p-2.5 rounded-2xl bg-white border border-slate-200 shadow-sm text-blue-800 shrink-0 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-blue-700" />
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate font-sans">
                    {title}
                  </h2>
                  {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate font-medium">{subtitle}</p>}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {headerActions}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </header>

            {subHeader && <div className="shrink-0 border-b border-slate-100 bg-white">{subHeader}</div>}

            <div className={cn('flex-1 overflow-y-auto custom-scrollbar px-5 sm:px-7 py-6', bodyClassName)}>
              {children}
            </div>

            {footer && (
              <footer className="px-5 sm:px-7 py-4 border-t border-slate-100 bg-slate-50/90 shrink-0">
                {footer}
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Renders children at document.body level — used so print CSS can isolate a document. */
export function BodyPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
