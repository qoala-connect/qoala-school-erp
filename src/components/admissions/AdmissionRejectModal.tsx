import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { AdmissionRecord } from '@/types/admission';
import { admissionService } from '@/services/admissionService';
import { toast } from 'sonner';
import { ModalShell, Field, textareaCls } from './AdmissionUI';

interface AdmissionRejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  admission: AdmissionRecord | null;
  onSuccess: () => Promise<void>;
}

const QUICK_REASONS = [
  'Age eligibility criteria not met',
  'Required documents incomplete',
  'Seat quota full for this class',
  'Did not appear for assessment',
];

export default function AdmissionRejectModal({
  isOpen,
  onClose,
  admission,
  onSuccess
}: AdmissionRejectModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admission) return;
    if (!reason.trim()) {
      toast.error('Please enter a specific reason for rejecting the application.');
      return;
    }

    setIsSubmitting(true);
    try {
      await admissionService.rejectAdmission(admission.id, reason.trim());
      toast.success(`Application for ${admission.name} has been rejected.`);
      setReason('');
      onClose();
      await onSuccess();
    } catch (err: any) {
      toast.error('Failed to reject application: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen && !!admission}
      onClose={onClose}
      icon={AlertTriangle}
      tone="rose"
      size="sm"
      title="Reject application"
      subtitle={admission ? `${admission.name} · Class ${admission.class}` : undefined}
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="admission-reject-form"
            disabled={isSubmitting || !reason.trim()}
            className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[13px] font-semibold shadow-sm shadow-rose-500/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm rejection
          </button>
        </div>
      }
    >
      <form id="admission-reject-form" onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Rejection reason"
          required
          hint="Recorded permanently in the application audit trail."
        >
          <textarea
            rows={4}
            required
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this application is being rejected…"
            className={textareaCls}
          />
        </Field>

        <div className="space-y-2">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Common reasons</span>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_REASONS.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 text-slate-600 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
