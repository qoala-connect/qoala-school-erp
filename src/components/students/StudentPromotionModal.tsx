import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, CheckCircle2, ShieldCheck, Loader2, ArrowRight } from 'lucide-react';
import { Student } from '@/types/student';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface StudentPromotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  onSuccess: () => void;
}

export default function StudentPromotionModal({
  isOpen,
  onClose,
  student,
  onSuccess
}: StudentPromotionModalProps) {
  if (!isOpen || !student) return null;

  const [classes, setClasses] = useState<{ id: string; class_name: string }[]>([]);
  const [sections, setSections] = useState<{ id: string; section_name: string }[]>([]);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);

  const [targetClassId, setTargetClassId] = useState('');
  const [targetSectionId, setTargetSectionId] = useState('');
  const [targetYearId, setTargetYearId] = useState('');
  const [targetRollNo, setTargetRollNo] = useState(student.roll_number || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const [c, s, y] = await Promise.all([
          supabase.from('classes').select('id, class_name').order('class_name'),
          supabase.from('sections').select('id, section_name').order('section_name'),
          supabase.from('academic_years').select('id, name, is_current').order('start_date', { ascending: false }),
        ]);

        const sortedClasses = (c.data || []).sort(
          (a, b) => (parseInt(a.class_name.replace(/\D/g, ''), 10) || 0) - (parseInt(b.class_name.replace(/\D/g, ''), 10) || 0)
        );
        setClasses(sortedClasses);
        setSections(s.data || []);
        setAcademicYears(y.data || []);

        // Default next class if available
        const currentIdx = sortedClasses.findIndex(cls => cls.class_name === student.class || cls.id === student.class_id);
        if (currentIdx !== -1 && currentIdx + 1 < sortedClasses.length) {
          setTargetClassId(sortedClasses[currentIdx + 1].id);
        } else if (sortedClasses.length > 0) {
          setTargetClassId(sortedClasses[0].id);
        }

        const secMatch = (s.data || []).find(sec => sec.section_name === student.section || sec.id === student.section_id);
        setTargetSectionId(secMatch ? secMatch.id : (s.data?.[0]?.id || ''));

        const currentYear = (y.data || []).find(yr => yr.name === student.academic_year || yr.id === student.academic_year_id);
        setTargetYearId(currentYear ? currentYear.id : (y.data?.[0]?.id || ''));
      } catch (err) {
        console.error('Error loading promotion references:', err);
      }
    })();
  }, [isOpen, student]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetClassId || !targetSectionId || !targetYearId) {
      toast.error('Please choose target class, section, and academic year.');
      return;
    }

    const selectedClass = classes.find(c => c.id === targetClassId);
    const selectedSection = sections.find(s => s.id === targetSectionId);
    const selectedYear = academicYears.find(y => y.id === targetYearId);

    if (!selectedClass || !selectedSection || !selectedYear) {
      toast.error('Invalid selection.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Record in student_promotions
      await supabase.from('student_promotions').insert([
        {
          student_id: student.id,
          from_class: student.class,
          to_class: selectedClass.class_name,
          from_section: student.section,
          to_section: selectedSection.section_name,
          from_academic_year: student.academic_year,
          to_academic_year: selectedYear.name,
          status: 'Promoted',
          promoted_at: new Date().toISOString()
        }
      ]);

      // 2. Record past class in student_class_history
      await supabase.from('student_class_history').insert([
        {
          student_id: student.id,
          class: student.class,
          section: student.section,
          academic_year: student.academic_year,
          roll_number: student.roll_number,
          created_at: new Date().toISOString()
        }
      ]);

      // 3. Update student current enrollment
      const { error: stuError } = await supabase
        .from('students')
        .update({
          class_id: targetClassId,
          section_id: targetSectionId,
          academic_year_id: targetYearId,
          class: selectedClass.class_name,
          section: selectedSection.section_name,
          academic_year: selectedYear.name,
          roll_number: targetRollNo.trim() || student.roll_number,
          updated_at: new Date().toISOString()
        })
        .eq('id', student.id);

      if (stuError) throw stuError;

      // 4. Log activity
      await supabase.from('student_activity').insert([
        {
          student_id: student.id,
          activity_type: 'PROMOTION',
          description: `Promoted from Class ${student.class} (${student.section}) to Class ${selectedClass.class_name} (${selectedSection.section_name}) for Session ${selectedYear.name}.`,
          created_at: new Date().toISOString()
        }
      ]);

      toast.success(`${student.name} successfully promoted to Class ${selectedClass.class_name} - ${selectedSection.section_name}!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[StudentPromotionModal] Promotion error:', err);
      toast.error(err.message || 'Promotion failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold">
                <TrendingUp size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Class Promotion & Section Shift</h3>
                <p className="text-[11px] text-slate-500">{student.name} ({student.admission_number})</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Current vs Target Comparison Card */}
            <div className="p-3.5 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 rounded-2xl flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Current Placement</span>
                <span className="font-bold text-slate-800">Class {student.class} - {student.section}</span>
                <div className="text-[10px] text-slate-500 mt-0.5">{student.academic_year}</div>
              </div>

              <div className="p-2 rounded-full bg-white text-violet-600 shadow-xs">
                <ArrowRight size={14} />
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold text-violet-600 uppercase block">New Placement</span>
                <span className="font-bold text-violet-900">
                  {classes.find(c => c.id === targetClassId)?.class_name ? `Class ${classes.find(c => c.id === targetClassId)?.class_name}` : 'Select Grade'}
                </span>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Sec {sections.find(s => s.id === targetSectionId)?.section_name || 'A'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Promote To Class *
                </label>
                <select
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/20"
                >
                  <option value="">Select Class</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>Class {c.class_name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Assign Section *
                </label>
                <select
                  value={targetSectionId}
                  onChange={(e) => setTargetSectionId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/20"
                >
                  <option value="">Select Section</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>Section {s.section_name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Target Academic Session *
                </label>
                <select
                  value={targetYearId}
                  onChange={(e) => setTargetYearId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/20"
                >
                  <option value="">Select Academic Year</option>
                  {academicYears.map(y => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                  New Roll Number
                </label>
                <input
                  type="text"
                  value={targetRollNo}
                  onChange={(e) => setTargetRollNo(e.target.value)}
                  placeholder="Optional Roll No"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500">
              💡 Historical class performance and attendance for previous sessions will remain archived and accessible on this student's profile.
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 size={14} />}
                <span>Execute Promotion</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
