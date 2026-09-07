import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  User,
  Users,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  Loader2,
  Calendar,
  Phone,
  Mail,
  MapPin,
  FileText,
  Printer,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { admissionService } from '@/services/admissionService';

const SJS_MEDIA = {
  logoIcon: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/logo_icon.JPG',
  favicon: 'https://sjsbrlschool.edu.in/favicon.png'
};

const CLASS_OPTIONS = [
  'Nursery', 'LKG', 'UKG',
  '1st', '2nd', '3rd', '4th', '5th',
  '6th', '7th', '8th', '9th', '10th',
  '11th (Science)', '11th (Commerce)', '11th (Arts)',
  '12th (Science)', '12th (Commerce)', '12th (Arts)'
];

interface OnlineAdmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnlineAdmissionModal({ isOpen, onClose }: OnlineAdmissionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState<any | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  const [formData, setFormData] = useState({
    name: '',
    dob: '',
    gender: 'male',
    class: '1st',
    academic_year: '2026-27',
    fatherName: '',
    motherName: '',
    phone: '',
    email: '',
    address: '',
    aadhaar_last4: '',
    prevSchool: '',
    percentage: '',
    tcNumber: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Please enter the student's full name.");
      return;
    }
    if (!formData.fatherName.trim()) {
      toast.error("Please enter the father / guardian's name.");
      return;
    }
    if (!formData.phone.trim() || formData.phone.length < 10) {
      toast.error("Please enter a valid 10-digit contact mobile number.");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await admissionService.createAdmission({
        name: formData.name.trim(),
        date_of_birth: formData.dob || new Date().toISOString().split('T')[0],
        gender: formData.gender.toLowerCase(),
        class: formData.class,
        section: 'A',
        academic_year: formData.academic_year,
        father_name: formData.fatherName.trim(),
        mother_name: formData.motherName.trim() || '',
        phone: formData.phone.trim(),
        email: formData.email.trim() || '',
        address: formData.address.trim() || '',
        aadhaar_last4: formData.aadhaar_last4.trim() || '',
        previous_school: formData.prevSchool.trim() || '',
        previous_marks: formData.percentage.trim() || '',
        transfer_certificate_no: formData.tcNumber.trim() || '',
        status: 'Pending'
      });

      setSubmittedData(created);
      toast.success(`Application registered successfully! Tracking No: ${created.application_number}`);
    } catch (err: any) {
      console.error('Admission submit error:', err);
      toast.error(`Submission failed: ${err.message || 'Please check database connection'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmittedData(null);
    setStep(1);
    setFormData({
      name: '',
      dob: '',
      gender: 'male',
      class: '1st',
      academic_year: '2026-27',
      fatherName: '',
      motherName: '',
      phone: '',
      email: '',
      address: '',
      aadhaar_last4: '',
      prevSchool: '',
      percentage: '',
      tcNumber: ''
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden relative my-auto flex flex-col max-h-[92vh]"
      >
        {/* MODAL HEADER */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#061f3d] via-slate-900 to-blue-950 text-white flex items-center justify-between shrink-0 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white p-1 shadow-md border border-white/20 shrink-0">
              <img
                src={SJS_MEDIA.logoIcon}
                alt="SJS Crest"
                className="w-full h-full object-contain rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = SJS_MEDIA.favicon;
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-black text-sm sm:text-base text-white tracking-tight">
                  ST. JOSEPH'S SCHOOL
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                  2026–27
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Online Student Admission Registration · CBSE Affiliation No. 2131498
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto flex-1 font-sans text-slate-800">
          {!submittedData ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Step Tabs / Progress indicator */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-black transition-colors",
                    step === 1 ? "bg-blue-100 text-blue-900" : "bg-slate-100 text-slate-600"
                  )}>
                    Step 1: Student &amp; Academic Info
                  </span>
                  <span className="text-slate-300">/</span>
                  <span className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-black transition-colors",
                    step === 2 ? "bg-blue-100 text-blue-900" : "bg-slate-100 text-slate-600"
                  )}>
                    Step 2: Guardian &amp; Address
                  </span>
                </div>

                <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Direct Admission Desk
                </span>
              </div>

              {/* STEP 1: Student & Academic Details */}
              {step === 1 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Full Name */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Student Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        placeholder="e.g. Aarav Sharma"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>

                    {/* Class */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Applying for Class <span className="text-rose-500">*</span>
                      </label>
                      <select
                        name="class"
                        value={formData.class}
                        onChange={handleChange}
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all"
                      >
                        {CLASS_OPTIONS.map(cls => (
                          <option key={cls} value={cls}>Class {cls}</option>
                        ))}
                      </select>
                    </div>

                    {/* Date of Birth */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Date of Birth <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="dob"
                        value={formData.dob}
                        onChange={handleChange}
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all"
                      />
                    </div>

                    {/* Gender */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Gender <span className="text-rose-500">*</span>
                      </label>
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    {/* Academic Session */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Academic Session
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={formData.academic_year}
                        className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 cursor-not-allowed"
                      />
                    </div>

                    {/* Aadhaar Last 4 Digits */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Aadhaar (Last 4 Digits)
                      </label>
                      <input
                        type="text"
                        name="aadhaar_last4"
                        maxLength={4}
                        value={formData.aadhaar_last4}
                        onChange={handleChange}
                        placeholder="••••"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>

                    {/* Previous School */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Previous School (If any)
                      </label>
                      <input
                        type="text"
                        name="prevSchool"
                        value={formData.prevSchool}
                        onChange={handleChange}
                        placeholder="Previous school name"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Parents & Contact Info */}
              {step === 2 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Father's Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Father’s / Guardian's Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="fatherName"
                        value={formData.fatherName}
                        onChange={handleChange}
                        required
                        placeholder="Father's full name"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>

                    {/* Mother's Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Mother’s Name
                      </label>
                      <input
                        type="text"
                        name="motherName"
                        value={formData.motherName}
                        onChange={handleChange}
                        placeholder="Mother's full name"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Contact Phone Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        placeholder="+91 94508 83433"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Email Address
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="parent@example.com"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>

                    {/* Address */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Residential Address <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        name="address"
                        rows={2}
                        value={formData.address}
                        onChange={handleChange}
                        required
                        placeholder="Village / Town, Post Office, Barhalganj, Gorakhpur"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:font-normal placeholder:text-slate-400 resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ACTION BUTTONS */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                {step === 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!formData.name.trim()) {
                          toast.error('Please provide the applicant student full name.');
                          return;
                        }
                        if (!formData.dob) {
                          toast.error('Please select the date of birth.');
                          return;
                        }
                        setStep(2);
                      }}
                      className="px-6 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer hover:scale-102"
                    >
                      <span>Continue to Guardian Info</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                    >
                      Back to Step 1
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={cn(
                        "px-7 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer",
                        isSubmitting && "opacity-60 cursor-not-allowed"
                      )}
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>{isSubmitting ? 'Submitting Application…' : 'Submit Admission Form'}</span>
                    </button>
                  </>
                )}
              </div>
            </form>
          ) : (
            /* REGISTRATION SUCCESS RECEIPT VIEW */
            <div className="text-center py-2 space-y-5 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h4 className="font-serif font-black text-xl text-slate-900">
                  Admission Application Registered!
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Your provisional admission record has been submitted to St. Joseph’s School Barhalganj.
                </p>
              </div>

              {/* Receipt Summary Card */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Application Tracking No.
                    </span>
                    <div className="text-lg font-mono font-black text-blue-900 mt-0.5">
                      {submittedData.application_number}
                    </div>
                  </div>
                  <QRCodeSVG value={`https://sjsbrlschool.edu.in/verify/${submittedData.application_number}`} size={48} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">Applicant:</span>
                    <p className="font-bold text-slate-900">{submittedData.name}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Class & Session:</span>
                    <p className="font-bold text-blue-800">Class {submittedData.class} ({submittedData.academic_year})</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Father/Guardian:</span>
                    <p className="font-bold text-slate-900">{submittedData.father_name}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Phone:</span>
                    <p className="font-bold text-slate-900">{submittedData.phone || 'Recorded'}</p>
                  </div>
                </div>
              </div>

              {/* Next Steps Notification */}
              <div className="bg-amber-50 border border-amber-200/80 p-3 rounded-xl text-left text-[11px] text-amber-900 leading-relaxed">
                <strong>Next Step:</strong> Please visit the school administrative counter with the original birth certificate, previous marksheet, and 4 passport photographs to confirm seat reservation.
              </div>

              {/* Success Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Printer className="w-4 h-4" /> Print / Save Slip
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
