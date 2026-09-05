import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://cqylpqrharentkjmrymr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('--- Finalizing Teacher Faculty Assignments with unique class teachers ---');

  const { data: years } = await supabase.from('academic_years').select('*').order('start_date', { ascending: false });
  const currentYear = years?.find(y => y.is_current) || years?.[0];
  const academicYearId = currentYear.id;

  const [classesRes, sectionsRes, subjectsRes, teachersRes] = await Promise.all([
    supabase.from('classes').select('*').order('display_order'),
    supabase.from('sections').select('*').order('section_name'),
    supabase.from('subjects').select('*').order('subject_name'),
    supabase.from('teachers').select('*').order('name')
  ]);

  const classes = classesRes.data || [];
  const sections = sectionsRes.data || [];
  const subjects = subjectsRes.data || [];
  const teachers = teachersRes.data || [];

  await supabase.from('teacher_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const teacherSubjectClassMap = [
    { nameMatch: 'Anand Kumar Mishra', subjectCode: 'PHY', classNames: ['11', '12'] },
    { nameMatch: 'Sunita Upadhyay', subjectCode: 'CHEM', classNames: ['11', '12'] },
    { nameMatch: 'Virendra Pratap Singh', subjectCode: 'BIO', classNames: ['9', '10', '11', '12'] },
    { nameMatch: 'Rakesh Chandra Pandey', subjectCode: 'MATH', classNames: ['9', '10', '11', '12'] },
    { nameMatch: 'Sandeep Vishwakarma', subjectCode: 'MATH', classNames: ['6', '7', '8'] },
    { nameMatch: 'Pratibha Srivastava', subjectCode: 'ENG', classNames: ['9', '10', '11', '12'] },
    { nameMatch: 'Archana Dubey', subjectCode: 'HIN', classNames: ['6', '7', '8', '9', '10'] },
    { nameMatch: 'Akhilesh Yadav', subjectCode: 'SST', classNames: ['8', '9', '10'] },
    { nameMatch: 'Meenakshi Chaubey', subjectCode: 'SST', classNames: ['6', '7'] },
    { nameMatch: 'Manoj Kumar Tiwari', subjectCode: 'COMP', classNames: ['9', '10', '11', '12'] },
    { nameMatch: 'Santosh Kumar Nishad', subjectCode: 'COMP', classNames: ['6', '7', '8'] },
    { nameMatch: 'Pooja Rai', subjectCode: 'SCI', classNames: ['7', '8'] },
    { nameMatch: 'Durgesh Kumar Patel', subjectCode: 'SCI', classNames: ['6'] },
    { nameMatch: 'Shweta Tripathi', subjectCode: 'SKT', classNames: ['6', '7', '8'] },
    { nameMatch: 'Brijesh Kumar Gupta', subjectCode: 'ACCT', classNames: ['11', '12'] },
    { nameMatch: 'Ritesh Kumar Maurya', subjectCode: 'PED', classNames: ['6', '7', '8', '9', '10', '11', '12'] },
    { nameMatch: 'Garima Singh', subjectCode: 'MATH', classNames: ['3', '4', '5'] },
    { nameMatch: 'Deepa Jaiswal', subjectCode: 'SCI', classNames: ['3', '4', '5'] },
    { nameMatch: 'Priyanka Chaurasia', subjectCode: 'ENG', classNames: ['1', '2', '3', '4', '5'] },
    { nameMatch: 'Rekha Paswan', subjectCode: 'HIN', classNames: ['1', '2', '3', '4', '5'] }
  ];

  const teacherAssignments = [];
  const assignedClassTeachers = new Set();

  for (const rule of teacherSubjectClassMap) {
    const teacher = teachers.find(t => t.name.includes(rule.nameMatch));
    const sub = subjects.find(s => s.subject_code === rule.subjectCode);
    if (!teacher || !sub) continue;

    for (const cName of rule.classNames) {
      const cls = classes.find(c => c.class_name === cName);
      if (!cls) continue;

      for (const sec of sections.slice(0, 2)) {
        const key = `${cls.id}_${sec.id}`;
        let isCT = false;
        if (!assignedClassTeachers.has(key) && (
          (cName === '12' && rule.nameMatch.includes('Anand') && sec.section_name === 'A') ||
          (cName === '11' && rule.nameMatch.includes('Sunita') && sec.section_name === 'A') ||
          (cName === '10' && rule.nameMatch.includes('Rakesh') && sec.section_name === 'A') ||
          (cName === '9' && rule.nameMatch.includes('Pratibha') && sec.section_name === 'A') ||
          (cName === '8' && rule.nameMatch.includes('Akhilesh') && sec.section_name === 'A') ||
          (cName === '7' && rule.nameMatch.includes('Pooja') && sec.section_name === 'A') ||
          (cName === '6' && rule.nameMatch.includes('Archana') && sec.section_name === 'A') ||
          (cName === '5' && rule.nameMatch.includes('Garima') && sec.section_name === 'A') ||
          (cName === '4' && rule.nameMatch.includes('Deepa') && sec.section_name === 'A') ||
          (cName === '3' && rule.nameMatch.includes('Priyanka') && sec.section_name === 'A') ||
          (cName === '2' && rule.nameMatch.includes('Rekha') && sec.section_name === 'A') ||
          (cName === '1' && rule.nameMatch.includes('Priyanka') && sec.section_name === 'A')
        )) {
          isCT = true;
          assignedClassTeachers.add(key);
        }

        teacherAssignments.push({
          teacher_id: teacher.id,
          class_id: cls.id,
          section_id: sec.id,
          subject_id: sub.id,
          academic_year_id: academicYearId,
          assignment_type: isCT ? 'class_teacher' : 'subject_teacher',
          is_active: true,
          created_at: new Date().toISOString()
        });
      }
    }
  }

  const { error: tAssignErr } = await supabase.from('teacher_assignments').insert(teacherAssignments);
  if (tAssignErr) console.error('Teacher assignment error:', tAssignErr);
  else console.log(`Successfully inserted ${teacherAssignments.length} faculty teaching assignments with 0 errors!`);
}

main().catch(err => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
