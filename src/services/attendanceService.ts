/**
 * Daily class attendance — the register a class or subject teacher marks
 * for one class, section and date.
 *
 * There is one canonical writer, the atomic Postgres function
 * save_attendance(). It is SECURITY DEFINER, checks attendance.manage,
 * refuses a future date, refuses a class a teacher is not assigned to
 * (migration 18e), upserts on (student_id, attendance_date) so re-marking
 * is safe, and writes an audit row. This module is a thin wrapper so the
 * teaching workspace and the Attendance module both go through it.
 */
import { supabase } from '@/lib/supabase';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'leave';

export const ATTENDANCE_STATUSES: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'leave', label: 'Excused / Leave' },
  { value: 'half_day', label: 'Half day' },
];

export interface RegisterStudent {
  id: string;
  name: string;
  roll_number: string;
  admission_number: string;
  photo_url: string | null;
  status: AttendanceStatus;
  remarks: string | null;
}

export interface ClassRegister {
  /** True when at least one row already exists for this class + date. */
  alreadyMarked: boolean;
  markedByName: string | null;
  lastUpdated: string | null;
  students: RegisterStudent[];
}

function describe(error: { code?: string; message: string }): string {
  if (error.code === '42501') return error.message || 'You cannot record attendance for this class.';
  if (error.code === 'check_violation') return 'Attendance cannot be recorded for a future date.';
  return error.message || 'The register could not be saved.';
}

/**
 * The roster for a class + section with any attendance already recorded
 * for the date spliced in. Unmarked students default to 'present'.
 */
export async function fetchClassRegister(input: {
  class_id: string;
  section_id: string;
  class_name: string;
  section_name: string;
  date: string;
}): Promise<ClassRegister> {
  const { data: students, error: sErr } = await supabase
    .from('students')
    .select('id, name, roll_number, admission_number, photo_url')
    .eq('class_id', input.class_id)
    .eq('section_id', input.section_id)
    .eq('status', 'active')
    .order('roll_number');
  if (sErr) throw new Error(describe(sErr));

  const ids = (students ?? []).map(s => s.id);
  let existing: Array<{ student_id: string; status: string; remarks: string | null; marked_by: string | null; updated_at: string }> = [];
  if (ids.length > 0) {
    const { data, error } = await supabase
      .from('attendance')
      .select('student_id, status, remarks, marked_by, updated_at')
      .eq('attendance_date', input.date)
      .in('student_id', ids);
    if (error) throw new Error(describe(error));
    existing = data ?? [];
  }

  const byStudent = new Map(existing.map(r => [r.student_id, r]));
  let markedByName: string | null = null;
  let lastUpdated: string | null = null;
  if (existing.length > 0) {
    lastUpdated = existing
      .map(r => r.updated_at)
      .sort()
      .at(-1) ?? null;
    const markerId = existing.find(r => r.marked_by)?.marked_by ?? null;
    if (markerId) {
      const { data: prof } = await supabase.from('profiles').select('name').eq('id', markerId).maybeSingle();
      markedByName = prof?.name ?? null;
    }
  }

  return {
    alreadyMarked: existing.length > 0,
    markedByName,
    lastUpdated,
    students: (students ?? []).map(s => {
      const rec = byStudent.get(s.id);
      return {
        id: s.id,
        name: s.name,
        roll_number: s.roll_number,
        admission_number: s.admission_number,
        photo_url: s.photo_url ?? null,
        status: (rec?.status as AttendanceStatus) ?? 'present',
        remarks: rec?.remarks ?? null,
      };
    }),
  };
}

/**
 * Writes the whole register in one statement via save_attendance().
 * Returns the number of rows saved.
 */
export async function saveClassRegister(input: {
  class_name: string;
  section_name: string;
  date: string;
  rows: { student_id: string; status: AttendanceStatus; remarks?: string | null }[];
}): Promise<number> {
  const { data, error } = await supabase.rpc('save_attendance', {
    _attendance_date: input.date,
    _class: input.class_name,
    _section: input.section_name,
    _records: input.rows.map(r => ({
      student_id: r.student_id,
      status: r.status,
      remarks: r.remarks ?? '',
    })),
  });
  if (error) throw new Error(describe(error));
  return Array.isArray(data) ? Number(data[0]?.saved ?? 0) : Number(data ?? 0);
}
