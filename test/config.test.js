const test = require('node:test');
const assert = require('node:assert/strict');
const { configuration } = require('../src/config');
const base = { DATABASE_URL: 'postgresql://user:placeholder@localhost/club_calendar' };
test('AC-23 startup configuration names missing requirements without exposing connection secrets', () => {
  assert.throws(() => configuration({}), /missing DATABASE_URL/);
  for (const DATABASE_URL of ['not-a-url', 'https://localhost/db']) assert.throws(() => configuration({ DATABASE_URL }), /PostgreSQL URL/);
  for (const PORT of ['0', '65536', 'bad']) assert.throws(() => configuration({ ...base, PORT }), /PORT/);
  for (const PUBLIC_BASE_URL of ['bad', 'ftp://host', 'http://user:pass@host', 'http://host/path', 'http://host/?secret=x', 'http://host/#x']) {
    assert.throws(() => configuration({ ...base, PUBLIC_BASE_URL }), /PUBLIC_BASE_URL/);
  }
  assert.throws(() => configuration({ ...base, NODE_ENV: 'production' }), /HTTPS PUBLIC_BASE_URL/);
  const configured = configuration({ ...base, PORT: '4000', PUBLIC_BASE_URL: 'https://club.example', NODE_ENV: 'production' });
  assert.equal(configured.port, 4000); assert.equal(configured.secureCookies, true);
  assert.equal(configuration(base).port, 3000);
});
