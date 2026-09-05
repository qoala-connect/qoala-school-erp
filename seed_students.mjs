import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const firstNames = ["Aarav", "Vihaan", "Aditya", "Sai", "Arjun", "Diya", "Isha", "Riya", "Ananya", "Kavya"];
const lastNames = ["Sharma", "Verma", "Gupta", "Patel", "Singh", "Kumar", "Rao", "Das", "Reddy", "Nair"];
const classes = ["Class 8", "Class 9", "Class 10", "Class 11", "Class 12"];
const sections = ["A", "B"];
const genders = ["male", "female"];

async function seedStudents() {
  console.log("Seeding 10 test students into the database...");
  
  const studentsToInsert = [];
  
  for (let i = 0; i < 10; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[i % lastNames.length];
    const cls = classes[i % classes.length];
    
    studentsToInsert.push({
      admission_number: `ADM-2026-${1000 + i}`,
      roll_number: `${i + 1}`,
      name: `${fn} ${ln}`,
      father_name: `Mr. ${ln}`,
      mother_name: `Mrs. ${ln}`,
      date_of_birth: `2010-05-${(i + 1).toString().padStart(2, '0')}`,
      gender: genders[i % 2],
      class: cls,
      section: sections[i % 2],
      academic_year: "2026-2027",
      phone: `987654321${i}`,
      category: i % 3 === 0 ? "OBC" : "General", // Using our new CBSE field!
    });
  }

  const { data, error } = await supabase.from('students').insert(studentsToInsert).select();
  
  if (error) {
    console.error("Error inserting students:", error.message);
  } else {
    console.log(`Successfully inserted ${data.length} students!`);
    
    // Let's also insert some fake attendance for them so the UI looks alive
    const attendanceRecords = [];
    for (const student of data) {
      attendanceRecords.push({
        student_id: student.id,
        attendance_date: new Date().toISOString().split('T')[0],
        status: Math.random() > 0.2 ? 'present' : 'absent'
      });
    }
    await supabase.from('attendance').insert(attendanceRecords);
    console.log("Added today's attendance for the new students.");
  }
}

seedStudents();
