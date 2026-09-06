/**
 * 159 active students (classes 1-12, section C — ~31% of the school) were
 * enrolled with no class_sections row and no teacher_assignments, so they
 * were invisible to the whole Academics module: no timetable, no syllabus,
 * no roster in the teacher workspace.
 *
 * This creates the missing class_sections rows and mirrors section A's
 * teacher_assignments (same subjects, same teachers) onto section C, so
 * the section becomes a real teaching group. The timetable / syllabus /
 * activity scripts are then re-run to give it a full footprint.
 *
 * Usage: node scripts/fix_section_c_structure.mjs --apply
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const get = (k) => env.match(new RegExp('^' + k + '=(.*)$', 'm'))?.[1]?.trim() ?? '';
const TOKEN = get('SUPABASE_ACCESS_TOKEN');
const REF = get('VITE_SUPABASE_URL').replace('https://', '').replace('.supabase.co', '');
const APPLY = process.argv.includes('--apply');

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${body.slice(0, 1000)}`);
  return body ? JSON.parse(body) : [];
}

async function main() {
  const [{ id: YEAR_ID }] = await sql(`select id from academic_years where is_current limit 1`);

  const gaps = await sql(`
    select distinct s.class_id, s.section_id, c.class_name, c.display_order, sec.section_name
    from students s
    join classes c on c.id = s.class_id
    join sections sec on sec.id = s.section_id
    where s.status = 'active'
      and (not exists (select 1 from class_sections cs where cs.class_id = s.class_id and cs.section_id = s.section_id)
        or not exists (select 1 from teacher_assignments ta where ta.class_id = s.class_id and ta.section_id = s.section_id and ta.is_active))
    order by c.display_order`);

  console.log(`missing class_sections: ${gaps.length}`);
  gaps.forEach(g => console.log(`  ${g.class_name}-${g.section_name}`));

  if (!APPLY) { console.log('\n(dry run)'); return; }

  // 1. class_sections rows (home room continues the R-1xx sequence)
  const [{ maxroom }] = await sql(`
    select coalesce(max(nullif(regexp_replace(room_no, '\\D', '', 'g'), ''))::int, 125) as maxroom
    from class_sections where room_no ~ '^R-'`);
  let rn = Number(maxroom) + 1;
  const csVals = gaps.map(g =>
    `('${g.class_id}', '${g.section_id}', 40, 'R-${rn++}', true, '${YEAR_ID}'::uuid)`).join(',\n');
  await sql(`
    INSERT INTO class_sections (class_id, section_id, capacity, room_no, is_active, school_id)
    SELECT class_id::uuid, section_id::uuid, capacity::int, room_no, is_active::boolean,
           '00000000-0000-0000-0000-000000000000'::uuid
    FROM (VALUES ${csVals}) AS v(class_id, section_id, capacity, room_no, is_active, y)
    ON CONFLICT DO NOTHING`);
  console.log(`  class_sections created: ${gaps.length}`);

  // 2. mirror section A's teacher_assignments onto section C
  let taCreated = 0;
  for (const g of gaps) {
    const src = await sql(`
      select ta.teacher_id, ta.subject_id, ta.assignment_type
      from teacher_assignments ta
      join sections sec on sec.id = ta.section_id
      where ta.class_id = '${g.class_id}' and ta.is_active
        and ta.academic_year_id = '${YEAR_ID}' and sec.section_name = 'A'`);
    if (src.length === 0) continue;
    const vals = src.map(r =>
      `('${r.teacher_id}', '${YEAR_ID}', '${g.class_id}', '${g.section_id}', ` +
      `${r.subject_id ? `'${r.subject_id}'` : 'NULL'}, '${r.assignment_type || 'subject_teacher'}', true)`).join(',\n');
    await sql(`
      INSERT INTO teacher_assignments
        (teacher_id, academic_year_id, class_id, section_id, subject_id, assignment_type, is_active)
      SELECT teacher_id::uuid, academic_year_id::uuid, class_id::uuid, section_id::uuid,
             subject_id::uuid, assignment_type, is_active::boolean
      FROM (VALUES ${vals}) AS v(teacher_id, academic_year_id, class_id, section_id, subject_id, assignment_type, is_active)
      ON CONFLICT DO NOTHING`);
    taCreated += src.length;
  }
  console.log(`  teacher_assignments mirrored: ${taCreated}`);
  console.log('\nnow re-run:  node scripts/rebuild_timetable.mjs --apply');
  console.log('             node scripts/reseed_academic_activity.mjs --apply');
}

main().catch(e => { console.error(e); process.exit(1); });
