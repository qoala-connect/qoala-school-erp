import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, User, GraduationCap, Calendar, Phone, Mail, MapPin, ShieldCheck, 
  Wallet, ClipboardList, Bus, BookOpen, FileText, Heart, ShieldAlert, 
  Activity, Printer, Edit2, TrendingUp, UserMinus, Plus, ExternalLink, 
  CheckCircle2, Clock, AlertTriangle, Download, RefreshCw, Send, Loader2, Award, Camera, Upload
} from 'lucide-react';
import { uploadEntityPhoto } from '@/lib/photoUpload';
import { 
  Student, 
  Student360Tab, 
  StudentAttendanceSummary, 
  StudentFeeSummary, 
  StudentExamSummary, 
  StudentTransportInfo, 
  StudentLibraryBorrowing, 
  StudentDocumentRecord, 
  StudentMedicalRecord, 
  StudentDisciplineRecord, 
  StudentPromotionHistory, 
  StudentActivityLog, 
  StudentStaffNote 
} from '@/types/student';
import TeacherAssignmentModal, { AssignmentPrefill } from '@/components/teachers/TeacherAssignmentModal';
import StudentMarksheetModal from '@/components/results/StudentMarksheetModal';
import StudentAdmitCardModal from '@/components/results/StudentAdmitCardModal';
import FeeReceiptModal from '@/components/fees/FeeReceiptModal';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Student360DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  onEdit: (student: Student) => void;
  onChangeStatus: (student: Student) => void;
  onPromote: (student: Student) => void;
  onPrintID: (student: Student) => void;
  onRefresh: () => void;
}

const TABS: { id: Student360Tab; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'personal', label: 'Personal & Family', icon: User },
  { id: 'academic', label: 'Academics & History', icon: GraduationCap },
  { id: 'attendance', label: 'Attendance', icon: Calendar },
  { id: 'fees', label: 'Fees & Ledgers', icon: Wallet },
  { id: 'examination', label: 'Exams & Grades', icon: ClipboardList },
  { id: 'transport', label: 'Transport', icon: Bus },
  { id: 'library', label: 'Library', icon: BookOpen },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'medical', label: 'Medical & Health', icon: Heart },
  { id: 'discipline', label: 'Discipline', icon: ShieldAlert },
  { id: 'activity', label: 'Notes & Timeline', icon: Clock },
];

export default function Student360Drawer({
  isOpen,
  onClose,
  student,
  onEdit,
  onChangeStatus,
  onPromote,
  onPrintID,
  onRefresh
}: Student360DrawerProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Student360Tab>('overview');

  // Tab Data States
  const [isLoadingTab, setIsLoadingTab] = useState(false);
  const [attendanceData, setAttendanceData] = useState<StudentAttendanceSummary | null>(null);
  const [feeData, setFeeData] = useState<StudentFeeSummary | null>(null);
  const [examData, setExamData] = useState<StudentExamSummary | null>(null);
  const [transportData, setTransportData] = useState<StudentTransportInfo | null>(null);
  const [libraryData, setLibraryData] = useState<StudentLibraryBorrowing[]>([]);
  const [documentData, setDocumentData] = useState<StudentDocumentRecord[]>([]);
  const [medicalData, setMedicalData] = useState<StudentMedicalRecord | null>(null);
  const [disciplineData, setDisciplineData] = useState<StudentDisciplineRecord[]>([]);
  const [promotionData, setPromotionData] = useState<StudentPromotionHistory[]>([]);
  const [activityData, setActivityData] = useState<StudentActivityLog[]>([]);
  const [notesData, setNotesData] = useState<StudentStaffNote[]>([]);
  const [facultyAssignments, setFacultyAssignments] = useState<any[]>([]);
  const [classTeacherInfo, setClassTeacherInfo] = useState<any | null>(null);

  // Note composer state
  const [newNote, setNewNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !student) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPEG, PNG).');
      return;
    }
    setIsUploadingPhoto(true);
    const toastId = toast.loading('Uploading student photograph...');
    try {
      const { url: publicUrl, stored } = await uploadEntityPhoto(file, 'students', student.id);
      const { error } = await supabase.from('students').update({ photo_url: publicUrl }).eq('id', student.id);
      if (error) throw error;
      student.photo_url = publicUrl;
      if (stored) {
        toast.success('Photograph updated & synced across all CBSE documents!', { id: toastId });
      } else {
        toast.warning('Photo saved, but cloud storage was unreachable — it is embedded directly for now.', { id: toastId });
      }
      onRefresh();
    } catch (err: any) {
      console.error('[Student360Drawer] Photo upload failed:', err);
      toast.error('Failed to update student photograph.', { id: toastId });
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  // Document upload state
  const [newDocType, setNewDocType] = useState('Certificate');
  const [newDocUrl, setNewDocUrl] = useState('');
  const [isSavingDoc, setIsSavingDoc] = useState(false);
  const [isMarksheetModalOpen, setIsMarksheetModalOpen] = useState(false);
  const [isAdmitCardModalOpen, setIsAdmitCardModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedReceiptFee, setSelectedReceiptFee] = useState<any | null>(null);

  // Fetch contextual data when student or active tab changes
  useEffect(() => {
    if (!isOpen || !student) return;
    loadTabData(activeTab);
  }, [isOpen, student, activeTab]);

  const loadTabData = async (tab: Student360Tab) => {
    if (!student) return;
    setIsLoadingTab(true);
    try {
      if (tab === 'overview' || tab === 'attendance') {
        const { data: att } = await supabase
          .from('attendance')
          .select('id, attendance_date, status, remarks')
          .eq('student_id', student.id)
          .order('attendance_date', { ascending: false });

        const records = att || [];
        const total = records.length;
        const present = records.filter(r => r.status === 'present').length;
        const absent = records.filter(r => r.status === 'absent').length;
        const late = records.filter(r => r.status === 'late').length;
        const leave = records.filter(r => r.status === 'leave').length;
        const half = records.filter(r => r.status === 'half_day').length;
        const pct = total > 0 ? Math.round(((present + half * 0.5) / total) * 100) : 100;

        setAttendanceData({
          total_days: total,
          present_days: present,
          absent_days: absent,
          late_days: late,
          leave_days: leave,
          half_days: half,
          percentage: pct,
          recent_records: records.slice(0, 15)
        });
      }

      if (tab === 'overview' || tab === 'fees') {
        const { data: feeLedgers, error: feeErr } = await supabase
          .from('student_fees')
          .select(`
            id, total_amount, discount_amount, net_amount, amount_paid, due_date, status,
            fee_categories:fee_category_id (id, category_name),
            fee_payments (id, receipt_number, amount_paid, payment_date, payment_mode)
          `)
          .eq('student_id', student.id)
          .order('due_date', { ascending: false });

        if (feeErr) console.error('Fee load error in Student360Drawer:', feeErr);

        const ledgers = (feeLedgers || []).map((l: any) => ({
          id: l.id,
          fee_category_name: l.fee_categories?.category_name || 'Composite School Fee',
          total_amount: Number(l.total_amount || 0),
          discount_amount: Number(l.discount_amount || 0),
          net_amount: Number(l.net_amount || (Number(l.total_amount || 0) - Number(l.discount_amount || 0))),
          amount_paid: Number(l.amount_paid || 0),
          due_date: l.due_date,
          status: l.status || 'pending',
          receipts: l.fee_payments || []
        }));

        const totalBilled = ledgers.reduce((acc, cur) => acc + cur.net_amount, 0);
        const totalPaid = ledgers.reduce((acc, cur) => acc + cur.amount_paid, 0);
        const totalDiscount = ledgers.reduce((acc, cur) => acc + cur.discount_amount, 0);
        const totalDue = Math.max(0, totalBilled - totalPaid);

        setFeeData({
          total_billed: totalBilled,
          total_paid: totalPaid,
          total_discount: totalDiscount,
          total_outstanding: totalDue,
          status: totalDue === 0 && totalBilled > 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'pending',
          ledgers
        });
      }

      if (tab === 'overview' || tab === 'examination') {
        const [marksRes, resultsRes] = await Promise.all([
          supabase
            .from('marks')
            .select('id, max_marks, obtained_marks, is_absent, exams(exam_name), subjects(subject_name)')
            .eq('student_id', student.id),
          supabase
            .from('exam_results')
            .select('id, total_marks, percentage, grade, division, result_status, exams(exam_name)')
            .eq('student_id', student.id)
        ]);

        const mappedMarks = (marksRes.data || []).map((m: any) => ({
          id: m.id,
          exam_name: m.exams?.exam_name || 'Terminal Exam',
          subject_name: m.subjects?.subject_name || 'Subject',
          max_marks: m.max_marks || 100,
          obtained_marks: m.obtained_marks || 0,
          is_absent: m.is_absent || false
        }));

        const mappedResults = (resultsRes.data || []).map((r: any) => ({
          id: r.id,
          exam_name: r.exams?.exam_name || 'Terminal Exam',
          total_marks: Number(r.total_marks || 0),
          percentage: Number(r.percentage || 0),
          grade: r.grade || 'A',
          division: r.division || 'First',
          result_status: r.result_status || 'Pass'
        }));

        setExamData({
          results: mappedResults,
          subject_marks: mappedMarks
        });
      }

      if (tab === 'overview' || tab === 'transport') {
        const { data: trans, error: transErr } = await supabase
          .from('student_transport')
          .select('*, transport_routes(route_name), vehicles(vehicle_number)')
          .eq('student_id', student.id)
          .maybeSingle();

        if (transErr) console.error('Transport load error in Student360Drawer:', transErr);

        if (trans) {
          setTransportData({
            id: trans.id,
            route_name: trans.transport_routes?.route_name || 'Not on file',
            vehicle_no: trans.vehicles?.vehicle_number || 'Not on file',
            boarding_point: trans.boarding_point || 'Not on file',
            pickup_time: trans.pickup_time || 'Not on file',
            driver_name: 'Not tracked per student',
            driver_phone: 'Not tracked per student'
          });
        } else {
          setTransportData(null);
        }
      }

      if (tab === 'library') {
        const { data: books } = await supabase
          .from('book_issues')
          .select('*, library_books(title, author, isbn)')
          .or(`user_id.eq.${student.id},borrower_name.ilike.%${student.name}%`)
          .order('issue_date', { ascending: false });

        const mapped = (books || []).map((b: any) => ({
          id: b.id,
          book_title: b.library_books?.title || 'Book record unavailable',
          author: b.library_books?.author || 'Unknown author',
          isbn: b.library_books?.isbn || 'N/A',
          issue_date: b.issue_date,
          due_date: b.due_date,
          return_date: b.return_date,
          status: b.status || 'Issued',
          fine_amount: Number(b.fine_amount || 0)
        }));
        setLibraryData(mapped);
      }

      if (tab === 'documents') {
        const { data: docs } = await supabase
          .from('student_documents')
          .select('*')
          .eq('student_id', student.id)
          .order('created_at', { ascending: false });

        setDocumentData(docs || []);
      }

      if (tab === 'overview' || tab === 'medical' || tab === 'personal') {
        const { data: med } = await supabase
          .from('student_medical')
          .select('*')
          .eq('student_id', student.id)
          .maybeSingle();

        setMedicalData(med || null);
      }

      if (tab === 'overview' || tab === 'discipline') {
        const { data: disc } = await supabase
          .from('disciplinary_records')
          .select('*')
          .or(`student_id.eq.${student.id},student_name.ilike.%${student.name}%`)
          .order('incident_date', { ascending: false });

        setDisciplineData(disc || []);
      }

      if (tab === 'academic') {
        const [promosRes, facultyRes] = await Promise.all([
          supabase.from('student_promotions').select('*').eq('student_id', student.id).order('promoted_at', { ascending: false }),
          supabase.from('teacher_assignments').select(`
            id, assignment_type,
            teachers (id, name, employee_id, designation, cbse_teaching_level, phone),
            subjects (id, subject_name),
            classes!inner (class_name),
            sections!inner (section_name)
          `).eq('classes.class_name', student.class).eq('sections.section_name', student.section).eq('is_active', true)
        ]);

        setPromotionData(promosRes.data || []);
        const loadedFaculty = facultyRes.data || [];
        setFacultyAssignments(loadedFaculty);
        const ct = loadedFaculty.find(f => f.assignment_type === 'class_teacher' || f.assignment_type === 'both');
        setClassTeacherInfo(ct?.teachers || null);
      }

      if (tab === 'activity' || tab === 'overview') {
        const [actRes, notesRes] = await Promise.all([
          supabase.from('student_activity').select('*').eq('student_id', student.id).order('created_at', { ascending: false }),
          supabase.from('student_notes').select('*').eq('student_id', student.id).order('created_at', { ascending: false })
        ]);
        setActivityData(actRes.data || []);
        setNotesData(notesRes.data || []);
      }
    } catch (err) {
      console.error(`Error loading tab ${tab}:`, err);
    } finally {
      setIsLoadingTab(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !newNote.trim()) return;

    setIsSavingNote(true);
    try {
      const { data: userAuth } = await supabase.auth.getUser();
      const userEmail = userAuth?.user?.email || 'Teacher / Admin';

      const { data, error } = await supabase.from('student_notes').insert([
        {
          student_id: student.id,
          note: newNote.trim(),
          created_by: userEmail,
          created_at: new Date().toISOString()
        }
      ]).select().single();

      if (error) throw error;

      setNotesData(prev => [data, ...prev]);
      setNewNote('');
      toast.success('Internal staff note recorded.');
    } catch (err: any) {
      toast.error('Failed to save note: ' + err.message);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !newDocUrl.trim()) return;

    setIsSavingDoc(true);
    try {
      const { data, error } = await supabase.from('student_documents').insert([
        {
          student_id: student.id,
          document_type: newDocType,
          file_url: newDocUrl.trim(),
          created_at: new Date().toISOString()
        }
      ]).select().single();

      if (error) throw error;

      setDocumentData(prev => [data, ...prev]);
      setNewDocUrl('');
      toast.success('Document reference linked successfully.');
    } catch (err: any) {
      toast.error('Failed to link document: ' + err.message);
    } finally {
      setIsSavingDoc(false);
    }
  };

  if (!isOpen || !student) return null;

  return (
    <AnimatePresence>
      <div key={student.id} className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-xs flex justify-end">
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col overflow-hidden border-l border-slate-200"
        >
          {/* 1. Header Toolbar */}
          <div className="px-6 py-4 bg-slate-900 text-white shrink-0 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                onChange={handlePhotoUpload}
                className="hidden"
              />

              <div
                onClick={() => !isUploadingPhoto && photoInputRef.current?.click()}
                className="relative w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 p-0.5 shadow-md flex items-center justify-center font-black text-xl text-white shrink-0 cursor-pointer group overflow-hidden"
                title="Click to upload/change passport photograph"
              >
                {student.photo_url ? (
                  <img src={student.photo_url} alt="" className="w-full h-full object-cover rounded-2xl" crossOrigin="anonymous" />
                ) : (
                  student.name.charAt(0).toUpperCase()
                )}

                <div className="absolute inset-0 bg-slate-950/70 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                  {isUploadingPhoto ? (
                    <Loader2 size={16} className="animate-spin text-white" />
                  ) : (
                    <Camera size={16} className="text-white" />
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black tracking-tight text-white">{student.name}</h2>
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                    student.status === 'active' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                    student.status === 'transferred' ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' :
                    student.status === 'graduated' ? 'bg-violet-500/20 text-violet-300 border-violet-500/30' :
                    'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  )}>
                    {student.status}
                  </span>
                </div>
                <div className="text-xs text-slate-300 flex items-center gap-2 mt-0.5">
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-violet-300 font-bold">
                    {student.admission_number}
                  </span>
                  <span>•</span>
                  <span>Class {student.class} - {student.section}</span>
                  <span>•</span>
                  <span>Roll: {student.roll_number || 'N/A'}</span>
                  <span>•</span>
                  <span className="text-slate-400">{student.academic_year}</span>
                </div>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(student)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Edit Student"
              >
                <Edit2 size={13} /> <span className="hidden sm:inline">Edit</span>
              </button>

              <button
                onClick={() => onChangeStatus(student)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Lifecycle Status Change"
              >
                <UserMinus size={13} /> <span className="hidden sm:inline">Status</span>
              </button>

              <button
                onClick={() => onPromote(student)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Class Promotion / Shift"
              >
                <TrendingUp size={13} /> <span className="hidden sm:inline">Promote</span>
              </button>

              <button
                onClick={() => onPrintID(student)}
                className="p-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                title="Print ID Card"
              >
                <Printer size={15} />
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* 2. Workspace Navigation Tabs */}
          <div className="border-b border-slate-200 bg-slate-50 flex overflow-x-auto px-4 shrink-0 custom-scrollbar">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "py-3 px-3.5 flex items-center gap-2 border-b-2 font-bold text-xs whitespace-nowrap transition-all cursor-pointer",
                    isActive
                      ? "border-violet-600 text-violet-700 bg-white font-black"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
                  )}
                >
                  <Icon size={14} className={isActive ? "text-violet-600" : "text-slate-400"} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* 3. Workspace Main Content Body */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">
            {isLoadingTab ? (
              <div className="flex flex-col items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-violet-600 animate-spin mb-2" />
                <p className="text-xs text-slate-500 font-medium">Fetching 360° record from database...</p>
              </div>
            ) : (
              <>
                {/* TAB 1: OVERVIEW */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* KPI Highlights Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                        <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                          <span>Attendance</span>
                          <Calendar size={14} className="text-indigo-500" />
                        </div>
                        <div className="text-2xl font-black text-slate-800 mt-1">
                          {attendanceData ? `${attendanceData.percentage}%` : '100%'}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {attendanceData ? `${attendanceData.present_days}/${attendanceData.total_days} sessions` : 'No logs recorded'}
                        </span>
                      </div>

                      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                        <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                          <span>Fee Balance</span>
                          <Wallet size={14} className="text-emerald-500" />
                        </div>
                        <div className="text-2xl font-black text-slate-800 mt-1">
                          {feeData ? `₹${feeData.total_outstanding.toLocaleString()}` : '₹0'}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {feeData && feeData.total_outstanding === 0 ? 'All fees cleared' : 'Due this session'}
                        </span>
                      </div>

                      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                        <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                          <span>Last Assessment</span>
                          <ClipboardList size={14} className="text-amber-500" />
                        </div>
                        <div className="text-2xl font-black text-slate-800 mt-1">
                          {examData?.results?.[0]?.percentage ? `${examData.results[0].percentage}%` : 'Grade A'}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {examData?.results?.[0]?.exam_name || 'CBSE Term Evaluation'}
                        </span>
                      </div>

                      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                        <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                          <span>Transport Route</span>
                          <Bus size={14} className="text-violet-500" />
                        </div>
                        <div className="text-lg font-black text-slate-800 mt-1 truncate">
                          {transportData ? transportData.route_name : 'Self / Walker'}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {transportData ? transportData.vehicle_no : 'No bus assigned'}
                        </span>
                      </div>
                    </div>

                    {/* Quick Profile Snapshot Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Family & Contact Card */}
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Parent & Contact Details</h4>
                          <button onClick={() => setActiveTab('personal')} className="text-[11px] font-bold text-violet-600 hover:underline">
                            View All →
                          </button>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Father:</span>
                            <span className="font-bold text-slate-800">{student.father_name}</span>
                          </div>
                          {student.mother_name && (
                            <div className="flex justify-between">
                              <span className="text-slate-400 font-medium">Mother:</span>
                              <span className="font-bold text-slate-800">{student.mother_name}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Primary Phone:</span>
                            <span className="font-mono font-bold text-slate-800">{student.phone || 'Not Provided'}</span>
                          </div>
                          {student.email && (
                            <div className="flex justify-between">
                              <span className="text-slate-400 font-medium">Parent Email:</span>
                              <span className="font-medium text-slate-700">{student.email}</span>
                            </div>
                          )}
                          {student.address && (
                            <div className="flex justify-between">
                              <span className="text-slate-400 font-medium">Address:</span>
                              <span className="font-medium text-slate-700 text-right truncate max-w-[200px]">{student.address}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Academic Roster & Attributes */}
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Academic Placement & Tags</h4>
                          <button onClick={() => setActiveTab('academic')} className="text-[11px] font-bold text-violet-600 hover:underline">
                            View All →
                          </button>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Enrolled Class:</span>
                            <span className="font-bold text-slate-800">Class {student.class} - {student.section}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Date of Birth:</span>
                            <span className="font-semibold text-slate-800">{student.date_of_birth}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Gender / Category:</span>
                            <span className="font-semibold text-slate-800 capitalize">{student.gender} • {student.category || 'General'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">House:</span>
                            <span className="font-bold text-violet-700">{student.house_name || 'Tagore House'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">CBSE Reg No:</span>
                            <span className="font-mono text-slate-700">{student.cbse_registration_no || 'Pending Board Reg'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Cross-Module Action Shortcuts */}
                    <div className="p-4 bg-violet-50/70 border border-violet-100 rounded-2xl flex flex-wrap gap-2 items-center justify-between">
                      <div>
                        <span className="text-xs font-black text-violet-900 block">Need deep operational changes?</span>
                        <span className="text-[11px] text-violet-700">Jump directly to specialized ERP management modules:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => navigate('/dashboard/fees', { state: { activeTab: 'student_fees', selectedStudent: student } })}
                          className="px-3 py-1.5 bg-white hover:bg-violet-100 text-violet-800 border border-violet-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <Wallet size={13} /> Collect Fees
                        </button>
                        <button
                          onClick={() => navigate('/dashboard/attendance', { state: { selectedClass: student.class, selectedSection: student.section, selectedStudentId: student.id, activeTab: 'register' } })}
                          className="px-3 py-1.5 bg-white hover:bg-violet-100 text-violet-800 border border-violet-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <Calendar size={13} /> Attendance Register
                        </button>
                        <button
                          onClick={() => navigate('/dashboard/examination?tab=marks')}
                          className="px-3 py-1.5 bg-white hover:bg-violet-100 text-violet-800 border border-violet-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <ClipboardList size={13} /> Marks Entry
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: PERSONAL & FAMILY */}
                {activeTab === 'personal' && (
                  <div className="space-y-5">
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Demographic & Identification Record</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">Full Legal Name</span>
                          <span className="font-bold text-slate-800 text-sm">{student.name}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">Date of Birth</span>
                          <span className="font-semibold text-slate-800">{student.date_of_birth}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">Gender</span>
                          <span className="font-semibold text-slate-800 capitalize">{student.gender}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">Social Category</span>
                          <span className="font-bold text-violet-700">{student.category || 'General'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">Aadhaar (Last 4)</span>
                          <span className="font-mono font-bold text-slate-800">{student.aadhaar_last4 ? `•••• •••• ${student.aadhaar_last4}` : 'Not Linked'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">Blood Group</span>
                          <span className="font-bold text-rose-600">{medicalData?.blood_group || 'Not Recorded'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">House</span>
                          <span className="font-bold text-slate-800">{student.house_name || 'Tagore House'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">Minority Status</span>
                          <span className="font-semibold text-slate-800">{student.minority_status ? 'Yes' : 'No'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">CWSN (Special Needs)</span>
                          <span className="font-semibold text-slate-800">{student.cwsn_status ? `Yes (${student.cwsn_type || 'General'})` : 'No'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Parents & Guardian Registry</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <User size={14} className="text-violet-600" /> Father's Profile
                          </div>
                          <div><span className="text-slate-400">Name:</span> <strong>{student.father_name}</strong></div>
                          <div><span className="text-slate-400">Phone:</span> <strong>{student.phone || 'N/A'}</strong></div>
                          <div><span className="text-slate-400">Email:</span> {student.email || 'N/A'}</div>
                        </div>

                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <User size={14} className="text-indigo-600" /> Mother's Profile
                          </div>
                          <div><span className="text-slate-400">Name:</span> <strong>{student.mother_name || 'Not Provided'}</strong></div>
                          <div><span className="text-slate-400">Emergency Phone:</span> {student.phone || 'N/A'}</div>
                        </div>
                      </div>

                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                        <span className="text-slate-400 font-bold block text-[10px] uppercase">Residential Address</span>
                        <div className="font-medium text-slate-800 mt-1">{student.address || 'Civil Lines, Deoria (U.P.)'}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: ACADEMIC & HISTORY */}
                {activeTab === 'academic' && (
                  <div className="space-y-5">
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Current Class Enrollment</h4>
                        <button onClick={() => onPromote(student)} className="px-3 py-1 bg-violet-600 text-white rounded-lg text-xs font-bold flex items-center gap-1">
                          <TrendingUp size={12} /> Promote Student
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">Enrolled Class</span>
                          <span className="font-bold text-slate-800 text-sm">Class {student.class} - {student.section}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">Roll Number</span>
                          <span className="font-mono font-bold text-slate-800">{student.roll_number || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">Academic Session</span>
                          <span className="font-bold text-violet-700">{student.academic_year}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">Admission Number</span>
                          <span className="font-mono font-bold text-slate-800">{student.admission_number}</span>
                        </div>
                      </div>
                    </div>

                    {/* Faculty Mentorship & Teaching Staff */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                          Faculty Mentorship & Teaching Staff
                        </h4>
                        <span className="text-[11px] text-slate-400 font-medium">Academic Session {student.academic_year}</span>
                      </div>

                      {/* Class Teacher Banner */}
                      <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                            <GraduationCap size={16} />
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                              Designated Class Teacher
                            </span>
                            <span className="text-xs font-bold text-slate-900">
                              {classTeacherInfo?.name || 'Class Teacher Pending Assignment'}
                            </span>
                            {classTeacherInfo?.designation && (
                              <span className="text-[10px] text-emerald-700 block mt-0.5">
                                {classTeacherInfo.designation} ({classTeacherInfo.employee_id})
                              </span>
                            )}
                          </div>
                        </div>

                        {classTeacherInfo?.phone && (
                          <a 
                            href={`tel:${classTeacherInfo.phone}`}
                            className="px-3 py-1.5 bg-white text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold hover:bg-emerald-50 transition-all flex items-center gap-1 shadow-2xs"
                          >
                            <Phone size={12} /> Contact
                          </a>
                        )}
                      </div>

                      {/* Subject Teachers Table */}
                      <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-2">
                          Subject Faculty Roster
                        </span>
                        {facultyAssignments.length === 0 ? (
                          <div className="text-center py-4 text-xs text-slate-400 italic">
                            No subject teachers assigned for Class {student.class}-{student.section} yet.
                          </div>
                        ) : (
                          <div className="overflow-hidden border border-slate-100 rounded-xl">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] uppercase font-bold">
                                <tr>
                                  <th className="px-3 py-2">Curriculum Subject</th>
                                  <th className="px-3 py-2">Assigned Teacher</th>
                                  <th className="px-3 py-2">Designation / Level</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {facultyAssignments.map(fa => (
                                  <tr key={fa.id} className="hover:bg-slate-50">
                                    <td className="px-3 py-2 font-bold text-slate-800">
                                      {fa.subjects?.subject_name || 'Class Mentor'}
                                    </td>
                                    <td className="px-3 py-2 font-semibold text-violet-700">
                                      {fa.teachers?.name || 'Unassigned'}
                                    </td>
                                    <td className="px-3 py-2 text-slate-500 font-mono text-[11px]">
                                      {fa.teachers?.designation || 'Teacher'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Promotion & Class History Logs */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Historical Promotion & Section History</h4>
                      {promotionData.length === 0 ? (
                        <div className="py-6 text-center text-slate-400 text-xs font-medium">
                          No previous promotions logged for this student.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {promotionData.map((promo) => (
                            <div key={promo.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                              <div>
                                <span className="font-bold text-slate-800">Class {promo.from_class} → Class {promo.to_class}</span>
                                <div className="text-[10px] text-slate-500">Session {promo.from_academic_year} to {promo.to_academic_year}</div>
                              </div>
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-black uppercase">
                                Promoted
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 4: ATTENDANCE */}
                {activeTab === 'attendance' && (
                  <div className="space-y-5">
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Attendance Ledger Summary</h4>
                          <p className="text-[11px] text-slate-500">Real-time attendance computation from daily roll call logs.</p>
                        </div>
                        <button
                          onClick={() => navigate('/dashboard/attendance', { state: { selectedClass: student.class, selectedSection: student.section, selectedStudentId: student.id, activeTab: 'register' } })}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-violet-50 text-violet-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink size={12} /> Open Register
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Sessions</span>
                          <span className="text-xl font-black text-slate-800">{attendanceData?.total_days || 0}</span>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                          <span className="text-[10px] font-bold text-emerald-600 uppercase block">Present</span>
                          <span className="text-xl font-black text-emerald-700">{attendanceData?.present_days || 0}</span>
                        </div>
                        <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                          <span className="text-[10px] font-bold text-rose-600 uppercase block">Absent</span>
                          <span className="text-xl font-black text-rose-700">{attendanceData?.absent_days || 0}</span>
                        </div>
                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                          <span className="text-[10px] font-bold text-amber-600 uppercase block">Leave / Late</span>
                          <span className="text-xl font-black text-amber-700">{(attendanceData?.leave_days || 0) + (attendanceData?.late_days || 0)}</span>
                        </div>
                        <div className="p-3 bg-violet-50 rounded-xl border border-violet-100">
                          <span className="text-[10px] font-bold text-violet-600 uppercase block">Overall Rate</span>
                          <span className="text-xl font-black text-violet-700">{attendanceData?.percentage || 100}%</span>
                        </div>
                      </div>

                      {/* Recent Attendance Logs */}
                      <div className="space-y-2 pt-2">
                        <h5 className="text-[11px] font-black uppercase text-slate-600">Recent Attendance Logs</h5>
                        {attendanceData?.recent_records && attendanceData.recent_records.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                              <thead>
                                <tr className="border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase">
                                  <th className="py-2">Date</th>
                                  <th className="py-2">Status</th>
                                  <th className="py-2">Remarks</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {attendanceData.recent_records.map(rec => (
                                  <tr key={rec.id}>
                                    <td className="py-2.5 font-medium text-slate-800">{rec.attendance_date}</td>
                                    <td className="py-2.5">
                                      <span className={cn(
                                        "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                                        rec.status === 'present' ? 'bg-emerald-50 text-emerald-700' :
                                        rec.status === 'absent' ? 'bg-rose-50 text-rose-700' :
                                        'bg-amber-50 text-amber-700'
                                      )}>
                                        {rec.status}
                                      </span>
                                    </td>
                                    <td className="py-2.5 text-slate-500">{rec.remarks || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="py-6 text-center text-slate-400 text-xs">
                            No attendance logs marked for this student yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 5: FEES & LEDGERS */}
                {activeTab === 'fees' && (
                  <div className="space-y-5">
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Fee Account & Ledgers</h4>
                          <p className="text-[11px] text-slate-500">Official fee ledger statements from Financials module.</p>
                        </div>
                        <button
                          onClick={() => navigate('/dashboard/fees', { state: { activeTab: 'student_fees', selectedStudent: student } })}
                          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <ExternalLink size={12} /> Collect Fees in Portal
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Invoiced</span>
                          <span className="text-lg font-black text-slate-800">₹{feeData?.total_billed.toLocaleString() || 0}</span>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                          <span className="text-[10px] font-bold text-emerald-600 uppercase block">Total Paid</span>
                          <span className="text-lg font-black text-emerald-700">₹{feeData?.total_paid.toLocaleString() || 0}</span>
                        </div>
                        <div className="p-3 bg-sky-50 rounded-xl border border-sky-100">
                          <span className="text-[10px] font-bold text-sky-600 uppercase block">Concessions</span>
                          <span className="text-lg font-black text-sky-700">₹{feeData?.total_discount.toLocaleString() || 0}</span>
                        </div>
                        <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                          <span className="text-[10px] font-bold text-rose-600 uppercase block">Due Balance</span>
                          <span className="text-lg font-black text-rose-700">₹{feeData?.total_outstanding.toLocaleString() || 0}</span>
                        </div>
                      </div>

                      {/* Ledgers Table */}
                      <div className="space-y-2 pt-2">
                        <h5 className="text-[11px] font-black uppercase text-slate-600">Fee Invoices & Statements</h5>
                        {feeData?.ledgers && feeData.ledgers.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                              <thead>
                                <tr className="border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase">
                                  <th className="py-2">Fee Head</th>
                                  <th className="py-2">Due Date</th>
                                  <th className="py-2">Net Amount</th>
                                  <th className="py-2">Amount Paid</th>
                                  <th className="py-2">Status</th>
                                  <th className="py-2 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {feeData.ledgers.map(l => (
                                  <tr key={l.id}>
                                    <td className="py-2.5 font-bold text-slate-800">{l.fee_category_name}</td>
                                    <td className="py-2.5 text-slate-500">{l.due_date}</td>
                                    <td className="py-2.5 font-mono">₹{l.net_amount.toLocaleString()}</td>
                                    <td className="py-2.5 font-mono text-emerald-700 font-bold">₹{l.amount_paid.toLocaleString()}</td>
                                    <td className="py-2.5">
                                      <span className={cn(
                                        "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                                        l.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                      )}>
                                        {l.status}
                                      </span>
                                    </td>
                                    <td className="py-2.5 text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        {l.amount_paid > 0 && (
                                          <button
                                            onClick={() => {
                                              const latestPayment: any = l.receipts?.[0] || {};
                                              setSelectedReceiptFee({
                                                id: l.id,
                                                receipt_number: latestPayment.receipt_number || `RCP/${student.admission_number || '2026'}`,
                                                total_amount: Number(latestPayment.amount_paid || l.amount_paid),
                                                paid_amount: Number(latestPayment.amount_paid || l.amount_paid),
                                                amount_paid: Number(latestPayment.amount_paid || l.amount_paid),
                                                remaining_amount: Math.max(0, (l.net_amount || l.total_amount) - l.amount_paid),
                                                category_name: l.fee_category_name,
                                                payment_mode: latestPayment.payment_mode || 'Cash',
                                                payment_date: latestPayment.payment_date || new Date().toISOString().split('T')[0],
                                                academic_year: student.academic_year || '2026-27',
                                                students: {
                                                  name: student.name,
                                                  class: `${student.class} - ${student.section}`,
                                                  roll_number: student.roll_number,
                                                  admission_number: student.admission_number,
                                                  father_name: student.father_name,
                                                  phone: student.phone
                                                }
                                              });
                                              setIsReceiptModalOpen(true);
                                            }}
                                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                                            title="View / Print Receipt"
                                          >
                                            <Printer size={11} /> Receipt
                                          </button>
                                        )}

                                        {l.status !== 'paid' && (
                                          <button
                                            onClick={() => {
                                              onClose();
                                              navigate('/dashboard/fees', {
                                                state: {
                                                  activeTab: 'student_fees',
                                                  selectedStudent: student,
                                                  targetFeeLedger: l
                                                }
                                              });
                                            }}
                                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shadow-2xs transition-colors cursor-pointer"
                                          >
                                            Collect
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="py-6 text-center text-slate-400 text-xs">
                            No active fee obligations pending for this student.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 6: EXAMINATION & GRADES */}
                {activeTab === 'examination' && (
                  <div className="space-y-5">
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Assessments & CBSE Marksheets</h4>
                          <p className="text-[11px] text-slate-500">Live academic performance data from Examination module.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setIsAdmitCardModalOpen(true)}
                            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Calendar size={13} /> View Admit Card
                          </button>
                          <button
                            onClick={() => setIsMarksheetModalOpen(true)}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Award size={13} /> View Official Marksheet
                          </button>
                          <button
                            onClick={() => navigate('/dashboard/examination?tab=marks')}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-violet-50 text-violet-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <ExternalLink size={12} /> Open Marks Entry
                          </button>
                        </div>
                      </div>

                      {examData?.subject_marks && examData.subject_marks.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase">
                                <th className="py-2">Exam Title</th>
                                <th className="py-2">Subject</th>
                                <th className="py-2">Max Marks</th>
                                <th className="py-2">Obtained Marks</th>
                                <th className="py-2">Performance</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {examData.subject_marks.map(m => {
                                const pct = m.max_marks > 0 ? Math.round((m.obtained_marks / m.max_marks) * 100) : 0;
                                return (
                                  <tr key={m.id}>
                                    <td className="py-2.5 font-bold text-slate-800">{m.exam_name}</td>
                                    <td className="py-2.5 text-slate-700">{m.subject_name}</td>
                                    <td className="py-2.5 font-mono">{m.max_marks}</td>
                                    <td className="py-2.5 font-mono font-bold text-violet-700">{m.obtained_marks}</td>
                                    <td className="py-2.5">
                                      <span className={cn(
                                        "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                                        pct >= 75 ? 'bg-emerald-50 text-emerald-700' :
                                        pct >= 50 ? 'bg-indigo-50 text-indigo-700' :
                                        'bg-amber-50 text-amber-700'
                                      )}>
                                        {pct}%
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-8 text-center text-slate-400 text-xs">
                          No assessment marks published for this student yet.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 7: TRANSPORT */}
                {activeTab === 'transport' && (
                  <div className="space-y-5">
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Assigned School Transit</h4>
                          <p className="text-[11px] text-slate-500">Fleet details and designated boarding stop.</p>
                        </div>
                        <button
                          onClick={() => navigate('/dashboard/transport')}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-violet-50 text-violet-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink size={12} /> Transport Hub
                        </button>
                      </div>

                      {transportData ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                            <div><span className="text-slate-400 font-bold block text-[10px] uppercase">Route Name</span><strong className="text-sm">{transportData.route_name}</strong></div>
                            <div><span className="text-slate-400 font-bold block text-[10px] uppercase">Designated Vehicle</span><strong className="text-sm text-violet-700">{transportData.vehicle_no}</strong></div>
                          </div>
                          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                            <div><span className="text-slate-400 font-bold block text-[10px] uppercase">Boarding Stop</span><strong>{transportData.boarding_point}</strong></div>
                            <div><span className="text-slate-400 font-bold block text-[10px] uppercase">Pickup Time</span><strong>{transportData.pickup_time}</strong></div>
                            <div><span className="text-slate-400 font-bold block text-[10px] uppercase">Driver Contact</span><strong>{transportData.driver_name} ({transportData.driver_phone})</strong></div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-8 text-center text-slate-400 text-xs">
                          This student is not registered for school transport (Self-commuter).
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 8: LIBRARY */}
                {activeTab === 'library' && (
                  <div className="space-y-5">
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Library Borrowings & Returns</h4>
                          <p className="text-[11px] text-slate-500">Live book issue records and overdue penalties.</p>
                        </div>
                        <button
                          onClick={() => navigate('/dashboard/library')}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-violet-50 text-violet-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink size={12} /> Library Desk
                        </button>
                      </div>

                      {libraryData.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase">
                                <th className="py-2">Book Title</th>
                                <th className="py-2">Issue Date</th>
                                <th className="py-2">Due Date</th>
                                <th className="py-2">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {libraryData.map(b => (
                                <tr key={b.id}>
                                  <td className="py-2.5 font-bold text-slate-800">{b.book_title}</td>
                                  <td className="py-2.5 text-slate-500">{b.issue_date}</td>
                                  <td className="py-2.5 text-slate-500">{b.due_date}</td>
                                  <td className="py-2.5">
                                    <span className={cn(
                                      "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                                      b.status === 'Returned' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                    )}>
                                      {b.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-8 text-center text-slate-400 text-xs">
                          No active books borrowed by this student.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 9: DOCUMENTS */}
                {activeTab === 'documents' && (
                  <div className="space-y-5">
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Official Student Documents &amp; Certificates</h4>
                          <p className="text-[11px] text-slate-500">{documentData.length} records linked</p>
                        </div>
                        <button
                          onClick={() => navigate('/dashboard/certificates', {
                            state: {
                              student: {
                                id: student.id,
                                name: (student as any).full_name || student.name,
                                admission_number: student.admission_number,
                                class_name: student.class,
                                roll_number: student.roll_number,
                                father_name: student.father_name,
                                mother_name: student.mother_name,
                                date_of_birth: student.date_of_birth,
                                section: student.section
                              }
                            }
                          })}
                          className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Award size={12} /> Issue Certificate / TC
                        </button>
                      </div>

                      {/* Add Document Link Form */}
                      <form onSubmit={handleAddDocument} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-2.5 items-center">
                        <select
                          value={newDocType}
                          onChange={e => setNewDocType(e.target.value)}
                          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none w-full sm:w-auto"
                        >
                          <option value="Birth Certificate">Birth Certificate</option>
                          <option value="Transfer Certificate">Transfer Certificate (TC)</option>
                          <option value="Previous Marksheet">Previous Marksheet</option>
                          <option value="Aadhaar Card">Aadhaar Card</option>
                          <option value="Medical Fitness">Medical Certificate</option>
                          <option value="Special Achievement">Achievement Certificate</option>
                        </select>

                        <input
                          type="text"
                          value={newDocUrl}
                          onChange={e => setNewDocUrl(e.target.value)}
                          placeholder="Document URL / File URI (e.g. https://...)"
                          className="w-full flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/20"
                        />

                        <button
                          type="submit"
                          disabled={isSavingDoc || !newDocUrl.trim()}
                          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1 shrink-0"
                        >
                          <Plus size={14} /> Add Document
                        </button>
                      </form>

                      {documentData.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {documentData.map(doc => (
                            <div key={doc.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2.5">
                                <FileText size={16} className="text-violet-600 shrink-0" />
                                <div>
                                  <div className="font-bold text-slate-800">{doc.document_type}</div>
                                  <div className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">{doc.file_url}</div>
                                </div>
                              </div>
                              <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold"
                              >
                                View
                              </a>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-slate-400 text-xs">
                          No supplemental certificates uploaded yet.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 10: MEDICAL */}
                {activeTab === 'medical' && (
                  <div className="space-y-5">
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Health Profile & Clinical Notes</h4>
                          <p className="text-[11px] text-slate-500">Managed through Campus Health Clinic.</p>
                        </div>
                        <button
                          onClick={() => navigate('/dashboard/medical')}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-violet-50 text-violet-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink size={12} /> Medical Hub
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                          <div><span className="text-slate-400 font-bold block text-[10px] uppercase">Blood Group</span><strong className="text-rose-600 text-sm">{medicalData?.blood_group || student.category || 'O+'}</strong></div>
                          <div><span className="text-slate-400 font-bold block text-[10px] uppercase">Known Allergies</span><strong>{medicalData?.allergies || 'None Reported'}</strong></div>
                          <div><span className="text-slate-400 font-bold block text-[10px] uppercase">Vaccination Status</span><strong>{medicalData?.vaccination_status || 'Up to Date'}</strong></div>
                        </div>

                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                          <div><span className="text-slate-400 font-bold block text-[10px] uppercase">Emergency Contact</span><strong>{medicalData?.emergency_contact_name || student.father_name} ({medicalData?.emergency_contact_phone || student.phone || 'N/A'})</strong></div>
                          <div><span className="text-slate-400 font-bold block text-[10px] uppercase">Family Physician</span><strong>{medicalData?.doctor_name || 'Campus Medical Officer'}</strong></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 11: DISCIPLINE */}
                {activeTab === 'discipline' && (
                  <div className="space-y-5">
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Disciplinary & Conduct History</h4>
                          <p className="text-[11px] text-slate-500">Incident reports and counseling intervention records.</p>
                        </div>
                        <button
                          onClick={() => navigate('/dashboard/discipline')}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-violet-50 text-violet-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink size={12} /> Discipline Desk
                        </button>
                      </div>

                      {disciplineData.length > 0 ? (
                        <div className="space-y-2.5">
                          {disciplineData.map(disc => (
                            <div key={disc.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-start justify-between text-xs">
                              <div className="space-y-1">
                                <div className="font-bold text-slate-900">{disc.incident_type}</div>
                                <div className="text-slate-600">{disc.description}</div>
                                <div className="text-[10px] text-slate-400">Action: {disc.action_taken || 'Counseling'} • {disc.incident_date}</div>
                              </div>
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                                disc.severity === 'High' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                              )}>
                                {disc.severity}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-slate-400 text-xs">
                          Clean record! No disciplinary incidents reported.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 12: ACTIVITY & NOTES */}
                {activeTab === 'activity' && (
                  <div className="space-y-5">
                    {/* Add Staff Note Form */}
                    <form onSubmit={handleAddNote} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Add Internal Staff Note</h4>
                      <textarea
                        rows={2}
                        value={newNote}
                        onChange={e => setNewNote(e.target.value)}
                        placeholder="e.g. Discussed math homework improvement with parent during PTM; positive progress."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isSavingNote || !newNote.trim()}
                          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Send size={13} /> Save Staff Note
                        </button>
                      </div>
                    </form>

                    {/* Timeline */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Student Lifecycle Activity Timeline</h4>
                      <div className="space-y-3">
                        {notesData.map(note => (
                          <div key={note.id} className="p-3 bg-violet-50/50 rounded-xl border border-violet-100 text-xs space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-violet-700 font-bold">
                              <span>Staff Note ({note.created_by || 'Teacher'})</span>
                              <span>{new Date(note.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="text-slate-800 font-medium">{note.note}</div>
                          </div>
                        ))}

                        {activityData.map(act => (
                          <div key={act.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                              <span>{act.activity_type}</span>
                              <span>{new Date(act.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="text-slate-800 font-medium">{act.description}</div>
                          </div>
                        ))}

                        {notesData.length === 0 && activityData.length === 0 && (
                          <div className="py-6 text-center text-slate-400 text-xs">
                            No notes or lifecycle activity logged yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>

      <StudentMarksheetModal
        isOpen={isMarksheetModalOpen}
        onClose={() => setIsMarksheetModalOpen(false)}
        student={student}
        marks={examData?.subject_marks}
        attendanceData={attendanceData}
        medicalData={medicalData}
      />

      <StudentAdmitCardModal
        isOpen={isAdmitCardModalOpen}
        onClose={() => setIsAdmitCardModalOpen(false)}
        student={student}
        exam={{
          exam_name: 'CBSE ANNUAL EXAMINATION 2026-2027',
          academic_year: '2026-2027'
        }}
      />

      <FeeReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setSelectedReceiptFee(null);
        }}
        fee={selectedReceiptFee}
      />
    </AnimatePresence>
  );
}
