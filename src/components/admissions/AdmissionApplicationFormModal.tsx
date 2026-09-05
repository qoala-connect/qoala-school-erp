import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  User,
  Users,
  GraduationCap,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Building,
  Loader2,
  Check,
  AlertCircle,
  AlertTriangle
} from 'lucide-react';
import { CreateAdmissionInput, AdmissionRecord } from '@/types/admission';
import { admissionService } from '@/services/admissionService';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ModalShell, Field, SectionBlock, inputCls, selectCls, textareaCls, errorControlCls } from './AdmissionUI';
import PhotoUploadInput from '@/components/common/PhotoUploadInput';

interface AdmissionApplicationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  classes: any[];
  sections: any[];
  academicYears: any[];
  editRecord?: AdmissionRecord | null;
}

const STEPS = [
  { id: 1, title: 'Session & Class', short: 'Session', icon: Building },
  { id: 2, title: 'Student Profile', short: 'Student', icon: User },
  { id: 3, title: 'Parents & Contact', short: 'Parents', icon: Users },
  { id: 4, title: 'Previous School', short: 'History', icon: GraduationCap },
  { id: 5, title: 'Review & Submit', short: 'Review', icon: CheckCircle2 },
];

/** Mandatory fields, mapped to the step that collects them. */
const REQUIRED_FIELDS: { field: string; step: number; label: string; message: string }[] = [
  { field: 'academic_year', step: 1, label: 'Academic year', message: 'Select the academic year.' },
  { field: 'class', step: 1, label: 'Applying class', message: 'Select the applying class.' },
  { field: 'name', step: 2, label: 'Student name', message: "Enter the student's full name." },
  { field: 'date_of_birth', step: 2, label: 'Date of birth', message: 'Select the date of birth.' },
  { field: 'father_name', step: 3, label: "Father's name", message: "Enter the father's full name." },
  { field: 'phone', step: 3, label: 'Primary phone', message: 'Enter a contact phone number.' },
];

export default function AdmissionApplicationFormModal({
  isOpen,
  onClose,
  onSuccess,
  classes,
  sections,
  academicYears,
  editRecord,
}: AdmissionApplicationFormModalProps) {
  const isEditMode = !!editRecord;
  const [currentStep, setCurrentStep] = useState(1);
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'submitted'>('idle');
  const [directEnroll, setDirectEnroll] = useState(false);
  // Field-level validation messages, keyed by form field name.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSubmitting = submitState === 'submitting';

  // Form State
  const [formData, setFormData] = useState<CreateAdmissionInput>({
    name: '',
    father_name: '',
    mother_name: '',
    date_of_birth: '',
    gender: 'male',
    class: '1',
    class_id: classes[0]?.id || '',
    section: 'A',
    section_id: sections[0]?.id || '',
    academic_year: academicYears.find(y => y.is_current)?.name || '2026-27',
    academic_year_id: academicYears.find(y => y.is_current)?.id || '',
    phone: '',
    email: '',
    address: '',
    photo_url: '',
    aadhaar_last4: '',
    category: 'General',
    minority_status: false,
    cwsn_status: false,
    only_child_girl: false,
    previous_school: '',
    previous_class: '',
    previous_marks: '',
    transfer_certificate_no: '',
    blood_group: 'O+',
    emergency_contact: '',
    religion: 'Hinduism',
    nationality: 'Indian',
    father_occupation: '',
    mother_occupation: '',
  });

  useEffect(() => {
    if (isOpen && editRecord) {
      setCurrentStep(1);
      setErrors({});
      setServerError(null);
      setSubmitState('idle');
      setFormData(prev => ({ ...prev, ...editRecord } as CreateAdmissionInput));
    }
  }, [isOpen, editRecord]);

  useEffect(() => {
    if (isEditMode) return;
    if (classes.length > 0 && !formData.class_id) {
      setFormData(prev => ({ ...prev, class_id: classes[0].id, class: classes[0].class_name }));
    }
    if (sections.length > 0 && !formData.section_id) {
      setFormData(prev => ({ ...prev, section_id: sections[0].id, section: sections[0].section_name }));
    }
    if (academicYears.length > 0 && !formData.academic_year_id) {
      const active = academicYears.find(y => y.is_current) || academicYears[0];
      setFormData(prev => ({ ...prev, academic_year_id: active.id, academic_year: active.name }));
    }
  }, [classes, sections, academicYears]);

  // Clear the timer that closes the dialog after a successful submit
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  const clearError = (field: string) => {
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    clearError(name);
  };

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedClassId = e.target.value;
    const selectedClass = classes.find(c => c.id === selectedClassId);
    setFormData(prev => ({
      ...prev,
      class_id: selectedClassId,
      class: selectedClass ? selectedClass.class_name : prev.class
    }));
  };

  const handleSectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedSecId = e.target.value;
    const selectedSec = sections.find(s => s.id === selectedSecId);
    setFormData(prev => ({
      ...prev,
      section_id: selectedSecId,
      section: selectedSec ? selectedSec.section_name : prev.section
    }));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedYearId = e.target.value;
    const selectedYear = academicYears.find(y => y.id === selectedYearId);
    setFormData(prev => ({
      ...prev,
      academic_year_id: selectedYearId,
      academic_year: selectedYear ? selectedYear.name : prev.academic_year
    }));
  };

  /** Collect the missing mandatory fields, optionally only for one step. */
  const collectErrors = (step?: number) => {
    const found: Record<string, string> = {};
    REQUIRED_FIELDS.forEach(rule => {
      if (step && rule.step !== step) return;
      const value = (formData as any)[rule.field];
      if (!value || !String(value).trim()) found[rule.field] = rule.message;
    });
    return found;
  };

  const validateStep = (step: number) => {
    const stepErrors = collectErrors(step);
    setErrors(prev => {
      const next = { ...prev };
      REQUIRED_FIELDS.filter(r => r.step === step).forEach(r => delete next[r.field]);
      return { ...next, ...stepErrors };
    });
    return Object.keys(stepErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    } else {
      toast.error('Please complete the highlighted fields.');
    }
  };

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const resetForm = () => {
    setCurrentStep(1);
    setErrors({});
    setServerError(null);
    setDirectEnroll(false);
    setSubmitState('idle');
    setFormData(prev => ({
      ...prev,
      name: '',
      father_name: '',
      mother_name: '',
      date_of_birth: '',
      gender: 'male',
      phone: '',
      email: '',
      address: '',
      aadhaar_last4: '',
      category: 'General',
      cwsn_status: false,
      only_child_girl: false,
      previous_school: '',
      previous_class: '',
      previous_marks: '',
      transfer_certificate_no: '',
      father_occupation: '',
      mother_occupation: '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitState !== 'idle') return;

    // Validate every mandatory field, then jump to the first step that needs attention
    const allErrors = collectErrors();
    setErrors(allErrors);
    setServerError(null);

    if (Object.keys(allErrors).length > 0) {
      const firstRule = REQUIRED_FIELDS.find(r => allErrors[r.field]);
      if (firstRule) setCurrentStep(firstRule.step);
      toast.error('Please complete the highlighted fields.');
      return;
    }

    setSubmitState('submitting');

    // Edit mode: just persist the corrected fields, no re-creation or enrolment.
    if (isEditMode && editRecord) {
      try {
        await admissionService.updateAdmission(editRecord.id, formData);
        toast.success(`Application for ${formData.name} updated.`);
      } catch (err: any) {
        console.error('[AdmissionApplicationFormModal] updateAdmission failed:', err);
        const message = err?.message || err?.error_description || err?.hint || 'Unknown database error.';
        setServerError(message);
        setCurrentStep(STEPS.length);
        toast.error('Could not save changes: ' + message);
        setSubmitState('idle');
        return;
      }
      setSubmitState('submitted');
      await onSuccess();
      closeTimer.current = setTimeout(() => { onClose(); }, 1000);
      return;
    }

    // 1. Create the admission record
    let created;
    try {
      created = await admissionService.createAdmission(formData);
    } catch (err: any) {
      console.error('[AdmissionApplicationFormModal] createAdmission failed:', err);
      const message = err?.message || err?.error_description || err?.hint || 'Unknown database error.';
      setServerError(message);
      setCurrentStep(STEPS.length);
      toast.error('Could not submit the application: ' + message);
      setSubmitState('idle');
      return;
    }

    // 2. Direct enrolment approves the record and creates the student in the SIS.
    //    The application already exists at this point, so a failure here must not
    //    look like a failed submit — re-submitting would duplicate the record.
    if (directEnroll) {
      try {
        const approved = await admissionService.approveAdmission(created.id, formData.section || 'A', null);
        toast.success(`${formData.name} enrolled in the SIS with roll no. ${approved?.roll_number || 'auto-assigned'}.`);
      } catch (err: any) {
        console.error('[AdmissionApplicationFormModal] approveAdmission failed:', err);
        const message = err?.message || err?.error_description || err?.hint || 'Unknown database error.';
        setServerError(
          `Application ${created.application_number} was saved, but SIS enrolment failed: ${message}. ` +
          'Approve it from the pipeline once this is resolved — do not submit the form again.'
        );
        toast.error('Saved the application, but SIS enrolment failed.');
        setSubmitState('idle');
        await onSuccess();
        return;
      }
    } else {
      toast.success(`Application for ${formData.name} submitted. Number: ${created.application_number}`);
    }

    setSubmitState('submitted');
    await onSuccess();
    closeTimer.current = setTimeout(() => { resetForm(); onClose(); }, 1400);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (submitState === 'submitted' && !isEditMode) resetForm();
    onClose();
  };

  const missingSummary = REQUIRED_FIELDS.filter(r => errors[r.field]);

  const stepper = (
    <div className="bg-slate-50/90 px-3 sm:px-6 py-2.5 border-b border-slate-200/80">
      <ol className="flex items-center justify-between gap-1 sm:gap-2" aria-label="Application steps">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isDone = currentStep > step.id;
          const hasError = REQUIRED_FIELDS.some(r => r.step === step.id && errors[r.field]);
          return (
            <li key={step.id} className="flex-1 min-w-0">
              <button
                type="button"
                onClick={() => { if (step.id < currentStep || hasError) setCurrentStep(step.id); }}
                disabled={step.id > currentStep && !hasError}
                aria-current={isActive ? 'step' : undefined}
                aria-invalid={hasError}
                className={cn(
                  'w-full py-2 px-2 sm:px-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer',
                  hasError
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : isActive
                      ? 'bg-gradient-to-r from-blue-800 to-blue-600 text-white shadow-md shadow-blue-800/25 scale-102'
                      : isDone
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100/60'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                )}
              >
                <span className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]',
                  hasError ? 'bg-rose-500 text-white' :
                    isActive ? 'bg-white/20 text-white font-black' :
                      isDone ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                )}>
                  {hasError ? <AlertCircle className="w-3 h-3" /> : isDone ? <Check className="w-3 h-3" /> : step.id}
                </span>
                <span className="truncate hidden sm:inline">
                  {step.title}
                </span>
                <span className="truncate sm:hidden">
                  {step.short}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );

  const reviewRows: [string, React.ReactNode][] = [
    ['Candidate', formData.name || '—'],
    ['Date of birth', formData.date_of_birth || '—'],
    ['Applying for', `Class ${formData.class} · Section ${formData.section}`],
    ['Academic session', formData.academic_year],
    ["Father's name", formData.father_name || '—'],
    ['Primary phone', formData.phone || '—'],
    ['Category', formData.category || 'General'],
    ['Previous school', formData.previous_school || '—'],
  ];

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      icon={GraduationCap}
      size="xl"
      title={isEditMode ? 'Edit Admission Application' : 'New Admission Application'}
      subtitle={isEditMode ? 'Correct applicant details on this submitted application.' : 'Capture applicant profile, verify documents, and optionally enrol directly into SIS.'}
      subHeader={stepper}
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handlePrev}
              disabled={submitState !== 'idle'}
              className="px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map(dot => (
                <div
                  key={dot}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all',
                    dot === currentStep ? 'w-5 bg-blue-600' : 'bg-slate-200'
                  )}
                />
              ))}
              <span className="text-[11px] font-bold text-slate-400 ml-1.5">Step {currentStep} of {STEPS.length}</span>
            </div>
          )}

          {currentStep > 1 && (
            <div className="hidden sm:flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map(dot => (
                <div
                  key={dot}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all',
                    dot === currentStep ? 'w-5 bg-blue-600' : 'bg-slate-200'
                  )}
                />
              ))}
            </div>
          )}

          {currentStep < STEPS.length ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-900 to-blue-700 hover:from-blue-800 hover:to-blue-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-900/20"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitState !== 'idle'}
              onClick={handleSubmit}
              aria-live="polite"
              className={cn(
                'px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:cursor-default',
                submitState === 'submitted'
                  ? 'bg-emerald-600 shadow-emerald-500/25'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 shadow-emerald-600/25',
                submitState === 'submitting' && 'opacity-80'
              )}
            >
              {submitState === 'submitting' && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitState === 'submitted' && <Check className="w-4 h-4" />}
              {submitState === 'submitting'
                ? 'Saving…'
                : submitState === 'submitted'
                  ? (isEditMode ? 'Saved' : 'Submitted')
                  : isEditMode ? 'Save Changes' : directEnroll ? 'Enrol Student into SIS' : 'Submit Application'}
            </button>
          )}
        </div>
      }
    >
      <form onSubmit={handleSubmit}>
        <motion.div key={currentStep} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
          {/* STEP 1 */}
          {currentStep === 1 && (
            <SectionBlock
              icon={Building}
              title="Academic session and target grade"
              description="Where the applicant is seeking a seat."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Academic year" required error={errors.academic_year}>
                  <select name="academic_year_id" value={formData.academic_year_id || ''} onChange={handleYearChange} aria-invalid={!!errors.academic_year} className={cn(selectCls, errors.academic_year && errorControlCls)}>
                    {academicYears.map(y => (
                      <option key={y.id} value={y.id}>{y.name}{y.is_current ? ' (current)' : ''}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Applying class" required error={errors.class}>
                  <select name="class_id" value={formData.class_id || ''} onChange={handleClassChange} aria-invalid={!!errors.class} className={cn(selectCls, errors.class && errorControlCls)}>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>Class {c.class_name}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Target section">
                  <select name="section_id" value={formData.section_id || ''} onChange={handleSectionChange} className={selectCls}>
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>Section {s.section_name}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Admission category">
                  <select name="category" value={formData.category || 'General'} onChange={handleChange} className={selectCls}>
                    <option value="General">General</option>
                    <option value="OBC">OBC</option>
                    <option value="SC">SC</option>
                    <option value="ST">ST</option>
                    <option value="EWS">EWS</option>
                  </select>
                </Field>
              </div>
            </SectionBlock>
          )}

          {/* STEP 2 */}
          {currentStep === 2 && (
            <SectionBlock
              icon={User}
              title="Student personal details"
              description="Details are matched against the birth certificate and Aadhaar."
            >
              <div className="mb-4">
                <PhotoUploadInput
                  value={formData.photo_url}
                  onChange={(url) => setFormData(prev => ({ ...prev, photo_url: url }))}
                  entityFolder="students"
                  label="Applicant Passport Photograph"
                  sublabel="Required for official CBSE student dossier, admit cards, and student ID generation."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full name of student" required error={errors.name} className="sm:col-span-2">
                  <input type="text" name="name" required value={formData.name} onChange={handleChange} placeholder="e.g. Aryan Sharma" aria-invalid={!!errors.name} className={cn(inputCls, errors.name && errorControlCls)} />
                </Field>

                <Field label="Date of birth" required error={errors.date_of_birth}>
                  <input type="date" name="date_of_birth" required value={formData.date_of_birth} onChange={handleChange} aria-invalid={!!errors.date_of_birth} className={cn(inputCls, errors.date_of_birth && errorControlCls)} />
                </Field>

                <Field label="Gender">
                  <select name="gender" value={formData.gender} onChange={handleChange} className={selectCls}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </Field>

                <Field label="Blood group">
                  <select name="blood_group" value={formData.blood_group || 'O+'} onChange={handleChange} className={selectCls}>
                    {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Aadhaar last 4 digits">
                  <input type="text" name="aadhaar_last4" maxLength={4} inputMode="numeric" value={formData.aadhaar_last4 || ''} onChange={handleChange} placeholder="e.g. 9482" className={inputCls} />
                </Field>

                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { name: 'cwsn_status', label: 'Child with special needs (CWSN)', checked: formData.cwsn_status },
                    { name: 'only_child_girl', label: 'Single girl child concession', checked: formData.only_child_girl },
                  ].map(opt => (
                    <label
                      key={opt.name}
                      className={cn(
                        'flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer transition-colors',
                        opt.checked ? 'bg-blue-50/70 border-blue-200' : 'bg-white border-slate-200 hover:bg-slate-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        name={opt.name}
                        checked={!!opt.checked}
                        onChange={handleChange}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-[13px] font-semibold text-slate-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </SectionBlock>
          )}

          {/* STEP 3 */}
          {currentStep === 3 && (
            <SectionBlock
              icon={Users}
              title="Parent and contact information"
              description="Used for all official school correspondence."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Father's full name" required error={errors.father_name}>
                  <input type="text" name="father_name" required value={formData.father_name} onChange={handleChange} placeholder="e.g. Rajesh Sharma" aria-invalid={!!errors.father_name} className={cn(inputCls, errors.father_name && errorControlCls)} />
                </Field>

                <Field label="Father's occupation">
                  <input type="text" name="father_occupation" value={formData.father_occupation || ''} onChange={handleChange} placeholder="e.g. Government service / Business" className={inputCls} />
                </Field>

                <Field label="Mother's full name">
                  <input type="text" name="mother_name" value={formData.mother_name || ''} onChange={handleChange} placeholder="e.g. Sunita Sharma" className={inputCls} />
                </Field>

                <Field label="Primary contact phone" required error={errors.phone}>
                  <input type="tel" name="phone" required value={formData.phone || ''} onChange={handleChange} placeholder="e.g. +91 98765 43210" aria-invalid={!!errors.phone} className={cn(inputCls, errors.phone && errorControlCls)} />
                </Field>

                <Field label="Email address" className="sm:col-span-2">
                  <input type="email" name="email" value={formData.email || ''} onChange={handleChange} placeholder="e.g. parent@example.com" className={inputCls} />
                </Field>

                <Field label="Residential address" className="sm:col-span-2">
                  <textarea name="address" rows={3} value={formData.address || ''} onChange={handleChange} placeholder="House no., street, locality, town - PIN code" className={textareaCls} />
                </Field>
              </div>
            </SectionBlock>
          )}

          {/* STEP 4 */}
          {currentStep === 4 && (
            <SectionBlock
              icon={GraduationCap}
              title="Previous academic background"
              description="Details from previous school or institution (if applicable)."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Previous school attended" className="sm:col-span-2">
                  <input type="text" name="previous_school" value={formData.previous_school || ''} onChange={handleChange} placeholder="e.g. St. Joseph's / Convent High School" className={inputCls} />
                </Field>

                <Field label="Previous class / grade">
                  <input type="text" name="previous_class" value={formData.previous_class || ''} onChange={handleChange} placeholder="e.g. Class 9" className={inputCls} />
                </Field>

                <Field label="Previous marks / percentage">
                  <input type="text" name="previous_marks" value={formData.previous_marks || ''} onChange={handleChange} placeholder="e.g. 88.5%" className={inputCls} />
                </Field>

                <Field label="Transfer certificate (TC) number" className="sm:col-span-2">
                  <input type="text" name="transfer_certificate_no" value={formData.transfer_certificate_no || ''} onChange={handleChange} placeholder="e.g. TC-2025-9832" className={inputCls} />
                </Field>
              </div>
            </SectionBlock>
          )}

          {/* STEP 5 */}
          {currentStep === 5 && (
            <SectionBlock
              icon={CheckCircle2}
              title="Review and submit application"
              description="Please verify applicant data prior to final recording."
            >
              {/* Blocking validation */}
              {missingSummary.length > 0 && (
                <div role="alert" className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-rose-800">
                    <AlertCircle className="w-4 h-4" />
                    {missingSummary.length} required field{missingSummary.length > 1 ? 's are' : ' is'} missing
                  </div>
                  <ul className="space-y-1">
                    {missingSummary.map(rule => (
                      <li key={rule.field}>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(rule.step)}
                          className="text-[13px] text-rose-700 hover:text-rose-900 underline underline-offset-2 cursor-pointer"
                        >
                          {rule.label} — {STEPS[rule.step - 1].title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {serverError && (
                <div role="alert" className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-rose-800">
                    <AlertTriangle className="w-4 h-4" /> Submission failed
                  </div>
                  <p className="text-[13px] text-rose-700 mt-1 break-words">{serverError}</p>
                </div>
              )}

              {submitState === 'submitted' && (
                <div role="status" className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-[13px] font-semibold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                  {isEditMode ? 'Application updated.' : directEnroll ? 'Student enrolled in the SIS.' : 'Application submitted.'}
                </div>
              )}

              <dl className="bg-slate-50 border border-slate-200 rounded-2xl divide-y divide-slate-200/60 overflow-hidden">
                {reviewRows.map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-4 px-4 py-2.5 text-[13px]">
                    <dt className="text-slate-500 font-medium shrink-0">{label}</dt>
                    <dd className="font-bold text-slate-900 text-right break-words">{value}</dd>
                  </div>
                ))}
              </dl>

              {!isEditMode && <label
                className={cn(
                  'flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all',
                  directEnroll ? 'bg-blue-50/80 border-blue-300 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50'
                )}
              >
                <input
                  type="checkbox"
                  checked={directEnroll}
                  onChange={(e) => setDirectEnroll(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span>
                  <span className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
                    Direct Enrolment into School SIS
                    <span className="px-1.5 py-0.2 rounded bg-blue-600 text-white text-[9px] uppercase font-bold tracking-wider">Fast-Track</span>
                  </span>
                  <span className="text-xs text-slate-500 leading-relaxed block mt-0.5">
                    Instantly approve application and generate student record with auto-assigned roll number.
                  </span>
                </span>
              </label>}
            </SectionBlock>
          )}
        </motion.div>
      </form>
    </ModalShell>
  );
}
