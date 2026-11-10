import { useEffect, useState, type ReactNode } from "react";
import {
  ShieldCheck,
  Money,
  ChartBar,
  Bell,
  Calendar,
  ShoppingCart,
} from "@phosphor-icons/react";
import CardTitle from "./CardTitle";
import PasswordInput from "./PasswordInput";
import useUnsavedChanges from "./useUnsavedChanges";
import "./operations-workspace.css";
type Row = Record<string, any>;
type Props = {
  api: (path: string, method?: string, body?: any) => Promise<any>;
  revision: number;
  refresh: (message?: string) => void;
  form: (...args: any[]) => void;
  money: (value?: string | number) => string;
  role: string;
  userId?: string;
  can: (permission: string) => boolean;
  contacts: Row[];
  accounts?: Row[];
  navigate: (page: string) => void;
};
const date = () => new Date().toISOString().slice(0, 10);
const reason = {
  name: "reason",
  label: "Reason / review note",
  type: "textarea",
};
const amount = (name = "amount", label = "Amount (SLE)") => ({
  name,
  label,
  type: "number",
  help: "Use up to two decimal places.",
});
const options = (rows: Row[], key = "id", label = "name") =>
  rows.map((r) => ({ value: String(r[key]), label: String(r[label]) }));
function useLoad(p: Props, path: string) {
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [iteration, setIteration] = useState(0);
  useEffect(() => {
    let live = true;
    let inFlight = false;
    setData(null);
    setError("");
    const load = () => {
      if (inFlight) return;
      inFlight = true;
      p.api(path)
        .then((d) => {
          if (live) {
            setData(d);
            setError("");
          }
        })
        .catch((e) => live && setError(e.message))
        .finally(() => {
          inFlight = false;
        });
    };
    load();
    const timer = setInterval(load, 15000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [p.revision, path, iteration]);
  return {
    data,
    reload: () => setIteration((n) => n + 1),
    state: error ? (
      <p className="error" role="alert">
        {error}{" "}
        <button
          className="button secondary small"
          onClick={() => setIteration((n) => n + 1)}
        >
          Retry
        </button>
      </p>
    ) : !data ? (
      <p className="panel-note" role="status">
        Loading records…
      </p>
    ) : null,
  };
}
function Grid({
  headers,
  children,
  empty,
}: {
  headers: string[];
  children: ReactNode;
  empty: boolean;
}) {
  return empty ? (
    <p className="panel-note">No records to show yet.</p>
  ) : (
    <div
      className="table-scroll operations-table"
      role="region"
      aria-label="Operational records; scroll horizontally to see all columns"
      tabIndex={0}
    >
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                scope="col"
                className={
                  [
                    "Amount",
                    "Budget",
                    "Actual spending",
                    "Remaining",
                    "Outstanding",
                  ].includes(h)
                    ? "money-cell"
                    : undefined
                }
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
const Button = ({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    className="button secondary small"
    type="button"
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </button>
);
export function CashShifts(p: Props) {
  const { data, state } = useLoad(p, "/cash-shifts");
  return (
    <section className="panel operations-panel">
      <div className="panel-header">
        <CardTitle icon={Money}>
          <h2>Cash counts and handover</h2>
          <p>
            Expected cash includes only receipts recorded during your open shift
            in the selected account. Submitted counts are frozen.
          </p>
        </CardTitle>
        {p.can("finance.shift.open") && data && (
          <Button
            onClick={() =>
              p.form(
                "Open cash shift",
                [
                  {
                    name: "account_id",
                    label: "Cash account",
                    type: "select",
                    options: options(data.accounts),
                  },
                  amount("opening", "Opening cash (SLE)"),
                ],
                "/cash-shifts",
                { request_key: crypto.randomUUID() },
              )
            }
          >
            Open shift
          </Button>
        )}
      </div>
      {state}
      {data && (
        <Grid
          headers={[
            "Cashier / account",
            "Opened / closed (UTC)",
            "Expected / counted / difference",
            "Status",
            "Review and actions",
          ]}
          empty={!data.items.length}
        >
          {data.items.map((s: Row) => (
            <tr key={s.id}>
              <td>
                {s.cashier}
                <small>{s.account}</small>
              </td>
              <td>
                {s.opened_at}
                <small>{s.closed_at || "Still open"}</small>
              </td>
              <td className="money">
                SLE {p.money(s.expected)}
                <small>
                  Counted:{" "}
                  {s.counted === null ? "Not submitted" : p.money(s.counted)}
                </small>
                <small>
                  Difference:{" "}
                  {s.difference === null
                    ? "Not submitted"
                    : p.money(s.difference)}
                </small>
              </td>
              <td>
                <span className={`badge ${s.status}`}>{s.status}</span>
              </td>
              <td>
                <div className="operations-actions">
                  {s.status === "open" &&
                    s.user_id === p.userId &&
                    p.can("finance.shift.close") && (
                      <Button
                        onClick={() =>
                          p.form(
                            "Close and submit cash count",
                            [
                              amount("counted", "Actual cash counted (SLE)"),
                              {
                                name: "note",
                                label: "Cash count explanation",
                                type: "textarea",
                              },
                            ],
                            `/cash-shifts/${s.id}/close`,
                            {},
                            "POST",
                            "Check your cash carefully. Submitting freezes this count for independent manager review.",
                          )
                        }
                      >
                        Submit count
                      </Button>
                    )}
                  {s.status === "submitted" &&
                    p.can("finance.shift.review") &&
                    s.user_id !== p.userId && (
                      <Button
                        onClick={() =>
                          p.form(
                            "Review cash shift",
                            [
                              {
                                name: "decision",
                                label: "Decision",
                                type: "select",
                                options: [
                                  { value: "approved", label: "Approve" },
                                  { value: "rejected", label: "Reject" },
                                ],
                              },
                              reason,
                            ],
                            `/cash-shifts/${s.id}/review`,
                          )
                        }
                      >
                        Review count
                      </Button>
                    )}
                  <p>{s.note}</p>
                  {s.reviewer_name && (
                    <small>
                      {s.reviewer_name}: {s.decision_reason}
                    </small>
                  )}
                  {s.entries && (
                    <details>
                      <summary>
                        Receipts in this shift ({s.entries.length})
                      </summary>
                      {s.entries.map((t: Row) => (
                        <p key={t.id}>
                          {t.reference}: {t.direction === "out" ? "−" : "+"} SLE{" "}
                          {p.money(t.amount)}
                        </p>
                      ))}
                    </details>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Grid>
      )}
    </section>
  );
}
export function Budgets(p: Props) {
  const [month, setMonth] = useState(date().slice(0, 7));
  const { data, state } = useLoad(p, `/budgets?month=${month}`);
  return (
    <section className="panel operations-panel">
      <div className="panel-header">
        <CardTitle icon={ChartBar}>
          <h2>Monthly spending plan</h2>
          <p>
            Actuals use accepted cash expenses and their recorded reversals.
            Pending expenses are excluded.
          </p>
        </CardTitle>
        <label>
          Month
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </label>
        {p.can("finance.budget.manage") && data && (
          <Button
            onClick={() =>
              p.form(
                "Set category budget",
                [
                  {
                    name: "month",
                    label: "Budget month (YYYY-MM)",
                    value: month,
                  },
                  {
                    name: "category",
                    label: "Expense category",
                    type: "select",
                    options: options(data.categories, "name", "name"),
                  },
                  amount(),
                  reason,
                ],
                "/budgets",
              )
            }
          >
            Set budget
          </Button>
        )}
      </div>
      {state}
      {data && (
        <Grid
          headers={[
            "Category",
            "Budget",
            "Actual spending",
            "Remaining",
            "Status",
          ]}
          empty={!data.items.length}
        >
          {data.items.map((b: Row) => (
            <tr key={b.id}>
              <td>{b.category}</td>
              <td className="money">SLE {p.money(b.amount)}</td>
              <td className="money">SLE {p.money(b.actual)}</td>
              <td className="money">SLE {p.money(b.remaining)}</td>
              <td>
                {b.overspent ? (
                  <span className="badge rejected">Over budget</span>
                ) : (
                  <span className="badge approved">Within budget</span>
                )}
              </td>
            </tr>
          ))}
        </Grid>
      )}
    </section>
  );
}
export function Followups(p: Props) {
  const { data, state } = useLoad(p, "/followups");
  const [kind, setKind] = useState("all"),
    [bucket, setBucket] = useState("all");
  const rows = (data?.items || []).filter(
    (d: Row) =>
      (kind === "all" || d.kind === kind) &&
      (bucket === "all" || d.bucket === bucket),
  );
  return (
    <section className="panel operations-panel">
      <div className="panel-header">
        <CardTitle icon={Bell}>
          <h2>Collections and upcoming payables</h2>
          <p>
            Assign follow-ups and retain promised payment dates without changing
            document balances.
          </p>
        </CardTitle>
      </div>
      <div className="operations-filters">
        <label>
          Documents
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">Customers and suppliers</option>
            <option value="customer">Customer invoices</option>
            <option value="supplier">Supplier bills</option>
          </select>
        </label>
        <label>
          Age
          <select value={bucket} onChange={(e) => setBucket(e.target.value)}>
            {[
              "all",
              "Current",
              "1–30 days",
              "31–60 days",
              "61–90 days",
              "Over 90 days",
            ].map((b) => (
              <option key={b} value={b}>
                {b === "all" ? "All ages" : b}
              </option>
            ))}
          </select>
        </label>
      </div>
      {state}
      {data && (
        <Grid
          headers={[
            "Document / contact",
            "Due / age",
            "Outstanding",
            "Follow-up history",
            "Action",
          ]}
          empty={!rows.length}
        >
          {rows.map((d: Row) => (
            <tr key={d.kind + d.id}>
              <td>
                {d.number}
                <small>
                  {d.kind} · {d.contact_name}
                </small>
              </td>
              <td>
                <time dateTime={d.due} className="nowrap">
                  {d.due}
                </time>
                <small>{d.bucket}</small>
              </td>
              <td className="money">SLE {p.money(d.outstanding)}</td>
              <td>
                {d.followups.length ? (
                  <details>
                    <summary>
                      {d.followups[0].owner} · {d.followups[0].promised_date}
                    </summary>
                    {d.followups.map((f: Row) => (
                      <p key={f.id}>
                        {f.promised_date} · {f.owner}: {f.note}
                      </p>
                    ))}
                  </details>
                ) : (
                  "Unassigned"
                )}
              </td>
              <td>
                {p.can("finance.followup.manage") && (
                  <Button
                    onClick={() =>
                      p.form(
                        "Record payment follow-up",
                        [
                          {
                            name: "owner_id",
                            label: "Responsible staff member",
                            type: "select",
                            options: options(data.owners),
                          },
                          {
                            name: "promised_date",
                            label: "Promised payment / follow-up date",
                            type: "date",
                            value: date(),
                          },
                          {
                            name: "note",
                            label: "Contact outcome and next action",
                            type: "textarea",
                          },
                        ],
                        "/followups",
                        { kind: d.kind, document_id: d.id },
                      )
                    }
                  >
                    Record follow-up
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </Grid>
      )}
    </section>
  );
}
export function RecurringDrafts(p: Props) {
  const { data, state } = useLoad(p, "/recurring");
  const manage = p.can("finance.recurring.manage");
  const create = (kind: string) =>
    p.form(
      `New recurring ${kind}`,
      [
        { name: "name", label: "Schedule name" },
        {
          name: "contact_id",
          label: kind === "invoice" ? "Customer" : "Supplier",
          type: "select",
          options: options(
            p.contacts.filter(
              (c) =>
                c.type === (kind === "invoice" ? "customer" : "supplier") &&
                c.active !== 0,
            ),
          ),
        },
        amount(),
        ...(kind === "expense"
          ? [{ name: "category", label: "Expense category" }]
          : []),
        { name: "description", label: "Description", type: "textarea" },
        {
          name: "next_date",
          label: "First occurrence",
          type: "date",
          value: date(),
        },
        {
          name: "interval_months",
          label: "Repeat every (months, 1–12)",
          type: "number",
          value: "1",
        },
        {
          name: "due_days",
          label: "Days until due (0–365)",
          type: "number",
          value: "30",
        },
      ],
      "/recurring",
      { kind },
    );
  return (
    <div className="operations-stack">
      <section className="panel operations-panel">
        <div className="panel-header">
          <CardTitle icon={Calendar}>
            <h2>Recurring schedules</h2>
            <p>
              Due occurrences are prepared automatically while the server runs.
              Nothing posts automatically: invoices remain drafts and expenses
              await independent approval.
            </p>
          </CardTitle>
          {manage && (
            <div className="operations-actions">
              <Button onClick={() => create("invoice")}>
                New invoice schedule
              </Button>
              <Button onClick={() => create("expense")}>
                New expense schedule
              </Button>
            </div>
          )}
        </div>
        {state}
        {data && (
          <Grid
            headers={["Schedule", "Contact / amount", "Next date", "Actions"]}
            empty={!data.templates.length}
          >
            {data.templates.map((t: Row) => (
              <tr key={t.id}>
                <td>
                  {t.name}
                  <small>
                    {t.kind} · Every {t.interval_months} month(s) ·{" "}
                    {t.active ? "Active" : "Paused"}
                  </small>
                </td>
                <td>
                  {t.contact_name}
                  <small>SLE {p.money(t.amount)}</small>
                </td>
                <td>{t.next_date}</td>
                <td>
                  {manage && (
                    <div className="operations-actions">
                      <Button
                        disabled={!t.active || t.next_date > date()}
                        onClick={() =>
                          p.form(
                            "Prepare recurring draft",
                            [reason],
                            `/recurring/${t.id}/prepare`,
                            { occurrence: t.next_date },
                          )
                        }
                      >
                        Prepare due draft
                      </Button>
                      <Button
                        onClick={() =>
                          p.form(
                            t.active ? "Pause schedule" : "Resume schedule",
                            [reason],
                            `/recurring/${t.id}/toggle`,
                            { active: !t.active },
                          )
                        }
                      >
                        {t.active ? "Pause" : "Resume"}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Grid>
        )}
      </section>
      <section className="panel operations-panel">
        <h2>Draft review queue</h2>
        {data && (
          <Grid
            headers={["Schedule / date", "Details", "Status", "Actions"]}
            empty={!data.drafts.length}
          >
            {data.drafts.map((d: Row) => (
              <tr key={d.id}>
                <td>
                  {d.name}
                  <small>
                    {d.occurrence} · {d.kind}
                  </small>
                </td>
                <td>
                  {d.payload.description}
                  <small>SLE {d.payload.amount}</small>
                </td>
                <td>{d.status}</td>
                <td>
                  {manage && d.status === "draft" && (
                    <div className="operations-actions">
                      <Button
                        onClick={() =>
                          p.form(
                            d.kind === "invoice"
                              ? "Create draft invoice"
                              : "Submit expense for approval",
                            [
                              {
                                name: "reference",
                                label:
                                  d.kind === "invoice"
                                    ? "Invoice number"
                                    : "Expense reference",
                              },
                              ...(d.kind === "expense"
                                ? [
                                    {
                                      name: "account_id",
                                      label: "Payment account",
                                      type: "select",
                                      options: options(
                                        (p.accounts || []).filter(
                                          (a) => a.active !== 0,
                                        ),
                                      ),
                                    },
                                  ]
                                : []),
                              reason,
                            ],
                            `/recurring/drafts/${d.id}/publish`,
                          )
                        }
                      >
                        Review and submit
                      </Button>
                      <Button
                        onClick={() =>
                          p.form(
                            "Dismiss recurring draft",
                            [reason],
                            `/recurring/drafts/${d.id}/dismiss`,
                          )
                        }
                      >
                        Dismiss draft
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Grid>
        )}
      </section>
    </div>
  );
}
export function Purchases(p: Props) {
  const { data, state } = useLoad(p, "/purchases");
  return (
    <section className="panel operations-panel">
      <div className="panel-header">
        <CardTitle icon={ShoppingCart}>
          <h2>Purchase requests and orders</h2>
          <p>
            Independent approval precedes the purchase order. Linking a bill
            does not create or approve a payment.
          </p>
        </CardTitle>
        {p.can("finance.purchase.create") && (
          <Button
            onClick={() =>
              p.form(
                "Request a purchase",
                [
                  { name: "number", label: "Request reference" },
                  {
                    name: "contact_id",
                    label: "Supplier",
                    type: "select",
                    options: options(
                      p.contacts.filter(
                        (c) => c.type === "supplier" && c.active !== 0,
                      ),
                    ),
                  },
                  {
                    name: "description",
                    label: "Purchase purpose",
                    type: "textarea",
                  },
                  amount(),
                ],
                "/purchases",
              )
            }
          >
            Request purchase
          </Button>
        )}
      </div>
      {state}
      {data && (
        <Grid
          headers={[
            "Request / purpose",
            "Supplier / amount",
            "Status / decision",
            "Order / bill",
            "Actions",
          ]}
          empty={!data.items.length}
        >
          {data.items.map((r: Row) => (
            <tr key={r.id}>
              <td>
                {r.number}
                <small>{r.description}</small>
                <small>Requested by {r.requester}</small>
              </td>
              <td>
                {r.supplier}
                <small>SLE {p.money(r.amount)}</small>
              </td>
              <td>
                <span className={`badge ${r.status}`}>{r.status}</span>
                {r.reviewer_name && (
                  <small>
                    {r.reviewer_name}: {r.reason}
                  </small>
                )}
              </td>
              <td>
                {r.order_number || "No order"}
                <small>{r.bill_number || "No linked bill"}</small>
                {r.bill_id && (
                  <Button onClick={() => p.navigate("Supplier bills")}>
                    View bill and payments
                  </Button>
                )}
              </td>
              <td>
                <div className="operations-actions">
                  {r.status === "pending" &&
                    p.can("finance.purchase.approve") &&
                    r.user_id !== p.userId && (
                      <Button
                        onClick={() =>
                          p.form(
                            "Review purchase request",
                            [
                              {
                                name: "decision",
                                label: "Decision",
                                type: "select",
                                options: [
                                  { value: "approved", label: "Approve" },
                                  { value: "rejected", label: "Reject" },
                                ],
                              },
                              reason,
                            ],
                            `/purchases/${r.id}/decide`,
                          )
                        }
                      >
                        Review request
                      </Button>
                    )}
                  {r.status === "approved" &&
                    !r.order_id &&
                    p.can("finance.purchase.order") && (
                      <Button
                        onClick={() =>
                          p.form(
                            "Create purchase order",
                            [
                              {
                                name: "number",
                                label: "Purchase order number",
                              },
                            ],
                            `/purchases/${r.id}/order`,
                          )
                        }
                      >
                        Create order
                      </Button>
                    )}
                  {r.order_id &&
                    !r.bill_id &&
                    p.can("finance.purchase.link") && (
                      <Button
                        onClick={() =>
                          p.form(
                            "Link supplier bill",
                            [
                              {
                                name: "bill_id",
                                label: "Supplier bill",
                                type: "select",
                                options: data.bills
                                  .filter(
                                    (b: Row) =>
                                      b.contact_id === r.contact_id &&
                                      b.lifecycle === "issued",
                                  )
                                  .map((b: Row) => ({
                                    value: b.id,
                                    label: `${b.number} · SLE ${p.money(b.amount)}`,
                                  })),
                              },
                              reason,
                            ],
                            `/purchases/${r.id}/link-bill`,
                          )
                        }
                      >
                        Link bill
                      </Button>
                    )}
                </div>
              </td>
            </tr>
          ))}
        </Grid>
      )}
    </section>
  );
}
export function Reminders(p: Props) {
  const { data, state } = useLoad(p, "/reminders");
  return (
    <section className="panel operations-panel">
      <div className="panel-header">
        <CardTitle icon={Bell}>
          <h2>Your action queue</h2>
          <p>
            Live reminders respect your permissions. Snoozing changes your queue
            only and does not resolve the underlying work.
          </p>
        </CardTitle>
      </div>
      {state}
      {data && (
        <Grid
          headers={["Action needed", "Details", "Actions"]}
          empty={!data.items.length}
        >
          {data.items.map((r: Row) => (
            <tr key={r.id}>
              <td>{r.title}</td>
              <td>{r.detail}</td>
              <td>
                <div className="operations-actions">
                  <Button onClick={() => p.navigate(r.page)}>
                    Open {r.page}
                  </Button>
                  {p.can("reminders.update") && (
                    <Button
                      onClick={() =>
                        p.form(
                          "Snooze reminder",
                          [
                            {
                              name: "snoozed_until",
                              label: "Remind me on",
                              type: "date",
                            },
                          ],
                          "/reminders/state",
                          { id: r.id, completed: false },
                        )
                      }
                    >
                      Snooze
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Grid>
      )}
    </section>
  );
}
export function SecureBackups(p: Props) {
  const { data, state } = useLoad(p, "/secure-backups");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="panel operations-panel">
      <div className="panel-header">
        <CardTitle icon={ShieldCheck}>
          <h2>Automatic encrypted backups</h2>
          <p>
            Each backup is decrypted and integrity-checked before it is marked
            verified. Retention applies only to these encrypted snapshots.
          </p>
        </CardTitle>
      </div>
      {state}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {data && (
        <>
          <p>
            {data.configured
              ? "Server encryption key is configured."
              : "The server operator must configure the encryption key before enabling this service."}
          </p>
          <p>
            Schedule:{" "}
            {data.policy.enabled
              ? `Every ${data.policy.interval_hours} hours`
              : "Disabled"}{" "}
            · Retain {data.policy.retention_count} verified backups.
          </p>
          <div className="operations-actions">
            <Button
              onClick={() =>
                p.form(
                  "Configure backup schedule",
                  [
                    {
                      name: "enabled",
                      label: "Automatic backups",
                      type: "select",
                      value: String(Boolean(data.policy.enabled)),
                      options: [
                        { value: "true", label: "Enabled" },
                        { value: "false", label: "Disabled" },
                      ],
                    },
                    {
                      name: "interval_hours",
                      label: "Backup interval (hours, 1–168)",
                      type: "number",
                      value: String(data.policy.interval_hours),
                    },
                    {
                      name: "retention_count",
                      label: "Verified backups to retain (2–90)",
                      type: "number",
                      value: String(data.policy.retention_count),
                    },
                    reason,
                  ],
                  "/secure-backups/policy",
                  {},
                )
              }
            >
              Configure schedule
            </Button>
            <Button
              disabled={busy || !data.configured}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await p.api("/secure-backups/run", "POST", {});
                  p.refresh("Encrypted backup verified");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Creating and verifying…" : "Create encrypted backup now"}
            </Button>
          </div>
          <Grid
            headers={["Started (UTC)", "Result", "Details", "Download"]}
            empty={!data.runs.length}
          >
            {data.runs.map((r: Row) => (
              <tr key={r.id}>
                <td>{r.started_at}</td>
                <td>
                  <span className={`badge ${r.status}`}>{r.status}</span>
                </td>
                <td>
                  {r.error || r.completed_at || "In progress"}
                  {r.sha256 && (
                    <details>
                      <summary>Verification hash</summary>
                      <code>{r.sha256}</code>
                    </details>
                  )}
                </td>
                <td>
                  {r.status === "verified" && r.filename ? (
                    <a
                      className="button secondary small"
                      href={`/api/secure-backups/${r.id}/download`}
                    >
                      Download encrypted file
                    </a>
                  ) : r.status === "verified" ? (
                    "Expired by retention"
                  ) : (
                    "Not available"
                  )}
                </td>
              </tr>
            ))}
          </Grid>
          <p className="panel-note">
            Keep the encryption key separately from backup storage. Encrypted
            recovery uses the operator restore command documented in Operations.
          </p>
        </>
      )}
    </section>
  );
}
export function Security(p: Props) {
  const { data, state, reload } = useLoad(p, "/mfa"),
    [setup, setSetup] = useState<Row | null>(null),
    [codes, setCodes] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useUnsavedChanges(!!setup || codes.length > 0);
  const submit = async (
    e: React.FormEvent<HTMLFormElement>,
    path: string,
    after?: (r: Row) => void,
  ) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    try {
      const result = await p.api(path, "POST", body);
      form.reset();
      after?.(result);
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel operations-panel security-controls">
      <div className="panel-header">
        <CardTitle icon={ShieldCheck}>
          <h2>Authenticator protection</h2>
          <p>
            Add a six-digit authenticator code to sign-in. Save recovery codes
            somewhere safe before leaving this page.
          </p>
        </CardTitle>
      </div>
      {state}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {data && (
        <>
          <p>
            MFA: <strong>{data.enabled ? "Enabled" : "Not enabled"}</strong>
            {data.enabled &&
              ` · ${data.remaining_recovery} recovery codes remaining`}
          </p>
          {!data.configured && (
            <p className="panel-note">
              Your server operator must configure the encryption key before
              authenticator setup is available.
            </p>
          )}
          {!data.enabled && !setup && p.can("security.mfa.manage") && (
            <form
              className="finbiz-form"
              onSubmit={(e) => submit(e, "/mfa/setup", (r) => setSetup(r))}
            >
              <label>
                Current password
                <PasswordInput
                  name="current_password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <button className="button" disabled={busy || !data.configured}>
                Start authenticator setup
              </button>
            </form>
          )}
          {setup && !data.enabled && (
            <div>
              <p>
                In your authenticator app, add a time-based account with this
                setup key:
              </p>
              <code className="security-secret">{setup.secret}</code>
              <p>
                This key is shown only during setup. Never send it to another
                person.
              </p>
              <form
                className="finbiz-form"
                onSubmit={(e) =>
                  submit(e, "/mfa/enable", (r) => {
                    setSetup(null);
                    setCodes(r.recovery_codes);
                  })
                }
              >
                <label>
                  Current six-digit code
                  <input
                    name="code"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                  />
                </label>
                <button className="button" disabled={busy}>
                  Verify and enable MFA
                </button>
              </form>
            </div>
          )}
          {!!codes.length && (
            <div className="security-recovery" role="status">
              <h3>Save these one-use recovery codes</h3>
              <p>
                They will not be shown again. You still need your password when
                using a recovery code.
              </p>
              <ul>
                {codes.map((c) => (
                  <li key={c}>
                    <code>{c}</code>
                  </li>
                ))}
              </ul>
              <Button onClick={() => setCodes([])}>
                I have saved my codes
              </Button>
            </div>
          )}
          {data.enabled && p.can("security.mfa.manage") && (
            <details>
              <summary>Disable authenticator protection</summary>
              <form
                className="finbiz-form"
                onSubmit={(e) =>
                  submit(e, "/mfa/disable", () => {
                    setCodes([]);
                    setSetup(null);
                  })
                }
              >
                <label>
                  Current password
                  <PasswordInput
                    name="current_password"
                    autoComplete="current-password"
                    required
                  />
                </label>
                <label>
                  Unused authenticator or recovery code
                  <input
                    name="code"
                    autoComplete="one-time-code"
                    required
                    maxLength={30}
                  />
                </label>
                <button className="button secondary" disabled={busy}>
                  Verify and disable MFA
                </button>
              </form>
            </details>
          )}
        </>
      )}
    </section>
  );
}
