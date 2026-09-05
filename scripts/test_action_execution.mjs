import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://cqylpqrharentkjmrymr.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function testActionExecution() {
  console.log('Testing Write Action: Creating Notice...');
  const testTitle = `AI Assistant Upgrade Notice ${Date.now()}`;
  const testDesc = 'School ERP Google Gemini AI Copilot enterprise upgrade successfully activated.';

  const { data: notice, error } = await supabase
    .from('notices')
    .insert([{
      title: testTitle,
      description: testDesc,
      created_at: new Date().toISOString()
    }])
    .select()
    .single();

  if (error) throw error;
  console.log(' ✔ Notice created successfully in database:', notice.id, notice.title);

  // Clean up test notice
  await supabase.from('notices').delete().eq('id', notice.id);
  console.log(' ✔ Cleaned up test notice.');
  console.log('=== ACTION EXECUTION VERIFIED ===');
}

testActionExecution().catch(err => {
  console.error('Action execution failed:', err);
  process.exit(1);
});
