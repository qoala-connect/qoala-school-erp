// Academics module — Overview, Academic Years, Classes & Sections, Subjects,
// Class Subjects, Curriculum & Syllabus, Timetable, Academic Monitor, Structure.
import { asAdmin, ok, assert, check, module, refs, uniq, trashIt } from './_harness.mjs';

export default async function run() {
  module('Academics');
  const { sb } = await asAdmin();
  const r = await refs();
  const cls = r.classes[0];
  const yr = r.currentYear;
  const teacher = r.teachers[0];

  // --- Page: Academics > Overview
  await check('Academics/Overview', 'Load overview (rpc academics_overview)', async () => {
    const data = ok(await sb.rpc('academics_overview', { _academic_year_id: yr.id }), 'rpc academics_overview');
    assert(data, 'no data');
    return 'ok';
  });

  // --- Page: Academics > Academic Years
  let yearId = null;
  await check('Academics/Years', 'Create academic year (insert academic_years)', async () => {
    const data = ok(await sb.from('academic_years').insert([{
      name: uniq('YR').slice(0, 20), start_date: '2030-04-01', end_date: '2031-03-31',
      status: 'upcoming', is_active: true,
    }]).select().single(), 'insert academic_years');
    yearId = data.id; trashIt('academic_years', yearId);
    return `id=${yearId.slice(0, 8)}`;
  });

  await check('Academics/Years', 'Edit academic year (update academic_years)', async () => {
    assert(yearId, 'no year');
    const data = ok(await sb.from('academic_years').update({
      name: uniq('YR2').slice(0, 20), start_date: '2030-04-01', end_date: '2031-03-31',
      status: 'active', is_active: true,
    }).eq('id', yearId).select().single(), 'update academic_years');
    assert(data.status === 'active', 'status not persisted');
    return 'ok';
  });

  await check('Academics/Years', 'Set current year (rpc set_current_academic_year)', async () => {
    assert(yearId, 'no year');
    ok(await sb.rpc('set_current_academic_year', { _year_id: yearId }), 'rpc set_current_academic_year');
    const row = ok(await sb.from('academic_years').select('is_current').eq('id', yearId).single(), 'reread');
    assert(row.is_current === true, 'is_current not set');
    // restore the real current year so the rest of the suite/app is unaffected
    ok(await sb.rpc('set_current_academic_year', { _year_id: yr.id }), 'restore current year');
    return 'ok';
  });

  await check('Academics/Years', 'Delete academic year (delete academic_years)', async () => {
    assert(yearId, 'no year');
    ok(await sb.from('academic_years').delete().eq('id', yearId), 'delete academic_years');
    const after = ok(await sb.from('academic_years').select('id').eq('id', yearId).maybeSingle(), 'reread');
    assert(!after, 'row survived delete');
    yearId = null;
    return 'ok';
  });

  // --- Page: Academics > Classes & Sections
  let classId = null;
  await check('Academics/Classes', 'Create class (insert classes)', async () => {
    const data = ok(await sb.from('classes').insert([{
      class_name: uniq('CLS').slice(0, 20), class_code: 'QA' + Math.floor(Math.random() * 9999),
      stream: 'General', display_order: 999, is_active: true,
    }]).select().single(), 'insert classes');
    classId = data.id; trashIt('classes', classId);
    return `id=${classId.slice(0, 8)}`;
  });

  await check('Academics/Classes', 'Edit class (update classes)', async () => {
    assert(classId, 'no class');
    ok(await sb.from('classes').update({ stream: 'Science', display_order: 998 }).eq('id', classId).select().single(), 'update classes');
    return 'ok';
  });

  await check('Academics/Classes', 'Toggle class active (update classes.is_active)', async () => {
    assert(classId, 'no class');
    ok(await sb.from('classes').update({ is_active: false }).eq('id', classId), 'deactivate');
    const row = ok(await sb.from('classes').select('is_active').eq('id', classId).single(), 'reread');
    assert(row.is_active === false, 'is_active did not persist');
    ok(await sb.from('classes').update({ is_active: true }).eq('id', classId), 'reactivate');
    return 'ok';
  });

  let classSectionId = null;
  await check('Academics/Classes', 'Attach section to class (insert sections + class_sections)', async () => {
    assert(classId, 'no class');
    const name = 'Z';
    let secId = (ok(await sb.from('sections').select('id').eq('section_name', name).maybeSingle(), 'find section'))?.id;
    if (!secId) {
      const created = ok(await sb.from('sections').insert([{ section_name: name, capacity: 40, is_active: true }]).select('id').single(), 'insert sections');
      secId = created.id; trashIt('sections', secId);
    }
    const cs = ok(await sb.from('class_sections').insert([{
      class_id: classId, section_id: secId, capacity: 40, room_no: 'QA-101', is_active: true,
    }]).select().single(), 'insert class_sections');
    classSectionId = cs.id; trashIt('class_sections', classSectionId);
    return 'ok';
  });

  await check('Academics/Classes', 'Edit section allocation (update class_sections)', async () => {
    assert(classSectionId, 'no class_section');
    ok(await sb.from('class_sections').update({ capacity: 45, room_no: 'QA-102' }).eq('id', classSectionId), 'update class_sections');
    const row = ok(await sb.from('class_sections').select('capacity,room_no').eq('id', classSectionId).single(), 'reread');
    assert(row.capacity === 45, 'capacity did not persist');
    return 'ok';
  });

  await check('Academics/Classes', 'Assign class teacher (update class_sections.class_teacher_id)', async () => {
    assert(classSectionId && teacher, 'no class_section or teacher');
    ok(await sb.from('class_sections').update({ class_teacher_id: teacher.id }).eq('id', classSectionId), 'assign class teacher');
    const row = ok(await sb.from('class_sections').select('class_teacher_id').eq('id', classSectionId).single(), 'reread');
    assert(row.class_teacher_id === teacher.id, 'class teacher did not persist');
    return 'ok';
  });

  await check('Academics/Classes', 'Load section directory (rpc academics_section_directory)', async () => {
    const data = ok(await sb.rpc('academics_section_directory', { _academic_year_id: yr.id, _class_id: null }), 'rpc');
    assert(Array.isArray(data), 'not an array');
    return `${data.length} rows`;
  });

  await check('Academics/Classes', 'Load class directory (rpc academics_class_directory)', async () => {
    const data = ok(await sb.rpc('academics_class_directory', { _academic_year_id: yr.id }), 'rpc');
    assert(Array.isArray(data), 'not an array');
    return `${data.length} rows`;
  });

  // --- Page: Academics > Subjects
  let subjectId = null;
  await check('Academics/Subjects', 'Create subject (insert subjects)', async () => {
    const data = ok(await sb.from('subjects').insert([{
      subject_name: uniq('SUB').slice(0, 30), subject_code: 'QS' + Math.floor(Math.random() * 9999),
      category: 'Scholastic', subject_type: 'Theory', is_active: true,
    }]).select().single(), 'insert subjects');
    subjectId = data.id; trashIt('subjects', subjectId);
    return `id=${subjectId.slice(0, 8)}`;
  });

  await check('Academics/Subjects', 'Edit subject (update subjects)', async () => {
    assert(subjectId, 'no subject');
    ok(await sb.from('subjects').update({ category: 'Co-Scholastic', subject_type: 'Activity' }).eq('id', subjectId).select().single(), 'update subjects');
    return 'ok';
  });

  await check('Academics/Subjects', 'Toggle subject active (update subjects.is_active)', async () => {
    assert(subjectId, 'no subject');
    ok(await sb.from('subjects').update({ is_active: false }).eq('id', subjectId), 'deactivate');
    const row = ok(await sb.from('subjects').select('is_active').eq('id', subjectId).single(), 'reread');
    assert(row.is_active === false, 'is_active did not persist');
    ok(await sb.from('subjects').update({ is_active: true }).eq('id', subjectId), 'reactivate');
    return 'ok';
  });

  await check('Academics/Subjects', 'Load subject directory (rpc academics_subject_directory)', async () => {
    const data = ok(await sb.rpc('academics_subject_directory', { _academic_year_id: yr.id }), 'rpc');
    assert(Array.isArray(data), 'not an array');
    return `${data.length} rows`;
  });

  // --- Page: Academics > Class Subjects
  let mappingId = null;
  await check('Academics/ClassSubjects', 'Map subjects to class (upsert class_subjects)', async () => {
    assert(classId && subjectId, 'no class/subject');
    const data = ok(await sb.from('class_subjects').upsert([{
      class_id: classId, academic_year_id: yr.id, section_id: null,
      subject_id: subjectId, is_mandatory: true, is_active: true,
    }], { onConflict: 'class_id,academic_year_id,subject_id,section_id', ignoreDuplicates: true })
      .select('id'), 'upsert class_subjects');
    assert(data && data.length, 'upsert returned no rows (mapping not created)');
    mappingId = data[0].id; trashIt('class_subjects', mappingId);
    return 'ok';
  });

  await check('Academics/ClassSubjects', 'Edit mapping (update class_subjects)', async () => {
    assert(mappingId, 'no mapping');
    ok(await sb.from('class_subjects').update({ is_mandatory: false }).eq('id', mappingId), 'update class_subjects');
    const row = ok(await sb.from('class_subjects').select('is_mandatory').eq('id', mappingId).single(), 'reread');
    assert(row.is_mandatory === false, 'is_mandatory did not persist');
    return 'ok';
  });

  await check('Academics/ClassSubjects', 'Load mappings (rpc academics_class_subjects)', async () => {
    const data = ok(await sb.rpc('academics_class_subjects', { _academic_year_id: yr.id, _class_id: null }), 'rpc');
    assert(Array.isArray(data), 'not an array');
    return `${data.length} rows`;
  });

  // --- Page: Academics > Curriculum & Syllabus
  let unitId = null, chapterId = null, topicId = null;
  await check('Academics/Curriculum', 'Create unit (insert syllabus_units)', async () => {
    assert(subjectId && classId, 'no class/subject');
    const data = ok(await sb.from('syllabus_units').insert([{
      academic_year_id: yr.id, class_id: classId, subject_id: subjectId,
      title: uniq('Unit'), sequence: 1, description: 'QA unit',
    }]).select().single(), 'insert syllabus_units');
    unitId = data.id; trashIt('syllabus_units', unitId);
    return 'ok';
  });

  await check('Academics/Curriculum', 'Create chapter (insert syllabus_chapters)', async () => {
    assert(unitId, 'no unit');
    const data = ok(await sb.from('syllabus_chapters').insert([{
      unit_id: unitId, title: uniq('Chapter'), sequence: 1, description: 'QA chapter', expected_hours: 6,
    }]).select().single(), 'insert syllabus_chapters');
    chapterId = data.id; trashIt('syllabus_chapters', chapterId);
    return 'ok';
  });

  await check('Academics/Curriculum', 'Create topic (insert syllabus_topics)', async () => {
    assert(chapterId, 'no chapter');
    const data = ok(await sb.from('syllabus_topics').insert([{
      chapter_id: chapterId, title: uniq('Topic'), sequence: 1,
    }]).select().single(), 'insert syllabus_topics');
    topicId = data.id; trashIt('syllabus_topics', topicId);
    return 'ok';
  });

  await check('Academics/Curriculum', 'Edit unit/chapter/topic (update x3)', async () => {
    assert(unitId && chapterId && topicId, 'missing syllabus rows');
    ok(await sb.from('syllabus_units').update({ description: 'QA edited' }).eq('id', unitId).select().single(), 'update unit');
    ok(await sb.from('syllabus_chapters').update({ expected_hours: 8 }).eq('id', chapterId).select().single(), 'update chapter');
    ok(await sb.from('syllabus_topics').update({ sequence: 2 }).eq('id', topicId).select().single(), 'update topic');
    return 'ok';
  });

  await check('Academics/Curriculum', 'Update chapter progress (upsert syllabus_progress)', async () => {
    assert(chapterId, 'no chapter');
    const secId = r.sections[0].id;
    ok(await sb.from('syllabus_progress').upsert([{
      chapter_id: chapterId, section_id: secId, teacher_id: teacher ? teacher.id : null,
      status: 'in_progress', started_on: new Date().toISOString().slice(0, 10),
      completed_on: null, notes: 'QA progress',
    }], { onConflict: 'chapter_id,section_id' }), 'upsert syllabus_progress');
    const row = ok(await sb.from('syllabus_progress').select('id,status').eq('chapter_id', chapterId).eq('section_id', secId).maybeSingle(), 'reread');
    assert(row && row.status === 'in_progress', 'progress did not persist');
    trashIt('syllabus_progress', row.id);
    return 'ok';
  });

  await check('Academics/Curriculum', 'Load syllabus tree/coverage (rpc x3)', async () => {
    const a = await sb.rpc('academics_syllabus_tree', { _academic_year_id: yr.id, _class_id: null, _subject_id: null, _section_id: null });
    const b = await sb.rpc('academics_syllabus_coverage', { _academic_year_id: yr.id });
    const c = await sb.rpc('admin_syllabus_by_subject', { _academic_year_id: yr.id });
    ok(a, 'academics_syllabus_tree'); ok(b, 'academics_syllabus_coverage'); ok(c, 'admin_syllabus_by_subject');
    return 'ok';
  });

  await check('Academics/Curriculum', 'Delete topic/chapter/unit (delete x3)', async () => {
    assert(unitId && chapterId && topicId, 'missing syllabus rows');
    ok(await sb.from('syllabus_topics').delete().eq('id', topicId), 'delete topic');
    ok(await sb.from('syllabus_chapters').delete().eq('id', chapterId), 'delete chapter');
    ok(await sb.from('syllabus_units').delete().eq('id', unitId), 'delete unit');
    const after = ok(await sb.from('syllabus_units').select('id').eq('id', unitId).maybeSingle(), 'reread');
    assert(!after, 'unit survived delete');
    unitId = chapterId = topicId = null;
    return 'ok';
  });

  // --- Page: Academics > Timetable
  let slotId = null;
  await check('Academics/Timetable', 'Save timetable slot (insert timetable)', async () => {
    assert(classId && subjectId, 'no class/subject');
    const clsRow = ok(await sb.from('classes').select('class_name').eq('id', classId).maybeSingle(), 'class name');
    const data = ok(await sb.from('timetable').insert([{
      academic_year_id: yr.id, class_id: classId, class: clsRow.class_name,
      section_id: r.sections[0].id, subject_id: subjectId,
      teacher_id: teacher ? teacher.id : null, day: 'mon', period_number: 1,
      start_time: '09:00:00', end_time: '09:40:00', room_no: 'QA-201',
    }]).select(), 'insert timetable');
    assert(data && data.length, 'insert returned no rows');
    slotId = data[0].id; trashIt('timetable', slotId);
    return 'ok';
  });

  await check('Academics/Timetable', 'Edit timetable slot (update timetable)', async () => {
    assert(slotId, 'no slot');
    const data = ok(await sb.from('timetable').update({
      start_time: '10:00:00', end_time: '10:40:00', room_no: 'QA-202',
    }).eq('id', slotId).select(), 'update timetable');
    assert(data && data.length, 'update returned no rows');
    return 'ok';
  });

  await check('Academics/Timetable', 'Load timetable grid (select timetable)', async () => {
    const data = ok(await sb.from('timetable').select(
      'id, class_id, section_id, subject_id, teacher_id, day, period_number, start_time, end_time, room_no'
    ).eq('academic_year_id', yr.id).limit(200), 'select timetable');
    assert(Array.isArray(data), 'not an array');
    return `${data.length} slots`;
  });

  await check('Academics/Timetable', 'Delete timetable slot (delete timetable)', async () => {
    assert(slotId, 'no slot');
    ok(await sb.from('timetable').delete().eq('id', slotId), 'delete timetable');
    const after = ok(await sb.from('timetable').select('id').eq('id', slotId).maybeSingle(), 'reread');
    assert(!after, 'slot survived delete');
    slotId = null;
    return 'ok';
  });

  // --- Page: Academics > Academic Monitor
  await check('Academics/Monitor', 'Load monitor (rpc admin_academic_monitor)', async () => {
    const data = ok(await sb.rpc('admin_academic_monitor', { _academic_year_id: yr.id, _on_date: new Date().toISOString().slice(0,10) }), 'rpc admin_academic_monitor');
    assert(data, 'no data');
    return 'ok';
  });

  // --- Page: Academics > Structure (teacher assignments)
  let assignmentId = null;
  await check('Academics/Structure', 'Assign teacher to class-subject (insert teacher_assignments)', async () => {
    assert(teacher && classId && subjectId, 'missing refs');
    const data = ok(await sb.from('teacher_assignments').insert([{
      teacher_id: teacher.id, academic_year_id: yr.id, class_id: classId,
      section_id: r.sections[0].id, subject_id: subjectId,
      assignment_type: 'subject_teacher', is_active: true,
    }]).select().single(), 'insert teacher_assignments');
    assignmentId = data.id; trashIt('teacher_assignments', assignmentId);
    return 'ok';
  });

  await check('Academics/Structure', 'Remove assignment (delete teacher_assignments)', async () => {
    assert(assignmentId, 'no assignment');
    ok(await sb.from('teacher_assignments').delete().eq('id', assignmentId), 'delete teacher_assignments');
    const after = ok(await sb.from('teacher_assignments').select('id').eq('id', assignmentId).maybeSingle(), 'reread');
    assert(!after, 'assignment survived delete');
    assignmentId = null;
    return 'ok';
  });

  // --- Page: Academics > Class Subjects cleanup path (delete)
  await check('Academics/ClassSubjects', 'Remove mapping (delete class_subjects)', async () => {
    assert(mappingId, 'no mapping');
    ok(await sb.from('class_subjects').delete().eq('id', mappingId), 'delete class_subjects');
    const after = ok(await sb.from('class_subjects').select('id').eq('id', mappingId).maybeSingle(), 'reread');
    assert(!after, 'mapping survived delete');
    mappingId = null;
    return 'ok';
  });

  // --- Page: School Calendar (Academics group)
  await check('Calendar', 'Add holiday/event (insert holidays)', async () => {
    const data = ok(await sb.from('holidays').insert([{
      title: uniq('Holiday'), start_date: '2030-12-25', end_date: '2030-12-25',
      description: 'QA holiday', is_national: false, is_active: true,
    }]).select().single(), 'insert holidays');
    trashIt('holidays', data.id);
    ok(await sb.from('holidays').update({ description: 'QA edited' }).eq('id', data.id), 'update holidays');
    return 'ok';
  });
}
