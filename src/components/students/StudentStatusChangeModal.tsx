import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, UserMinus, AlertTriangle, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';
import { Student, StudentStatus } from '@/types/student';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface StudentStatusChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  onSuccess: () => void;
}

const STATUS_OPTIONS: { value: StudentStatus; label: string; description: string; color: string }[] = [
  { value: 'active', label: 'Active (On Roll)', description: 'Student is actively enrolled and attending classes.', color: 'border-emerald-500 bg-emerald-50 text-emerald-800' },
  { value: 'transferred', label: 'Transferred (TC Issued)', description: 'Student has moved to another institution; historical marks/fees retained.', color: 'border-sky-500 bg-sky-50 text-sky-800' },
  { value: 'graduated', label: 'Graduated / Alumni', description: 'Student successfully completed final academic grade.', color: 'border-violet-500 bg-violet-50 text-violet-800' },
  { value: 'withdrawn', label: 'Withdrawn by Parent', description: 'Student was formally withdrawn from the school by parent/guardian request.', color: 'border-rose-500 bg-rose-50 text-rose-800' },
  { value: 'inactive', label: 'Inactive / Suspended', description: 'Student is on extended leave or temporarily suspended.', color: 'border-slate-500 bg-slate-50 text-slate-800' },
];

export default function StudentStatusChangeModal({
  isOpen,
  onClose,
  student,
  onSuccess
}: StudentStatusChangeModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<StudentStatus>(student?.status ?? 'active');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !student) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStatus === student.status) {
      toast.info('No status change selected.');
      onClose();
      return;
    }

    if (selectedStatus !== 'active' && !reason.trim()) {
      toast.error('Please specify a reason for this status change for the audit log.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc('set_student_status', {
        _student_id: student.id,
        _status: selectedStatus,
        _reason: reason.trim() || 'Status updated via SIS console',
      });

      if (error) throw error;

      toast.success(`Student status updated to ${selectedStatus.toUpperCase()}.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[StudentStatusChangeModal] Error:', err);
      toast.error(
        err.code === '42501'
          ? 'You do not have permission to alter a student’s status.'
          : err.message || 'Status transition failed.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div key={student.id} className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden border border-slate-200 flex flex-col"
        >
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold">
                <UserMinus size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Student Lifecycle Status Change</h3>
                <p className="text-[11px] text-slate-500">{student.name} ({student.admission_number})</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Current Placement</span>
                <span className="font-bold text-slate-800">Class {student.class} - {student.section}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Current Status</span>
                <span className="font-black uppercase text-violet-700">{student.status}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Select Target Status
              </label>
              <div className="space-y-2">
                {STATUS_OPTIONS.map((opt) => {
                  const isSelected = selectedStatus === opt.value;
                  return (
                    <label
                      key={opt.value}
                      onClick={() => setSelectedStatus(opt.value)}
                      className={`p-3 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                        isSelected
                          ? `${opt.color} ring-2 ring-violet-500/20 shadow-xs`
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="student-status"
                        checked={isSelected}
                        onChange={() => setSelectedStatus(opt.value)}
                        className="mt-1 text-violet-600 focus:ring-violet-500"
                      />
                      <div className="flex-1">
                        <div className="font-bold text-xs">{opt.label}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{opt.description}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Reason / Remarks for Audit Trail {selectedStatus !== 'active' && <span className="text-rose-500">*</span>}
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. TC issued for relocation to Lucknow; Fees cleared; Character Certificate issued."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
              />
            </div>
          </div>

            <div className="shrink-0 flex gap-2 px-6 py-4 border-t border-slate-100 bg-white">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 size={14} />}
                <span>Apply Status Change</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
