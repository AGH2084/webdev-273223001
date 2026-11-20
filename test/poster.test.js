const test = require('node:test');
const assert = require('node:assert/strict');
const { posterService } = require('../src/services/poster');
const { posterClient } = require('../src/model/poster-client');
const { fixture } = require('./helpers');
const image = { mimeType: 'image/png', data: Buffer.from('89504e470d0a1a0a00000000', 'hex').toString('base64'), consent: true };
const auth = { requireUser: () => ({ id: 2, role: 'organiser' }) };

test('AC-7 poster suggestions are validated, labelled and never automatically saved', async () => {
  const client = { configured: true, read: async () => ({ title: ' Workshop ', venue: ' Lab ', startsAt: '2026-12-01T14:00:00Z' }) };
  const service = posterService(auth, client);
  const result = await service.read('token', image);
  assert.equal(result.source, 'suggestion'); assert.equal(result.suggestion.title, 'Workshop');
  assert.equal(result.suggestion.startsAt, '2026-12-01T14:00:00.000Z');
  client.read = async () => ({ title: 'Workshop', startsAt: '2026-02-31T14:00:00Z', venue: 25 });
  const invalid = await service.read('token', image);
  assert.equal(invalid.suggestion.startsAt, ''); assert.equal(invalid.suggestion.venue, '');
  client.read = async () => ({ title: 'Workshop', startsAt: 'not-a-date' });
  assert.equal((await service.read('token', image)).suggestion.startsAt, '');
});

test('AC-8 missing key, timeout, rate limit and malformed answers keep manual entry available', async () => {
  for (const client of [
    { configured: false },
    { configured: true, read: async () => { throw new Error('429'); } },
    { configured: true, read: () => new Promise(() => {}) },
    { configured: true, read: async () => null },
    { configured: true, read: async () => ({}) },
  ]) {
    const result = await posterService(auth, client, { timeoutMs: 10 }).read('token', image);
    assert.equal(result.source, 'manual'); assert.equal(result.suggestion, null);
  }
});

test('AC-7 unsupported images, missing consent and non-organisers are refused before provider calls', async () => {
  let called = false;
  const client = { configured: true, read: async () => { called = true; } };
  const service = posterService(auth, client);
  for (const bad of [null, { ...image, consent: false }, { ...image, mimeType: 'text/html' },
    { ...image, data: 'abcd' }, { ...image, data: 'a'.repeat(1400001) }]) {
    await assert.rejects(service.read('token', bad), { code: 'InvalidInput' });
  }
  await assert.rejects(posterService({ requireUser: () => ({ role: 'member' }) }, client).read('token', image), { code: 'Forbidden' });
  assert.equal(called, false);
});

test('AC-7 AC-8 model adapter sends only the selected image and prompt, with bounded JSON generation', async () => {
  let request;
  const client = posterClient({ apiKey: 'fixture-key', fetchImpl: async (url, options) => {
    request = { url, options }; return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"title":"Workshop"}' }] } }] }) };
  } });
  assert.equal((await client.read(image)).title, 'Workshop');
  assert.ok(request.options.signal); assert.equal(request.options.headers['x-goog-api-key'], 'fixture-key');
  const body = JSON.parse(request.options.body);
  assert.deepEqual(body.contents[0].parts[1].inlineData, { mimeType: image.mimeType, data: image.data });
  await assert.rejects(posterClient({ model: '../wrong' }).read(image));
  await assert.rejects(posterClient({ fetchImpl: async () => ({ ok: false }) }).read(image));
});

test('AC-7 AC-8 poster HTTP suggests without inserting events; missing key falls back', async t => {
  const { base, password, db } = await fixture(t, { modelClient: { configured: true, read: async () => ({ title: 'Suggestion', startsAt: '2026-12-01T14:00:00Z' }) } });
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'organiser@example.test', password }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const response = await fetch(`${base}/api/poster`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(image) });
  assert.equal(response.status, 200); assert.equal((await response.json()).source, 'suggestion');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n, 4);
  const other = await fixture(t, { modelClient: { configured: false } });
  const signed = await fetch(`${other.base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'organiser@example.test', password: other.password }) });
  const fallback = await fetch(`${other.base}/api/poster`, { method: 'POST', headers: { Cookie: signed.headers.get('set-cookie').split(';')[0], 'Content-Type': 'application/json' }, body: JSON.stringify(image) });
  assert.equal((await fallback.json()).source, 'manual');
});
