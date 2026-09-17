export type FeeStatus = 'paid' | 'partial' | 'pending' | 'overdue' | 'waived' | 'refunded';
export type PaymentMode = 'cash' | 'upi' | 'bank' | 'online' | 'cheque';
export type FeeFrequency = 'Monthly' | 'Quarterly' | 'Term' | 'Annual' | 'One-time';

export interface FeeCategory {
  id: string;
  category_name: string;
  description?: string | null;
  frequency: FeeFrequency | string;
  amount: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FeeStructureItem {
  id: string;
  class_id: string;
  fee_category_id: string;
  academic_year_id: string;
  amount: number;
  created_at?: string;
  updated_at?: string;
  classes?: { id: string; class_name: string };
  fee_categories?: { id: string; category_name: string; frequency: string };
  academic_years?: { id: string; name: string };
}

export interface FeePaymentRecord {
  id: string;
  student_fee_id: string;
  payment_date: string;
  amount_paid: number;
  payment_mode: PaymentMode | string;
  transaction_id?: string | null;
  receipt_number: string;
  remarks?: string | null;
  created_by?: string | null;
  created_at?: string;
  voided_at?: string | null;
  voided_by?: string | null;
  void_reason?: string | null;
}

export interface StudentFeeLedger {
  id: string;
  student_id: string;
  fee_category_id: string;
  academic_year_id: string;
  total_amount: number;
  discount_amount: number;
  scholarship_amount?: number;
  fine_amount: number;
  net_amount: number;
  amount_paid: number;
  remaining_amount: number;
  due_date: string;
  status: FeeStatus;
  created_at?: string;
  updated_at?: string;
  category_name: string;
  frequency?: string;
  academic_year: string;
  month?: string;
  payment_mode?: string;
  payment_date?: string;
  receipt_number?: string;
  students?: {
    id: string;
    name: string;
    roll_number: string;
    admission_number?: string;
    class: string;
    section: string;
    father_name?: string;
    phone?: string;
  };
  fee_payments?: FeePaymentRecord[];
}

export interface FeeSummaryMetrics {
  totalDemand: number;
  totalCollected: number;
  totalOutstanding: number;
  totalDiscount: number;
  totalFine: number;
  collectionRate: number;
  todayCollection: number;
  totalInvoices: number;
  pendingInvoices: number;
  paidInvoices: number;
  partialInvoices: number;
}

export interface StudentFeeAccountSummary {
  studentId: string;
  totalAssignedFee: number;
  totalPaid: number;
  currentDue: number;
  totalOutstanding: number;
  overdueAmount: number;
  nextDueDate: string | null;
  nextDueAmount: number;
  ledgers: StudentFeeLedger[];
}

export interface CollectFeeInput {
  studentFeeId?: string;
  studentId: string;
  feeCategoryId: string;
  academicYearId?: string;
  amount: number;
  paymentMode: PaymentMode | string;
  totalAmount?: number;
  discountAmount?: number;
  fineAmount?: number;
  dueDate?: string;
  transactionId?: string;
  remarks?: string;
  /**
   * Reuse an already-minted receipt number instead of minting a new one --
   * pass the first call's returned receiptNumber into every subsequent call
   * of the same cashier submission so a multi-item payment shares one
   * receipt instead of getting one per settled line.
   */
  receiptNumber?: string;
}

export interface CollectFeeResult {
  paymentId: string;
  studentFeeId: string;
  receiptNumber: string;
  amountPaid: number;
  netAmount: number;
  totalPaid: number;
  balance: number;
  status: string;
}

export interface FeeReceiptData {
  id?: string;
  payment_id?: string;
  student_fee_id?: string;
  receipt_number: string;
  amount_paid: number;
  paid_amount?: number;
  total_amount?: number;
  net_amount?: number;
  discount_amount?: number;
  fine_amount?: number;
  remaining_amount?: number;
  total_outstanding_dues?: number;
  payment_mode?: string;
  payment_date?: string;
  due_date?: string;
  transaction_id?: string | null;
  bank_name?: string | null;
  remarks?: string | null;
  category_name?: string;
  installment_name?: string;
  academic_year?: string;
  created_by?: string | null;
  cashier_name?: string | null;
  student_id?: string;
  /**
   * Fee heads this specific payment was tagged as covering, when it was paid
   * against a lumped "Composite" ledger row and the cashier ticked which
   * heads it's for. The receipt shows exactly these instead of pulling the
   * whole class's fee structure.
   */
  composite_heads_covered?: { category_name: string; frequency?: string; amount: number }[];
  /**
   * Every individual ledger row this payment actually settled, in the exact
   * amount allocated to it -- e.g. "Tuition Fee — Apr" ₹500, "Tuition Fee —
   * May" ₹500, "Admission Fee" ₹1500. When a single payment spans several
   * rows (several months, or several heads at once), the receipt shows this
   * full breakdown instead of collapsing everything into one lump line.
   */
  line_items?: { description: string; amount: number }[];
  students?: {
    id?: string;
    name?: string;
    roll_number?: string;
    admission_number?: string;
    enrollment_number?: string;
    class?: string;
    section?: string;
    father_name?: string;
    mother_name?: string;
    guardian_name?: string;
    phone?: string;
  };
}

