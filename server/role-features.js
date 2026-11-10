import { staffImageSql } from "./profile-images.js";
import { rateLimit } from "express-rate-limit";
import { randomBytes } from "node:crypto";
import { atomic, audit, hashPassword, verifyPassword, isoDate } from "./db.js";
import { documentRows, fail } from "./enhancements.js";
import { hasApprovalAuthority } from "./access.js";

const adminActions =
  "(e.action LIKE 'auth.%' OR e.action LIKE 'user.%' OR e.action LIKE 'system.%' OR e.action LIKE 'backup.%' OR e.action IN ('settings.update','approval.delegate','account.create','account.update','category.create','category.update'))";
import { approvalHistory } from "./role-data.js";
import { operationalReminders } from "./business-operations.js";
export function registerRoleFeatures(
  app,
  db,
  { allow, text, report, allocateInvoice },
) {
  app.get("/api/users", allow(["admin"]), (req, res) => {
    const where = ["1=1"],
      values = [];
    if (req.query.q) {
      where.push("(u.name LIKE ? OR u.email LIKE ?)");
      values.push(
        `%${String(req.query.q).slice(0, 100)}%`,
        `%${String(req.query.q).slice(0, 100)}%`,
      );
    }
    if (req.query.role) {
      where.push("u.role=?");
      values.push(String(req.query.role));
    }
    if (req.query.active !== undefined) {
      if (!["0", "1"].includes(req.query.active))
        fail("Choose active or inactive status.");
      where.push("u.active=?");
      values.push(Number(req.query.active));
    }
    res.json(
      db
        .prepare(
          `SELECT u.id,u.name,u.email,u.role,u.active,${staffImageSql("u.id")} AS image_url,(SELECT MIN(e.created_at) FROM audit_events e WHERE e.action='user.create' AND e.entity=u.id) AS registered_at,(SELECT MAX(e.created_at) FROM audit_events e WHERE e.action='auth.login' AND e.user_id=u.id) AS last_login_at FROM users u WHERE ${where.join(" AND ")} ORDER BY u.name`,
        )
        .all(...values),
    );
  });
  app.post(
    "/api/users/:id/reset-password",
    allow(["admin"]),
    rateLimit({
      windowMs: 60 * 60 * 1000,
      limit: 10,
      keyGenerator: (req) => req.user.id,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    (req, res) => {
      if (req.params.id === req.user.id)
        fail("Change your own password from Profile.", 403);
      const reason = text(req.body.reason, "Reset reason", 500),
        current = text(
          req.body.current_password,
          "Your current administrator password",
          256,
        );
      if (
        !verifyPassword(
          current,
          db.prepare("SELECT password FROM users WHERE id=?").get(req.user.id)
            .password,
        )
      )
        fail("Your administrator password is incorrect.", 403);
      const target = db
        .prepare("SELECT id,email FROM users WHERE id=?")
        .get(req.params.id);
      if (!target) fail("User not found.", 404);
      const password = `Temp-${randomBytes(18).toString("base64url")}`;
      atomic(db, () => {
        db.prepare("UPDATE users SET password=? WHERE id=?").run(
          hashPassword(password),
          target.id,
        );
        db.prepare("DELETE FROM sessions WHERE user_id=?").run(target.id);
        audit(db, req.user.id, "user.password_reset", target.id, {
          reason,
          email: target.email,
          sessions_revoked: true,
        });
      });
      res.json({ temporary_password: password });
    },
  );
  app.get("/api/admin/configuration", allow(["admin"]), (req, res) =>
    res.json({
      organisation: db.prepare("SELECT * FROM settings WHERE id=1").get(),
      accounts: db
        .prepare(
          "SELECT id,name,channel,provider,currency,active,kind FROM accounts ORDER BY name",
        )
        .all(),
      categories: db.prepare("SELECT * FROM categories ORDER BY name").all(),
      supported_currencies: ["SLE"],
      payment_channels: ["cash", "bank", "mobile"],
      statement_formats: ["CSV", "XLSX"],
    }),
  );
  app.patch("/api/settings", allow(["admin"]), (req, res) =>
    atomic(db, () => {
      const before = db.prepare("SELECT * FROM settings WHERE id=1").get(),
        after = { ...before };
      if (req.body.name !== undefined)
        after.name = text(req.body.name, "Organisation name");
      for (const key of [
        "auditor_export_allowed",
        "cashier_create_customers",
        "cashier_invoice_allocation",
      ])
        if (req.body[key] !== undefined) {
          if (typeof req.body[key] !== "boolean")
            fail(`${key} must be true or false.`);
          after[key] = Number(req.body[key]);
        }
      if (req.body.currency !== undefined && req.body.currency !== "SLE")
        fail("This workspace supports SLE only.");
      const reason = req.body.reason
        ? text(req.body.reason, "Configuration reason", 500)
        : "Administrator updated organisation settings";
      db.prepare(
        "UPDATE settings SET name=?,auditor_export_allowed=?,cashier_create_customers=?,cashier_invoice_allocation=? WHERE id=1",
      ).run(
        after.name,
        after.auditor_export_allowed,
        after.cashier_create_customers,
        after.cashier_invoice_allocation,
      );
      audit(db, req.user.id, "settings.update", "organisation", {
        before,
        after,
        reason,
      });
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/audit",
    allow(["admin", "manager", "finance", "auditor"]),
    (req, res) => {
      const where = [req.user.role === "admin" ? adminActions : "1=1"],
        values = [];
      for (const [key, col] of [
        ["user", "e.user_id"],
        ["action", "e.action"],
      ])
        if (req.query[key]) {
          where.push(`${col}=?`);
          values.push(String(req.query[key]));
        }
      if (req.query.from) {
        where.push("date(e.created_at)>=?");
        values.push(isoDate(req.query.from));
      }
      if (req.query.to) {
        where.push("date(e.created_at)<=?");
        values.push(isoDate(req.query.to));
      }
      if (req.query.from && req.query.to && req.query.from > req.query.to)
        fail("From date cannot follow To date.");
      res.json(
        db
          .prepare(
            `SELECT e.*,u.name AS user_name,${staffImageSql("u.id")} AS user_image_url FROM audit_events e LEFT JOIN users u ON u.id=e.user_id WHERE ${where.join(" AND ")} ORDER BY e.created_at DESC,e.rowid DESC LIMIT 200`,
          )
          .all(...values)
          .map((event) => {
            if (
              req.user.role !== "admin" ||
              !event.action.startsWith("account.")
            )
              return event;
            const details = JSON.parse(event.details),
              clean = (value) =>
                Object.fromEntries(
                  Object.entries(value || {}).filter(([key]) =>
                    ["name", "channel", "provider", "active", "kind"].includes(
                      key,
                    ),
                  ),
                );
            const sanitized = { ...clean(details), reason: details.reason };
            if (details.before) sanitized.before = clean(details.before);
            if (details.after) sanitized.after = clean(details.after);
            return { ...event, details: JSON.stringify(sanitized) };
          }),
      );
    },
  );
  app.get(
    "/api/approvals/history",
    allow(["manager", "finance", "auditor", "admin"]),
    (req, res) =>
      res.json(
        approvalHistory(db, {
          ...req,
          query: req.query,
          rows: report({ ...req, query: { ...req.query, status: undefined } }),
        }),
      ),
  );
  app.get("/api/receipts/:id/invoices", allow(["cashier"]), (req, res) => {
    const t = db
      .prepare(
        "SELECT * FROM transactions WHERE id=? AND user_id=? AND direction='in'",
      )
      .get(req.params.id, req.user.id);
    if (!t) fail("Receipt not found in your workspace.", 403);
    const used = db
      .prepare(
        "SELECT COALESCE(SUM(p.amount),0) AS amount FROM payment_allocations p WHERE p.transaction_id=? AND NOT EXISTS(SELECT 1 FROM allocation_corrections c WHERE c.allocation_id=p.id)",
      )
      .get(t.id).amount;
    res.json({
      available: String(BigInt(t.amount) - BigInt(used)),
      invoices: documentRows(db)
        .filter(
          (i) =>
            i.contact_id === t.contact_id &&
            i.lifecycle === "issued" &&
            BigInt(i.outstanding) > 0n &&
            !db
              .prepare(
                "SELECT 1 FROM payment_allocations WHERE invoice_id=? AND transaction_id=?",
              )
              .get(i.id, t.id),
        )
        .map((i) => ({
          id: i.id,
          number: i.number,
          outstanding: i.outstanding,
          issued: i.issued,
        })),
    });
  });
  app.post("/api/receipts/:id/allocate", allow(["cashier"]), (req, res) => {
    const t = db
      .prepare(
        "SELECT id FROM transactions WHERE id=? AND user_id=? AND direction='in'",
      )
      .get(req.params.id, req.user.id);
    if (!t) fail("Receipt not found in your workspace.", 403);
    const invoice = db
      .prepare(
        "SELECT i.id FROM invoices i JOIN transactions t ON t.contact_id=i.contact_id WHERE i.id=? AND t.id=? AND t.user_id=?",
      )
      .get(req.body.invoice_id, t.id, req.user.id);
    if (!invoice)
      fail("Invoice is outside this receipt's customer scope.", 403);
    const transactionId = t.id;
    req.params.id = text(req.body.invoice_id, "Invoice");
    req.body.transaction_id = transactionId;
    return allocateInvoice(req, res);
  });
  app.get("/api/notifications", allow(), (req, res) => {
    let items = [];
    if (req.user.role === "admin")
      items = db
        .prepare(
          `SELECT e.id,e.action AS title,e.created_at,u.name AS detail,'Audit trail' AS page FROM audit_events e LEFT JOIN users u ON u.id=e.user_id WHERE ${adminActions} ORDER BY e.rowid DESC LIMIT 8`,
        )
        .all();
    else if (req.user.role === "cashier")
      items = report(req)
        .slice(-8)
        .reverse()
        .map((t) => ({
          id: t.id,
          title: "Receipt recorded",
          detail: t.reference || t.description,
          created_at: t.created_at,
          page: "Transactions",
        }));
    else if (req.user.role === "manager") {
      for (const [table, title, page] of [
        ["transactions", "Payments awaiting review", "Approvals"],
        ["control_requests", "Control requests awaiting review", "Approvals"],
        [
          "reconciliation_proposals",
          "Reconciliation groups awaiting review",
          "Reconciliation",
        ],
        [
          "partial_matches",
          "Partial matches awaiting review",
          "Reconciliation",
        ],
      ]) {
        const count = db
          .prepare(
            `SELECT COUNT(*) AS n FROM ${table} WHERE ${table === "transactions" ? "approval='pending'" : "status='pending'"}`,
          )
          .get().n;
        if (count)
          items.push({ id: table, title, detail: `${count} pending`, page });
      }
    } else if (req.user.role === "finance") {
      items = db
        .prepare(
          "SELECT id,'Statement import' AS title,filename || ' - ' || status AS detail,created_at,'Statements' AS page FROM imports WHERE user_id=? ORDER BY created_at DESC LIMIT 4",
        )
        .all(req.user.id);
      items.push(
        ...approvalHistory(db, { ...req, query: req.query, rows: report(req) })
          .filter((r) => r.requester_id === req.user.id)
          .slice(0, 4)
          .map((r) => ({
            id: r.id,
            title: `Request ${r.status}`,
            detail: r.reason,
            created_at: r.decided_at,
            page: "Approvals",
          })),
      );
    } else
      items = db
        .prepare(
          "SELECT id,action AS title,created_at,'Recorded audit event' AS detail,'Audit trail' AS page FROM audit_events ORDER BY rowid DESC LIMIT 8",
        )
        .all();
    res.json({
      items: [...operationalReminders(db, req.user), ...items],
      can_approve: hasApprovalAuthority(db, req.user),
    });
  });
}
