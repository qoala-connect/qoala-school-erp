/**
 * Replaces the thin / bulk-seeded academic activity data with realistic,
 * time-spread data derived from the real structure (teacher_assignments,
 * class_subjects, students):
 *
 *   syllabus_units / _chapters / _topics   a CBSE-style curriculum per
 *                                          class + subject
 *   syllabus_progress                      per section, coverage matching
 *                                          how far into the term we are
 *   lesson_plans                           ~weekly, completed for past
 *                                          dates, planned for the future
 *   assignments                            homework + assignments spread
 *                                          over the term, all sections
 *   student_assignment_submissions         per-student text, staggered
 *                                          submit times, a realistic
 *                                          submit rate, partial review
 *
 * Usage: node scripts/reseed_academic_activity.mjs --apply
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

// deterministic RNG so re-runs are stable
let _seed = 20260905;
const rnd = () => { _seed = (_seed * 1664525 + 1013904223) % 4294967296; return _seed / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const chance = (p) => rnd() < p;
const Q = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const D = (dt) => `'${dt.toISOString().slice(0, 10)}'`;
const TS = (dt) => `'${dt.toISOString()}'`;
const addDays = (dt, n) => { const x = new Date(dt); x.setUTCDate(x.getUTCDate() + n); return x; };

// ------- content banks -------------------------------------------------
const CHAPTERS = {
  Mathematics: ['Number Systems', 'Polynomials', 'Linear Equations in Two Variables', 'Coordinate Geometry',
    'Triangles', 'Quadrilaterals', 'Areas of Parallelograms and Triangles', 'Circles', 'Surface Areas and Volumes',
    'Statistics', 'Probability', 'Quadratic Equations', 'Arithmetic Progressions', 'Trigonometry'],
  Science: ['Matter in Our Surroundings', 'Is Matter Around Us Pure', 'Atoms and Molecules', 'Structure of the Atom',
    'The Fundamental Unit of Life', 'Tissues', 'Motion', 'Force and Laws of Motion', 'Gravitation', 'Work and Energy',
    'Sound', 'Improvement in Food Resources', 'Natural Resources'],
  Physics: ['Electric Charges and Fields', 'Electrostatic Potential and Capacitance', 'Current Electricity',
    'Moving Charges and Magnetism', 'Magnetism and Matter', 'Electromagnetic Induction', 'Alternating Current',
    'Ray Optics and Optical Instruments', 'Wave Optics', 'Dual Nature of Radiation and Matter'],
  Chemistry: ['Solid State', 'Solutions', 'Electrochemistry', 'Chemical Kinetics', 'Surface Chemistry',
    'The p-Block Elements', 'The d- and f-Block Elements', 'Coordination Compounds', 'Haloalkanes and Haloarenes',
    'Alcohols, Phenols and Ethers', 'Aldehydes, Ketones and Carboxylic Acids', 'Amines', 'Biomolecules'],
  Biology: ['The Living World', 'Biological Classification', 'Plant Kingdom', 'Animal Kingdom',
    'Morphology of Flowering Plants', 'Cell: The Unit of Life', 'Cell Cycle and Cell Division', 'Photosynthesis',
    'Respiration in Plants', 'Human Reproduction', 'Principles of Inheritance and Variation', 'Evolution',
    'Human Health and Disease', 'Ecosystem'],
  English: ['The Portrait of a Lady', 'A Photograph', 'We’re Not Afraid to Die', 'Discovering Tut',
    'The Laburnum Top', 'The Voice of the Rain', 'The Adventure', 'Silk Road', 'Note Making and Summarising',
    'Letter Writing — Formal', 'Article Writing', 'Reading Comprehension — Unseen Passage', 'Grammar: Tenses',
    'Grammar: Determiners and Modals'],
  Hindi: ['गद्य खंड — प्रेमचंद: ईदगाह', 'काव्य खंड — सूरदास के पद',
    'काव्य खंड — तुलसीदास', 'गद्य खंड — रामवृक्ष बेनीपुरी',
    'व्याकरण — समास', 'व्याकरण — अलंकार', 'व्याकरण — रस', 'अपठित गद्यांश',
    'निबंध लेखन', 'पत्र लेखन'],
  Sanskrit: ['सुभाषितानि', 'दुर्बुद्धिः विनश्यति', 'स्वावलम्बनम्', 'शब्दरूप — बालक, नदी',
    'धातुरूप — लट्, लृट्', 'सन्धि — स्वर सन्धि', 'समास — तत्पुरुष', 'अनुवाद अभ्यास'],
  'Social Science': ['The French Revolution', 'Nazism and the Rise of Hitler', 'Nationalism in India',
    'The Making of a Global World', 'Resources and Development', 'Water Resources', 'Agriculture',
    'Minerals and Energy Resources', 'Manufacturing Industries', 'Power Sharing', 'Federalism',
    'Democracy and Diversity', 'Development', 'Sectors of the Indian Economy'],
  'Computer Applications & AI': ['Introduction to AI and its Domains', 'AI Project Cycle', 'Data for AI — Acquisition and Exploration',
    'Introduction to Python', 'Python — Lists, Tuples and Dictionaries', 'Functions and Modules',
    'Introduction to Machine Learning', 'Computer Networks and the Internet', 'HTML and Web Pages',
    'Cyber Safety and Digital Footprint', 'Databases and SQL Basics'],
  Accountancy: ['Introduction to Accounting', 'Theory Base of Accounting', 'Recording of Transactions — Journal',
    'Ledger and Trial Balance', 'Depreciation, Provisions and Reserves', 'Bill of Exchange',
    'Financial Statements — Sole Proprietorship', 'Accounts from Incomplete Records', 'Not-for-Profit Organisations'],
  'Physical & Health Education': ['Changing Trends and Career in Physical Education', 'Olympic Movement',
    'Physical Fitness, Wellness and Lifestyle', 'Yoga', 'Doping and its Side Effects', 'Test and Measurement in Sports',
    'Fundamentals of Anatomy and Physiology', 'Training and Doping in Sports'],
};
const genericChapters = (subj) => Array.from({ length: 12 }, (_, i) => `${subj} — Unit ${i + 1}`);
const chaptersFor = (subj) => CHAPTERS[subj] || genericChapters(subj);

const HW_TITLES = (subj, ch) => pick([
  `Exercise on ${ch}`, `${ch} — textbook questions 1–10`, `Worksheet: ${ch}`,
  `Short-answer practice: ${ch}`, `${ch} — diagram / derivation practice`, `Revision notes: ${ch}`,
  `Solve NCERT problems — ${ch}`, `${subj}: back-exercise of ${ch}`,
]);
const AS_TITLES = (subj, ch) => pick([
  `Project: ${ch}`, `Assignment — ${ch} (long answers)`, `Case study: ${ch}`, `Lab record: ${ch}`,
  `Portfolio task — ${ch}`, `Research write-up: ${ch}`, `${subj} assignment — ${ch}`,
]);
const METHODS = ['Lecture + discussion', 'Demonstration + Q&A', 'Group activity', 'Problem solving on board',
  'Audio-visual + notes', 'Peer learning', 'Flipped classroom', 'Lab / practical work'];
const RESOURCES = ['NCERT textbook, board', 'Textbook + worksheet', 'Smart-board slides, charts',
  'Lab apparatus, record book', 'Reference book + past papers', 'Diagrams, model, board'];
const FEEDBACK_POS = [
  'Clear reasoning and neat presentation. Well done.', 'Good grasp of the concept; keep this consistency.',
  'Accurate work. Attempt the optional questions next time.', 'Very good — steps shown clearly throughout.',
  'Strong answer with correct terminology.', 'Nicely organised. Diagrams are labelled well.',
];
const FEEDBACK_MID = [
  'On the right track. Show every step of the working.', 'Revise the last section — a few conceptual slips.',
  'Answers are brief; expand with examples.', 'Mind the units in the final answers.',
  'Handwriting and layout need care.', 'Good attempt — recheck question 3 and 5.',
];
const FEEDBACK_LOW = [
  'Incomplete. Please redo and resubmit.', 'Several errors — come for doubt-clearing this week.',
  'Copied structure without understanding; attempt on your own.', 'Only partially attempted. See me after class.',
];
const SUBMIT_TEXT = (name, subj, ch) => {
  const first = name.split(' ')[0];
  return pick([
    `${first}'s submission for ${ch}. All parts attempted; working shown for the numerical questions.`,
    `Completed the ${subj} task on "${ch}". I found question ${int(2, 6)} difficult and have shown my approach.`,
    `Answers for ${ch} — have included diagrams where asked. Please check the last section.`,
    `Submitting my work on ${ch}. Used the NCERT and reference notes. Marked the doubtful step with a "?".`,
    `${ch}: exercises solved, notes made. Uploaded the scanned sheet as well.`,
    `Here is my ${subj} assignment on ${ch}. I have written the derivation and one real-life example.`,
  ]);
};

// ------- main --------------------------------------------------------
async function main() {
  const [{ id: YEAR_ID, start_date: TERM_START }] =
    await sql(`select id, start_date from academic_years where is_current limit 1`);
  const [{ today }] = await sql(`select current_date::text as today`);
  const TODAY = new Date(today + 'T00:00:00Z');
  const START = new Date('2026-04-07T00:00:00Z'); // first teaching week

  const ta = await sql(`
    select ta.class_id, ta.section_id, ta.subject_id, ta.teacher_id,
           c.class_name, c.display_order, sec.section_name, s.subject_name, t.name teacher_name
    from teacher_assignments ta
    join classes c on c.id = ta.class_id
    join sections sec on sec.id = ta.section_id
    join subjects s on s.id = ta.subject_id
    join teachers t on t.id = ta.teacher_id
    where ta.is_active and ta.academic_year_id = ${Q(YEAR_ID)} and ta.subject_id is not null`);

  const students = await sql(`
    select id, name, class_id, section_id from students where status = 'active'`);
  const roster = (classId, sectionId) => students.filter(s => s.class_id === classId && s.section_id === sectionId);

  // distinct (class, subject) for the curriculum — build once per class+subject
  const classSubj = [...new Map(ta.map(r => [`${r.class_id}|${r.subject_id}`,
    { class_id: r.class_id, subject_id: r.subject_id, class_name: r.class_name, subject_name: r.subject_name, display_order: r.display_order }])).values()]
    .filter(cs => cs.display_order >= 6); // curriculum tracked for classes 6+

  // per-student ability 0.55..0.97 (stable), per (student,subject) noise
  const ability = new Map(students.map(s => [s.id, 0.55 + rnd() * 0.42]));

  const units = [], chapters = [], topics = [], progress = [], lessons = [], assigns = [], subs = [];
  const chapterIndex = new Map(); // class|subject -> [{id, seq, title}]

  // ---- curriculum ----
  for (const cs of classSubj) {
    const bank = chaptersFor(cs.subject_name);
    const nUnits = int(3, 5);
    let chSeq = 0;
    const chList = [];
    for (let u = 1; u <= nUnits; u++) {
      const uid = crypto.randomUUID();
      units.push(`(${Q(uid)}, ${Q(YEAR_ID)}, ${Q(cs.class_id)}, ${Q(cs.subject_id)}, ${Q(`Unit ${u}: ${bank[(u - 1) % bank.length]}`)}, ${u})`);
      const nCh = int(2, 4);
      for (let c = 0; c < nCh; c++) {
        chSeq++;
        const cid = crypto.randomUUID();
        const title = bank[(chSeq - 1) % bank.length];
        chapters.push(`(${Q(cid)}, ${Q(uid)}, ${Q(title)}, ${c + 1}, ${int(4, 12)}.0)`);
        chList.push({ id: cid, seq: chSeq, title });
        const nT = int(2, 4);
        for (let t = 1; t <= nT; t++)
          topics.push(`(${Q(crypto.randomUUID())}, ${Q(cid)}, ${Q(`${title} — ${pick(['Introduction', 'Key concepts', 'Worked examples', 'Applications', 'Common errors', 'Summary'])}`)}, ${t})`);
      }
    }
    chapterIndex.set(`${cs.class_id}|${cs.subject_id}`, chList);
  }

  // ---- progress + lesson plans + assignments per teacher_assignment ----
  const weeksElapsed = Math.max(1, Math.round((TODAY - START) / (7 * 864e5)));
  for (const a of ta) {
    const chList = chapterIndex.get(`${a.class_id}|${a.subject_id}`) || [];
    const kids = roster(a.class_id, a.section_id);

    // syllabus progress: cover ~ (weeksElapsed / 34) of chapters, +- pace
    if (chList.length) {
      const pace = 0.75 + rnd() * 0.5;
      const coveredF = Math.min(1, (weeksElapsed / 34) * pace);
      const doneN = Math.floor(chList.length * coveredF);
      chList.forEach((ch, idx) => {
        let status = 'not_started', started = 'NULL', completed = 'NULL';
        if (idx < doneN) {
          status = 'completed';
          const cd = addDays(START, int(7, weeksElapsed * 7 - 2));
          started = D(addDays(cd, -int(3, 9))); completed = D(cd);
        } else if (idx === doneN) {
          status = 'in_progress'; started = D(addDays(TODAY, -int(2, 8)));
        }
        progress.push(`(${Q(ch.id)}, ${Q(a.section_id)}, ${Q(a.teacher_id)}, ${Q(status)}, ${started}, ${completed}, ${Q(a.teacher_name + ' — pace ' + pace.toFixed(2))})`);
      });
    }

    // lesson plans: one per teaching week, following the chapter list
    const planWeeks = Math.min(weeksElapsed + 2, 26);
    for (let w = 0; w < planWeeks; w += 1) {
      if (a.subject_name.match(/physical/i) && w % 2) continue; // PE ~ fortnightly plan
      const planned = addDays(START, w * 7 + int(0, 4));
      const past = planned < TODAY;
      const ch = chList.length ? chList[Math.min(chList.length - 1, Math.floor(w * chList.length / Math.max(1, planWeeks)))] : null;
      const topic = ch ? `${ch.title} — ${pick(['introduction', 'core concepts', 'numericals', 'revision', 'application', 'doubt session'])}`
        : `${a.subject_name} — week ${w + 1}`;
      lessons.push(
        `(${Q(a.class_id)}, ${Q(a.class_name)}, ${Q(a.subject_id)}, ${Q(a.subject_name)}, ${Q(topic)}, ` +
        `${Q('Students will understand ' + (ch ? ch.title.toLowerCase() : a.subject_name.toLowerCase()) + ' and apply it to standard problems.')}, ` +
        `${D(planned)}, ${past ? D(addDays(planned, int(0, 2))) : 'NULL'}, ${Q(past ? 'completed' : 'planned')}, ` +
        `${Q(a.teacher_id)}, ${Q(a.teacher_name)}, ${Q(a.section_id)}, ${Q(YEAR_ID)}, ${ch ? Q(ch.id) : 'NULL'}, ` +
        `${int(35, 45)}, ${Q(pick(METHODS))}, ${Q(pick(RESOURCES))}, ` +
        `${past ? Q(pick(['Ex. ' + int(1, 9) + '.' + int(1, 4), 'Worksheet ' + int(1, 6), 'Read next section', 'Revise notes', 'None'])) : 'NULL'}, ` +
        `${past ? Q(pick(['Covered as planned.', 'Ran slightly over; finish intro next class.', 'Good participation.', 'Re-explain the tricky step next time.', 'Quick recap needed before test.'])) : 'NULL'})`
      );
    }

    // assignments: homework + assignment, spread across elapsed weeks
    if (a.display_order >= 6 && kids.length) {
      const nItems = int(2, 4);
      for (let i = 0; i < nItems; i++) {
        const wk = Math.floor((i + 0.5) * weeksElapsed / nItems) - int(0, 1);
        const assigned = addDays(START, Math.max(3, wk * 7 + int(1, 5)));
        if (assigned > addDays(TODAY, 6)) continue;
        const isHw = chance(0.6);
        const ch = chList.length ? chList[Math.min(chList.length - 1, Math.floor(wk * chList.length / Math.max(1, weeksElapsed)))] : { title: a.subject_name };
        const due = addDays(assigned, isHw ? int(2, 5) : int(7, 12));
        const future = assigned > TODAY;
        const aid = crypto.randomUUID();
        const maxMarks = isHw ? 'NULL' : String(pick([10, 15, 20, 25, 30, 40]));
        assigns.push({
          id: aid,
          row: `(${Q(aid)}, ${Q(isHw ? HW_TITLES(a.subject_name, ch.title) : AS_TITLES(a.subject_name, ch.title))}, ` +
            `${Q(`${isHw ? 'Complete and submit' : 'Prepare and submit'} the work on "${ch.title}". ${isHw ? 'Show all working.' : 'Follow the assignment rubric; cite sources where used.'}`)}, ` +
            `${Q(a.class_name)}, ${Q(a.section_name)}, ${Q(a.subject_id)}, ${Q(a.teacher_id)}, ${D(due)}, ${maxMarks}, ` +
            `${Q(YEAR_ID)}, ${Q(a.class_id)}, ${Q(a.section_id)}, ${Q(isHw ? 'homework' : 'assignment')}, ${D(assigned)}, ` +
            `${Q(future && chance(0.5) ? 'draft' : 'published')})`,
          assigned, due, future, isHw, maxMarks: isHw ? null : Number(maxMarks),
          teacher_id: a.teacher_id, subject_name: a.subject_name, chTitle: ch.title, kids,
        });
      }
    }
  }

  // ---- submissions ----
  for (const a of assigns) {
    if (a.future) continue; // nothing submitted for a future / draft item
    const submitRate = 0.72 + rnd() * 0.22;
    const reviewable = addDays(a.due, 3) < TODAY;
    for (const kid of a.kids) {
      if (!chance(submitRate)) continue; // this student didn't submit
      const ab = ability.get(kid.id) ?? 0.75;
      const late = chance(0.12);
      const when = late
        ? addDays(a.due, int(1, 3))
        : new Date(a.assigned.getTime() + rnd() * Math.max(1, (a.due - a.assigned)));
      if (when > TODAY) continue;
      const reviewed = reviewable && chance(0.55 + ab * 0.25);
      let marks = 'NULL', fb = 'NULL', status = late ? 'late' : 'submitted', rvAt = 'NULL', rvBy = 'NULL';
      if (reviewed) {
        status = 'reviewed';
        rvAt = TS(addDays(when, int(2, 6)));
        rvBy = Q(a.teacher_id);
        if (a.maxMarks) {
          const frac = Math.max(0.35, Math.min(1, ab + (rnd() - 0.5) * 0.22 - (late ? 0.08 : 0)));
          marks = String(Math.round(a.maxMarks * frac));
        }
        const band = a.maxMarks ? Number(marks) / a.maxMarks : ab;
        fb = chance(0.25) ? 'NULL'
          : Q(band >= 0.78 ? pick(FEEDBACK_POS) : band >= 0.55 ? pick(FEEDBACK_MID) : pick(FEEDBACK_LOW));
      }
      subs.push(
        `(${Q(a.id)}, ${Q(kid.id)}, ${Q(SUBMIT_TEXT(kid.name, a.subject_name, a.chTitle))}, ` +
        `${chance(0.35) ? Q(`https://drive.school.local/${kid.id.slice(0, 8)}/${a.id.slice(0, 8)}.pdf`) : 'NULL'}, ` +
        `${TS(when)}, ${marks}, ${fb}, ${Q(status)}, ${rvAt}, ${rvBy})`
      );
    }
  }

  console.log(`units ${units.length} chapters ${chapters.length} topics ${topics.length}`);
  console.log(`progress ${progress.length}  lesson_plans ${lessons.length}`);
  console.log(`assignments ${assigns.length}  submissions ${subs.length}`);

  if (!APPLY) { console.log('\n(dry run — pass --apply to write)'); return; }

  const chunks = (arr, n) => arr.reduce((a, _, i) => (i % n ? a : [...a, arr.slice(i, i + n)]), []);
  const run = async (label, header, rows) => {
    for (const c of chunks(rows, 400)) await sql(header + c.join(',\n') + ';');
    console.log(`  ${label}: ${rows.length}`);
  };

  await sql(`BEGIN;
    DELETE FROM student_assignment_submissions;
    DELETE FROM assignments;
    DELETE FROM lesson_plans;
    DELETE FROM syllabus_progress;
    DELETE FROM syllabus_topics; DELETE FROM syllabus_chapters; DELETE FROM syllabus_units;
    COMMIT;`);
  await run('units', `INSERT INTO syllabus_units (id,academic_year_id,class_id,subject_id,title,sequence) VALUES `, units);
  await run('chapters', `INSERT INTO syllabus_chapters (id,unit_id,title,sequence,expected_hours) VALUES `, chapters);
  await run('topics', `INSERT INTO syllabus_topics (id,chapter_id,title,sequence) VALUES `, topics);
  await run('progress', `INSERT INTO syllabus_progress (chapter_id,section_id,teacher_id,status,started_on,completed_on,notes) VALUES `, progress);
  await run('lesson_plans', `INSERT INTO lesson_plans (class_id,class_name,subject_id,subject_name,topic,objectives,planned_date,completion_date,status,teacher_id,teacher_name,section_id,academic_year_id,chapter_id,duration_minutes,teaching_method,resources,homework_text,outcome_notes) VALUES `, lessons);
  await run('assignments', `INSERT INTO assignments (id,title,description,class,section,subject_id,teacher_id,due_date,max_marks,academic_year_id,class_id,section_id,kind,assigned_date,status) VALUES `, assigns.map(a => a.row));
  await run('submissions', `INSERT INTO student_assignment_submissions (assignment_id,student_id,submission_text,submission_url,submitted_at,marks_obtained,feedback,status,reviewed_at,reviewed_by) VALUES `, subs);
  console.log('done.');
}

main().catch(e => { console.error(e); process.exit(1); });
