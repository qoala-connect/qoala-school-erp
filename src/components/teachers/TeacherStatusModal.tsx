import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  X, AlertTriangle, ShieldAlert, CheckCircle2, 
  Archive, UserCheck, Clock, UserX, Loader2, Save
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Teacher, TeacherLifecycleStatus, changeTeacherStatus } from '@/services/teacherService';

interface TeacherStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: Teacher | null;
  onUpdated: () => void;
}

const STATUS_CONFIG: Record<TeacherLifecycleStatus, { label: string; desc: string; color: string; icon: any }> = {
  'Active': { label: 'Active', desc: 'Full academic permissions & duties active', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  'Draft': { label: 'Draft', desc: 'Onboarding in progress, not yet deployed', color: 'text-slate-700 bg-slate-50 border-slate-200', icon: Clock },
  'On Leave': { label: 'On Leave', desc: 'Temporarily relieved of daily duties', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: Clock },
  'Inactive': { label: 'Inactive', desc: 'Suspended or temporarily unavailable', color: 'text-rose-700 bg-rose-50 border-rose-200', icon: UserX },
  'Transferred': { label: 'Transferred', desc: 'Relocated to affiliated branch/school', color: 'text-indigo-700 bg-indigo-50 border-indigo-200', icon: UserCheck },
  'Resigned': { label: 'Resigned', desc: 'Employment concluded voluntarily', color: 'text-slate-700 bg-slate-100 border-slate-300', icon: UserX },
  'Retired': { label: 'Retired', desc: 'Completed service; emeritus status', color: 'text-purple-700 bg-purple-50 border-purple-200', icon: UserCheck },
  'Archived': { label: 'Archived', desc: 'Preserved historical record only', color: 'text-slate-500 bg-slate-100 border-slate-300', icon: Archive },
};

export default function TeacherStatusModal({
  isOpen,
  onClose,
  teacher,
  onUpdated
}: TeacherStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<TeacherLifecycleStatus>(teacher?.status || 'Active');
  const [isUpdating, setIsUpdating] = useState(false);

  React.useEffect(() => {
    if (teacher) setSelectedStatus(teacher.status);
  }, [teacher]);

  if (!isOpen || !teacher) return null;

  const handleStatusSubmit = async () => {
    setIsUpdating(true);
    const toastId = toast.loading(`Updating lifecycle status for ${teacher.name}...`);

    try {
      await changeTeacherStatus(teacher.id, selectedStatus);
      toast.success(`Status updated to ${selectedStatus}`, { id: toastId });
      onUpdated();
      onClose();
    } catch (err: any) {
      toast.error('Status update failed: ' + err.message, { id: toastId });
    } finally {
      setIsUpdating(false);
    }
  };

  const isDeactivating = selectedStatus === 'Archived' || selectedStatus === 'Resigned' || selectedStatus === 'Retired' || selectedStatus === 'Inactive';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white border border-slate-200 shadow-2xl rounded-3xl w-full max-w-md overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/30 border border-amber-400/30 rounded-xl text-amber-300">
              <ShieldAlert size={18} />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-sm tracking-tight text-white">
                Update Faculty Status
              </h3>
              <p className="text-[11px] text-slate-400">
                Manage lifecycle state for {teacher.name} ({teacher.employee_id})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          <div className="space-y-2">
            {(Object.keys(STATUS_CONFIG) as TeacherLifecycleStatus[]).map((st) => {
              const cfg = STATUS_CONFIG[st];
              const Icon = cfg.icon;
              const isSelected = selectedStatus === st;

              return (
                <div
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={cn(
                    "p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer",
                    isSelected 
                      ? "border-violet-600 bg-violet-50/60 shadow-xs shadow-violet-600/10" 
                      : "border-slate-200/80 hover:bg-slate-50 text-slate-700"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={cn("p-1.5 rounded-lg border", cfg.color)}>
                      <Icon size={14} />
                    </div>
                    <div>
                      <span className="text-xs font-bold block">{cfg.label}</span>
                      <span className="text-[10px] text-slate-400 block">{cfg.desc}</span>
                    </div>
                  </div>

                  <div className={cn(
                    "w-4 h-4 rounded-full border flex items-center justify-center",
                    isSelected ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300"
                  )}>
                    {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                </div>
              );
            })}
          </div>

          {isDeactivating && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-start gap-2 leading-relaxed">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>
                <strong>Non-Destructive Action:</strong> Setting this status safely deactivates active assignments while preserving all historical marks, examinations, and attendance records logged by this teacher.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button 
            type="button" 
            onClick={onClose}
            className="px-4 py-2 bg-transparent text-slate-500 hover:text-slate-800 text-xs font-semibold rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button 
            type="button" 
            onClick={handleStatusSubmit}
            disabled={isUpdating || selectedStatus === teacher.status}
            className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-violet-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Confirm Status Change</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
