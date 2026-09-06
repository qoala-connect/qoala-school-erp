/**
 * Regenerates realistic subject marks for every exam that has mark rows,
 * then recomputes exam_results (totals, %, grade, division, pass/fail,
 * class rank) from those marks.
 *
 * Before: 6,210 of 6,211 marks rows had obtained_marks = 0 while
 * exam_results showed 70-93% — the results did not derive from the marks.
 * After: a per-student ability (stable across both exams and correlated
 * across subjects) drives the marks; results are a straight roll-up.
 *
 * Usage: node scripts/regenerate_marks.mjs --apply
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const get = (k) => env.match(new RegExp('^' + k + '=(.*)$', 'm'))?.[1]?.trim() ?? '';
const TOKEN = get('SUPABASE_ACCESS_TOKEN');
const REF = (get('VITE_SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL'))
  .replace('https://', '').replace('.supabase.co', '');
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

// stable hash -> [0,1)
const h01 = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const Q = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);

function gradeFor(pct, rules) {
  const r = rules.find(x => pct >= Number(x.min_score) && pct <= Number(x.max_score));
  return r ? r.grade_name : (pct >= 33 ? 'D' : 'E');
}
function divisionFor(pct) {
  if (pct >= 75) return 'First Division (Distinction)';
  if (pct >= 60) return 'First Division';
  if (pct >= 45) return 'Second Division';
  if (pct >= 33) return 'Third Division';
  return 'Fail';
}

async function main() {
  const rules = await sql(`select grade_name, min_score, max_score from grading_rules order by min_score desc`);
  const exams = await sql(`select id, class_id, academic_year_id, short_name, exam_name from exams`);
  const examSub = await sql(`select exam_id, subject_id, max_marks, pass_marks from exam_subjects`);
  const marks = await sql(`select id, exam_id, student_id, subject_id, max_marks from marks`);
  const [{ processed_by }] = await sql(
    `select id as processed_by from profiles where role in ('admin','super_admin','principal') limit 1`);

  const examById = new Map(exams.map(e => [e.id, e]));
  const subMax = new Map(); // exam_id|subject_id -> {max, pass}
  for (const s of examSub) subMax.set(`${s.exam_id}|${s.subject_id}`, { max: Number(s.max_marks), pass: Number(s.pass_marks) });

  const ability = (studentId) => 0.50 + h01('abil' + studentId) * 0.47;           // 0.50 .. 0.97
  const subjBias = (studentId, subjectId) => (h01('sb' + studentId + subjectId) - 0.5) * 0.24; // +-0.12
  const examLuck = (studentId, examId) => (h01('lk' + studentId + examId) - 0.5) * 0.14;        // +-0.07

  const markUpdates = [];
  const perExamStudent = new Map(); // exam_id|student_id -> {examId, studentId, tot, max, allPass}

  for (const m of marks) {
    const key = `${m.exam_id}|${m.subject_id}`;
    const cfg = subMax.get(key) || { max: Number(m.max_marks) || 100, pass: Math.round((Number(m.max_marks) || 100) * 0.33) };
    const max = cfg.max;
    const absent = h01('abs' + m.id) < 0.02;
    let obtained;
    if (absent) obtained = 0;
    else {
      const perf = clamp(ability(m.student_id) + subjBias(m.student_id, m.subject_id) + examLuck(m.student_id, m.exam_id), 0.30, 1.0);
      obtained = clamp(Math.round(max * perf), 0, max);
      // avoid an unnatural spike exactly at max
      if (obtained === max && h01('nudge' + m.id) < 0.7) obtained -= 1 + Math.floor(h01('n2' + m.id) * 3);
    }
    const pct = (obtained / max) * 100;
    const grade = gradeFor(pct, rules);

    // CBSE component split for /100 papers; single bucket otherwise
    let pt = 0, ma = 0, pf = 0, se = 0, ae = 0;
    if (max >= 80) {
      pt = Math.round(obtained * 0.10);
      ma = Math.round(obtained * 0.05);
      pf = Math.round(obtained * 0.05);
      se = Math.round(obtained * 0.05);
      ae = obtained - pt - ma - pf - se;
    } else {
      pt = obtained;
    }

    markUpdates.push(
      `(${Q(m.id)}, ${obtained}, ${pt}, ${ma}, ${pf}, ${se}, ${ae}, ${absent}, ` +
      `${Q(absent ? 'Absent' : 'Present')}, ${Q(grade)}, ${Q('approved')}, ${Q(processed_by)})`
    );

    const k2 = `${m.exam_id}|${m.student_id}`;
    if (!perExamStudent.has(k2)) perExamStudent.set(k2, { examId: m.exam_id, studentId: m.student_id, tot: 0, max: 0, allPass: true, absentAll: true });
    const agg = perExamStudent.get(k2);
    agg.tot += obtained; agg.max += max;
    if (!absent) agg.absentAll = false;
    if (obtained < cfg.pass) agg.allPass = false;
  }

  // exam_results with rank
  const byExam = new Map();
  for (const agg of perExamStudent.values()) {
    if (!byExam.has(agg.examId)) byExam.set(agg.examId, []);
    byExam.get(agg.examId).push(agg);
  }
  const resultRows = [];
  for (const [examId, list] of byExam) {
    const e = examById.get(examId);
    list.sort((a, b) => b.tot - a.tot);
    list.forEach((agg, i) => {
      const pct = agg.max ? (agg.tot / agg.max) * 100 : 0;
      const status = agg.absentAll ? 'ABSENT' : agg.allPass ? 'PASS' : 'FAIL';
      resultRows.push(
        `(${Q(examId)}, ${Q(agg.studentId)}, ${agg.tot}, ${agg.max}, ${pct.toFixed(2)}, ` +
        `${Q(divisionFor(pct))}, ${Q(gradeFor(pct, rules))}, ${Q(status)}, ${i + 1}, ` +
        `${e ? Q(e.class_id) : 'NULL'}, ${e ? Q(e.academic_year_id) : 'NULL'}, ${Q(processed_by)})`
      );
    });
  }

  console.log(`marks to update:   ${markUpdates.length}`);
  console.log(`exam_results:      ${resultRows.length} across ${byExam.size} exams`);
  const distinctExamsWithMarks = [...new Set(marks.map(m => m.exam_id))];

  if (!APPLY) { console.log('\n(dry run — pass --apply to write)'); return; }

  const chunks = (arr, n) => arr.reduce((a, _, i) => (i % n ? a : [...a, arr.slice(i, i + n)]), []);

  for (const c of chunks(markUpdates, 500)) {
    await sql(`
      UPDATE public.marks AS m SET
        obtained_marks = v.obtained,
        periodic_test_marks = v.pt, multiple_assessment_marks = v.ma,
        portfolio_marks = v.pf, subject_enrichment_marks = v.se, annual_exam_marks = v.ae,
        is_absent = v.absent, attendance_status = v.att, grade = v.grade,
        status = v.status, updated_by = v.uby::uuid, updated_at = now()
      FROM (VALUES ${c.join(',\n')})
        AS v(id, obtained, pt, ma, pf, se, ae, absent, att, grade, status, uby)
      WHERE m.id = v.id::uuid`);
  }
  console.log(`  marks updated: ${markUpdates.length}`);

  await sql(`DELETE FROM public.exam_results WHERE exam_id IN (${distinctExamsWithMarks.map(Q).join(',')})`);
  for (const c of chunks(resultRows, 400)) {
    await sql(`
      INSERT INTO public.exam_results
        (exam_id, student_id, total_marks, max_total_marks, percentage, division, grade,
         result_status, rank, class_id, academic_year_id, processed_by)
      VALUES ${c.join(',\n')}`);
  }
  console.log(`  exam_results inserted: ${resultRows.length}`);
  console.log('done.');
}

main().catch(e => { console.error(e); process.exit(1); });
