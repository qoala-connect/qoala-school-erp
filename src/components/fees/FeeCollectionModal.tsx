import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Check, Search, CreditCard, Banknote, Smartphone, 
  Building, Receipt, AlertCircle, Percent, Plus, Loader2,
  Users, UserCheck, Filter, ChevronDown, CheckCircle2, ShieldCheck, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { feeService } from '@/services/feeService';
import { FeeCategory, PaymentMode, CollectFeeResult, StudentFeeLedger } from '@/types/fee';

interface FeeCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  students?: any[];
  preSelectedStudent?: any;
  targetFeeLedger?: StudentFeeLedger | null;
  feeCategories: FeeCategory[];
  currentAcademicYear?: { id: string; name: string } | null;
  onPaymentSuccess: (result: CollectFeeResult, student: any) => void;
}

export default function FeeCollectionModal({
  isOpen,
  onClose,
  students: initialStudents = [],
  preSelectedStudent,
  targetFeeLedger,
  feeCategories,
  currentAcademicYear,
  onPaymentSuccess
}: FeeCollectionModalProps) {
  // All Students Roster
  const [allStudents, setAllStudents] = useState<any[]>(initialStudents);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  // Student Selection & Filters
  const [selectedStudent, setSelectedStudent] = useState<any>(
    targetFeeLedger?.students || preSelectedStudent || null
  );
  const [selectedLedger, setSelectedLedger] = useState<StudentFeeLedger | null>(
    targetFeeLedger || null
  );
  const [studentPendingInvoices, setStudentPendingInvoices] = useState<StudentFeeLedger[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  const [classFilter, setClassFilter] = useState('All');
  const [sectionFilter, setSectionFilter] = useState('All');
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentPicker, setShowStudentPicker] = useState(!preSelectedStudent && !targetFeeLedger);

  // Form Fields
  const [feeCategoryId, setFeeCategoryId] = useState<string>('');
  const [grossAmount, setGrossAmount] = useState<number | ''>('');
  const [discountAmount, setDiscountAmount] = useState<number | ''>('');
  const [fineAmount, setFineAmount] = useState<number | ''>('');
  const [payingAmount, setPayingAmount] = useState<number | ''>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [transactionId, setTransactionId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load all active students on modal open
  useEffect(() => {
    if (isOpen) {
      fetchActiveStudents();
    }
  }, [isOpen]);

  const fetchActiveStudents = async () => {
    setIsLoadingStudents(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, name, admission_number, roll_number, class, section, father_name, phone')
        .eq('status', 'active')
        .order('name');

      if (!error && data) {
        setAllStudents(data);
      }
    } catch (e) {
      console.warn('Student fetch failed, using props:', e);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  // Synchronize when targetFeeLedger or preSelectedStudent changes
  useEffect(() => {
    if (targetFeeLedger) {
      setSelectedLedger(targetFeeLedger);
      setSelectedStudent(targetFeeLedger.students || null);
      setShowStudentPicker(false);
      setFeeCategoryId(targetFeeLedger.fee_category_id);
      setGrossAmount(targetFeeLedger.total_amount);
      setDiscountAmount(targetFeeLedger.discount_amount || '');
      setFineAmount(targetFeeLedger.fine_amount || '');
      setPayingAmount(targetFeeLedger.remaining_amount);
      setDueDate(targetFeeLedger.due_date || '');
      setRemarks(`Settlement of ${targetFeeLedger.category_name}`);
    } else if (preSelectedStudent) {
      setSelectedStudent(preSelectedStudent);
      setSelectedLedger(null);
      setShowStudentPicker(false);
    } else {
      setSelectedStudent(null);
      setSelectedLedger(null);
      setShowStudentPicker(true);
    }
  }, [targetFeeLedger, preSelectedStudent, isOpen]);

  // Load pending invoices for the selected student
  useEffect(() => {
    if (!selectedStudent?.id) {
      setStudentPendingInvoices([]);
      return;
    }

    let cancelled = false;
    const loadInvoices = async () => {
      setIsLoadingInvoices(true);
      try {
        const fees = await feeService.fetchFees();
        if (cancelled) return;
        const pending = fees.filter(f => f.student_id === selectedStudent.id && f.remaining_amount > 0);
        setStudentPendingInvoices(pending);

        // If not already locked to a ledger, and only 1 invoice exists, auto-select it
        if (!selectedLedger && pending.length === 1 && !grossAmount) {
          applyLedger(pending[0]);
        }
      } catch (e) {
        console.warn('Could not load student invoices:', e);
      } finally {
        if (!cancelled) setIsLoadingInvoices(false);
      }
    };

    loadInvoices();
    return () => { cancelled = true; };
  }, [selectedStudent]);

  const applyLedger = (ledger: StudentFeeLedger) => {
    setSelectedLedger(ledger);
    setFeeCategoryId(ledger.fee_category_id);
    setGrossAmount(ledger.total_amount);
    setDiscountAmount(ledger.discount_amount || '');
    setFineAmount(ledger.fine_amount || '');
    setPayingAmount(ledger.remaining_amount);
    setDueDate(ledger.due_date || '');
    setRemarks(`Settlement of ${ledger.category_name}`);
  };

  const clearSelectedLedger = () => {
    setSelectedLedger(null);
    setGrossAmount('');
    setDiscountAmount('');
    setFineAmount('');
    setPayingAmount('');
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(10);
    setDueDate(nextMonth.toISOString().split('T')[0]);
    setRemarks('');
  };

  useEffect(() => {
    if (feeCategories.length > 0 && !feeCategoryId) {
      setFeeCategoryId(feeCategories[0].id);
    }
  }, [feeCategories, feeCategoryId]);

  // Default due date when creating new invoice
  useEffect(() => {
    if (!dueDate && isOpen && !selectedLedger) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(10);
      setDueDate(nextMonth.toISOString().split('T')[0]);
    }
  }, [isOpen, dueDate, selectedLedger]);

  // Unique Classes & Sections
  const availableClasses = useMemo(() => {
    const set = new Set(allStudents.map(s => s.class).filter(Boolean));
    return Array.from(set).sort((a: any, b: any) => (parseInt(a) || 0) - (parseInt(b) || 0));
  }, [allStudents]);

  const availableSections = useMemo(() => {
    const set = new Set(allStudents.map(s => s.section).filter(Boolean));
    return Array.from(set).sort();
  }, [allStudents]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    const s = studentSearch.toLowerCase().trim();
    return allStudents.filter(st => {
      const matchesClass = classFilter === 'All' || st.class === classFilter || `Class ${st.class}` === classFilter;
      const matchesSection = sectionFilter === 'All' || st.section === sectionFilter;
      const matchesSearch = !s || (
        (st.name && st.name.toLowerCase().includes(s)) ||
        (st.admission_number && st.admission_number.toLowerCase().includes(s)) ||
        (st.roll_number && st.roll_number.toLowerCase().includes(s)) ||
        (st.father_name && st.father_name.toLowerCase().includes(s)) ||
        (st.phone && st.phone.includes(s))
      );
      return matchesClass && matchesSection && matchesSearch;
    });
  }, [allStudents, classFilter, sectionFilter, studentSearch]);

  // Computed net amount
  const numGross = typeof grossAmount === 'number' ? grossAmount : 0;
  const numDiscount = typeof discountAmount === 'number' ? discountAmount : 0;
  const numFine = typeof fineAmount === 'number' ? fineAmount : 0;
  const netPayable = Math.max(0, numGross + numFine - numDiscount);
  const numPaying = typeof payingAmount === 'number' ? payingAmount : 0;
  const balanceAfterPayment = Math.max(0, (selectedLedger ? selectedLedger.remaining_amount : netPayable) - numPaying);

  const handleSelectStudent = (st: any) => {
    setSelectedStudent(st);
    setSelectedLedger(null);
    setShowStudentPicker(false);
  };

  const handleGrossChange = (valStr: string) => {
    if (valStr === '') {
      setGrossAmount('');
      setPayingAmount('');
      return;
    }
    const val = Number(valStr);
    setGrossAmount(val);
    const newNet = Math.max(0, val + numFine - numDiscount);
    setPayingAmount(newNet);
  };

  const handleDiscountChange = (valStr: string) => {
    if (valStr === '') {
      setDiscountAmount('');
      const newNet = Math.max(0, numGross + numFine);
      setPayingAmount(newNet);
      return;
    }
    const val = Number(valStr);
    setDiscountAmount(val);
    const newNet = Math.max(0, numGross + numFine - val);
    setPayingAmount(newNet);
  };

  const handleFineChange = (valStr: string) => {
    if (valStr === '') {
      setFineAmount('');
      const newNet = Math.max(0, numGross - numDiscount);
      setPayingAmount(newNet);
      return;
    }
    const val = Number(valStr);
    setFineAmount(val);
    const newNet = Math.max(0, numGross + val - numDiscount);
    setPayingAmount(newNet);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!selectedStudent) {
      toast.error('Please select a student for payment.');
      return;
    }
    if (!feeCategoryId) {
      toast.error('Please select a fee category head.');
      return;
    }
    if (!numPaying || numPaying <= 0) {
      toast.error('Please enter a payment amount greater than zero.');
      return;
    }

    setIsSubmitting(true);
    toast.loading('Processing fee collection & receipt generation...', { id: 'collect-fee' });

    try {
      const result = await feeService.collectFee({
        studentFeeId: selectedLedger?.id || undefined,
        studentId: selectedStudent.id,
        feeCategoryId,
        academicYearId: currentAcademicYear?.id || selectedLedger?.academic_year_id,
        amount: numPaying,
        paymentMode,
        totalAmount: numGross || numPaying,
        discountAmount: numDiscount,
        fineAmount: numFine,
        dueDate: dueDate || undefined,
        transactionId: transactionId.trim() || undefined,
        remarks: remarks.trim() || undefined
      });

      toast.success(
        `Receipt ${result.receiptNumber} issued! Paid ₹${result.amountPaid.toFixed(2)}, Balance ₹${result.balance.toFixed(2)}`,
        { id: 'collect-fee' }
      );

      onPaymentSuccess(result, selectedStudent);
      onClose();
    } catch (err: any) {
      console.error('[FeeCollectionModal] Error:', err);
      toast.error(
        err.code === '42501'
          ? 'You do not have permission to collect fees.'
          : err.message || 'Failed to record payment.',
        { id: 'collect-fee' }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] my-auto">
        
        {/* 1. Fixed Header */}
        <div className="shrink-0 p-5 border-b border-slate-100 flex items-center justify-between bg-white rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-display font-black text-slate-900">
                {selectedLedger ? 'Settle Outstanding Fee Due' : 'Fee Collection & Cashier Desk'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {selectedLedger 
                  ? `Direct settlement for ${selectedLedger.category_name} (Outstanding Due: ₹${selectedLedger.remaining_amount.toFixed(2)})`
                  : 'Record fee payment, issue sequential receipt, and update student balance.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Scrollable Body */}
        <form id="fee-collection-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* A. Student Selector & Filter Section */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-violet-600" />
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">Select Student</label>
              </div>

              {selectedStudent && (
                <button
                  type="button"
                  onClick={() => setShowStudentPicker(p => !p)}
                  className="text-xs font-bold text-violet-600 hover:text-violet-800 underline cursor-pointer"
                >
                  {showStudentPicker ? 'Hide Student List' : 'Change Student'}
                </button>
              )}
            </div>

            {/* Selected Student Active Card */}
            {selectedStudent && !showStudentPicker ? (
              <div className="bg-white p-3.5 rounded-xl border border-violet-200 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    {selectedStudent.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{selectedStudent.name}</div>
                    <div className="text-[11px] text-slate-500">
                      Class <strong className="text-slate-700">{selectedStudent.class}-{selectedStudent.section}</strong> • ADM: <span className="font-mono font-bold text-violet-700">{selectedStudent.admission_number || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 block">
                    Student Selected
                  </span>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                    Father: {selectedStudent.father_name || 'N/A'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Class & Section Filter Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Filter by Class</label>
                    <select
                      value={classFilter}
                      onChange={(e) => setClassFilter(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl py-1.5 px-2.5 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                    >
                      <option value="All">All Classes ({availableClasses.length})</option>
                      {availableClasses.map(c => (
                        <option key={c} value={c}>Class {c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Filter by Section</label>
                    <select
                      value={sectionFilter}
                      onChange={(e) => setSectionFilter(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl py-1.5 px-2.5 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                    >
                      <option value="All">All Sections</option>
                      {availableSections.map(s => (
                        <option key={s} value={s}>Section {s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Search Student</label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                      <input
                        type="text"
                        placeholder="Name, ADM, Roll..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl py-1.5 pl-8 pr-2 text-xs font-medium text-slate-800 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Student Selection Roster List */}
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl">
                  {isLoadingStudents ? (
                    <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-violet-600" /> Loading active students roster...
                    </div>
                  ) : filteredStudents.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No active students found matching class/search criteria.
                    </div>
                  ) : (
                    filteredStudents.map(st => (
                      <div
                        key={st.id}
                        onClick={() => handleSelectStudent(st)}
                        className={cn(
                          "p-2.5 flex items-center justify-between hover:bg-violet-50/70 transition-colors cursor-pointer",
                          selectedStudent?.id === st.id && "bg-violet-50"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                            {st.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-xs text-slate-900">{st.name}</span>
                            <span className="text-[11px] text-slate-400 ml-2">Class {st.class}-{st.section}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded">
                            {st.admission_number || 'N/A'}
                          </span>
                          <span className="text-xs text-slate-400 font-bold">Select &rarr;</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* B. Target Outstanding Invoices Card (If student has pending dues) */}
          {selectedStudent && (
            <div className="bg-amber-50/50 border border-amber-200/80 p-3.5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Student Fee Obligations & Outstanding Dues ({studentPendingInvoices.length})</span>
                </div>
                {selectedLedger && (
                  <button
                    type="button"
                    onClick={clearSelectedLedger}
                    className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                  >
                    + Create New Charge Instead
                  </button>
                )}
              </div>

              {studentPendingInvoices.length > 0 ? (
                <div className="space-y-1.5">
                  {studentPendingInvoices.map(inv => (
                    <div
                      key={inv.id}
                      onClick={() => applyLedger(inv)}
                      className={cn(
                        "p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer",
                        selectedLedger?.id === inv.id
                          ? "bg-amber-100/80 border-amber-400 ring-2 ring-amber-400/30"
                          : "bg-white border-amber-200/60 hover:bg-amber-50"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{inv.category_name}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-800">
                            {inv.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                          Total Demand: ₹{inv.total_amount.toFixed(2)} • Paid: ₹{inv.amount_paid.toFixed(2)} • Due: {inv.due_date || 'N/A'}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-mono font-black text-rose-700">₹{inv.remaining_amount.toFixed(2)} Due</div>
                        <span className="text-[10px] font-bold text-amber-700 flex items-center gap-0.5 justify-end">
                          {selectedLedger?.id === inv.id ? 'Selected ✓' : 'Settle →'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> No overdue balances on record. Ready for advance/new collection.
                </p>
              )}
            </div>
          )}

          {/* C. Fee Category Head & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">Fee Category Head</label>
              <select
                value={feeCategoryId}
                onChange={(e) => setFeeCategoryId(e.target.value)}
                disabled={!!selectedLedger}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 cursor-pointer disabled:opacity-75"
              >
                {feeCategories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.category_name} ({c.frequency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={!!selectedLedger}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 cursor-pointer disabled:opacity-75"
              />
            </div>
          </div>

          {/* D. Amounts & Dynamic Calculations */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Gross Fee (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={grossAmount}
                  onChange={(e) => handleGrossChange(e.target.value)}
                  disabled={!!selectedLedger}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-900 font-mono outline-none focus:border-violet-500 disabled:opacity-75"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Discount / Concession (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={discountAmount}
                  onChange={(e) => handleDiscountChange(e.target.value)}
                  disabled={!!selectedLedger}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-emerald-700 font-mono outline-none focus:border-emerald-500 disabled:opacity-75"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Late Fine (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={fineAmount}
                  onChange={(e) => handleFineChange(e.target.value)}
                  disabled={!!selectedLedger}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-rose-700 font-mono outline-none focus:border-rose-500 disabled:opacity-75"
                />
              </div>
            </div>

            {/* Net Calculation Summary */}
            <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 text-xs">
              <span className="font-bold text-slate-600">
                {selectedLedger ? 'Outstanding Ledger Balance to Settle:' : 'Net Payable Total:'}
              </span>
              <span className="font-mono font-extrabold text-slate-900 text-sm">
                ₹{(selectedLedger ? selectedLedger.remaining_amount : netPayable).toFixed(2)}
              </span>
            </div>

            {/* Paying Amount Input & Quick Settle Buttons */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Amount Being Paid Today (₹)
                </label>
                {selectedLedger && (
                  <button
                    type="button"
                    onClick={() => setPayingAmount(selectedLedger.remaining_amount)}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 cursor-pointer"
                  >
                    Pay Full Balance (₹{selectedLedger.remaining_amount.toFixed(2)})
                  </button>
                )}
              </div>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Enter amount paying..."
                value={payingAmount}
                onChange={(e) => setPayingAmount(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-white border-2 border-violet-500 rounded-xl py-2 px-3 text-base font-extrabold text-violet-700 font-mono outline-none focus:ring-2 focus:ring-violet-500/20"
              />
              
              {/* Balance preview */}
              <div className="mt-1.5 flex items-center justify-between text-xs">
                {balanceAfterPayment === 0 && numPaying > 0 ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Full Settlement: Dues will be cleared to ₹0.00!
                  </span>
                ) : numPaying > 0 ? (
                  <span className="text-amber-700 font-bold">
                    Partial Payment: Balance ₹{balanceAfterPayment.toFixed(2)} will remain due.
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* E. Payment Mode & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">Payment Mode</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['cash', 'upi', 'bank', 'online'] as PaymentMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode)}
                    className={cn(
                      "py-2 px-1 text-center rounded-xl text-xs font-bold capitalize border transition-all cursor-pointer",
                      paymentMode === mode
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Transaction Ref / Cheque No
              </label>
              <input
                type="text"
                placeholder="e.g. UPI-930491823"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-mono font-medium text-slate-800 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">Cashier Remarks (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Term fee clearance, paid by father"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-medium text-slate-800 outline-none"
            />
          </div>

        </form>

        {/* 3. Fixed Footer with Actions */}
        <div className="shrink-0 p-4 border-t border-slate-100 bg-slate-50/70 rounded-b-3xl flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-2xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="fee-collection-form"
            disabled={isSubmitting || !numPaying || numPaying <= 0 || !selectedStudent}
            className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isSubmitting ? 'Recording...' : `Record Payment ${numPaying > 0 ? `of ₹${numPaying.toFixed(2)}` : ''}`}
          </button>
        </div>

      </div>
    </div>
  );
}
