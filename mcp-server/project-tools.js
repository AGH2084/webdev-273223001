const { AppError } = require('../src/services/errors');
const emptySchema = { type: 'object', properties: {}, additionalProperties: false };
const tools = [
  { name: 'upcoming_events', description: 'Lists future club events with dates, venues and remaining places for the signed-in member.', inputSchema: emptySchema },
  { name: 'my_registrations', description: 'Lists the event registrations belonging to the member whose ordinary session token is configured.', inputSchema: emptySchema },
  { name: 'register', description: 'Registers the signed-in member for a future event, refusing full events and duplicate registrations.',
    inputSchema: { type: 'object', properties: { eventId: { type: 'integer', minimum: 1 } }, required: ['eventId'], additionalProperties: false } },
  { name: 'cancel_registration', description: 'Cancels a registration only when it belongs to the member whose ordinary session token is configured.',
    inputSchema: { type: 'object', properties: { registrationId: { type: 'integer', minimum: 1 } }, required: ['registrationId'], additionalProperties: false } },
];
async function callProjectTool(services, token, name, args) {
  try {
    let result;
    if (name === 'upcoming_events') result = (await services.events.list(token)).events;
    else if (name === 'my_registrations') result = await services.registrations.mine(token);
    else if (name === 'register') result = await services.registrations.register(token, args.eventId);
    else { await services.registrations.cancel(token, args.registrationId); result = { cancelled: true }; }
    return { content: [{ type: 'text', text: JSON.stringify(result) }], isError: false };
  } catch (error) {
    const message = error instanceof AppError ? error.message : 'The request could not be completed.';
    return { content: [{ type: 'text', text: message }], isError: true };
  }
}
module.exports = { projectTools: tools, callProjectTool };
