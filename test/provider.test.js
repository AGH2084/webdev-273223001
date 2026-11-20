const test = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/data/database');
const { repository } = require('../src/data/repository');
const { seedDemo } = require('../src/data/seed');
const { authService } = require('../src/services/auth');
const { providerAuth } = require('../src/services/provider-auth');
const { googleClient } = require('../src/auth/google-client');
const { fixture } = require('./helpers');

test('AC-6 verified provider identity links one local account and reuses ordinary sessions', async () => {
  const db = openDatabase(':memory:');
  try {
    seedDemo(db, 'fixture-hash'); const data = repository(db); const auth = authService(data);
    let profile = { sub: 'google-subject', email: 'member@example.test', email_verified: true, name: 'Member' };
    const client = { configured: true, authorization: state => `https://accounts.example/?state=${state}`, exchange: async () => profile };
    const service = providerAuth(data, auth, client);
    const begin = service.begin(); const session = await service.complete(begin.state, begin.state, 'fake-code');
    assert.equal(auth.requireUser(session.token).id, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 2);
    await assert.rejects(service.complete(begin.state, begin.state, 'fake-code'), { code: 'InvalidOAuthState' });
    profile = { ...profile, email: 'changed@example.test', name: '' };
    const again = service.begin(); assert.equal((await service.complete(again.state, again.state, 'code')).user.id, 1);
    profile = { sub: 'new-subject', email: 'new@example.test', email_verified: true };
    const other = service.begin(); assert.equal((await service.complete(other.state, other.state, 'code')).user.role, 'member');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 3);
    assert.equal(service.available(), true);
  } finally { db.close(); }
});

test('AC-6 unverified emails, bad state, expired state and provider failure never link accounts', async () => {
  const db = openDatabase(':memory:');
  try {
    seedDemo(db, 'fixture-hash'); const data = repository(db); const auth = authService(data);
    let now = new Date('2026-11-20T12:00:00Z');
    const client = { configured: true, authorization: () => 'url', exchange: async () => ({ sub: 'x', email: 'member@example.test', email_verified: false }) };
    const service = providerAuth(data, auth, client, () => now);
    await assert.rejects(service.complete('bad', 'bad', 'code'), { code: 'InvalidOAuthState' });
    const flow = service.begin();
    await assert.rejects(service.complete(flow.state, 'wrong-browser', 'code'), { code: 'InvalidOAuthState' });
    await assert.rejects(service.complete(flow.state, flow.state, 'code'), { code: 'UnverifiedIdentity' });
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM provider_accounts').get().n, 0);
    const expired = service.begin(); now = new Date('2026-11-20T12:11:00Z');
    await assert.rejects(service.complete(expired.state, expired.state, 'code'), { code: 'InvalidOAuthState' });
    client.exchange = async () => { throw new Error('offline'); };
    const failed = service.begin(); await assert.rejects(service.complete(failed.state, failed.state, 'code'), { code: 'ProviderUnavailable' });
    client.configured = false; assert.equal(service.available(), false);
    assert.throws(() => service.begin(), { code: 'ProviderUnavailable' });
  } finally { db.close(); }
});

test('AC-6 Google adapter uses PKCE, a bounded token exchange and authenticated userinfo', async () => {
  const calls = [];
  const client = googleClient({ clientId: 'fixture-id', clientSecret: 'fixture-secret', baseUrl: 'https://club.example/',
    fetchImpl: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => calls.length === 1 ? { access_token: 'fixture-token' } : { sub: 's', email_verified: true } }; } });
  const url = new URL(client.authorization('state', 'verifier'));
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://club.example/api/auth/google/callback');
  assert.equal((await client.exchange('code', 'verifier')).sub, 's');
  assert.match(calls[0].options.body, /code_verifier=verifier/);
  assert.ok(calls[0].options.signal);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer fixture-token');
  for (const responses of [[{ ok: false }], [{ ok: true, json: async () => ({}) }],
    [{ ok: true, json: async () => ({ access_token: 'x' }) }, { ok: false }]]) {
    const broken = googleClient({ fetchImpl: async () => responses.shift() });
    await assert.rejects(broken.exchange('code', 'v'));
  }
});

test('AC-6 HTTP provider flow binds state to the browser and redirects into the same session', async t => {
  const providerClient = { configured: true, authorization: state => `https://accounts.example/?state=${state}`,
    exchange: async () => ({ sub: 'http-sub', email: 'member@example.test', email_verified: true }) };
  const { base } = await fixture(t, { providerClient });
  const begin = await fetch(`${base}/api/auth/google`, { redirect: 'manual' });
  const state = new URL(begin.headers.get('location')).searchParams.get('state');
  const cookie = begin.headers.get('set-cookie').split(';')[0];
  const response = await fetch(`${base}/api/auth/google/callback?state=${state}&code=fake`, { headers: { Cookie: cookie }, redirect: 'manual' });
  assert.equal(response.status, 302); assert.equal(response.headers.get('location'), '/events');
  const session = response.headers.getSetCookie().find(s => s.startsWith('club_session=')).split(';')[0];
  assert.equal((await (await fetch(`${base}/api/events`, { headers: { Cookie: session } })).json()).user.id, 1);
  const replay = await fetch(`${base}/api/auth/google/callback?state=${state}&code=fake`, { headers: { Cookie: cookie }, redirect: 'manual' });
  assert.equal(replay.headers.get('location'), '/login?provider=failed');
});
