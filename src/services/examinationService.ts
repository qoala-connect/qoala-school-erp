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
      query = query.eq('academic_year_id', filters.academicYearId);
    }
    if (filters?.classId && filters.classId !== 'all') {
      query = query.eq('class_id', filters.classId);
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

    if (teacherId && teacherId !== 'all') {
      query = query.eq('teacher_id', teacherId);
    }

    const { data: rawTasks, error } = await query;
    if (error) {
      console.error('[ExaminationService] getTeacherWorkload error:', error);
      throw error;
    }

    // Filter by academic year if passed
    const tasks = (rawTasks || []).filter(t => {
      if (!academicYearId || academicYearId === 'all') return true;
      const exYearId = (t.exams as any)?.academic_year_id;
      return exYearId === academicYearId;
    });

    // Roster sizes and entered-marks progress used to be fetched per task —
    // two round trips each, so ~300+ requests and ~45s for a full board. Both
    // are now resolved with a single bulk query apiece and grouped in memory.
    const examIds = [...new Set(tasks.map((t: any) => t.exam_id).filter(Boolean))];
    const classIds = [...new Set(tasks.map((t: any) => t.exams?.class_id).filter(Boolean))];
    const classNames = [...new Set(tasks.map((t: any) => t.exams?.class).filter(Boolean))];

    const [studentsRes, marksRes] = await Promise.all([
      classIds.length || classNames.length
        ? supabase
            .from('students')
            .select('id, class_id, class')
            .eq('status', 'active')
            .or([
              classIds.length ? `class_id.in.(${classIds.join(',')})` : '',
              classNames.length ? `class.in.(${classNames.map(c => `"${c}"`).join(',')})` : '',
            ].filter(Boolean).join(','))
        : Promise.resolve({ data: [] as any[] }),
      examIds.length
        ? supabase
            .from('marks')
            .select('exam_id, subject_id, obtained_marks, attendance_status')
            .in('exam_id', examIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const countByClassId = new Map<string, number>();
    const countByClassName = new Map<string, number>();
    for (const s of (studentsRes as any).data || []) {
      if (s.class_id) countByClassId.set(s.class_id, (countByClassId.get(s.class_id) || 0) + 1);
      if (s.class) countByClassName.set(s.class, (countByClassName.get(s.class) || 0) + 1);
    }

    const enteredByKey = new Map<string, number>();
    for (const m of (marksRes as any).data || []) {
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
          teacher_id: task.teacher_id,
          teacher_name: task.teachers?.name || 'Unassigned',
          teacher_email: task.teachers?.email,
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

    // Update exam_subjects review status to in_progress if still draft
    await supabase
      .from('exam_subjects')
      .update({ review_status: 'in_progress' })
      .eq('exam_id', examId)
      .eq('subject_id', subjectId)
      .eq('review_status', 'draft');

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

    // 1. Mark exam_subjects as submitted
    const { error: subErr } = await supabase
      .from('exam_subjects')
      .update({
        review_status: 'submitted',
        reviewed_at: null,
        reopen_reason: null
      })
      .eq('exam_id', examId)
      .eq('subject_id', subjectId);

    if (subErr) throw subErr;

    // 2. Mark student marks as submitted
    const { error: markErr } = await supabase
      .from('marks')
      .update({
        status: 'submitted',
        updated_by: userId || null,
        updated_at: now
      })
      .eq('exam_id', examId)
      .eq('subject_id', subjectId);

    if (markErr) throw markErr;

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

    const { error: subErr } = await supabase
      .from('exam_subjects')
      .update({
        review_status: 'approved',
        reopen_reason: null,
        reviewed_by: adminId || null,
        reviewed_at: now
      })
      .eq('exam_id', examId)
      .eq('subject_id', subjectId);

    if (subErr) throw subErr;

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
   * Admin locks marks
   */
  async lockMarks(examId: string, subjectId: string, adminId?: string, reason?: string): Promise<void> {
    const now = new Date().toISOString();

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

    // 3. Fetch active students in class
    let studentQuery = supabase
      .from('students')
      .select('id, name, roll_number, admission_number, class, section, class_id, section_id')
      .eq('status', 'active');

    if (classId && classId !== 'all') {
      studentQuery = studentQuery.eq('class_id', classId);
    } else if (exam.class_id) {
      studentQuery = studentQuery.eq('class_id', exam.class_id);
    }

    const { data: students, error: stdErr } = await studentQuery;
    if (stdErr || !students || students.length === 0) {
      throw new Error('No students found enrolled in this class.');
    }

    // 4. Fetch all marks for this exam
    const { data: allMarks } = await supabase
      .from('marks')
      .select('*')
      .eq('exam_id', examId);

    const marksByStudent = new Map<string, any[]>();
    for (const m of allMarks || []) {
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
      let hasFailedSubject = false;
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
            hasFailedSubject = true;
          }
        } else if (markRow?.attendance_status === 'Absent' || markRow?.is_absent) {
          hasAbsent = true;
        }
      }

      const percentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 10000) / 100 : 0;
      const gradeInfo = this.calculateGradeFromRules(percentage, gradingRules);

      // Pass/Fail decision
      let resultStatus: 'PASS' | 'COMPARTMENT' | 'FAIL' | 'WITHHELD' = 'PASS';
      if (enteredSubjectCount === 0) {
        resultStatus = 'WITHHELD';
      } else if (hasFailedSubject) {
        resultStatus = 'COMPARTMENT';
      } else if (percentage < 33) {
        resultStatus = 'FAIL';
      }

      // Division
      let division = 'First Division';
      if (percentage >= 60) division = 'First Division';
      else if (percentage >= 50) division = 'Second Division';
      else if (percentage >= 33) division = 'Third Division';
      else division = 'Essential Repeat';

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
        remarks: gradeInfo.remarks,
        published: exam.is_published || false,
        processed_at: new Date().toISOString(),
        processed_by: adminId || null
      });
    }

    // Assign rank based on percentage descending
    resultsToUpsert.sort((a, b) => b.percentage - a.percentage);
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
  async publishExamResults(examId: string, classId?: string, adminId?: string): Promise<void> {
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
      })
      .eq('exam_id', examId);

    if (classId && classId !== 'all') {
      resQuery = resQuery.eq('class_id', classId);
    }

    const { error: resErr } = await resQuery;
    if (resErr) throw resErr;

    await this.logAudit('RESULT_PUBLISHED', 'exams', examId, null, { published_by: adminId, class_id: classId });
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
}

export const examinationService = new ExaminationService();
