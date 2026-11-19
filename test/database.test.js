const test = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/data/database');
const { repository } = require('../src/data/repository');
const { seedDemo, rotateDemoPassword } = require('../src/data/seed');

test('AC-11 migration and explicit seed create three future events with real capacity counts', () => {
  const db = openDatabase(':memory:');
  try {
    const now = new Date('2026-11-20T12:00:00Z');
    assert.equal(seedDemo(db, 'test-hash', now), true);
    assert.equal(seedDemo(db, 'test-hash', now), false);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n, 4);
    const events = repository(db).upcoming(now.toISOString());
    assert.equal(events.length, 3);
    assert.equal(events[0].capacity - events[0].registered, 23);
    assert.deepEqual(events.map(e => e.id), [1, 2, 3]);
  } finally { db.close(); }
});

test('AC-13 explicit demo password rotation revokes demo sessions without recreating events', () => {
  const db = openDatabase(':memory:');
  try {
    assert.throws(() => rotateDemoPassword(db, 'replacement'), /Both local demo accounts/);
    seedDemo(db, 'original');
    const data = repository(db);
    data.createSession('test-digest', 1, '2099-01-01T00:00:00.000Z');
    rotateDemoPassword(db, 'replacement');
    assert.equal(data.findUser('member@example.test').password_hash, 'replacement');
    assert.equal(data.sessionUser('test-digest', '2026-11-20T12:00:00.000Z'), undefined);
    assert.equal(data.upcoming('2026-11-20T00:00:00.000Z').length, 3);
  } finally { db.close(); }
});
