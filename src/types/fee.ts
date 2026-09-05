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
