function repository(db) {
  return {
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
