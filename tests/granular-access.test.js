import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { openDb, id } from "../server/db.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";

async function fixture() {
  const db = openDb(":memory:"),
    password = "Granular-role-test-only-123";
  seed(db, password);
  const app = createApp(db),
    clients = {};
  async function login(role, email = `${role}@finbiz.demo`) {
    const agent = request.agent(app),
      session = await agent.get("/api/session");
    const response = await agent
      .post("/api/login")
      .set("x-csrf-token", session.body.csrf)
      .send({ email, password });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return { agent, csrf: response.body.csrf, user: response.body.user };
  }
  for (const role of ["admin", "manager", "finance", "cashier", "auditor"])
    clients[role] = await login(role);
  const send = (role, method, path, body = {}) =>
    clients[role].agent[method](`/api${path}`)
      .set("x-csrf-token", clients[role].csrf)
      .send(body);
  const tx = (overrides = {}) => ({
    date: "2026-11-04",
    amount: "20.00",
    direction: "in",
    account_id: db
      .prepare("SELECT id FROM accounts WHERE channel='mobile'")
      .get().id,
    reference: id(),
    description: "Synthetic scoped receipt",
    category: "Sales",
    request_key: id(),
    ...overrides,
  });
  return { db, app, clients, send, login, tx, password };
}

test("server-issued module/action/scope grants and new pages preserve all five role boundaries", async () => {
  const f = await fixture();
  try {
    const matrix = [
      ["/admin/access", ["admin"]],
      ["/admin/sessions", ["admin"]],
      ["/admin/maintenance", ["admin"]],
      ["/staff-overview", ["manager"]],
      ["/receipts", ["cashier"]],
      ["/sales/invoices", ["cashier"]],
      ["/invoices/assignees", ["manager", "finance"]],
      ["/notifications", Object.keys(f.clients)],
    ];
    for (const [role, client] of Object.entries(f.clients)) {
      const master = await client.agent.get("/api/master");
      assert.equal(master.status, 200);
      const grants = master.body.permissions.grants;
      assert.ok(
        grants.every(
          (g) =>
            g.id === `${g.module}.${g.action}` && typeof g.scope === "string",
        ),
      );
      assert.ok(master.body.permissions.pages.includes("Notifications"));
      if (role === "cashier")
        assert.equal(
          grants.find((g) => g.id === "finance.transaction.view").scope,
          "own",
        );
      if (role === "admin")
        assert.equal(
          grants.some((g) => g.id === "finance.transaction.view"),
          false,
        );
      if (role === "auditor")
        assert.ok(
          grants
            .filter((g) => g.module.startsWith("finance."))
            .every((g) => g.action === "view"),
        );
      for (const [path, allowed] of matrix) {
        assert.equal(
          (await client.agent.get(`/api${path}`)).status,
          allowed.includes(role) ? 200 : 403,
          `${role} GET ${path}`,
        );
        assert.equal(
          (await client.agent.head(`/api${path}`)).status,
          allowed.includes(role) ? 200 : 403,
          `${role} HEAD ${path}`,
        );
      }
    }
  } finally {
    f.db.close();
  }
});

test("restricted custom roles revoke sessions, remove write/export capabilities and cannot expand responsibility scope", async () => {
  const f = await fixture();
  try {
    const before = f.db.prepare("SELECT * FROM transactions ORDER BY id").all();
    const created = await f.send("admin", "post", "/admin/access/roles", {
      name: "Finance reviewer",
      base_role: "finance",
      permissions: [],
      reason: "Read-only preparation assignment",
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const roleId = created.body.id;
    assert.equal(
      (
        await f.send("admin", "post", "/admin/access/assign", {
          user_id: f.clients.finance.user.id,
          access_role_id: roleId,
          reason: "Restrict operations",
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.clients.finance.agent.get("/api/transactions")).status,
      401,
    );
    f.clients.finance = await f.login("finance");
    const master = (await f.clients.finance.agent.get("/api/master")).body;
    assert.equal(master.permissions.can_record, false);
    assert.equal(master.permissions.can_export, false);
    assert.ok(
      master.permissions.grants.every(
        (g) =>
          g.action === "view" ||
          ["profile", "security.mfa", "reminders"].includes(g.module),
      ),
    );
    for (const [method, path, body] of [
      [
        "post",
        "/transactions",
        { ...f.tx(), role: "manager", permissions: ["*"] },
      ],
      ["post", "/invoices", {}],
      ["patch", "/invoices/guessed-id", {}],
      ["post", "/reconciliation", {}],
      ["post", "/control-requests", {}],
      ["get", "/reports/export?format=csv", {}],
    ])
      assert.equal(
        (await f.send("finance", method, path, body)).status,
        403,
        `${method} ${path}`,
      );
    assert.equal(
      (await f.clients.finance.agent.get("/api/transactions")).status,
      200,
    );
    for (const body of [
      { name: "Administrator clone", base_role: "admin", permissions: [] },
      {
        name: "Cashier escalation",
        base_role: "cashier",
        permissions: ["users.staff.create"],
      },
      {
        name: "Scope injection",
        base_role: "cashier",
        permissions: [{ id: "finance.transaction.view", scope: "company" }],
      },
    ])
      assert.equal(
        (
          await f.send("admin", "post", "/admin/access/roles", {
            ...body,
            reason: "Invalid escalation",
          })
        ).status,
        400,
      );
    assert.equal(
      (
        await f.send("admin", "post", "/admin/access/assign", {
          user_id: f.clients.cashier.user.id,
          access_role_id: roleId,
          reason: "Mismatched responsibility",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.send("finance", "post", "/admin/access/roles", {
          name: "Forbidden",
          base_role: "finance",
          permissions: [],
          reason: "Cannot manage roles",
        })
      ).status,
      403,
    );
    assert.deepEqual(
      f.db.prepare("SELECT * FROM transactions ORDER BY id").all(),
      before,
    );
    const edited = await f.send(
      "admin",
      "patch",
      `/admin/access/roles/${roleId}`,
      {
        name: "Finance receipt officer",
        base_role: "finance",
        permissions: ["finance.transaction.create"],
        reason: "Enable receipt entry only",
      },
    );
    assert.equal(edited.status, 200);
    assert.equal(
      (await f.clients.finance.agent.get("/api/transactions")).status,
      401,
    );
    f.clients.finance = await f.login("finance");
    assert.equal(
      (await f.send("finance", "post", "/transactions", f.tx())).status,
      201,
    );
    assert.equal(
      (
        await f.send(
          "finance",
          "post",
          "/transactions",
          f.tx({ direction: "out", category: "Operations" }),
        )
      ).status,
      403,
    );
    assert.equal(
      (await f.send("finance", "post", "/invoices", {})).status,
      403,
    );
    assert.ok(
      f.db
        .prepare(
          "SELECT 1 FROM audit_events WHERE action='system.access_role_updated'",
        )
        .get(),
    );
  } finally {
    f.db.close();
  }
});

test("active-session listing exposes opaque identifiers and revocation ends only the selected session", async () => {
  const f = await fixture();
  try {
    const response = await f.clients.admin.agent.get("/api/admin/sessions");
    assert.equal(response.status, 200);
    const tokens = new Set(
      f.db
        .prepare("SELECT token FROM sessions")
        .all()
        .map((s) => s.token),
    );
    assert.ok(
      response.body.items.every(
        (s) =>
          !tokens.has(s.id) &&
          !Object.hasOwn(s, "token") &&
          !Object.hasOwn(s, "csrf"),
      ),
    );
    const cashier = response.body.items.find((s) => s.role === "cashier"),
      own = response.body.items.find((s) => s.current);
    assert.equal(
      (
        await f.send("admin", "post", `/admin/sessions/${own.id}/revoke`, {
          reason: "Current session protection",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await f.send(
          "finance",
          "post",
          `/admin/sessions/${cashier.id}/revoke`,
          { reason: "Forbidden" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await f.send("admin", "post", `/admin/sessions/${cashier.id}/revoke`, {
          reason: "End a synthetic session",
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.clients.cashier.agent.get("/api/receipts")).status,
      401,
    );
    assert.equal(
      (await f.clients.finance.agent.get("/api/transactions")).status,
      200,
    );
    assert.ok(
      f.db
        .prepare(
          "SELECT 1 FROM audit_events WHERE action='system.session_revoked'",
        )
        .get(),
    );
  } finally {
    f.db.close();
  }
});

test("cashier invoice drafts and explicit assignments never expose unassigned invoices or change ledger totals", async () => {
  const f = await fixture();
  try {
    const customer = f.db
      .prepare("SELECT id FROM contacts WHERE type='customer' AND active=1")
      .get().id;
    const invoice = (
      await f.clients.finance.agent.get("/api/invoices")
    ).body.find((i) => i.lifecycle === "issued");
    assert.ok(invoice);
    assert.equal(
      (await f.clients.cashier.agent.get("/api/sales/invoices")).body.items
        .length,
      0,
    );
    assert.equal(
      (
        await f.send("finance", "post", `/invoices/${invoice.id}/assign`, {
          user_id: f.clients.cashier.user.id,
          reason: "Collect assigned payment",
        })
      ).status,
      200,
    );
    const list = await f.clients.cashier.agent.get("/api/sales/invoices");
    assert.deepEqual(
      list.body.items.map((i) => i.id),
      [invoice.id],
    );
    const count = f.db
      .prepare("SELECT COUNT(*) AS n FROM transactions")
      .get().n;
    const created = await f.send("cashier", "post", "/sales/invoices", {
      contact_id: customer,
      issued: "2026-11-04",
      due: "2026-11-10",
      amount: "123.45",
      description: "Cashier draft for finance review",
      lifecycle: "issued",
      user_id: f.clients.manager.user.id,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const saved = f.db
      .prepare("SELECT * FROM invoices WHERE id=?")
      .get(created.body.id);
    assert.equal(saved.lifecycle, "draft");
    assert.equal(saved.user_id, f.clients.cashier.user.id);
    assert.equal(saved.amount, 12345);
    assert.equal(
      f.db.prepare("SELECT COUNT(*) AS n FROM transactions").get().n,
      count,
    );
    assert.equal(
      (
        await f.send("cashier", "patch", `/invoices/${saved.id}`, {
          lifecycle: "issued",
          reason: "Forbidden self-issue",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.send("finance", "patch", `/invoices/${saved.id}`, {
          lifecycle: "issued",
          reason: "Reviewed cashier draft",
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.clients.cashier.agent.get("/api/invoices")).status,
      403,
    );
    const supplier = f.db
      .prepare("SELECT id FROM contacts WHERE type='supplier'")
      .get().id;
    assert.equal(
      (
        await f.send("cashier", "post", "/sales/invoices", {
          contact_id: supplier,
          issued: "2026-11-04",
          due: "2026-11-10",
          amount: "1.00",
          description: "Forbidden supplier",
        })
      ).status,
      400,
    );
  } finally {
    f.db.close();
  }
});

test("receipts remain owned and immutable; print requests are audited and reversal requests need independent approval", async () => {
  const f = await fixture();
  try {
    const created = await f.send("cashier", "post", "/transactions", f.tx());
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const receipt = f.db
      .prepare(
        "SELECT * FROM transactions WHERE user_id=? ORDER BY rowid DESC LIMIT 1",
      )
      .get(f.clients.cashier.user.id);
    const foreign = f.db
      .prepare(
        "SELECT id FROM transactions WHERE user_id<>? AND direction='in'",
      )
      .get(f.clients.cashier.user.id);
    const list = await f.clients.cashier.agent.get("/api/receipts");
    assert.ok(list.body.items.some((t) => t.id === receipt.id));
    assert.ok(
      list.body.items.every((t) => t.user_id === f.clients.cashier.user.id),
    );
    const before = f.db
      .prepare("SELECT COUNT(*) AS n FROM transactions")
      .get().n;
    assert.equal(
      (await f.send("cashier", "post", `/receipts/${foreign.id}/print`)).status,
      403,
    );
    assert.equal(
      (await f.send("cashier", "post", `/receipts/${receipt.id}/print`)).status,
      200,
    );
    assert.equal(
      f.db.prepare("SELECT COUNT(*) AS n FROM transactions").get().n,
      before,
    );
    assert.ok(
      f.db
        .prepare(
          "SELECT 1 FROM audit_events WHERE entity=? AND action='receipt.print_requested'",
        )
        .get(receipt.id),
    );
    assert.equal(
      (
        await f.send(
          "cashier",
          "post",
          `/receipts/${foreign.id}/reversal-request`,
          { date: "2026-11-04", reason: "Foreign receipt" },
        )
      ).status,
      403,
    );
    const body = { date: "2026-11-04", reason: "Customer correction request" };
    const reversal = await f.send(
      "cashier",
      "post",
      `/receipts/${receipt.id}/reversal-request`,
      body,
    );
    assert.equal(reversal.status, 201, JSON.stringify(reversal.body));
    assert.equal(
      (
        await f.send(
          "cashier",
          "post",
          `/receipts/${receipt.id}/reversal-request`,
          body,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await f.send(
          "cashier",
          "post",
          `/control-requests/${reversal.body.id}/decide`,
          { decision: "approved", reason: "Forbidden self approval" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await f.send(
          "manager",
          "post",
          `/control-requests/${reversal.body.id}/decide`,
          { decision: "approved", reason: "Independent correction review" },
        )
      ).status,
      200,
    );
    assert.deepEqual(
      f.db.prepare("SELECT * FROM transactions WHERE id=?").get(receipt.id),
      receipt,
    );
    assert.ok(
      f.db
        .prepare("SELECT id FROM transactions WHERE reversal_of=?")
        .get(receipt.id),
    );
  } finally {
    f.db.close();
  }
});

test("monetary approval limits apply immediately and cannot be changed by the same approver or administrator", async () => {
  const f = await fixture();
  try {
    const target = f.clients.finance.user.id;
    assert.equal(
      (
        await f.send("manager", "post", "/approval-policy", {
          user_id: target,
          active: true,
          reason: "Synthetic payment delegation",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await f.send("admin", "post", "/approval-policy/limits", {
          user_id: target,
          max_amount: "10.00",
          reason: "No financial authority",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.send("manager", "post", "/approval-policy/limits", {
          user_id: f.clients.manager.user.id,
          max_amount: "10.00",
          reason: "Forbidden self change",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.send("manager", "post", "/approval-policy/limits", {
          user_id: target,
          max_amount: "10.00",
          reason: "Limit delegated approvals",
        })
      ).status,
      200,
    );
    const created = await f.send(
      "manager",
      "post",
      "/transactions",
      f.tx({ direction: "out", category: "Operations" }),
    );
    assert.equal(created.status, 201);
    const pending = f.db
      .prepare(
        "SELECT id FROM transactions WHERE user_id=? AND approval='pending' ORDER BY rowid DESC LIMIT 1",
      )
      .get(f.clients.manager.user.id);
    assert.equal(
      (
        await f.send("finance", "post", `/approvals/${pending.id}`, {
          decision: "approved",
          reason: "Exceeds limit",
        })
      ).status,
      403,
    );
    assert.equal(
      f.db
        .prepare("SELECT approval FROM transactions WHERE id=?")
        .get(pending.id).approval,
      "pending",
    );
    assert.equal(
      (
        await f.send("finance", "post", `/approvals/${pending.id}`, {
          decision: "rejected",
          reason: "Cannot approve amount",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await f.send(
          "manager",
          "post",
          "/transactions",
          f.tx({ direction: "out", amount: "10.00", category: "Operations" }),
        )
      ).status,
      201,
    );
    const exact = f.db
      .prepare(
        "SELECT id FROM transactions WHERE user_id=? AND approval='pending' ORDER BY rowid DESC LIMIT 1",
      )
      .get(f.clients.manager.user.id);
    assert.equal(
      (
        await f.send("finance", "post", `/approvals/${exact.id}`, {
          decision: "approved",
          reason: "At configured threshold",
        })
      ).status,
      200,
    );
    const event = f.db
      .prepare(
        "SELECT details FROM audit_events WHERE action='approval.limit' ORDER BY rowid DESC LIMIT 1",
      )
      .get();
    assert.equal(JSON.parse(event.details).max_amount, "1000");
  } finally {
    f.db.close();
  }
});

test("conditional grants on a custom role still require organisation policy and independent manager delegation", async () => {
  const f = await fixture();
  try {
    const role = await f.send("admin", "post", "/admin/access/roles", {
      name: "Delegated payment reviewer",
      base_role: "finance",
      permissions: ["finance.approval.approve", "finance.expense.approve"],
      reason: "Role eligibility only",
    });
    assert.equal(role.status, 201);
    assert.equal(
      (
        await f.send("admin", "post", "/admin/access/assign", {
          user_id: f.clients.finance.user.id,
          access_role_id: role.body.id,
          reason: "Assign bounded reviewer role",
        })
      ).status,
      200,
    );
    f.clients.finance = await f.login("finance");
    assert.equal(
      (await f.clients.finance.agent.get("/api/master")).body.permissions
        .can_approve,
      false,
    );
    assert.equal(
      (
        await f.send("manager", "post", "/approval-policy", {
          user_id: f.clients.finance.user.id,
          active: true,
          reason: "Explicit independent delegation",
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.clients.finance.agent.get("/api/master")).body.permissions
        .can_approve,
      true,
    );
    const cashierRole = await f.send("admin", "post", "/admin/access/roles", {
      name: "Customer sales officer",
      base_role: "cashier",
      permissions: ["finance.contact.create", "sales.receipt.allocate"],
      reason: "Policy-bound customer operations",
    });
    assert.equal(cashierRole.status, 201);
    assert.equal(
      (
        await f.send("admin", "post", "/admin/access/assign", {
          user_id: f.clients.cashier.user.id,
          access_role_id: cashierRole.body.id,
          reason: "Assign customer role",
        })
      ).status,
      200,
    );
    f.clients.cashier = await f.login("cashier");
    assert.equal(
      (await f.clients.cashier.agent.get("/api/master")).body.permissions
        .can_create_customers,
      false,
    );
    assert.equal(
      (
        await f.send("admin", "patch", "/settings", {
          cashier_create_customers: true,
          reason: "Enable customer creation policy",
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.clients.cashier.agent.get("/api/master")).body.permissions
        .can_create_customers,
      true,
    );
    assert.equal(
      (
        await f.send("admin", "patch", "/settings", {
          cashier_create_customers: false,
          reason: "Revoke customer creation policy",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await f.send("cashier", "post", "/contacts", {
          name: "Forbidden policy bypass",
          type: "customer",
        })
      ).status,
      403,
    );
  } finally {
    f.db.close();
  }
});

test("manager limits also guard monetary control requests and preserve an undecided request on denial", async () => {
  const f = await fixture();
  try {
    const createdManager = await f.send("admin", "post", "/users", {
      name: "Second synthetic manager",
      email: "second-manager@example.test",
      password: f.password,
      role: "manager",
    });
    assert.equal(createdManager.status, 201);
    f.clients.secondManager = await f.login(
      "manager",
      "second-manager@example.test",
    );
    assert.equal(
      (
        await f.send("secondManager", "post", "/approval-policy/limits", {
          user_id: f.clients.manager.user.id,
          max_amount: "5.00",
          reason: "Independent managerial limit",
        })
      ).status,
      200,
    );
    const posted = await f.send(
      "finance",
      "post",
      "/transactions",
      f.tx({ amount: "20.00" }),
    );
    assert.equal(posted.status, 201);
    const requestBody = {
      kind: "reversal",
      reason: "Controlled correction",
      payload: { transaction_id: posted.body.id, date: "2026-11-04" },
      request_key: id(),
    };
    const control = await f.send(
      "finance",
      "post",
      "/control-requests",
      requestBody,
    );
    assert.equal(control.status, 201, JSON.stringify(control.body));
    assert.equal(
      (
        await f.send(
          "manager",
          "post",
          `/control-requests/${control.body.id}/decide`,
          { decision: "approved", reason: "Over limit" },
        )
      ).status,
      403,
    );
    assert.equal(
      f.db
        .prepare("SELECT status FROM control_requests WHERE id=?")
        .get(control.body.id).status,
      "pending",
    );
    assert.equal(
      (
        await f.send(
          "secondManager",
          "post",
          `/control-requests/${control.body.id}/decide`,
          {
            decision: "approved",
            reason: "Independent reviewer with sufficient authority",
          },
        )
      ).status,
      200,
    );
  } finally {
    f.db.close();
  }
});

test("maintenance reports completed snapshots without exposing credentials or claiming legacy export attempts succeeded", async () => {
  const f = await fixture();
  try {
    const initial = (await f.clients.admin.agent.get("/api/admin/maintenance"))
      .body;
    assert.equal(initial.database, "ok");
    assert.equal(initial.schema_version, 11);
    assert.equal(initial.last_successful_backup, null);
    assert.equal(initial.restore.mode, "operator");
    const backup = await f.clients.admin.agent.get("/api/backup");
    assert.equal(backup.status, 200);
    const after = (await f.clients.admin.agent.get("/api/admin/maintenance"))
      .body;
    assert.ok(after.last_successful_backup);
    assert.ok(after.backups.some((b) => b.action === "backup.created"));
    const overview = (await f.clients.admin.agent.get("/api/admin/overview"))
      .body;
    assert.equal(overview.last_successful_backup, after.last_successful_backup);
    assert.equal(Object.hasOwn(overview, "incoming"), false);
  } finally {
    f.db.close();
  }
});

test("supplier allocation correction remains available to financial operators and forbidden to read-only and administrative roles", async () => {
  const f = await fixture();
  try {
    const supplier = f.db
      .prepare("SELECT id FROM contacts WHERE type='supplier' AND active=1")
      .get().id;
    const bill = await f.send("finance", "post", "/supplier-bills", {
      number: `BILL-${id()}`,
      contact_id: supplier,
      issued: "2026-11-04",
      due: "2026-11-10",
      amount: "20.00",
      description: "Synthetic payable",
    });
    assert.equal(bill.status, 201);
    const payment = await f.send(
      "finance",
      "post",
      "/transactions",
      f.tx({ direction: "out", contact_id: supplier, category: "Operations" }),
    );
    assert.equal(payment.status, 201);
    assert.equal(
      (
        await f.send("manager", "post", `/approvals/${payment.body.id}`, {
          decision: "approved",
          reason: "Independent payment review",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await f.send(
          "finance",
          "post",
          `/supplier-bills/${bill.body.id}/allocate`,
          { transaction_id: payment.body.id, amount: "20.00" },
        )
      ).status,
      200,
    );
    const allocation = f.db
      .prepare("SELECT id FROM supplier_allocations WHERE bill_id=?")
      .get(bill.body.id);
    for (const role of ["auditor", "admin", "cashier"])
      assert.equal(
        (
          await f.send(
            role,
            "post",
            `/supplier-allocations/${allocation.id}/correct`,
            { reason: "Denied" },
          )
        ).status,
        403,
      );
    assert.equal(
      (
        await f.send(
          "finance",
          "post",
          `/supplier-allocations/${allocation.id}/correct`,
          { reason: "Correct the synthetic allocation" },
        )
      ).status,
      200,
    );
    assert.ok(
      f.db
        .prepare(
          "SELECT 1 FROM supplier_allocation_corrections WHERE allocation_id=?",
        )
        .get(allocation.id),
    );
  } finally {
    f.db.close();
  }
});
