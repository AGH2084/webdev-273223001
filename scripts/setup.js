const { openDatabase } = require('../src/data/database');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  throw new Error('Use Node.js 22.13 or newer for built-in SQLite.');
}
const db = openDatabase();
db.close();
console.log('Database ready. No dependencies required. Next: npm run seed, then npm start.');
