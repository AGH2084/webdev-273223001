const eventId = Number(new URLSearchParams(location.search).get('id'));
const detailMessage = document.querySelector('#detail-message');
const detailRetry = document.querySelector('#detail-retry');
const registerButton = document.querySelector('#register-event');
const cancelButton = document.querySelector('#cancel-event');
let registrationId = null;
async function loadDetail(notice = '') {
  detailMessage.classList.remove('error'); detailMessage.textContent = 'Loading event…'; detailRetry.hidden = true;
  try {
    const result = await window.ClubAPI(`/api/events/${eventId}`);
    const event = result.event; registrationId = result.registrationId;
    document.title = `${event.title} · Club Calendar`;
    document.querySelector('#event-title').textContent = event.title;
    document.querySelector('#event-club').textContent = event.club;
    document.querySelector('#event-time').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Sofia', dateStyle: 'full', timeStyle: 'short' }).format(new Date(event.startsAt)) + ' (Sofia time)';
    document.querySelector('#event-venue').textContent = event.venue;
    document.querySelector('#event-description').textContent = event.description;
    document.querySelector('#event-capacity').textContent = `${event.freePlaces} of ${event.capacity} places free`;
    registerButton.hidden = registrationId !== null;
    cancelButton.hidden = registrationId === null;
    registerButton.disabled = event.freePlaces === 0 || new Date(event.startsAt) <= new Date();
    registerButton.textContent = event.freePlaces === 0 ? 'Event full' : 'Register';
    const edit = document.querySelector('#edit-event'); edit.hidden = !result.canEdit; edit.href = `/event/edit?id=${eventId}`;
    const attendees = document.querySelector('#attendees'); attendees.replaceChildren();
    document.querySelector('#attendees-panel').hidden = !result.canEdit;
    if (result.canEdit) {
      document.querySelector('#attendees-empty').hidden = result.attendees.length !== 0;
      for (const member of result.attendees) { const item = document.createElement('li'); item.textContent = member.name; attendees.append(item); }
    }
    document.querySelector('#event-detail').hidden = false;
    detailMessage.textContent = notice || (registrationId !== null ? 'You have a place at this event.' : 'Choose Register to reserve your place.');
  } catch {
    document.querySelector('#event-detail').hidden = true;
    document.querySelector('#attendees-panel').hidden = true;
    detailMessage.classList.add('error'); detailMessage.textContent = 'Could not load this event. Please try again.'; detailRetry.hidden = false;
  }
}
async function registrationAction(cancel) {
  registerButton.disabled = true; cancelButton.disabled = true;
  detailMessage.textContent = cancel ? 'Cancelling your place…' : 'Reserving your place…';
  try {
    await window.ClubAPI(cancel ? `/api/registrations/${registrationId}` : '/api/registrations',
      cancel ? { method: 'DELETE' } : { method: 'POST', body: { eventId } });
    await loadDetail(cancel ? 'Your registration was cancelled. The place is available again.' : 'Your place is reserved.');
  } catch (error) { detailMessage.classList.add('error'); detailMessage.textContent = error.message || 'Could not update your registration. Please try again.'; }
  finally { cancelButton.disabled = false; if (!registerButton.hidden && registerButton.textContent === 'Register') registerButton.disabled = false; }
}
registerButton.addEventListener('click', () => registrationAction(false));
cancelButton.addEventListener('click', () => registrationAction(true));
detailRetry.addEventListener('click', () => loadDetail());
loadDetail();
