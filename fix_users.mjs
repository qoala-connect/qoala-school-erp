import pkg from 'pg';
const { Client } = pkg;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const password = process.env.SUPABASE_DB_PASSWORD || encodeURIComponent('REDACTED');
const projectRef = 'cqylpqrharentkjmrymr';
const connectionString = `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`;
const pgClient = new Client({ connectionString });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function fixUsers() {
  await pgClient.connect();
  try {
    console.log("Adding 'parent' to app_role enum...");
    await pgClient.query(`ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'parent';`);
  } catch(e) {
    console.log("Enum might already exist or not exist: " + e.message);
  }

  const users = [
    { email: 'admin@school.com', role: 'admin', name: 'Principal Admin' },
    { email: 'teacher@school.com', role: 'teacher', name: 'Test Teacher' },
    { email: 'student@school.com', role: 'student', name: 'Test Student' },
    { email: 'parent@school.com', role: 'parent', name: 'Test Parent' }
  ];

  for (const u of users) {
    // We update the password just to be sure we know what it is
    const { data: { users: authUsers }, error: searchError } = await supabase.auth.admin.listUsers();
    const user = authUsers.find(au => au.email === u.email);
    
    if (user) {
      console.log(`Updating password for ${u.email}...`);
      await supabase.auth.admin.updateUserById(user.id, { password: 'Password@123', email_confirm: true });
      
      // Upsert profile
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        email: u.email,
        name: u.name,
        role: u.role
      });
      if (profileError) console.error("Error upserting profile:", profileError.message);
      else console.log(`Profile linked for ${u.email}`);
    }
  }

  await pgClient.end();
}

fixUsers();
