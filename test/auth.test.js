const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { openDatabase } = require('../src/data/database');
const { seedDemo } = require('../src/data/seed');
const { repository } = require('../src/data/repository');
const { authService, hashPassword, verifyPassword, digest } = require('../src/services/auth');
const { eventsService } = require('../src/services/events');

test('AC-1 event service uses the current time and a public data shape', async () => {
  let instant;
  const service = eventsService({ upcoming(now) { instant = now; return [{ id: 1, title: 'Meetup',
    description: 'An event', starts_at: '2099-01-01T12:00:00.000Z', venue: 'Club room', club: 'Club', capacity: 1, registered: 2 }]; } },
  { requireUser() { return { id: 1 }; } });
  const result = (await service.list('test-token'));
  assert.ok(Number.isFinite(Date.parse(instant)));
  assert.equal(result.events[0].freePlaces, 0);
  assert.equal(result.events[0].registered, undefined);
});

test('AC-13 salted passwords, invalid credentials and hashed session storage', async () => {
  const db = openDatabase(':memory:');
  try {
    const password = randomBytes(20).toString('hex');
    const hash = await hashPassword(password);
    assert.notEqual(hash, await hashPassword(password));
    assert.equal(hash.includes(password), false);
    assert.equal(await verifyPassword(password, hash), true);
    assert.equal(await verifyPassword(password, 'broken-hash'), false);
    seedDemo(db, hash);
    const auth = authService(repository(db));
    for (const email of ['missing@example.test', 'member@example.test']) {
      await assert.rejects(async () => auth.login(email, 'wrong'), { code: 'InvalidCredentials' });
    }
    await assert.rejects(async () => auth.login(null, password), { code: 'InvalidInput' });
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
    const result = await auth.login(' MEMBER@example.test ', password);
    assert.equal(result.user.id, 1);
    assert.equal(result.user.password_hash, undefined);
    const row = db.prepare('SELECT * FROM sessions').get();
    assert.equal(row.token_hash, digest(result.token));
    assert.notEqual(row.token_hash, result.token);
    assert.equal((await auth.requireUser(result.token)).id, 1);
  } finally { db.close(); }
});

test('AC-14 logout revokes sessions and expired tokens are refused', async () => {
  const db = openDatabase(':memory:');
  try {
    let now = new Date('2026-11-20T12:00:00Z');
    const password = randomBytes(20).toString('hex');
    seedDemo(db, await hashPassword(password), now);
    const auth = authService(repository(db), () => now);
    const result = await auth.login('member@example.test', password);
    (await auth.logout(result.token));
    await assert.rejects(() => auth.requireUser(result.token), { code: 'Unauthenticated' });
    await assert.rejects(() => auth.requireUser(), { code: 'Unauthenticated' });
    const second = await auth.login('member@example.test', password);
    now = new Date('2026-11-20T20:00:00Z');
    await assert.rejects(() => auth.requireUser(second.token), { code: 'Unauthenticated' });
  } finally { db.close(); }
});
