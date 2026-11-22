const { openPostgres } = require('../src/data/postgres');
const { repository } = require('../src/data/repository');
const { configuration } = require('../src/config');
(async () => {
  if (process.argv[2] !== 'list') throw new Error('Usage: npm run db -- list');
  const db = openPostgres(configuration().databaseUrl);
  try { console.table(await repository(db).upcoming(new Date().toISOString())); }
  finally { await db.close(); }
})().catch(() => { console.error('Database inspection failed. Check configuration and database connectivity.'); process.exitCode = 1; });
