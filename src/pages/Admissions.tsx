import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  GraduationCap,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Users,
  Sparkles,
  Check,
  Loader2,
  FileText,
  Phone,
  Calendar,
  MapPin,
  Clock,
  Printer,
  ShieldCheck,
  School,
  AlertCircle,
  HelpCircle,
  Building,
  CheckCircle,
  BookOpen
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Navbar } from '@/components/Navbar';
import Footer from '@/components/Footer';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { admissionService } from '@/services/admissionService';

// Official SJS Barhalganj Media URLs
const SJS_MEDIA = {
  logoIcon: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/logo_icon.JPG',
  favicon: 'https://sjsbrlschool.edu.in/favicon.png',
  campusLogo: 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/Campulogo.png'
};

const STEPS = [
  { id: 1, title: 'Student Profile', short: 'Student', desc: 'Personal & Class info', icon: User },
  { id: 2, title: 'Parents & Contact', short: 'Guardian', desc: 'Emergency & Address', icon: Users },
  { id: 3, title: 'Academic History', short: 'Academic', desc: 'Previous school & marks', icon: GraduationCap },
  { id: 4, title: 'Review & Submit', short: 'Confirm', desc: 'Verification & Allotment', icon: CheckCircle2 },
];

const CLASS_OPTIONS = [
  'Nursery', 'LKG', 'UKG',
  '1st', '2nd', '3rd', '4th', '5th',
  '6th', '7th', '8th', '9th', '10th',
  '11th (Science)', '11th (Commerce)', '11th (Arts)',
  '12th (Science)', '12th (Commerce)', '12th (Arts)'
];

export default function Admissions() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    dob: '',
    gender: 'male',
    class: '1st',
    section: 'A',
    academic_year: '2026-27',
    fatherName: '',
    motherName: '',
    phone: '',
    email: '',
    address: '',
    aadhaar_last4: '',
    prevSchool: '',
    percentage: '',
    tcNumber: '',
    photoUrl: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleStepNext = () => {
    if (currentStep === 1) {
      if (!formData.name.trim()) {
        toast.error("Please enter the student's full name.");
        return;
      }
      if (!formData.dob) {
        toast.error("Please select the student's date of birth.");
        return;
      }
    } else if (currentStep === 2) {
      if (!formData.fatherName.trim()) {
        toast.error("Please enter the father's / guardian's full name.");
        return;
      }
      if (!formData.phone.trim() || formData.phone.length < 10) {
        toast.error("Please enter a valid 10-digit primary contact mobile number.");
        return;
      }
      if (!formData.address.trim()) {
        toast.error("Please enter your residential address.");
        return;
      }
    }

    setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.fatherName.trim() || !formData.phone.trim()) {
      toast.error('Please fill in all mandatory fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await admissionService.createAdmission({
        name: formData.name.trim(),
        date_of_birth: formData.dob || new Date().toISOString().split('T')[0],
        gender: formData.gender.toLowerCase(),
        class: formData.class,
        section: formData.section || 'A',
        academic_year: formData.academic_year,
        father_name: formData.fatherName.trim(),
        mother_name: formData.motherName.trim() || '',
        phone: formData.phone.trim(),
        email: formData.email.trim() || '',
        address: formData.address.trim() || '',
        photo_url: formData.photoUrl || '',
        aadhaar_last4: formData.aadhaar_last4.trim() || '',
        previous_school: formData.prevSchool.trim() || '',
        previous_marks: formData.percentage.trim() || '',
        transfer_certificate_no: formData.tcNumber.trim() || '',
        status: 'Pending'
      });

      setSubmittedData(created);
      setShowReceiptModal(true);
      toast.success(`Application registered! Tracking No: ${created.application_number}`);
    } catch (error: any) {
      console.error('Submission error:', error);
      toast.error(`Submission failed: ${error.message || 'Check database connection'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-between font-sans text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
      <Navbar transparent={false} />

      {/* HERO HEADER */}
      <section className="relative pt-28 sm:pt-36 pb-12 bg-gradient-to-b from-[#061f3d] via-slate-900 to-slate-900 text-white overflow-hidden border-b border-blue-900/40">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/2 right-10 w-[300px] h-[300px] bg-amber-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Authentic Crest Emblem */}
          <div className="inline-flex items-center justify-center mb-3">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-1.5 shadow-2xl ring-4 ring-amber-400/30 flex items-center justify-center">
              <img
                src={SJS_MEDIA.logoIcon}
                alt="St. Joseph's Emblem"
                className="w-full h-full object-contain rounded-xl"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = SJS_MEDIA.favicon;
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Admissions Open 2026–27
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-600/30 text-blue-200 border border-blue-400/30 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> CBSE Aff. No. 2131498
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black font-serif tracking-tight text-white mb-2">
            Student Admission Application
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm max-w-xl mx-auto font-medium">
            St. Joseph’s School, Barhalganj · Direct Online Enrolment &amp; Enquiry Desk
          </p>
        </div>
      </section>

      {/* MAIN REGISTRATION FORM */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1">
        
        {/* Step Progression Bar */}
        <div className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STEPS.map((s) => {
              const isActive = currentStep === s.id;
              const isDone = currentStep > s.id;
              const StepIcon = s.icon;
              return (
                <div
                  key={s.id}
                  onClick={() => isDone && setCurrentStep(s.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-2xl border transition-all select-none",
                    isActive
                      ? "bg-white border-blue-600 shadow-md ring-2 ring-blue-600/20"
                      : isDone
                        ? "bg-emerald-50/70 border-emerald-200 cursor-pointer hover:bg-emerald-50"
                        : "bg-white/80 border-slate-200 opacity-60"
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-colors",
                    isActive
                      ? "bg-blue-900 text-white"
                      : isDone
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-500"
                  )}>
                    {isDone ? <Check className="w-4 h-4 stroke-[3]" /> : <StepIcon className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {s.title}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {s.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Multi-Section Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
          
          {/* Card Top Information Ribbon */}
          <div className="bg-slate-50 px-6 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-700">
              <Building className="w-4 h-4 text-blue-800" />
              <span>Session: <strong className="text-blue-900 font-mono">2026-27</strong></span>
              <span className="text-slate-300">•</span>
              <span>Class: <strong className="text-blue-900">Class {formData.class}</strong></span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Counter Timings: <strong>8:00 AM – 3:00 PM</strong></span>
            </div>
          </div>

          <form onSubmit={handleFinalSubmit} className="p-6 sm:p-10">
            <AnimatePresence mode="wait">
              {/* STEP 1: Student Profile */}
              {currentStep === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="border-b border-slate-100 pb-3">
                    <h2 className="text-lg font-bold text-slate-900 font-serif flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-700" /> 1. Student Personal &amp; Academic Details
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Enter official details exactly as they appear on the student’s Birth Certificate.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
                        placeholder="e.g. Aarav Kumar Sharma"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>

                    {/* Applying Class */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Applying for Class <span className="text-rose-500">*</span>
                      </label>
                      <select
                        name="class"
                        value={formData.class}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all"
                      >
                        {CLASS_OPTIONS.map(c => (
                          <option key={c} value={c}>Class {c}</option>
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
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all"
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
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    {/* Aadhaar Last 4 */}
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
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:font-normal placeholder:text-slate-400"
                      />
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
                        className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 cursor-not-allowed"
                      />
                    </div>

                    {/* Direct Allotment Section */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Preferred Section
                      </label>
                      <select
                        name="section"
                        value={formData.section}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all"
                      >
                        <option value="A">Section A</option>
                        <option value="B">Section B</option>
                        <option value="C">Section C</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: Parents & Contact Info */}
              {currentStep === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="border-b border-slate-100 pb-3">
                    <h2 className="text-lg font-bold text-slate-900 font-serif flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-700" /> 2. Parents, Guardian &amp; Address Details
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ensure contact numbers are active for official SMS notifications and verification.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Father's Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Father’s / Guardian's Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="fatherName"
                        value={formData.fatherName}
                        onChange={handleChange}
                        required
                        placeholder="Father's full name"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:font-normal placeholder:text-slate-400"
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
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>

                    {/* Contact Phone */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Primary Contact Phone Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        placeholder="+91 94508 83433"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:font-normal placeholder:text-slate-400"
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
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>

                    {/* Full Address */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Permanent Residential Address <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        name="address"
                        rows={3}
                        value={formData.address}
                        onChange={handleChange}
                        required
                        placeholder="Full address (House/Street/Village, Post Office, Barhalganj, Gorakhpur, PIN Code)"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:font-normal placeholder:text-slate-400 resize-none"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: Academic History */}
              {currentStep === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="border-b border-slate-100 pb-3">
                    <h2 className="text-lg font-bold text-slate-900 font-serif flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-blue-700" /> 3. Prior Academic History &amp; Transfer
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      For new admissions entering Class 1st to 12th. (Optional for Nursery/Kindergarten).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Previous School Name &amp; Board
                      </label>
                      <input
                        type="text"
                        name="prevSchool"
                        value={formData.prevSchool}
                        onChange={handleChange}
                        placeholder="e.g. Holy Cross School / CBSE Board"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Previous Class Score / Percentage
                      </label>
                      <input
                        type="text"
                        name="percentage"
                        value={formData.percentage}
                        onChange={handleChange}
                        placeholder="e.g. 88.5% or Grade A"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Transfer Certificate (TC) Number
                      </label>
                      <input
                        type="text"
                        name="tcNumber"
                        value={formData.tcNumber}
                        onChange={handleChange}
                        placeholder="e.g. TC-2026/891"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:font-normal placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 4: Summary & Confirm */}
              {currentStep === 4 && (
                <motion.div
                  key="step-4"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="border-b border-slate-100 pb-3">
                    <h2 className="text-lg font-bold text-slate-900 font-serif flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" /> 4. Review &amp; Confirm Application
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Please verify all submitted applicant information prior to final registration.
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-4">
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-xs">
                      {[
                        ['Student Name', formData.name || '—'],
                        ['Date of Birth', formData.dob || '—'],
                        ['Gender', formData.gender.toUpperCase()],
                        ['Applying Class', `Class ${formData.class}`],
                        ['Academic Session', formData.academic_year],
                        ["Father's Name", formData.fatherName || '—'],
                        ["Mother's Name", formData.motherName || '—'],
                        ['Contact Phone', formData.phone || '—'],
                        ['Email', formData.email || '—'],
                        ['Residential Address', formData.address || '—'],
                        ['Previous School', formData.prevSchool || '—'],
                      ].map(([label, val]) => (
                        <div key={label} className="flex justify-between border-b border-slate-200/60 pb-1.5">
                          <dt className="text-slate-500 font-medium">{label}:</dt>
                          <dd className="text-slate-900 font-bold">{val}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl text-xs text-blue-900">
                    <div className="flex items-center gap-2 font-bold text-blue-950 mb-1">
                      <Sparkles className="w-4 h-4 text-blue-700" /> Institutional Admission Policy
                    </div>
                    Submitting this form initiates your formal registration and generates an instant Admission Tracking Number. Final seat reservation is confirmed upon physical document verification at the school office.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ACTION FOOTER */}
            <div className="flex items-center justify-between pt-8 mt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(prev => Math.max(prev - 1, 1))}
                className={cn(
                  "px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer",
                  currentStep === 1 && "opacity-0 pointer-events-none"
                )}
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleStepNext}
                  className="px-7 py-3 bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-800 hover:to-indigo-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer hover:scale-102"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={cn(
                    "px-8 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer",
                    isSubmitting && "opacity-60 cursor-not-allowed"
                  )}
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{isSubmitting ? 'Registering Application…' : 'Submit Admission Application'}</span>
                </button>
              )}
            </div>
          </form>

        </div>

      </main>

      {/* PRINTABLE RECEIPT MODAL */}
      <AnimatePresence>
        {showReceiptModal && submittedData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative my-8"
            >
              {/* Header with crest */}
              <div className="text-center pb-5 border-b border-slate-200">
                <div className="w-16 h-16 mx-auto mb-2 rounded-xl bg-white p-1 shadow-md border border-slate-200">
                  <img src={SJS_MEDIA.logoIcon} alt="SJS Crest" className="w-full h-full object-contain rounded-lg" />
                </div>
                <h3 className="font-serif font-black text-xl text-blue-950">ST. JOSEPH’S SCHOOL</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Barhalganj, Gorakhpur (U.P.)</p>
                <div className="inline-block mt-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-700 text-xs font-bold">
                  ✓ Admission Application Registered
                </div>
              </div>

              {/* Receipt Details Body */}
              <div className="py-5 space-y-4 text-xs">
                <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Application Tracking No:</span>
                    <div className="text-base font-mono font-black text-blue-900 mt-0.5">
                      {submittedData.application_number}
                    </div>
                  </div>
                  <QRCodeSVG value={`https://sjsbrlschool.edu.in/verify/${submittedData.application_number}`} size={56} />
                </div>

                <div className="grid grid-cols-2 gap-3 text-slate-700">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Applicant Name</div>
                    <div className="font-bold text-slate-900 text-sm mt-0.5">{submittedData.name}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Class & Session</div>
                    <div className="font-bold text-blue-800 text-sm mt-0.5">Class {submittedData.class} ({submittedData.academic_year})</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Father / Guardian</div>
                    <div className="font-bold text-slate-900 mt-0.5">{submittedData.father_name}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Contact Phone</div>
                    <div className="font-bold text-slate-900 mt-0.5">{submittedData.phone || 'Recorded'}</div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200/80 p-3.5 rounded-xl text-amber-900 text-[11px] leading-relaxed">
                  <strong>Next Step:</strong> Please visit the administrative counter at St. Joseph’s School with original birth certificate, previous marksheets, and 4 photographs for final seat allotment.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-3 bg-blue-900 hover:bg-blue-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print / Save PDF Slip
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowReceiptModal(false);
                    window.location.href = '/';
                  }}
                  className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Footer showCallout={false} />
    </div>
  );
}
