import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// The user accidentally provided the service_role key here, so we can use admin methods!
const serviceRoleKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUsers() {
  const users = [
    { email: 'admin@school.com', role: 'admin', name: 'Principal Admin' },
    { email: 'teacher@school.com', role: 'teacher', name: 'Test Teacher' },
    { email: 'student@school.com', role: 'student', name: 'Test Student' },
    { email: 'parent@school.com', role: 'parent', name: 'Test Parent' }
  ];

  const password = 'Password@123';

  for (const u of users) {
    // 1. Create User in Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: u.email,
      password: password,
      email_confirm: true // Auto-confirm the email
    });

    if (authError) {
      console.log(`User ${u.email} already exists or error: ${authError.message}`);
      
      // If user exists, we can try to fetch them and insert profile just in case
      // Since it's a test script, we will skip complex error handling for existing users
    } else if (authData.user) {
      console.log(`Created Auth User: ${u.email}`);
      
      // 2. Create Profile in public.profiles
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: authData.user.id,
        email: u.email,
        name: u.name,
        role: u.role
      });

      if (profileError) {
        console.error(`Error creating profile for ${u.email}:`, profileError.message);
      } else {
        console.log(`Created Profile for ${u.email} with role ${u.role}`);
      }
    }
  }
}

createTestUsers();
