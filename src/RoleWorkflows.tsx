import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Gear as Settings,
  ClipboardText as History,
  Bank as Landmark,
  Key as KeyRound,
} from "@phosphor-icons/react";
import CardTitle from "./CardTitle";
import InputSurface from "./InputSurface";
import { UserIdentity } from "./UserAvatar";
import PasswordInput from "./PasswordInput";
import { ReferenceCategories } from "./Enhancements";
type Row = Record<string, any>;
type Props = {
  api: (path: string, method?: string, body?: unknown) => Promise<any>;
  form: (...args: any[]) => void;
  refresh: (message?: string) => void;
  revision: number;
  money: (value?: string | number) => string;
  role: string;
  canEdit: boolean;
};
export function AdminConfiguration(props: Props) {
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState("");
  useEffect(() => {
    let live = true;
    props
      .api("/admin/configuration")
      .then((r) => {
        if (live) setData(r);
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [props.revision]);
  return (
    <>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {data && (
        <>
          <section className="panel">
            <CardTitle icon={ShieldCheck}>
              <h2>Organisation access policy</h2>
              <p>
                These permissions are disabled until explicitly enabled by an
                administrator.
              </p>
            </CardTitle>
            <form
              className="policy-form finbiz-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy) return;
                setBusy(true);
                setError("");
                try {
                  await props.api("/settings", "PATCH", {
                    auditor_export_allowed:
                      !!data.organisation.auditor_export_allowed,
                    cashier_create_customers:
                      !!data.organisation.cashier_create_customers,
                    cashier_invoice_allocation:
                      !!data.organisation.cashier_invoice_allocation,
                    reason,
                  });
                  setReason("");
                  props.refresh("Access policy saved");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {(
                [
                  [
                    "auditor_export_allowed",
                    "Allow auditors to export authorised reports",
                  ],
                  [
                    "cashier_create_customers",
                    "Allow cashiers to create customer records",
                  ],
                  [
                    "cashier_invoice_allocation",
                    "Allow cashiers to allocate their own receipts to customer invoices",
                  ],
                ] as const
              ).map(([key, label]) => (
                <label className="policy-choice" key={key}>
                  <input
                    type="checkbox"
                    checked={!!data.organisation[key]}
                    onChange={(e) =>
                      setData({
                        ...data,
                        organisation: {
                          ...data.organisation,
                          [key]: Number(e.target.checked),
                        },
                      })
                    }
                  />
                  {label}
                </label>
              ))}
              <label>
                Reason for policy change
                <InputSurface>
                  <input
                    className="input"
                    required
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </InputSurface>
              </label>
              <button className="button" disabled={busy}>
                {busy ? "Saving..." : "Save access policy"}
              </button>
            </form>
          </section>
          <ReferenceCategories
            {...props}
            canEdit={true}
            categories={data.categories}
          />
          <section className="panel">
            <div className="panel-header">
              <CardTitle icon={Landmark}>
                <h2>Payment accounts and channels</h2>
                <p>
                  Configure account references. Opening balances and financial
                  activity remain protected.
                </p>
              </CardTitle>
              <button
                className="button secondary"
                onClick={() =>
                  props.form(
                    "Configure payment account",
                    [
                      { name: "name", label: "Account name" },
                      {
                        name: "channel",
                        label: "Payment channel",
                        options: ["cash", "mobile", "bank"].map((value) => ({
                          value,
                          label: value,
                        })),
                      },
                      { name: "provider", label: "Provider", required: false },
                    ],
                    "/accounts",
                    { opening_amount: "0.00" },
                  )
                }
              >
                Add account reference
              </button>
            </div>
            <div
              className="table-scroll"
              role="region"
              aria-label="Payment account configuration"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Channel</th>
                    <th>Currency</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.map((a: Row) => (
                    <tr key={a.id}>
                      <td>{a.name}</td>
                      <td>{a.channel}</td>
                      <td>{a.currency}</td>
                      <td>{a.active ? "Active" : "Inactive"}</td>
                      <td>
                        <button
                          className="button secondary small"
                          onClick={() =>
                            props.form(
                              "Edit account reference",
                              [
                                { name: "name", label: "Name", value: a.name },
                                {
                                  name: "provider",
                                  label: "Provider",
                                  value: a.provider,
                                  required: false,
                                },
                                {
                                  name: "active",
                                  label: "Account status",
                                  value: String(!!a.active),
                                  options: [
                                    { value: "true", label: "Active" },
                                    { value: "false", label: "Inactive" },
                                  ],
                                },
                                { name: "reason", label: "Reason" },
                              ],
                              `/accounts/${a.id}`,
                              {},
                              "PATCH",
                            )
                          }
                        >
                          Edit reference
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.accounts.length && (
              <p className="panel-note">No payment accounts configured.</p>
            )}
          </section>
          <section className="panel">
            <CardTitle icon={Settings}>
              <h2>Supported configuration</h2>
              <p>
                The current organisation uses SLE, two decimal places and
                Africa/Freetown. Bank and mobile money statements support CSV
                and XLSX with column mapping during import. Additional
                currencies, channel types and parser formats require a supported
                application extension.
              </p>
            </CardTitle>
          </section>
        </>
      )}
    </>
  );
}
export function ApprovalHistory({
  api,
  params,
  revision,
}: {
  api: Props["api"];
  params: string;
  revision: number;
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api(`/approvals/history?${params}&status=${status}`)
      .then((r) => {
        if (live) {
          setRows(r);
          setError("");
        }
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [params, status, revision]);
  return (
    <section className="panel">
      <div className="panel-header">
        <CardTitle icon={History}>
          <h2>Approval decision history</h2>
          <p>Recorded reviewers, decisions, reasons and timestamps.</p>
        </CardTitle>
        <label>
          Decision
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All completed decisions</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="undone">Undone</option>
          </select>
        </label>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div
        className="table-scroll"
        role="region"
        aria-label="Approval decision history"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Request</th>
              <th>Reference</th>
              <th>Decision</th>
              <th>Reviewer</th>
              <th>Time (UTC)</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.kind}-${r.id}`}>
                <td>{r.kind.replaceAll("_", " ")}</td>
                <td>
                  {r.description}
                  <small>{r.reference}</small>
                </td>
                <td>
                  <span className={`badge ${r.status}`}>{r.status}</span>
                </td>
                <td>
                  <UserIdentity name={r.reviewer} src={r.reviewer_image_url} />
                </td>
                <td>{r.decided_at}</td>
                <td>{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && !error && (
        <p className="panel-note">
          No completed decisions in the selected scope.
        </p>
      )}
    </section>
  );
}
export function ReceiptAllocation({
  transaction,
  api,
  refresh,
  money,
}: {
  transaction: Row;
  api: Props["api"];
  refresh: Props["refresh"];
  money: Props["money"];
}) {
  const [data, setData] = useState<Row | null>(null),
    [invoice, setInvoice] = useState(""),
    [amount, setAmount] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    api(`/receipts/${transaction.id}/invoices`)
      .then((r) => live && setData(r))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [transaction.id, version]);
  return (
    <section className="panel">
      <h3>Apply this receipt to an invoice</h3>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {data && (
        <>
          <p>
            Unallocated receipt: SLE {money(data.available)}. Allocations do not
            record a second receipt.
          </p>
          {data.invoices.length && BigInt(data.available) > 0n ? (
            <form
              className="policy-form finbiz-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy) return;
                setBusy(true);
                try {
                  await api(`/receipts/${transaction.id}/allocate`, "POST", {
                    invoice_id: invoice,
                    amount,
                  });
                  setVersion((v) => v + 1);
                  setAmount("");
                  setError("");
                  refresh("Receipt allocation saved");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Customer invoice
                <select
                  className="input"
                  required
                  value={invoice}
                  onChange={(e) => setInvoice(e.target.value)}
                >
                  <option value="">Choose invoice</option>
                  {data.invoices.map((i: Row) => (
                    <option key={i.id} value={i.id}>
                      {i.number} - SLE {money(i.outstanding)} outstanding
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Amount (SLE)
                <InputSurface>
                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </InputSurface>
              </label>
              <button className="button" disabled={busy}>
                {busy ? "Saving..." : "Allocate receipt"}
              </button>
            </form>
          ) : (
            <p className="panel-note">
              No outstanding invoice or available receipt amount for this
              customer.
            </p>
          )}
        </>
      )}
    </section>
  );
}
export function PasswordReset({
  user,
  api,
  onClose,
  refresh,
}: {
  user: Row;
  api: Props["api"];
  onClose: () => void;
  refresh: Props["refresh"];
}) {
  const [current, setCurrent] = useState(""),
    [reason, setReason] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section
      className="panel password-reset-panel"
      aria-label={`Reset password for ${user.email}`}
    >
      <CardTitle icon={KeyRound}>
        <h2>Reset password: {user.name}</h2>
        <p>
          Revokes this user's sessions. The generated password is displayed
          once; share it privately and ask the user to change it in Profile.
        </p>
      </CardTitle>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {password ? (
        <p className="panel-note">
          Temporary password: <code>{password}</code>
        </p>
      ) : (
        <form
          className="policy-form finbiz-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            try {
              const r = await api(`/users/${user.id}/reset-password`, "POST", {
                current_password: current,
                reason,
              });
              setPassword(r.temporary_password);
              setCurrent("");
              refresh("Password reset and existing sessions revoked");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Your administrator password
            <InputSurface>
              <PasswordInput
                className="input"
                visibilityLabel="administrator password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </InputSurface>
          </label>
          <label>
            Reset reason
            <InputSurface>
              <input
                className="input"
                required
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </InputSurface>
          </label>
          <button className="button" disabled={busy}>
            {busy ? "Resetting..." : "Generate temporary password"}
          </button>
        </form>
      )}
      <button className="button secondary small" onClick={onClose}>
        {password ? "Close and hide password" : "Cancel reset"}
      </button>
    </section>
  );
}
