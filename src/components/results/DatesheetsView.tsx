import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  Plus, 
  Trash2, 
  Download, 
  Printer, 
  Clock, 
  X, 
  Sparkles,
  BookOpen,
  MapPin,
  CheckCircle2,
  RefreshCcw,
  Loader2,
  Pencil,
  CalendarClock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { isSameClass, formatClassDisplay } from '@/lib/cbseExamUtils';
import { useExamScope } from '@/lib/useExamScope';
import { printRegion } from '@/lib/printRegion';

// The stored duration must always be offered, or a slot saved as "1 Hour"
// silently resaves as whatever option happened to render first.
const DURATION_PRESETS = ['1 Hour', '1.5 Hours', '2 Hours', '2.5 Hours', '3 Hours'];

interface DatesheetSlot {
  id: string;
  exam_id: string;
  exam_name: string;
  class_name: string;
  class_id: string | null;
  subject_id: string;
  subject_name: string;
  exam_date: string;
  start_time: string;
  duration: string;
  room: string;
  max_marks: number;
  status: 'Published' | 'Draft';
}

/**
 * InvigilationView prints "start - end" for each session, so a slot whose
 * duration changed but whose end_time did not showed a window that contradicted
 * itself. Derives end_time from what the admin actually entered.
 */
function computeEndTime(startTime: string, duration: string): string {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(startTime.trim());
  const hours = parseFloat(duration);
  if (!m || !isFinite(hours)) return startTime;

  let h = parseInt(m[1], 10) % 12;
  const meridiem = (m[3] || '').toUpperCase();
  if (meridiem === 'PM') h += 12;
  if (!meridiem && parseInt(m[1], 10) === 12) h = 12;

  const total = (h * 60 + parseInt(m[2], 10) + Math.round(hours * 60)) % (24 * 60);
  const endH = Math.floor(total / 60);
  const endM = total % 60;
  const label = endH >= 12 ? 'PM' : 'AM';
  const display = endH % 12 === 0 ? 12 : endH % 12;
  return `${String(display).padStart(2, '0')}:${String(endM).padStart(2, '0')} ${label}`;
}

export default function DatesheetsView() {
  const [exams, setExams] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [datesheets, setDatesheets] = useState<DatesheetSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const scope = useExamScope();

  // Filters
  const [filterClass, setFilterClass] = useState('All');
  const [filterExamId, setFilterExamId] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);

  // New slot form state
  const [formData, setFormData] = useState({
    exam_id: '',
    class_name: '10',
    subject_id: '',
    exam_date: new Date().toISOString().split('T')[0],
    start_time: '09:00 AM',
    duration: '3 Hours',
    room: 'Main Examination Hall',
    max_marks: 100
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [examsRes, subjectsRes, examSubjectsRes, classesRes] = await Promise.all([
        supabase.from('exams').select('*').order('created_at', { ascending: false }),
        supabase.from('subjects').select('*').order('subject_name'),
        supabase.from('exam_subjects').select('*'),
        supabase.from('classes').select('*').order('display_order', { ascending: true })
      ]);

      const examData = examsRes.data || [];
      const subData = subjectsRes.data || [];
      const esData = examSubjectsRes.data || [];
      const classData = classesRes.data || [];

      setExams(examData);
      setSubjects(subData);
      setClasses(classData);

      if (examData.length > 0) {
        setFormData(prev => ({
          ...prev,
          exam_id: examData[0].id,
          class_name: examData[0].class || '10'
        }));
      }
      if (subData.length > 0) {
        setFormData(prev => ({ ...prev, subject_id: subData[0].id }));
      }

      // Compile active schedule slots from real exam_subjects rows only —
      // an exam with no subjects scheduled yet shows the empty state below
      // rather than a fabricated 5-subject placeholder schedule.
      const compiledSlots: DatesheetSlot[] = [];
      examData.forEach(ex => {
        const matchingSubjects = esData.filter(es => es.exam_id === ex.id);
        matchingSubjects.forEach((es) => {
          const sub = subData.find(s => s.id === es.subject_id);
          compiledSlots.push({
            id: es.id,
            exam_id: ex.id,
            exam_name: ex.exam_name,
            class_name: ex.class,
            class_id: es.class_id || ex.class_id || null,
            subject_id: es.subject_id,
            subject_name: es.subject_name || sub?.subject_name || 'Subject',
            exam_date: es.exam_date || '',
            start_time: es.start_time || '',
            duration: es.duration || '',
            room: es.room || '',
            max_marks: es.max_marks || 100,
            status: 'Published'
          });
        });
      });

      setDatesheets(compiledSlots);
    } catch (err) {
      console.error('Failed to load schedule context:', err);
      toast.error('Failed loading schedule datesheets');
    } finally {
      setIsLoading(false);
    }
  };

  // exam_subjects carries a UNIQUE (exam_id, subject_id) constraint, and every
  // subject on an exam's syllabus is already attached as a row when the exam is
  // created — with exam_date/room still empty. Scheduling is therefore almost
  // always filling in an existing row, not adding a new one; a blind INSERT
  // failed with "duplicate key value violates unique constraint uq_exam_subject"
  // for every subject the admin could realistically pick.
  const existingSlot = useMemo(
    () => datesheets.find(d => d.exam_id === formData.exam_id && d.subject_id === formData.subject_id),
    [datesheets, formData.exam_id, formData.subject_id]
  );

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.exam_id || !formData.subject_id) {
      toast.error('Please select both an exam and a subject.');
      return;
    }

    const selectedExam = exams.find(ex => ex.id === formData.exam_id);
    const selectedSub = subjects.find(s => s.id === formData.subject_id);
    const maxMarks = Number(formData.max_marks) || 100;

    // Schedule fields only. review_status, component_name and teacher_id belong
    // to the marks workflow and must survive a re-scheduling untouched.
    const schedule = {
      exam_date: formData.exam_date,
      start_time: formData.start_time,
      end_time: computeEndTime(formData.start_time, formData.duration),
      duration: formData.duration,
      room: formData.room,
      max_marks: maxMarks,
      pass_marks: Math.round(maxMarks * 0.33)
    };

    setIsSaving(true);
    try {
      let rowId = existingSlot?.id;

      if (rowId) {
        const { error } = await supabase.from('exam_subjects').update(schedule).eq('id', rowId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('exam_subjects').insert({
          exam_id: formData.exam_id,
          // Without class_id the row is invisible to every class-scoped view
          // (admit cards, seating plan, invigilation) that joins on it.
          class_id: selectedExam?.class_id || null,
          subject_id: formData.subject_id,
          subject_name: selectedSub?.subject_name || 'Subject',
          ...schedule
        }).select().single();
        if (error) throw error;
        rowId = data?.id;
      }

      const savedSlot: DatesheetSlot = {
        id: rowId || Math.random().toString(),
        exam_id: formData.exam_id,
        exam_name: selectedExam?.exam_name || 'Term Examination',
        class_name: selectedExam?.class || formData.class_name,
        class_id: existingSlot?.class_id || selectedExam?.class_id || null,
        subject_id: formData.subject_id,
        subject_name: existingSlot?.subject_name || selectedSub?.subject_name || 'Subject',
        exam_date: formData.exam_date,
        start_time: formData.start_time,
        duration: formData.duration,
        room: formData.room,
        max_marks: maxMarks,
        status: 'Published'
      };

      setDatesheets(prev =>
        prev.some(d => d.id === savedSlot.id)
          ? prev.map(d => (d.id === savedSlot.id ? savedSlot : d))
          : [savedSlot, ...prev]
      );
      setShowAddModal(false);
      toast.success(
        existingSlot
          ? `${savedSlot.subject_name} rescheduled for ${formData.exam_date}.`
          : `${savedSlot.subject_name} scheduled for ${formData.exam_date}.`
      );
    } catch (err: any) {
      console.error('Schedule slot save failed:', err);
      toast.error('Could not schedule slot: ' + (err?.message || 'Unknown error') + (err?.details ? ` (${err.details})` : ''));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSlot = async (slot: DatesheetSlot) => {
    // This drops the whole exam_subjects row, which also carries the evaluator,
    // the review status and the max/pass marks — and marks rows key on
    // (exam_id, subject_id) rather than this id, so they are orphaned, not
    // cascaded. That is a much bigger action than "remove a date".
    const confirmed = window.confirm(
      `Remove ${slot.subject_name} from ${slot.exam_name} entirely?

` +
      `This deletes the subject from the exam — not just its date — along with ` +
      `its assigned evaluator, review status and max marks. Any marks already ` +
      `entered for it will be left orphaned.

` +
      `To clear only the date, open the session and reschedule it instead.`
    );
    if (!confirmed) return;

    const slotId = slot.id;
    // Dropping the row from local state regardless of the outcome made a failed
    // delete look like a success until the next refresh brought the slot back.
    try {
      const { error } = await supabase.from('exam_subjects').delete().eq('id', slotId);
      if (error) throw error;
      setDatesheets(prev => prev.filter(d => d.id !== slotId));
      toast.success(`${slot.subject_name} removed from ${slot.exam_name}.`);
    } catch (err: any) {
      console.error('Schedule slot delete failed:', err);
      toast.error('Could not delete slot: ' + (err?.message || 'Unknown error'));
    }
  };

  // Subjects already attached to the chosen exam are what actually needs a date;
  // the rest stay available so a subject missing from the syllabus can still be added.
  const examSlots = useMemo(
    () => datesheets.filter(d => d.exam_id === formData.exam_id),
    [datesheets, formData.exam_id]
  );
  const examSubjectIds = useMemo(() => new Set(examSlots.map(d => d.subject_id)), [examSlots]);
  const otherSubjects = useMemo(
    () => subjects.filter(sub => !examSubjectIds.has(sub.id)),
    [subjects, examSubjectIds]
  );

  // Picking an exam/subject pulls whatever is already stored for that slot into
  // the form, so re-opening the modal edits the real values instead of silently
  // overwriting max marks with the 100 default.
  const applySelection = (examId: string, subjectId: string) => {
    const ex = exams.find(x => x.id === examId);
    const slot = datesheets.find(d => d.exam_id === examId && d.subject_id === subjectId);
    setFormData(prev => ({
      ...prev,
      exam_id: examId,
      subject_id: subjectId,
      class_name: ex?.class || prev.class_name,
      exam_date: slot?.exam_date || prev.exam_date,
      start_time: slot?.start_time || prev.start_time,
      duration: slot?.duration || prev.duration,
      room: slot?.room || prev.room,
      max_marks: slot?.max_marks ?? prev.max_marks
    }));
  };

  const durationOptions = useMemo(() => {
    const d = formData.duration;
    return !d || DURATION_PRESETS.includes(d) ? DURATION_PRESETS : [d, ...DURATION_PRESETS];
  }, [formData.duration]);

  // Every exam term belongs to one class, so choosing a class narrows the terms
  // on offer rather than being a separate field the admin can contradict.
  const modalExams = useMemo(
    () => exams.filter(ex => isSameClass(ex.class, formData.class_name)),
    [exams, formData.class_name]
  );

  // Point the form at a class: first term for that class, first subject on it.
  const applyClass = (className: string) => {
    const firstExam = exams.find(ex => isSameClass(ex.class, className));
    if (!firstExam) {
      setFormData(prev => ({ ...prev, class_name: className, exam_id: '', subject_id: '' }));
      return;
    }
    const firstSubject = datesheets.find(d => d.exam_id === firstExam.id)?.subject_id;
    applySelection(firstExam.id, firstSubject || subjects[0]?.id || '');
  };

  const openSlotEditor = (examId: string, subjectId: string) => {
    applySelection(examId, subjectId);
    setShowAddModal(true);
  };

  const filteredSlots = useMemo(() => {
    return datesheets.filter(d => {
      // A teacher may read every slot in the school (exam_subjects_read is
      // `true`), so the narrowing to their own classes/subjects is done here.
      if (!scope.allowsSlot(d.class_id, d.subject_id)) return false;
      const matchClass = filterClass === 'All' || isSameClass(d.class_name, filterClass);
      const matchExam = filterExamId === 'All' || d.exam_id === filterExamId;
      return matchClass && matchExam;
    });
  }, [datesheets, filterClass, filterExamId, scope]);

  return (
    <div className="space-y-5">
      {/* 0. Read-only notice — the datesheet is the exam office's to edit */}
      {scope.isScopedTeacher && (
        <div className="bg-blue-50/70 border border-blue-100 rounded-[18px] px-4 py-3 flex items-start gap-2.5">
          <BookOpen size={15} className="text-blue-600 mt-0.5 shrink-0" />
          <p className="text-[11px] font-semibold text-blue-900 leading-relaxed">
            Showing the examination sessions for the classes and subjects you teach.
            The datesheet is published by the exam office, so it is read-only here —
            raise any clash with them.
          </p>
        </div>
      )}

      {/* 1. Header Filter Controls */}
      <div className="bg-white rounded-[20px] border border-slate-200/60 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Class Filter */}
          <div className="flex flex-col min-w-[120px]">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Class Grade</span>
            <select 
              value={filterClass} 
              onChange={(e) => setFilterClass(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-700 outline-none h-[36px] cursor-pointer focus:border-violet-500 focus:bg-white"
            >
              <option value="All">All Grades</option>
              {classes.length > 0 ? (
                classes.map(c => (
                  <option key={c.id} value={c.class_name}>{formatClassDisplay(c.class_name)}</option>
                ))
              ) : (
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'LKG'].map(c => (
                  <option key={c} value={c}>{formatClassDisplay(c)}</option>
                ))
              )}
            </select>
          </div>

          {/* Exam Filter */}
          <div className="flex flex-col min-w-[170px]">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Assessment Term</span>
            <select 
              value={filterExamId} 
              onChange={(e) => setFilterExamId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-700 outline-none h-[36px] cursor-pointer focus:border-violet-500 focus:bg-white"
            >
              <option value="All">All Assessments</option>
              {exams.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.exam_name} ({ex.academic_year})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              const ok = printRegion('exam-datesheet-print', 'Examination Datesheet');
              if (!ok) toast.error('Could not open the timetable for printing.');
            }}
            className="flex items-center gap-1.5 px-4 h-[36px] border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Printer size={14} /> Print Timetable
          </button>

          {scope.canManage && (
            <button
              onClick={() => {
                if (filterClass !== 'All') {
                  applyClass(filterClass);
                } else {
                  const examId = filterExamId !== 'All' ? filterExamId : (formData.exam_id || exams[0]?.id || '');
                  const firstOnExam = datesheets.find(d => d.exam_id === examId)?.subject_id;
                  applySelection(examId, firstOnExam || formData.subject_id || subjects[0]?.id || '');
                }
                setShowAddModal(true);
              }}
              className="flex items-center gap-1.5 px-4 h-[36px] bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-violet-500/15 cursor-pointer active:scale-95"
            >
              <Plus size={14} /> Schedule Subject Slot
            </button>
          )}
        </div>
      </div>

      {/* 2. Schedule Timetable Matrix */}
      <div id="exam-datesheet-print" className="bg-white border border-slate-200/60 shadow-2xs rounded-[22px] overflow-hidden">
        {/* Paper-only letterhead — the on-screen page already has the app header */}
        <div data-print-only className="px-5 pt-5 pb-3 border-b border-slate-200">
          <h2 className="text-base font-black text-slate-900">Examination Datesheet</h2>
          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
            {filterClass === 'All' ? 'All classes' : formatClassDisplay(filterClass)}
            {' • '}
            {filterExamId === 'All'
              ? 'All assessment terms'
              : exams.find(ex => ex.id === filterExamId)?.exam_name || 'Assessment term'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[9.5px] font-black text-slate-400 uppercase tracking-widest">
                <th className="py-3.5 px-5">Exam Term</th>
                <th className="py-3.5 px-4 text-center">Class Scope</th>
                <th className="py-3.5 px-4">Subject</th>
                <th className="py-3.5 px-4 text-center">Date</th>
                <th className="py-3.5 px-4 text-center">Timings & Duration</th>
                <th className="py-3.5 px-4 text-center">Exam Venue</th>
                <th className="py-3.5 px-4 text-center">Max Marks</th>
                {scope.canManage && <th data-print-hide className="py-3.5 px-4 text-right pr-5">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/70 text-slate-700 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={scope.canManage ? 8 : 7} className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-600" />
                    Loading datesheets timetable...
                  </td>
                </tr>
              ) : filteredSlots.length === 0 ? (
                <tr>
                  <td colSpan={scope.canManage ? 8 : 7} className="py-16 text-center text-slate-400 font-bold">
                    {scope.canManage
                      ? 'No examination schedule slots found. Click "Schedule Subject Slot" to create one.'
                      : 'No examination sessions scheduled for your classes yet. The exam office publishes the datesheet.'}
                  </td>
                </tr>
              ) : (
                filteredSlots.map(slot => (
                  <tr key={slot.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-3 px-5 font-bold text-slate-900">{slot.exam_name}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-100">
                        {formatClassDisplay(slot.class_name)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{slot.subject_name}</td>
                    <td className="py-3 px-4 text-center">
                      {slot.exam_date ? (
                        <span className="font-mono font-bold text-slate-600">{slot.exam_date}</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Not scheduled
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {/* Rows carry a default 09:00 start even before they have a
                          date; printing it beside "Not scheduled" read as a real
                          session that had been booked. */}
                      {slot.exam_date && slot.start_time ? (
                        <div className="flex items-center justify-center gap-1.5 text-slate-600">
                          <Clock size={13} className="text-slate-400" />
                          <span>{slot.start_time} ({slot.duration || '—'})</span>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-indigo-700 font-semibold">
                      {slot.exam_date ? (slot.room || '—') : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">{slot.max_marks} pts</td>
                    {scope.canManage && (
                      <td data-print-hide className="py-3 px-4 text-right pr-5">
                        <div className="flex items-center justify-end gap-1">
                          {/* Without this the only route to an unscheduled row
                              was the header modal plus a hunt through the
                              subject dropdown. */}
                          <button
                            onClick={() => openSlotEditor(slot.exam_id, slot.subject_id)}
                            className={cn(
                              "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer",
                              slot.exam_date
                                ? "text-slate-500 hover:text-violet-700 hover:bg-violet-50"
                                : "text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200"
                            )}
                            title={slot.exam_date ? 'Reschedule this session' : 'Set a date for this session'}
                          >
                            {slot.exam_date ? <Pencil size={12} /> : <CalendarClock size={12} />}
                            {slot.exam_date ? 'Edit' : 'Schedule'}
                          </button>

                          <button 
                            onClick={() => handleDeleteSlot(slot)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Remove this subject from the exam"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Schedule Slot Creation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Schedule Examination Session</h3>
                {existingSlot && (
                  <p className="text-[10px] font-semibold text-violet-600 mt-0.5">
                    Updating the existing slot for {existingSlot.subject_name} on this exam.
                  </p>
                )}
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSlot} className="p-5 space-y-4 text-xs font-semibold text-slate-700">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1">Class Grade</label>
                  <select
                    value={formData.class_name}
                    onChange={(e) => applyClass(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
                    required
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.class_name}>{formatClassDisplay(c.class_name)}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1">Assessment Term</label>
                  <select 
                    value={formData.exam_id}
                    onChange={(e) => {
                      const nextExam = e.target.value;
                      const firstOnExam = datesheets.find(d => d.exam_id === nextExam)?.subject_id;
                      applySelection(nextExam, firstOnExam || formData.subject_id);
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none disabled:opacity-60"
                    disabled={modalExams.length === 0}
                    required
                  >
                    {modalExams.length === 0 ? (
                      <option value="">No terms for this class</option>
                    ) : (
                      modalExams.map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.exam_name} ({ex.academic_year})</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {modalExams.length === 0 && (
                <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  {formatClassDisplay(formData.class_name)} has no assessment term yet. Create one under
                  Exams &amp; Assessments before scheduling its sessions.
                </p>
              )}

              <div className="grid grid-cols-1 gap-3">
                <div className="flex flex-col">
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1">Subject</label>
                  <select 
                    value={formData.subject_id}
                    onChange={(e) => applySelection(formData.exam_id, e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
                    required
                  >
                    {examSlots.length > 0 && (
                      <optgroup label="On this exam">
                        {examSlots.map(slot => (
                          <option key={slot.subject_id} value={slot.subject_id}>
                            {slot.subject_name}{slot.exam_date ? ` — ${slot.exam_date}` : ' — not scheduled'}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Other subjects">
                      {otherSubjects.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.subject_name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col">
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1">Exam Date</label>
                  <input 
                    type="date"
                    value={formData.exam_date}
                    onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1">Start Time</label>
                  <input 
                    type="text"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1">Duration</label>
                  <select 
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
                  >
                    {durationOptions.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1">Exam Venue</label>
                  <input 
                    type="text"
                    value={formData.room}
                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
                    placeholder="e.g. Main Hall"
                    required
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1">Max Marks</label>
                  <input 
                    type="number"
                    value={formData.max_marks}
                    onChange={(e) => setFormData({ ...formData, max_marks: Number(e.target.value) })}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md shadow-violet-500/15 inline-flex items-center gap-1.5"
                >
                  {isSaving && <Loader2 size={13} className="animate-spin" />}
                  {isSaving ? 'Saving…' : existingSlot ? 'Confirm & Reschedule' : 'Confirm & Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
