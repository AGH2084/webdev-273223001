const { Pool } = require('pg');
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
function openPostgres(connectionString, options = {}) {
  const pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 5000, query_timeout: 5000, ...options });
  pool.on('error', () => console.error('Database connection interrupted'));
  return { kind: 'postgres', pool, close: () => pool.end() };
}
async function migratePostgres(db) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(273223001)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)');
    const directory = path.resolve(__dirname, '../../migrations/postgres');
    for (const name of readdirSync(directory).filter(n => /^\d+_.+\.sql$/.test(n)).sort()) {
      if ((await client.query('SELECT name FROM schema_migrations WHERE name=$1', [name])).rowCount) continue;
      await client.query(readFileSync(path.join(directory, name), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
module.exports = { openPostgres, migratePostgres };
