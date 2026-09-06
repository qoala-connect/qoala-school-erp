// Staff & Faculty module — Teacher Directory & 360, Academic Assignments,
// Non-Teaching Staff, Departments.
import { asAdmin, ok, assert, check, module, refs, uniq, trashIt } from './_harness.mjs';
import crypto from 'crypto';

export default async function run() {
  module('Staff');
  const { sb } = await asAdmin();
  const r = await refs();
  const yr = r.currentYear;
  const cls = r.classes[0];
  const sec = r.sections[0];
  const subject = r.subjects[0];
  let teacherId = null, staffId = null, deptId = null, assignmentId = null;

  // --- Page: Teachers > Directory
  await check('Teachers/Directory', 'Load teacher directory (select teachers)', async () => {
    const data = ok(await sb.from('teachers').select('*').order('name').limit(200), 'select teachers');
    assert(Array.isArray(data), 'not an array');
    return `${data.length} teachers`;
  });

  await check('Teachers/Form', 'Reference dropdowns load (departments/profiles)', async () => {
    const [d, p] = await Promise.all([
      sb.from('departments').select('id, department_name').eq('is_active', true).order('department_name'),
      sb.from('profiles').select('id, email, name, role').in('role', ['teacher', 'class_teacher', 'admin']),
    ]);
    ok(d, 'departments'); ok(p, 'profiles');
    return `${d.data.length} departments / ${p.data.length} linkable profiles`;
  });

  // --- Page: Teachers > Add Teacher modal
  await check('Teachers/Form', 'Submit new teacher (insert teachers)', async () => {
    const id = crypto.randomUUID();
    const data = ok(await sb.from('teachers').insert([{
      id, name: uniq('Teacher'), employee_id: 'QA-FAC-' + Math.floor(Math.random() * 99999),
      user_id: null, email: 'qa.teacher@example.com', phone: '9700000001', photo_url: null,
      gender: 'Male', date_of_birth: '1990-01-01', joining_date: '2024-06-01',
      status: 'Active', designation: 'Teacher', department: 'Teaching Faculty',
      department_id: null, subject_id: subject ? subject.id : null,
      qualification: 'M.Sc', highest_qualification: 'M.Sc', experience_years: 5,
      employment_type: 'Full-Time', cbse_teaching_level: 'TGT', ctet_qualified: true,
      address: 'QA Address', emergency_contact_name: 'QA Contact',
      emergency_contact_phone: '9700000002', blood_group: 'B+',
      is_active: true, updated_at: new Date().toISOString(),
    }]).select().single(), 'insert teachers');
    teacherId = data.id; trashIt('teachers', teacherId);
    return `id=${teacherId.slice(0, 8)}`;
  });

  await check('Teachers/Form', 'Save teacher edits (update teachers)', async () => {
    assert(teacherId, 'no teacher');
    const data = ok(await sb.from('teachers').update({
      designation: 'Senior Teacher', experience_years: 8, cbse_teaching_level: 'PGT',
      updated_at: new Date().toISOString(),
    }).eq('id', teacherId).select().single(), 'update teachers');
    assert(data.designation === 'Senior Teacher', 'edit did not persist');
    return 'ok';
  });

  await check('Teachers/Directory', 'Every lifecycle status accepted (update teachers.status)', async () => {
    assert(teacherId, 'no teacher');
    // The full TeacherLifecycleStatus vocabulary from src/services/teacherService.ts.
    const statuses = ['Draft', 'Active', 'On Leave', 'Inactive', 'Transferred', 'Resigned', 'Retired', 'Archived'];
    for (const st of statuses) {
      const isActive = st === 'Active' || st === 'Draft';
      ok(await sb.from('teachers').update({ status: st, is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', teacherId).select().single(), `status "${st}"`);
    }
    ok(await sb.from('teachers').update({ status: 'Active', is_active: true }).eq('id', teacherId), 'restore Active');
    return `${statuses.length} statuses`;
  });

  // --- Page: Teachers > Academic Assignments
  await check('Teachers/Assignments', 'Create assignment (insert teacher_assignments)', async () => {
    assert(teacherId && subject, 'no teacher/subject');
    const data = ok(await sb.from('teacher_assignments').insert([{
      teacher_id: teacherId, academic_year_id: yr.id, class_id: cls.id,
      section_id: sec.id, subject_id: subject.id,
      assignment_type: 'subject_teacher', is_active: true,
    }]).select().single(), 'insert teacher_assignments');
    assignmentId = data.id; trashIt('teacher_assignments', assignmentId);
    return 'ok';
  });

  await check('Teachers/Assignments', 'Every assignment type accepted (update teacher_assignments)', async () => {
    assert(assignmentId, 'no assignment');
    // 'class_teacher' and 'both' are deliberately excluded here: the
    // uq_single_active_class_teacher index allows only one active class teacher
    // per class-section, and this QA section already has one. That guard is
    // covered by its own check below.
    const types = ['subject_teacher', 'assistant_teacher', 'examiner'];
    for (const t of types) {
      ok(await sb.from('teacher_assignments').update({ assignment_type: t }).eq('id', assignmentId).select().single(), `type "${t}"`);
    }
    return `${types.length} types`;
  });

  await check('Teachers/Assignments', 'Duplicate class teacher is rejected (uq_single_active_class_teacher)', async () => {
    assert(assignmentId, 'no assignment');
    const existing = ok(await sb.from('teacher_assignments').select('id, class_id, section_id')
      .eq('academic_year_id', yr.id).eq('is_active', true)
      .in('assignment_type', ['class_teacher', 'both']).limit(1), 'find an existing class teacher');
    if (!existing.length) return 'skipped — no existing class teacher to collide with';
    const res = await sb.from('teacher_assignments').update({
      assignment_type: 'class_teacher', class_id: existing[0].class_id, section_id: existing[0].section_id,
    }).eq('id', assignmentId).select();
    assert(res.error && res.error.code === '23505',
      `a second class teacher was accepted for the same section — guard not enforced (${res.error ? res.error.code : 'no error'})`);
    return 'guard enforced';
  });

  await check('Teachers/Assignments', 'Load assignments with joins (select teacher_assignments)', async () => {
    const data = ok(await sb.from('teacher_assignments').select(`
      id, assignment_type, is_active,
      teachers:teacher_id(id, name, employee_id),
      classes:class_id(id, class_name),
      sections:section_id(id, section_name),
      subjects:subject_id(id, subject_name)
    `).eq('academic_year_id', yr.id).limit(200), 'select teacher_assignments');
    assert(Array.isArray(data), 'not an array');
    return `${data.length} assignments`;
  });

  await check('Teachers/Assignments', 'Deactivate + delete assignment', async () => {
    assert(assignmentId, 'no assignment');
    ok(await sb.from('teacher_assignments').update({ is_active: false }).eq('id', assignmentId), 'deactivate');
    ok(await sb.from('teacher_assignments').delete().eq('id', assignmentId), 'delete');
    const after = ok(await sb.from('teacher_assignments').select('id').eq('id', assignmentId).maybeSingle(), 'reread');
    assert(!after, 'assignment survived delete');
    assignmentId = null;
    return 'ok';
  });

  // --- Page: Teacher 360 drawer
  await check('Teachers/Teacher360', 'Load 360 panels (workload/timetable/exams)', async () => {
    assert(teacherId, 'no teacher');
    const res = await Promise.all([
      sb.from('timetable').select('id, day, period_number').eq('teacher_id', teacherId).limit(50),
      sb.from('teacher_assignments').select('id').eq('teacher_id', teacherId).limit(50),
      sb.from('exam_subjects').select('id, subject_name').eq('teacher_id', teacherId).limit(50),
      sb.from('lesson_plans').select('id, topic, status').eq('teacher_id', teacherId).limit(50),
    ]);
    const bad = res.map((x, i) => (x.error ? `${i}:${x.error.message}` : null)).filter(Boolean);
    assert(!bad.length, `panel errors -> ${bad.join(' | ')}`);
    return '4 panels ok';
  });

  await check('Teachers/Teacher360', 'Teacher summary (rpc teacher_academic_summary)', async () => {
    assert(teacherId, 'no teacher');
    const res = await sb.rpc('teacher_academic_summary', { _teacher_id: teacherId, _academic_year_id: yr.id });
    ok(res, 'rpc teacher_academic_summary');
    return 'ok';
  });

  // --- Page: Departments
  await check('Staff/Departments', 'Create department (insert departments)', async () => {
    const data = ok(await sb.from('departments').insert({
      department_name: uniq('Dept').slice(0, 40), code: 'QD' + Math.floor(Math.random() * 999),
      head_id: null, is_active: true,
    }).select().single(), 'insert departments');
    deptId = data.id; trashIt('departments', deptId);
    ok(await sb.from('departments').update({ code: 'QDX' }).eq('id', deptId), 'update departments');
    return 'ok';
  });

  // --- Page: Employees (Non-Teaching Staff)
  await check('Employees', 'Submit new employee (insert staff)', async () => {
    const data = ok(await sb.from('staff').insert([{
      name: uniq('Staff'), role_title: 'Accountant', department: 'Administration',
      designation: 'Accounts Officer', email: 'qa.staff@example.com', phone: '9600000001',
      salary: 25000, joining_date: '2024-05-01', status: 'Active', is_active: true,
      employment_type: 'Full-Time', experience_years: 3, gender: 'Female',
      date_of_birth: '1992-02-02', address: 'QA Address',
      cbse_teaching_level: null, ctet_qualified: false, highest_qualification: 'B.Com',
    }]).select().single(), 'insert staff');
    staffId = data.id; trashIt('staff', staffId);
    return `id=${staffId.slice(0, 8)}`;
  });

  await check('Employees', 'Save employee edits (update staff)', async () => {
    assert(staffId, 'no staff');
    const data = ok(await sb.from('staff').update({
      salary: 28000, designation: 'Senior Accounts Officer',
    }).eq('id', staffId).select().single(), 'update staff');
    assert(Number(data.salary) === 28000, 'salary did not persist');
    return 'ok';
  });

  await check('Employees', 'Every employee status accepted (rpc set_staff_status)', async () => {
    assert(staffId, 'no staff');
    // Exactly EMPLOYEE_STATUSES from src/pages/dashboard/Employees.tsx.
    const statuses = ['Active', 'Probation', 'On Leave', 'Suspended', 'Resigned', 'Retired', 'Terminated'];
    for (const st of statuses) {
      ok(await sb.rpc('set_staff_status', { _staff_id: staffId, _status: st, _reason: 'QA test' }), `status "${st}"`);
    }
    ok(await sb.rpc('set_staff_status', { _staff_id: staffId, _status: 'Active', _reason: 'QA restore' }), 'restore Active');
    return `${statuses.length} statuses`;
  });

  await check('Employees', 'Load staff directory (select staff)', async () => {
    const data = ok(await sb.from('staff').select('*').limit(200), 'select staff');
    assert(Array.isArray(data), 'not an array');
    return `${data.length} staff`;
  });

  // --- Page: Leave requests (staff self-service surfaced to admin)
  await check('Staff/Leave', 'Create + approve leave request (insert/update leave_requests)', async () => {
    assert(staffId, 'no staff');
    const data = ok(await sb.from('leave_requests').insert({
      applicant_id: staffId, applicant_type: 'staff', start_date: '2030-05-01',
      end_date: '2030-05-03', reason: 'QA leave', status: 'pending', is_active: true,
    }).select().single(), 'insert leave_requests');
    trashIt('leave_requests', data.id);
    ok(await sb.from('leave_requests').update({
      status: 'approved', approved_at: new Date().toISOString(),
    }).eq('id', data.id), 'approve leave_requests');
    return 'ok';
  });
}
