const list = document.querySelector('#event-list');
const message = document.querySelector('#events-message');
const retry = document.querySelector('#retry');
const refresh = document.querySelector('#refresh');
const count = document.querySelector('#event-count');
const timeOptions = { timeZone: 'Europe/Sofia' };
const datePart = (date, options) => new Intl.DateTimeFormat('en-GB', { ...timeOptions, ...options }).format(date);
const node = (tag, className, text) => {
  const element = document.createElement(tag); element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
let pending = false;
async function loadEvents() {
  if (pending) return;
  pending = true;
  message.classList.remove('error');
  message.textContent = 'Loading club events…';
  list.setAttribute('aria-busy', 'true');
  refresh.disabled = true;
  retry.hidden = true;
  try {
    const response = await fetch('/api/events', { signal: AbortSignal.timeout(10000) });
    if (response.status === 401) { location.assign('/login'); return; }
    const result = await response.json();
    if (!response.ok) throw new Error('Could not load your events. Please try again.');
    document.querySelector('#account-name').textContent = result.user.name;
    document.querySelector('#create-event').hidden = result.user.role !== 'organiser';
    list.replaceChildren();
    count.textContent = `${result.events.length} ${result.events.length === 1 ? 'event' : 'events'}`;
    message.textContent = result.events.length ? 'Your calendar is up to date.' : 'Nothing is scheduled yet. Check back soon for your next club event.';
    for (const event of result.events) {
      const date = new Date(event.startsAt);
      const row = node('article', 'event-row');
      const dateBlock = node('div', 'date-block');
      dateBlock.setAttribute('aria-hidden', 'true');
      dateBlock.append(node('strong', '', datePart(date, { day: '2-digit' })), node('span', '', datePart(date, { month: 'short' })));
      const content = node('div', 'event-content');
      const dateTime = node('time', '', datePart(date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
      dateTime.dateTime = event.startsAt;
      const details = node('p', 'event-details'); details.append(dateTime, document.createTextNode(` · ${event.venue}`));
      content.append(node('h3', '', event.title), node('p', 'event-meta', event.club), details,
        node('p', 'event-description', event.description),
        node('p', 'event-places', `${event.freePlaces} of ${event.capacity} places free`));
      const view = node('a', 'event-link', 'View event'); view.href = `/event?id=${event.id}`; content.append(view);
      row.append(dateBlock, content); list.append(row);
    }
  } catch {
    list.replaceChildren();
    count.textContent = '';
    message.classList.add('error');
    message.textContent = 'Could not load your events. Check your connection and try again.';
    retry.hidden = false;
  } finally {
    list.setAttribute('aria-busy', 'false'); refresh.disabled = false; pending = false;
  }
}
refresh.addEventListener('click', loadEvents);
retry.addEventListener('click', loadEvents);
document.querySelector('#sign-out').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  const status = document.querySelector('#sign-out-message');
  status.textContent = 'Signing out…';
  try {
    const response = await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000) });
    if (!response.ok && response.status !== 401) throw new Error();
    location.assign('/login');
  } catch {
    status.textContent = 'Could not sign out. Please try again.';
    status.classList.add('error'); button.disabled = false;
  }
});
loadEvents();
