/**
 * Migration runner.
 *
 * Usage:  node run_sql_migration.mjs <file.sql> [<file.sql> ...]
 *
 * Applies SQL through the Supabase Management API, which needs only a
 * personal access token. This replaced the direct Postgres connection
 * that earlier scripts used, because the database password those scripts
 * hardcoded has since been rotated (correctly).
 *
 * Credentials, in order of preference:
 *   SUPABASE_ACCESS_TOKEN   personal access token (sbp_...)
 *   SUPABASE_PROJECT_REF    project ref, defaults to the one in .env
 *   DATABASE_URL            falls back to a direct Postgres connection
 */
import fs from 'fs';
import pkg from 'pg';

const { Client } = pkg;

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node run_sql_migration.mjs <file.sql> [...]');
  process.exit(1);
}

function projectRef() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF;
  const env = fs.readFileSync('.env', 'utf8');
  const url = env.match(/^VITE_SUPABASE_URL=(.*)$/m)?.[1]?.trim() ?? '';
  return url.replace('https://', '').replace('.supabase.co', '');
}

async function applyViaManagementApi(token, sql, file) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef()}/database/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    }
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${body.slice(0, 500)}`);
  return body;
}

async function applyViaPostgres(sql) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  client.on('notice', m => console.log('   notice: ' + m.message));
  await client.connect();
  try { await client.query(sql); } finally { await client.end(); }
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token && !process.env.DATABASE_URL) {
  console.error(
    'No credentials. Set SUPABASE_ACCESS_TOKEN (a sbp_ personal access\n' +
    'token from https://supabase.com/dashboard/account/tokens), or set\n' +
    'DATABASE_URL to a direct Postgres connection string.'
  );
  process.exit(1);
}

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error(`SKIP  ${file} (not found)`);
    process.exitCode = 1;
    continue;
  }
  process.stdout.write(`applying ${file} ... `);
  const sql = fs.readFileSync(file, 'utf8');
  try {
    let out;
    if (token) out = await applyViaManagementApi(token, sql, file);
    else await applyViaPostgres(sql);
    console.log('ok');
    // Print any rows the statement returned, so this doubles as a query tool.
    if (out && out !== '[]') console.log(out.slice(0, 4000));
  } catch (err) {
    console.log('FAILED');
    console.error(`   ${err.message}`);
    process.exit(1);
  }
}

console.log('\ndone');
