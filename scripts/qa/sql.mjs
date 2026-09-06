// SQL runner via Supabase Management API (QA harness only)
import dotenv from 'dotenv';
dotenv.config();

const REF = process.env.SUPABASE_PROJECT_REF || 'cqylpqrharentkjmrymr';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

export async function sql(query) {
  if (!TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN missing in env/.env');
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`SQL ${r.status}: ${t.slice(0, 2000)}`);
  try { return JSON.parse(t); } catch { return t; }
}

if (process.argv[2]) {
  const arg = process.argv[2];
  const q = arg === '-'
    ? await new Promise((res) => { let d = ''; process.stdin.on('data', (c) => (d += c)); process.stdin.on('end', () => res(d)); })
    : arg;
  console.log(JSON.stringify(await sql(q), null, 1));
}
