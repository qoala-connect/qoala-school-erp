// Examination module — exam types, exams, schedule/datesheet, subject mapping,
// marks entry, marks verification workflow, grade rules, result processing,
// publication, report cards, analytics.
import { asAdmin, ok, assert, check, module, refs, uniq, trashIt, svc } from './_harness.mjs';

export default async function run() {
  module('Examination');
  const { sb, user } = await asAdmin();
  const r = await refs();
  const yr = r.currentYear;

  // Pick a class that actually has students + class_subjects, like the UI would.
  const s = svc();
  const { data: candidates } = await s.from('students')
    .select('class_id, section_id, academic_year_id')
    .eq('academic_year_id', yr.id).not('class_id', 'is', null).limit(500);
  const counts = new Map();
  for (const c of candidates || []) counts.set(c.class_id, (counts.get(c.class_id) || 0) + 1);
  const classId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || r.classes[0].id;
  const clsRow = ok(await sb.from('classes').select('id,class_name').eq('id', classId).single(), 'class');

  let examTypeId = null, examId = null, examSubjectId = null, subjectId = null;
  let students = [];

  // --- Page: Examination > Exam Types
  await check('Exam/ExamTypes', 'Load exam types (select assessment_types)', async () => {
    const data = ok(await sb.from('assessment_types').select('*').order('display_order'), 'select assessment_types');
    assert(Array.isArray(data), 'not an array');
    return `${data.length} types`;
  });

  await check('Exam/ExamTypes', 'Create exam type (insert assessment_types)', async () => {
    const data = ok(await sb.from('assessment_types').insert({
      code: 'QA' + Math.floor(Math.random() * 9999), name: uniq('ExamType'),
      description: 'QA type', stage_category: 'all', default_weightage: 10,
      is_board_exam: false, display_order: 99, is_active: true,
    }).select().single(), 'insert assessment_types');
    examTypeId = data.id; trashIt('assessment_types', examTypeId);
    return 'ok';
  });

  await check('Exam/ExamTypes', 'Edit exam type (update assessment_types)', async () => {
    assert(examTypeId, 'no exam type');
    const data = ok(await sb.from('assessment_types').update({
      name: 'QA Type Renamed', default_weightage: 20, is_active: true,
    }).eq('id', examTypeId).select().single(), 'update assessment_types');
    assert(data.default_weightage == 20, 'weightage did not persist');
    return 'ok';
  });

  // --- Page: Examination > Grade Rules
  await check('Exam/GradeRules', 'Load grading rules (select grading_rules)', async () => {
    const data = ok(await sb.from('grading_rules').select('*').order('min_score', { ascending: false }), 'select grading_rules');
    assert(Array.isArray(data), 'not an array');
    return `${data.length} rules`;
  });

  await check('Exam/GradeRules', 'Save grade rule (insert grading_rules)', async () => {
    const data = ok(await sb.from('grading_rules').insert({
      grade_name: 'QAX', min_score: 0, max_score: 1, points: 0, remarks: 'QA rule',
    }).select().single(), 'insert grading_rules');
    trashIt('grading_rules', data.id);
    ok(await sb.from('grading_rules').update({ remarks: 'QA edited' }).eq('id', data.id), 'update grading_rules');
    return 'ok';
  });

  // --- Page: Examination > Exams (create exam + auto-seed subjects)
  await check('Exam/Exams', 'Create exam (insert exams)', async () => {
    const data = ok(await sb.from('exams').insert({
      exam_name: uniq('Exam'), short_name: 'QA1', exam_type: 'Periodic Assessment',
      academic_year: yr.name, academic_year_id: yr.id,
      class: clsRow.class_name, class_id: clsRow.id,
      description: 'QA exam', start_date: '2030-01-10', end_date: '2030-01-20',
      marks_entry_start_date: '2030-01-21', marks_entry_deadline: '2030-01-31',
      result_publish_date: '2030-02-10', status: 'draft', instructions: 'QA instructions',
    }).select().single(), 'insert exams');
    examId = data.id; trashIt('exams', examId);
    return `id=${examId.slice(0, 8)}`;
  });

  await check('Exam/Exams', 'Auto-seed subjects from Class Subjects (upsert exam_subjects)', async () => {
    assert(examId, 'no exam');
    const csRows = ok(await sb.from('class_subjects')
      .select('subject_id, is_active, subjects:subject_id(subject_name)')
      .eq('class_id', clsRow.id).eq('academic_year_id', yr.id), 'select class_subjects');
    assert(csRows.length > 0, `class ${clsRow.class_name} has no class_subjects mapped — exam would be created with zero subjects`);
    const rows = [...new Map(csRows.filter((x) => x.is_active !== false && x.subject_id)
      .map((x) => [x.subject_id, x])).values()].map((x) => ({
      exam_id: examId, class_id: clsRow.id, subject_id: x.subject_id,
      subject_name: x.subjects?.subject_name || 'Subject', max_marks: 20, pass_marks: 7,
      teacher_id: null, component_name: 'QA1', review_status: 'draft',
    }));
    ok(await sb.from('exam_subjects').upsert(rows, { onConflict: 'exam_id,subject_id' }), 'upsert exam_subjects');
    const seeded = ok(await sb.from('exam_subjects').select('id,subject_id').eq('exam_id', examId), 'reread');
    assert(seeded.length === rows.length, `seeded ${seeded.length} of ${rows.length}`);
    examSubjectId = seeded[0].id; subjectId = seeded[0].subject_id;
    return `${seeded.length} subjects`;
  });

  await check('Exam/Exams', 'Edit exam (update exams)', async () => {
    assert(examId, 'no exam');
    const data = ok(await sb.from('exams').update({
      description: 'QA exam edited', instructions: 'QA edited instructions',
    }).eq('id', examId).select().single(), 'update exams');
    assert(data.description === 'QA exam edited', 'edit did not persist');
    return 'ok';
  });

  await check('Exam/Exams', 'Exam status lifecycle (update exams.status)', async () => {
    assert(examId, 'no exam');
    const flow = ['scheduled', 'marks_entry_open', 'review', 'locked', 'result_processed'];
    for (const st of flow) {
      ok(await sb.from('exams').update({ status: st }).eq('id', examId).select().single(), `set status "${st}"`);
    }
    return flow.join(' -> ');
  });

  // --- Page: Examination > Schedule / Datesheet
  await check('Exam/Schedule', 'Set datesheet slot (update exam_subjects date/time/room)', async () => {
    assert(examSubjectId, 'no exam subject');
    const data = ok(await sb.from('exam_subjects').update({
      exam_date: '2030-01-12', start_time: '09:00 AM', end_time: '11:00 AM',
      duration: '2 Hours', room: 'QA-Hall-1', instructions: 'Bring admit card',
    }).eq('id', examSubjectId).select().single(), 'update exam_subjects schedule');
    assert(data.room === 'QA-Hall-1', 'room did not persist');
    return 'ok';
  });

  await check('Exam/Schedule', 'Assign invigilator (update exam_subjects.invigilator_id)', async () => {
    assert(examSubjectId && r.teachers[0], 'no exam subject/teacher');
    const data = ok(await sb.from('exam_subjects').update({ invigilator_id: r.teachers[0].id })
      .eq('id', examSubjectId).select().single(), 'assign invigilator');
    assert(data.invigilator_id === r.teachers[0].id, 'invigilator did not persist');
    return 'ok';
  });

  // --- Page: Examination > Subject Mapping
  await check('Exam/SubjectMapping', 'Configure subject marks + teacher (update exam_subjects)', async () => {
    assert(examSubjectId, 'no exam subject');
    const data = ok(await sb.from('exam_subjects').update({
      max_marks: 80, pass_marks: 27, teacher_id: r.teachers[0] ? r.teachers[0].id : null,
      component_name: 'Term 1',
    }).eq('id', examSubjectId).select().single(), 'update exam_subjects mapping');
    assert(data.max_marks === 80, 'max_marks did not persist');
    return 'ok';
  });

  // --- Page: Examination > Marks Entry
  await check('Exam/MarksEntry', 'Load student roster (select students)', async () => {
    const data = ok(await sb.from('students')
      .select('id, name, roll_number, class, section')
      .eq('class_id', clsRow.id).eq('academic_year_id', yr.id)
      .eq('status', 'active').order('roll_number').limit(60), 'select students');
    assert(data.length > 0, 'roster is empty — marks entry would show no students');
    students = data;
    return `${data.length} students`;
  });

  await check('Exam/MarksEntry', 'Save marks draft (upsert marks)', async () => {
    assert(examId && subjectId && students.length, 'missing exam/subject/students');
    const rows = students.slice(0, 10).map((st, i) => ({
      exam_id: examId, student_id: st.id, subject_id: subjectId, max_marks: 80,
      obtained_marks: 40 + (i % 30), attendance_status: 'Present',
      is_absent: false, is_medical: false, is_exempted: false,
      remarks: null, status: 'draft', entered_by: user.id, updated_at: new Date().toISOString(),
    }));
    ok(await sb.from('marks').upsert(rows, { onConflict: 'exam_id,student_id,subject_id' }), 'upsert marks');
    const saved = ok(await sb.from('marks').select('id').eq('exam_id', examId).eq('subject_id', subjectId), 'reread');
    assert(saved.length === rows.length, `saved ${saved.length} of ${rows.length}`);
    for (const m of saved) trashIt('marks', m.id);
    return `${saved.length} marks`;
  });

  await check('Exam/MarksEntry', 'Absent / medical / exempted rows (upsert marks)', async () => {
    assert(students.length >= 3, 'not enough students');
    const variants = [
      { st: students[0], attendance_status: 'Absent', is_absent: true, is_medical: false, is_exempted: false },
      { st: students[1], attendance_status: 'Medical', is_absent: false, is_medical: true, is_exempted: false },
      { st: students[2], attendance_status: 'Exempted', is_absent: false, is_medical: false, is_exempted: true },
    ];
    const rows = variants.map((v) => ({
      exam_id: examId, student_id: v.st.id, subject_id: subjectId, max_marks: 80,
      obtained_marks: null, attendance_status: v.attendance_status,
      is_absent: v.is_absent, is_medical: v.is_medical, is_exempted: v.is_exempted,
      status: 'draft', entered_by: user.id, updated_at: new Date().toISOString(),
    }));
    ok(await sb.from('marks').upsert(rows, { onConflict: 'exam_id,student_id,subject_id' }), 'upsert absent/medical/exempted');
    return '3 variants';
  });

  await check('Exam/MarksEntry', 'Draft flips review_status to in_progress (update exam_subjects)', async () => {
    ok(await sb.from('exam_subjects').update({ review_status: 'in_progress' })
      .eq('exam_id', examId).eq('subject_id', subjectId).eq('review_status', 'draft'), 'update review_status');
    return 'ok';
  });

  // --- Page: Examination > Marks Verification workflow
  await check('Exam/MarksVerification', 'Submit for review (update exam_subjects + marks)', async () => {
    ok(await sb.from('exam_subjects').update({ review_status: 'submitted', reviewed_at: null, reopen_reason: null })
      .eq('exam_id', examId).eq('subject_id', subjectId), 'submit exam_subjects');
    ok(await sb.from('marks').update({ status: 'submitted', updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('exam_id', examId).eq('subject_id', subjectId), 'submit marks');
    const es = ok(await sb.from('exam_subjects').select('review_status').eq('exam_id', examId).eq('subject_id', subjectId).single(), 'reread');
    assert(es.review_status === 'submitted', `review_status is ${es.review_status}`);
    return 'ok';
  });

  await check('Exam/MarksVerification', 'Return for correction (update exam_subjects + marks)', async () => {
    ok(await sb.from('exam_subjects').update({
      review_status: 'returned', reopen_reason: 'QA correction needed',
      reviewed_by: user.id, reviewed_at: new Date().toISOString(),
    }).eq('exam_id', examId).eq('subject_id', subjectId), 'return exam_subjects');
    ok(await sb.from('marks').update({ status: 'returned', updated_at: new Date().toISOString() })
      .eq('exam_id', examId).eq('subject_id', subjectId), 'return marks');
    return 'ok';
  });

  await check('Exam/MarksVerification', 'Re-submit then approve (update exam_subjects + marks)', async () => {
    ok(await sb.from('exam_subjects').update({ review_status: 'submitted', reopen_reason: null })
      .eq('exam_id', examId).eq('subject_id', subjectId), 're-submit');
    ok(await sb.from('exam_subjects').update({
      review_status: 'approved', reopen_reason: null, reviewed_by: user.id, reviewed_at: new Date().toISOString(),
    }).eq('exam_id', examId).eq('subject_id', subjectId), 'approve exam_subjects');
    ok(await sb.from('marks').update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('exam_id', examId).eq('subject_id', subjectId), 'approve marks');
    const es = ok(await sb.from('exam_subjects').select('review_status').eq('exam_id', examId).eq('subject_id', subjectId).single(), 'reread');
    assert(es.review_status === 'approved', `review_status is ${es.review_status}`);
    return 'ok';
  });

  await check('Exam/MarksVerification', 'Lock marks (update exam_subjects.locked + marks.status)', async () => {
    ok(await sb.from('exam_subjects').update({
      locked: true, review_status: 'locked', locked_by: user.id,
      locked_at: new Date().toISOString(), unlock_reason: null,
    }).eq('exam_id', examId).eq('subject_id', subjectId), 'lock exam_subjects');
    ok(await sb.from('marks').update({ status: 'locked' })
      .eq('exam_id', examId).eq('subject_id', subjectId), 'lock marks');
    const es = ok(await sb.from('exam_subjects').select('locked').eq('exam_id', examId).eq('subject_id', subjectId).single(), 'reread');
    assert(es.locked === true, 'lock did not persist');
    return 'ok';
  });

  await check('Exam/MarksVerification', 'Locked marks reject further edits (guard enforced)', async () => {
    const res = await sb.from('marks').update({ obtained_marks: 1 })
      .eq('exam_id', examId).eq('subject_id', subjectId).eq('status', 'locked').select();
    // Either the DB guard raises, or nothing is updated. A silent success would
    // mean the lock button is decorative.
    if (!res.error) {
      const rows = ok(await sb.from('marks').select('obtained_marks').eq('exam_id', examId).eq('subject_id', subjectId).limit(5), 'reread');
      assert(!rows.some((x) => x.obtained_marks === 1), 'locked marks were editable — lock is not enforced');
    }
    return res.error ? `guard raised: ${res.error.code}` : 'no rows changed';
  });

  await check('Exam/MarksVerification', 'Unlock marks with reason (update exam_subjects)', async () => {
    ok(await sb.from('exam_subjects').update({
      locked: false, review_status: 'approved', unlock_reason: 'QA unlock',
      reviewed_by: user.id, reviewed_at: new Date().toISOString(),
    }).eq('exam_id', examId).eq('subject_id', subjectId), 'unlock exam_subjects');
    ok(await sb.from('marks').update({ status: 'approved' })
      .eq('exam_id', examId).eq('subject_id', subjectId), 'restore marks status');
    return 'ok';
  });

  // --- Page: Examination > Result Processing
  await check('Exam/ResultProcessing', 'Write computed results (upsert exam_results)', async () => {
    assert(students.length, 'no students');
    const rows = students.slice(0, 10).map((st, i) => ({
      exam_id: examId, student_id: st.id, class_id: clsRow.id, academic_year_id: yr.id,
      total_marks: 40 + i, max_total_marks: 80, percentage: ((40 + i) / 80) * 100,
      grade: 'B', division: 'First', result_status: 'Pass', rank: i + 1,
      processed_at: new Date().toISOString(), processed_by: null, published: false,
    }));
    const data = ok(await sb.from('exam_results').upsert(rows, { onConflict: 'exam_id,student_id' }).select('id'), 'upsert exam_results');
    assert(data && data.length, 'upsert returned no rows');
    for (const x of data) trashIt('exam_results', x.id);
    return `${data.length} results`;
  });

  // --- Page: Examination > Result Publication
  await check('Exam/ResultPublication', 'Publish results (update exam_results + exams)', async () => {
    const now = new Date().toISOString();
    ok(await sb.from('exam_results').update({ published: true, published_at: now })
      .eq('exam_id', examId), 'publish exam_results');
    ok(await sb.from('exams').update({ is_published: true, published_at: now, status: 'published' })
      .eq('id', examId), 'publish exams');
    const rows = ok(await sb.from('exam_results').select('published').eq('exam_id', examId).limit(5), 'reread');
    assert(rows.length && rows.every((x) => x.published === true), 'publish did not persist');
    return 'ok';
  });

  // --- Page: Examination > Report Cards / Merit / Rank / Analytics (read paths)
  await check('Exam/ReportCards', 'Load report card data (select exam_results + marks)', async () => {
    const [res, mk] = await Promise.all([
      sb.from('exam_results').select('*, students:student_id(name, roll_number)').eq('exam_id', examId).limit(50),
      sb.from('marks').select('*, subjects:subject_id(subject_name)').eq('exam_id', examId).limit(200),
    ]);
    ok(res, 'exam_results join'); ok(mk, 'marks join');
    assert(res.data.length > 0, 'no results for report card');
    return `${res.data.length} results / ${mk.data.length} marks`;
  });

  await check('Exam/MeritRank', 'Load merit + rank list (select exam_results ordered)', async () => {
    const data = ok(await sb.from('exam_results').select('student_id, percentage, rank')
      .eq('exam_id', examId).order('rank').limit(50), 'select ranked results');
    assert(data.length > 0, 'no ranked results');
    return `${data.length} ranked`;
  });

  await check('Exam/Analytics', 'Load analytics aggregates (select exam_results/marks)', async () => {
    const [a, b] = await Promise.all([
      sb.from('exam_results').select('percentage, grade, result_status').eq('academic_year_id', yr.id).limit(500),
      sb.from('marks').select('obtained_marks, max_marks, subject_id').eq('exam_id', examId).limit(500),
    ]);
    ok(a, 'exam_results aggregate'); ok(b, 'marks aggregate');
    return `${a.data.length} results / ${b.data.length} marks`;
  });

  await check('Exam/CoScholastic', 'Save co-scholastic grades (upsert co_scholastic)', async () => {
    assert(students.length, 'no students');
    const st = students[0];
    const res = await sb.from('co_scholastic').insert({
      student_id: st.id, exam_id: examId, academic_year_id: yr.id, academic_year: yr.name,
      discipline: 'A', reading_skill: 'A', writing_skill: 'B', behavior: 'A',
      sports: 'A', art: 'B', music: 'A', dance: 'B', computer: 'A',
      leadership: 'A', communication: 'A', remarks: 'QA co-scholastic',
    }).select().single();
    ok(res, 'insert co_scholastic');
    trashIt('co_scholastic', res.data.id);
    return 'ok';
  });

  // --- Page: Examination > delete exam (cascade cleanup the service performs)
  await check('Exam/Exams', 'Delete exam cascade (delete marks/results/subjects/exam)', async () => {
    assert(examId, 'no exam');
    ok(await sb.from('co_scholastic').delete().eq('exam_id', examId), 'delete co_scholastic');
    ok(await sb.from('marks').delete().eq('exam_id', examId), 'delete marks');
    ok(await sb.from('exam_results').delete().eq('exam_id', examId), 'delete exam_results');
    ok(await sb.from('exam_subjects').delete().eq('exam_id', examId), 'delete exam_subjects');
    ok(await sb.from('exams').delete().eq('id', examId), 'delete exams');
    const after = ok(await sb.from('exams').select('id').eq('id', examId).maybeSingle(), 'reread');
    assert(!after, 'exam survived delete');
    examId = null;
    return 'ok';
  });

  // --- Page: Examination > Attendance-linked entry (AttendanceEntry page)
  await check('Attendance/Entry', 'Save attendance (rpc save_attendance)', async () => {
    assert(students.length, 'no students');
    const day = new Date().toISOString().slice(0, 10);
    const records = students.slice(0, 5).map((st, i) => ({
      student_id: st.id, status: i === 0 ? 'absent' : 'present', remarks: null,
    }));
    ok(await sb.rpc('save_attendance', {
      _attendance_date: day, _class: students[0].class, _section: students[0].section,
      _records: records,
    }), 'rpc save_attendance');
    const saved = ok(await sb.from('attendance').select('id,status').eq('attendance_date', day)
      .in('student_id', records.map((x) => x.student_id)), 'reread');
    assert(saved.length === records.length, `saved ${saved.length} of ${records.length}`);
    for (const a of saved) trashIt('attendance', a.id);
    return `${saved.length} rows`;
  });
}
