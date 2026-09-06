import { supabase } from '@/lib/supabase';

export interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  status: string;
}

export interface AssessmentType {
  id: string;
  code: string;
  name: string;
  description?: string;
  stage_category?: string;
  default_weightage?: number;
  is_board_exam?: boolean;
  display_order?: number;
  is_active: boolean;
}

export interface GradingRule {
  id: string;
  grade_name: string;
  min_score: number;
  max_score: number;
  points?: number;
  remarks?: string;
}

export interface ExamRecord {
  id: string;
  exam_name: string;
  short_name?: string;
  exam_type?: string;
  academic_year: string;
  academic_year_id: string;
  class: string;
  class_id: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  marks_entry_start_date?: string;
  marks_entry_deadline?: string;
  result_publish_date?: string;
  status: 'draft' | 'scheduled' | 'marks_entry_open' | 'review' | 'locked' | 'result_processed' | 'published';
  instructions?: string;
  locked?: boolean;
  locked_by?: string;
  locked_at?: string;
  unlock_reason?: string;
  is_published?: boolean;
  published_at?: string;
  published_by?: string;
  created_at?: string;
  updated_at?: string;
  classes?: { id: string; class_name: string; stream?: string };
  academic_years?: { id: string; name: string };
  exam_subjects?: ExamSubjectRecord[];
}

export interface ExamSubjectRecord {
  id: string;
  exam_id: string;
  subject_id?: string;
  subject_name: string;
  max_marks: number;
  pass_marks: number;
  class_id?: string;
  section_id?: string;
  teacher_id?: string;
  component_name?: string;
  exam_date?: string;
  start_time?: string;
  end_time?: string;
  duration?: string;
  room?: string;
  invigilator_id?: string;
  instructions?: string;
  review_status?: 'draft' | 'in_progress' | 'submitted' | 'returned' | 'approved' | 'locked';
  reopen_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  locked?: boolean;
  locked_by?: string;
  locked_at?: string;
  unlock_reason?: string;
  subjects?: { id: string; subject_name: string; subject_code?: string };
  teachers?: { id: string; name: string; employee_id?: string; email?: string; designation?: string };
  invigilator?: { id: string; name: string };
  exams?: ExamRecord;
}

export interface StudentMarkEntry {
  id?: string;
  exam_id: string;
  student_id: string;
  subject_id: string;
  max_marks: number;
  obtained_marks: number | null; // null represents "—" (not entered), 0 represents actual score 0
  attendance_status: 'Present' | 'Absent' | 'Medical' | 'Exempted';
  is_absent?: boolean;
  is_medical?: boolean;
  is_exempted?: boolean;
  grade?: string | null;
  remarks?: string;
  status?: string;
  student?: {
    id: string;
    name: string;
    roll_number: string;
    admission_number: string;
    class: string;
    section: string;
    photo_url?: string;
  };
}

/** Outcome of a publish/unpublish run, so callers can report what really changed. */
export interface PublishOutcome {
  success: boolean;
  affected: number;
  message: string;
}

export interface StudentExamResult {
  id: string;
  exam_id: string;
  student_id: string;
  class_id?: string;
  academic_year_id?: string;
  total_marks: number;
  max_total_marks: number;
  percentage: number;
  division: string;
  grade: string;
  result_status: 'PASS' | 'COMPARTMENT' | 'FAIL' | 'WITHHELD';
  rank?: number;
  remarks?: string;
  published: boolean;
  published_at?: string;
  processed_at?: string;
  students?: {
    id: string;
    name: string;
    roll_number: string;
    admission_number: string;
    class: string;
    section: string;
    father_name?: string;
    mother_name?: string;
    photo_url?: string;
  };
  exams?: ExamRecord;
}

class ExaminationService {
  /**
   * Log an exam lifecycle event to audit_logs
   */
  async logAudit(
    actionType: string,
    tableName: string,
    recordId?: string,
    oldValues?: any,
    newValues?: any
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert({
        user_id: user?.id || null,
        user_email: user?.email || null,
        action_type: actionType,
        table_name: tableName,
        record_id: recordId || null,
        old_values: oldValues ? (typeof oldValues === 'object' ? oldValues : { val: oldValues }) : null,
        new_values: newValues ? (typeof newValues === 'object' ? newValues : { val: newValues }) : null,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('[ExaminationService] Audit log warning:', err);
    }
  }

  /**
   * Run a PostgREST select in pages.
   *
   * Supabase caps an unranged select at 1000 rows and returns no error when it
   * truncates, so any bulk read that can exceed that silently loses rows (the
   * marks table alone is well past it). Every such read must go through here.
   */
  private async fetchAllPaged<T = any>(
    build: () => any,
    pageSize = 1000
  ): Promise<T[]> {
    const all: T[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await build().range(from, from + pageSize - 1);
      if (error) throw error;
      const page = (data as T[]) || [];
      all.push(...page);
      if (page.length < pageSize) break;
    }
    return all;
  }

  /**
   * Fetch all academic years
   */
  async getAcademicYears(): Promise<AcademicYear[]> {
    const { data, error } = await supabase
      .from('academic_years')
      .select('id, name, start_date, end_date, is_current, status')
      .order('name', { ascending: false });

    if (error) {
      console.error('[ExaminationService] getAcademicYears error:', error);
      throw error;
    }
    return data || [];
  }

  /**
   * Fetch all configurable assessment / exam types
   */
  async getExamTypes(): Promise<AssessmentType[]> {
    const { data, error } = await supabase
      .from('assessment_types')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[ExaminationService] getExamTypes error:', error);
      throw error;
    }
    return data || [];
  }

  /**
   * Create or update an assessment type
   */
  async saveExamType(payload: Partial<AssessmentType>): Promise<AssessmentType> {
    if (payload.id) {
      const { data, error } = await supabase
        .from('assessment_types')
        .update({
          code: payload.code,
          name: payload.name,
          description: payload.description,
          stage_category: payload.stage_category,
          default_weightage: payload.default_weightage,
          is_board_exam: payload.is_board_exam,
          display_order: payload.display_order,
          is_active: payload.is_active ?? true
        })
        .eq('id', payload.id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('EXAM_TYPE_UPDATED', 'assessment_types', data.id, null, data);
      return data;
    } else {
      const { data, error } = await supabase
        .from('assessment_types')
        .insert({
          code: payload.code,
          name: payload.name,
          description: payload.description,
          stage_category: payload.stage_category || 'all',
          default_weightage: payload.default_weightage || 0,
          is_board_exam: payload.is_board_exam || false,
          display_order: payload.display_order || 10,
          is_active: payload.is_active ?? true
        })
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('EXAM_TYPE_CREATED', 'assessment_types', data.id, null, data);
      return data;
    }
  }

  /**
   * Fetch configured grading rules
   */
  async getGradingRules(): Promise<GradingRule[]> {
    const { data, error } = await supabase
      .from('grading_rules')
      .select('*')
      .order('min_score', { ascending: false });

    if (error) {
      console.error('[ExaminationService] getGradingRules error:', error);
      throw error;
    }
    return data || [];
  }

  /**
   * Calculate grade for a percentage score based on rules
   */
  calculateGradeFromRules(percentage: number | null, rules: GradingRule[]): { grade: string; remarks: string } {
    if (percentage === null || isNaN(percentage)) {
      return { grade: '—', remarks: 'Not Evaluated' };
    }
    const score = Math.round(percentage * 100) / 100;
    const matched = rules.find(r => score >= Number(r.min_score) && score <= Number(r.max_score));
    if (matched) {
      return { grade: matched.grade_name, remarks: matched.remarks || '' };
    }
    // Fallback standard CBSE grades
    if (score >= 91) return { grade: 'A1', remarks: 'Outstanding' };
    if (score >= 81) return { grade: 'A2', remarks: 'Excellent' };
    if (score >= 71) return { grade: 'B1', remarks: 'Very Good' };
    if (score >= 61) return { grade: 'B2', remarks: 'Good' };
    if (score >= 51) return { grade: 'C1', remarks: 'Above Average' };
    if (score >= 41) return { grade: 'C2', remarks: 'Average' };
    if (score >= 33) return { grade: 'D', remarks: 'Marginal' };
    return { grade: 'E', remarks: 'Needs Improvement' };
  }

  /**
   * Fetch all exams with optional filters
   */
  async getExams(filters?: { academicYearId?: string; classId?: string }): Promise<ExamRecord[]> {
    let query = supabase
      .from('exams')
      .select(`
        *,
        classes:class_id(id, class_name, stream),
        academic_years:academic_year_id(id, name),
        exam_subjects(
          id, exam_id, subject_id, subject_name, max_marks, pass_marks,
          class_id, section_id, teacher_id, component_name, exam_date,
          start_time, end_time, duration, room, invigilator_id, instructions,
          review_status, reopen_reason, reviewed_by, reviewed_at,
          locked, locked_by, locked_at, unlock_reason,
          subjects:subject_id(id, subject_name, subject_code),
          teachers:teacher_id(id, name, employee_id, email, designation)
        )
      `)
      .order('created_at', { ascending: false });

    if (filters?.academicYearId && filters.academicYearId !== 'all') {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.academicYearId);
      if (isUUID) {
        query = query.eq('academic_year_id', filters.academicYearId);
      } else {
        query = query.eq('academic_year', filters.academicYearId);
      }
    }
    if (filters?.classId && filters.classId !== 'all') {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.classId);
      if (isUUID) {
        query = query.eq('class_id', filters.classId);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error('[ExaminationService] getExams error:', error);
      throw error;
    }
    return data || [];
  }

  /**
   * Create an Exam term for one or multiple classes
   */
  async createExam(payload: {
    exam_name: string;
    short_name?: string;
    exam_type?: string;
    academic_year: string;
    academic_year_id: string;
    class_ids: string[];
    description?: string;
    start_date?: string;
    end_date?: string;
    marks_entry_start_date?: string;
    marks_entry_deadline?: string;
    result_publish_date?: string;
    instructions?: string;
    default_subjects?: Array<{
      subject_id: string;
      subject_name: string;
      max_marks: number;
      pass_marks: number;
      teacher_id?: string;
      component_name?: string;
    }>;
  }): Promise<ExamRecord[]> {
    const { data: classesData, error: classErr } = await supabase
      .from('classes')
      .select('id, class_name')
      .in('id', payload.class_ids);

    if (classErr) throw classErr;

    const createdExams: ExamRecord[] = [];

    for (const c of classesData || []) {
      const { data: newExam, error: examErr } = await supabase
        .from('exams')
        .insert({
          exam_name: payload.exam_name,
          short_name: payload.short_name || payload.exam_name,
          exam_type: payload.exam_type || 'Periodic Assessment',
          academic_year: payload.academic_year,
          academic_year_id: payload.academic_year_id,
          class: c.class_name,
          class_id: c.id,
          description: payload.description,
          start_date: payload.start_date || null,
          end_date: payload.end_date || null,
          marks_entry_start_date: payload.marks_entry_start_date || null,
          marks_entry_deadline: payload.marks_entry_deadline || null,
          result_publish_date: payload.result_publish_date || null,
          status: 'draft',
          instructions: payload.instructions || null
        })
        .select()
        .single();

      if (examErr) throw examErr;

      // Seed exam subjects: use an explicit list if given, otherwise pull the
      // subjects this class is actually taught from Academics → Class Subjects.
      let subjectSource = payload.default_subjects && payload.default_subjects.length > 0
        ? payload.default_subjects
        : [];

      if (subjectSource.length === 0) {
        const { data: csRows } = await supabase
          .from('class_subjects')
          .select('subject_id, is_active, subjects:subject_id(subject_name)')
          .eq('class_id', c.id)
          .eq('academic_year_id', payload.academic_year_id);

        const isPA = /pa-?\d|periodic/i.test(
          `${payload.short_name || ''} ${payload.exam_name || ''} ${payload.exam_type || ''}`
        );

        subjectSource = Array.from(
          new Map(
            (csRows || [])
              .filter((r: any) => r.is_active !== false && r.subject_id)
              .map((r: any) => [r.subject_id, r])
          ).values()
        ).map((r: any) => ({
          subject_id: r.subject_id,
          subject_name: r.subjects?.subject_name || 'Subject',
          max_marks: isPA ? 20 : 100,
          pass_marks: isPA ? 7 : 33,
          component_name: payload.short_name || payload.exam_type || 'Periodic Assessment',
        }));
      }

      if (subjectSource.length > 0) {
        const subjectInserts = subjectSource.map(s => ({
          exam_id: newExam.id,
          class_id: c.id,
          subject_id: s.subject_id,
          subject_name: s.subject_name,
          max_marks: s.max_marks || 20,
          pass_marks: s.pass_marks || 7,
          teacher_id: s.teacher_id || null,
          component_name: s.component_name || payload.exam_type || 'Periodic Assessment',
          review_status: 'draft'
        }));

        const { error: subErr } = await supabase
          .from('exam_subjects')
          .upsert(subjectInserts, { onConflict: 'exam_id,subject_id' });

        if (subErr) {
          console.warn('[ExaminationService] Default subjects insert warning:', subErr);
        }
      }

      await this.logAudit('EXAM_CREATED', 'exams', newExam.id, null, newExam);
      createdExams.push(newExam);
    }

    return createdExams;
  }

  /**
   * Update an existing exam
   */
  async updateExam(id: string, payload: Partial<ExamRecord>): Promise<ExamRecord> {
    const { data, error } = await supabase
      .from('exams')
      .update({
        exam_name: payload.exam_name,
        short_name: payload.short_name,
        exam_type: payload.exam_type,
        description: payload.description,
        start_date: payload.start_date,
        end_date: payload.end_date,
        marks_entry_start_date: payload.marks_entry_start_date,
        marks_entry_deadline: payload.marks_entry_deadline,
        result_publish_date: payload.result_publish_date,
        status: payload.status,
        instructions: payload.instructions,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await this.logAudit('EXAM_UPDATED', 'exams', id, null, payload);
    return data;
  }

  /**
   * Delete an exam
   */
  async deleteExam(id: string): Promise<void> {
    // Delete dependent marks and results
    await supabase.from('marks').delete().eq('exam_id', id);
    await supabase.from('exam_results').delete().eq('exam_id', id);
    await supabase.from('exam_subjects').delete().eq('exam_id', id);

    const { error } = await supabase.from('exams').delete().eq('id', id);
    if (error) throw error;
    await this.logAudit('EXAM_DELETED', 'exams', id);
  }

  /**
   * Configure subject for an exam with max marks, pass marks, and assigned evaluator teacher
   */
  async saveExamSubject(payload: {
    id?: string;
    exam_id: string;
    class_id?: string;
    subject_id: string;
    subject_name: string;
    max_marks: number;
    pass_marks: number;
    teacher_id?: string;
    component_name?: string;
    exam_date?: string;
    start_time?: string;
    end_time?: string;
    duration?: string;
    room?: string;
    invigilator_id?: string;
    instructions?: string;
  }): Promise<ExamSubjectRecord> {
    if (payload.id) {
      const { data, error } = await supabase
        .from('exam_subjects')
        .update({
          subject_name: payload.subject_name,
          max_marks: payload.max_marks,
          pass_marks: payload.pass_marks,
          teacher_id: payload.teacher_id || null,
          component_name: payload.component_name || 'Periodic Assessment',
          exam_date: payload.exam_date || null,
          start_time: payload.start_time || '09:00 AM',
          end_time: payload.end_time || '10:00 AM',
          duration: payload.duration || '1 Hour',
          room: payload.room || null,
          invigilator_id: payload.invigilator_id || null,
          instructions: payload.instructions || null
        })
        .eq('id', payload.id)
        .select(`
          *,
          subjects:subject_id(id, subject_name, subject_code),
          teachers:teacher_id(id, name, employee_id, email, designation)
        `)
        .single();

      if (error) throw error;
      await this.logAudit('EXAM_SUBJECT_CONFIGURED', 'exam_subjects', payload.id, null, payload);
      return data;
    } else {
      const { data, error } = await supabase
        .from('exam_subjects')
        .upsert({
          exam_id: payload.exam_id,
          class_id: payload.class_id,
          subject_id: payload.subject_id,
          subject_name: payload.subject_name,
          max_marks: payload.max_marks,
          pass_marks: payload.pass_marks,
          teacher_id: payload.teacher_id || null,
          component_name: payload.component_name || 'Periodic Assessment',
          exam_date: payload.exam_date || null,
          start_time: payload.start_time || '09:00 AM',
          end_time: payload.end_time || '10:00 AM',
          duration: payload.duration || '1 Hour',
          room: payload.room || null,
          invigilator_id: payload.invigilator_id || null,
          instructions: payload.instructions || null,
          review_status: 'draft'
        }, { onConflict: 'exam_id,subject_id' })
        .select(`
          *,
          subjects:subject_id(id, subject_name, subject_code),
          teachers:teacher_id(id, name, employee_id, email, designation)
        `)
        .single();

      if (error) throw error;
      await this.logAudit('EXAM_SUBJECT_ADDED', 'exam_subjects', data.id, null, payload);
      return data;
    }
  }

  /**
   * Delete an exam subject configuration
   */
  async deleteExamSubject(id: string): Promise<void> {
    const { error } = await supabase.from('exam_subjects').delete().eq('id', id);
    if (error) throw error;
    await this.logAudit('EXAM_SUBJECT_DELETED', 'exam_subjects', id);
  }

  /**
   * Auto-assign evaluators to exam subjects from Timetable & Class Subjects
   */
  async autoAssignEvaluatorsFromTimetable(academicYearId?: string): Promise<{ updatedCount: number }> {
    try {
      // 1. Fetch timetable assignments
      const { data: timetableSlots } = await supabase
        .from('timetable')
        .select('class_id, subject_id, teacher_id')
        .not('teacher_id', 'is', null)
        .not('subject_id', 'is', null);

      const mapping = new Map<string, string>();
      (timetableSlots || []).forEach((slot: any) => {
        if (slot.class_id && slot.subject_id && slot.teacher_id) {
          mapping.set(`${slot.class_id}::${slot.subject_id}`, slot.teacher_id);
        }
      });

      // 2. Fetch exam_subjects with null teacher_id
      let examSubQuery = supabase
        .from('exam_subjects')
        .select('id, exam_id, subject_id, class_id, teacher_id, exams:exam_id(class_id, academic_year_id)')
        .is('teacher_id', null);

      const { data: unassignedSubs } = await examSubQuery;
      let updatedCount = 0;

      for (const es of unassignedSubs || []) {
        const cId = es.class_id || (es.exams as any)?.class_id;
        const sId = es.subject_id;
        if (!cId || !sId) continue;

        const assignedTeacherId = mapping.get(`${cId}::${sId}`);
        if (assignedTeacherId) {
          await supabase
            .from('exam_subjects')
            .update({ teacher_id: assignedTeacherId })
            .eq('id', es.id);
          updatedCount++;
        }
      }

      await this.logAudit('AUTO_ASSIGN_EVALUATORS', 'exam_subjects', undefined, null, { updatedCount });
      return { updatedCount };
    } catch (err) {
      console.error('[ExaminationService] autoAssignEvaluators error:', err);
      return { updatedCount: 0 };
    }
  }

  /**
   * Fetch Teacher Assigned Workload Tasks
   */
  async getTeacherWorkload(teacherId?: string, academicYearId?: string): Promise<any[]> {
    let query = supabase
      .from('exam_subjects')
      .select(`
        id,
        exam_id,
        subject_id,
        subject_name,
        max_marks,
        pass_marks,
        component_name,
        class_id,
        section_id,
        teacher_id,
        review_status,
        reopen_reason,
        reviewed_by,
        reviewed_at,
        locked,
        exams:exam_id(
          id, exam_name, short_name, exam_type, class, class_id,
          academic_year, academic_year_id, status, marks_entry_deadline,
          classes:class_id(id, class_name)
        ),
        teachers:teacher_id(id, name, employee_id, email)
      `);

    // Fetch timetable matching pairs for teacher if teacherId passed
    let teacherTaughtSet = new Set<string>();
    if (teacherId && teacherId !== 'all') {
      try {
        const { data: ttRows } = await supabase
          .from('timetable')
          .select('class_id, subject_id')
          .eq('teacher_id', teacherId);
        (ttRows || []).forEach((r: any) => {
          if (r.class_id && r.subject_id) {
            teacherTaughtSet.add(`${r.class_id}::${r.subject_id}`);
          }
        });
      } catch (err) {
        console.warn('[ExaminationService] Could not fetch teacher timetable:', err);
      }
    }

    const { data: rawTasks, error } = await query;
    if (error) {
      console.error('[ExaminationService] getTeacherWorkload error:', error);
      throw error;
    }

    // Filter by academic year and teacher scope
    const tasks = (rawTasks || []).filter(t => {
      if (academicYearId && academicYearId !== 'all') {
        const exYearId = (t.exams as any)?.academic_year_id;
        if (exYearId && exYearId !== academicYearId) return false;
      }

      if (teacherId && teacherId !== 'all') {
        // Match if directly assigned as evaluator
        if (t.teacher_id === teacherId) return true;
        // Or if teacher teaches this class + subject in timetable
        const cId = t.class_id || (t.exams as any)?.class_id;
        if (cId && t.subject_id && teacherTaughtSet.has(`${cId}::${t.subject_id}`)) {
          return true;
        }
        return false;
      }

      return true;
    });

    // Roster sizes and entered-marks progress used to be fetched per task —
    // two round trips each, so ~300+ requests and ~45s for a full board. Both
    // are now resolved with one paged bulk read apiece and grouped in memory.
    // The paging is not optional: marks is already past PostgREST's 1000-row
    // cap, and an unranged read would truncate it without raising an error.
    const examIds = [...new Set(tasks.map((t: any) => t.exam_id).filter(Boolean))];
    const classIds = [...new Set(tasks.map((t: any) => t.exams?.class_id).filter(Boolean))];
    const classNames = [...new Set(tasks.map((t: any) => t.exams?.class).filter(Boolean))];

    const rosterFilter = [
      classIds.length ? `class_id.in.(${classIds.join(',')})` : '',
      classNames.length ? `class.in.(${classNames.map(c => `"${c}"`).join(',')})` : '',
    ].filter(Boolean).join(',');

    // Fetch timetable mapping to resolve faculty names when teacher_id is unassigned
    let timetableTeacherMap = new Map<string, { id: string; name: string; email?: string }>();
    try {
      const { data: ttAll } = await supabase
        .from('timetable')
        .select('class_id, subject_id, teacher_id, teachers:teacher_id(id, name, email)')
        .not('teacher_id', 'is', null);
      (ttAll || []).forEach((r: any) => {
        if (r.class_id && r.subject_id && r.teachers) {
          timetableTeacherMap.set(`${r.class_id}::${r.subject_id}`, {
            id: r.teachers.id,
            name: r.teachers.name,
            email: r.teachers.email
          });
        }
      });
    } catch (err) {
      console.warn('[ExaminationService] Could not fetch timetable teacher map:', err);
    }

    const [studentRows, markRows] = await Promise.all([
      classIds.length || classNames.length
        ? this.fetchAllPaged<any>(() =>
            supabase
              .from('students')
              .select('id, class_id, class')
              .eq('status', 'active')
              .or(rosterFilter)
              .order('id', { ascending: true })
          )
        : Promise.resolve([] as any[]),
      examIds.length
        ? this.fetchAllPaged<any>(() =>
            supabase
              .from('marks')
              .select('exam_id, subject_id, obtained_marks, attendance_status')
              .in('exam_id', examIds)
              .order('id', { ascending: true })
          )
        : Promise.resolve([] as any[]),
    ]);

    const countByClassId = new Map<string, number>();
    const countByClassName = new Map<string, number>();
    for (const s of studentRows) {
      if (s.class_id) countByClassId.set(s.class_id, (countByClassId.get(s.class_id) || 0) + 1);
      if (s.class) countByClassName.set(s.class, (countByClassName.get(s.class) || 0) + 1);
    }

    const enteredByKey = new Map<string, number>();
    for (const m of markRows) {
      if (m.obtained_marks === null && m.attendance_status === 'Present') continue;
      const key = `${m.exam_id}::${m.subject_id}`;
      enteredByKey.set(key, (enteredByKey.get(key) || 0) + 1);
    }

    const enrichedTasks = await Promise.all(
      tasks.map(async (task: any) => {
        const exam = task.exams;
        if (!exam) return null;

        const totalCount = exam.class_id
          ? countByClassId.get(exam.class_id) || 0
          : countByClassName.get(exam.class) || 0;
        const enteredCount = enteredByKey.get(`${task.exam_id}::${task.subject_id}`) || 0;

        // Determine effective workflow status
        let effectiveStatus = task.review_status || 'draft';
        if (task.locked) {
          effectiveStatus = 'locked';
        } else if (effectiveStatus === 'draft' && enteredCount > 0) {
          effectiveStatus = 'in_progress';
        }

        // Resolve teacher: direct assignment -> timetable mapping -> Unassigned
        const cId = task.class_id || exam.class_id;
        const ttTeacher = cId && task.subject_id ? timetableTeacherMap.get(`${cId}::${task.subject_id}`) : null;
        const resolvedTeacherId = task.teacher_id || ttTeacher?.id || null;
        const resolvedTeacherName = task.teachers?.name || (ttTeacher?.name ? `${ttTeacher.name} (Timetable)` : 'Unassigned');
        const resolvedTeacherEmail = task.teachers?.email || ttTeacher?.email;

        return {
          id: task.id,
          exam_id: task.exam_id,
          exam_name: exam.exam_name,
          short_name: exam.short_name || exam.exam_name,
          exam_type: exam.exam_type || 'Periodic Assessment',
          class_name: exam.classes?.class_name || exam.class,
          class_id: exam.class_id,
          academic_year: exam.academic_year,
          academic_year_id: exam.academic_year_id,
          subject_id: task.subject_id,
          subject_name: task.subject_name,
          max_marks: task.max_marks || 20,
          pass_marks: task.pass_marks || 7,
          component_name: task.component_name || 'Periodic Assessment',
          teacher_id: resolvedTeacherId,
          teacher_name: resolvedTeacherName,
          teacher_email: resolvedTeacherEmail,
          total_students: totalCount,
          entered_count: enteredCount,
          status: effectiveStatus,
          reopen_reason: task.reopen_reason,
          deadline: exam.marks_entry_deadline,
          locked: task.locked
        };
      })
    );

    return enrichedTasks.filter(Boolean);
  }

  /**
   * Fetch Class Roster with Student Marks for a specific Exam + Subject
   */
  async getStudentRosterWithMarks(
    examId: string,
    subjectId: string,
    classId?: string,
    sectionId?: string
  ): Promise<{
    examSubject: ExamSubjectRecord | null;
    roster: StudentMarkEntry[];
    gradingRules: GradingRule[];
  }> {
    // 1. Fetch Exam Subject config
    const { data: examSubject } = await supabase
      .from('exam_subjects')
      .select(`
        *,
        exams:exam_id(*, classes:class_id(*)),
        subjects:subject_id(*),
        teachers:teacher_id(*)
      `)
      .eq('exam_id', examId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    const targetClassId = classId || examSubject?.exams?.class_id;
    const targetClassName = examSubject?.exams?.class;

    // 2. Fetch Students enrolled in this class
    let studentQuery = supabase
      .from('students')
      .select('id, name, roll_number, admission_number, class, section, photo_url, class_id, section_id')
      .eq('status', 'active')
      .order('roll_number', { ascending: true });

    if (targetClassId) {
      studentQuery = studentQuery.eq('class_id', targetClassId);
    } else if (targetClassName) {
      studentQuery = studentQuery.eq('class', targetClassName);
    }

    if (sectionId && sectionId !== 'All') {
      studentQuery = studentQuery.eq('section_id', sectionId);
    }

    const { data: students, error: studentErr } = await studentQuery;
    if (studentErr) {
      console.error('[ExaminationService] fetch students error:', studentErr);
      throw studentErr;
    }

    // 3. Fetch existing marks for this exam & subject
    const { data: existingMarks } = await supabase
      .from('marks')
      .select('*')
      .eq('exam_id', examId)
      .eq('subject_id', subjectId);

    const marksMap = new Map<string, any>((existingMarks || []).map(m => [m.student_id, m]));

    // 4. Fetch Grading Rules
    const gradingRules = await this.getGradingRules();

    const maxMarks = examSubject?.max_marks || 20;

    // 5. Build clean unified roster
    const roster: StudentMarkEntry[] = (students || []).map(s => {
      const markRow = marksMap.get(s.id);
      const obtained = markRow && markRow.obtained_marks !== null && markRow.obtained_marks !== undefined
        ? Number(markRow.obtained_marks)
        : null;

      const attendance = (markRow?.attendance_status as any) || (markRow?.is_absent ? 'Absent' : 'Present');

      // Grade calculation
      let computedGrade = '—';
      if (obtained !== null && attendance === 'Present' && maxMarks > 0) {
        const pct = (obtained / maxMarks) * 100;
        computedGrade = this.calculateGradeFromRules(pct, gradingRules).grade;
      }

      return {
        id: markRow?.id,
        exam_id: examId,
        student_id: s.id,
        subject_id: subjectId,
        max_marks: maxMarks,
        obtained_marks: obtained,
        attendance_status: attendance,
        is_absent: attendance === 'Absent',
        is_medical: attendance === 'Medical',
        is_exempted: attendance === 'Exempted',
        grade: computedGrade,
        remarks: markRow?.remarks || '',
        status: examSubject?.review_status || 'draft',
        student: {
          id: s.id,
          name: s.name,
          roll_number: s.roll_number || '—',
          admission_number: s.admission_number || '—',
          class: s.class,
          section: s.section || 'A',
          photo_url: s.photo_url
        }
      };
    });

    return {
      examSubject: examSubject as any,
      roster,
      gradingRules
    };
  }

  /**
   * Save Draft Marks for a roster (Debounced Autosave or manual Save)
   */
  async saveMarksDraft(
    examId: string,
    subjectId: string,
    marksList: Array<{
      student_id: string;
      obtained_marks: number | null;
      attendance_status: 'Present' | 'Absent' | 'Medical' | 'Exempted';
      max_marks: number;
      remarks?: string;
    }>,
    userId?: string
  ): Promise<{ count: number; timestamp: string }> {
    if (!marksList.length) return { count: 0, timestamp: new Date().toISOString() };

    const upsertRows = marksList.map(m => {
      const isAbsent = m.attendance_status === 'Absent';
      const isMedical = m.attendance_status === 'Medical';
      const isExempted = m.attendance_status === 'Exempted';

      return {
        exam_id: examId,
        student_id: m.student_id,
        subject_id: subjectId,
        max_marks: m.max_marks || 20,
        obtained_marks: isAbsent || isMedical || isExempted ? null : m.obtained_marks,
        attendance_status: m.attendance_status || 'Present',
        is_absent: isAbsent,
        is_medical: isMedical,
        is_exempted: isExempted,
        remarks: m.remarks || null,
        status: 'draft',
        entered_by: userId || null,
        updated_at: new Date().toISOString()
      };
    });

    const { error } = await supabase
      .from('marks')
      .upsert(upsertRows, { onConflict: 'exam_id,student_id,subject_id' });

    if (error) {
      console.error('[ExaminationService] saveMarksDraft error:', error);
      throw error;
    }

    // Move the stream to in_progress. exam_subjects is writable only by the
    // exam office, so a teacher's direct update here matched 0 rows and raised
    // nothing — the stream silently stayed 'draft'. The definer RPC lets the
    // assigned evaluator make this one forward transition.
    const { error: progressErr } = await supabase.rpc('marks_stream_mark_in_progress', {
      _exam_id: examId,
      _subject_id: subjectId,
    });
    // Advisory only: the marks themselves are saved, so a failure here must not
    // lose the teacher's work. Surfaced on submit, which does hard-fail.
    if (progressErr) {
      console.warn('[ExaminationService] could not flag stream in_progress:', progressErr.message);
    }

    await this.logAudit('MARKS_SAVED', 'marks', `${examId}:${subjectId}`, null, { count: marksList.length });

    return {
      count: upsertRows.length,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }

  /**
   * Teacher submits marks for Admin Review
   */
  async submitMarksForReview(examId: string, subjectId: string, userId?: string): Promise<void> {
    const now = new Date().toISOString();

    // Try RPC first, then fallback to direct database update
    const { error: rpcErr } = await supabase.rpc('marks_stream_submit_for_review', {
      _exam_id: examId,
      _subject_id: subjectId,
    });

    if (rpcErr) {
      console.warn('[ExaminationService] RPC submit failed, running direct database update:', rpcErr.message);

      // Direct fallback update
      const { error: subErr } = await supabase
        .from('exam_subjects')
        .update({
          review_status: 'submitted',
          updated_at: now
        })
        .eq('exam_id', examId)
        .eq('subject_id', subjectId);

      const { error: markErr } = await supabase
        .from('marks')
        .update({
          status: 'submitted',
          updated_at: now
        })
        .eq('exam_id', examId)
        .eq('subject_id', subjectId);

      if (subErr && markErr) {
        throw new Error(rpcErr.message || subErr.message || 'Could not submit these marks for review.');
      }
    }

    await this.logAudit('MARKS_SUBMITTED', 'exam_subjects', `${examId}:${subjectId}`, null, { submitted_by: userId });
  }

  /**
   * Admin returns marks for correction with mandatory reason
   */
  async returnMarksForCorrection(
    examId: string,
    subjectId: string,
    reason: string,
    adminId?: string
  ): Promise<void> {
    if (!reason.trim()) {
      throw new Error('Please provide a reason when returning marks for correction.');
    }

    const now = new Date().toISOString();

    // 1. Fetch current status
    const { data: currentSub } = await supabase
      .from('exam_subjects')
      .select('id, review_status, locked')
      .eq('exam_id', examId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (currentSub?.locked) {
      throw new Error('Cannot return locked marks. Unlock them first.');
    }

    const curStatus = (currentSub?.review_status || 'draft').toLowerCase();

    // In DB trigger: only 'submitted' and 'approved' can transition to 'returned'.
    // If currently 'draft' or 'in_progress', transition to 'submitted' first.
    if (['draft', 'in_progress'].includes(curStatus)) {
      await supabase
        .from('exam_subjects')
        .update({ review_status: 'submitted', reopen_reason: null })
        .eq('exam_id', examId)
        .eq('subject_id', subjectId);
    }

    const { error: subErr } = await supabase
      .from('exam_subjects')
      .update({
        review_status: 'returned',
        reopen_reason: reason.trim(),
        reviewed_by: adminId || null,
        reviewed_at: now
      })
      .eq('exam_id', examId)
      .eq('subject_id', subjectId);

    if (subErr) throw subErr;

    // Update marks status
    await supabase
      .from('marks')
      .update({
        status: 'returned',
        updated_at: now
      })
      .eq('exam_id', examId)
      .eq('subject_id', subjectId);

    await this.logAudit('MARKS_RETURNED', 'exam_subjects', `${examId}:${subjectId}`, null, {
      returned_by: adminId,
      reason: reason.trim()
    });
  }

  /**
   * Admin approves marks for an exam subject
   */
  async approveMarks(examId: string, subjectId: string, adminId?: string): Promise<void> {
    const now = new Date().toISOString();

    // 1. Fetch current subject state
    const { data: currentSub } = await supabase
      .from('exam_subjects')
      .select('id, review_status, locked')
      .eq('exam_id', examId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (currentSub?.locked) {
      throw new Error('Cannot approve a locked subject stream. Unlock it first with a valid reason.');
    }

    const curStatus = (currentSub?.review_status || 'draft').toLowerCase();

    // Step 1: If currently draft, in_progress, returned, or unassigned -> transition to 'submitted' first
    if (['draft', 'in_progress', 'returned'].includes(curStatus)) {
      const { error: submitErr } = await supabase
        .from('exam_subjects')
        .update({
          review_status: 'submitted',
          reopen_reason: null
        })
        .eq('exam_id', examId)
        .eq('subject_id', subjectId);

      if (submitErr) {
        console.error('[ExaminationService] Error transitioning to submitted:', submitErr);
        throw new Error(`Failed to submit marks for approval: ${submitErr.message}`);
      }
    }

    // Step 2: Transition from submitted to approved (or re-assert approved)
    const { error: approveErr } = await supabase
      .from('exam_subjects')
      .update({
        review_status: 'approved',
        reopen_reason: null,
        reviewed_by: adminId || null,
        reviewed_at: now
      })
      .eq('exam_id', examId)
      .eq('subject_id', subjectId);

    if (approveErr) {
      console.error('[ExaminationService] Error transitioning to approved:', approveErr);
      throw new Error(`Failed to approve marks: ${approveErr.message}`);
    }

    // Step 3: Update marks table status
    await supabase
      .from('marks')
      .update({
        status: 'approved',
        updated_at: now
      })
      .eq('exam_id', examId)
      .eq('subject_id', subjectId);

    await this.logAudit('MARKS_APPROVED', 'exam_subjects', `${examId}:${subjectId}`, null, { approved_by: adminId });
  }

  /**
   * Approve several exam subjects in one pass.
   *
   * Updates are grouped by exam and safely transition through 'submitted' to 'approved'
   * in batch to comply with database lifecycle triggers.
   */
  async approveMarksBulk(
    targets: { examId: string; subjectId: string }[],
    adminId?: string
  ): Promise<{ approved: number; failed: { examId: string; subjectId: string; message: string }[] }> {
    const now = new Date().toISOString();
    const byExam = new Map<string, string[]>();
    for (const t of targets) {
      if (!t.examId || !t.subjectId) continue;
      const list = byExam.get(t.examId) || [];
      list.push(t.subjectId);
      byExam.set(t.examId, list);
    }

    let approved = 0;
    const failed: { examId: string; subjectId: string; message: string }[] = [];

    for (const [examId, subjectIds] of byExam) {
      try {
        // 1. Fetch current subject statuses for this exam
        const { data: currentRows, error: fetchErr } = await supabase
          .from('exam_subjects')
          .select('id, subject_id, review_status, locked')
          .eq('exam_id', examId)
          .in('subject_id', subjectIds);

        if (fetchErr) throw fetchErr;

        const rows = currentRows || [];
        const nonLockedRows = rows.filter(r => !r.locked);
        const lockedRows = rows.filter(r => r.locked);

        for (const l of lockedRows) {
          failed.push({ examId, subjectId: l.subject_id, message: 'Stream is locked. Unlock before approval.' });
        }

        const idsToSubmit = nonLockedRows
          .filter(r => ['draft', 'in_progress', 'returned'].includes((r.review_status || 'draft').toLowerCase()))
          .map(r => r.subject_id);

        const idsToApprove = nonLockedRows.map(r => r.subject_id);

        // Step 1: Transition draft/in_progress/returned rows to 'submitted'
        for (const sid of idsToSubmit) {
          const { error: submitErr } = await supabase
            .from('exam_subjects')
            .update({
              review_status: 'submitted',
              reopen_reason: null
            })
            .eq('exam_id', examId)
            .eq('subject_id', sid);

          if (submitErr) {
            console.warn(`[ExaminationService] Transition to submitted warning for subject ${sid}:`, submitErr.message);
          }
        }

        // Step 2: Transition from 'submitted' to 'approved' and update marks
        for (const sid of idsToApprove) {
          const { error: approveErr } = await supabase
            .from('exam_subjects')
            .update({
              review_status: 'approved',
              reopen_reason: null,
              reviewed_by: adminId || null,
              reviewed_at: now
            })
            .eq('exam_id', examId)
            .eq('subject_id', sid);

          if (approveErr) {
            console.error(`[ExaminationService] Approve step error for subject ${sid}:`, approveErr);
            failed.push({ examId, subjectId: sid, message: approveErr.message });
            continue;
          }

          // Step 3: Update marks table
          await supabase
            .from('marks')
            .update({ status: 'approved', updated_at: now })
            .eq('exam_id', examId)
            .eq('subject_id', sid);

          approved++;
        }
      } catch (err: any) {
        console.error('[ExaminationService] Bulk approval failed for exam:', examId, err);
        for (const subjectId of subjectIds) {
          if (!failed.some(f => f.examId === examId && f.subjectId === subjectId)) {
            failed.push({ examId, subjectId, message: err?.message || 'Approval failed' });
          }
        }
      }
    }

    await this.logAudit('MARKS_APPROVED_BULK', 'exam_subjects', undefined, null, {
      approved_by: adminId,
      approved_count: approved,
      failed_count: failed.length
    });

    return { approved, failed };
  }

  /**
   * Admin locks marks
   */
  async lockMarks(examId: string, subjectId: string, adminId?: string, reason?: string): Promise<void> {
    const now = new Date().toISOString();

    // 1. Fetch current status
    const { data: currentSub } = await supabase
      .from('exam_subjects')
      .select('id, review_status, locked')
      .eq('exam_id', examId)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (currentSub?.locked) {
      return; // Already locked
    }

    const curStatus = (currentSub?.review_status || 'draft').toLowerCase();

    // If draft, in_progress, or returned -> transition to submitted first
    if (['draft', 'in_progress', 'returned'].includes(curStatus)) {
      await supabase
        .from('exam_subjects')
        .update({ review_status: 'submitted', reopen_reason: null })
        .eq('exam_id', examId)
        .eq('subject_id', subjectId);
    }

    // If not approved yet -> transition to approved
    if (curStatus !== 'approved') {
      await supabase
        .from('exam_subjects')
        .update({
          review_status: 'approved',
          reopen_reason: null,
          reviewed_by: adminId || null,
          reviewed_at: now
        })
        .eq('exam_id', examId)
        .eq('subject_id', subjectId);
    }

    // Now transition from approved -> locked
    const { error } = await supabase
      .from('exam_subjects')
      .update({
        locked: true,
        review_status: 'locked',
        locked_by: adminId || null,
        locked_at: now,
        unlock_reason: null
      })
      .eq('exam_id', examId)
      .eq('subject_id', subjectId);

    if (error) throw error;

    await supabase
      .from('marks')
      .update({ status: 'locked' })
      .eq('exam_id', examId)
      .eq('subject_id', subjectId);

    await this.logAudit('MARKS_LOCKED', 'exam_subjects', `${examId}:${subjectId}`, null, {
      locked_by: adminId,
      reason: reason || 'Locked by Administrator'
    });
  }

  /**
   * Admin unlocks marks with reason
   */
  async unlockMarks(examId: string, subjectId: string, reason: string, adminId?: string): Promise<void> {
    if (!reason.trim()) {
      throw new Error('Please provide an explicit reason when unlocking marks.');
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from('exam_subjects')
      .update({
        locked: false,
        review_status: 'approved',
        unlock_reason: reason.trim(),
        reviewed_by: adminId || null,
        reviewed_at: now
      })
      .eq('exam_id', examId)
      .eq('subject_id', subjectId);

    if (error) throw error;

    await this.logAudit('MARKS_UNLOCKED', 'exam_subjects', `${examId}:${subjectId}`, null, {
      unlocked_by: adminId,
      reason: reason.trim()
    });
  }

  /**
   * Run Result Processing Engine for a Class & Exam Term
   * Evaluates approved/locked marks, computes totals, percentages, grades, division & ranks
   */
  async processClassResults(
    examId: string,
    classId: string,
    adminId?: string
  ): Promise<{
    totalCandidates: number;
    processedCount: number;
    errors: string[];
    warnings: string[];
    results: StudentExamResult[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Fetch Exam record
    const { data: exam, error: examErr } = await supabase
      .from('exams')
      .select('*, classes:class_id(*)')
      .eq('id', examId)
      .single();

    if (examErr || !exam) {
      throw new Error('Examination record not found.');
    }

    // 2. Fetch all configured Exam Subjects
    const { data: examSubjects, error: subErr } = await supabase
      .from('exam_subjects')
      .select('*')
      .eq('exam_id', examId);

    if (subErr || !examSubjects || examSubjects.length === 0) {
      throw new Error('No subjects configured for this examination term.');
    }

    // Only approved/locked subjects may contribute to a result (§18). Anything
    // still in draft/in_progress/submitted/returned is excluded outright — its
    // marks must not influence totals, percentage or pass/fail.
    const gradableSubjects = examSubjects.filter(
      s => s.review_status === 'approved' || s.review_status === 'locked'
    );
    const unapprovedSubs = examSubjects.filter(
      s => s.review_status !== 'approved' && s.review_status !== 'locked'
    );

    if (gradableSubjects.length === 0) {
      throw new Error(
        'No subject has been approved yet. Approve (or lock) at least one subject before processing results.'
      );
    }

    if (unapprovedSubs.length > 0) {
      warnings.push(
        `${unapprovedSubs.length} subject(s) not yet approved and therefore EXCLUDED from this result: ${unapprovedSubs.map(s => s.subject_name).join(', ')}. Approve them and re-process to include them.`
      );
    }

    // 3. Fetch active students in class. Built as a factory so each page gets
    // its own query builder rather than re-ranging a spent one.
    const rosterClassId = classId && classId !== 'all' ? classId : exam.class_id;
    const buildStudentQuery = () => {
      let q = supabase
        .from('students')
        .select('id, name, roll_number, admission_number, class, section, class_id, section_id')
        .eq('status', 'active')
        .order('id', { ascending: true });
      if (rosterClassId) q = q.eq('class_id', rosterClassId);
      return q;
    };

    const students = await this.fetchAllPaged<any>(buildStudentQuery);
    if (!students.length) {
      throw new Error('No students found enrolled in this class.');
    }

    // 4. Fetch all marks for this exam
    const allMarks = await this.fetchAllPaged<any>(() =>
      supabase
        .from('marks')
        .select('*')
        .eq('exam_id', examId)
        .order('id', { ascending: true })
    );

    const marksByStudent = new Map<string, any[]>();
    for (const m of allMarks) {
      const list = marksByStudent.get(m.student_id) || [];
      list.push(m);
      marksByStudent.set(m.student_id, list);
    }

    // 5. Fetch grading rules
    const gradingRules = await this.getGradingRules();

    // 6. Compute each student result
    const resultsToUpsert: any[] = [];

    for (const student of students) {
      const stdMarks = marksByStudent.get(student.id) || [];

      let totalObtained = 0;
      let totalMax = 0;
      let hasAbsent = false;
      let failedSubjectCount = 0;
      let failedSubjectNames: string[] = [];
      let enteredSubjectCount = 0;

      for (const es of gradableSubjects) {
        const markRow = stdMarks.find(m => m.subject_id === es.subject_id);
        const maxScore = Number(es.max_marks || 20);
        const passScore = Number(es.pass_marks || (maxScore * 0.33));

        totalMax += maxScore;

        if (markRow && markRow.obtained_marks !== null && markRow.obtained_marks !== undefined) {
          const obtained = Number(markRow.obtained_marks);
          totalObtained += obtained;
          enteredSubjectCount++;

          if (obtained < passScore) {
            failedSubjectCount++;
            failedSubjectNames.push(es.subject_name);
          }
        } else if (markRow?.attendance_status === 'Absent' || markRow?.is_absent) {
          hasAbsent = true;
          failedSubjectCount++;
          failedSubjectNames.push(`${es.subject_name} (Absent)`);
        }
      }

      const percentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 10000) / 100 : 0;
      const gradeInfo = this.calculateGradeFromRules(percentage, gradingRules);

      // CBSE Compliant Pass/Compartment/Fail decision
      let resultStatus: 'PASS' | 'COMPARTMENT' | 'FAIL' | 'WITHHELD' = 'PASS';
      if (enteredSubjectCount === 0) {
        resultStatus = 'WITHHELD';
      } else if (failedSubjectCount >= 3 || percentage < 33) {
        resultStatus = 'FAIL';
      } else if (failedSubjectCount > 0) {
        resultStatus = 'COMPARTMENT';
      }

      // Division Classification
      let division = 'First Division';
      if (resultStatus === 'FAIL') {
        division = 'Essential Repeat';
      } else if (resultStatus === 'COMPARTMENT') {
        division = `Compartment (${failedSubjectNames.join(', ')})`;
      } else if (percentage >= 75) {
        division = 'First Division (Distinction)';
      } else if (percentage >= 60) {
        division = 'First Division';
      } else if (percentage >= 50) {
        division = 'Second Division';
      } else if (percentage >= 33) {
        division = 'Third Division';
      } else {
        division = 'Essential Repeat';
      }

      const remarks = resultStatus === 'COMPARTMENT'
        ? `Eligible for Compartment in: ${failedSubjectNames.join(', ')}`
        : gradeInfo.remarks || (resultStatus === 'PASS' ? 'Promoted' : 'Needs Improvement');

      resultsToUpsert.push({
        exam_id: examId,
        student_id: student.id,
        class_id: student.class_id || exam.class_id,
        academic_year_id: exam.academic_year_id,
        total_marks: totalObtained,
        max_total_marks: totalMax,
        percentage: percentage,
        division: division,
        grade: gradeInfo.grade,
        result_status: resultStatus,
        remarks: remarks,
        published: exam.is_published || false,
        processed_at: new Date().toISOString(),
        processed_by: adminId || null
      });
    }

    // Assign rank based on percentage descending (PASS students first, then Compartment, then Fail)
    resultsToUpsert.sort((a, b) => {
      if (a.result_status === 'PASS' && b.result_status !== 'PASS') return -1;
      if (b.result_status === 'PASS' && a.result_status !== 'PASS') return 1;
      return b.percentage - a.percentage;
    });

    resultsToUpsert.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    // 7. Upsert results into `exam_results`
    const { error: upsertErr } = await supabase
      .from('exam_results')
      .upsert(resultsToUpsert, { onConflict: 'exam_id,student_id' });

    if (upsertErr) {
      console.error('[ExaminationService] processClassResults upsert error:', upsertErr);
      throw upsertErr;
    }

    // Update exam status to result_processed
    await supabase
      .from('exams')
      .update({ status: 'result_processed' })
      .eq('id', examId);

    await this.logAudit('RESULT_PROCESSED', 'exams', examId, null, {
      students_processed: resultsToUpsert.length,
      class_id: classId
    });

    // 8. Re-fetch processed results with student relationships
    const { data: finalResults } = await supabase
      .from('exam_results')
      .select(`
        *,
        students:student_id(id, name, roll_number, admission_number, class, section, father_name, mother_name),
        exams:exam_id(id, exam_name, short_name, exam_type, academic_year)
      `)
      .eq('exam_id', examId)
      .order('rank', { ascending: true });

    return {
      totalCandidates: students.length,
      processedCount: resultsToUpsert.length,
      errors,
      warnings,
      results: (finalResults as any[]) || []
    };
  }

  /**
   * Publish Examination Results
   */
  async publishExamResults(
    examId: string,
    classId?: string,
    adminId?: string
  ): Promise<PublishOutcome> {
    const now = new Date().toISOString();

    // 1. Mark exam as published
    const { error: examErr } = await supabase
      .from('exams')
      .update({
        is_published: true,
        status: 'published',
        published_at: now,
        published_by: adminId || null
      })
      .eq('id', examId);

    if (examErr) throw examErr;

    // 2. Mark exam_results rows as published
    let resQuery = supabase
      .from('exam_results')
      .update({
        published: true,
        published_at: now,
        published_by: adminId || null
      }, { count: 'exact' })
      .eq('exam_id', examId);

    if (classId && classId !== 'all') {
      resQuery = resQuery.eq('class_id', classId);
    }

    const { error: resErr, count } = await resQuery;
    if (resErr) throw resErr;

    await this.logAudit('RESULT_PUBLISHED', 'exams', examId, null, { published_by: adminId, class_id: classId });

    const affected = count || 0;
    if (affected === 0) {
      // The exam flag alone publishes nothing students can read. Say so rather
      // than reporting a success that left every report card invisible.
      return {
        success: false,
        affected: 0,
        message: 'No processed results exist for this exam yet — run Result Processing before publishing.'
      };
    }

    return { success: true, affected, message: `Published ${affected} student result(s).` };
  }

  /**
   * Fetch Published Results for Student / Parent Portal
   */
  async getStudentPublishedResults(studentId: string): Promise<{
    results: StudentExamResult[];
    marks: any[];
  }> {
    // 1. Fetch published results for this student
    const { data: results, error: resErr } = await supabase
      .from('exam_results')
      .select(`
        *,
        exams:exam_id(id, exam_name, short_name, exam_type, academic_year, is_published, status),
        students:student_id(id, name, roll_number, admission_number, class, section, father_name, mother_name)
      `)
      .eq('student_id', studentId)
      .eq('published', true)
      .order('processed_at', { ascending: false });

    if (resErr) {
      console.error('[ExaminationService] getStudentPublishedResults error:', resErr);
      throw resErr;
    }

    // 2. Fetch marks belonging to published exams
    const publishedExamIds = (results || []).map(r => r.exam_id);

    let marksData: any[] = [];
    if (publishedExamIds.length > 0) {
      const { data: marks } = await supabase
        .from('marks')
        .select(`
          *,
          subjects:subject_id(id, subject_name, subject_code),
          exams:exam_id(id, exam_name, short_name)
        `)
        .eq('student_id', studentId)
        .in('exam_id', publishedExamIds);

      marksData = marks || [];
    }

    return {
      results: (results as any[]) || [],
      marks: marksData
    };
  }

  /**
   * Save or update a CBSE Grading Rule
   */
  async saveGradingRule(payload: Partial<GradingRule>): Promise<GradingRule> {
    if (payload.id) {
      const { data, error } = await supabase
        .from('grading_rules')
        .update({
          grade_name: payload.grade_name,
          min_score: payload.min_score,
          max_score: payload.max_score,
          points: payload.points,
          remarks: payload.remarks
        })
        .eq('id', payload.id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('GRADING_RULE_UPDATED', 'grading_rules', data.id, null, data);
      return data;
    } else {
      const { data, error } = await supabase
        .from('grading_rules')
        .insert({
          grade_name: payload.grade_name,
          min_score: payload.min_score,
          max_score: payload.max_score,
          points: payload.points,
          remarks: payload.remarks
        })
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('GRADING_RULE_CREATED', 'grading_rules', data.id, null, data);
      return data;
    }
  }

  /**
   * Delete a Grading Rule
   */
  async deleteGradingRule(id: string): Promise<void> {
    const { error } = await supabase.from('grading_rules').delete().eq('id', id);
    if (error) throw error;
    await this.logAudit('GRADING_RULE_DELETED', 'grading_rules', id);
  }

  /**
   * Unpublish Results (reverts to result_processed for correction)
   */
  async unpublishExamResults(
    examId: string,
    classId?: string,
    adminId?: string
  ): Promise<PublishOutcome> {
    const now = new Date().toISOString();

    const { error: examErr } = await supabase
      .from('exams')
      .update({
        is_published: false,
        status: 'result_processed',
        published_at: null,
        published_by: null
      })
      .eq('id', examId);

    if (examErr) throw examErr;

    let resQuery = supabase
      .from('exam_results')
      .update({
        published: false,
        published_at: null,
        published_by: null
      }, { count: 'exact' })
      .eq('exam_id', examId);

    if (classId && classId !== 'all') {
      resQuery = resQuery.eq('class_id', classId);
    }

    const { error: resErr, count } = await resQuery;
    if (resErr) throw resErr;

    await this.logAudit('RESULT_UNPUBLISHED', 'exams', examId, null, { unpublished_by: adminId, class_id: classId });

    const affected = count || 0;
    return {
      success: true,
      affected,
      message: `Retracted ${affected} student result(s) to draft.`
    };
  }

  /**
   * Evaluate Student Eligibility for an examination
   */
  async getStudentEligibility(
    examId: string,
    classId?: string,
    sectionId?: string
  ): Promise<{
    total: number;
    eligibleCount: number;
    ineligibleCount: number;
    students: Array<{
      id: string;
      name: string;
      roll_number: string;
      admission_number: string;
      class: string;
      section: string;
      photo_url?: string;
      is_eligible: boolean;
      reason: string;
    }>;
  }> {
    // 1. Fetch Exam
    const { data: exam } = await supabase
      .from('exams')
      .select('*, academic_years(*)')
      .eq('id', examId)
      .single();

    const targetClassId = classId && classId !== 'all' ? classId : exam?.class_id;

    // 2. Fetch all students in class
    let query = supabase
      .from('students')
      .select('*')
      .order('roll_number', { ascending: true });

    if (targetClassId) {
      query = query.eq('class_id', targetClassId);
    }
    if (sectionId && sectionId !== 'All') {
      query = query.eq('section_id', sectionId);
    }

    const { data: stdList } = await query;

    const evaluatedStudents = (stdList || []).map(s => {
      const isActive = s.status === 'active';
      let isEligible = true;
      let reason = 'Active enrollment in class curriculum';

      if (!isActive) {
        isEligible = false;
        reason = `Student account is ${s.status || 'inactive'}`;
      }

      return {
        id: s.id,
        name: s.name,
        roll_number: s.roll_number || '—',
        admission_number: s.admission_number || '—',
        class: s.class,
        section: s.section || 'A',
        photo_url: s.photo_url,
        is_eligible: isEligible,
        reason: reason
      };
    });

    const eligibleCount = evaluatedStudents.filter(s => s.is_eligible).length;

    return {
      total: evaluatedStudents.length,
      eligibleCount,
      ineligibleCount: evaluatedStudents.length - eligibleCount,
      students: evaluatedStudents
    };
  }

  /**
   * Check for Exam Schedule Conflicts
   */
  async checkScheduleConflicts(params: {
    examId: string;
    classId?: string;
    date: string;
    startTime: string;
    endTime: string;
    invigilatorId?: string;
    room?: string;
    excludeSubjectId?: string;
  }): Promise<{ hasConflict: boolean; conflicts: string[] }> {
    const conflicts: string[] = [];

    if (!params.date) return { hasConflict: false, conflicts: [] };

    // Fetch existing scheduled exam subjects on the same date
    const { data: existingSlots } = await supabase
      .from('exam_subjects')
      .select('id, exam_id, subject_name, exam_date, start_time, end_time, room, invigilator_id, class_id, exams:exam_id(class, class_id), teachers:invigilator_id(name)')
      .eq('exam_date', params.date);

    for (const slot of existingSlots || []) {
      if (params.excludeSubjectId && slot.id === params.excludeSubjectId) continue;

      // Check time overlap (e.g. 09:00 AM vs 09:00 AM)
      const slotStart = (slot.start_time || '').trim().toLowerCase();
      const paramStart = (params.startTime || '').trim().toLowerCase();
      const timeClash = slotStart === paramStart;

      if (timeClash) {
        // 1. Class conflict: Same class cannot have 2 exams at the same time
        const slotClassId = slot.class_id || (slot.exams as any)?.class_id;
        if (params.classId && slotClassId && params.classId === slotClassId) {
          conflicts.push(`Class already has an exam scheduled (${slot.subject_name}) on ${params.date} at ${slot.start_time}`);
        }

        // 2. Invigilator conflict: Same teacher cannot invigilate 2 rooms at the same time
        if (params.invigilatorId && slot.invigilator_id && params.invigilatorId === slot.invigilator_id) {
          const tName = (slot.teachers as any)?.name || 'Invigilator';
          conflicts.push(`${tName} is already assigned as invigilator for ${slot.subject_name} in ${slot.room || 'another room'} at ${slot.start_time}`);
        }

        // 3. Room conflict: Same room cannot host 2 different exams at the same time unless combined
        if (params.room && slot.room && params.room.trim().toLowerCase() === slot.room.trim().toLowerCase()) {
          conflicts.push(`Room "${params.room}" is already allocated for ${slot.subject_name} at ${slot.start_time}`);
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }

  /**
   * Save Exam Attendance (Present, Absent, Medical, Exempted, Withheld)
   */
  async saveExamAttendance(
    examId: string,
    subjectId: string,
    attendanceList: Array<{
      student_id: string;
      attendance_status: 'Present' | 'Absent' | 'Medical' | 'Exempted';
      remarks?: string;
    }>,
    adminId?: string
  ): Promise<void> {
    const now = new Date().toISOString();

    const upserts = attendanceList.map(item => {
      const isAbsent = item.attendance_status === 'Absent';
      const isMedical = item.attendance_status === 'Medical';
      const isExempted = item.attendance_status === 'Exempted';

      return {
        exam_id: examId,
        student_id: item.student_id,
        subject_id: subjectId,
        attendance_status: item.attendance_status,
        is_absent: isAbsent,
        is_medical: isMedical,
        is_exempted: isExempted,
        remarks: item.remarks || null,
        entered_by: adminId || null,
        updated_at: now
      };
    });

    const { error } = await supabase
      .from('marks')
      .upsert(upserts, { onConflict: 'exam_id,student_id,subject_id' });

    if (error) throw error;

    await this.logAudit('EXAM_ATTENDANCE_MARKED', 'marks', `${examId}:${subjectId}`, null, {
      marked_count: attendanceList.length,
      marked_by: adminId
    });
  }

  /**
   * Fetch comprehensive Performance Analytics from live database
   */
  async getExamPerformanceAnalytics(filters?: {
    academicYearId?: string;
    examId?: string;
    classId?: string;
  }): Promise<{
    totalExams: number;
    upcomingExamsCount: number;
    ongoingExamsCount: number;
    completedExamsCount: number;
    marksPendingCount: number;
    resultsPendingCount: number;
    publishedResultsCount: number;
    totalCandidates: number;
    classAverages: Array<{ className: string; average: number; count: number }>;
    gradeDistribution: Record<string, number>;
    passFailStats: { pass: number; compartment: number; fail: number; withheld: number };
    topRankers: any[];
    examTrends: Array<{ examName: string; average: number; passRate: number }>;
  }> {
    // 1. Fetch Exams
    let examQuery = supabase.from('exams').select('*, classes:class_id(*)');
    if (filters?.academicYearId && filters.academicYearId !== 'all') {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.academicYearId);
      if (isUUID) {
        examQuery = examQuery.eq('academic_year_id', filters.academicYearId);
      } else {
        examQuery = examQuery.eq('academic_year', filters.academicYearId);
      }
    }
    if (filters?.examId && filters.examId !== 'all') {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.examId);
      if (isUUID) {
        examQuery = examQuery.eq('id', filters.examId);
      }
    }
    if (filters?.classId && filters.classId !== 'all') {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.classId);
      if (isUUID) {
        examQuery = examQuery.eq('class_id', filters.classId);
      }
    }

    const { data: allExams } = await examQuery;
    const examsList = allExams || [];

    const examIds = examsList.map(e => e.id);

    // 2. Fetch Exam Results
    let resQuery = supabase
      .from('exam_results')
      .select('*, students:student_id(*), exams:exam_id(*)');

    if (examIds.length > 0) {
      resQuery = resQuery.in('exam_id', examIds);
    }

    const { data: allResults } = await resQuery;
    const resultsList = allResults || [];

    // 3. Aggregate KPIs
    const today = new Date().toISOString().slice(0, 10);

    const upcomingExamsCount = examsList.filter(e => e.start_date && e.start_date > today).length;
    const ongoingExamsCount = examsList.filter(e => e.start_date && e.end_date && e.start_date <= today && e.end_date >= today).length;
    const completedExamsCount = examsList.filter(e => e.status === 'published' || (e.end_date && e.end_date < today)).length;
    const marksPendingCount = examsList.filter(e => e.status === 'draft' || e.status === 'scheduled' || e.status === 'marks_entry_open').length;
    const resultsPendingCount = examsList.filter(e => e.status === 'review' || e.status === 'locked' || e.status === 'result_processed').length;
    const publishedResultsCount = resultsList.filter(r => r.published).length;

    // 4. Grade distribution
    const gradeDistribution: Record<string, number> = {
      'A1': 0, 'A2': 0, 'B1': 0, 'B2': 0, 'C1': 0, 'C2': 0, 'D': 0, 'E': 0
    };

    const passFailStats = { pass: 0, compartment: 0, fail: 0, withheld: 0 };

    const classScoreMap = new Map<string, { totalPct: number; count: number }>();

    for (const r of resultsList) {
      if (r.grade && gradeDistribution[r.grade] !== undefined) {
        gradeDistribution[r.grade]++;
      }
      const st = (r.result_status || 'PASS').toUpperCase();
      if (st === 'PASS') passFailStats.pass++;
      else if (st === 'COMPARTMENT') passFailStats.compartment++;
      else if (st === 'FAIL') passFailStats.fail++;
      else passFailStats.withheld++;

      const cName = r.students?.class || 'Class';
      const entry = classScoreMap.get(cName) || { totalPct: 0, count: 0 };
      entry.totalPct += Number(r.percentage || 0);
      entry.count++;
      classScoreMap.set(cName, entry);
    }

    const classAverages = Array.from(classScoreMap.entries()).map(([className, val]) => ({
      className,
      average: val.count > 0 ? Math.round((val.totalPct / val.count) * 10) / 10 : 0,
      count: val.count
    })).sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }));

    // Top Rankers
    const topRankers = [...resultsList]
      .filter(r => r.percentage > 0)
      .sort((a, b) => Number(b.percentage) - Number(a.percentage))
      .slice(0, 10);

    // Multi-term progression trends
    const examMap = new Map<string, { examName: string; totalPct: number; passCount: number; totalCount: number }>();
    for (const r of resultsList) {
      const eName = r.exams?.exam_name || 'Exam';
      const cur = examMap.get(eName) || { examName: eName, totalPct: 0, passCount: 0, totalCount: 0 };
      cur.totalPct += Number(r.percentage || 0);
      if (r.result_status === 'PASS') cur.passCount++;
      cur.totalCount++;
      examMap.set(eName, cur);
    }

    const examTrends = Array.from(examMap.values()).map(e => ({
      examName: e.examName,
      average: e.totalCount > 0 ? Math.round((e.totalPct / e.totalCount) * 10) / 10 : 0,
      passRate: e.totalCount > 0 ? Math.round((e.passCount / e.totalCount) * 100) : 0
    }));

    return {
      totalExams: examsList.length,
      upcomingExamsCount,
      ongoingExamsCount,
      completedExamsCount,
      marksPendingCount,
      resultsPendingCount,
      publishedResultsCount,
      totalCandidates: resultsList.length,
      classAverages,
      gradeDistribution,
      passFailStats,
      topRankers,
      examTrends
    };
  }
}

export const examinationService = new ExaminationService();

