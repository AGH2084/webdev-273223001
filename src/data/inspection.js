// Local inspection and isolated verification. Never called by HTTP or MCP.
function listEvents(db) {
  return db.prepare('SELECT id, title, starts_at, capacity FROM events ORDER BY starts_at').all();
}
function eventSnapshot(db, id) {
  return {
    event: db.prepare('SELECT * FROM events WHERE id = ?').get(id),
    registrations: db.prepare('SELECT * FROM registrations WHERE event_id = ?').all(id),
  };
}
function removeEvent(db, id) { db.prepare('DELETE FROM events WHERE id = ?').run(id); }
function restoreEvent(db, snapshot) {
  const e = snapshot.event;
  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(e.id, e.club_id, e.owner_id, e.title, e.description, e.starts_at, e.venue, e.capacity);
    for (const r of snapshot.registrations) {
      db.prepare('INSERT INTO registrations VALUES (?, ?, ?)').run(r.id, r.user_id, r.event_id);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
module.exports = { listEvents, eventSnapshot, removeEvent, restoreEvent };
