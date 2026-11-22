const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers');

test('AC-21 health checks the database and returns a safe 503 when it cannot answer', async t => {
  const { base, db } = await fixture(t);
  const healthy = await fetch(`${base}/health`);
  assert.equal(healthy.status, 200); assert.deepEqual(await healthy.json(), { status: 'ok', db: 'ok' });
  const prepare = db.prepare.bind(db);
  db.prepare = sql => { if (sql === 'SELECT 1 AS ok') throw new Error('private connection details'); return prepare(sql); };
  const unhealthy = await fetch(`${base}/health`);
  assert.equal(unhealthy.status, 503); assert.deepEqual(await unhealthy.json(), { status: 'error', db: 'down' });
  db.prepare = prepare;
});

test('AC-22 missing pages and malformed authenticated requests return readable errors without stack traces', async t => {
  const { base, login } = await fixture(t);
  const missing = await fetch(`${base}/no-such-page`);
  assert.equal(missing.status, 404); assert.equal((await missing.json()).error, 'NotFound');
  const cookie = (await login()).headers.get('set-cookie').split(';')[0];
  const malformed = await fetch(`${base}/api/events`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{"title":' });
  assert.equal(malformed.status, 400); assert.deepEqual(await malformed.json(), { error: 'InvalidJson', message: 'Send a valid JSON object.' });
});


test('AC-22 internal database failure returns 500 without exposing diagnostic data', async t => {
  const { base, db, login } = await fixture(t);
  const cookie = (await login()).headers.get('set-cookie').split(';')[0];
  const prepare = db.prepare.bind(db); const originalError = console.error; const logged = [];
  console.error = (...args) => logged.push(args.join(' '));
  db.prepare = sql => { if (sql.includes('LEFT JOIN registrations')) throw new Error('private database credential'); return prepare(sql); };
  try {
    const response = await fetch(`${base}/api/events`, { headers: { Cookie: cookie } });
    assert.equal(response.status, 500);
    const text = await response.text(); assert.match(text, /We could not complete/); assert.doesNotMatch(text, /private|\.js|stack/);
    assert.equal(logged.length, 1); assert.doesNotMatch(logged[0], /private database credential/);
  } finally { db.prepare = prepare; console.error = originalError; }
});
