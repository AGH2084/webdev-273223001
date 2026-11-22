async function seedPostgres(db, hash, now = new Date()) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(273223002)');
    if ((await client.query('SELECT id FROM users LIMIT 1')).rowCount) { await client.query('COMMIT'); return false; }
    await client.query("INSERT INTO users (id,email,name,password_hash,role) VALUES (1,'member@example.test','Alex Petrova',$1,'member'),(2,'organiser@example.test','Boris Ivanov',$1,'organiser')", [hash]);
    await client.query("INSERT INTO clubs (id,name,owner_id) VALUES (1,'Informatics Club',2)");
    const date = (days, hour) => { const d = new Date(now); d.setUTCDate(d.getUTCDate()+days); d.setUTCHours(hour,0,0,0); return d.toISOString(); };
    for (const event of [
      [1,'Build night','Bring a small project and work alongside other members.',date(2,16),'Room 1250, TU Sofia',24],
      [2,'Board games after class','Beginners are welcome.',date(5,16),'Student common room',12],
      [3,'Web accessibility workshop','Try keyboard navigation together.',date(9,14),'Lab 2310, TU Sofia',18],
      [4,'Last month’s club meetup','Past fixture.',date(-30,16),'Student common room',20],
    ]) await client.query('INSERT INTO events (id,club_id,owner_id,title,description,starts_at,venue,capacity) VALUES ($1,1,2,$2,$3,$4,$5,$6)', event);
    await client.query('INSERT INTO registrations (user_id,event_id) VALUES (2,1)');
    for (const table of ['users','clubs','events']) await client.query(`SELECT setval(pg_get_serial_sequence('${table}','id'),(SELECT MAX(id) FROM ${table}))`);
    await client.query('COMMIT'); return true;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function rotatePostgresPassword(db, hash) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const users = await client.query("SELECT id FROM users WHERE email IN ('member@example.test','organiser@example.test') FOR UPDATE");
    if (users.rowCount !== 2) throw new Error('Both local demo accounts must exist before rotation.');
    const ids = users.rows.map(row => row.id);
    await client.query('UPDATE users SET password_hash=$1 WHERE id=ANY($2::int[])', [hash,ids]);
    await client.query('DELETE FROM sessions WHERE user_id=ANY($1::int[])', [ids]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
module.exports = { seedPostgres, rotatePostgresPassword };
