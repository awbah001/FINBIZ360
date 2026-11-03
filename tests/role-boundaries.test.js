import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { openDb, id } from "../server/db.js";
import { createApp } from "../server/app.js";
import { seed } from "../server/seed.js";

async function fixture() {
  const db = openDb(":memory:");
  const password = "Role-boundary-testing-123";
  seed(db, password);
  const app = createApp(db),
    clients = {};
  for (const role of ["manager", "finance", "cashier", "auditor", "admin"]) {
    const agent = request.agent(app),
      session = await agent.get("/api/session");
    const login = await agent
      .post("/api/login")
      .set("x-csrf-token", session.body.csrf)
      .send({ email: `${role}@finbiz.demo`, password });
    assert.equal(login.status, 200);
    clients[role] = { agent, csrf: login.body.csrf, user: login.body.user };
  }
  const send = (role, method, path, body = {}) =>
    clients[role].agent[method]("/api" + path)
      .set("x-csrf-token", clients[role].csrf)
      .send(body);
  return { db, clients, send };
}

test("direct API requests enforce workspace boundaries across all five roles", async () => {
  const { db, clients, send } = await fixture();
  try {
    const matrix = [
      ["/overview", ["manager", "finance", "cashier", "auditor"]],
      ["/transactions", ["manager", "finance", "cashier", "auditor"]],
      ["/invoices", ["manager", "finance", "auditor"]],
      ["/supplier-bills", ["manager", "finance", "auditor"]],
      ["/imports", ["manager", "finance", "auditor"]],
      ["/reconciliation", ["manager", "finance", "auditor"]],
      ["/exceptions", ["manager", "finance", "auditor"]],
      ["/analytics", ["manager", "finance", "auditor"]],
      ["/control-requests", ["manager", "finance", "auditor"]],
      ["/reports/data?kind=transactions", ["manager", "finance", "auditor"]],
      ["/reports/export?format=csv", ["manager", "finance"]],
      ["/approval-policy", ["manager", "finance", "auditor"]],
      ["/approvals", ["manager", "finance", "auditor"]],
      ["/audit", ["manager", "finance", "auditor", "admin"]],
      ["/settings", ["manager", "finance", "admin"]],
      ["/users", ["admin"]],
      ["/admin/overview", ["admin"]],
      ["/search?q=Sale", ["manager", "finance", "auditor", "cashier"]],
    ];
    for (const [path, allowed] of matrix)
      for (const [role, client] of Object.entries(clients)) {
        const response = await client.agent.get("/api" + path);
        assert.equal(
          response.status,
          allowed.includes(role) ? 200 : 403,
          `${role} GET ${path}: ${JSON.stringify(response.body)}`,
        );
      }
    const before = db.prepare("SELECT COUNT(*) AS n FROM audit_events").get().n;
    for (const role of ["admin", "cashier", "auditor"])
      for (const [method, path] of [
        ["post", "/accounts"],
        ["patch", "/accounts/guessed-id"],
        ["post", "/contacts"],
        ["post", "/categories"],
        ["patch", "/categories/guessed-id"],
        ["post", "/invoices"],
        ["post", "/supplier-bills"],
        ["post", "/imports/preview"],
        ["post", "/reconciliation"],
        ["post", "/exceptions/review"],
        ["post", "/control-requests"],
        ["post", "/periods"],
      ]) {
        if (role === "admin" && /^\/(accounts|categories)(\/|$)/.test(path))
          continue;
        assert.equal(
          (await send(role, method, path)).status,
          403,
          `${role} ${method} ${path}`,
        );
      }
    assert.equal(
      db.prepare("SELECT COUNT(*) AS n FROM audit_events").get().n,
      before,
    );
    for (const role of ["manager", "finance", "cashier", "auditor"]) {
      assert.equal((await send(role, "post", "/users")).status, 403);
      assert.equal((await clients[role].agent.get("/api/backup")).status, 403);
    }
    assert.equal(
      (await clients.admin.agent.get("/api/new-financial-feature")).status,
      403,
    );
  } finally {
    db.close();
  }
});

test("shared payloads, search, contact histories and evidence cannot bypass cashier or admin scopes", async () => {
  const { db, clients, send } = await fixture();
  try {
    const adminMaster = (await clients.admin.agent.get("/api/master")).body;
    assert.deepEqual(adminMaster.accounts, []);
    assert.deepEqual(adminMaster.contacts, []);
    assert.deepEqual(adminMaster.categories, []);
    assert.equal(adminMaster.permissions.transaction_scope, "none");
    const master = (await clients.cashier.agent.get("/api/master")).body;
    assert.ok(master.contacts.every((c) => c.type === "customer" && c.active));
    assert.ok(
      master.accounts.every(
        (a) =>
          a.active &&
          a.opening_amount === undefined &&
          a.opening_date === undefined,
      ),
    );
    assert.ok(
      master.categories.every((c) => c.active && c.direction !== "out"),
    );
    const supplier = db
      .prepare("SELECT * FROM contacts WHERE type='supplier' LIMIT 1")
      .get();
    assert.equal(
      (await clients.cashier.agent.get(`/api/contacts/${supplier.id}/history`))
        .status,
      403,
    );
    const search = (
      await clients.cashier.agent.get(
        "/api/search?q=" + encodeURIComponent(supplier.name.slice(0, 3)),
      )
    ).body;
    assert.ok(search.contacts.every((c) => c.type === "customer"));
    assert.deepEqual(search.documents, []);
    const account =
      master.accounts.find((a) => a.channel === "mobile") || master.accounts[0];
    const receipt = {
      date: "2026-11-03",
      direction: "in",
      amount: "10.25",
      description: "Cashier isolation receipt",
      category: "Sales",
      account_id: account.id,
      reference: "ROLE-RECEIPT",
      request_key: id(),
    };
    assert.equal(
      (
        await send("cashier", "post", "/transactions", {
          ...receipt,
          contact_id: supplier.id,
        })
      ).status,
      403,
    );
    const expenseCategory = db
      .prepare(
        "SELECT name FROM categories WHERE direction='out' AND active=1 LIMIT 1",
      )
      .get();
    assert.ok(expenseCategory);
    assert.equal(
      (
        await send("cashier", "post", "/transactions", {
          ...receipt,
          category: expenseCategory.name,
        })
      ).status,
      403,
    );
    assert.equal(
      (await send("cashier", "post", "/transactions", receipt)).status,
      201,
    );
    const overview = (await clients.cashier.agent.get("/api/overview")).body;
    assert.equal(overview.count, 1);
    assert.equal(overview.incoming, "1025");
    assert.deepEqual(overview.accounts, []);
    assert.ok(
      overview.recent.every((t) => t.user_id === clients.cashier.user.id),
    );
    const other = db
      .prepare("SELECT id FROM transactions WHERE user_id<>? LIMIT 1")
      .get(clients.cashier.user.id);
    for (const role of ["admin", "cashier"])
      assert.equal(
        (
          await clients[role].agent.get(
            `/api/transactions/${other.id}/evidence`,
          )
        ).status,
        403,
      );
    const audit = (await clients.admin.agent.get("/api/audit")).body;
    assert.ok(
      audit.every(
        (e) =>
          /^(auth\.|user\.)/.test(e.action) ||
          ["settings.update", "backup.export", "approval.delegate"].includes(
            e.action,
          ),
      ),
    );
  } finally {
    db.close();
  }
});

test("explicit admin delegation grants payment review only and revocation takes effect in the same session", async () => {
  const { db, clients, send } = await fixture();
  try {
    const admin = clients.admin;
    assert.equal((await admin.agent.get("/api/approvals")).status, 403);
    assert.equal(
      (
        await send("manager", "post", "/approval-policy", {
          user_id: admin.user.id,
          active: true,
          reason: "Independent test reviewer",
        })
      ).status,
      200,
    );
    assert.equal(
      (await admin.agent.get("/api/master")).body.permissions.can_approve,
      true,
    );
    const queue = await admin.agent.get("/api/approvals");
    assert.equal(queue.status, 200);
    assert.ok(queue.body.length > 0);
    for (const path of [
      "/transactions",
      "/overview",
      "/reports/export?format=csv",
      "/control-requests",
    ])
      assert.equal((await admin.agent.get("/api" + path)).status, 403);
    const pending = queue.body[0];
    assert.equal(
      (
        await send("admin", "post", `/approvals/${pending.id}`, {
          decision: "approved",
          reason: "Independent review completed",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await send("manager", "post", "/approval-policy", {
          user_id: admin.user.id,
          active: false,
          reason: "Reviewer duty ended",
        })
      ).status,
      200,
    );
    assert.equal(
      (await admin.agent.get("/api/master")).body.permissions.can_approve,
      false,
    );
    assert.equal((await admin.agent.get("/api/approvals")).status, 403);
    assert.equal(
      (
        await send("admin", "post", `/approvals/${pending.id}`, {
          decision: "rejected",
          reason: "Must be denied",
        })
      ).status,
      403,
    );
  } finally {
    db.close();
  }
});
