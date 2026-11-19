const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers');
const { eventSnapshot, removeEvent, restoreEvent } = require('../src/data/inspection');

test('AC-10 signed-out page redirects and API exposes no events', async t => {
  const { base } = await fixture(t);
  const page = await fetch(`${base}/events`, { redirect: 'manual' });
  assert.equal(page.status, 302);
  assert.equal(page.headers.get('location'), '/login');
  const api = await fetch(`${base}/api/events`);
  assert.equal(api.status, 401);
  assert.equal((await api.text()).includes('Build night'), false);
});

test('AC-1 AC-11 authenticated API returns only future events ordered by time with calculated free places', async t => {
  const { base, login } = await fixture(t);
  const response = await login();
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  const headers = { Cookie: cookie.split(';')[0] };
  const page = await fetch(`${base}/events`, { headers });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Upcoming events/);
  const result = await (await fetch(`${base}/api/events`, { headers })).json();
  assert.deepEqual(result.events.map(e => e.id), [1, 2, 3]);
  assert.deepEqual(result.events.map(e => e.freePlaces), [23, 12, 18]);
  assert.equal(result.events[0].club, 'Informatics Club');
  assert.equal(result.events[0].venue, 'Room 1250, TU Sofia');
  assert.equal(result.user.password_hash, undefined);
  assert.equal(result.user.token, undefined);
  assert.equal(page.headers.get('cache-control'), 'no-store');
});

test('AC-12 removing and restoring an event changes the real HTTP list', async t => {
  const { base, db, login } = await fixture(t);
  const cookie = (await login()).headers.get('set-cookie').split(';')[0];
  const get = async () => (await (await fetch(`${base}/api/events`, { headers: { Cookie: cookie } })).json()).events;
  const snapshot = eventSnapshot(db, 1);
  assert.equal((await get()).length, 3);
  removeEvent(db, 1);
  assert.deepEqual((await get()).map(e => e.id), [2, 3]);
  restoreEvent(db, snapshot);
  assert.equal((await get())[0].freePlaces, 23);
});

test('AC-13 invalid credentials and malformed requests are refused; cross-site login is rejected', async t => {
  const { base, password } = await fixture(t, { secureCookies: true });
  const post = (body, more = {}) => fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...more }, body });
  const wrong = await post(JSON.stringify({ email: 'member@example.test', password: 'wrong' }));
  assert.equal(wrong.status, 401);
  assert.equal((await wrong.json()).message, 'Email or password is incorrect');
  assert.equal(wrong.headers.get('set-cookie'), null);
  assert.equal((await post('null')).status, 400);
  assert.equal((await post('{}')).status, 422);
  assert.equal((await post('{')).status, 400);
  assert.equal((await post('x', { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post(JSON.stringify({ a: 'a'.repeat(9000) }))).status, 413);
  assert.equal((await post('{}', { Origin: 'https://other.example' })).status, 403);
  const valid = await post(JSON.stringify({ email: 'member@example.test', password }));
  assert.equal(valid.status, 200);
  assert.match(valid.headers.get('set-cookie'), /; Secure/);
});

test('AC-14 HTTP logout invalidates the old cookie and clears it', async t => {
  const { base, login } = await fixture(t);
  const cookie = (await login()).headers.get('set-cookie').split(';')[0];
  const logout = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await fetch(`${base}/api/events`, { headers: { Cookie: cookie } })).status, 401);
  const again = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(again.status, 401);
});

test('AC-15 empty database list returns an empty array without stale fixtures', async t => {
  const { base, db, login } = await fixture(t);
  for (const id of [1, 2, 3]) removeEvent(db, id);
  const cookie = (await login()).headers.get('set-cookie').split(';')[0];
  const response = await fetch(`${base}/api/events`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).events, []);
});
