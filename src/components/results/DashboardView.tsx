import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, 
  Calendar, 
  ClipboardList, 
  BarChart3, 
  IdCard, 
  Award, 
  CheckCircle2, 
  Clock, 
  Users, 
  Send, 
  ShieldCheck, 
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  FileText,
  Layers,
  Sparkles,
  Loader2,
  Printer,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { examinationService, ExamRecord } from '@/services/examinationService';
import AdminStatCard from '@/components/common/AdminStatCard';
import { Link } from 'react-router-dom';

interface DashboardViewProps {
  onNavigateTab: (tab: string, extraParams?: Record<string, string>) => void;
  academicYears: any[];
  selectedYearId: string;
}

export default function DashboardView({ onNavigateTab, academicYears, selectedYearId }: DashboardViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedYearId]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [examsData, analyticsData] = await Promise.all([
        examinationService.getExams({ academicYearId: selectedYearId }),
        examinationService.getExamPerformanceAnalytics({ academicYearId: selectedYearId })
      ]);
      setExams(examsData);
      setAnalytics(analyticsData);
    } catch (err) {
      console.error('Failed to load exam dashboard metrics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  // Status segmentation from real DB records
  const upcomingExams = useMemo(() => {
    return exams.filter(e => e.start_date && e.start_date > today);
  }, [exams, today]);

  const ongoingExams = useMemo(() => {
    return exams.filter(e => e.start_date && e.end_date && e.start_date <= today && e.end_date >= today);
  }, [exams, today]);

  const awaitingMarks = useMemo(() => {
    return exams.filter(e => e.status === 'draft' || e.status === 'scheduled' || e.status === 'marks_entry_open');
  }, [exams]);

  const pendingVerification = useMemo(() => {
    return exams.filter(e => e.status === 'review' || (e.exam_subjects && e.exam_subjects.some(s => s.review_status === 'submitted')));
  }, [exams]);

  const readyToPublish = useMemo(() => {
    return exams.filter(e => e.status === 'result_processed' && !e.is_published);
  }, [exams]);

  const publishedExams = useMemo(() => {
    return exams.filter(e => e.is_published || e.status === 'published');
  }, [exams]);

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-xs font-bold text-slate-500">Loading live examination metrics...</p>
      </div>
    );
  }

  const passStats = analytics?.passFailStats || { pass: 0, compartment: 0, fail: 0, withheld: 0 };
  const totalEvaluated = passStats.pass + passStats.compartment + passStats.fail + passStats.withheld;
  const passPct = totalEvaluated > 0 ? Math.round((passStats.pass / totalEvaluated) * 100) : 0;
  const compPct = totalEvaluated > 0 ? Math.round((passStats.compartment / totalEvaluated) * 100) : 0;
  const failPct = totalEvaluated > 0 ? Math.round((passStats.fail / totalEvaluated) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* 1. Primary Live KPI Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <AdminStatCard
          label="Total Exams"
          value={exams.length}
          icon={ClipboardList}
          variant="primary"
          subtext="Configured terms"
        />
        <AdminStatCard
          label="Upcoming Exams"
          value={upcomingExams.length}
          icon={Calendar}
          variant="primary"
          subtext="Scheduled dates"
        />
        <AdminStatCard
          label="Candidates"
          value={analytics?.totalCandidates || 0}
          icon={Users}
          variant="emerald"
          subtext="Enrolled students"
        />
        <AdminStatCard
          label="Marks Pending"
          value={awaitingMarks.length}
          icon={Clock}
          variant="amber"
          subtext="Awaiting entry"
        />
        <AdminStatCard
          label="Results Ready"
          value={readyToPublish.length}
          icon={Trophy}
          variant="violet"
          subtext="Processed"
        />
        <AdminStatCard
          label="Published"
          value={publishedExams.length}
          icon={CheckCircle2}
          variant="emerald"
          subtext="Active in portals"
        />
      </div>

      {/* 2. Quick Action Workflow Shortcuts */}
      <div className="p-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-200 border border-blue-400/30 rounded-full text-[10px] font-bold uppercase tracking-wider">
                Exam Workflow Pipeline
              </span>
            </div>
            <h3 className="text-base font-bold text-white">Central Examination Operations</h3>
            <p className="text-xs text-blue-200/80">Manage the complete exam lifecycle from term scheduling to result publication.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onNavigateTab('exams')}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <ClipboardList size={14} /> Create / Manage Exam
            </button>
            <button
              onClick={() => onNavigateTab('marks-entry')}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <FileText size={14} /> Enter Marks
            </button>
            <button
              onClick={() => onNavigateTab('result-processing')}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Trophy size={14} /> Process Results
            </button>
            <button
              onClick={() => onNavigateTab('admit-cards')}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <IdCard size={14} /> Admit Cards
            </button>
          </div>
        </div>
      </div>

      {/* 3. Operational Stage Status Overview & Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Pipeline Tracking & Class Performance */}
        <div className="lg:col-span-2 space-y-6">
          {/* Exam Lifecycle Pipeline Cards */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Examination Pipeline Status
                </h4>
                <p className="text-xs text-slate-500">Live breakdown of all configured examinations by lifecycle phase.</p>
              </div>
              <button
                onClick={() => onNavigateTab('exams')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View all <ChevronRight size={13} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div 
                onClick={() => onNavigateTab('exams')}
                className="p-3.5 bg-slate-50 hover:bg-blue-50/50 border border-slate-200/70 rounded-xl cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                  <span>Scheduled</span>
                  <Calendar size={13} className="text-blue-500" />
                </div>
                <span className="text-2xl font-black text-slate-800">{upcomingExams.length}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Ready for testing</span>
              </div>

              <div 
                onClick={() => onNavigateTab('marks-entry')}
                className="p-3.5 bg-amber-50/40 hover:bg-amber-50 border border-amber-200/60 rounded-xl cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between text-xs font-bold text-amber-700 mb-1">
                  <span>Awaiting Marks</span>
                  <Clock size={13} className="text-amber-500" />
                </div>
                <span className="text-2xl font-black text-amber-900">{awaitingMarks.length}</span>
                <span className="text-[10px] text-amber-600/80 block mt-0.5">Faculty entry pending</span>
              </div>

              <div 
                onClick={() => onNavigateTab('marks-verification')}
                className="p-3.5 bg-indigo-50/40 hover:bg-indigo-50 border border-indigo-200/60 rounded-xl cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between text-xs font-bold text-indigo-700 mb-1">
                  <span>Pending Review</span>
                  <ShieldCheck size={13} className="text-indigo-500" />
                </div>
                <span className="text-2xl font-black text-indigo-900">{pendingVerification.length}</span>
                <span className="text-[10px] text-indigo-600/80 block mt-0.5">Submitted by teachers</span>
              </div>

              <div 
                onClick={() => onNavigateTab('result-publishing')}
                className="p-3.5 bg-emerald-50/40 hover:bg-emerald-50 border border-emerald-200/60 rounded-xl cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between text-xs font-bold text-emerald-700 mb-1">
                  <span>Published</span>
                  <CheckCircle2 size={13} className="text-emerald-500" />
                </div>
                <span className="text-2xl font-black text-emerald-900">{publishedExams.length}</span>
                <span className="text-[10px] text-emerald-600/80 block mt-0.5">Visible to parents</span>
              </div>
            </div>
          </div>

          {/* Class Average Performance Bar Chart */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  Class-Wise Academic Average
                </h4>
                <p className="text-xs text-slate-500">Mean percentage scored across all processed terms in this session.</p>
              </div>
              <button
                onClick={() => onNavigateTab('analytics')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                Full Analytics <ChevronRight size={13} />
              </button>
            </div>

            {analytics?.classAverages && analytics.classAverages.length > 0 ? (
              <div className="space-y-3">
                {analytics.classAverages.map((c: any) => (
                  <div key={c.className} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">Class {c.className}</span>
                      <span className="font-mono font-bold text-slate-900">{c.average}% ({c.count} evaluated)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          c.average >= 75 ? "bg-emerald-500" :
                          c.average >= 60 ? "bg-blue-500" :
                          c.average >= 45 ? "bg-amber-500" : "bg-rose-500"
                        )}
                        style={{ width: `${Math.min(100, Math.max(0, c.average))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400">
                <BarChart3 className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                <p className="text-xs font-bold text-slate-600">No Processed Results Yet</p>
                <p className="text-[11px] text-slate-400">Class averages will appear once exam marks are processed.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Performance Breakdown & Quick Actions */}
        <div className="space-y-6">
          {/* Pass / Compartment / Fail Distribution */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Award className="w-4 h-4 text-emerald-600" />
              Overall Progression Metrics
            </h4>

            {totalEvaluated > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/60">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase block">Pass Rate</span>
                    <span className="text-xl font-black text-emerald-800">{passPct}%</span>
                    <span className="text-[10px] text-emerald-600 font-mono">{passStats.pass} students</span>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/60">
                    <span className="text-[10px] font-bold text-amber-700 uppercase block">Compartment</span>
                    <span className="text-xl font-black text-amber-800">{compPct}%</span>
                    <span className="text-[10px] text-amber-600 font-mono">{passStats.compartment} students</span>
                  </div>
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-200/60">
                    <span className="text-[10px] font-bold text-rose-700 uppercase block">Repeat</span>
                    <span className="text-xl font-black text-rose-800">{failPct}%</span>
                    <span className="text-[10px] text-rose-600 font-mono">{passStats.fail} students</span>
                  </div>
                </div>

                {/* Progress bar split */}
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
                  <div style={{ width: `${passPct}%` }} className="bg-emerald-500 h-full" title={`Pass: ${passPct}%`} />
                  <div style={{ width: `${compPct}%` }} className="bg-amber-500 h-full" title={`Compartment: ${compPct}%`} />
                  <div style={{ width: `${failPct}%` }} className="bg-rose-500 h-full" title={`Fail: ${failPct}%`} />
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">No examination progression data available yet.</p>
            )}

            {/* CBSE 8-Point Grade Distribution */}
            <div className="pt-3 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-800 block mb-2">CBSE Grade Distribution</span>
              <div className="grid grid-cols-4 gap-2 text-center">
                {Object.entries(analytics?.gradeDistribution || {}).map(([grade, count]) => (
                  <div key={grade} className="p-2 bg-slate-50 border border-slate-200/70 rounded-lg">
                    <span className="text-[10px] font-black text-blue-700 block">{grade}</span>
                    <span className="text-xs font-bold text-slate-900 font-mono">{count as number}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Upcoming Schedule Widget */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Upcoming Examinations
              </h4>
              <button
                onClick={() => onNavigateTab('schedule')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                Schedule
              </button>
            </div>

            {upcomingExams.length > 0 ? (
              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {upcomingExams.slice(0, 5).map(e => (
                  <div key={e.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800 block">{e.exam_name}</span>
                      <span className="text-[11px] text-slate-400 font-medium">Class {e.class} • Starts {e.start_date}</span>
                    </div>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-black text-[10px] uppercase">
                      {e.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No upcoming examinations scheduled.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
