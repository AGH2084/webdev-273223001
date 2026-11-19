const { randomBytes } = require('node:crypto');
const { openDatabase } = require('../src/data/database');
const { seedDemo, rotateDemoPassword } = require('../src/data/seed');
const { hashPassword } = require('../src/services/auth');

(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is for local development only.');
  const db = openDatabase();
  try {
    const password = randomBytes(18).toString('base64url');
    const hash = await hashPassword(password);
    if (process.argv.includes('--rotate-demo-password')) {
      rotateDemoPassword(db, hash);
    } else if (!seedDemo(db, hash)) {
      console.log('Existing data left unchanged. To generate a new local demo password: npm run seed -- --rotate-demo-password');
      return;
    }
    console.log('Local demo accounts: member@example.test and organiser@example.test');
    console.log('Generated demo password (shown once; never committed):', password);
    console.log('Keep this in your password manager. These are fictional local accounts only.');
  } finally { db.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
