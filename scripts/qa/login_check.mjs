import { asUser, admin } from './_client.mjs';
const emails = ['admin@school.com','teacher@school.com','student@school.com','parent@school.com'];
for (const e of emails) {
  try {
    const { sb, user } = await asUser(e);
    const { data: prof, error: pe } = await sb.from('profiles').select('id,email,role,name,is_active').eq('id', user.id).maybeSingle();
    console.log('OK  ', e, pe ? 'PROFILE_ERR:'+pe.message : JSON.stringify(prof));
  } catch (err) { console.log('FAIL', e, err.message); }
}
