import { id, money, atomic, audit } from "./db.js";

// Partial amounts are evidence allocations, never mutations of posted cash amounts.
export function registerPartialMatches(
  app,
  db,
  { allow, financial, readers, text, fail, openPeriod, policy, partialTotals },
) {
  const participants = (transactionId, lineId) => {
    if (typeof transactionId !== "string" || typeof lineId !== "string")
      fail("Choose one transaction and one statement line.");
    const t = db
        .prepare("SELECT * FROM transactions WHERE id=?")
        .get(transactionId),
      l = db.prepare("SELECT * FROM statement_lines WHERE id=?").get(lineId);
    if (!t || !l) fail("Transaction or statement line not found.", 404);
    if (
      !["approved", "not_required"].includes(t.approval) ||
      t.reversal_of ||
      db.prepare("SELECT 1 FROM transactions WHERE reversal_of=?").get(t.id)
    )
      fail("Choose an accepted, unreversed original transaction.", 409);
    if (t.account_id !== l.account_id || t.direction !== l.direction)
      fail(
        "Partial allocations require the same account, currency and direction.",
      );
    if (
      t.reconciliation === "reconciled" ||
      db
        .prepare("SELECT 1 FROM reconciliations WHERE line_id=? AND active=1")
        .get(l.id) ||
      db
        .prepare(
          "SELECT 1 FROM grouped_links WHERE participant_type='line' AND participant_id=? AND active=1",
        )
        .get(l.id)
    )
      fail("A participant is already fully reconciled.", 409);
    if (
      Math.abs(Date.parse(t.date) - Date.parse(l.date)) / 86400000 >
      policy().date_days
    )
      fail("Dates exceed the configured matching window.");
    openPeriod(db, t.date);
    openPeriod(db, l.date);
    const totals = partialTotals(db);
    return {
      t,
      l,
      transaction_remaining: BigInt(t.amount) - (totals.tx.get(t.id) || 0n),
      line_remaining: BigInt(l.amount) - (totals.line.get(l.id) || 0n),
    };
  };
  app.get("/api/reconciliation/partial-proposals", allow(readers), (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT p.*,u.name AS requester FROM partial_matches p JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC",
        )
        .all()
        .map((p) => ({
          ...p,
          amount: String(p.amount),
          transaction_ids: [p.transaction_id],
          line_ids: [p.line_id],
          mode: "partial",
        })),
    ),
  );
  app.post(
    "/api/reconciliation/partial-proposals",
    allow(financial),
    (req, res) =>
      atomic(db, () => {
        const amount = money(req.body.amount),
          reason = text(req.body.reason, "Partial-match explanation", 500),
          rows = participants(req.body.transaction_id, req.body.line_id);
        if (
          BigInt(amount) > rows.transaction_remaining ||
          BigInt(amount) > rows.line_remaining
        )
          fail("Allocation exceeds a remaining unmatched amount.", 409);
        const pid = id();
        db.prepare(
          "INSERT INTO partial_matches(id,transaction_id,line_id,amount,reason,user_id) VALUES(?,?,?,?,?,?)",
        ).run(pid, rows.t.id, rows.l.id, amount, reason, req.user.id);
        audit(db, req.user.id, "reconciliation.partial_propose", pid, {
          transaction: rows.t.id,
          line: rows.l.id,
          amount: String(amount),
          reason,
        });
        res.status(201).json({ id: pid });
      }),
  );
  app.post(
    "/api/reconciliation/partial-proposals/:id/decide",
    allow(["manager"]),
    (req, res) =>
      atomic(db, () => {
        const p = db
          .prepare(
            "SELECT * FROM partial_matches WHERE id=? AND status='pending'",
          )
          .get(req.params.id);
        if (!p) fail("Pending partial allocation not found.", 409);
        if (p.user_id === req.user.id)
          fail("A different manager must review the partial allocation.", 403);
        const decision = req.body.decision,
          reason = text(req.body.reason, "Decision reason", 500);
        if (!["approved", "rejected"].includes(decision))
          fail("Choose approve or reject.");
        if (decision === "approved") {
          const rows = participants(p.transaction_id, p.line_id);
          if (
            BigInt(p.amount) > rows.transaction_remaining ||
            BigInt(p.amount) > rows.line_remaining
          )
            fail(
              "Remaining evidence changed; allocation must be reviewed again.",
              409,
            );
        }
        db.prepare(
          "UPDATE partial_matches SET status=?,decision_user=?,decision_reason=?,decided_at=CURRENT_TIMESTAMP WHERE id=?",
        ).run(decision, req.user.id, reason, p.id);
        if (decision === "approved") {
          const t = db
              .prepare("SELECT amount FROM transactions WHERE id=?")
              .get(p.transaction_id),
            used = partialTotals(db).tx.get(p.transaction_id) || 0n;
          db.prepare("UPDATE transactions SET reconciliation=? WHERE id=?").run(
            used === BigInt(t.amount) ? "reconciled" : "unmatched",
            p.transaction_id,
          );
        }
        audit(db, req.user.id, "reconciliation.partial_decide", p.id, {
          decision,
          reason,
          amount: String(p.amount),
          rule: "partial-allocation-independent-review-v1",
        });
        res.json({ ok: true });
      }),
  );
  app.post(
    "/api/reconciliation/partial-proposals/:id/undo",
    allow(financial),
    (req, res) =>
      atomic(db, () => {
        const p = db
          .prepare(
            "SELECT * FROM partial_matches WHERE id=? AND status='approved'",
          )
          .get(req.params.id);
        if (!p) fail("Approved partial allocation not found.", 404);
        const t = db
            .prepare("SELECT * FROM transactions WHERE id=?")
            .get(p.transaction_id),
          l = db
            .prepare("SELECT * FROM statement_lines WHERE id=?")
            .get(p.line_id);
        openPeriod(db, t.date);
        openPeriod(db, l.date);
        const reason = text(req.body.reason, "Undo reason", 500);
        db.prepare("UPDATE partial_matches SET status='undone' WHERE id=?").run(
          p.id,
        );
        const used = partialTotals(db).tx.get(t.id) || 0n;
        db.prepare("UPDATE transactions SET reconciliation=? WHERE id=?").run(
          used === BigInt(t.amount) ? "reconciled" : "unmatched",
          t.id,
        );
        audit(db, req.user.id, "reconciliation.partial_undo", p.id, {
          reason,
          amount: String(p.amount),
        });
        res.json({ ok: true });
      }),
  );
}
