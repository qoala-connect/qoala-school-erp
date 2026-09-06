import { admin } from './_client.mjs';
import fs from 'fs';
const sb = admin();
// use pg via supabase rest? fallback: query information_schema through a view is not exposed. Use rpc if exists.
const { data, error } = await sb.rpc('exec_sql', { sql: 'select 1' });
console.log('rpc exec_sql:', error ? error.message : JSON.stringify(data));
