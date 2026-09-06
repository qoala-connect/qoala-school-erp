import { supabase } from '@/lib/supabase';

/**
 * Writes one row to audit_logs.
 *
 * Mirrors ExaminationService.logAudit so the whole ERP records important
 * changes the same way: who, what action, which table and row, and the
 * before / after values where they matter. Never throws — an audit write
 * failing must not fail the user's action.
 */
export async function logAudit(
  actionType: string,
  tableName: string,
  recordId?: string | null,
  oldValues?: unknown,
  newValues?: unknown,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const shape = (v: unknown) =>
      v == null ? null : typeof v === 'object' ? v : { val: v };
    await supabase.from('audit_logs').insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      action_type: actionType,
      table_name: tableName,
      record_id: recordId ?? null,
      old_values: shape(oldValues),
      new_values: shape(newValues),
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[audit] could not write audit log:', err);
  }
}
