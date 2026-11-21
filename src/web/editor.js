const editId = Number(new URLSearchParams(location.search).get('id'));
const eventForm = document.querySelector('#event-form');
const editorMessage = document.querySelector('#editor-message');
const editorRetry = document.querySelector('#editor-retry');
const field = name => document.querySelector(`#${name}`);
const localTime = value => { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
let posterVersion = 0;
async function loadEditor() {
  editorMessage.classList.remove('error'); editorMessage.textContent = 'Loading event form…'; editorRetry.hidden = true;
  try {
    const { clubs } = await window.ClubAPI('/api/clubs');
    if (!clubs.length) { editorMessage.textContent = 'You do not own a club yet. Ask your club administrator about organiser access.'; return; }
    field('club').replaceChildren();
    for (const club of clubs) { const option = document.createElement('option'); option.value = club.id; option.textContent = club.name; field('club').append(option); }
    if (editId) {
      const result = await window.ClubAPI(`/api/events/${editId}`);
      if (!result.canEdit) throw new Error('Only the event owner may edit it.');
      document.querySelector('#editor-title').textContent = 'Edit event';
      for (const name of ['title', 'venue', 'capacity', 'description']) field(name).value = result.event[name];
      field('startsAt').value = localTime(result.event.startsAt); field('club').value = result.event.clubId; field('club').disabled = true;
    }
    document.querySelector('#editor-content').hidden = false; editorMessage.textContent = 'Complete the details, then confirm to save.';
  } catch (error) { editorMessage.classList.add('error'); editorMessage.textContent = error.message || 'Could not load the event form. Please try again.'; editorRetry.hidden = false; }
}
eventForm.addEventListener('submit', async event => {
  const saveMessage = document.querySelector('#save-message');
  event.preventDefault(); const save = document.querySelector('#save-event'); save.disabled = true;
  saveMessage.classList.remove('error'); saveMessage.textContent = 'Saving event…';
  try {
    const startsAt = new Date(field('startsAt').value);
    if (!Number.isFinite(startsAt.getTime())) throw new Error('Enter a valid event date and time.');
    const body = { title: field('title').value, venue: field('venue').value, capacity: Number(field('capacity').value),
      description: field('description').value, startsAt: startsAt.toISOString(), clubId: Number(field('club').value) };
    const result = await window.ClubAPI(editId ? `/api/events/${editId}` : '/api/events', { method: editId ? 'PATCH' : 'POST', body });
    saveMessage.textContent = 'Event saved.'; location.assign(`/event?id=${result.id}`);
  } catch (error) { saveMessage.classList.add('error'); saveMessage.textContent = error.message || 'Could not save the event. Check the details and try again.';
    saveMessage.focus({ preventScroll: true }); saveMessage.scrollIntoView({ block: 'nearest' }); }
  finally { save.disabled = false; }
});
document.querySelector('#read-poster').addEventListener('click', async event => {
  const status = document.querySelector('#poster-message'); const file = field('poster-file').files[0];
  status.classList.remove('error');
  let mimeType = file?.type?.toLowerCase() || '';
  if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
  if (file && !mimeType) {
    if (/\.jpe?g$/i.test(file.name)) mimeType = 'image/jpeg';
    else if (/\.png$/i.test(file.name)) mimeType = 'image/png';
  }
  let validationMessage = '';
  if (!file) validationMessage = 'Choose a poster image first.';
  else if (!['image/png', 'image/jpeg'].includes(mimeType)) validationMessage = 'Choose a PNG or JPEG image. This file type is not supported.';
  else if (file.size > 1048576) validationMessage = 'Choose an image up to 1 MB (1,048,576 bytes).';
  else if (!field('poster-consent').checked) validationMessage = 'Confirm sending this selected poster to Google by checking the consent box.';
  if (validationMessage) {
    status.classList.add('error'); status.textContent = validationMessage; return;
  }
  const version = ++posterVersion;
  const button = event.currentTarget; button.disabled = true; status.textContent = 'Reading the poster…';
  try {
    const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
    if (version !== posterVersion) return;
    const result = await window.ClubAPI('/api/poster', { method: 'POST', body: { mimeType, data, consent: true } });
    if (version !== posterVersion) return;
    if (result.suggestion) {
      field('title').value = result.suggestion.title; field('venue').value = result.suggestion.venue;
      field('startsAt').value = result.suggestion.startsAt ? localTime(result.suggestion.startsAt) : '';
      if (result.suggestion.capacity != null) field('capacity').value = result.suggestion.capacity;
      if (result.suggestion.description) field('description').value = result.suggestion.description;
    }
    status.textContent = result.message;
    if (result.source === 'manual') status.classList.add('error');
  } catch { if (version !== posterVersion) return; status.classList.add('error'); status.textContent = 'Poster assistance failed. Enter the event details manually.'; }
  finally { if (version === posterVersion) button.disabled = false; }
});
editorRetry.addEventListener('click', loadEditor);
loadEditor();

function clearPosterSelection() {
  posterVersion++;
  field('poster-consent').checked = false;
  document.querySelector('#read-poster').disabled = false;
  document.querySelector('#poster-message').classList.remove('error');
  document.querySelector('#poster-message').textContent = 'Poster selection cleared. Event details are unchanged.';
}
document.querySelector('#remove-poster').addEventListener('click', () => {
  field('poster-file').value = '';
  clearPosterSelection();
});
field('poster-file').addEventListener('change', () => {
  clearPosterSelection();
  const file = field('poster-file').files[0];
  document.querySelector('#poster-message').textContent = file
    ? 'Poster selected. Check the consent box, then choose Suggest details from poster.'
    : 'Choose a poster image to suggest event details.';
});
