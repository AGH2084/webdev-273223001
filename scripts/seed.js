const { randomBytes } = require('node:crypto');
const { openPostgres } = require('../src/data/postgres');
const { configuration } = require('../src/config');
const { seedPostgres, rotatePostgresPassword } = require('../src/data/postgres-seed');
const { hashPassword } = require('../src/services/auth');

(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is for local development only.');
  const db = openPostgres(configuration().databaseUrl);
  try {
    const password = randomBytes(18).toString('base64url');
    const hash = await hashPassword(password);
    if (process.argv.includes('--rotate-demo-password')) {
      await rotatePostgresPassword(db, hash);
    } else if (!await seedPostgres(db, hash)) {
      console.log('Existing data left unchanged. To generate a new local demo password: npm run seed -- --rotate-demo-password');
      return;
    }
    console.log('Local demo accounts: member@example.test and organiser@example.test');
    console.log('Generated demo password (shown once; never committed):', password);
    console.log('Keep this in your password manager. These are fictional local accounts only.');
  } finally { await db.close(); }
})().catch(error => { console.error('Demo seed failed. Check database setup and local development configuration.'); process.exitCode = 1; });
