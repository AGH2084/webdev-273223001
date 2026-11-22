CREATE FUNCTION enforce_registration_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE maximum INTEGER;
BEGIN
  SELECT capacity INTO maximum FROM events WHERE id=NEW.event_id FOR UPDATE;
  IF (SELECT COUNT(*) FROM registrations WHERE event_id=NEW.event_id) >= maximum THEN
    RAISE EXCEPTION 'event_capacity_exceeded' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER registrations_capacity_insert BEFORE INSERT ON registrations
FOR EACH ROW EXECUTE FUNCTION enforce_registration_capacity();

CREATE FUNCTION enforce_event_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.capacity < (SELECT COUNT(*) FROM registrations WHERE event_id=NEW.id) THEN
    RAISE EXCEPTION 'capacity_below_registrations' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER events_capacity_update BEFORE UPDATE OF capacity ON events
FOR EACH ROW EXECUTE FUNCTION enforce_event_capacity();
