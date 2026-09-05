import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
  const { error } = await supabase.from('academic_years').select('id').limit(1);
  if (error) {
    console.log("Enterprise Migration NOT applied yet. Error:", error.message);
  } else {
    console.log("Enterprise Migration IS applied!");
  }
}

checkDb();
