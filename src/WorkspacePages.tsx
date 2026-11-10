import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ShieldCheck,
  Pulse as Activity,
  Bell,
  FileText,
  Printer,
  Users,
} from "@phosphor-icons/react";
import CardTitle from "./CardTitle";
import useUnsavedChanges from "./useUnsavedChanges";
import "./workspace-pages.css";

type Row = Record<string, any>;
type Props = {
  role: string;
  api: (path: string, method?: string, body?: unknown) => Promise<any>;
  revision: number;
  refresh: (message?: string) => void;
  form: (...args: any[]) => void;
  money: (value?: string | number) => string;
  navigate: (page: string) => void;
  grants: Row[];
  contacts: Row[];
  params: string;
};
const date = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Freetown",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const label = (value: string) =>
  value.replaceAll("_", " ").replaceAll(".", " / ");
function useData(props: Props, path: string) {
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setData(null);
    setError("");
    props
      .api(path)
      .then((r) => live && setData(r))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [props.revision, path]);
  return {
    data,
    state: error ? (
      <div className="error" role="alert">
        {error}
        <button type="button" onClick={() => props.refresh()}>
          Retry
        </button>
      </div>
    ) : !data ? (
      <p role="status" className="panel-note">
        Loading workspace records…
      </p>
    ) : null,
  };
}
export function Table({
  rows,
  headings,
  render,
  title,
}: {
  rows: Row[];
  headings: string[];
  render: (row: Row) => ReactNode;
  title: string;
}) {
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(1);
  const filtered = rows.filter((r) =>
    Object.values(r).some(
      (v) =>
        typeof v !== "object" &&
        String(v ?? "")
          .toLowerCase()
          .includes(query.toLowerCase()),
    ),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 15)),
    active = Math.min(page, pages);
  return (
    <>
      <label className="workspace-table-search">
        Search {title.toLowerCase()}
        <input
          className="input"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
      </label>
      <div
        className="table-scroll"
        role="region"
        aria-label={`${title}. Scroll horizontally to see all columns.`}
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              {headings.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice((active - 1) * 15, active * 15).map(render)}
          </tbody>
        </table>
      </div>
      {!filtered.length && <p className="panel-note">No matching records.</p>}
      <div className="pagination">
        <span>
          {filtered.length} records · Page {active} of {pages}
        </span>
        <button
          className="button secondary small"
          disabled={active <= 1}
          onClick={() => setPage(active - 1)}
        >
          Previous
        </button>
        <button
          className="button secondary small"
          disabled={active >= pages}
          onClick={() => setPage(active + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}

function RoleEditor({ data, ...props }: Props & { data: Row }) {
  const [editing, setEditing] = useState(""),
    [base, setBase] = useState("finance"),
    [name, setName] = useState(""),
    [reason, setReason] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
  const template = data.templates.find((t: Row) => t.id === base);
  const choose = (id: string) => {
    if (dirty && !window.confirm("Discard the unsaved role changes?")) return;
    const role = data.roles.find((r: Row) => r.id === id);
    setEditing(id);
    setBase(role?.base_role || "finance");
    setName(role?.name || "");
    setSelected(role?.permissions || []);
    setDirty(false);
    setReason("");
    setError("");
  };
  return (
    <form
      className="finbiz-form access-role-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
          await props.api(
            editing ? `/admin/access/roles/${editing}` : "/admin/access/roles",
            editing ? "PATCH" : "POST",
            { name, base_role: base, permissions: selected, reason },
          );
          setDirty(false);
          setReason("");
          props.refresh("Role saved. Affected sessions have been revoked.");
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{editing ? "Edit restricted role" : "Create a restricted role"}</h3>
      <p className="field-help">
        Read access follows the responsibility class. Select operational actions
        below. Organisation policies, record scope and independent approval
        checks always apply. Administrator roles are fixed.
      </p>
      <div className="form-grid">
        <label>
          Role to edit
          <select
            className="input"
            value={editing}
            onChange={(e) => choose(e.target.value)}
          >
            <option value="">New role</option>
            {data.roles.map((r: Row) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Responsibility class
          <select
            className="input"
            value={base}
            disabled={!!editing}
            onChange={(e) => {
              setBase(e.target.value);
              setSelected([]);
              setDirty(true);
            }}
          >
            {data.templates
              .filter((t: Row) => t.id !== "admin")
              .map((t: Row) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Role name
          <input
            className="input"
            required
            maxLength={80}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
          />
        </label>
        <label>
          Reason for change
          <input
            className="input"
            required
            maxLength={500}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setDirty(true);
            }}
          />
        </label>
      </div>
      <fieldset className="permission-grid">
        <legend>Module · action · scope</legend>
        {template.grants.map((g: Row) => {
          const fixed =
            g.action === "view" ||
            ["workspace", "profile", "notifications"].includes(g.module);
          return (
            <label className="policy-choice" key={g.id}>
              <input
                type="checkbox"
                disabled={fixed || busy}
                checked={fixed || selected.includes(g.id)}
                onChange={(e) => {
                  setSelected(
                    e.target.checked
                      ? [...selected, g.id]
                      : selected.filter((id) => id !== g.id),
                  );
                  setDirty(true);
                }}
              />
              <span>
                <strong>{g.module}</strong>
                <small>
                  {g.action} · {g.scope}
                  {fixed ? " · inherited" : ""}
                      {g.condition ? ` · ${g.condition}` : ""}
                </small>
              </span>
            </label>
          );
        })}
      </fieldset>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={busy || !dirty}>
        {busy ? "Saving…" : "Save role"}
      </button>
    </form>
  );
}
function RoleAssignment({
  staff,
  roles,
  ...props
}: Props & { staff: Row; roles: Row[] }) {
  const [value, setValue] = useState(staff.access_role_id || ""),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="access-assignment"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
          await props.api("/admin/access/assign", "POST", {
            user_id: staff.id,
            access_role_id: value || null,
            reason,
          });
          props.refresh(
            "Staff role assigned; sessions and delegation revoked.",
          );
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Role for {staff.name}
        <select
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        >
          <option value="">Standard {staff.role}</option>
          {roles
            .filter((r) => r.base_role === staff.role)
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Assignment reason
        <input
          className="input"
          required
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <button
        className="button secondary small"
        disabled={busy || value === (staff.access_role_id || "")}
      >
        {busy ? "Saving…" : "Assign role"}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </form>
  );
}
export function AccessManagement(props: Props) {
  const { data, state } = useData(props, "/admin/access");
  return (
    <section className="panel">
      <div className="panel-header">
        <CardTitle icon={ShieldCheck}>
          <h2>Roles and permissions</h2>
          <p>User → role → module, action and scope.</p>
        </CardTitle>
      </div>
      {state}
      {data && (
        <>
          <details className="workspace-details">
            <summary>Review built-in permission matrix</summary>
            {data.templates.map((t: Row) => (
              <details key={t.id}>
                <summary>
                  {t.name} · {t.grants.length} grants
                </summary>
                <ul className="permission-catalog">
                  {t.grants.map((g: Row) => (
                    <li key={g.id}>
                      <code>{g.id}</code>
                      <span>{g.scope}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </details>
          <RoleEditor {...props} data={data} />
          <Table
            title="Staff role assignments"
            rows={data.assignments}
            headings={["Staff", "Responsibility", "Role assignment"]}
            render={(staff) => (
              <tr key={staff.id}>
                <td>
                  {staff.name}
                  <small>{staff.active ? "Active" : "Inactive"}</small>
                </td>
                <td>{staff.role}</td>
                <td>
                  {staff.role === "admin" ? (
                    "Fixed system role"
                  ) : (
                    <RoleAssignment
                      {...props}
                      key={`${staff.id}-${staff.access_role_id || "standard"}`}
                      staff={staff}
                      roles={data.roles}
                    />
                  )}
                </td>
              </tr>
            )}
          />
        </>
      )}
    </section>
  );
}
export function ActiveSessions(props: Props) {
  const { data, state } = useData(props, "/admin/sessions");
  return (
    <section className="panel">
      <div className="panel-header">
        <CardTitle icon={Activity}>
          <h2>Active staff sessions</h2>
          <p>
            Revocation takes effect on the next API request. Session credentials
            are never displayed.
          </p>
        </CardTitle>
      </div>
      {state}
      {data && (
        <Table
          title="Active sessions"
          rows={data.items}
          headings={["Staff", "Role", "Expires", "Action"]}
          render={(s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.role}</td>
              <td>
                {new Date(s.expires).toLocaleString("en-GB", {
                  timeZone: "Africa/Freetown",
                })}{" "}
                GMT
              </td>
              <td>
                {s.current ? (
                  "Current session"
                ) : (
                  <button
                    className="button secondary small"
                    onClick={() =>
                      props.form(
                        "Revoke staff session",
                        [{ name: "reason", label: "Reason for revocation" }],
                        `/admin/sessions/${s.id}/revoke`,
                      )
                    }
                  >
                    Revoke session
                  </button>
                )}
              </td>
            </tr>
          )}
        />
      )}
    </section>
  );
}
export function SystemMaintenance(props: Props) {
  const { data, state } = useData(props, "/admin/maintenance");
  return (
    <section className="panel">
      <div className="panel-header">
        <CardTitle icon={Activity}>
          <h2>Database and system maintenance</h2>
          <p>Configuration, integrity and recorded backup activity.</p>
        </CardTitle>
        <a className="button secondary" href="/api/backup">
          Download new backup
        </a>
      </div>
      {state}
      {data && (
        <>
          <dl className="settings-grid">
            <div>
              <dt>Database check</dt>
              <dd>{data.database}</dd>
            </div>
            <div>
              <dt>Schema</dt>
              <dd>Version {data.schema_version}</dd>
            </div>
            <div>
              <dt>Currency / region</dt>
              <dd>
                {data.organisation.currency} / {data.organisation.timezone}
              </dd>
            </div>
            <div>
              <dt>Last successful snapshot</dt>
              <dd>
                {data.last_successful_backup
                  ? `${data.last_successful_backup} UTC`
                  : "No verified snapshot recorded"}
              </dd>
            </div>
          </dl>
          <div className="workspace-details">
            <h3>Restore a backup</h3>
            <p>{data.restore.description}</p>
            <code className="restore-command">{data.restore.command}</code>
            <p className="field-help">
              Operator workflow. The running database cannot be replaced from
              this page. Backup history records snapshot creation and download
              attempts; it cannot verify that a downloaded copy has been
              retained.
            </p>
          </div>
          <Table
            title="Backup history"
            rows={data.backups}
            headings={["Event", "Time (UTC)"]}
            render={(b) => (
              <tr key={b.id}>
                <td>{label(b.action)}</td>
                <td>{b.created_at}</td>
              </tr>
            )}
          />
        </>
      )}
    </section>
  );
}
export function NotificationCentre(props: Props) {
  const { data, state } = useData(props, "/notifications");
  return (
    <section className="panel">
      <div className="panel-header">
        <CardTitle icon={Bell}>
          <h2>Notification centre</h2>
          <p>
            Recent saved events and pending work in your permitted workspace.
          </p>
        </CardTitle>
      </div>
      {state}
      {data && (
        <Table
          title="Notifications"
          rows={data.items}
          headings={["Activity", "Details", "Time (UTC)", "Open"]}
          render={(n) => (
            <tr key={n.id}>
              <td>{label(n.title)}</td>
              <td>{n.detail}</td>
              <td>{n.created_at || "Current queue"}</td>
              <td>
                <button
                  className="button secondary small"
                  onClick={() => props.navigate(n.page)}
                >
                  Open {n.page}
                </button>
              </td>
            </tr>
          )}
        />
      )}
    </section>
  );
}
export function StaffOverview(props: Props) {
  const { data, state } = useData(props, "/staff-overview");
  return (
    <section className="panel">
      <div className="panel-header">
        <CardTitle icon={Users}>
          <h2>Staff overview</h2>
          <p>
            Read-only staff directory. Access changes remain with system
            administrators.
          </p>
        </CardTitle>
      </div>
      {state}
      {data && (
        <Table
          title="Staff"
          rows={data.items}
          headings={["Name", "Responsibility", "Status"]}
          render={(u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.role}</td>
              <td>{u.active ? "Active" : "Inactive"}</td>
            </tr>
          )}
        />
      )}
    </section>
  );
}
export function ReceiptWorkspace(props: Props) {
  const { data, state } = useData(props, `/receipts?${props.params}`),
    [receiptId, setReceiptId] = useState(""),
    [error, setError] = useState("");
  const receipt = data?.items.find((r: Row) => r.id === receiptId);
  const allowed = (id: string) => props.grants.some((g) => g.id === id);
  return (
    <section className="panel">
      <div className="panel-header">
        <CardTitle icon={FileText}>
          <h2>My receipt history</h2>
          <p>Your posted receipts, original details and correction requests.</p>
        </CardTitle>
      </div>
      {state}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {data && (
        <>
          <Table
            title="Receipts"
            rows={data.items}
            headings={[
              "Date",
              "Reference",
              "Channel",
              "Amount (SLE)",
              "Status",
              "Actions",
            ]}
            render={(r) => (
              <tr key={r.id}>
                <td>{r.date}</td>
                <td>
                  {r.reference}
                  <small>{r.description}</small>
                </td>
                <td>{r.channel}</td>
                <td>{props.money(r.amount)}</td>
                <td>{r.reversed ? "Reversed" : r.approval}</td>
                <td>
                  <div className="enhancement-actions">
                    <button
                      className="button secondary small"
                      onClick={() => setReceiptId(r.id)}
                    >
                      View receipt
                    </button>
                    {!r.reversed &&
                      allowed("sales.receipt.request_reversal") && (
                        <button
                          className="button secondary small"
                          onClick={() =>
                            props.form(
                              "Request receipt reversal",
                              [
                                {
                                  name: "date",
                                  label: "Reversal date",
                                  type: "date",
                                  value: date(),
                                },
                                {
                                  name: "reason",
                                  label: "Reason for reversal",
                                },
                              ],
                              `/receipts/${r.id}/reversal-request`,
                            )
                          }
                        >
                          Request reversal
                        </button>
                      )}
                  </div>
                </td>
              </tr>
            )}
          />
          {receipt && (
            <section className="receipt-preview">
              <ReceiptContent receipt={receipt} organisation={data.organisation.name} money={props.money} />
              {createPortal(<div className="receipt-print-document"><ReceiptContent receipt={receipt} organisation={data.organisation.name} money={props.money} /></div>, document.body)}
              {allowed("sales.receipt.print") && (
                <button
                  className="button secondary"
                  onClick={async () => {
                    setError("");
                    try {
                      await props.api(`/receipts/${receipt.id}/print`, "POST");
                      window.print();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <Printer size={17} aria-hidden="true" focusable="false" />
                  Print / reprint receipt
                </button>
              )}
            </section>
          )}
          <p className="panel-note">
            Posted sales cannot be edited. Submit a reversal request for
            independent manager review. A separate editable pending-sale
            workflow is in development.
          </p>
        </>
      )}
    </section>
  );
}
function ReceiptContent({ receipt, organisation, money }: { receipt: Row; organisation: string; money: Props["money"] }) {
  return <div className="receipt-print"><h2>{organisation}</h2><h3>{receipt.reversed ? "Reversed receipt — original copy" : "Payment receipt"}</h3><dl className="settings-grid">{[
    ["Receipt identifier", receipt.id], ["Date", receipt.date], ["Reference", receipt.reference],
    ["Description", receipt.description], ["Payment channel", receipt.channel],
    ["Amount received", `SLE ${money(receipt.amount)}`], ["Status", receipt.reversed ? "Reversed" : receipt.approval],
  ].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><p>Copy of the original posted record. Reprinting does not record another payment.</p></div>;
}
export function AssignedInvoices(props: Props) {
  const { data, state } = useData(props, "/sales/invoices");
  return (
    <section className="panel">
      <div className="panel-header">
        <CardTitle icon={FileText}>
          <h2>Assigned customer invoices</h2>
          <p>
            Assigned invoices and your drafts. Finance reviews and issues drafts
            before payment allocation.
          </p>
        </CardTitle>
        {props.grants.some((g) => g.id === "sales.invoice.create") && (
          <button
            className="button secondary"
            onClick={() =>
              props.form(
                "Create draft customer invoice",
                [
                  {
                    name: "contact_id",
                    label: "Customer",
                    options: props.contacts.map((c) => ({
                      value: c.id,
                      label: c.name,
                    })),
                  },
                  {
                    name: "issued",
                    label: "Issue date",
                    type: "date",
                    value: date(),
                  },
                  {
                    name: "due",
                    label: "Due date",
                    type: "date",
                    value: date(),
                  },
                  { name: "amount", label: "Amount (SLE)", type: "number" },
                  { name: "description", label: "Description" },
                ],
                "/sales/invoices",
              )
            }
          >
            Create draft invoice
          </button>
        )}
      </div>
      {state}
      {data && (
        <Table
          title="Assigned invoices"
          rows={data.items}
          headings={[
            "Invoice / customer",
            "Due",
            "Description",
            "Status",
            "Amount (SLE)",
            "Outstanding (SLE)",
          ]}
          render={(i) => (
            <tr key={i.id}>
              <td>
                {i.number}
                <small>{i.contact_name}</small>
              </td>
              <td>{i.due}</td>
              <td>{i.description}</td>
              <td>{i.lifecycle}</td>
              <td>{props.money(i.amount)}</td>
              <td>{props.money(i.outstanding)}</td>
            </tr>
          )}
        />
      )}
      <p className="panel-note">
        Record customer payments in Transactions, then allocate your receipt to
        the same customer's issued invoice where the organisation policy
        permits. Draft invoices do not add to cash totals.
      </p>
    </section>
  );
}

export function InvoiceAssigner({
  invoices,
  ...props
}: Props & { invoices: Row[] }) {
  const { data, state } = useData(props, "/invoices/assignees");
  const [invoice, setInvoice] = useState("");
  return (
    <div className="workspace-details">
      <h3>Assign an invoice to a sales officer</h3>
      {state}
      {data && (
        <>
          <label className="workspace-table-search">
            Invoice
            <select
              className="input"
              value={invoice}
              onChange={(e) => setInvoice(e.target.value)}
            >
              <option value="">Choose invoice</option>
              {invoices
                .filter((i) => i.lifecycle !== "cancelled")
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.number} · {i.customer}
                  </option>
                ))}
            </select>
          </label>
          <button
            className="button secondary small"
            disabled={!invoice || !data.items.length}
            onClick={() =>
              props.form(
                "Assign customer invoice",
                [
                  {
                    name: "user_id",
                    label: "Sales officer",
                    options: data.items.map((u: Row) => ({
                      value: u.id,
                      label: u.name,
                    })),
                  },
                  { name: "reason", label: "Assignment reason" },
                ],
                `/invoices/${invoice}/assign`,
              )
            }
          >
            Assign invoice
          </button>
          {!data.items.length && (
            <p className="field-help">
              Create an active cashier account before assigning invoices.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function ApprovalLimits(props: Props & { userId: string }) {
  const { data, state } = useData(props, "/approval-policy");
  return (
    <section className="panel">
      <div className="panel-header">
        <CardTitle icon={ShieldCheck}>
          <h2>Monetary approval limits</h2>
          <p>
            Limits cover payment approvals and monetary control requests.
            Another manager must configure your limit. Unconfigured approvers
            retain existing authority.
          </p>
        </CardTitle>
      </div>
      {state}
      {data && (
        <Table
          title="Approval limits"
          rows={data.approvers}
          headings={["Approver", "Responsibility", "Limit (SLE)", "Actions"]}
          render={(u) => {
            const limit = data.limits.find((l: Row) => l.user_id === u.id);
            return (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.role}</td>
                <td>
                  {limit
                    ? props.money(limit.max_amount)
                    : "No configured amount limit"}
                </td>
                <td>
                  {u.id === props.userId ? (
                    "Another manager must change your limit"
                  ) : (
                    <div className="enhancement-actions">
                      <button
                        className="button secondary small"
                        onClick={() =>
                          props.form(
                            "Configure approval limit",
                            [
                              {
                                name: "max_amount",
                                label:
                                  "Maximum approval amount (SLE; 0 blocks all approvals)",
                                value: limit
                                  ? props.money(limit.max_amount)
                                  : "1000.00",
                              },
                              { name: "reason", label: "Reason for limit" },
                            ],
                            "/approval-policy/limits",
                            { user_id: u.id },
                          )
                        }
                      >
                        Set limit
                      </button>
                      {limit && (
                        <button
                          className="button secondary small"
                          onClick={() =>
                            props.form(
                              "Remove approval amount limit",
                              [
                                {
                                  name: "reason",
                                  label:
                                    "Reason for restoring unlimited amount authority",
                                },
                              ],
                              "/approval-policy/limits",
                              { user_id: u.id, unlimited: true },
                            )
                          }
                        >
                          Remove amount limit
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          }}
        />
      )}
    </section>
  );
}
