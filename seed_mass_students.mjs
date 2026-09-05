import pkg from 'pg';
const { Client } = pkg;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const password = process.env.SUPABASE_DB_PASSWORD || encodeURIComponent('REDACTED');
const projectRef = 'cqylpqrharentkjmrymr';
const connectionString = `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`;
const pgClient = new Client({ connectionString });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const firstNames = ["Aarav", "Vihaan", "Aditya", "Sai", "Arjun", "Diya", "Isha", "Riya", "Ananya", "Kavya", "Rahul", "Sneha", "Karan", "Pooja"];
const lastNames = ["Sharma", "Verma", "Gupta", "Patel", "Singh", "Kumar", "Rao", "Das", "Reddy", "Nair", "Joshi", "Chawla", "Bose", "Iyer"];
const sections = ["A", "B"];
const genders = ["male", "female"];

async function resetAndSeed() {
  await pgClient.connect();
  console.log("Truncating students to ensure clean slate...");
  // CASCADE will wipe attendance, marks, fees tied to students
  await pgClient.query(`TRUNCATE TABLE public.students CASCADE;`);
  
  const classes = ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"];
  console.log(`Seeding exactly 10 students into EACH of the 12 classes...`);
  
  const studentsToInsert = [];
  let counter = 0;

  for (const cls of classes) {
    for (let i = 0; i < 10; i++) {
      counter++;
      const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
      const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
      
      studentsToInsert.push({
        admission_number: `ADM-2026-X${counter.toString().padStart(4, '0')}`,
        roll_number: `${i + 1}`,
        name: `${fn} ${ln}`,
        father_name: `Mr. ${ln}`,
        mother_name: `Mrs. ${ln}`,
        date_of_birth: `2010-${Math.floor(Math.random() * 12 + 1).toString().padStart(2, '0')}-${Math.floor(Math.random() * 28 + 1).toString().padStart(2, '0')}`,
        gender: genders[Math.floor(Math.random() * genders.length)],
        class: cls,
        section: sections[Math.floor(Math.random() * sections.length)],
        academic_year: "2026-2027",
        phone: `98765${Math.floor(10000 + Math.random() * 90000)}`,
        category: Math.random() > 0.7 ? "OBC" : "General",
      });
    }
  }

  for (let i = 0; i < studentsToInsert.length; i += 50) {
    const batch = studentsToInsert.slice(i, i + 50);
    await supabase.from('students').insert(batch);
  }
  
  console.log("Successfully seeded exactly 120 students!");
  await pgClient.end();
}

resetAndSeed();
