CREATE TRIGGER registrations_capacity_insert BEFORE INSERT ON registrations
WHEN (SELECT COUNT(*) FROM registrations WHERE event_id = NEW.event_id) >=
     (SELECT capacity FROM events WHERE id = NEW.event_id)
BEGIN SELECT RAISE(ABORT, 'event_capacity_exceeded'); END;

CREATE TRIGGER events_capacity_update BEFORE UPDATE OF capacity ON events
WHEN NEW.capacity < (SELECT COUNT(*) FROM registrations WHERE event_id = NEW.id)
BEGIN SELECT RAISE(ABORT, 'capacity_below_registrations'); END;

CREATE TABLE provider_accounts (
  provider_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE oauth_states (
  state_hash TEXT PRIMARY KEY,
  verifier TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
