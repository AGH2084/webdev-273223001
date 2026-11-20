const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers');

test('AC-2 AC-3 AC-4 AC-16 AC-17 AC-18 real HTTP enforces registration rules and ownership', async t => {
  const { base, login, password, db } = await fixture(t);
  const member = (await login()).headers.get('set-cookie').split(';')[0];
  const owner = (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'organiser@example.test', password }) })).headers.get('set-cookie').split(';')[0];
  const call = (path, method, cookie, body) => fetch(`${base}${path}`, { method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal((await call('/api/registrations', 'POST', null, { eventId: 2 })).status, 401);
  db.prepare('UPDATE events SET capacity=1 WHERE id=1').run();
  const full = await call('/api/registrations', 'POST', member, { eventId: 1 });
  assert.equal(full.status, 409); assert.equal((await full.json()).message, 'This event is full');
  assert.equal((await call('/api/registrations', 'POST', member, { eventId: 4 })).status, 409);
  assert.equal((await call('/api/registrations', 'POST', member, { eventId: 999 })).status, 404);
  const created = await call('/api/registrations', 'POST', member, { eventId: 2 });
  assert.equal(created.status, 201); const { id } = await created.json();
  assert.equal((await call('/api/registrations', 'POST', member, { eventId: 2 })).status, 409);
  assert.equal((await call(`/api/registrations/${id}`, 'DELETE', owner)).status, 403);
  assert.equal((await call(`/api/registrations/${id}`, 'DELETE', null)).status, 401);
  assert.equal((await (await call('/api/registrations', 'GET', member)).json()).registrations.length, 1);
  assert.equal((await call(`/api/registrations/${id}`, 'DELETE', member)).status, 204);
  assert.equal((await call(`/api/registrations/${id}`, 'DELETE', member)).status, 404);
});

test('AC-5 organiser HTTP creates/edits owned events and keeps attendee details private', async t => {
  const { base, login, password } = await fixture(t);
  const member = (await login()).headers.get('set-cookie').split(';')[0];
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'organiser@example.test', password }) });
  const owner = response.headers.get('set-cookie').split(';')[0];
  const call = (path, method, cookie, body) => fetch(`${base}${path}`, { method,
    headers: { Cookie: cookie, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const details = { title: 'New workshop', description: 'Bring a laptop.', startsAt: '2026-12-02T16:00:00Z', venue: 'Lab 1', capacity: 12, clubId: 1 };
  assert.equal((await call('/api/events', 'POST', member, details)).status, 403);
  const created = await call('/api/events', 'POST', owner, details);
  assert.equal(created.status, 201); const { id } = await created.json();
  assert.equal((await call(`/api/events/${id}`, 'PATCH', member, { ...details, title: 'Wrong edit' })).status, 403);
  assert.equal((await call(`/api/events/${id}`, 'PATCH', owner, { ...details, title: 'Updated workshop' })).status, 200);
  assert.equal((await (await call(`/api/events/${id}`, 'GET', member)).json()).event.title, 'Updated workshop');
  assert.equal((await (await call('/api/events/1', 'GET', member)).json()).attendees, null);
  assert.equal((await (await call('/api/events/1', 'GET', owner)).json()).attendees[0].name, 'Boris Ivanov');
  assert.equal((await (await call('/api/clubs', 'GET', owner)).json()).clubs.length, 1);
  assert.equal((await call('/api/events', 'POST', owner, { ...details, capacity: 0 })).status, 422);
});
