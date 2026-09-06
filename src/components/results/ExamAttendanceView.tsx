import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserCheck, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Save, 
  Printer, 
  RefreshCw, 
  Loader2,
  Users,
  ShieldCheck,
  Award
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { printRegion } from '@/lib/printRegion';
import { supabase } from '@/lib/supabase';
import { examinationService, ExamRecord } from '@/services/examinationService';
import { useAuth } from '@/context/AuthContext';

interface ExamAttendanceViewProps {
  exams: ExamRecord[];
  classes: any[];
  subjects: any[];
  selectedYearId: string;
}

interface StudentAttendanceRow {
  student_id: string;
  name: string;
  roll_number: string;
  admission_number: string;
  class: string;
  section: string;
  photo_url?: string;
  attendance_status: 'Present' | 'Absent' | 'Medical' | 'Exempted';
  remarks?: string;
}

export default function ExamAttendanceView({
  exams,
  classes,
  subjects,
  selectedYearId
}: ExamAttendanceViewProps) {
  const { user, can } = useAuth();

  const [selectedExamId, setSelectedExamId] = useState<string>(exams[0]?.id || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [roster, setRoster] = useState<StudentAttendanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Selected Exam Record
  const activeExam = useMemo(() => {
    return exams.find(e => e.id === selectedExamId) || null;
  }, [exams, selectedExamId]);

  // Exam Subjects for this active exam
  const examSubjectsList = useMemo(() => {
    return activeExam?.exam_subjects || [];
  }, [activeExam]);

  // Set default subject when exam changes
  useEffect(() => {
    if (examSubjectsList.length > 0) {
      if (!selectedSubjectId || !examSubjectsList.some(s => s.subject_id === selectedSubjectId)) {
        setSelectedSubjectId(examSubjectsList[0].subject_id || '');
      }
    } else {
      setSelectedSubjectId('');
    }
  }, [examSubjectsList]);

  // Load roster and attendance
  useEffect(() => {
    if (selectedExamId && selectedSubjectId) {
      loadAttendanceRoster();
    }
  }, [selectedExamId, selectedSubjectId, selectedSection]);

  const loadAttendanceRoster = async () => {
    if (!selectedExamId || !selectedSubjectId) return;
    setIsLoading(true);
    setHasUnsavedChanges(false);

    try {
      const { roster: rawRoster } = await examinationService.getStudentRosterWithMarks(
        selectedExamId,
        selectedSubjectId,
        activeExam?.class_id,
        selectedSection !== 'All' ? selectedSection : undefined
      );

      const mapped: StudentAttendanceRow[] = rawRoster.map(r => ({
        student_id: r.student_id,
        name: r.student?.name || 'Student',
        roll_number: r.student?.roll_number || '—',
        admission_number: r.student?.admission_number || '—',
        class: r.student?.class || activeExam?.class || '',
        section: r.student?.section || 'A',
        photo_url: r.student?.photo_url,
        attendance_status: (r.attendance_status as any) || 'Present',
        remarks: r.remarks || ''
      }));

      setRoster(mapped);
    } catch (err: any) {
      console.error('Failed loading exam attendance roster:', err);
      toast.error('Failed to load examination attendance');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = (studentId: string, status: 'Present' | 'Absent' | 'Medical' | 'Exempted') => {
    setRoster(prev => prev.map(r => {
      if (r.student_id === studentId) {
        return { ...r, attendance_status: status };
      }
      return r;
    }));
    setHasUnsavedChanges(true);
  };

  const handleMarkAll = (status: 'Present' | 'Absent') => {
    setRoster(prev => prev.map(r => ({ ...r, attendance_status: status })));
    setHasUnsavedChanges(true);
    toast.info(`Marked all students as ${status}. Click Save to persist.`);
  };

  const handleSaveAttendance = async () => {
    if (!selectedExamId || !selectedSubjectId) return;

    setIsSaving(true);
    try {
      const payload = roster.map(r => ({
        student_id: r.student_id,
        attendance_status: r.attendance_status,
        remarks: r.remarks
      }));

      await examinationService.saveExamAttendance(
        selectedExamId,
        selectedSubjectId,
        payload,
        user?.id
      );

      setHasUnsavedChanges(false);
      toast.success(`Exam attendance saved for ${roster.length} students.`);
    } catch (err: any) {
      console.error('Save exam attendance error:', err);
      toast.error(err.message || 'Failed to save attendance');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintAttendanceSheet = () => {
    if (!printRegion('exam-attendance-print', 'Exam Attendance Sheet')) {
      toast.error('Could not open the attendance sheet for printing.');
      return;
    }
  };

  // Filtered Roster
  const filteredRoster = useMemo(() => {
    return roster.filter(s => {
      const matchSection = selectedSection === 'All' || s.section === selectedSection;
      const matchSearch = !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.roll_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.admission_number.toLowerCase().includes(searchQuery.toLowerCase());

      return matchSection && matchSearch;
    });
  }, [roster, selectedSection, searchQuery]);

  const presentCount = roster.filter(r => r.attendance_status === 'Present').length;
  const absentCount = roster.filter(r => r.attendance_status === 'Absent').length;
  const medicalCount = roster.filter(r => r.attendance_status === 'Medical' || r.attendance_status === 'Exempted').length;

  return (
    <div id="exam-attendance-print" className="space-y-6">
      {/* Selector & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs print:hidden">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Exam Selector */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Exam Term</span>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800"
            >
              {exams.map(e => (
                <option key={e.id} value={e.id}>{e.exam_name} (Class {e.class})</option>
              ))}
            </select>
          </div>

          {/* Subject Selector */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Exam Subject</span>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800"
            >
              {examSubjectsList.map(s => (
                <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Section</span>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800"
            >
              <option value="All">All Sections</option>
              <option value="A">Section A</option>
              <option value="B">Section B</option>
              <option value="C">Section C</option>
              <option value="D">Section D</option>
            </select>
          </div>

          {/* Search */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Search Student</span>
            <div className="relative min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Name, Roll No..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Quick Actions & Save */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleMarkAll('Present')}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Mark All Present
          </button>
          <button
            onClick={handlePrintAttendanceSheet}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
          >
            <Printer size={13} /> Print Sheet
          </button>
          <button
            onClick={handleSaveAttendance}
            disabled={isSaving || !hasUnsavedChanges}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save size={14} />}
            Save Attendance
          </button>
        </div>
      </div>

      {/* Telemetry Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
        <div className="p-3.5 bg-slate-50 border border-slate-200/70 rounded-2xl">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Candidates</span>
          <span className="text-2xl font-black text-slate-900 font-mono">{roster.length}</span>
        </div>
        <div className="p-3.5 bg-emerald-50 border border-emerald-200/70 rounded-2xl">
          <span className="text-[10px] font-bold text-emerald-700 uppercase block">Present</span>
          <span className="text-2xl font-black text-emerald-900 font-mono">{presentCount}</span>
        </div>
        <div className="p-3.5 bg-rose-50 border border-rose-200/70 rounded-2xl">
          <span className="text-[10px] font-bold text-rose-700 uppercase block">Absent</span>
          <span className="text-2xl font-black text-rose-900 font-mono">{absentCount}</span>
        </div>
        <div className="p-3.5 bg-amber-50 border border-amber-200/70 rounded-2xl">
          <span className="text-[10px] font-bold text-amber-700 uppercase block">Medical / Exempted</span>
          <span className="text-2xl font-black text-amber-900 font-mono">{medicalCount}</span>
        </div>
      </div>

      {/* Attendance Sheet Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
        {/* Printable Official Header */}
        <div className="hidden print:block p-6 text-center border-b border-slate-200">
          <h2 className="text-xl font-black uppercase text-slate-900">ST. JOSEPH'S SCHOOL, BARHALGANJ</h2>
          <p className="text-xs text-slate-600">Official Examination Hall Attendance Sheet</p>
          <p className="text-[11px] text-slate-500 mt-1 font-mono">
            {activeExam?.exam_name} • Class {activeExam?.class} • Subject: {examSubjectsList.find(s => s.subject_id === selectedSubjectId)?.subject_name}
          </p>
        </div>

        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200">
              <th className="py-3 px-4 text-center">Roll No</th>
              <th className="py-3 px-4">Student Name</th>
              <th className="py-3 px-4">Admission No</th>
              <th className="py-3 px-4">Class &amp; Sec</th>
              <th className="py-3 px-4 text-center">Attendance Status</th>
              <th className="py-3 px-4 text-center hidden print:table-cell">Candidate Signature</th>
              <th className="py-3 px-4 text-right print:hidden">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                  Loading candidate attendance roster...
                </td>
              </tr>
            ) : filteredRoster.length > 0 ? (
              filteredRoster.map(s => (
                <tr key={s.student_id} className="hover:bg-slate-50/60">
                  <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                    {s.roll_number}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {s.name}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">
                    {s.admission_number}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-700">
                    {s.class}-{s.section}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl print:bg-transparent">
                      {(['Present', 'Absent', 'Medical', 'Exempted'] as const).map(status => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => handleStatusChange(s.student_id, status)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer",
                            s.attendance_status === status
                              ? status === 'Present' ? "bg-emerald-600 text-white shadow-xs" :
                                status === 'Absent' ? "bg-rose-600 text-white shadow-xs" :
                                "bg-amber-600 text-white shadow-xs"
                              : "text-slate-500 hover:text-slate-800"
                          )}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center hidden print:table-cell border-b border-slate-200">
                    <div className="h-6 w-32 border-b border-dashed border-slate-400 mx-auto" />
                  </td>
                  <td className="py-3 px-4 text-right print:hidden">
                    <input
                      type="text"
                      placeholder="Remarks..."
                      value={s.remarks || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRoster(prev => prev.map(r => r.student_id === s.student_id ? { ...r, remarks: val } : r));
                        setHasUnsavedChanges(true);
                      }}
                      className="text-[11px] px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none w-32 text-right"
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <UserCheck size={28} className="mx-auto text-slate-300 mb-1.5" />
                  <p className="font-bold text-slate-600 text-xs">No Candidates Enrolled</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Select a valid exam term and subject to load the attendance register.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Printable Invigilator Signature Footer */}
        <div className="hidden print:flex items-center justify-between p-8 mt-12 border-t border-slate-300 text-xs font-bold text-slate-700">
          <div>
            <div className="h-10 border-b border-dashed border-slate-400 w-48 mb-1" />
            <span>Invigilator Signature</span>
          </div>
          <div>
            <div className="h-10 border-b border-dashed border-slate-400 w-48 mb-1" />
            <span>Exam Controller / Principal</span>
          </div>
        </div>
      </div>
    </div>
  );
}
