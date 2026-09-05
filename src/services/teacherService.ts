import { supabase } from '@/lib/supabase';

export type TeacherLifecycleStatus =
  | 'Draft'
  | 'Active'
  | 'On Leave'
  | 'Inactive'
  | 'Transferred'
  | 'Resigned'
  | 'Retired'
  | 'Archived';

export type AssignmentType =
  | 'subject_teacher'
  | 'class_teacher'
  | 'both'
  | 'assistant_teacher'
  | 'examiner';

export interface Teacher {
  id: string;
  name: string;
  employee_id: string;
  user_id?: string | null;
  email?: string | null;
  phone?: string | null;
  photo_url?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  joining_date?: string | null;
  status: TeacherLifecycleStatus;
  designation: string;
  department: string;
  department_id?: string | null;
  qualification?: string | null;
  highest_qualification?: string | null;
  experience_years: number;
  employment_type: 'Full-Time' | 'Part-Time' | 'Contract' | 'Temporary';
  cbse_teaching_level?: 'PRT' | 'TGT' | 'PGT' | string;
  ctet_qualified: boolean;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  blood_group?: string | null;
  subject_id?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  
  // Computed / Joined fields
  assignments_count?: number;
  classes_covered?: string[];
  subjects_taught?: string[];
  is_class_teacher_of?: string | null;
}

export interface TeacherAssignment {
  id: string;
  teacher_id: string;
  teacher_name?: string;
  teacher_employee_id?: string;
  academic_year_id: string;
  academic_year_name?: string;
  class_id: string;
  class_name: string;
  section_id: string;
  section_name: string;
  subject_id?: string | null;
  subject_name?: string | null;
  assignment_type: AssignmentType;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TeacherWorkload {
  classes_count: number;
  sections_count: number;
  subjects_count: number;
  periods_per_week: number;
  exam_tasks_count: number;
  pending_marks_count: number;
  classes_list: string[];
  subjects_list: string[];
}

export interface AssignmentConflict {
  hasConflict: boolean;
  type?: 'DUPLICATE_ASSIGNMENT' | 'EXISTING_CLASS_TEACHER' | 'INACTIVE_TEACHER';
  message: string;
  existingTeacherName?: string;
}

// ---------------------------------------------------------------------
// TEACHER DIRECTORY & CRUD
// ---------------------------------------------------------------------

export async function fetchTeachers(params?: {
  search?: string;
  status?: string;
  department?: string;
  designation?: string;
  academicYearId?: string;
}): Promise<Teacher[]> {
  try {
    let query = supabase.from('teachers').select('*').order('name');

    if (params?.status && params.status !== 'all') {
      query = query.eq('status', params.status);
    }

    if (params?.department && params.department !== 'all') {
      query = query.eq('department', params.department);
    }

    if (params?.designation && params.designation !== 'all') {
      query = query.eq('designation', params.designation);
    }

    const { data: teachers, error } = await query;
    if (error) throw error;

    // Fetch assignments for computing metadata
    const { data: assignments } = await supabase
      .from('teacher_assignments')
      .select(`
        id,
        teacher_id,
        assignment_type,
        is_active,
        classes (class_name),
        sections (section_name),
        subjects (subject_name)
      `)
      .eq('is_active', true);

    const assignmentMap: Record<string, any[]> = {};
    (assignments || []).forEach(a => {
      if (!assignmentMap[a.teacher_id]) assignmentMap[a.teacher_id] = [];
      assignmentMap[a.teacher_id].push(a);
    });

    let result: Teacher[] = (teachers || []).map((t: any) => {
      const teacherAssigns = assignmentMap[t.id] || [];
      const classesSet = new Set<string>();
      const subjectsSet = new Set<string>();
      let classTeacherOf: string | null = null;

      teacherAssigns.forEach(a => {
        const clsName = a.classes?.class_name;
        const secName = a.sections?.section_name;
        const subName = a.subjects?.subject_name;
        if (clsName && secName) classesSet.add(`${clsName}-${secName}`);
        if (subName) subjectsSet.add(subName);

        if ((a.assignment_type === 'class_teacher' || a.assignment_type === 'both') && clsName && secName) {
          classTeacherOf = `${clsName}-${secName}`;
        }
      });

      return {
        ...t,
        status: (t.status || 'Active') as TeacherLifecycleStatus,
        designation: t.designation || 'Teacher',
        department: t.department || 'Teaching Faculty',
        employment_type: t.employment_type || 'Full-Time',
        experience_years: t.experience_years || 0,
        ctet_qualified: !!t.ctet_qualified,
        is_active: t.is_active !== false && t.status !== 'Archived' && t.status !== 'Resigned' && t.status !== 'Retired',
        assignments_count: teacherAssigns.length,
        classes_covered: Array.from(classesSet),
        subjects_taught: Array.from(subjectsSet),
        is_class_teacher_of: classTeacherOf
      };
    });

    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      result = result.filter(t => 
        t.name.toLowerCase().includes(q) ||
        (t.employee_id && t.employee_id.toLowerCase().includes(q)) ||
        (t.email && t.email.toLowerCase().includes(q)) ||
        (t.phone && t.phone.toLowerCase().includes(q)) ||
        t.department.toLowerCase().includes(q) ||
        t.designation.toLowerCase().includes(q) ||
        t.classes_covered?.some(c => c.toLowerCase().includes(q)) ||
        t.subjects_taught?.some(s => s.toLowerCase().includes(q))
      );
    }

    return result;
  } catch (err: any) {
    console.error('[TeacherService] fetchTeachers failed:', err);
    throw err;
  }
}

export async function fetchTeacherById(id: string): Promise<Teacher | null> {
  const { data, error } = await supabase.from('teachers').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as Teacher;
}

export async function saveTeacher(teacher: Partial<Teacher>): Promise<Teacher> {
  const payload: any = {
    name: teacher.name?.trim(),
    employee_id: teacher.employee_id?.trim() || null,
    user_id: teacher.user_id || null,
    email: teacher.email?.trim() || null,
    phone: teacher.phone?.trim() || null,
    photo_url: teacher.photo_url || null,
    gender: teacher.gender || null,
    date_of_birth: teacher.date_of_birth || null,
    joining_date: teacher.joining_date || null,
    status: teacher.status || 'Active',
    designation: teacher.designation?.trim() || 'Teacher',
    department: teacher.department?.trim() || 'Teaching Faculty',
    department_id: teacher.department_id || null,
    qualification: teacher.qualification || null,
    highest_qualification: teacher.highest_qualification || null,
    experience_years: Number(teacher.experience_years) || 0,
    employment_type: teacher.employment_type || 'Full-Time',
    cbse_teaching_level: teacher.cbse_teaching_level || 'TGT',
    ctet_qualified: !!teacher.ctet_qualified,
    address: teacher.address?.trim() || null,
    emergency_contact_name: teacher.emergency_contact_name?.trim() || null,
    emergency_contact_phone: teacher.emergency_contact_phone?.trim() || null,
    blood_group: teacher.blood_group || null,
    is_active: teacher.status !== 'Archived' && teacher.status !== 'Resigned' && teacher.status !== 'Retired' && teacher.status !== 'Inactive',
    updated_at: new Date().toISOString()
  };

  if (teacher.id) {
    const { data, error } = await supabase.from('teachers').update(payload).eq('id', teacher.id).select().single();
    if (error) throw error;
    return data as Teacher;
  } else {
    // Generate employee_id if absent
    if (!payload.employee_id) {
      const { data: countData } = await supabase.from('teachers').select('id', { count: 'exact' });
      const seq = (countData?.length || 0) + 1;
      payload.employee_id = `TCH-${String(seq).padStart(4, '0')}`;
    }
    const { data, error } = await supabase.from('teachers').insert([payload]).select().single();
    if (error) throw error;
    return data as Teacher;
  }
}

export async function changeTeacherStatus(id: string, newStatus: TeacherLifecycleStatus): Promise<void> {
  const is_active = newStatus === 'Active' || newStatus === 'Draft';
  const { error } = await supabase.from('teachers').update({
    status: newStatus,
    is_active,
    updated_at: new Date().toISOString()
  }).eq('id', id);
  if (error) throw error;

  // If archiving or resigning, deactivate active assignments
  if (newStatus === 'Archived' || newStatus === 'Resigned' || newStatus === 'Retired' || newStatus === 'Inactive') {
    await supabase.from('teacher_assignments').update({ is_active: false }).eq('teacher_id', id);
  }
}

// ---------------------------------------------------------------------
// TEACHER ACADEMIC ASSIGNMENTS
// ---------------------------------------------------------------------

export async function fetchAssignments(params?: {
  teacherId?: string;
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  activeOnly?: boolean;
}): Promise<TeacherAssignment[]> {
  let query = supabase.from('teacher_assignments').select(`
    id,
    teacher_id,
    academic_year_id,
    class_id,
    section_id,
    subject_id,
    assignment_type,
    is_active,
    created_at,
    updated_at,
    teachers (id, name, employee_id),
    academic_years (id, name),
    classes (id, class_name),
    sections (id, section_name),
    subjects (id, subject_name)
  `);

  if (params?.teacherId) query = query.eq('teacher_id', params.teacherId);
  if (params?.academicYearId) query = query.eq('academic_year_id', params.academicYearId);
  if (params?.classId) query = query.eq('class_id', params.classId);
  if (params?.sectionId) query = query.eq('section_id', params.sectionId);
  if (params?.activeOnly !== false) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    teacher_id: row.teacher_id,
    teacher_name: row.teachers?.name || 'Unknown',
    teacher_employee_id: row.teachers?.employee_id || '',
    academic_year_id: row.academic_year_id,
    academic_year_name: row.academic_years?.name || '',
    class_id: row.class_id,
    class_name: row.classes?.class_name || '',
    section_id: row.section_id,
    section_name: row.sections?.section_name || '',
    subject_id: row.subject_id,
    subject_name: row.subjects?.subject_name || (row.assignment_type === 'class_teacher' ? 'Class Teacher' : 'All Subjects'),
    assignment_type: row.assignment_type as AssignmentType,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at
  })).sort((a, b) => {
    const classCompare = (parseInt(a.class_name.replace(/\D/g, '')) || 0) - (parseInt(b.class_name.replace(/\D/g, '')) || 0);
    if (classCompare !== 0) return classCompare;
    return a.section_name.localeCompare(b.section_name);
  });
}

export async function checkAssignmentConflicts(params: {
  teacherId: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  subjectId?: string | null;
  assignmentType: AssignmentType;
  excludeAssignmentId?: string;
}): Promise<AssignmentConflict> {
  // 1. Verify Teacher is active
  const teacher = await fetchTeacherById(params.teacherId);
  if (!teacher || !teacher.is_active) {
    return {
      hasConflict: true,
      type: 'INACTIVE_TEACHER',
      message: `Teacher ${teacher?.name || 'Selected'} is currently marked as ${teacher?.status || 'Inactive'} and cannot receive active academic responsibilities.`
    };
  }

  // 2. Check Class Teacher Conflict: Only one Class Teacher per Class + Section per Academic Year
  if (params.assignmentType === 'class_teacher' || params.assignmentType === 'both') {
    let ctQuery = supabase
      .from('teacher_assignments')
      .select('id, teacher_id, teachers(name)')
      .eq('academic_year_id', params.academicYearId)
      .eq('class_id', params.classId)
      .eq('section_id', params.sectionId)
      .in('assignment_type', ['class_teacher', 'both'])
      .eq('is_active', true);

    if (params.excludeAssignmentId) {
      ctQuery = ctQuery.neq('id', params.excludeAssignmentId);
    }

    const { data: ctData } = await ctQuery;
    if (ctData && ctData.length > 0) {
      const existing = ctData[0];
      const existingName = (existing.teachers as any)?.name || 'Another teacher';
      if (existing.teacher_id !== params.teacherId) {
        return {
          hasConflict: true,
          type: 'EXISTING_CLASS_TEACHER',
          message: `${existingName} is already assigned as the Class Teacher for this class section in this academic year.`,
          existingTeacherName: existingName
        };
      }
    }
  }

  // 3. Check Duplicate Subject Assignment
  if (params.subjectId) {
    let dupQuery = supabase
      .from('teacher_assignments')
      .select('id')
      .eq('teacher_id', params.teacherId)
      .eq('academic_year_id', params.academicYearId)
      .eq('class_id', params.classId)
      .eq('section_id', params.sectionId)
      .eq('subject_id', params.subjectId)
      .eq('is_active', true);

    if (params.excludeAssignmentId) {
      dupQuery = dupQuery.neq('id', params.excludeAssignmentId);
    }

    const { data: dupData } = await dupQuery;
    if (dupData && dupData.length > 0) {
      return {
        hasConflict: true,
        type: 'DUPLICATE_ASSIGNMENT',
        message: `This teacher is already assigned to this subject for this class section.`
      };
    }
  }

  return { hasConflict: false, message: 'No conflicts detected.' };
}

export async function saveAssignment(assignment: {
  id?: string;
  teacher_id: string;
  academic_year_id: string;
  class_id: string;
  section_id: string;
  subject_id?: string | null;
  assignment_type: AssignmentType;
}): Promise<TeacherAssignment> {
  const payload = {
    teacher_id: assignment.teacher_id,
    academic_year_id: assignment.academic_year_id,
    class_id: assignment.class_id,
    section_id: assignment.section_id,
    subject_id: assignment.subject_id || null,
    assignment_type: assignment.assignment_type,
    is_active: true,
    updated_at: new Date().toISOString()
  };

  if (assignment.id) {
    const { data, error } = await supabase
      .from('teacher_assignments')
      .update(payload)
      .eq('id', assignment.id)
      .select()
      .single();
    if (error) throw error;
    return data as TeacherAssignment;
  } else {
    const { data, error } = await supabase
      .from('teacher_assignments')
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    return data as TeacherAssignment;
  }
}

export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await supabase.from('teacher_assignments').delete().eq('id', id);
  if (error) throw error;
}

export async function bulkAssignTeacher(params: {
  teacher_id: string;
  academic_year_id: string;
  subject_id: string;
  allocations: Array<{ class_id: string; section_id: string; is_class_teacher?: boolean }>;
}): Promise<{ successCount: number; errors: string[] }> {
  let successCount = 0;
  const errors: string[] = [];

  for (const alloc of params.allocations) {
    const assignmentType: AssignmentType = alloc.is_class_teacher ? 'both' : 'subject_teacher';
    
    // Check conflicts
    const conflict = await checkAssignmentConflicts({
      teacherId: params.teacher_id,
      academicYearId: params.academic_year_id,
      classId: alloc.class_id,
      sectionId: alloc.section_id,
      subjectId: params.subject_id,
      assignmentType
    });

    if (conflict.hasConflict) {
      errors.push(conflict.message);
      continue;
    }

    try {
      await saveAssignment({
        teacher_id: params.teacher_id,
        academic_year_id: params.academic_year_id,
        class_id: alloc.class_id,
        section_id: alloc.section_id,
        subject_id: params.subject_id,
        assignment_type: assignmentType
      });
      successCount++;
    } catch (e: any) {
      errors.push(`Allocation error: ${e.message}`);
    }
  }

  return { successCount, errors };
}

// ---------------------------------------------------------------------
// WORKLOAD & CROSS-MODULE QUERIES
// ---------------------------------------------------------------------

export async function getTeacherWorkload(teacherId: string, academicYearId?: string): Promise<TeacherWorkload> {
  let yrId = academicYearId;
  if (!yrId) {
    const { data: currYr } = await supabase.from('academic_years').select('id').eq('is_current', true).maybeSingle();
    yrId = currYr?.id;
  }

  const [assigns, timetableSlots, examTasks] = await Promise.all([
    fetchAssignments({ teacherId, academicYearId: yrId }),
    supabase.from('timetable').select('id').eq('teacher_id', teacherId),
    fetchTeacherExamTasks(teacherId, yrId)
  ]);

  const classesSet = new Set<string>();
  const sectionsSet = new Set<string>();
  const subjectsSet = new Set<string>();

  assigns.forEach(a => {
    classesSet.add(a.class_name);
    sectionsSet.add(`${a.class_name}-${a.section_name}`);
    if (a.subject_name) subjectsSet.add(a.subject_name);
  });

  const pendingMarks = examTasks.reduce((acc, t) => acc + (t.total_students - t.entered_count), 0);

  return {
    classes_count: classesSet.size,
    sections_count: sectionsSet.size,
    subjects_count: subjectsSet.size,
    periods_per_week: timetableSlots.data?.length || 0,
    exam_tasks_count: examTasks.length,
    pending_marks_count: Math.max(0, pendingMarks),
    classes_list: Array.from(classesSet),
    subjects_list: Array.from(subjectsSet)
  };
}

export async function fetchTeacherStudents(teacherId: string, academicYearId?: string): Promise<any[]> {
  const assigns = await fetchAssignments({ teacherId, academicYearId });
  if (assigns.length === 0) return [];

  const classPairs = Array.from(new Set(assigns.map(a => `${a.class_name}__${a.section_name}`)));
  const classNames = Array.from(new Set(assigns.map(a => a.class_name)));
  
  const { data: students, error } = await supabase
    .from('students')
    .select('id, name, roll_number, admission_number, class, section, status, photo_url, father_name, phone')
    .in('class', classNames)
    .eq('status', 'active')
    .order('class')
    .order('roll_number');

  if (error) throw error;

  // Filter precisely by class and section matching the teacher's assignments
  return (students || []).filter(s => classPairs.includes(`${s.class}__${s.section}`));
}

export async function fetchTeacherExamTasks(teacherId: string, academicYearId?: string): Promise<any[]> {
  const assigns = await fetchAssignments({ teacherId, academicYearId });
  if (assigns.length === 0) return [];

  const classNames = Array.from(new Set(assigns.map(a => a.class_name)));
  const subjectIds = Array.from(new Set(assigns.map(a => a.subject_id).filter(Boolean)));

  // Fetch relevant exams
  const { data: exams } = await supabase
    .from('exams')
    .select('id, exam_name, class, academic_year, created_at')
    .in('class', classNames);

  if (!exams || exams.length === 0) return [];
  const examIds = exams.map(e => e.id);

  // Fetch exam subjects for these exams and matching teacher subjects
  let esQuery = supabase.from('exam_subjects').select('id, exam_id, subject_id, subject_name, max_marks, pass_marks').in('exam_id', examIds);
  if (subjectIds.length > 0) {
    esQuery = esQuery.in('subject_id', subjectIds);
  }
  const { data: examSubjects } = await esQuery;
  if (!examSubjects || examSubjects.length === 0) return [];

  // Fetch real marks count
  const { data: allMarks } = await supabase
    .from('marks')
    .select('exam_id, subject_id, obtained_marks')
    .in('exam_id', examIds);

  // Fetch total students per class
  const { data: stdCounts } = await supabase
    .from('students')
    .select('class, id')
    .in('class', classNames)
    .eq('status', 'active');

  const studentCountMap: Record<string, number> = {};
  (stdCounts || []).forEach(s => {
    studentCountMap[s.class] = (studentCountMap[s.class] || 0) + 1;
  });

  const tasks: any[] = [];

  for (const es of examSubjects) {
    const parentExam = exams.find(e => e.id === es.exam_id);
    if (!parentExam) continue;

    const totalStudents = studentCountMap[parentExam.class] || 30;
    const entered = (allMarks || []).filter(m => m.exam_id === es.exam_id && m.subject_id === es.subject_id && m.obtained_marks !== null).length;
    
    let status = 'draft';
    if (entered === 0) status = 'draft';
    else if (entered < totalStudents) status = 'in_progress';
    else status = 'submitted';

    tasks.push({
      id: `${parentExam.id}-${es.subject_id}`,
      exam_id: parentExam.id,
      exam_name: parentExam.exam_name,
      class_name: parentExam.class,
      subject_id: es.subject_id,
      subject_name: es.subject_name,
      teacher_id: teacherId,
      total_students: totalStudents,
      entered_count: entered,
      max_marks: es.max_marks || 100,
      pass_marks: es.pass_marks || 33,
      status
    });
  }

  return tasks;
}
