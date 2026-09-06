// Apply a .sql file to the project database: node scripts/qa/apply_sql.mjs <file.sql>
import fs from 'fs';
import { sql } from './sql.mjs';

const file = process.argv[2];
if (!file) { console.error('usage: apply_sql.mjs <file.sql>'); process.exit(1); }
const text = fs.readFileSync(file, 'utf8');
const out = await sql(text);
console.log('applied:', file);
console.log(JSON.stringify(out, null, 1).slice(0, 2000));
