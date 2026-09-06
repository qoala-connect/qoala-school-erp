import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  UserCheck, 
  Trash2, 
  Save, 
  X, 
  Printer, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2,
  Edit2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { printRegion } from '@/lib/printRegion';
import { supabase } from '@/lib/supabase';
import { examinationService, ExamRecord } from '@/services/examinationService';
import { useAuth } from '@/context/AuthContext';
import { useExamScope } from '@/lib/useExamScope';
import { SchoolCrest } from '@/components/SchoolLogo';

interface InvigilationViewProps {
  exams: ExamRecord[];
  teachers: any[];
  selectedYearId: string;
}

export default function InvigilationView({ exams, teachers, selectedYearId }: InvigilationViewProps) {
  const { user, can } = useAuth();
  const scope = useExamScope();

  const [assignments, setAssignments] = useState<any[]>([]);
  const [examSubjects, setExamSubjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedExamId, setSelectedExamId] = useState('all');
  const [selectedTeacherId, setSelectedTeacherId] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [showDutyModal, setShowDutyModal] = useState(false);
  const [editingDutyId, setEditingDutyId] = useState<string | null>(null);
  const [dutyExamId, setDutyExamId] = useState('');
  const [dutySubjectId, setDutySubjectId] = useState('');
  const [dutyTeacherId, setDutyTeacherId] = useState('');
  const [dutyRoom, setDutyRoom] = useState('');
  const [dutyDate, setDutyDate] = useState('');
  const [dutyStartTime, setDutyStartTime] = useState('09:00 AM');
  const [dutyEndTime, setDutyEndTime] = useState('12:00 PM');
  const [dutyType, setDutyType] = useState('Chief Invigilator');
  const [dutyNotes, setDutyNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  useEffect(() => {
    fetchDutyAssignments();
  }, [selectedYearId]);

  const fetchDutyAssignments = async () => {
    setIsLoading(true);
    try {
      // Pull all exam subjects that have invigilation or schedule info
      const { data: esData, error: esErr } = await supabase
        .from('exam_subjects')
        .select(`
          id, exam_id, subject_id, subject_name, exam_date, start_time, end_time, duration, room, invigilator_id, instructions,
          exams:exam_id(id, exam_name, short_name, class, academic_year_id),
          teachers:invigilator_id(id, name, employee_id, email)
        `)
        .order('exam_date', { ascending: true });

      if (esErr) throw esErr;

      const filtered = (esData || []).filter(es => {
        if (!selectedYearId || selectedYearId === 'all') return true;
        return (es.exams as any)?.academic_year_id === selectedYearId;
      });

      setExamSubjects(filtered);
    } catch (err: any) {
      console.error('Failed to load invigilation duties:', err);
      toast.error('Failed to load invigilator records');
    } finally {
      setIsLoading(false);
    }
  };

  // Conflict detection when assigning
  useEffect(() => {
    if (dutyTeacherId && dutyDate && dutyStartTime) {
      const clash = examSubjects.find(es => 
        es.invigilator_id === dutyTeacherId &&
        es.exam_date === dutyDate &&
        es.start_time?.trim().toLowerCase() === dutyStartTime.trim().toLowerCase() &&
        (!editingDutyId || es.id !== editingDutyId)
      );

      if (clash) {
        const tName = teachers.find(t => t.id === dutyTeacherId)?.name || 'Teacher';
        setConflictWarning(`⚠️ Conflict: ${tName} is already assigned to ${clash.exams?.exam_name || 'Exam'} (${clash.subject_name}) in ${clash.room || 'another room'} at ${clash.start_time}`);
      } else {
        setConflictWarning(null);
      }
    } else {
      setConflictWarning(null);
    }
  }, [dutyTeacherId, dutyDate, dutyStartTime, examSubjects, editingDutyId, teachers]);

  const handleOpenAssignModal = (prefill?: any) => {
    setEditingDutyId(prefill?.id || null);
    setDutyExamId(prefill?.exam_id || (exams[0]?.id || ''));
    setDutySubjectId(prefill?.subject_id || '');
    setDutyTeacherId(prefill?.invigilator_id || '');
    setDutyRoom(prefill?.room || 'Room 101');
    setDutyDate(prefill?.exam_date || '');
    setDutyStartTime(prefill?.start_time || '09:00 AM');
    setDutyEndTime(prefill?.end_time || '12:00 PM');
    setDutyNotes(prefill?.instructions || '');
    setConflictWarning(null);
    setShowDutyModal(true);
  };

  const handleSaveDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dutyExamId || !dutyTeacherId) {
      toast.error('Please select both exam and faculty member.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingDutyId) {
        const { error } = await supabase
          .from('exam_subjects')
          .update({
            invigilator_id: dutyTeacherId,
            room: dutyRoom || null,
            exam_date: dutyDate || null,
            start_time: dutyStartTime || null,
            end_time: dutyEndTime || null,
            instructions: dutyNotes || null
          })
          .eq('id', editingDutyId);

        if (error) throw error;
        toast.success('Invigilation assignment updated.');
      } else if (dutySubjectId) {
        const { error } = await supabase
          .from('exam_subjects')
          .update({
            invigilator_id: dutyTeacherId,
            room: dutyRoom || null,
            exam_date: dutyDate || null,
            start_time: dutyStartTime || null,
            end_time: dutyEndTime || null,
            instructions: dutyNotes || null
          })
          .eq('exam_id', dutyExamId)
          .eq('subject_id', dutySubjectId);

        if (error) throw error;
        toast.success('Faculty member assigned as invigilator.');
      } else {
        toast.error('Please select an exam subject slot.');
        setIsSubmitting(false);
        return;
      }

      await examinationService.logAudit('INVIGILATOR_ASSIGNED', 'exam_subjects', editingDutyId || dutyExamId, null, {
        teacher_id: dutyTeacherId,
        room: dutyRoom,
        date: dutyDate
      });

      setShowDutyModal(false);
      fetchDutyAssignments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save invigilation duty');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveDuty = async (subjectRecordId: string) => {
    if (!window.confirm('Unassign this invigilator from the examination duty?')) return;
    try {
      const { error } = await supabase
        .from('exam_subjects')
        .update({ invigilator_id: null })
        .eq('id', subjectRecordId);

      if (error) throw error;
      toast.success('Invigilator unassigned.');
      fetchDutyAssignments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove duty');
    }
  };

  const handlePrintRoster = () => {
    if (!printRegion('invigilation-roster-print', 'Invigilation Roster')) {
      toast.error('Could not open the roster for printing.');
      return;
    }
  };

  // Filtered Roster
  const filteredDuties = useMemo(() => {
    return examSubjects.filter(es => {
      // A teacher's roster is their own duties plus the sessions for classes and
      // subjects they teach — not the whole school's invigilation plan.
      if (scope.isScopedTeacher &&
          es.invigilator_id !== scope.teacherId &&
          !scope.allowsSlot(es.class_id, es.subject_id)) {
        return false;
      }
      const matchExam = selectedExamId === 'all' || es.exam_id === selectedExamId;
      const matchTeacher = selectedTeacherId === 'all' || es.invigilator_id === selectedTeacherId;
      const matchDate = !dateFilter || es.exam_date === dateFilter;
      const matchSearch = !searchQuery ||
        es.subject_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        es.teachers?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        es.room?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchExam && matchTeacher && matchDate && matchSearch;
    });
  }, [examSubjects, selectedExamId, selectedTeacherId, dateFilter, searchQuery, scope]);

  const assignedCount = filteredDuties.filter(d => d.invigilator_id).length;
  const unassignedCount = filteredDuties.filter(d => !d.invigilator_id).length;

  return (
    <div id="invigilation-roster-print" className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs print:hidden">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search faculty, room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Exam Filter */}
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-700"
          >
            <option value="all">All Exam Terms</option>
            {exams.map(e => (
              <option key={e.id} value={e.id}>{e.exam_name} (Class {e.class})</option>
            ))}
          </select>

          {/* Faculty Filter */}
          <select
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-700"
          >
            <option value="all">All Faculty Staff</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {/* Date */}
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-700"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintRoster}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Printer size={14} /> Print Duty Roster
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden">
        <div className="p-4 bg-blue-50 border border-blue-200/70 rounded-2xl">
          <span className="text-[10px] font-bold text-blue-700 uppercase block">Total Examination Slots</span>
          <span className="text-xl font-black text-blue-900">{filteredDuties.length}</span>
        </div>
        <div className="p-4 bg-emerald-50 border border-emerald-200/70 rounded-2xl">
          <span className="text-[10px] font-bold text-emerald-700 uppercase block">Faculty Assigned</span>
          <span className="text-xl font-black text-emerald-900">{assignedCount}</span>
        </div>
        <div className="p-4 bg-amber-50 border border-amber-200/70 rounded-2xl">
          <span className="text-[10px] font-bold text-amber-700 uppercase block">Unassigned Slots</span>
          <span className="text-xl font-black text-amber-900">{unassignedCount}</span>
        </div>
      </div>

      {/* Official Duty Roster Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
        {/* Printable Header */}
        <div className="hidden print:block p-6 text-center border-b border-slate-200">
          <h2 className="text-xl font-black uppercase text-slate-900">ST. JOSEPH'S SCHOOL, BARHALGANJ</h2>
          <p className="text-xs text-slate-600">Official Faculty Examination Invigilation Roster</p>
          <p className="text-[11px] text-slate-500 mt-1 font-mono">Academic Session 2026-27</p>
        </div>

        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200">
              <th className="py-3 px-4">Date &amp; Time</th>
              <th className="py-3 px-4">Examination</th>
              <th className="py-3 px-4">Subject</th>
              <th className="py-3 px-4">Class</th>
              <th className="py-3 px-4">Room / Hall</th>
              <th className="py-3 px-4">Assigned Invigilator</th>
              <th className="py-3 px-4 text-center">Duty Status</th>
              <th className="py-3 px-4 text-right print:hidden">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                  Loading invigilation schedule...
                </td>
              </tr>
            ) : filteredDuties.length > 0 ? (
              filteredDuties.map(d => (
                <tr key={d.id} className="hover:bg-slate-50/60">
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {d.exam_date || 'Date TBD'}
                    <span className="text-[11px] font-mono text-slate-500 block font-normal">
                      {d.start_time || '09:00 AM'} - {d.end_time || '12:00 PM'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-800">
                    {d.exams?.exam_name || 'Assessment'}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-blue-700">
                    {d.subject_name}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-700">
                    Class {d.exams?.class}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-md font-bold font-mono text-[11px]">
                      {d.room || 'Unallocated'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {d.teachers ? (
                      <div>
                        <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                          <UserCheck size={13} className="text-emerald-600" />
                          {d.teachers.name}
                        </span>
                        {d.teachers.employee_id && (
                          <span className="text-[10px] text-slate-400 font-mono">{d.teachers.employee_id}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                        <AlertTriangle size={12} /> Unassigned
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase",
                      d.invigilator_id ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    )}>
                      {d.invigilator_id ? 'Assigned' : 'Pending'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right print:hidden">
                    {/* Assigning a duty writes exam_subjects, which RLS reserves
                        for is_admin() OR results.publish — so a teacher gets the
                        roster to read, not buttons the database would refuse. */}
                    {scope.canManage ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenAssignModal(d)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          {d.invigilator_id ? 'Reassign' : 'Assign'}
                        </button>
                        {d.invigilator_id && (
                          <button
                            onClick={() => handleRemoveDuty(d.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100"
                            title="Unassign"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        {d.invigilator_id === scope.teacherId ? 'Your duty' : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <ShieldCheck size={28} className="mx-auto text-slate-300 mb-1.5" />
                  <p className="font-bold text-slate-600 text-xs">No Scheduled Examination Slots Found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Configure exam schedule dates first to assign invigilators.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ASSIGN INVIGILATOR MODAL */}
      {showDutyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingDutyId ? 'Assign Invigilator to Duty' : 'New Invigilation Duty'}
                </h3>
                <p className="text-xs text-slate-500">Allocate faculty staff to exam halls and time periods.</p>
              </div>
              <button
                onClick={() => setShowDutyModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {conflictWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800 flex items-start gap-2">
                <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <span>{conflictWarning}</span>
              </div>
            )}

            <form onSubmit={handleSaveDuty} className="space-y-4">
              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Invigilating Faculty Member *</label>
                  <select
                    required
                    value={dutyTeacherId}
                    onChange={(e) => setDutyTeacherId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Select Faculty Teacher</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.employee_id || 'Staff'}) - {t.designation || 'Teacher'}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Exam Room / Hall *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Room 101, Hall A"
                      value={dutyRoom}
                      onChange={(e) => setDutyRoom(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Duty Date *</label>
                    <input
                      type="date"
                      required
                      value={dutyDate}
                      onChange={(e) => setDutyDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Start Time</label>
                    <input
                      type="text"
                      placeholder="09:00 AM"
                      value={dutyStartTime}
                      onChange={(e) => setDutyStartTime(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">End Time</label>
                    <input
                      type="text"
                      placeholder="12:00 PM"
                      value={dutyEndTime}
                      onChange={(e) => setDutyEndTime(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Instructions / Reporting Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Report 15 mins before exam commencement..."
                    value={dutyNotes}
                    onChange={(e) => setDutyNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDutyModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save size={14} />}
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
