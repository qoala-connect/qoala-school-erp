// QA runner: node scripts/qa/run.mjs [moduleName ...]
import { report, cleanup } from './_harness.mjs';

const MODULES = {
  admissions: () => import('./t_admissions.mjs'),
  students: () => import('./t_students.mjs'),
  academics: () => import('./t_academics.mjs'),
  examination: () => import('./t_examination.mjs'),
  fees: () => import('./t_fees.mjs'),
  staff: () => import('./t_staff.mjs'),
  attendance: () => import('./t_attendance.mjs'),
  operations: () => import('./t_operations.mjs'),
  library: () => import('./t_library.mjs'),
  transport: () => import('./t_transport.mjs'),
  system: () => import('./t_system.mjs'),
};

const want = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const names = want.length ? want : Object.keys(MODULES);

for (const n of names) {
  if (!MODULES[n]) { console.log(`(skip unknown module ${n})`); continue; }
  console.log(`\n### ${n.toUpperCase()}`);
  try {
    const m = await MODULES[n]();
    await m.default();
  } catch (e) {
    console.log(`  MODULE CRASH ${n}: ${e.stack || e.message}`);
  }
}

await cleanup();
const { fail } = report(`scripts/out/qa-${names.join('-').slice(0, 40)}.json`);
process.exit(fail ? 1 : 0);
