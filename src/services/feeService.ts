import { supabase } from '@/lib/supabase';
import { 
  StudentFeeLedger, 
  FeeCategory, 
  FeeStructureItem, 
  CollectFeeInput, 
  CollectFeeResult, 
  FeePaymentRecord 
} from '@/types/fee';

export interface FeeFilters {
  search?: string;
  admissionNo?: string;
  classFilter?: string;
  sectionFilter?: string;
  academicYearFilter?: string;
  statusFilter?: string;
}

export const feeService = {
  /**
   * Fetch fee ledgers with relational joins and role filtering
   */
  async fetchFees(filters?: FeeFilters): Promise<StudentFeeLedger[]> {
    let query = supabase
      .from('student_fees')
      .select(`
        id,
        student_id,
        fee_category_id,
        total_amount,
        net_amount,
        amount_paid,
        discount_amount,
        fine_amount,
        scholarship_amount,
        status,
        created_at,
        updated_at,
        due_date,
        academic_year_id,
        fee_categories ( id, category_name, frequency ),
        academic_years ( id, name ),
        fee_payments ( id, amount_paid, payment_mode, payment_date, receipt_number, transaction_id, voided_at, void_reason, created_by ),
        students (
          id,
          name,
          roll_number,
          admission_number,
          class,
          section,
          father_name,
          phone
        )
      `)
      .order('created_at', { ascending: false });

    if (filters?.academicYearFilter && filters.academicYearFilter !== 'all') {
      query = query.eq('academic_year_id', filters.academicYearFilter);
    }

    if (filters?.statusFilter && filters.statusFilter !== 'all') {
      query = query.eq('status', filters.statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[feeService.fetchFees] Error:', error);
      throw error;
    }

    let records: StudentFeeLedger[] = (data || []).map((row: any) => {
      const categoryName = row.fee_categories?.category_name || 'School Fee';
      const payments: FeePaymentRecord[] = (row.fee_payments || []).filter((p: any) => !p.voided_at);
      const paidAmount = Number(row.amount_paid ?? payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0));
      const totalAmount = Number(row.total_amount || 0);
      const netAmount = Number(row.net_amount || totalAmount);
      const remainingAmount = Math.max(0, netAmount - paidAmount);
      const lastPayment = payments.length > 0 ? payments[payments.length - 1] : null;

      const monthStr = row.due_date
        ? new Date(row.due_date).toLocaleString('default', { month: 'long' })
        : new Date(row.created_at).toLocaleString('default', { month: 'long' });

      return {
        id: row.id,
        student_id: row.student_id,
        fee_category_id: row.fee_category_id,
        academic_year_id: row.academic_year_id,
        total_amount: totalAmount,
        discount_amount: Number(row.discount_amount || 0),
        scholarship_amount: Number(row.scholarship_amount || 0),
        fine_amount: Number(row.fine_amount || 0),
        net_amount: netAmount,
        amount_paid: paidAmount,
        remaining_amount: remainingAmount,
        due_date: row.due_date,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        category_name: categoryName,
        academic_year: row.academic_years?.name || '2026-27',
        month: monthStr,
        payment_mode: lastPayment?.payment_mode || 'cash',
        payment_date: lastPayment?.payment_date || row.created_at?.split('T')[0],
        receipt_number: lastPayment?.receipt_number || `REC-${row.id.substring(0, 6).toUpperCase()}`,
        students: row.students,
        fee_payments: row.fee_payments || []
      };
    });

    // Client-side multi-field filter
    if (filters?.search && filters.search.trim()) {
      const s = filters.search.toLowerCase().trim();
      records = records.filter(r =>
        (r.students?.name && r.students.name.toLowerCase().includes(s)) ||
        (r.students?.admission_number && r.students.admission_number.toLowerCase().includes(s)) ||
        (r.students?.roll_number && r.students.roll_number.toLowerCase().includes(s)) ||
        (r.students?.father_name && r.students.father_name.toLowerCase().includes(s)) ||
        (r.receipt_number && r.receipt_number.toLowerCase().includes(s))
      );
    }

    if (filters?.classFilter && filters.classFilter !== 'all') {
      records = records.filter(r => r.students?.class === filters.classFilter || `Class ${r.students?.class}` === filters.classFilter);
    }

    if (filters?.sectionFilter && filters.sectionFilter !== 'all') {
      records = records.filter(r => r.students?.section === filters.sectionFilter);
    }

    return records;
  },

  /**
   * Fetch active fee categories catalogue
   */
  async fetchFeeCategories(): Promise<FeeCategory[]> {
    const { data, error } = await supabase
      .from('fee_categories')
      .select('*')
      .order('category_name');

    if (error) {
      console.error('[feeService.fetchFeeCategories] Error:', error);
      throw error;
    }

    return (data || []).map((c: any) => ({
      id: c.id,
      category_name: c.category_name,
      description: c.description,
      frequency: c.frequency || 'Monthly',
      amount: Number(c.amount || 0),
      is_active: c.is_active !== false,
      created_at: c.created_at,
      updated_at: c.updated_at
    }));
  },

  /**
   * Create or update fee category
   */
  async saveFeeCategory(category: Partial<FeeCategory>): Promise<FeeCategory> {
    if (category.id) {
      const { data, error } = await supabase
        .from('fee_categories')
        .update({
          category_name: category.category_name,
          description: category.description,
          frequency: category.frequency,
          amount: category.amount,
          is_active: category.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', category.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('fee_categories')
        .insert([{
          category_name: category.category_name,
          description: category.description,
          frequency: category.frequency || 'Monthly',
          amount: category.amount || 0,
          is_active: category.is_active !== false
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  /**
   * Fetch fee structures for an academic year
   */
  async fetchFeeStructures(academicYearId?: string): Promise<FeeStructureItem[]> {
    let query = supabase
      .from('fee_structure')
      .select(`
        id,
        class_id,
        fee_category_id,
        academic_year_id,
        amount,
        created_at,
        updated_at,
        classes ( id, class_name ),
        fee_categories ( id, category_name, frequency ),
        academic_years ( id, name )
      `)
      .order('created_at', { ascending: false });

    if (academicYearId && academicYearId !== 'all') {
      query = query.eq('academic_year_id', academicYearId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[feeService.fetchFeeStructures] Error:', error);
      throw error;
    }

    return (data || []) as any as FeeStructureItem[];
  },

  /**
   * Upsert a fee structure rate
   */
  async saveFeeStructureItem(item: { classId: string; feeCategoryId: string; academicYearId: string; amount: number }): Promise<void> {
    const { error } = await supabase
      .from('fee_structure')
      .upsert({
        class_id: item.classId,
        fee_category_id: item.feeCategoryId,
        academic_year_id: item.academicYearId,
        amount: item.amount,
        updated_at: new Date().toISOString()
      }, { onConflict: 'class_id,fee_category_id,academic_year_id' });

    if (error) {
      console.error('[feeService.saveFeeStructureItem] Error:', error);
      throw error;
    }
  },

  /**
   * Record fee payment atomically with specific ledger settlement support
   */
  async collectFee(input: CollectFeeInput): Promise<CollectFeeResult> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    // 1. Primary: Resilient server-side settlement endpoint
    try {
      const resp = await fetch('/api/fees/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          student_fee_id: input.studentFeeId || null,
          student_id: input.studentId,
          fee_category_id: input.feeCategoryId,
          academic_year_id: input.academicYearId || null,
          amount: input.amount,
          payment_mode: input.paymentMode,
          total_amount: input.totalAmount || input.amount,
          discount_amount: input.discountAmount || 0,
          fine_amount: input.fineAmount || 0,
          due_date: input.dueDate || null,
          payment_date: new Date().toISOString().split('T')[0],
          transaction_id: input.transactionId || null,
          remarks: input.remarks || null,
        })
      });

      if (resp.ok) {
        const json = await resp.json();
        return {
          paymentId: json.paymentId,
          studentFeeId: json.studentFeeId,
          receiptNumber: json.receiptNumber,
          amountPaid: Number(json.amountPaid),
          netAmount: Number(json.netAmount),
          totalPaid: Number(json.totalPaid),
          balance: Number(json.balance),
          status: json.status
        };
      }
    } catch (e) {
      console.warn('[feeService.collectFee] Server endpoint fallback to RPC:', e);
    }

    // 2. Fallback: Supabase RPC
    const { data, error } = await supabase.rpc('collect_fee', {
      _student_id: input.studentId,
      _fee_category_id: input.feeCategoryId,
      _amount: input.amount,
      _payment_mode: input.paymentMode,
      _academic_year_id: input.academicYearId || null,
      _total_amount: input.totalAmount || input.amount,
      _discount_amount: input.discountAmount || 0,
      _fine_amount: input.fineAmount || 0,
      _due_date: input.dueDate || null,
      _payment_date: new Date().toISOString().split('T')[0],
      _transaction_id: input.transactionId || null,
      _remarks: input.remarks || null,
    });

    if (error) {
      console.error('[feeService.collectFee] RPC Error:', error);
      throw error;
    }

    const res = Array.isArray(data) ? data[0] : data;
    return {
      paymentId: res.payment_id,
      studentFeeId: res.student_fee_id,
      receiptNumber: res.receipt_number,
      amountPaid: Number(res.amount_paid),
      netAmount: Number(res.net_amount),
      totalPaid: Number(res.total_paid),
      balance: Number(res.balance),
      status: res.status
    };
  },

  /**
   * Void / reverse a payment with audit reason
   */
  async voidPayment(paymentId: string, reason: string): Promise<void> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    try {
      const resp = await fetch('/api/fees/void', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          payment_id: paymentId,
          reason: reason.trim()
        })
      });

      if (resp.ok) return;
    } catch (e) {
      console.warn('[feeService.voidPayment] Server endpoint fallback to RPC:', e);
    }

    const { error } = await supabase.rpc('void_fee_payment', {
      _payment_id: paymentId,
      _reason: reason.trim()
    });

    if (error) {
      console.error('[feeService.voidPayment] RPC Error:', error);
      throw error;
    }
  },

  /**
   * Assign a new fee obligation to student
   */
  async assignFeeToStudent(params: {
    studentId: string;
    feeCategoryId: string;
    academicYearId: string;
    amount: number;
    dueDate: string;
    discountAmount?: number;
    fineAmount?: number;
  }): Promise<void> {
    const { error } = await supabase
      .from('student_fees')
      .insert([{
        student_id: params.studentId,
        fee_category_id: params.feeCategoryId,
        academic_year_id: params.academicYearId,
        total_amount: params.amount,
        discount_amount: params.discountAmount || 0,
        fine_amount: params.fineAmount || 0,
        due_date: params.dueDate,
      }]);

    if (error) {
      console.error('[feeService.assignFeeToStudent] Insert Error:', error);
      throw error;
    }
  },

  /**
   * Fetch all transaction logs
   */
  async fetchTransactions(): Promise<any[]> {
    const { data, error } = await supabase
      .from('fee_payments')
      .select(`
        id,
        student_fee_id,
        payment_date,
        amount_paid,
        payment_mode,
        transaction_id,
        receipt_number,
        remarks,
        created_at,
        voided_at,
        voided_by,
        void_reason,
        student_fees (
          id,
          total_amount,
          net_amount,
          discount_amount,
          fine_amount,
          due_date,
          status,
          fee_categories ( category_name ),
          students (
            id,
            name,
            admission_number,
            roll_number,
            class,
            section,
            father_name,
            phone
          )
        )
      `)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[feeService.fetchTransactions] Error:', error);
      throw error;
    }

    return data || [];
  }
};
