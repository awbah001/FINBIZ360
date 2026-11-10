import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { randomBytes } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openDb, id } from "../server/db.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";
import { businessDate } from "../server/role-data.js";
import {
  advanceMonth,
  budgetRows,
  prepareDueRecurring,
} from "../server/business-operations.js";
import { base32, totp, encrypt, decrypt } from "../server/security-crypto.js";
import {
  runEncryptedBackup,
  startBackupScheduler,
} from "../server/secure-backups.js";
import { restoreToNewFile } from "../server/restore.js";
let db, app, clients, cash, customer, supplier, category;
const password = "Synthetic-operations-tests-123!";
async function login(role, code) {
  const agent = request.agent(app),
    s = await agent.get("/api/session");
  const r = await agent
    .post("/api/login")
    .set("x-csrf-token", s.body.csrf)
    .send({ email: `${role}@finbiz.demo`, password, code });
  return { agent, csrf: r.body.csrf, response: r };
}
const send = (role, path, body = {}) =>
  clients[role].agent
    .post("/api" + path)
    .set("x-csrf-token", clients[role].csrf)
    .send(body);
beforeEach(async () => {
  db = openDb(":memory:");
  seed(db, password);
  app = createApp(db);
  clients = {};
  for (const role of ["admin", "manager", "finance", "cashier", "auditor"]) {
    clients[role] = await login(role);
    assert.equal(clients[role].response.status, 200);
  }
  cash = db.prepare("SELECT * FROM accounts WHERE channel='cash'").get();
  customer = db.prepare("SELECT * FROM contacts WHERE type='customer'").get();
  supplier = db.prepare("SELECT * FROM contacts WHERE type='supplier'").get();
  category = "Supplies";
});
afterEach(() => db.close());
test("cash shift records only its owner and account, closes once, and requires independent review", async () => {
  const open = await send("cashier", "/cash-shifts", {
    account_id: cash.id,
    opening: "100.00",
    request_key: id(),
  });
  assert.equal(open.status, 201, JSON.stringify(open.body));
  const sid = open.body.id;
  assert.equal(
    (
      await send("cashier", "/cash-shifts", {
        account_id: cash.id,
        opening: "0",
        request_key: id(),
      })
    ).status,
    409,
  );
  const transaction = {
    date: businessDate(),
    amount: "37.45",
    direction: "in",
    entry_kind: "sale",
    account_id: cash.id,
    reference: "SHIFT-TEST",
    description: "Synthetic shift receipt",
    category: "Sales",
    contact_id: customer.id,
    request_key: id(),
  };
  const sale = await send("cashier", "/transactions", transaction);
  assert.equal(sale.status, 201, JSON.stringify(sale.body));
  await send("cashier", "/transactions", transaction); // Retry must not duplicate the shift link.
  await send("finance", "/transactions", {
    ...transaction,
    request_key: id(),
    reference: "OTHER-CASHIER",
    amount: "10.00",
  });
  let row = (await clients.cashier.agent.get("/api/cash-shifts")).body.items[0];
  assert.equal(row.expected, "13745");
  assert.equal(row.entries.length, 1);
  assert.equal(
    (
      await send("finance", `/cash-shifts/${sid}/close`, {
        counted: "137.45",
        note: "Not my shift",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await send("cashier", `/cash-shifts/${sid}/close`, {
        counted: "137.00",
        note: "Count short by 0.45",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await send("cashier", `/cash-shifts/${sid}/close`, {
        counted: "200.00",
        note: "Retry",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await send("admin", `/cash-shifts/${sid}/review`, {
        decision: "approved",
        reason: "Admin is not a financial reviewer",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await send("manager", `/cash-shifts/${sid}/review`, {
        decision: "approved",
        reason: "Independent count review",
      })
    ).status,
    200,
  );
  row = (await clients.cashier.agent.get("/api/cash-shifts")).body.items[0];
  assert.equal(row.difference, "-45");
  assert.equal(row.expected, "13745");
  assert.equal(row.status, "approved");
  assert.equal((await clients.admin.agent.get("/api/cash-shifts")).status, 403);
  const other = id();
  db.prepare(
    "INSERT INTO users(id,name,email,password,role) SELECT ?, 'Other cashier','second@finbiz.demo',password,'cashier' FROM users WHERE role='cashier' LIMIT 1",
  ).run(other);
  db.prepare(
    "INSERT INTO cash_shifts(id,user_id,account_id,opening,request_key) VALUES(?,?,?,0,?)",
  ).run(id(), other, cash.id, id());
  assert.equal(
    (await clients.cashier.agent.get("/api/cash-shifts")).body.items.length,
    1,
  );
});
test("budgets exclude pending payments, preserve exact amounts and restrict changes to managers", async () => {
  const body = {
    month: businessDate().slice(0, 7),
    category,
    amount: "100.00",
    reason: "Monthly supplies budget",
  };
  assert.equal((await send("finance", "/budgets", body)).status, 403);
  assert.equal((await send("manager", "/budgets", body)).status, 200);
  const tx = await send("finance", "/transactions", {
    date: businessDate(),
    amount: "110.25",
    direction: "out",
    account_id: cash.id,
    reference: "BUDGET-TEST",
    description: "Budget test payment",
    category,
    contact_id: supplier.id,
    request_key: id(),
  });
  assert.equal(tx.status, 201);
  const before = budgetRows(db, body.month).find(
    (b) => b.category === category,
  );
  assert.equal(
    (
      await send("manager", `/approvals/${tx.body.id}`, {
        decision: "approved",
        reason: "Independent review",
      })
    ).status,
    200,
  );
  const after = budgetRows(db, body.month).find((b) => b.category === category);
  assert.equal(BigInt(after.actual) - BigInt(before.actual), 11025n);
  assert.equal(after.overspent, true);
  assert.equal((await clients.auditor.agent.get("/api/budgets")).status, 200);
  assert.equal((await clients.cashier.agent.get("/api/budgets")).status, 403);
  assert.equal(
    (await send("manager", "/budgets", { ...body, month: "2026-13" })).status,
    400,
  );
});
test("overdue documents retain assigned follow-ups and expose role-scoped snoozable reminders", async () => {
  const doc = (
    await clients.finance.agent.get("/api/followups")
  ).body.items.find((d) => d.kind === "customer");
  assert.ok(doc);
  const owner = db
    .prepare("SELECT id FROM users WHERE role='finance'")
    .get().id;
  const body = {
    kind: "customer",
    document_id: doc.id,
    owner_id: owner,
    promised_date: businessDate(),
    note: "Customer promises payment; follow up today",
  };
  assert.equal((await send("finance", "/followups", body)).status, 201);
  const rows = (await clients.finance.agent.get("/api/followups")).body.items;
  assert.equal(rows.find((d) => d.id === doc.id).followups[0].note, body.note);
  const reminders = (await clients.finance.agent.get("/api/reminders")).body
    .items;
  const item = reminders.find((r) => r.id.startsWith("promise:"));
  assert.ok(item);
  assert.equal(
    (
      await send("finance", "/reminders/state", {
        id: item.id,
        completed: false,
        snoozed_until: "2099-01-01",
      })
    ).status,
    200,
  );
  assert.ok(
    !(await clients.finance.agent.get("/api/reminders")).body.items.some(
      (r) => r.id === item.id,
    ),
  );
  assert.ok(
    !(await clients.admin.agent.get("/api/reminders")).body.items.some(
      (r) => r.page === "Collections & payables",
    ),
  );
  assert.equal((await send("auditor", "/followups", body)).status, 403);
  assert.equal((await clients.cashier.agent.get("/api/followups")).status, 403);
});
test("recurring schedules prepare reviewable drafts and expenses require independent approval", async () => {
  assert.equal(advanceMonth("2028-01-31", 1), "2028-02-29");
  const body = {
    kind: "expense",
    name: "Monthly supplies",
    contact_id: supplier.id,
    amount: "12.35",
    category,
    description: "Recurring synthetic expense",
    next_date: businessDate(),
    interval_months: 1,
    due_days: 30,
  };
  const template = await send("finance", "/recurring", body);
  assert.equal(template.status, 201, JSON.stringify(template.body));
  const count = db.prepare("SELECT COUNT(*) n FROM transactions").get().n;
  const draft = await send(
    "finance",
    `/recurring/${template.body.id}/prepare`,
    { occurrence: body.next_date },
  );
  assert.equal(draft.status, 201, JSON.stringify(draft.body));
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM transactions").get().n,
    count,
  );
  assert.equal(
    (
      await send("finance", `/recurring/${template.body.id}/prepare`, {
        occurrence: body.next_date,
      })
    ).status,
    200,
  );
  const publish = await send(
    "finance",
    `/recurring/drafts/${draft.body.id}/publish`,
    {
      reference: "RECURRING-TEST",
      account_id: cash.id,
      reason: "Reviewed scheduled expense",
    },
  );
  assert.equal(publish.status, 200, JSON.stringify(publish.body));
  const tx = db
    .prepare("SELECT * FROM transactions WHERE id=?")
    .get(publish.body.id);
  assert.equal(tx.approval, "pending");
  assert.equal(tx.amount, 1235);
  assert.equal(
    (
      await send("finance", `/approvals/${tx.id}`, {
        decision: "approved",
        reason: "Self review",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await send("finance", `/recurring/drafts/${draft.body.id}/publish`, {
        reference: "RECURRING-TEST",
        account_id: cash.id,
        reason: "Retry",
      })
    ).status,
    409,
  );
  assert.equal((await send("auditor", "/recurring", body)).status, 403);
  const invoice = await send("finance", "/recurring", {
    ...body,
    kind: "invoice",
    contact_id: customer.id,
  });
  const invDraft = await send(
    "finance",
    `/recurring/${invoice.body.id}/prepare`,
    { occurrence: body.next_date },
  );
  const inv = await send(
    "finance",
    `/recurring/drafts/${invDraft.body.id}/publish`,
    { reference: "RECURRING-INVOICE", reason: "Invoice draft review" },
  );
  assert.equal(inv.status, 200);
  assert.equal(
    db.prepare("SELECT lifecycle FROM invoices WHERE id=?").get(inv.body.id)
      .lifecycle,
    "draft",
  );
});
test("automatic recurring preparation is idempotent, retains month-end dates and never posts money", async () => {
  const template = await send("finance", "/recurring", {
    kind: "invoice",
    name: "Month-end service",
    contact_id: customer.id,
    amount: "25.30",
    description: "Monthly service",
    next_date: "2026-01-31",
    interval_months: 1,
    due_days: 14,
  });
  assert.equal(template.status, 201);
  const before = db.prepare("SELECT COUNT(*) n FROM transactions").get().n;
  assert.equal(prepareDueRecurring(db).length, 1);
  assert.equal(
    db
      .prepare("SELECT next_date FROM recurring_templates WHERE id=?")
      .get(template.body.id).next_date,
    "2026-02-28",
  );
  assert.equal(prepareDueRecurring(db).length, 1);
  assert.equal(
    db
      .prepare("SELECT next_date FROM recurring_templates WHERE id=?")
      .get(template.body.id).next_date,
    "2026-03-31",
  );
  const first = db
    .prepare(
      "SELECT id FROM recurring_drafts WHERE template_id=? AND occurrence=?",
    )
    .get(template.body.id, "2026-01-31");
  const retry = await send(
    "finance",
    `/recurring/${template.body.id}/prepare`,
    { occurrence: "2026-01-31" },
  );
  assert.equal(retry.status, 200);
  assert.equal(retry.body.id, first.id);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM transactions").get().n,
    before,
  );
  assert.equal(
    (
      await send("finance", `/recurring/${template.body.id}/toggle`, {
        active: false,
        reason: "Pause automated drafts",
      })
    ).status,
    200,
  );
  assert.equal(prepareDueRecurring(db).length, 0);
});

test("closed periods and restricted financial grants cannot be bypassed by recurring publication", async () => {
  const template = await send("finance", "/recurring", {
    kind: "expense",
    name: "Controlled expense",
    contact_id: supplier.id,
    amount: "5.25",
    category,
    description: "Scheduled expense",
    next_date: businessDate(),
    interval_months: 1,
    due_days: 0,
  });
  const draft = await send(
    "finance",
    `/recurring/${template.body.id}/prepare`,
    { occurrence: businessDate() },
  );
  const manager = db
    .prepare("SELECT id FROM users WHERE role='manager'")
    .get().id;
  db.prepare(
    "INSERT INTO periods(month,closed,reason,user_id) VALUES(?,1,'Closed test period',?)",
  ).run(businessDate().slice(0, 7), manager);
  const before = db.prepare("SELECT COUNT(*) n FROM transactions").get().n;
  assert.equal(
    (
      await send("finance", `/recurring/drafts/${draft.body.id}/publish`, {
        reference: "BLOCKED",
        account_id: cash.id,
        reason: "Blocked period",
      })
    ).status,
    409,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM transactions").get().n,
    before,
  );
  db.prepare("DELETE FROM periods WHERE month=?").run(
    businessDate().slice(0, 7),
  );
  const admin = db.prepare("SELECT id FROM users WHERE role='admin'").get().id;
  const roleId = id();
  db.prepare(
    "INSERT INTO access_roles(id,name,base_role,permissions,created_by) VALUES(?,'Schedule manager only','finance',?,?)",
  ).run(roleId, JSON.stringify(["finance.recurring.manage"]), admin);
  db.prepare("INSERT INTO user_access_roles VALUES(?,?)").run(
    db.prepare("SELECT id FROM users WHERE role='finance'").get().id,
    roleId,
  );
  assert.equal(
    (
      await send("finance", `/recurring/drafts/${draft.body.id}/publish`, {
        reference: "BLOCKED-GRANT",
        account_id: cash.id,
        reason: "No expense permission",
      })
    ).status,
    403,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM transactions").get().n,
    before,
  );
});

test("purchase orders require independent approval and reject mismatched or excessive bills", async () => {
  const body = {
    number: "PURCHASE-TEST",
    contact_id: supplier.id,
    description: "Stationery request",
    amount: "50.00",
  };
  const purchase = await send("manager", "/purchases", body);
  assert.equal(purchase.status, 201);
  assert.equal(
    (
      await send("manager", `/purchases/${purchase.body.id}/decide`, {
        decision: "approved",
        reason: "Self approval",
      })
    ).status,
    403,
  );
  const request2 = await send("finance", "/purchases", {
    ...body,
    number: "PURCHASE-FINANCE",
  });
  const pid = request2.body.id;
  assert.equal(
    (
      await send("finance", `/purchases/${pid}/order`, {
        number: "PO-BEFORE-APPROVAL",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await send("admin", `/purchases/${pid}/decide`, {
        decision: "approved",
        reason: "Not a financial manager",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await send("manager", `/purchases/${pid}/decide`, {
        decision: "approved",
        reason: "Independent budget review",
      })
    ).status,
    200,
  );
  assert.equal(
    (await send("finance", `/purchases/${pid}/order`, { number: "PO-TEST" }))
      .status,
    201,
  );
  const billBody = {
    number: "BILL-TOO-LARGE",
    contact_id: supplier.id,
    issued: businessDate(),
    due: businessDate(),
    amount: "50.01",
    description: "Purchase bill",
  };
  const large = await send("finance", "/supplier-bills", billBody);
  assert.equal(
    (
      await send("finance", `/purchases/${pid}/link-bill`, {
        bill_id: large.body.id,
        reason: "Too large",
      })
    ).status,
    409,
  );
  const bill = await send("finance", "/supplier-bills", {
    ...billBody,
    number: "BILL-VALID",
    amount: "49.99",
  });
  assert.equal(
    (
      await send("finance", `/purchases/${pid}/link-bill`, {
        bill_id: bill.body.id,
        reason: "Matches approved order",
      })
    ).status,
    200,
  );
  assert.equal((await clients.cashier.agent.get("/api/purchases")).status, 403);
});
test("TOTP matches RFC vectors and MFA requires password plus an unused second factor with one-use recovery", async () => {
  const oldKey = process.env.FINBIZ_SECURITY_KEY;
  process.env.FINBIZ_SECURITY_KEY = randomBytes(32).toString("hex");
  try {
    assert.equal(
      totp(base32(Buffer.from("12345678901234567890")), 1, 8),
      "94287082",
    );
    assert.equal(
      (await send("manager", "/mfa/setup", { current_password: "wrong" }))
        .status,
      403,
    );
    const setup = await send("manager", "/mfa/setup", {
      current_password: password,
    });
    assert.equal(setup.status, 200, JSON.stringify(setup.body));
    assert.ok(
      !JSON.stringify(
        db.prepare("SELECT * FROM mfa_credentials").all(),
      ).includes(setup.body.secret),
    );
    const counter = Math.floor(Date.now() / 30000),
      code = totp(setup.body.secret, counter);
    const enabled = await send("manager", "/mfa/enable", { code });
    assert.equal(enabled.status, 200);
    assert.equal(enabled.body.recovery_codes.length, 10);
    assert.equal((await login("manager")).response.status, 401);
    assert.equal((await login("manager", code)).response.status, 401);
    const recovered = await login("manager", enabled.body.recovery_codes[0]);
    assert.equal(recovered.response.status, 200);
    assert.equal(
      (await login("manager", enabled.body.recovery_codes[0])).response.status,
      401,
    );
    const fresh = await login("manager", totp(setup.body.secret, counter + 1));
    assert.equal(fresh.response.status, 200);
    assert.equal(
      (await fresh.agent.get("/api/mfa")).body.remaining_recovery,
      9,
    );
    const events = JSON.stringify(
      db.prepare("SELECT * FROM audit_events").all(),
    );
    assert.ok(!events.includes(setup.body.secret));
    assert.ok(!events.includes(enabled.body.recovery_codes[0]));
  } finally {
    if (oldKey === undefined) delete process.env.FINBIZ_SECURITY_KEY;
    else process.env.FINBIZ_SECURITY_KEY = oldKey;
  }
});
test("MFA setup expires and disabling requires both password and an unused factor", async () => {
  const previous = process.env.FINBIZ_SECURITY_KEY;
  process.env.FINBIZ_SECURITY_KEY = randomBytes(32).toString("hex");
  try {
    const first = await send("manager", "/mfa/setup", {
      current_password: password,
    });
    assert.equal(first.status, 200);
    db.prepare(
      "UPDATE mfa_credentials SET created_at=datetime('now','-16 minutes')",
    ).run();
    assert.equal(
      (
        await send("manager", "/mfa/enable", {
          code: totp(first.body.secret, Math.floor(Date.now() / 30000)),
        })
      ).status,
      409,
    );
    const fresh = await send("manager", "/mfa/setup", {
      current_password: password,
    });
    assert.equal(fresh.status, 200);
    const enabled = await send("manager", "/mfa/enable", {
      code: totp(fresh.body.secret, Math.floor(Date.now() / 30000)),
    });
    assert.equal(enabled.status, 200);
    assert.equal(
      (
        await send("manager", "/mfa/disable", {
          current_password: password,
          code: "invalid",
        })
      ).status,
      403,
    );
    assert.equal(
      (await clients.manager.agent.get("/api/mfa")).body.enabled,
      true,
    );
    assert.equal(
      (
        await send("manager", "/mfa/disable", {
          current_password: "wrong",
          code: enabled.body.recovery_codes[0],
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await send("manager", "/mfa/disable", {
          current_password: password,
          code: enabled.body.recovery_codes[0],
        })
      ).status,
      200,
    );
    assert.equal(
      (await clients.manager.agent.get("/api/mfa")).body.enabled,
      false,
    );
    assert.equal((await login("manager")).response.status, 200);
  } finally {
    if (previous === undefined) delete process.env.FINBIZ_SECURITY_KEY;
    else process.env.FINBIZ_SECURITY_KEY = previous;
  }
});

test("encrypted backups are authenticated, verified, retained and restore to a new file with sessions cleared", async () => {
  const folder = mkdtempSync(join(tmpdir(), "finbiz-encrypted-test-")),
    oldKey = process.env.FINBIZ_SECURITY_KEY,
    oldDir = process.env.FINBIZ_BACKUP_DIR;
  process.env.FINBIZ_SECURITY_KEY = randomBytes(32).toString("hex");
  process.env.FINBIZ_BACKUP_DIR = folder;
  try {
    assert.equal(
      (await clients.finance.agent.get("/api/secure-backups")).status,
      403,
    );
    db.prepare("UPDATE backup_policy SET retention_count=2").run();
    const first = await runEncryptedBackup(db);
    await runEncryptedBackup(db);
    const third = await runEncryptedBackup(db);
    const adminOverview = (await clients.admin.agent.get("/api/admin/overview"))
      .body;
    assert.ok(adminOverview.last_successful_backup);
    assert.ok(
      (await clients.admin.agent.get("/api/audit")).body.some(
        (e) => e.action === "backup.encrypted_verified",
      ),
    );
    assert.equal(
      readdirSync(folder).filter((n) => n.endsWith(".finbiz")).length,
      2,
    );
    assert.equal(
      db.prepare("SELECT filename FROM backup_runs WHERE id=?").get(first.id)
        .filename,
      null,
    );
    const bytes = readFileSync(join(folder, third.filename));
    assert.ok(!bytes.subarray(0, 16).toString().includes("SQLite"));
    const changed = Buffer.from(bytes);
    changed[changed.length - 1] ^= 1;
    assert.throws(() => decrypt(changed, "finbiz-backup-v1"));
    const raw = join(folder, "decrypted.db");
    writeFileSync(raw, decrypt(bytes, "finbiz-backup-v1"));
    const dest = join(folder, "restored.db");
    await restoreToNewFile(raw, dest);
    const restored = new DatabaseSync(dest);
    try {
      assert.equal(
        restored.prepare("SELECT COUNT(*) n FROM sessions").get().n,
        0,
      );
      assert.equal(
        restored.prepare("PRAGMA integrity_check").get().integrity_check,
        "ok",
      );
    } finally {
      restored.close();
    }
    assert.throws(() => decrypt(encrypt(Buffer.from("test"), "one"), "two"));
    db.prepare(
      "UPDATE backup_runs SET started_at=datetime('now','-200 hours')",
    ).run();
    db.prepare("UPDATE backup_policy SET enabled=1").run();
    const stop = startBackupScheduler(db);
    await stop();
    assert.equal(
      db
        .prepare("SELECT status FROM backup_runs ORDER BY rowid DESC LIMIT 1")
        .get().status,
      "verified",
    );
    assert.equal(
      db
        .prepare("SELECT COUNT(*) n FROM backup_runs WHERE status='verified'")
        .get().n,
      4,
    );
  } finally {
    if (oldKey === undefined) delete process.env.FINBIZ_SECURITY_KEY;
    else process.env.FINBIZ_SECURITY_KEY = oldKey;
    if (oldDir === undefined) delete process.env.FINBIZ_BACKUP_DIR;
    else process.env.FINBIZ_BACKUP_DIR = oldDir;
    assert.ok(resolve(folder).startsWith(resolve(tmpdir()) + sep));
    rmSync(folder, { recursive: true, force: true });
  }
});
