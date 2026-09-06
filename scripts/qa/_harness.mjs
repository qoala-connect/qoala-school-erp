// Shared QA harness: real Supabase sessions (anon key + password login) so every
// write goes through the exact RLS path the browser UI uses.
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();

export const URL = process.env.VITE_SUPABASE_URL;
export const ANON = process.env.VITE_SUPABASE_ANON_KEY;
export const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const svc = () =>
  createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const sessionCache = new Map();
export async function login(email, password = 'Password@123') {
  if (sessionCache.has(email)) return sessionCache.get(email);
  const sb = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login(${email}): ${error.message}`);
  const out = { sb, user: data.user };
  sessionCache.set(email, out);
  return out;
}
export const asAdmin = () => login('admin@school.com');

// ---------------------------------------------------------------- results
const results = [];
let currentModule = 'unknown';
export function module(name) { currentModule = name; }

export async function check(page, action, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ module: currentModule, page, action, status: 'PASS', detail: detail || '', ms: Date.now() - started });
    console.log(`  PASS  ${page} :: ${action}${detail ? ' — ' + detail : ''}`);
    return true;
  } catch (e) {
    const msg = (e && e.message) || String(e);
    results.push({ module: currentModule, page, action, status: 'FAIL', detail: msg, ms: Date.now() - started });
    console.log(`  FAIL  ${page} :: ${action} — ${msg}`);
    return false;
  }
}

export function ok(res, what) {
  if (res && res.error) throw new Error(`${what}: [${res.error.code || '-'}] ${res.error.message}`);
  return res ? res.data : undefined;
}
export function assert(cond, msg) { if (!cond) throw new Error(msg); }

export function report(file) {
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\n===== ${pass} passed, ${fail} failed, ${results.length} total =====`);
  if (fail) {
    console.log('\nFAILURES:');
    for (const r of results.filter((x) => x.status === 'FAIL')) {
      console.log(`  [${r.module}] ${r.page} :: ${r.action}\n      ${r.detail}`);
    }
  }
  if (file) {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString(), pass, fail, results }, null, 2));
    console.log(`\nreport -> ${file}`);
  }
  return { pass, fail };
}

// ---------------------------------------------------------------- fixtures
export const TAG = 'QA_AUTOTEST';
export const uniq = (p) => `${TAG}_${p}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

// Cleanup registry: [table, id]
const trash = [];
export function trashIt(table, id) { if (id) trash.push([table, id]); }
export async function cleanup() {
  const s = svc();
  for (const [table, id] of trash.reverse()) {
    const { error } = await s.from(table).delete().eq('id', id);
    if (error) console.log(`  (cleanup warn) ${table}/${id}: ${error.message}`);
  }
  trash.length = 0;
}

// Common reference data pulled once
let refCache = null;
export async function refs() {
  if (refCache) return refCache;
  const s = svc();
  const [ay, cls, sec, sub, tch, stu] = await Promise.all([
    s.from('academic_years').select('id,name,is_current').order('start_date', { ascending: false }),
    s.from('classes').select('id,class_name,display_order').order('display_order'),
    s.from('sections').select('id,section_name').order('section_name'),
    s.from('subjects').select('id,subject_name,subject_code').limit(50),
    s.from('teachers').select('id,name,user_id').limit(50),
    s.from('students').select('id,name,class,section,class_id,section_id,academic_year_id').limit(50),
  ]);
  refCache = {
    years: ay.data || [],
    currentYear: (ay.data || []).find((y) => y.is_current) || (ay.data || [])[0],
    classes: cls.data || [],
    sections: sec.data || [],
    subjects: sub.data || [],
    teachers: tch.data || [],
    students: stu.data || [],
  };
  return refCache;
}
