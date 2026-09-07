import { SupabaseClient, User } from '@supabase/supabase-js';

export interface UserContext {
  user: User;
  userId: string;
  email: string;
  name: string;
  role: string;
  roleCategory: 'admin' | 'teacher' | 'student' | 'staff';
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  studentId?: string | null;
  studentName?: string | null;
  studentClass?: string | null;
  studentSection?: string | null;
  studentRollNumber?: string | null;
  teacherId?: string | null;
  teacherName?: string | null;
  assignedClasses: string[];
  assignedSections: string[];
  assignedSubjectIds: string[];
}

/**
 * Resolves the authenticated user context from the incoming Bearer token.
 * This runs securely on the server and checks the Supabase session, profiles table,
 * and linked student or teacher records.
 */
export async function resolveUserContext(
  token: string | null | undefined,
  adminClient: SupabaseClient | null
): Promise<{ context: UserContext | null; error: string | null; statusCode: number }> {
  // Return guest/visitor context if no token or database client
  if (!token || !adminClient) {
    return {
      context: {
        user: null as any,
        userId: 'guest',
        email: 'visitor@stjosephs.edu.in',
        name: 'Guest Visitor',
        role: 'visitor',
        roleCategory: 'student',
        isAdmin: false,
        isTeacher: false,
        isStudent: false,
        studentId: null,
        studentName: null,
        studentClass: null,
        studentSection: null,
        studentRollNumber: null,
        teacherId: null,
        teacherName: null,
        assignedClasses: [],
        assignedSections: [],
        assignedSubjectIds: []
      },
      error: null,
      statusCode: 200
    };
  }

  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  if (!cleanToken) {
    return {
      context: {
        user: null as any,
        userId: 'guest',
        email: 'visitor@stjosephs.edu.in',
        name: 'Guest Visitor',
        role: 'visitor',
        roleCategory: 'student',
        isAdmin: false,
        isTeacher: false,
        isStudent: false,
        studentId: null,
        studentName: null,
        studentClass: null,
        studentSection: null,
        studentRollNumber: null,
        teacherId: null,
        teacherName: null,
        assignedClasses: [],
        assignedSections: [],
        assignedSubjectIds: []
      },
      error: null,
      statusCode: 200
    };
  }

  // 1. Verify token with Supabase Auth
  const { data: userData, error: authError } = await adminClient.auth.getUser(cleanToken);
  if (authError || !userData?.user) {
    // If token expired or invalid, fall back to safe guest context
    return {
      context: {
        user: null as any,
        userId: 'guest',
        email: 'visitor@stjosephs.edu.in',
        name: 'Guest Visitor',
        role: 'visitor',
        roleCategory: 'student',
        isAdmin: false,
        isTeacher: false,
        isStudent: false,
        studentId: null,
        studentName: null,
        studentClass: null,
        studentSection: null,
        studentRollNumber: null,
        teacherId: null,
        teacherName: null,
        assignedClasses: [],
        assignedSections: [],
        assignedSubjectIds: []
      },
      error: null,
      statusCode: 200
    };
  }

  const user = userData.user;
  const userId = user.id;
  const email = user.email || '';
  const metaName = user.user_metadata?.full_name || email.split('@')[0] || 'User';

  // 2. Fetch role from profiles table
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role, name')
    .eq('id', userId)
    .maybeSingle();

  const role = (profile?.role || 'student').toLowerCase();
  const displayName = profile?.name || metaName;

  const adminRoles = ['super_admin', 'admin', 'principal', 'vice_principal', 'accountant', 'exam_controller', 'hr'];
  const teacherRoles = ['teacher', 'class_teacher'];
  const studentRoles = ['student', 'parent'];

  let roleCategory: 'admin' | 'teacher' | 'student' | 'staff' = 'student';
  if (adminRoles.includes(role)) roleCategory = 'admin';
  else if (teacherRoles.includes(role)) roleCategory = 'teacher';
  else if (studentRoles.includes(role)) roleCategory = 'student';
  else roleCategory = 'staff';

  let studentId: string | null = null;
  let studentName: string | null = null;
  let studentClass: string | null = null;
  let studentSection: string | null = null;
  let studentRollNumber: string | null = null;

  let teacherId: string | null = null;
  let teacherName: string | null = null;
  const assignedClasses: string[] = [];
  const assignedSections: string[] = [];
  const assignedSubjectIds: string[] = [];

  // 3. Resolve Student Entity if student/parent
  if (roleCategory === 'student') {
    // Try user_id first
    let { data: studentRecord } = await adminClient
      .from('students')
      .select('id, name, class, section, roll_number')
      .eq('user_id', userId)
      .maybeSingle();

    // Fallback to email
    if (!studentRecord && email) {
      const { data: byEmail } = await adminClient
        .from('students')
        .select('id, name, class, section, roll_number')
        .ilike('email', email)
        .maybeSingle();
      studentRecord = byEmail;
    }

    // Fallback to name match for test/demo accounts
    if (!studentRecord && email) {
      const prefix = email.split('@')[0];
      const { data: byName } = await adminClient
        .from('students')
        .select('id, name, class, section, roll_number')
        .ilike('name', `%${prefix}%`)
        .limit(1)
        .maybeSingle();
      studentRecord = byName;
    }

    if (studentRecord) {
      studentId = studentRecord.id;
      studentName = studentRecord.name;
      studentClass = studentRecord.class;
      studentSection = studentRecord.section;
      studentRollNumber = studentRecord.roll_number;
    }
  }

  // 4. Resolve Teacher Entity if teacher
  if (roleCategory === 'teacher') {
    let { data: teacherRecord } = await adminClient
      .from('teachers')
      .select('id, name')
      .eq('user_id', userId)
      .maybeSingle();

    if (!teacherRecord && email) {
      const { data: byEmail } = await adminClient
        .from('teachers')
        .select('id, name')
        .ilike('email', email)
        .maybeSingle();
      teacherRecord = byEmail;
    }

    if (!teacherRecord && email) {
      const prefix = email.split('@')[0];
      const { data: byName } = await adminClient
        .from('teachers')
        .select('id, name')
        .ilike('name', `%${prefix}%`)
        .limit(1)
        .maybeSingle();
      teacherRecord = byName;
    }

    if (teacherRecord) {
      teacherId = teacherRecord.id;
      teacherName = teacherRecord.name;

      // Fetch active teacher assignments
      const { data: assigns } = await adminClient
        .from('teacher_assignments')
        .select(`
          class_id,
          section_id,
          subject_id,
          classes (class_name),
          sections (section_name)
        `)
        .eq('teacher_id', teacherRecord.id)
        .eq('is_active', true);

      (assigns || []).forEach((a: any) => {
        const cls = a.classes?.class_name;
        const sec = a.sections?.section_name;
        if (cls && !assignedClasses.includes(cls)) assignedClasses.push(cls);
        if (cls && sec && !assignedSections.includes(`${cls}-${sec}`)) assignedSections.push(`${cls}-${sec}`);
        if (a.subject_id && !assignedSubjectIds.includes(a.subject_id)) assignedSubjectIds.push(a.subject_id);
      });
    }
  }

  return {
    context: {
      user,
      userId,
      email,
      name: displayName,
      role,
      roleCategory,
      isAdmin: roleCategory === 'admin',
      isTeacher: roleCategory === 'teacher',
      isStudent: roleCategory === 'student',
      studentId,
      studentName,
      studentClass,
      studentSection,
      studentRollNumber,
      teacherId,
      teacherName,
      assignedClasses,
      assignedSections,
      assignedSubjectIds
    },
    error: null,
    statusCode: 200
  };
}
