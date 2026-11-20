const test = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/data/database');
const { repository } = require('../src/data/repository');
const { seedDemo } = require('../src/data/seed');
const { hashPassword, authService } = require('../src/services/auth');
const { eventsService } = require('../src/services/events');
const { registrationsService } = require('../src/services/registrations');
const { handle } = require('../mcp-server/server');
const { callProjectTool } = require('../mcp-server/project-tools');

test('AC-9 project MCP tools use the authenticated HTTP services and preserve business errors', async () => {
  const db = openDatabase(':memory:');
  try {
    seedDemo(db, await hashPassword('test-only-mcp-password'));
    const data = repository(db); const auth = authService(data);
    const { token } = await auth.login('member@example.test', 'test-only-mcp-password');
    const services = { events: eventsService(data, auth), registrations: registrationsService(data, auth) };
    const call = (name, args = {}, session = token) => handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, services, session);
    assert.equal(handle({ method: 'tools/list', id: 1 }).result.tools.length, 6);
    assert.equal(JSON.parse(call('upcoming_events').result.content[0].text).length, 3);
    assert.equal(call('upcoming_events', {}, 'wrong').result.isError, true);
    db.prepare('UPDATE events SET capacity=1 WHERE id=1').run();
    assert.equal(call('register', { eventId: 1 }).result.content[0].text, 'This event is full');
    const registered = JSON.parse(call('register', { eventId: 2 }).result.content[0].text);
    assert.equal(JSON.parse(call('my_registrations').result.content[0].text).length, 1);
    assert.equal(call('cancel_registration', { registrationId: 1 }).result.isError, true);
    assert.equal(call('cancel_registration', { registrationId: registered.id }).result.isError, false);
    assert.equal(JSON.parse(call('my_registrations').result.content[0].text).length, 0);
    assert.equal(call('no_such_tool').error.code, -32602);
    assert.equal(callProjectTool({ events: { list() { throw new Error('private detail'); } } }, token, 'upcoming_events', {}).content[0].text, 'The request could not be completed.');
  } finally { db.close(); }
});
