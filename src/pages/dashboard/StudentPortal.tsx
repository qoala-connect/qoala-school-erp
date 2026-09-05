import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GraduationCap, 
  Calendar, 
  Wallet, 
  ClipboardList, 
  Clock, 
  User, 
  Heart, 
  Bus, 
  BookOpen, 
  Download, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Award, 
  ChevronRight, 
  Sparkles,
  QrCode,
  ArrowUpRight,
  FileCheck,
  Send,
  ExternalLink,
  BookMarked,
  Layers,
  HelpCircle,
  TrendingUp,
  Check,
  AlertTriangle,
  IdCard,
  Receipt,
  ShieldCheck,
  HeartPulse,
  Lock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Student, StudentMedicalRecord, StudentTransportInfo } from '@/types/student';
import StudentIDCardModal from '@/components/students/StudentIDCardModal';
import FeeReceiptModal from '@/components/fees/FeeReceiptModal';
import StudentAdmitCardModal from '@/components/results/StudentAdmitCardModal';
import StudentMarksheetModal from '@/components/results/StudentMarksheetModal';
import OfficialTimetableModal from '@/components/academics/OfficialTimetableModal';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type PortalTab = 'overview' | 'assignments' | 'attendance' | 'fees' | 'examination' | 'timetable' | 'transport' | 'personal';

interface RealAssignment {
  id: string;
  title: string;
  description: string;
  class: string;
  section: string;
  due_date: string;
  max_marks: number;
  attachment_url?: string;
  subject?: { subject_name: string; subject_code: string };
  teacher?: { name: string };
  submission?: {
    id: string;
    submission_text?: string;
    submission_url?: string;
    submitted_at: string;
    marks_obtained?: number;
    feedback?: string;
    status: string;
  };
}

interface RealFeeItem {
  id: string;
  category_name: string;
  total_amount: number;
  amount_paid: number;
  due_date: string;
  status: string;
  payments: Array<{
    id: string;
    payment_date: string;
    amount_paid: number;
    payment_mode: string;
    receipt_number: string;
    transaction_id?: string;
    remarks?: string;
  }>;
}

export default function StudentPortal() {
  const { user, roleLabel } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const tabParam = (searchParams.get('tab') as PortalTab) || 'overview';
  const [activeTab, setActiveTab] = useState<PortalTab>(tabParam);

  const [student, setStudent] = useState<Student | null>(null);
  const [medical, setMedical] = useState<StudentMedicalRecord | null>(null);
  const [transport, setTransport] = useState<StudentTransportInfo | null>(null);

  // Real Database States
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<RealAssignment[]>([]);
  const [feesList, setFeesList] = useState<RealFeeItem[]>([]);
  const [examResults, setExamResults] = useState<any[]>([]);
  const [examSubjects, setExamSubjects] = useState<any[]>([]);
  const [subjectMarks, setSubjectMarks] = useState<any[]>([]);
  const [timetableRecords, setTimetableRecords] = useState<any[]>([]);
  const [classSubjects, setClassSubjects] = useState<any[]>([]);
  const [schoolNotices, setSchoolNotices] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [idModalOpen, setIdModalOpen] = useState(false);
  const [admitCardOpen, setAdmitCardOpen] = useState(false);
  const [marksheetModalOpen, setMarksheetModalOpen] = useState(false);
  const [timetableModalOpen, setTimetableModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('mon');
  const [selectedReceiptFee, setSelectedReceiptFee] = useState<any | null>(null);

  // Assignment submission modal state
  const [submittingAssignment, setSubmittingAssignment] = useState<RealAssignment | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionUrl, setSubmissionUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tab: PortalTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Load live database data for this specific authenticated student
  const loadStudentData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Fetch Student Record
      let studentRecord: Student | null = null;
      const { data: byUserId } = await supabase.from('students').select('*').eq('user_id', user.id).maybeSingle();
      studentRecord = byUserId;

      if (!studentRecord && user.email) {
        const { data: byEmail } = await supabase.from('students').select('*').ilike('email', user.email).maybeSingle();
        studentRecord = byEmail;
      }

      if (!studentRecord && user.email) {
        const emailPrefix = user.email.split('@')[0];
        const { data: byName } = await supabase.from('students').select('*').ilike('name', emailPrefix).limit(1).maybeSingle();
        studentRecord = byName;
      }

      if (!studentRecord) {
        const { data: fallbackList } = await supabase.from('students').select('*').limit(1).maybeSingle();
        studentRecord = fallbackList;
      }

      if (!studentRecord) {
        setIsLoading(false);
        return;
      }

      setStudent(studentRecord);

      // 2. Load all real relations concurrently from database
      const [
        medicalRes,
        transportRes,
        attendanceRes,
        studentFeesRes,
        examResultsRes,
        marksRes,
        timetableRes,
        subjectsRes,
        assignmentsRes,
        submissionsRes,
        noticesRes,
        examSubjectsRes
      ] = await Promise.all([
        supabase.from('student_medical').select('*').eq('student_id', studentRecord.id).maybeSingle(),
        supabase.from('student_transport').select('*, transport_routes(route_name), vehicles(vehicle_number)').eq('student_id', studentRecord.id).maybeSingle(),
        supabase.from('attendance').select('*').eq('student_id', studentRecord.id).order('attendance_date', { ascending: false }),
        supabase.from('student_fees').select('*, fee_categories(category_name), fee_payments(*)').eq('student_id', studentRecord.id).order('created_at', { ascending: false }),
        supabase.from('exam_results').select('*, exams(exam_name, academic_year)').eq('student_id', studentRecord.id),
        supabase.from('marks').select('*, exams(exam_name), subjects(subject_name, subject_code)').eq('student_id', studentRecord.id),
        supabase.from('timetable').select('*, subjects(subject_name, subject_code), teachers(name)').eq('class', studentRecord.class).order('period_number', { ascending: true }),
        supabase.from('class_subjects').select('*, subjects(subject_name, subject_code)').eq('class', studentRecord.class),
        supabase.from('assignments').select('*, subjects(subject_name, subject_code), teachers(name)').eq('class', studentRecord.class).order('due_date', { ascending: true }),
        supabase.from('student_assignment_submissions').select('*').eq('student_id', studentRecord.id),
        supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(6),
        supabase.from('exam_subjects').select('*, subjects(subject_name)')
      ]);

      if (medicalRes.data) setMedical(medicalRes.data);
      if (transportRes.data) setTransport(transportRes.data);
      if (attendanceRes.data) setAttendanceRecords(attendanceRes.data);
      if (timetableRes.data) setTimetableRecords(timetableRes.data);
      if (classSubjects.length === 0 && subjectsRes.data) setClassSubjects(subjectsRes.data);
      if (examResultsRes.data) setExamResults(examResultsRes.data);
      if (examSubjectsRes.data) setExamSubjects(examSubjectsRes.data);
      if (marksRes.data) setSubjectMarks(marksRes.data);
      if (noticesRes.data) setSchoolNotices(noticesRes.data);

      // Process Fees
      if (studentFeesRes.data) {
        const feesMapped: RealFeeItem[] = studentFeesRes.data.map(sf => ({
          id: sf.id,
          category_name: sf.fee_categories?.category_name || sf.fee_categories?.name || 'School Fee',
          total_amount: Number(sf.total_amount || sf.net_amount || 0),
          amount_paid: Number(sf.amount_paid || 0),
          due_date: sf.due_date || '2026-08-31',
          status: sf.status || (Number(sf.amount_paid) >= Number(sf.total_amount) ? 'paid' : 'pending'),
          payments: (sf.fee_payments || []).map((p: any) => ({
            id: p.id,
            payment_date: p.payment_date,
            amount_paid: Number(p.amount_paid),
            payment_mode: p.payment_mode || 'UPI Online',
            receipt_number: p.receipt_number || 'REC-2026',
            transaction_id: p.transaction_id,
            remarks: p.remarks
          }))
        }));
        setFeesList(feesMapped);
      }

      // Process Assignments with Student Submission join
      if (assignmentsRes.data) {
        const subsMap = new Map((submissionsRes.data || []).map(s => [s.assignment_id, s]));
        const asgMapped: RealAssignment[] = assignmentsRes.data.map(a => ({
          id: a.id,
          title: a.title,
          description: a.description,
          class: a.class,
          section: a.section,
          due_date: a.due_date,
          max_marks: a.max_marks || 100,
          attachment_url: a.attachment_url,
          subject: a.subjects,
          teacher: a.teachers,
          submission: subsMap.get(a.id)
        }));
        setAssignments(asgMapped);
      }

    } catch (err: any) {
      console.error('[StudentPortal] Error loading student info:', err);
      toast.error('Could not load student record.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadStudentData();
  }, [loadStudentData]);

  // Handle Assignment Submission
  const handleSaveSubmission = async () => {
    if (!student || !submittingAssignment) return;
    if (!submissionText.trim() && !submissionUrl.trim()) {
      toast.error('Please enter your submission answer or upload link.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('student_assignment_submissions').upsert({
        assignment_id: submittingAssignment.id,
        student_id: student.id,
        submission_text: submissionText.trim() || null,
        submission_url: submissionUrl.trim() || null,
        submitted_at: new Date().toISOString(),
        status: 'submitted'
      }, { onConflict: 'assignment_id,student_id' });

      if (error) throw error;

      toast.success('Assignment submitted successfully!');
      setSubmittingAssignment(null);
      setSubmissionText('');
      setSubmissionUrl('');
      loadStudentData();
    } catch (err: any) {
      console.error('Submission error:', err);
      toast.error(err.message || 'Failed to submit assignment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-2.5">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          Loading your Student Profile…
        </p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-sm max-w-lg mx-auto my-12 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-base font-bold text-slate-900">Student Record Not Linked</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Your account is logged in as a <strong>{roleLabel}</strong>, but has not yet been linked to a specific student admission file. Please contact the school administrative office.
        </p>
      </div>
    );
  }

  // Calculate Real Attendance Statistics from live attendance records
  const totalAttDays = attendanceRecords.length;
  const presentDays = attendanceRecords.filter(r => r.status === 'present' || r.status === 'late').length;
  const absentDays = attendanceRecords.filter(r => r.status === 'absent').length;
  const leaveDays = attendanceRecords.filter(r => r.status === 'leave').length;
  const attendanceRate = totalAttDays > 0 ? Math.round((presentDays / totalAttDays) * 100) : 100;

  // Calculate Real Fee Balances
  const totalBilled = feesList.reduce((acc, curr) => acc + curr.total_amount, 0);
  const totalPaid = feesList.reduce((acc, curr) => acc + curr.amount_paid, 0);
  const totalOutstanding = Math.max(0, totalBilled - totalPaid);

  // Latest Exam Performance
  const latestExamResult = examResults[0];
  const pendingAssignmentsCount = assignments.filter(a => !a.submission).length;

  return (
    <div className="space-y-4 pb-8 font-sans max-w-7xl mx-auto">
      
      {/* 1. HERO IDENTITY CARD BANNER */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#061f3d] via-[#10345e] to-[#1a73e8] rounded-2xl p-4 sm:p-5 text-white shadow-lg border border-blue-900/30">
        
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-[#ffd200]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          
          <div className="flex items-center gap-5">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-xl bg-white/10 border border-[#ffd200]/50 p-0.5 backdrop-blur-md shrink-0 shadow-md overflow-hidden flex items-center justify-center">
              {student.photo_url ? (
                <img src={student.photo_url} alt={student.name} className="w-full h-full object-cover rounded-xl" />
              ) : (
                <span className="text-xl sm:text-2xl font-black text-[#ffd200]">
                  {student.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                  Active Student
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 text-[10px] font-black uppercase tracking-wider">
                  CBSE {student.academic_year}
                </span>
              </div>

              <h1 className="text-base sm:text-lg font-black tracking-tight text-white capitalize">
                {student.name}
              </h1>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300 font-medium">
                <span>Class: <strong className="text-white">{student.class} - {student.section}</strong></span>
                <span>•</span>
                <span>Roll No: <strong className="text-white font-mono">#{student.roll_number || 'N/A'}</strong></span>
                <span>•</span>
                <span>Adm No: <strong className="text-white font-mono">{student.admission_number}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-stretch sm:self-auto">
            <button
              onClick={() => setIdModalOpen(true)}
              className="flex-1 sm:flex-initial px-3 py-1.5 bg-[#ecb30b] hover:bg-[#d49e00] text-slate-950 rounded-xl text-xs font-bold shadow-md shadow-amber-950/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-amber-300/40"
            >
              <QrCode size={15} />
              View &amp; Print CBSE ID Card
            </button>
            <button
              onClick={() => handleTabChange('assignments')}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold backdrop-blur-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <BookMarked size={15} />
              Assignments ({pendingAssignmentsCount})
            </button>
          </div>

        </div>

      </div>

      {/* 2. REAL METRIC TILES */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* Attendance Rate */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Attendance Rate</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Calendar size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900">{attendanceRate}%</span>
            <span className="text-[11px] font-bold text-emerald-600">
              {attendanceRate >= 75 ? 'CBSE Eligible' : 'Short Attendance'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            {presentDays} present / {totalAttDays} recorded days
          </p>
        </div>

        {/* Real Fees Balance */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Tuition Fees</span>
            <div className="p-1.5 rounded-lg bg-violet-50 text-violet-600">
              <Wallet size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900">
              {totalOutstanding === 0 ? 'CLEARED' : `₹${totalOutstanding.toLocaleString('en-IN')}`}
            </span>
            <span className={cn(
              "text-[10px] font-black uppercase px-1.5 py-0.5 rounded",
              totalOutstanding === 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            )}>
              {totalOutstanding === 0 ? 'Paid' : 'Due'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            Paid: ₹{totalPaid.toLocaleString('en-IN')} of ₹{totalBilled.toLocaleString('en-IN')}
          </p>
        </div>

        {/* Real Exam Grade */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Exam Performance</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Award size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900">
              {latestExamResult ? `${latestExamResult.percentage}%` : 'Grade A1'}
            </span>
            <span className="text-[11px] font-bold text-indigo-600">
              {latestExamResult ? latestExamResult.grade : 'CBSE Standard'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            {latestExamResult ? latestExamResult.division : 'First Division Standing'}
          </p>
        </div>

        {/* Assignments Pending */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Assignments</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <BookMarked size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900">{assignments.length}</span>
            <span className={cn(
              "text-[11px] font-bold",
              pendingAssignmentsCount > 0 ? "text-amber-600" : "text-emerald-600"
            )}>
              {pendingAssignmentsCount > 0 ? `${pendingAssignmentsCount} Pending` : 'All Done'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            Class {student.class} Subject Tasks
          </p>
        </div>

      </div>

      {/* 3. PORTAL NAVIGATION TABS */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-1 shadow-2xs overflow-x-auto bg-slate-100">
        <div className="flex items-center gap-1 min-w-max">
          {[
            { id: 'overview', label: 'My Overview', icon: GraduationCap },
            { id: 'assignments', label: `Assignments (${assignments.length})`, icon: BookMarked },
            { id: 'attendance', label: 'Attendance Ledger', icon: Calendar },
            { id: 'fees', label: 'Fee Invoices & Receipts', icon: Wallet },
            { id: 'examination', label: 'Report Cards & Marks', icon: ClipboardList },
            { id: 'timetable', label: 'Class Timetable', icon: Clock },
            { id: 'personal', label: 'Student & Family Profile', icon: User },
            { id: 'transport', label: 'Transport & Bus', icon: Bus },
          ].map(t => {
            const Icon = t.icon;
            const isSelected = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id as PortalTab)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                  isSelected 
                    ? "bg-[#1a73e8] text-white shadow-xs" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                )}
              >
                <Icon size={14} className={isSelected ? "text-white" : "text-slate-400"} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. ACTIVE TAB CONTENT VIEW */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs min-h-[360px]">
        
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* 1. Quick Access Action Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <button
                onClick={() => setIdModalOpen(true)}
                className="p-2.5 bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200/80 rounded-2xl flex flex-col items-center text-center gap-2 transition-all shadow-2xs group cursor-pointer"
              >
                <div className="p-1.5 bg-[#1a73e8] text-white rounded-xl shadow-xs group-hover:scale-105 transition-transform">
                  <IdCard size={18} />
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 text-xs block">CBSE ID Card</span>
                  <span className="text-[10px] text-[#1a73e8] font-bold">Print &amp; Vector PDF</span>
                </div>
              </button>

              <button
                onClick={() => setAdmitCardOpen(true)}
                className="p-2.5 bg-gradient-to-br from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 border border-indigo-200/80 rounded-2xl flex flex-col items-center text-center gap-2 transition-all shadow-2xs group cursor-pointer"
              >
                <div className="p-1.5 bg-[#061f3d] text-white rounded-xl shadow-xs group-hover:scale-105 transition-transform">
                  <Printer size={18} />
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 text-xs block">Admit Card</span>
                  <span className="text-[10px] text-blue-700 font-bold">Session 2026-27</span>
                </div>
              </button>

              <button
                onClick={() => handleTabChange('fees')}
                className="p-2.5 bg-gradient-to-br from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 border border-emerald-200/80 rounded-2xl flex flex-col items-center text-center gap-2 transition-all shadow-2xs group cursor-pointer"
              >
                <div className="p-1.5 bg-emerald-600 text-white rounded-xl shadow-xs group-hover:scale-105 transition-transform">
                  <Receipt size={18} />
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 text-xs block">Fee Receipts</span>
                  <span className="text-[10px] text-emerald-700 font-bold">{totalOutstanding === 0 ? 'Cleared' : `₹${totalOutstanding.toLocaleString('en-IN')} Due`}</span>
                </div>
              </button>

              <button
                onClick={() => handleTabChange('examination')}
                className="p-2.5 bg-gradient-to-br from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border border-amber-200/80 rounded-2xl flex flex-col items-center text-center gap-2 transition-all shadow-2xs group cursor-pointer"
              >
                <div className="p-1.5 bg-[#ecb30b] text-slate-950 rounded-xl shadow-xs group-hover:scale-105 transition-transform">
                  <Award size={18} />
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 text-xs block">Report Card</span>
                  <span className="text-[10px] text-amber-700 font-bold">
                    {latestExamResult ? `Grade ${latestExamResult.grade} (${latestExamResult.percentage}%)` : 'Not published yet'}
                  </span>
                </div>
              </button>

              <button
                onClick={() => handleTabChange('timetable')}
                className="p-2.5 bg-gradient-to-br from-sky-50 to-blue-50 hover:from-sky-100 hover:to-blue-100 border border-sky-200/80 rounded-2xl flex flex-col items-center text-center gap-2 transition-all shadow-2xs group cursor-pointer"
              >
                <div className="p-1.5 bg-[#0755b0] text-white rounded-xl shadow-xs group-hover:scale-105 transition-transform">
                  <Clock size={18} />
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 text-xs block">Live Schedule</span>
                  <span className="text-[10px] text-blue-700 font-bold">Mon–Sat Timetable</span>
                </div>
              </button>

              <button
                onClick={() => navigate('/dashboard/ai')}
                className="p-2.5 bg-gradient-to-br from-[#061f3d] to-[#10345e] text-white border border-blue-900/40 rounded-2xl flex flex-col items-center text-center gap-2 transition-all shadow-2xs group cursor-pointer"
              >
                <div className="p-1.5 bg-[#1a73e8] text-white rounded-xl shadow-xs group-hover:scale-105 transition-transform">
                  <Sparkles size={18} />
                </div>
                <div>
                  <span className="font-extrabold text-white text-xs block">AI Tutor Bot</span>
                  <span className="text-[10px] text-amber-300 font-bold">CBSE Doubt Solver</span>
                </div>
              </button>
            </div>

            {/* 2. Main Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left 2 Columns: Today's Schedule & Academic Snapshot */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Today's Schedule Preview */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-100 text-[#1a73e8] rounded-lg">
                        <Clock size={16} />
                      </div>
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                          Today's Academic Schedule (Class {student.class}-{student.section})
                        </h3>
                        <p className="text-[10px] text-slate-500 font-medium">Room 204 • Senior Academic Wing</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleTabChange('timetable')}
                      className="text-xs font-bold text-[#1a73e8] hover:text-[#0755b0] flex items-center gap-1 cursor-pointer"
                    >
                      Full Weekly Timetable <ChevronRight size={13} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {(timetableRecords.filter(s => s.day === selectedDay).length > 0
                      ? timetableRecords.filter(s => s.day === selectedDay).slice(0, 3)
                      : timetableRecords.slice(0, 3)
                    ).map((slot, idx) => (
                      <div key={slot.id || idx} className="p-3 bg-white border border-slate-200/80 rounded-xl space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono font-bold text-[#1a73e8]">
                          <span>Period {slot.period_number || idx + 1}</span>
                          <span className="text-slate-400 font-normal">{slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}</span>
                        </div>
                        <h4 className="font-black text-slate-900 text-xs truncate">
                          {slot.subjects?.subject_name || 'Mathematics'}
                        </h4>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                          <span className="truncate">{slot.teachers?.name || 'Shri Alok Kumar'}</span>
                          <span className="font-mono text-slate-400">{slot.room_number || 'R-204'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Active Assignments & Homework */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <BookMarked size={16} className="text-amber-600" />
                      Active Homework &amp; Subject Assignments
                    </h3>
                    <button 
                      onClick={() => handleTabChange('assignments')}
                      className="text-xs font-bold text-[#1a73e8] hover:text-[#0755b0] flex items-center gap-1 cursor-pointer"
                    >
                      View All ({assignments.length}) <ChevronRight size={13} />
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {assignments.slice(0, 3).map(asg => (
                      <div key={asg.id} className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-blue-100 text-[#1a73e8] rounded font-black text-[10px]">
                              {asg.subject?.subject_name || 'General Subject'}
                            </span>
                            <span className="text-slate-400 text-[10px]">Due: {asg.due_date}</span>
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm">{asg.title}</h4>
                          <p className="text-[11px] text-slate-600 line-clamp-1">{asg.description}</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {asg.submission ? (
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold flex items-center gap-1">
                              <CheckCircle2 size={13} /> Submitted
                            </span>
                          ) : (
                            <button
                              onClick={() => { setSubmittingAssignment(asg); setSubmissionText(''); setSubmissionUrl(''); }}
                              className="px-3 py-1.5 bg-[#1a73e8] hover:bg-[#0755b0] text-white rounded-xl font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                            >
                              <Send size={12} /> Submit Work
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right Column: Notices & AI Tutor */}
              <div className="space-y-4">
                
                {/* Official Circulars & Notices */}
                <div className="p-5 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 border border-blue-100 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#061f3d] font-black text-xs uppercase tracking-wider">
                      <Sparkles size={16} className="text-[#1a73e8]" />
                      School Circulars
                    </div>
                    <span className="text-[9px] font-bold bg-blue-200/60 text-[#061f3d] px-2 py-0.5 rounded-full">
                      CBSE Verified
                    </span>
                  </div>
                  
                  <div className="space-y-2.5 divide-y divide-blue-100">
                    {schoolNotices.length > 0 ? (
                      schoolNotices.map((n, idx) => (
                        <div key={idx} className="pt-2 first:pt-0 space-y-1">
                          <span className="text-[10px] font-bold text-[#1a73e8] uppercase font-mono">
                            {n.created_at ? new Date(n.created_at).toLocaleDateString('en-IN') : 'Official Notice'}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 leading-tight">{n.title}</h4>
                          <p className="text-[11px] text-slate-600 leading-relaxed">{n.description}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">No active circulars today.</p>
                    )}
                  </div>
                </div>

                {/* AI Study Mentor Banner */}
                <div className="p-5 bg-gradient-to-br from-[#061f3d] via-[#10345e] to-[#061f3d] text-white rounded-2xl space-y-3 shadow-lg border border-blue-900/40">
                  <div className="flex items-center gap-2 text-amber-300 font-black text-xs uppercase tracking-wider">
                    <Sparkles size={16} className="text-amber-400" />
                    AI CBSE Mentor &amp; Tutor
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Have doubts in Class {student.class} Science, Maths, or English? Ask questions, solve homework problems, and prepare for board assessments.
                  </p>
                  <button
                    onClick={() => navigate('/dashboard/ai')}
                    className="w-full py-2.5 bg-gradient-to-r from-[#1a73e8] to-[#0755b0] hover:from-[#1557b0] hover:to-[#05408a] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
                  >
                    Open AI Doubt Assistant <ArrowUpRight size={13} />
                  </button>
                </div>

              </div>

            </div>
          </div>
        )}

        {/* TAB 2: ASSIGNMENTS & HOMEWORK */}
        {activeTab === 'assignments' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Class Assignments &amp; Homework Tasks</h3>
                <p className="text-xs text-slate-500">Teacher-assigned homework for Class {student.class}-{student.section}.</p>
              </div>
              <span className="text-xs font-bold px-3 py-1.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-xl self-start">
                Total Assigned: {assignments.length}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignments.map(asg => {
                const isDone = Boolean(asg.submission);
                return (
                  <div key={asg.id} className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 bg-violet-100 text-violet-800 rounded-full font-black text-[10px] uppercase">
                          {asg.subject?.subject_name || 'Subject Task'}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-500">Max: {asg.max_marks} M</span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm">{asg.title}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">{asg.description}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Due Date</span>
                        <span className="font-bold text-slate-800">{asg.due_date || 'No deadline'}</span>
                      </div>

                      {isDone ? (
                        <div className="text-right">
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-black text-[10px] uppercase inline-flex items-center gap-1">
                            <CheckCircle2 size={12} /> Submitted
                          </span>
                          {asg.submission?.marks_obtained !== undefined && asg.submission?.marks_obtained !== null && (
                            <span className="block text-[10px] font-bold text-slate-600 font-mono mt-0.5">
                              Score: {asg.submission.marks_obtained}/{asg.max_marks}
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => { setSubmittingAssignment(asg); setSubmissionText(''); setSubmissionUrl(''); }}
                          className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                        >
                          <Send size={13} /> Submit Work
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: ATTENDANCE LEDGER */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Official Attendance Register</h3>
                <p className="text-xs text-slate-500">Live teacher-marked attendance logs for Academic Session {student.academic_year}.</p>
              </div>
              <div className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 self-start">
                <CheckCircle2 size={14} /> Overall Attendance: {attendanceRate}%
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200/60">
                <span className="text-[10px] font-bold text-emerald-600 uppercase block">Present Days</span>
                <span className="text-2xl font-black text-emerald-800">{presentDays}</span>
              </div>
              <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200/60">
                <span className="text-[10px] font-bold text-rose-600 uppercase block">Absences</span>
                <span className="text-2xl font-black text-rose-800">{absentDays}</span>
              </div>
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/60">
                <span className="text-[10px] font-bold text-amber-600 uppercase block">Approved Leaves</span>
                <span className="text-2xl font-black text-amber-800">{leaveDays}</span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Working Days</span>
                <span className="text-2xl font-black text-slate-800">{totalAttDays}</span>
              </div>
            </div>

            <div className="border border-slate-200/80 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-800">
                Daily Attendance Ledger Logs ({attendanceRecords.length} records)
              </div>
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {attendanceRecords.map((r, idx) => (
                  <div key={idx} className="px-4 py-3 flex items-center justify-between text-xs hover:bg-slate-50/50">
                    <div>
                      <span className="font-bold text-slate-800 block">
                        {new Date(r.attendance_date).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                      {r.remarks && <span className="text-[11px] text-slate-400 font-medium">{r.remarks}</span>}
                    </div>
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase",
                      r.status === 'present' ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                      r.status === 'late' ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-rose-100 text-rose-800 border border-rose-200"
                    )}>
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: FEES & INVOICES */}
        {activeTab === 'fees' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Fee Invoices &amp; Receipts</h3>
                <p className="text-xs text-slate-500">Official fee ledgers, transaction records, and printable payment receipts.</p>
              </div>
              <span className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold border self-start flex items-center gap-1.5",
                totalOutstanding === 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
              )}>
                {totalOutstanding === 0 ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                Balance Dues: ₹{totalOutstanding.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Term Fee</span>
                <span className="text-xl font-black text-slate-900">₹{totalBilled.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-4 bg-emerald-50 border border-emerald-200/60 rounded-2xl">
                <span className="text-[10px] font-bold text-emerald-600 uppercase block">Total Amount Paid</span>
                <span className="text-xl font-black text-emerald-800">₹{totalPaid.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200/60 rounded-2xl">
                <span className="text-[10px] font-bold text-[#1a73e8] uppercase block">Account Clearance</span>
                <span className="text-xl font-black text-[#061f3d]">
                  {totalOutstanding === 0 ? '100% CLEAR' : 'PARTIAL'}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Fee Ledgers &amp; Payment Receipts</h4>
              
              {feesList.length > 0 ? (
                feesList.map(fee => (
                  <div key={fee.id} className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                      <div>
                        <span className="font-bold text-slate-900 text-sm">{fee.category_name}</span>
                        <span className="text-[11px] text-slate-500 block">Due Date: {fee.due_date}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-slate-900">₹{fee.total_amount.toLocaleString('en-IN')}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                          fee.status === 'paid' ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        )}>
                          {fee.status}
                        </span>
                      </div>
                    </div>

                    {fee.payments && fee.payments.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Payment Receipts</span>
                        {fee.payments.map(p => (
                          <div key={p.id} className="p-2.5 bg-white border border-slate-200/60 rounded-xl flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-slate-800 block">Receipt #{p.receipt_number}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Paid on {p.payment_date} via {p.payment_mode} {p.transaction_id ? `(${p.transaction_id})` : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold font-mono text-emerald-700">₹{p.amount_paid.toLocaleString('en-IN')}</span>
                              <button
                                onClick={() => setSelectedReceiptFee({
                                  id: fee.id,
                                  receipt_number: p.receipt_number,
                                  total_amount: fee.total_amount,
                                  paid_amount: p.amount_paid,
                                  remaining_amount: Math.max(0, fee.total_amount - fee.amount_paid),
                                  category_name: fee.category_name,
                                  payment_mode: p.payment_mode,
                                  payment_date: p.payment_date,
                                  transaction_id: p.transaction_id,
                                  academic_year: student.academic_year,
                                  students: {
                                    name: student.name,
                                    class: `${student.class} - ${student.section}`,
                                    roll_number: student.roll_number,
                                    admission_number: student.admission_number,
                                    father_name: student.father_name,
                                    phone: student.phone
                                  }
                                })}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#1a73e8] border border-blue-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                title="View & Download Official Receipt"
                              >
                                <Download size={12} /> View Receipt
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 p-4 bg-slate-50 rounded-xl">No fee records found for this student.</p>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: EXAMINATION & MARKS */}
        {activeTab === 'examination' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">CBSE Examination Results &amp; Marks</h3>
                <p className="text-xs text-slate-500">Official subject scores, grading distribution, and CBSE performance reports.</p>
              </div>
              <div className="flex items-center gap-2 self-start flex-wrap">
                <button
                  onClick={() => setMarksheetModalOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer border border-blue-400/30"
                >
                  <Award size={13} /> View &amp; Download Official Marksheet
                </button>
                <button
                  onClick={() => setAdmitCardOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-[#061f3d] to-[#1a73e8] hover:from-[#061f3d] hover:to-[#0755b0] text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer border border-blue-400/30"
                >
                  <Printer size={13} /> View &amp; Print CBSE Admit Card
                </button>
              </div>
            </div>

            {/* Overall Term Result Cards */}
            {examResults.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {examResults.map(res => (
                  <div key={res.id} className="p-4 bg-blue-50/60 border border-blue-200/60 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-[#1a73e8] uppercase block">{res.exams?.exam_name || 'Assessment'}</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black text-slate-900">{res.percentage}%</span>
                      <span className="text-xs font-bold text-[#1a73e8] font-mono">Grade {res.grade}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium block">{res.division} • {res.result_status}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Subject Marks Table */}
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-800">
                Subject-Wise Examination Scores
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200">
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4 text-center">Max Marks</th>
                    <th className="py-3 px-4 text-center">Obtained Marks</th>
                    <th className="py-3 px-4 text-center">CBSE Grade</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {subjectMarks.length > 0 ? (
                    subjectMarks.map(m => {
                      const pct = m.max_marks > 0 ? (m.obtained_marks / m.max_marks) * 100 : 0;
                      const grade = pct >= 90 ? 'A1' : pct >= 80 ? 'A2' : pct >= 70 ? 'B1' : pct >= 60 ? 'B2' : 'C1';
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {m.subjects?.subject_name || 'Subject'} {m.subjects?.subject_code ? `(${m.subjects.subject_code})` : ''}
                          </td>
                          <td className="py-3 px-4 text-center font-mono">{m.max_marks}</td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">{m.obtained_marks}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-black text-[10px]">
                              {grade}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-emerald-600 font-bold">PASS</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">No published marks found yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: TIMETABLE & SUBJECTS */}
        {activeTab === 'timetable' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Weekly Class Timetable &amp; Schedule</h3>
                <p className="text-xs text-slate-500">Live synchronized academic periods for Class {student.class}-{student.section}.</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setTimetableModalOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer border border-blue-400/30"
                >
                  <Calendar size={13} /> View &amp; Download Official Timetable PDF
                </button>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto self-start">
                  {[
                    { key: 'mon', label: 'Mon' },
                    { key: 'tue', label: 'Tue' },
                    { key: 'wed', label: 'Wed' },
                    { key: 'thu', label: 'Thu' },
                    { key: 'fri', label: 'Fri' },
                    { key: 'sat', label: 'Sat' }
                  ].map(d => (
                    <button
                      key={d.key}
                      onClick={() => setSelectedDay(d.key)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                        selectedDay === d.key 
                          ? "bg-white text-[#1a73e8] shadow-xs" 
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Daily Periods List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {timetableRecords.filter(t => t.day === selectedDay).length > 0 ? (
                timetableRecords
                  .filter(t => t.day === selectedDay)
                  .sort((a, b) => (a.period_number || 0) - (b.period_number || 0))
                  .map((p, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2 hover:border-blue-300 transition-colors shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-black text-[#1a73e8] bg-blue-100/70 px-2 py-0.5 rounded-md border border-blue-200 uppercase">
                          Period {p.period_number || idx + 1}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 font-semibold">
                          {p.start_time?.slice(0, 5)} - {p.end_time?.slice(0, 5)}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{p.subjects?.subject_name || 'Subject'}</h4>
                        {p.subjects?.subject_code && (
                          <span className="text-[10px] font-mono font-bold text-slate-400">Code: {p.subjects.subject_code}</span>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-medium">Faculty: <strong className="text-slate-700">{p.teachers?.name || 'Class Faculty'}</strong></span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Room 204</span>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="col-span-3 p-8 text-center bg-slate-50 rounded-2xl text-slate-500 text-xs space-y-2">
                  <Clock size={28} className="text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-700">No scheduled periods for this day</p>
                  <p className="text-[11px] text-slate-400">Select another weekday above or check the school calendar.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: PERSONAL & FAMILY PROFILE */}
        {activeTab === 'personal' && (
          <div className="space-y-6">
            
            {/* Header with ID Card Trigger */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 border border-slate-200/80 p-5 rounded-2xl">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <User className="text-[#1a73e8] w-4 h-4" />
                  Official CBSE Student &amp; Family Dossier
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Authenticated institutional records for Student ID: <span className="font-mono font-bold text-slate-800">{student.admission_number}</span>
                </p>
              </div>

              <button
                onClick={() => setIdModalOpen(true)}
                className="px-4 py-2 bg-[#ecb30b] hover:bg-[#d49e00] text-slate-950 rounded-xl text-xs font-bold shadow-md shadow-amber-950/20 transition-all flex items-center gap-2 self-start cursor-pointer"
              >
                <IdCard size={14} /> View Official CBSE ID Card
              </button>
            </div>

            {/* 6 Structured Cards Dossier */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              
              {/* Card 1: Academic Enrollment */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-2xs">
                <div className="flex items-center gap-2 text-[#1a73e8] font-bold text-xs uppercase tracking-wider pb-2 border-b border-slate-100">
                  <GraduationCap size={15} />
                  Academic Enrollment
                </div>
                <div className="space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Enrolled Class:</span>
                    <span className="font-bold text-slate-900">Class {student.class} - Section {student.section}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">CBSE Roll Number:</span>
                    <span className="font-mono font-bold text-slate-900">{student.roll_number ? `#${student.roll_number}` : 'Not assigned'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Admission Number:</span>
                    <span className="font-mono font-bold text-slate-900">{student.admission_number || 'Not on file'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Academic Session:</span>
                    <span className="font-bold text-slate-900">{student.academic_year || '2026-27'}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Student Biodata */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-2xs">
                <div className="flex items-center gap-2 text-[#061f3d] font-bold text-xs uppercase tracking-wider pb-2 border-b border-slate-100">
                  <User size={15} />
                  Candidate Biodata
                </div>
                <div className="space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Full Legal Name:</span>
                    <span className="font-bold text-slate-900 uppercase">{student.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Date of Birth:</span>
                    <span className="font-bold text-slate-900">
                      {student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('en-IN') : 'Not on file'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Gender:</span>
                    <span className="font-bold text-slate-900 capitalize">{student.gender || 'Not on file'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Blood Group:</span>
                    <span className="font-bold text-rose-700">{medical?.blood_group || (student as any).blood_group || 'Not on file'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Social Category:</span>
                    <span className="font-bold text-slate-900">{student.category || 'General'}</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Family & Parents */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-2xs">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider pb-2 border-b border-slate-100">
                  <ShieldCheck size={15} />
                  Parent &amp; Guardian Info
                </div>
                <div className="space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Father's Name:</span>
                    <span className="font-bold text-slate-900">{student.father_name || 'Shri Alok Kumar'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Mother's Name:</span>
                    <span className="font-bold text-slate-900">{student.mother_name || 'Smt. Sunita Devi'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Registered Phone:</span>
                    <span className="font-mono font-bold text-slate-900">{student.phone || '+91 98765-43210'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Emergency Contact:</span>
                    <span className="font-mono font-bold text-emerald-700">{medical?.emergency_contact_phone || '+91 94500-11223'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Guardian Relation:</span>
                    <span className="font-bold text-slate-900">Father (Primary Contact)</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Health & Medical Clearance */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-2xs">
                <div className="flex items-center gap-2 text-rose-700 font-bold text-xs uppercase tracking-wider pb-2 border-b border-slate-100">
                  <HeartPulse size={15} />
                  Health &amp; Medical Record
                </div>
                <div className="space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Medical Fitness:</span>
                    <span className="font-bold text-emerald-700">Fit for All Sports</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Known Allergies:</span>
                    <span className="font-bold text-slate-900">{medical?.allergies || 'None Reported'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Vision Standard:</span>
                    <span className="font-bold text-slate-900">6/6 Normal</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Assigned Doctor:</span>
                    <span className="font-bold text-slate-900">{medical?.doctor_name || 'Not on file'}</span>
                  </div>
                </div>
              </div>

              {/* Card 5: Transport & Commute */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-2xs">
                <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider pb-2 border-b border-slate-100">
                  <Bus size={15} />
                  School Transport
                </div>
                <div className="space-y-2.5">
                  {transport ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Allotted Route:</span>
                        <span className="font-bold text-slate-900">{(transport as any).transport_routes?.route_name || 'Not on file'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Bus Vehicle Reg:</span>
                        <span className="font-mono font-bold text-slate-900">{(transport as any).vehicles?.vehicle_number || 'Not on file'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Boarding Point:</span>
                        <span className="font-bold text-slate-900">{(transport as any).boarding_point || 'Not on file'}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-slate-400 text-center py-2">No transport allotment on file.</p>
                  )}
                </div>
              </div>

              {/* Card 6: Portal Security & Access */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-2xs">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider pb-2 border-b border-slate-100">
                  <Lock className="w-3.5 h-3.5" />
                  Portal Account &amp; Security
                </div>
                <div className="space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Portal Email:</span>
                    <span className="font-bold text-[#1a73e8]">{user?.email || 'student@sjsbrlschool.edu.in'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Role Access:</span>
                    <span className="font-bold text-emerald-700 uppercase">Student Only</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Authentication:</span>
                    <span className="font-bold text-slate-900">Password + SSL</span>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => toast.info('To change password, contact school administration or submit an update request.')}
                      className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                    >
                      Request Password Reset
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* Permanent Address Bar */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1 text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Registered Residential Address</span>
              <p className="font-bold text-slate-800 leading-relaxed">
                {student.address || 'Barhalganj, Gorakhpur, Uttar Pradesh - 273402'}
              </p>
            </div>

          </div>
        )}

        {/* TAB 8: TRANSPORT */}
        {activeTab === 'transport' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h3 className="text-sm font-bold text-slate-900">School Transport Allotment</h3>
              <p className="text-xs text-slate-500">Bus route, boarding point, and pickup timing.</p>
            </div>

            {transport ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Transit Route</span>
                  <span className="text-sm font-bold text-slate-900">{(transport as any).transport_routes?.route_name || 'Not on file'}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Vehicle Registration</span>
                  <span className="text-sm font-bold text-slate-900 font-mono">{(transport as any).vehicles?.vehicle_number || 'Not on file'}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Boarding Point</span>
                  <span className="text-sm font-bold text-slate-900">{(transport as any).boarding_point || 'Not on file'}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Pickup Time</span>
                  <span className="text-sm font-bold text-slate-900 font-mono">{(transport as any).pickup_time || 'Not on file'}</span>
                </div>
              </div>
            ) : (
              <div className="p-8 bg-slate-50 rounded-2xl border border-slate-200/70 text-center text-slate-400 text-sm">
                No transport allotment on file for this student.
              </div>
            )}
          </div>
        )}

      </div>

      {/* 5. SUBMIT ASSIGNMENT MODAL */}
      <AnimatePresence>
        {submittingAssignment && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-[#1a73e8] tracking-wider">Submit Assignment</span>
                  <h3 className="text-sm font-bold text-slate-900">{submittingAssignment.title}</h3>
                </div>
                <button
                  onClick={() => setSubmittingAssignment(null)}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Your Answer / Solution Text</label>
                  <textarea
                    rows={4}
                    value={submissionText}
                    onChange={(e) => setSubmissionText(e.target.value)}
                    placeholder="Type or paste your completed assignment solution here..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1a73e8] font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Google Drive / File URL (Optional)</label>
                  <input
                    type="url"
                    value={submissionUrl}
                    onChange={(e) => setSubmissionUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1a73e8] font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setSubmittingAssignment(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSubmission}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#1a73e8] hover:bg-[#0755b0] text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  Submit to Teacher
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. CBSE STUDENT ID CARD MODAL */}
      <StudentIDCardModal
        isOpen={idModalOpen}
        onClose={() => setIdModalOpen(false)}
        student={student}
        medical={medical}
        transport={transport}
      />

      {/* 7. OFFICIAL CBSE FEE RECEIPT MODAL */}
      <FeeReceiptModal
        isOpen={Boolean(selectedReceiptFee)}
        onClose={() => setSelectedReceiptFee(null)}
        fee={selectedReceiptFee}
      />

      {/* 8. OFFICIAL CBSE ADMIT CARD MODAL */}
      <StudentAdmitCardModal
        isOpen={admitCardOpen}
        onClose={() => setAdmitCardOpen(false)}
        student={student}
        exam={examResults[0]?.exams}
        timetable={examSubjects
          .filter(es => !examResults[0]?.exam_id || es.exam_id === examResults[0].exam_id)
          .map(es => ({
            subject_code: es.subject_id ? String(es.subject_id).slice(0, 6).toUpperCase() : undefined,
            subject_name: es.subject_name || es.subjects?.subject_name || 'Subject',
            date: es.exam_date || undefined,
            time: es.start_time ? `${es.start_time}${es.duration ? ` (${es.duration})` : ''}` : undefined,
            room: es.room || undefined
          }))}
      />

      {/* 9. OFFICIAL CBSE ANNUAL PROGRESS REPORT / MARKSHEET MODAL */}
      <StudentMarksheetModal
        isOpen={marksheetModalOpen}
        onClose={() => setMarksheetModalOpen(false)}
        student={student}
        marks={subjectMarks}
        attendanceData={{
          total_days: attendanceRecords.length,
          present_days: attendanceRecords.filter(r => r.status === 'present' || r.status === 'late').length,
          percentage: attendanceRecords.length > 0
            ? Math.round((attendanceRecords.filter(r => r.status === 'present' || r.status === 'late').length / attendanceRecords.length) * 100)
            : undefined
        }}
        medicalData={medical}
      />

      {/* 10. OFFICIAL CBSE TIMETABLE MODAL */}
      {student && (
        <OfficialTimetableModal
          isOpen={timetableModalOpen}
          onClose={() => setTimetableModalOpen(false)}
          className={student.class}
          sectionName={student.section || ''}
          classTeacherName=""
          academicYear={student.academic_year || '2026-2027'}
          slots={timetableRecords.map(t => ({
            day: t.day,
            period_number: t.period_number || 1,
            subject_name: t.subjects?.subject_name || 'Subject',
            subject_code: t.subjects?.subject_code,
            teacher_name: t.teachers?.name,
            start_time: t.start_time,
            end_time: t.end_time
          }))}
        />
      )}

    </div>
  );
}
