const { openDatabase } = require('../src/data/database');
const { listEvents } = require('../src/data/inspection');
if (process.argv[2] !== 'list') throw new Error('Usage: npm run db -- list');
const db = openDatabase();
try { console.table(listEvents(db)); } finally { db.close(); }
