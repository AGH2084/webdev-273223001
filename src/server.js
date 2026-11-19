const { openDatabase } = require('./data/database');
const { createApp } = require('./routes/app');
const db = openDatabase();
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
const app = createApp(db, { secureCookies: process.env.PUBLIC_BASE_URL?.startsWith('https://') === true });
app.listen(port, '0.0.0.0', () => console.log(`Club Calendar listening on http://localhost:${port}`));
function shutdown() { app.close(() => { db.close(); process.exit(0); }); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
