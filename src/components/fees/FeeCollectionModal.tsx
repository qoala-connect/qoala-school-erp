import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, Check, Search, CreditCard, Banknote, Smartphone, 
  Building, Receipt, AlertCircle, Loader2, User,
  CheckCircle2, Printer, Download, Eye, Copy, ArrowRight,
  RotateCcw, Calendar, FileText, ChevronRight, ChevronDown,
  AlertTriangle, CheckSquare, Square
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatFeeHeadName } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { feeService } from '@/services/feeService';
import { feePeriodLabel } from '@/lib/feeLabels';
import { FeeCategory, PaymentMode, CollectFeeResult, StudentFeeLedger, FeeReceiptData, FeeStructureItem } from '@/types/fee';
import FeeReceiptModal from '@/components/fees/FeeReceiptModal';

interface FeeCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  students?: any[];
  preSelectedStudent?: any;
  targetFeeLedger?: StudentFeeLedger | null;
  feeCategories: FeeCategory[];
  currentAcademicYear?: { id: string; name: string } | null;
  /**
   * Fires with the exact same receipt data this modal itself displays
   * (including the full line_items breakdown) -- callers should hand it
   * straight to their own FeeReceiptModal rather than reconstructing a
   * receipt from the raw result, which loses the per-head/per-month detail.
   */
  onPaymentSuccess?: (result: CollectFeeResult, student: any, receiptData: FeeReceiptData) => void;
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
  // Which recurring fee-head groups (Tuition, Transport...) are expanded to
  // show their individual per-month rows, rather than just the quick-pick
  // summary row.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Fee Structure Master heads for a composite-billed student, and which of
  // them the cashier has ticked as "what this payment is for". Tagging only
  // — it never changes the ledger row a payment is recorded against.
  const [structureHeads, setStructureHeads] = useState<FeeStructureItem[]>([]);
  const [selectedHeadIds, setSelectedHeadIds] = useState<Set<string>>(new Set());

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
      setStructureHeads([]);
      setSelectedHeadIds(new Set());
      return;
    }

    let isCancelled = false;
    const loadLedgers = async () => {
      setIsLoadingInvoices(true);
      setStructureHeads([]);
      setSelectedHeadIds(new Set());
      try {
        // Scoped server-side to this one student, rather than walking the
        // entire school's fee ledger and filtering client-side — with
        // itemized billing (up to ~20 rows/student/year) that whole-school
        // fetch only gets heavier as enrolment grows.
        const account = await feeService.getStudentFeeAccount(selectedStudent.id);
        if (isCancelled) return;

        // A settled-with-zero-balance "Composite Annual Fee" row is a
        // retrofit artifact -- kept only so historical payments still
        // resolve to a real ledger row, never something anyone will collect
        // against again. Showing it in the active checklist just inflates
        // the item count with a dead line; a Composite row that still has a
        // real balance (not yet converted to itemized billing) stays.
        const rows = account.ledgers.filter(r =>
          !(/composite/i.test(r.category_name) && Number(r.remaining_amount || 0) === 0 && Number(r.total_amount || 0) === Number(r.amount_paid || 0))
        );
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

        // A lumped "Composite" row can't be checked head-by-head the way
        // itemized rows can (there's only ever the one row) -- when the
        // student has one, pull the class's Fee Structure Master so the
        // cashier can still tick which heads this payment is for. Nothing
        // here changes the ledger; it only tags the payment for the receipt.
        if (rows.some(r => /composite/i.test(r.category_name) && Number(r.remaining_amount || 0) > 0)) {
          const rawClassName = String(selectedStudent.class || '').replace(/^class\s*/i, '').trim();
          const sessionName = selectedStudent.academic_year || currentAcademicYear?.name;
          const structures = await feeService.fetchFeeStructures();
          if (isCancelled) return;
          setStructureHeads(
            structures.filter(s =>
              (s.classes?.class_name || '').trim() === rawClassName &&
              (!sessionName || (s.academic_years?.name || '') === sessionName)
            )
          );
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

  // A recurring head (Monthly/Quarterly) with more than one period pending
  // gets collapsed into one quick-pick row -- 12 individual Tuition
  // checkboxes is a lot of scrolling/clicking for what's usually just "pay N
  // months". Anything billed once (Admission, Exam, Annual heads) or a
  // recurring head with only one row left renders as a normal single row.
  interface InvoiceGroup {
    key: string;
    categoryName: string;
    frequency?: string;
    rows: StudentFeeLedger[];
    isGrouped: boolean;
  }

  const groupedInvoices = useMemo<InvoiceGroup[]>(() => {
    const map = new Map<string, StudentFeeLedger[]>();
    for (const inv of studentInvoices) {
      const key = inv.fee_category_id || inv.category_name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(inv);
    }
    const groups = Array.from(map.entries()).map(([key, rows]) => {
      const sorted = [...rows].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
      const freq = (sorted[0].frequency || '').toLowerCase();
      return {
        key,
        categoryName: sorted[0].category_name,
        frequency: sorted[0].frequency,
        rows: sorted,
        isGrouped: sorted.length > 1 && (freq === 'monthly' || freq === 'quarterly'),
      };
    });
    // Chronological by each group's earliest due date, matching the flat
    // list's original ordering.
    return groups.sort((a, b) => (a.rows[0]?.due_date || '').localeCompare(b.rows[0]?.due_date || ''));
  }, [studentInvoices]);

  // Shared by every selection action: write the id set, then derive Amount
  // Received from exactly what's now selected across the whole invoice list.
  const applyLedgerSelection = (next: Set<string>) => {
    setSelectedLedgerIds(next);
    const sum = studentInvoices
      .filter(r => next.has(r.id))
      .reduce((acc, r) => acc + Number(r.remaining_amount || 0), 0);
    setPayingAmount(sum > 0 ? Math.round(sum * 100) / 100 : '');
  };

  // Toggle selection
  const handleToggleLedger = (id: string) => {
    const next = new Set(selectedLedgerIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    applyLedgerSelection(next);
  };

  const handleToggleAllLedgers = () => {
    const pendingRows = studentInvoices.filter(r => Number(r.remaining_amount || 0) > 0);
    if (selectedLedgerIds.size === pendingRows.length && pendingRows.length > 0) {
      applyLedgerSelection(new Set());
    } else {
      applyLedgerSelection(new Set(pendingRows.map(r => r.id)));
    }
  };

  // Quick-pick N earliest-due pending periods within one grouped head
  // (or every pending period, for "Pay All"). Replaces this group's own
  // selection only -- every other head's ticks are left exactly as they were.
  const handleQuickSelectGroup = (groupRows: StudentFeeLedger[], count: number | 'all') => {
    const pending = groupRows
      .filter(r => Number(r.remaining_amount || 0) > 0)
      .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
    const toSelect = count === 'all' ? pending : pending.slice(0, count);

    const next = new Set(selectedLedgerIds);
    groupRows.forEach(r => next.delete(r.id));
    toSelect.forEach(r => next.add(r.id));
    applyLedgerSelection(next);
  };

  const toggleGroupExpanded = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleToggleHead = (id: string) => {
    const next = new Set(selectedHeadIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedHeadIds(next);

    if (next.size > 0) {
      // Can't collect more against the one composite row than it's still
      // owed, however many heads got ticked.
      const sum = structureHeads
        .filter(s => next.has(s.id))
        .reduce((acc, s) => acc + Number(s.amount || 0), 0);
      const capped = totalAmountDue > 0 ? Math.min(sum, totalAmountDue) : sum;
      setPayingAmount(capped > 0 ? Math.round(capped * 100) / 100 : '');
    }
    // Unticking the last box leaves Amount Received as it is, rather than
    // clobbering a figure the cashier may have typed by hand.
  };

  const selectedHeads = useMemo(
    () => structureHeads.filter(s => selectedHeadIds.has(s.id)),
    [structureHeads, selectedHeadIds]
  );
  const selectedHeadsTotal = useMemo(
    () => selectedHeads.reduce((sum, s) => sum + Number(s.amount || 0), 0),
    [selectedHeads]
  );

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
      // Head tags are cashier-entered context, not a ledger change: fold them
      // into the remarks that actually get written, and carry them through to
      // the receipt separately so it can show the exact heads ticked.
      const headTagNote = selectedHeads.length > 0
        ? `Covers: ${selectedHeads.map(s => s.fee_categories?.category_name).filter(Boolean).join(', ')}.`
        : '';
      const typedRemarks = remarks.trim();
      const effectiveRemarks = [headTagNote, typedRemarks].filter(Boolean).join(' ') || undefined;

      // A single "amount received" can cover several selected lines at once
      // (several months of one head, or several heads together). Each line
      // is its own collect_fee() call so it settles against its own ledger
      // row and can be independently voided later, but they must all read
      // as ONE payment to the cashier and the parent -- so the first call
      // mints a receipt number and every subsequent call in this batch
      // reuses it, instead of each line minting (and displaying) its own.
      const paidResults: CollectFeeResult[] = [];
      const paidLineItems: { description: string; amount: number }[] = [];
      let remainingBudget = numPaying;
      let batchReceiptNumber: string | undefined;

      for (const item of selectedInvoices) {
        if (remainingBudget <= 0) break;
        const due = Number(item.remaining_amount || 0);
        const alloc = Math.min(due, remainingBudget);
        if (alloc <= 0) continue;

        paidLineItems.push({ description: feePeriodLabel(item), amount: alloc });

        const result = await feeService.collectFee({
          studentFeeId: item.id,
          studentId: selectedStudent.id,
          feeCategoryId: item.fee_category_id,
          academicYearId: item.academic_year_id || currentAcademicYear?.id,
          amount: alloc,
          paymentMode,
          totalAmount: item.total_amount,
          dueDate: item.due_date,
          transactionId: transactionId.trim() || undefined,
          remarks: effectiveRemarks,
          receiptNumber: batchReceiptNumber
        });

        batchReceiptNumber = batchReceiptNumber || result.receiptNumber;
        paidResults.push(result);
        remainingBudget -= alloc;
      }

      if (paidResults.length === 0) {
        throw new Error('Payment processing failed.');
      }

      const primaryResult = paidResults[0];
      const totalPaidNow = paidResults.reduce((sum, r) => sum + Number(r.amountPaid || 0), 0);
      const combinedNet = selectedInvoices.reduce((sum, inv) => sum + Number(inv.net_amount || 0), 0);
      const combinedBalance = Math.max(0, Math.round((totalAmountDue - totalPaidNow) * 100) / 100);

      const aggregateResult: CollectFeeResult = {
        paymentId: primaryResult.paymentId,
        studentFeeId: primaryResult.studentFeeId,
        receiptNumber: primaryResult.receiptNumber,
        amountPaid: totalPaidNow,
        netAmount: combinedNet,
        totalPaid: paidResults.reduce((sum, r) => sum + Number(r.totalPaid || 0), 0),
        balance: combinedBalance,
        status: combinedBalance === 0 ? 'paid' : 'partial',
      };

      setLastPaymentResult(aggregateResult);

      // One label for the printed receipt: the head paid, or a joined list
      // when several different heads were settled in the same payment.
      const distinctHeads = [...new Set(selectedInvoices.map(i => i.category_name))];
      const combinedLabel =
        distinctHeads.length <= 1
          ? feePeriodLabel(selectedInvoices[0])
          : distinctHeads.length === 2
            ? distinctHeads.join(' + ')
            : `${distinctHeads[0]} + ${distinctHeads.length - 1} more heads`;

      const receiptData: FeeReceiptData = {
        id: primaryResult.studentFeeId,
        payment_id: primaryResult.paymentId,
        receipt_number: primaryResult.receiptNumber,
        amount_paid: totalPaidNow,
        paid_amount: totalPaidNow,
        total_amount: combinedNet,
        net_amount: combinedNet,
        remaining_amount: combinedBalance,
        total_outstanding_dues: combinedBalance,
        payment_mode: paymentMode,
        payment_date: paymentDate,
        transaction_id: transactionId.trim() || null,
        remarks: effectiveRemarks || null,
        category_name: combinedLabel,
        academic_year: selectedStudent?.academic_year || currentAcademicYear?.name || '2026-27',
        student_id: selectedStudent.id,
        line_items: paidLineItems,
        composite_heads_covered: selectedHeads.length > 0
          ? selectedHeads.map(s => ({
              category_name: s.fee_categories?.category_name || 'Fee Head',
              frequency: s.fee_categories?.frequency,
              amount: Number(s.amount || 0),
            }))
          : undefined,
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
      toast.success(
        paidResults.length > 1
          ? `Payment of ₹${totalPaidNow.toLocaleString('en-IN')} recorded across ${paidResults.length} fee items. Receipt #${primaryResult.receiptNumber} (+${paidResults.length - 1} more)`
          : `Payment recorded! Receipt #${primaryResult.receiptNumber}`,
        { id: 'fee-pay' }
      );

      if (onPaymentSuccess) {
        onPaymentSuccess(aggregateResult, selectedStudent, receiptData);
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
                          <div className="max-h-[340px] overflow-y-auto">
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
                                  <th className="py-2 px-2.5 min-w-[150px]">Fee Head</th>
                                  <th className="py-2 px-2 text-center w-20">Due Date</th>
                                  <th className="py-2 px-2 text-right w-24">Total</th>
                                  <th className="py-2 px-2.5 text-right w-24">Due Balance</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                                {groupedInvoices.map((group) => {
                                  if (!group.isGrouped) {
                                    const inv = group.rows[0];
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
                                          {feePeriodLabel(inv)}
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
                                  }

                                  // Grouped recurring head: one quick-pick summary row, with
                                  // an expandable list of the individual periods underneath.
                                  const pending = group.rows.filter(r => Number(r.remaining_amount || 0) > 0);
                                  const groupDue = pending.reduce((sum, r) => sum + Number(r.remaining_amount || 0), 0);
                                  const selectedInGroup = group.rows.filter(r => selectedLedgerIds.has(r.id)).length;
                                  const isExpanded = expandedGroups.has(group.key);
                                  const quickCounts = [1, 3, 6].filter(n => n < pending.length);

                                  return (
                                    <React.Fragment key={group.key}>
                                      <tr className={cn("transition-colors bg-slate-50/40", selectedInGroup > 0 && "bg-blue-50/40")}>
                                        <td className="py-1.5 px-2.5 text-center align-top pt-2.5">
                                          <button
                                            type="button"
                                            onClick={() => toggleGroupExpanded(group.key)}
                                            className="text-slate-400 hover:text-slate-700 cursor-pointer"
                                            title={isExpanded ? 'Collapse months' : 'Show individual months'}
                                          >
                                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                          </button>
                                        </td>
                                        <td className="py-1.5 px-2.5" colSpan={4}>
                                          <div className="flex items-center justify-between flex-wrap gap-1.5">
                                            <div>
                                              <span className="font-bold text-slate-900">{formatFeeHeadName(group.categoryName)}</span>
                                              <span className="text-[10px] text-slate-500 ml-1.5">
                                                {pending.length === 0
                                                  ? `${group.rows.length} settled`
                                                  : `${selectedInGroup > 0 ? `${selectedInGroup} of ` : ''}${pending.length} pending · ₹${groupDue.toLocaleString('en-IN')} due`}
                                              </span>
                                            </div>
                                            {pending.length > 0 && (
                                              <div className="flex items-center gap-1">
                                                {quickCounts.map(n => (
                                                  <button
                                                    key={n}
                                                    type="button"
                                                    onClick={() => handleQuickSelectGroup(group.rows, n)}
                                                    className={cn(
                                                      "px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer transition-colors",
                                                      selectedInGroup === n ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                                                    )}
                                                  >
                                                    Pay {n}
                                                  </button>
                                                ))}
                                                <button
                                                  type="button"
                                                  onClick={() => handleQuickSelectGroup(group.rows, 'all')}
                                                  className={cn(
                                                    "px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer transition-colors",
                                                    selectedInGroup === pending.length ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-emerald-700 border-emerald-200 hover:border-emerald-400"
                                                  )}
                                                >
                                                  Pay All
                                                </button>
                                                {selectedInGroup > 0 && (
                                                  <button
                                                    type="button"
                                                    onClick={() => handleQuickSelectGroup(group.rows, 0)}
                                                    className="px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-400 hover:text-rose-600 cursor-pointer"
                                                  >
                                                    Clear
                                                  </button>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                      </tr>

                                      {isExpanded && group.rows.map(inv => {
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
                                            <td className="py-1.5 pl-6 pr-2.5 font-semibold text-slate-700">
                                              {feePeriodLabel(inv)}
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
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Head-tagging for a lumped "Composite" ledger row: there's only
                          the one row to check, so let the cashier tick which of the
                          class's configured fee heads this payment is for instead.
                          Tags the receipt/remarks only — the payment still posts
                          against the composite row above. */}
                      {structureHeads.length > 1 && (
                        <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] font-bold text-amber-900 uppercase tracking-wide">
                              What is this payment for? <span className="font-normal normal-case text-amber-700">(tag the composite payment — optional)</span>
                            </span>
                            {selectedHeadIds.size > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedHeadIds(new Set())}
                                className="text-[10px] font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {structureHeads.map(s => {
                              const checked = selectedHeadIds.has(s.id);
                              return (
                                <label
                                  key={s.id}
                                  className={cn(
                                    "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] cursor-pointer transition-colors",
                                    checked ? "bg-white border-amber-400 shadow-2xs" : "bg-white/60 border-amber-100 hover:border-amber-300"
                                  )}
                                >
                                  <span className="flex items-center gap-1.5 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => handleToggleHead(s.id)}
                                      className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 border-amber-300 cursor-pointer shrink-0"
                                    />
                                    <span className="font-bold text-slate-800 truncate">
                                      {formatFeeHeadName(s.fee_categories?.category_name)}
                                    </span>
                                  </span>
                                  <span className="font-mono text-slate-500 text-[10px] shrink-0">
                                    ₹{Number(s.amount || 0).toLocaleString('en-IN')}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                          {selectedHeadIds.size > 0 && (
                            <p className="text-[10px] text-amber-800 font-medium">
                              Tagged total: ₹{selectedHeadsTotal.toLocaleString('en-IN')} — filled into Amount Received. Edit it there if the cashier collected a different figure.
                            </p>
                          )}
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
                          <span className="font-semibold text-slate-800">{feePeriodLabel(inv)}</span>
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
                  {lastReceiptData?.category_name && (
                    <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                      <span className="text-slate-500 text-[11px]">Paid For:</span>
                      <span className="font-bold text-slate-900 text-right">{lastReceiptData.category_name}</span>
                    </div>
                  )}
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
