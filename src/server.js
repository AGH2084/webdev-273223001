const { configuration } = require('./config');
const { openPostgres } = require('./data/postgres');
const { createApp } = require('./routes/app');
let db;
try {
  const config = configuration();
  db = openPostgres(config.databaseUrl);
  const app = createApp(db, { secureCookies: config.secureCookies });
  app.listen(config.port, '0.0.0.0', () => console.log(`Club Calendar listening on port ${config.port}`));
  const shutdown = () => app.close(async () => { await db.close(); process.exit(0); });
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
} catch (error) { console.error(error.message); process.exitCode = 1; }
