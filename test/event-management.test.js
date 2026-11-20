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
