/**
 * Rebuilds the weekly timetable for the current academic year from
 * teacher_assignments, producing a clash-free grid:
 *   - no teacher in two rooms in the same day + period
 *   - no class-section double-booked
 *   - no shared room (labs, ground) double-booked
 *   - every (class, section, subject) gets a realistic weekly period count
 *
 * Fixed 7-period day, Mon-Sat, breaks after P2 and P4. Home room per
 * class-section; Computer -> Computer Lab, Physical Education -> Sports
 * Ground / Activity Hall.
 *
 * Usage: node scripts/rebuild_timetable.mjs [--apply]
 *   without --apply it prints a summary and writes the SQL to
 *   scripts/out/timetable.sql; with --apply it also runs it.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const get = (k) => env.match(new RegExp('^' + k + '=(.*)$', 'm'))?.[1]?.trim() ?? '';
const TOKEN = get('SUPABASE_ACCESS_TOKEN');
const REF = (get('VITE_SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL'))
  .replace('https://', '').replace('.supabase.co', '');

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${body.slice(0, 800)}`);
  return body ? JSON.parse(body) : [];
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const PERIODS = [
  { p: 1, s: '08:00', e: '08:45' },
  { p: 2, s: '08:45', e: '09:30' },
  { p: 3, s: '09:45', e: '10:30' },   // break after P2
  { p: 4, s: '10:30', e: '11:15' },
  { p: 5, s: '11:45', e: '12:30' },   // break after P4
  { p: 6, s: '12:30', e: '13:15' },
  { p: 7, s: '13:15', e: '14:00' },
];

// weekly period budget per subject
function weeklyPeriods(subjectName, subjectCount) {
  const n = (subjectName || '').toLowerCase();
  if (/physical|health|sport|games|yoga/.test(n)) return 3;
  if (/computer|^ai|artificial|coding/.test(n)) return 4;
  if (/sanskrit|accountancy|business|economics|geography|history/.test(n)) return 4;
  if (/english|hindi|math|science|physics|chemistry|biology|social/.test(n)) return 5;
  return 4;
}

const uuid = (s) => `'${s}'`;
const q = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);

async function main() {
  const [year] = await sql(`select id from academic_years where is_current limit 1`);
  const YEAR_ID = year.id;

  const csRows = await sql(`
    select cs.id as cs_id, cs.class_id, cs.section_id, cs.room_no,
           c.class_name, c.display_order, sec.section_name
    from class_sections cs
    join classes c on c.id = cs.class_id
    join sections sec on sec.id = cs.section_id
    where cs.is_active
    order by c.display_order, sec.section_name`);

  const taRows = await sql(`
    select ta.class_id, ta.section_id, ta.subject_id, ta.teacher_id,
           s.subject_name, t.name as teacher_name
    from teacher_assignments ta
    join subjects s on s.id = ta.subject_id
    join teachers t on t.id = ta.teacher_id
    where ta.is_active and ta.academic_year_id = ${uuid(YEAR_ID)} and ta.subject_id is not null`);

  // group assignments by class-section
  const bySection = new Map(); // cs_id -> {cs, needs:[{subject_id,teacher_id,subject_name,teacher_name,left}]}
  const homeRoom = new Map();  // cs_id -> "R-###"
  let roomSeq = 101;
  for (const cs of csRows) {
    homeRoom.set(cs.cs_id, `R-${roomSeq++}`);
    bySection.set(cs.cs_id, { cs, needs: [] });
  }
  // how many sections each teacher covers — a teacher assigned to many
  // sections physically cannot give each one a full period count in a
  // 42-slot week, so the target is capped by their spread.
  const teacherSpread = new Map();
  for (const ta of taRows) teacherSpread.set(ta.teacher_id, (teacherSpread.get(ta.teacher_id) ?? 0) + 1);

  for (const ta of taRows) {
    const cs = csRows.find(r => r.class_id === ta.class_id && r.section_id === ta.section_id);
    if (!cs) continue;
    const entry = bySection.get(cs.cs_id);
    const subjectCount = taRows.filter(x => x.class_id === ta.class_id && x.section_id === ta.section_id).length;
    let ideal = weeklyPeriods(ta.subject_name, subjectCount);
    if (subjectCount <= 3) ideal = Math.min(12, Math.ceil(34 / subjectCount));   // primary: doubles allowed
    else if (subjectCount <= 5) ideal = Math.min(ideal + 1, 7);
    const spread = teacherSpread.get(ta.teacher_id) ?? 1;
    const feasible = Math.max(2, Math.floor(38 / spread));
    entry.needs.push({
      subject_id: ta.subject_id, teacher_id: ta.teacher_id,
      subject_name: ta.subject_name, teacher_name: ta.teacher_name,
      target: Math.min(ideal, feasible),
      left: Math.min(ideal, feasible),
    });
  }

  // busy maps
  const key = (d, p) => `${d}#${p}`;
  const teacherBusy = new Map(); // teacher_id -> Set(day#period)
  const roomBusy = new Map();    // room -> Set(day#period)
  const bump = (m, id, k) => { if (!m.has(id)) m.set(id, new Set()); m.get(id).add(k); };
  const free = (m, id, k) => !m.get(id)?.has(k);

  const rows = [];
  const occupied = new Set(); // cs_id#day#period  -> class-section already has a slot
  const roomFor = (csId, subjectName, k) => {
    let room = homeRoom.get(csId);
    const sn = subjectName.toLowerCase();
    if (/computer|artificial|^ai/.test(sn)) {
      room = ['Computer Lab 1', 'Computer Lab 2'].find(r => free(roomBusy, r, k)) || room;
    } else if (/physical|health|sport|games|yoga/.test(sn)) {
      room = ['Sports Ground', 'Activity Hall'].find(r => free(roomBusy, r, k)) || room;
    }
    return room;
  };
  const place = (cs, nd, d, p, s, e) => {
    const k = key(d, p);
    const room = roomFor(cs.cs_id, nd.subject_name, k);
    rows.push({
      cs_id: cs.cs_id, class_id: cs.class_id, section_id: cs.section_id,
      subject_id: nd.subject_id, teacher_id: nd.teacher_id,
      day: d, period: p, start: s + ':00', end: e + ':00', room, class_name: cs.class_name,
    });
    if (nd.left > 0) nd.left -= 1;
    bump(teacherBusy, nd.teacher_id, k);
    bump(roomBusy, room, k);
    occupied.add(`${cs.cs_id}#${d}#${p}`);
  };
  const sameSubjectAdjacent = (csId, d, p, subjectId) =>
    rows.some(r => r.cs_id === csId && r.day === d && r.subject_id === subjectId && Math.abs(r.period - p) === 1);
  const twiceInDay = (csId, d, subjectId) =>
    rows.filter(r => r.cs_id === csId && r.day === d && r.subject_id === subjectId).length >= 2;

  const allCells = [];
  for (const { p, s, e } of PERIODS) for (const d of DAYS) allCells.push({ d, p, s, e });
  // per-section cell order: rotate the starting day so contention for a
  // shared teacher spreads across the week instead of piling on Monday P1.
  const cellsFor = (i) => {
    const off = (i * 5) % allCells.length;
    return allCells.slice(off).concat(allCells.slice(0, off));
  };
  const gotCount = (csId, subjId) => rows.filter(r => r.cs_id === csId && r.subject_id === subjId).length;

  const tryPlaceOne = (cs, i, mode /* 'target' | 'relax' */) => {
    const entry = bySection.get(cs.cs_id);
    const pending = (mode === 'target'
      ? entry.needs.filter(nd => gotCount(cs.cs_id, nd.subject_id) < nd.target)
      : entry.needs.filter(nd => gotCount(cs.cs_id, nd.subject_id) < nd.target + 3))
      .sort((a, b) => gotCount(cs.cs_id, a.subject_id) - gotCount(cs.cs_id, b.subject_id));
    for (const nd of pending) {
      const cell = cellsFor(i).find(({ d, p }) =>
        !occupied.has(`${cs.cs_id}#${d}#${p}`) &&
        free(teacherBusy, nd.teacher_id, key(d, p)) &&
        !twiceInDay(cs.cs_id, d, nd.subject_id) &&
        !sameSubjectAdjacent(cs.cs_id, d, p, nd.subject_id));
      if (cell) { place(cs, nd, cell.d, cell.p, cell.s, cell.e); return true; }
    }
    return false;
  };

  const order = [...csRows.keys()].sort((a, b) => {
    const da = bySection.get(csRows[a].cs_id).needs.reduce((t, n) => t + n.target, 0);
    const db = bySection.get(csRows[b].cs_id).needs.reduce((t, n) => t + n.target, 0);
    return db - da;
  });

  // fill to target, one placement per section per sweep, until a sweep does nothing
  for (let sweep = 0; sweep < 60; sweep++) {
    let placed = 0;
    for (const i of order) if (tryPlaceOne(csRows[i], i, 'target')) placed++;
    if (!placed) break;
  }
  // relax past target to keep the grid dense
  for (let sweep = 0; sweep < 30; sweep++) {
    let placed = 0;
    for (const i of order) {
      const cs = csRows[i];
      const filled = rows.filter(r => r.cs_id === cs.cs_id).length;
      if (filled >= allCells.length) continue;
      if (tryPlaceOne(cs, i, 'relax')) placed++;
    }
    if (!placed) break;
  }

  // report: per class-section, periods/week per subject and total
  const thin = [];
  for (const { cs, needs } of bySection.values()) {
    const total = rows.filter(r => r.cs_id === cs.cs_id).length;
    for (const nd of needs) {
      const got = rows.filter(r => r.cs_id === cs.cs_id && r.subject_id === nd.subject_id).length;
      if (got < 3) thin.push(`${cs.class_name}-${cs.section_name} ${nd.subject_name}: only ${got}/wk`);
    }
    if (total < DAYS.length * 4) thin.push(`${cs.class_name}-${cs.section_name}: only ${total} periods/wk`);
  }
  console.log(`class-sections: ${csRows.length}`);
  console.log(`assignments:    ${taRows.length}`);
  console.log(`slots planned:  ${rows.length}  (avg ${(rows.length / csRows.length).toFixed(1)}/section)`);
  console.log(`thin coverage:  ${thin.length}${thin.length ? '\n  ' + thin.join('\n  ') : ''}`);

  // emit SQL
  const values = rows.map(r =>
    `(${uuid(r.class_id)}, ${q(r.class_name)}, ${uuid(r.section_id)}, ${uuid(r.subject_id)}, ` +
    `${uuid(r.teacher_id)}, ${uuid(YEAR_ID)}, ${q(r.day)}, ${r.period}, ` +
    `'${r.start}', '${r.end}', ${q(r.room)})`
  ).join(',\n');

  const out = `-- Regenerated clash-free timetable for ${YEAR_ID}
BEGIN;
DELETE FROM public.timetable WHERE academic_year_id = ${uuid(YEAR_ID)} OR academic_year_id IS NULL;
INSERT INTO public.timetable
  (class_id, class, section_id, subject_id, teacher_id, academic_year_id, day, period_number, start_time, end_time, room_no)
VALUES
${values};
COMMIT;
`;
  const dir = path.join(ROOT, 'scripts', 'out');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'timetable.sql'), out);
  console.log(`\nwrote scripts/out/timetable.sql (${rows.length} rows)`);

  if (process.argv.includes('--apply')) {
    await sql(out);
    const [{ count: clashCount }] = await sql(`select count(*)::int as count from timetable_teacher_clashes`);
    const dbl = await sql(`
      select class_id, section_id, day, period_number, count(*)
      from timetable where academic_year_id = ${uuid(YEAR_ID)}
      group by 1,2,3,4 having count(*) > 1`);
    const roomDbl = await sql(`
      select room_no, day, period_number, count(*)
      from timetable where academic_year_id = ${uuid(YEAR_ID)} and room_no is not null
      group by 1,2,3 having count(*) > 1`);
    console.log(`\napplied. teacher clashes now: ${clashCount}`);
    console.log(`class double-bookings:  ${dbl.length}`);
    console.log(`room double-bookings:   ${roomDbl.length}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
