const test = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/data/database');
const { seedDemo } = require('../src/data/seed');
const { repository } = require('../src/data/repository');
const { registrationsService } = require('../src/services/registrations');

function fixture(t) {
  const db = openDatabase(':memory:');
  seedDemo(db, 'fixture-hash', new Date('2026-11-20T12:00:00Z'));
  t.after(() => db.close());
  const auth = { requireUser(token) {
    if (!token) { const { AppError } = require('../src/services/errors'); throw new AppError('Unauthenticated', 'Sign in first'); }
    return { id: Number(token), role: 'member' };
  } };
  return { db, service: registrationsService(repository(db), auth, () => new Date('2026-11-20T12:00:00Z')) };
}

test('AC-2 full event is refused by the service without inserting a registration', t => {
  const { db, service } = fixture(t);
  db.prepare('UPDATE events SET capacity=1 WHERE id=1').run();
  assert.throws(() => service.register('1', 1), { code: 'EventFull', message: 'This event is full' });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM registrations WHERE event_id=1').get().n, 1);
});
test('AC-3 duplicate registration is refused without consuming another place', t => {
  const { db, service } = fixture(t);
  assert.throws(() => service.register('2', 1), { code: 'AlreadyRegistered' });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM registrations WHERE event_id=1').get().n, 1);
});
test('AC-4 AC-16 cancellation frees a place; only the owner can cancel', t => {
  const { db, service } = fixture(t);
  const registration = service.register('1', 2);
  assert.equal(service.mine('1').length, 1);
  assert.throws(() => service.cancel('2', registration.id), { code: 'Forbidden' });
  service.cancel('1', registration.id);
  assert.equal(service.mine('1').length, 0);
  assert.equal(service.register('2', 2).eventId, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM registrations WHERE event_id=2').get().n, 1);
});
test('AC-17 AC-18 invalid, missing and past records are refused, including signed-out calls', t => {
  const { service } = fixture(t);
  assert.throws(() => service.register('1', 4), { code: 'EventPast' });
  assert.throws(() => service.register('1', 999), { code: 'NotFound' });
  assert.throws(() => service.register('1', '1'), { code: 'InvalidInput' });
  assert.throws(() => service.cancel('1', 999), { code: 'NotFound' });
  assert.throws(() => service.cancel('1', 0), { code: 'InvalidInput' });
  assert.throws(() => service.register(null, 1), { code: 'Unauthenticated' });
  assert.throws(() => service.cancel(null, 1), { code: 'Unauthenticated' });
});
