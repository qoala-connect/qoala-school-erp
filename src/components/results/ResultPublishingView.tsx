import React, { useState, useEffect, useMemo } from 'react';
import { 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Lock, 
  Unlock, 
  RotateCcw, 
  Search, 
  Filter, 
  Award, 
  Users, 
  Layers, 
  Calendar, 
  Clock, 
  Sparkles, 
  ShieldCheck, 
  FileText, 
  Eye, 
  Printer, 
  ChevronRight,
  Check,
  X,
  Loader2,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { examinationService, ExamRecord, StudentExamResult } from '@/services/examinationService';
import { useAuth } from '@/context/AuthContext';
import { formatClassDisplay } from '@/lib/cbseExamUtils';

interface ResultPublishingViewProps {
  exams: ExamRecord[];
  classes: any[];
  selectedYearId: string;
  onNavigateTab: (tab: string, extraParams?: Record<string, string>) => void;
}

export default function ResultPublishingView({
  exams,
  classes,
  selectedYearId,
  onNavigateTab
}: ResultPublishingViewProps) {
  const { user, can } = useAuth();

  const [selectedExamId, setSelectedExamId] = useState<string>('all');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all'); // all | published | unpublished
  const [searchQuery, setSearchQuery] = useState('');

  const [results, setResults] = useState<StudentExamResult[]>([]);
  const [allSessionResults, setAllSessionResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeExamsList, setActiveExamsList] = useState<ExamRecord[]>(exams);

  // Publish / Unpublish Confirmation Modals
  const [publishModalExam, setPublishModalExam] = useState<ExamRecord | null>(null);
  const [unpublishModalExam, setUnpublishModalExam] = useState<ExamRecord | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Preview Drawer Modal
  const [previewResult, setPreviewResult] = useState<StudentExamResult | null>(null);

  // Load results when exam or class selection changes
  useEffect(() => {
    fetchResults();
  }, [selectedExamId, selectedClassId, selectedYearId]);

  const fetchResults = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch filtered results for the active view
      let query = supabase
        .from('exam_results')
        .select('*, students:student_id(name, roll_number, admission_number, class, section, father_name), exams:exam_id(exam_name, short_name, class, is_published, academic_year)')
        .order('rank', { ascending: true });

      if (selectedExamId && selectedExamId !== 'all') {
        query = query.eq('exam_id', selectedExamId);
      }
      if (selectedClassId && selectedClassId !== 'all') {
        query = query.eq('class_id', selectedClassId);
      }

      const [filteredRes, allRes] = await Promise.all([
        query,
        supabase
          .from('exam_results')
          .select('id, result_status, exam_id, is_published')
      ]);

      if (filteredRes.error) throw filteredRes.error;
      setResults(filteredRes.data || []);
      setAllSessionResults(allRes.data || []);

      // Also refresh exam list to have latest is_published status
      const updatedExams = await examinationService.getExams({ academicYearId: selectedYearId });
      setActiveExamsList(updatedExams);
    } catch (err: any) {
      console.error('Failed to fetch exam results for publishing:', err);
      toast.error('Failed to load processed examination results');
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered list of exams for the top cards
  const filteredExams = useMemo(() => {
    return activeExamsList.filter(ex => {
      if (selectedYearId && ex.academic_year_id && ex.academic_year_id !== selectedYearId) return false;
      if (selectedClassId !== 'all' && ex.class_id !== selectedClassId) return false;
      if (statusFilter === 'published' && !ex.is_published) return false;
      if (statusFilter === 'unpublished' && ex.is_published) return false;
      return true;
    });
  }, [activeExamsList, selectedYearId, selectedClassId, statusFilter]);

  // Filtered student results
  const filteredResults = useMemo(() => {
    return results.filter(res => {
      const student = (res as any).students;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const name = student?.name?.toLowerCase() || '';
      const roll = student?.roll_number?.toLowerCase() || '';
      const adm = student?.admission_number?.toLowerCase() || '';
      return name.includes(q) || roll.includes(q) || adm.includes(q);
    });
  }, [results, searchQuery]);

  // Publishing metrics
  const stats = useMemo(() => {
    const totalExams = activeExamsList.length;
    const publishedExams = activeExamsList.filter(e => e.is_published).length;
    const pendingExams = totalExams - publishedExams;
    
    // Use session-wide results if viewing all, or filtered results if viewing single exam
    const dataset = (selectedExamId !== 'all' || selectedClassId !== 'all') ? results : allSessionResults;
    const totalProcessedResults = dataset.length;
    const passCount = dataset.filter(r => r.result_status === 'PASS').length;
    const passPercentage = totalProcessedResults > 0 ? Math.round((passCount / totalProcessedResults) * 100) : null;

    return {
      totalExams,
      publishedExams,
      pendingExams,
      totalProcessedResults,
      passCount,
      passPercentage
    };
  }, [activeExamsList, results, allSessionResults, selectedExamId, selectedClassId]);

  // Handle Publish Execution
  const handleConfirmPublish = async () => {
    if (!publishModalExam) return;
    setIsActionLoading(true);
    try {
      const result = await examinationService.publishExamResults(
        publishModalExam.id,
        publishModalExam.class_id || undefined,
        user?.id
      );
      if (result.success) {
        toast.success(`Results for ${publishModalExam.short_name || publishModalExam.exam_name} published successfully!`);
        setPublishModalExam(null);
        await fetchResults();
      } else {
        toast.error(result.message || 'Failed to publish results');
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred while publishing results');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Unpublish Execution
  const handleConfirmUnpublish = async () => {
    if (!unpublishModalExam) return;
    setIsActionLoading(true);
    try {
      const result = await examinationService.unpublishExamResults(
        unpublishModalExam.id,
        unpublishModalExam.class_id || undefined,
        user?.id
      );
      if (result.success) {
        toast.info(`Results for ${unpublishModalExam.short_name || unpublishModalExam.exam_name} have been retracted to Draft status.`);
        setUnpublishModalExam(null);
        await fetchResults();
      } else {
        toast.error(result.message || 'Failed to unpublish results');
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred while unpublishing results');
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Header & Quick Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Terms</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Layers size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{stats.totalExams}</span>
            <span className="text-[11px] text-slate-400 font-medium">configured</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Published & Live</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600">{stats.publishedExams}</span>
            <span className="text-[11px] text-slate-400 font-medium">visible in portal</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Draft / Pending</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600">{stats.pendingExams}</span>
            <span className="text-[11px] text-slate-400 font-medium">not yet visible</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pass Ratio</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Award size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-600">
              {stats.passPercentage !== null ? `${stats.passPercentage}%` : '—'}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              {stats.totalProcessedResults > 0 
                ? `${stats.passCount}/${stats.totalProcessedResults} passed` 
                : 'No results processed'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Control Banner: Explaining Security & Visibility */}
      <div className="bg-linear-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-blue-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-white/10 rounded-xl border border-white/20 shrink-0">
            <ShieldCheck className="w-6 h-6 text-blue-200" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">Official CBSE Result Publishing Safeguards</h3>
            <p className="text-xs text-blue-100/80 mt-0.5 max-w-2xl">
              Publishing an exam releases official marks, CBSE grades, division, and ranks to the Student &amp; Parent Portals while locking marks entry from further alterations. Retracting an exam makes results immediately private.
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigateTab('result-processing')}
          className="px-3.5 py-2 bg-white text-blue-900 hover:bg-blue-50 rounded-xl text-xs font-bold transition-colors shrink-0 shadow-xs cursor-pointer flex items-center gap-1.5"
        >
          <span>Calculate / Reprocess Results</span>
          <ChevronRight size={13} />
        </button>
      </div>

      {/* 3. Examination Status Master Cards */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Term-Wise Publication State</h3>
            <p className="text-xs text-slate-500 mt-0.5">Authorize student and parent portal access per assessment</p>
          </div>
          
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published Only</option>
              <option value="unpublished">Pending / Draft Only</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredExams.map(ex => {
            const isPub = ex.is_published;

            return (
              <div 
                key={ex.id}
                className={cn(
                  "p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3",
                  isPub 
                    ? "bg-emerald-50/40 border-emerald-200/80 hover:border-emerald-300" 
                    : "bg-slate-50/60 border-slate-200/80 hover:border-blue-200"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider bg-white border border-slate-200 text-slate-700">
                      {formatClassDisplay(ex.classes?.class_name || ex.class)}
                    </span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10.5px] font-bold border flex items-center gap-1",
                      isPub ? "bg-emerald-100/80 text-emerald-800 border-emerald-200" : "bg-slate-200 text-slate-700 border-slate-300"
                    )}>
                      {isPub ? (
                        <>
                          <CheckCircle2 size={11} className="text-emerald-700" />
                          <span>Published</span>
                        </>
                      ) : (
                        <>
                          <Clock size={11} className="text-slate-500" />
                          <span>Draft / Hidden</span>
                        </>
                      )}
                    </span>
                  </div>

                  <h4 className="text-xs font-black text-slate-900 leading-snug">
                    {ex.short_name || ex.exam_name}
                  </h4>
                  {ex.short_name && ex.short_name !== ex.exam_name && (
                    <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">{ex.exam_name}</p>
                  )}
                  
                  <div className="mt-2 text-[10.5px] text-slate-500 space-y-0.5 font-medium">
                    <p>Session: <span className="font-bold text-slate-700">{ex.academic_year}</span></p>
                    {ex.result_publish_date && (
                      <p>Publish Date: <span className="font-bold text-slate-700">{ex.result_publish_date}</span></p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setSelectedExamId(ex.id);
                      if (ex.class_id) setSelectedClassId(ex.class_id);
                    }}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                  >
                    View Candidates ({results.filter(r => r.exam_id === ex.id).length})
                  </button>

                  {can('results.publish') && (
                    <div>
                      {isPub ? (
                        <button
                          onClick={() => setUnpublishModalExam(ex)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <RotateCcw size={11} />
                          <span>Retract</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setPublishModalExam(ex)}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <Send size={11} />
                          <span>Publish Now</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Candidate Results Registry */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Processed Candidate Results Ledger</h3>
            <p className="text-xs text-slate-500 mt-0.5">Review marks, percentages, CBSE grades, divisions, and ranks before publishing</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search candidate..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:bg-white w-44"
              />
            </div>

            <select
              value={selectedExamId}
              onChange={e => setSelectedExamId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Examinations</option>
              {activeExamsList.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.short_name || ex.exam_name} ({formatClassDisplay(ex.classes?.class_name || ex.class)})
                </option>
              ))}
            </select>

            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{formatClassDisplay(c.class_name)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 text-center w-14">Rank</th>
                <th className="py-3 px-4">Candidate Details</th>
                <th className="py-3 px-4 text-center">Class / Section</th>
                <th className="py-3 px-4 text-center">Grand Total</th>
                <th className="py-3 px-4 text-center">Percentage</th>
                <th className="py-3 px-4 text-center">CBSE Grade</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right pr-5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 font-bold">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading processed results...
                  </td>
                </tr>
              ) : filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 font-medium">
                    <Award className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No processed results found for the selected filter.
                    <br />
                    <button
                      onClick={() => onNavigateTab('result-processing')}
                      className="mt-2 text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                    >
                      Run Result Processing Engine →
                    </button>
                  </td>
                </tr>
              ) : (
                filteredResults.map(res => {
                  const student = (res as any).students;
                  const isPass = res.result_status === 'PASS';

                  return (
                    <tr key={res.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-center">
                        <span className={cn(
                          "inline-flex items-center justify-center w-6 h-6 rounded-full font-mono text-xs font-black",
                          res.rank === 1 ? "bg-amber-100 text-amber-800 border border-amber-300" :
                          res.rank === 2 ? "bg-slate-200 text-slate-800 border border-slate-300" :
                          res.rank === 3 ? "bg-orange-100 text-orange-800 border border-orange-300" :
                          "bg-slate-100 text-slate-600"
                        )}>
                          {res.rank || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <span>{student?.name || 'Student'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Roll: {student?.roll_number || '-'} • Adm: {student?.admission_number || '-'}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                          {formatClassDisplay(student?.class)} {student?.section ? `- ${student.section}` : ''}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                        {res.total_marks} / {res.max_total_marks}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-black text-slate-900">
                        {res.percentage}%
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-md font-mono text-[10.5px] font-black bg-blue-50 text-blue-700 border border-blue-100">
                          {res.grade || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          isPass ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                        )}>
                          {res.result_status || 'PASS'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right pr-5">
                        <button
                          onClick={() => setPreviewResult(res)}
                          className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye size={12} />
                          <span>View Summary</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONFIRM PUBLISH MODAL */}
      {publishModalExam && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <Send size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Publish Examination Results</h3>
                <p className="text-xs text-slate-500">Authorize visibility to students and parents</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Assessment Term:</span>
                <strong className="text-slate-800">{publishModalExam.short_name || publishModalExam.exam_name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Class Scope:</span>
                <strong className="text-slate-800">{formatClassDisplay(publishModalExam.classes?.class_name || publishModalExam.class)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Academic Session:</span>
                <strong className="text-slate-800">{publishModalExam.academic_year}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Candidates Impacted:</span>
                <strong className="text-blue-600">{results.filter(r => r.exam_id === publishModalExam.id).length} candidates</strong>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-800 font-medium">
              <AlertTriangle size={15} className="shrink-0 text-amber-600 mt-0.5" />
              <p>
                <strong>Important:</strong> Once published, students and parents can instantly view and print their report cards. Marks entry for this exam will be locked.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPublishModalExam(null)}
                disabled={isActionLoading}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPublish}
                disabled={isActionLoading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 cursor-pointer transition-all flex items-center gap-1.5"
              >
                {isActionLoading && <Loader2 size={13} className="animate-spin" />}
                <span>{isActionLoading ? 'Publishing...' : 'Yes, Publish Results'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM UNPUBLISH / RETRACT MODAL */}
      {unpublishModalExam && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                <RotateCcw size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Retract / Unpublish Results</h3>
                <p className="text-xs text-slate-500">Hide results from student/parent portal</p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
              You are retracting results for <strong>{unpublishModalExam.short_name || unpublishModalExam.exam_name}</strong>. Students and parents will immediately lose access to their marks and report cards until republished.
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setUnpublishModalExam(null)}
                disabled={isActionLoading}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUnpublish}
                disabled={isActionLoading}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 cursor-pointer transition-all flex items-center gap-1.5"
              >
                {isActionLoading && <Loader2 size={13} className="animate-spin" />}
                <span>{isActionLoading ? 'Retracting...' : 'Confirm Retract'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW RESULT DRAWER MODAL */}
      {previewResult && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Award size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Candidate Evaluation Summary</h3>
                  <p className="text-[11px] text-slate-500">{(previewResult as any).students?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewResult(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Class & Section</span>
                <strong className="text-slate-800 text-xs">
                  {formatClassDisplay(previewResult.students?.class)} {previewResult.students?.section ? `- ${previewResult.students.section}` : ''}
                </strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Class Rank</span>
                <strong className="text-blue-700 text-xs">Rank #{previewResult.rank || 'N/A'}</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Grand Total</span>
                <strong className="text-slate-800 text-xs">{previewResult.total_marks} / {previewResult.max_total_marks}</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Percentage</span>
                <strong className="text-slate-900 text-xs">{previewResult.percentage}%</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">CBSE Grade</span>
                <strong className="text-emerald-700 text-xs">{previewResult.grade}</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Division</span>
                <strong className="text-slate-800 text-xs">{previewResult.division || 'First Division'}</strong>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between text-xs">
              <span className="text-blue-900 font-bold">Result Status:</span>
              <span className="px-2.5 py-0.5 rounded-md font-black bg-blue-600 text-white uppercase text-[10px]">
                {previewResult.result_status || 'PASS'}
              </span>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setPreviewResult(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
