// Admissions module — exercises every write path an admin submit button triggers.
import { asAdmin, svc, ok, assert, check, module, refs, uniq, trashIt } from './_harness.mjs';

export default async function run() {
  module('Admissions');
  const { sb } = await asAdmin();
  const r = await refs();
  const cls = r.classes[0];
  const sec = r.sections[0];
  const yr = r.currentYear;
  let admissionId = null;

  // --- Page: Admissions > New Application (AdmissionApplicationFormModal -> createAdmission)
  await check('Admissions/NewApplication', 'Submit new application (insert)', async () => {
    const payload = {
      application_number: uniq('APP'),
      name: uniq('Applicant'),
      father_name: 'QA Father',
      mother_name: 'QA Mother',
      date_of_birth: '2015-04-10',
      gender: 'male',
      class: cls.class_name,
      class_id: cls.id,
      section: sec.section_name,
      section_id: sec.id,
      academic_year: yr.name,
      academic_year_id: yr.id,
      phone: '9876543210',
      email: 'qa.applicant@example.com',
      address: 'QA Address',
      photo_url: null,
      aadhaar_last4: '1234',
      category: 'General',
      cwsn_status: false,
      only_child_girl: false,
      previous_school: 'QA Prev School',
      previous_class: 'UKG',
      previous_marks: '80%',
      transfer_certificate_no: null,
      blood_group: 'O+',
      emergency_contact: '9876543211',
      religion: 'Hindu',
      nationality: 'Indian',
      father_occupation: 'Engineer',
      mother_occupation: 'Teacher',
      documents: [{ id: 'doc-1', name: 'Birth Certificate', type: 'Certificate', status: 'Pending' }],
      notes: 'QA autotest',
      status: 'Pending',
    };
    const data = ok(await sb.from('admissions').insert([payload]).select().maybeSingle(), 'insert admissions');
    assert(data && data.id, 'insert returned no row (RLS select-after-insert blocked)');
    admissionId = data.id;
    trashIt('admissions', admissionId);
    return `id=${admissionId.slice(0, 8)}`;
  });

  // --- Page: Admissions list > row edit (updateAdmission)
  await check('Admissions/Edit', 'Save edits (update)', async () => {
    assert(admissionId, 'no admission created');
    const data = ok(
      await sb.from('admissions').update({ notes: 'QA edited', phone: '9000000001', updated_at: new Date().toISOString() })
        .eq('id', admissionId).select().single(),
      'update admissions'
    );
    assert(data.notes === 'QA edited', 'update did not persist');
    return 'ok';
  });

  // --- Page: Admissions > Details drawer > document verify (verify_admission_document RPC)
  await check('Admissions/DetailsDrawer', 'Verify document (rpc verify_admission_document)', async () => {
    assert(admissionId, 'no admission created');
    const data = ok(await sb.rpc('verify_admission_document', {
      _admission_id: admissionId, _document_id: 'doc-1', _status: 'Verified', _remarks: 'QA verified',
    }), 'rpc verify_admission_document');
    assert(data, 'rpc returned nothing');
    const row = ok(await sb.from('admissions').select('documents').eq('id', admissionId).single(), 'reread');
    const doc = (row.documents || []).find((d) => d.id === 'doc-1');
    assert(doc && doc.status === 'Verified', `document status not persisted: ${JSON.stringify(doc)}`);
    return 'ok';
  });

  // --- Page: Admissions > status transitions (updateStatus)
  await check('Admissions/StatusChange', 'Every pipeline stage accepted (update status)', async () => {
    assert(admissionId, 'no admission created');
    // The full AdmissionStatus vocabulary from src/types/admission.ts — the Kanban
    // board and status dropdown can move a record into any of these.
    const stages = ['In Review', 'Under Review', 'Interview Scheduled', 'Documents Verification',
      'Waitlisted', 'Withdrawn', 'Cancelled', 'Student Created', 'Approved', 'Rejected', 'Pending'];
    for (const st of stages) {
      ok(await sb.from('admissions').update({ status: st }).eq('id', admissionId).select().single(), `set status "${st}"`);
    }
    return `${stages.length} stages`;
  });

  // --- Page: Admissions > Approvals modal (approve_admission RPC -> creates student)
  await check('Admissions/Approvals', 'Approve application (rpc approve_admission -> student created)', async () => {
    assert(admissionId, 'no admission created');
    const data = ok(await sb.rpc('approve_admission', {
      _admission_id: admissionId, _section_name: sec.section_name, _roll_number: null,
    }), 'rpc approve_admission');
    const res = Array.isArray(data) ? data[0] : data;
    assert(res, 'approve returned nothing');
    const adm = ok(await sb.from('admissions').select('status,student_id').eq('id', admissionId).single(), 'reread');
    assert(adm.status === 'Approved', `status is ${adm.status}, expected Approved`);
    assert(adm.student_id, 'no student_id linked after approval');
    trashIt('students', adm.student_id);
    return `student=${adm.student_id.slice(0, 8)}`;
  });

  // --- Page: Admissions > Reject modal (reject_admission RPC)
  let rejectId = null;
  await check('Admissions/RejectModal', 'Reject application (rpc reject_admission)', async () => {
    const payload = {
      application_number: uniq('APPR'), name: uniq('Reject'), father_name: 'QA F',
      date_of_birth: '2015-01-01', gender: 'female', class: cls.class_name, class_id: cls.id,
      section: sec.section_name, section_id: sec.id, academic_year: yr.name, academic_year_id: yr.id,
      status: 'Pending',
    };
    const row = ok(await sb.from('admissions').insert([payload]).select().single(), 'insert for reject');
    rejectId = row.id; trashIt('admissions', rejectId);
    const data = ok(await sb.rpc('reject_admission', { _admission_id: rejectId, _reason: 'QA rejection reason' }), 'rpc reject_admission');
    assert(data, 'reject rpc returned falsy');
    const after = ok(await sb.from('admissions').select('status,rejection_reason').eq('id', rejectId).single(), 'reread');
    assert(after.status === 'Rejected', `status ${after.status}`);
    return 'ok';
  });

  // --- Page: Admissions > delete
  await check('Admissions/Delete', 'Delete application (delete)', async () => {
    assert(rejectId, 'no reject record');
    ok(await sb.from('admissions').delete().eq('id', rejectId), 'delete admissions');
    const after = ok(await sb.from('admissions').select('id').eq('id', rejectId).maybeSingle(), 'reread');
    assert(!after, 'row still present after delete (RLS silently blocked delete)');
    return 'ok';
  });

  // --- Page: Admissions > Reports tab (read aggregations)
  await check('Admissions/Reports', 'Load report data (select)', async () => {
    const data = ok(await sb.from('admissions').select('id,status,class,category,gender,created_at').limit(200), 'select admissions');
    assert(Array.isArray(data), 'no rows array');
    return `${data.length} rows`;
  });

  // --- Page: Admissions > reference dropdowns
  await check('Admissions/NewApplication', 'Reference dropdowns load (classes/sections/years)', async () => {
    const [c, s, y] = await Promise.all([
      sb.from('classes').select('id,class_name').order('class_name'),
      sb.from('sections').select('id,section_name,capacity').order('section_name'),
      sb.from('academic_years').select('id,name,is_current').order('start_date', { ascending: false }),
    ]);
    ok(c, 'classes'); ok(s, 'sections'); ok(y, 'academic_years');
    assert(c.data.length && s.data.length && y.data.length, 'a dropdown source is empty');
    return `${c.data.length} classes / ${s.data.length} sections / ${y.data.length} years`;
  });

  // --- Page: Front Office (Admissions group)
  await check('FrontOffice', 'Log visitor entry (insert front_office_logs)', async () => {
    const row = ok(await svc().from('front_office_logs').select('id').limit(1), 'probe');
    const payload = {
      name: uniq('Visitor'), phone: '9000000002', type: 'Visitor', purpose: 'QA test',
      date_time: new Date().toISOString(), assigned_to: 'Reception', status: 'Open', notes: 'QA',
    };
    const data = ok(await sb.from('front_office_logs').insert([payload]).select().maybeSingle(), 'insert front_office_logs');
    assert(data && data.id, 'insert returned no row');
    trashIt('front_office_logs', data.id);
    return 'ok';
  });
}
