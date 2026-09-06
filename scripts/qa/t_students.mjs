// Students module — Student Directory/SIS, Student 360, Promotion, Medical, Discipline.
import { asAdmin, svc, ok, assert, check, module, refs, uniq, trashIt } from './_harness.mjs';

export default async function run() {
  module('Students');
  const { sb } = await asAdmin();
  const r = await refs();
  const cls = r.classes[0];
  const cls2 = r.classes[1] || r.classes[0];
  const sec = r.sections[0];
  const sec2 = r.sections[1] || r.sections[0];
  const yr = r.currentYear;
  let studentId = null;

  // --- Page: Students > Directory (list query the page actually issues)
  await check('Students/Directory', 'Load directory (select selective columns)', async () => {
    const data = ok(await sb.from('students').select(
      'id, admission_number, roll_number, name, father_name, mother_name, date_of_birth, gender, class, section, ' +
      'class_id, section_id, academic_year, academic_year_id, phone, email, address, category, status, ' +
      'status_changed_at, aadhaar_last4, photo_url, user_id, minority_status, cwsn_status, cwsn_type, ' +
      'only_child_girl, cbse_registration_no, house_name, created_at, updated_at'
    ).order('class').order('roll_number').limit(100), 'select students');
    assert(data.length > 0, 'directory is empty');
    return `${data.length} rows`;
  });

  // --- Page: Students > Add Student modal (rpc create_student)
  await check('Students/AddStudent', 'Submit new student (rpc create_student)', async () => {
    const res = await sb.rpc('create_student', {
      _name: uniq('Student'), _father_name: 'QA Father', _date_of_birth: '2014-06-15',
      _class_id: cls.id, _section_id: sec.id, _academic_year_id: yr.id,
      _mother_name: 'QA Mother', _gender: 'male', _phone: '9800000001',
      _email: 'qa.student@example.com', _address: 'QA Address', _category: 'General',
      _roll_number: null, _allow_duplicate: true,
    });
    const data = ok(res, 'rpc create_student');
    const created = Array.isArray(data) ? data[0] : data;
    studentId = created?.student_id ?? created?.id;
    assert(studentId, `rpc returned no id: ${JSON.stringify(data)}`);
    trashIt('students', studentId);
    return `id=${studentId.slice(0, 8)}`;
  });

  // --- Page: Students > Add Student modal, post-save extended-fields update
  await check('Students/AddStudent', 'Post-save CBSE/extended fields (update students)', async () => {
    assert(studentId, 'no student');
    ok(await sb.from('students').update({
      photo_url: null, aadhaar_last4: '4321', minority_status: false, cwsn_status: false,
      cwsn_type: null, only_child_girl: false, cbse_registration_no: 'QA-CBSE-1', house_name: 'Blue',
    }).eq('id', studentId), 'update extended fields');
    const row = ok(await sb.from('students').select('cbse_registration_no,house_name').eq('id', studentId).single(), 'reread');
    assert(row.cbse_registration_no === 'QA-CBSE-1', 'extended fields did not persist (RLS silently dropped update)');
    return 'ok';
  });

  // --- Page: Students > Edit Student modal (rpc update_student)
  await check('Students/EditStudent', 'Save edits (rpc update_student)', async () => {
    assert(studentId, 'no student');
    ok(await sb.rpc('update_student', {
      _student_id: studentId, _name: 'QA Student Renamed', _father_name: 'QA Father 2',
      _mother_name: 'QA Mother 2', _date_of_birth: '2014-06-15', _gender: 'male',
      _class_id: cls.id, _section_id: sec.id, _phone: '9800000002', _email: 'qa2@example.com',
      _address: 'QA Address 2', _category: 'OBC', _roll_number: null,
    }), 'rpc update_student');
    const row = ok(await sb.from('students').select('name,category').eq('id', studentId).single(), 'reread');
    assert(row.name === 'QA Student Renamed', 'name did not persist');
    return 'ok';
  });

  // --- Page: Students > row status menu (rpc set_student_status)
  await check('Students/StatusChange', 'Change status inactive/active (rpc set_student_status)', async () => {
    assert(studentId, 'no student');
    ok(await sb.rpc('set_student_status', { _student_id: studentId, _status: 'inactive', _reason: 'QA test' }), 'set inactive');
    const a = ok(await sb.from('students').select('status').eq('id', studentId).single(), 'reread');
    assert(a.status === 'inactive', `status is ${a.status}`);
    ok(await sb.rpc('set_student_status', { _student_id: studentId, _status: 'active', _reason: 'QA restore' }), 'set active');
    return 'ok';
  });

  // --- Page: Student 360 drawer > Notes tab
  await check('Students/Student360', 'Add internal note (insert student_notes)', async () => {
    assert(studentId, 'no student');
    const data = ok(await sb.from('student_notes').insert([{
      student_id: studentId, note: 'QA internal note', created_by: 'admin@school.com',
      created_at: new Date().toISOString(),
    }]).select().single(), 'insert student_notes');
    trashIt('student_notes', data.id);
    return 'ok';
  });

  // --- Page: Student 360 drawer > Documents tab
  await check('Students/Student360', 'Link document — every dropdown option (insert student_documents)', async () => {
    assert(studentId, 'no student');
    // Exactly the options offered by the "Link document" <select>.
    const types = ['Birth Certificate', 'Transfer Certificate', 'Previous Marksheet',
      'Aadhaar Card', 'Medical Fitness', 'Special Achievement'];
    for (const t of types) {
      const data = ok(await sb.from('student_documents').insert([{
        student_id: studentId, document_type: t,
        file_url: 'https://example.com/qa.pdf', created_at: new Date().toISOString(),
      }]).select().single(), `insert student_documents "${t}"`);
      trashIt('student_documents', data.id);
    }
    return `${types.length} types`;
  });

  // --- Page: Student 360 drawer > photo upload writes photo_url
  await check('Students/Student360', 'Set photo_url (update students)', async () => {
    assert(studentId, 'no student');
    ok(await sb.from('students').update({ photo_url: 'https://example.com/qa.png' }).eq('id', studentId), 'update photo_url');
    const row = ok(await sb.from('students').select('photo_url').eq('id', studentId).single(), 'reread');
    assert(row.photo_url === 'https://example.com/qa.png', 'photo_url did not persist');
    return 'ok';
  });

  // --- Page: Student 360 drawer > all read tabs
  await check('Students/Student360', 'Load all 360 tabs (select x11)', async () => {
    assert(studentId, 'no student');
    const q = [
      sb.from('attendance').select('id,status,attendance_date').eq('student_id', studentId).limit(5),
      sb.from('student_fees').select('id,status,net_amount').eq('student_id', studentId).limit(5),
      sb.from('marks').select('id,obtained_marks').eq('student_id', studentId).limit(5),
      sb.from('exam_results').select('id,percentage').eq('student_id', studentId).limit(5),
      sb.from('student_transport').select('id,route').eq('student_id', studentId).limit(5),
      sb.from('book_issues').select('id,status').limit(5),
      sb.from('student_documents').select('id').eq('student_id', studentId).limit(5),
      sb.from('student_medical').select('id').eq('student_id', studentId).limit(5),
      sb.from('disciplinary_records').select('id').eq('student_id', studentId).limit(5),
      sb.from('student_promotions').select('id').eq('student_id', studentId).limit(5),
      sb.from('student_activity').select('id').eq('student_id', studentId).limit(5),
    ];
    const res = await Promise.all(q);
    const bad = res.map((x, i) => (x.error ? `${i}:${x.error.message}` : null)).filter(Boolean);
    assert(!bad.length, `tab query errors -> ${bad.join(' | ')}`);
    return '11 tabs ok';
  });

  // --- Page: Students > Promote modal (4 writes, all must succeed)
  await check('Students/Promotion', 'Promote student (promotions + history + students + activity)', async () => {
    assert(studentId, 'no student');
    const cur = ok(await sb.from('students').select('class,section,academic_year,roll_number').eq('id', studentId).single(), 'read current');
    const targetYear = r.years.find((y) => y.id !== yr.id) || yr;

    const p = ok(await sb.from('student_promotions').insert([{
      student_id: studentId, from_class: cur.class, to_class: cls2.class_name,
      from_section: cur.section, to_section: sec2.section_name,
      from_academic_year: cur.academic_year, to_academic_year: targetYear.name,
      status: 'Promoted', promoted_at: new Date().toISOString(),
    }]).select().single(), 'insert student_promotions');
    trashIt('student_promotions', p.id);

    const h = ok(await sb.from('student_class_history').insert([{
      student_id: studentId, class: cur.class, section: cur.section,
      academic_year: cur.academic_year, roll_number: cur.roll_number,
      created_at: new Date().toISOString(),
    }]).select().single(), 'insert student_class_history');
    trashIt('student_class_history', h.id);

    ok(await sb.from('students').update({
      class_id: cls2.id, section_id: sec2.id, academic_year_id: targetYear.id,
      class: cls2.class_name, section: sec2.section_name, academic_year: targetYear.name,
      updated_at: new Date().toISOString(),
    }).eq('id', studentId), 'update students enrollment');

    const a = ok(await sb.from('student_activity').insert([{
      student_id: studentId, activity_type: 'PROMOTION',
      description: 'QA promotion', created_at: new Date().toISOString(),
    }]).select().single(), 'insert student_activity');
    trashIt('student_activity', a.id);

    const after = ok(await sb.from('students').select('class,section').eq('id', studentId).single(), 'reread');
    assert(after.class === cls2.class_name, `class not updated (${after.class})`);
    return 'ok';
  });

  // --- Page: Medical Management > Add health record
  await check('Medical', 'Register health card (insert student_medical)', async () => {
    assert(studentId, 'no student');
    const payload = {
      blood_group: 'O+', allergies: 'None', height_cm: 160, weight_kg: 55,
      emergency_contact: 'Campus Clinic', vaccination_status: 'All Standard Vaccinations Complete',
      medical_conditions: null, remarks: 'Health record verified',
      student_id: studentId,
    };
    const res = await sb.from('student_medical').insert([payload]).select().single();
    ok(res, 'insert student_medical');
    trashIt('student_medical', res.data.id);
    return 'ok';
  });

  await check('Medical', 'Update health card (update student_medical)', async () => {
    const row = ok(await sb.from('student_medical').select('id').eq('student_id', studentId).maybeSingle(), 'find');
    assert(row, 'no medical record to update');
    ok(await sb.from('student_medical').update({
      blood_group: 'A+', allergies: 'Dust', height_cm: 161, weight_kg: 56,
      emergency_contact: 'Campus Clinic', medical_conditions: 'Requires monitoring', remarks: 'Health record verified',
    }).eq('id', row.id), 'update student_medical');
    return 'ok';
  });

  // --- Page: Discipline Management > Log incident
  await check('Discipline', 'Log incident (insert disciplinary_records)', async () => {
    assert(studentId, 'no student');
    const payload = {
      student_id: studentId, student_name: 'QA Student Renamed', student_class: 'Class 1-A',
      incident_type: 'Misconduct', description: 'QA incident', action_taken: 'Warning issued',
      demerit_points: 2, severity: 'Medium',
      incident_date: new Date().toISOString().substring(0, 10), status: 'Pending',
    };
    const res = await sb.from('disciplinary_records').insert([payload]).select().single();
    ok(res, 'insert disciplinary_records');
    trashIt('disciplinary_records', res.data.id);
    return 'ok';
  });

  await check('Discipline', 'Update incident (update disciplinary_records)', async () => {
    const row = ok(await sb.from('disciplinary_records').select('id').eq('student_id', studentId).maybeSingle(), 'find');
    assert(row, 'no disciplinary record to update');
    ok(await sb.from('disciplinary_records').update({
      incident_type: 'Misconduct', description: 'QA incident edited', action_taken: 'Parent call',
      demerit_points: 3, severity: 'High', incident_date: new Date().toISOString().substring(0, 10), status: 'Resolved',
    }).eq('id', row.id), 'update disciplinary_records');
    return 'ok';
  });

  // --- Page: Certificates / ID cards
  await check('Students/IDCards', 'Generate ID card (insert student_id_cards)', async () => {
    assert(studentId, 'no student');
    const res = await sb.from('student_id_cards').insert([{
      student_id: studentId, template_name: 'default', card_data: { name: 'QA' },
    }]).select().single();
    ok(res, 'insert student_id_cards');
    trashIt('student_id_cards', res.data.id);
    return 'ok';
  });
}
