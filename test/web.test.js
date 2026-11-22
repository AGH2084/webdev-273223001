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
    focus() { this.focused = true; }, scrollIntoView() { this.scrolledIntoView = true; },
    setAttribute(key, value) { this.attributes[key] = value; }, addEventListener(key, fn) { this.listeners[key] = fn; } };
}
function boot(script, fetch, { api, search = '', fileReader, abortSignal = AbortSignal } = {}) {
  const elements = new Map();
  const htmlFile = join(__dirname, '../src/web', script.replace('.js', '.html'));
  if (existsSync(htmlFile)) for (const match of readFileSync(htmlFile, 'utf8').matchAll(/id="([^"]+)"/g)) elements.set(`#${match[1]}`, fakeNode());
  const document = { querySelector(selector) { if (!elements.has(selector)) elements.set(selector, fakeNode()); return elements.get(selector); },
    createElement: fakeNode, createTextNode: text => ({ textContent: text }) };
  const navigations = [];
  const window = { ClubAPI: api };
  vm.runInNewContext(readFileSync(join(__dirname, '../src/web', script), 'utf8'), {
    document, window, fetch, URLSearchParams, FileReader: fileReader, AbortSignal: abortSignal, Intl, Date, Error,
    location: { search, assign: url => navigations.push(url) },
  }, { filename: join(__dirname, '../src/web', script) });
  return { elements, navigations, window, document };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('AC-5 editor document title distinguishes creating from editing before data arrives', () => {
  const api = () => new Promise(() => {});
  assert.equal(boot('editor.js', null, { api }).document.title, 'Create event · Club Calendar');
  assert.equal(boot('editor.js', null, { api, search: '?id=1' }).document.title, 'Edit event · Club Calendar');
});

test('AC-5 AC-16 detail and editor announce loading before their pending requests resolve', () => {
  const api = () => new Promise(() => {});
  const detail = boot('event.js', null, { api, search: '?id=1' });
  const editor = boot('editor.js', null, { api });
  assert.equal(detail.elements.get('#detail-message').textContent, 'Loading event…');
  assert.equal(editor.elements.get('#editor-message').textContent, 'Loading event form…');
});

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


test('AC-19 event deletion requires confirmation, reports failure and navigates after success', async () => {
  const writes = []; let fail = true;
  const api = async (path, options) => {
    if (options) { writes.push({ path, options }); if (fail) throw new Error('Deletion failed'); return null; }
    return { event: { id: 1, title: 'Event', club: 'Club', startsAt: '2099-12-01T14:00:00Z', venue: 'Lab', description: '', capacity: 12, freePlaces: 12 }, registrationId: null, canEdit: true, attendees: [] };
  };
  const page = boot('event.js', null, { api, search: '?id=1' }); await tick();
  assert.equal(page.elements.get('#delete-event').hidden, false);
  page.elements.get('#delete-event').listeners.click();
  assert.equal(page.elements.get('#delete-confirmation').hidden, false);
  assert.equal(writes.length, 0);
  page.elements.get('#keep-event').listeners.click();
  assert.equal(page.elements.get('#delete-confirmation').hidden, true);
  page.elements.get('#delete-event').listeners.click();
  await page.elements.get('#confirm-delete').listeners.click();
  assert.match(page.elements.get('#detail-message').textContent, /Deletion failed/);
  assert.equal(page.navigations.length, 0);
  assert.equal(page.elements.get('#confirm-delete').disabled, false);
  fail = false; await page.elements.get('#confirm-delete').listeners.click();
  assert.equal(writes[1].path, '/api/events/1'); assert.equal(writes[1].options.method, 'DELETE');
  assert.deepEqual(page.navigations, ['/events']);
});

test('AC-20 removing the poster clears selection and consent and ignores an outstanding suggestion', async () => {
  let resolvePoster; const writes = [];
  const api = async (path, options) => {
    if (path === '/api/clubs') return { clubs: [{ id: 1, name: 'Club' }] };
    writes.push(path); return new Promise(resolve => { resolvePoster = resolve; });
  };
  class Reader { readAsDataURL() { this.result = 'data:image/png;base64,fixture'; this.onload(); } }
  const page = boot('editor.js', null, { api, fileReader: Reader }); await tick();
  page.elements.get('#title').value = 'Keep title';
  page.elements.get('#poster-file').files = [{ type: 'image/png', size: 12 }];
  page.elements.get('#poster-file').value = 'poster.png';
  page.elements.get('#poster-consent').checked = true;
  const button = page.elements.get('#read-poster');
  const pending = button.listeners.click({ currentTarget: button }); await tick();
  page.elements.get('#remove-poster').listeners.click();
  assert.equal(page.elements.get('#poster-file').value, '');
  assert.equal(page.elements.get('#poster-consent').checked, false);
  assert.equal(button.disabled, false);
  resolvePoster({ suggestion: { title: 'Discard title', startsAt: '', venue: '' }, message: 'Suggestion' });
  await pending;
  assert.equal(page.elements.get('#title').value, 'Keep title');
  assert.match(page.elements.get('#poster-message').textContent, /cleared/);
  assert.equal(writes.length, 1); assert.equal(writes[0], '/api/poster');
  assert.equal(page.navigations.length, 0);
});


test('AC-7 poster validation distinguishes file, size and consent and normalizes JPEG metadata', async () => {
  const writes = [];
  const api = async (path, options) => {
    if (path === '/api/clubs') return { clubs: [{ id: 1, name: 'Club' }] };
    writes.push(options.body); return { source: 'manual', message: 'Manual entry available.' };
  };
  class Reader { readAsDataURL() { this.result = 'data:;base64,fixture'; this.onload(); } }
  const page = boot('editor.js', null, { api, fileReader: Reader }); await tick();
  const file = page.elements.get('#poster-file'); const consent = page.elements.get('#poster-consent');
  const button = page.elements.get('#read-poster'); const message = page.elements.get('#poster-message');
  const click = () => button.listeners.click({ currentTarget: button });
  await click(); assert.match(message.textContent, /Choose a poster image first/);
  file.files = [{ name: 'poster.webp', type: 'image/webp', size: 10 }];
  await click(); assert.match(message.textContent, /not supported/);
  file.files = [{ name: 'poster.jpg', type: 'image/jpeg', size: 1048577 }];
  await click(); assert.match(message.textContent, /1,048,576/);
  file.files = [{ name: 'test.jpg', type: '', size: 231819 }];
  file.listeners.change(); assert.match(message.textContent, /Poster selected/);
  await click(); assert.match(message.textContent, /consent box/); assert.equal(writes.length, 0);
  consent.checked = true; await click(); assert.equal(writes[0].mimeType, 'image/jpeg');
  file.files = [{ name: 'test.jpg', type: 'image/jpg', size: 231819 }];
  await click(); assert.equal(writes[1].mimeType, 'image/jpeg');
  file.files = [{ name: 'test.png', type: '', size: 100 }];
  await click(); assert.equal(writes[2].mimeType, 'image/png');
});


test('AC-8 browser waits for the poster fallback while ordinary API requests retain their limit', async () => {
  const budgets = [];
  const page = boot('api.js', async () => ({ ok: true, status: 200, json: async () => ({ source: 'manual' }) }),
    { abortSignal: { timeout(ms) { budgets.push(ms); return {}; } } });
  assert.equal((await page.window.ClubAPI('/api/poster', { method: 'POST', body: {} })).source, 'manual');
  await page.window.ClubAPI('/api/events');
  assert.deepEqual(budgets, [35000, 10000]);
});


test('AC-7 poster fills capacity and description only when supplied and waits for confirmation', async () => {
  let suggestion = { title: 'Coding night', venue: 'Lab B102', startsAt: '', capacity: 40, description: 'Bring your own laptop.' };
  const writes = [];
  const api = async (path, options) => {
    if (path === '/api/clubs') return { clubs: [{ id: 1, name: 'Club' }] };
    writes.push(path); return { source: 'suggestion', suggestion, message: 'Check suggestions before saving.' };
  };
  class Reader { readAsDataURL() { this.result = 'data:image/jpeg;base64,fixture'; this.onload(); } }
  const page = boot('editor.js', null, { api, fileReader: Reader }); await tick();
  page.elements.get('#poster-file').files = [{ type: 'image/jpeg', size: 100 }];
  page.elements.get('#poster-consent').checked = true;
  const button = page.elements.get('#read-poster');
  await button.listeners.click({ currentTarget: button });
  assert.equal(page.elements.get('#capacity').value, 40);
  assert.equal(page.elements.get('#description').value, 'Bring your own laptop.');
  suggestion = { ...suggestion, capacity: null, description: '' };
  await button.listeners.click({ currentTarget: button });
  assert.equal(page.elements.get('#capacity').value, 40);
  assert.equal(page.elements.get('#description').value, 'Bring your own laptop.');
  assert.deepEqual(writes, ['/api/poster', '/api/poster']);
  assert.equal(page.navigations.length, 0);
});


test('AC-5 event form displays the precise server refusal and preserves inputs for correction', async () => {
  const page = boot('editor.js', null, { api: async (path) => {
    if (path === '/api/clubs') return { clubs: [{ id: 1, name: 'Club' }] };
    throw new Error('The event date and time are in the past or have already started. Choose a future date and time.');
  } }); await tick();
  const value = name => page.elements.get(`#${name}`);
  value('title').value = 'Coding night'; value('venue').value = 'Lab'; value('capacity').value = '40';
  value('description').value = 'Bring a laptop.'; value('club').value = '1'; value('startsAt').value = '2026-10-26T18:00';
  await value('event-form').listeners.submit({ preventDefault() {} });
  assert.match(value('save-message').textContent, /Choose a future date and time/);
  assert.equal(value('save-message').focused, true); assert.equal(value('save-message').scrolledIntoView, true);
  assert.equal(value('title').value, 'Coding night'); assert.equal(value('capacity').value, '40');
  assert.equal(value('save-event').disabled, false); assert.equal(page.navigations.length, 0);
  value('startsAt').value = '';
  await value('event-form').listeners.submit({ preventDefault() {} });
  assert.equal(value('save-message').textContent, 'Enter a valid event date and time.');
});
