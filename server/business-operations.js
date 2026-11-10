import { atomic, audit, id, isoDate, money } from "./db.js";
import { documentRows, fail, openPeriod, major } from "./enhancements.js";
import { businessDate } from "./role-data.js";
import { assertApprovalLimit, hasPermission } from "./permissions.js";
import { keyConfigured } from "./security-crypto.js";
import { backupPath, runEncryptedBackup } from "./secure-backups.js";
import { existsSync } from "node:fs";
const zeroMoney = (value) => (/^(0|0\.0{1,2})$/.test(value) ? 0 : money(value));
const pack = (row) =>
  Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k,
      [
        "amount",
        "opening",
        "counted",
        "expected",
        "difference",
        "actual",
        "remaining",
      ].includes(k) && v !== null
        ? String(v)
        : v,
    ]),
  );
const integer = (value, min, max, label) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max)
    fail(`${label} must be ${min}–${max}.`);
  return n;
};
const month = (value) => {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value))
    fail("Use a month in YYYY-MM format.");
  return value;
};
const addDays = (date, days) =>
  new Date(Date.parse(date + "T00:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
export function advanceMonth(date, months, preferredDay) {
  const [y, m, d] = date.split("-").map(Number),
    target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(preferredDay || d, last));
  return target.toISOString().slice(0, 10);
}
function prepareRecurringDraft(db, template, userId) {
  const did = id(),
    payload = {
      kind: template.kind,
      contact_id: template.contact_id,
      amount: major(template.amount),
      category: template.category,
      description: template.description,
      date: template.next_date,
      due: addDays(template.next_date, template.due_days),
    };
  const initial = db
    .prepare(
      "SELECT json_extract(details,'$.next_date') initial FROM audit_events WHERE entity=? AND action='recurring.created' ORDER BY rowid LIMIT 1",
    )
    .get(template.id)?.initial;
  const anchor = Number((initial || template.next_date).slice(-2));
  db.prepare(
    "INSERT INTO recurring_drafts(id,template_id,occurrence,payload) VALUES(?,?,?,?)",
  ).run(did, template.id, template.next_date, JSON.stringify(payload));
  db.prepare("UPDATE recurring_templates SET next_date=? WHERE id=?").run(
    advanceMonth(template.next_date, template.interval_months, anchor),
    template.id,
  );
  audit(db, userId, "recurring.draft_prepared", did, {
    template: template.id,
    occurrence: template.next_date,
  });
  return did;
}
export function prepareDueRecurring(db) {
  const templates = db
    .prepare(
      "SELECT t.* FROM recurring_templates t JOIN users u ON u.id=t.user_id WHERE t.active=1 AND t.next_date<=? AND u.active=1 ORDER BY t.next_date LIMIT 100",
    )
    .all(businessDate());
  const prepared = [];
  for (const template of templates) {
    const owner = db
      .prepare("SELECT id,role FROM users WHERE id=?")
      .get(template.user_id);
    if (!hasPermission(db, owner, "finance.recurring.manage")) continue;
    try {
      prepared.push(
        atomic(db, () => prepareRecurringDraft(db, template, owner.id)),
      );
    } catch {
      atomic(db, () => {
        db.prepare("UPDATE recurring_templates SET active=0 WHERE id=?").run(
          template.id,
        );
        audit(db, owner.id, "recurring.schedule_paused", template.id, {
          reason:
            "Automatic draft preparation failed; review the schedule before resuming.",
        });
      });
    }
  }
  return prepared;
}
export function startRecurringScheduler(db) {
  const tick = () => prepareDueRecurring(db);
  const timer = setInterval(tick, 60000);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}
export function linkShiftReceipt(db, transactionId, userId, accountId) {
  const shift = db
    .prepare(
      "SELECT id FROM cash_shifts WHERE user_id=? AND account_id=? AND status='open'",
    )
    .get(userId, accountId);
  if (shift)
    db.prepare("INSERT INTO shift_receipts VALUES(?,?)").run(
      transactionId,
      shift.id,
    );
}
export function shiftTotals(db, shift) {
  const entries = db
    .prepare(
      "SELECT t.id,t.reference,t.amount,t.direction,t.approval FROM transactions t WHERE t.id IN (SELECT transaction_id FROM shift_receipts WHERE shift_id=?) OR t.reversal_of IN (SELECT transaction_id FROM shift_receipts WHERE shift_id=?) ORDER BY t.rowid",
    )
    .all(shift.id, shift.id);
  const movement = entries
    .filter((t) => ["approved", "not_required"].includes(t.approval))
    .reduce(
      (n, t) =>
        n + (t.direction === "in" ? BigInt(t.amount) : -BigInt(t.amount)),
      0n,
    );
  return {
    entries: entries.map(pack),
    movement: String(movement),
    expected: String(BigInt(shift.opening) + movement),
  };
}
export function budgetRows(db, selectedMonth) {
  return db
    .prepare("SELECT * FROM budgets WHERE month=? ORDER BY category")
    .all(selectedMonth)
    .map((b) => {
      const rows = db
        .prepare(
          "SELECT amount,direction FROM transactions WHERE substr(date,1,7)=? AND category=? AND approval IN ('approved','not_required') AND (direction='out' OR reversal_of IN (SELECT id FROM transactions WHERE direction='out'))",
        )
        .all(b.month, b.category);
      const actual = rows.reduce(
        (n, t) =>
          n + (t.direction === "out" ? BigInt(t.amount) : -BigInt(t.amount)),
        0n,
      );
      return {
        ...pack(b),
        actual: String(actual),
        remaining: String(BigInt(b.amount) - actual),
        overspent: actual > BigInt(b.amount),
      };
    });
}
export function followupQueue(db) {
  const today = businessDate();
  const histories = new Map();
  for (const f of db
    .prepare(
      "SELECT f.*,u.name AS owner FROM document_followups f JOIN users u ON u.id=f.owner_id ORDER BY f.rowid DESC",
    )
    .all()) {
    const key = `${f.kind}:${f.document_id}`;
    if (!histories.has(key)) histories.set(key, []);
    histories.get(key).push(f);
  }
  return ["customer", "supplier"].flatMap((kind) =>
    documentRows(db, kind)
      .filter((d) => BigInt(d.outstanding) > 0n)
      .map((d) => {
        const days = Math.max(
          0,
          Math.floor((Date.parse(today) - Date.parse(d.due)) / 86400000),
        );
        const history = histories.get(`${kind}:${d.id}`) || [];
        return {
          ...d,
          kind,
          days_overdue: days,
          bucket:
            days === 0
              ? "Current"
              : days <= 30
                ? "1–30 days"
                : days <= 60
                  ? "31–60 days"
                  : days <= 90
                    ? "61–90 days"
                    : "Over 90 days",
          followups: history,
        };
      }),
  );
}
export function operationalReminders(db, user) {
  const items = [],
    today = businessDate(),
    can = (p) => hasPermission(db, user, p);
  const add = (key, title, detail, page) =>
    items.push({ id: key, title, detail, page, actionable: true });
  if (can("finance.followup.view"))
    for (const doc of followupQueue(db)) {
      if (doc.due <= addDays(today, 3))
        add(
          `due:${doc.kind}:${doc.id}:${doc.due}`,
          doc.days_overdue ? "Overdue payment" : "Payment due soon",
          `${doc.number} · ${doc.contact_name} · SLE ${major(doc.outstanding)} · ${doc.days_overdue} days overdue`,
          "Collections & payables",
        );
      const latest = doc.followups[0];
      if (
        latest &&
        latest.promised_date <= today &&
        latest.owner_id === user.id
      )
        add(
          `promise:${latest.id}`,
          "Follow-up due",
          `${doc.number} · ${latest.note}`,
          "Collections & payables",
        );
    }
  if (can("finance.shift.review")) {
    const count = db
      .prepare(
        "SELECT COUNT(*) n FROM cash_shifts WHERE status='submitted' AND user_id<>?",
      )
      .get(user.id).n;
    if (count)
      add(
        "shifts:submitted",
        "Cash shifts awaiting review",
        `${count} submitted shifts`,
        "Cash shifts",
      );
  }
  if (can("finance.purchase.approve")) {
    const count = db
      .prepare(
        "SELECT COUNT(*) n FROM purchase_requests WHERE status='pending' AND user_id<>?",
      )
      .get(user.id).n;
    if (count)
      add(
        "purchases:pending",
        "Purchase requests awaiting review",
        `${count} requests`,
        "Purchases",
      );
  }
  if (can("finance.approval.approve")) {
    const count = db
      .prepare(
        "SELECT COUNT(*) n FROM transactions WHERE approval='pending' AND user_id<>? AND created_at<datetime('now','-2 days')",
      )
      .get(user.id).n;
    if (count)
      add(
        "approvals:overdue",
        "Approvals waiting over two days",
        `${count} outgoing payments`,
        "Approvals",
      );
  }
  if (can("finance.exception.review")) {
    const count = db
      .prepare(
        "SELECT COUNT(*) n FROM transactions WHERE reconciliation='unmatched' AND approval IN ('approved','not_required') AND date<? AND reversal_of IS NULL AND NOT EXISTS(SELECT 1 FROM transactions r WHERE r.reversal_of=transactions.id)",
      )
      .get(addDays(today, -7)).n;
    if (count)
      add(
        "exceptions:aged",
        "Records unmatched for over seven days",
        `${count} recorded transactions`,
        "Exceptions",
      );
  }
  if (can("finance.budget.view"))
    for (const b of budgetRows(db, today.slice(0, 7)))
      if (b.overspent)
        add(
          `budget:${b.id}:${b.actual}`,
          "Budget exceeded",
          `${b.category} · SLE ${major(BigInt(b.actual) - BigInt(b.amount))} over budget`,
          "Budgets",
        );
  if (can("finance.recurring.manage")) {
    const count = db
      .prepare(
        "SELECT COUNT(*) n FROM recurring_templates WHERE active=1 AND next_date<=?",
      )
      .get(today).n;
    if (count)
      add(
        "recurring:due",
        "Recurring drafts ready to prepare",
        `${count} schedules due`,
        "Recurring drafts",
      );
  }
  if (can("system.backup.configure")) {
    const latest = db
      .prepare("SELECT * FROM backup_runs ORDER BY rowid DESC LIMIT 1")
      .get();
    if (latest?.status === "failed")
      add(
        `backup:${latest.id}`,
        "Encrypted backup failed",
        latest.error,
        "System maintenance",
      );
    const enabled = db
      .prepare("SELECT enabled FROM backup_policy WHERE id=1")
      .get().enabled;
    if (!enabled)
      add(
        "backup:disabled",
        "Automatic encrypted backups are disabled",
        "Configure the encryption key and backup schedule.",
        "System maintenance",
      );
  }
  const states = db
    .prepare("SELECT * FROM reminder_states WHERE user_id=?")
    .all(user.id);
  return items
    .filter((item) => {
      const s = states.find((s) => s.reminder_id === item.id);
      return (
        !s || (!s.completed && (!s.snoozed_until || s.snoozed_until <= today))
      );
    })
    .slice(0, 100);
}
export function registerBusinessOperations(app, db, { text }) {
  const reason = (req) => text(req.body.reason, "Reason", 500);
  app.get("/api/cash-shifts", (req, res) => {
    const own = req.user.role === "cashier";
    const rows = db
      .prepare(
        `SELECT s.*,u.name AS cashier,a.name AS account,v.name AS reviewer_name FROM cash_shifts s JOIN users u ON u.id=s.user_id JOIN accounts a ON a.id=s.account_id LEFT JOIN users v ON v.id=s.reviewer ${own ? "WHERE s.user_id=?" : ""} ORDER BY s.rowid DESC LIMIT 100`,
      )
      .all(...(own ? [req.user.id] : []));
    res.json({
      items: rows.map((s) => ({
        ...pack(s),
        ...(s.status === "open" ? shiftTotals(db, s) : {}),
      })),
      accounts: db
        .prepare(
          "SELECT id,name FROM accounts WHERE channel='cash' AND active=1",
        )
        .all(),
    });
  });
  app.post("/api/cash-shifts", (req, res) =>
    atomic(db, () => {
      const account = db
        .prepare(
          "SELECT id FROM accounts WHERE id=? AND channel='cash' AND active=1",
        )
        .get(req.body.account_id);
      if (!account) fail("Choose an active cash account.");
      const opening = zeroMoney(req.body.opening),
        key = text(req.body.request_key, "Request key", 100);
      const existing = db
        .prepare("SELECT * FROM cash_shifts WHERE request_key=?")
        .get(key);
      if (existing) {
        if (
          existing.user_id !== req.user.id ||
          existing.account_id !== account.id ||
          existing.opening !== opening
        )
          fail("Request key already used.", 409);
        return res.json({ id: existing.id });
      }
      const shiftId = id();
      db.prepare(
        "INSERT INTO cash_shifts(id,user_id,account_id,opening,request_key) VALUES(?,?,?,?,?)",
      ).run(shiftId, req.user.id, account.id, opening, key);
      audit(db, req.user.id, "shift.opened", shiftId, {
        account: account.id,
        opening: String(opening),
      });
      res.status(201).json({ id: shiftId });
    }),
  );
  app.post("/api/cash-shifts/:id/close", (req, res) =>
    atomic(db, () => {
      const shift = db
        .prepare(
          "SELECT * FROM cash_shifts WHERE id=? AND user_id=? AND status='open'",
        )
        .get(req.params.id, req.user.id);
      if (!shift) fail("Your open shift was not found.", 409);
      const counted = zeroMoney(req.body.counted),
        totals = shiftTotals(db, shift),
        expected = Number(totals.expected),
        difference = counted - expected,
        note = text(req.body.note, "Cash count explanation", 500);
      if (!Number.isSafeInteger(expected) || !Number.isSafeInteger(difference))
        fail("Shift total exceeds the supported exact amount range.");
      db.prepare(
        "UPDATE cash_shifts SET status='submitted',counted=?,expected=?,difference=?,note=?,closed_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(counted, expected, difference, note, shift.id);
      audit(db, req.user.id, "shift.submitted", shift.id, {
        counted: String(counted),
        expected: totals.expected,
        difference: String(difference),
        note,
        entries: totals.entries.map((t) => t.id),
      });
      res.json({ ok: true });
    }),
  );
  app.post("/api/cash-shifts/:id/review", (req, res) =>
    atomic(db, () => {
      const shift = db
        .prepare("SELECT * FROM cash_shifts WHERE id=? AND status='submitted'")
        .get(req.params.id);
      if (!shift) fail("Submitted shift not found.", 409);
      if (shift.user_id === req.user.id)
        fail("Another manager must review your shift.", 403);
      if (!["approved", "rejected"].includes(req.body.decision))
        fail("Choose approve or reject.");
      const why = reason(req);
      assertApprovalLimit(db, req.user, Math.abs(shift.difference));
      db.prepare(
        "UPDATE cash_shifts SET status=?,reviewer=?,decision_reason=?,decided_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(req.body.decision, req.user.id, why, shift.id);
      audit(db, req.user.id, "shift.reviewed", shift.id, {
        decision: req.body.decision,
        reason: why,
      });
      res.json({ ok: true });
    }),
  );
  app.get("/api/budgets", (req, res) => {
    const selected = month(req.query.month || businessDate().slice(0, 7));
    res.json({
      month: selected,
      items: budgetRows(db, selected),
      categories: db
        .prepare(
          "SELECT name FROM categories WHERE active=1 AND direction IN ('out','both') ORDER BY name",
        )
        .all(),
    });
  });
  app.post("/api/budgets", (req, res) =>
    atomic(db, () => {
      const selected = month(req.body.month),
        category = text(req.body.category, "Expense category", 80),
        amount = money(req.body.amount),
        why = reason(req);
      if (
        !db
          .prepare(
            "SELECT 1 FROM categories WHERE name=? AND active=1 AND direction IN ('out','both')",
          )
          .get(category)
      )
        fail("Choose an active expense category.");
      const before = db
        .prepare("SELECT * FROM budgets WHERE month=? AND category=?")
        .get(selected, category);
      const bid = before?.id || id();
      db.prepare(
        "INSERT INTO budgets(id,month,category,amount,user_id) VALUES(?,?,?,?,?) ON CONFLICT(month,category) DO UPDATE SET amount=excluded.amount,user_id=excluded.user_id,changed_at=CURRENT_TIMESTAMP",
      ).run(bid, selected, category, amount, req.user.id);
      audit(db, req.user.id, "budget.updated", bid, {
        month: selected,
        category,
        before: before ? String(before.amount) : null,
        amount: String(amount),
        reason: why,
      });
      res.json({ ok: true });
    }),
  );
  app.get("/api/followups", (req, res) =>
    res.json({
      items: followupQueue(db),
      owners: db
        .prepare(
          "SELECT id,name FROM users WHERE active=1 AND role IN ('finance','manager') ORDER BY name",
        )
        .all(),
    }),
  );
  app.post("/api/followups", (req, res) =>
    atomic(db, () => {
      const kind = req.body.kind;
      if (!["customer", "supplier"].includes(kind))
        fail("Choose customer or supplier.");
      const doc = followupQueue(db).find(
        (d) => d.kind === kind && d.id === req.body.document_id,
      );
      if (!doc) fail("Outstanding document not found.", 404);
      if (
        !db
          .prepare(
            "SELECT 1 FROM users WHERE id=? AND active=1 AND role IN ('finance','manager')",
          )
          .get(req.body.owner_id)
      )
        fail("Choose an active finance officer or manager.");
      const promised = isoDate(req.body.promised_date),
        note = text(req.body.note, "Follow-up note", 500),
        fid = id();
      db.prepare(
        "INSERT INTO document_followups(id,kind,document_id,owner_id,promised_date,note,user_id) VALUES(?,?,?,?,?,?,?)",
      ).run(fid, kind, doc.id, req.body.owner_id, promised, note, req.user.id);
      audit(db, req.user.id, "followup.recorded", fid, {
        kind,
        document: doc.id,
        owner: req.body.owner_id,
        promised_date: promised,
        note,
      });
      res.status(201).json({ id: fid });
    }),
  );
  app.get("/api/recurring", (req, res) =>
    res.json({
      templates: db
        .prepare(
          "SELECT t.*,c.name AS contact_name FROM recurring_templates t JOIN contacts c ON c.id=t.contact_id ORDER BY next_date",
        )
        .all()
        .map(pack),
      drafts: db
        .prepare(
          "SELECT d.*,t.name,t.kind FROM recurring_drafts d JOIN recurring_templates t ON t.id=d.template_id ORDER BY d.rowid DESC LIMIT 100",
        )
        .all()
        .map((d) => ({ ...d, payload: JSON.parse(d.payload) })),
    }),
  );
  app.post("/api/recurring", (req, res) =>
    atomic(db, () => {
      const kind = req.body.kind;
      if (!["invoice", "expense"].includes(kind))
        fail("Choose invoice or expense.");
      if (
        !db
          .prepare("SELECT 1 FROM contacts WHERE id=? AND type=? AND active=1")
          .get(
            req.body.contact_id,
            kind === "invoice" ? "customer" : "supplier",
          )
      )
        fail("Choose the matching active contact.");
      const tid = id(),
        next = isoDate(req.body.next_date),
        category =
          kind === "expense"
            ? text(req.body.category, "Expense category", 80)
            : "Sales";
      if (
        kind === "expense" &&
        !db
          .prepare(
            "SELECT 1 FROM categories WHERE name=? AND active=1 AND direction IN ('out','both')",
          )
          .get(category)
      )
        fail("Choose an active expense category.");
      db.prepare(
        "INSERT INTO recurring_templates(id,kind,name,contact_id,amount,category,description,next_date,interval_months,due_days,user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        tid,
        kind,
        text(req.body.name, "Schedule name", 100),
        req.body.contact_id,
        money(req.body.amount),
        category,
        text(req.body.description, "Description"),
        next,
        integer(req.body.interval_months, 1, 12, "Interval months"),
        integer(req.body.due_days, 0, 365, "Due days"),
        req.user.id,
      );
      audit(db, req.user.id, "recurring.created", tid, {
        kind,
        next_date: next,
      });
      res.status(201).json({ id: tid });
    }),
  );
  app.post("/api/recurring/:id/toggle", (req, res) =>
    atomic(db, () => {
      if (typeof req.body.active !== "boolean")
        fail("Active must be true or false.");
      const result = db
        .prepare("UPDATE recurring_templates SET active=? WHERE id=?")
        .run(Number(req.body.active), req.params.id);
      if (!result.changes) fail("Schedule not found.", 404);
      audit(db, req.user.id, "recurring.toggled", req.params.id, {
        active: req.body.active,
        reason: reason(req),
      });
      res.json({ ok: true });
    }),
  );
  app.post("/api/recurring/:id/prepare", (req, res) =>
    atomic(db, () => {
      const template = db
        .prepare("SELECT * FROM recurring_templates WHERE id=? AND active=1")
        .get(req.params.id);
      if (!template) fail("Active schedule not found.", 404);
      const occurrence = isoDate(req.body.occurrence);
      const existing = db
        .prepare(
          "SELECT id FROM recurring_drafts WHERE template_id=? AND occurrence=?",
        )
        .get(template.id, occurrence);
      if (existing) return res.json({ id: existing.id });
      if (occurrence !== template.next_date)
        fail(
          "The schedule advanced; refresh before preparing another occurrence.",
          409,
        );
      if (template.next_date > businessDate())
        fail("This schedule is not due yet.", 409);
      const did = prepareRecurringDraft(db, template, req.user.id);
      res.status(201).json({ id: did });
    }),
  );
  app.post("/api/recurring/drafts/:id/publish", (req, res) =>
    atomic(db, () => {
      const draft = db
        .prepare("SELECT * FROM recurring_drafts WHERE id=? AND status='draft'")
        .get(req.params.id);
      if (!draft) fail("Unpublished draft not found.", 409);
      const payload = JSON.parse(draft.payload),
        resultId = id();
      openPeriod(db, payload.date);
      if (
        !hasPermission(
          db,
          req.user,
          payload.kind === "invoice"
            ? "finance.invoice.create"
            : "finance.expense.create",
        ) ||
        (payload.kind === "expense" &&
          !hasPermission(db, req.user, "finance.transaction.create"))
      )
        fail("Your role cannot create this financial record.", 403);
      if (
        !db
          .prepare("SELECT 1 FROM contacts WHERE id=? AND type=? AND active=1")
          .get(
            payload.contact_id,
            payload.kind === "invoice" ? "customer" : "supplier",
          )
      )
        fail("The scheduled contact is no longer active.");
      if (payload.kind === "invoice") {
        db.prepare(
          "INSERT INTO invoices(id,number,contact_id,issued,due,amount,description,user_id,lifecycle) VALUES(?,?,?,?,?,?,?,?,'draft')",
        ).run(
          resultId,
          text(req.body.reference, "Invoice number", 80),
          payload.contact_id,
          payload.date,
          payload.due,
          money(payload.amount),
          payload.description,
          req.user.id,
        );
      } else {
        const account = db
          .prepare("SELECT * FROM accounts WHERE id=? AND active=1")
          .get(req.body.account_id);
        if (!account || account.opening_date > payload.date)
          fail("Choose an active account valid for this expense date.");
        if (
          !db
            .prepare(
              "SELECT 1 FROM categories WHERE name=? AND active=1 AND direction IN ('out','both')",
            )
            .get(payload.category)
        )
          fail("The expense category is no longer active.");
        db.prepare(
          "INSERT INTO transactions(id,date,amount,direction,account_id,reference,description,category,contact_id,user_id,approval,request_key) VALUES(?,?,?,'out',?,?,?,?,?,?,'pending',?)",
        ).run(
          resultId,
          payload.date,
          money(payload.amount),
          account.id,
          text(req.body.reference, "Expense reference", 200),
          payload.description,
          payload.category,
          payload.contact_id,
          req.user.id,
          `recurring:${draft.id}`,
        );
        audit(db, req.user.id, "transaction.create", resultId, {
          entry_kind: "payment",
          source: "recurring",
          approval: "pending",
          amount: String(money(payload.amount)),
        });
      }
      db.prepare(
        "UPDATE recurring_drafts SET status='published',result_id=? WHERE id=?",
      ).run(resultId, draft.id);
      audit(db, req.user.id, "recurring.draft_published", draft.id, {
        result_id: resultId,
        kind: payload.kind,
        reason: reason(req),
      });
      res.json({ id: resultId });
    }),
  );
  app.post("/api/recurring/drafts/:id/dismiss", (req, res) =>
    atomic(db, () => {
      const result = db
        .prepare(
          "UPDATE recurring_drafts SET status='dismissed' WHERE id=? AND status='draft'",
        )
        .run(req.params.id);
      if (!result.changes) fail("Unpublished draft not found.", 409);
      audit(db, req.user.id, "recurring.draft_dismissed", req.params.id, {
        reason: reason(req),
      });
      res.json({ ok: true });
    }),
  );
  app.get("/api/purchases", (req, res) =>
    res.json({
      items: db
        .prepare(
          "SELECT p.*,c.name AS supplier,u.name AS requester,r.name AS reviewer_name,o.id AS order_id,o.number AS order_number,l.bill_id,b.number AS bill_number FROM purchase_requests p JOIN contacts c ON c.id=p.contact_id JOIN users u ON u.id=p.user_id LEFT JOIN users r ON r.id=p.reviewer LEFT JOIN purchase_orders o ON o.request_id=p.id LEFT JOIN purchase_bill_links l ON l.order_id=o.id LEFT JOIN supplier_bills b ON b.id=l.bill_id ORDER BY p.rowid DESC LIMIT 150",
        )
        .all()
        .map(pack),
      bills: documentRows(db, "supplier"),
    }),
  );
  app.post("/api/purchases", (req, res) =>
    atomic(db, () => {
      if (
        !db
          .prepare(
            "SELECT 1 FROM contacts WHERE id=? AND type='supplier' AND active=1",
          )
          .get(req.body.contact_id)
      )
        fail("Choose an active supplier.");
      const pid = id();
      db.prepare(
        "INSERT INTO purchase_requests(id,number,contact_id,description,amount,user_id) VALUES(?,?,?,?,?,?)",
      ).run(
        pid,
        text(req.body.number, "Request number", 80),
        req.body.contact_id,
        text(req.body.description, "Purchase purpose", 500),
        money(req.body.amount),
        req.user.id,
      );
      audit(db, req.user.id, "purchase.requested", pid);
      res.status(201).json({ id: pid });
    }),
  );
  app.post("/api/purchases/:id/decide", (req, res) =>
    atomic(db, () => {
      const purchase = db
        .prepare(
          "SELECT * FROM purchase_requests WHERE id=? AND status='pending'",
        )
        .get(req.params.id);
      if (!purchase) fail("Pending purchase request not found.", 409);
      if (purchase.user_id === req.user.id)
        fail("Another manager must review your purchase request.", 403);
      if (!["approved", "rejected"].includes(req.body.decision))
        fail("Choose approve or reject.");
      const why = reason(req);
      if (req.body.decision === "approved")
        assertApprovalLimit(db, req.user, purchase.amount);
      db.prepare(
        "UPDATE purchase_requests SET status=?,reviewer=?,reason=?,decided_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(req.body.decision, req.user.id, why, purchase.id);
      audit(db, req.user.id, "purchase.decided", purchase.id, {
        decision: req.body.decision,
        reason: why,
      });
      res.json({ ok: true });
    }),
  );
  app.post("/api/purchases/:id/order", (req, res) =>
    atomic(db, () => {
      const purchase = db
        .prepare(
          "SELECT * FROM purchase_requests WHERE id=? AND status='approved'",
        )
        .get(req.params.id);
      if (!purchase) fail("Approved purchase request not found.", 409);
      const oid = id();
      db.prepare(
        "INSERT INTO purchase_orders(id,request_id,number,created_by) VALUES(?,?,?,?)",
      ).run(
        oid,
        purchase.id,
        text(req.body.number, "Purchase order number", 80),
        req.user.id,
      );
      audit(db, req.user.id, "purchase.order_created", oid, {
        request: purchase.id,
      });
      res.status(201).json({ id: oid });
    }),
  );
  app.post("/api/purchases/:id/link-bill", (req, res) =>
    atomic(db, () => {
      const order = db
        .prepare(
          "SELECT o.*,p.contact_id,p.amount FROM purchase_orders o JOIN purchase_requests p ON p.id=o.request_id WHERE o.request_id=?",
        )
        .get(req.params.id);
      if (!order) fail("Purchase order not found.", 404);
      const bill = db
        .prepare(
          "SELECT * FROM supplier_bills WHERE id=? AND lifecycle='issued' AND contact_id=?",
        )
        .get(req.body.bill_id, order.contact_id);
      if (!bill) fail("Choose an issued bill for the same supplier.");
      if (bill.amount > order.amount)
        fail(
          "Bill exceeds the approved purchase amount; obtain a new approved request.",
          409,
        );
      db.prepare(
        "INSERT INTO purchase_bill_links(order_id,bill_id,user_id) VALUES(?,?,?)",
      ).run(order.id, bill.id, req.user.id);
      audit(db, req.user.id, "purchase.bill_linked", order.id, {
        bill: bill.id,
        reason: reason(req),
      });
      res.json({ ok: true });
    }),
  );
  app.get("/api/reminders", (req, res) =>
    res.json({ items: operationalReminders(db, req.user) }),
  );
  app.post("/api/reminders/state", (req, res) =>
    atomic(db, () => {
      const reminder = operationalReminders(db, req.user).find(
        (r) => r.id === req.body.id,
      );
      if (!reminder) fail("Active reminder not found.", 404);
      const until = req.body.snoozed_until
        ? isoDate(req.body.snoozed_until)
        : null;
      if (until && until <= businessDate())
        fail("Choose a future reminder date.");
      if (typeof req.body.completed !== "boolean")
        fail("Completed must be true or false.");
      db.prepare(
        "INSERT INTO reminder_states(user_id,reminder_id,snoozed_until,completed) VALUES(?,?,?,?) ON CONFLICT(user_id,reminder_id) DO UPDATE SET snoozed_until=excluded.snoozed_until,completed=excluded.completed",
      ).run(req.user.id, reminder.id, until, Number(req.body.completed));
      audit(db, req.user.id, "reminder.updated", reminder.id, {
        snoozed_until: until,
        completed: req.body.completed,
      });
      res.json({ ok: true });
    }),
  );
  app.get("/api/secure-backups", (req, res) =>
    res.json({
      policy: db.prepare("SELECT * FROM backup_policy WHERE id=1").get(),
      configured: keyConfigured(),
      runs: db
        .prepare("SELECT * FROM backup_runs ORDER BY rowid DESC LIMIT 50")
        .all(),
    }),
  );
  app.post("/api/secure-backups/policy", (req, res) =>
    atomic(db, () => {
      if (typeof req.body.enabled !== "boolean")
        fail("Enabled must be true or false.");
      if (req.body.enabled && !keyConfigured())
        fail("Configure the server encryption key first.");
      const interval = integer(
          req.body.interval_hours,
          1,
          168,
          "Interval hours",
        ),
        retention = integer(
          req.body.retention_count,
          2,
          90,
          "Retained backups",
        ),
        why = reason(req);
      db.prepare(
        "UPDATE backup_policy SET enabled=?,interval_hours=?,retention_count=?,changed_by=?,changed_at=CURRENT_TIMESTAMP WHERE id=1",
      ).run(Number(req.body.enabled), interval, retention, req.user.id);
      audit(db, req.user.id, "backup.policy_updated", "backup_policy", {
        enabled: req.body.enabled,
        interval_hours: interval,
        retention_count: retention,
        reason: why,
      });
      res.json({ ok: true });
    }),
  );
  app.post("/api/secure-backups/run", async (req, res) =>
    res.json(await runEncryptedBackup(db, req.user.id)),
  );
  app.get("/api/secure-backups/:id/download", (req, res) => {
    const run = db
      .prepare(
        "SELECT filename FROM backup_runs WHERE id=? AND status='verified' AND filename IS NOT NULL",
      )
      .get(req.params.id);
    if (!run || !existsSync(backupPath(run.filename)))
      fail("Retained backup file not found.", 404);
    audit(db, req.user.id, "backup.encrypted_downloaded", req.params.id);
    res.download(backupPath(run.filename), run.filename);
  });
}
