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

export interface PageParams {
  page?: number;
  pageSize?: number;
}

// Rows pulled per round-trip. Callers that don't ask for a specific page get
// every row, fetched in chunks of this size -- a single capped request used to
// silently truncate the fee directory the moment enrolment passed the ceiling,
// which reads to the user as "my student is missing from Fees".
const DEFAULT_PAGE_SIZE = 500;

// Safety valve so an un-paginated caller still can't loop forever.
const MAX_FETCH_ALL_ROWS = 20000;

export const feeService = {
  /**
   * Fetch fee ledgers with relational joins and role filtering
   */
  async fetchFees(filters?: FeeFilters, pagination?: PageParams): Promise<StudentFeeLedger[]> {
    const buildQuery = () => {
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
      // Deterministic, unique ordering: created_at alone collides on bulk
      // inserts, and a non-unique sort key can drop or repeat rows across pages.
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

      if (filters?.academicYearFilter && filters.academicYearFilter !== 'all') {
        query = query.eq('academic_year_id', filters.academicYearFilter);
      }

      if (filters?.statusFilter && filters.statusFilter !== 'all') {
        query = query.eq('status', filters.statusFilter);
      }

      return query;
    };

    const pageSize = pagination?.pageSize || DEFAULT_PAGE_SIZE;
    const data: any[] = [];

    if (pagination?.page && pagination.page > 0) {
      // Explicit page requested -- honour it exactly.
      const from = (pagination.page - 1) * pageSize;
      const { data: rows, error } = await buildQuery().range(from, from + pageSize - 1);
      if (error) {
        console.error('[feeService.fetchFees] Error:', error);
        throw error;
      }
      data.push(...(rows || []));
    } else {
      // No page requested -- walk every chunk so the caller sees all ledgers.
      for (let from = 0; from < MAX_FETCH_ALL_ROWS; from += pageSize) {
        const { data: rows, error } = await buildQuery().range(from, from + pageSize - 1);
        if (error) {
          console.error('[feeService.fetchFees] Error:', error);
          throw error;
        }
        data.push(...(rows || []));
        if (!rows || rows.length < pageSize) break;
      }
    }

    let records: StudentFeeLedger[] = data.map((row: any) => {
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
   * Delete or deactivate fee category with safety check on student fee ledgers
   */
  async deleteFeeCategory(categoryId: string, forceCascade = false): Promise<{ deleted: boolean; deactivated?: boolean; message: string }> {
    // 1. Check if student fees are referencing this fee category
    const { count, error: countErr } = await supabase
      .from('student_fees')
      .select('id', { count: 'exact', head: true })
      .eq('fee_category_id', categoryId);

    if (countErr) {
      console.warn('[feeService.deleteFeeCategory] Count check warning:', countErr);
    }

    if (count && count > 0 && !forceCascade) {
      // If student records exist, deactivate category to protect audit trail
      const { error: deactErr } = await supabase
        .from('fee_categories')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', categoryId);

      if (deactErr) throw deactErr;
      return { 
        deleted: false, 
        deactivated: true, 
        message: `Category deactivated. ${count} student fee ledger entries exist so history was preserved.` 
      };
    }

    // 2. Remove from fee_structure matrix first
    const { error: structErr } = await supabase
      .from('fee_structure')
      .delete()
      .eq('fee_category_id', categoryId);

    if (structErr) {
      console.error('[feeService.deleteFeeCategory] Error deleting fee_structure items:', structErr);
    }

    // 3. Delete fee category
    const { error: delErr } = await supabase
      .from('fee_categories')
      .delete()
      .eq('id', categoryId);

    if (delErr) {
      console.error('[feeService.deleteFeeCategory] Error deleting category:', delErr);
      throw delErr;
    }

    return { deleted: true, message: 'Fee category deleted successfully.' };
  },

  /**
   * Delete a specific fee structure item rate
   */
  async deleteFeeStructureItem(classId: string, feeCategoryId: string, academicYearId: string): Promise<void> {
    const { error } = await supabase
      .from('fee_structure')
      .delete()
      .eq('class_id', classId)
      .eq('fee_category_id', feeCategoryId)
      .eq('academic_year_id', academicYearId);

    if (error) {
      console.error('[feeService.deleteFeeStructureItem] Error:', error);
      throw error;
    }
  },

  /**
   * Delete / Reset all fee structure rates for a specific class in an academic session
   */
  async deleteClassFeeStructure(classId: string, academicYearId: string): Promise<void> {
    const { error } = await supabase
      .from('fee_structure')
      .delete()
      .eq('class_id', classId)
      .eq('academic_year_id', academicYearId);

    if (error) {
      console.error('[feeService.deleteClassFeeStructure] Error:', error);
      throw error;
    }
  },

  /**
   * Delete all fee structure rates for an academic year (reset matrix)
   */
  async resetAllFeeStructures(academicYearId: string): Promise<void> {
    const { error } = await supabase
      .from('fee_structure')
      .delete()
      .eq('academic_year_id', academicYearId);

    if (error) {
      console.error('[feeService.resetAllFeeStructures] Error:', error);
      throw error;
    }
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
   * Bulk upsert multiple fee structure rates efficiently
   */
  async saveBatchFeeStructures(items: { classId: string; feeCategoryId: string; academicYearId: string; amount: number }[]): Promise<void> {
    if (!items || items.length === 0) return;
    const records = items.map(item => ({
      class_id: item.classId,
      fee_category_id: item.feeCategoryId,
      academic_year_id: item.academicYearId,
      amount: item.amount,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('fee_structure')
      .upsert(records, { onConflict: 'class_id,fee_category_id,academic_year_id' });

    if (error) {
      console.error('[feeService.saveBatchFeeStructures] Error:', error);
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
  async fetchTransactions(pagination?: PageParams): Promise<any[]> {
    const pageSize = pagination?.pageSize || DEFAULT_PAGE_SIZE;
    const page = pagination?.page && pagination.page > 0 ? pagination.page : 1;

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
          amount_paid,
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
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      console.error('[feeService.fetchTransactions] Error:', error);
      throw error;
    }

    return data || [];
  }
};
