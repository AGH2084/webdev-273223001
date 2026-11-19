const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { openDatabase } = require('../src/data/database');
const { seedDemo } = require('../src/data/seed');
const { listEvents, removeEvent, restoreEvent, eventSnapshot } = require('../src/data/inspection');

test('AC-12 file database persists removals across reopen and migrations never reseed', () => {
  // Keep the isolated temporary directory: repository instructions require permission before deleting files.
  const file = join(mkdtempSync(join(tmpdir(), 'club-calendar-proof-')), 'proof.db');
  let db = openDatabase(file);
  try {
    seedDemo(db, 'test-only-not-a-real-password-hash');
    const snapshot = eventSnapshot(db, 1);
    removeEvent(db, 1);
    db.close();
    db = openDatabase(file);
    assert.equal(listEvents(db).some(e => e.id === 1), false);
    assert.equal(seedDemo(db, 'unused'), false);
    assert.equal(listEvents(db).some(e => e.id === 1), false);
    restoreEvent(db, snapshot);
    assert.equal(listEvents(db).some(e => e.id === 1), true);
  } finally { db.close(); }
});
