/**
 * A student_fees row carries only a due_date, never an explicit "this is
 * April's instalment" label -- a Monthly/Quarterly head's period is read off
 * its own due date. Shared by the Collect Fee checklist and the fee
 * breakdown statement so a cashier and a parent see the same label for the
 * same row.
 */
export function feePeriodLabel(row: { category_name?: string | null; frequency?: string | null; due_date?: string | null }): string {
  const base = row.category_name || 'School Fee';
  const freq = (row.frequency || '').toLowerCase();
  const d = row.due_date ? new Date(row.due_date) : null;
  if (!d || Number.isNaN(d.getTime())) return base;

  if (freq === 'monthly') {
    return `${base} — ${d.toLocaleString('en-IN', { month: 'short' })}`;
  }
  if (freq === 'quarterly') {
    // Academic-year quarters: Q1 Apr-Jun, Q2 Jul-Sep, Q3 Oct-Dec, Q4 Jan-Mar.
    const q = Math.floor(((d.getMonth() - 3 + 12) % 12) / 3) + 1;
    return `${base} — Q${q}`;
  }
  return base;
}
