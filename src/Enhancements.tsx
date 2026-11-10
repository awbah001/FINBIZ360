import { useEffect, useState } from "react";
import {
  ArrowRight,
  WarningCircle as CircleAlert,
  DownloadSimple as Download,
  FileText,
  MagnifyingGlass as Search,
  UploadSimple as Upload,
} from "@phosphor-icons/react";
import CardTitle from "./CardTitle";
import InputSurface from "./InputSurface";
import { UserIdentity } from "./UserAvatar";
import RecordPicker, { selectedSummary } from "./RecordPicker";
import useUnsavedChanges from "./useUnsavedChanges";

type Row = Record<string, any>;
type Shared = {
  userId?: string;
  api: (path: string, method?: string, body?: unknown) => Promise<any>;
  form: (
    title: string,
    fields: any[],
    path: string,
    extra?: Row,
    method?: string,
    description?: string,
  ) => void;
  money: (value?: string | number) => string;
  refresh: (message?: string) => void;
  canEdit: boolean;
  can?: (permission: string) => boolean;
  canExport?: boolean;
  role: string;
  revision: number;
};
const permitted = (shared: Shared, permission: string) =>
  shared.can ? shared.can(permission) : shared.canEdit;
const reason = {
  name: "reason",
  label: "Reason / review note",
  type: "textarea",
};
const statusOptions = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];
function ErrorNotice({ error }: { error: string }) {
  return error ? (
    <p className="error" role="alert">
      <CircleAlert size={17} aria-hidden="true" focusable="false" />
      {error}
    </p>
  ) : null;
}

export function ContactDirectory({
  contacts,
  type,
  ...shared
}: Shared & { contacts: Row[]; type: string }) {
  const [query, setQuery] = useState(""),
    [active, setActive] = useState("all"),
    [history, setHistory] = useState<Row | null>(null),
    [error, setError] = useState("");
  const items = contacts.filter(
    (c) =>
      c.type === type &&
      (active === "all" || Boolean(c.active) === (active === "active")) &&
      `${c.name} ${c.phone} ${c.email} ${c.reference}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  useEffect(() => {
    setHistory(null);
    setQuery("");
    setError("");
  }, [type, shared.revision]);
  return (
    <>
      <div className="enhancement-toolbar">
        <label>
          <Search size={16} aria-hidden="true" focusable="false" />
          Search contacts
          <InputSurface>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, reference, email or phone"
            />
          </InputSurface>
        </label>
        <label>
          Status
          <InputSurface>
            <select
              className="input"
              value={active}
              onChange={(e) => setActive(e.target.value)}
            >
              <option value="all">All contacts</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </InputSurface>
        </label>
      </div>
      <ErrorNotice error={error} />
      <div className="directory-grid">
        {items.map((c) => (
          <article className="contact-card" key={c.id}>
            <span className="contact-avatar">
              {c.name.slice(0, 2).toUpperCase()}
            </span>
            <h3>{c.name}</h3>
            <p>
              {c.phone || "No phone recorded"}
              <br />
              {c.email}
              <br />
              {c.reference && `Ref: ${c.reference}`}
            </p>
            <span className={`badge ${c.active ? "active" : "inactive"}`}>
              {c.active ? "Active" : "Inactive"}
            </span>
            <div className="enhancement-actions">
              <button
                className="button secondary small"
                onClick={async () => {
                  try {
                    setError("");
                    setHistory(await shared.api(`/contacts/${c.id}/history`));
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                View history
                <ArrowRight size={14} aria-hidden="true" focusable="false" />
              </button>
              {shared.canEdit &&
                permitted(shared, "finance.contact.update") && (
                  <button
                    className="button secondary small"
                    onClick={() =>
                      shared.form(
                        "Edit contact",
                        [
                          { name: "name", label: "Name", value: c.name },
                          {
                            name: "phone",
                            label: "Phone",
                            value: c.phone,
                            required: false,
                          },
                          {
                            name: "email",
                            label: "Email",
                            type: "email",
                            value: c.email,
                            required: false,
                          },
                          {
                            name: "address",
                            label: "Address",
                            type: "textarea",
                            value: c.address,
                            required: false,
                          },
                          {
                            name: "reference",
                            label: "Customer / supplier reference",
                            value: c.reference,
                            required: false,
                          },
                          {
                            name: "active",
                            label: "Status",
                            value: String(Boolean(c.active)),
                            options: statusOptions,
                          },
                          reason,
                        ],
                        `/contacts/${c.id}`,
                        {},
                        "PATCH",
                      )
                    }
                  >
                    Edit contact
                  </button>
                )}
            </div>
          </article>
        ))}
      </div>
      {!items.length && (
        <p className="enhancement-empty">No contacts match these filters.</p>
      )}
      {history && (
        <section className="enhancement-history">
          <h3>{history.contact.name} — account history</h3>
          <p>Outstanding documents: SLE {shared.money(history.outstanding)}</p>
          <div
            className="table-scroll"
            role="region"
            aria-label="Financial records. Scroll horizontally to see all columns."
            tabIndex={0}
          >
            <p className="scroll-hint">Scroll sideways to view all columns.</p>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference / document</th>
                  <th>Type</th>
                  <th>Amount (SLE)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.transactions.map((t: Row) => (
                  <tr key={t.id}>
                    <td>{t.date}</td>
                    <td>{t.reference || t.description}</td>
                    <td>{t.direction === "in" ? "Receipt" : "Payment"}</td>
                    <td>{shared.money(t.amount)}</td>
                    <td>{t.approval}</td>
                  </tr>
                ))}
                {history.documents.map((d: Row) => (
                  <tr key={d.id}>
                    <td>{d.issued}</td>
                    <td>{d.number}</td>
                    <td>{type === "customer" ? "Invoice" : "Supplier bill"}</td>
                    <td>{shared.money(d.amount)}</td>
                    <td>
                      {d.status} · outstanding {shared.money(d.outstanding)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="button secondary small"
            onClick={() => setHistory(null)}
          >
            Close history
          </button>
        </section>
      )}
    </>
  );
}

export function TransactionEvidence({
  transaction,
  ...shared
}: Shared & { transaction: Row }) {
  const [files, setFiles] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    shared
      .api(`/transactions/${transaction.id}/evidence`)
      .then(setFiles)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, [transaction.id, shared.revision]);
  return (
    <section className="evidence-tools">
      <h3>Supporting evidence</h3>
      <p>
        Payment state:{" "}
        <strong>{transaction.payment_status || "recorded"}</strong>. Statement
        reconciliation remains a separate control.
      </p>
      <ErrorNotice error={error} />
      {files.map((file) => (
        <a
          key={file.id}
          href={`/api/evidence/${file.id}`}
          className="button secondary small"
        >
          <Download
            size={15}
            aria-hidden="true"
            focusable="false"
            className="icon-download"
          />
          {file.filename}
        </a>
      ))}
      {!files.length && <p>No evidence files attached.</p>}
      {shared.canEdit && permitted(shared, "finance.evidence.upload") && (
        <form
          className="finbiz-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            const data = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
              await shared.api(
                `/transactions/${transaction.id}/evidence`,
                "POST",
                data,
              );
              await load();
              shared.refresh("Evidence attached");
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Attach PDF, PNG or JPEG (up to 2 MB; no banking credentials)
            <input
              aria-label="Transaction evidence file"
              name="file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              required
              disabled={busy}
            />
          </label>
          <button className="button small" disabled={busy}>
            <Upload
              size={15}
              aria-hidden="true"
              focusable="false"
              className="icon-upload"
            />
            {busy ? "Uploading…" : "Attach evidence"}
          </button>
        </form>
      )}
      {shared.canEdit &&
        permitted(shared, "finance.transaction.verify") &&
        shared.role !== "cashier" &&
        transaction.payment_status !== "evidence_verified" && (
          <button
            className="button secondary small"
            onClick={() =>
              shared.form(
                "Record evidence verification",
                [
                  {
                    name: "evidence_reference",
                    label: "Evidence reference and what was verified",
                    type: "textarea",
                  },
                ],
                `/transactions/${transaction.id}/verify`,
                {},
                "POST",
                "This records your manual evidence review. It does not claim confirmation from a provider API.",
              )
            }
          >
            Record evidence verification
          </button>
        )}
    </section>
  );
}

export function InvoiceActions({
  invoice,
  supplier = false,
  ...shared
}: Shared & { invoice: Row; supplier?: boolean }) {
  const [payments, setPayments] = useState<Row[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => setPayments(null), [shared.revision]);
  return (
    <div className="invoice-actions">
      {!supplier && invoice.items?.length > 0 && (
        <details>
          <summary>Invoice line items</summary>
          {invoice.items.map((item: Row, i: number) => (
            <p key={i}>
              {item.description} ? {item.quantity} ? SLE{" "}
              {shared.money(item.unit_price_minor)}
            </p>
          ))}
        </details>
      )}
      <ErrorNotice error={error} />
      {shared.canEdit &&
        permitted(shared, "finance.invoice.update") &&
        invoice.lifecycle === "draft" && (
          <button
            className="button secondary small"
            onClick={() =>
              shared.form(
                "Issue invoice",
                [reason],
                `/invoices/${invoice.id}`,
                { lifecycle: "issued" },
                "PATCH",
              )
            }
          >
            Issue invoice
          </button>
        )}
      {shared.canEdit &&
        permitted(shared, "finance.invoice.update") &&
        !supplier &&
        invoice.lifecycle !== "cancelled" &&
        BigInt(invoice.paid) === 0n &&
        BigInt(invoice.written_off || "0") === 0n && (
          <button
            className="button danger small"
            onClick={() =>
              shared.form(
                "Cancel invoice",
                [reason],
                `/invoices/${invoice.id}`,
                { lifecycle: "cancelled" },
                "PATCH",
              )
            }
          >
            Cancel invoice
          </button>
        )}
      <button
        className="button secondary small"
        onClick={async () => {
          try {
            setPayments(
              payments
                ? null
                : await shared.api(
                    `/${supplier ? "supplier-bills" : "invoices"}/${invoice.id}/payments`,
                  ),
            );
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Payment history
      </button>
      {payments && (
        <div className="allocation-history">
          {!payments.length && <p>No payments allocated.</p>}
          {payments.map((p) => (
            <div key={p.id}>
              <p>
                {p.date} · {p.reference} · SLE {shared.money(p.amount)}
                {p.correction_reason && ` · Corrected: ${p.correction_reason}`}
              </p>
              {shared.canEdit &&
                permitted(shared, "finance.allocation.correct") &&
                !p.correction_reason && (
                  <button
                    className="button secondary small"
                    onClick={() =>
                      shared.form(
                        "Correct payment allocation",
                        [reason],
                        `/${supplier ? "supplier-allocations" : "allocations"}/${p.id}/correct`,
                        {},
                        "POST",
                        "Retains the original allocation and records its correction. This does not reverse the underlying receipt.",
                      )
                    }
                  >
                    Correct allocation
                  </button>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ItemisedInvoice({
  customers,
  ...shared
}: Shared & { customers: Row[] }) {
  const [items, setItems] = useState([
      { description: "", quantity: "1", unit_price: "" },
    ]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
  const amount = () => {
    let total = 0n;
    for (const item of items) {
      if (
        !/^\d{1,10}(\.\d{1,2})?$/.test(item.unit_price) ||
        !/^\d+$/.test(item.quantity) ||
        BigInt(item.quantity) < 1n
      )
        throw new Error(
          "Use positive whole quantities and valid two-decimal prices.",
        );
      const [w, f = ""] = item.unit_price.split(".");
      total +=
        (BigInt(w) * 100n + BigInt(f.padEnd(2, "0"))) * BigInt(item.quantity);
    }
    return `${total / 100n}.${String(total % 100n).padStart(2, "0")}`;
  };
  const update = (i: number, key: string, value: string) =>
    setItems((prev) =>
      prev.map((item, j) => (j === i ? { ...item, [key]: value } : item)),
    );
  return (
    <details className="itemised-invoice">
      <summary>Create an itemised invoice</summary>
      <form
        className="finbiz-form"
        onChange={() => setDirty(true)}
        aria-busy={busy}
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            const element = e.currentTarget;
            const values = Object.fromEntries(new FormData(element));
            await shared.api("/invoices", "POST", {
              ...values,
              amount: amount(),
              description: items
                .map((i) => i.description)
                .join("; ")
                .slice(0, 200),
              items: items.map((i) => ({ ...i, quantity: Number(i.quantity) })),
            });
            setDirty(false);
            shared.refresh("Itemised invoice created");
            setItems([{ description: "", quantity: "1", unit_price: "" }]);
            element.reset();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label>
            Invoice number
            <input
              name="number"
              required
              maxLength={80}
              placeholder="e.g. INV-2026-001"
            />
          </label>
          <label>
            Customer
            <select name="contact_id" required>
              <option value="">Choose customer</option>
              {customers
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Issue date
            <input
              type="date"
              name="issued"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <label>
            Due date
            <input type="date" name="due" required />
          </label>
          <label>
            Lifecycle
            <select name="lifecycle">
              <option value="issued">Issued</option>
              <option value="draft">Draft</option>
            </select>
          </label>
        </div>
        {items.map((item, i) => (
          <fieldset key={i} className="invoice-item-row">
            <legend>Item {i + 1}</legend>
            <label>
              Description
              <input
                required
                value={item.description}
                placeholder="Describe the product or service"
                maxLength={200}
                onChange={(e) => update(i, "description", e.target.value)}
              />
            </label>
            <label>
              Quantity
              <input
                type="number"
                required
                min="1"
                max="100000"
                step="1"
                value={item.quantity}
                placeholder="e.g. 1"
                onChange={(e) => update(i, "quantity", e.target.value)}
              />
            </label>
            <label>
              Unit price (SLE)
              <input
                type="text"
                required
                inputMode="decimal"
                value={item.unit_price}
                placeholder="0.00"
                onChange={(e) => update(i, "unit_price", e.target.value)}
              />
            </label>
            {items.length > 1 && (
              <button
                type="button"
                className="button secondary small"
                onClick={() => setItems(items.filter((_, j) => j !== i))}
              >
                Remove item
              </button>
            )}
          </fieldset>
        ))}
        <ErrorNotice error={error} />
        <div className="enhancement-actions">
          <button
            type="button"
            className="button secondary small"
            disabled={items.length >= 100 || busy}
            onClick={() =>
              setItems([
                ...items,
                { description: "", quantity: "1", unit_price: "" },
              ])
            }
          >
            Add line item
          </button>
          <button className="button small" disabled={busy}>
            {busy ? "Saving…" : "Create invoice"}
          </button>
        </div>
      </form>
    </details>
  );
}

export function SupplierBills({
  data,
  contacts,
  ...shared
}: Shared & { data: Row[]; contacts: Row[] }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <CardTitle icon={FileText}>
          <h2>Supplier bills & payments</h2>
          <p>Payables are separate from approved cash outflows.</p>
        </CardTitle>
        {shared.canEdit &&
          permitted(shared, "finance.supplier_bill.create") && (
            <button
              className="button small"
              onClick={() =>
                shared.form(
                  "Record supplier bill",
                  [
                    { name: "number", label: "Bill number" },
                    {
                      name: "contact_id",
                      label: "Supplier",
                      options: contacts
                        .filter((c) => c.type === "supplier" && c.active)
                        .map((c) => ({ value: c.id, label: c.name })),
                    },
                    {
                      name: "issued",
                      label: "Issue date",
                      type: "date",
                      value: new Date().toISOString().slice(0, 10),
                    },
                    { name: "due", label: "Due date", type: "date" },
                    { name: "amount", label: "Amount (SLE)", type: "number" },
                    {
                      name: "description",
                      label: "Description",
                      type: "textarea",
                    },
                  ],
                  "/supplier-bills",
                )
              }
            >
              Record bill
            </button>
          )}
      </div>
      <div
        className="table-scroll"
        role="region"
        aria-label="Financial records. Scroll horizontally to see all columns."
        tabIndex={0}
      >
        <p className="scroll-hint">Scroll sideways to view all columns.</p>
        <table>
          <thead>
            <tr>
              <th>Bill / supplier</th>
              <th>Due</th>
              <th>Amount</th>
              <th>Outstanding</th>
              <th>Status</th>
              <th>History / actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((b) => (
              <tr key={b.id}>
                <td>
                  <strong>{b.number}</strong>
                  <small>{b.contact_name}</small>
                </td>
                <td>{b.due}</td>
                <td>{shared.money(b.amount)}</td>
                <td>{shared.money(b.outstanding)}</td>
                <td>
                  <span className={`badge ${b.status}`}>{b.status}</span>
                </td>
                {
                  <td>
                    {shared.canEdit &&
                      permitted(shared, "finance.supplier_bill.allocate") &&
                      BigInt(b.outstanding) > 0n && (
                        <button
                          className="button secondary small"
                          onClick={() =>
                            shared.form(
                              "Allocate approved supplier payment",
                              [
                                {
                                  name: "transaction_id",
                                  label: "Approved payment internal ID",
                                },
                                {
                                  name: "amount",
                                  label: "Amount to allocate (SLE)",
                                  type: "number",
                                },
                              ],
                              `/supplier-bills/${b.id}/allocate`,
                              {},
                              "POST",
                              "Use an independently approved outgoing transaction for the same supplier.",
                            )
                          }
                        >
                          Allocate payment
                        </button>
                      )}
                    <InvoiceActions {...shared} invoice={b} supplier />
                  </td>
                }
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.length && (
        <p className="enhancement-empty">No supplier bills recorded.</p>
      )}
    </section>
  );
}

export function ExceptionQueue({ data, ...shared }: Shared & { data: Row[] }) {
  const [account, setAccount] = useState(""),
    [channel, setChannel] = useState(""),
    [type, setType] = useState(""),
    [status, setStatus] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const items = data.filter(
    (r) =>
      (!account || r.account_id === account) &&
      (!channel || r.channel === channel) &&
      (!type || r.type === type) &&
      (!status || r.status === status) &&
      (!from || r.date >= from) &&
      (!to || r.date <= to),
  );
  return (
    <section className="panel">
      <div className="panel-header">
        <CardTitle icon={CircleAlert}>
          <h2>Exception review queue</h2>
          <p>
            Investigations do not change financial records. Resolve financial
            differences through approved recorded corrections and
            reconciliation.
          </p>
        </CardTitle>
      </div>
      <div className="enhancement-toolbar">
        {[
          {
            label: "Account",
            value: account,
            set: setAccount,
            options: [
              ...new Map(
                data.map((r) => [
                  r.account_id,
                  { id: r.account_id, name: r.account_name },
                ]),
              ).values(),
            ],
          },
          {
            label: "Channel",
            value: channel,
            set: setChannel,
            options: ["cash", "bank", "mobile"].map((v) => ({
              id: v,
              name: v,
            })),
          },
          {
            label: "Type",
            value: type,
            set: setType,
            options: [...new Set(data.map((r) => r.type))].map((v) => ({
              id: v,
              name: v.replaceAll("_", " "),
            })),
          },
          {
            label: "Status",
            value: status,
            set: setStatus,
            options: ["open", "in_review", "dismissed"].map((v) => ({
              id: v,
              name: v.replaceAll("_", " "),
            })),
          },
        ].map((f) => (
          <label key={f.label}>
            {f.label}
            <InputSurface>
              <select
                className="input"
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
              >
                <option value="">All</option>
                {f.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </InputSurface>
          </label>
        ))}
        <label>
          From
          <InputSurface>
            <input
              className="input"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </InputSurface>
        </label>
        <label>
          To
          <InputSurface>
            <input
              className="input"
              type="date"
              min={from || undefined}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </InputSurface>
        </label>
      </div>
      <div
        className="table-scroll"
        role="region"
        aria-label="Financial records. Scroll horizontally to see all columns."
        tabIndex={0}
      >
        <p className="scroll-hint">Scroll sideways to view all columns.</p>
        <table>
          <thead>
            <tr>
              <th>Date / account</th>
              <th>Type</th>
              <th>Evidence / issue</th>
              <th>Amount</th>
              <th>Status / review</th>
              {shared.canEdit &&
                permitted(shared, "finance.exception.review") && (
                  <th>Action</th>
                )}
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.key}>
                <td>
                  {e.date}
                  <small>{e.account_name}</small>
                </td>
                <td>{e.type.replaceAll("_", " ")}</td>
                <td>
                  {e.reference || "No reference"}
                  <small>{e.description}</small>
                </td>
                <td>{shared.money(e.amount)}</td>
                <td>
                  <span className="badge">{e.status.replaceAll("_", " ")}</span>
                  {e.review && (
                    <small>
                      {e.review.reason} · {e.review.created_at}
                    </small>
                  )}
                </td>
                {shared.canEdit &&
                  permitted(shared, "finance.exception.review") && (
                    <td>
                      <button
                        className="button secondary small"
                        onClick={() =>
                          shared.form(
                            "Record exception investigation",
                            [reason],
                            "/exceptions/review",
                            { key: e.key, status: "in_review" },
                          )
                        }
                      >
                        Investigate
                      </button>
                      {shared.role === "manager" &&
                        ["duplicate", "invalid_statement"].includes(e.type) && (
                          <button
                            className="button secondary small"
                            onClick={() =>
                              shared.form(
                                "Dismiss reviewed non-posting exception",
                                [reason],
                                "/exceptions/review",
                                { key: e.key, status: "dismissed" },
                                "POST",
                                "The original evidence remains retained. No transaction is written off or removed.",
                              )
                            }
                          >
                            Dismiss with reason
                          </button>
                        )}
                    </td>
                  )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!items.length && (
        <p className="enhancement-empty">No exceptions match these filters.</p>
      )}
    </section>
  );
}

export function AdvancedReconciliation(shared: Shared) {
  const [state, setState] = useState<Row | null>(null),
    [error, setError] = useState("");
  const [composing, setComposing] = useState(false),
    [saving, setSaving] = useState(false);
  const [matchingMode, setMatchingMode] = useState("balanced");
  const [selection, setSelection] = useState<{
    transaction_ids: string[];
    line_ids: string[];
  }>({ transaction_ids: [], line_ids: [] });
  const txSummary = selectedSummary(
    state?.participants.transactions || [],
    selection.transaction_ids,
  );
  const lineSummary = selectedSummary(
    state?.participants.lines || [],
    selection.line_ids,
  );
  const difference = txSummary.total - lineSummary.total;
  const selectedAccounts = [
    ...new Set([...txSummary.accounts, ...lineSummary.accounts]),
  ];
  useUnsavedChanges(
    composing &&
      (selection.transaction_ids.length > 0 || selection.line_ids.length > 0),
  );
  useEffect(() => {
    let live = true;
    Promise.all([
      shared.api("/reconciliation/suggestions"),
      shared.api("/reconciliation/proposals"),
      shared.api("/reconciliation/participants"),
      shared.api("/reconciliation/partial-proposals"),
    ])
      .then(([suggestions, proposals, participants, partials]) => {
        if (live) {
          setState({
            ...suggestions,
            proposals: [...proposals, ...partials].sort((a, b) =>
              b.created_at.localeCompare(a.created_at),
            ),
            participants,
          });
          setError("");
        }
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [shared.revision]);
  return (
    <section className="panel">
      <div className="panel-header">
        <CardTitle icon={FileText}>
          <h2>Reviewed matching & groups</h2>
          <p>
            Exact matching above remains available. Tolerance and grouped
            matches require balanced totals and a different manager’s approval.
          </p>
        </CardTitle>
        {shared.canEdit &&
          permitted(shared, "finance.reconciliation.execute") && (
            <button
              className="button small"
              onClick={() => setComposing(!composing)}
            >
              Propose match / group
            </button>
          )}
      </div>
      <ErrorNotice error={error} />
      {composing && state && (
        <form
          className="group-proposal-form finbiz-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (saving) return;
            setSaving(true);
            setError("");
            const values = new FormData(event.currentTarget);
            try {
              const transactionIds = selection.transaction_ids,
                lineIds = selection.line_ids;
              if (!transactionIds.length || !lineIds.length)
                throw new Error(
                  "Select records on both sides before submitting.",
                );
              if (selectedAccounts.length !== 1)
                throw new Error(
                  "Select entries from the same financial account.",
                );
              if (matchingMode === "balanced" && difference !== 0n)
                throw new Error(
                  "The signed totals must balance. Use partial mode for a remaining amount.",
                );
              if (matchingMode === "partial") {
                if (transactionIds.length !== 1 || lineIds.length !== 1)
                  throw new Error(
                    "A partial proposal needs exactly one transaction and one statement line.",
                  );
                await shared.api("/reconciliation/partial-proposals", "POST", {
                  transaction_id: transactionIds[0],
                  line_id: lineIds[0],
                  amount: values.get("amount"),
                  reason: values.get("reason"),
                });
              } else
                await shared.api("/reconciliation/proposals", "POST", {
                  transaction_ids: transactionIds,
                  line_ids: lineIds,
                  reason: values.get("reason"),
                });
              setComposing(false);
              setSelection({ transaction_ids: [], line_ids: [] });
              shared.refresh(
                "Matching proposal submitted for independent manager review",
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <label>
            Matching mode
            <select
              value={matchingMode}
              onChange={(e) => {
                setMatchingMode(e.target.value);
                setSelection({ transaction_ids: [], line_ids: [] });
              }}
            >
              <option value="balanced">Balanced full settlement / group</option>
              <option value="partial">Partial amount allocation</option>
            </select>
          </label>
          <p>
            {matchingMode === "partial"
              ? "Choose exactly one transaction and one statement line, with the same account and direction. Allocate no more than the remaining amount on either side."
              : "Select up to 30 entries on each side using the checkboxes. Use one account within the date tolerance. Inflows less outflows must balance the statement totals. Use partial mode to complete an already partially matched record."}
          </p>
          {matchingMode === "partial" && (
            <label>
              Amount to allocate (SLE)
              <input
                name="amount"
                type="number"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                required
              />
            </label>
          )}
          <div className="form-grid">
            {[
              {
                name: "transaction_ids",
                label: "Accepted internal transactions",
                rows: state.participants.transactions,
              },
              {
                name: "line_ids",
                label: "Unreconciled statement evidence",
                rows: state.participants.lines,
              },
            ].map((group) => (
              <RecordPicker
                key={group.name}
                name={group.name}
                title={group.label}
                rows={group.rows}
                selected={selection[group.name as keyof typeof selection]}
                onSelect={(ids) =>
                  setSelection((current) => ({ ...current, [group.name]: ids }))
                }
                limit={matchingMode === "partial" ? 1 : 30}
                money={shared.money}
              />
            ))}
          </div>
          <div className="matching-summary" aria-live="polite">
            <p>
              <strong>Account:</strong>{" "}
              {selectedAccounts.length === 1
                ? (
                    state.participants.transactions.find((row: Row) =>
                      selection.transaction_ids.includes(row.id),
                    ) ||
                    state.participants.lines.find((row: Row) =>
                      selection.line_ids.includes(row.id),
                    )
                  )?.account_name
                : selectedAccounts.length > 1
                  ? "Multiple accounts selected"
                  : "Select records to begin"}
            </p>
            <div>
              <span>Internal entries ({txSummary.count})</span>
              <strong>SLE {shared.money(String(txSummary.total))}</strong>
            </div>
            <div>
              <span>Statement entries ({lineSummary.count})</span>
              <strong>SLE {shared.money(String(lineSummary.total))}</strong>
            </div>
            <div>
              <span>
                {matchingMode === "partial"
                  ? "Difference in available totals"
                  : "Difference to resolve"}
              </span>
              <strong>SLE {shared.money(String(difference))}</strong>
            </div>
            <p>
              {selectedAccounts.length > 1
                ? "Different accounts selected. Choose records from one account."
                : matchingMode === "partial"
                  ? "Allocate only the amount supported by both selected records. The server rechecks remaining amounts and direction."
                  : difference === 0n && txSummary.count && lineSummary.count
                    ? "Totals balance. Check dates, references and account before requesting independent approval."
                    : "Select records on both sides. Signed inflows less outflows must balance."}
            </p>
          </div>
          <label>
            Review explanation
            <textarea
              name="reason"
              required
              maxLength={500}
              placeholder="Explain why these records should be matched"
            />
          </label>
          <div className="enhancement-actions">
            <button className="button small" disabled={saving}>
              {saving ? "Submitting..." : "Submit proposal"}
            </button>
            <button
              className="button secondary small"
              type="button"
              disabled={saving}
              onClick={() => setComposing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {state && (
        <>
          <div className="panel-note">
            Tolerance: {state.policy.date_days} days · SLE{" "}
            {shared.money(state.policy.amount_minor)}. Amount tolerance produces
            suggestions only; a difference cannot be silently confirmed.
            {shared.role === "manager" &&
              permitted(shared, "finance.reconciliation.configure") && (
                <button
                  className="button secondary small"
                  onClick={() =>
                    shared.form(
                      "Configure matching tolerances",
                      [
                        {
                          name: "date_days",
                          label: "Date tolerance (whole days, 0–7)",
                          value: String(state.policy.date_days),
                        },
                        {
                          name: "amount_minor",
                          label: "Amount tolerance (minor units, 0–100000)",
                          value: String(state.policy.amount_minor),
                        },
                        reason,
                      ],
                      "/reconciliation/policy",
                      {},
                      "PATCH",
                    )
                  }
                >
                  Edit matching policy
                </button>
              )}
          </div>
          <details className="enhancement-history">
            <summary>
              {state.suggestions.length} potential tolerance suggestions
            </summary>
            {state.suggestions.map((s: Row) => (
              <div key={s.line_id}>
                <strong>
                  {s.reference || "No reference"} · {s.date} · SLE{" "}
                  {shared.money(s.amount)}
                </strong>
                <small>Statement line: {s.line_id}</small>
                <p>{s.reason}</p>
                {s.candidates.map((c: Row) => (
                  <p key={c.id}>
                    Candidate {c.id} · {c.date} · SLE {shared.money(c.amount)} ·
                    difference {shared.money(c.difference)}
                  </p>
                ))}
              </div>
            ))}
          </details>
          <div
            className="table-scroll"
            role="region"
            aria-label="Financial records. Scroll horizontally to see all columns."
            tabIndex={0}
          >
            <p className="scroll-hint">Scroll sideways to view all columns.</p>
            <table>
              <thead>
                <tr>
                  <th>Proposed / requester</th>
                  <th>Entries</th>
                  <th>Reason / decision</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {state.proposals.map((p: Row) => (
                  <tr key={p.id}>
                    <td>
                      {p.created_at}
                      <small>
                        <UserIdentity
                          name={p.requester}
                          src={p.requester_image_url}
                        />
                      </small>
                    </td>
                    <td>
                      {p.transaction_ids.length} transactions /{" "}
                      {p.line_ids.length} statement lines
                      {p.mode === "partial" && (
                        <small>
                          Partial allocation: SLE {shared.money(p.amount)}
                        </small>
                      )}
                    </td>
                    <td>
                      {p.reason}
                      <small>{p.decision_reason}</small>
                    </td>
                    <td>
                      <span className="badge">{p.status}</span>
                    </td>
                    <td>
                      {shared.role === "manager" &&
                        permitted(shared, "finance.reconciliation.confirm") &&
                        p.status === "pending" &&
                        p.user_id !== shared.userId && (
                          <div className="enhancement-actions">
                            {["approved", "rejected"].map((decision) => (
                              <button
                                key={decision}
                                className={`button small ${decision === "rejected" ? "danger" : "secondary"}`}
                                onClick={() =>
                                  shared.form(
                                    `${decision === "approved" ? "Approve" : "Reject"} grouped match`,
                                    [reason],
                                    `/reconciliation/${p.mode === "partial" ? "partial-proposals" : "proposals"}/${p.id}/decide`,
                                    { decision },
                                  )
                                }
                              >
                                {decision === "approved" ? "Approve" : "Reject"}
                              </button>
                            ))}
                          </div>
                        )}
                      {shared.canEdit &&
                        permitted(shared, "finance.reconciliation.undo") &&
                        p.status === "approved" && (
                          <button
                            className="button secondary small"
                            onClick={() =>
                              shared.form(
                                "Undo grouped reconciliation",
                                [reason],
                                `/reconciliation/${p.mode === "partial" ? "partial-proposals" : "proposals"}/${p.id}/undo`,
                              )
                            }
                          >
                            Undo group
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!state.proposals.length && (
            <p className="enhancement-empty">
              No manual matching proposals yet.
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function AnalyticsPanel({
  data,
  money,
}: {
  data: Row;
  money: Shared["money"];
}) {
  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <CardTitle icon={FileText}>
            <h2>Recorded performance by channel</h2>
            <p>
              Accepted entries only. Figures are recorded cash movement, not
              profit.
            </p>
          </CardTitle>
        </div>
        <div
          className="table-scroll"
          role="region"
          aria-label="Financial records. Scroll horizontally to see all columns."
          tabIndex={0}
        >
          <p className="scroll-hint">Scroll sideways to view all columns.</p>
          <table>
            <thead>
              <tr>
                <th>Channel</th>
                <th>Count</th>
                <th>Inflows</th>
                <th>Outflows</th>
                <th>Net (SLE)</th>
              </tr>
            </thead>
            <tbody>
              {data.channels.map((c: Row) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td>{c.count}</td>
                  <td>{money(c.incoming)}</td>
                  <td>{money(c.outgoing)}</td>
                  <td>{money(c.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.comparison && (
          <div className="panel-note">
            <strong>Period comparison</strong>
            <p>{data.comparison.scope}</p>
            <p>
              Before {data.comparison.split_date}: net SLE{" "}
              {money(data.comparison.previous.net)} · From{" "}
              {data.comparison.split_date}: net SLE{" "}
              {money(data.comparison.current.net)}
            </p>
          </div>
        )}
      </section>
      <section className="panel">
        <div className="panel-header">
          <CardTitle icon={CircleAlert}>
            <h2>Rule-based anomaly indicators</h2>
            <p>
              Indicators require human investigation. They are not evidence of
              fraud.
            </p>
          </CardTitle>
        </div>
        {data.anomalies.length ? (
          <div
            className="table-scroll"
            role="region"
            aria-label="Financial records. Scroll horizontally to see all columns."
            tabIndex={0}
          >
            <p className="scroll-hint">Scroll sideways to view all columns.</p>
            <table>
              <thead>
                <tr>
                  <th>Date / reference</th>
                  <th>Amount (SLE)</th>
                  <th>Triggered rules</th>
                </tr>
              </thead>
              <tbody>
                {data.anomalies.map((a: Row) => (
                  <tr key={a.transaction_id}>
                    <td>
                      {a.date}
                      <small>{a.reference || "No reference"}</small>
                    </td>
                    <td>{money(a.amount)}</td>
                    <td>{a.reasons.join(" ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="enhancement-empty">
            No configured rules triggered in this view.
          </p>
        )}
      </section>
      <section className="panel">
        <div className="panel-header">
          <CardTitle icon={FileText}>
            <h2>Short-term cash-flow baseline</h2>
            <p>
              Available only when recorded history passes the sufficiency check.
            </p>
          </CardTitle>
        </div>
        {!data.forecast.available ? (
          <p className="panel-note">{data.forecast.reason}</p>
        ) : (
          <>
            <div className="panel-note">
              <p>{data.forecast.method}</p>
              <p>
                Training ends {data.forecast.training_end}. Baseline dates
                follow that recorded period.
              </p>
              <p>
                Held-out mean absolute error: SLE{" "}
                {money(data.forecast.mae_minor)}.
              </p>
              <p>{data.forecast.assumptions}</p>
              <p>{data.forecast.limitations}</p>
            </div>
            <div
              className="table-scroll"
              role="region"
              aria-label="Financial records. Scroll horizontally to see all columns."
              tabIndex={0}
            >
              <p className="scroll-hint">
                Scroll sideways to view all columns.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Expected net (SLE)</th>
                    <th>Historical-error range</th>
                  </tr>
                </thead>
                <tbody>
                  {data.forecast.points.map((p: Row) => (
                    <tr key={p.date}>
                      <td>{p.date}</td>
                      <td>{money(p.net)}</td>
                      <td>
                        {money(p.low)} to {money(p.high)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}

export function ReportCentre({
  params,
  ...shared
}: Shared & { params: string }) {
  const [kind, setKind] = useState("accounts"),
    [report, setReport] = useState<Row | null>(null),
    [error, setError] = useState("");
  const [reportStatus, setReportStatus] = useState("");
  useEffect(() => {
    let live = true;
    setReport(null);
    shared
      .api(
        `/reports/data?${params}&kind=${kind}&report_status=${encodeURIComponent(reportStatus)}`,
      )
      .then((r) => {
        if (live) {
          setReport(r);
          setError("");
        }
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [kind, params, reportStatus, shared.revision]);
  return (
    <section className="panel">
      <div className="panel-header">
        <CardTitle icon={FileText}>
          <h2>Financial report centre</h2>
          <p>
            All monetary report fields are exact SLE minor units (divide by 100
            for major units).
          </p>
        </CardTitle>
        <label>
          Report type
          <select
            aria-label="Financial report type"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setReportStatus("");
            }}
          >
            {[
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
            ].map((v) => (
              <option key={v} value={v}>
                {v.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        {report?.statuses?.length > 0 && (
          <label>
            Report status
            <select
              aria-label="Report status"
              value={reportStatus}
              onChange={(e) => setReportStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {report?.statuses?.map((v: string) => (
                <option key={v} value={v}>
                  {v.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <ErrorNotice error={error} />
      {shared.canExport !== false && (
        <div className="enhancement-actions report-downloads">
          {["csv", "xlsx", "pdf"].map((format) => (
            <a
              key={format}
              className="button secondary small"
              href={`/api/reports/download?${params}&kind=${kind}&report_status=${encodeURIComponent(reportStatus)}&format=${format}`}
            >
              <Download
                size={15}
                aria-hidden="true"
                focusable="false"
                className="icon-download"
              />
              {format.toUpperCase()}
            </a>
          ))}
        </div>
      )}
      {shared.canExport === false && (
        <p className="panel-note">
          Report export is disabled by your organisation's audit policy. Reports
          remain available for review.
        </p>
      )}
      {report ? (
        <>
          <p className="panel-note">{report.scope}</p>
          <div
            className="table-scroll"
            role="region"
            aria-label="Financial records. Scroll horizontally to see all columns."
            tabIndex={0}
          >
            <p className="scroll-hint">Scroll sideways to view all columns.</p>
            <table>
              <thead>
                <tr>
                  {report.rows[0] &&
                    Object.keys(report.rows[0]).map((key) => (
                      <th key={key}>{key.replaceAll("_", " ")}</th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.slice(0, 100).map((row: Row, i: number) => (
                  <tr key={i}>
                    {Object.entries(row).map(([key, value]) => (
                      <td key={key}>{String(value)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-note">
            {report.rows.length} rows · preview shows at most 100; exports
            contain all filtered rows.
          </p>
        </>
      ) : (
        <p className="enhancement-empty">Loading report…</p>
      )}
    </section>
  );
}

export function ReferenceCategories({
  categories,
  ...shared
}: Shared & { categories: Row[] }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <CardTitle icon={FileText}>
          <h2>Income & expense categories</h2>
        </CardTitle>
        {shared.canEdit && permitted(shared, "finance.category.create") && (
          <button
            className="button small"
            onClick={() =>
              shared.form(
                "Create category",
                [
                  { name: "name", label: "Category name" },
                  {
                    name: "direction",
                    label: "Applies to",
                    options: [
                      { value: "in", label: "Income" },
                      { value: "out", label: "Expense" },
                      { value: "both", label: "Both" },
                    ],
                  },
                ],
                "/categories",
              )
            }
          >
            Create category
          </button>
        )}
      </div>
      <div className="category-list">
        {categories.map((c) => (
          <div key={c.id}>
            <span>
              {c.name} · {c.direction} · {c.active ? "Active" : "Inactive"}
            </span>
            {shared.canEdit && permitted(shared, "finance.category.update") && (
              <button
                className="button secondary small"
                onClick={() =>
                  shared.form(
                    c.active ? "Deactivate category" : "Activate category",
                    [reason],
                    `/categories/${c.id}`,
                    { active: !c.active },
                    "PATCH",
                  )
                }
              >
                {c.active ? "Deactivate" : "Activate"}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
export function ApprovalPolicy(shared: Shared) {
  const [state, setState] = useState<Row | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    shared
      .api("/approval-policy")
      .then(setState)
      .catch((e) => setError(e.message));
  }, [shared.revision]);
  return (
    <section className="panel">
      <div className="panel-header">
        <CardTitle icon={FileText}>
          <h2>Business approval authority</h2>
          <p>
            Managers approve by role. Administrators and finance officers need
            explicit delegation. Nobody can approve their own payment.
          </p>
        </CardTitle>
        {state && permitted(shared, "finance.approval_policy.configure") && (
          <button
            className="button small"
            onClick={() =>
              shared.form(
                "Assign or revoke approval authority",
                [
                  {
                    name: "user_id",
                    label: "Eligible staff member",
                    options: state.eligible.map((u: Row) => ({
                      value: u.id,
                      label: `${u.name} (${u.role})`,
                    })),
                  },
                  {
                    name: "active",
                    label: "Authority",
                    value: "true",
                    options: [
                      {
                        value: "true",
                        label: "Grant business payment approval",
                      },
                      { value: "false", label: "Revoke delegated authority" },
                    ],
                  },
                  reason,
                ],
                "/approval-policy",
              )
            }
          >
            Manage delegation
          </button>
        )}
      </div>
      <ErrorNotice error={error} />
      <div className="category-list">
        {state?.delegates.map((d: Row) => (
          <div key={d.user_id}>
            <span>
              {d.name} � {d.active ? "Delegated" : "Revoked"}
              <small>{d.reason}</small>
            </span>
          </div>
        ))}
        {state && !state.delegates.length && (
          <p>No extra approval authority has been delegated.</p>
        )}
      </div>
    </section>
  );
}
export function ControlRequests({
  accounts,
  ...shared
}: Shared & { accounts: Row[] }) {
  const [requests, setRequests] = useState<Row[]>([]),
    [documents, setDocuments] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [kind, setKind] = useState("adjustment");
  useEffect(() => {
    let live = true;
    Promise.all([
      shared.api("/control-requests"),
      shared.api("/invoices"),
      shared.api("/supplier-bills"),
    ])
      .then(([r, i, b]) => {
        if (live) {
          setRequests(r);
          setDocuments([
            ...i.map((d: Row) => ({ ...d, document_kind: "customer" })),
            ...b.map((d: Row) => ({ ...d, document_kind: "supplier" })),
          ]);
          setError("");
        }
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [shared.revision]);
  const fields = () => {
    if (kind === "period_close")
      return [{ name: "month", label: "Reporting month", type: "month" }];
    if (kind === "reversal")
      return [
        { name: "transaction_id", label: "Original transaction internal ID" },
        {
          name: "date",
          label: "Reversal date",
          type: "date",
          value: new Date().toISOString().slice(0, 10),
        },
      ];
    if (kind === "writeoff")
      return [
        {
          name: "document_key",
          label: "Outstanding document",
          options: documents
            .filter(
              (d) => d.lifecycle === "issued" && BigInt(d.outstanding) > 0n,
            )
            .map((d) => ({
              value: `${d.document_kind}:${d.id}`,
              label: `${d.number} � ${d.contact_name} � SLE ${shared.money(d.outstanding)}`,
            })),
        },
        {
          name: "amount",
          label: "Non-cash amount to write off (SLE)",
          type: "number",
        },
        {
          name: "evidence_reference",
          label: "Authorised write-off evidence reference",
        },
      ];
    return [
      {
        name: "account_id",
        label: "Financial account",
        options: accounts
          .filter((a) => a.active)
          .map((a) => ({ value: a.id, label: a.name })),
      },
      {
        name: "date",
        label: "Adjustment date",
        type: "date",
        value: new Date().toISOString().slice(0, 10),
      },
      {
        name: "direction",
        label: "Direction",
        options: [
          { value: "in", label: "Inflow" },
          { value: "out", label: "Outflow / fee" },
        ],
      },
      { name: "amount", label: "Amount (SLE)", type: "number" },
      { name: "reference", label: "Adjustment / fee evidence reference" },
      { name: "description", label: "Description", type: "textarea" },
    ];
  };
  return (
    <section className="panel">
      <div className="panel-header">
        <CardTitle icon={FileText}>
          <h2>Adjustments, write-offs & period review</h2>
          <p>
            Requests require a different manager�s approval. Write-offs reduce
            document balances only; they never create cash income or mark an
            invoice paid.
          </p>
        </CardTitle>
      </div>
      <ErrorNotice error={error} />
      {shared.canEdit && permitted(shared, "finance.control.create") && (
        <div className="enhancement-toolbar">
          <label>
            Request type
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="adjustment">Recorded adjustment / fee</option>
              <option value="writeoff">Document write-off</option>
              <option value="reversal">Transaction reversal</option>
              <option value="period_close">Reporting-period closure</option>
            </select>
          </label>
          <button
            className="button small"
            onClick={() =>
              shared.form(
                "Submit independent control request",
                [...fields(), reason],
                "/control-requests",
                { kind },
              )
            }
          >
            Create request
          </button>
        </div>
      )}
      <div
        className="table-scroll"
        role="region"
        aria-label="Financial records. Scroll horizontally to see all columns."
        tabIndex={0}
      >
        <p className="scroll-hint">Scroll sideways to view all columns.</p>
        <table>
          <thead>
            <tr>
              <th>Request / user</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Decision / history</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.kind.replaceAll("_", " ")}
                  <small>
                    <UserIdentity
                      name={r.requester}
                      src={r.requester_image_url}
                    />{" "}
                    � {r.created_at}
                  </small>
                </td>
                <td>
                  {r.reason}
                  <small>
                    {r.payload.description ||
                      r.payload.month ||
                      r.payload.evidence_reference ||
                      ""}
                  </small>
                </td>
                <td>
                  <span className="badge">{r.status}</span>
                </td>
                <td>
                  {shared.role === "manager" &&
                  permitted(shared, "finance.control.approve") &&
                  r.status === "pending" &&
                  r.user_id !== shared.userId ? (
                    <div className="enhancement-actions">
                      {["approved", "rejected"].map((decision) => (
                        <button
                          key={decision}
                          className="button secondary small"
                          onClick={() =>
                            shared.form(
                              `${decision === "approved" ? "Approve" : "Reject"} control request`,
                              [reason],
                              `/control-requests/${r.id}/decide`,
                              { decision },
                            )
                          }
                        >
                          {decision === "approved" ? "Approve" : "Reject"}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <small>
                      {r.decision_reason ||
                        (r.status === "pending"
                          ? "Awaiting independent manager review"
                          : "")}
                    </small>
                  )}
                  {r.result_id && <small>Result: {r.result_id}</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!requests.length && (
        <p className="enhancement-empty">No control requests recorded.</p>
      )}
    </section>
  );
}
