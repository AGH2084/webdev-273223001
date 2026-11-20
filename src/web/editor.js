const editId = Number(new URLSearchParams(location.search).get('id'));
const eventForm = document.querySelector('#event-form');
const editorMessage = document.querySelector('#editor-message');
const editorRetry = document.querySelector('#editor-retry');
const field = name => document.querySelector(`#${name}`);
const localTime = value => { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
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
  event.preventDefault(); const save = document.querySelector('#save-event'); save.disabled = true;
  editorMessage.classList.remove('error'); editorMessage.textContent = 'Saving event…';
  try {
    const body = { title: field('title').value, venue: field('venue').value, capacity: Number(field('capacity').value),
      description: field('description').value, startsAt: new Date(field('startsAt').value).toISOString(), clubId: Number(field('club').value) };
    const result = await window.ClubAPI(editId ? `/api/events/${editId}` : '/api/events', { method: editId ? 'PATCH' : 'POST', body });
    editorMessage.textContent = 'Event saved.'; location.assign(`/event?id=${result.id}`);
  } catch (error) { editorMessage.classList.add('error'); editorMessage.textContent = error.message || 'Could not save the event. Check the details and try again.'; }
  finally { save.disabled = false; }
});
document.querySelector('#read-poster').addEventListener('click', async event => {
  const status = document.querySelector('#poster-message'); const file = field('poster-file').files[0];
  status.classList.remove('error');
  if (!file || !field('poster-consent').checked || !['image/png', 'image/jpeg'].includes(file.type) || file.size > 1048576) {
    status.classList.add('error'); status.textContent = 'Choose a PNG or JPEG up to 1 MB and confirm sending the selected image.'; return;
  }
  const button = event.currentTarget; button.disabled = true; status.textContent = 'Reading the poster…';
  try {
    const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
    const result = await window.ClubAPI('/api/poster', { method: 'POST', body: { mimeType: file.type, data, consent: true } });
    if (result.suggestion) {
      field('title').value = result.suggestion.title; field('venue').value = result.suggestion.venue;
      field('startsAt').value = result.suggestion.startsAt ? localTime(result.suggestion.startsAt) : '';
    }
    status.textContent = result.message;
    if (result.source === 'manual') status.classList.add('error');
  } catch { status.classList.add('error'); status.textContent = 'Poster assistance failed. Enter the event details manually.'; }
  finally { button.disabled = false; }
});
editorRetry.addEventListener('click', loadEditor);
loadEditor();
