// Explicit development fixtures. This is never run by server startup.
function seedDemo(db, passwordHash, now = new Date()) {
  if (db.prepare('SELECT id FROM users LIMIT 1').get()) return false;
  const date = (days, hour) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + days);
    d.setUTCHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  db.exec('BEGIN');
  try {
    const addUser = db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)');
    addUser.run(1, 'member@example.test', 'Alex Petrova', passwordHash, 'member');
    addUser.run(2, 'organiser@example.test', 'Boris Ivanov', passwordHash, 'organiser');
    db.prepare('INSERT INTO clubs VALUES (?, ?, ?)').run(1, 'Informatics Club', 2);
    const addEvent = db.prepare('INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    addEvent.run(1, 1, 2, 'Build night', 'Bring a small project and work alongside other members.', date(2, 16), 'Room 1250, TU Sofia', 24);
    addEvent.run(2, 1, 2, 'Board games after class', 'An evening of cooperative games. Beginners are welcome.', date(5, 16), 'Student common room', 12);
    addEvent.run(3, 1, 2, 'Web accessibility workshop', 'Try keyboard navigation and improve a small web page together.', date(9, 14), 'Lab 2310, TU Sofia', 18);
    addEvent.run(4, 1, 2, 'Last month’s club meetup', 'Past fixture: must never appear in the upcoming agenda.', date(-30, 16), 'Student common room', 20);
    db.prepare('INSERT INTO registrations (user_id, event_id) VALUES (?, ?)').run(2, 1);
    db.exec('COMMIT');
    return true;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
function rotateDemoPassword(db, passwordHash) {
  const users = db.prepare("SELECT id FROM users WHERE email IN ('member@example.test', 'organiser@example.test')").all();
  if (users.length !== 2) throw new Error('Both local demo accounts must exist before rotation.');
  db.exec('BEGIN');
  try {
    for (const user of users) {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
module.exports = { seedDemo, rotateDemoPassword };
