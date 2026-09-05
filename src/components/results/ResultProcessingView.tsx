import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, 
  RotateCw, 
  ShieldAlert, 
  CheckCircle2, 
  Sparkles, 
  Download, 
  Printer, 
  Eye, 
  Search, 
  Lock, 
  Unlock, 
  Award,
  BookOpen,
  Filter,
  Save,
  Check,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { 
  calculateCBSEGrade, 
  calculateCBSEDivision, 
  isSameClass, 
  formatClassDisplay, 
  normalizeClassName 
} from '@/lib/cbseExamUtils';

interface StudentResult {
  id: string; // student_id
  result_id?: string;
  name: string;
  roll: string;
  admission_number: string;
  className: string;
  section: string;
  subjectScores: Record<string, { marks: number; max: number; isAbsent: boolean; subject_name: string }>;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  grade: string;
  division: string;
  rank: number;
  status: 'Pass' | 'Fail' | 'Needs Grace';
  originalStatus?: string;
  graceApplied?: number;
  published: boolean;
}

export default function ResultProcessingView() {
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('All');
  const [processingState, setProcessingState] = useState<'idle' | 'processing' | 'done'>('idle');
  const [publicationStatus, setPublicationStatus] = useState<'Draft' | 'Verified' | 'Published' | 'Locked'>('Draft');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Loaded database entities
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [rawMarks, setRawMarks] = useState<any[]>([]);
  const [existingResults, setExistingResults] = useState<any[]>([]);
  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Grace marks config
  const [graceMaxMarks, setGraceMaxMarks] = useState(5);
  const [passThreshold, setPassThreshold] = useState(33);

  // Initial load
  useEffect(() => {
    fetchInitialContext();
  }, []);

  const fetchInitialContext = async () => {
    setIsLoading(true);
    try {
      const [examsRes, subjectsRes, studentsRes] = await Promise.all([
        supabase.from('exams').select('*').order('created_at', { ascending: false }),
        supabase.from('subjects').select('*').order('subject_name'),
        supabase.from('students').select('*').eq('status', 'active').order('name')
      ]);

      const examData = examsRes.data || [];
      setExams(examData);
      setSubjects(subjectsRes.data || []);
      setStudents(studentsRes.data || []);

      if (examData.length > 0 && !selectedExamId) {
        setSelectedExamId(examData[0].id);
      }
    } catch (err) {
      console.error('Failed to load results processing context:', err);
      toast.error('Failed loading examinations records');
    } finally {
      setIsLoading(false);
    }
  };

  // When selected exam changes, load marks and existing results for this exam
  useEffect(() => {
    if (!selectedExamId) return;
    loadExamData(selectedExamId);
  }, [selectedExamId]);

  const loadExamData = async (examId: string) => {
    setIsLoading(true);
    try {
      const [marksRes, resultsRes] = await Promise.all([
        supabase.from('marks').select('*').eq('exam_id', examId),
        supabase.from('exam_results').select('*').eq('exam_id', examId)
      ]);

      const marksList = marksRes.data || [];
      const resList = resultsRes.data || [];
      setRawMarks(marksList);
      setExistingResults(resList);

      // Determine initial publication status
      const currentExam = exams.find(e => e.id === examId);
      if (resList.length > 0 && resList.every(r => r.published)) {
        setPublicationStatus(currentExam?.locked ? 'Locked' : 'Published');
      } else if (resList.length > 0) {
        setPublicationStatus('Verified');
      } else {
        setPublicationStatus('Draft');
      }

      // Compile current student results from database
      compileResultsFromDB(marksList, resList);
    } catch (err) {
      console.error('Error loading exam marks/results:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const compileResultsFromDB = (marksList: any[], resList: any[]) => {
    if (students.length === 0) return;

    const currentExam = exams.find(e => e.id === selectedExamId);
    const targetClass = currentExam?.class;

    // Build map of marks per student
    const studentMarksMap: Record<string, Record<string, any>> = {};
    marksList.forEach(m => {
      if (!studentMarksMap[m.student_id]) studentMarksMap[m.student_id] = {};
      studentMarksMap[m.student_id][m.subject_id] = m;
    });

    const compiled: StudentResult[] = students
      .filter(s => !targetClass || isSameClass(s.class, targetClass) || selectedClass === 'All' || isSameClass(s.class, selectedClass))
      .map(s => {
        const sMarks = studentMarksMap[s.id] || {};
        const existing = resList.find(r => r.student_id === s.id);

        let totalMarks = 0;
        let maxMarks = 0;
        let failedSubjectsCount = 0;
        let canBeGraceSaved = false;

        const subjectScores: Record<string, any> = {};

        subjects.forEach(sub => {
          const entry = sMarks[sub.id];
          if (entry) {
            const obt = Number(entry.obtained_marks) || 0;
            const max = Number(entry.max_marks) || 100;
            totalMarks += obt;
            maxMarks += max;
            const isAbsent = !!entry.is_absent;

            if (!isAbsent && obt < passThreshold) {
              failedSubjectsCount++;
              if (obt >= (passThreshold - graceMaxMarks)) {
                canBeGraceSaved = true;
              }
            }

            subjectScores[sub.id] = {
              marks: obt,
              max,
              isAbsent,
              subject_name: sub.subject_name
            };
          }
        });

        // Default max marks if none recorded yet
        if (maxMarks === 0) maxMarks = 100;

        const percentage = maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 10000) / 100 : 0;
        const isPass = failedSubjectsCount === 0 && totalMarks > 0;
        const gradeCalc = calculateCBSEGrade(percentage);
        const division = calculateCBSEDivision(percentage, isPass);

        let status: 'Pass' | 'Fail' | 'Needs Grace' = 'Pass';
        if (failedSubjectsCount > 0) {
          status = canBeGraceSaved ? 'Needs Grace' : 'Fail';
        } else if (totalMarks === 0) {
          status = 'Fail';
        }

        return {
          id: s.id,
          result_id: existing?.id,
          name: s.name,
          roll: s.roll_number || 'N/A',
          admission_number: s.admission_number || '',
          className: s.class,
          section: s.section || 'A',
          subjectScores,
          totalMarks: existing ? Number(existing.total_marks) : totalMarks,
          maxMarks,
          percentage: existing ? Number(existing.percentage) : percentage,
          grade: existing ? existing.grade : gradeCalc.grade,
          division: existing ? existing.division : division,
          rank: 1,
          status: existing ? (existing.result_status === 'pass' ? 'Pass' : existing.result_status === 'grace' ? 'Needs Grace' : 'Fail') : status,
          published: existing ? !!existing.published : false
        };
      });

    // Compute ranks with ties
    compiled.sort((a, b) => b.percentage - a.percentage);
    let currentRank = 1;
    for (let i = 0; i < compiled.length; i++) {
      if (i > 0 && compiled[i].percentage < compiled[i - 1].percentage) {
        currentRank = i + 1;
      }
      compiled[i].rank = currentRank;
    }

    setStudentResults(compiled);
  };

  // Execute full calculation & rank generation engine
  const handleCalculateResults = async () => {
    if (!selectedExamId) {
      toast.error('Select an examination term first.');
      return;
    }

    setProcessingState('processing');
    const toastId = toast.loading('Calculating CBSE totals, grades, divisions and merit ranks...');

    try {
      compileResultsFromDB(rawMarks, existingResults);
      setProcessingState('done');
      setPublicationStatus('Verified');
      toast.success('CBSE Results compilation & rank sorting completed!', { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error('Calculation failed: ' + err.message, { id: toastId });
      setProcessingState('idle');
    }
  };

  // Auto Grace Marks application
  const applyAutoGraceMarks = () => {
    let appliedCount = 0;
    setStudentResults(prev => prev.map(student => {
      if (student.status === 'Needs Grace') {
        appliedCount++;
        const newTotal = student.totalMarks + 2;
        const newPct = Math.round((newTotal / student.maxMarks) * 10000) / 100;
        const gradeCalc = calculateCBSEGrade(newPct);

        return {
          ...student,
          totalMarks: newTotal,
          percentage: newPct,
          grade: gradeCalc.grade,
          division: 'Third Division (Grace Pass)',
          status: 'Pass',
          graceApplied: 2
        };
      }
      return student;
    }));

    toast.success(`Allocated grace marks to ${appliedCount} borderline candidates!`);
  };

  // Commit and save calculated results to Supabase exam_results table
  const handleSaveResultsToDatabase = async () => {
    if (!selectedExamId) return;
    if (studentResults.length === 0) {
      toast.error('No calculated results to save.');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('Persisting results to PostgreSQL database...');

    try {
      const recordsToUpsert = studentResults.map(s => ({
        exam_id: selectedExamId,
        student_id: s.id,
        total_marks: s.totalMarks,
        percentage: s.percentage,
        grade: s.grade,
        division: s.division,
        result_status: (s.status === 'Pass' || Boolean(s.graceApplied)) ? 'pass' : 'fail',
        remarks: s.graceApplied ? `Passed with ${s.graceApplied} grace marks.` : `CBSE Grade ${s.grade}`,
        published: publicationStatus === 'Published' || publicationStatus === 'Locked'
      }));

      const { error } = await supabase
        .from('exam_results')
        .upsert(recordsToUpsert, { onConflict: 'exam_id,student_id' });

      if (error) throw error;

      toast.success(`Successfully saved ${recordsToUpsert.length} academic result statements!`, { id: toastId });
      await loadExamData(selectedExamId);
    } catch (err: any) {
      console.error(err);
      toast.error('Database save failed: ' + err.message, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Publication Status Toggle
  const handlePublicationToggle = async () => {
    if (publicationStatus === 'Draft') {
      setPublicationStatus('Verified');
      toast.success('Results marked as VERIFIED.');
    } else if (publicationStatus === 'Verified') {
      setPublicationStatus('Published');
      // Update database published flag
      if (selectedExamId) {
        await supabase
          .from('exam_results')
          .update({ published: true })
          .eq('exam_id', selectedExamId);
      }
      toast.success('Results PUBLISHED live to Student & Parent Portals!');
    } else if (publicationStatus === 'Published') {
      setPublicationStatus('Locked');
      if (selectedExamId) {
        await supabase.from('exams').update({ locked: true }).eq('id', selectedExamId);
      }
      toast.success('Results LOCKED.');
    } else {
      setPublicationStatus('Draft');
      if (selectedExamId) {
        await Promise.all([
          supabase.from('exam_results').update({ published: false }).eq('exam_id', selectedExamId),
          supabase.from('exams').update({ locked: false }).eq('id', selectedExamId)
        ]);
      }
      toast.info('Results reset to DRAFT mode.');
    }
  };

  // Filter for display
  const activeClassResults = useMemo(() => {
    let list = studentResults.filter(s => selectedClass === 'All' || isSameClass(s.className, selectedClass));
    
    if (filterStatus === 'pass') {
      list = list.filter(r => r.status === 'Pass');
    } else if (filterStatus === 'fail') {
      list = list.filter(r => r.status === 'Fail');
    } else if (filterStatus === 'grace') {
      list = list.filter(r => r.status === 'Needs Grace' || (r.graceApplied && r.graceApplied > 0));
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r => 
        (r.name || '').toLowerCase().includes(q) || 
        (r.roll || '').includes(q) ||
        (r.admission_number || '').toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => a.rank - b.rank);
  }, [studentResults, selectedClass, filterStatus, searchQuery]);

  const stats = useMemo(() => {
    const list = studentResults.filter(s => selectedClass === 'All' || isSameClass(s.className, selectedClass));
    const total = list.length;
    const passed = list.filter(r => r.status === 'Pass').length;
    const failed = list.filter(r => r.status === 'Fail').length;
    const needsGrace = list.filter(r => r.status === 'Needs Grace').length;

    return {
      total,
      passRate: total > 0 ? `${Math.round((passed / total) * 100)}%` : '0%',
      failed,
      needsGrace
    };
  }, [studentResults, selectedClass]);

  return (
    <div className="space-y-5">
      {/* 1. Header & Parameter Bar */}
      <div className="bg-white border border-slate-200/60 p-4 rounded-[20px] shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex flex-col min-w-[170px]">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Target Examination</span>
            <select 
              value={selectedExamId} 
              onChange={(e) => {
                setSelectedExamId(e.target.value);
                setProcessingState('idle');
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-700 outline-none h-[36px] cursor-pointer focus:border-violet-500 focus:bg-white"
            >
              {exams.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.exam_name} ({ex.academic_year})</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col min-w-[120px]">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Class Scope</span>
            <select 
              value={selectedClass} 
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-700 outline-none h-[36px] cursor-pointer focus:border-violet-500 focus:bg-white"
            >
              <option value="All">All Classes</option>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(c => (
                <option key={c} value={c}>{formatClassDisplay(c)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleCalculateResults}
            disabled={processingState === 'processing'}
            className="flex items-center gap-2 px-4 h-[36px] bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-violet-500/15 cursor-pointer active:scale-95"
          >
            <RotateCw className={cn("w-3.5 h-3.5", processingState === 'processing' && "animate-spin")} />
            {processingState === 'processing' ? 'Calculating...' : 'Run Calculation Engine'}
          </button>

          <button 
            onClick={handleSaveResultsToDatabase}
            disabled={isSaving || studentResults.length === 0}
            className="flex items-center gap-2 px-4 h-[36px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/15 cursor-pointer disabled:opacity-45 active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Persisting...' : 'Save Results to DB'}
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Enrolled Candidates', value: stats.total, desc: 'Active student roster', color: 'text-slate-600 bg-slate-50' },
          { label: 'Pass Rate', value: stats.passRate, desc: 'Scoring above threshold', color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Essential Repeat', value: stats.failed, desc: 'Unconditional fail cases', color: 'text-rose-600 bg-rose-50' },
          { label: 'Grace Eligible', value: stats.needsGrace, desc: 'Within rescue margin', color: 'text-amber-600 bg-amber-50' }
        ].map((k, i) => (
          <div key={i} className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-2xs flex flex-col justify-between">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{k.label}</span>
            <div className="flex items-baseline justify-between mt-1">
              <h3 className="text-xl font-black text-slate-900 leading-none">{k.value}</h3>
              <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded uppercase font-mono", k.color)}>STATS</span>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Publication Controls & Grace Tool */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Grace Marks Allocation */}
        <div className="bg-white border border-slate-200/60 p-5 rounded-[22px] shadow-2xs space-y-3">
          <div>
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-violet-500" />
              CBSE Grace Marks Rule
            </h4>
            <p className="text-slate-400 text-[10px] font-semibold mt-0.5">Automated salvage for students near 33% passing line</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Pass Cutoff</label>
              <input 
                type="number" 
                value={passThreshold} 
                onChange={(e) => setPassThreshold(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs outline-none"
              />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Max Grace</label>
              <input 
                type="number" 
                value={graceMaxMarks} 
                onChange={(e) => setGraceMaxMarks(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs outline-none"
              />
            </div>
          </div>

          <button 
            onClick={applyAutoGraceMarks}
            disabled={stats.needsGrace === 0}
            className={cn(
              "w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
              stats.needsGrace > 0 
                ? "bg-amber-500 hover:bg-amber-600 text-white shadow-xs" 
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            )}
          >
            Apply Auto-Grace Marks ({stats.needsGrace})
          </button>
        </div>

        {/* Publication Stages Workflow */}
        <div className="bg-white border border-slate-200/60 p-5 rounded-[22px] shadow-2xs space-y-3 lg:col-span-2">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-emerald-500" />
                Result Release & Portal Lock
              </h4>
              <p className="text-slate-400 text-[10px] font-semibold mt-0.5">Control publication visibility on Parent & Student 360 dashboards</p>
            </div>
            
            <span className={cn(
              "px-3 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider",
              publicationStatus === 'Published' ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
              publicationStatus === 'Locked' ? "bg-purple-50 border-purple-200 text-purple-700" :
              publicationStatus === 'Verified' ? "bg-blue-50 border-blue-200 text-blue-700" :
              "bg-slate-100 border-slate-200 text-slate-600"
            )}>
              Current: {publicationStatus}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {[
              { status: 'Draft', label: '1. Draft Entries', desc: 'Marks entry ongoing by faculty.', color: 'bg-slate-50 border-slate-200 text-slate-600' },
              { status: 'Verified', label: '2. Verified Results', desc: 'Averages & rank checks done.', color: 'bg-blue-50 border-blue-200 text-blue-700' },
              { status: 'Published', label: '3. Published Live', desc: 'Visible on parent portal.', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
              { status: 'Locked', label: '4. Session Locked', desc: 'Archive protected from changes.', color: 'bg-violet-50 border-violet-200 text-violet-700' }
            ].map((st, i) => {
              const isActive = publicationStatus === st.status;
              return (
                <div 
                  key={i}
                  className={cn(
                    "border rounded-xl p-2.5 text-left transition-all",
                    isActive ? st.color + " ring-2 ring-violet-500/20 font-bold" : "border-slate-100 bg-white opacity-50"
                  )}
                >
                  <span className="block text-[10px] font-black uppercase tracking-wider mb-0.5">{st.label}</span>
                  <span className="block text-[8.5px] text-slate-400 font-medium leading-tight">{st.desc}</span>
                </div>
              );
            })}
          </div>

          <button 
            onClick={handlePublicationToggle}
            className="w-full mt-2 py-2 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 transition-all"
          >
            Advance to Next Publication Phase
          </button>
        </div>
      </div>

      {/* 4. Merit List & Roster Table */}
      <div className="bg-white border border-slate-200/60 shadow-2xs rounded-[22px] overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Class Merit & Rank Ledger</h4>
            <p className="text-slate-400 text-[10px] font-medium">Rank positions resolve ties automatically based on percentage aggregates</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-2.5 bg-slate-50 h-[32px] w-[180px]">
              <Search size={13} className="text-slate-400" />
              <input 
                type="text" 
                placeholder="Search candidate..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none text-xs outline-none w-full"
              />
            </div>

            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-1 px-2 text-xs font-semibold text-slate-600 outline-none h-[32px] cursor-pointer"
            >
              <option value="all">All Candidates</option>
              <option value="pass">Only Passed</option>
              <option value="fail">Only Failed</option>
              <option value="grace">Grace Candidates</option>
            </select>

            <button 
              onClick={() => {
                window.print();
                toast.success('Printing Official Merit Roll');
              }}
              className="px-3 h-[32px] bg-slate-800 hover:bg-slate-950 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Print Roll
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[9.5px] font-black text-slate-400 uppercase tracking-widest">
                <th className="py-3 px-4 text-center w-[60px]">Rank</th>
                <th className="py-3 px-4">Student Candidate</th>
                <th className="py-3 px-3 text-center">Class / Sec</th>
                <th className="py-3 px-3 text-center">Total Score</th>
                <th className="py-3 px-3 text-center">Percentage</th>
                <th className="py-3 px-3 text-center">CBSE Grade</th>
                <th className="py-3 px-3 text-center">Division</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/70 text-slate-700 font-medium">
              {activeClassResults.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 font-bold">
                    No result records generated yet. Click "Run Calculation Engine" to evaluate.
                  </td>
                </tr>
              ) : (
                activeClassResults.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/40 transition-colors">
                    {/* Rank */}
                    <td className="py-3 px-4 text-center">
                      <div className={cn(
                        "w-6 h-6 mx-auto rounded-full flex items-center justify-center font-black text-[10px]",
                        st.rank === 1 ? "bg-amber-100 text-amber-800 border border-amber-300" :
                        st.rank === 2 ? "bg-slate-200 text-slate-800 border border-slate-300" :
                        st.rank === 3 ? "bg-orange-100 text-orange-800 border border-orange-300" :
                        "bg-slate-50 text-slate-500 border border-slate-200"
                      )}>
                        {st.rank}
                      </div>
                    </td>

                    {/* Student Name */}
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        {st.rank <= 3 && <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                        <span>{st.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        Roll: #{st.roll} • {st.admission_number}
                      </div>
                    </td>

                    {/* Class */}
                    <td className="py-3 px-3 text-center font-bold text-slate-600">
                      {formatClassDisplay(st.className)}-{st.section}
                    </td>

                    {/* Total Score */}
                    <td className="py-3 px-3 text-center font-mono font-bold text-indigo-700">
                      {st.totalMarks} / {st.maxMarks}
                    </td>

                    {/* Percentage */}
                    <td className="py-3 px-3 text-center font-mono font-black text-slate-900">
                      {st.percentage.toFixed(1)}%
                    </td>

                    {/* CBSE Grade */}
                    <td className="py-3 px-3 text-center">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                        st.grade.startsWith('A') ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        st.grade.startsWith('B') ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
                        st.grade.startsWith('C') ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        st.grade === 'D' ? "bg-blue-50 text-blue-700 border border-blue-200" :
                        "bg-rose-50 text-rose-700 border border-rose-200"
                      )}>
                        {st.grade}
                      </span>
                    </td>

                    {/* Division */}
                    <td className="py-3 px-3 text-center text-[10px] font-semibold text-slate-600">
                      {st.division}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4 text-center">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                        st.status === 'Pass' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        st.status === 'Needs Grace' ? "bg-amber-50 text-amber-700 border-amber-200" :
                        "bg-rose-50 text-rose-700 border-rose-200"
                      )}>
                        {st.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
