const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

function fakeNode(tag = 'div') {
  const classes = new Set();
  return { tag, className: '', textContent: '', children: [], attributes: {}, listeners: {}, hidden: false,
    classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) },
    append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; },
    setAttribute(key, value) { this.attributes[key] = value; }, addEventListener(key, fn) { this.listeners[key] = fn; } };
}
function boot(script, fetch) {
  const elements = new Map();
  const document = { querySelector(selector) { if (!elements.has(selector)) elements.set(selector, fakeNode()); return elements.get(selector); },
    createElement: fakeNode, createTextNode: text => ({ textContent: text }) };
  const navigations = [];
  vm.runInNewContext(readFileSync(join(__dirname, '../src/web', script), 'utf8'), {
    document, fetch, AbortSignal, Intl, Date, Error, location: { assign: url => navigations.push(url) },
  }, { filename: join(__dirname, '../src/web', script) });
  return { elements, navigations };
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
