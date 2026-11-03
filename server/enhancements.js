import { businessDate, approvalHistory } from "./role-data.js";
import { registerPartialMatches } from "./partial-matching.js";
import { backup } from "node:sqlite";
import { mkdtemp, rm, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { id, money, isoDate, atomic, audit } from "./db.js";

export const fail = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};
export function openPeriod(db, date) {
  if (
    db
      .prepare("SELECT 1 FROM periods WHERE month=? AND closed=1")
      .get(date.slice(0, 7))
  )
    fail("This reporting period is closed.", 409);
}
export const accepted = (row) =>
  ["approved", "not_required"].includes(row.approval);
export const sumMinor = (rows, key = "amount") =>
  rows.reduce((sum, row) => sum + BigInt(row[key]), 0n);
export const major = (value) => {
  const n = BigInt(value),
    a = n < 0n ? -n : n;
  return `${n < 0n ? "-" : ""}${a / 100n}.${String(a % 100n).padStart(2, "0")}`;
};
export function previewWarnings(db, rows, accountId, importId) {
  const keys = new Map(),
    warnings = [];
  for (const r of rows) {
    const key = [r.date, r.reference, r.amount, r.direction].join("|");
    keys.set(key, (keys.get(key) || 0) + 1);
  }
  for (const r of rows) {
    const key = [r.date, r.reference, r.amount, r.direction].join("|");
    if (
      keys.get(key) > 1 ||
      db
        .prepare(
          "SELECT 1 FROM statement_lines WHERE account_id=? AND date=? AND reference=? AND amount=? AND direction=? AND import_id<>?",
        )
        .get(accountId, r.date, r.reference, r.amount, r.direction, importId)
    )
      warnings.push({
        row: r.row_number,
        warning:
          "Possible duplicate statement entry; original evidence is retained and reconciliation needs review.",
      });
  }
  return warnings;
}
export function validateWorkbookArchive(bytes) {
  const eocd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0 || eocd + 22 > bytes.length) fail("Invalid XLSX ZIP directory.");
  const count = bytes.readUInt16LE(eocd + 10),
    start = bytes.readUInt32LE(eocd + 16),
    size = bytes.readUInt32LE(eocd + 12);
  if (count > 1000 || start + size > bytes.length)
    fail("Workbook archive exceeds supported limits.");
  let offset = start,
    total = 0;
  for (let n = 0; n < count; n++) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50)
      fail("Invalid workbook archive metadata.");
    const flags = bytes.readUInt16LE(offset + 8),
      uncompressed = bytes.readUInt32LE(offset + 24),
      nameLength = bytes.readUInt16LE(offset + 28),
      extra = bytes.readUInt16LE(offset + 30),
      comment = bytes.readUInt16LE(offset + 32);
    total += uncompressed;
    if (
      flags & 1 ||
      uncompressed > 10 * 1024 * 1024 ||
      total > 25 * 1024 * 1024
    )
      fail("Encrypted or oversized expanded workbooks are unsupported.");
    offset += 46 + nameLength + extra + comment;
    if (offset > start + size) fail("Invalid workbook archive directory.");
  }
}
export function partialTotals(db) {
  const tx = new Map(),
    line = new Map();
  for (const p of db
    .prepare(
      "SELECT transaction_id,line_id,amount FROM partial_matches WHERE status='approved'",
    )
    .all()) {
    tx.set(
      p.transaction_id,
      (tx.get(p.transaction_id) || 0n) + BigInt(p.amount),
    );
    line.set(p.line_id, (line.get(p.line_id) || 0n) + BigInt(p.amount));
  }
  return { tx, line };
}
export function documentRows(db, kind = "customer", query = {}) {
  if (query.from) isoDate(query.from);
  if (query.to) isoDate(query.to);
  if (query.from && query.to && query.from > query.to)
    throw new Error("From date cannot follow To date.");
  const supplier = kind === "supplier";
  const writeoffs = db
    .prepare("SELECT * FROM document_writeoffs WHERE document_kind=?")
    .all(kind);
  const documents = db
    .prepare(
      `SELECT i.*,c.name AS customer,c.name AS contact_name FROM ${supplier ? "supplier_bills" : "invoices"} i JOIN contacts c ON c.id=i.contact_id ORDER BY i.due,i.number`,
    )
    .all();
  const allocations = db
    .prepare(
      supplier
        ? "SELECT p.* FROM supplier_allocations p WHERE NOT EXISTS (SELECT 1 FROM supplier_allocation_corrections x WHERE x.allocation_id=p.id)"
        : "SELECT p.* FROM payment_allocations p WHERE NOT EXISTS (SELECT 1 FROM allocation_corrections x WHERE x.allocation_id=p.id)",
    )
    .all();
  return documents
    .filter(
      (row) =>
        (!query.from || row.issued >= query.from) &&
        (!query.to || row.issued <= query.to) &&
        (!query.contact || row.contact_id === query.contact),
    )
    .map((row) => {
      const paid = sumMinor(
        allocations.filter(
          (a) => (supplier ? a.bill_id : a.invoice_id) === row.id,
        ),
      );
      const writtenOff = sumMinor(
        writeoffs.filter((w) => w.document_id === row.id),
      );
      const outstanding =
        row.lifecycle === "cancelled" || row.lifecycle === "draft"
          ? 0n
          : BigInt(row.amount) - paid - writtenOff;
      return {
        ...row,
        amount: String(row.amount),
        paid: String(paid),
        written_off: String(writtenOff),
        outstanding: String(outstanding),
        items: row.items ? JSON.parse(row.items) : [],
        status:
          row.lifecycle !== "issued"
            ? row.lifecycle
            : paid >= BigInt(row.amount)
              ? "paid"
              : outstanding === 0n && writtenOff > 0n
                ? "written_off"
                : paid > 0n
                  ? "partial"
                  : row.due < new Date().toISOString().slice(0, 10)
                    ? "overdue"
                    : "unpaid",
      };
    });
}
export function invoiceItems(items, expected) {
  if (!Array.isArray(items) || items.length > 100)
    throw new Error("Use at most 100 invoice line items.");
  let total = 0n;
  const result = items.map((item) => {
    if (
      typeof item.description !== "string" ||
      !item.description.trim() ||
      item.description.length > 200 ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 100000
    )
      throw new Error(
        "Each item needs a description and a positive whole quantity.",
      );
    const unit = money(item.unit_price);
    total += BigInt(unit) * BigInt(item.quantity);
    return {
      description: item.description.trim(),
      quantity: item.quantity,
      unit_price_minor: String(unit),
    };
  });
  if (items.length && total !== BigInt(expected))
    throw new Error("Invoice total must equal its line items.");
  return result;
}
export function balanceSummary(db, rows, query, user) {
  const end = query.to || "9999-12-31";
  const history = db
    .prepare(
      `SELECT * FROM transactions WHERE date<=?${user.role === "cashier" ? " AND user_id=?" : ""}`,
    )
    .all(end, ...(user.role === "cashier" ? [user.id] : []))
    .filter(accepted);
  return db
    .prepare("SELECT * FROM accounts ORDER BY name")
    .all()
    .filter(
      (a) =>
        (!query.account || query.account === a.id) &&
        (!query.channel || query.channel === a.channel),
    )
    .map((a) => {
      const movement = rows.filter((t) => t.account_id === a.id && accepted(t));
      const net =
        sumMinor(movement.filter((t) => t.direction === "in")) -
        sumMinor(movement.filter((t) => t.direction === "out"));
      const all = history.filter((t) => t.account_id === a.id);
      const prior = query.from ? all.filter((t) => t.date < query.from) : [];
      const beginning =
        (user.role === "cashier" || a.opening_date > end
          ? 0n
          : BigInt(a.opening_amount)) +
        sumMinor(prior.filter((t) => t.direction === "in")) -
        sumMinor(prior.filter((t) => t.direction === "out"));
      const closing =
        (user.role === "cashier" || a.opening_date > end
          ? 0n
          : BigInt(a.opening_amount)) +
        sumMinor(all.filter((t) => t.direction === "in")) -
        sumMinor(all.filter((t) => t.direction === "out"));
      return {
        ...a,
        opening_amount: String(a.opening_amount),
        balance: String(net),
        movement: String(net),
        closing: String(closing),
        opening: String(beginning),
      };
    });
}

export function analytics(rows, query = {}) {
  const valid = rows.filter(accepted),
    totals = (subset) => {
      const incoming = sumMinor(subset.filter((t) => t.direction === "in")),
        outgoing = sumMinor(subset.filter((t) => t.direction === "out"));
      return {
        incoming: String(incoming),
        outgoing: String(outgoing),
        net: String(incoming - outgoing),
        count: subset.length,
      };
    };
  const group = (field) =>
    [...new Set(valid.map((r) => r[field]))].map((name) => ({
      name,
      ...totals(valid.filter((r) => r[field] === name)),
    }));
  const anomalies = [];
  const sorted = valid
    .map((t) => BigInt(t.amount))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0n;
  const refs = new Map();
  for (const t of valid) {
    const k = `${t.account_id}|${t.date}|${t.direction}|${t.reference}`;
    if (t.reference) refs.set(k, (refs.get(k) || 0) + 1);
  }
  for (const t of valid) {
    const reasons = [];
    if (!t.reference)
      reasons.push("Missing external reference: verify supporting evidence.");
    if (
      t.reference &&
      refs.get(`${t.account_id}|${t.date}|${t.direction}|${t.reference}`) > 1
    )
      reasons.push(
        "Repeated reference on the same account, direction and date.",
      );
    if (sorted.length >= 10 && median > 0n && BigInt(t.amount) > median * 5n)
      reasons.push(
        "Amount exceeds five times the median accepted transaction in this view (at least 10 records).",
      );
    if (reasons.length)
      anomalies.push({
        transaction_id: t.id,
        date: t.date,
        reference: t.reference,
        amount: String(t.amount),
        reasons,
      });
  }
  const days = new Map();
  for (const t of valid)
    days.set(
      t.date,
      (days.get(t.date) || 0n) +
        (t.direction === "in" ? BigInt(t.amount) : -BigInt(t.amount)),
    );
  const dates = [...days.keys()].sort(),
    span = dates.length
      ? Math.round(
          (Date.parse(dates.at(-1)) - Date.parse(dates[0])) / 86400000,
        ) + 1
      : 0;
  const recentStart = dates.length
    ? new Date(Date.parse(dates.at(-1)) - 55 * 86400000)
        .toISOString()
        .slice(0, 10)
    : "9999-12-31";
  const recent = valid.filter((t) => t.date >= recentStart);
  let forecast = {
    available: false,
    reason:
      "Forecast needs at least 56 calendar days of history, with 28 active days and 56 accepted transactions in the most recent 56 days, and no more than 10% pending records.",
  };
  if (
    span >= 56 &&
    dates.filter((date) => date >= recentStart).length >= 28 &&
    recent.length >= 56 &&
    rows.filter((t) => t.approval === "pending").length * 10 <= rows.length
  ) {
    const end = Date.parse(dates.at(-1)),
      daily = Array.from(
        { length: 56 },
        (_, i) =>
          days.get(
            new Date(end - (55 - i) * 86400000).toISOString().slice(0, 10),
          ) || 0n,
      );
    const abs = (n) => (n < 0n ? -n : n);
    const errors = [];
    for (let i = 42; i < 56; i++) {
      const baseline = daily.slice(i - 7, i).reduce((a, b) => a + b, 0n) / 7n;
      errors.push(abs(daily[i] - baseline));
    }
    const mean = daily.slice(-7).reduce((a, b) => a + b, 0n) / 7n,
      mae = errors.reduce((a, b) => a + b, 0n) / 14n;
    forecast = {
      available: true,
      method:
        "Seven-day mean daily net movement; 14-day rolling held-out baseline",
      training_end: dates.at(-1),
      mae_minor: String(mae),
      assumptions:
        "Missing dates are zero recorded movement. Last seven calendar days remain representative. Values truncate to whole minor units.",
      limitations:
        "Recorded cash movement only; no seasonality, unpaid documents or provider feeds. Ranges are twice historical MAE, not confidence intervals. Human review required.",
      points: Array.from({ length: 7 }, (_, i) => ({
        date: new Date(end + (i + 1) * 86400000).toISOString().slice(0, 10),
        net: String(mean),
        low: String(mean - 2n * mae),
        high: String(mean + 2n * mae),
      })),
    };
  }
  const middle = dates.length ? dates[Math.floor(dates.length / 2)] : null;
  return {
    totals: totals(valid),
    channels: group("channel"),
    accounts: group("account_name"),
    categories: group("category"),
    anomalies,
    forecast,
    comparison: middle
      ? {
          scope:
            "First and second halves of active transaction dates in this view; periods may differ in length",
          split_date: middle,
          previous: totals(valid.filter((t) => t.date < middle)),
          current: totals(valid.filter((t) => t.date >= middle)),
        }
      : null,
    filters: query,
  };
}

export function registerEnhancements(
  app,
  db,
  {
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
  },
) {
  const getTx = (req, tid) => {
    const row = db.prepare("SELECT * FROM transactions WHERE id=?").get(tid);
    if (!row) fail("Transaction not found.", 404);
    if (req.user.role === "cashier" && row.user_id !== req.user.id)
      fail("Your role does not permit this record.", 403);
    return row;
  };
  const dateFilter = (row, q) =>
    (!q.from || row.date >= isoDate(q.from)) &&
    (!q.to || row.date <= isoDate(q.to)) &&
    (!q.account || row.account_id === q.account) &&
    (!q.channel || row.channel === q.channel);
  const beforeAfter = (req, action, entity, before, after, reason) =>
    audit(db, req.user.id, action, entity, { before, after, reason });

  app.patch("/api/accounts/:id", allow(["admin", ...financial]), (req, res) =>
    atomic(db, () => {
      const a = db
        .prepare("SELECT * FROM accounts WHERE id=?")
        .get(req.params.id);
      if (!a) fail("Account not found.", 404);
      const name =
        req.body.name === undefined
          ? a.name
          : text(req.body.name, "Account name");
      const active =
        req.body.active === undefined
          ? a.active
          : typeof req.body.active === "boolean"
            ? Number(req.body.active)
            : fail("Active must be a boolean.");
      if (req.body.opening_amount !== undefined)
        fail(
          "Opening balances are immutable after account creation. Use an authorised adjustment.",
        );
      const provider =
        req.body.provider === undefined
          ? a.provider
          : String(req.body.provider).slice(0, 100);
      db.prepare(
        "UPDATE accounts SET name=?,provider=?,active=? WHERE id=?",
      ).run(name, provider, active, a.id);
      beforeAfter(
        req,
        "account.update",
        a.id,
        req.user.role === "admin"
          ? { name: a.name, provider: a.provider, active: a.active }
          : a,
        { name, provider, active },
        text(req.body.reason, "Change reason", 500),
      );
      res.json({ ok: true });
    }),
  );
  app.patch("/api/contacts/:id", allow(financial), (req, res) =>
    atomic(db, () => {
      const c = db
        .prepare("SELECT * FROM contacts WHERE id=?")
        .get(req.params.id);
      if (!c) fail("Contact not found.", 404);
      const next = { ...c };
      for (const key of ["name", "phone", "email", "address", "reference"])
        if (req.body[key] !== undefined)
          next[key] =
            key === "name"
              ? text(req.body[key], "Name")
              : String(req.body[key])
                  .trim()
                  .slice(0, key === "address" ? 500 : 200);
      if (next.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email))
        fail("Enter a valid email.");
      if (req.body.active !== undefined) {
        if (typeof req.body.active !== "boolean")
          fail("Active must be a boolean.");
        next.active = Number(req.body.active);
      }
      db.prepare(
        "UPDATE contacts SET name=?,phone=?,email=?,address=?,reference=?,active=? WHERE id=?",
      ).run(
        next.name,
        next.phone,
        next.email,
        next.address,
        next.reference,
        next.active,
        c.id,
      );
      beforeAfter(
        req,
        "contact.update",
        c.id,
        c,
        next,
        text(req.body.reason, "Change reason", 500),
      );
      res.json({ ok: true });
    }),
  );
  app.get("/api/contacts/:id/history", allow(), (req, res) => {
    const c = db
      .prepare("SELECT * FROM contacts WHERE id=?")
      .get(req.params.id);
    if (!c) fail("Contact not found.", 404);
    if (req.user.role === "cashier" && c.type !== "customer")
      fail("Your role does not permit this record.", 403);
    const rows = report({ ...req, query: { ...req.query, contact: c.id } });
    const documents =
      req.user.role === "cashier"
        ? []
        : documentRows(db, c.type, { ...req.query, contact: c.id });
    res.json({
      contact: c,
      transactions: rows.map((t) => ({ ...t, amount: String(t.amount) })),
      documents,
      outstanding: String(
        documents.reduce((n, d) => n + BigInt(d.outstanding), 0n),
      ),
    });
  });
  app.get("/api/categories", allow(), (req, res) =>
    res.json(
      req.user.role === "cashier"
        ? db
            .prepare(
              "SELECT * FROM categories WHERE active=1 AND direction IN ('in','both') ORDER BY name",
            )
            .all()
        : db.prepare("SELECT * FROM categories ORDER BY name").all(),
    ),
  );
  app.post("/api/categories", allow(["admin", ...financial]), (req, res) =>
    atomic(db, () => {
      const cid = id(),
        name = text(req.body.name, "Category name", 80),
        direction = req.body.direction;
      if (!["in", "out", "both"].includes(direction))
        fail("Choose category direction.");
      db.prepare("INSERT INTO categories(id,name,direction) VALUES(?,?,?)").run(
        cid,
        name,
        direction,
      );
      audit(db, req.user.id, "category.create", cid, { name, direction });
      res.status(201).json({ id: cid });
    }),
  );
  app.patch("/api/categories/:id", allow(["admin", ...financial]), (req, res) =>
    atomic(db, () => {
      const c = db
        .prepare("SELECT * FROM categories WHERE id=?")
        .get(req.params.id);
      if (!c) fail("Category not found.", 404);
      if (typeof req.body.active !== "boolean")
        fail("Active must be a boolean.");
      db.prepare("UPDATE categories SET active=? WHERE id=?").run(
        Number(req.body.active),
        c.id,
      );
      beforeAfter(
        req,
        "category.update",
        c.id,
        c,
        { active: req.body.active },
        text(req.body.reason, "Reason", 500),
      );
      res.json({ ok: true });
    }),
  );

  app.get("/api/transactions/:id/evidence", allow(), (req, res) => {
    getTx(req, req.params.id);
    res.json(
      db
        .prepare(
          "SELECT id,filename,mime,created_at,user_id FROM evidence WHERE transaction_id=? ORDER BY created_at",
        )
        .all(req.params.id),
    );
  });
  app.post(
    "/api/transactions/:id/evidence",
    allow([...financial, "cashier"]),
    upload.single("file"),
    (req, res) =>
      atomic(db, () => {
        const t = getTx(req, req.params.id);
        openPeriod(db, t.date);
        if (!req.file) fail("Choose a PDF, PNG or JPEG evidence file.");
        const bytes = req.file.buffer,
          png = bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
          jpeg =
            bytes.length > 3 &&
            bytes[0] === 255 &&
            bytes[1] === 216 &&
            bytes[2] === 255,
          pdf = bytes.subarray(0, 5).toString() === "%PDF-";
        const mime = png
          ? "image/png"
          : jpeg
            ? "image/jpeg"
            : pdf
              ? "application/pdf"
              : null;
        if (!mime)
          fail(
            "Only PDF, PNG and JPEG file signatures are accepted. Do not upload payment credentials.",
          );
        if (
          db
            .prepare(
              "SELECT COUNT(*) AS n FROM evidence WHERE transaction_id=?",
            )
            .get(t.id).n >= 5
        )
          fail("At most five evidence files per transaction.");
        const eid = id();
        db.prepare(
          "INSERT INTO evidence(id,transaction_id,filename,mime,source,fingerprint,user_id) VALUES(?,?,?,?,?,?,?)",
        ).run(
          eid,
          t.id,
          req.file.originalname.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 100),
          mime,
          bytes,
          digest(bytes),
          req.user.id,
        );
        audit(db, req.user.id, "evidence.attach", t.id, {
          evidence: eid,
          mime,
        });
        res.status(201).json({ id: eid });
      }),
  );
  app.get("/api/evidence/:id", allow(), (req, res) => {
    const e = db
      .prepare("SELECT * FROM evidence WHERE id=?")
      .get(req.params.id);
    if (!e) fail("Evidence not found.", 404);
    getTx(req, e.transaction_id);
    res.set("X-Content-Type-Options", "nosniff");
    res.attachment(e.filename);
    res.type(e.mime).send(Buffer.from(e.source));
  });
  app.post("/api/transactions/:id/verify", allow(financial), (req, res) =>
    atomic(db, () => {
      const t = getTx(req, req.params.id);
      openPeriod(db, t.date);
      const reference = text(
        req.body.evidence_reference,
        "Independent evidence reference",
        500,
      );
      if (
        !accepted(t) ||
        t.reversal_of ||
        db.prepare("SELECT 1 FROM transactions WHERE reversal_of=?").get(t.id)
      )
        fail("Only an accepted unreversed transaction can be verified.", 409);
      db.prepare(
        "INSERT INTO payment_verifications(transaction_id,evidence_reference,user_id) VALUES(?,?,?)",
      ).run(t.id, reference, req.user.id);
      audit(db, req.user.id, "payment.verify", t.id, {
        evidence_reference: reference,
        source: "manual evidence review; no provider API",
      });
      res.json({ ok: true });
    }),
  );

  app.patch("/api/invoices/:id", allow(financial), (req, res) =>
    atomic(db, () => {
      const row = db
        .prepare("SELECT * FROM invoices WHERE id=?")
        .get(req.params.id);
      if (!row) fail("Invoice not found.", 404);
      openPeriod(db, row.issued);
      const reason = text(req.body.reason, "Change reason", 500),
        next = req.body.lifecycle;
      if (!["issued", "cancelled"].includes(next))
        fail("Choose issue or cancel.");
      const doc = documentRows(db).find((d) => d.id === row.id);
      if (
        row.lifecycle === "cancelled" ||
        (next === "issued" && row.lifecycle !== "draft") ||
        BigInt(doc.paid) > 0n ||
        BigInt(doc.written_off) > 0n
      )
        fail(
          "This invoice cannot change lifecycle; correct allocations first.",
          409,
        );
      db.prepare("UPDATE invoices SET lifecycle=? WHERE id=?").run(
        next,
        row.id,
      );
      beforeAfter(
        req,
        "invoice.lifecycle",
        row.id,
        { lifecycle: row.lifecycle },
        { lifecycle: next },
        reason,
      );
      res.json({ ok: true });
    }),
  );
  app.get("/api/invoices/:id/payments", allow(readers), (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT p.*,t.date,t.reference,x.reason AS correction_reason FROM payment_allocations p JOIN transactions t ON t.id=p.transaction_id LEFT JOIN allocation_corrections x ON x.allocation_id=p.id WHERE p.invoice_id=? ORDER BY t.date",
        )
        .all(req.params.id)
        .map((p) => ({ ...p, amount: String(p.amount) })),
    ),
  );
  app.post("/api/allocations/:id/correct", allow(financial), (req, res) =>
    atomic(db, () => {
      const p = db
        .prepare(
          "SELECT p.*,t.date,i.issued FROM payment_allocations p JOIN transactions t ON t.id=p.transaction_id JOIN invoices i ON i.id=p.invoice_id WHERE p.id=?",
        )
        .get(req.params.id);
      if (!p) fail("Allocation not found.", 404);
      openPeriod(db, p.date);
      openPeriod(db, p.issued);
      const reason = text(req.body.reason, "Correction reason", 500);
      db.prepare(
        "INSERT INTO allocation_corrections(allocation_id,reason,user_id) VALUES(?,?,?)",
      ).run(p.id, reason, req.user.id);
      audit(db, req.user.id, "allocation.correct", p.id, {
        reason,
        invoice: p.invoice_id,
        transaction: p.transaction_id,
        amount: String(p.amount),
      });
      res.json({ ok: true });
    }),
  );
  app.get("/api/supplier-bills", allow(readers), (req, res) =>
    res.json(documentRows(db, "supplier", req.query)),
  );
  app.post("/api/supplier-bills", allow(financial), (req, res) =>
    atomic(db, () => {
      const b = req.body,
        bid = id(),
        issued = isoDate(b.issued),
        due = isoDate(b.due),
        amount = money(b.amount);
      if (b.currency && b.currency !== "SLE")
        fail("Supplier bills use the organisation currency SLE.");
      if (due < issued) fail("Due date cannot precede issue date.");
      if (
        !db
          .prepare(
            "SELECT 1 FROM contacts WHERE id=? AND type='supplier' AND active=1",
          )
          .get(b.contact_id)
      )
        fail("Choose an active supplier.");
      openPeriod(db, issued);
      db.prepare(
        "INSERT INTO supplier_bills(id,number,contact_id,issued,due,amount,description,user_id) VALUES(?,?,?,?,?,?,?,?)",
      ).run(
        bid,
        text(b.number, "Bill number", 80),
        b.contact_id,
        issued,
        due,
        amount,
        text(b.description, "Description"),
        req.user.id,
      );
      audit(db, req.user.id, "supplier_bill.create", bid, {
        amount: String(amount),
        supplier: b.contact_id,
      });
      res.status(201).json({ id: bid });
    }),
  );
  app.post("/api/supplier-bills/:id/allocate", allow(financial), (req, res) =>
    atomic(db, () => {
      const b = db
          .prepare(
            "SELECT * FROM supplier_bills WHERE id=? AND lifecycle='issued'",
          )
          .get(req.params.id),
        t = getTx(req, req.body.transaction_id),
        amount = money(req.body.amount);
      if (!b) fail("Issued supplier bill not found.", 404);
      if (
        BigInt(amount) >
        BigInt(
          documentRows(db, "supplier").find((d) => d.id === b.id).outstanding,
        )
      )
        fail(
          "Allocation exceeds outstanding payable after approved write-offs.",
          409,
        );
      openPeriod(db, b.issued);
      openPeriod(db, t.date);
      if (
        t.direction !== "out" ||
        t.approval !== "approved" ||
        t.contact_id !== b.contact_id ||
        t.reversal_of ||
        db.prepare("SELECT 1 FROM transactions WHERE reversal_of=?").get(t.id)
      )
        fail(
          "Use an independently approved, unreversed payment for the same supplier.",
        );
      const paid = sumMinor(
          db
            .prepare(
              "SELECT p.amount FROM supplier_allocations p WHERE bill_id=? AND NOT EXISTS (SELECT 1 FROM supplier_allocation_corrections x WHERE x.allocation_id=p.id)",
            )
            .all(b.id),
        ),
        used = sumMinor(
          db
            .prepare(
              "SELECT p.amount FROM supplier_allocations p WHERE transaction_id=? AND NOT EXISTS (SELECT 1 FROM supplier_allocation_corrections x WHERE x.allocation_id=p.id)",
            )
            .all(t.id),
        );
      if (
        BigInt(amount) > BigInt(b.amount) - paid ||
        BigInt(amount) > BigInt(t.amount) - used
      )
        fail("Allocation exceeds bill or payment balance.", 409);
      db.prepare("INSERT INTO supplier_allocations VALUES(?,?,?,?)").run(
        id(),
        b.id,
        t.id,
        amount,
      );
      audit(db, req.user.id, "supplier_bill.allocate", b.id, {
        transaction: t.id,
        amount: String(amount),
      });
      res.json({ ok: true });
    }),
  );

  const policy = () =>
    db.prepare("SELECT * FROM reconciliation_policy WHERE id=1").get();
  registerPartialMatches(app, db, {
    allow,
    financial,
    readers,
    text,
    fail,
    openPeriod,
    policy,
    partialTotals,
  });
  app.get("/api/control-requests", allow(readers), (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT c.*,u.name AS requester FROM control_requests c JOIN users u ON u.id=c.user_id ORDER BY c.created_at DESC",
        )
        .all()
        .map((r) => ({ ...r, payload: JSON.parse(r.payload) })),
    ),
  );
  app.post("/api/control-requests", allow(financial), (req, res) =>
    atomic(db, () => {
      const kind = req.body.kind,
        p = req.body.payload,
        reason = text(req.body.reason, "Request reason", 500);
      if (
        !["period_close", "reversal", "adjustment", "writeoff"].includes(
          kind,
        ) ||
        !p ||
        typeof p !== "object" ||
        Array.isArray(p)
      )
        fail("Choose a valid control request and its details.");
      const rid = req.body.request_key
        ? text(req.body.request_key, "Request key", 100)
        : id();
      const prior = db
        .prepare("SELECT * FROM control_requests WHERE id=?")
        .get(rid);
      if (prior) {
        if (
          prior.user_id !== req.user.id ||
          prior.kind !== kind ||
          prior.payload !== JSON.stringify(p) ||
          prior.reason !== reason
        )
          fail("Request key was used for different control data.", 409);
        return res.status(201).json({ id: prior.id });
      }
      if (kind === "period_close" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month))
        fail("Use a YYYY-MM period.");
      if (kind === "reversal") {
        isoDate(p.date);
        getTx(req, p.transaction_id);
      }
      if (kind === "adjustment") {
        isoDate(p.date);
        money(p.amount);
        if (!["in", "out"].includes(p.direction))
          fail("Choose adjustment direction.");
        if (
          !db
            .prepare("SELECT 1 FROM accounts WHERE id=? AND active=1")
            .get(p.account_id)
        )
          fail("Choose an active account.");
        text(p.reference, "Adjustment evidence reference");
        text(p.description, "Adjustment description");
      }
      if (kind === "writeoff") {
        if (!["customer", "supplier"].includes(p.document_kind))
          fail("Choose document kind.");
        money(p.amount);
        text(p.evidence_reference, "Write-off evidence reference");
        const d = documentRows(db, p.document_kind).find(
          (d) => d.id === p.document_id,
        );
        if (!d || d.lifecycle !== "issued") fail("Choose an issued document.");
        if (BigInt(money(p.amount)) > BigInt(d.outstanding))
          fail("Write-off exceeds outstanding amount.", 409);
      }
      db.prepare(
        "INSERT INTO control_requests(id,kind,payload,reason,user_id) VALUES(?,?,?,?,?)",
      ).run(rid, kind, JSON.stringify(p), reason, req.user.id);
      audit(db, req.user.id, "control.request", rid, {
        kind,
        payload: p,
        reason,
      });
      res.status(201).json({ id: rid });
    }),
  );
  app.post("/api/control-requests/:id/decide", allow(["manager"]), (req, res) =>
    atomic(db, () => {
      const r = db
        .prepare(
          "SELECT * FROM control_requests WHERE id=? AND status='pending'",
        )
        .get(req.params.id);
      if (!r) fail("Pending request not found.", 409);
      if (r.user_id === req.user.id)
        fail("A different manager must decide this request.", 403);
      const reason = text(req.body.reason, "Decision reason", 500),
        decision = req.body.decision;
      if (!["approved", "rejected"].includes(decision))
        fail("Choose approve or reject.");
      const p = JSON.parse(r.payload);
      let result = null;
      if (decision === "approved") {
        if (r.kind === "period_close")
          setPeriod(db, req.user.id, p.month, 1, reason);
        if (r.kind === "reversal")
          result = reverseEntry(
            db,
            req.user.id,
            p.transaction_id,
            isoDate(p.date),
            `${r.reason}; approval: ${reason}`,
          );
        if (r.kind === "adjustment") {
          const a = db
            .prepare("SELECT * FROM accounts WHERE id=? AND active=1")
            .get(p.account_id);
          if (!a) fail("Account is inactive or missing.", 409);
          const day = isoDate(p.date);
          openPeriod(db, day);
          if (day < a.opening_date) fail("Date precedes the opening balance.");
          result = id();
          db.prepare(
            "INSERT INTO transactions(id,date,amount,direction,account_id,reference,description,category,user_id,approval,request_key) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
          ).run(
            result,
            day,
            money(p.amount),
            p.direction,
            a.id,
            p.reference,
            p.description,
            "Adjustment",
            r.user_id,
            "approved",
            r.id,
          );
          audit(db, req.user.id, "adjustment.post", result, {
            request: r.id,
            reason,
            evidence: p.reference,
          });
        }
        if (r.kind === "writeoff") {
          const d = documentRows(db, p.document_kind).find(
            (d) => d.id === p.document_id,
          );
          if (!d || d.lifecycle !== "issued")
            fail("Issued document no longer available.", 409);
          openPeriod(db, d.issued);
          const amount = money(p.amount);
          if (BigInt(amount) > BigInt(d.outstanding))
            fail(
              "Outstanding amount changed; request must be reviewed again.",
              409,
            );
          result = id();
          db.prepare(
            "INSERT INTO document_writeoffs VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP)",
          ).run(
            result,
            p.document_kind,
            d.id,
            amount,
            r.id,
            req.user.id,
            `${r.reason}; ${reason}; Evidence: ${p.evidence_reference}`,
          );
          audit(db, req.user.id, "document.writeoff", d.id, {
            request: r.id,
            amount: String(amount),
            reason,
            evidence: p.evidence_reference,
            non_cash: true,
          });
        }
      }
      db.prepare(
        "UPDATE control_requests SET status=?,decision_user=?,decision_reason=?,result_id=?,decided_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(decision, req.user.id, reason, result, r.id);
      audit(db, req.user.id, "control.decide", r.id, {
        decision,
        reason,
        result,
      });
      res.json({ ok: true, result_id: result });
    }),
  );
  app.get("/api/supplier-bills/:id/payments", allow(readers), (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT p.*,t.date,t.reference,x.reason AS correction_reason FROM supplier_allocations p JOIN transactions t ON t.id=p.transaction_id LEFT JOIN supplier_allocation_corrections x ON x.allocation_id=p.id WHERE p.bill_id=? ORDER BY t.date",
        )
        .all(req.params.id)
        .map((p) => ({ ...p, amount: String(p.amount) })),
    ),
  );
  app.post(
    "/api/supplier-allocations/:id/correct",
    allow(financial),
    (req, res) =>
      atomic(db, () => {
        const p = db
          .prepare(
            "SELECT p.*,t.date,b.issued FROM supplier_allocations p JOIN transactions t ON t.id=p.transaction_id JOIN supplier_bills b ON b.id=p.bill_id WHERE p.id=?",
          )
          .get(req.params.id);
        if (!p) fail("Supplier allocation not found.", 404);
        openPeriod(db, p.date);
        openPeriod(db, p.issued);
        const reason = text(req.body.reason, "Correction reason", 500);
        db.prepare(
          "INSERT INTO supplier_allocation_corrections VALUES(?,?,?,CURRENT_TIMESTAMP)",
        ).run(p.id, reason, req.user.id);
        audit(db, req.user.id, "supplier_allocation.correct", p.id, {
          reason,
          bill: p.bill_id,
          transaction: p.transaction_id,
        });
        res.json({ ok: true });
      }),
  );
  app.get("/api/approval-policy", allow(readers), (req, res) =>
    res.json({
      delegates: db
        .prepare(
          "SELECT d.*,u.name,u.role FROM approval_delegates d JOIN users u ON u.id=d.user_id",
        )
        .all(),
      eligible: db
        .prepare(
          "SELECT id,name,role FROM users WHERE active=1 AND role IN ('finance','admin') ORDER BY name",
        )
        .all(),
    }),
  );
  app.post("/api/approval-policy", allow(["manager"]), (req, res) =>
    atomic(db, () => {
      const user = db
        .prepare(
          "SELECT id,role FROM users WHERE id=? AND active=1 AND role IN ('finance','admin')",
        )
        .get(req.body.user_id);
      if (!user) fail("Choose an active finance officer or administrator.");
      if (typeof req.body.active !== "boolean")
        fail("Active must be a boolean.");
      const reason = text(req.body.reason, "Delegation reason", 500);
      db.prepare(
        "INSERT INTO approval_delegates(user_id,active,reason,assigned_by) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET active=excluded.active,reason=excluded.reason,assigned_by=excluded.assigned_by,created_at=CURRENT_TIMESTAMP",
      ).run(user.id, Number(req.body.active), reason, req.user.id);
      audit(db, req.user.id, "approval.delegate", user.id, {
        active: req.body.active,
        reason,
        role: user.role,
      });
      res.json({ ok: true });
    }),
  );
  app.get("/api/reconciliation/participants", allow(readers), (req, res) => {
    const partial = partialTotals(db),
      reversed = new Set(
        db
          .prepare(
            "SELECT reversal_of FROM transactions WHERE reversal_of IS NOT NULL",
          )
          .all()
          .map((r) => r.reversal_of),
      );
    res.json({
      transactions: report(req)
        .filter(
          (t) =>
            accepted(t) &&
            t.reconciliation === "unmatched" &&
            !t.reversal_of &&
            !reversed.has(t.id),
        )
        .map((t) => ({
          ...t,
          amount: String(t.amount),
          remaining_minor: String(
            BigInt(t.amount) - (partial.tx.get(t.id) || 0n),
          ),
        })),
      lines: reconciliationRows().filter((l) => l.status !== "reconciled"),
    });
  });
  app.get("/api/reconciliation/policy", allow(readers), (req, res) =>
    res.json(policy()),
  );
  app.post(
    "/api/reconciliation/suggestions/reject",
    allow(financial),
    (req, res) =>
      atomic(db, () => {
        const line = reconciliationRows().find(
            (l) => l.id === req.body.line_id,
          ),
          reason = text(req.body.reason, "Rejection reason", 500);
        if (
          !line ||
          !line.candidates.some((t) => t.id === req.body.transaction_id)
        )
          fail("Current suggestion not found.", 409);
        openPeriod(db, line.date);
        db.prepare(
          "INSERT INTO exception_reviews(source_key,status,reason,user_id) VALUES(?,?,?,?)",
        ).run(
          `suggestion:${line.id}:${req.body.transaction_id}`,
          "in_review",
          reason,
          req.user.id,
        );
        audit(db, req.user.id, "reconciliation.suggestion_reject", line.id, {
          transaction: req.body.transaction_id,
          reason,
        });
        res.json({ ok: true });
      }),
  );
  app.patch("/api/reconciliation/policy", allow(["manager"]), (req, res) =>
    atomic(db, () => {
      const b = req.body;
      if (
        !Number.isInteger(b.date_days) ||
        b.date_days < 0 ||
        b.date_days > 7 ||
        !Number.isInteger(b.amount_minor) ||
        b.amount_minor < 0 ||
        b.amount_minor > 100000
      )
        fail(
          "Use date tolerance 0–7 days and amount tolerance 0–100000 minor units.",
        );
      const before = policy(),
        reason = text(b.reason, "Policy reason", 500);
      db.prepare(
        "UPDATE reconciliation_policy SET date_days=?,amount_minor=? WHERE id=1",
      ).run(b.date_days, b.amount_minor);
      beforeAfter(
        req,
        "reconciliation.policy",
        "policy",
        before,
        policy(),
        reason,
      );
      res.json({ ok: true });
    }),
  );
  const participantRows = (body) => {
    if (
      !Array.isArray(body.transaction_ids) ||
      !Array.isArray(body.line_ids) ||
      !body.transaction_ids.length ||
      !body.line_ids.length ||
      body.transaction_ids.length > 30 ||
      body.line_ids.length > 30
    )
      fail("Choose 1–30 transactions and 1–30 statement lines.");
    for (const list of [body.transaction_ids, body.line_ids])
      if (
        list.some((v) => typeof v !== "string") ||
        new Set(list).size !== list.length
      )
        fail("Participant IDs must be unique strings.");
    const tx = body.transaction_ids.map((tid) =>
        db.prepare("SELECT * FROM transactions WHERE id=?").get(tid),
      ),
      lines = body.line_ids.map((lid) =>
        db.prepare("SELECT * FROM statement_lines WHERE id=?").get(lid),
      );
    if ([...tx, ...lines].some((r) => !r)) fail("Participant not found.", 404);
    const all = [...tx, ...lines],
      first = all[0];
    if (all.some((r) => r.account_id !== first.account_id))
      fail("Participants must share one financial account and currency.");
    for (const t of tx)
      if (
        !accepted(t) ||
        t.reconciliation === "reconciled" ||
        db
          .prepare(
            "SELECT 1 FROM partial_matches WHERE transaction_id=? AND status='approved'",
          )
          .get(t.id) ||
        t.reversal_of ||
        db.prepare("SELECT 1 FROM transactions WHERE reversal_of=?").get(t.id)
      )
        fail("Use accepted, unreversed, unreconciled transactions.", 409);
    for (const l of lines)
      if (
        db
          .prepare(
            "SELECT 1 FROM partial_matches WHERE line_id=? AND status='approved'",
          )
          .get(l.id) ||
        db
          .prepare("SELECT 1 FROM reconciliations WHERE line_id=? AND active=1")
          .get(l.id) ||
        db
          .prepare(
            "SELECT 1 FROM grouped_links WHERE participant_type='line' AND participant_id=? AND active=1",
          )
          .get(l.id)
      )
        fail("Statement line is already reconciled.", 409);
    for (const r of all) openPeriod(db, r.date);
    const dates = all.map((r) => Date.parse(r.date));
    if (
      (Math.max(...dates) - Math.min(...dates)) / 86400000 >
      policy().date_days
    )
      fail("Participant dates exceed the configured tolerance.");
    const signed = (rows) =>
      sumMinor(rows.filter((r) => r.direction === "in")) -
      sumMinor(rows.filter((r) => r.direction === "out"));
    return { tx, lines, difference: signed(tx) - signed(lines) };
  };
  app.get("/api/reconciliation/suggestions", allow(readers), (req, res) => {
    const rules = policy(),
      tx = report(req).filter(
        (t) =>
          accepted(t) &&
          t.reconciliation === "unmatched" &&
          !t.reversal_of &&
          !db
            .prepare("SELECT 1 FROM transactions WHERE reversal_of=?")
            .get(t.id),
      );
    const candidates = [];
    for (const line of reconciliationRows().filter(
      (l) => l.status !== "reconciled" && dateFilter(l, req.query),
    )) {
      const options = tx.filter(
        (t) =>
          t.account_id === line.account_id &&
          t.direction === line.direction &&
          Math.abs(Date.parse(t.date) - Date.parse(line.date)) / 86400000 <=
            rules.date_days &&
          Math.abs(t.amount - Number(line.amount)) <= rules.amount_minor,
      );
      if (options.length)
        candidates.push({
          line_id: line.id,
          reference: line.reference,
          amount: line.amount,
          date: line.date,
          candidates: options.map((t) => ({
            id: t.id,
            reference: t.reference,
            date: t.date,
            amount: String(t.amount),
            difference: String(BigInt(t.amount) - BigInt(line.amount)),
          })),
          reason: `Same account/direction, within ${rules.date_days} days and ${rules.amount_minor} minor units. A proposal needs independent manager approval; nonzero differences require a separate recorded correction.`,
        });
    }
    res.json({ policy: rules, suggestions: candidates });
  });
  app.get("/api/reconciliation/proposals", allow(readers), (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT p.*,u.name AS requester FROM reconciliation_proposals p JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC",
        )
        .all()
        .map((p) => ({
          ...p,
          transaction_ids: JSON.parse(p.transaction_ids),
          line_ids: JSON.parse(p.line_ids),
        })),
    ),
  );
  app.post("/api/reconciliation/proposals", allow(financial), (req, res) =>
    atomic(db, () => {
      const rows = participantRows(req.body),
        pid = id(),
        reason = text(req.body.reason, "Proposal reason", 500);
      if (rows.difference !== 0n)
        fail(
          "Group totals differ. Record and approve the real fee/adjustment separately, then select a balanced group.",
          409,
        );
      db.prepare(
        "INSERT INTO reconciliation_proposals(id,transaction_ids,line_ids,reason,user_id) VALUES(?,?,?,?,?)",
      ).run(
        pid,
        JSON.stringify(req.body.transaction_ids),
        JSON.stringify(req.body.line_ids),
        reason,
        req.user.id,
      );
      audit(db, req.user.id, "reconciliation.propose", pid, {
        ...req.body,
        rule: "balanced-group-independent-review-v1",
      });
      res.status(201).json({ id: pid });
    }),
  );
  app.post(
    "/api/reconciliation/proposals/:id/decide",
    allow(["manager"]),
    (req, res) =>
      atomic(db, () => {
        const p = db
          .prepare(
            "SELECT * FROM reconciliation_proposals WHERE id=? AND status='pending'",
          )
          .get(req.params.id);
        if (!p) fail("Pending proposal not found.", 409);
        if (p.user_id === req.user.id)
          fail("A different manager must decide this proposal.", 403);
        const decision = req.body.decision,
          reason = text(req.body.reason, "Decision reason", 500);
        if (!["approved", "rejected"].includes(decision))
          fail("Choose approve or reject.");
        if (decision === "approved") {
          const rows = participantRows({
            transaction_ids: JSON.parse(p.transaction_ids),
            line_ids: JSON.parse(p.line_ids),
          });
          if (rows.difference !== 0n)
            fail("Group totals no longer agree.", 409);
          for (const [type, list] of [
            ["transaction", rows.tx],
            ["line", rows.lines],
          ])
            for (const r of list)
              db.prepare("INSERT INTO grouped_links VALUES(?,?,?,1)").run(
                p.id,
                type,
                r.id,
              );
          for (const t of rows.tx)
            db.prepare(
              "UPDATE transactions SET reconciliation='reconciled' WHERE id=?",
            ).run(t.id);
        }
        db.prepare(
          "UPDATE reconciliation_proposals SET status=?,decision_user=?,decision_reason=?,decided_at=CURRENT_TIMESTAMP WHERE id=?",
        ).run(decision, req.user.id, reason, p.id);
        audit(db, req.user.id, "reconciliation.group_decide", p.id, {
          decision,
          reason,
        });
        res.json({ ok: true });
      }),
  );
  app.post(
    "/api/reconciliation/proposals/:id/undo",
    allow(financial),
    (req, res) =>
      atomic(db, () => {
        const p = db
          .prepare(
            "SELECT * FROM reconciliation_proposals WHERE id=? AND status='approved'",
          )
          .get(req.params.id);
        if (!p) fail("Approved proposal not found.", 404);
        const reason = text(req.body.reason, "Undo reason", 500);
        for (const tid of JSON.parse(p.transaction_ids)) {
          const t = getTx(req, tid);
          openPeriod(db, t.date);
          db.prepare(
            "UPDATE transactions SET reconciliation='unmatched' WHERE id=?",
          ).run(tid);
        }
        for (const lid of JSON.parse(p.line_ids))
          openPeriod(
            db,
            db.prepare("SELECT date FROM statement_lines WHERE id=?").get(lid)
              .date,
          );
        db.prepare("UPDATE grouped_links SET active=0 WHERE proposal_id=?").run(
          p.id,
        );
        db.prepare(
          "UPDATE reconciliation_proposals SET status='undone' WHERE id=?",
        ).run(p.id);
        audit(db, req.user.id, "reconciliation.group_undo", p.id, { reason });
        res.json({ ok: true });
      }),
  );

  function exceptions(query = {}) {
    const output = [];
    const partial = partialTotals(db);
    const reversedIds = new Set(
      db
        .prepare(
          "SELECT reversal_of FROM transactions WHERE reversal_of IS NOT NULL",
        )
        .all()
        .map((r) => r.reversal_of),
    );
    const allRows = report({
      user: { role: "finance" },
      query: { ...query, status: undefined },
    });
    const eligible = allRows.filter(
      (t) =>
        accepted(t) &&
        t.reconciliation === "unmatched" &&
        !t.reversal_of &&
        !reversedIds.has(t.id),
    );
    const references = new Map();
    for (const t of eligible) {
      const key = JSON.stringify([t.account_id, t.direction, t.reference]);
      if (!references.has(key)) references.set(key, []);
      references.get(key).push(t);
    }

    for (const l of reconciliationRows())
      if (l.status !== "reconciled" && dateFilter(l, query)) {
        let type =
          l.status === "duplicate"
            ? "duplicate"
            : !l.reference
              ? "missing_reference"
              : l.status === "ambiguous"
                ? "pending_review"
                : "unmatched";
        const near = l.reference
          ? references.get(
              JSON.stringify([l.account_id, l.direction, l.reference]),
            ) || []
          : [];
        if (
          type === "unmatched" &&
          near.some((t) => BigInt(t.amount) !== BigInt(l.amount))
        )
          type =
            sumMinor(near) < BigInt(l.amount)
              ? "partial_match"
              : "amount_difference";
        if (partial.line.has(l.id)) type = "partial_match";
        output.push({
          key: `line:${l.id}`,
          source: "statement",
          source_id: l.id,
          type,
          date: l.date,
          account_id: l.account_id,
          account_name: l.account_name,
          channel: l.channel,
          reference: l.reference,
          amount: String(BigInt(l.amount) - (partial.line.get(l.id) || 0n)),
          description: partial.line.has(l.id)
            ? `${l.description} ? Remaining unmatched statement amount`
            : l.description,
        });
      }
    for (const i of db
      .prepare(
        "SELECT i.*,a.name AS account_name,a.channel FROM imports i JOIN accounts a ON a.id=i.account_id",
      )
      .all())
      if (
        (!query.account || query.account === i.account_id) &&
        (!query.channel || query.channel === i.channel)
      )
        for (const e of JSON.parse(i.errors)) {
          const day = i.created_at.slice(0, 10);
          if ((query.from && day < query.from) || (query.to && day > query.to))
            continue;
          output.push({
            key: `invalid:${i.id}:${e.row}`,
            source: "import",
            source_id: i.id,
            type: "invalid_statement",
            date: day,
            account_id: i.account_id,
            account_name: i.account_name,
            channel: i.channel,
            reference: `Row ${e.row}`,
            amount: "0",
            description: e.error,
          });
        }
    const unmatched = eligible;
    for (const t of unmatched)
      output.push({
        key: `transaction:${t.id}`,
        source: "transaction",
        source_id: t.id,
        type: partial.tx.has(t.id)
          ? "partial_match"
          : t.reference
            ? "unmatched_transaction"
            : "missing_reference",
        date: t.date,
        account_id: t.account_id,
        account_name: t.account_name,
        channel: t.channel,
        reference: t.reference,
        amount: String(BigInt(t.amount) - (partial.tx.get(t.id) || 0n)),
        description: partial.tx.has(t.id)
          ? `${t.description} ? Remaining unmatched transaction amount`
          : t.description,
      });
    const notes = new Map(
      db
        .prepare("SELECT * FROM exception_reviews")
        .all()
        .map((r) => [r.source_key, r]),
    );
    return output
      .map((r) => ({
        ...r,
        status: notes.get(r.key)?.status || "open",
        review: notes.get(r.key) || null,
      }))
      .filter(
        (r) =>
          (!query.type || r.type === query.type) &&
          (!["open", "in_review", "dismissed"].includes(query.status) ||
            r.status === query.status),
      );
  }
  app.get("/api/workspace-summary", allow(), (req, res) => {
    const rows = report(req),
      date = businessDate(),
      today = rows.filter((t) => t.date === date),
      accepted = today.filter((t) =>
        ["approved", "not_required"].includes(t.approval),
      ),
      incoming = accepted.filter((t) => t.direction === "in"),
      sum = (items) =>
        items.reduce((n, t) => n + BigInt(t.amount), 0n).toString();
    const reversed = new Set(
      db
        .prepare(
          "SELECT reversal_of FROM transactions WHERE reversal_of IS NOT NULL",
        )
        .all()
        .map((t) => t.reversal_of),
    );
    const sales = incoming.filter(
      (t) => t.entry_kind === "sale" && !t.reversal_of && !reversed.has(t.id),
    );
    const daily = {
      date,
      incoming: sum(incoming),
      outgoing: sum(accepted.filter((t) => t.direction === "out")),
      sales: sum(sales),
      sales_count: sales.length,
      count: today.length,
      cash: sum(incoming.filter((t) => t.channel === "cash")),
      mobile: sum(incoming.filter((t) => t.channel === "mobile")),
      bank: sum(incoming.filter((t) => t.channel === "bank")),
    };
    if (req.user.role === "cashier") return res.json({ daily });
    const items = exceptions(req.query),
      imports = db
        .prepare(
          "SELECT id,filename,account_id,status,created_at FROM imports ORDER BY created_at DESC",
        )
        .all()
        .filter(
          (i) =>
            (!req.query.account || i.account_id === req.query.account) &&
            (!req.query.from || i.created_at.slice(0, 10) >= req.query.from) &&
            (!req.query.to || i.created_at.slice(0, 10) <= req.query.to),
        )
        .slice(0, 5),
      history = approvalHistory(db, { ...req, query: req.query, rows }),
      adjustments = history.filter((r) =>
        ["adjustment", "writeoff", "reversal"].includes(r.kind),
      );
    res.json({
      daily,
      pending_exceptions: items.filter((i) => i.status !== "dismissed").length,
      recent_imports: imports,
      approval_history: history.slice(0, 6),
      recent_adjustments: adjustments.slice(0, 6),
      recent_audit: db
        .prepare(
          "SELECT e.id,e.action,e.created_at,u.name AS user_name FROM audit_events e LEFT JOIN users u ON u.id=e.user_id ORDER BY e.created_at DESC,e.rowid DESC",
        )
        .all()
        .filter(
          (e) =>
            (!req.query.from || e.created_at.slice(0, 10) >= req.query.from) &&
            (!req.query.to || e.created_at.slice(0, 10) <= req.query.to),
        )
        .slice(0, 5),
    });
  });
  app.get("/api/exceptions", allow(readers), (req, res) =>
    res.json(exceptions(req.query)),
  );
  app.post("/api/exceptions/review", allow(financial), (req, res) =>
    atomic(db, () => {
      const item = exceptions().find((r) => r.key === req.body.key);
      if (!item) fail("Current exception not found.", 404);
      const status = req.body.status,
        reason = text(
          req.body.reason,
          "Investigation / resolution reason",
          500,
        );
      if (!["in_review", "dismissed"].includes(status))
        fail("Choose in_review or dismissed.");
      if (
        status === "dismissed" &&
        (req.user.role !== "manager" ||
          !["duplicate", "invalid_statement"].includes(item.type))
      )
        fail(
          "Only a manager may dismiss a documented duplicate or invalid statement row. Match or correct other financial exceptions.",
          403,
        );
      openPeriod(db, item.date);
      db.prepare(
        "INSERT INTO exception_reviews(source_key,status,reason,user_id) VALUES(?,?,?,?) ON CONFLICT(source_key) DO UPDATE SET status=excluded.status,reason=excluded.reason,user_id=excluded.user_id,created_at=CURRENT_TIMESTAMP",
      ).run(item.key, status, reason, req.user.id);
      beforeAfter(
        req,
        "exception.review",
        item.key,
        item.review,
        { status },
        reason,
      );
      res.json({ ok: true });
    }),
  );

  app.get("/api/analytics", allow(readers), (req, res) =>
    res.json(analytics(report(req), req.query)),
  );
  const reportKinds = [
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
  ];
  const reportData = (req) => {
    const kind = String(req.query.kind || "transactions");
    if (!reportKinds.includes(kind)) fail("Unknown report type.");
    const rows = report(req);
    let data;
    if (["transactions", "income", "expenses", "outstanding"].includes(kind))
      data = rows
        .filter((t) =>
          kind === "income"
            ? t.direction === "in" && accepted(t)
            : kind === "expenses"
              ? t.direction === "out" && accepted(t)
              : kind === "outstanding"
                ? t.approval === "pending" || t.reconciliation === "unmatched"
                : true,
        )
        .map((t) => ({
          date: t.date,
          reference: t.reference,
          description: t.description,
          account: t.account_name,
          channel: t.channel,
          category: t.category,
          contact: t.contact_name || "",
          currency: t.currency,
          direction: t.direction,
          amount_minor: String(t.amount),
          approval: t.approval,
          reconciliation:
            t.reconciliation === "reconciled"
              ? "reconciled"
              : BigInt(t.reconciled_minor || 0) > 0n
                ? "partially_matched"
                : t.reconciliation,
          allocated_minor: String(t.reconciled_minor || 0),
        }));
    else if (kind === "account_statement") {
      data = [];
      for (const a of balanceSummary(db, rows, req.query, req.user)) {
        let running = BigInt(a.opening);
        data.push({
          account: a.name,
          date: req.query.from || a.opening_date,
          reference: "OPENING",
          description: "Opening book balance before filtered movements",
          direction: "opening",
          amount_minor: "0",
          running_balance_minor: String(running),
          currency: a.currency,
        });
        for (const t of rows.filter(
          (t) => t.account_id === a.id && accepted(t),
        )) {
          running +=
            t.direction === "in" ? BigInt(t.amount) : -BigInt(t.amount);
          data.push({
            account: a.name,
            date: t.date,
            reference: t.reference,
            description: t.description,
            direction: t.direction,
            amount_minor: String(t.amount),
            running_balance_minor: String(running),
            currency: a.currency,
          });
        }
      }
    } else if (kind === "cashflow") data = analytics(rows).channels;
    else if (kind === "accounts")
      data = balanceSummary(db, rows, req.query, req.user).map((a) => ({
        name: a.name,
        channel: a.channel,
        currency: a.currency,
        opening_minor: a.opening,
        movement_minor: a.movement,
        closing_minor: a.closing,
      }));
    else if (["invoices", "supplier_bills"].includes(kind))
      data = documentRows(
        db,
        kind === "invoices" ? "customer" : "supplier",
        req.query,
      ).map((d) => ({
        number: d.number,
        contact: d.contact_name,
        issued: d.issued,
        due: d.due,
        currency: d.currency,
        amount_minor: d.amount,
        written_off_minor: d.written_off,
        paid_minor: d.paid,
        outstanding_minor: d.outstanding,
        status: d.status,
      }));
    else if (["customers", "suppliers"].includes(kind)) {
      const type = kind === "customers" ? "customer" : "supplier",
        docs = documentRows(db, type, req.query);
      data = db
        .prepare("SELECT * FROM contacts WHERE type=? ORDER BY name")
        .all(type)
        .map((c) => ({
          name: c.name,
          reference: c.reference,
          phone: c.phone,
          outstanding_minor: String(
            docs
              .filter((d) => d.contact_id === c.id)
              .reduce((n, d) => n + BigInt(d.outstanding), 0n),
          ),
        }));
    } else if (kind === "exceptions")
      data = exceptions(req.query).map((e) => ({
        date: e.date,
        account: e.account_name,
        type: e.type,
        status: e.status,
        reference: e.reference,
        amount_minor: e.amount,
        description: e.description,
      }));
    else
      data = reconciliationRows()
        .filter((l) => dateFilter(l, req.query))
        .map((l) => ({
          date: l.date,
          account: l.account_name,
          reference: l.reference,
          amount_minor: l.amount,
          allocated_minor: l.allocated_minor,
          remaining_minor: l.remaining_minor,
          direction: l.direction,
          status: l.status,
          rule: l.rule,
          transaction: l.transaction_id || "",
        }));
    const statuses = [
      ...new Set(
        data
          .map((r) => r.status || r.approval || r.reconciliation)
          .filter(Boolean),
      ),
    ];
    if (req.query.report_status)
      data = data.filter(
        (r) =>
          (r.status || r.approval || r.reconciliation) ===
          req.query.report_status,
      );
    return {
      kind,
      statuses,
      rows: data,
      filters: req.query,
      scope: ["invoices", "supplier_bills", "customers", "suppliers"].includes(
        kind,
      )
        ? "Document issue dates; outstanding documents have no financial-account attribution. Transaction account/channel/category/approval/reconciliation filters do not apply to document obligations. Use the report status control for document payment status."
        : kind === "account_statement"
          ? "Running balance of filtered accepted entries plus opening balance. Category/status filters can omit activity; use Accounts report for the full closing book balance. Monetary fields are minor units."
          : "Recorded transactions/evidence in selected scope; monetary amounts are exact minor units.",
    };
  };
  app.get("/api/reports/data", allow(readers), (req, res) =>
    res.json(reportData(req)),
  );
  app.get("/api/reports/download", allow(readers), async (req, res) => {
    const output = reportData(req),
      columns = output.rows.length
        ? Object.keys(output.rows[0])
        : ["No records"];
    audit(db, req.user.id, "report.download", output.kind, {
      filters: req.query,
      count: output.rows.length,
    });
    if (req.query.format === "pdf") {
      const pdf = new PDFDocument({
        margin: 36,
        size: "A4",
        layout: "landscape",
      });
      res.attachment(`finbiz-${output.kind}.pdf`);
      res.type("pdf");
      pdf.pipe(res);
      pdf.fontSize(18).text(`FinBiz 360 | ${output.kind}`);
      pdf.fontSize(9).text(output.scope).text(JSON.stringify(req.query));
      for (const row of output.rows) {
        pdf
          .moveDown(0.5)
          .fontSize(8)
          .text(columns.map((k) => `${k}: ${row[k]}`).join(" | "));
      }
      pdf.end();
    } else if (req.query.format === "xlsx") {
      const book = new ExcelJS.Workbook(),
        sheet = book.addWorksheet("Report");
      sheet.addRow(columns);
      for (const row of output.rows)
        sheet.addRow(columns.map((key) => String(row[key] ?? "")));
      res.attachment(`finbiz-${output.kind}.xlsx`);
      res.type(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      await book.xlsx.write(res);
      res.end();
    } else {
      const cell = (v) =>
        '"' +
        String(v ?? "")
          .replace(/^[=+\-@\t\r]/, "'$&")
          .replaceAll('"', '""') +
        '"';
      res.attachment(`finbiz-${output.kind}.csv`);
      res
        .type("text/csv")
        .send(
          [columns, ...output.rows.map((r) => columns.map((k) => r[k]))]
            .map((r) => r.map(cell).join(","))
            .join("\r\n"),
        );
    }
  });
  app.get("/api/imports/:id/errors", allow(readers), (req, res) => {
    const i = db
      .prepare("SELECT errors FROM imports WHERE id=?")
      .get(req.params.id);
    if (!i) fail("Import not found.", 404);
    res
      .attachment("statement-validation-errors.json")
      .json(JSON.parse(i.errors));
  });
  app.get("/api/search", allow(), (req, res) => {
    const q = String(req.query.q || "")
      .trim()
      .slice(0, 100);
    if (q.length < 2)
      return res.json({ transactions: [], contacts: [], documents: [] });
    const transactions = report({ ...req, query: { q } })
      .slice(-10)
      .map((t) => ({
        id: t.id,
        description: t.description,
        reference: t.reference,
        amount: String(t.amount),
      }));
    const contacts = db
      .prepare(
        "SELECT id,name,type,reference FROM contacts WHERE (name LIKE ? OR reference LIKE ?) AND (? <> 'cashier' OR (type='customer' AND active=1)) ORDER BY name LIMIT 10",
      )
      .all(`%${q}%`, `%${q}%`, req.user.role);
    const documents =
      req.user.role === "cashier"
        ? []
        : [
            ...documentRows(db).map((d) => ({
              ...d,
              document_kind: "invoice",
            })),
            ...documentRows(db, "supplier").map((d) => ({
              ...d,
              document_kind: "supplier_bill",
            })),
          ]
            .filter(
              (d) =>
                d.number.toLowerCase().includes(q.toLowerCase()) ||
                d.contact_name.toLowerCase().includes(q.toLowerCase()),
            )
            .slice(0, 10);
    res.json({ transactions, contacts, documents });
  });
  app.get("/api/backup", allow(["admin"]), async (req, res) => {
    const directory = await mkdtemp(join(tmpdir(), "finbiz-download-"));
    try {
      const filename = join(directory, "snapshot.db");
      audit(db, req.user.id, "backup.export", "database");
      await backup(db, filename);
      res.attachment(
        `finbiz-backup-${new Date().toISOString().slice(0, 10)}.db`,
      );
      await new Promise((resolve, reject) =>
        res.sendFile(filename, (error) => (error ? reject(error) : resolve())),
      );
    } finally {
      await rm(join(directory, "snapshot.db"), { force: true });
      await rmdir(directory);
    }
  });
}

export function reverseEntry(db, userId, transactionId, date, reason) {
  const tid = id();
  const t = db
    .prepare("SELECT * FROM transactions WHERE id=?")
    .get(transactionId);
  if (!t) fail("Transaction not found.", 404);
  openPeriod(db, t.date);
  openPeriod(db, date);
  if (t.approval === "pending" || t.approval === "rejected" || t.reversal_of)
    fail("Only accepted original entries can be reversed.", 409);
  if (
    db
      .prepare("SELECT 1 FROM payment_allocations WHERE transaction_id=?")
      .get(t.id)
  )
    fail(
      "Correct the existing invoice allocations in Payment history before reversing this receipt.",
      409,
    );
  if (
    db
      .prepare(
        "SELECT 1 FROM supplier_allocations p WHERE transaction_id=? AND NOT EXISTS (SELECT 1 FROM supplier_allocation_corrections x WHERE x.allocation_id=p.id)",
      )
      .get(t.id)
  )
    fail(
      "A supplier-allocated payment cannot be reversed before an allocation correction.",
      409,
    );
  if (
    t.reconciliation === "reconciled" ||
    db
      .prepare(
        "SELECT 1 FROM partial_matches WHERE transaction_id=? AND status='approved'",
      )
      .get(t.id)
  )
    fail("Undo reconciliation before reversing this transaction.", 409);
  db.prepare(
    "INSERT INTO transactions (id,date,amount,direction,account_id,reference,description,category,contact_id,user_id,approval,reversal_of,request_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
  ).run(
    tid,
    date,
    t.amount,
    t.direction === "in" ? "out" : "in",
    t.account_id,
    `REV-${t.reference}`,
    reason,
    t.category,
    t.contact_id,
    userId,
    "approved",
    t.id,
    id(),
  );
  audit(db, userId, "transaction.reverse", t.id, {
    reversal: tid,
    reason,
  });
  return tid;
}

export function setPeriod(db, userId, month, closed, reason) {
  if (
    closed &&
    db
      .prepare(
        "SELECT 1 FROM transactions WHERE date LIKE ? AND approval='pending'",
      )
      .get(`${month}%`)
  )
    fail("Resolve pending approvals before closing the period.", 409);
  db.prepare(
    "INSERT INTO periods VALUES (?,?,?,?) ON CONFLICT(month) DO UPDATE SET closed=excluded.closed,reason=excluded.reason,user_id=excluded.user_id",
  ).run(month, closed, reason, userId);
  audit(db, userId, closed ? "period.close" : "period.reopen", month, {
    reason,
  });
}
