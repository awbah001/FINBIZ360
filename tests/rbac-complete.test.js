import { test } from "node:test";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";
import request from "supertest";
import { openDb, id } from "../server/db.js";
import { createApp } from "../server/app.js";
import { seed } from "../server/seed.js";
import { businessDate } from "../server/role-data.js";
async function setup() {
  const db = openDb(":memory:"),
    password = "Full-RBAC-test-password-123";
  seed(db, password);
  const app = createApp(db),
    clients = {};
  async function login(email, password) {
    const agent = request.agent(app),
      session = await agent.get("/api/session");
    const r = await agent
      .post("/api/login")
      .set("x-csrf-token", session.body.csrf)
      .send({ email, password });
    return { agent, csrf: r.body.csrf, response: r };
  }
  for (const role of ["manager", "finance", "cashier", "auditor", "admin"]) {
    const client = await login(`${role}@finbiz.demo`, password);
    assert.equal(client.response.status, 200);
    clients[role] = client;
  }
  const send = (role, method, path, body = {}) =>
    clients[role].agent[method]("/api" + path)
      .set("x-csrf-token", clients[role].csrf)
      .send(body);
  const receipt = (extra = {}) => ({
    date: businessDate(),
    direction: "in",
    amount: "10.25",
    description: "Role workflow receipt",
    category: "Sales",
    account_id: db
      .prepare("SELECT id FROM accounts WHERE channel='mobile' LIMIT 1")
      .get().id,
    reference: id(),
    request_key: id(),
    ...extra,
  });
  return { db, app, password, clients, send, login, receipt };
}
test("administrator user search, metadata and reauthenticated reset preserve security and revoke sessions", async () => {
  const { db, password, clients, send, login } = await setup();
  try {
    const created = await send("admin", "post", "/users", {
      name: "New reviewer",
      email: "new.review@example.test",
      password,
      role: "auditor",
    });
    assert.equal(created.status, 201);
    const users = await clients.admin.agent.get(
      "/api/users?q=new.review&role=auditor&active=1",
    );
    assert.equal(users.body.length, 1);
    assert.ok(users.body[0].registered_at);
    assert.equal(users.body[0].password, undefined);
    assert.equal(users.body[0].last_login_at, null);
    const reviewer = await login("new.review@example.test", password);
    assert.equal(reviewer.response.status, 200);
    assert.ok(
      (await clients.admin.agent.get("/api/users?q=new.review")).body[0]
        .last_login_at,
    );
    assert.equal(
      (
        await send(
          "cashier",
          "post",
          `/users/${created.body.id}/reset-password`,
          { current_password: password, reason: "No authority", role: "admin" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await send(
          "admin",
          "post",
          `/users/${created.body.id}/reset-password`,
          { current_password: "wrong-password", reason: "Recovery" },
        )
      ).status,
      403,
    );
    const reset = await send(
      "admin",
      "post",
      `/users/${created.body.id}/reset-password`,
      { current_password: password, reason: "Verified local recovery" },
    );
    assert.equal(reset.status, 200);
    assert.ok(reset.body.temporary_password.length >= 12);
    assert.equal((await reviewer.agent.get("/api/overview")).status, 401);
    assert.equal(
      (await login("new.review@example.test", password)).response.status,
      401,
    );
    assert.equal(
      (await login("new.review@example.test", reset.body.temporary_password))
        .response.status,
      200,
    );
    const event = db
      .prepare(
        "SELECT details FROM audit_events WHERE entity=? AND action='user.password_reset'",
      )
      .get(created.body.id);
    assert.match(event.details, /Verified local recovery/);
    assert.ok(!event.details.includes(reset.body.temporary_password));
    assert.ok(!event.details.includes(password));
    const own = db.prepare("SELECT id FROM users WHERE role='admin'").get().id;
    assert.equal(
      (
        await send("admin", "post", `/users/${own}/reset-password`, {
          current_password: password,
          reason: "Self reset",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await send("admin", "patch", `/users/${created.body.id}`, {
          active: false,
          reason: "Offboard",
        })
      ).status,
      200,
    );
    assert.equal(
      (await login("new.review@example.test", reset.body.temporary_password))
        .response.status,
      401,
    );
  } finally {
    db.close();
  }
});
test("organisation policy explicitly controls auditor exports and cashier customer creation", async () => {
  const { db, clients, send } = await setup();
  try {
    for (const role of ["manager", "finance", "auditor", "cashier"])
      assert.equal(
        (await clients[role].agent.get("/api/workspace-summary")).status,
        200,
        role + " workspace summary",
      );
    for (const path of [
      "/reports/export?format=csv",
      "/reports/download?kind=transactions&format=pdf",
    ]) {
      assert.equal(
        (await clients.auditor.agent.get("/api" + path)).status,
        403,
      );
      assert.equal(
        (await clients.auditor.agent.head("/api" + path)).status,
        403,
      );
    }
    assert.equal(
      (await clients.auditor.agent.get("/api/reports/data?kind=transactions"))
        .status,
      200,
    );
    assert.equal(
      (
        await send("cashier", "post", "/contacts", {
          name: "Receipt customer",
          type: "customer",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await send("finance", "patch", "/settings", {
          auditor_export_allowed: true,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await send("admin", "patch", "/settings", {
          auditor_export_allowed: "true",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await send("admin", "patch", "/settings", {
          auditor_export_allowed: true,
          cashier_create_customers: true,
          reason: "Explicit policy approval",
        })
      ).status,
      200,
    );
    assert.equal(
      (await clients.auditor.agent.get("/api/master")).body.permissions
        .can_export,
      true,
    );
    assert.equal(
      (await clients.auditor.agent.get("/api/reports/export?format=csv"))
        .status,
      200,
    );
    assert.equal(
      (
        await send("cashier", "post", "/contacts", {
          name: "Receipt customer",
          type: "customer",
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await send("cashier", "post", "/contacts", {
          name: "Forbidden supplier",
          type: "supplier",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await send("admin", "patch", "/settings", {
          auditor_export_allowed: false,
          cashier_create_customers: false,
          reason: "Policy revoked",
        })
      ).status,
      200,
    );
    assert.equal(
      (await clients.auditor.agent.get("/api/reports/export?format=csv"))
        .status,
      403,
    );
    const account = await send("admin", "post", "/accounts", {
      name: "Admin bank reference",
      channel: "bank",
      currency: "SLE",
    });
    assert.equal(account.status, 201);
    assert.equal(
      (
        await send("admin", "post", "/accounts", {
          name: "Forbidden balance",
          channel: "bank",
          opening_amount: "50.00",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await send("admin", "post", "/categories", {
          name: "Sales reference category",
          direction: "in",
        })
      ).status,
      201,
    );
    const config = (await clients.admin.agent.get("/api/admin/configuration"))
      .body;
    assert.ok(
      config.accounts.every(
        (a) => a.opening_amount === undefined && a.balance === undefined,
      ),
    );
    assert.deepEqual(config.supported_currencies, ["SLE"]);
    assert.equal((await clients.admin.agent.get("/api/overview")).status, 403);
    assert.equal((await clients.admin.agent.get("/api/approvals")).status, 403);
    const stats = (await clients.admin.agent.get("/api/admin/overview")).body;
    assert.equal(stats.total_users, 5);
    assert.equal(stats.role_distribution.length, 5);
  } finally {
    db.close();
  }
});
test("cashier sales, daily receipt channels, exact partial invoice allocation and ownership are enforced", async () => {
  const { db, clients, send, receipt } = await setup();
  try {
    const customer = db
      .prepare("SELECT id FROM contacts WHERE type='customer' LIMIT 1")
      .get().id;
    const a = await send(
      "cashier",
      "post",
      "/transactions",
      receipt({ contact_id: customer, entry_kind: "sale" }),
    );
    assert.equal(a.status, 201);
    const cash = db
      .prepare("SELECT id FROM accounts WHERE channel='cash' LIMIT 1")
      .get().id;
    assert.equal(
      (
        await send(
          "cashier",
          "post",
          "/transactions",
          receipt({ account_id: cash, amount: "2.50" }),
        )
      ).status,
      201,
    );
    const summary = (await clients.cashier.agent.get("/api/workspace-summary"))
      .body;
    assert.equal(summary.daily.sales, "1025");
    assert.equal(summary.daily.incoming, "1275");
    assert.equal(summary.daily.cash, "250");
    assert.equal(summary.daily.mobile, "1025");
    assert.equal(summary.daily.sales_count, 1);
    assert.equal(summary.daily.count, 2);
    const scoped = (
      await clients.cashier.agent.get("/api/workspace-summary?account=" + cash)
    ).body;
    assert.equal(scoped.daily.sales, "0");
    assert.equal(scoped.daily.incoming, "250");
    const invoice = await send("finance", "post", "/invoices", {
      number: id(),
      contact_id: customer,
      issued: businessDate(),
      due: businessDate(),
      amount: "20.00",
      description: "Cashier allocation invoice",
    });
    assert.equal(invoice.status, 201);
    assert.equal(
      (await clients.cashier.agent.get(`/api/receipts/${a.body.id}/invoices`))
        .status,
      403,
    );
    await send("admin", "patch", "/settings", {
      cashier_invoice_allocation: true,
      reason: "Allow receipt allocation",
    });
    const invoices = await clients.cashier.agent.get(
      `/api/receipts/${a.body.id}/invoices`,
    );
    assert.equal(invoices.status, 200);
    assert.ok(invoices.body.invoices.some((i) => i.id === invoice.body.id));
    assert.equal(
      (
        await send("cashier", "post", `/receipts/${a.body.id}/allocate`, {
          invoice_id: invoice.body.id,
          amount: "5.25",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await send("cashier", "post", `/receipts/${a.body.id}/allocate`, {
          invoice_id: invoice.body.id,
          amount: "6.00",
        })
      ).status,
      409,
    );
    assert.equal(
      (await clients.cashier.agent.get(`/api/receipts/${a.body.id}/invoices`))
        .body.available,
      "500",
    );
    const other = db
      .prepare(
        "SELECT id FROM transactions WHERE user_id<>(SELECT id FROM users WHERE role='cashier') LIMIT 1",
      )
      .get().id;
    assert.equal(
      (await clients.cashier.agent.get(`/api/receipts/${other}/invoices`))
        .status,
      403,
    );
    assert.equal(
      (
        await send("cashier", "post", `/receipts/${a.body.id}/allocate`, {
          invoice_id: "outside-customer",
          amount: "1.00",
        })
      ).status,
      403,
    );
    assert.equal(
      (await clients.cashier.agent.get("/api/workspace-summary")).body.daily
        .incoming,
      "1275",
    );
    assert.equal(
      (await clients.cashier.agent.get("/api/invoices")).status,
      403,
    );
  } finally {
    db.close();
  }
});
test("approval histories, audit filters and notifications are complete and scoped to role", async () => {
  const { db, clients, send, receipt } = await setup();
  try {
    const expense = await send(
      "finance",
      "post",
      "/transactions",
      receipt({ direction: "out", category: "Operations" }),
    );
    assert.equal(expense.status, 201);
    assert.equal(
      (
        await send("finance", "post", `/approvals/${expense.body.id}`, {
          decision: "approved",
          reason: "Self decision",
        })
      ).status,
      403,
    );
    const notice = (await clients.manager.agent.get("/api/notifications")).body;
    assert.ok(notice.items.some((i) => i.page === "Approvals"));
    assert.equal(
      (
        await send("manager", "post", `/approvals/${expense.body.id}`, {
          decision: "rejected",
          reason: "Missing supporting evidence",
        })
      ).status,
      200,
    );
    const history = await clients.auditor.agent.get(
      "/api/approvals/history?status=rejected",
    );
    assert.equal(history.status, 200);
    assert.ok(
      history.body.some(
        (i) =>
          i.reference === expense.body.id &&
          i.reason === "Missing supporting evidence" &&
          i.reviewer &&
          i.decided_at,
      ),
    );
    assert.equal(
      (await clients.cashier.agent.get("/api/approvals/history")).status,
      403,
    );
    assert.equal(
      (await clients.admin.agent.get("/api/approvals/history")).status,
      403,
    );
    const finance = db
      .prepare("SELECT id FROM users WHERE role='finance'")
      .get().id;
    const events = (
      await clients.auditor.agent.get(
        "/api/audit?user=" +
          finance +
          "&action=transaction.create&from=" +
          businessDate() +
          "&to=" +
          businessDate(),
      )
    ).body;
    assert.ok(events.length);
    assert.ok(
      events.every(
        (e) => e.user_id === finance && e.action === "transaction.create",
      ),
    );
    assert.equal(
      (await clients.auditor.agent.get("/api/audit?from=invalid")).status,
      400,
    );
    const adminNotice = (await clients.admin.agent.get("/api/notifications"))
      .body;
    assert.ok(
      adminNotice.items.every((i) =>
        ["Audit trail", "System maintenance"].includes(i.page),
      ),
    );
    assert.ok(adminNotice.items.some((i) => i.id === "backup:disabled"));
    assert.ok(
      !JSON.stringify(adminNotice).includes("Missing supporting evidence"),
    );
    const cashNotice = (await clients.cashier.agent.get("/api/notifications"))
      .body;
    assert.ok(cashNotice.items.every((i) => i.page === "Transactions"));
    assert.equal(
      (
        await send("auditor", "post", "/transactions", {
          ...receipt(),
          role: "manager",
        })
      ).status,
      403,
    );
  } finally {
    db.close();
  }
});
test("role changes and reactivation never revive old delegated approval authority", async () => {
  const { db, clients, send, login, password } = await setup();
  try {
    const target = db
      .prepare("SELECT id FROM users WHERE role='finance'")
      .get().id;
    assert.equal(
      (
        await send("manager", "post", "/approval-policy", {
          user_id: target,
          active: true,
          reason: "Initial payment reviewer",
        })
      ).status,
      200,
    );
    assert.equal(
      (await clients.finance.agent.get("/api/master")).body.permissions
        .can_approve,
      true,
    );
    assert.equal(
      (
        await send("admin", "patch", `/users/${target}`, {
          role: "admin",
          reason: "Change responsibilities",
        })
      ).status,
      200,
    );
    assert.equal((await clients.finance.agent.get("/api/master")).status, 401);
    const reassigned = await login("finance@finbiz.demo", password);
    assert.equal(reassigned.response.body.user.role, "admin");
    assert.equal(
      (await reassigned.agent.get("/api/master")).body.permissions.can_approve,
      false,
    );
    assert.equal(
      (
        await send("admin", "patch", `/users/${target}`, {
          role: "finance",
          reason: "Return to operations",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await send("manager", "post", "/approval-policy", {
          user_id: target,
          active: true,
          reason: "New explicit delegation",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await send("admin", "patch", `/users/${target}`, {
          active: false,
          reason: "Disable access",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await send("admin", "patch", `/users/${target}`, {
          active: true,
          reason: "Restore staff access only",
        })
      ).status,
      200,
    );
    const restored = await login("finance@finbiz.demo", password);
    assert.equal(
      (await restored.agent.get("/api/master")).body.permissions.can_approve,
      false,
    );
    for (const role of ["admin", "cashier"])
      assert.equal(
        (await clients[role].agent.get("/api/master")).body.permissions
          .can_export,
        false,
      );
  } finally {
    db.close();
  }
});

test("version 7 rollback preserves users, financial records and immutable audit history", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    // Exercise the historical v7 rollback from its original schema version.
    db.exec("PRAGMA foreign_keys=ON");
    const source = readFileSync(
      new URL("../server/db.js", import.meta.url),
      "utf8",
    );
    for (const [, sql] of source.matchAll(/db\.exec\(`([\s\S]*?)`\)/g)) {
      db.exec(sql);
      if (sql.includes("INSERT INTO migrations(version) VALUES (7)")) break;
    }
    seed(db, "Synthetic-rollback-fixture-123!");
    const users = db.prepare("SELECT * FROM users ORDER BY id").all(),
      transactions = db.prepare("SELECT * FROM transactions ORDER BY id").all(),
      events = db.prepare("SELECT * FROM audit_events ORDER BY id").all();
    assert.equal(
      db.prepare("SELECT MAX(version) AS n FROM migrations").get().n,
      7,
    );
    db.exec(
      readFileSync(
        new URL("../docs/RBAC_V7_ROLLBACK.sql", import.meta.url),
        "utf8",
      ),
    );
    assert.equal(
      db.prepare("SELECT MAX(version) AS n FROM migrations").get().n,
      6,
    );
    assert.deepEqual(
      db.prepare("SELECT * FROM users ORDER BY id").all(),
      users,
    );
    assert.deepEqual(
      db.prepare("SELECT * FROM transactions ORDER BY id").all(),
      transactions,
    );
    assert.deepEqual(
      db.prepare("SELECT * FROM audit_events ORDER BY id").all(),
      events,
    );
    assert.ok(
      !db
        .prepare("PRAGMA table_info(settings)")
        .all()
        .some((c) => c.name === "auditor_export_allowed"),
    );
    assert.equal(
      db.prepare("PRAGMA integrity_check").get().integrity_check,
      "ok",
    );
  } finally {
    db.close();
  }
});
