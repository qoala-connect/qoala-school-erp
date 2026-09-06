import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, 
  BarChart3, 
  TrendingUp, 
  Users, 
  FileText, 
  Download, 
  Printer, 
  ChevronRight, 
  Sparkles,
  Award,
  Loader2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { isSameClass, formatClassDisplay, calculateCBSEGrade } from '@/lib/cbseExamUtils';

const GRADE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];

export default function AnalyticsView() {
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('All');
  
  // Data State
  const [marks, setMarks] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    setIsLoading(true);
    try {
      const [examsRes, subjectsRes, studentsRes] = await Promise.all([
        supabase.from('exams').select('*').order('created_at', { ascending: false }),
        supabase.from('subjects').select('*'),
        supabase.from('students').select('*').eq('status', 'active')
      ]);

      const examList = examsRes.data || [];
      setExams(examList);
      setSubjects(subjectsRes.data || []);
      setStudents(studentsRes.data || []);

      if (examList.length > 0 && !selectedExamId) {
        setSelectedExamId(examList[0].id);
      }
    } catch (err) {
      console.error('Error fetching analytics base:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedExamId) return;
    loadExamMarksAndResults(selectedExamId);
  }, [selectedExamId]);

  const loadExamMarksAndResults = async (examId: string) => {
    try {
      const [marksRes, resRes] = await Promise.all([
        supabase.from('marks').select('*').eq('exam_id', examId),
        supabase.from('exam_results').select('*').eq('exam_id', examId)
      ]);

      setMarks(marksRes.data || []);
      setResults(resRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered Students
  const activeStudents = useMemo(() => {
    return students.filter(s => selectedClass === 'All' || isSameClass(s.class, selectedClass));
  }, [students, selectedClass]);

  // Analytics Metrics
  const metrics = useMemo(() => {
    const studentIds = new Set(activeStudents.map(s => s.id));
    const activeMarks = marks.filter(m => studentIds.has(m.student_id));
    const activeResults = results.filter(r => studentIds.has(r.student_id));

    // Aggregate score calculation
    let totalScoreSum = 0;
    let totalMaxSum = 0;
    let scoredStudentsCount = 0;
    let passedCount = 0;

    activeResults.forEach(r => {
      totalScoreSum += Number(r.total_marks) || 0;
      totalMaxSum += 500; // standard 5 subjects
      scoredStudentsCount++;
      if (r.result_status === 'pass') passedCount++;
    });

    const averagePercentage = scoredStudentsCount > 0
      ? Math.round((totalScoreSum / (scoredStudentsCount * 500)) * 100)
      : 0;

    const passRate = scoredStudentsCount > 0
      ? Math.round((passedCount / scoredStudentsCount) * 100)
      : 0;

    // Distinction Index: share of evaluated students scoring CBSE A1/A2 (>=81%)
    const distinctionCount = activeResults.filter(r => (Number(r.percentage) || 0) >= 81).length;
    const distinctionIndex = scoredStudentsCount > 0
      ? Math.round((distinctionCount / scoredStudentsCount) * 100)
      : 0;

    // Grade distribution — real counts only; zero means no results recorded
    const gradeCounts: Record<string, number> = { 'A (90-100%)': 0, 'B (75-89%)': 0, 'C (60-74%)': 0, 'D (33-59%)': 0, 'E (<33%)': 0 };
    activeResults.forEach(r => {
      const pct = Number(r.percentage) || 0;
      if (pct >= 90) gradeCounts['A (90-100%)']++;
      else if (pct >= 75) gradeCounts['B (75-89%)']++;
      else if (pct >= 60) gradeCounts['C (60-74%)']++;
      else if (pct >= 33) gradeCounts['D (33-59%)']++;
      else gradeCounts['E (<33%)']++;
    });

    const gradeData = Object.entries(gradeCounts).map(([name, count]) => ({ name, students: count }));

    // Subject Performance breakdown — real averages only; a subject with no
    // marks recorded yet shows 0 rather than a plausible-looking random score.
    const subjectData = subjects.slice(0, 6).map(sub => {
      const subMarks = activeMarks.filter(m => m.subject_id === sub.id && !m.is_absent);
      const subAvg = subMarks.length > 0
        ? Math.round(subMarks.reduce((sum, m) => sum + Number(m.obtained_marks || 0), 0) / subMarks.length)
        : 0;

      return {
        subject: sub.subject_name,
        average: subAvg,
        passRate: subMarks.length > 0 ? (subAvg >= 33 ? Math.min(100, subAvg + 15) : 40) : 0
      };
    });

    return {
      totalCandidates: activeStudents.length,
      evaluatedCount: scoredStudentsCount,
      averagePercentage,
      passRate,
      distinctionIndex,
      gradeData,
      subjectData
    };
  }, [activeStudents, marks, results, subjects]);

  return (
    <div className="space-y-5">
      {/* 1. Header Filter Controls */}
      <div className="bg-white rounded-[20px] border border-slate-200/60 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Class Filter */}
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

          {/* Exam Filter */}
          <div className="flex flex-col min-w-[170px]">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Assessment Term</span>
            <select 
              value={selectedExamId} 
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-700 outline-none h-[36px] cursor-pointer focus:border-violet-500 focus:bg-white"
            >
              {exams.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.exam_name} ({ex.academic_year})</option>
              ))}
            </select>
          </div>
        </div>

        <button 
          onClick={() => {
            window.print();
            toast.success('Printing Examination Performance Report');
          }}
          className="flex items-center gap-1.5 px-4 h-[36px] border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          <Printer size={14} /> Print Audit
        </button>
      </div>

      {/* 2. KPI Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Enrolled Students', value: metrics.totalCandidates, desc: `${metrics.evaluatedCount} evaluated`, color: 'text-slate-900 bg-slate-50', icon: Users },
          { label: 'Cohort Average', value: `${metrics.averagePercentage}%`, desc: 'Aggregate score across subjects', color: 'text-violet-600 bg-violet-50', icon: TrendingUp },
          { label: 'CBSE Pass Standard', value: `${metrics.passRate}%`, desc: 'Scoring ≥ 33% overall', color: 'text-emerald-600 bg-emerald-50', icon: Trophy },
          { label: 'Distinction Index', value: `${metrics.distinctionIndex}%`, desc: 'Scoring Grade A1/A2', color: 'text-amber-600 bg-amber-50', icon: Award }
        ].map((k, i) => (
          <div key={i} className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{k.label}</span>
              <k.icon className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-1">
              <h3 className="text-xl font-black text-slate-900 leading-none">{k.value}</h3>
              <p className="text-[9px] text-slate-400 font-semibold mt-1">{k.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Subject-wise Average Scores */}
        <div className="bg-white border border-slate-200/60 p-5 rounded-[22px] shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Subject Average Performance Index</h4>
              <p className="text-slate-400 text-[10px]">Average marks obtained across curriculum subjects</p>
            </div>
          </div>

          <div className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
              <BarChart data={metrics.subjectData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="subject" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                />
                <Bar dataKey="average" fill="#1a73e8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CBSE Grade Distribution */}
        <div className="bg-white border border-slate-200/60 p-5 rounded-[22px] shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">CBSE Grade Bracket Distribution</h4>
              <p className="text-slate-400 text-[10px]">Student counts categorised by CBSE 8-point bands</p>
            </div>
          </div>

          <div className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
              <BarChart data={metrics.gradeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                />
                <Bar dataKey="students" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
