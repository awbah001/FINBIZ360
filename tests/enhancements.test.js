import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import ExcelJS from "exceljs";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { restoreToNewFile } from "../server/restore.js";
import { openDb, id, isoDate } from "../server/db.js";
import { createApp } from "../server/app.js";
import { seed } from "../server/seed.js";
import { analytics, sumMinor } from "../server/enhancements.js";

let db, app, accounts, contacts;
const password = "Enhancement-test-password-123";
const binary = (res, done) => {
  const chunks = [];
  res.on("data", (part) => chunks.push(Buffer.from(part)));
  res.on("end", () => done(null, Buffer.concat(chunks)));
};
beforeEach(() => {
  db = openDb(":memory:");
  seed(db, password);
  app = createApp(db);
  accounts = db.prepare("SELECT * FROM accounts").all();
  contacts = db.prepare("SELECT * FROM contacts").all();
});
afterEach(() => db.close());
async function login(role = "finance") {
  const agent = request.agent(app),
    s = await agent.get("/api/session"),
    r = await agent
      .post("/api/login")
      .set("x-csrf-token", s.body.csrf)
      .send({ email: `${role}@finbiz.demo`, password });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return { agent, csrf: r.body.csrf };
}
const send = (c, method, path, body = {}) =>
  c.agent[method]("/api" + path)
    .set("x-csrf-token", c.csrf)
    .send(body);
const tx = (overrides = {}) => ({
  date: "2026-10-01",
  amount: "100.00",
  direction: "in",
  account_id: accounts.find((a) => a.channel === "mobile").id,
  reference: "ENHANCE-REF",
  description: "Enhanced receipt",
  category: "Sales",
  request_key: id(),
  ...overrides,
});
async function preview(c, content) {
  return c.agent
    .post("/api/imports/preview")
    .set("x-csrf-token", c.csrf)
    .field("account_id", accounts.find((a) => a.channel === "mobile").id)
    .field(
      "mapping",
      JSON.stringify({
        date: "date",
        reference: "reference",
        amount: "amount",
        direction: "direction",
      }),
    )
    .attach("file", Buffer.from(content), "enhancement.csv");
}

test("new schema retains seeded financial and audit records with foreign-key integrity", () => {
  const before = db.prepare("SELECT COUNT(*) n FROM transactions").get().n,
    events = db.prepare("SELECT COUNT(*) n FROM audit_events").get().n;
  assert.equal(db.prepare("SELECT COUNT(*) n FROM migrations").get().n, 11);
  assert.equal(
    db
      .prepare("SELECT COUNT(*) n FROM transactions WHERE approval='pending'")
      .get().n,
    3,
  );
  assert.ok(before > 0);
  assert.ok(events > 0);
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
});
test("admin edits users, revokes sessions and cannot confer business authority implicitly", async () => {
  const admin = await login("admin"),
    finance = await login(),
    manager = await login("manager"),
    uid = db.prepare("SELECT id FROM users WHERE role='finance'").get().id;
  const r = await send(admin, "patch", `/users/${uid}`, {
    name: "Edited Finance",
    email: "finance@finbiz.demo",
    role: "auditor",
    reason: "Read-only reassignment",
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await finance.agent.get("/api/transactions")).status, 401);
  const own = db.prepare("SELECT id FROM users WHERE role='admin'").get().id;
  assert.equal(
    (await send(admin, "patch", `/users/${own}`, { role: "finance" })).status,
    400,
  );
  const pending = db
    .prepare("SELECT id FROM transactions WHERE approval='pending'")
    .get().id;
  assert.equal(
    (
      await send(admin, "post", `/approvals/${pending}`, {
        decision: "approved",
        reason: "Not authorised",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await send(manager, "post", "/approval-policy", {
        user_id: own,
        active: true,
        reason: "Explicit authorised delegation",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await send(admin, "post", `/approvals/${pending}`, {
        decision: "approved",
        reason: "Independent delegated review",
      })
    ).status,
    200,
  );
});
test("opening balances, inactive accounts, clearing context and closing totals are distinct from cash movement", async () => {
  const c = await login();
  const a = await send(c, "post", "/accounts", {
    name: "Opening test clearing",
    channel: "bank",
    kind: "clearing",
    currency: "SLE",
    opening_amount: "123.45",
    opening_date: "2026-10-01",
  });
  assert.equal(a.status, 201, JSON.stringify(a.body));
  assert.equal(
    (
      await send(
        c,
        "post",
        "/transactions",
        tx({ account_id: a.body.id, amount: "0.55", date: "2026-09-30" }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await send(
        c,
        "post",
        "/transactions",
        tx({ account_id: a.body.id, amount: "0.55" }),
      )
    ).status,
    201,
  );
  const overview = (
    await c.agent.get(
      `/api/overview?account=${a.body.id}&from=2026-10-01&to=2026-10-31`,
    )
  ).body;
  assert.equal(overview.incoming, "55");
  assert.equal(overview.accounts[0].movement, "55");
  assert.equal(overview.accounts[0].closing, "12400");
  assert.equal(overview.accounts[0].opening, "12345");
  assert.equal(
    (
      await send(c, "patch", `/accounts/${a.body.id}`, {
        opening_amount: "1",
        reason: "Forbidden overwrite",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await send(c, "patch", `/accounts/${a.body.id}`, {
        active: false,
        reason: "Account closed",
      })
    ).status,
    200,
  );
  assert.equal(
    (await send(c, "post", "/transactions", tx({ account_id: a.body.id })))
      .status,
    400,
  );
});
test("contacts retain edit history, account history and role-restricted maintenance", async () => {
  const c = await login(),
    auditor = await login("auditor");
  const create = await send(c, "post", "/contacts", {
    name: "Search Customer",
    type: "customer",
    phone: "076000000",
    reference: "CUS-100",
    email: "contact@example.test",
  });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  assert.equal(
    (
      await send(auditor, "patch", `/contacts/${create.body.id}`, {
        name: "No",
        reason: "Forbidden",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await send(c, "patch", `/contacts/${create.body.id}`, {
        name: "Updated customer",
        active: false,
        reason: "No longer trading",
      })
    ).status,
    200,
  );
  const h = await c.agent.get(`/api/contacts/${create.body.id}/history`);
  assert.equal(h.body.contact.active, 0);
  assert.equal(h.body.contact.reference, "CUS-100");
  assert.equal(h.body.outstanding, "0");
  assert.ok(
    db
      .prepare(
        "SELECT details FROM audit_events WHERE action='contact.update' AND entity=?",
      )
      .get(create.body.id)
      .details.includes("Search Customer"),
  );
});
test("transaction filters, sorting, duplicate warnings and export scope agree", async () => {
  const c = await login();
  let r = await send(c, "post", "/transactions", tx({ amount: "0.29" }));
  assert.equal(r.body.warnings.length, 0);
  r = await send(c, "post", "/transactions", tx({ amount: "0.30" }));
  assert.equal(r.body.warnings.length, 1);
  const query =
    "from=2026-10-01&to=2026-10-01&channel=mobile&category=Sales&approval=not_required&sort=amount_asc&q=ENHANCE-REF";
  const list = await c.agent.get("/api/transactions?" + query);
  assert.equal(list.status, 200, JSON.stringify(list.body));
  assert.equal(list.body.total, 2);
  assert.deepEqual(
    list.body.rows.map((t) => t.amount),
    ["29", "30"],
  );
  const overview = await c.agent.get("/api/overview?" + query);
  assert.equal(overview.body.incoming, "59");
  const report = await c.agent.get("/api/reports/data?kind=income&" + query);
  assert.equal(
    report.body.rows.reduce((n, r) => n + BigInt(r.amount_minor), 0n),
    59n,
  );
  assert.equal(
    (await c.agent.get("/api/transactions?sort=amount;DROP TABLE users"))
      .status,
    400,
  );
});
test("evidence uploads validate signatures, protect private downloads and distinguish manual verification", async () => {
  const c = await login(),
    cashier = await login("cashier"),
    auditor = await login("auditor"),
    created = await send(c, "post", "/transactions", tx());
  const tid = created.body.id;
  const attach = (client, bytes, name) =>
    client.agent
      .post(`/api/transactions/${tid}/evidence`)
      .set("x-csrf-token", client.csrf)
      .attach("file", bytes, name);
  assert.equal(
    (await attach(c, Buffer.from("<script>alert(1)</script>"), "receipt.png"))
      .status,
    400,
  );
  const evidence = await attach(
    c,
    Buffer.from("%PDF-1.4\n%isolated test receipt"),
    "receipt.pdf",
  );
  assert.equal(evidence.status, 201, JSON.stringify(evidence.body));
  assert.equal(
    (await cashier.agent.get(`/api/evidence/${evidence.body.id}`)).status,
    403,
  );
  assert.equal(
    (await auditor.agent.get(`/api/evidence/${evidence.body.id}`)).status,
    200,
  );
  assert.equal(
    (
      await send(auditor, "post", `/transactions/${tid}/verify`, {
        evidence_reference: "Not allowed",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await send(c, "post", `/transactions/${tid}/verify`, {
        evidence_reference: "Reviewed authorised provider receipt DOC-1",
      })
    ).status,
    200,
  );
  const record = (await c.agent.get("/api/transactions?q=ENHANCE-REF")).body
    .rows[0];
  assert.equal(record.payment_status, "evidence_verified");
  assert.equal(record.reconciliation, "unmatched");
});
test("itemised invoices, draft issue/cancel, partial payments and allocation corrections preserve exact balances", async () => {
  const c = await login(),
    customer = contacts.find((p) => p.type === "customer"),
    receipt = await send(
      c,
      "post",
      "/transactions",
      tx({ contact_id: customer.id, amount: "100.00" }),
    );
  const body = {
    number: "ITEM-TEST",
    contact_id: customer.id,
    issued: "2026-10-01",
    due: "2026-10-31",
    amount: "100.00",
    description: "Item invoice",
    lifecycle: "draft",
    items: [{ description: "Goods", quantity: 2, unit_price: "50.00" }],
  };
  assert.equal(
    (
      await send(c, "post", "/invoices", {
        ...body,
        number: "BAD-ITEM",
        amount: "99.00",
      })
    ).status,
    400,
  );
  const invoice = await send(c, "post", "/invoices", body);
  assert.equal(invoice.status, 201, JSON.stringify(invoice.body));
  const allocate = () =>
    send(c, "post", `/invoices/${invoice.body.id}/allocate`, {
      transaction_id: receipt.body.id,
      amount: "40.00",
    });
  assert.equal((await allocate()).status, 409);
  assert.equal(
    (
      await send(c, "patch", `/invoices/${invoice.body.id}`, {
        lifecycle: "issued",
        reason: "Ready to send",
      })
    ).status,
    200,
  );
  assert.equal((await allocate()).status, 200);
  let doc = (await c.agent.get("/api/invoices")).body.find(
    (d) => d.id === invoice.body.id,
  );
  assert.equal(doc.status, "partial");
  assert.equal(doc.outstanding, "6000");
  const payment = (
    await c.agent.get(`/api/invoices/${invoice.body.id}/payments`)
  ).body[0];
  assert.equal(
    (
      await send(c, "post", `/allocations/${payment.id}/correct`, {
        reason: "Wrong invoice selected; retain history",
      })
    ).status,
    200,
  );
  doc = (await c.agent.get("/api/invoices")).body.find(
    (d) => d.id === invoice.body.id,
  );
  assert.equal(doc.paid, "0");
  assert.equal((await allocate()).status, 200);
  assert.equal((await allocate()).status, 409);
  const history = (
    await c.agent.get(`/api/invoices/${invoice.body.id}/payments`)
  ).body;
  assert.equal(history.length, 2);
  assert.equal(
    history.find((p) => p.id === payment.id).correction_reason,
    "Wrong invoice selected; retain history",
  );
  const replacement = history.find((p) => p.id !== payment.id);
  assert.equal(
    (
      await send(c, "post", `/allocations/${replacement.id}/correct`, {
        reason: "Correct replacement before cancelling test invoice",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await send(c, "patch", `/invoices/${invoice.body.id}`, {
        lifecycle: "cancelled",
        reason: "Invoice cancelled after correction",
      })
    ).status,
    200,
  );
  assert.equal((await allocate()).status, 409);
  assert.equal(
    db
      .prepare("SELECT COUNT(*) n FROM payment_allocations WHERE id=?")
      .get(payment.id).n,
    1,
  );
});
test("supplier bill allocation requires approved same-supplier payments and cannot overpay or reverse silently", async () => {
  const c = await login(),
    manager = await login("manager"),
    supplier = contacts.find((p) => p.type === "supplier");
  const bill = await send(c, "post", "/supplier-bills", {
    number: "SUP-TEST",
    contact_id: supplier.id,
    issued: "2026-10-01",
    due: "2026-10-30",
    amount: "75.00",
    description: "Supplier purchase",
  });
  assert.equal(bill.status, 201);
  const payment = await send(
    c,
    "post",
    "/transactions",
    tx({ direction: "out", amount: "100.00", contact_id: supplier.id }),
  );
  const allocate = (amount) =>
    send(c, "post", `/supplier-bills/${bill.body.id}/allocate`, {
      transaction_id: payment.body.id,
      amount,
    });
  assert.equal((await allocate("75.00")).status, 400);
  assert.equal(
    (
      await send(manager, "post", `/approvals/${payment.body.id}`, {
        decision: "approved",
        reason: "Independent expense review",
      })
    ).status,
    200,
  );
  assert.equal((await allocate("75.01")).status, 409);
  assert.equal((await allocate("75.00")).status, 200);
  const b = (await c.agent.get("/api/supplier-bills")).body.find(
    (d) => d.id === bill.body.id,
  );
  assert.equal(b.status, "paid");
  assert.equal(b.outstanding, "0");
  const originalAllocation = (
    await c.agent.get(`/api/supplier-bills/${bill.body.id}/payments`)
  ).body[0];
  assert.equal(
    (
      await send(
        c,
        "post",
        `/supplier-allocations/${originalAllocation.id}/correct`,
        {
          reason: "Correct test supplier allocation and retain payment",
        },
      )
    ).status,
    200,
  );
  assert.equal((await allocate("75.00")).status, 200);
  assert.equal((await allocate("0.01")).status, 409);
  const history = (
    await c.agent.get(`/api/supplier-bills/${bill.body.id}/payments`)
  ).body;
  assert.equal(history.length, 2);
  assert.ok(
    history.find((p) => p.id === originalAllocation.id).correction_reason,
  );
  assert.equal(
    (
      await send(manager, "post", `/transactions/${payment.body.id}/reverse`, {
        date: "2026-10-02",
        reason: "Attempted silent reversal",
      })
    ).status,
    409,
  );
});
test("balanced many-to-one grouping requires independent manager review, handles concurrency and is reversible", async () => {
  const c = await login(),
    manager = await login("manager");
  const first = await send(
      c,
      "post",
      "/transactions",
      tx({ reference: "GROUP-A", amount: "20.00" }),
    ),
    second = await send(
      c,
      "post",
      "/transactions",
      tx({ reference: "GROUP-B", amount: "30.00" }),
    );
  const file = await preview(
    c,
    "date,reference,amount,direction\n2026-10-01,SETTLEMENT,50.00,in\n",
  );
  assert.equal(file.status, 201);
  await send(c, "post", `/imports/${file.body.id}/commit`);
  const line = db
    .prepare("SELECT id FROM statement_lines WHERE import_id=?")
    .get(file.body.id).id;
  const proposal = await send(c, "post", "/reconciliation/proposals", {
    transaction_ids: [first.body.id, second.body.id],
    line_ids: [line],
    reason: "Reviewed grouped settlement evidence",
  });
  assert.equal(proposal.status, 201, JSON.stringify(proposal.body));
  assert.equal(
    (
      await send(
        c,
        "post",
        `/reconciliation/proposals/${proposal.body.id}/decide`,
        { decision: "approved", reason: "Self approval" },
      )
    ).status,
    403,
  );
  const decisions = await Promise.all([
    send(
      manager,
      "post",
      `/reconciliation/proposals/${proposal.body.id}/decide`,
      { decision: "approved", reason: "Independent aggregate review" },
    ),
    send(
      manager,
      "post",
      `/reconciliation/proposals/${proposal.body.id}/decide`,
      { decision: "approved", reason: "Duplicate click" },
    ),
  ]);
  assert.deepEqual(decisions.map((r) => r.status).sort(), [200, 409]);
  const row = (await c.agent.get("/api/reconciliation")).body.find(
    (r) => r.id === line,
  );
  assert.equal(row.status, "reconciled");
  assert.equal(row.rule, "balanced-group-independent-review-v1");
  assert.equal(
    (
      await send(
        c,
        "post",
        `/reconciliation/proposals/${proposal.body.id}/undo`,
        { reason: "Recheck source evidence" },
      )
    ).status,
    200,
  );
  assert.equal(
    db
      .prepare("SELECT reconciliation FROM transactions WHERE id=?")
      .get(first.body.id).reconciliation,
    "unmatched",
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM grouped_links WHERE active=1").get().n,
    0,
  );
});
test("tolerances suggest discrepancies but refuse unbalanced confirmation and obey period locks", async () => {
  const c = await login(),
    manager = await login("manager");
  const t = await send(
    c,
    "post",
    "/transactions",
    tx({ amount: "100.00", reference: "TOLERANCE" }),
  );
  const file = await preview(
    c,
    "date,reference,amount,direction\n2026-10-02,TOLERANCE,99.50,in\n",
  );
  await send(c, "post", `/imports/${file.body.id}/commit`);
  assert.equal(
    (
      await send(c, "patch", "/reconciliation/policy", {
        date_days: 2,
        amount_minor: 100,
        reason: "Not authorised",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await send(manager, "patch", "/reconciliation/policy", {
        date_days: 2,
        amount_minor: 100,
        reason: "Two-day settlement window",
      })
    ).status,
    200,
  );
  const suggestions = await c.agent.get(
    "/api/reconciliation/suggestions?from=2026-10-01&to=2026-10-03",
  );
  assert.ok(
    suggestions.body.suggestions.some((s) => s.reference === "TOLERANCE"),
  );
  const line = db
    .prepare("SELECT id FROM statement_lines WHERE import_id=?")
    .get(file.body.id).id;
  assert.equal(
    (
      await send(c, "post", "/reconciliation/proposals", {
        transaction_ids: [t.body.id],
        line_ids: [line],
        reason: "Unbalanced proposal",
      })
    ).status,
    409,
  );
  assert.equal(
    db
      .prepare("SELECT reconciliation FROM transactions WHERE id=?")
      .get(t.body.id).reconciliation,
    "unmatched",
  );
});
test("exception queue retains invalid source rows, restrictions and investigation history", async () => {
  const c = await login(),
    manager = await login("manager"),
    auditor = await login("auditor");
  const file = await preview(
    c,
    "date,reference,amount,direction\n2026-10-01,VALID,25.00,in\ninvalid,FAIL,-2.00,in\n",
  );
  assert.equal(file.status, 201);
  assert.equal(file.body.errors[0].source.reference, "FAIL");
  const queue = await c.agent.get("/api/exceptions");
  const e = queue.body.find((r) => r.source_id === file.body.id);
  assert.equal(e.type, "invalid_statement");
  assert.equal(
    (
      await send(auditor, "post", "/exceptions/review", {
        key: e.key,
        status: "in_review",
        reason: "Read-only test",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await send(c, "post", "/exceptions/review", {
        key: e.key,
        status: "dismissed",
        reason: "Not manager",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await send(c, "post", "/exceptions/review", {
        key: e.key,
        status: "in_review",
        reason: "Requested corrected source file",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await send(manager, "post", "/exceptions/review", {
        key: e.key,
        status: "dismissed",
        reason: "Source row confirmed invalid; original retained",
      })
    ).status,
    200,
  );
  assert.equal(
    (await c.agent.get("/api/imports/" + file.body.id + "/errors")).status,
    200,
  );
  assert.equal(
    JSON.parse(
      db.prepare("SELECT errors FROM imports WHERE id=?").get(file.body.id)
        .errors,
    ).length,
    1,
  );
});
test("all report variants export controlled CSV, XLSX and PDF and cashier is excluded", async () => {
  const c = await login(),
    cashier = await login("cashier");
  for (const kind of [
    "transactions",
    "income",
    "expenses",
    "cashflow",
    "accounts",
    "account_statement",
    "customers",
    "suppliers",
    "invoices",
    "supplier_bills",
    "reconciliation",
    "exceptions",
    "outstanding",
  ]) {
    const r = await c.agent.get("/api/reports/data?kind=" + kind);
    assert.equal(r.status, 200, kind + JSON.stringify(r.body));
    assert.ok(Array.isArray(r.body.rows));
  }
  const x = await c.agent
    .get("/api/reports/download?kind=accounts&format=xlsx")
    .buffer(true)
    .parse(binary);
  assert.equal(x.status, 200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(x.body);
  assert.equal(workbook.worksheets[0].getRow(1).getCell(1).value, "name");
  assert.equal(
    (await c.agent.get("/api/reports/download?kind=accounts&format=pdf"))
      .status,
    200,
  );
  assert.equal(
    (await cashier.agent.get("/api/reports/download?kind=accounts&format=csv"))
      .status,
    403,
  );
});
test("analytics explains anomaly rules and gates forecast; sufficient history backtests integer baseline", () => {
  assert.equal(
    sumMinor([{ amount: "9007199254740991" }, { amount: "9007199254740991" }]),
    18014398509481982n,
  );
  const rows = Array.from({ length: 56 }, (_, i) => ({
    id: String(i),
    date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10),
    amount: i === 55 ? "100000" : "1000",
    direction: "in",
    approval: "not_required",
    account_id: "a",
    account_name: "Account",
    channel: "bank",
    category: "Sales",
    reference: i < 2 ? "DUP" : "R" + i,
  }));
  assert.equal(analytics(rows.slice(0, 20)).forecast.available, false);
  const result = analytics(rows);
  assert.equal(result.forecast.available, true);
  assert.equal(result.forecast.points.length, 7);
  assert.ok(
    result.anomalies.some((a) =>
      a.reasons.some((r) => r.includes("five times")),
    ),
  );
  assert.match(result.forecast.mae_minor, /^\d+$/);
  assert.equal(result.totals.incoming, "155000");
});
test("global search is scoped and category maintenance is audited", async () => {
  const c = await login(),
    auditor = await login("auditor");
  const cat = await send(c, "post", "/categories", {
    name: "Insurance",
    direction: "out",
  });
  assert.equal(cat.status, 201);
  assert.equal(
    (
      await send(auditor, "patch", `/categories/${cat.body.id}`, {
        active: false,
        reason: "Forbidden",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await send(c, "patch", `/categories/${cat.body.id}`, {
        active: false,
        reason: "Not used",
      })
    ).status,
    200,
  );
  const search = await c.agent.get("/api/search?q=Kallon");
  assert.equal(search.status, 200);
  assert.ok(search.body.contacts.length);
  assert.equal(
    (await c.agent.get("/api/analytics?from=not-a-date")).status,
    400,
  );
});

test("independent adjustment and write-off requests do not silently alter invoices or create cash twice", async () => {
  const finance = await login(),
    manager = await login("manager"),
    admin = await login("admin"),
    customer = contacts.find((c) => c.type === "customer");
  const invoice = await send(finance, "post", "/invoices", {
    number: "WRITE-OFF-TEST",
    contact_id: customer.id,
    issued: "2026-10-01",
    due: "2026-10-31",
    amount: "80.00",
    description: "Non-cash control test",
  });
  const requestBody = {
    kind: "writeoff",
    request_key: id(),
    payload: {
      document_kind: "customer",
      document_id: invoice.body.id,
      amount: "80.00",
      evidence_reference: "Authorised credit decision TEST",
    },
    reason: "Irrecoverable document balance reviewed with evidence",
  };
  const control = await send(finance, "post", "/control-requests", requestBody);
  assert.equal(control.status, 201, JSON.stringify(control.body));
  assert.equal(
    (
      await send(admin, "post", `/control-requests/${control.body.id}/decide`, {
        decision: "approved",
        reason: "Not a manager",
      })
    ).status,
    403,
  );
  const before = (await finance.agent.get("/api/overview")).body.incoming;
  const decided = await send(
    manager,
    "post",
    `/control-requests/${control.body.id}/decide`,
    { decision: "approved", reason: "Independent evidence and debt review" },
  );
  assert.equal(decided.status, 200, JSON.stringify(decided.body));
  const doc = (await finance.agent.get("/api/invoices")).body.find(
    (d) => d.id === invoice.body.id,
  );
  assert.equal(doc.paid, "0");
  assert.equal(doc.written_off, "8000");
  assert.equal(doc.outstanding, "0");
  assert.equal(doc.status, "written_off");
  const retry = await send(finance, "post", "/control-requests", requestBody);
  assert.equal(retry.status, 201);
  assert.equal(retry.body.id, control.body.id);
  assert.equal(
    (await finance.agent.get("/api/overview")).body.incoming,
    before,
  );
  assert.equal(
    (
      await send(
        manager,
        "post",
        `/control-requests/${control.body.id}/decide`,
        { decision: "approved", reason: "Double click" },
      )
    ).status,
    409,
  );
  const adjust = await send(finance, "post", "/control-requests", {
    kind: "adjustment",
    payload: {
      account_id: accounts[0].id,
      date: "2026-10-02",
      amount: "0.29",
      direction: "out",
      reference: "FEE-TEST",
      description: "Recorded evidence-backed fee",
    },
    reason: "Correct settlement fee",
  });
  assert.equal(adjust.status, 201);
  const applied = await send(
    manager,
    "post",
    `/control-requests/${adjust.body.id}/decide`,
    { decision: "approved", reason: "Fee evidence checked independently" },
  );
  assert.equal(applied.status, 200, JSON.stringify(applied.body));
  assert.equal(
    db
      .prepare("SELECT amount FROM transactions WHERE id=?")
      .get(applied.body.result_id).amount,
    29,
  );
  const self = await send(manager, "post", "/control-requests", {
    kind: "period_close",
    payload: { month: "2024-01" },
    reason: "Own request",
  });
  assert.equal(
    (
      await send(manager, "post", `/control-requests/${self.body.id}/decide`, {
        decision: "approved",
        reason: "Forbidden self decision",
      })
    ).status,
    403,
  );
  const close = await send(finance, "post", "/control-requests", {
    kind: "period_close",
    payload: { month: "2024-02" },
    reason: "Completed records reviewed",
  });
  assert.equal(
    (
      await send(manager, "post", `/control-requests/${close.body.id}/decide`, {
        decision: "approved",
        reason: "Independent close review",
      })
    ).status,
    200,
  );
  assert.equal(
    db.prepare("SELECT closed FROM periods WHERE month='2024-02'").get().closed,
    1,
  );
});

test("one-to-many and net-of-fee matching retain both cash movements and enforce locks", async () => {
  const c = await login(),
    manager = await login("manager");
  const receipt = await send(
    c,
    "post",
    "/transactions",
    tx({ amount: "100.00", reference: "NET-RECEIPT" }),
  );
  const fee = await send(
    c,
    "post",
    "/transactions",
    tx({ amount: "0.50", reference: "NET-FEE", direction: "out" }),
  );
  await send(manager, "post", `/approvals/${fee.body.id}`, {
    decision: "approved",
    reason: "Fee evidence reviewed",
  });
  const file = await preview(
    c,
    "date,reference,amount,direction\n2026-10-01,NET-SETTLEMENT-A,60.00,in\n2026-10-01,NET-SETTLEMENT-B,39.50,in\n",
  );
  await send(c, "post", `/imports/${file.body.id}/commit`);
  const ids = db
    .prepare("SELECT id FROM statement_lines WHERE import_id=?")
    .all(file.body.id)
    .map((r) => r.id);
  const proposal = await send(c, "post", "/reconciliation/proposals", {
    transaction_ids: [receipt.body.id, fee.body.id],
    line_ids: ids,
    reason:
      "One receipt net of an independently approved fee across two settlement lines",
  });
  assert.equal(proposal.status, 201, JSON.stringify(proposal.body));
  const approve = await send(
    manager,
    "post",
    `/reconciliation/proposals/${proposal.body.id}/decide`,
    { decision: "approved", reason: "Reviewed signed totals and all evidence" },
  );
  assert.equal(approve.status, 200, JSON.stringify(approve.body));
  for (const pending of (await manager.agent.get("/api/approvals")).body.filter(
    (t) => t.date.startsWith("2026-10"),
  ))
    await send(manager, "post", `/approvals/${pending.id}`, {
      decision: "approved",
      reason: "Resolve pending entries before period lock",
    });
  const closed = await send(manager, "post", "/periods", {
    month: "2026-10",
    closed: true,
    reason: "Lock completed period",
  });
  assert.equal(closed.status, 200, JSON.stringify(closed.body));
  assert.equal(
    (
      await send(
        c,
        "post",
        `/reconciliation/proposals/${proposal.body.id}/undo`,
        { reason: "Should be locked" },
      )
    ).status,
    409,
  );
  assert.equal(
    db
      .prepare("SELECT status FROM reconciliation_proposals WHERE id=?")
      .get(proposal.body.id).status,
    "approved",
  );
});

test("admin backup restores to a new file, invalidates sessions, preserves records and refuses overwrite", async () => {
  const admin = await login("admin"),
    finance = await login();
  assert.equal((await finance.agent.get("/api/backup")).status, 403);
  const response = await admin.agent
    .get("/api/backup")
    .buffer(true)
    .parse(binary);
  assert.equal(response.status, 200);
  assert.ok(
    response.body.subarray(0, 15).toString().startsWith("SQLite format 3"),
  );
  const folder = mkdtempSync(join(tmpdir(), "finbiz-restore-enhancement-")),
    source = join(folder, "source.db"),
    destination = join(folder, "restored.db");
  try {
    writeFileSync(source, response.body);
    const result = await restoreToNewFile(source, destination);
    assert.equal(result.integrity, "ok");
    assert.equal(
      result.transactions,
      db.prepare("SELECT COUNT(*) n FROM transactions").get().n,
    );
    const restored = openDb(destination);
    try {
      assert.equal(
        restored.prepare("SELECT COUNT(*) n FROM sessions").get().n,
        0,
      );
      assert.equal(
        restored
          .prepare(
            "SELECT COUNT(*) n FROM audit_events WHERE action='backup.restore'",
          )
          .get().n,
        1,
      );
    } finally {
      restored.close();
    }
    await assert.rejects(
      restoreToNewFile(source, destination),
      /never overwritten/,
    );
  } finally {
    assert.ok(resolve(folder).startsWith(resolve(tmpdir()) + sep));
    rmSync(folder, { recursive: true, force: true });
  }
});
test("rejected suggestions remain auditable, duplicate preview warnings survive, and unsafe workbooks are refused", async () => {
  const c = await login();
  const entry = await send(
    c,
    "post",
    "/transactions",
    tx({ reference: "REVIEW-ONE" }),
  );
  const file = await preview(
    c,
    "date,reference,amount,direction\n2026-10-01,REVIEW-ONE,100.00,in\n",
  );
  await send(c, "post", `/imports/${file.body.id}/commit`);
  const line = db
    .prepare("SELECT id FROM statement_lines WHERE import_id=?")
    .get(file.body.id).id;
  assert.equal(
    (
      await send(c, "post", "/reconciliation/suggestions/reject", {
        line_id: line,
        transaction_id: entry.body.id,
        reason: "Wrong supporting document was selected",
      })
    ).status,
    200,
  );
  const updated = (await c.agent.get("/api/reconciliation")).body.find(
    (l) => l.id === line,
  );
  assert.equal(updated.status, "unmatched");
  assert.equal(
    (
      await send(c, "post", "/reconciliation", {
        line_id: line,
        transaction_id: entry.body.id,
        reason: "Cannot confirm a rejected suggestion",
      })
    ).status,
    409,
  );
  const duplicates = await preview(
    c,
    "date,reference,amount,direction\n2026-10-01,DUP-PREVIEW,1.00,in\n2026-10-01,DUP-PREVIEW,1.00,in\n",
  );
  assert.equal(duplicates.body.warnings.length, 2);
  const malformed = await c.agent
    .post("/api/imports/preview")
    .set("x-csrf-token", c.csrf)
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
    .attach("file", Buffer.from("not-a-ZIP-workbook"), "bad.xlsx");
  assert.equal(malformed.status, 400);
  assert.equal(
    (await send(c, "post", "/transactions", tx({ currency: "USD" }))).status,
    400,
  );
  assert.equal(
    (await c.agent.get("/api/master")).headers["cache-control"],
    "no-store",
  );
});
test("partial evidence enters the queue and control request retries reuse the original request after approval", async () => {
  const c = await login(),
    manager = await login("manager");
  await send(
    c,
    "post",
    "/transactions",
    tx({ reference: "PARTIAL-EVIDENCE", amount: "60.00" }),
  );
  const file = await preview(
    c,
    "date,reference,amount,direction\n2026-10-01,PARTIAL-EVIDENCE,100.00,in\n",
  );
  await send(c, "post", `/imports/${file.body.id}/commit`);
  const queue = (await c.agent.get("/api/exceptions?status=open")).body;
  assert.ok(
    queue.some(
      (r) => r.type === "partial_match" && r.reference === "PARTIAL-EVIDENCE",
    ),
  );
  assert.ok(queue.some((r) => r.source === "transaction"));
  const body = {
    kind: "adjustment",
    payload: {
      account_id: accounts[0].id,
      date: "2026-10-02",
      direction: "out",
      amount: "0.50",
      reference: "IDEMPOTENT-FEE",
      description: "Evidence-backed fee",
    },
    reason: "Independent fee request",
    request_key: id(),
  };
  const created = await send(c, "post", "/control-requests", body);
  assert.equal(created.status, 201);
  const applied = await send(
    manager,
    "post",
    `/control-requests/${created.body.id}/decide`,
    { decision: "approved", reason: "Verified independently" },
  );
  assert.equal(applied.status, 200);
  const replay = await send(c, "post", "/control-requests", body);
  assert.equal(replay.status, 201);
  assert.equal(replay.body.id, created.body.id);
  assert.equal(
    db
      .prepare("SELECT COUNT(*) n FROM transactions WHERE request_key=?")
      .get(created.body.id).n,
    1,
  );
});
test("independent partial allocations track remaining evidence, reject overmatching, complete exactly and undo safely", async () => {
  const c = await login(),
    manager = await login("manager"),
    auditor = await login("auditor");
  const receipt = await send(
    c,
    "post",
    "/transactions",
    tx({ reference: "PARTIAL-TRACK", amount: "100.00" }),
  );
  const file = await preview(
    c,
    "date,reference,amount,direction\n2026-10-01,PARTIAL-LINE-A,60.00,in\n2026-10-01,PARTIAL-LINE-B,60.00,in\n",
  );
  await send(c, "post", `/imports/${file.body.id}/commit`);
  const lines = db
    .prepare(
      "SELECT id FROM statement_lines WHERE import_id=? ORDER BY row_number",
    )
    .all(file.body.id);
  const propose = (line, amount) =>
    send(c, "post", "/reconciliation/partial-proposals", {
      transaction_id: receipt.body.id,
      line_id: line.id,
      amount,
      reason: "Reviewed partial settlement evidence",
    });
  assert.equal(
    (
      await send(auditor, "post", "/reconciliation/partial-proposals", {
        transaction_id: receipt.body.id,
        line_id: lines[0].id,
        amount: "60.00",
        reason: "Read-only role test",
      })
    ).status,
    403,
  );
  const first = await propose(lines[0], "60.00");
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.equal(
    (
      await send(
        c,
        "post",
        `/reconciliation/partial-proposals/${first.body.id}/decide`,
        { decision: "approved", reason: "Self decision" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await send(
        manager,
        "post",
        `/reconciliation/partial-proposals/${first.body.id}/decide`,
        {
          decision: "approved",
          reason: "Independent review of first evidence",
        },
      )
    ).status,
    200,
  );
  let remaining = (
    await c.agent.get("/api/reconciliation/participants")
  ).body.transactions.find((t) => t.id === receipt.body.id);
  assert.equal(remaining.remaining_minor, "4000");
  const partialView = await c.agent.get(
    "/api/transactions?status=partially_matched&q=PARTIAL-TRACK",
  );
  assert.equal(partialView.body.total, 1);
  assert.equal(
    partialView.body.rows[0].reconciliation_display,
    "partially_matched",
  );
  assert.equal((await propose(lines[1], "40.01")).status, 409);
  const reverse = await send(
    manager,
    "post",
    `/transactions/${receipt.body.id}/reverse`,
    { date: "2026-10-02", reason: "Must undo partial evidence first" },
  );
  assert.equal(reverse.status, 409, JSON.stringify(reverse.body));
  const second = await propose(lines[1], "40.00");
  const race = await Promise.all([
    send(
      manager,
      "post",
      `/reconciliation/partial-proposals/${second.body.id}/decide`,
      { decision: "approved", reason: "Final amount reviewed" },
    ),
    send(
      manager,
      "post",
      `/reconciliation/partial-proposals/${second.body.id}/decide`,
      { decision: "approved", reason: "Repeated click" },
    ),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    db
      .prepare("SELECT reconciliation FROM transactions WHERE id=?")
      .get(receipt.body.id).reconciliation,
    "reconciled",
  );
  const line = (await c.agent.get("/api/reconciliation")).body.find(
    (l) => l.id === lines[1].id,
  );
  assert.equal(line.status, "partially_matched");
  assert.equal(line.allocated_minor, "4000");
  assert.equal(line.remaining_minor, "2000");
  const queue = (await c.agent.get("/api/exceptions")).body.find(
    (r) => r.source_id === lines[1].id,
  );
  assert.equal(queue.type, "partial_match");
  assert.equal(queue.amount, "2000");
  assert.equal(
    (
      await send(
        c,
        "post",
        `/reconciliation/partial-proposals/${second.body.id}/undo`,
        { reason: "Reopen the final settlement for investigation" },
      )
    ).status,
    200,
  );
  assert.equal(
    db
      .prepare("SELECT reconciliation FROM transactions WHERE id=?")
      .get(receipt.body.id).reconciliation,
    "unmatched",
  );
  remaining = (
    await c.agent.get("/api/reconciliation/participants")
  ).body.transactions.find((t) => t.id === receipt.body.id);
  assert.equal(remaining.remaining_minor, "4000");
  const history = await c.agent.get("/api/reconciliation/partial-proposals");
  assert.ok(
    history.body.find((p) => p.id === second.body.id && p.status === "undone"),
  );
  assert.equal(
    (
      await c.agent.get(
        "/api/overview?from=2026-10-01&to=2026-10-01&q=PARTIAL-TRACK",
      )
    ).body.incoming,
    "10000",
  );
});
