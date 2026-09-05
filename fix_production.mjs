import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';

const password = process.env.SUPABASE_DB_PASSWORD || encodeURIComponent('REDACTED');
const projectRef = 'cqylpqrharentkjmrymr';
const connectionString = `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`;

const client = new Client({ connectionString });

async function fixDatabase() {
  await client.connect();
  console.log("Connected to Supabase. Applying Production Optimization Patch...");

  try {
    // 1. Fix the missing RLS on temp tables
    await client.query(`
      ALTER TABLE IF EXISTS public.temp_inspect_results ENABLE ROW LEVEL SECURITY;
    `);
    console.log("✅ Secured unprotected tables.");

    // 2. Fix the missing Foreign Key Indexes dynamically
    const fkIndexQuery = `
      SELECT c.conrelid::regclass AS table_name, a.attname AS column_name
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.contype = 'f' 
        AND NOT EXISTS (
          SELECT 1 FROM pg_index i 
          WHERE i.indrelid = c.conrelid AND a.attnum = ANY(i.indkey)
        )
        AND c.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
    `;
    const fkRes = await client.query(fkIndexQuery);
    
    let indexCount = 0;
    for (const row of fkRes.rows) {
      // Create a safe index name
      const tableName = row.table_name.toString().replace(/"/g, '');
      const colName = row.column_name.toString().replace(/"/g, '');
      const indexName = `idx_${tableName}_${colName}`.substring(0, 63); // Max length for pg ident
      
      const createIdx = `CREATE INDEX IF NOT EXISTS ${indexName} ON public.${tableName} (${colName});`;
      await client.query(createIdx);
      indexCount++;
    }
    console.log(`✅ Automatically generated and applied ${indexCount} high-performance indexes.`);

    // 3. Fix missing 'updated_at' triggers
    // Make sure the function exists first
    await client.query(`
      CREATE OR REPLACE FUNCTION public.update_modified_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = now();
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // List of tables known to miss the trigger
    const tablesNeedingTriggers = [
      'students', 'teachers', 'notices', 'student_documents', 
      'gallery', 'parents', 'class_fee_structure'
    ];

    let triggerCount = 0;
    for (const table of tablesNeedingTriggers) {
      // Check if table exists
      const tableCheck = await client.query(`SELECT to_regclass('public.${table}') as exists`);
      if (tableCheck.rows[0].exists) {
        // Drop it if it exists to replace it cleanly
        await client.query(`DROP TRIGGER IF EXISTS trigger_update_${table} ON public.${table};`);
        // Check if table actually has an updated_at column
        const colCheck = await client.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name='${table}' AND column_name='updated_at'
        `);
        if (colCheck.rows.length > 0) {
          await client.query(`
            CREATE TRIGGER trigger_update_${table}
            BEFORE UPDATE ON public.${table}
            FOR EACH ROW
            EXECUTE FUNCTION public.update_modified_column();
          `);
          triggerCount++;
        }
      }
    }
    console.log(`✅ Deployed ${triggerCount} automated timestamp triggers.`);

  } catch (err) {
    console.error("❌ Error applying fix:", err.message);
  } finally {
    await client.end();
  }
}

fixDatabase();
