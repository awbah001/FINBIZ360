import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { openDb } from "../server/db.js";
import { seed } from "../server/seed.js";

test("upgrading a populated v2 database preserves every existing transaction, invoice, user and audit event", () => {
  const folder = mkdtempSync(join(tmpdir(), "finbiz-v2-migration-")),
    filename = join(folder, "legacy.db");
  let db = new DatabaseSync(filename);
  try {
    // Execute the retained historical v1/v2 schemas, without running new migrations.
    const source = readFileSync(
      new URL("../server/db.js", import.meta.url),
      "utf8",
    );
    const historical = source.match(
      /CREATE TABLE settings[\s\S]+?INSERT INTO migrations\(version\) VALUES \(1\);/,
    )[0];
    db.exec(
      "PRAGMA foreign_keys=ON; CREATE TABLE migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
    );
    db.exec(historical);
    db.exec(
      "ALTER TABLE settings ADD COLUMN mode TEXT NOT NULL DEFAULT 'live' CHECK(mode IN ('live','demo')); INSERT INTO migrations(version) VALUES(2);",
    );
    seed(db, "Migration-test-only-password-123");
    const transactions = db
        .prepare("SELECT * FROM transactions ORDER BY id")
        .all(),
      invoices = db.prepare("SELECT * FROM invoices ORDER BY id").all(),
      users = db.prepare("SELECT * FROM users ORDER BY id").all(),
      events = db.prepare("SELECT * FROM audit_events ORDER BY id").all();
    db.close();
    db = openDb(filename);
    assert.deepEqual(
      db.prepare("SELECT * FROM transactions ORDER BY id").all(),
      transactions,
    );
    assert.deepEqual(
      db
        .prepare(
          "SELECT id,number,contact_id,issued,due,amount,description,user_id FROM invoices ORDER BY id",
        )
        .all(),
      invoices,
    );
    assert.deepEqual(
      db.prepare("SELECT * FROM users ORDER BY id").all(),
      users,
    );
    assert.deepEqual(
      db.prepare("SELECT * FROM audit_events ORDER BY id").all(),
      events,
    );
    assert.equal(db.prepare("SELECT COUNT(*) n FROM migrations").get().n, 7);
    assert.equal(
      db.prepare("SELECT SUM(opening_amount) n FROM accounts").get().n,
      0,
    );
    assert.equal(
      db.prepare("PRAGMA integrity_check").get().integrity_check,
      "ok",
    );
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    db.close();
    db = openDb(filename);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM migrations").get().n, 7);
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM transactions").get().n,
      transactions.length,
    );
  } finally {
    db.close();
    assert.ok(resolve(folder).startsWith(resolve(tmpdir()) + sep));
    rmSync(folder, { recursive: true, force: true });
  }
});
