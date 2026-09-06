/**
 * Curriculum & syllabus data access.
 *
 * Academics owns the curriculum: units, chapters and topics an admin
 * configures per class + subject for an academic year (academics.manage).
 * A teacher never edits the curriculum; they record how far their section
 * has got through each chapter in syllabus_progress (academics.teach).
 *
 * The tree and the coverage figures come from SECURITY INVOKER functions
 * created in supabase_academics_workflow_migration_18c_readmodel.sql, so a
 * whole class's syllabus is one request and row level security still
 * applies to the caller.
 */
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

export type ChapterStatus = 'not_started' | 'in_progress' | 'completed';

export interface SyllabusUnit {
  id: string;
  academic_year_id: string;
  class_id: string;
  subject_id: string;
  title: string;
  sequence: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyllabusChapter {
  id: string;
  unit_id: string;
  title: string;
  sequence: number;
  description: string | null;
  expected_hours: number | null;
  created_at: string;
  updated_at: string;
}

export interface SyllabusTopic {
  id: string;
  chapter_id: string;
  title: string;
  sequence: number;
}

/** One flat row of academics_syllabus_tree(). */
export interface SyllabusTreeRow {
  unit_id: string;
  unit_title: string;
  unit_sequence: number;
  chapter_id: string | null;
  chapter_title: string | null;
  chapter_sequence: number | null;
  expected_hours: number | null;
  topic_count: number;
  progress_status: ChapterStatus;
  started_on: string | null;
  completed_on: string | null;
  progress_notes: string | null;
}

export interface SyllabusCoverageRow {
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  chapters_total: number;
  sections_in_class: number;
  completed_pairs: number;
  in_progress_pairs: number;
  percent_complete: number | null;
}

export interface SubjectCoverageRow {
  subject_id: string;
  subject_name: string;
  chapters_total: number;
  percent_complete: number | null;
}

// ---------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------

function describe(error: { code?: string; message: string }): string {
  const raw = error.message || '';
  switch (error.code) {
    case '23505':
      return 'That sequence number is already used in this unit or chapter. Choose another.';
    case '23503':
      return 'Other records still depend on this item. Remove them first.';
    case '23514':
      return 'Some of those values are not allowed. Check the sequence and status.';
    case '42501':
      return 'You do not have permission to change the curriculum.';
    default:
      return raw || 'The change could not be saved.';
  }
}

function unwrap<T>(res: { data: T | null; error: any }): T {
  if (res.error) throw new Error(describe(res.error));
  return res.data as T;
}

// ---------------------------------------------------------------------
// Read model
// ---------------------------------------------------------------------

export async function fetchSyllabusTree(input: {
  academic_year_id: string;
  class_id: string;
  subject_id: string;
  section_id?: string | null;
}): Promise<SyllabusTreeRow[]> {
  const { data, error } = await supabase.rpc('academics_syllabus_tree', {
    _academic_year_id: input.academic_year_id,
    _class_id: input.class_id,
    _subject_id: input.subject_id,
    _section_id: input.section_id ?? null,
  });
  if (error) throw new Error(describe(error));
  return (data as SyllabusTreeRow[]) ?? [];
}

export async function fetchSyllabusCoverage(academicYearId: string): Promise<SyllabusCoverageRow[]> {
  const { data, error } = await supabase.rpc('academics_syllabus_coverage', {
    _academic_year_id: academicYearId,
  });
  if (error) throw new Error(describe(error));
  return (data as SyllabusCoverageRow[]) ?? [];
}

export async function fetchSyllabusBySubject(academicYearId: string): Promise<SubjectCoverageRow[]> {
  const { data, error } = await supabase.rpc('admin_syllabus_by_subject', {
    _academic_year_id: academicYearId,
  });
  if (error) throw new Error(describe(error));
  return (data as SubjectCoverageRow[]) ?? [];
}

// ---------------------------------------------------------------------
// Unit / chapter / topic CRUD
// ---------------------------------------------------------------------

export async function fetchUnits(input: {
  academic_year_id: string;
  class_id: string;
  subject_id: string;
}): Promise<SyllabusUnit[]> {
  return unwrap(
    await supabase
      .from('syllabus_units')
      .select('*')
      .eq('academic_year_id', input.academic_year_id)
      .eq('class_id', input.class_id)
      .eq('subject_id', input.subject_id)
      .order('sequence'),
  );
}

export async function fetchChapters(unitIds: string[]): Promise<SyllabusChapter[]> {
  if (unitIds.length === 0) return [];
  return unwrap(
    await supabase.from('syllabus_chapters').select('*').in('unit_id', unitIds).order('sequence'),
  );
}

export async function fetchTopics(chapterIds: string[]): Promise<SyllabusTopic[]> {
  if (chapterIds.length === 0) return [];
  return unwrap(
    await supabase
      .from('syllabus_topics')
      .select('id, chapter_id, title, sequence')
      .in('chapter_id', chapterIds)
      .order('sequence'),
  );
}

export async function saveUnit(input: {
  id?: string;
  academic_year_id: string;
  class_id: string;
  subject_id: string;
  title: string;
  sequence: number;
  description?: string | null;
}): Promise<SyllabusUnit> {
  const payload = {
    academic_year_id: input.academic_year_id,
    class_id: input.class_id,
    subject_id: input.subject_id,
    title: input.title.trim(),
    sequence: input.sequence,
    description: input.description?.trim() || null,
  };
  const row = unwrap<SyllabusUnit>(
    input.id
      ? await supabase.from('syllabus_units').update(payload).eq('id', input.id).select().single()
      : await supabase.from('syllabus_units').insert([payload]).select().single(),
  );
  await logAudit(input.id ? 'SYLLABUS_UNIT_UPDATED' : 'SYLLABUS_UNIT_CREATED', 'syllabus_units', row.id, null, payload);
  return row;
}

export async function deleteUnit(unitId: string): Promise<void> {
  const { error } = await supabase.from('syllabus_units').delete().eq('id', unitId);
  if (error) throw new Error(describe(error));
  await logAudit('SYLLABUS_UNIT_DELETED', 'syllabus_units', unitId);
}

export async function saveChapter(input: {
  id?: string;
  unit_id: string;
  title: string;
  sequence: number;
  description?: string | null;
  expected_hours?: number | null;
}): Promise<SyllabusChapter> {
  const payload = {
    unit_id: input.unit_id,
    title: input.title.trim(),
    sequence: input.sequence,
    description: input.description?.trim() || null,
    expected_hours: input.expected_hours ?? null,
  };
  const row = unwrap<SyllabusChapter>(
    input.id
      ? await supabase.from('syllabus_chapters').update(payload).eq('id', input.id).select().single()
      : await supabase.from('syllabus_chapters').insert([payload]).select().single(),
  );
  await logAudit(input.id ? 'SYLLABUS_CHAPTER_UPDATED' : 'SYLLABUS_CHAPTER_CREATED', 'syllabus_chapters', row.id, null, payload);
  return row;
}

export async function deleteChapter(chapterId: string): Promise<void> {
  const { error } = await supabase.from('syllabus_chapters').delete().eq('id', chapterId);
  if (error) throw new Error(describe(error));
  await logAudit('SYLLABUS_CHAPTER_DELETED', 'syllabus_chapters', chapterId);
}

export async function saveTopic(input: {
  id?: string;
  chapter_id: string;
  title: string;
  sequence: number;
}): Promise<SyllabusTopic> {
  const payload = { chapter_id: input.chapter_id, title: input.title.trim(), sequence: input.sequence };
  return unwrap<SyllabusTopic>(
    input.id
      ? await supabase.from('syllabus_topics').update(payload).eq('id', input.id).select().single()
      : await supabase.from('syllabus_topics').insert([payload]).select().single(),
  );
}

export async function deleteTopic(topicId: string): Promise<void> {
  const { error } = await supabase.from('syllabus_topics').delete().eq('id', topicId);
  if (error) throw new Error(describe(error));
}

// ---------------------------------------------------------------------
// Teacher: chapter progress for a section
// ---------------------------------------------------------------------

export async function updateChapterProgress(input: {
  chapter_id: string;
  section_id: string;
  teacher_id: string;
  status: ChapterStatus;
  started_on?: string | null;
  completed_on?: string | null;
  notes?: string | null;
}): Promise<void> {
  const payload = {
    chapter_id: input.chapter_id,
    section_id: input.section_id,
    teacher_id: input.teacher_id,
    status: input.status,
    started_on:
      input.started_on ??
      (input.status !== 'not_started' ? new Date().toISOString().slice(0, 10) : null),
    completed_on:
      input.completed_on ??
      (input.status === 'completed' ? new Date().toISOString().slice(0, 10) : null),
    notes: input.notes?.trim() || null,
  };
  const { error } = await supabase
    .from('syllabus_progress')
    .upsert([payload], { onConflict: 'chapter_id,section_id' });
  if (error) throw new Error(describe(error));
  await logAudit('SYLLABUS_PROGRESS_UPDATED', 'syllabus_progress', null, null, payload);
}

// ---------------------------------------------------------------------
// Copy a whole year's syllabus into another year
// ---------------------------------------------------------------------

/**
 * Rebuilds every unit / chapter / topic from one year under another year,
 * for every class + subject. Existing units in the target year are left
 * alone (matched on class + subject + sequence), so this is safe to run
 * again and only fills gaps.
 */
export async function copySyllabusFromYear(fromYearId: string, toYearId: string): Promise<number> {
  const units = unwrap<SyllabusUnit[]>(
    await supabase.from('syllabus_units').select('*').eq('academic_year_id', fromYearId).order('sequence'),
  );
  if (units.length === 0) return 0;

  const existing = unwrap<Array<{ class_id: string; subject_id: string; sequence: number }>>(
    await supabase
      .from('syllabus_units')
      .select('class_id, subject_id, sequence')
      .eq('academic_year_id', toYearId),
  );
  const taken = new Set(existing.map(u => `${u.class_id}|${u.subject_id}|${u.sequence}`));

  const chapters = await fetchChapters(units.map(u => u.id));
  const topics = await fetchTopics(chapters.map(c => c.id));
  const chaptersByUnit = new Map<string, SyllabusChapter[]>();
  chapters.forEach(c => {
    const list = chaptersByUnit.get(c.unit_id) ?? [];
    list.push(c);
    chaptersByUnit.set(c.unit_id, list);
  });
  const topicsByChapter = new Map<string, SyllabusTopic[]>();
  topics.forEach(t => {
    const list = topicsByChapter.get(t.chapter_id) ?? [];
    list.push(t);
    topicsByChapter.set(t.chapter_id, list);
  });

  let copied = 0;
  for (const u of units) {
    if (taken.has(`${u.class_id}|${u.subject_id}|${u.sequence}`)) continue;
    const newUnit = unwrap<SyllabusUnit>(
      await supabase
        .from('syllabus_units')
        .insert([{
          academic_year_id: toYearId,
          class_id: u.class_id,
          subject_id: u.subject_id,
          title: u.title,
          sequence: u.sequence,
          description: u.description,
        }])
        .select()
        .single(),
    );
    copied += 1;

    for (const c of chaptersByUnit.get(u.id) ?? []) {
      const newChapter = unwrap<SyllabusChapter>(
        await supabase
          .from('syllabus_chapters')
          .insert([{
            unit_id: newUnit.id,
            title: c.title,
            sequence: c.sequence,
            description: c.description,
            expected_hours: c.expected_hours,
          }])
          .select()
          .single(),
      );
      const childTopics = topicsByChapter.get(c.id) ?? [];
      if (childTopics.length > 0) {
        const { error } = await supabase.from('syllabus_topics').insert(
          childTopics.map(t => ({ chapter_id: newChapter.id, title: t.title, sequence: t.sequence })),
        );
        if (error) throw new Error(describe(error));
      }
    }
  }

  await logAudit('SYLLABUS_COPIED', 'syllabus_units', null, { from: fromYearId }, { to: toYearId, units: copied });
  return copied;
}
