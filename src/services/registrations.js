const { AppError } = require('./errors');
const validId = id => {
  if (!Number.isSafeInteger(id) || id < 1) throw new AppError('InvalidInput', 'Choose a valid event or registration.');
};
function registrationsService(data, auth, clock = () => new Date()) {
  return {
    register(token, eventId) {
      const user = auth.requireUser(token); validId(eventId);
      return data.transaction(() => {
        const event = data.event(eventId);
        if (!event) throw new AppError('NotFound', 'This event could not be found.');
        if (new Date(event.starts_at) <= clock()) throw new AppError('EventPast', 'This event has already started.');
        if (data.registrationFor(user.id, eventId)) throw new AppError('AlreadyRegistered', 'You are already registered for this event.');
        if (event.registered >= event.capacity) throw new AppError('EventFull', 'This event is full');
        return data.addRegistration(user.id, eventId);
      });
    },
    cancel(token, id) {
      const user = auth.requireUser(token); validId(id);
      return data.transaction(() => {
        const registration = data.registration(id);
        if (!registration) throw new AppError('NotFound', 'This registration could not be found.');
        if (registration.user_id !== user.id) throw new AppError('Forbidden', 'Only the member who registered may cancel this place.');
        data.removeRegistration(id);
      });
    },
    mine(token) { return data.myRegistrations(auth.requireUser(token).id); },
  };
}
module.exports = { registrationsService, validId };
