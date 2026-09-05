import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';

// Use the password provided and construct the direct connection URL
const password = process.env.SUPABASE_DB_PASSWORD || encodeURIComponent('REDACTED');
const projectRef = 'cqylpqrharentkjmrymr';
const connectionString = `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`;

const client = new Client({
  connectionString: connectionString,
});

async function runMigration() {
  try {
    await client.connect();
    console.log("Successfully connected to the PostgreSQL database.");

    const sql = fs.readFileSync('supabase_cbse_compliance_migration.sql', 'utf8');
    
    console.log("Executing migration SQL...");
    await client.query(sql);
    
    console.log("Migration executed successfully!");
  } catch (err) {
    console.error("Error executing migration:", err.message);
  } finally {
    await client.end();
  }
}

runMigration();
