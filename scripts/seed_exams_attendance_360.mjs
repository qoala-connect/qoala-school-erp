import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://cqylpqrharentkjmrymr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('--- Starting Comprehensive 360 Seeding (Exams, Marks, Attendance, Transport, Medical, Documents) ---');

  // 1. Get Academic Year
  const { data: years } = await supabase.from('academic_years').select('*').order('start_date', { ascending: false });
  const currentYear = years?.find(y => y.is_current) || years?.[0];
  const academicYearId = currentYear.id;
  const academicYearName = currentYear.name || '2026-27';

  // 2. Fetch Classes, Subjects, Teachers, Students
  const [classesRes, subjectsRes, teachersRes, studentsRes] = await Promise.all([
    supabase.from('classes').select('*').order('display_order'),
    supabase.from('subjects').select('*').order('subject_name'),
    supabase.from('teachers').select('*').order('name'),
    supabase.from('students').select('*').order('roll_number')
  ]);

  const classes = classesRes.data || [];
  const subjects = subjectsRes.data || [];
  const teachers = teachersRes.data || [];
  const students = studentsRes.data || [];

  console.log(`Loaded ${classes.length} classes, ${subjects.length} subjects, ${teachers.length} teachers, ${students.length} students.`);

  // 3. Setup Transport Routes and Vehicles
  console.log('Setting up Transport Routes & Vehicles...');
  await supabase.from('student_transport').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('vehicles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('transport_routes').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const routesData = [
    { route_name: 'Route 1: Barhalganj – Gola Bazar', start_point: 'Gola Bazar Chowk', end_point: 'School Campus, Korari', fare_amount: 1400 },
    { route_name: 'Route 2: Barhalganj – Gagaha', start_point: 'Gagaha Bus Stand', end_point: 'School Campus, Korari', fare_amount: 1500 },
    { route_name: 'Route 3: Barhalganj – Dohrighat Bridge', start_point: 'Dohrighat Ghat Road', end_point: 'School Campus, Korari', fare_amount: 1200 },
    { route_name: 'Route 4: Barhalganj – Belghat Deoria Road', start_point: 'Belghat Mode', end_point: 'School Campus, Korari', fare_amount: 1600 },
    { route_name: 'Route 5: Barhalganj Town Express', start_point: 'Barhalganj Main Market', end_point: 'School Campus, Korari', fare_amount: 1000 }
  ];

  const insertedRoutes = [];
  for (const r of routesData) {
    const { data } = await supabase.from('transport_routes').insert({
      ...r,
      school_id: '00000000-0000-0000-0000-000000000000',
      is_active: true
    }).select().single();
    if (data) insertedRoutes.push(data);
  }

  const vehiclesData = [
    { vehicle_number: 'UP-53-BT-1080', vehicle_model: 'Tata Starbus 42-Seater', capacity: 42 },
    { vehicle_number: 'UP-53-BT-2140', vehicle_model: 'Eicher Skyline Pro 36-Seater', capacity: 36 },
    { vehicle_number: 'UP-53-BT-3948', vehicle_model: 'Ashok Leyland Sunshine 40-Seater', capacity: 40 },
    { vehicle_number: 'UP-53-BT-4512', vehicle_model: 'Tata Winger 18-Seater', capacity: 18 },
    { vehicle_number: 'UP-53-BT-5820', vehicle_model: 'Force Traveller 26-Seater', capacity: 26 }
  ];

  const insertedVehicles = [];
  for (const v of vehiclesData) {
    const { data } = await supabase.from('vehicles').insert({
      ...v,
      school_id: '00000000-0000-0000-0000-000000000000',
      is_active: true
    }).select().single();
    if (data) insertedVehicles.push(data);
  }

  // Assign ~40% of students to transport
  const driverNames = ['Sri Ramashankar Yadav', 'Sri Vinod Kumar Sharma', 'Sri Munna Nishad', 'Sri Rajendra Prasad', 'Sri Subhash Maurya'];
  const driverPhones = ['9450881215', '9838123456', '9918765432', '7388112233', '9628998877'];
  const boardingPoints = ['Main Chowk', 'Hospital Mode', 'Post Office Crossing', 'Block Headquarters', 'Police Station Mode', 'Kisan Seva Kendra'];

  const studentTransportBatch = [];
  for (let i = 0; i < students.length; i += 2) {
    const st = students[i];
    const rIdx = i % insertedRoutes.length;
    const vIdx = i % insertedVehicles.length;

    studentTransportBatch.push({
      student_id: st.id,
      route_id: insertedRoutes[rIdx].id,
      vehicle_id: insertedVehicles[vIdx].id,
      route: insertedRoutes[rIdx].route_name,
      boarding_point: boardingPoints[i % boardingPoints.length],
      pickup_point: boardingPoints[i % boardingPoints.length],
      pickup_time: `07:${15 + (i % 3) * 10} AM`,
      driver_name: driverNames[vIdx],
      driver_phone: driverPhones[vIdx]
    });
  }

  await supabase.from('student_transport').insert(studentTransportBatch);
  console.log(`Assigned transport for ${studentTransportBatch.length} students across 5 routes and buses.`);

  // 4. Seed Medical Profiles
  console.log('Seeding Student Medical Profiles...');
  await supabase.from('student_medical').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const bloodGroups = ['A+', 'B+', 'O+', 'AB+', 'A-', 'B-', 'O-'];
  const allergiesList = ['None', 'None', 'None', 'None', 'Dust Allergy (Mild)', 'Peanut Allergy', 'Lactose Intolerant', 'None'];
  const medicalBatch = [];

  for (const st of students) {
    const bg = bloodGroups[Math.floor(Math.random() * bloodGroups.length)];
    const allergy = allergiesList[Math.floor(Math.random() * allergiesList.length)];
    medicalBatch.push({
      student_id: st.id,
      blood_group: bg,
      allergies: allergy,
      medical_history: 'Fit and healthy. Regular physical assessment passed.',
      doctor_name: 'Dr. P.K. Srivastava (MBBS, MD)',
      doctor_phone: '9450882341',
      vaccination_status: 'Fully Immunized (BCG, Polio, MMR, Hepatitis B, Tetanus, COVID-19)',
      emergency_contact_name: st.father_name || 'Father / Guardian',
      emergency_contact_phone: st.phone || '9450881215'
    });
  }

  for (let i = 0; i < medicalBatch.length; i += 100) {
    await supabase.from('student_medical').insert(medicalBatch.slice(i, i + 100));
  }
  console.log(`Seeded ${medicalBatch.length} student medical records.`);

  // 5. Seed Attendance for last 35 days
  console.log('Seeding 35-Day Student Attendance Records...');
  await supabase.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const attendanceDates = [];
  const curr = new Date('2026-09-04');
  while (attendanceDates.length < 30) {
    curr.setDate(curr.getDate() - 1);
    const day = curr.getDay();
    if (day !== 0) { // Exclude Sundays
      attendanceDates.push(curr.toISOString().split('T')[0]);
    }
  }

  const attendanceBatch = [];
  for (const st of students) {
    for (const d of attendanceDates) {
      const rand = Math.random();
      let status = 'present';
      let remarks = null;
      if (rand < 0.88) {
        status = 'present';
      } else if (rand < 0.94) {
        status = 'late';
        remarks = 'Late arrival due to heavy traffic at Barhalganj Bridge';
      } else if (rand < 0.98) {
        status = 'absent';
        remarks = 'Informed absence due to illness';
      } else {
        status = 'leave';
        remarks = 'Sanctioned family function leave';
      }

      attendanceBatch.push({
        student_id: st.id,
        attendance_date: d,
        status: status,
        class: st.class,
        section: st.section || 'A',
        academic_year_id: academicYearId,
        remarks: remarks
      });
    }
  }

  for (let i = 0; i < attendanceBatch.length; i += 300) {
    await supabase.from('attendance').insert(attendanceBatch.slice(i, i + 300));
  }
  console.log(`Inserted ${attendanceBatch.length} attendance records across 30 school days.`);

  // 6. Seed Exams, Marks, and Exam Results
  console.log('Seeding CBSE Exams, Subject Marks, and Exam Results...');
  await supabase.from('marks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('exam_results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('exams').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const examNames = [
    { name: 'Periodic Assessment 1 (PA-1)', maxPerSub: 50 },
    { name: 'Mid-Term Examination (Half Yearly)', maxPerSub: 100 }
  ];

  const examsList = [];
  for (const cls of classes) {
    for (const en of examNames) {
      const { data: ex } = await supabase.from('exams').insert({
        exam_name: en.name,
        class: cls.class_name,
        class_id: cls.id,
        academic_year: academicYearName,
        academic_year_id: academicYearId
      }).select().single();
      if (ex) examsList.push({ ...ex, maxPerSub: en.maxPerSub });
    }
  }

  const marksBatch = [];
  const resultsBatch = [];

  for (const st of students) {
    const classNum = parseInt(st.class) || 5;
    const cls = classes.find(c => c.class_name === String(st.class));
    if (!cls) continue;

    // Get subjects for this class
    let applicableCodes = [];
    if (classNum <= 5) applicableCodes = ['MATH', 'SCI', 'ENG', 'HIN', 'SST', 'COMP'];
    else if (classNum <= 8) applicableCodes = ['MATH', 'SCI', 'ENG', 'HIN', 'SST', 'COMP', 'SKT'];
    else if (classNum <= 10) applicableCodes = ['MATH', 'SCI', 'ENG', 'HIN', 'SST', 'COMP'];
    else applicableCodes = ['PHY', 'CHEM', 'BIO', 'MATH', 'ENG', 'COMP'];

    const studentSubs = subjects.filter(s => applicableCodes.includes(s.subject_code));
    const classExams = examsList.filter(e => e.class === st.class);

    for (const ex of classExams) {
      let totalObtained = 0;
      let totalMax = 0;

      for (const sub of studentSubs) {
        const maxMarks = ex.maxPerSub;
        // Generate realistic marks between 65% and 96%
        const scorePct = 0.65 + Math.random() * 0.31;
        const obtained = Math.round(maxMarks * scorePct);

        totalObtained += obtained;
        totalMax += maxMarks;

        marksBatch.push({
          exam_id: ex.id,
          student_id: st.id,
          subject_id: sub.id,
          max_marks: maxMarks,
          obtained_marks: obtained,
          is_absent: false
        });
      }

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
        exam_id: ex.id,
        student_id: st.id,
        total_marks: totalObtained,
        percentage: pct,
        grade: grade,
        division: division,
        result_status: 'Pass',
        remarks: 'Promoted with commendable academic diligence.',
        published: true
      });
    }
  }

  for (let i = 0; i < marksBatch.length; i += 300) {
    await supabase.from('marks').insert(marksBatch.slice(i, i + 300));
  }
  console.log(`Inserted ${marksBatch.length} subject marks records.`);

  for (let i = 0; i < resultsBatch.length; i += 200) {
    await supabase.from('exam_results').insert(resultsBatch.slice(i, i + 200));
  }
  console.log(`Inserted ${resultsBatch.length} aggregated exam results.`);

  // 7. Seed Student Documents & Activity Notes
  console.log('Seeding Student Documents & Activity Logs...');
  await supabase.from('student_documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('student_notes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('student_activity').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const docTypes = ['Birth Certificate', 'Transfer Certificate (TC)', 'Previous Academic Marksheet', 'Aadhar Card Verification', 'Caste Certificate'];
  const docBatch = [];
  const noteBatch = [];
  const actBatch = [];

  for (const st of students) {
    // 3 verified documents per student
    for (let j = 0; j < 3; j++) {
      docBatch.push({
        student_id: st.id,
        document_type: docTypes[j],
        file_url: `https://stjosephsschool.edu.in/documents/students/${st.admission_number || st.roll_number}_doc_${j + 1}.pdf`
      });
    }

    // 1-2 staff notes
    noteBatch.push({
      student_id: st.id,
      note: `Student is performing well in scholastic activities. Active participant in morning assembly and classroom discussions.`,
      created_by: 'Class Teacher / Academic Coordinator'
    });

    // 2-3 activity logs
    actBatch.push({
      student_id: st.id,
      activity_type: 'Admission Confirmed',
      description: `Official CBSE admission registration completed for Session ${academicYearName}.`,
      performed_by: 'Admissions Office'
    });
    actBatch.push({
      student_id: st.id,
      activity_type: 'Fee Paid',
      description: `First installment fee ledger paid and formal receipt generated.`,
      performed_by: 'Accounts Counter'
    });
    actBatch.push({
      student_id: st.id,
      activity_type: 'Exam Marks Published',
      description: `Mid-Term Examination scorecards published to Student Portal.`,
      performed_by: 'Examination Cell'
    });
  }

  for (let i = 0; i < docBatch.length; i += 200) {
    await supabase.from('student_documents').insert(docBatch.slice(i, i + 200));
  }
  for (let i = 0; i < noteBatch.length; i += 200) {
    await supabase.from('student_notes').insert(noteBatch.slice(i, i + 200));
  }
  for (let i = 0; i < actBatch.length; i += 200) {
    await supabase.from('student_activity').insert(actBatch.slice(i, i + 200));
  }

  console.log(`Seeded ${docBatch.length} documents, ${noteBatch.length} staff notes, and ${actBatch.length} student activity logs.`);
  console.log('--- ALL STUDENT 360 PROFILES 100% COMPLETE & SYNCHRONIZED ---');
}

main().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
