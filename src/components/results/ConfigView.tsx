import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  Plus, 
  Trash2, 
  Check, 
  AlertCircle, 
  Scale, 
  Percent, 
  Award, 
  BookOpen,
  Sparkles,
  Loader2,
  Calendar,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface GradingRule {
  id: string;
  grade_name: string;
  min_score: number;
  max_score: number;
  points: number;
  remarks: string;
}

interface AssessmentType {
  id: string;
  code: string;
  name: string;
  description: string;
  stage_category: string;
  default_weightage: number;
  is_board_exam: boolean;
  display_order: number;
}

export default function ConfigView() {
  const [activeTab, setActiveTab] = useState<'assessments' | 'matrix' | 'grading'>('assessments');
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>([]);
  const [gradingRules, setGradingRules] = useState<GradingRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Default CBSE Secondary 8-Point Scale
  const defaultRules: GradingRule[] = [
    { id: '1', grade_name: 'A1', min_score: 91, max_score: 100, points: 10.0, remarks: 'Top 1/8th Outstanding' },
    { id: '2', grade_name: 'A2', min_score: 81, max_score: 90, points: 9.0, remarks: 'Next 1/8th Excellent' },
    { id: '3', grade_name: 'B1', min_score: 71, max_score: 80, points: 8.0, remarks: 'Next 1/8th Very Good' },
    { id: '4', grade_name: 'B2', min_score: 61, max_score: 70, points: 7.0, remarks: 'Next 1/8th Good' },
    { id: '5', grade_name: 'C1', min_score: 51, max_score: 60, points: 6.0, remarks: 'Next 1/8th Satisfactory' },
    { id: '6', grade_name: 'C2', min_score: 41, max_score: 50, points: 5.0, remarks: 'Next 1/8th Fair' },
    { id: '7', grade_name: 'D', min_score: 33, max_score: 40, points: 4.0, remarks: 'Pass Standard' },
    { id: '8', grade_name: 'E', min_score: 0, max_score: 32.9, points: 0.0, remarks: 'Essential Repeat' }
  ];

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [assessRes, gradesRes] = await Promise.all([
        supabase.from('assessment_types').select('*').order('display_order', { ascending: true }),
        supabase.from('grading_rules').select('*').order('min_score', { ascending: false })
      ]);

      if (assessRes.data && assessRes.data.length > 0) {
        setAssessmentTypes(assessRes.data);
      }

      if (gradesRes.data && gradesRes.data.length > 0) {
        setGradingRules(gradesRes.data);
      } else {
        setGradingRules(defaultRules);
      }
    } catch (err) {
      console.error(err);
      setGradingRules(defaultRules);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssessmentChange = (index: number, field: keyof AssessmentType, value: any) => {
    setAssessmentTypes(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSaveAssessmentTypes = async () => {
    setIsSaving(true);
    const toastId = toast.loading('Saving CBSE Assessment Types & Policies...');
    try {
      const { error } = await supabase
        .from('assessment_types')
        .upsert(assessmentTypes.map(a => ({
          code: a.code,
          name: a.name,
          description: a.description,
          stage_category: a.stage_category,
          default_weightage: Number(a.default_weightage || 0),
          is_board_exam: Boolean(a.is_board_exam),
          display_order: Number(a.display_order || 1)
        })), { onConflict: 'code' });

      if (error) throw error;
      toast.success('Assessment configuration saved to database!', { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to save assessment types: ' + err.message, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGradingRules = async () => {
    setIsSaving(true);
    const toastId = toast.loading('Saving CBSE Grading Rules...');
    try {
      const payload = gradingRules.map(r => ({
        grade_name: r.grade_name,
        min_score: Number(r.min_score),
        max_score: Number(r.max_score),
        points: Number(r.points),
        remarks: r.remarks
      }));

      await supabase.from('grading_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      const { error } = await supabase.from('grading_rules').insert(payload);
      if (error) throw error;

      toast.success('Grading rules successfully updated!', { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to save grading rules: ' + err.message, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-[20px] border border-slate-200/60 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Scale className="w-4 h-4 text-violet-600" />
            CBSE Examination, Assessment Hierarchy &amp; Policy
          </h3>
          <p className="text-slate-400 text-xs mt-0.5">Canonical CBSE assessment tiers, class-wise evaluation matrices, and 8-point grading scales</p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={activeTab === 'grading' ? handleSaveGradingRules : handleSaveAssessmentTypes}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 h-[36px] bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-violet-500/15 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Save size={14} />
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* 2. Sub-Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { id: 'assessments', label: 'CBSE Assessment Catalog', icon: Layers },
          { id: 'matrix', label: 'Class Assessment Matrix (1-12)', icon: Calendar },
          { id: 'grading', label: 'Grading Scales & Passing Rules', icon: Award },
        ].map(t => {
          const Icon = t.icon;
          const isSelected = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                isSelected ? "bg-white text-violet-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Icon size={13} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: ASSESSMENT CATALOG */}
      {activeTab === 'assessments' && (
        <div className="space-y-4">
          <div className="bg-white rounded-[22px] border border-slate-200/60 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Configured CBSE Assessment Types</h4>
                <p className="text-slate-400 text-[10px]">Assessment categories dynamically instantiated across Academic Years</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[9.5px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Assessment Name</th>
                    <th className="py-3 px-4">Applicable Stages</th>
                    <th className="py-3 px-4 text-center">Annual Weightage (%)</th>
                    <th className="py-3 px-4 text-center">Type</th>
                    <th className="py-3 px-4">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                  {assessmentTypes.map((a, idx) => (
                    <tr key={a.id || idx} className="hover:bg-slate-50/40">
                      <td className="py-3 px-4 font-mono font-bold text-violet-700">{a.code}</td>
                      <td className="py-3 px-4">
                        <input 
                          type="text"
                          value={a.name}
                          onChange={(e) => handleAssessmentChange(idx, 'name', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-lg px-2.5 py-1 font-bold text-slate-900 text-xs outline-none"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={a.stage_category}
                          onChange={(e) => handleAssessmentChange(idx, 'stage_category', e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none"
                        >
                          <option value="all">All Classes (1-12)</option>
                          <option value="primary">Primary (1-5)</option>
                          <option value="middle">Middle (6-8)</option>
                          <option value="secondary">Secondary (9-10)</option>
                          <option value="senior_secondary">Senior Secondary (11-12)</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input 
                          type="number"
                          value={a.default_weightage}
                          onChange={(e) => handleAssessmentChange(idx, 'default_weightage', Number(e.target.value))}
                          className="w-16 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg px-2 py-1 font-mono text-center text-xs outline-none"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                          a.is_board_exam ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                        )}>
                          {a.is_board_exam ? 'Board Exam' : 'School Exam'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate">{a.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLASS ASSESSMENT MATRIX */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          <div className="bg-white rounded-[22px] border border-slate-200/60 p-6 shadow-2xs space-y-4">
            <div>
              <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">CBSE Class Assessment Progression Matrix</h4>
              <p className="text-slate-400 text-xs">Standard academic year assessment schedule across school stages</p>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Stage &amp; Classes</th>
                    <th className="py-3 px-3 text-center">Periodic Test 1</th>
                    <th className="py-3 px-3 text-center">Mid-Term Exam</th>
                    <th className="py-3 px-3 text-center">Periodic Test 2</th>
                    <th className="py-3 px-3 text-center">Pre-Board I / II</th>
                    <th className="py-3 px-3 text-center">Annual / Board Exam</th>
                    <th className="py-3 px-3 text-center">Internal Assessment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      Primary (Classes 1–5)
                      <span className="block text-[10px] text-slate-400 font-normal">Foundational CCE Assessment</span>
                    </td>
                    <td className="text-center text-emerald-600 font-black">✓ (PT-1)</td>
                    <td className="text-center text-emerald-600 font-black">✓ (Term 1)</td>
                    <td className="text-center text-emerald-600 font-black">✓ (PT-2)</td>
                    <td className="text-center text-slate-300">—</td>
                    <td className="text-center text-violet-700 font-black">✓ (Term 2)</td>
                    <td className="text-center text-indigo-600 font-bold">Continuous</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      Middle (Classes 6–8)
                      <span className="block text-[10px] text-slate-400 font-normal">Uniform CBSE Assessment Structure</span>
                    </td>
                    <td className="text-center text-emerald-600 font-black">✓ (PT-1)</td>
                    <td className="text-center text-emerald-600 font-black">✓ (Half-Yearly)</td>
                    <td className="text-center text-emerald-600 font-black">✓ (PT-2)</td>
                    <td className="text-center text-slate-300">—</td>
                    <td className="text-center text-violet-700 font-black">✓ (Annual Exam)</td>
                    <td className="text-center text-indigo-600 font-bold">20 Marks (PT+MA+PF+SE)</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      Secondary (Class 9)
                      <span className="block text-[10px] text-slate-400 font-normal">Pre-Board Preparation Foundation</span>
                    </td>
                    <td className="text-center text-emerald-600 font-black">✓ (PT-1)</td>
                    <td className="text-center text-emerald-600 font-black">✓ (Mid-Term)</td>
                    <td className="text-center text-emerald-600 font-black">✓ (PT-2)</td>
                    <td className="text-center text-slate-300">—</td>
                    <td className="text-center text-violet-700 font-black">✓ (Annual Exam)</td>
                    <td className="text-center text-indigo-600 font-bold">20 Marks CBSE</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 bg-amber-50/30">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      Secondary (Class 10 - Board)
                      <span className="block text-[10px] text-amber-700 font-bold">AISSE Board Examination Year</span>
                    </td>
                    <td className="text-center text-emerald-600 font-black">✓ (PT-1)</td>
                    <td className="text-center text-emerald-600 font-black">✓ (Mid-Term)</td>
                    <td className="text-center text-emerald-600 font-black">✓ (PT-2)</td>
                    <td className="text-center text-amber-700 font-black">✓ (Pre-Board I &amp; II)</td>
                    <td className="text-center text-amber-800 font-black">CBSE AISSE Board</td>
                    <td className="text-center text-indigo-600 font-bold">20 Marks CBSE</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      Senior Secondary (Class 11)
                      <span className="block text-[10px] text-slate-400 font-normal">Stream Specific (Sci/Comm/Arts)</span>
                    </td>
                    <td className="text-center text-emerald-600 font-black">✓ (Unit Test 1)</td>
                    <td className="text-center text-emerald-600 font-black">✓ (Mid-Term)</td>
                    <td className="text-center text-emerald-600 font-black">✓ (Unit Test 2)</td>
                    <td className="text-center text-slate-300">—</td>
                    <td className="text-center text-violet-700 font-black">✓ (Annual Exam)</td>
                    <td className="text-center text-indigo-600 font-bold">Theory 70/80 + Prac 30/20</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 bg-amber-50/30">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      Senior Secondary (Class 12 - Board)
                      <span className="block text-[10px] text-amber-700 font-bold">AISSCE Board Examination Year</span>
                    </td>
                    <td className="text-center text-emerald-600 font-black">✓ (Unit Test 1)</td>
                    <td className="text-center text-emerald-600 font-black">✓ (Half-Yearly)</td>
                    <td className="text-center text-emerald-600 font-black">✓ (Unit Test 2)</td>
                    <td className="text-center text-amber-700 font-black">✓ (Pre-Board I &amp; II)</td>
                    <td className="text-center text-amber-800 font-black">CBSE AISSCE Board</td>
                    <td className="text-center text-indigo-600 font-bold">Theory 70/80 + Prac 30/20</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GRADING RULES */}
      {activeTab === 'grading' && (
        <div className="space-y-4">
          <div className="bg-white rounded-[22px] border border-slate-200/60 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">CBSE 8-Point Grading Scale Matrix</h4>
                <p className="text-slate-400 text-[10px]">Applied automatically by the calculation engine and report card generators</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[9.5px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="py-3 px-5">Grade Symbol</th>
                    <th className="py-3 px-4 text-center">Min Score (%)</th>
                    <th className="py-3 px-4 text-center">Max Score (%)</th>
                    <th className="py-3 px-4 text-center">Grade Point</th>
                    <th className="py-3 px-4">Performance Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/70 text-slate-700 font-semibold">
                  {gradingRules.map((rule, idx) => (
                    <tr key={rule.id || idx} className="hover:bg-slate-50/40">
                      <td className="py-2.5 px-5 font-black text-violet-700">{rule.grade_name}</td>
                      <td className="py-2.5 px-4 text-center font-mono">{rule.min_score}%</td>
                      <td className="py-2.5 px-4 text-center font-mono">{rule.max_score}%</td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-900">{rule.points}</td>
                      <td className="py-2.5 px-4 text-slate-600">{rule.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
