export function businessDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Freetown",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function approvalHistory(db, req) {
  const scoped = new Set(req.rows.map((r) => r.id));
  let rows = db
    .prepare(
      `SELECT a.id,'payment' AS kind,a.transaction_id AS reference,a.decision AS status,a.reason,a.created_at AS decided_at,u.name AS reviewer,t.user_id AS requester_id,t.date,t.account_id,t.description,t.amount FROM approvals a JOIN transactions t ON t.id=a.transaction_id JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC`,
    )
    .all()
    .filter((r) => scoped.has(r.reference));
  if (req.user.role !== "admin") {
    for (const [table, kind] of [
      ["control_requests", "control"],
      ["reconciliation_proposals", "reconciliation"],
      ["partial_matches", "partial_match"],
    ]) {
      const entries = db
        .prepare(
          `SELECT c.*,u.name AS reviewer FROM ${table} c LEFT JOIN users u ON u.id=c.decision_user WHERE c.status IN ('approved','rejected','undone') ORDER BY c.decided_at DESC`,
        )
        .all();
      for (const r of entries) {
        const payload = r.payload ? JSON.parse(r.payload) : {};
        const ids = r.transaction_ids
          ? JSON.parse(r.transaction_ids)
          : [r.transaction_id || payload.transaction_id].filter(Boolean);
        const date = payload.date || r.created_at.slice(0, 10);
        if (
          req.query.account &&
          !(
            payload.account_id === req.query.account ||
            ids.some((id) => scoped.has(id))
          )
        )
          continue;
        if (
          (req.query.from && date < req.query.from) ||
          (req.query.to && date > req.query.to)
        )
          continue;
        rows.push({
          id: r.id,
          kind: r.kind || kind,
          reference: r.result_id || r.id,
          status: r.status,
          reason: r.decision_reason,
          decided_at: r.decided_at,
          reviewer: r.reviewer,
          requester_id: r.user_id,
          date,
          description: r.reason,
          amount: r.amount === undefined ? null : String(r.amount),
        });
      }
    }
  }
  return rows
    .filter(
      (r) =>
        (!req.query.status || r.status === req.query.status) &&
        (!req.query.kind || r.kind === req.query.kind),
    )
    .sort((a, b) => String(b.decided_at).localeCompare(String(a.decided_at)))
    .map((r) => ({
      ...r,
      amount: r.amount === null ? null : String(r.amount),
    }));
}
