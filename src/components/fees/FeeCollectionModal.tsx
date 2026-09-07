import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, Check, Search, CreditCard, Banknote, Smartphone, 
  Building, Receipt, AlertCircle, Loader2, User,
  CheckCircle2, Printer, Download, Eye, Copy, ArrowRight,
  RotateCcw, Calendar, FileText, ChevronRight,
  AlertTriangle, CheckSquare, Square
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { feeService } from '@/services/feeService';
import { FeeCategory, PaymentMode, CollectFeeResult, StudentFeeLedger, FeeReceiptData } from '@/types/fee';
import FeeReceiptModal from '@/components/fees/FeeReceiptModal';

interface FeeCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  students?: any[];
  preSelectedStudent?: any;
  targetFeeLedger?: StudentFeeLedger | null;
  feeCategories: FeeCategory[];
  currentAcademicYear?: { id: string; name: string } | null;
  onPaymentSuccess?: (
    result: CollectFeeResult, 
    student: any, 
    ledger?: StudentFeeLedger | null, 
    paymentMeta?: { paymentMode: string; transactionId?: string; remarks?: string; fineAmount?: number; discountAmount?: number }
  ) => void;
}

type CollectionStep = 'form' | 'confirm' | 'success';

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
  // Step state
  const [step, setStep] = useState<CollectionStep>('form');

  // Student directory & search
  const [allStudents, setAllStudents] = useState<any[]>(initialStudents);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Selected Student
  const [selectedStudent, setSelectedStudent] = useState<any>(
    targetFeeLedger?.students || preSelectedStudent || null
  );

  // Pending Fees
  const [studentInvoices, setStudentInvoices] = useState<StudentFeeLedger[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [selectedLedgerIds, setSelectedLedgerIds] = useState<Set<string>>(new Set());

  // Payment inputs
  const [payingAmount, setPayingAmount] = useState<number | ''>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [transactionId, setTransactionId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // Submission & Results
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastPaymentResult, setLastPaymentResult] = useState<CollectFeeResult | null>(null);
  const [lastReceiptData, setLastReceiptData] = useState<FeeReceiptData | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch active students catalogue on modal open
  useEffect(() => {
    if (isOpen) {
      fetchStudents();
    }
  }, [isOpen]);

  const fetchStudents = async () => {
    setIsLoadingStudents(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, name, admission_number, roll_number, class, section, father_name, phone, photo_url, academic_year')
        .eq('status', 'active')
        .order('name');

      if (!error && data) {
        setAllStudents(data);
      }
    } catch (e) {
      console.warn('Student fetch failed:', e);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  // Synchronize incoming props
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setLastPaymentResult(null);
      setLastReceiptData(null);
      setRemarks('');
      setTransactionId('');
      setPaymentMode('cash');
      setPaymentDate(new Date().toISOString().split('T')[0]);

      if (targetFeeLedger) {
        setSelectedStudent(targetFeeLedger.students || null);
        setSelectedLedgerIds(new Set([targetFeeLedger.id]));
        setPayingAmount(targetFeeLedger.remaining_amount);
      } else if (preSelectedStudent) {
        setSelectedStudent(preSelectedStudent);
      } else {
        setSelectedStudent(null);
        setSelectedLedgerIds(new Set());
        setPayingAmount('');
      }
    }
  }, [isOpen, targetFeeLedger, preSelectedStudent]);

  // Load pending fee ledgers for selected student
  useEffect(() => {
    if (!selectedStudent?.id) {
      setStudentInvoices([]);
      setSelectedLedgerIds(new Set());
      setPayingAmount('');
      return;
    }

    let isCancelled = false;
    const loadLedgers = async () => {
      setIsLoadingInvoices(true);
      try {
        const fees = await feeService.fetchFees();
        if (isCancelled) return;

        const rows = fees.filter(f => f.student_id === selectedStudent.id);
        setStudentInvoices(rows);

        if (targetFeeLedger && rows.some(r => r.id === targetFeeLedger.id)) {
          setSelectedLedgerIds(new Set([targetFeeLedger.id]));
          setPayingAmount(targetFeeLedger.remaining_amount);
        } else {
          // Auto-select all pending dues by default
          const pendingIds = rows.filter(r => r.remaining_amount > 0).map(r => r.id);
          const initialSet = new Set(pendingIds);
          setSelectedLedgerIds(initialSet);

          const totalPending = rows
            .filter(r => initialSet.has(r.id))
            .reduce((sum, r) => sum + Number(r.remaining_amount || 0), 0);

          setPayingAmount(totalPending > 0 ? Math.round(totalPending * 100) / 100 : '');
        }
      } catch (e) {
        console.warn('Error loading fees:', e);
      } finally {
        if (!isCancelled) setIsLoadingInvoices(false);
      }
    };

    loadLedgers();
    return () => { isCancelled = true; };
  }, [selectedStudent, targetFeeLedger]);

  // Search filter
  const searchResults = useMemo(() => {
    const s = studentSearch.toLowerCase().trim();
    if (!s) return allStudents.slice(0, 8);
    return allStudents.filter(st =>
      (st.name && st.name.toLowerCase().includes(s)) ||
      (st.admission_number && st.admission_number.toLowerCase().includes(s)) ||
      (st.roll_number && st.roll_number.toLowerCase().includes(s)) ||
      (st.father_name && st.father_name.toLowerCase().includes(s))
    ).slice(0, 15);
  }, [allStudents, studentSearch]);

  // Selected fee items
  const selectedInvoices = useMemo(() => {
    return studentInvoices.filter(inv => selectedLedgerIds.has(inv.id));
  }, [studentInvoices, selectedLedgerIds]);

  // Total Due of selected items
  const totalAmountDue = useMemo(() => {
    return selectedInvoices.reduce((sum, r) => sum + Number(r.remaining_amount || 0), 0);
  }, [selectedInvoices]);

  const numPaying = typeof payingAmount === 'number' ? payingAmount : 0;
  const remainingBalance = Math.max(0, totalAmountDue - numPaying);

  // Toggle selection
  const handleToggleLedger = (id: string) => {
    const next = new Set(selectedLedgerIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedLedgerIds(next);

    const newTotal = studentInvoices
      .filter(r => next.has(r.id))
      .reduce((sum, r) => sum + Number(r.remaining_amount || 0), 0);

    setPayingAmount(newTotal > 0 ? Math.round(newTotal * 100) / 100 : '');
  };

  const handleToggleAllLedgers = () => {
    const pendingRows = studentInvoices.filter(r => Number(r.remaining_amount || 0) > 0);
    if (selectedLedgerIds.size === pendingRows.length && pendingRows.length > 0) {
      setSelectedLedgerIds(new Set());
      setPayingAmount('');
    } else {
      const next = new Set(pendingRows.map(r => r.id));
      setSelectedLedgerIds(next);
      const sum = pendingRows.reduce((acc, r) => acc + Number(r.remaining_amount || 0), 0);
      setPayingAmount(sum > 0 ? Math.round(sum * 100) / 100 : '');
    }
  };

  const handleSelectStudent = (st: any) => {
    setSelectedStudent(st);
    setStudentSearch('');
    setIsSearchOpen(false);
  };

  const handleClearStudent = () => {
    setSelectedStudent(null);
    setSelectedLedgerIds(new Set());
    setPayingAmount('');
    setStudentInvoices([]);
    setStudentSearch('');
  };

  // Open confirmation modal
  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStudent) {
      toast.error('Please select a student.');
      return;
    }

    if (selectedInvoices.length === 0) {
      toast.error('Please select at least one pending fee.');
      return;
    }

    if (!numPaying || numPaying <= 0) {
      toast.error('Please enter a valid amount received.');
      return;
    }

    if (numPaying > totalAmountDue && totalAmountDue > 0) {
      toast.error(`Amount paying (₹${numPaying}) cannot exceed selected dues (₹${totalAmountDue}).`);
      return;
    }

    setStep('confirm');
  };

  // Execute Payment and save to DB
  const handleExecutePayment = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    toast.loading('Saving payment & issuing receipt...', { id: 'fee-pay' });

    try {
      let finalResult: CollectFeeResult | null = null;
      let remainingBudget = numPaying;

      for (const item of selectedInvoices) {
        if (remainingBudget <= 0) break;
        const due = Number(item.remaining_amount || 0);
        const alloc = Math.min(due, remainingBudget);
        if (alloc <= 0) continue;

        finalResult = await feeService.collectFee({
          studentFeeId: item.id,
          studentId: selectedStudent.id,
          feeCategoryId: item.fee_category_id,
          academicYearId: item.academic_year_id || currentAcademicYear?.id,
          amount: alloc,
          paymentMode,
          totalAmount: item.total_amount,
          dueDate: item.due_date,
          transactionId: transactionId.trim() || undefined,
          remarks: remarks.trim() || undefined
        });

        remainingBudget -= alloc;
      }

      if (!finalResult) {
        throw new Error('Payment processing failed.');
      }

      setLastPaymentResult(finalResult);

      const primaryLedger = selectedInvoices[0];
      const receiptData: FeeReceiptData = {
        id: finalResult.studentFeeId,
        payment_id: finalResult.paymentId,
        receipt_number: finalResult.receiptNumber,
        amount_paid: finalResult.amountPaid,
        paid_amount: finalResult.amountPaid,
        total_amount: finalResult.netAmount,
        net_amount: finalResult.netAmount,
        remaining_amount: finalResult.balance,
        total_outstanding_dues: finalResult.balance,
        payment_mode: paymentMode,
        payment_date: paymentDate,
        transaction_id: transactionId.trim() || null,
        remarks: remarks.trim() || null,
        category_name: primaryLedger?.category_name || 'Academic Fee',
        academic_year: selectedStudent?.academic_year || currentAcademicYear?.name || '2026-27',
        student_id: selectedStudent.id,
        students: {
          id: selectedStudent.id,
          name: selectedStudent.name,
          admission_number: selectedStudent.admission_number,
          roll_number: selectedStudent.roll_number,
          class: selectedStudent.class,
          section: selectedStudent.section,
          father_name: selectedStudent.father_name,
          phone: selectedStudent.phone
        }
      };

      setLastReceiptData(receiptData);
      toast.success(`Payment recorded! Receipt #${finalResult.receiptNumber}`, { id: 'fee-pay' });

      if (onPaymentSuccess) {
        onPaymentSuccess(finalResult, selectedStudent, primaryLedger, {
          paymentMode,
          transactionId: transactionId.trim() || undefined,
          remarks: remarks.trim() || undefined
        });
      }

      setStep('success');
    } catch (err: any) {
      console.error('Payment failed:', err);
      toast.error(err.message || 'Failed to record payment.', { id: 'fee-pay' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyReceiptNo = () => {
    if (!lastPaymentResult?.receiptNumber) return;
    navigator.clipboard.writeText(lastPaymentResult.receiptNumber);
    setIsCopied(true);
    toast.success('Receipt number copied!');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleResetForNext = () => {
    handleClearStudent();
    setStep('form');
    setLastPaymentResult(null);
    setLastReceiptData(null);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 sm:p-4 backdrop-blur-xs font-sans">
        {/* Enterprise Sized Modal Window - Fitted to viewport without vertical overflow */}
        <div className="relative w-full max-w-4xl lg:max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* Top Enterprise Header */}
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  Fee Collection Desk
                  <span className="text-[10px] font-medium bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                    Official Counter
                  </span>
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-300 font-mono hidden sm:inline-block">
                Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <button
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Modal Main Body */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-5">

            {/* STEP 1: ENTERPRISE HIGH-DENSITY FORM SCREEN */}
            {step === 'form' && (
              <form id="fee-collection-form" onSubmit={handleProceedToConfirm} className="space-y-3.5">
                
                {/* 1. SELECT STUDENT (Ultra-Compact Ribbon) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                      Select Student
                    </label>
                    {selectedStudent && (
                      <span className="text-[11px] text-slate-500">
                        Academic Year: <strong className="text-slate-800">{selectedStudent.academic_year || currentAcademicYear?.name || '2026-27'}</strong>
                      </span>
                    )}
                  </div>

                  {/* If No Student Selected: Compact Search Bar with Live Autocomplete */}
                  {!selectedStudent ? (
                    <div className="relative" ref={searchRef}>
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search student by Name, Admission No, Roll No, or Father's Name..."
                          value={studentSearch}
                          onChange={(e) => {
                            setStudentSearch(e.target.value);
                            setIsSearchOpen(true);
                          }}
                          onFocus={() => setIsSearchOpen(true)}
                          className="w-full bg-slate-50 border border-slate-300 focus:border-slate-800 focus:bg-white rounded-xl py-2 pl-9 pr-9 text-xs font-medium text-slate-900 outline-none transition-all shadow-2xs"
                          autoFocus
                        />
                        {isLoadingStudents && (
                          <Loader2 className="w-4 h-4 text-slate-600 animate-spin absolute right-3 top-2.5" />
                        )}
                      </div>

                      {/* Dropdown */}
                      {isSearchOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto z-30 divide-y divide-slate-100">
                          {searchResults.length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-400">
                              No matching active students found
                            </div>
                          ) : (
                            searchResults.map((st) => (
                              <div
                                key={st.id}
                                onClick={() => handleSelectStudent(st)}
                                className="p-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer"
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                    {st.photo_url ? (
                                      <img src={st.photo_url} alt="" className="w-full h-full object-cover rounded-full" />
                                    ) : (
                                      st.name?.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  <div>
                                    <div className="text-xs font-bold text-slate-900">{st.name}</div>
                                    <div className="text-[10px] text-slate-500">
                                      Class {st.class}-{st.section} • Roll: {st.roll_number || 'N/A'} • Father: {st.father_name || 'N/A'}
                                    </div>
                                  </div>
                                </div>
                                <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  Adm: {st.admission_number || 'N/A'}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Selected Student Ribbon: Ultra-Compact Single-Row Header */
                    <div className="border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                          {selectedStudent.photo_url ? (
                            <img src={selectedStudent.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            selectedStudent.name?.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="font-bold text-slate-900">{selectedStudent.name}</span>
                            <span className="bg-slate-200 text-slate-700 font-mono text-[10px] px-1.5 py-0.2 rounded font-semibold">
                              Adm: {selectedStudent.admission_number || 'N/A'}
                            </span>
                            <span className="text-slate-600 text-[11px]">
                              Class: <strong className="text-slate-800">{selectedStudent.class}-{selectedStudent.section}</strong>
                            </span>
                            {selectedStudent.roll_number && (
                              <span className="text-slate-500 text-[11px]">
                                Roll: {selectedStudent.roll_number}
                              </span>
                            )}
                            {selectedStudent.father_name && (
                              <span className="text-slate-500 text-[11px] truncate hidden md:inline">
                                Father: <strong className="text-slate-700">{selectedStudent.father_name}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleClearStudent}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-bold cursor-pointer hover:underline shrink-0 ml-2 px-2 py-0.5 rounded bg-blue-50 border border-blue-200"
                      >
                        Change Student
                      </button>
                    </div>
                  )}
                </div>

                {/* 2-COLUMN SPLIT DESK (Pending Fees on Left, Payment & Summary on Right) */}
                {selectedStudent ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
                    
                    {/* LEFT PANEL: 2. PENDING FEES TABLE (col-span-7) */}
                    <div className="lg:col-span-7 space-y-1.5 flex flex-col">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                          Pending Fees Breakdown
                          <span className="text-[10px] font-normal text-slate-500 font-sans">
                            ({studentInvoices.length} {studentInvoices.length === 1 ? 'item' : 'items'})
                          </span>
                        </label>
                        {studentInvoices.length > 0 && (
                          <button
                            type="button"
                            onClick={handleToggleAllLedgers}
                            className="text-[10px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer underline"
                          >
                            {selectedLedgerIds.size === studentInvoices.filter(r => r.remaining_amount > 0).length ? 'Deselect All' : 'Select All Dues'}
                          </button>
                        )}
                      </div>

                      {isLoadingInvoices ? (
                        <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                          Loading student fee ledger...
                        </div>
                      ) : studentInvoices.length === 0 ? (
                        <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                          <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                          No pending fee dues recorded for this student account.
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                          <div className="max-h-[260px] overflow-y-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider z-10">
                                <tr>
                                  <th className="py-2 px-2.5 text-center w-9">
                                    <input
                                      type="checkbox"
                                      checked={studentInvoices.filter(r => r.remaining_amount > 0).length > 0 && selectedLedgerIds.size === studentInvoices.filter(r => r.remaining_amount > 0).length}
                                      onChange={handleToggleAllLedgers}
                                      className="w-3.5 h-3.5 rounded text-slate-900 focus:ring-slate-800 border-slate-300 cursor-pointer"
                                    />
                                  </th>
                                  <th className="py-2 px-2.5">Fee Head</th>
                                  <th className="py-2 px-2 text-center">Due Date</th>
                                  <th className="py-2 px-2 text-right">Total</th>
                                  <th className="py-2 px-2.5 text-right">Due Balance</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                                {studentInvoices.map((inv) => {
                                  const isSelected = selectedLedgerIds.has(inv.id);
                                  const balance = Number(inv.remaining_amount || 0);

                                  return (
                                    <tr
                                      key={inv.id}
                                      onClick={() => balance > 0 && handleToggleLedger(inv.id)}
                                      className={cn(
                                        "transition-colors",
                                        balance === 0 ? "opacity-45 bg-slate-50/50" : "cursor-pointer hover:bg-slate-50",
                                        isSelected && "bg-blue-50/60 font-medium"
                                      )}
                                    >
                                      <td className="py-1.5 px-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="checkbox"
                                          disabled={balance === 0}
                                          checked={isSelected}
                                          onChange={() => handleToggleLedger(inv.id)}
                                          className="w-3.5 h-3.5 rounded text-slate-900 focus:ring-slate-800 border-slate-300 cursor-pointer disabled:cursor-not-allowed"
                                        />
                                      </td>
                                      <td className="py-1.5 px-2.5 font-bold text-slate-900">
                                        {inv.category_name}
                                      </td>
                                      <td className="py-1.5 px-2 text-center text-slate-500 text-[10px]">
                                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-mono text-slate-600 text-[10px]">
                                        ₹{Number(inv.total_amount || 0).toLocaleString('en-IN')}
                                      </td>
                                      <td className="py-1.5 px-2.5 text-right font-mono font-bold text-rose-700">
                                        ₹{balance.toLocaleString('en-IN')}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* RIGHT PANEL: 3. PAYMENT ENTRY & 4. PAYMENT SUMMARY (col-span-5) */}
                    <div className="lg:col-span-5 space-y-3">
                      
                      {/* 3. PAYMENT ENTRY CARD */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2.5 shadow-2xs">
                        <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                            Payment Details
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500 font-mono">
                            Dues: ₹{totalAmountDue.toLocaleString('en-IN')}
                          </span>
                        </label>

                        {/* Amount Received Input */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-slate-700 uppercase">
                              Amount Received (₹) *
                            </span>
                            {totalAmountDue > 0 && (
                              <button
                                type="button"
                                onClick={() => setPayingAmount(totalAmountDue)}
                                className="text-[9px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-1.5 py-0.5 rounded border border-emerald-300 cursor-pointer transition-colors"
                              >
                                Pay Full (₹{totalAmountDue.toLocaleString('en-IN')})
                              </button>
                            )}
                          </div>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="Enter amount to pay..."
                            value={payingAmount}
                            onChange={(e) => setPayingAmount(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full bg-white border border-slate-300 focus:border-slate-900 rounded-lg py-1.5 px-2.5 text-sm font-bold font-mono text-slate-900 outline-none shadow-2xs"
                            required
                          />
                        </div>

                        {/* Payment Mode & Transaction ID Grid */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-slate-700 uppercase block mb-1">
                              Payment Method
                            </span>
                            <select
                              value={paymentMode}
                              onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                              className="w-full bg-white border border-slate-300 focus:border-slate-900 rounded-lg py-1.5 px-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                            >
                              <option value="cash">Cash</option>
                              <option value="upi">UPI</option>
                              <option value="bank">Bank Transfer</option>
                              <option value="cheque">Cheque</option>
                              <option value="online">Online</option>
                            </select>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold text-slate-700 uppercase block mb-1">
                              Ref / Cheque No.
                            </span>
                            <input
                              type="text"
                              placeholder={paymentMode === 'cash' ? 'N/A' : 'Txn / Cheque #'}
                              value={transactionId}
                              onChange={(e) => setTransactionId(e.target.value)}
                              disabled={paymentMode === 'cash'}
                              className="w-full bg-white border border-slate-300 focus:border-slate-900 rounded-lg py-1.5 px-2 text-xs font-mono text-slate-800 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                            />
                          </div>
                        </div>

                        {/* Remarks */}
                        <div>
                          <input
                            type="text"
                            placeholder="Optional remarks / note..."
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            className="w-full bg-white border border-slate-300 focus:border-slate-900 rounded-lg py-1 px-2.5 text-[11px] text-slate-800 outline-none"
                          />
                        </div>
                      </div>

                      {/* 4. PAYMENT SUMMARY (Compact Enterprise Card) */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-1.5 text-xs shadow-2xs">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <span className="w-3.5 h-3.5 rounded bg-slate-800 text-white flex items-center justify-center text-[9px] font-bold">4</span>
                            Summary
                          </label>
                          <span className="text-[10px] font-mono text-slate-400">
                            {selectedInvoices.length} selected
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-slate-600 text-[11px]">
                          <span>Selected Due</span>
                          <span className="font-mono font-bold text-slate-900">₹{totalAmountDue.toLocaleString('en-IN')}</span>
                        </div>
                        
                        <div className="flex justify-between items-center text-emerald-700 font-semibold text-[11px]">
                          <span>Amount Paying</span>
                          <span className="font-mono font-bold text-emerald-800">₹{numPaying.toLocaleString('en-IN')}</span>
                        </div>
                        
                        <div className="flex justify-between items-center border-t border-slate-200 pt-1.5 font-bold">
                          <span className="text-slate-800 text-[11px]">Balance After Payment</span>
                          <span className="font-mono text-xs">
                            {remainingBalance === 0 && numPaying > 0 ? (
                              <span className="text-emerald-700 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                ₹0.00 (NO DUES)
                              </span>
                            ) : (
                              <span className="text-rose-700 font-bold">₹{remainingBalance.toLocaleString('en-IN')}</span>
                            )}
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs">
                    <User className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
                    Please search and select a student above to view pending fee dues and collect payment.
                  </div>
                )}

              </form>
            )}

            {/* STEP 2: CONFIRMATION MODAL */}
            {step === 'confirm' && (
              <div className="max-w-xl mx-auto space-y-3 py-1">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-900 font-medium">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  Please verify the payment information before finalizing and generating the receipt:
                </div>

                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3 text-xs shadow-2xs">
                  <div className="pb-2.5 border-b border-slate-100 flex justify-between items-start">
                    <div>
                      <span className="text-slate-400 font-bold uppercase text-[10px] block">Student Account</span>
                      <span className="font-bold text-slate-900 text-sm">{selectedStudent?.name}</span>
                      <span className="text-slate-500 block text-[11px]">
                        Adm: {selectedStudent?.admission_number || 'N/A'} • Class: {selectedStudent?.class}-{selectedStudent?.section}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-slate-400 font-bold uppercase text-[10px] block">Payment Method</span>
                      <span className="font-bold text-slate-900 capitalize bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block">
                        {paymentMode}
                      </span>
                      {transactionId && (
                        <span className="text-slate-500 font-mono text-[10px] block mt-0.5">Ref: {transactionId}</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Allocation Details</span>
                    <div className="bg-slate-50 rounded-lg p-2 space-y-1">
                      {selectedInvoices.map(inv => (
                        <div key={inv.id} className="flex justify-between items-center text-[11px]">
                          <span className="font-semibold text-slate-800">{inv.category_name}</span>
                          <span className="font-mono font-bold text-slate-900">₹{Number(inv.remaining_amount || 0).toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center">
                    <span className="font-bold text-emerald-900 uppercase text-xs">Total Amount to Collect</span>
                    <span className="text-lg font-black font-mono text-emerald-900">₹{numPaying.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: SUCCESS & RECEIPT ACTIONS */}
            {step === 'success' && lastPaymentResult && (
              <div className="max-w-md mx-auto space-y-3 text-center py-2">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                  <CheckCircle2 className="w-5 h-5" />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">Payment Recorded Successfully</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Receipt generated for {selectedStudent?.name}</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                    <span className="text-slate-500 text-[11px]">Receipt Number:</span>
                    <span className="font-mono font-bold text-slate-900 flex items-center gap-1.5 bg-white px-2 py-0.5 rounded border border-slate-200 text-xs">
                      {lastPaymentResult.receiptNumber}
                      <button onClick={handleCopyReceiptNo} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                        {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                    <span className="text-slate-500 text-[11px]">Amount Paid:</span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">₹{lastPaymentResult.amountPaid.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-[11px]">Remaining Dues:</span>
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      {lastPaymentResult.balance === 0 ? (
                        <span className="text-emerald-700">₹0.00 (No Dues)</span>
                      ) : (
                        `₹${lastPaymentResult.balance.toLocaleString('en-IN')}`
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    onClick={() => setIsReceiptModalOpen(true)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-400" /> View Receipt
                  </button>
                  <button
                    onClick={() => setIsReceiptModalOpen(true)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Printer className="w-3.5 h-3.5 text-blue-600" /> Print
                  </button>
                  <button
                    onClick={() => setIsReceiptModalOpen(true)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Download PDF
                  </button>
                  <button
                    onClick={handleResetForNext}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Next Fee
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Bottom Action Footer */}
          <div className="px-5 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
            {step === 'form' && (
              <>
                <div className="text-[11px] text-slate-500 font-medium">
                  {selectedStudent && numPaying > 0 ? (
                    <span>Collecting <strong className="text-slate-900 font-mono">₹{numPaying.toLocaleString('en-IN')}</strong> for <strong className="text-slate-900">{selectedStudent.name}</strong></span>
                  ) : (
                    <span>Ready for fee entry</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="fee-collection-form"
                    disabled={!selectedStudent || !numPaying || numPaying <= 0}
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-xs"
                  >
                    <span>Confirm Payment</span>
                    {numPaying > 0 && <span className="font-mono text-emerald-300">₹{numPaying.toLocaleString('en-IN')}</span>}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}

            {step === 'confirm' && (
              <div className="flex items-center justify-between w-full">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  ← Back to Edit
                </button>
                <button
                  type="button"
                  onClick={handleExecutePayment}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {isSubmitting ? 'Recording Payment...' : `Finalize & Collect ₹${numPaying.toLocaleString('en-IN')}`}
                </button>
              </div>
            )}

            {step === 'success' && (
              <div className="flex items-center justify-end w-full">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Official Fee Receipt Modal */}
      {isReceiptModalOpen && lastReceiptData && (
        <FeeReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          fee={lastReceiptData}
        />
      )}
    </>
  );
}
