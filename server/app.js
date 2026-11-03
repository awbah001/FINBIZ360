import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { createHash, randomBytes } from "node:crypto";
import {
  id,
  money,
  isoDate,
  atomic,
  audit,
  verifyPassword,
  hashPassword,
} from "./db.js";

import {
  registerEnhancements,
  reverseEntry,
  openPeriod,
  fail,
  setPeriod,
  documentRows,
  invoiceItems,
  balanceSummary,
  sumMinor,
  major,
  previewWarnings,
  partialTotals,
  validateWorkbookArchive,
} from "./enhancements.js";

import { roleBoundary, hasApprovalAuthority } from "./access.js";
import { registerRoleFeatures } from "./role-features.js";

const financial = ["manager", "finance"];
const readers = ["manager", "finance", "auditor", "admin"];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});
const digest = (value) => createHash("sha256").update(value).digest("hex");
const text = (value, label, max = 200) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new Error(`${label} is required (maximum ${max} characters).`);
  return value.trim();
};
const packTx = (row) => ({
  ...row,
  amount: String(row.amount),
  reconciled_minor:
    row.reconciled_minor === undefined
      ? undefined
      : String(row.reconciled_minor),
  reconciliation_display:
    row.reconciliation === undefined
      ? undefined
      : row.reconciliation === "reconciled"
        ? "reconciled"
        : BigInt(row.reconciled_minor || 0) > 0n
          ? "partially_matched"
          : row.reconciliation,
});
function account(db, aid) {
  const a = db
    .prepare("SELECT * FROM accounts WHERE id=? AND active=1")
    .get(aid);
  if (!a) fail("Choose an active financial account.");
  return a;
}
function filters(req) {
  const conditions = ["1=1"],
    values = [];
  if (req.user.role === "cashier") {
    conditions.push("t.user_id=?");
    values.push(req.user.id);
  }
  for (const [key, column] of [
    ["account", "t.account_id"],
    ["direction", "t.direction"],
    ["status", "t.reconciliation"],
    ["approval", "t.approval"],
    ["category", "t.category"],
    ["contact", "t.contact_id"],
    ["channel", "a.channel"],
  ])
    if (req.query[key]) {
      if (key === "status" && req.query[key] === "partially_matched") {
        conditions.push(
          "t.reconciliation='unmatched' AND EXISTS (SELECT 1 FROM partial_matches p WHERE p.transaction_id=t.id AND p.status='approved')",
        );
        continue;
      }
      conditions.push(`${column}=?`);
      values.push(String(req.query[key]));
    }
  if (req.query.from) {
    conditions.push("t.date>=?");
    values.push(isoDate(req.query.from));
  }
  if (req.query.to) {
    conditions.push("t.date<=?");
    values.push(isoDate(req.query.to));
  }
  if (req.query.q) {
    conditions.push("(t.description LIKE ? OR t.reference LIKE ?)");
    values.push(
      `%${String(req.query.q).slice(0, 100)}%`,
      `%${String(req.query.q).slice(0, 100)}%`,
    );
  }
  if (req.query.from && req.query.to && req.query.from > req.query.to)
    fail("From date cannot follow To date.");
  return { where: conditions.join(" AND "), values };
}
const txSelect = `SELECT t.*,COALESCE((SELECT json_extract(e.details,'$.entry_kind') FROM audit_events e WHERE e.entity=t.id AND e.action='transaction.create' ORDER BY e.rowid LIMIT 1),CASE WHEN t.direction='out' THEN 'payment' ELSE 'receipt' END) AS entry_kind,COALESCE((SELECT SUM(p.amount) FROM partial_matches p WHERE p.transaction_id=t.id AND p.status='approved'),0) AS reconciled_minor,a.name AS account_name,a.channel,a.currency,c.name AS contact_name,u.name AS user_name,CASE WHEN v.transaction_id IS NULL THEN 'recorded' ELSE 'evidence_verified' END AS payment_status FROM transactions t JOIN accounts a ON a.id=t.account_id LEFT JOIN contacts c ON c.id=t.contact_id JOIN users u ON u.id=t.user_id LEFT JOIN payment_verifications v ON v.transaction_id=t.id`;

export function createApp(db) {
  const app = express();
  const absentUserHash = hashPassword(randomBytes(32).toString("hex"));
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    const token = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("finbiz_session="))
      ?.slice(15);
    let session =
      token &&
      db.prepare("SELECT * FROM sessions WHERE token=?").get(digest(token));
    if (!session) {
      const raw = randomBytes(32).toString("hex");
      session = {
        token: digest(raw),
        user_id: null,
        csrf: randomBytes(32).toString("hex"),
        expires: Date.now() + 8 * 3600000,
      };
      db.prepare("INSERT INTO sessions VALUES (?,?,?,?)").run(
        session.token,
        null,
        session.csrf,
        session.expires,
      );
      res.cookie("finbiz_session", raw, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 8 * 3600000,
        path: "/",
      });
    }
    req.session = session;
    req.user = session.user_id
      ? db
          .prepare(
            "SELECT id,name,email,role FROM users WHERE id=? AND active=1",
          )
          .get(session.user_id)
      : null;
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers["x-csrf-token"] !== session.csrf
    )
      return res.status(403).json({
        error: "Session verification failed. Refresh the page and try again.",
      });
    next();
  });
  app.use("/api", roleBoundary(db));
  const allow = (roles) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Please sign in." });
    if (roles && !roles.includes(req.user.role))
      return res
        .status(403)
        .json({ error: "Your role does not permit this action." });
    next();
  };
  app.get("/api/session", (req, res) =>
    res.json({
      user: req.user || null,
      csrf: req.session.csrf,
      setupRequired: !db.prepare("SELECT 1 FROM users LIMIT 1").get(),
      setupTokenRequired: process.env.NODE_ENV === "production",
      workspaceMode: db.prepare("SELECT mode FROM settings WHERE id=1").get()
        .mode,
    }),
  );
  app.post(
    "/api/setup",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many setup attempts. Please try again later." },
    }),
    (req, res) => {
      if (db.prepare("SELECT 1 FROM users LIMIT 1").get())
        fail("This workspace is already configured.", 409);
      if (
        process.env.NODE_ENV === "production" &&
        (!process.env.SETUP_TOKEN ||
          req.body.setup_token !== process.env.SETUP_TOKEN)
      )
        fail(
          "A valid server SETUP_TOKEN is required for first-time production setup.",
          403,
        );
      const organisation = text(req.body.organisation, "Organisation name");
      const ownerName = text(req.body.owner_name, "Owner / manager name"),
        adminName = text(req.body.admin_name, "Administrator name");
      const ownerEmail = text(
          req.body.owner_email,
          "Owner email",
        ).toLowerCase(),
        adminEmail = text(
          req.body.admin_email,
          "Administrator email",
        ).toLowerCase();
      const ownerPassword = text(
          req.body.owner_password,
          "Owner password",
          256,
        ),
        adminPassword = text(
          req.body.admin_password,
          "Administrator password",
          256,
        );
      if (
        ![ownerEmail, adminEmail].every((email) =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        )
      )
        fail("Enter valid email addresses.");
      if (ownerEmail === adminEmail)
        fail("Owner and administrator must use distinct email addresses.");
      if (ownerPassword.length < 12 || adminPassword.length < 12)
        fail("Use passwords of at least 12 characters.");
      const ownerId = id(),
        adminId = id(),
        ownerHash = hashPassword(ownerPassword),
        adminHash = hashPassword(adminPassword);
      atomic(db, () => {
        if (db.prepare("SELECT 1 FROM users LIMIT 1").get())
          fail("This workspace is already configured.", 409);
        db.prepare("UPDATE settings SET name=?,mode='live' WHERE id=1").run(
          organisation,
        );
        db.prepare("INSERT INTO users VALUES (?,?,?,?,?,1)").run(
          ownerId,
          ownerName,
          ownerEmail,
          ownerHash,
          "manager",
        );
        db.prepare("INSERT INTO users VALUES (?,?,?,?,?,1)").run(
          adminId,
          adminName,
          adminEmail,
          adminHash,
          "admin",
        );
        audit(db, ownerId, "workspace.setup", "organisation", {
          organisation,
          administrator: adminId,
          currency: "SLE",
        });
      });
      res.status(201).json({ ok: true });
    },
  );
  app.post(
    "/api/login",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 25,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many attempts. Please try again later." },
    }),
    (req, res) => {
      const email = text(req.body.email, "Email").toLowerCase(),
        password = text(req.body.password, "Password", 256);
      const user = db
        .prepare("SELECT * FROM users WHERE email=? AND active=1")
        .get(email);
      const verified = verifyPassword(
        password,
        user?.password || absentUserHash,
      );
      if (!user || !verified) fail("Email or password is incorrect.", 401);
      const raw = randomBytes(32).toString("hex"),
        csrf = randomBytes(32).toString("hex");
      atomic(db, () => {
        db.prepare("DELETE FROM sessions WHERE token=?").run(req.session.token);
        db.prepare("INSERT INTO sessions VALUES (?,?,?,?)").run(
          digest(raw),
          user.id,
          csrf,
          Date.now() + 8 * 3600000,
        );
        audit(db, user.id, "auth.login", "user");
      });
      res.cookie("finbiz_session", raw, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 8 * 3600000,
        path: "/",
      });
      res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        csrf,
      });
    },
  );
  app.post("/api/logout", allow(), (req, res) => {
    db.prepare("DELETE FROM sessions WHERE token=?").run(req.session.token);
    res.clearCookie("finbiz_session", { path: "/" });
    res.json({ ok: true });
  });
  app.patch("/api/profile", allow(), (req, res) => {
    if (Object.keys(req.body).some((key) => key !== "name"))
      fail("Only your display name can be updated here.");
    const name = text(req.body.name, "Full name", 200);
    atomic(db, () => {
      db.prepare("UPDATE users SET name=? WHERE id=?").run(name, req.user.id);
      audit(db, req.user.id, "user.profile", "user", {
        id: req.user.id,
        previous_name: req.user.name,
        name,
      });
    });
    res.json({ user: { ...req.user, name } });
  });
  app.post("/api/password", allow(), (req, res) => {
    const old = text(req.body.current, "Current password", 256),
      password = text(req.body.password, "New password", 256);
    if (password.length < 12) fail("Use at least 12 characters.");
    const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
    if (!verifyPassword(old, user.password))
      fail("Current password is incorrect.", 403);
    atomic(db, () => {
      db.prepare("UPDATE users SET password=? WHERE id=?").run(
        hashPassword(password),
        user.id,
      );
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
      audit(db, user.id, "auth.password", "user");
    });
    res.json({ ok: true });
  });
  app.get("/api/master", allow(), (req, res) => {
    const admin = req.user.role === "admin",
      cashier = req.user.role === "cashier";
    const accounts = admin
      ? []
      : cashier
        ? db
            .prepare(
              "SELECT id,name,channel,currency,active FROM accounts WHERE active=1 ORDER BY name",
            )
            .all()
        : db.prepare("SELECT * FROM accounts").all();
    const contacts = admin
      ? []
      : cashier
        ? db
            .prepare(
              "SELECT id,name,type,reference,active FROM contacts WHERE type='customer' AND active=1 ORDER BY name",
            )
            .all()
        : db.prepare("SELECT * FROM contacts ORDER BY name").all();
    res.json({
      settings: db.prepare("SELECT * FROM settings").get(),
      accounts,
      contacts,
      categories: admin
        ? []
        : cashier
          ? db
              .prepare(
                "SELECT * FROM categories WHERE active=1 AND direction IN ('in','both') ORDER BY name",
              )
              .all()
          : db.prepare("SELECT * FROM categories ORDER BY name").all(),
      permissions: {
        can_approve: hasApprovalAuthority(db, req.user),
        can_record: ["manager", "finance", "cashier"].includes(req.user.role),
        can_manage_finances: financial.includes(req.user.role),
        can_manage_users: admin,
        can_export:
          financial.includes(req.user.role) ||
          (req.user.role === "auditor" &&
            !!db
              .prepare(
                "SELECT auditor_export_allowed AS allowed FROM settings WHERE id=1",
              )
              .get().allowed),
        can_create_customers:
          financial.includes(req.user.role) ||
          (cashier &&
            !!db
              .prepare(
                "SELECT cashier_create_customers AS allowed FROM settings WHERE id=1",
              )
              .get().allowed),
        can_allocate_receipts:
          cashier &&
          !!db
            .prepare(
              "SELECT cashier_invoice_allocation AS allowed FROM settings WHERE id=1",
            )
            .get().allowed,
        transaction_scope: cashier ? "own" : admin ? "none" : "company",
      },
    });
  });
  app.post("/api/accounts", allow(["admin", ...financial]), (req, res) => {
    const name = text(req.body.name, "Account name"),
      channel = req.body.channel;
    if (!["cash", "mobile", "bank"].includes(channel))
      fail("Invalid payment channel.");
    if (req.body.currency && req.body.currency !== "SLE")
      fail(
        "This organisation uses SLE. Currency conversion is not configured.",
      );
    if (
      req.body.kind &&
      !["cash", "bank", "mobile", "clearing"].includes(req.body.kind)
    )
      fail("Invalid account kind.");
    if (
      req.user.role === "admin" &&
      req.body.opening_amount &&
      !["0", "0.00"].includes(req.body.opening_amount)
    )
      fail(
        "Administrators configure account references; financial opening balances require finance authority.",
        403,
      );
    if (
      req.body.opening_amount &&
      !["0", "0.00"].includes(req.body.opening_amount) &&
      !req.body.opening_date
    )
      fail("Provide the opening balance date.");
    const aid = id();
    atomic(db, () => {
      db.prepare(
        "INSERT INTO accounts (id,name,channel,provider,kind,opening_amount,opening_date) VALUES (?,?,?,?,?,?,?)",
      ).run(
        aid,
        name,
        channel,
        String(req.body.provider || "").slice(0, 100),
        req.body.kind === "clearing" ? "clearing" : channel,
        req.body.opening_amount &&
          req.body.opening_amount !== "0" &&
          req.body.opening_amount !== "0.00"
          ? money(req.body.opening_amount)
          : 0,
        req.body.opening_date ? isoDate(req.body.opening_date) : "1970-01-01",
      );
      audit(db, req.user.id, "account.create", aid, {
        name,
        channel,
        opening_amount: req.body.opening_amount || "0",
        opening_date: req.body.opening_date || "1970-01-01",
        kind: req.body.kind || channel,
      });
    });
    res.status(201).json({ id: aid });
  });
  app.post("/api/contacts", allow([...financial, "cashier"]), (req, res) => {
    if (req.user.role === "cashier" && req.body.type !== "customer")
      fail("Cashiers may create customers only.", 403);
    const name = text(req.body.name, "Name"),
      type = req.body.type;
    if (!["customer", "supplier"].includes(type)) fail("Invalid contact type.");
    const cid = id();
    atomic(db, () => {
      db.prepare(
        "INSERT INTO contacts (id,name,type,phone,email,address,reference) VALUES (?,?,?,?,?,?,?)",
      ).run(
        cid,
        name,
        type,
        String(req.body.phone || "").slice(0, 50),
        String(req.body.email || "").slice(0, 200),
        String(req.body.address || "").slice(0, 500),
        String(req.body.reference || "").slice(0, 100),
      );
      audit(db, req.user.id, "contact.create", cid, { name, type });
    });
    res.status(201).json({ id: cid });
  });
  app.get("/api/transactions", allow(), (req, res) => {
    const { where, values } = filters(req),
      page = Math.min(1000000, Math.max(1, parseInt(req.query.page, 10) || 1)),
      limit = 15;
    const sorts = {
      date_desc: "t.date DESC,t.created_at DESC,t.id",
      date_asc: "t.date,t.created_at,t.id",
      amount_desc: "t.amount DESC,t.date DESC,t.id",
      amount_asc: "t.amount,t.date DESC,t.id",
    };
    const sortKey = String(req.query.sort || "date_desc");
    if (!Object.hasOwn(sorts, sortKey)) fail("Invalid transaction sort.");
    const sort = sorts[sortKey];
    const rows = db
      .prepare(`${txSelect} WHERE ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`)
      .all(...values, limit, (page - 1) * limit);
    res.json({
      rows: rows.map(packTx),
      total: db
        .prepare(
          `SELECT COUNT(*) AS n FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE ${where}`,
        )
        .get(...values).n,
      page,
    });
  });
  app.post(
    "/api/transactions",
    allow([...financial, "cashier"]),
    (req, res) => {
      const b = req.body,
        date = isoDate(b.date),
        amount = money(b.amount),
        a = account(db, b.account_id);
      if (date < a.opening_date)
        fail("Transaction date precedes the account opening date.");
      const direction = b.direction;
      const entryKind =
        b.entry_kind || (direction === "out" ? "payment" : "receipt");
      if (
        !["sale", "receipt", "payment"].includes(entryKind) ||
        (direction === "out" && entryKind !== "payment") ||
        (direction === "in" && entryKind === "payment")
      )
        fail("Choose a valid sale, receipt or payment classification.");
      if (b.currency && b.currency !== a.currency)
        fail("Transaction currency must match its account.");
      if (!["in", "out"].includes(direction)) fail("Choose inflow or outflow.");
      if (req.user.role === "cashier" && direction !== "in")
        fail("Cashiers may record receipts only.", 403);
      const reference =
        a.channel === "cash"
          ? text(b.reference, "Receipt / voucher reference")
          : String(b.reference || "")
              .trim()
              .slice(0, 200);
      const description = text(b.description, "Description"),
        category = text(b.category, "Category", 80),
        key = text(b.request_key, "Request key", 100);
      const configuredCategory = db
        .prepare("SELECT active,direction FROM categories WHERE name=?")
        .get(category);
      if (configuredCategory && !configuredCategory.active)
        fail("Choose an active category for new records.");
      if (
        req.user.role === "cashier" &&
        configuredCategory?.direction === "out"
      )
        fail("Cashier receipts require an income category.", 403);
      if (
        b.contact_id &&
        !db
          .prepare("SELECT 1 FROM contacts WHERE id=? AND active=1")
          .get(b.contact_id)
      )
        fail("Contact not found.");
      if (
        req.user.role === "cashier" &&
        b.contact_id &&
        !db
          .prepare(
            "SELECT 1 FROM contacts WHERE id=? AND type='customer' AND active=1",
          )
          .get(b.contact_id)
      )
        fail("Cashier receipts may reference active customers only.", 403);
      const txid = id(),
        approval = direction === "out" ? "pending" : "not_required";
      const result = atomic(db, () => {
        const existing = db
          .prepare("SELECT * FROM transactions WHERE request_key=?")
          .get(key);
        if (existing) {
          if (
            (db
              .prepare(
                "SELECT json_extract(details,'$.entry_kind') AS kind FROM audit_events WHERE entity=? AND action='transaction.create' ORDER BY rowid LIMIT 1",
              )
              .get(existing.id)?.kind ||
              (existing.direction === "out" ? "payment" : "receipt")) !==
              entryKind ||
            existing.user_id !== req.user.id ||
            existing.amount !== amount ||
            existing.date !== date ||
            existing.account_id !== a.id ||
            existing.direction !== direction ||
            existing.reference !== reference ||
            existing.description !== description ||
            existing.category !== category ||
            (existing.contact_id || null) !== (b.contact_id || null)
          )
            fail("Request key was already used for different data.", 409);
          return existing.id;
        }
        openPeriod(db, date);
        db.prepare(
          "INSERT INTO transactions (id,date,amount,direction,account_id,reference,description,category,contact_id,user_id,approval,request_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        ).run(
          txid,
          date,
          amount,
          direction,
          a.id,
          reference,
          description,
          category,
          b.contact_id || null,
          req.user.id,
          approval,
          key,
        );
        audit(db, req.user.id, "transaction.create", txid, {
          entry_kind: entryKind,
          date,
          amount: String(amount),
          direction,
          account: a.id,
          approval,
        });
        return txid;
      });
      const duplicates = reference
        ? db
            .prepare(
              "SELECT id FROM transactions WHERE id<>? AND account_id=? AND date=? AND direction=? AND reference=? AND reversal_of IS NULL",
            )
            .all(result, a.id, date, direction, reference)
            .map((r) => r.id)
        : [];
      res.status(201).json({
        id: result,
        warnings: duplicates.length
          ? [
              "Possible duplicate external reference on the same account, direction and date. Review before recording another entry.",
            ]
          : [],
        duplicate_ids: duplicates,
      });
    },
  );
  app.post("/api/transactions/:id/reverse", allow(["manager"]), (req, res) => {
    const date = isoDate(req.body.date),
      reason = text(req.body.reason, "Reversal reason", 500);
    const tid = atomic(db, () =>
      reverseEntry(db, req.user.id, req.params.id, date, reason),
    );
    res.status(201).json({ id: tid });
  });
  function report(req) {
    const { where, values } = filters(req);
    return db
      .prepare(`${txSelect} WHERE ${where} ORDER BY t.date,t.id`)
      .all(...values);
  }
  app.get("/api/admin/overview", allow(["admin"]), (req, res) => {
    const counts = db
      .prepare(
        `SELECT
      COUNT(*) AS total_users,
      COUNT(CASE WHEN active=1 THEN 1 END) AS active_users,
      COUNT(CASE WHEN active=0 THEN 1 END) AS inactive_users,
      COUNT(CASE WHEN active=1 AND role='admin' THEN 1 END) AS administrators
      FROM users`,
      )
      .get();
    res.json({
      ...counts,
      role_distribution: db
        .prepare(
          "SELECT role,COUNT(*) AS total,SUM(active) AS active FROM users GROUP BY role ORDER BY role",
        )
        .all(),
      configuration: {
        ...db
          .prepare(
            "SELECT currency,timezone,auditor_export_allowed,cashier_create_customers,cashier_invoice_allocation FROM settings WHERE id=1",
          )
          .get(),
        active_accounts: db
          .prepare("SELECT COUNT(*) AS n FROM accounts WHERE active=1")
          .get().n,
        active_categories: db
          .prepare("SELECT COUNT(*) AS n FROM categories WHERE active=1")
          .get().n,
        import_formats: ["CSV", "XLSX"],
      },
      active_sessions: db
        .prepare(
          "SELECT COUNT(*) AS n FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.expires>? AND u.active=1",
        )
        .get(Date.now()).n,
      recent_activity: db
        .prepare(
          "SELECT e.id,e.action,e.created_at,u.name AS user_name FROM audit_events e LEFT JOIN users u ON u.id=e.user_id WHERE e.action LIKE 'auth.%' OR e.action LIKE 'user.%' OR e.action LIKE 'system.%' OR e.action IN ('settings.update','backup.export','approval.delegate','account.create','account.update','category.create','category.update') ORDER BY e.created_at DESC,e.rowid DESC LIMIT 8",
        )
        .all(),
    });
  });
  app.get("/api/overview", allow(), (req, res) => {
    const rows = report(req),
      accepted = rows.filter((t) =>
        ["approved", "not_required"].includes(t.approval),
      );
    const sum = (items) => {
      const n = items.reduce((s, t) => s + BigInt(t.amount), 0n);
      return n.toString();
    };
    const trend = Object.values(
      accepted.reduce((acc, t) => {
        acc[t.date] ??= { date: t.date, in: 0n, out: 0n };
        acc[t.date][t.direction] += BigInt(t.amount);
        return acc;
      }, {}),
    ).map((r) => ({ ...r, in: String(r.in), out: String(r.out) }));
    const incoming = sum(accepted.filter((t) => t.direction === "in")),
      outgoing = sum(accepted.filter((t) => t.direction === "out"));
    const accounts =
      req.user.role === "cashier"
        ? []
        : balanceSummary(db, rows, req.query, req.user);
    const reversedIds = new Set(
      db
        .prepare(
          "SELECT reversal_of FROM transactions WHERE reversal_of IS NOT NULL",
        )
        .all()
        .map((r) => r.reversal_of),
    );
    const docs =
        req.user.role === "cashier"
          ? []
          : documentRows(db, "customer", req.query),
      bills =
        req.user.role === "cashier"
          ? []
          : documentRows(db, "supplier", req.query);
    res.json({
      incoming,
      outgoing,
      outstanding_customers: String(
        docs.reduce((n, d) => n + BigInt(d.outstanding), 0n),
      ),
      outstanding_suppliers: String(
        bills.reduce((n, d) => n + BigInt(d.outstanding), 0n),
      ),
      document_scope:
        "Company-wide documents issued in date range; no account attribution",
      unmatched: accepted.filter(
        (t) =>
          t.reconciliation === "unmatched" &&
          !t.reversal_of &&
          !reversedIds.has(t.id),
      ).length,
      net: (BigInt(incoming) - BigInt(outgoing)).toString(),
      count: rows.length,
      pending: rows.filter((t) => t.approval === "pending").length,
      reconciled: rows.filter((t) => t.reconciliation === "reconciled").length,
      trend,
      accounts,
      recent: [...rows].reverse().slice(0, 5).map(packTx),
    });
  });
  app.get("/api/approvals", allow(readers), (req, res) =>
    res.json(
      report(req)
        .filter((t) => t.approval === "pending")
        .reverse()
        .map(packTx),
    ),
  );
  app.post(
    "/api/approvals/:id",
    allow(["manager", "admin", "finance"]),
    (req, res) => {
      if (
        req.user.role !== "manager" &&
        !db
          .prepare(
            "SELECT 1 FROM approval_delegates WHERE user_id=? AND active=1",
          )
          .get(req.user.id)
      )
        fail("Business approval authority has not been assigned.", 403);
      const decision = req.body.decision,
        reason = text(req.body.reason, "Decision reason", 500);
      if (!["approved", "rejected"].includes(decision))
        fail("Invalid decision.");
      atomic(db, () => {
        const t = db
          .prepare("SELECT * FROM transactions WHERE id=?")
          .get(req.params.id);
        if (!t) fail("Transaction not found.", 404);
        openPeriod(db, t.date);
        if (t.user_id === req.user.id)
          fail("A different manager must approve your entry.", 403);
        if (t.approval !== "pending")
          fail("This entry has already been decided.", 409);
        db.prepare(
          "INSERT INTO approvals (id,transaction_id,decision,reason,user_id) VALUES (?,?,?,?,?)",
        ).run(id(), t.id, decision, reason, req.user.id);
        db.prepare("UPDATE transactions SET approval=? WHERE id=?").run(
          decision,
          t.id,
        );
        audit(db, req.user.id, `transaction.${decision}`, t.id, { reason });
      });
      res.json({ ok: true });
    },
  );
  app.get("/api/invoices", allow(readers), (req, res) =>
    res.json(documentRows(db, "customer", req.query)),
  );
  app.post("/api/invoices", allow(financial), (req, res) => {
    const b = req.body,
      number = text(b.number, "Invoice number", 80),
      issued = isoDate(b.issued),
      due = isoDate(b.due),
      amount = money(b.amount),
      description = text(b.description, "Description");
    if (b.currency && b.currency !== "SLE")
      fail("Invoices use the organisation currency SLE.");
    if (due < issued) fail("Due date cannot precede issue date.");
    if (
      !db
        .prepare(
          "SELECT 1 FROM contacts WHERE id=? AND type='customer' AND active=1",
        )
        .get(b.contact_id)
    )
      fail("Choose an active customer.");
    const iid = id();
    atomic(db, () => {
      openPeriod(db, issued);
      const items = invoiceItems(b.items || [], amount);
      const lifecycle = b.lifecycle || "issued";
      if (!["draft", "issued"].includes(lifecycle))
        fail("Choose draft or issued.");
      db.prepare(
        "INSERT INTO invoices (id,number,contact_id,issued,due,amount,description,user_id) VALUES (?,?,?,?,?,?,?,?)",
      ).run(
        iid,
        number,
        b.contact_id,
        issued,
        due,
        amount,
        description,
        req.user.id,
      );
      db.prepare("UPDATE invoices SET lifecycle=?,items=? WHERE id=?").run(
        lifecycle,
        JSON.stringify(items),
        iid,
      );
      audit(db, req.user.id, "invoice.create", iid, {
        number,
        amount: String(amount),
      });
    });
    res.status(201).json({ id: iid });
  });
  const allocateInvoice = (req, res) => {
    const amount = money(req.body.amount);
    atomic(db, () => {
      const i = db
          .prepare("SELECT * FROM invoices WHERE id=?")
          .get(req.params.id),
        t = db
          .prepare("SELECT * FROM transactions WHERE id=?")
          .get(req.body.transaction_id);
      if (!i || !t) fail("Invoice or transaction not found.", 404);
      if (i.lifecycle !== "issued")
        fail("Only issued invoices can receive payments.", 409);
      openPeriod(db, i.issued);
      openPeriod(db, t.date);
      if (
        t.direction !== "in" ||
        !["not_required", "approved"].includes(t.approval) ||
        t.contact_id !== i.contact_id ||
        t.reversal_of ||
        db.prepare("SELECT 1 FROM transactions WHERE reversal_of=?").get(t.id)
      )
        fail("Use an accepted, unreversed receipt for the same customer.");
      const paid = sumMinor(
        db
          .prepare(
            "SELECT p.amount FROM payment_allocations p WHERE invoice_id=? AND NOT EXISTS (SELECT 1 FROM allocation_corrections x WHERE x.allocation_id=p.id)",
          )
          .all(i.id),
      );
      const used = sumMinor(
        db
          .prepare(
            "SELECT p.amount FROM payment_allocations p WHERE transaction_id=? AND NOT EXISTS (SELECT 1 FROM allocation_corrections x WHERE x.allocation_id=p.id)",
          )
          .all(t.id),
      );
      if (
        BigInt(amount) >
        BigInt(documentRows(db).find((d) => d.id === i.id).outstanding)
      )
        fail(
          "Allocation exceeds the outstanding invoice after approved write-offs.",
          409,
        );
      if (
        BigInt(amount) > BigInt(i.amount) - paid ||
        BigInt(amount) > BigInt(t.amount) - used
      )
        fail(
          "Allocation exceeds the unpaid invoice or available receipt.",
          409,
        );
      db.prepare("INSERT INTO payment_allocations VALUES (?,?,?,?)").run(
        id(),
        i.id,
        t.id,
        amount,
      );
      audit(db, req.user.id, "invoice.allocate", i.id, {
        transaction: t.id,
        amount: String(amount),
      });
    });
    res.json({ ok: true });
  };
  app.post("/api/invoices/:id/allocate", allow(financial), allocateInvoice);
  registerRoleFeatures(app, db, { allow, text, report, allocateInvoice });
  app.post(
    "/api/imports/preview",
    allow(financial),
    upload.single("file"),
    async (req, res) => {
      if (!req.file) fail("Choose a CSV or XLSX file.");
      const a = account(db, req.body.account_id);
      if (a.channel === "cash")
        fail("Statements apply to bank or mobile money accounts.");
      const name = req.file.originalname,
        fingerprint = digest(req.file.buffer);
      if (
        db
          .prepare("SELECT 1 FROM imports WHERE fingerprint=? AND account_id=?")
          .get(fingerprint, a.id)
      )
        fail(
          "This file already has a preview or committed import. Open it from import history.",
          409,
        );
      let mapping;
      try {
        mapping = JSON.parse(req.body.mapping || "{}");
      } catch {
        fail("Invalid column mapping.");
      }
      for (const key of ["date", "reference", "amount", "direction"])
        if (!mapping[key]) fail(`Map the ${key} column.`);
      let source;
      if (name.toLowerCase().endsWith(".csv"))
        source = parse(req.file.buffer, {
          columns: true,
          bom: true,
          skip_empty_lines: true,
          trim: true,
        });
      else if (name.toLowerCase().endsWith(".xlsx")) {
        validateWorkbookArchive(req.file.buffer);
        const book = new ExcelJS.Workbook();
        await book.xlsx.load(req.file.buffer);
        const sheet = book.worksheets[0];
        if (!sheet) fail("Workbook is empty.");
        const headers = [];
        sheet.getRow(1).eachCell((cell, index) => {
          headers[index] = String(cell.value || "").trim();
        });
        source = [];
        sheet.eachRow((row, index) => {
          if (index === 1) return;
          const record = {};
          headers.forEach((header, col) => {
            const value = row.getCell(col).value;
            if (value && typeof value === "object" && !(value instanceof Date))
              fail(
                "Formula and rich-text cells are unsupported. Use plain statement values.",
              );
            record[header] =
              value instanceof Date
                ? value.toISOString().slice(0, 10)
                : String(value ?? "");
          });
          source.push(record);
        });
      } else fail("Only CSV and XLSX statements are supported.");
      if (!source.length || source.length > 2000)
        fail("Import between 1 and 2,000 rows per file.");
      const rows = [],
        errors = [];
      source.forEach((row, index) => {
        try {
          const date = isoDate(String(row[mapping.date] ?? "")),
            amount = money(String(row[mapping.amount] ?? "")),
            direction = String(row[mapping.direction] ?? "").toLowerCase();
          if (!["in", "out"].includes(direction))
            fail("Direction must be in or out.");
          if (mapping.currency && row[mapping.currency] !== a.currency)
            fail("Currency does not match the account.");
          const reference = String(row[mapping.reference] ?? "")
              .trim()
              .slice(0, 200),
            description = String(row[mapping.description] ?? "").slice(0, 200);
          rows.push({
            row_number: index + 2,
            date,
            amount,
            direction,
            reference,
            description,
          });
        } catch (error) {
          errors.push({ row: index + 2, error: error.message, source: row });
        }
      });
      const iid = id();
      atomic(db, () => {
        db.prepare(
          "INSERT INTO imports (id,fingerprint,account_id,filename,source,mapping,rows,errors,user_id) VALUES (?,?,?,?,?,?,?,?,?)",
        ).run(
          iid,
          fingerprint,
          a.id,
          name.slice(0, 200),
          req.file.buffer,
          JSON.stringify(mapping),
          JSON.stringify(rows),
          JSON.stringify(errors),
          req.user.id,
        );
        audit(db, req.user.id, "statement.preview", iid, {
          filename: name,
          valid: rows.length,
          invalid: errors.length,
        });
      });
      res.status(201).json({
        id: iid,
        filename: name,
        rows: rows.map(packTx),
        warnings: previewWarnings(db, rows, a.id, iid),
        errors,
        status: "preview",
      });
    },
  );
  app.get("/api/imports", allow(readers), (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT i.id,i.filename,i.status,i.created_at,a.name AS account_name,i.errors,i.rows FROM imports i JOIN accounts a ON a.id=i.account_id ORDER BY i.created_at DESC",
        )
        .all()
        .map((i) => ({
          ...i,
          valid: JSON.parse(i.rows).length,
          invalid: JSON.parse(i.errors).length,
          rows: undefined,
          errors: undefined,
        })),
    ),
  );
  app.get("/api/imports/:id", allow(readers), (req, res) => {
    const i = db
      .prepare(
        "SELECT id,filename,rows,errors,status,account_id FROM imports WHERE id=?",
      )
      .get(req.params.id);
    if (!i) fail("Import not found.", 404);
    res.json({
      ...i,
      rows: JSON.parse(i.rows).map(packTx),
      errors: JSON.parse(i.errors),
      warnings: previewWarnings(db, JSON.parse(i.rows), i.account_id, i.id),
    });
  });
  app.get("/api/imports/:id/source", allow(readers), (req, res) => {
    const i = db
      .prepare("SELECT filename,source FROM imports WHERE id=?")
      .get(req.params.id);
    if (!i) fail("Import not found.", 404);
    res.attachment(i.filename);
    res.send(Buffer.from(i.source));
  });
  app.post("/api/imports/:id/commit", allow(financial), (req, res) => {
    atomic(db, () => {
      const i = db
        .prepare("SELECT * FROM imports WHERE id=?")
        .get(req.params.id);
      if (!i) fail("Import not found.", 404);
      if (i.status === "committed") return;
      const rows = JSON.parse(i.rows);
      if (!rows.length) fail("There are no valid rows to import.");
      for (const row of rows) {
        openPeriod(db, row.date);
        db.prepare(
          "INSERT INTO statement_lines VALUES (?,?,?,?,?,?,?,?,?)",
        ).run(
          id(),
          i.id,
          row.row_number,
          i.account_id,
          row.date,
          row.reference,
          row.description,
          row.amount,
          row.direction,
        );
      }
      db.prepare("UPDATE imports SET status='committed' WHERE id=?").run(i.id);
      audit(db, req.user.id, "statement.commit", i.id, {
        count: rows.length,
        excluded: JSON.parse(i.errors).length,
      });
    });
    res.json({ ok: true });
  });
  function reconciliationRows() {
    const lines = db
      .prepare(
        `SELECT l.*,a.name AS account_name,a.channel,r.id AS reconciliation_id,r.transaction_id,g.proposal_id AS group_id FROM statement_lines l JOIN accounts a ON a.id=l.account_id LEFT JOIN reconciliations r ON r.line_id=l.id AND r.active=1 LEFT JOIN grouped_links g ON g.participant_type='line' AND g.participant_id=l.id AND g.active=1 ORDER BY l.date DESC`,
      )
      .all();
    const partial = partialTotals(db);
    const key = (r) =>
      JSON.stringify([
        r.account_id,
        r.direction,
        String(r.amount),
        r.date,
        r.reference,
      ]);
    const duplicates = new Map(),
      available = new Map();
    for (const l of lines)
      duplicates.set(key(l), (duplicates.get(key(l)) || 0) + 1);
    const rejected = new Set(
      db
        .prepare(
          "SELECT source_key FROM exception_reviews WHERE source_key LIKE 'suggestion:%'",
        )
        .all()
        .map((r) => r.source_key),
    );
    for (const t of db
      .prepare(
        "SELECT t.id,t.account_id,t.direction,t.amount,t.date,t.reference,t.description FROM transactions t WHERE t.reference<>'' AND t.reconciliation='unmatched' AND t.approval IN ('approved','not_required') AND t.reversal_of IS NULL AND NOT EXISTS (SELECT 1 FROM transactions rev WHERE rev.reversal_of=t.id)",
      )
      .all()) {
      const k = key(t);
      if (!available.has(k)) available.set(k, []);
      available.get(k).push(t);
    }
    return lines.map((line) => {
      const candidates =
        line.reconciliation_id || line.group_id || partial.line.has(line.id)
          ? []
          : (available.get(key(line)) || []).filter(
              (t) =>
                !rejected.has(`suggestion:${line.id}:${t.id}`) &&
                !partial.tx.has(t.id),
            );
      const duplicate = duplicates.get(key(line)) > 1;
      return {
        ...line,
        amount: String(line.amount),
        allocated_minor: String(partial.line.get(line.id) || 0n),
        remaining_minor: String(
          BigInt(line.amount) - (partial.line.get(line.id) || 0n),
        ),
        candidates: candidates.map(packTx),
        status:
          line.reconciliation_id ||
          line.group_id ||
          (partial.line.get(line.id) || 0n) === BigInt(line.amount)
            ? "reconciled"
            : partial.line.has(line.id)
              ? "partially_matched"
              : duplicate
                ? "duplicate"
                : candidates.length === 1
                  ? "suggested"
                  : candidates.length > 1
                    ? "ambiguous"
                    : "unmatched",
        rule: partial.line.has(line.id)
          ? "partial-allocation-independent-review-v1"
          : line.group_id
            ? "balanced-group-independent-review-v1"
            : "exact-reference-amount-date-v1",
      };
    });
  }
  app.get("/api/reconciliation", allow(readers), (req, res) =>
    res.json(reconciliationRows()),
  );
  app.post("/api/reconciliation", allow(financial), (req, res) => {
    const reason = text(req.body.reason, "Confirmation reason", 500);
    atomic(db, () => {
      const line = reconciliationRows().find((l) => l.id === req.body.line_id);
      if (!line) fail("Statement line not found.", 404);
      if (
        line.status !== "suggested" ||
        line.candidates[0].id !== req.body.transaction_id
      )
        fail(
          "Only unambiguous exact suggestions may be confirmed in this release.",
          409,
        );
      openPeriod(db, line.date);
      db.prepare(
        "INSERT INTO reconciliations (id,transaction_id,line_id,rule,reason,user_id) VALUES (?,?,?,?,?,?)",
      ).run(
        id(),
        req.body.transaction_id,
        line.id,
        line.rule,
        reason,
        req.user.id,
      );
      db.prepare(
        "UPDATE transactions SET reconciliation='reconciled' WHERE id=?",
      ).run(req.body.transaction_id);
      audit(db, req.user.id, "reconciliation.confirm", line.id, {
        transaction: req.body.transaction_id,
        rule: line.rule,
        reason,
      });
    });
    res.json({ ok: true });
  });
  app.post("/api/reconciliation/:id/undo", allow(financial), (req, res) => {
    const reason = text(req.body.reason, "Undo reason", 500);
    atomic(db, () => {
      const r = db
        .prepare(
          "SELECT r.*,t.date FROM reconciliations r JOIN transactions t ON t.id=r.transaction_id WHERE r.id=? AND r.active=1",
        )
        .get(req.params.id);
      if (!r) fail("Active reconciliation not found.", 404);
      openPeriod(db, r.date);
      db.prepare("UPDATE reconciliations SET active=0 WHERE id=?").run(r.id);
      db.prepare(
        "UPDATE transactions SET reconciliation='unmatched' WHERE id=?",
      ).run(r.transaction_id);
      audit(db, req.user.id, "reconciliation.undo", r.id, { reason });
    });
    res.json({ ok: true });
  });
  app.get("/api/reports/export", allow(readers), (req, res) => {
    audit(db, req.user.id, "report.export", "transactions", {
      filters: req.query,
    });
    const rows = report(req);
    audit(db, req.user.id, "report.export", "transactions", {
      filters: req.query,
      rows: rows.length,
    });
    if (req.query.format === "pdf") {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      res.type("pdf");
      res.attachment("finbiz-transactions.pdf");
      doc.pipe(res);
      doc.fontSize(20).text("FinBiz 360 | Transaction report");
      doc
        .fontSize(9)
        .text(
          `Generated ${new Date().toISOString()} | Currency SLE | Amounts in major units`,
        );
      doc.text(`Filters: ${JSON.stringify(req.query)}`);
      doc.moveDown();
      for (const t of rows) {
        doc
          .fontSize(9)
          .text(
            `${t.date} | ${t.direction.toUpperCase()} | ${major(t.amount)} | ${t.approval}`,
          );
        doc.text(`${t.reference} - ${t.description} | ${t.account_name}`);
        doc.moveDown(0.5);
      }
      doc.end();
      return;
    }
    const escape = (value) =>
      '"' +
      String(value)
        .replace(/^[=+\-@\t\r]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const body = [
      [
        "Date",
        "Reference",
        "Description",
        "Account",
        "Currency",
        "Direction",
        "Amount minor units",
        "Approval",
        "Reconciliation",
      ],
      ...rows.map((t) => [
        t.date,
        t.reference,
        t.description,
        t.account_name,
        t.currency,
        t.direction,
        String(t.amount),
        t.approval,
        t.reconciliation,
      ]),
    ]
      .map((row) => row.map(escape).join(","))
      .join("\r\n");
    res.attachment("finbiz-transactions.csv");
    res.type("text/csv");
    res.send(body);
  });
  app.get("/api/settings", allow(), (req, res) =>
    res.json({
      organisation: db.prepare("SELECT * FROM settings").get(),
      periods:
        req.user.role === "admin"
          ? []
          : db.prepare("SELECT * FROM periods ORDER BY month DESC").all(),
    }),
  );
  app.post("/api/periods", allow(["manager"]), (req, res) => {
    const month = text(req.body.month, "Period", 7),
      reason = text(req.body.reason, "Reason", 500);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
      fail("Use a YYYY-MM reporting period.");
    const closed =
      req.body.closed === true
        ? 1
        : req.body.closed === false
          ? 0
          : fail("Choose close or reopen.");
    atomic(db, () => {
      setPeriod(db, req.user.id, month, closed, reason);
    });
    res.json({ ok: true });
  });
  app.post("/api/users", allow(["admin"]), (req, res) => {
    const name = text(req.body.name, "Name"),
      email = text(req.body.email, "Email").toLowerCase(),
      password = text(req.body.password, "Password", 256),
      role = req.body.role;
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 12 ||
      !["admin", ...financial, "cashier", "auditor"].includes(role)
    )
      fail("Use a valid email, role and a password of at least 12 characters.");
    const uid = id();
    atomic(db, () => {
      db.prepare("INSERT INTO users VALUES (?,?,?,?,?,1)").run(
        uid,
        name,
        email,
        hashPassword(password),
        role,
      );
      audit(db, req.user.id, "user.create", uid, { name, email, role });
    });
    res.status(201).json({ id: uid });
  });
  app.patch("/api/users/:id", allow(["admin"]), (req, res) =>
    atomic(db, () => {
      const current = db
        .prepare("SELECT id,name,email,role,active FROM users WHERE id=?")
        .get(req.params.id);
      if (!current) fail("User not found.", 404);
      const next = { ...current };
      for (const key of ["name", "email", "role"])
        if (req.body[key] !== undefined) next[key] = text(req.body[key], key);
      next.email = next.email.toLowerCase();
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email) ||
        !["admin", ...financial, "cashier", "auditor"].includes(next.role)
      )
        fail("Use a valid email and role.");
      if (req.body.active !== undefined) {
        if (typeof req.body.active !== "boolean")
          fail("Specify active as a boolean.");
        next.active = Number(req.body.active);
      }
      if (
        current.id === req.user.id &&
        (!next.active || next.role !== current.role)
      )
        fail("You cannot deactivate or change the role of your own account.");
      if (
        current.role === "admin" &&
        current.active &&
        (!next.active || next.role !== "admin") &&
        db
          .prepare(
            "SELECT COUNT(*) AS n FROM users WHERE role='admin' AND active=1",
          )
          .get().n <= 1
      )
        fail("Keep at least one active administrator.", 409);
      db.prepare(
        "UPDATE users SET name=?,email=?,role=?,active=? WHERE id=?",
      ).run(next.name, next.email, next.role, next.active, current.id);
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(current.id);
      const revokeDelegation = next.role !== current.role || !next.active;
      if (revokeDelegation)
        db.prepare(
          "UPDATE approval_delegates SET active=0 WHERE user_id=?",
        ).run(current.id);
      audit(db, req.user.id, "user.update", current.id, {
        before: current,
        after: next,
        delegation_revoked: revokeDelegation,
        reason: req.body.reason
          ? text(req.body.reason, "Change reason", 500)
          : "Administrator updated user access",
      });
      res.json({ ok: true });
    }),
  );
  registerEnhancements(app, db, {
    allow,
    financial,
    readers,
    text,
    fail,
    openPeriod,
    upload,
    digest,
    report,
    reconciliationRows,
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "API endpoint not found." }),
  );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    let status = error.status || 400,
      message = error.message;
    if (error.code?.startsWith("ERR_SQLITE")) {
      status = 409;
      message =
        "This operation conflicts with an existing record or financial constraint.";
    }
    if (error instanceof SyntaxError) message = "Invalid request format.";
    if (error.code === "LIMIT_FILE_SIZE")
      message = "Statement files must be no larger than 2 MB.";
    if (status >= 500) {
      try {
        audit(
          db,
          req.user?.id || null,
          "system.request_error",
          String(req.route?.path || "/api"),
          { method: req.method, status },
        );
      } catch {}
      console.error(error);
      message = "The request could not be completed.";
    }
    res.status(status).json({ error: message });
  });
  return app;
}
