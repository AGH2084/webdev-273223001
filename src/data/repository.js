function repository(db) {
  if (db.kind === 'postgres') return require('./postgres-repository').postgresRepository(db.pool);
  return {
    health: () => db.prepare('SELECT 1 AS ok').get(),
    async transaction(work) {
      db.exec('BEGIN IMMEDIATE');
      try { const result = await work(); db.exec('COMMIT'); return result; }
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
    club: id => db.prepare('SELECT * FROM clubs WHERE id=?').get(id),
    ownedClubs: userId => db.prepare('SELECT id,name FROM clubs WHERE owner_id=? ORDER BY name').all(userId),
    attendees: eventId => db.prepare(`SELECT u.name FROM registrations r JOIN users u ON u.id=r.user_id WHERE r.event_id=? ORDER BY u.name`).all(eventId),
    addEvent(userId, event) {
      const r = db.prepare('INSERT INTO events (club_id,owner_id,title,description,starts_at,venue,capacity) VALUES (?,?,?,?,?,?,?)')
        .run(event.clubId, userId, event.title, event.description, event.startsAt, event.venue, event.capacity);
      return Number(r.lastInsertRowid);
    },
    removeEvent: id => db.prepare('DELETE FROM events WHERE id=?').run(id),
    updateEvent(id, event) { db.prepare('UPDATE events SET title=?,description=?,starts_at=?,venue=?,capacity=? WHERE id=?')
      .run(event.title, event.description, event.startsAt, event.venue, event.capacity, id); },
    storeOAuthState: (hash, verifier, expires) => db.prepare('INSERT INTO oauth_states VALUES (?,?,?)').run(hash, verifier, expires),
    consumeOAuthState(hash, now) {
      const row = db.prepare('DELETE FROM oauth_states WHERE state_hash=? RETURNING *').get(hash);
      return row && row.expires_at > now ? row : null;
    },
    providerUser: subject => db.prepare('SELECT u.* FROM users u JOIN provider_accounts p ON p.user_id=u.id WHERE p.provider_id=?').get(subject),
    linkProvider: (subject, userId) => db.prepare('INSERT INTO provider_accounts VALUES (?,?)').run(subject, userId),
    createProviderUser(email, name, passwordHash) {
      const result = db.prepare("INSERT INTO users (email,name,password_hash,role) VALUES (?,?,?,'member')").run(email, name, passwordHash);
      return { id: Number(result.lastInsertRowid), email, name, role: 'member' };
    },
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
