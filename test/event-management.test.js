const test = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/data/database');
const { repository } = require('../src/data/repository');
const { seedDemo } = require('../src/data/seed');
const { eventManagement } = require('../src/services/event-management');

test('AC-5 organiser service refuses foreign ownership, missing data and invalid event details', () => {
  const db = openDatabase(':memory:');
  try {
    seedDemo(db, 'fixture-hash');
    db.prepare("INSERT INTO users VALUES (3,'other@example.test','Other organiser','fixture-hash','organiser')").run();
    const service = eventManagement(repository(db), { requireUser: token => ({ id: Number(token), role: token === '1' ? 'member' : 'organiser' }) });
    const body = { title: 'Future event', venue: 'Lab', startsAt: '2099-12-01T14:00:00Z', capacity: 12, clubId: 1 };
    assert.throws(() => service.create('1', body), { code: 'Forbidden' });
    assert.throws(() => service.create('3', body), { code: 'Forbidden' });
    assert.throws(() => service.create('2', { ...body, clubId: 999 }), { code: 'NotFound' });
    assert.throws(() => service.create('2', null), { code: 'InvalidInput' });
    for (const bad of [{ title: '' }, { title: 4 }, { description: 4 }, { venue: '' }, { venue: 4 },
      { capacity: 0 }, { capacity: 1.5 }, { startsAt: '2026-01-01T12:00:00Z' }, { startsAt: 'wrong' },
      { startsAt: '2099-02-31T12:00:00Z' }, { startsAt: '2099-99-01T12:00:00Z' }]) {
      assert.throws(() => service.create('2', { ...body, ...bad }), { code: 'InvalidInput' });
    }
    const created = service.create('2', body);
    assert.equal(service.detail('1', created.id).registrationId, null);
    assert.throws(() => service.detail('2', 999), { code: 'NotFound' });
    assert.throws(() => service.edit('2', 999, body), { code: 'NotFound' });
    assert.throws(() => service.edit('3', 1, body), { code: 'Forbidden' });
    db.prepare('INSERT INTO registrations (user_id,event_id) VALUES (1,1)').run();
    assert.throws(() => service.edit('2', 1, { ...body, capacity: 1 }), { code: 'CapacityConflict' });
    assert.equal(service.detail('2', 1).attendees.length, 2);
  } finally { db.close(); }
});


test('AC-19 only the event organiser can delete an event and its registrations', () => {
  const db = openDatabase(':memory:');
  try {
    seedDemo(db, 'fixture-hash');
    const service = eventManagement(repository(db), { requireUser(token) {
      if (!token) { const { AppError } = require('../src/services/errors'); throw new AppError('Unauthenticated', 'Sign in'); }
      return { id: Number(token), role: token === '1' ? 'member' : 'organiser' };
    } });
    assert.throws(() => service.remove(null, 1), { code: 'Unauthenticated' });
    assert.throws(() => service.remove('1', 1), { code: 'Forbidden' });
    assert.throws(() => service.remove('3', 1), { code: 'Forbidden' });
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM registrations WHERE event_id=1').get().n, 1);
    assert.throws(() => service.remove('2', 999), { code: 'NotFound' });
    assert.throws(() => service.remove('2', 0), { code: 'InvalidInput' });
    service.remove('2', 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events WHERE id=1').get().n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM registrations WHERE event_id=1').get().n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n, 3);
    assert.throws(() => service.remove('2', 1), { code: 'NotFound' });
  } finally { db.close(); }
});


test('AC-5 event validation identifies the failing field and keeps stored events unchanged', () => {
  const db = openDatabase(':memory:');
  try {
    seedDemo(db, 'fixture-hash');
    const now = new Date('2026-11-21T12:00:00Z');
    const service = eventManagement(repository(db), { requireUser: () => ({ id: 2, role: 'organiser' }) }, () => now);
    const body = { title: 'Coding night', venue: 'Lab', capacity: 40, description: 'Bring a laptop.', startsAt: '2099-01-01T18:00:00Z', clubId: 1 };
    for (const [bad, message] of [
      [{ title: '' }, /event title/], [{ description: 'x'.repeat(2001) }, /description/],
      [{ venue: '' }, /venue/], [{ capacity: 0 }, /whole number of places/],
      [{ startsAt: '' }, /valid event date and time/],
      [{ startsAt: '2026-10-26T18:00:00Z' }, /Choose a future date and time/],
      [{ startsAt: now.toISOString() }, /Choose a future date and time/],
    ]) {
      assert.throws(() => service.edit('token', 1, { ...body, ...bad }), error => error.code === 'InvalidInput' && message.test(error.message));
      assert.equal(db.prepare('SELECT title FROM events WHERE id=1').get().title, 'Build night');
    }
  } finally { db.close(); }
});
