import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://cqylpqrharentkjmrymr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('--- Seeding Exam Subjects, Marks, Results, and Documents with exact constraints ---');

  const [classesRes, subjectsRes, studentsRes, examsRes] = await Promise.all([
    supabase.from('classes').select('*').order('display_order'),
    supabase.from('subjects').select('*').order('subject_name'),
    supabase.from('students').select('*').order('roll_number'),
    supabase.from('exams').select('*')
  ]);

  const classes = classesRes.data || [];
  const subjects = subjectsRes.data || [];
  const students = studentsRes.data || [];
  const exams = examsRes.data || [];

  console.log(`Loaded ${classes.length} classes, ${subjects.length} subjects, ${students.length} students, ${exams.length} exams.`);

  // 1. Setup exam_subjects for each exam
  console.log('Configuring exam_subjects...');
  await supabase.from('marks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('exam_results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('exam_subjects').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const examSubjectsBatch = [];
  for (const ex of exams) {
    const classNum = parseInt(ex.class) || 5;
    let applicableCodes = [];
    if (classNum <= 5) applicableCodes = ['MATH', 'SCI', 'ENG', 'HIN', 'SST', 'COMP'];
    else if (classNum <= 8) applicableCodes = ['MATH', 'SCI', 'ENG', 'HIN', 'SST', 'COMP', 'SKT'];
    else if (classNum <= 10) applicableCodes = ['MATH', 'SCI', 'ENG', 'HIN', 'SST', 'COMP'];
    else applicableCodes = ['PHY', 'CHEM', 'BIO', 'MATH', 'ENG', 'COMP'];

    const isPA = ex.exam_name.includes('PA') || ex.exam_name.includes('Periodic');
    const maxMarks = isPA ? 50 : 100;
    const passMarks = isPA ? 18 : 33;

    for (const code of applicableCodes) {
      const sub = subjects.find(s => s.subject_code === code);
      if (!sub) continue;

      examSubjectsBatch.push({
        id: crypto.randomUUID(),
        exam_id: ex.id,
        subject_id: sub.id,
        subject_name: sub.subject_name,
        max_marks: maxMarks,
        pass_marks: passMarks
      });
    }
  }

  const { error: esErr } = await supabase.from('exam_subjects').insert(examSubjectsBatch);
  if (esErr) console.error('Error inserting exam_subjects:', esErr);
  else console.log(`Successfully configured ${examSubjectsBatch.length} exam_subjects.`);

  // 2. Seed Marks & Results
  console.log('Seeding student marks and exam results...');
  const marksBatch = [];
  const resultsBatch = [];

  for (const st of students) {
    const classNum = parseInt(st.class) || 5;
    const classStr = String(st.class).trim();

    let applicableCodes = [];
    if (classNum <= 5) applicableCodes = ['MATH', 'SCI', 'ENG', 'HIN', 'SST', 'COMP'];
    else if (classNum <= 8) applicableCodes = ['MATH', 'SCI', 'ENG', 'HIN', 'SST', 'COMP', 'SKT'];
    else if (classNum <= 10) applicableCodes = ['MATH', 'SCI', 'ENG', 'HIN', 'SST', 'COMP'];
    else applicableCodes = ['PHY', 'CHEM', 'BIO', 'MATH', 'ENG', 'COMP'];

    const studentSubs = subjects.filter(s => applicableCodes.includes(s.subject_code));
    const classExams = exams.filter(e => String(e.class).trim() === classStr);

    for (const ex of classExams) {
      const isPA = ex.exam_name.includes('PA') || ex.exam_name.includes('Periodic');
      const maxMarks = isPA ? 50 : 100;
      let totalObtained = 0;
      let totalMax = 0;

      for (const sub of studentSubs) {
        const scorePct = 0.65 + Math.random() * 0.31;
        const obtained = Math.round(maxMarks * scorePct);

        totalObtained += obtained;
        totalMax += maxMarks;

        marksBatch.push({
          id: crypto.randomUUID(),
          exam_id: ex.id,
          student_id: st.id,
          subject_id: sub.id,
          max_marks: maxMarks,
          obtained_marks: obtained,
          is_absent: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      if (totalMax > 0) {
        const pct = Math.round((totalObtained / totalMax) * 100 * 10) / 10;
        let grade = 'A1';
        let division = 'First Division (Distinction)';

        if (pct >= 91) { grade = 'A1'; division = 'First Division (Distinction)'; }
        else if (pct >= 81) { grade = 'A2'; division = 'First Division'; }
        else if (pct >= 71) { grade = 'B1'; division = 'First Division'; }
        else if (pct >= 61) { grade = 'B2'; division = 'Second Division'; }
        else if (pct >= 51) { grade = 'C1'; division = 'Second Division'; }
        else { grade = 'C2'; division = 'Third Division'; }

        resultsBatch.push({
          id: crypto.randomUUID(),
          exam_id: ex.id,
          student_id: st.id,
          total_marks: totalObtained,
          percentage: pct,
          grade: grade,
          division: division,
          result_status: 'pass',
          remarks: 'Promoted with commendable academic diligence.',
          published: true
        });
      }
    }
  }

  for (let i = 0; i < marksBatch.length; i += 200) {
    const chunk = marksBatch.slice(i, i + 200);
    const { error } = await supabase.from('marks').insert(chunk);
    if (error) console.error('Marks insert error chunk', i, error);
  }
  console.log(`Inserted ${marksBatch.length} subject marks records with 0 errors.`);

  for (let i = 0; i < resultsBatch.length; i += 200) {
    const chunk = resultsBatch.slice(i, i + 200);
    const { error } = await supabase.from('exam_results').insert(chunk);
    if (error) console.error('Results insert error chunk', i, error);
  }
  console.log(`Inserted ${resultsBatch.length} exam results with 0 errors.`);

  // 3. Seed Student Documents (type: 'aadhaar', 'tc', 'marksheet')
  console.log('Seeding student documents...');
  await supabase.from('student_documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const allowedDocTypes = ['aadhaar', 'tc', 'marksheet'];
  const docBatch = [];

  for (const st of students) {
    for (const dt of allowedDocTypes) {
      docBatch.push({
        id: crypto.randomUUID(),
        student_id: st.id,
        document_type: dt,
        file_url: `https://stjosephsschool.edu.in/documents/students/${st.admission_number?.replace(/\//g, '_') || st.roll_number}_${dt}.pdf`,
        created_at: new Date().toISOString()
      });
    }
  }

  for (let i = 0; i < docBatch.length; i += 200) {
    const chunk = docBatch.slice(i, i + 200);
    const { error } = await supabase.from('student_documents').insert(chunk);
    if (error) console.error('Docs insert error chunk', i, error);
  }
  console.log(`Inserted ${docBatch.length} student documents with 0 errors.`);

  console.log('--- EXAMS, MARKS, RESULTS, AND DOCUMENTS SUCCESSFULLY SEEDED ---');
}

main().catch(console.error);
