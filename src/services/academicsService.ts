/**
 * Academics data access.
 *
 * Academics owns the academic structure: academic years, classes,
 * sections, subjects and the class-subject offering. Every other module
 * references those rows by id and none of them may create their own.
 *
 * What this file deliberately does NOT do:
 *
 *   Teacher assignments  Teacher Management owns them, in
 *                        services/teacherService.ts against
 *                        teacher_assignments. Academics reads the
 *                        resulting names through the read-model
 *                        functions and links to Teacher Management to
 *                        change them.
 *   Students             Students owns enrolment. Academics reads counts
 *                        and links across with a class and section
 *                        filter.
 *   Exams, marks, fees   Owned by Examination and Fees.
 *
 * Every aggregate figure comes from a SECURITY INVOKER function created
 * in supabase_academics_migration_07c_readmodel.sql, so a class list of
 * any size is one request rather than one request per class.
 */
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

export type AcademicYearStatus = 'upcoming' | 'active' | 'completed' | 'archived';

export interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  is_active: boolean;
  status: AcademicYearStatus;
  created_at: string;
  updated_at: string;
}

export interface SchoolClass {
  id: string;
  class_name: string;
  class_code: string;
  stream: string;
  display_order: number;
  is_active: boolean;
}

export interface SectionLetter {
  id: string;
  section_name: string;
  capacity: number | null;
  is_active: boolean;
}

export interface Subject {
  id: string;
  subject_name: string;
  subject_code: string | null;
  category: 'Scholastic' | 'Co-Scholastic';
  subject_type: 'Theory' | 'Practical' | 'Theory + Practical' | 'Activity';
  is_active: boolean;
}

export interface AcademicsOverview {
  academic_year_id: string;
  academic_year_name: string;
  academic_year_status: AcademicYearStatus;
  is_current_year: boolean;
  classes_total: number;
  classes_active: number;
  sections_total: number;
  subjects_total: number;
  subjects_active: number;
  students_enrolled: number;
  teachers_active: number;
  class_subject_mappings: number;
  classes_without_sections: number;
  classes_without_subjects: number;
  sections_without_class_teacher: number;
  subjects_never_mapped: number;
  timetable_slots: number;
}

export interface ClassDirectoryRow {
  class_id: string;
  class_name: string;
  class_code: string;
  stream: string;
  display_order: number;
  is_active: boolean;
  sections_count: number;
  section_labels: string | null;
  subjects_count: number;
  students_count: number;
  class_teacher_names: string | null;
  teachers_count: number;
}

export interface SectionDirectoryRow {
  class_section_id: string;
  section_id: string;
  section_name: string;
  capacity: number | null;
  room_no: string | null;
  is_active: boolean;
  students_count: number;
  class_teacher_id: string | null;
  class_teacher_name: string | null;
  subject_teachers: number;
}

export interface ClassSubjectRow {
  mapping_id: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  subject_code: string | null;
  category: string;
  subject_type: string;
  section_id: string | null;
  section_name: string | null;
  is_mandatory: boolean;
  is_active: boolean;
  teacher_names: string | null;
}

export interface SubjectDirectoryRow {
  subject_id: string;
  subject_name: string;
  subject_code: string | null;
  category: string;
  subject_type: string;
  is_active: boolean;
  classes_count: number;
  class_labels: string | null;
  teachers_count: number;
  has_marks: boolean;
}

export interface TimetableSlot {
  id: string;
  class_id: string | null;
  section_id: string | null;
  subject_id: string | null;
  teacher_id: string | null;
  academic_year_id: string | null;
  day: string;
  period_number: number | null;
  start_time: string;
  end_time: string;
}

// ---------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------

/**
 * Turns a PostgREST error into something an administrator can act on.
 *
 * The guard triggers added in migration 07b already raise a sentence
 * naming the class and the count, so those are passed through as they
 * are. The generic codes are the ones worth translating.
 */
function describe(error: { code?: string; message: string; details?: string }): string {
  const raw = error.message || '';

  if (raw.includes('Deactivate it instead') || raw.includes('Remove them from') ||
      raw.includes('Remove those mappings') || raw.includes('Archive it instead') ||
      raw.includes('cannot be deleted')) {
    return raw;
  }

  switch (error.code) {
    case '23505':
      return 'That record already exists. Check for a duplicate name, code or mapping.';
    case '23503':
      return 'Other records still depend on this. Deactivate it instead of deleting it.';
    case '23514':
      return 'Some of those values are not allowed. Check the dates and the type.';
    case '42501':
      return 'You do not have permission to change the academic structure.';
    default:
      return raw || 'The change could not be saved.';
  }
}

function unwrap<T>(res: { data: T | null; error: any }): T {
  if (res.error) throw new Error(describe(res.error));
  return res.data as T;
}

// ---------------------------------------------------------------------
// Academic years
// ---------------------------------------------------------------------

export async function fetchAcademicYears(): Promise<AcademicYear[]> {
  return unwrap(
    await supabase
      .from('academic_years')
      .select('id, name, start_date, end_date, is_current, is_active, status, created_at, updated_at')
      .order('start_date', { ascending: false })
  );
}

export async function saveAcademicYear(input: {
  id?: string;
  name: string;
  start_date: string;
  end_date: string;
  status: AcademicYearStatus;
}): Promise<AcademicYear> {
  const payload = {
    name: input.name.trim(),
    start_date: input.start_date,
    end_date: input.end_date,
    status: input.status,
    is_active: input.status !== 'archived',
  };

  const res = input.id
    ? await supabase.from('academic_years').update(payload).eq('id', input.id).select().single()
    : await supabase.from('academic_years').insert([payload]).select().single();

  return unwrap(res);
}

/**
 * Only one year may carry is_current, enforced by a partial unique index.
 * Clearing the old one and setting the new one has to happen in a single
 * statement, so it goes through the database function rather than two
 * round trips with a window in between where no year is current.
 */
export async function setCurrentAcademicYear(yearId: string): Promise<void> {
  const { error } = await supabase.rpc('set_current_academic_year', { _year_id: yearId });
  if (error) throw new Error(describe(error));
}

export async function deleteAcademicYear(yearId: string): Promise<void> {
  const { error } = await supabase.from('academic_years').delete().eq('id', yearId);
  if (error) throw new Error(describe(error));
}

// ---------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------

export async function fetchOverview(academicYearId: string): Promise<AcademicsOverview | null> {
  const { data, error } = await supabase
    .rpc('academics_overview', { _academic_year_id: academicYearId });
  if (error) throw new Error(describe(error));
  return (data as AcademicsOverview[])?.[0] ?? null;
}

// ---------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------

export async function fetchClassDirectory(academicYearId: string): Promise<ClassDirectoryRow[]> {
  const { data, error } = await supabase
    .rpc('academics_class_directory', { _academic_year_id: academicYearId });
  if (error) throw new Error(describe(error));
  return (data as ClassDirectoryRow[]) ?? [];
}

export async function fetchClasses(): Promise<SchoolClass[]> {
  return unwrap(
    await supabase
      .from('classes')
      .select('id, class_name, class_code, stream, display_order, is_active')
      .order('display_order')
  );
}

export async function saveClass(input: {
  id?: string;
  class_name: string;
  class_code: string;
  stream: string;
  display_order: number;
  is_active: boolean;
}): Promise<SchoolClass> {
  const payload = {
    class_name: input.class_name.trim(),
    class_code: input.class_code.trim().toUpperCase(),
    stream: input.stream.trim() || 'General',
    display_order: input.display_order,
    is_active: input.is_active,
  };

  const res = input.id
    ? await supabase.from('classes').update(payload).eq('id', input.id).select().single()
    : await supabase.from('classes').insert([payload]).select().single();

  return unwrap(res);
}

export async function setClassActive(classId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('classes').update({ is_active: isActive }).eq('id', classId);
  if (error) throw new Error(describe(error));
}

export async function deleteClass(classId: string): Promise<void> {
  const { error } = await supabase.from('classes').delete().eq('id', classId);
  if (error) throw new Error(describe(error));
}

// ---------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------

/**
 * Section letters are global and become a real teaching group only once
 * paired with a class in class_sections. That is the shape the data has
 * had since migration 05a and the shape students, admissions and
 * teacher_assignments already point at, so it is kept rather than
 * duplicated per class.
 */
export async function fetchSectionLetters(): Promise<SectionLetter[]> {
  return unwrap(
    await supabase
      .from('sections')
      .select('id, section_name, capacity, is_active')
      .order('section_name')
  );
}

export async function fetchSectionDirectory(
  academicYearId: string,
  classId: string
): Promise<SectionDirectoryRow[]> {
  const { data, error } = await supabase.rpc('academics_section_directory', {
    _academic_year_id: academicYearId,
    _class_id: classId,
  });
  if (error) throw new Error(describe(error));
  return (data as SectionDirectoryRow[]) ?? [];
}

/** Creates the section letter if the school does not have it yet, then attaches it to the class. */
export async function attachSectionToClass(input: {
  class_id: string;
  section_name: string;
  capacity: number;
  room_no: string | null;
}): Promise<void> {
  const name = input.section_name.trim().toUpperCase();

  const existing = unwrap(
    await supabase.from('sections').select('id').eq('section_name', name).maybeSingle()
  ) as { id: string } | null;

  const sectionId = existing?.id ?? (unwrap(
    await supabase
      .from('sections')
      .insert([{ section_name: name, capacity: input.capacity, is_active: true }])
      .select('id')
      .single()
  ) as { id: string }).id;

  const { error } = await supabase.from('class_sections').insert([{
    class_id: input.class_id,
    section_id: sectionId,
    capacity: input.capacity,
    room_no: input.room_no,
    is_active: true,
  }]);
  if (error) throw new Error(describe(error));
}

export async function updateClassSection(
  classSectionId: string,
  patch: { capacity?: number; room_no?: string | null; is_active?: boolean }
): Promise<void> {
  const { error } = await supabase.from('class_sections').update(patch).eq('id', classSectionId);
  if (error) throw new Error(describe(error));
}

export async function deleteClassSection(classSectionId: string): Promise<void> {
  const { error } = await supabase.from('class_sections').delete().eq('id', classSectionId);
  if (error) throw new Error(describe(error));
}

// ---------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------

export async function fetchSubjectDirectory(academicYearId: string): Promise<SubjectDirectoryRow[]> {
  const { data, error } = await supabase
    .rpc('academics_subject_directory', { _academic_year_id: academicYearId });
  if (error) throw new Error(describe(error));
  return (data as SubjectDirectoryRow[]) ?? [];
}

export async function fetchSubjects(activeOnly = true): Promise<Subject[]> {
  let query = supabase
    .from('subjects')
    .select('id, subject_name, subject_code, category, subject_type, is_active')
    .order('subject_name');
  if (activeOnly) query = query.eq('is_active', true);
  return unwrap(await query);
}

export async function saveSubject(input: {
  id?: string;
  subject_name: string;
  subject_code: string;
  category: Subject['category'];
  subject_type: Subject['subject_type'];
  is_active: boolean;
}): Promise<Subject> {
  const payload = {
    subject_name: input.subject_name.trim(),
    subject_code: input.subject_code.trim().toUpperCase(),
    category: input.category,
    subject_type: input.subject_type,
    is_active: input.is_active,
  };

  const res = input.id
    ? await supabase.from('subjects').update(payload).eq('id', input.id).select().single()
    : await supabase.from('subjects').insert([payload]).select().single();

  return unwrap(res);
}

export async function setSubjectActive(subjectId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('subjects').update({ is_active: isActive }).eq('id', subjectId);
  if (error) throw new Error(describe(error));
}

export async function deleteSubject(subjectId: string): Promise<void> {
  const { error } = await supabase.from('subjects').delete().eq('id', subjectId);
  if (error) throw new Error(describe(error));
}

// ---------------------------------------------------------------------
// Class-subject offering
// ---------------------------------------------------------------------

export async function fetchClassSubjects(
  academicYearId: string,
  classId: string | null
): Promise<ClassSubjectRow[]> {
  const { data, error } = await supabase.rpc('academics_class_subjects', {
    _academic_year_id: academicYearId,
    _class_id: classId,
  });
  if (error) throw new Error(describe(error));
  return (data as ClassSubjectRow[]) ?? [];
}

/**
 * Maps one or more subjects onto a class for a year.
 *
 * section_id is null for the usual case, a subject the whole class takes.
 * Naming a section restricts the offering to that section, which is what
 * an elective stream needs. The unique index treats a null section as a
 * value, so the same whole-class subject cannot be added twice.
 */
export async function addClassSubjects(input: {
  academic_year_id: string;
  class_id: string;
  subject_ids: string[];
  section_id: string | null;
  is_mandatory: boolean;
}): Promise<number> {
  if (input.subject_ids.length === 0) return 0;

  const rows = input.subject_ids.map(subject_id => ({
    class_id: input.class_id,
    academic_year_id: input.academic_year_id,
    section_id: input.section_id,
    subject_id,
    is_mandatory: input.is_mandatory,
    is_active: true,
  }));

  // Ignore rows that already exist rather than failing the whole batch,
  // so re-running a partly-completed mapping is safe.
  const { data, error } = await supabase
    .from('class_subjects')
    .upsert(rows, {
      onConflict: 'class_id,academic_year_id,subject_id,section_id',
      ignoreDuplicates: true,
    })
    .select('id');

  if (error) throw new Error(describe(error));
  return data?.length ?? 0;
}

export async function updateClassSubject(
  mappingId: string,
  patch: { is_mandatory?: boolean; is_active?: boolean }
): Promise<void> {
  const { error } = await supabase.from('class_subjects').update(patch).eq('id', mappingId);
  if (error) throw new Error(describe(error));
}

export async function removeClassSubject(mappingId: string): Promise<void> {
  const { error } = await supabase.from('class_subjects').delete().eq('id', mappingId);
  if (error) throw new Error(describe(error));
}

/**
 * Carries a year's whole subject offering into another year.
 *
 * A new academic year otherwise starts with no subjects mapped to any
 * class, and rebuilding twelve classes by hand is the step that gets
 * skipped, which is how Examination and Timetable end up inventing their
 * own subject lists.
 */
export async function copyClassSubjects(
  fromYearId: string,
  toYearId: string
): Promise<number> {
  const source = unwrap(
    await supabase
      .from('class_subjects')
      .select('class_id, section_id, subject_id, is_mandatory')
      .eq('academic_year_id', fromYearId)
      .eq('is_active', true)
  ) as Array<{ class_id: string; section_id: string | null; subject_id: string; is_mandatory: boolean }>;

  if (source.length === 0) return 0;

  const rows = source
    .filter(r => r.class_id)
    .map(r => ({ ...r, academic_year_id: toYearId, is_active: true }));

  const { data, error } = await supabase
    .from('class_subjects')
    .upsert(rows, {
      onConflict: 'class_id,academic_year_id,subject_id,section_id',
      ignoreDuplicates: true,
    })
    .select('id');

  if (error) throw new Error(describe(error));
  return data?.length ?? 0;
}

/**
 * Subjects a class is actually being taught but was never mapped to.
 *
 * The curriculum is meant to be the record every other module reads, and
 * the timetable is meant to schedule only what it names. Where a school
 * built its week before mapping the curriculum, the two disagree, and the
 * disagreement is invisible until a report card is missing a subject.
 * This reports it so it can be closed in one action.
 */
export interface CurriculumGap {
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  slots: number;
}

/**
 * Reads every row of a table, not the first page.
 *
 * PostgREST answers with at most a thousand rows and says nothing about
 * the rest. A school's week already runs to that, so a single request
 * would under-report the gap and the banner would go quiet while the
 * curriculum was still short.
 */
const PAGE = 1000;
async function readAll<T>(
  build: () => any,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw new Error(describe(error));
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < PAGE) return out;
  }
}

export async function fetchCurriculumGaps(academicYearId: string): Promise<CurriculumGap[]> {
  const [taught, mappedRows, classRows, subjectRows] = await Promise.all([
    readAll<{ class_id: string; subject_id: string }>(() =>
      supabase.from('timetable')
        .select('class_id, subject_id')
        .eq('academic_year_id', academicYearId)
        .not('class_id', 'is', null)
        .not('subject_id', 'is', null)
        .order('class_id')),
    readAll<{ class_id: string; subject_id: string }>(() =>
      supabase.from('class_subjects')
        .select('class_id, subject_id')
        .eq('academic_year_id', academicYearId)
        .order('class_id')),
    readAll<{ id: string; class_name: string }>(() =>
      supabase.from('classes').select('id, class_name').order('id')),
    readAll<{ id: string; subject_name: string }>(() =>
      supabase.from('subjects').select('id, subject_name').order('id')),
  ]);

  const have = new Set(mappedRows.map(r => `${r.class_id}|${r.subject_id}`));
  const className = new Map(classRows.map(c => [c.id, c.class_name]));
  const subjectName = new Map(subjectRows.map(s => [s.id, s.subject_name]));

  const gaps = new Map<string, CurriculumGap>();
  for (const row of taught) {
    const key = `${row.class_id}|${row.subject_id}`;
    if (have.has(key)) continue;
    const existing = gaps.get(key);
    if (existing) { existing.slots += 1; continue; }
    gaps.set(key, {
      class_id: row.class_id,
      subject_id: row.subject_id,
      class_name: className.get(row.class_id) ?? 'Unknown class',
      subject_name: subjectName.get(row.subject_id) ?? 'Removed subject',
      slots: 1,
    });
  }

  return [...gaps.values()].sort(
    (a, b) => a.class_name.localeCompare(b.class_name, undefined, { numeric: true })
             || a.subject_name.localeCompare(b.subject_name)
  );
}

/**
 * Maps every gap the timetable reveals onto the curriculum as a
 * whole-class, mandatory offering. Existing rows are left alone, so this
 * is safe to run twice and never narrows an offering that already names
 * a section.
 */
export async function importClassSubjectsFromTimetable(academicYearId: string): Promise<number> {
  const gaps = await fetchCurriculumGaps(academicYearId);
  if (gaps.length === 0) return 0;

  const { data, error } = await supabase
    .from('class_subjects')
    .upsert(
      gaps.map(g => ({
        class_id: g.class_id,
        academic_year_id: academicYearId,
        subject_id: g.subject_id,
        section_id: null,
        is_mandatory: true,
        is_active: true,
      })),
      { onConflict: 'class_id,academic_year_id,subject_id,section_id', ignoreDuplicates: true }
    )
    .select('id');

  if (error) throw new Error(describe(error));
  return data?.length ?? 0;
}

// ---------------------------------------------------------------------
// Timetable
// ---------------------------------------------------------------------

export const TIMETABLE_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export const DAY_LABELS: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
  thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

/**
 * Every slot in the year, thinned to what a clash check needs.
 *
 * The grid shows one class at a time, so a teacher booked for another
 * class in the same period is invisible from the screen that would have
 * caught it. This is read once per year and held in memory.
 */
export interface TimetableIndexRow {
  id: string;
  class_id: string | null;
  section_id: string | null;
  subject_id: string | null;
  teacher_id: string | null;
  day: string;
  period_number: number | null;
  start_time?: string | null;
  end_time?: string | null;
  class_name?: string | null;
  section_name?: string | null;
  subject_name?: string | null;
  subject_code?: string | null;
}

export async function fetchYearTimetableIndex(academicYearId: string): Promise<TimetableIndexRow[]> {
  const { data, error } = await supabase.from('timetable')
    .select(`
      id, class_id, section_id, subject_id, teacher_id, day, period_number, start_time, end_time,
      classes (class_name),
      sections (section_name),
      subjects (subject_name, subject_code)
    `)
    .eq('academic_year_id', academicYearId)
    .order('id');
  if (error) throw new Error(describe(error));
  return (data || []).map((r: any) => ({
    id: r.id,
    class_id: r.class_id,
    section_id: r.section_id,
    subject_id: r.subject_id,
    teacher_id: r.teacher_id,
    day: r.day,
    period_number: r.period_number,
    start_time: r.start_time ? r.start_time.slice(0, 5) : null,
    end_time: r.end_time ? r.end_time.slice(0, 5) : null,
    class_name: r.classes?.class_name || null,
    section_name: r.sections?.section_name || null,
    subject_name: r.subjects?.subject_name || null,
    subject_code: r.subjects?.subject_code || null,
  }));
}

export async function fetchTimetable(input: {
  academic_year_id: string;
  class_id?: string | null;
  section_id?: string | null;
}): Promise<TimetableSlot[]> {
  let query = supabase
    .from('timetable')
    .select('id, class_id, section_id, subject_id, teacher_id, academic_year_id, day, period_number, start_time, end_time')
    .eq('academic_year_id', input.academic_year_id)
    .order('day')
    .order('period_number');

  if (input.class_id) query = query.eq('class_id', input.class_id);
  if (input.section_id) query = query.eq('section_id', input.section_id);

  return unwrap(await query);
}

export async function saveTimetableSlot(input: {
  id?: string;
  academic_year_id: string;
  class_id: string;
  section_id: string | null;
  subject_id: string;
  teacher_id: string | null;
  day: string;
  period_number: number;
  start_time: string;
  end_time: string;
}): Promise<void> {
  const { data: clsData } = await supabase.from('classes').select('class_name').eq('id', input.class_id).maybeSingle();
  const className = clsData?.class_name || 'Class';

  // Sanitize time formats (e.g., '09:00' -> '09:00:00' or clean HH:mm)
  const cleanStartTime = (input.start_time || '09:00').trim().slice(0, 8);
  const cleanEndTime = (input.end_time || '09:40').trim().slice(0, 8);

  let targetId = input.id;

  // Check if a slot already exists for this class, section, day, and period
  let clash = supabase
    .from('timetable')
    .select('id, class_id, section_id, teacher_id, start_time, end_time')
    .eq('academic_year_id', input.academic_year_id)
    .eq('day', input.day)
    .eq('period_number', input.period_number);
  if (input.id) clash = clash.neq('id', input.id);

  const { data: sameSlot, error: clashError } = await clash;
  if (!clashError && sameSlot) {
    for (const row of sameSlot) {
      const sameSection =
        (row as any).class_id === input.class_id && ((row as any).section_id ?? null) === (input.section_id || null);
      if (sameSection) {
        // If adding without an ID, adopt the existing slot ID to update seamlessly!
        if (!targetId) {
          targetId = (row as any).id;
        }
      }
    }
  }

  const payload = {
    academic_year_id: input.academic_year_id,
    class_id: input.class_id,
    class: className,
    section_id: input.section_id || null,
    subject_id: input.subject_id,
    teacher_id: input.teacher_id || null,
    day: input.day,
    period_number: input.period_number,
    start_time: cleanStartTime,
    end_time: cleanEndTime,
  };

  // 1. Direct Supabase write attempt
  try {
    const res = targetId
      ? await supabase.from('timetable').update(payload).eq('id', targetId)
      : await supabase.from('timetable').insert([payload]);

    if (!res.error) return;
  } catch (err) {
    // Fall through to resilient backend endpoint
  }

  // 2. Resilient server endpoint fallback
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const resp = await fetch('/api/timetable/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ ...payload, id: targetId })
  });

  if (!resp.ok) {
    const errJson = await resp.json().catch(() => ({}));
    throw new Error(errJson.error || `Save failed with status ${resp.status}`);
  }
}

export async function deleteTimetableSlot(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('timetable').delete().eq('id', id);
    if (!error) return;
  } catch (err) {
    // Fall through
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const resp = await fetch(`/api/timetable/${id}`, {
    method: 'DELETE',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!resp.ok) {
    const errJson = await resp.json().catch(() => ({}));
    throw new Error(errJson.error || `Delete failed with status ${resp.status}`);
  }
}

// ---------------------------------------------------------------------
// Cross-module context, read only
// ---------------------------------------------------------------------

export interface TeacherOption {
  id: string;
  name: string;
  employee_id: string | null;
  department?: string | null;
  designation?: string | null;
  subjects_taught?: string | null;
  subject_codes?: string | null;
}

/** Teachers with their specialization subjects taught, for showing who is assigned and available. */
export async function fetchTeacherOptions(academicYearId?: string): Promise<TeacherOption[]> {
  const { data, error } = await supabase
    .from('teachers')
    .select(`
      id, name, employee_id, department, designation,
      teacher_assignments (
        is_active,
        academic_year_id,
        subjects (subject_name, subject_code)
      )
    `)
    .eq('is_active', true)
    .order('name');
  if (error) throw new Error(describe(error));

  return (data || []).map((t: any) => {
    const activeAssignments = (t.teacher_assignments || []).filter((ta: any) => 
      ta.is_active !== false && (!academicYearId || ta.academic_year_id === academicYearId)
    );
    const subjects = [...new Set(activeAssignments.map((ta: any) => ta.subjects?.subject_name).filter(Boolean))];
    const codes = [...new Set(activeAssignments.map((ta: any) => ta.subjects?.subject_code).filter(Boolean))];

    return {
      id: t.id,
      name: t.name,
      employee_id: t.employee_id,
      department: t.department,
      designation: t.designation,
      subjects_taught: subjects.length > 0 ? (subjects as string[]).join(', ') : null,
      subject_codes: codes.length > 0 ? (codes as string[]).join(', ') : null,
    };
  });
}
