const { AppError } = require('./errors');
const { validId } = require('./registrations');

function eventManagement(data, auth, clock = () => new Date()) {
  const organiser = token => {
    const user = auth.requireUser(token);
    if (user.role !== 'organiser') throw new AppError('Forbidden', 'Only an organiser may manage events.');
    return user;
  };
  const input = body => {
    if (!body || typeof body !== 'object') throw new AppError('InvalidInput', 'Enter the event details.');
    const { title, description = '', startsAt, venue, capacity } = body;
    const date = new Date(startsAt);
    if (typeof title !== 'string' || !title.trim() || title.length > 120) {
      throw new AppError('InvalidInput', 'Enter an event title of 1 to 120 characters.');
    }
    if (typeof description !== 'string' || description.length > 2000) {
      throw new AppError('InvalidInput', 'Keep the event description within 2000 characters.');
    }
    if (typeof venue !== 'string' || !venue.trim() || venue.length > 160) {
      throw new AppError('InvalidInput', 'Enter a venue of 1 to 160 characters.');
    }
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 5000) {
      throw new AppError('InvalidInput', 'Enter a whole number of places from 1 to 5000.');
    }
    if (typeof startsAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{3})?)?Z$/.test(startsAt) ||
        !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 16) !== startsAt.slice(0, 16)) {
      throw new AppError('InvalidInput', 'Enter a valid event date and time.');
    }
    if (date <= clock()) {
      throw new AppError('InvalidInput', 'The event date and time are in the past or have already started. Choose a future date and time.');
    }
    return { title: title.trim(), description: description.trim(), startsAt: date.toISOString(), venue: venue.trim(), capacity };
  };
  const publicEvent = e => ({ id: e.id, clubId: e.club_id, club: e.club, title: e.title,
    description: e.description, startsAt: e.starts_at, venue: e.venue, capacity: e.capacity,
    freePlaces: Math.max(0, e.capacity - e.registered) });
  return {
    clubs(token) { return data.ownedClubs(organiser(token).id); },
    detail(token, id) {
      const user = auth.requireUser(token); validId(id);
      const event = data.event(id);
      if (!event) throw new AppError('NotFound', 'This event could not be found.');
      const canEdit = user.role === 'organiser' && event.owner_id === user.id;
      const registration = data.registrationFor(user.id, id);
      return { event: publicEvent(event), canEdit, registrationId: registration ? registration.id : null,
        attendees: canEdit ? data.attendees(id) : null };
    },
    create(token, body) {
      const user = organiser(token);
      const event = input(body); validId(body.clubId);
      const club = data.club(body.clubId);
      if (!club) throw new AppError('NotFound', 'This club could not be found.');
      if (club.owner_id !== user.id) throw new AppError('Forbidden', 'Only the club owner may publish its events.');
      const id = data.addEvent(user.id, { ...event, clubId: body.clubId });
      return { id };
    },
    remove(token, id) {
      const user = organiser(token); validId(id);
      return data.transaction(() => {
        const current = data.event(id);
        if (!current) throw new AppError('NotFound', 'This event could not be found.');
        if (current.owner_id !== user.id) throw new AppError('Forbidden', 'Only the event owner may delete this event.');
        data.removeEvent(id);
      });
    },
    edit(token, id, body) {
      const user = organiser(token); validId(id);
      return data.transaction(() => {
        const current = data.event(id);
        if (!current) throw new AppError('NotFound', 'This event could not be found.');
        if (current.owner_id !== user.id) throw new AppError('Forbidden', 'Only the event owner may edit this event.');
        const event = input(body);
        if (event.capacity < current.registered) throw new AppError('CapacityConflict', 'Capacity cannot be lower than the number already registered.');
        data.updateEvent(id, event);
        return { id };
      });
    },
  };
}
module.exports = { eventManagement };
