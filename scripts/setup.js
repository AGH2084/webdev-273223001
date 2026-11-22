const { configuration } = require('../src/config');
const { openPostgres, migratePostgres } = require('../src/data/postgres');
(async () => {
  const db = openPostgres(configuration().databaseUrl);
  try { await migratePostgres(db); console.log('PostgreSQL migrations applied. No seed ran.'); }
  finally { await db.close(); }
})().catch(() => { console.error('Migration failed. Check DATABASE_URL and PostgreSQL access; credentials are not logged.'); process.exitCode = 1; });
