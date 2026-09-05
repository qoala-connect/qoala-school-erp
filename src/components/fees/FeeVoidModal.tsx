import React, { useState } from 'react';
import { X, AlertTriangle, Loader2, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { feeService } from '@/services/feeService';

interface FeeVoidModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: any;
  onSuccess: () => void;
}

export default function FeeVoidModal({
  isOpen,
  onClose,
  payment,
  onSuccess
}: FeeVoidModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !payment) return null;

  const receiptNo = payment.receipt_number || payment.receiptNumber || 'N/A';
  const amount = Number(payment.amount_paid || payment.amount || 0);
  const studentName = payment.student_fees?.students?.name || payment.students?.name || 'Student';

  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('A clear reason is required to void a payment.');
      return;
    }

    setIsSubmitting(true);
    toast.loading('Voiding payment transaction...', { id: 'void-tx' });

    try {
      await feeService.voidPayment(payment.id, reason.trim());
      toast.success(`Receipt ${receiptNo} voided. The ledger balance has been restored.`, { id: 'void-tx' });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[FeeVoidModal] Error:', err);
      toast.error(
        err.code === '42501'
          ? 'You do not have permission to void fee payments.'
          : err.message || 'Failed to void payment.',
        { id: 'void-tx' }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200 overflow-y-auto max-h-[90vh]">
        
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5 text-rose-600">
            <div className="p-2 bg-rose-50 rounded-xl border border-rose-100">
              <Ban className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Void Fee Payment Receipt</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-3.5 space-y-2 text-xs">
          <div className="flex items-start gap-2 text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="font-medium leading-relaxed">
              Voiding this transaction will mark Receipt <strong className="font-mono">{receiptNo}</strong> as reversed in the permanent audit trail and re-open the outstanding balance for <strong>{studentName}</strong>.
            </p>
          </div>

          <div className="flex justify-between items-center bg-white/80 p-2.5 rounded-xl border border-rose-100 font-mono text-xs">
            <span className="text-slate-500">Amount to reverse:</span>
            <span className="font-bold text-rose-700 text-sm">₹{amount.toFixed(2)}</span>
          </div>
        </div>

        <form onSubmit={handleVoid} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Reason for Void / Cancellation <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Cashier error, cheque bounced, duplicate entry recorded..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
              Confirm Void
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
