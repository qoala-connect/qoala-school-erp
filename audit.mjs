import pkg from 'pg';
const { Client } = pkg;

const password = process.env.SUPABASE_DB_PASSWORD || encodeURIComponent('REDACTED');
const projectRef = 'cqylpqrharentkjmrymr';
const connectionString = `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`;

const client = new Client({ connectionString });

async function auditDatabase() {
  await client.connect();

  console.log("=== SUPABASE PRODUCTION READINESS AUDIT ===");

  try {
    // 1. Check Row Level Security (RLS)
    const rlsQuery = `
      SELECT relname, relrowsecurity 
      FROM pg_class 
      JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace 
      WHERE nspname = 'public' AND relkind = 'r';
    `;
    const rlsRes = await client.query(rlsQuery);
    const tablesWithoutRLS = rlsRes.rows.filter(r => !r.relrowsecurity).map(r => r.relname);
    
    console.log("\n[RLS Audit]");
    if (tablesWithoutRLS.length === 0) {
      console.log("✅ All public tables have Row Level Security enabled.");
    } else {
      console.log("❌ WARNING: The following tables do NOT have RLS enabled (Major Security Risk):");
      console.log(tablesWithoutRLS.join(', '));
    }

    // 2. Check Missing Foreign Key Indexes
    const fkIndexQuery = `
      SELECT c.conrelid::regclass AS table_name, c.conname AS fk_name, a.attname AS column_name
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
    
    console.log("\n[Index Audit]");
    if (fkRes.rows.length === 0) {
      console.log("✅ All foreign keys are properly indexed for high performance.");
    } else {
      console.log("⚠️ WARNING: The following foreign keys lack indexes, which will cause slow joins at scale:");
      fkRes.rows.forEach(r => console.log(`- Table: ${r.table_name}, Column: ${r.column_name}`));
    }

    // 3. Check for updated_at triggers
    const triggerQuery = `
      SELECT event_object_table as table_name
      FROM information_schema.triggers
      WHERE trigger_schema = 'public' AND trigger_name LIKE '%update%';
    `;
    const triggerRes = await client.query(triggerQuery);
    const tablesWithTriggers = triggerRes.rows.map(r => r.table_name);
    const allTables = rlsRes.rows.map(r => r.relname);
    const missingTriggers = allTables.filter(t => !tablesWithTriggers.includes(t));
    
    console.log("\n[Trigger Audit (updated_at)]");
    if (missingTriggers.length === 0) {
      console.log("✅ All tables automatically track updates via triggers.");
    } else {
      console.log("⚠️ Info: Some tables don't have automatic 'updated_at' triggers configured:");
      console.log(missingTriggers.slice(0, 10).join(', ') + (missingTriggers.length > 10 ? ' ...' : ''));
    }

  } catch (err) {
    console.error("Audit error:", err.message);
  } finally {
    await client.end();
  }
}

auditDatabase();
