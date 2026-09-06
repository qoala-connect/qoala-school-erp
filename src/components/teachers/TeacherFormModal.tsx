import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, User, BookOpen, Briefcase, Phone, Mail, ShieldCheck, 
  Calendar, Award, MapPin, AlertCircle, Save, Loader2, Sparkles, CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Teacher, TeacherLifecycleStatus, saveTeacher } from '@/services/teacherService';
import { supabase } from '@/lib/supabase';
import PhotoUploadInput from '@/components/common/PhotoUploadInput';

interface TeacherFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher?: Teacher | null;
  onSaved: (teacher: Teacher) => void;
}

export default function TeacherFormModal({
  isOpen,
  onClose,
  teacher,
  onSaved
}: TeacherFormModalProps) {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [departments, setDepartments] = useState<Array<{ id: string; department_name: string }>>([]);
  const [authUsers, setAuthUsers] = useState<Array<{ id: string; email: string; name: string }>>([]);

  // Form State
  const [formData, setFormData] = useState<Partial<Teacher>>({
    name: '',
    employee_id: '',
    email: '',
    phone: '',
    gender: 'Male',
    date_of_birth: '',
    joining_date: new Date().toISOString().split('T')[0],
    status: 'Active',
    designation: 'TGT Teacher',
    department: 'Mathematics',
    department_id: '',
    highest_qualification: 'Post Graduate (M.Sc., B.Ed.)',
    qualification: 'B.Ed.',
    experience_years: 5,
    employment_type: 'Full-Time',
    cbse_teaching_level: 'TGT',
    ctet_qualified: true,
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    blood_group: 'B+',
    user_id: ''
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;

    if (teacher) {
      setFormData({
        ...teacher,
        date_of_birth: teacher.date_of_birth || '',
        joining_date: teacher.joining_date || new Date().toISOString().split('T')[0],
        user_id: teacher.user_id || ''
      });
    } else {
      setFormData({
        name: '',
        employee_id: '',
        email: '',
        phone: '',
        gender: 'Male',
        date_of_birth: '',
        joining_date: new Date().toISOString().split('T')[0],
        status: 'Active',
        designation: 'TGT Teacher',
        department: 'Mathematics',
        department_id: '',
        highest_qualification: 'M.Sc., B.Ed.',
        qualification: 'B.Ed.',
        experience_years: 5,
        employment_type: 'Full-Time',
        cbse_teaching_level: 'TGT',
        ctet_qualified: true,
        address: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        blood_group: 'O+',
        user_id: ''
      });
    }

    setActiveStep(1);
    setFormErrors({});

    // Fetch departments and auth users
    async function loadMeta() {
      const [deptRes, profRes] = await Promise.all([
        supabase.from('departments').select('id, department_name').eq('is_active', true).order('department_name'),
        supabase.from('profiles').select('id, email, name, role').in('role', ['teacher', 'class_teacher', 'admin'])
      ]);

      if (deptRes.data) setDepartments(deptRes.data);
      if (profRes.data) setAuthUsers(profRes.data);
    }
    loadMeta();
  }, [isOpen, teacher]);

  const validateCurrentStep = (): boolean => {
    const errors: Record<string, string> = {};

    if (activeStep === 1) {
      if (!formData.name?.trim()) errors.name = 'Full legal name is required.';
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = 'Enter a valid email address.';
      }
      if (formData.phone && !/^[0-9+\-\s]{6,15}$/.test(formData.phone)) {
        errors.phone = 'Enter a valid contact phone.';
      }
    }

    if (activeStep === 2) {
      if (!formData.highest_qualification?.trim()) {
        errors.highest_qualification = 'Highest academic qualification is required.';
      }
    }

    if (activeStep === 3) {
      if (!formData.designation?.trim()) errors.designation = 'Official designation is required.';
      if (!formData.department?.trim()) errors.department = 'Department allocation is required.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setActiveStep(prev => Math.min(prev + 1, 4));
    } else {
      toast.error('Please complete the required fields in this step.');
    }
  };

  const handlePrevious = () => {
    setActiveStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCurrentStep()) {
      toast.error('Please resolve validation errors.');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading(teacher?.id ? 'Updating teacher record...' : 'Registering faculty member...');

    try {
      const saved = await saveTeacher(formData);
      toast.success(teacher?.id ? 'Teacher profile updated!' : 'New faculty member registered successfully!', { id: toastId });
      onSaved(saved);
      onClose();
    } catch (err: any) {
      console.error(err);
      // A network failure already carries its own guidance; prefixing it with
      // "Save failed: TypeError:" only buries the part worth reading.
      // supabase-js stringifies the thrown error, so our diagnosed network
      // message arrives prefixed with "TypeError: ". Show it from that point on.
      const message = String(err?.message || 'Unknown database error');
      const i = message.indexOf('Cannot reach the server');
      toast.error(
        i >= 0 ? message.slice(i) : `Save failed: ${message}`,
        { id: toastId, duration: 12000 }
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white border border-slate-200/90 shadow-2xl rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
              <Award size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight text-white">
                {teacher?.id ? `Edit Faculty: ${teacher.name}` : 'Register New Faculty Member'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Official Teacher Profile & Academic Employment Onboarding
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Wizard Step Navigation (Enterprise Segmented Dock) */}
        <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-3 flex items-center justify-between shrink-0">
          {[
            { step: 1, label: 'Demographics', icon: User },
            { step: 2, label: 'Academic & CBSE', icon: BookOpen },
            { step: 3, label: 'Employment', icon: Briefcase },
            { step: 4, label: 'Emergency & Auth', icon: ShieldCheck }
          ].map((s) => {
            const isDone = activeStep > s.step;
            const isCurrent = activeStep === s.step;
            return (
              <div 
                key={s.step} 
                className={cn(
                  "flex items-center gap-2 cursor-pointer transition-all",
                  isCurrent ? "text-indigo-600 font-bold" : isDone ? "text-emerald-600 font-semibold" : "text-slate-400 font-medium"
                )}
                onClick={() => {
                  if (s.step < activeStep || validateCurrentStep()) {
                    setActiveStep(s.step);
                  }
                }}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all",
                  isCurrent ? "bg-indigo-600 text-white border-indigo-600 shadow-xs shadow-indigo-600/30" :
                  isDone ? "bg-emerald-50 text-emerald-700 border-emerald-300" :
                  "bg-white text-slate-400 border-slate-200"
                )}>
                  {isDone ? <CheckCircle2 size={12} /> : s.step}
                </div>
                <span className="text-xs hidden sm:inline">{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* STEP 1: DEMOGRAPHICS */}
          {activeStep === 1 && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 pl-0.5 block mb-1.5">
                    Full Legal Name <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Dr. Rajesh Kumar Sharma"
                    className={cn(
                      "w-full bg-slate-50/80 hover:bg-slate-50 border rounded-xl py-2 px-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all",
                      formErrors.name ? "border-rose-400 bg-rose-50/20" : "border-slate-200/90"
                    )}
                  />
                  {formErrors.name && <span className="text-[10px] text-rose-500 font-semibold mt-0.5 block">{formErrors.name}</span>}
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 pl-0.5 block mb-1.5">
                    Employee ID (Auto-assigned if empty)
                  </label>
                  <input 
                    type="text" 
                    value={formData.employee_id || ''}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value.toUpperCase() })}
                    placeholder="e.g. SJS-FAC-2011"
                    className="w-full bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 rounded-xl py-2 px-3 text-xs sm:text-sm font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 pl-0.5 block mb-1.5">
                    Email Address
                  </label>
                  <input 
                    type="email" 
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="faculty@school.com"
                    className={cn(
                      "w-full bg-slate-50/80 hover:bg-slate-50 border rounded-xl py-2 px-3 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all",
                      formErrors.email ? "border-rose-400 bg-rose-50/20" : "border-slate-200/90"
                    )}
                  />
                  {formErrors.email && <span className="text-[10px] text-rose-500 font-semibold mt-0.5 block">{formErrors.email}</span>}
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 pl-0.5 block mb-1.5">
                    Phone Number
                  </label>
                  <input 
                    type="tel" 
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className={cn(
                      "w-full bg-slate-50/80 hover:bg-slate-50 border rounded-xl py-2 px-3 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all",
                      formErrors.phone ? "border-rose-400 bg-rose-50/20" : "border-slate-200/90"
                    )}
                  />
                  {formErrors.phone && <span className="text-[10px] text-rose-500 font-semibold mt-0.5 block">{formErrors.phone}</span>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 pl-0.5 block mb-1.5">Gender</label>
                  <select 
                    value={formData.gender || 'Male'}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 rounded-xl py-2 px-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 pl-0.5 block mb-1.5">Date of Birth</label>
                  <input 
                    type="date" 
                    value={formData.date_of_birth || ''}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    className="w-full bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 rounded-xl py-2 px-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 pl-0.5 block mb-1.5">Blood Group</label>
                  <select 
                    value={formData.blood_group || 'O+'}
                    onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                    className="w-full bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 rounded-xl py-2 px-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <PhotoUploadInput
                value={formData.photo_url}
                onChange={(url) => setFormData({ ...formData, photo_url: url })}
                entityFolder="teachers"
                entityId={teacher?.id}
                label="Official Faculty Photograph"
                sublabel="Official employee portrait used for institutional ID, portal badge, and class allotment records."
              />
            </motion.div>
          )}

          {/* STEP 2: ACADEMIC & CBSE */}
          {activeStep === 2 && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 pl-0.5 block mb-1.5">
                  Highest Academic Degree & Specialization <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={formData.highest_qualification || ''}
                  onChange={(e) => setFormData({ ...formData, highest_qualification: e.target.value })}
                  placeholder="e.g. M.Sc. Mathematics, B.Ed. (Gold Medalist)"
                  className="w-full bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 rounded-xl py-2 px-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 pl-0.5 block mb-1.5">
                    CBSE Teaching Level Category
                  </label>
                  <select 
                    value={formData.cbse_teaching_level || 'TGT'}
                    onChange={(e) => setFormData({ ...formData, cbse_teaching_level: e.target.value })}
                    className="w-full bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 rounded-xl py-2 px-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                  >
                    <option value="PRT">PRT (Primary Teacher - Classes 1 to 5)</option>
                    <option value="TGT">TGT (Trained Graduate - Classes 6 to 10)</option>
                    <option value="PGT">PGT (Post Graduate - Classes 11 to 12)</option>
                    <option value="Primary">Primary Specialist</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 pl-0.5 block mb-1.5">
                    Teaching Experience (Years)
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    max="50"
                    value={formData.experience_years ?? 0}
                    onChange={(e) => setFormData({ ...formData, experience_years: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 rounded-xl py-2 px-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between shadow-2xs">
                <div>
                  <h4 className="text-xs font-bold text-indigo-950">CTET / STET Certified</h4>
                  <p className="text-[11px] text-indigo-700 font-medium">Successfully cleared Central or State Teacher Eligibility Test</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={formData.ctet_qualified || false}
                  onChange={(e) => setFormData({ ...formData, ctet_qualified: e.target.checked })}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                />
              </div>
            </motion.div>
          )}

          {/* STEP 3: EMPLOYMENT & DEPARTMENT */}
          {activeStep === 3 && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 pl-0.5 block mb-1.5">
                    Designation / Title <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    value={formData.designation || ''}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Senior PGT Mathematics, HOD Science"
                    className="w-full bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 rounded-xl py-2 px-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 pl-0.5 block mb-1.5">
                    Academic Department <span className="text-rose-500">*</span>
                  </label>
                  <select 
                    value={formData.department || 'Mathematics'}
                    onChange={(e) => {
                      const deptObj = departments.find(d => d.department_name === e.target.value);
                      setFormData({ 
                        ...formData, 
                        department: e.target.value,
                        department_id: deptObj?.id || formData.department_id
                      });
                    }}
                    className="w-full bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 rounded-xl py-2 px-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                  >
                    {departments.length > 0 ? (
                      departments.map(d => (
                        <option key={d.id} value={d.department_name}>{d.department_name}</option>
                      ))
                    ) : (
                      <>
                        <option value="Mathematics">Mathematics</option>
                        <option value="Science & Technology">Science & Technology</option>
                        <option value="Languages & Literature">Languages & Literature</option>
                        <option value="Social Sciences & Humanities">Social Sciences & Humanities</option>
                        <option value="Computer Science & ICT">Computer Science & ICT</option>
                        <option value="Primary Wing">Primary Wing</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 pl-0.5 block mb-1.5">Lifecycle Status</label>
                  <select 
                    value={formData.status || 'Active'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as TeacherLifecycleStatus })}
                    className="w-full bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 rounded-xl py-2 px-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Transferred">Transferred</option>
                    <option value="Resigned">Resigned</option>
                    <option value="Retired">Retired</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 pl-0.5 block mb-1.5">Employment Type</label>
                  <select 
                    value={formData.employment_type || 'Full-Time'}
                    onChange={(e) => setFormData({ ...formData, employment_type: e.target.value as any })}
                    className="w-full bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 rounded-xl py-2 px-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                  >
                    <option value="Full-Time">Full-Time (Permanent)</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Contract">Contract</option>
                    <option value="Temporary">Temporary / Guest</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 pl-0.5 block mb-1.5">Date of Joining</label>
                  <input 
                    type="date" 
                    value={formData.joining_date || ''}
                    onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                    className="w-full bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 rounded-xl py-2 px-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 4: EMERGENCY & AUTH ACCOUNT */}
          {activeStep === 4 && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 pl-0.5 block mb-1.5">Residential Address</label>
                <textarea 
                  rows={2}
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street, Locality, City, State, PIN"
                  className="w-full bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 rounded-xl py-2 px-3 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 pl-0.5 block mb-1.5">Emergency Contact Person</label>
                  <input 
                    type="text" 
                    value={formData.emergency_contact_name || ''}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                    placeholder="e.g. Smt. Neha Sharma (Spouse)"
                    className="w-full bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 rounded-xl py-2 px-3 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 pl-0.5 block mb-1.5">Emergency Phone Number</label>
                  <input 
                    type="tel" 
                    value={formData.emergency_contact_phone || ''}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                    placeholder="+91 94150 00000"
                    className="w-full bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 rounded-xl py-2 px-3 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
              </div>

              {/* Link Auth Account */}
              <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-indigo-600" />
                  <h4 className="text-xs font-bold text-slate-900">ERP Portal Login Account</h4>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  Link this faculty employment record with their authentication login account. This enables the teacher to view their assigned marks entry tasks, timetable, and attendance roster.
                </p>
                <select 
                  value={formData.user_id || ''}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value || null })}
                  className="w-full bg-white border border-slate-200/90 rounded-xl py-2 px-3 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                >
                  <option value="">-- No Account Linked (Employment Profile Only) --</option>
                  {authUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name ? `${u.name} (${u.email})` : u.email}
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}
        </form>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div>
            {activeStep > 1 && (
              <button 
                type="button"
                onClick={handlePrevious}
                className="px-4 py-2 bg-white border border-slate-200/80 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-transparent text-slate-500 hover:text-slate-800 text-xs font-semibold rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>

            {activeStep < 4 ? (
              <button 
                type="button"
                onClick={handleNext}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                Continue Next
              </button>
            ) : (
              <button 
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>{teacher?.id ? 'Save Changes' : 'Confirm Registration'}</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
