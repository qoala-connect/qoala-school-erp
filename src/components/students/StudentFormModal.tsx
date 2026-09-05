import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { X, Loader2, AlertTriangle, User, GraduationCap, Phone, MapPin, ShieldCheck, Heart } from 'lucide-react';
import { Student } from '@/types/student';
import PhotoUploadInput from '@/components/common/PhotoUploadInput';

export interface StudentFormValues {
  id?: string;
  name: string;
  father_name: string;
  mother_name: string;
  date_of_birth: string;
  gender: string;
  class_id: string;
  section_id: string;
  academic_year_id?: string;
  phone: string;
  email: string;
  address: string;
  category: string;
  roll_number: string;
  photo_url?: string;
  blood_group?: string;
  aadhaar_last4?: string;
  religion?: string;
  nationality?: string;
  minority_status?: boolean;
  cwsn_status?: boolean;
  cwsn_type?: string;
  only_child_girl?: boolean;
  cbse_registration_no?: string;
  house_name?: string;
}

const EMPTY: StudentFormValues = {
  name: '',
  father_name: '',
  mother_name: '',
  date_of_birth: '',
  gender: 'male',
  class_id: '',
  section_id: '',
  phone: '',
  email: '',
  address: '',
  category: 'General',
  roll_number: '',
  photo_url: '',
  blood_group: 'O+',
  aadhaar_last4: '',
  religion: 'Hindu',
  nationality: 'Indian',
  minority_status: false,
  cwsn_status: false,
  cwsn_type: '',
  only_child_girl: false,
  cbse_registration_no: '',
  house_name: 'Tagore House',
};

const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS'];
const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const HOUSES = ['Tagore House', 'Ashoka House', 'Raman House', 'Shivaji House'];

type Errors = Partial<Record<keyof StudentFormValues, string>>;

interface Props {
  open: boolean;
  initial?: Partial<StudentFormValues> | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function StudentFormModal({ open, initial, onClose, onSaved }: Props) {
  const isEdit = Boolean(initial?.id);

  const [values, setValues] = useState<StudentFormValues>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [classes, setClasses] = useState<{ id: string; class_name: string }[]>([]);
  const [sections, setSections] = useState<{ id: string; section_name: string }[]>([]);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'basic' | 'academic' | 'cbse' | 'contact'>('basic');

  useEffect(() => {
    if (!open) return;
    setValues({ ...EMPTY, ...(initial ?? {}) } as StudentFormValues);
    setErrors({});
    setDuplicateWarning(null);
    setActiveSection('basic');
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [c, s, y] = await Promise.all([
        supabase.from('classes').select('id, class_name'),
        supabase.from('sections').select('id, section_name').order('section_name'),
        supabase.from('academic_years').select('id, name, is_current').order('start_date', { ascending: false }),
      ]);

      if (c.error || s.error) {
        toast.error('Could not load classes and sections.');
        return;
      }
      const sorted = (c.data ?? []).sort(
        (a, b) => (parseInt(a.class_name.replace(/\D/g, ''), 10) || 0) - (parseInt(b.class_name.replace(/\D/g, ''), 10) || 0)
      );
      setClasses(sorted);
      setSections(s.data ?? []);
      setAcademicYears(y.data ?? []);

      // If creating new and no class selected, default to first class
      if (!initial?.id && sorted.length > 0 && !values.class_id) {
        setValues(prev => ({
          ...prev,
          class_id: sorted[0].id,
          section_id: s.data?.[0]?.id || '',
          academic_year_id: y.data?.find(yr => yr.is_current)?.id || y.data?.[0]?.id || ''
        }));
      }
    })();
  }, [open]);

  const set = (key: keyof StudentFormValues, value: any) => {
    setValues(v => ({ ...v, [key]: value }));
    setErrors(e => ({ ...e, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: Errors = {};
    if (!values.name.trim()) next.name = "The student's name is required.";
    if (!values.father_name.trim()) next.father_name = "The father's name is required.";
    if (!values.date_of_birth) next.date_of_birth = 'Date of birth is required.';
    else if (new Date(values.date_of_birth) >= new Date()) next.date_of_birth = 'Date of birth must be in the past.';
    if (!values.class_id) next.class_id = 'Choose a class.';
    if (!values.section_id) next.section_id = 'Choose a section.';
    if (values.phone && !/^[0-9+\-\s]{6,15}$/.test(values.phone)) next.phone = 'Enter a valid phone number.';
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = 'Enter a valid email address.';
    if (values.aadhaar_last4 && !/^\d{4}$/.test(values.aadhaar_last4)) next.aadhaar_last4 = 'Enter 4 digits only.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (allowDuplicate = false) => {
    if (isSubmitting) return;
    if (!validate()) {
      toast.error('Please resolve the highlighted validation errors.');
      return;
    }

    setIsSubmitting(true);
    setDuplicateWarning(null);

    const res = isEdit
      ? await supabase.rpc('update_student', {
          _student_id: initial!.id,
          _name: values.name,
          _father_name: values.father_name,
          _mother_name: values.mother_name || null,
          _date_of_birth: values.date_of_birth || null,
          _gender: values.gender || null,
          _class_id: values.class_id || null,
          _section_id: values.section_id || null,
          _phone: values.phone || null,
          _email: values.email || null,
          _address: values.address || null,
          _category: values.category || null,
          _roll_number: values.roll_number || null,
        })
      : await supabase.rpc('create_student', {
          _name: values.name,
          _father_name: values.father_name,
          _date_of_birth: values.date_of_birth,
          _class_id: values.class_id,
          _section_id: values.section_id,
          _academic_year_id: values.academic_year_id || null,
          _mother_name: values.mother_name || null,
          _gender: values.gender || null,
          _phone: values.phone || null,
          _email: values.email || null,
          _address: values.address || null,
          _category: values.category,
          _roll_number: values.roll_number || null,
          _allow_duplicate: allowDuplicate,
        });

    if (res.error) {
      setIsSubmitting(false);
      console.error('[StudentFormModal] Save failed:', res.error);
      if (res.error.code === '23505' && /already exists this year/i.test(res.error.message)) {
        setDuplicateWarning(res.error.message);
        return;
      }
      toast.error(
        res.error.code === '42501'
          ? `You do not have permission to ${isEdit ? 'edit' : 'admit'} students.`
          : res.error.message
      );
      return;
    }

    const studentId = isEdit ? initial!.id : (res.data as any)?.[0]?.id;
    if (studentId) {
      await supabase.from('students').update({
        photo_url: values.photo_url || null,
        aadhaar_last4: values.aadhaar_last4 || null,
        minority_status: values.minority_status || false,
        cwsn_status: values.cwsn_status || false,
        cwsn_type: values.cwsn_type || null,
        only_child_girl: values.only_child_girl || false,
        cbse_registration_no: values.cbse_registration_no || null,
        house_name: values.house_name || null,
      }).eq('id', studentId);
    }

    setIsSubmitting(false);

    toast.success(isEdit ? 'Student details updated successfully.' : 'Student admitted successfully.');
    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white w-full max-w-3xl rounded-3xl border border-slate-200 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center text-white font-bold shrink-0">
              <GraduationCap size={20} />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">{isEdit ? 'Edit Student Record' : 'Direct Student Enrollment'}</h2>
              <p className="text-xs text-slate-400">
                {isEdit ? 'Atomic updates logged to central audit trail.' : 'Automated admission & roll numbering with CBSE compliance.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section Navigation Tabs */}
        <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 shrink-0">
          {[
            { id: 'basic', label: '1. Basic Info', icon: User },
            { id: 'academic', label: '2. Placement', icon: GraduationCap },
            { id: 'contact', label: '3. Parents & Address', icon: Phone },
            { id: 'cbse', label: '4. CBSE & Health', icon: ShieldCheck },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                activeSection === tab.id
                  ? 'border-violet-600 text-violet-700 bg-white font-black'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <tab.icon size={13} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <form onSubmit={e => { e.preventDefault(); submit(false); }} className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {duplicateWarning && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-900">
                <p className="font-bold mb-1">Possible Duplicate Student Detected</p>
                <p className="text-[11px]">{duplicateWarning}</p>
                <button
                  type="button"
                  onClick={() => submit(true)}
                  className="mt-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700"
                >
                  Override & Admit Anyway
                </button>
              </div>
            </div>
          )}

          {/* Section 1: Basic Identity */}
          {activeSection === 'basic' && (
            <div className="space-y-4">
              <PhotoUploadInput
                value={values.photo_url}
                onChange={url => set('photo_url', url)}
                entityId={initial?.id}
                entityFolder="students"
                label="Official Student Passport Photograph"
                sublabel="Used across CBSE Admit Cards, Marksheets, Report Cards & Institutional ID Cards"
              />

              <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider pt-2 border-t border-slate-100">Primary Demographic Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Student Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={values.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    className={`w-full px-3 py-2 rounded-xl border text-xs bg-slate-50 outline-none focus:ring-2 focus:ring-violet-500/20 ${
                      errors.name ? 'border-rose-400 bg-rose-50/40' : 'border-slate-200 focus:border-violet-500'
                    }`}
                  />
                  {errors.name && <p className="text-[10px] font-semibold text-rose-600">{errors.name}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Date of Birth <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={values.date_of_birth}
                    onChange={e => set('date_of_birth', e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs bg-slate-50 outline-none focus:ring-2 focus:ring-violet-500/20 ${
                      errors.date_of_birth ? 'border-rose-400 bg-rose-50/40' : 'border-slate-200 focus:border-violet-500'
                    }`}
                  />
                  {errors.date_of_birth && <p className="text-[10px] font-semibold text-rose-600">{errors.date_of_birth}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Gender</label>
                  <select
                    value={values.gender}
                    onChange={e => set('gender', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  >
                    {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Social Category</label>
                  <select
                    value={values.category}
                    onChange={e => set('category', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Blood Group</label>
                  <select
                    value={values.blood_group}
                    onChange={e => set('blood_group', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  >
                    {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Aadhaar (Last 4 Digits)</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={values.aadhaar_last4}
                    onChange={e => set('aadhaar_last4', e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 9842"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                  {errors.aadhaar_last4 && <p className="text-[10px] font-semibold text-rose-600">{errors.aadhaar_last4}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Academic Placement */}
          {activeSection === 'academic' && (
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">Academic Year & Classroom Roster</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Enrolling Class <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={values.class_id}
                    onChange={e => set('class_id', e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border bg-slate-50 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20 ${
                      errors.class_id ? 'border-rose-400' : 'border-slate-200'
                    }`}
                  >
                    <option value="">Choose Class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>Class {c.class_name}</option>)}
                  </select>
                  {errors.class_id && <p className="text-[10px] font-semibold text-rose-600">{errors.class_id}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Assigned Section <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={values.section_id}
                    onChange={e => set('section_id', e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border bg-slate-50 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20 ${
                      errors.section_id ? 'border-rose-400' : 'border-slate-200'
                    }`}
                  >
                    <option value="">Choose Section</option>
                    {sections.map(s => <option key={s.id} value={s.id}>Section {s.section_name}</option>)}
                  </select>
                  {errors.section_id && <p className="text-[10px] font-semibold text-rose-600">{errors.section_id}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Roll Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={values.roll_number}
                    onChange={e => set('roll_number', e.target.value)}
                    placeholder="e.g. 14"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">School House</label>
                  <select
                    value={values.house_name}
                    onChange={e => set('house_name', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  >
                    {HOUSES.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Parents & Contacts */}
          {activeSection === 'contact' && (
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">Parent & Contact Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Father's Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={values.father_name}
                    onChange={e => set('father_name', e.target.value)}
                    placeholder="e.g. Rajesh Sharma"
                    className={`w-full px-3 py-2 rounded-xl border text-xs bg-slate-50 outline-none focus:ring-2 focus:ring-violet-500/20 ${
                      errors.father_name ? 'border-rose-400' : 'border-slate-200'
                    }`}
                  />
                  {errors.father_name && <p className="text-[10px] font-semibold text-rose-600">{errors.father_name}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Mother's Name</label>
                  <input
                    type="text"
                    value={values.mother_name}
                    onChange={e => set('mother_name', e.target.value)}
                    placeholder="e.g. Sunita Sharma"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Primary Contact Phone</label>
                  <input
                    type="tel"
                    value={values.phone}
                    onChange={e => set('phone', e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                  {errors.phone && <p className="text-[10px] font-semibold text-rose-600">{errors.phone}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Parent Email</label>
                  <input
                    type="email"
                    value={values.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="e.g. parent@example.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                  {errors.email && <p className="text-[10px] font-semibold text-rose-600">{errors.email}</p>}
                </div>

                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Residential Address</label>
                  <textarea
                    rows={2}
                    value={values.address}
                    onChange={e => set('address', e.target.value)}
                    placeholder="e.g. Ward No. 4, Civil Lines, Deoria (U.P.)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 4: CBSE & Special Attributes */}
          {activeSection === 'cbse' && (
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">CBSE Compliance & Special Attributes</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">CBSE Registration Number</label>
                  <input
                    type="text"
                    value={values.cbse_registration_no}
                    onChange={e => set('cbse_registration_no', e.target.value)}
                    placeholder="e.g. D213084/2026/001"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Religion</label>
                  <input
                    type="text"
                    value={values.religion}
                    onChange={e => set('religion', e.target.value)}
                    placeholder="e.g. Hindu / Muslim / Sikh / Christian"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                  <label className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!values.only_child_girl}
                      onChange={e => set('only_child_girl', e.target.checked)}
                      className="rounded text-violet-600 focus:ring-violet-500"
                    />
                    <span className="text-xs font-bold text-slate-700">Only Child (Girl)</span>
                  </label>

                  <label className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!values.minority_status}
                      onChange={e => set('minority_status', e.target.checked)}
                      className="rounded text-violet-600 focus:ring-violet-500"
                    />
                    <span className="text-xs font-bold text-slate-700">Minority Category</span>
                  </label>

                  <label className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!values.cwsn_status}
                      onChange={e => set('cwsn_status', e.target.checked)}
                      className="rounded text-violet-600 focus:ring-violet-500"
                    />
                    <span className="text-xs font-bold text-slate-700">CWSN (Special Needs)</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-xs font-bold text-slate-700 transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {activeSection !== 'cbse' && (
              <button
                type="button"
                onClick={() => {
                  const tabs: ('basic' | 'academic' | 'contact' | 'cbse')[] = ['basic', 'academic', 'contact', 'cbse'];
                  const idx = tabs.indexOf(activeSection);
                  if (idx < tabs.length - 1) setActiveSection(tabs[idx + 1]);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all"
              >
                Next Section →
              </button>
            )}

            <button
              type="button"
              onClick={() => submit(false)}
              disabled={isSubmitting}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-md shadow-violet-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Admit Student'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
