import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import ExcelJS from "exceljs";
import { backup } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, money, id } from "../server/db.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";

let db, app, accounts, contacts;
const password = "Testing-only-password-123";
beforeEach(() => {
  db = openDb(":memory:");
  seed(db, password);
  app = createApp(db);
  accounts = db.prepare("SELECT * FROM accounts").all();
  contacts = db.prepare("SELECT * FROM contacts").all();
});
afterEach(() => db.close());
async function login(role = "finance") {
  const agent = request.agent(app);
  const session = await agent.get("/api/session");
  const r = await agent
    .post("/api/login")
    .set("x-csrf-token", session.body.csrf)
    .send({ email: `${role}@finbiz.demo`, password });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return { agent, csrf: r.body.csrf };
}
const post = (client, path, body) =>
  client.agent
    .post("/api" + path)
    .set("x-csrf-token", client.csrf)
    .send(body);
function tx(overrides = {}) {
  return {
    date: "2026-10-01",
    amount: "123.45",
    direction: "in",
    account_id: accounts.find((a) => a.channel === "mobile").id,
    reference: "TEST-REF",
    description: "Test receipt",
    category: "Sales",
    request_key: id(),
    ...overrides,
  };
}
async function importCsv(
  client,
  content,
  aid = accounts.find((a) => a.channel === "mobile").id,
) {
  return client.agent
    .post("/api/imports/preview")
    .set("x-csrf-token", client.csrf)
    .field("account_id", aid)
    .field(
      "mapping",
      JSON.stringify({
        date: "date",
        reference: "reference",
        amount: "amount",
        direction: "direction",
      }),
    )
    .attach("file", Buffer.from(content), "statement.csv");
}
const csv = "date,reference,amount,direction\n2026-10-01,TEST-REF,123.45,in\n";

test("exact money rejects fractions beyond precision, floating-point inputs and invalid dates", async () => {
  assert.equal(money("0.29"), 29);
  assert.equal(money("9999999999.99"), 999999999999);
  for (const amount of [
    "0",
    "-1",
    "1.001",
    "1e4",
    "NaN",
    "10000000000.00",
    1.1,
  ])
    assert.throws(() => money(amount));
  const client = await login();
  const result = await post(
    client,
    "/transactions",
    tx({ date: "2026-02-30" }),
  );
  assert.equal(result.status, 400);
});
test("authentication and CSRF protect writes; login rotates the session", async () => {
  assert.equal((await request(app).get("/api/transactions")).status, 401);
  const client = await login();
  assert.equal(
    (await client.agent.post("/api/transactions").send(tx())).status,
    403,
  );
  assert.equal(
    (await client.agent.get("/api/session")).body.user.role,
    "finance",
  );
  await post(client, "/logout", {});
  assert.equal((await client.agent.get("/api/transactions")).status, 401);
});
test("auditors cannot mutate, administrators cannot approve, cashiers only see own receipts", async () => {
  const auditor = await login("auditor");
  assert.equal((await post(auditor, "/transactions", tx())).status, 403);
  const admin = await login("admin");
  const pending = db
    .prepare("SELECT id FROM transactions WHERE approval='pending'")
    .get();
  assert.equal(
    (
      await post(admin, `/approvals/${pending.id}`, {
        decision: "approved",
        reason: "Reviewed",
      })
    ).status,
    403,
  );
  const cashier = await login("cashier");
  assert.equal(
    (await post(cashier, "/transactions", tx({ direction: "out" }))).status,
    403,
  );
  const receipt = await post(cashier, "/transactions", tx());
  assert.equal(receipt.status, 201);
  const rows = await cashier.agent.get("/api/transactions");
  assert.equal(rows.body.total, 1);
  assert.equal(rows.body.rows[0].id, receipt.body.id);
  assert.equal((await cashier.agent.get("/api/invoices")).status, 403);
});
test("all channels record exact amounts; cash requires receipt evidence", async () => {
  const client = await login();
  for (const a of accounts) {
    const r = await post(client, "/transactions", tx({ account_id: a.id }));
    assert.equal(r.status, 201);
    assert.equal(
      db.prepare("SELECT amount FROM transactions WHERE id=?").get(r.body.id)
        .amount,
      12345,
    );
  }
  assert.equal(
    (
      await post(
        client,
        "/transactions",
        tx({
          account_id: accounts.find((a) => a.channel === "cash").id,
          reference: "",
        }),
      )
    ).status,
    400,
  );
});
test("request keys make retries safe and reject conflicting reuse", async () => {
  const client = await login(),
    body = tx(),
    first = await post(client, "/transactions", body),
    retry = await post(client, "/transactions", body);
  assert.equal(first.body.id, retry.body.id);
  assert.equal(
    (await post(client, "/transactions", { ...body, amount: "125.00" })).status,
    409,
  );
  assert.equal(
    db
      .prepare("SELECT COUNT(*) AS n FROM transactions WHERE request_key=?")
      .get(body.request_key).n,
    1,
  );
});
test("approval requires a different manager and cannot be decided twice", async () => {
  const manager = await login("manager"),
    finance = await login();
  const own = await post(manager, "/transactions", tx({ direction: "out" }));
  assert.equal(
    (
      await post(manager, `/approvals/${own.body.id}`, {
        decision: "approved",
        reason: "Self review",
      })
    ).status,
    403,
  );
  const other = await post(finance, "/transactions", tx({ direction: "out" }));
  assert.equal(
    (
      await post(manager, `/approvals/${other.body.id}`, {
        decision: "approved",
        reason: "Evidence verified",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post(manager, `/approvals/${other.body.id}`, {
        decision: "rejected",
        reason: "Changed mind",
      })
    ).status,
    409,
  );
});
test("closed periods block new records and leave no partial financial entries", async () => {
  const manager = await login("manager"),
    finance = await login();
  assert.equal(
    (
      await post(manager, "/periods", {
        month: "2025-01",
        closed: true,
        reason: "Month complete",
      })
    ).status,
    200,
  );
  const before = db.prepare("SELECT COUNT(*) AS n FROM transactions").get().n;
  assert.equal(
    (await post(finance, "/transactions", tx({ date: "2025-01-20" }))).status,
    409,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM transactions").get().n,
    before,
  );
  await post(manager, "/periods", {
    month: "2025-01",
    closed: false,
    reason: "Correction permitted",
  });
  assert.equal(
    (await post(finance, "/transactions", tx({ date: "2025-01-20" }))).status,
    201,
  );
});
test("statement preview validates rows and duplicate imports; commit is retry safe", async () => {
  const client = await login(),
    content = csv + "bad-date,INVALID,1.00,in\n";
  const preview = await importCsv(client, content);
  assert.equal(preview.status, 201, JSON.stringify(preview.body));
  assert.equal(preview.body.rows.length, 1);
  assert.equal(preview.body.errors.length, 1);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM statement_lines").get().n,
    0,
  );
  assert.equal((await importCsv(client, content)).status, 409);
  assert.equal(
    (await post(client, `/imports/${preview.body.id}/commit`, {})).status,
    200,
  );
  assert.equal(
    (await post(client, `/imports/${preview.body.id}/commit`, {})).status,
    200,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM statement_lines").get().n,
    1,
  );
});
test("XLSX uses the same preview validation and stores original evidence", async () => {
  const client = await login(),
    book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet("Statement");
  sheet.addRow(["date", "reference", "amount", "direction"]);
  sheet.addRow(["2026-10-01", "XLSX-REF", "55.25", "in"]);
  sheet.addRow(["2026-10-01", "BAD", "1.001", "in"]);
  const r = await client.agent
    .post("/api/imports/preview")
    .set("x-csrf-token", client.csrf)
    .field("account_id", accounts.find((a) => a.channel === "bank").id)
    .field(
      "mapping",
      JSON.stringify({
        date: "date",
        reference: "reference",
        amount: "amount",
        direction: "direction",
      }),
    )
    .attach("file", Buffer.from(await book.xlsx.writeBuffer()), "bank.xlsx");
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.rows[0].amount, "5525");
  assert.equal(r.body.errors.length, 1);
  assert.equal(
    (await client.agent.get(`/api/imports/${r.body.id}/source`)).status,
    200,
  );
});
test("exact matches require confirmation and cannot be confirmed concurrently twice", async () => {
  const client = await login(),
    receipt = await post(client, "/transactions", tx()),
    preview = await importCsv(client, csv);
  await post(client, `/imports/${preview.body.id}/commit`, {});
  const row = (await client.agent.get("/api/reconciliation")).body[0];
  assert.equal(row.status, "suggested");
  assert.equal(
    db
      .prepare("SELECT reconciliation FROM transactions WHERE id=?")
      .get(receipt.body.id).reconciliation,
    "unmatched",
  );
  const body = {
    line_id: row.id,
    transaction_id: receipt.body.id,
    reason: "Checked evidence",
  };
  const results = await Promise.all([
    post(client, "/reconciliation", body),
    post(client, "/reconciliation", body),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const done = (await client.agent.get("/api/reconciliation")).body[0];
  assert.equal(done.status, "reconciled");
  assert.equal(
    (
      await post(client, `/reconciliation/${done.reconciliation_id}/undo`, {
        reason: "Review again",
      })
    ).status,
    200,
  );
  assert.equal(
    (await client.agent.get("/api/reconciliation")).body[0].status,
    "suggested",
  );
});
test("similar amounts, ambiguous references and duplicated evidence never silently reconcile", async () => {
  const client = await login();
  await post(client, "/transactions", tx());
  await post(client, "/transactions", tx());
  const preview = await importCsv(
    client,
    csv +
      "2026-10-02,OTHER-REF,123.45,in\n2026-10-02,OTHER-REF,123.45,in\n2026-10-03,UNKNOWN,123.45,in\n",
  );
  await post(client, `/imports/${preview.body.id}/commit`, {});
  const lines = (await client.agent.get("/api/reconciliation")).body;
  assert.equal(
    lines.find((l) => l.reference === "TEST-REF").status,
    "ambiguous",
  );
  assert.equal(lines.filter((l) => l.status === "duplicate").length, 2);
  assert.equal(
    lines.find((l) => l.reference === "UNKNOWN").status,
    "unmatched",
  );
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM transactions WHERE reconciliation='reconciled'",
      )
      .get().n,
    0,
  );
});
test("invoice allocations prevent overpayments and do not add dashboard cash", async () => {
  const client = await login(),
    customer = contacts.find((c) => c.type === "customer"),
    receipt = await post(
      client,
      "/transactions",
      tx({ contact_id: customer.id }),
    );
  const before = (await client.agent.get("/api/overview")).body.incoming;
  const invoice = await post(client, "/invoices", {
    number: "TEST-INVOICE",
    contact_id: customer.id,
    issued: "2026-10-01",
    due: "2026-10-15",
    amount: "100.00",
    description: "Customer order",
  });
  assert.equal(invoice.status, 201);
  assert.equal(
    (
      await post(client, `/invoices/${invoice.body.id}/allocate`, {
        transaction_id: receipt.body.id,
        amount: "60.00",
      })
    ).status,
    200,
  );
  const other = await post(
    client,
    "/transactions",
    tx({ amount: "50.00", contact_id: customer.id }),
  );
  assert.equal(
    (
      await post(client, `/invoices/${invoice.body.id}/allocate`, {
        transaction_id: other.body.id,
        amount: "41.00",
      })
    ).status,
    409,
  );
  assert.equal(
    (await client.agent.get("/api/invoices")).body.find(
      (i) => i.id === invoice.body.id,
    ).paid,
    "6000",
  );
  assert.equal(
    (await client.agent.get("/api/overview")).body.incoming,
    String(BigInt(before) + 5000n),
  );
});
test("financial records and audit history cannot be silently overwritten; reversal is linked", async () => {
  const finance = await login(),
    manager = await login("manager"),
    r = await post(finance, "/transactions", tx());
  assert.throws(() =>
    db.prepare("UPDATE transactions SET amount=1 WHERE id=?").run(r.body.id),
  );
  assert.throws(() =>
    db.prepare("DELETE FROM transactions WHERE id=?").run(r.body.id),
  );
  assert.throws(() => db.exec("DELETE FROM audit_events"));
  const reversal = await post(manager, `/transactions/${r.body.id}/reverse`, {
    date: "2026-10-02",
    reason: "Correct duplicate receipt",
  });
  assert.equal(reversal.status, 201);
  assert.equal(
    db
      .prepare("SELECT reversal_of FROM transactions WHERE id=?")
      .get(reversal.body.id).reversal_of,
    r.body.id,
  );
  assert.equal(
    (
      await post(manager, `/transactions/${r.body.id}/reverse`, {
        date: "2026-10-02",
        reason: "Repeat",
      })
    ).status,
    409,
  );
});
test("filtered dashboard and CSV totals agree and exports escape spreadsheet formulas", async () => {
  const client = await login(),
    aid = accounts[0].id;
  await post(
    client,
    "/transactions",
    tx({ account_id: aid, description: '=HYPERLINK("bad")' }),
  );
  const query = `?account=${aid}&from=2026-10-01&to=2026-10-01&q=HYPERLINK`;
  const o = (await client.agent.get("/api/overview" + query)).body;
  assert.equal(o.incoming, "12345");
  assert.equal(o.outgoing, "0");
  const csvExport = await client.agent.get("/api/reports/export" + query);
  assert.equal(csvExport.status, 200);
  assert.match(csvExport.text, /'=HYPERLINK/);
  assert.match(csvExport.text, /'?12345/);
  const pdf = await client.agent.get(
    "/api/reports/export" + query + "&format=pdf",
  );
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers["content-type"], /pdf/);
});
test("user deactivation and password changes invalidate existing sessions", async () => {
  const admin = await login("admin"),
    finance = await login();
  const uid = (await finance.agent.get("/api/session")).body.user.id;
  assert.equal(
    (
      await admin.agent
        .patch("/api/users/" + uid)
        .set("x-csrf-token", admin.csrf)
        .send({ active: false })
    ).status,
    200,
  );
  assert.equal((await finance.agent.get("/api/transactions")).status, 401);
  assert.equal(
    (
      await post(admin, "/password", {
        current: password,
        password: "A-new-long-password-123",
      })
    ).status,
    200,
  );
  assert.equal((await admin.agent.get("/api/users")).status, 401);
});
test("a consistent backup restores transaction counts, audit evidence and integrity", async () => {
  const client = await login();
  const preview = await importCsv(client, csv);
  await post(client, `/imports/${preview.body.id}/commit`, {});
  const folder = mkdtempSync(join(tmpdir(), "finbiz-backup-")),
    filename = join(folder, "restore.db");
  let restored;
  try {
    await backup(db, filename);
    restored = openDb(filename);
    assert.equal(
      restored.prepare("PRAGMA integrity_check").get().integrity_check,
      "ok",
    );
    assert.equal(
      restored.prepare("SELECT COUNT(*) AS n FROM transactions").get().n,
      db.prepare("SELECT COUNT(*) AS n FROM transactions").get().n,
    );
    assert.equal(
      restored.prepare("SELECT COUNT(*) AS n FROM audit_events").get().n,
      db.prepare("SELECT COUNT(*) AS n FROM audit_events").get().n,
    );
    assert.equal(
      restored.prepare("SELECT COUNT(*) AS n FROM statement_lines").get().n,
      1,
    );
    assert.deepEqual(
      Buffer.from(
        restored
          .prepare("SELECT source FROM imports WHERE id=?")
          .get(preview.body.id).source,
      ),
      Buffer.from(csv),
    );
    assert.equal(restored.prepare("PRAGMA foreign_key_check").all().length, 0);
  } finally {
    restored?.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
