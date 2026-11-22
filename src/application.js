const { openPostgres } = require('./data/postgres');
const { configuration } = require('./config');
const { repository } = require('./data/repository');
const { authService } = require('./services/auth');
const { eventsService } = require('./services/events');
const { registrationsService } = require('./services/registrations');

function openApplication() {
  const db = openPostgres(configuration().databaseUrl);
  const data = repository(db);
  const auth = authService(data);
  return { auth, events: eventsService(data, auth), registrations: registrationsService(data, auth), close: () => db.close() };
}
module.exports = { openApplication };
