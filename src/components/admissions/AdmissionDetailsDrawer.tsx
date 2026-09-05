import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Phone,
  Mail,
  MapPin,
  FileText,
  User,
  Users,
  GraduationCap,
  Printer,
  ExternalLink,
  Check,
  Building,
  ShieldCheck,
  CalendarClock,
  FileWarning,
  Loader2
} from 'lucide-react';
import { AdmissionRecord, AdmissionDocument } from '@/types/admission';
import { admissionService } from '@/services/admissionService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { StatusBadge, Avatar, DetailItem, useDialogBehaviour } from './AdmissionUI';

interface AdmissionDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  admission: AdmissionRecord | null;
  onRefresh: () => Promise<void>;
  onOpenRejectModal: (admission: AdmissionRecord) => void;
  onOpenLetterModal: (admission: AdmissionRecord) => void;
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'documents', label: 'Documents' },
  { id: 'history', label: 'Timeline' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function AdmissionDetailsDrawer({
  isOpen,
  onClose,
  admission,
  onRefresh,
  onOpenRejectModal,
  onOpenLetterModal
}: AdmissionDetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [updatingDocId, setUpdatingDocId] = useState<string | null>(null);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [localDocs, setLocalDocs] = useState<AdmissionDocument[]>([]);

  // Keep localDocs in sync with incoming admission prop
  useEffect(() => {
    if (admission?.documents) {
      setLocalDocs(admission.documents);
    } else {
      setLocalDocs([]);
    }
  }, [admission]);

  const handleApprove = async () => {
    if (!admission) return;
    setIsApproving(true);
    try {
      const res = await admissionService.approveAdmission(admission.id, admission.section || 'A', null);
      toast.success(`${admission.name} enrolled with roll no. ${res?.roll_number || 'auto-assigned'}.`);
      setConfirmApprove(false);
      await onRefresh();
      onClose();
    } catch (err: any) {
      toast.error('Enrolment failed: ' + (err?.message || err));
    } finally {
      setIsApproving(false);
    }
  };

  useDialogBehaviour(isOpen, onClose);

  const handleVerifyDoc = async (docId: string, status: 'Verified' | 'Rejected') => {
    if (!admission) return;
    let remarks = '';
    if (status === 'Rejected') {
      const reason = prompt('Enter reason for document rejection:');
      if (reason === null) return;
      remarks = reason;
    }

    setUpdatingDocId(docId);

    // Instant optimistic update
    setLocalDocs(prev => prev.map(d => {
      if (d.id === docId) {
        return {
          ...d,
          status,
          remarks: remarks || d.remarks,
          verified_at: new Date().toISOString(),
          verified_by: 'Admissions Office'
        };
      }
      return d;
    }));

    try {
      const updated = await admissionService.updateDocumentVerification(admission.id, docId, status, remarks);
      if (updated?.documents) {
        setLocalDocs(updated.documents);
      }
      toast.success(`Document marked as ${status}`);
      await onRefresh();
    } catch (err: any) {
      toast.error('Failed to update document: ' + err.message);
      // Revert if error
      if (admission.documents) {
        setLocalDocs(admission.documents);
      }
    } finally {
      setUpdatingDocId(null);
    }
  };

  const docs = localDocs.length > 0 ? localDocs : (admission?.documents || []);
  const verifiedCount = docs.filter(d => d.status === 'Verified').length;
  const totalDocs = docs.length;
  const verifiedPct = totalDocs > 0 ? Math.round((verifiedCount / totalDocs) * 100) : 0;
  const isApproved = admission?.status === 'Approved' || admission?.status === 'Student Created';

  return (
    <AnimatePresence>
      {isOpen && admission && (
        <motion.div
          key="drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={onClose}
          className="fixed inset-0 z-50 overflow-hidden bg-slate-950/50 backdrop-blur-[3px] flex justify-end"
        >
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={`Application details for ${admission.name}`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            onMouseDown={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col"
          >
            {/* Header */}
            <header className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3.5 min-w-0">
                <Avatar name={admission.name} photoUrl={admission.photo_url} className="w-12 h-12 text-lg rounded-2xl" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-display font-semibold text-slate-900 tracking-tight truncate">{admission.name}</h2>
                    <StatusBadge status={admission.status} />
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1 flex-wrap">
                    <span className="font-mono font-semibold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-100">
                      {admission.application_number || `APP-${admission.id.slice(0, 8).toUpperCase()}`}
                    </span>
                    <span>Class {admission.class} · Section {admission.section || 'A'}</span>
                    <span className="hidden sm:inline">Session {admission.academic_year}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                aria-label="Close details"
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* Tabs */}
            <nav className="px-5 sm:px-6 border-b border-slate-100 flex gap-5 text-[13px] shrink-0" aria-label="Application sections">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={activeTab === tab.id}
                  className={cn(
                    'py-3 border-b-2 -mb-px font-semibold transition-colors cursor-pointer flex items-center gap-1.5',
                    activeTab === tab.id
                      ? 'border-violet-600 text-violet-700'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  )}
                >
                  {tab.label}
                  {tab.id === 'documents' && totalDocs > 0 && (
                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 rounded-full px-1.5 py-0.5 tabular-nums">
                      {verifiedCount}/{totalDocs}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 sm:px-6 py-5 space-y-5">
              {activeTab === 'overview' && (
                <>
                  {admission.student_id && (
                    <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="p-2 bg-emerald-600 text-white rounded-xl shrink-0">
                          <GraduationCap className="w-4.5 h-4.5" />
                        </span>
                        <div className="min-w-0">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 block">Enrolled in SIS</span>
                          <p className="text-[13px] font-semibold text-slate-900 truncate">
                            Admission no. {admission.students?.admission_number || '—'} · Roll no. {admission.students?.roll_number || '—'}
                          </p>
                        </div>
                      </div>
                      <Link
                        to="/dashboard/students"
                        className="px-3 py-2 bg-white hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-300 text-[13px] font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 shrink-0"
                      >
                        View SIS profile <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}

                  <section className="border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
                    <h3 className="text-[13px] font-display font-semibold text-slate-900 flex items-center gap-2">
                      <User className="w-4 h-4 text-violet-600" /> Candidate profile
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4">
                      <DetailItem label="Date of birth" value={admission.date_of_birth} />
                      <DetailItem label="Gender" value={<span className="capitalize">{admission.gender}</span>} />
                      <DetailItem label="Blood group" value={admission.blood_group} />
                      <DetailItem label="Category" value={admission.category || 'General'} />
                      <DetailItem label="Aadhaar (last 4)" value={admission.aadhaar_last4 ? `XXXX-XXXX-${admission.aadhaar_last4}` : null} />
                      <DetailItem label="Special needs" value={admission.cwsn_status ? 'Yes (CWSN)' : 'No'} />
                    </div>
                  </section>

                  <section className="border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
                    <h3 className="text-[13px] font-display font-semibold text-slate-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-violet-600" /> Parent &amp; guardian
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                      <DetailItem
                        label="Father's name"
                        value={
                          <span>
                            {admission.father_name}
                            {admission.father_occupation && (
                              <span className="block text-[11px] font-normal text-slate-500">{admission.father_occupation}</span>
                            )}
                          </span>
                        }
                      />
                      <DetailItem
                        label="Mother's name"
                        value={
                          admission.mother_name ? (
                            <span>
                              {admission.mother_name}
                              {admission.mother_occupation && (
                                <span className="block text-[11px] font-normal text-slate-500">{admission.mother_occupation}</span>
                              )}
                            </span>
                          ) : null
                        }
                      />
                      <DetailItem label="Primary phone" value={admission.phone} icon={Phone} />
                      <DetailItem label="Email address" value={admission.email} icon={Mail} />
                      <DetailItem label="Residential address" value={admission.address} icon={MapPin} className="sm:col-span-2" />
                    </div>
                  </section>

                  <section className="border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
                    <h3 className="text-[13px] font-display font-semibold text-slate-900 flex items-center gap-2">
                      <Building className="w-4 h-4 text-violet-600" /> Previous schooling
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4">
                      <DetailItem label="Previous school" value={admission.previous_school} className="col-span-2 sm:col-span-1" />
                      <DetailItem label="Previous class" value={admission.previous_class} />
                      <DetailItem label="Previous marks" value={admission.previous_marks} />
                      <DetailItem label="TC number" value={admission.transfer_certificate_no} />
                    </div>
                  </section>
                </>
              )}

              {activeTab === 'documents' && (
                <>
                  <div className="p-4 border border-slate-200/80 rounded-2xl">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[13px] font-semibold text-slate-900 block">Verification progress</span>
                        <span className="text-[11px] text-slate-500">{verifiedCount} of {totalDocs} documents verified</span>
                      </div>
                      <span className="text-lg font-display font-bold text-violet-700 tabular-nums">{verifiedPct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-3">
                      <div
                        className={cn('h-full rounded-full transition-all', verifiedPct === 100 ? 'bg-emerald-500' : 'bg-violet-500')}
                        style={{ width: `${verifiedPct}%` }}
                      />
                    </div>
                  </div>

                  {totalDocs === 0 ? (
                    <div className="flex flex-col items-center text-center py-12">
                      <span className="p-3 rounded-2xl bg-slate-50 text-slate-400 border border-slate-200 mb-3">
                        <FileWarning className="w-6 h-6" />
                      </span>
                      <h4 className="text-sm font-semibold text-slate-900">No documents uploaded</h4>
                      <p className="text-[13px] text-slate-500 max-w-xs mt-1">
                        Certificates submitted for this application will be listed here for verification.
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-2.5">
                      {docs.map(doc => (
                        <li key={doc.id} className="p-3.5 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={cn(
                              'p-2 rounded-lg shrink-0',
                              doc.status === 'Verified' ? 'bg-emerald-50 text-emerald-600' :
                              doc.status === 'Rejected' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                            )}>
                              <FileText className="w-4 h-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-slate-800 truncate">{doc.name}</div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {doc.type}{doc.remarks ? ` · ${doc.remarks}` : ''}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                              doc.status === 'Verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              doc.status === 'Rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              'bg-amber-50 text-amber-700 border-amber-200'
                            )}>
                              {doc.status}
                            </span>

                            {!isApproved && (
                              <div className="flex items-center gap-1">
                                {doc.status !== 'Verified' ? (
                                  <button
                                    disabled={updatingDocId === doc.id}
                                    onClick={() => handleVerifyDoc(doc.id, 'Verified')}
                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center min-w-[28px] min-h-[28px]"
                                    title="Mark verified"
                                    aria-label={`Mark ${doc.name} verified`}
                                  >
                                    {updatingDocId === doc.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Check className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="p-1 text-emerald-600" title="Verified">
                                    <Check className="w-4 h-4" />
                                  </span>
                                )}

                                {doc.status !== 'Rejected' && (
                                  <button
                                    disabled={updatingDocId === doc.id}
                                    onClick={() => handleVerifyDoc(doc.id, 'Rejected')}
                                    className="p-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center min-w-[28px] min-h-[28px]"
                                    title="Mark rejected"
                                    aria-label={`Mark ${doc.name} rejected`}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {activeTab === 'history' && (
                <ol className="relative pl-6 space-y-6 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                  <li className="relative">
                    <span className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-violet-600 ring-4 ring-white" />
                    <div className="text-[13px] font-semibold text-slate-900">Application submitted</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <CalendarClock className="w-3 h-3" /> {new Date(admission.created_at).toLocaleString()}
                    </div>
                  </li>

                  {admission.reviewed_at && (
                    <li className="relative">
                      <span className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-indigo-600 ring-4 ring-white" />
                      <div className="text-[13px] font-semibold text-slate-900">Reviewed by administration</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{new Date(admission.reviewed_at).toLocaleString()}</div>
                    </li>
                  )}

                  {isApproved && (
                    <li className="relative">
                      <span className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-emerald-600 ring-4 ring-white" />
                      <div className="text-[13px] font-semibold text-slate-900">Approved and matriculated</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Student account created in the SIS</div>
                    </li>
                  )}

                  {admission.status === 'Rejected' && (
                    <li className="relative">
                      <span className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-rose-600 ring-4 ring-white" />
                      <div className="text-[13px] font-semibold text-slate-900">Application rejected</div>
                      <div className="text-[11px] text-rose-600 mt-0.5">Reason: {admission.rejection_reason || 'Not specified'}</div>
                      {admission.rejected_at && (
                        <div className="text-[11px] text-slate-500">{new Date(admission.rejected_at).toLocaleString()}</div>
                      )}
                    </li>
                  )}
                </ol>
              )}
            </div>

            {/* Footer actions */}
            <footer className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={() => onOpenLetterModal(admission)}
                aria-label="Print admission letter"
                className="px-3.5 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[13px] font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">Print letter</span>
              </button>

              {!isApproved && (
                <div className="flex items-center gap-2">
                  {confirmApprove ? (
                    /* Approval is confirmed inline — no second dialog on top of the drawer */
                    <>
                      <span className="hidden sm:block text-[11px] text-slate-500 max-w-[11rem] leading-tight">
                        Enrol into Class {admission.class} · Section {admission.section || 'A'}?
                      </span>
                      <button
                        onClick={() => setConfirmApprove(false)}
                        disabled={isApproving}
                        className="px-3.5 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[13px] font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleApprove}
                        disabled={isApproving}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-semibold rounded-xl shadow-sm shadow-emerald-500/25 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                      >
                        {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        {isApproving ? 'Enrolling…' : 'Confirm'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => onOpenRejectModal(admission)}
                        className="px-3.5 py-2.5 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-700 hover:text-rose-700 text-[13px] font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => setConfirmApprove(true)}
                        className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-[13px] font-semibold rounded-xl shadow-sm shadow-violet-500/25 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span className="hidden sm:inline">Approve &amp; enrol</span>
                        <span className="sm:hidden">Approve</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </footer>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
