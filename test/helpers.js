const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { openDatabase } = require('../src/data/database');
const { seedDemo } = require('../src/data/seed');
const { hashPassword } = require('../src/services/auth');
const { createApp } = require('../src/routes/app');

async function fixture(t, options = {}) {
  const db = openDatabase(':memory:');
  const now = new Date('2026-11-20T12:00:00Z');
  const password = randomBytes(20).toString('hex');
  seedDemo(db, await hashPassword(password), now);
  const app = createApp(db, { clock: () => now, ...options });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  const base = `http://127.0.0.1:${app.address().port}`;
  t.after(async () => { await new Promise(resolve => app.close(resolve)); db.close(); });
  const login = () => fetch(`${base}/api/auth/login`, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'member@example.test', password }) });
  return { db, base, app, password, login };
}
module.exports = { fixture };
