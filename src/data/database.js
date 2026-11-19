const { DatabaseSync } = require('node:sqlite');
const { mkdirSync, readdirSync, readFileSync } = require('node:fs');
const path = require('node:path');

const defaultPath = path.resolve(__dirname, '../../data/club-calendar.db');

function openDatabase(filename = defaultPath) {
  if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)');
  const directory = path.resolve(__dirname, '../../migrations');
  for (const name of readdirSync(directory).filter(n => /^\d+_.+\.sql$/.test(n)).sort()) {
    if (db.prepare('SELECT name FROM schema_migrations WHERE name = ?').get(name)) continue;
    db.exec('BEGIN');
    try {
      db.exec(readFileSync(path.join(directory, name), 'utf8'));
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(name);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      db.close();
      throw error;
    }
  }
  return db;
}

module.exports = { openDatabase, defaultPath };
