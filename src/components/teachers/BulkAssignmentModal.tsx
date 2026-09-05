import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  X, Layers, CheckSquare, Square, AlertTriangle, CheckCircle2, 
  Loader2, Save, Sparkles, Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Teacher, bulkAssignTeacher } from '@/services/teacherService';
import { supabase } from '@/lib/supabase';

interface BulkAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers: Teacher[];
  onAssigned: () => void;
}

export default function BulkAssignmentModal({
  isOpen,
  onClose,
  teachers,
  onAssigned
}: BulkAssignmentModalProps) {
  const [teacherId, setTeacherId] = useState<string>('');
  const [academicYearId, setAcademicYearId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  
  const [academicYears, setAcademicYears] = useState<Array<{ id: string; name: string; is_current: boolean }>>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; subject_name: string }>>([]);
  const [classSections, setClassSections] = useState<Array<{
    class_id: string;
    class_name: string;
    section_id: string;
    section_name: string;
    selected: boolean;
    is_class_teacher: boolean;
  }>>([]);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (teachers.length > 0) setTeacherId(teachers[0].id);

    async function loadData() {
      const [yrs, subs, cls, secs] = await Promise.all([
        supabase.from('academic_years').select('id, name, is_current').order('start_date', { ascending: false }),
        supabase.from('subjects').select('id, subject_name').order('subject_name'),
        supabase.from('classes').select('id, class_name').order('class_name'),
        supabase.from('sections').select('id, section_name').order('section_name')
      ]);

      if (yrs.data && yrs.data.length > 0) {
        setAcademicYears(yrs.data);
        const current = yrs.data.find(y => y.is_current) || yrs.data[0];
        setAcademicYearId(current.id);
      }

      if (subs.data && subs.data.length > 0) {
        setSubjects(subs.data);
        setSubjectId(subs.data[0].id);
      }

      // Build grid of class + sections
      const list: any[] = [];
      (cls.data || []).forEach(c => {
        (secs.data || []).forEach(s => {
          list.push({
            class_id: c.id,
            class_name: c.class_name,
            section_id: s.id,
            section_name: s.section_name,
            selected: false,
            is_class_teacher: false
          });
        });
      });

      list.sort((a, b) => {
        const ca = parseInt(a.class_name.replace(/\D/g, '')) || 0;
        const cb = parseInt(b.class_name.replace(/\D/g, '')) || 0;
        if (ca !== cb) return ca - cb;
        return a.section_name.localeCompare(b.section_name);
      });

      setClassSections(list);
    }

    loadData();
  }, [isOpen, teachers]);

  const toggleSelectAll = (select: boolean) => {
    setClassSections(prev => prev.map(cs => ({ ...cs, selected: select })));
  };

  const toggleSection = (classId: string, sectionId: string) => {
    setClassSections(prev => prev.map(cs => {
      if (cs.class_id === classId && cs.section_id === sectionId) {
        return { ...cs, selected: !cs.selected };
      }
      return cs;
    }));
  };

  const toggleClassTeacher = (classId: string, sectionId: string) => {
    setClassSections(prev => prev.map(cs => {
      if (cs.class_id === classId && cs.section_id === sectionId) {
        return { ...cs, is_class_teacher: !cs.is_class_teacher, selected: true };
      }
      return cs;
    }));
  };

  const selectedCount = classSections.filter(cs => cs.selected).length;

  const handleBulkSubmit = async () => {
    if (!teacherId || !academicYearId || !subjectId) {
      toast.error('Please select teacher, academic year, and subject.');
      return;
    }

    const allocations = classSections.filter(cs => cs.selected).map(cs => ({
      class_id: cs.class_id,
      section_id: cs.section_id,
      is_class_teacher: cs.is_class_teacher
    }));

    if (allocations.length === 0) {
      toast.error('Please select at least one class section to assign.');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading(`Assigning ${allocations.length} class sections in bulk...`);

    try {
      const { successCount, errors } = await bulkAssignTeacher({
        teacher_id: teacherId,
        academic_year_id: academicYearId,
        subject_id: subjectId,
        allocations
      });

      if (successCount > 0) {
        toast.success(`Successfully committed ${successCount} allocations!`, { id: toastId });
        if (errors.length > 0) {
          toast.warning(`Note: ${errors.length} allocations had conflicts and were skipped.`);
        }
        onAssigned();
        onClose();
      } else {
        toast.error(`Allocations failed: ${errors[0] || 'Unknown error'}`, { id: toastId });
      }
    } catch (err: any) {
      toast.error('Bulk assignment failed: ' + err.message, { id: toastId });
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
        className="bg-white border border-slate-200 shadow-2xl rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600/30 border border-indigo-500/30 rounded-xl text-indigo-300">
              <Layers size={18} />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-sm tracking-tight text-white">
                Bulk Subject Allocation Matrix
              </h3>
              <p className="text-[11px] text-slate-400">
                Allocate a teacher to multiple class sections simultaneously with safety checks
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
          {/* Form Header Context */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                Faculty Member
              </label>
              <select 
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 outline-none focus:border-violet-500"
              >
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.employee_id})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                Curriculum Subject
              </label>
              <select 
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 outline-none focus:border-violet-500"
              >
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.subject_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                Academic Session
              </label>
              <select 
                value={academicYearId}
                onChange={(e) => setAcademicYearId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-800 outline-none focus:border-violet-500"
              >
                {academicYears.map(y => (
                  <option key={y.id} value={y.id}>Session {y.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Selection Controls */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-xs font-black uppercase text-slate-700 tracking-wider">
              Select Classes & Sections ({selectedCount} chosen)
            </span>
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => toggleSelectAll(true)}
                className="text-xs font-bold text-violet-700 hover:text-violet-800 cursor-pointer"
              >
                Select All
              </button>
              <span className="text-slate-300">•</span>
              <button 
                type="button"
                onClick={() => toggleSelectAll(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Deselect All
              </button>
            </div>
          </div>

          {/* Grid of Class Sections */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
            {classSections.map(cs => (
              <div 
                key={`${cs.class_id}-${cs.section_id}`}
                className={cn(
                  "p-3 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer",
                  cs.selected 
                    ? "bg-violet-50/60 border-violet-300 shadow-2xs" 
                    : "bg-white border-slate-200/80 hover:bg-slate-50"
                )}
                onClick={() => toggleSection(cs.class_id, cs.section_id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {cs.selected ? (
                      <CheckSquare size={16} className="text-violet-600" />
                    ) : (
                      <Square size={16} className="text-slate-400" />
                    )}
                    <span className="text-xs font-extrabold text-slate-900">
                      Class {cs.class_name}-{cs.section_name}
                    </span>
                  </div>
                </div>

                <div 
                  className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[10px] text-slate-500 font-medium">Class Teacher?</span>
                  <input 
                    type="checkbox"
                    checked={cs.is_class_teacher}
                    onChange={() => toggleClassTeacher(cs.class_id, cs.section_id)}
                    className="w-4 h-4 accent-violet-600 rounded cursor-pointer"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            {selectedCount} class sections ready for allocation
          </span>

          <div className="flex items-center gap-2.5">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 bg-transparent text-slate-500 hover:text-slate-800 text-xs font-semibold rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleBulkSubmit}
              disabled={isSaving || selectedCount === 0}
              className="px-6 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-violet-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>Execute Bulk Assignment</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
