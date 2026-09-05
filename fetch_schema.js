import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://cqylpqrharentkjmrymr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxeWxwcXJoYXJlbnRram1yeW1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgwNjY1MSwiZXhwIjoyMDg2MzgyNjUxfQ.sw9db3dZ0sC0wMOJJ0Zgxkts26IlBY_tHR85yon2l0Q'
)

async function run() {
  const { data: fees } = await supabase.from('student_fees').select('*').limit(1)
  console.log('student_fees:', fees)
  const { data: cats } = await supabase.from('fee_categories').select('*').limit(1)
  console.log('fee_categories:', cats)
  const { data: payments } = await supabase.from('fee_payments').select('*').limit(1)
  console.log('fee_payments:', payments)
}

run()
