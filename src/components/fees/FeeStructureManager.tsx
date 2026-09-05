import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building, Plus, Edit2, Check, X, RefreshCcw, 
  Settings, Layers, AlertTriangle, Loader2, Save, Sparkles 
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { feeService } from '@/services/feeService';
import { FeeCategory, FeeStructureItem } from '@/types/fee';

interface FeeStructureManagerProps {
  classes: { id: string; class_name: string }[];
  academicYears: { id: string; name: string }[];
  currentAcademicYear?: { id: string; name: string } | null;
}

const DEFAULT_CBSE_HEADS = [
  { category_name: 'Tuition Fee', frequency: 'Monthly', amount: 3500, description: 'Academic instruction and classroom tuition' },
  { category_name: 'Admission Fee', frequency: 'One-time', amount: 5000, description: 'One-time registration & admission processing' },
  { category_name: 'Examination Fee', frequency: 'Term', amount: 1200, description: 'CBSE terminal & summative assessments' },
  { category_name: 'Computer & Lab Fee', frequency: 'Annual', amount: 2000, description: 'Science lab, computer lab & smart classroom tech' },
  { category_name: 'Annual Activity & Sports', frequency: 'Annual', amount: 1800, description: 'Sports, co-curricular and annual events' },
  { category_name: 'Transport Fee', frequency: 'Monthly', amount: 1500, description: 'School bus commute & fleet service' },
];

export default function FeeStructureManager({
  classes,
  academicYears,
  currentAcademicYear
}: FeeStructureManagerProps) {
  const [selectedYearId, setSelectedYearId] = useState<string>(currentAcademicYear?.id || '');
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [structures, setStructures] = useState<FeeStructureItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Partial<FeeCategory> | null>(null);
  const [catName, setCatName] = useState('');
  const [catFrequency, setCatFrequency] = useState('Monthly');
  const [catAmount, setCatAmount] = useState<number | ''>('');
  const [catDescription, setCatDescription] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Matrix Editing State: classId_categoryId -> amount
  const [matrixValues, setMatrixValues] = useState<Record<string, number>>({});
  const [isSavingMatrix, setIsSavingMatrix] = useState(false);

  useEffect(() => {
    if (currentAcademicYear?.id && !selectedYearId) {
      setSelectedYearId(currentAcademicYear.id);
    }
  }, [currentAcademicYear]);

  useEffect(() => {
    loadData();
  }, [selectedYearId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cats, structs] = await Promise.all([
        feeService.fetchFeeCategories(),
        feeService.fetchFeeStructures(selectedYearId || undefined)
      ]);
      setCategories(cats);
      setStructures(structs);

      // Populate matrix
      const map: Record<string, number> = {};
      structs.forEach(s => {
        map[`${s.class_id}_${s.fee_category_id}`] = Number(s.amount);
      });
      setMatrixValues(map);
    } catch (err) {
      console.error('[FeeStructureManager] Load failed:', err);
      toast.error('Failed to load fee configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCatName('');
    setCatFrequency('Monthly');
    setCatAmount('');
    setCatDescription('');
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: FeeCategory) => {
    setEditingCategory(cat);
    setCatName(cat.category_name);
    setCatFrequency(cat.frequency);
    setCatAmount(cat.amount || '');
    setCatDescription(cat.description || '');
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return toast.error('Category name is required.');

    setIsSavingCategory(true);
    toast.loading('Saving fee category...', { id: 'save-cat' });
    try {
      await feeService.saveFeeCategory({
        id: editingCategory?.id,
        category_name: catName.trim(),
        frequency: catFrequency,
        amount: typeof catAmount === 'number' ? catAmount : 0,
        description: catDescription.trim() || undefined,
        is_active: true
      });
      toast.success('Fee category saved successfully.', { id: 'save-cat' });
      setIsCategoryModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Save category error:', err);
      toast.error(err.message || 'Failed to save fee category.', { id: 'save-cat' });
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleSeedDefaultHeads = async () => {
    setIsSeeding(true);
    toast.loading('Adding standard CBSE fee categories...', { id: 'seed-heads' });
    try {
      const existingNames = new Set(categories.map(c => c.category_name.toLowerCase()));
      const toAdd = DEFAULT_CBSE_HEADS.filter(h => !existingNames.has(h.category_name.toLowerCase()));
      
      if (toAdd.length === 0) {
        toast.info('Standard fee heads already exist in your catalogue.', { id: 'seed-heads' });
        setIsSeeding(false);
        return;
      }

      for (const head of toAdd) {
        await feeService.saveFeeCategory({
          category_name: head.category_name,
          frequency: head.frequency,
          amount: head.amount,
          description: head.description,
          is_active: true
        });
      }

      toast.success(`Added ${toAdd.length} standard CBSE fee heads!`, { id: 'seed-heads' });
      loadData();
    } catch (err: any) {
      console.error('Seed error:', err);
      toast.error(err.message || 'Failed to seed fee heads.', { id: 'seed-heads' });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleMatrixCellChange = (classId: string, categoryId: string, val: number) => {
    setMatrixValues(prev => ({
      ...prev,
      [`${classId}_${categoryId}`]: val
    }));
  };

  const handleSaveAllMatrix = async () => {
    if (!selectedYearId) return toast.error('Select an academic session first.');

    setIsSavingMatrix(true);
    toast.loading('Saving class fee structure matrix...', { id: 'save-matrix' });
    try {
      const promises: Promise<void>[] = [];
      for (const cls of classes) {
        for (const cat of categories) {
          const key = `${cls.id}_${cat.id}`;
          const amount = matrixValues[key] ?? cat.amount;
          promises.push(
            feeService.saveFeeStructureItem({
              classId: cls.id,
              feeCategoryId: cat.id,
              academicYearId: selectedYearId,
              amount
            })
          );
        }
      }
      await Promise.all(promises);
      toast.success('Class fee structures saved successfully.', { id: 'save-matrix' });
      loadData();
    } catch (err: any) {
      console.error('Save matrix error:', err);
      toast.error(err.message || 'Failed to save fee structures.', { id: 'save-matrix' });
    } finally {
      setIsSavingMatrix(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Control Header Bar */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-violet-50 text-violet-600 rounded-2xl border border-violet-100">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-display font-black text-slate-900 tracking-tight">Fee Structure & Categories Master</h2>
            <p className="text-xs text-slate-500 font-medium">Define grade-wise fee structures per academic session and manage fee heads.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <select
            value={selectedYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            {academicYears.map(y => (
              <option key={y.id} value={y.id}>Session {y.name}</option>
            ))}
          </select>

          {categories.length <= 2 && (
            <button
              onClick={handleSeedDefaultHeads}
              disabled={isSeeding}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Add standard CBSE heads: Tuition, Admission, Exam, Lab, Sports, Transport"
            >
              <Sparkles className="w-3.5 h-3.5" /> Seed CBSE Heads
            </button>
          )}

          <button
            onClick={handleOpenAddCategory}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Fee Category
          </button>

          <button
            onClick={handleSaveAllMatrix}
            disabled={isSavingMatrix}
            className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-violet-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSavingMatrix ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Structure
          </button>
        </div>
      </div>

      {/* 2. Fee Categories Catalogue Cards */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-display font-black text-slate-800 uppercase tracking-wider">
            Fee Category Heads Catalogue ({categories.length})
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">Standard institutional billing components</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {categories.map(cat => (
            <div
              key={cat.id}
              className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-start justify-between shadow-2xs"
            >
              <div>
                <div className="font-bold text-xs text-slate-900">{cat.category_name}</div>
                <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                  Freq: <span className="font-bold text-slate-700">{cat.frequency}</span>
                </div>
                <div className="text-xs font-mono font-extrabold text-violet-700 mt-1">
                  Default: ₹{Number(cat.amount).toFixed(2)}
                </div>
              </div>

              <button
                onClick={() => handleOpenEditCategory(cat)}
                className="p-1.5 text-slate-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors cursor-pointer"
                title="Edit Category"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Grade-wise Fee Rate Matrix */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-xs font-display font-black text-slate-800 uppercase tracking-wider">
              Grade-Wise Fee Structure Matrix
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">Set the applicable fee amount for each grade and fee head.</p>
          </div>
          <span className="text-xs font-bold text-slate-500">{classes.length} Classes configured</span>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48">
            <Loader2 className="w-7 h-7 text-violet-600 animate-spin mb-2" />
            <span className="text-xs text-slate-500">Loading fee structure matrix...</span>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-black bg-slate-50/80">
                  <th className="py-3 px-4 w-40 text-left border-r border-slate-200/60">Class / Grade</th>
                  {categories.map(cat => (
                    <th key={cat.id} className="py-3 px-4 text-right min-w-[140px] border-r border-slate-200/60">
                      {cat.category_name} (₹)
                    </th>
                  ))}
                  <th className="py-3 px-4 text-right w-44 font-black text-slate-900 bg-slate-100/50">
                    Total Demand / Term (₹)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {classes.map(cls => {
                  let rowTotal = 0;
                  return (
                    <tr key={cls.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 border-r border-slate-100">
                        Class {cls.class_name}
                      </td>

                      {categories.map(cat => {
                        const key = `${cls.id}_${cat.id}`;
                        const currentVal = matrixValues[key] ?? cat.amount;
                        rowTotal += currentVal;

                        return (
                          <td key={cat.id} className="py-2.5 px-4 text-right border-r border-slate-100">
                            <div className="flex justify-end">
                              <input
                                type="number"
                                min="0"
                                step="50"
                                value={currentVal || ''}
                                placeholder="0.00"
                                onChange={(e) => handleMatrixCellChange(cls.id, cat.id, e.target.value === '' ? 0 : Number(e.target.value))}
                                className="w-28 text-right bg-white border border-slate-200 rounded-xl py-1.5 px-2.5 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 shadow-2xs transition-all"
                              />
                            </div>
                          </td>
                        );
                      })}

                      <td className="py-3 px-4 text-right font-mono font-extrabold text-violet-700 text-sm bg-slate-50/40">
                        ₹{rowTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Category Creation / Edit Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingCategory ? 'Edit Fee Category Head' : 'Create New Fee Category Head'}
              </h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Category Name</label>
                <input
                  type="text"
                  placeholder="e.g. Computer & Lab Fee"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Billing Frequency</label>
                  <select
                    value={catFrequency}
                    onChange={(e) => setCatFrequency(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Term">Per Term</option>
                    <option value="Annual">Annual</option>
                    <option value="One-time">One-time / Admission</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Base Default Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    placeholder="0.00"
                    value={catAmount}
                    onChange={(e) => setCatAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-mono font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Brief notes about this fee head"
                  value={catDescription}
                  onChange={(e) => setCatDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCategory}
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {isSavingCategory ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
