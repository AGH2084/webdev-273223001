const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

function fakeNode(tag = 'div') {
  const classes = new Set();
  return { tag, className: '', textContent: '', value: '', files: [], checked: false, children: [], attributes: {}, listeners: {}, hidden: false,
    classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) },
    append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; },
    setAttribute(key, value) { this.attributes[key] = value; }, addEventListener(key, fn) { this.listeners[key] = fn; } };
}
function boot(script, fetch, { api, search = '', fileReader } = {}) {
  const elements = new Map();
  const htmlFile = join(__dirname, '../src/web', script.replace('.js', '.html'));
  if (existsSync(htmlFile)) for (const match of readFileSync(htmlFile, 'utf8').matchAll(/id="([^"]+)"/g)) elements.set(`#${match[1]}`, fakeNode());
  const document = { querySelector(selector) { if (!elements.has(selector)) elements.set(selector, fakeNode()); return elements.get(selector); },
    createElement: fakeNode, createTextNode: text => ({ textContent: text }) };
  const navigations = [];
  const window = { ClubAPI: api };
  vm.runInNewContext(readFileSync(join(__dirname, '../src/web', script), 'utf8'), {
    document, window, fetch, URLSearchParams, FileReader: fileReader, AbortSignal, Intl, Date, Error,
    location: { search, assign: url => navigations.push(url) },
  }, { filename: join(__dirname, '../src/web', script) });
  return { elements, navigations, window };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('AC-15 event UI announces loading, renders honest empty state, shows failure and retries', async () => {
  let reply;
  const page = boot('events.js', () => new Promise(resolve => { reply = resolve; }));
  assert.equal(page.elements.get('#events-message').textContent, 'Loading club events…');
  assert.equal(page.elements.get('#event-list').attributes['aria-busy'], 'true');
  reply({ status: 200, ok: true, json: async () => ({ user: { name: 'Test member' }, events: [] }) });
  await tick();
  assert.match(page.elements.get('#events-message').textContent, /Nothing is scheduled/);
  assert.equal(page.elements.get('#event-count').textContent, '0 events');
  const request = page.elements.get('#refresh').listeners.click();
  reply({ status: 500, ok: false, json: async () => ({}) });
  await request;
  assert.equal(page.elements.get('#retry').hidden, false);
  assert.match(page.elements.get('#events-message').textContent, /Could not load/);
  const retry = page.elements.get('#retry').listeners.click();
  reply({ status: 200, ok: true, json: async () => ({ user: { name: 'Test member' }, events: [] }) });
  await retry;
  assert.equal(page.elements.get('#retry').hidden, true);
  assert.equal(page.elements.get('#event-list').attributes['aria-busy'], 'false');
});

test('AC-11 event UI renders database fields as text and includes Sofia date and capacity', async () => {
  const unsafeTitle = '<img src=x onerror=alert(1)>';
  const page = boot('events.js', async () => ({ status: 200, ok: true, json: async () => ({
    user: { name: 'Test member' }, events: [{ id: 1, title: unsafeTitle, startsAt: '2026-11-22T16:00:00Z',
      venue: 'Room 1250', club: 'Informatics Club', description: 'Meet the club.', freePlaces: 23, capacity: 24 }],
  }) }));
  await tick();
  const row = page.elements.get('#event-list').children[0];
  const content = row.children[1];
  assert.equal(content.children[0].textContent, unsafeTitle);
  assert.equal(content.children[0].children.length, 0);
  assert.match(content.children[2].children[0].textContent, /18:00/);
  assert.equal(content.children[4].textContent, '23 of 24 places free');
  assert.equal(page.elements.get('#event-count').textContent, '1 event');
});

test('AC-13 login UI shows progress, readable refusal, then navigates only after success', async () => {
  let ok = false;
  const page = boot('login.js', async () => ({ ok, json: async () => ({ message: 'Email or password is incorrect' }) }));
  const form = page.elements.get('#login-form');
  form.email = { value: 'member@example.test' }; form.password = { value: 'test-only-input' };
  const request = form.listeners.submit({ preventDefault() {} });
  assert.equal(page.elements.get('#sign-in').disabled, true);
  await request;
  assert.equal(page.navigations.length, 0);
  assert.match(page.elements.get('#login-message').textContent, /incorrect/);
  ok = true;
  await form.listeners.submit({ preventDefault() {} });
  assert.deepEqual(page.navigations, ['/events']);
});


test('AC-16 AC-4 event screen registers and cancels through the API and updates the visible state', async () => {
  let registrationId = null; const writes = [];
  const api = async (path, options) => {
    if (options) { writes.push({ path, options }); registrationId = options.method === 'POST' ? 8 : null; return {}; }
    return { event: { id: 2, title: 'Workshop', club: 'Club', description: 'Meetup', startsAt: '2099-12-01T14:00:00Z', venue: 'Lab', capacity: 12, freePlaces: registrationId ? 11 : 12 },
      registrationId, canEdit: false, attendees: null };
  };
  const page = boot('event.js', null, { api, search: '?id=2' }); await tick();
  assert.equal(page.elements.get('#register-event').hidden, false);
  await page.elements.get('#register-event').listeners.click();
  assert.equal(writes[0].path, '/api/registrations');
  assert.equal(writes[0].options.body.eventId, 2);
  assert.equal(page.elements.get('#cancel-event').hidden, false);
  assert.match(page.elements.get('#detail-message').textContent, /reserved/);
  await page.elements.get('#cancel-event').listeners.click();
  assert.equal(writes[1].path, '/api/registrations/8');
  assert.match(page.elements.get('#detail-message').textContent, /cancelled/);
});

test('AC-5 AC-7 organiser form applies suggestions but saves only on explicit confirmation', async () => {
  const writes = [];
  const api = async (path, options) => {
    if (path === '/api/clubs') return { clubs: [{ id: 1, name: 'Club' }] };
    writes.push({ path, options });
    if (path === '/api/poster') return { source: 'suggestion', message: 'Check these suggestions.', suggestion: { title: 'Poster workshop', venue: 'Lab', startsAt: '2099-12-01T14:00:00Z' } };
    return { id: 9 };
  };
  class Reader { readAsDataURL() { this.result = 'data:image/png;base64,fixture'; this.onload(); } }
  const page = boot('editor.js', null, { api, fileReader: Reader }); await tick();
  page.elements.get('#poster-file').files = [{ type: 'image/png', size: 12 }];
  page.elements.get('#poster-consent').checked = true;
  const button = page.elements.get('#read-poster');
  await button.listeners.click({ currentTarget: button });
  assert.equal(writes.length, 1); assert.equal(writes[0].path, '/api/poster');
  assert.equal(page.elements.get('#title').value, 'Poster workshop');
  assert.equal(page.navigations.length, 0);
  page.elements.get('#capacity').value = '12'; page.elements.get('#club').value = '1'; page.elements.get('#description').value = 'Details';
  await page.elements.get('#event-form').listeners.submit({ preventDefault() {} });
  assert.equal(writes[1].path, '/api/events');
  assert.equal(writes[1].options.body.title, 'Poster workshop');
  assert.deepEqual(page.navigations, ['/event?id=9']);
});

test('AC-8 poster failure leaves the organiser form available for manual entry', async () => {
  const api = async path => path === '/api/clubs' ? { clubs: [{ id: 1, name: 'Club' }] } :
    { source: 'manual', suggestion: null, message: 'Enter details manually.' };
  class Reader { readAsDataURL() { this.result = 'data:image/png;base64,fixture'; this.onload(); } }
  const page = boot('editor.js', null, { api, fileReader: Reader }); await tick();
  page.elements.get('#title').value = 'Manual title';
  page.elements.get('#poster-file').files = [{ type: 'image/png', size: 12 }]; page.elements.get('#poster-consent').checked = true;
  const button = page.elements.get('#read-poster'); await button.listeners.click({ currentTarget: button });
  assert.equal(page.elements.get('#title').value, 'Manual title');
  assert.equal(page.elements.get('#editor-content').hidden, false);
  assert.equal(button.disabled, false);
  assert.match(page.elements.get('#poster-message').textContent, /manually/);
});

test('AC-18 shared browser API redirects expired sessions and preserves readable errors', async () => {
  let response = { status: 204, ok: true };
  const page = boot('api.js', async () => response);
  assert.equal(await page.window.ClubAPI('/api/registrations/1', { method: 'DELETE' }), null);
  response = { status: 403, ok: false, json: async () => ({ message: 'Only the owner may cancel.' }) };
  await assert.rejects(page.window.ClubAPI('/api/registrations/1'), /Only the owner/);
  response = { status: 401 }; await assert.rejects(page.window.ClubAPI('/api/events'), /Sign in/);
  assert.deepEqual(page.navigations, ['/login']);
});
