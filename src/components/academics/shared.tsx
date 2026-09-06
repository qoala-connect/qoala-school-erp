import React from 'react';
import { AlertTriangle, Loader2, Inbox, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The pieces every Academics view needs, in one place so the six views
 * do not each grow their own slightly different loading spinner, empty
 * message and error banner.
 */

// ---------------------------------------------------------------------
// Loading, empty and error
// ---------------------------------------------------------------------

export function LoadingBlock({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3" role="status" aria-live="polite">
      <Loader2 className="w-6 h-6 text-violet-500 animate-spin" aria-hidden="true" />
      <p className="text-xs font-semibold text-slate-400">{label}…</p>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 px-6 text-center" role="alert">
      <div className="p-3 rounded-xl bg-rose-50 border border-rose-100">
        <AlertTriangle className="w-5 h-5 text-rose-600" aria-hidden="true" />
      </div>
      <p className="text-sm font-bold text-slate-800">That did not load</p>
      <p className="text-xs text-slate-500 max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 px-4 h-[34px] rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyBlock({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: any;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 px-6 text-center">
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
        <Icon className="w-5 h-5 text-slate-400" aria-hidden="true" />
      </div>
      <p className="text-sm font-bold text-slate-800">{title}</p>
      <p className="text-xs text-slate-500 max-w-md">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-1 px-4 h-[34px] rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/** Chooses between loading, error, empty and the real content. */
export function AsyncBlock({
  isLoading,
  error,
  isEmpty,
  onRetry,
  loadingLabel,
  empty,
  children,
}: {
  isLoading: boolean;
  error: string | null;
  isEmpty: boolean;
  onRetry?: () => void;
  loadingLabel?: string;
  empty: React.ReactNode;
  children: React.ReactNode;
}) {
  if (isLoading) return <LoadingBlock label={loadingLabel} />;
  if (error) return <ErrorBlock message={error} onRetry={onRetry} />;
  if (isEmpty) return <>{empty}</>;
  return <>{children}</>;
}

// ---------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('bg-white border border-slate-200/70 rounded-2xl shadow-xs overflow-hidden', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">{title}</h2>}
            {description && <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>}
          </div>
          {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/**
 * A table that scrolls inside its own box.
 *
 * Wide academic tables must never push the page sideways, which is the
 * failure mode on a tablet in portrait.
 */
export function TableScroll({ children, minWidth = 760 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, align = 'left', className }: { children?: React.ReactNode; align?: 'left' | 'center' | 'right'; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        'py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        className
      )}
    >
      {children}
    </th>
  );
}

export function StatusPill({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'muted' | 'info'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border whitespace-nowrap',
        tone === 'good' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
        tone === 'warn' && 'bg-amber-50 text-amber-700 border-amber-200',
        tone === 'bad' && 'bg-rose-50 text-rose-700 border-rose-200',
        tone === 'info' && 'bg-violet-50 text-violet-700 border-violet-200',
        tone === 'muted' && 'bg-slate-100 text-slate-500 border-slate-200'
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------

export function PrimaryButton({
  children, onClick, disabled, type = 'button', className,
}: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  type?: 'button' | 'submit'; className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 px-4 h-[36px] rounded-xl bg-violet-600 text-white text-xs font-bold',
        'hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600',
        'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
        className
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children, onClick, disabled, title, type = 'button', className,
}: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  title?: string; type?: 'button' | 'submit'; className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 px-3.5 h-[36px] rounded-xl border border-slate-200 bg-white',
        'text-slate-600 text-xs font-bold hover:bg-slate-50 hover:text-slate-900',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600',
        'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
        className
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children, onClick, label, tone = 'neutral', disabled,
}: {
  children: React.ReactNode; onClick: () => void; label: string;
  tone?: 'neutral' | 'danger'; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'p-1.5 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        tone === 'danger'
          ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
          : 'text-slate-400 hover:text-violet-600 hover:bg-violet-50'
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------
// Modal and form fields
// ---------------------------------------------------------------------

export function Modal({
  title, description, onClose, children, footer, wide,
}: {
  title: string; description?: string; onClose: () => void;
  children: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  // Escape closes, and focus moves into the dialog on open, so the
  // keyboard path matches the mouse path.
  const ref = React.useRef<HTMLDivElement>(null);

  // Callers pass an inline arrow for onClose, so its identity changes on
  // every render. Read it through a ref so neither effect below depends on
  // it — re-running them per keystroke would tear the Escape listener down
  // and, worse, pull focus back to the dialog out of the field being typed in.
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  // Focus the dialog once, when it opens — never again.
  React.useEffect(() => { ref.current?.focus(); }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4">
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'bg-white w-full rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200 outline-none',
          'max-h-[92vh] flex flex-col',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        )}
      >
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">{title}</h2>
            {description && <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>}
          </div>
          <IconButton onClick={onClose} label="Close"><X size={16} /></IconButton>
        </header>

        <div className="px-5 py-4 overflow-y-auto grow">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-100 bg-slate-50/60">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export function Field({
  label, htmlFor, hint, error, children, className,
}: {
  label: string; htmlFor: string; hint?: string; error?: string;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
        {label}
      </label>
      {children}
      {error
        ? <p id={`${htmlFor}-error`} role="alert" className="text-[11px] font-semibold text-rose-600">{error}</p>
        : hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'w-full bg-white border border-slate-200 rounded-xl h-[38px] px-3 text-xs font-medium text-slate-800 ' +
  'outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 transition-all ' +
  'aria-[invalid=true]:border-rose-400 aria-[invalid=true]:ring-rose-500/15';

export const selectClass = inputClass + ' cursor-pointer';
