import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building, Plus, Edit2, Check, X, RefreshCcw, 
  Settings, Layers, AlertTriangle, Loader2, Save, Sparkles,
  Trash2, RotateCcw, HelpCircle, CheckCircle2, ChevronDown, Sliders
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
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
  const { role, can } = useAuth();
  const isAdmin = (role as string) === 'admin' || (role as string) === 'super_admin' || can('fees.manage');

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
  const [catIsActive, setCatIsActive] = useState(true);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Category Delete Confirmation Modal
  const [categoryToDelete, setCategoryToDelete] = useState<FeeCategory | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  // Class Reset Confirmation Modal
  const [classToReset, setClassToReset] = useState<{ id: string; class_name: string } | null>(null);
  const [isResettingClass, setIsResettingClass] = useState(false);

  // Quick Class Config Modal
  const [isQuickConfigOpen, setIsQuickConfigOpen] = useState(false);
  const [quickConfigClassId, setQuickConfigClassId] = useState<string>('');
  const [quickConfigAmounts, setQuickConfigAmounts] = useState<Record<string, number>>({});

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
    setCatIsActive(true);
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: FeeCategory) => {
    setEditingCategory(cat);
    setCatName(cat.category_name);
    setCatFrequency(cat.frequency);
    setCatAmount(cat.amount || '');
    setCatDescription(cat.description || '');
    setCatIsActive(cat.is_active !== false);
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
        is_active: catIsActive
      });
      toast.success(editingCategory?.id ? 'Fee category updated successfully.' : 'New fee category created successfully.', { id: 'save-cat' });
      setIsCategoryModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Save category error:', err);
      toast.error(err.message || 'Failed to save fee category.', { id: 'save-cat' });
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setIsDeletingCategory(true);
    toast.loading(`Deleting fee category ${categoryToDelete.category_name}...`, { id: 'del-cat' });
    try {
      const result = await feeService.deleteFeeCategory(categoryToDelete.id);
      if (result.deactivated) {
        toast.info(result.message, { id: 'del-cat', duration: 5000 });
      } else {
        toast.success('Fee category deleted successfully.', { id: 'del-cat' });
      }
      setCategoryToDelete(null);
      loadData();
    } catch (err: any) {
      console.error('Delete category error:', err);
      toast.error(err.message || 'Failed to delete fee category.', { id: 'del-cat' });
    } finally {
      setIsDeletingCategory(false);
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

  // 1-Click apply category default amounts to a single class
  const handleApplyDefaultsToClass = (classId: string) => {
    setMatrixValues(prev => {
      const updated = { ...prev };
      categories.forEach(cat => {
        updated[`${classId}_${cat.id}`] = Number(cat.amount || 0);
      });
      return updated;
    });
    toast.success('Populated default base rates for class.');
  };

  // 1-Click clear all rates for a single class
  const handleClearClassRates = async (cls: { id: string; class_name: string }) => {
    setIsResettingClass(true);
    toast.loading(`Clearing fee structure for Class ${cls.class_name}...`, { id: 'clear-cls' });
    try {
      await feeService.deleteClassFeeStructure(cls.id, selectedYearId);
      setMatrixValues(prev => {
        const updated = { ...prev };
        categories.forEach(cat => {
          updated[`${cls.id}_${cat.id}`] = 0;
        });
        return updated;
      });
      toast.success(`Fee structure cleared for Class ${cls.class_name}.`, { id: 'clear-cls' });
      setClassToReset(null);
      loadData();
    } catch (err: any) {
      console.error('Clear class fee structure error:', err);
      toast.error(err.message || 'Failed to clear class fee structure.', { id: 'clear-cls' });
    } finally {
      setIsResettingClass(false);
    }
  };

  const handleSaveAllMatrix = async () => {
    if (!selectedYearId) return toast.error('Select an academic session first.');

    setIsSavingMatrix(true);
    toast.loading('Saving class fee structure matrix...', { id: 'save-matrix' });
    try {
      const itemsToSave: { classId: string; feeCategoryId: string; academicYearId: string; amount: number }[] = [];
      for (const cls of classes) {
        for (const cat of categories) {
          const key = `${cls.id}_${cat.id}`;
          const amount = matrixValues[key] ?? cat.amount;
          itemsToSave.push({
            classId: cls.id,
            feeCategoryId: cat.id,
            academicYearId: selectedYearId,
            amount: Number(amount || 0)
          });
        }
      }
      await feeService.saveBatchFeeStructures(itemsToSave);
      toast.success('Class fee structures saved successfully.', { id: 'save-matrix' });
      loadData();
    } catch (err: any) {
      console.error('Save matrix error:', err);
      toast.error(err.message || 'Failed to save fee structures.', { id: 'save-matrix' });
    } finally {
      setIsSavingMatrix(false);
    }
  };

  const handleOpenQuickConfig = (classId?: string) => {
    const targetClassId = classId || classes[0]?.id || '';
    setQuickConfigClassId(targetClassId);
    
    // Prefill amounts from matrix or defaults
    const amounts: Record<string, number> = {};
    categories.forEach(cat => {
      const key = `${targetClassId}_${cat.id}`;
      amounts[cat.id] = matrixValues[key] !== undefined ? matrixValues[key] : Number(cat.amount || 0);
    });
    setQuickConfigAmounts(amounts);
    setIsQuickConfigOpen(true);
  };

  const handleSaveQuickConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickConfigClassId || !selectedYearId) return toast.error('Class and session are required.');

    toast.loading('Applying class fee structure...', { id: 'save-quick' });
    try {
      const items = categories.map(cat => ({
        classId: quickConfigClassId,
        feeCategoryId: cat.id,
        academicYearId: selectedYearId,
        amount: Number(quickConfigAmounts[cat.id] || 0)
      }));

      await feeService.saveBatchFeeStructures(items);
      toast.success('Class fee structure updated successfully.', { id: 'save-quick' });
      setIsQuickConfigOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update class fee structure.', { id: 'save-quick' });
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* 1. Control Header Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-sans text-slate-900 tracking-tight">Fee Structure & Categories Master</h2>
            <p className="text-xs text-slate-500 font-normal mt-0.5">Define grade-wise fee structures per academic session, create fee heads, and configure tuition rates.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <select
            value={selectedYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-800 outline-none cursor-pointer"
          >
            {academicYears.map(y => (
              <option key={y.id} value={y.id}>Session {y.name}</option>
            ))}
          </select>

          {categories.length <= 2 && (
            <button
              onClick={handleSeedDefaultHeads}
              disabled={isSeeding}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Add standard CBSE heads: Tuition, Admission, Exam, Lab, Sports, Transport"
            >
              <Sparkles className="w-3.5 h-3.5" /> Seed CBSE Heads
            </button>
          )}

          {isAdmin && (
            <button
              onClick={handleOpenAddCategory}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-blue-600" /> Create Fee Head
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => handleOpenQuickConfig()}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl border border-blue-200/80 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Sliders className="w-3.5 h-3.5" /> Configure Class
            </button>
          )}

          <button
            onClick={handleSaveAllMatrix}
            disabled={isSavingMatrix}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            {isSavingMatrix ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Structure
          </button>
        </div>
      </div>

      {/* 2. Fee Categories Catalogue Cards */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-sans text-slate-800 uppercase tracking-wider">
              Fee Category Heads Catalogue ({categories.length})
            </span>
            <span className="text-[11px] font-normal text-slate-400">Institutional billing components</span>
          </div>
          {isAdmin && (
            <button
              onClick={handleOpenAddCategory}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add New Head
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {categories.map(cat => (
            <div
              key={cat.id}
              className={cn(
                "p-4 rounded-2xl border transition-all flex flex-col justify-between shadow-2xs group relative bg-white",
                cat.is_active === false 
                  ? "border-slate-200 bg-slate-50/70 opacity-70" 
                  : "border-slate-200/90 hover:border-blue-300 hover:shadow-xs"
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-xs text-slate-900 font-sans leading-tight">
                    {cat.category_name}
                  </div>
                  {cat.is_active === false && (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 font-normal mt-1 flex items-center gap-1.5">
                  <span>Frequency:</span>
                  <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                    {cat.frequency}
                  </span>
                </div>

                {cat.description && (
                  <p className="text-[11px] text-slate-400 font-normal mt-1.5 line-clamp-1" title={cat.description}>
                    {cat.description}
                  </p>
                )}
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-normal block">Base Default</span>
                  <span className="text-xs font-bold font-sans tabular-nums text-blue-700">
                    ₹{Number(cat.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditCategory(cat)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                      title="Edit Category"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setCategoryToDelete(cat)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete / Deactivate Category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Grade-wise Fee Rate Matrix */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <span className="text-xs font-bold font-sans text-slate-800 uppercase tracking-wider block">
              Grade-Wise Fee Structure Matrix
            </span>
            <p className="text-[11px] text-slate-400 font-normal mt-0.5">Set the applicable billing rates for each grade and fee category in Session {academicYears.find(y => y.id === selectedYearId)?.name || 'Current'}.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500">{classes.length} Classes configured</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48">
            <Loader2 className="w-7 h-7 text-blue-600 animate-spin mb-2" />
            <span className="text-xs text-slate-500 font-medium">Loading fee structure matrix...</span>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-bold bg-slate-50/80">
                  <th className="py-3 px-4 w-44 text-left border-r border-slate-200/60 font-sans">Class / Grade</th>
                  {categories.map(cat => (
                    <th key={cat.id} className="py-3 px-4 text-right min-w-[140px] border-r border-slate-200/60 font-sans">
                      <div className="font-bold text-slate-700">{cat.category_name}</div>
                      <div className="text-[9px] text-slate-400 font-normal lowercase">({cat.frequency})</div>
                    </th>
                  ))}
                  <th className="py-3 px-4 text-right w-44 font-bold text-slate-900 bg-slate-100/50 font-sans">
                    Total Demand / Term
                  </th>
                  {isAdmin && (
                    <th className="py-3 px-3 text-center w-28 font-bold text-slate-500 font-sans">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {classes.map(cls => {
                  let rowTotal = 0;
                  return (
                    <tr key={cls.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 border-r border-slate-100 font-sans">
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
                                className="w-28 text-right bg-white border border-slate-200 rounded-xl py-1.5 px-2.5 text-xs font-sans font-bold tabular-nums text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 shadow-2xs transition-all"
                              />
                            </div>
                          </td>
                        );
                      })}

                      <td className="py-3 px-4 text-right font-sans font-bold tabular-nums text-blue-700 text-sm bg-slate-50/40">
                        ₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {isAdmin && (
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleApplyDefaultsToClass(cls.id)}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer"
                              title="Fill Base Defaults"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setClassToReset(cls)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete / Clear Class Fee Structure"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs font-sans">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-sans">
                  {editingCategory ? 'Edit Fee Category Head' : 'Create New Fee Category Head'}
                </h3>
                <p className="text-xs text-slate-400 font-normal">Define institutional billing fee component.</p>
              </div>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Category Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Computer & Lab Fee"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Billing Frequency</label>
                  <select
                    value={catFrequency}
                    onChange={(e) => setCatFrequency(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Term">Per Term / Term-wise</option>
                    <option value="Annual">Annual</option>
                    <option value="One-time">One-time / Admission</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Default Base Rate (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    placeholder="0.00"
                    value={catAmount}
                    onChange={(e) => setCatAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-sans font-bold tabular-nums text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Brief notes regarding this fee head (e.g. includes lab manuals and smart class access)"
                  value={catDescription}
                  onChange={(e) => setCatDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none resize-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="cat-active-toggle"
                  checked={catIsActive}
                  onChange={(e) => setCatIsActive(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                />
                <label htmlFor="cat-active-toggle" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Active (Visible in student fee invoices and structure matrix)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCategory}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingCategory && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs font-sans">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-sans">Delete Fee Category</h3>
                <p className="text-xs text-slate-500 font-normal">Confirm removal of fee component</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              Are you sure you want to delete <strong className="text-slate-900 font-bold">"{categoryToDelete.category_name}"</strong>?
              If student fee invoices exist for this category, it will be safely deactivated to protect historical audit records.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                disabled={isDeletingCategory}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCategory}
                disabled={isDeletingCategory}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isDeletingCategory && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Class Structure Confirmation Modal */}
      {classToReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs font-sans">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-sans">Clear Class Fee Structure</h3>
                <p className="text-xs text-slate-500 font-normal">Reset rates for Class {classToReset.class_name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              Are you sure you want to clear all configured fee rates for <strong className="text-slate-900 font-bold">Class {classToReset.class_name}</strong> in Session {academicYears.find(y => y.id === selectedYearId)?.name || 'Current'}?
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setClassToReset(null)}
                disabled={isResettingClass}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleClearClassRates(classToReset)}
                disabled={isResettingClass}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isResettingClass && <Loader2 className="w-4 h-4 animate-spin" />}
                Clear Class Rates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Configure Class Modal */}
      {isQuickConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs font-sans">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-sans">
                  Configure Class Fee Structure
                </h3>
                <p className="text-xs text-slate-400 font-normal">Set all fee head amounts for a selected grade at once.</p>
              </div>
              <button onClick={() => setIsQuickConfigOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickConfig} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Target Class *</label>
                <select
                  value={quickConfigClassId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setQuickConfigClassId(id);
                    const amounts: Record<string, number> = {};
                    categories.forEach(cat => {
                      const key = `${id}_${cat.id}`;
                      amounts[cat.id] = matrixValues[key] !== undefined ? matrixValues[key] : Number(cat.amount || 0);
                    });
                    setQuickConfigAmounts(amounts);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>Class {cls.class_name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2.5">
                <label className="font-semibold text-slate-700 block">Fee Categories & Rates (INR)</label>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl p-3 bg-slate-50/50 space-y-2">
                  {categories.map(cat => (
                    <div key={cat.id} className="pt-2 first:pt-0 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-bold text-slate-800 text-xs block">{cat.category_name}</span>
                        <span className="text-[10px] text-slate-400">Freq: {cat.frequency} • Default: ₹{Number(cat.amount).toFixed(2)}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          value={quickConfigAmounts[cat.id] ?? ''}
                          placeholder="0.00"
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : Number(e.target.value);
                            setQuickConfigAmounts(prev => ({ ...prev, [cat.id]: val }));
                          }}
                          className="w-28 bg-white border border-slate-200 rounded-xl py-1 px-2.5 text-xs font-sans font-bold tabular-nums text-slate-900 text-right outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const amounts: Record<string, number> = {};
                    categories.forEach(cat => { amounts[cat.id] = Number(cat.amount || 0); });
                    setQuickConfigAmounts(amounts);
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  Reset to Catalogue Defaults
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsQuickConfigOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    Apply & Save
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
