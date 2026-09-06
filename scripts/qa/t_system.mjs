// System module — Overview, User Directory, Roles & Permissions,
// School Settings, Audit Logs, Security & Governance. Plus Reports & Analytics.
import { asAdmin, svc, ok, assert, check, module, refs } from './_harness.mjs';

export default async function run() {
  module('System');
  const { sb, user } = await asAdmin();
  const r = await refs();

  // --- Page: System > Overview
  await check('System/Overview', 'Load overview (rpc system_overview)', async () => {
    const data = ok(await sb.rpc('system_overview'), 'rpc system_overview');
    assert(data, 'no data');
    return 'ok';
  });

  // --- Page: System > User Directory
  await check('System/Users', 'Load user directory (rpc admin_user_directory)', async () => {
    const data = ok(await sb.rpc('admin_user_directory', {
      _search: null, _role: null, _status: null, _linked: null, _limit: 50, _offset: 0,
    }), 'rpc admin_user_directory');
    assert(Array.isArray(data), 'not an array');
    return `${data.length} users`;
  });

  await check('System/Users', 'Search + filter directory (rpc admin_user_directory)', async () => {
    const data = ok(await sb.rpc('admin_user_directory', {
      _search: 'admin', _role: 'admin', _status: null, _linked: null, _limit: 20, _offset: 0,
    }), 'rpc admin_user_directory filtered');
    assert(Array.isArray(data), 'not an array');
    return `${data.length} matches`;
  });

  await check('System/Users', 'Change user role (rpc set_user_role)', async () => {
    // Use the seeded teacher account, then put its role back.
    const { data: prof } = await svc().from('profiles').select('id,role').eq('email', 'teacher@school.com').maybeSingle();
    assert(prof, 'teacher@school.com profile missing');
    ok(await sb.rpc('set_user_role', { _user_id: prof.id, _role: 'class_teacher' }), 'set role class_teacher');
    const after = ok(await sb.from('profiles').select('role').eq('id', prof.id).single(), 'reread');
    assert(after.role === 'class_teacher', `role is ${after.role}`);
    ok(await sb.rpc('set_user_role', { _user_id: prof.id, _role: prof.role }), `restore role ${prof.role}`);
    return 'ok';
  });

  await check('System/Users', 'Change user status (rpc set_user_status)', async () => {
    const { data: prof } = await svc().from('profiles').select('id,status').eq('email', 'teacher@school.com').maybeSingle();
    assert(prof, 'teacher@school.com profile missing');
    ok(await sb.rpc('set_user_status', { _user_id: prof.id, _status: 'suspended', _reason: 'QA test' }), 'suspend');
    const after = ok(await sb.from('profiles').select('status').eq('id', prof.id).single(), 'reread');
    assert(after.status === 'suspended', `status is ${after.status}`);
    ok(await sb.rpc('set_user_status', { _user_id: prof.id, _status: 'active', _reason: 'QA restore' }), 'restore active');
    return 'ok';
  });

  await check('System/Users', 'Self-suspension is blocked (rpc set_user_status)', async () => {
    const res = await sb.rpc('set_user_status', { _user_id: user.id, _status: 'suspended', _reason: 'QA self-lockout' });
    assert(res.error, 'an admin was allowed to suspend their own account — lockout guard missing');
    // Make sure the guard did not actually apply the change before raising.
    const after = ok(await sb.from('profiles').select('status').eq('id', user.id).single(), 'reread self');
    assert(after.status !== 'suspended', 'admin account was suspended despite the error');
    return `guard raised: ${res.error.code}`;
  });

  await check('System/Users', 'Load linkable entities (rpc linkable_entities)', async () => {
    for (const t of ['student', 'teacher', 'staff']) {
      const data = ok(await sb.rpc('linkable_entities', { _entity_type: t, _search: null }), `linkable_entities "${t}"`);
      assert(Array.isArray(data), `${t}: not an array`);
    }
    return '3 entity types';
  });

  await check('System/Users', 'Link + unlink user to entity (rpc link/unlink_user_to_entity)', async () => {
    const { data: prof } = await svc().from('profiles').select('id').eq('email', 'teacher@school.com').maybeSingle();
    const cands = ok(await sb.rpc('linkable_entities', { _entity_type: 'teacher', _search: null }), 'linkable teachers');
    if (!cands.length) return 'skipped — no unlinked teacher records';
    const target = cands[0];
    const entityId = target.id ?? target.entity_id;
    ok(await sb.rpc('link_user_to_entity', { _user_id: prof.id, _entity_type: 'teacher', _entity_id: entityId }), 'link');
    ok(await sb.rpc('unlink_user_from_entity', { _entity_type: 'teacher', _entity_id: entityId }), 'unlink');
    return 'ok';
  });

  // --- Page: System > Roles & Permissions
  await check('System/Roles', 'Load role permissions (select role_permissions)', async () => {
    const data = ok(await sb.from('role_permissions').select('role, permission').limit(500), 'select role_permissions');
    assert(data.length > 0, 'no role permissions configured');
    return `${data.length} grants`;
  });

  await check('System/Roles', 'Grant + revoke a permission (rpc set_role_permission)', async () => {
    const probe = 'qa.autotest.permission';
    ok(await sb.rpc('set_role_permission', { _role: 'teacher', _permission: probe, _granted: true }), 'grant');
    const granted = ok(await sb.from('role_permissions').select('permission').eq('role', 'teacher').eq('permission', probe).maybeSingle(), 'reread grant');
    assert(granted, 'grant did not persist');
    ok(await sb.rpc('set_role_permission', { _role: 'teacher', _permission: probe, _granted: false }), 'revoke');
    const revoked = ok(await sb.from('role_permissions').select('permission').eq('role', 'teacher').eq('permission', probe).maybeSingle(), 'reread revoke');
    assert(!revoked, 'revoke did not remove the grant');
    return 'ok';
  });

  await check('System/Roles', 'Own permissions resolve (rpc my_permissions)', async () => {
    const data = ok(await sb.rpc('my_permissions'), 'rpc my_permissions');
    assert(Array.isArray(data) && data.length > 0, 'admin resolved to zero permissions');
    return `${data.length} permissions`;
  });

  // --- Page: System > School Settings
  await check('System/Settings', 'Load settings (select system_settings)', async () => {
    const data = ok(await sb.from('system_settings').select('*').limit(1).maybeSingle(), 'select system_settings');
    assert(data, 'no settings row');
    return 'ok';
  });

  await check('System/Settings', 'Save settings (rpc update_system_settings)', async () => {
    const before = ok(await sb.from('system_settings').select('*').limit(1).maybeSingle(), 'read before');
    const data = ok(await sb.rpc('update_system_settings', {
      _patch: { school_phone: '9111111111', document_footer_note: 'QA footer note' },
    }), 'rpc update_system_settings');
    const after = ok(await sb.from('system_settings').select('school_phone, document_footer_note').limit(1).maybeSingle(), 'read after');
    assert(after.document_footer_note === 'QA footer note', 'settings patch did not persist');
    // restore
    ok(await sb.rpc('update_system_settings', {
      _patch: { school_phone: before.school_phone, document_footer_note: before.document_footer_note },
    }), 'restore settings');
    return 'ok';
  });

  // --- Page: System > Audit Logs
  await check('System/Audit', 'Search audit logs (rpc audit_log_search)', async () => {
    const data = ok(await sb.rpc('audit_log_search', {
      _search: null, _action: null, _table: null, _user_id: null,
      _from: null, _to: null, _limit: 50, _offset: 0,
    }), 'rpc audit_log_search');
    assert(Array.isArray(data), 'not an array');
    return `${data.length} entries`;
  });

  await check('System/Audit', 'Load audit facets (rpc audit_log_facets)', async () => {
    const data = ok(await sb.rpc('audit_log_facets'), 'rpc audit_log_facets');
    assert(data, 'no facets');
    return 'ok';
  });

  await check('System/Audit', 'Audit log is append-only (update rejected)', async () => {
    const row = ok(await sb.from('audit_logs').select('id').limit(1).maybeSingle(), 'find an audit row');
    if (!row) return 'skipped — audit log empty';
    const res = await sb.from('audit_logs').update({ action_type: 'QA_TAMPER' }).eq('id', row.id).select();
    if (!res.error) {
      const after = ok(await sb.from('audit_logs').select('action_type').eq('id', row.id).single(), 'reread');
      assert(after.action_type !== 'QA_TAMPER', 'an audit log entry was editable — immutability guard missing');
    }
    return res.error ? `guard raised: ${res.error.code}` : 'no rows changed';
  });

  // --- Page: System > Security & Governance
  // The Security view is built from audit_logs and role_permissions; activity_logs
  // is written by database triggers only and is not read by any page.
  await check('System/Security', 'Load governance panels (audit_logs + role_permissions)', async () => {
    const [a, p] = await Promise.all([
      sb.from('audit_logs').select('id, action_type, table_name, created_at')
        .order('created_at', { ascending: false }).limit(50),
      sb.from('role_permissions').select('role, permission').limit(500),
    ]);
    ok(a, 'audit_logs'); ok(p, 'role_permissions');
    return `${a.data.length} audit / ${p.data.length} grants`;
  });

  // --- Page: Reports
  await check('Reports', 'Load report datasets (select x4)', async () => {
    const res = await Promise.all([
      sb.from('students').select('id, class, section, status, gender, category').limit(500),
      sb.from('student_fees').select('id, net_amount, amount_paid, status').limit(500),
      sb.from('attendance').select('id, status, attendance_date').limit(500),
      sb.from('exam_results').select('id, percentage, result_status').limit(500),
    ]);
    const bad = res.map((x, i) => (x.error ? `${i}:${x.error.message}` : null)).filter(Boolean);
    assert(!bad.length, `report query errors -> ${bad.join(' | ')}`);
    return res.map((x) => x.data.length).join('/') + ' rows';
  });

  // --- Page: Analytics
  await check('Analytics', 'Load analytics aggregates (select/rpc)', async () => {
    const yr = r.currentYear;
    const res = await Promise.all([
      sb.rpc('academics_overview', { _academic_year_id: yr.id }),
      sb.from('exam_results').select('percentage, grade').eq('academic_year_id', yr.id).limit(500),
      sb.from('attendance').select('status').eq('academic_year_id', yr.id).limit(500),
    ]);
    const bad = res.map((x, i) => (x.error ? `${i}:${x.error.message}` : null)).filter(Boolean);
    assert(!bad.length, `analytics errors -> ${bad.join(' | ')}`);
    return 'ok';
  });
}
