const { AsyncLocalStorage } = require('node:async_hooks');
function postgresRepository(pool) {
  const scope = new AsyncLocalStorage();
  const query = (sql, values) => (scope.getStore() || pool).query(sql, values);
  const one = async (sql, values) => (await query(sql, values)).rows[0];
  const all = async (sql, values) => (await query(sql, values)).rows;
  return {
    health: () => one('SELECT 1 AS ok'),
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await scope.run(client, work);
        await client.query('COMMIT'); return result;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    async event(id) {
      // Lock before counting, so concurrent registration requests observe the latest committed count.
      if (scope.getStore()) await query('SELECT id FROM events WHERE id=$1 FOR UPDATE', [id]);
      return one(`SELECT e.*, c.name AS club, (SELECT COUNT(*)::int FROM registrations WHERE event_id=e.id) AS registered
        FROM events e JOIN clubs c ON c.id=e.club_id WHERE e.id=$1`, [id]);
    },
    registration: id => one('SELECT * FROM registrations WHERE id=$1', [id]),
    registrationFor: (userId, eventId) => one('SELECT * FROM registrations WHERE user_id=$1 AND event_id=$2', [userId, eventId]),
    addRegistration: (userId, eventId) => one('INSERT INTO registrations (user_id,event_id) VALUES ($1,$2) RETURNING id,user_id AS "userId",event_id AS "eventId"', [userId, eventId]),
    removeRegistration: id => query('DELETE FROM registrations WHERE id=$1', [id]),
    myRegistrations: userId => all(`SELECT r.id,r.event_id AS "eventId",e.title,e.starts_at AS "startsAt"
      FROM registrations r JOIN events e ON e.id=r.event_id WHERE r.user_id=$1 ORDER BY e.starts_at`, [userId]),
    club: id => one('SELECT * FROM clubs WHERE id=$1', [id]),
    ownedClubs: userId => all('SELECT id,name FROM clubs WHERE owner_id=$1 ORDER BY name', [userId]),
    attendees: eventId => all('SELECT u.name FROM registrations r JOIN users u ON u.id=r.user_id WHERE r.event_id=$1 ORDER BY u.name', [eventId]),
    async addEvent(userId, event) {
      const row = await one(`INSERT INTO events (club_id,owner_id,title,description,starts_at,venue,capacity)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [event.clubId,userId,event.title,event.description,event.startsAt,event.venue,event.capacity]);
      return row.id;
    },
    updateEvent: (id, event) => query('UPDATE events SET title=$1,description=$2,starts_at=$3,venue=$4,capacity=$5 WHERE id=$6',
      [event.title,event.description,event.startsAt,event.venue,event.capacity,id]),
    removeEvent: id => query('DELETE FROM events WHERE id=$1', [id]),
    storeOAuthState: (hash, verifier, expires) => query('INSERT INTO oauth_states VALUES ($1,$2,$3)', [hash,verifier,expires]),
    async consumeOAuthState(hash, now) {
      const row = await one('DELETE FROM oauth_states WHERE state_hash=$1 RETURNING *', [hash]);
      return row && row.expires_at > now ? row : null;
    },
    providerUser: subject => one('SELECT u.* FROM users u JOIN provider_accounts p ON p.user_id=u.id WHERE p.provider_id=$1', [subject]),
    linkProvider: (subject, userId) => query('INSERT INTO provider_accounts VALUES ($1,$2)', [subject,userId]),
    createProviderUser: (email, name, hash) => one("INSERT INTO users (email,name,password_hash,role) VALUES ($1,$2,$3,'member') RETURNING id,email,name,role", [email,name,hash]),
    findUser: email => one('SELECT * FROM users WHERE lower(email)=lower($1)', [email]),
    createSession: (digest, userId, expires) => query('INSERT INTO sessions VALUES ($1,$2,$3)', [digest,userId,expires]),
    sessionUser: (digest, now) => one(`SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=$1 AND s.expires_at>$2`, [digest,now]),
    revokeSession: digest => query('DELETE FROM sessions WHERE token_hash=$1', [digest]),
    upcoming: now => all(`SELECT e.id,e.title,e.description,e.starts_at,e.venue,e.capacity,c.name AS club,COUNT(r.id)::int AS registered
      FROM events e JOIN clubs c ON c.id=e.club_id LEFT JOIN registrations r ON r.event_id=e.id
      WHERE e.starts_at>$1 GROUP BY e.id,c.name ORDER BY e.starts_at,e.id`, [now]),
  };
}
module.exports = { postgresRepository };
