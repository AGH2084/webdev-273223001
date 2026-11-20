function repository(db) {
  return {
    transaction(work) {
      db.exec('BEGIN IMMEDIATE');
      try { const result = work(); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    event: id => db.prepare(`SELECT e.*, c.name AS club,
      (SELECT COUNT(*) FROM registrations WHERE event_id=e.id) AS registered
      FROM events e JOIN clubs c ON c.id=e.club_id WHERE e.id=?`).get(id),
    registration: id => db.prepare('SELECT * FROM registrations WHERE id=?').get(id),
    registrationFor: (userId, eventId) => db.prepare('SELECT * FROM registrations WHERE user_id=? AND event_id=?').get(userId, eventId),
    addRegistration(userId, eventId) {
      const result = db.prepare('INSERT INTO registrations (user_id,event_id) VALUES (?,?)').run(userId, eventId);
      return { id: Number(result.lastInsertRowid), userId, eventId };
    },
    removeRegistration: id => db.prepare('DELETE FROM registrations WHERE id=?').run(id),
    myRegistrations: userId => db.prepare(`SELECT r.id, r.event_id AS eventId, e.title, e.starts_at AS startsAt
      FROM registrations r JOIN events e ON e.id=r.event_id WHERE r.user_id=? ORDER BY e.starts_at`).all(userId),
    findUser: email => db.prepare('SELECT * FROM users WHERE email = ?').get(email),
    createSession: (digest, userId, expires) => db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(digest, userId, expires),
    sessionUser: (digest, now) => db.prepare(`SELECT u.id, u.name, u.email, u.role FROM sessions s
      JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`).get(digest, now),
    revokeSession: digest => db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest),
    upcoming: now => db.prepare(`SELECT e.id, e.title, e.description, e.starts_at, e.venue,
      e.capacity, c.name AS club, COUNT(r.id) AS registered
      FROM events e JOIN clubs c ON c.id = e.club_id
      LEFT JOIN registrations r ON r.event_id = e.id
      WHERE e.starts_at > ? GROUP BY e.id ORDER BY e.starts_at, e.id`).all(now),
  };
}
module.exports = { repository };
