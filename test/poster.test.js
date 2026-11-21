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
  const jpeg = { ...image, mimeType: 'image/jpeg', data: Buffer.from('ffd8ff001122', 'hex').toString('base64') };
  assert.equal((await service.read('token', jpeg)).source, 'suggestion');
  client.read = async () => ({ title: 'Workshop', startsAt: '2026-99-01T14:00:00Z' });
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


test('AC-8 poster fallback distinguishes configuration, API refusal, quota, timeout and invalid output without leaking details', async () => {
  const cases = [
    [400, /rejected the poster request/], [401, /refused API access/], [403, /refused API access/],
    [404, /model is unavailable/], [429, /exhausted quota/], [503, /temporarily unavailable/],
  ];
  for (const [status, message] of cases) {
    const client = posterClient({ apiKey: 'private-fixture-key', fetchImpl: async () => ({ ok: false, status }) });
    const result = await posterService(auth, client).read('token', image);
    assert.equal(result.source, 'manual'); assert.match(result.message, message);
    assert.doesNotMatch(result.message, /private-fixture-key/);
  }
  for (const name of ['TimeoutError', 'AbortError']) {
    const client = posterClient({ apiKey: 'fixture', fetchImpl: async () => { throw Object.assign(new Error('private provider detail'), { name }); } });
    assert.match((await posterService(auth, client).read('token', image)).message, /timed out/);
  }
  assert.match((await posterService(auth, { configured: false }).read('token', image)).message, /not configured/);
  assert.match((await posterService(auth, { configured: true, read: () => new Promise(() => {}) }, { timeoutMs: 5 }).read('token', image)).message, /timed out/);
  assert.match((await posterService(auth, posterClient({ apiKey: 'fixture', model: '../wrong' })).read('token', image)).message, /model is unavailable/);
  const badAnswer = posterClient({ apiKey: 'fixture', fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });
  assert.match((await posterService(auth, badAnswer).read('token', image)).message, /usable poster details/);
});


test('AC-8 poster adapter allows 30 seconds and aborts an unanswered provider request', async () => {
  const originalTimeout = AbortSignal.timeout; const budgets = [];
  AbortSignal.timeout = ms => { budgets.push(ms); return originalTimeout(5); };
  try {
    const client = posterClient({ apiKey: 'fixture-only', fetchImpl: (url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    }) });
    // Keep the event loop alive while the short injected AbortSignal timer fires.
    const keepAlive = setTimeout(() => {}, 1000);
    try { await assert.rejects(client.read(image), { code: 'PosterTimeout' }); }
    finally { clearTimeout(keepAlive); }
    assert.deepEqual(budgets, [30000]);
  } finally { AbortSignal.timeout = originalTimeout; }
});


test('AC-7 poster capacity and description are validated independently without inventing missing values', async () => {
  let answer = { capacity: 40, description: '  Collaborative coding. Bring your own laptop.  ' };
  const service = posterService(auth, { configured: true, read: async () => answer });
  const result = await service.read('token', image);
  assert.equal(result.suggestion.capacity, 40);
  assert.equal(result.suggestion.description, 'Collaborative coding. Bring your own laptop.');
  for (const capacity of [undefined, null, '40', 1.5, 0, 5001]) {
    answer = { title: 'Event', capacity, description: 123 };
    const invalid = await service.read('token', image);
    assert.equal(invalid.suggestion.capacity, null); assert.equal(invalid.suggestion.description, '');
  }
  answer = { capacity: 5000, description: 'x'.repeat(2001) };
  assert.equal((await service.read('token', image)).suggestion.description.length, 2000);
  answer = { capacity: 1 };
  assert.equal((await service.read('token', image)).suggestion.capacity, 1);
});
