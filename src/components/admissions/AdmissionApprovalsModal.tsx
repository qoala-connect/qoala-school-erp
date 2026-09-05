import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Award,
  FileText,
  UserCheck,
  Printer,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { AdmissionRecord, AdmissionStatus } from '@/types/admission';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ModalShell, Field, StatusBadge, selectCls, textareaCls, inputCls } from './AdmissionUI';

interface AdmissionApprovalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AdmissionRecord;
  onUpdateStatus: (id: string, newStatus: AdmissionStatus, approvalDetails?: Partial<AdmissionRecord>) => Promise<void>;
  onOpenLetterModal: (record: AdmissionRecord) => void;
}

const STEPS = [
  { id: 'verification', label: 'Documents', icon: FileText },
  { id: 'assessment', label: 'Assessment', icon: Award },
  { id: 'allocation', label: 'Allotment', icon: UserCheck },
  { id: 'decision', label: 'Decision', icon: CheckCircle2 },
] as const;

type StepId = (typeof STEPS)[number]['id'];

const DOC_CHECKLIST = [
  { key: 'birth_certificate', label: 'Birth certificate', hint: 'Municipal or Gram Panchayat issued', required: true },
  { key: 'transfer_certificate', label: 'Transfer certificate', hint: 'Previous school leaving certificate', required: true },
  { key: 'previous_marksheet', label: 'Previous marksheet', hint: 'Last grade report card', required: true },
  { key: 'aadhaar_card', label: 'Aadhaar identification', hint: 'Student or parent', required: true },
  { key: 'passport_photos', label: 'Passport photographs', hint: '4 recent copies', required: true },
  { key: 'medical_fitness', label: 'Medical fitness record', hint: 'Immunisation history', required: false },
];

export default function AdmissionApprovalsModal({
  isOpen,
  onClose,
  record,
  onUpdateStatus,
  onOpenLetterModal
}: AdmissionApprovalsModalProps) {
  const [activeStep, setActiveStep] = useState<StepId>('verification');
  const [isProcessing, setIsProcessing] = useState(false);

  // Form State for Approval Details
  const [docsChecked, setDocsChecked] = useState<Record<string, boolean>>({
    birth_certificate: record?.verified_documents?.birth_certificate ?? true,
    transfer_certificate: record?.verified_documents?.transfer_certificate ?? true,
    previous_marksheet: record?.verified_documents?.previous_marksheet ?? true,
    aadhaar_card: record?.verified_documents?.aadhaar_card ?? (!!record?.aadhaar_last4),
    medical_fitness: record?.verified_documents?.medical_fitness ?? false,
    passport_photos: record?.verified_documents?.passport_photos ?? true,
  });

  const [meritScore, setMeritScore] = useState<number>(record?.merit_score ?? 85);
  const [entranceScore, setEntranceScore] = useState<number>(record?.entrance_score ?? 88);
  const [interviewRemarks, setInterviewRemarks] = useState<string>(record?.interview_remarks ?? 'Candidate demonstrated good foundational readiness and positive attitude.');
  const [allocatedSection, setAllocatedSection] = useState<string>(record?.section || 'A');
  const [stream, setStream] = useState<string>(record?.stream || 'General');
  const [feeCategory, setFeeCategory] = useState<string>(record?.fee_category || 'Standard');
  const [verificationNotes, setVerificationNotes] = useState<string>(record?.verification_notes || 'All basic criteria verified.');
  const [rejectionReason, setRejectionReason] = useState<string>('');

  if (!record) return null;

  const requiredDocsCount = Object.keys(docsChecked).length;
  const verifiedDocsCount = Object.values(docsChecked).filter(Boolean).length;
  const verificationPercentage = Math.round((verifiedDocsCount / requiredDocsCount) * 100);

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await onUpdateStatus(record.id, 'Approved', {
        merit_score: meritScore,
        entrance_score: entranceScore,
        interview_remarks: interviewRemarks,
        section: allocatedSection,
        stream: (stream as any),
        fee_category: (feeCategory as any),
        verified_documents: docsChecked,
        verification_notes: verificationNotes,
        approval_stage: 'Completed',
        approved_by: 'Academic Principal / Admissions Desk',
        approved_at: new Date().toISOString()
      });
      toast.success(`Application for ${record.name} successfully Approved & Matriculated!`);
      onClose();
    } catch (err: any) {
      toast.error('Approval failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please add a reason before rejecting this application.');
      return;
    }

    setIsProcessing(true);
    try {
      await onUpdateStatus(record.id, 'Rejected', {
        verification_notes: rejectionReason.trim(),
        approval_stage: 'Completed'
      });
      toast.success(`Application for ${record.name} set to Rejected.`);
      onClose();
    } catch (err: any) {
      toast.error('Rejection failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const stepIndex = STEPS.findIndex(s => s.id === activeStep);

  const stepper = (
    <ol className="flex bg-slate-50/80" aria-label="Approval steps">
      {STEPS.map((step, i) => {
        const isActive = activeStep === step.id;
        const isDone = i < stepIndex;
        const Icon = step.icon;
        return (
          <li key={step.id} className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setActiveStep(step.id)}
              aria-current={isActive ? 'step' : undefined}
              className={cn(
                'w-full py-3 px-1.5 flex flex-col sm:flex-row items-center justify-center gap-1.5 border-b-2 text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer',
                isActive ? 'border-violet-600 text-violet-700 bg-white'
                  : isDone ? 'border-emerald-500 text-emerald-700 hover:bg-white/70'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-white/70'
              )}
            >
              <span className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                isActive ? 'bg-violet-600 text-white' : isDone ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
              )}>
                <Icon className="w-3 h-3" />
              </span>
              <span className="truncate">{i + 1}. {step.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon={ShieldCheck}
      size="lg"
      align="start"
      title="Admission review"
      subtitle={`${record.name} · Class ${record.class} · ${record.application_number || record.id.slice(0, 8).toUpperCase()}`}
      subHeader={stepper}
      headerActions={
        record.status === 'Approved' && (
          <button
            onClick={() => onOpenLetterModal(record)}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors cursor-pointer"
            title="Print admission letter"
            aria-label="Print admission letter"
          >
            <Printer className="w-4 h-4" />
          </button>
        )
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setActiveStep(STEPS[Math.max(0, stepIndex - 1)].id)}
            disabled={stepIndex === 0}
            className="px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          {activeStep !== 'decision' ? (
            <button
              type="button"
              onClick={() => setActiveStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)].id)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[13px] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              Next step <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleApprove}
              disabled={isProcessing}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[13px] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-500/20 disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Approve &amp; enrol
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        {/* Candidate summary */}
        <div className="p-4 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 truncate">{record.name}</h3>
            <p className="text-[13px] text-slate-500 mt-0.5 truncate">
              Father: {record.father_name} · Phone: {record.phone || 'Not provided'}
            </p>
          </div>
          <StatusBadge status={record.status} className="self-start sm:self-auto shrink-0" />
        </div>

        {/* STEP 1: DOCUMENT VERIFICATION */}
        {activeStep === 'verification' && (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h4 className="text-[13px] font-display font-semibold text-slate-900">Document checklist</h4>
                <p className="text-xs text-slate-500 mt-0.5">Confirm the physical or digital copies submitted by the applicant.</p>
              </div>
              <span className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap',
                verificationPercentage === 100 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              )}>
                {verifiedDocsCount}/{requiredDocsCount} verified
              </span>
            </div>

            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', verificationPercentage === 100 ? 'bg-emerald-500' : 'bg-violet-500')}
                style={{ width: `${verificationPercentage}%` }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DOC_CHECKLIST.map((item) => (
                <label
                  key={item.key}
                  className={cn(
                    'p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-colors',
                    docsChecked[item.key] ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={!!docsChecked[item.key]}
                    onChange={(e) => setDocsChecked({ ...docsChecked, [item.key]: e.target.checked })}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="text-[13px] font-semibold text-slate-800 flex items-center gap-1.5">
                      {item.label}
                      {item.required && <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1">Required</span>}
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">{item.hint}</span>
                  </span>
                </label>
              ))}
            </div>

            <Field label="Verification notes">
              <input
                type="text"
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="e.g. Original TC submitted; birth certificate matched with Aadhaar."
                className={inputCls}
              />
            </Field>
          </section>
        )}

        {/* STEP 2: ASSESSMENT */}
        {activeStep === 'assessment' && (
          <section className="space-y-4">
            <div>
              <h4 className="text-[13px] font-display font-semibold text-slate-900">Academic readiness</h4>
              <p className="text-xs text-slate-500 mt-0.5">Record the entrance assessment result and interview observations.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Entrance test</span>
                  <span className="text-lg font-display font-bold text-violet-700 tabular-nums">{entranceScore}%</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="100"
                  value={entranceScore}
                  onChange={(e) => setEntranceScore(Number(e.target.value))}
                  aria-label="Entrance test score"
                  className="w-full accent-violet-600 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>40% pass</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="p-4 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Prior academic merit</span>
                  <span className="text-lg font-display font-bold text-emerald-600 tabular-nums">{meritScore}%</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="100"
                  value={meritScore}
                  onChange={(e) => setMeritScore(Number(e.target.value))}
                  aria-label="Prior academic merit score"
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>40%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            <Field label="Interview and observation remarks">
              <textarea
                rows={4}
                value={interviewRemarks}
                onChange={(e) => setInterviewRemarks(e.target.value)}
                placeholder="Communication skills, language proficiency, subject strengths…"
                className={textareaCls}
              />
            </Field>
          </section>
        )}

        {/* STEP 3: ALLOCATION */}
        {activeStep === 'allocation' && (
          <section className="space-y-4">
            <div>
              <h4 className="text-[13px] font-display font-semibold text-slate-900">Section and fee allocation</h4>
              <p className="text-xs text-slate-500 mt-0.5">Assign the classroom division, stream and applicable fee plan.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Allotted section" required>
                <select value={allocatedSection} onChange={(e) => setAllocatedSection(e.target.value)} className={selectCls}>
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="C">Section C</option>
                </select>
              </Field>

              <Field label="Academic stream">
                <select value={stream} onChange={(e) => setStream(e.target.value)} className={selectCls}>
                  <option value="General">General (Grades 1-10)</option>
                  <option value="Science">Science</option>
                  <option value="Commerce">Commerce</option>
                  <option value="Humanities">Humanities &amp; Arts</option>
                </select>
              </Field>

              <Field label="Fee concession plan">
                <select value={feeCategory} onChange={(e) => setFeeCategory(e.target.value)} className={selectCls}>
                  <option value="Standard">Standard tuition</option>
                  <option value="Sibling Concession">Sibling concession (20%)</option>
                  <option value="Merit Scholarship">Merit scholarship</option>
                  <option value="Staff Dependent">Staff ward concession</option>
                </select>
              </Field>
            </div>

            <p className="p-3.5 bg-violet-50/70 border border-violet-100 rounded-xl text-[13px] text-violet-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 text-violet-600 shrink-0" />
              On approval a student record is created in the SIS registry with an admission number and section roster entry.
            </p>
          </section>
        )}

        {/* STEP 4: DECISION */}
        {activeStep === 'decision' && (
          <section className="space-y-4">
            <div>
              <h4 className="text-[13px] font-display font-semibold text-slate-900">Final decision</h4>
              <p className="text-xs text-slate-500 mt-0.5">Review the summary, then approve or reject the application.</p>
            </div>

            <dl className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
              {[
                ['Grade allotted', `Class ${record.class} · Section ${allocatedSection}`],
                ['Academic stream', stream],
                ['Fee category', feeCategory],
                ['Entrance score', `${entranceScore}%`],
                ['Prior merit', `${meritScore}%`],
                ['Documents verified', `${verifiedDocsCount} of ${requiredDocsCount}`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 px-4 py-2.5 text-[13px]">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-semibold text-slate-900 text-right">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="p-4 border border-rose-200 bg-rose-50/40 rounded-2xl space-y-3">
              <Field label="Rejection reason" hint="Required only if you reject this application.">
                <textarea
                  rows={2}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Seat capacity reached for this grade."
                  className={textareaCls}
                />
              </Field>
              <button
                onClick={handleReject}
                disabled={isProcessing}
                className="w-full py-2.5 bg-white hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 rounded-xl text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" /> Reject application
              </button>
            </div>
          </section>
        )}
      </div>
    </ModalShell>
  );
}
