import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  User,
  Users,
  GraduationCap,
  Building,
  Loader2,
  Check,
  AlertCircle,
  Phone,
  Sparkles,
  FileText
} from 'lucide-react';
import { CreateAdmissionInput, AdmissionRecord } from '@/types/admission';
import { admissionService } from '@/services/admissionService';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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

const REQUIRED_FIELDS: { field: keyof CreateAdmissionInput; label: string; message: string }[] = [
  { field: 'name', label: 'Student Full Name', message: 'Student name is required.' },
  { field: 'date_of_birth', label: 'Date of Birth', message: 'Date of birth is required.' },
  { field: 'academic_year_id', label: 'Academic Year', message: 'Please select an academic year.' },
  { field: 'class_id', label: 'Applying Class', message: 'Please select a class.' },
  { field: 'father_name', label: "Father's Name", message: "Father's name is required." },
  { field: 'phone', label: 'Primary Contact Phone', message: 'Primary phone number is required.' },
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [directEnroll, setDirectEnroll] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<CreateAdmissionInput>({
    name: '',
    father_name: '',
    mother_name: '',
    date_of_birth: '',
    gender: 'male',
    class: '1',
    class_id: '',
    section: 'A',
    section_id: '',
    academic_year: '2026-27',
    academic_year_id: '',
    phone: '',
    email: '',
    address: '',
    photo_url: '',
    aadhaar_last4: '',
    category: 'General',
    fee_category: 'Standard',
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

  // Populate on open / edit
  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setServerError(null);
    setIsSubmitting(false);

    if (editRecord) {
      setFormData({
        ...editRecord,
        class_id: editRecord.class_id || classes.find(c => c.class_name === editRecord.class)?.id || '',
        section_id: editRecord.section_id || sections.find(s => s.section_name === editRecord.section)?.id || '',
        academic_year_id: editRecord.academic_year_id || academicYears.find(y => y.name === editRecord.academic_year)?.id || '',
      } as CreateAdmissionInput);
    } else {
      const activeYear = academicYears.find(y => y.is_current) || academicYears[0];
      const defaultClass = classes[0];
      const defaultSec = sections[0];

      setFormData({
        name: '',
        father_name: '',
        mother_name: '',
        date_of_birth: '',
        gender: 'male',
        class: defaultClass?.class_name || '1',
        class_id: defaultClass?.id || '',
        section: defaultSec?.section_name || 'A',
        section_id: defaultSec?.id || '',
        academic_year: activeYear?.name || '2026-27',
        academic_year_id: activeYear?.id || '',
        phone: '',
        email: '',
        address: '',
        photo_url: '',
        aadhaar_last4: '',
        category: 'General',
        fee_category: 'Standard',
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
      setDirectEnroll(false);
    }
  }, [isOpen, editRecord, classes, sections, academicYears]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  const clearError = (field: string) => {
    if (!errors[field]) return;
    setErrors(prev => {
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
    clearError('class_id');
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
    clearError('academic_year_id');
  };

  const validate = (): boolean => {
    const foundErrors: Record<string, string> = {};
    REQUIRED_FIELDS.forEach(req => {
      const val = (formData as any)[req.field];
      if (!val || !String(val).trim()) {
        foundErrors[req.field] = req.message;
      }
    });

    setErrors(foundErrors);
    if (Object.keys(foundErrors).length > 0) {
      toast.error('Please fill in all required fields highlighted in red.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validate()) return;

    setIsSubmitting(true);
    setServerError(null);

    try {
      if (isEditMode && editRecord) {
        await admissionService.updateAdmission(editRecord.id, formData);
        toast.success(`Admission record for ${formData.name} updated successfully.`);
      } else {
        const created = await admissionService.createAdmission(formData);
        
        if (directEnroll) {
          try {
            const approved = await admissionService.approveAdmission(created.id, formData.section || 'A', null);
            toast.success(`${formData.name} enrolled in SIS with Roll No: ${approved?.roll_number || 'auto-assigned'}.`);
          } catch (enrollErr: any) {
            console.error('[AdmissionModal] Direct enrollment error:', enrollErr);
            toast.warning(`Application #${created.application_number} saved, but direct SIS enrollment failed.`);
          }
        } else {
          toast.success(`New admission application #${created.application_number} submitted for ${formData.name}.`);
        }
      }

      await onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[AdmissionModal] Submit error:', err);
      const msg = err?.message || 'Failed to save admission record.';
      setServerError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 sm:p-4 backdrop-blur-xs font-sans">
      {/* Centered Large Rounded Modal with Clean Surface & Subtle Shadow */}
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header: Title, Short Subtitle & Close X Button */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                {isEditMode ? 'Edit Admission' : 'New Admission'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {isEditMode 
                  ? 'Update student, academic, and parent details for this application.' 
                  : 'Enter student, academic, and parent details to record admission.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body (Compact 2-Column Layout with Grouped Sections) */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <form id="admission-form" onSubmit={handleSubmit} className="space-y-6">
            
            {serverError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Error saving admission: </span>
                  <span>{serverError}</span>
                </div>
              </div>
            )}

            {/* SECTION 1: STUDENT DETAILS */}
            <div className="space-y-3.5">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <User className="w-4 h-4 text-slate-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  1. Student Details
                </h3>
              </div>

              {/* Photo Upload (Compact) */}
              <div className="pb-1">
                <PhotoUploadInput
                  value={formData.photo_url}
                  onChange={(url) => setFormData(prev => ({ ...prev, photo_url: url }))}
                  entityFolder="students"
                  label="Student Passport Photograph"
                  sublabel="Required for official CBSE student dossier, admit cards, and ID generation."
                />
              </div>

              {/* 2-Column Responsive Grid for Student Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                {/* Full Name * */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Student Full Name <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Aarav Sharma"
                    className={cn(
                      "w-full bg-white border rounded-xl py-2 px-3 text-xs font-medium text-slate-900 outline-none transition-all shadow-2xs",
                      errors.name ? "border-rose-400 bg-rose-50/40 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/10" : "border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    )}
                    required
                  />
                  {errors.name && <p className="text-[10px] text-rose-600 font-semibold mt-1">{errors.name}</p>}
                </div>

                {/* Date of Birth * */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Date of Birth <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="date"
                    name="date_of_birth"
                    value={formData.date_of_birth}
                    onChange={handleChange}
                    className={cn(
                      "w-full bg-white border rounded-xl py-2 px-3 text-xs font-medium text-slate-900 outline-none transition-all shadow-2xs",
                      errors.date_of_birth ? "border-rose-400 bg-rose-50/40 focus:border-rose-600" : "border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    )}
                    required
                  />
                  {errors.date_of_birth && <p className="text-[10px] text-rose-600 font-semibold mt-1">{errors.date_of_birth}</p>}
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Gender
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 rounded-xl py-2 px-3 text-xs font-medium text-slate-900 outline-none cursor-pointer shadow-2xs"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Blood Group */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Blood Group
                  </label>
                  <select
                    name="blood_group"
                    value={formData.blood_group || 'O+'}
                    onChange={handleChange}
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 rounded-xl py-2 px-3 text-xs font-medium text-slate-900 outline-none cursor-pointer shadow-2xs"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>

                {/* Aadhaar Last 4 Digits */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Aadhaar (Last 4 Digits)
                  </label>
                  <input
                    type="text"
                    name="aadhaar_last4"
                    maxLength={4}
                    inputMode="numeric"
                    value={formData.aadhaar_last4 || ''}
                    onChange={handleChange}
                    placeholder="e.g. 4821"
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 rounded-xl py-2 px-3 text-xs font-medium text-slate-900 outline-none shadow-2xs"
                  />
                </div>

                {/* Special Tags / Concessions */}
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <label className={cn(
                    "flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors text-xs font-medium",
                    formData.cwsn_status ? "bg-blue-50/70 border-blue-200 text-blue-900" : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  )}>
                    <input
                      type="checkbox"
                      name="cwsn_status"
                      checked={!!formData.cwsn_status}
                      onChange={handleChange}
                      className="w-3.5 h-3.5 rounded text-slate-900 focus:ring-slate-800 border-slate-300 cursor-pointer"
                    />
                    <span>Child with Special Needs (CWSN)</span>
                  </label>

                  <label className={cn(
                    "flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors text-xs font-medium",
                    formData.only_child_girl ? "bg-blue-50/70 border-blue-200 text-blue-900" : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  )}>
                    <input
                      type="checkbox"
                      name="only_child_girl"
                      checked={!!formData.only_child_girl}
                      onChange={handleChange}
                      className="w-3.5 h-3.5 rounded text-slate-900 focus:ring-slate-800 border-slate-300 cursor-pointer"
                    />
                    <span>Single Girl Child Concession</span>
                  </label>
                </div>
              </div>
            </div>

            {/* SECTION 2: ADMISSION & ACADEMIC DETAILS */}
            <div className="space-y-3.5">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Building className="w-4 h-4 text-slate-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  2. Admission & Academic Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                {/* Academic Year * */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Academic Session <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <select
                    name="academic_year_id"
                    value={formData.academic_year_id || ''}
                    onChange={handleYearChange}
                    className={cn(
                      "w-full bg-white border rounded-xl py-2 px-3 text-xs font-medium text-slate-900 outline-none cursor-pointer shadow-2xs",
                      errors.academic_year_id ? "border-rose-400 bg-rose-50/40" : "border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    )}
                    required
                  >
                    {academicYears.map(y => (
                      <option key={y.id} value={y.id}>{y.name}{y.is_current ? ' (Current Session)' : ''}</option>
                    ))}
                  </select>
                  {errors.academic_year_id && <p className="text-[10px] text-rose-600 font-semibold mt-1">{errors.academic_year_id}</p>}
                </div>

                {/* Applying Class * */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Applying Class <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <select
                    name="class_id"
                    value={formData.class_id || ''}
                    onChange={handleClassChange}
                    className={cn(
                      "w-full bg-white border rounded-xl py-2 px-3 text-xs font-medium text-slate-900 outline-none cursor-pointer shadow-2xs",
                      errors.class_id ? "border-rose-400 bg-rose-50/40" : "border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    )}
                    required
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>Class {c.class_name}</option>
                    ))}
                  </select>
                  {errors.class_id && <p className="text-[10px] text-rose-600 font-semibold mt-1">{errors.class_id}</p>}
                </div>

                {/* Target Section */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Target Section
                  </label>
                  <select
                    name="section_id"
                    value={formData.section_id || ''}
                    onChange={handleSectionChange}
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 rounded-xl py-2 px-3 text-xs font-medium text-slate-900 outline-none cursor-pointer shadow-2xs"
                  >
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>Section {s.section_name}</option>
                    ))}
                  </select>
                </div>

                {/* Social Category */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Admission Category
                  </label>
                  <select
                    name="category"
                    value={formData.category || 'General'}
                    onChange={handleChange}
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 rounded-xl py-2 px-3 text-xs font-medium text-slate-900 outline-none cursor-pointer shadow-2xs"
                  >
                    <option value="General">General</option>
                    <option value="OBC">OBC</option>
                    <option value="SC">SC</option>
                    <option value="ST">ST</option>
                    <option value="EWS">EWS</option>
                  </select>
                </div>

                {/* Previous School Details */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Previous School (If any)
                  </label>
                  <input
                    type="text"
                    name="previous_school"
                    value={formData.previous_school || ''}
                    onChange={handleChange}
                    placeholder="e.g. St. Joseph's / Convent School"
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 rounded-xl py-2 px-3 text-xs font-medium text-slate-900 outline-none shadow-2xs"
                  />
                </div>

                {/* Transfer Certificate No */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Transfer Certificate (TC) No
                  </label>
                  <input
                    type="text"
                    name="transfer_certificate_no"
                    value={formData.transfer_certificate_no || ''}
                    onChange={handleChange}
                    placeholder="e.g. TC-2026-9041"
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 rounded-xl py-2 px-3 text-xs font-medium text-slate-900 outline-none shadow-2xs"
                  />
                </div>

                {/* Direct Enrolment Toggle (Only for new admissions) */}
                {!isEditMode && (
                  <div className="sm:col-span-2 pt-1">
                    <label className={cn(
                      "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                      directEnroll ? "bg-emerald-50/80 border-emerald-300 shadow-2xs" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    )}>
                      <input
                        type="checkbox"
                        checked={directEnroll}
                        onChange={(e) => setDirectEnroll(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span>Direct Enrolment into School SIS</span>
                          <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[9px] uppercase font-bold tracking-wider">
                            Fast-Track
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Instantly approve application and create student directory record with auto-assigned roll number.
                        </p>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 3: PARENT & CONTACT DETAILS */}
            <div className="space-y-3.5">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Users className="w-4 h-4 text-slate-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  3. Parent & Contact Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                {/* Father's Name * */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Father's Full Name <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    name="father_name"
                    value={formData.father_name}
                    onChange={handleChange}
                    placeholder="e.g. Rajesh Sharma"
                    className={cn(
                      "w-full bg-white border rounded-xl py-2 px-3 text-xs font-medium text-slate-900 outline-none transition-all shadow-2xs",
                      errors.father_name ? "border-rose-400 bg-rose-50/40 focus:border-rose-600" : "border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    )}
                    required
                  />
                  {errors.father_name && <p className="text-[10px] text-rose-600 font-semibold mt-1">{errors.father_name}</p>}
                </div>

                {/* Father's Occupation */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Father's Occupation
                  </label>
                  <input
                    type="text"
                    name="father_occupation"
                    value={formData.father_occupation || ''}
                    onChange={handleChange}
                    placeholder="e.g. Business / Service"
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 rounded-xl py-2 px-3 text-xs font-medium text-slate-900 outline-none shadow-2xs"
                  />
                </div>

                {/* Mother's Name */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Mother's Full Name
                  </label>
                  <input
                    type="text"
                    name="mother_name"
                    value={formData.mother_name || ''}
                    onChange={handleChange}
                    placeholder="e.g. Sunita Sharma"
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 rounded-xl py-2 px-3 text-xs font-medium text-slate-900 outline-none shadow-2xs"
                  />
                </div>

                {/* Primary Contact Phone * */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Primary Contact Phone <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone || ''}
                    onChange={handleChange}
                    placeholder="e.g. +91 98765 43210"
                    className={cn(
                      "w-full bg-white border rounded-xl py-2 px-3 text-xs font-medium text-slate-900 outline-none transition-all shadow-2xs",
                      errors.phone ? "border-rose-400 bg-rose-50/40 focus:border-rose-600" : "border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    )}
                    required
                  />
                  {errors.phone && <p className="text-[10px] text-rose-600 font-semibold mt-1">{errors.phone}</p>}
                </div>

                {/* Email Address */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email || ''}
                    onChange={handleChange}
                    placeholder="e.g. parent@example.com"
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 rounded-xl py-2 px-3 text-xs font-medium text-slate-900 outline-none shadow-2xs"
                  />
                </div>

                {/* Residential Address */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Residential Address
                  </label>
                  <textarea
                    name="address"
                    rows={2}
                    value={formData.address || ''}
                    onChange={handleChange}
                    placeholder="House / Flat No., Street, Area, City, PIN Code"
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 rounded-xl py-2 px-3 text-xs font-medium text-slate-900 outline-none shadow-2xs resize-none"
                  />
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* Sticky Footer: Cancel Secondary & Save Admission Primary */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-medium">
            <span className="text-rose-500 font-bold">*</span> Mandatory fields required
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="admission-form"
              disabled={isSubmitting}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{isEditMode ? 'Save Changes' : directEnroll ? 'Enrol Student into SIS' : 'Save Admission'}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
