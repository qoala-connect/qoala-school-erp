import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  console.log('Fixing permissions on auth functions and admissions RLS...');
  
  // Grant execute permissions on helper functions to public / anon / authenticated
  const sqlCommands = `
    GRANT EXECUTE ON FUNCTION public.auth_has_permission(text) TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION public.account_is_active() TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon, authenticated, service_role;
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlCommands });
    console.log('Direct RPC result:', { data, error });
  } catch (err) {
    console.log('RPC execution catch:', err);
  }
}

main();
