/**
 * The teacher's daily teaching workflow: today's periods, the per-class
 * workspace, lesson plans, homework / assignments and their submissions.
 *
 * Everything here is scoped to the signed-in teacher by row level
 * security (migration 18b) and by the read-model functions (18c), which
 * only ever return the teacher's own assigned classes. A teacher cannot
 * reach another teacher's class by changing an id.
 *
 * Academics owns the structure this hangs off; this module never creates
 * a class, section, subject or timetable slot.
 */
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

export type LessonPlanStatus = 'draft' | 'planned' | 'completed';
export type AssignmentKind = 'homework' | 'assignment';
export type AssignmentStatus = 'draft' | 'published' | 'closed';
export type SubmissionStatus = 'submitted' | 'late' | 'reviewed' | 'returned';

export interface TeacherTodayClass {
  slot_id: string;
  day: string;
  period_number: number | null;
  start_time: string | null;
  end_time: string | null;
  class_id: string;
  class_name: string;
  section_id: string | null;
  section_name: string | null;
  subject_id: string | null;
  subject_name: string | null;
  subject_code: string | null;
  room: string | null;
  students_total: number;
  attendance_marked: boolean;
  lesson_plan_id: string | null;
  lesson_plan_status: LessonPlanStatus | null;
  homework_count: number;
}

export interface TeacherClassWorkspace {
  students_total: number;
  attendance_marked: boolean;
  present_count: number;
  absent_count: number;
  late_count: number;
  leave_count: number;
  lesson_plan: LessonPlan | null;
  pending_homework: number;
  chapters_total: number;
  chapters_completed: number;
  syllabus_percent: number | null;
}

export interface TeacherAcademicSummary {
  my_classes: number;
  my_subjects: number;
  classes_today: number;
  pending_attendance: number;
  pending_lesson_plans: number;
  open_assignments: number;
  submissions_to_review: number;
  syllabus_percent: number | null;
}

export interface TeacherScopeRow {
  assignment_id: string;
  class_id: string;
  class_name: string;
  section_id: string;
  section_name: string;
  subject_id: string | null;
  subject_name: string | null;
  subject_code: string | null;
  assignment_type: string;
}

export interface LessonPlan {
  id: string;
  class_id: string | null;
  class_name: string | null;
  section_id: string | null;
  subject_id: string | null;
  subject_name: string | null;
  academic_year_id: string | null;
  chapter_id: string | null;
  topic: string;
  objectives: string | null;
  planned_date: string;
  completion_date: string | null;
  duration_minutes: number | null;
  teaching_method: string | null;
  resources: string | null;
  homework_text: string | null;
  outcome_notes: string | null;
  status: LessonPlanStatus;
  teacher_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Assignment {
  id: string;
  title: string;
  description: string | null;
  kind: AssignmentKind;
  status: AssignmentStatus;
  class_id: string | null;
  class: string | null;
  section_id: string | null;
  section: string | null;
  subject_id: string | null;
  teacher_id: string | null;
  academic_year_id: string | null;
  assigned_date: string;
  due_date: string | null;
  max_marks: number | null;
  attachment_url: string | null;
  created_at?: string;
  subjects?: { subject_name: string; subject_code: string | null } | null;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  student_name: string;
  roll_number: string;
  submission_text: string | null;
  submission_url: string | null;
  submitted_at: string | null;
  marks_obtained: number | null;
  feedback: string | null;
  status: SubmissionStatus;
  reviewed_at: string | null;
}

// ---------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------

function describe(error: { code?: string; message: string }): string {
  const raw = error.message || '';
  switch (error.code) {
    case '23505':
      return 'That record already exists.';
    case '23503':
      return 'A referenced class, section or subject no longer exists.';
    case '23514':
      return 'Some of those values are not allowed. Check the dates and status.';
    case '42501':
      return 'You can only work with classes you are assigned to.';
    default:
      return raw || 'The change could not be saved.';
  }
}

function unwrap<T>(res: { data: T | null; error: any }): T {
  if (res.error) throw new Error(describe(res.error));
  return res.data as T;
}

// ---------------------------------------------------------------------
// Who am I
// ---------------------------------------------------------------------

export interface CurrentTeacher {
  id: string;
  name: string;
  employee_id: string | null;
  designation: string | null;
  department: string | null;
}

/** The teachers row for the signed-in user, or null if they are not a teacher. */
export async function fetchCurrentTeacher(): Promise<CurrentTeacher | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('teachers')
    .select('id, name, employee_id, designation, department')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw new Error(describe(error));
  return (data as CurrentTeacher) ?? null;
}

// ---------------------------------------------------------------------
// Dashboards / read model
// ---------------------------------------------------------------------

export async function fetchTeacherToday(teacherId: string, date: string): Promise<TeacherTodayClass[]> {
  const { data, error } = await supabase.rpc('teacher_today_classes', {
    _teacher_id: teacherId,
    _on_date: date,
  });
  if (error) throw new Error(describe(error));
  return (data as TeacherTodayClass[]) ?? [];
}

export async function fetchTeacherClassWorkspace(input: {
  teacher_id: string;
  academic_year_id: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  date: string;
}): Promise<TeacherClassWorkspace | null> {
  const { data, error } = await supabase.rpc('teacher_class_workspace', {
    _teacher_id: input.teacher_id,
    _academic_year_id: input.academic_year_id,
    _class_id: input.class_id,
    _section_id: input.section_id,
    _subject_id: input.subject_id,
    _on_date: input.date,
  });
  if (error) throw new Error(describe(error));
  return (data as TeacherClassWorkspace[])?.[0] ?? null;
}

export async function fetchTeacherAcademicSummary(
  teacherId: string,
  academicYearId: string,
  date: string,
): Promise<TeacherAcademicSummary | null> {
  const { data, error } = await supabase.rpc('teacher_academic_summary', {
    _teacher_id: teacherId,
    _academic_year_id: academicYearId,
    _on_date: date,
  });
  if (error) throw new Error(describe(error));
  return (data as TeacherAcademicSummary[])?.[0] ?? null;
}

/** The teacher's class + section + subject grid for a year ("My Classes"). */
export async function fetchTeacherScope(
  teacherId: string,
  academicYearId: string,
): Promise<TeacherScopeRow[]> {
  const { data, error } = await supabase
    .from('teacher_assignments')
    .select(`
      id, class_id, section_id, subject_id, assignment_type,
      classes (class_name),
      sections (section_name),
      subjects (subject_name, subject_code)
    `)
    .eq('teacher_id', teacherId)
    .eq('academic_year_id', academicYearId)
    .eq('is_active', true);
  if (error) throw new Error(describe(error));
  return (data ?? []).map((r: any) => ({
    assignment_id: r.id,
    class_id: r.class_id,
    class_name: r.classes?.class_name ?? '—',
    section_id: r.section_id,
    section_name: r.sections?.section_name ?? '—',
    subject_id: r.subject_id,
    subject_name: r.subjects?.subject_name ?? null,
    subject_code: r.subjects?.subject_code ?? null,
    assignment_type: r.assignment_type,
  })).sort((a, b) =>
    a.class_name.localeCompare(b.class_name, undefined, { numeric: true }) ||
    a.section_name.localeCompare(b.section_name) ||
    (a.subject_name ?? '').localeCompare(b.subject_name ?? ''),
  );
}

// ---------------------------------------------------------------------
// Lesson plans
// ---------------------------------------------------------------------

export async function fetchLessonPlans(filter: {
  teacher_id: string;
  class_id?: string | null;
  section_id?: string | null;
  subject_id?: string | null;
  from?: string;
  to?: string;
  status?: LessonPlanStatus | 'all';
}): Promise<LessonPlan[]> {
  let q = supabase
    .from('lesson_plans')
    .select('*')
    .eq('teacher_id', filter.teacher_id)
    .order('planned_date', { ascending: false });
  if (filter.class_id) q = q.eq('class_id', filter.class_id);
  if (filter.section_id) q = q.eq('section_id', filter.section_id);
  if (filter.subject_id) q = q.eq('subject_id', filter.subject_id);
  if (filter.from) q = q.gte('planned_date', filter.from);
  if (filter.to) q = q.lte('planned_date', filter.to);
  if (filter.status && filter.status !== 'all') q = q.eq('status', filter.status);
  return unwrap(await q);
}

export async function saveLessonPlan(input: {
  id?: string;
  teacher_id: string;
  teacher_name?: string | null;
  class_id: string;
  class_name?: string | null;
  section_id: string | null;
  subject_id: string | null;
  subject_name?: string | null;
  academic_year_id: string;
  chapter_id?: string | null;
  topic: string;
  objectives?: string | null;
  planned_date: string;
  duration_minutes?: number | null;
  teaching_method?: string | null;
  resources?: string | null;
  homework_text?: string | null;
  status?: LessonPlanStatus;
}): Promise<LessonPlan> {
  const payload = {
    teacher_id: input.teacher_id,
    teacher_name: input.teacher_name ?? null,
    class_id: input.class_id,
    class_name: input.class_name ?? null,
    section_id: input.section_id,
    subject_id: input.subject_id,
    subject_name: input.subject_name ?? null,
    academic_year_id: input.academic_year_id,
    chapter_id: input.chapter_id ?? null,
    topic: input.topic.trim(),
    objectives: input.objectives?.trim() || null,
    planned_date: input.planned_date,
    duration_minutes: input.duration_minutes ?? 40,
    teaching_method: input.teaching_method?.trim() || null,
    resources: input.resources?.trim() || null,
    homework_text: input.homework_text?.trim() || null,
    status: input.status ?? 'planned',
  };
  const row = unwrap<LessonPlan>(
    input.id
      ? await supabase.from('lesson_plans').update(payload).eq('id', input.id).select().single()
      : await supabase.from('lesson_plans').insert([payload]).select().single(),
  );
  await logAudit(input.id ? 'LESSON_PLAN_UPDATED' : 'LESSON_PLAN_CREATED', 'lesson_plans', row.id, null, payload);
  return row;
}

export async function completeLessonPlan(id: string, outcomeNotes?: string | null): Promise<void> {
  const { error } = await supabase
    .from('lesson_plans')
    .update({
      status: 'completed',
      completion_date: new Date().toISOString().slice(0, 10),
      outcome_notes: outcomeNotes?.trim() || null,
    })
    .eq('id', id);
  if (error) throw new Error(describe(error));
  await logAudit('LESSON_PLAN_COMPLETED', 'lesson_plans', id, null, { outcome_notes: outcomeNotes ?? null });
}

export async function deleteLessonPlan(id: string): Promise<void> {
  const { error } = await supabase.from('lesson_plans').delete().eq('id', id);
  if (error) throw new Error(describe(error));
  await logAudit('LESSON_PLAN_DELETED', 'lesson_plans', id);
}

// ---------------------------------------------------------------------
// Homework / assignments
// ---------------------------------------------------------------------

export async function fetchAssignments(filter: {
  teacher_id?: string;
  academic_year_id?: string;
  class_id?: string | null;
  section_id?: string | null;
  subject_id?: string | null;
  kind?: AssignmentKind | 'all';
  status?: AssignmentStatus | 'all';
  due_from?: string;
  due_to?: string;
}): Promise<Assignment[]> {
  let q = supabase
    .from('assignments')
    .select('*, subjects (subject_name, subject_code)')
    .order('assigned_date', { ascending: false });
  if (filter.teacher_id) q = q.eq('teacher_id', filter.teacher_id);
  if (filter.academic_year_id) q = q.eq('academic_year_id', filter.academic_year_id);
  if (filter.class_id) q = q.eq('class_id', filter.class_id);
  if (filter.section_id) q = q.eq('section_id', filter.section_id);
  if (filter.subject_id) q = q.eq('subject_id', filter.subject_id);
  if (filter.kind && filter.kind !== 'all') q = q.eq('kind', filter.kind);
  if (filter.status && filter.status !== 'all') q = q.eq('status', filter.status);
  if (filter.due_from) q = q.gte('due_date', filter.due_from);
  if (filter.due_to) q = q.lte('due_date', filter.due_to);
  return unwrap(await q);
}

export async function saveAssignment(input: {
  id?: string;
  teacher_id: string;
  academic_year_id: string;
  class_id: string;
  section_id: string | null;
  subject_id: string | null;
  kind: AssignmentKind;
  title: string;
  description?: string | null;
  assigned_date: string;
  due_date: string | null;
  max_marks?: number | null;
  attachment_url?: string | null;
  status?: AssignmentStatus;
}): Promise<Assignment> {
  const payload = {
    teacher_id: input.teacher_id,
    academic_year_id: input.academic_year_id,
    class_id: input.class_id,
    section_id: input.section_id,
    subject_id: input.subject_id,
    kind: input.kind,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    assigned_date: input.assigned_date,
    due_date: input.due_date,
    max_marks: input.kind === 'assignment' ? (input.max_marks ?? null) : null,
    attachment_url: input.attachment_url?.trim() || null,
    status: input.status ?? 'published',
  };
  const row = unwrap<Assignment>(
    input.id
      ? await supabase.from('assignments').update(payload).eq('id', input.id).select('*, subjects (subject_name, subject_code)').single()
      : await supabase.from('assignments').insert([payload]).select('*, subjects (subject_name, subject_code)').single(),
  );
  await logAudit(
    input.id ? 'ASSIGNMENT_UPDATED' : (input.kind === 'homework' ? 'HOMEWORK_CREATED' : 'ASSIGNMENT_CREATED'),
    'assignments', row.id, null, payload,
  );
  return row;
}

export async function setAssignmentStatus(id: string, status: AssignmentStatus): Promise<void> {
  const { error } = await supabase.from('assignments').update({ status }).eq('id', id);
  if (error) throw new Error(describe(error));
  await logAudit('ASSIGNMENT_STATUS_CHANGED', 'assignments', id, null, { status });
}

export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await supabase.from('assignments').delete().eq('id', id);
  if (error) throw new Error(describe(error));
  await logAudit('ASSIGNMENT_DELETED', 'assignments', id);
}

// ---------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------

export async function fetchAssignmentSubmissions(assignmentId: string): Promise<AssignmentSubmission[]> {
  const { data, error } = await supabase
    .from('student_assignment_submissions')
    .select(`
      id, assignment_id, student_id, submission_text, submission_url, submitted_at,
      marks_obtained, feedback, status, reviewed_at,
      students (name, roll_number)
    `)
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: true });
  if (error) throw new Error(describe(error));
  return (data ?? []).map((r: any) => ({
    id: r.id,
    assignment_id: r.assignment_id,
    student_id: r.student_id,
    student_name: r.students?.name ?? 'Unknown',
    roll_number: r.students?.roll_number ?? '—',
    submission_text: r.submission_text,
    submission_url: r.submission_url,
    submitted_at: r.submitted_at,
    marks_obtained: r.marks_obtained,
    feedback: r.feedback,
    status: r.status,
    reviewed_at: r.reviewed_at,
  }));
}

export async function reviewSubmission(input: {
  id: string;
  teacher_id: string;
  marks_obtained?: number | null;
  feedback?: string | null;
  status?: Extract<SubmissionStatus, 'reviewed' | 'returned'>;
}): Promise<void> {
  const { error } = await supabase
    .from('student_assignment_submissions')
    .update({
      marks_obtained: input.marks_obtained ?? null,
      feedback: input.feedback?.trim() || null,
      status: input.status ?? 'reviewed',
      reviewed_at: new Date().toISOString(),
      reviewed_by: input.teacher_id,
    })
    .eq('id', input.id);
  if (error) throw new Error(describe(error));
  await logAudit('SUBMISSION_REVIEWED', 'student_assignment_submissions', input.id, null, {
    marks_obtained: input.marks_obtained ?? null,
    status: input.status ?? 'reviewed',
  });
}
