const test = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/data/database');
const { seedDemo } = require('../src/data/seed');

test('AC-2 AC-3 migration protects capacity and duplicate registrations on a fresh database', () => {
  const db = openDatabase(':memory:');
  try {
    seedDemo(db, 'fixture-hash');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n, 2);
    assert.throws(() => db.prepare('INSERT INTO registrations (user_id,event_id) VALUES (2,1)').run(), /UNIQUE/);
    db.prepare('UPDATE events SET capacity=1 WHERE id=1').run();
    assert.throws(() => db.prepare('INSERT INTO registrations (user_id,event_id) VALUES (1,1)').run(), /event_capacity_exceeded/);
    db.prepare('INSERT INTO registrations (user_id,event_id) VALUES (1,2)').run();
    db.prepare('INSERT INTO registrations (user_id,event_id) VALUES (2,2)').run();
    assert.throws(() => db.prepare('UPDATE events SET capacity=1 WHERE id=2').run(), /capacity_below_registrations/);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 2);
  } finally { db.close(); }
});
