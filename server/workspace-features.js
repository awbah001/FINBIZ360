import { createHash } from "node:crypto";
import { atomic, audit, id, isoDate, money } from "./db.js";
import {
  inheritedPermission,
  roleNames,
  hasPermission,
  permissionTemplate,
} from "./permissions.js";
import { documentRows, fail, openPeriod } from "./enhancements.js";

const sessionId = (token) =>
  createHash("sha256").update(`session-list:${token}`).digest("hex");

export function registerWorkspaceFeatures(app, db, { report, text }) {
  const templates = () =>
    Object.entries(roleNames).map(([role, name]) => ({
      id: role,
      name,
      base_role: role,
      built_in: true,
      grants: permissionTemplate(db, role),
    }));
  const reason = (req) => text(req.body.reason, "Change reason", 500);
  app.post("/api/approval-policy/limits", (req, res) => {
    const target = db
      .prepare(
        "SELECT id FROM users WHERE id=? AND active=1 AND role IN ('manager','finance','admin')",
      )
      .get(text(req.body.user_id, "Approver"));
    if (!target) fail("Choose an active approver.");
    if (target.id === req.user.id)
      fail("Another manager must configure your approval limit.", 403);
    const why = reason(req),
      unlimited = req.body.unlimited === true;
    const amount = unlimited
      ? null
      : ["0", "0.00"].includes(req.body.max_amount)
        ? 0
        : money(req.body.max_amount);
    atomic(db, () => {
      const before =
        db
          .prepare("SELECT max_amount FROM approval_limits WHERE user_id=?")
          .get(target.id)?.max_amount ?? null;
      if (unlimited)
        db.prepare("DELETE FROM approval_limits WHERE user_id=?").run(
          target.id,
        );
      else
        db.prepare(
          "INSERT INTO approval_limits(user_id,max_amount,changed_by,reason) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET max_amount=excluded.max_amount,changed_by=excluded.changed_by,reason=excluded.reason,changed_at=CURRENT_TIMESTAMP",
        ).run(target.id, amount, req.user.id, why);
      audit(db, req.user.id, "approval.limit", target.id, {
        before: before === null ? null : String(before),
        max_amount: amount === null ? null : String(amount),
        reason: why,
      });
    });
    res.json({ ok: true });
  });
  app.get("/api/invoices/assignees", (req, res) => {
    if (!hasPermission(db, req.user, "finance.invoice.update"))
      fail("Invoice assignment is not permitted.", 403);
    res.json({
      items: db
        .prepare(
          "SELECT id,name FROM users WHERE role='cashier' AND active=1 ORDER BY name",
        )
        .all(),
    });
  });
  const roleBody = (req) => {
    if (
      !["manager", "finance", "cashier", "auditor"].includes(req.body.base_role)
    )
      fail(
        "Choose a business responsibility class. Administrator roles are fixed.",
      );
    const grants = permissionTemplate(db, req.body.base_role);
    const allowed = new Set(grants.map((g) => g.id));
    if (
      !Array.isArray(req.body.permissions) ||
      req.body.permissions.some((p) => typeof p !== "string" || !allowed.has(p))
    )
      fail("Permissions must belong to the selected responsibility class.");
    const permissions = [
      ...new Set([
        ...grants.filter(inheritedPermission).map((g) => g.id),
        ...req.body.permissions,
      ]),
    ];
    return {
      name: text(req.body.name, "Role name", 80),
      base_role: req.body.base_role,
      permissions,
    };
  };
  app.get("/api/admin/access", (req, res) =>
    res.json({
      templates: templates(),
      roles: db
        .prepare("SELECT * FROM access_roles ORDER BY name")
        .all()
        .map((r) => ({ ...r, permissions: JSON.parse(r.permissions) })),
      assignments: db
        .prepare(
          "SELECT u.id,u.name,u.role,u.active,a.access_role_id,r.name AS access_role_name FROM users u LEFT JOIN user_access_roles a ON a.user_id=u.id LEFT JOIN access_roles r ON r.id=a.access_role_id ORDER BY u.name",
        )
        .all(),
      inherited_reads: true,
    }),
  );
  app.post("/api/admin/access/roles", (req, res) => {
    const role = roleBody(req),
      why = reason(req),
      uid = id();
    atomic(db, () => {
      db.prepare(
        "INSERT INTO access_roles(id,name,base_role,permissions,created_by) VALUES(?,?,?,?,?)",
      ).run(
        uid,
        role.name,
        role.base_role,
        JSON.stringify(role.permissions),
        req.user.id,
      );
      audit(db, req.user.id, "system.access_role_created", uid, {
        ...role,
        reason: why,
      });
    });
    res.status(201).json({ id: uid });
  });
  app.patch("/api/admin/access/roles/:id", (req, res) => {
    const before = db
      .prepare("SELECT * FROM access_roles WHERE id=?")
      .get(req.params.id);
    if (!before) fail("Role not found.", 404);
    const role = roleBody(req),
      why = reason(req);
    if (role.base_role !== before.base_role)
      fail("A role's responsibility class cannot be changed.");
    atomic(db, () => {
      db.prepare("UPDATE access_roles SET name=?,permissions=? WHERE id=?").run(
        role.name,
        JSON.stringify(role.permissions),
        before.id,
      );
      db.prepare(
        "DELETE FROM sessions WHERE user_id IN (SELECT user_id FROM user_access_roles WHERE access_role_id=?)",
      ).run(before.id);
      audit(db, req.user.id, "system.access_role_updated", before.id, {
        before: { ...before, permissions: JSON.parse(before.permissions) },
        after: role,
        reason: why,
      });
    });
    res.json({ ok: true });
  });
  app.post("/api/admin/access/assign", (req, res) => {
    const target = db
      .prepare("SELECT id,role FROM users WHERE id=?")
      .get(text(req.body.user_id, "Staff account"));
    if (!target) fail("Staff account not found.", 404);
    if (target.id === req.user.id || target.role === "admin")
      fail("Administrator access uses the fixed system role.", 403);
    const why = reason(req),
      profileId = req.body.access_role_id;
    if (profileId !== null && typeof profileId !== "string")
      fail("Choose a role or the standard responsibility role.");
    const profile =
      profileId &&
      db.prepare("SELECT * FROM access_roles WHERE id=?").get(profileId);
    if (profileId && (!profile || profile.base_role !== target.role))
      fail("The role must match the staff member's responsibility class.", 403);
    atomic(db, () => {
      const before =
        db
          .prepare(
            "SELECT access_role_id FROM user_access_roles WHERE user_id=?",
          )
          .get(target.id)?.access_role_id || null;
      db.prepare("DELETE FROM user_access_roles WHERE user_id=?").run(
        target.id,
      );
      if (profile)
        db.prepare("INSERT INTO user_access_roles VALUES(?,?)").run(
          target.id,
          profile.id,
        );
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(target.id);
      // Changing a permission role cannot silently retain delegated decisions.
      db.prepare("UPDATE approval_delegates SET active=0 WHERE user_id=?").run(
        target.id,
      );
      audit(db, req.user.id, "user.access_role", target.id, {
        before,
        after: profileId,
        reason: why,
        sessions_revoked: true,
      });
    });
    res.json({ ok: true });
  });
  app.get("/api/admin/sessions", (req, res) =>
    res.json({
      items: db
        .prepare(
          "SELECT s.token,s.expires,u.id AS user_id,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.expires>? AND u.active=1 ORDER BY s.expires DESC",
        )
        .all(Date.now())
        .map(({ token, ...s }) => ({
          ...s,
          id: sessionId(token),
          current: token === req.session.token,
        })),
    }),
  );
  app.post("/api/admin/sessions/:id/revoke", (req, res) => {
    const session = db
      .prepare(
        "SELECT token,user_id FROM sessions WHERE user_id IS NOT NULL AND expires>?",
      )
      .all(Date.now())
      .find((s) => sessionId(s.token) === req.params.id);
    if (!session) fail("Active session not found.", 404);
    if (session.token === req.session.token)
      fail("Use Sign out to end your current session.");
    const why = reason(req);
    atomic(db, () => {
      db.prepare("DELETE FROM sessions WHERE token=?").run(session.token);
      audit(db, req.user.id, "system.session_revoked", session.user_id, {
        reason: why,
      });
    });
    res.json({ ok: true });
  });
  app.get("/api/admin/maintenance", (req, res) => {
    const backups = db
      .prepare(
        "SELECT id,action,created_at,details FROM audit_events WHERE action LIKE 'backup.%' ORDER BY rowid DESC LIMIT 50",
      )
      .all();
    res.json({
      database: db.prepare("PRAGMA quick_check").get().quick_check,
      schema_version: db
        .prepare("SELECT MAX(version) AS version FROM migrations")
        .get().version,
      organisation: db
        .prepare("SELECT name,currency,timezone,mode FROM settings WHERE id=1")
        .get(),
      last_successful_backup:
        backups.find((b) =>
          ["backup.created", "backup.encrypted_verified"].includes(b.action),
        )?.created_at || null,
      backups,
      restore: {
        mode: "operator",
        command:
          "npm run restore -- --source backups/snapshot.db --destination data/restored-new.db",
        description:
          "Restores to a new file, validates integrity and invalidates sessions. An operator must review the copy and restart the application with DB_PATH pointing to it.",
      },
    });
  });
  app.get("/api/staff-overview", (req, res) =>
    res.json({
      items: db
        .prepare("SELECT id,name,role,active FROM users ORDER BY name")
        .all(),
    }),
  );
  app.get("/api/receipts", (req, res) => {
    const rows = report(req).filter(
      (t) => t.direction === "in" && !t.reversal_of,
    );
    res.json({
      items: rows.map((t) => ({
        ...t,
        reversed: !!db
          .prepare("SELECT 1 FROM transactions WHERE reversal_of=?")
          .get(t.id),
      })),
      organisation: db
        .prepare("SELECT name,currency FROM settings WHERE id=1")
        .get(),
    });
  });
  app.post("/api/receipts/:id/reversal-request", (req, res) => {
    const receipt = db
      .prepare(
        "SELECT * FROM transactions WHERE id=? AND user_id=? AND direction='in' AND reversal_of IS NULL",
      )
      .get(req.params.id, req.user.id);
    if (!receipt) fail("Receipt not found in your workspace.", 403);
    if (
      db
        .prepare("SELECT 1 FROM transactions WHERE reversal_of=?")
        .get(receipt.id)
    )
      fail("This receipt is already reversed.", 409);
    const why = reason(req),
      date = isoDate(req.body.date);
    openPeriod(db, date);
    const uid = id();
    atomic(db, () => {
      const pending = db
        .prepare(
          "SELECT 1 FROM control_requests WHERE kind='reversal' AND status='pending' AND json_extract(payload,'$.transaction_id')=?",
        )
        .get(receipt.id);
      if (pending) fail("A reversal request is already awaiting review.", 409);
      const payload = { transaction_id: receipt.id, date };
      db.prepare(
        "INSERT INTO control_requests(id,kind,payload,reason,user_id) VALUES(?,'reversal',?,?,?)",
      ).run(uid, JSON.stringify(payload), why, req.user.id);
      audit(db, req.user.id, "control.request", uid, {
        kind: "reversal",
        payload,
        reason: why,
      });
    });
    res.status(201).json({ id: uid });
  });
  app.post("/api/receipts/:id/print", (req, res) => {
    const receipt = db
      .prepare(
        "SELECT id FROM transactions WHERE id=? AND user_id=? AND direction='in' AND reversal_of IS NULL",
      )
      .get(req.params.id, req.user.id);
    if (!receipt) fail("Receipt not found in your workspace.", 403);
    audit(db, req.user.id, "receipt.print_requested", receipt.id);
    res.json({ ok: true });
  });
  app.post("/api/invoices/:id/assign", (req, res) => {
    const invoice = db
      .prepare("SELECT id,lifecycle FROM invoices WHERE id=?")
      .get(req.params.id);
    if (!invoice || invoice.lifecycle === "cancelled")
      fail("Choose an available invoice.");
    const cashier = db
      .prepare(
        "SELECT id FROM users WHERE id=? AND active=1 AND role='cashier'",
      )
      .get(text(req.body.user_id, "Cashier"));
    if (!cashier) fail("Choose an active cashier.");
    const why = reason(req);
    atomic(db, () => {
      db.prepare(
        "INSERT INTO invoice_assignments(invoice_id,user_id,assigned_by) VALUES(?,?,?) ON CONFLICT(invoice_id) DO UPDATE SET user_id=excluded.user_id,assigned_by=excluded.assigned_by,created_at=CURRENT_TIMESTAMP",
      ).run(invoice.id, cashier.id, req.user.id);
      audit(db, req.user.id, "invoice.assign", invoice.id, {
        user_id: cashier.id,
        reason: why,
      });
    });
    res.json({ ok: true });
  });
  app.get("/api/sales/invoices", (req, res) => {
    const assigned = new Set(
      db
        .prepare("SELECT invoice_id FROM invoice_assignments WHERE user_id=?")
        .all(req.user.id)
        .map((i) => i.invoice_id),
    );
    const items = documentRows(db)
      .filter((i) => assigned.has(i.id) || i.user_id === req.user.id)
      .map((i) => ({
        id: i.id,
        number: i.number,
        contact_id: i.contact_id,
        contact_name: i.contact_name,
        issued: i.issued,
        due: i.due,
        amount: i.amount,
        outstanding: i.outstanding,
        description: i.description,
        lifecycle: i.lifecycle,
      }));
    res.json({ items });
  });
  app.post("/api/sales/invoices", (req, res) => {
    const customer = db
      .prepare(
        "SELECT id FROM contacts WHERE id=? AND type='customer' AND active=1",
      )
      .get(text(req.body.contact_id, "Customer"));
    if (!customer) fail("Choose an active customer.");
    const issued = isoDate(req.body.issued),
      due = isoDate(req.body.due);
    if (due < issued) fail("Due date must be on or after the issue date.");
    const amount = money(req.body.amount),
      description = text(req.body.description, "Description", 500),
      uid = id();
    atomic(db, () => {
      const number = `DRAFT-${uid}`;
      db.prepare(
        "INSERT INTO invoices(id,number,contact_id,issued,due,amount,description,user_id,lifecycle) VALUES(?,?,?,?,?,?,?,?,'draft')",
      ).run(
        uid,
        number,
        customer.id,
        issued,
        due,
        amount,
        description,
        req.user.id,
      );
      db.prepare(
        "INSERT INTO invoice_assignments(invoice_id,user_id,assigned_by) VALUES(?,?,?)",
      ).run(uid, req.user.id, req.user.id);
      audit(db, req.user.id, "invoice.create", uid, {
        number,
        lifecycle: "draft",
        amount: String(amount),
        sales_request: true,
      });
    });
    res.status(201).json({ id: uid, lifecycle: "draft" });
  });
}
