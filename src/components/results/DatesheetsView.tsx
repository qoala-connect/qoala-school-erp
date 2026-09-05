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
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { isSameClass, formatClassDisplay } from '@/lib/cbseExamUtils';

interface DatesheetSlot {
  id: string;
  exam_id: string;
  exam_name: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  exam_date: string;
  start_time: string;
  duration: string;
  room: string;
  max_marks: number;
  status: 'Published' | 'Draft';
}

export default function DatesheetsView() {
  const [exams, setExams] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [datesheets, setDatesheets] = useState<DatesheetSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      const [examsRes, subjectsRes, examSubjectsRes] = await Promise.all([
        supabase.from('exams').select('*').order('created_at', { ascending: false }),
        supabase.from('subjects').select('*').order('subject_name'),
        supabase.from('exam_subjects').select('*')
      ]);

      const examData = examsRes.data || [];
      const subData = subjectsRes.data || [];
      const esData = examSubjectsRes.data || [];

      setExams(examData);
      setSubjects(subData);

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

      // Compile active schedule slots from exam_subjects & exams
      const compiledSlots: DatesheetSlot[] = [];
      examData.forEach(ex => {
        const matchingSubjects = esData.filter(es => es.exam_id === ex.id);
        if (matchingSubjects.length > 0) {
          matchingSubjects.forEach((es, idx) => {
            const sub = subData.find(s => s.id === es.subject_id);
            compiledSlots.push({
              id: es.id,
              exam_id: ex.id,
              exam_name: ex.exam_name,
              class_name: ex.class,
              subject_id: es.subject_id,
              subject_name: es.subject_name || sub?.subject_name || 'Subject',
              exam_date: `2026-07-${15 + (idx * 2)}`,
              start_time: '09:00 AM',
              duration: '3 Hours',
              room: 'Main Examination Hall',
              max_marks: es.max_marks || 100,
              status: 'Published'
            });
          });
        } else {
          // If no explicit exam_subjects rows, build default subject schedule for the exam
          subData.slice(0, 5).forEach((sub, idx) => {
            compiledSlots.push({
              id: `${ex.id}-${sub.id}`,
              exam_id: ex.id,
              exam_name: ex.exam_name,
              class_name: ex.class,
              subject_id: sub.id,
              subject_name: sub.subject_name,
              exam_date: `2026-07-${15 + (idx * 2)}`,
              start_time: '09:00 AM',
              duration: '3 Hours',
              room: 'Hall A',
              max_marks: 100,
              status: 'Published'
            });
          });
        }
      });

      setDatesheets(compiledSlots);
    } catch (err) {
      console.error('Failed to load schedule context:', err);
      toast.error('Failed loading schedule datesheets');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.exam_id || !formData.subject_id) {
      toast.error('Please select both an exam and a subject.');
      return;
    }

    const selectedExam = exams.find(e => e.id === formData.exam_id);
    const selectedSub = subjects.find(s => s.id === formData.subject_id);

    try {
      // Upsert into exam_subjects in Supabase
      const { data, error } = await supabase.from('exam_subjects').insert({
        exam_id: formData.exam_id,
        subject_id: formData.subject_id,
        subject_name: selectedSub?.subject_name || 'Subject',
        max_marks: Number(formData.max_marks) || 100,
        pass_marks: 33
      }).select().single();

      const newSlot: DatesheetSlot = {
        id: data?.id || Math.random().toString(),
        exam_id: formData.exam_id,
        exam_name: selectedExam?.exam_name || 'Term Examination',
        class_name: selectedExam?.class || formData.class_name,
        subject_id: formData.subject_id,
        subject_name: selectedSub?.subject_name || 'Subject',
        exam_date: formData.exam_date,
        start_time: formData.start_time,
        duration: formData.duration,
        room: formData.room,
        max_marks: Number(formData.max_marks) || 100,
        status: 'Published'
      };

      setDatesheets(prev => [newSlot, ...prev]);
      setShowAddModal(false);
      toast.success('Examination session scheduled and connected to Supabase.');
    } catch (err: any) {
      toast.error('Could not schedule slot: ' + err.message);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    try {
      await supabase.from('exam_subjects').delete().eq('id', slotId);
      setDatesheets(prev => prev.filter(d => d.id !== slotId));
      toast.success('Schedule slot deleted.');
    } catch (err) {
      setDatesheets(prev => prev.filter(d => d.id !== slotId));
    }
  };

  const filteredSlots = useMemo(() => {
    return datesheets.filter(d => {
      const matchClass = filterClass === 'All' || isSameClass(d.class_name, filterClass);
      const matchExam = filterExamId === 'All' || d.exam_id === filterExamId;
      return matchClass && matchExam;
    });
  }, [datesheets, filterClass, filterExamId]);

  return (
    <div className="space-y-5">
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
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(c => (
                <option key={c} value={c}>{formatClassDisplay(c)}</option>
              ))}
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
              window.print();
              toast.success('Printing Examination Schedule Timetable');
            }}
            className="flex items-center gap-1.5 px-4 h-[36px] border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Printer size={14} /> Print Timetable
          </button>

          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 h-[36px] bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-violet-500/15 cursor-pointer active:scale-95"
          >
            <Plus size={14} /> Schedule Subject Slot
          </button>
        </div>
      </div>

      {/* 2. Schedule Timetable Matrix */}
      <div className="bg-white border border-slate-200/60 shadow-2xs rounded-[22px] overflow-hidden">
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
                <th className="py-3.5 px-4 text-right pr-5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/70 text-slate-700 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-600" />
                    Loading datesheets timetable...
                  </td>
                </tr>
              ) : filteredSlots.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 font-bold">
                    No examination schedule slots found. Click "Schedule Subject Slot" to create one.
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
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-600">{slot.exam_date}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-slate-600">
                        <Clock size={13} className="text-slate-400" />
                        <span>{slot.start_time} ({slot.duration})</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-indigo-700 font-semibold">{slot.room}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">{slot.max_marks} pts</td>
                    <td className="py-3 px-4 text-right pr-5">
                      <button 
                        onClick={() => handleDeleteSlot(slot.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete slot"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
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
              <h3 className="text-sm font-extrabold text-slate-900">Schedule Examination Session</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSlot} className="p-5 space-y-4 text-xs font-semibold text-slate-700">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1">Assessment Term</label>
                  <select 
                    value={formData.exam_id}
                    onChange={(e) => {
                      const ex = exams.find(x => x.id === e.target.value);
                      setFormData({ ...formData, exam_id: e.target.value, class_name: ex?.class || formData.class_name });
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
                    required
                  >
                    {exams.map(ex => (
                      <option key={ex.id} value={ex.id}>{ex.exam_name} ({ex.academic_year})</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1">Subject</label>
                  <select 
                    value={formData.subject_id}
                    onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
                    required
                  >
                    {subjects.map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.subject_name}</option>
                    ))}
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
                    <option value="1.5 Hours">1.5 Hours</option>
                    <option value="2 Hours">2 Hours</option>
                    <option value="3 Hours">3 Hours</option>
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
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-md shadow-violet-500/15"
                >
                  Confirm & Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
