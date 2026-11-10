import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { openDb } from "../server/db.js";
import { seed } from "../server/seed.js";

test("v9 allocation migration preserves corrected history and enforces one active pair", () => {
  const folder = mkdtempSync(join(tmpdir(), "finbiz-allocation-migration-"));
  const filename = join(folder, "legacy.db");
  let db = new DatabaseSync(filename);
  try {
    db.exec("PRAGMA foreign_keys=ON");
    const source = readFileSync(
      new URL("../server/db.js", import.meta.url),
      "utf8",
    );
    for (const [, sql] of source.matchAll(/db\.exec\(`([\s\S]*?)`\)/g)) {
      db.exec(sql);
      if (sql.includes("INSERT INTO migrations(version) VALUES (9)")) break;
    }
    seed(db, "Synthetic-migration-only-123!");
    const user = db
      .prepare("SELECT id FROM users WHERE role='finance'")
      .get().id;
    const invoice = db.prepare("SELECT id FROM invoices LIMIT 1").get().id;
    const tx = db
      .prepare(
        "SELECT id,contact_id,date FROM transactions WHERE direction='out' LIMIT 1",
      )
      .get();
    db.prepare(
      "INSERT INTO payment_allocations VALUES('old-invoice',?,?,100)",
    ).run(invoice, tx.id);
    db.prepare(
      "INSERT INTO allocation_corrections(allocation_id,reason,user_id) VALUES('old-invoice','Retained invoice correction',?)",
    ).run(user);
    db.prepare(
      "INSERT INTO supplier_bills(id,number,contact_id,issued,due,amount,description,user_id) VALUES('bill','MIGRATION-BILL',?,?,?,1000,'Synthetic bill',?)",
    ).run(tx.contact_id, tx.date, tx.date, user);
    db.prepare(
      "INSERT INTO supplier_allocations VALUES('old-supplier','bill',?,100)",
    ).run(tx.id);
    db.prepare(
      "INSERT INTO supplier_allocation_corrections(allocation_id,reason,user_id) VALUES('old-supplier','Retained supplier correction',?)",
    ).run(user);
    const tables = [
      "payment_allocations",
      "allocation_corrections",
      "supplier_allocations",
      "supplier_allocation_corrections",
      "transactions",
      "audit_events",
    ];
    const before = tables.map((name) =>
      db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all(),
    );
    db.close();
    db = openDb(filename);
    for (const [index, name] of tables.entries())
      assert.deepEqual(
        db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all(),
        before[index],
      );
    db.prepare(
      "INSERT INTO payment_allocations VALUES('new-invoice',?,?,200)",
    ).run(invoice, tx.id);
    assert.throws(
      () =>
        db
          .prepare(
            "INSERT INTO payment_allocations VALUES('duplicate-invoice',?,?,200)",
          )
          .run(invoice, tx.id),
      /already allocated/,
    );
    db.prepare(
      "INSERT INTO supplier_allocations VALUES('new-supplier','bill',?,200)",
    ).run(tx.id);
    assert.throws(
      () =>
        db
          .prepare(
            "INSERT INTO supplier_allocations VALUES('duplicate-supplier','bill',?,200)",
          )
          .run(tx.id),
      /already allocated/,
    );
    assert.throws(
      () =>
        db
          .prepare(
            "INSERT INTO payment_allocations VALUES('missing-parent','missing','missing',100)",
          )
          .run(),
      /FOREIGN KEY/,
    );
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(
      db.prepare("PRAGMA integrity_check").get().integrity_check,
      "ok",
    );
    db.close();
    db = openDb(filename);
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM payment_allocations").get().n,
      2,
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM supplier_allocations").get().n,
      2,
    );
  } finally {
    db.close();
    assert.ok(resolve(folder).startsWith(resolve(tmpdir()) + sep));
    rmSync(folder, { recursive: true, force: true });
  }
});

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
    assert.equal(db.prepare("SELECT COUNT(*) n FROM migrations").get().n, 11);
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
    assert.equal(db.prepare("SELECT COUNT(*) n FROM migrations").get().n, 11);
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
