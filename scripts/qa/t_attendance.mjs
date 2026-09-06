// Attendance module — Attendance Entry page (roster load, save, edit, audit trail).
import { asAdmin, svc, ok, assert, check, module, refs, trashIt } from './_harness.mjs';

export default async function run() {
  module('Attendance');
  const { sb } = await asAdmin();
  const r = await refs();
  const yr = r.currentYear;
  const today = new Date().toISOString().slice(0, 10);

  // Pick the class-section with the most students, like the page's own picker.
  const s = svc();
  const { data: rows } = await s.from('students')
    .select('id, name, class, section, class_id, section_id')
    .eq('academic_year_id', yr.id).eq('status', 'active').limit(1000);
  const byKey = new Map();
  for (const st of rows || []) {
    const k = `${st.class}||${st.section}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(st);
  }
  const [key, roster] = [...byKey.entries()].sort((a, b) => b[1].length - a[1].length)[0] || [];
  const [className, sectionName] = (key || '||').split('||');

  await check('Attendance/Entry', 'Load class roster (select students)', async () => {
    assert(roster && roster.length, 'no class-section with active students');
    const data = ok(await sb.from('students')
      .select('id, name, roll_number, class, section')
      .eq('class', className).eq('section', sectionName)
      .eq('status', 'active').order('roll_number').limit(100), 'select roster');
    assert(data.length > 0, 'roster query returned nothing');
    return `${className}-${sectionName}: ${data.length} students`;
  });

  await check('Attendance/Entry', 'Load teacher scope (select teacher_assignments)', async () => {
    const data = ok(await sb.from('teacher_assignments')
      .select('class_id, section_id, classes:class_id(class_name), sections:section_id(section_name)')
      .in('assignment_type', ['class_teacher', 'both']).eq('academic_year_id', yr.id).limit(100),
      'select teacher_assignments');
    assert(Array.isArray(data), 'not an array');
    return `${data.length} class-teacher scopes`;
  });

  await check('Attendance/Entry', 'Load approved student leaves (select leave_requests)', async () => {
    const ids = roster.slice(0, 20).map((x) => x.id);
    const data = ok(await sb.from('leave_requests')
      .select('applicant_id, reason, start_date, end_date')
      .eq('applicant_type', 'student').eq('status', 'approved')
      .lte('start_date', today).gte('end_date', today).in('applicant_id', ids), 'select leave_requests');
    assert(Array.isArray(data), 'not an array');
    return `${data.length} on leave`;
  });

  let saved = [];
  await check('Attendance/Entry', 'Save attendance — every status (rpc save_attendance)', async () => {
    assert(roster && roster.length >= 5, 'roster too small');
    // The five states the entry grid can set (ATTENDANCE_STATUSES + leave).
    const statuses = ['present', 'absent', 'late', 'half_day', 'leave'];
    const records = roster.slice(0, 5).map((st, i) => ({
      student_id: st.id, status: statuses[i], remarks: `QA ${statuses[i]}`,
    }));
    ok(await sb.rpc('save_attendance', {
      _attendance_date: today, _class: className, _section: sectionName, _records: records,
    }), 'rpc save_attendance');
    saved = ok(await sb.from('attendance').select('id, student_id, status')
      .eq('attendance_date', today).in('student_id', records.map((x) => x.student_id)), 'reread');
    assert(saved.length === records.length, `saved ${saved.length} of ${records.length}`);
    for (const a of saved) trashIt('attendance', a.id);
    return `${saved.length} rows, ${statuses.length} statuses`;
  });

  await check('Attendance/Entry', 'Re-save same day is idempotent (rpc save_attendance)', async () => {
    assert(saved.length, 'nothing saved');
    const records = saved.map((a) => ({ student_id: a.student_id, status: 'present', remarks: 'QA corrected' }));
    ok(await sb.rpc('save_attendance', {
      _attendance_date: today, _class: className, _section: sectionName, _records: records,
    }), 'rpc save_attendance (re-save)');
    const after = ok(await sb.from('attendance').select('id, status')
      .eq('attendance_date', today).in('student_id', records.map((x) => x.student_id)), 'reread');
    assert(after.length === records.length, `duplicated rows: ${after.length} for ${records.length} students`);
    assert(after.every((x) => x.status === 'present'), 'correction did not overwrite the earlier marks');
    for (const a of after) trashIt('attendance', a.id);
    return 'no duplicates, values overwritten';
  });

  await check('Attendance/Entry', 'Future date is rejected (rpc save_attendance)', async () => {
    const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const res = await sb.rpc('save_attendance', {
      _attendance_date: future, _class: className, _section: sectionName,
      _records: [{ student_id: roster[0].id, status: 'present', remarks: null }],
    });
    assert(res.error, 'attendance was accepted for a future date — guard missing');
    return `guard raised: ${res.error.code}`;
  });

  await check('Attendance/Entry', 'Attendance edit trail recorded (select attendance_logs)', async () => {
    const data = ok(await sb.from('attendance_logs')
      .select('id, previous_status, new_status, changed_at')
      .order('changed_at', { ascending: false }).limit(20), 'select attendance_logs');
    assert(Array.isArray(data), 'not an array');
    return `${data.length} log entries`;
  });

  await check('Attendance/Reports', 'Attendance summary query (select attendance)', async () => {
    const data = ok(await sb.from('attendance')
      .select('status, attendance_date, class, section')
      .eq('academic_year_id', yr.id).limit(1000), 'select attendance');
    const present = data.filter((x) => x.status === 'present').length;
    return `${data.length} records, ${present} present`;
  });
}
