import React, { useEffect, useId, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  ArrowLeftRight,
  FileText,
  Users,
  User,
  Building2,
  Landmark,
  Upload,
  GitCompareArrows,
  ShieldCheck,
  ChartNoAxesCombined,
  History,
  Settings,
  LogOut,
  Plus,
  Search,
  Download,
  X,
  Check,
  CircleAlert,
  Wallet,
  Menu,
  LockKeyhole,
  RefreshCw,
  CheckCheck,
  Banknote,
  Smartphone,
  Eye,
} from "lucide-react";
import "@fontsource-variable/plus-jakarta-sans";
import "./ui-tokens.css";
import "./styles.css";
import Setup from "./Setup";
import Login from "./Login";
import Home from "./Home";
import AuthFrame from "./AuthFrame";
import { navigate, usePath } from "./navigation";
import CardTitle from "./CardTitle";
import ProfilePage from "./ProfilePage";
import InputSurface from "./InputSurface";
import "./design.css";
import "./dashboard.css";
import "./cards.css";
import Dashboard, { WorkspaceTopbar } from "./Dashboard";
import RoleDashboard from "./RoleDashboard";
import {
  AdminConfiguration,
  ApprovalHistory,
  ReceiptAllocation,
  PasswordReset,
} from "./RoleWorkflows";
import {
  roleWorkspaces,
  canOpenPage,
  workspacePageFromSearch,
  workspacePageUrl,
} from "./roleWorkspace";
import "./reference-dashboard.css";
import {
  ContactDirectory,
  TransactionEvidence,
  InvoiceActions,
  ItemisedInvoice,
  SupplierBills,
  ExceptionQueue,
  AdvancedReconciliation,
  AnalyticsPanel,
  ReportCentre,
  ReferenceCategories,
  ApprovalPolicy,
  ControlRequests,
} from "./Enhancements";
import "./enhancements.css";
import "./ui.css";
import PageHero from "./PageHero";
import useNavigationDrawer from "./useNavigationDrawer";
import { allowWorkspaceNavigation } from "./useUnsavedChanges";

type Row = Record<string, any>;
type User = { id: string; name: string; email: string; role: string };
type Field = {
  name: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  value?: string;
  required?: boolean;
  placeholder?: string;
  help?: string;
};
let csrf = "";
async function api(path: string, method = "GET", body?: unknown) {
  const form = body instanceof FormData;
  const response = await fetch("/api" + path, {
    method,
    headers: {
      ...(method !== "GET" ? { "x-csrf-token": csrf } : {}),
      ...(!form && body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? (form ? body : JSON.stringify(body)) : undefined,
  });
  const result = await response.json();
  if (response.status === 401 && path !== "/login") {
    try {
      const session = await fetch("/api/session", {
        credentials: "same-origin",
      });
      const fresh = await session.json();
      if (session.ok) csrf = fresh.csrf;
    } catch {}
    window.dispatchEvent(new Event("finbiz-session-expired"));
  }
  if (!response.ok)
    throw Object.assign(new Error(result.error || "The request failed."), {
      status: response.status,
    });
  return result;
}
const fmt = (value: string | number = "0") => {
  const minor = BigInt(value);
  const absolute = minor < 0n ? -minor : minor;
  const whole = new Intl.NumberFormat("en-SL").format(absolute / 100n);
  return `${minor < 0n ? "−" : ""}${whole}.${String(absolute % 100n).padStart(2, "0")}`;
};
const today = () => new Date().toISOString().slice(0, 10);
const roleLabel: Row = {
  manager: "Owner / Manager",
  finance: "Finance Officer",
  cashier: "Cashier",
  auditor: "Auditor",
  admin: "Administrator",
};
const channelLabel: Row = {
  cash: "Cash",
  mobile: "Mobile money",
  bank: "Bank transfer",
};
function Badge({ value }: { value: string }) {
  return <span className={`badge ${value}`}>{value.replaceAll("_", " ")}</span>;
}
function Empty({
  title = "Nothing here yet",
  description = "New records will appear here as you work.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-illustration" aria-hidden="true">
        <FileText size={42} />
        <Search className="empty-search" size={27} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
function FormModal({
  title,
  fields,
  onClose,
  onSubmit,
  description,
  submit = "Save record",
}: {
  title: string;
  fields: Field[];
  onClose: () => void;
  onSubmit: (data: Row) => Promise<void>;
  description?: string;
  submit?: string;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const requestKey = useRef(crypto.randomUUID());
  const formId = useId();
  const [invalid, setInvalid] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const close = () => {
    if (
      !busy &&
      (!dirtyRef.current || window.confirm("Discard the changes in this form?"))
    )
      closeRef.current();
  };
  const dismissRef = useRef(close);
  dismissRef.current = close;
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    (
      dialog?.querySelector<HTMLElement>("input,select,textarea") ||
      dialog?.querySelector<HTMLElement>("button")
    )?.focus();
    const main = document.querySelector(
      ".app-shell > main",
    ) as HTMLElement | null;
    const sidebar = document.querySelector(
      ".app-shell > aside",
    ) as HTMLElement | null;
    const previousMain = main?.inert,
      previousSidebar = sidebar?.inert;
    if (main) main.inert = true;
    if (sidebar) sidebar.inert = true;
    const elements = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
        ) || [],
      );
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = elements();
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      if (main) main.inert = previousMain || false;
      if (sidebar) sidebar.inert = previousSidebar || false;
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) dismissRef.current();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [busy, onClose]);
  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="modal"
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">FINBIZ WORKSPACE</span>
            <h2 id="dialog-title">{title}</h2>
          </div>
          <button
            aria-label="Close dialog"
            className="icon-button"
            disabled={busy}
            onClick={close}
          >
            <X />
          </button>
        </div>
        {description && <p className="muted">{description}</p>}
        <form
          noValidate
          aria-busy={busy}
          onChange={() => setDirty(true)}
          onSubmit={async (e) => {
            e.preventDefault();
            if (submitting.current) return;
            const form = e.currentTarget;
            const errors: Record<string, string> = {};
            for (const element of Array.from(form.elements)) {
              if (
                element instanceof HTMLInputElement ||
                element instanceof HTMLSelectElement ||
                element instanceof HTMLTextAreaElement
              ) {
                if (!element.validity.valid)
                  errors[element.name] = element.validationMessage;
              }
            }
            setInvalid(errors);
            if (Object.keys(errors).length) {
              form.querySelector<HTMLElement>(":invalid")?.focus();
              return;
            }
            submitting.current = true;
            setBusy(true);
            setError("");
            try {
              await onSubmit({
                ...Object.fromEntries(new FormData(e.currentTarget)),
                _request_key: requestKey.current,
              });
              onClose();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              submitting.current = false;
              setBusy(false);
            }
          }}
        >
          {Object.keys(invalid).length > 0 && (
            <p className="error" role="alert">
              Check the highlighted fields before saving.
            </p>
          )}
          <div className="form-grid">
            {fields.map((f) => (
              <label
                key={f.name}
                className={f.type === "textarea" ? "full" : ""}
              >
                <span className="field-label">
                  {f.label}{" "}
                  <small>
                    {f.required === false ? "Optional" : "Required"}
                  </small>
                </span>
                {f.options ? (
                  <InputSurface>
                    <select
                      id={`${formId}-${f.name}`}
                      aria-invalid={!!invalid[f.name]}
                      aria-describedby={`${formId}-${f.name}-help`}
                      className="input"
                      name={f.name}
                      defaultValue={f.value || ""}
                      required={f.required !== false}
                    >
                      <option value="" disabled>
                        Select an option
                      </option>
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </InputSurface>
                ) : f.type === "textarea" ? (
                  <InputSurface>
                    <textarea
                      id={`${formId}-${f.name}`}
                      aria-invalid={!!invalid[f.name]}
                      aria-describedby={`${formId}-${f.name}-help`}
                      className="input"
                      name={f.name}
                      required={f.required !== false}
                      maxLength={500}
                      defaultValue={f.value}
                      placeholder={
                        f.placeholder || `Enter ${f.label.toLowerCase()}`
                      }
                    />
                  </InputSurface>
                ) : (
                  <InputSurface>
                    <input
                      id={`${formId}-${f.name}`}
                      aria-invalid={!!invalid[f.name]}
                      aria-describedby={`${formId}-${f.name}-help`}
                      className="input"
                      autoFocus={fields[0] === f}
                      name={f.name}
                      type={f.type || "text"}
                      step={f.type === "number" ? "0.01" : undefined}
                      min={f.type === "number" ? "0.01" : undefined}
                      required={f.required !== false}
                      defaultValue={f.value}
                      placeholder={
                        f.placeholder ||
                        (f.type === "number"
                          ? "0.00"
                          : `Enter ${f.label.toLowerCase()}`)
                      }
                      maxLength={256}
                    />
                  </InputSurface>
                )}
                <span
                  className={invalid[f.name] ? "field-error" : "field-help"}
                  id={`${formId}-${f.name}-help`}
                >
                  {invalid[f.name] ||
                    f.help ||
                    (f.type === "password"
                      ? "Use at least 12 characters for a new password."
                      : "")}
                </span>
              </label>
            ))}
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div className="modal-footer">
            <button
              className="button secondary"
              type="button"
              onClick={close}
              disabled={busy}
            >
              Cancel
            </button>
            <button className="button" disabled={busy}>
              {busy ? "Saving…" : submit}
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
const nav = [
  {
    group: "WORKSPACE",
    items: [
      ["Overview", LayoutDashboard],
      ["Transactions", ArrowLeftRight],
      ["Invoices", FileText],
      ["Customers", Users],
      ["Suppliers", Building2],
      ["Supplier bills", FileText],
      ["Accounts", Landmark],
    ],
  },
  {
    group: "CONTROL & INSIGHT",
    items: [
      ["Statements", Upload],
      ["Reconciliation", GitCompareArrows],
      ["Exceptions", CircleAlert],
      ["Approvals", ShieldCheck],
      ["Reports", ChartNoAxesCombined],
      ["Analytics", ChartNoAxesCombined],
      ["Audit trail", History],
    ],
  },
  {
    group: "PREFERENCES",
    items: [
      ["Users", Users],
      ["Profile", User],
      ["Settings", Settings],
    ],
  },
] as const;
const moduleTones: Record<string, string> = {
  Users: "cyan",
  Overview: "teal",
  Transactions: "blue",
  Invoices: "purple",
  Customers: "cyan",
  Suppliers: "orange",
  "Supplier bills": "orange",
  Accounts: "blue",
  Statements: "cyan",
  Reconciliation: "green",
  Exceptions: "rose",
  Approvals: "amber",
  Reports: "blue",
  Analytics: "purple",
  "Audit trail": "slate",
  Profile: "purple",
  Settings: "slate",
};
function App() {
  const route = usePath();
  const [user, setUser] = useState<User | null>(null),
    [initial, setInitial] = useState(true),
    [sessionError, setSessionError] = useState("");
  const [setupRequired, setSetupRequired] = useState(false),
    [setupTokenRequired, setSetupTokenRequired] = useState(false),
    [workspaceMode, setWorkspaceMode] = useState("live"),
    [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [page, setPage] = useState(
      workspacePageFromSearch(window.location.search),
    ),
    [master, setMaster] = useState<Row>({
      accounts: [],
      contacts: [],
      settings: {},
    }),
    [overview, setOverview] = useState<Row | null>(null),
    [pageData, setData] = useState<{ page: string; value: any } | null>(null);
  // A page switch renders before its loading effect runs. Never give the new
  // screen a response belonging to the previous screen's different API shape.
  const data = pageData?.page === page ? pageData.value : null;
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [revision, setRevision] = useState(0),
    [modal, setModal] = useState<React.ReactNode>(null),
    [mobile, setMobile] = useState(false);
  const drawer = useNavigationDrawer(mobile, () => setMobile(false));
  const [query, setQuery] = useState(""),
    [accountFilter, setAccountFilter] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [txPage, setTxPage] = useState(1);
  const [extraFilters, setExtraFilters] = useState<Row>({});
  const [importFile, setImportFile] = useState<File | null>(null),
    [importAccount, setImportAccount] = useState(""),
    [preview, setPreview] = useState<Row | null>(null),
    [importBusy, setImportBusy] = useState(false);
  const finance = !!user && ["finance", "manager"].includes(user.role),
    readAll = user?.role !== "cashier";
  const canAccessPage = (role: string, name: string) =>
    canOpenPage(role, name, !!master.permissions?.can_approve);
  const params = new URLSearchParams({
    ...extraFilters,
    ...(query ? { q: query } : {}),
    ...(accountFilter ? { account: accountFilter } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  }).toString();
  const refresh = (message = "Saved successfully") => {
    setToast(message);
    setRevision((v) => v + 1);
  };
  useEffect(() => {
    if (!user) {
      setMaster({ accounts: [], contacts: [], settings: {} });
      setOverview(null);
      setData(null);
      setModal(null);
      setPreview(null);
      setImportFile(null);
      setExtraFilters({});
    }
  }, [user]);
  useEffect(() => {
    const expired = () => {
      setUser(null);
      setOverview(null);
      setData(null);
      setModal(null);
      navigate("/login", true);
    };
    window.addEventListener("finbiz-session-expired", expired);
    return () => window.removeEventListener("finbiz-session-expired", expired);
  }, []);
  useEffect(() => {
    api("/session")
      .then((r) => {
        csrf = r.csrf;
        setUser(r.user);
        setSetupRequired(r.setupRequired);
        setSetupTokenRequired(r.setupTokenRequired);
        setWorkspaceMode(r.workspaceMode);
      })
      .catch((e) => setSessionError(e.message))
      .finally(() => setInitial(false));
  }, []);
  useEffect(() => {
    if (initial || sessionError) return;
    if (route === "/workspace" && !user)
      navigate(setupRequired ? "/register" : "/login", true);
    else if (route === "/register" && user) navigate("/workspace", true);
  }, [route, initial, sessionError, user, setupRequired]);
  useEffect(() => {
    const titles: Record<string, string> = {
      "/": "Financial clarity for your business",
      "/login": "Sign in",
      "/register": "Company registration",
      "/workspace": "Financial workspace",
    };
    document.title = `FinBiz 360 | ${titles[route] || "Page not found"}`;
  }, [route]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!user || route !== "/workspace") return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setData(null);
    const routes: Row = {
      Transactions: `/transactions?${params}&page=${txPage}`,
      Invoices: "/invoices",
      "Supplier bills": "/supplier-bills",
      Exceptions: "/exceptions",
      Analytics: "/analytics",
      Statements: "/imports",
      Reconciliation: "/reconciliation",
      Approvals: "/approvals",
      "Audit trail": `/audit?${params}`,
      Settings: "/settings",
    };
    let inFlight = false;
    const load = (silent = false) => {
      if (inFlight || cancelled) return;
      inFlight = true;
      if (!silent) setLoading(true);
      Promise.all([
        api("/master"),
        api(user.role === "admin" ? "/admin/overview" : `/overview?${params}`),
        user.role === "admin"
          ? Promise.resolve({})
          : api(`/workspace-summary?${params}`),
      ])
        .then(async ([m, o, summary]) => {
          const permitted = canOpenPage(
            user.role,
            page,
            !!m.permissions?.can_approve,
          );
          const d = permitted && routes[page] ? await api(routes[page]) : null;
          if (!cancelled) {
            setMaster(m);
            setOverview({ ...o, ...summary });
            setData({ page, value: d });
            setLastUpdated(new Date());
            setError(
              permitted
                ? ""
                : "Access denied. This page is outside your assigned workspace.",
            );
            setWorkspaceMode(m.settings.mode);
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setError(e.message);
            setData(null);
            if (e.status === 401) setUser(null);
            if (e.status === 403) {
              api("/master")
                .then((fresh) => {
                  if (cancelled) return;
                  setMaster(fresh);
                  if (
                    !canOpenPage(
                      user.role,
                      page,
                      !!fresh.permissions?.can_approve,
                    )
                  ) {
                    setOverview(null);
                    setPage("Overview");
                    setToast(
                      "Your access has changed. Returned to your dashboard.",
                    );
                  }
                })
                .catch(() => {});
            }
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
          inFlight = false;
        });
    };
    load();
    const sync = () => {
      if (document.visibilityState === "visible") load(true);
    };
    const timer = window.setInterval(sync, 15000);
    window.addEventListener("focus", sync);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", sync);
    };
  }, [user, route, page, revision, params, txPage]);
  useEffect(() => {
    const update = () => {
      if (window.location.pathname !== "/workspace") return;
      const next = workspacePageFromSearch(window.location.search);
      if (next === page) return;
      if (!allowWorkspaceNavigation()) {
        window.history.pushState({}, "", workspacePageUrl(page));
        return;
      }
      setPage(next);
      setExtraFilters({});
      setQuery("");
      setTxPage(1);
    };
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, [page]);
  const changePage = (name: string) => {
    if (!user || !canAccessPage(user.role, name)) return false;
    const target = name;
    if (target !== page && !allowWorkspaceNavigation()) return false;
    setPage(target);
    window.history.pushState({}, "", workspacePageUrl(target));
    if (!["Transactions", "Reports", "Analytics"].includes(target))
      setExtraFilters({});
    setMobile(false);
    setQuery("");
    setTxPage(1);
    setPreview(null);
    return true;
  };
  const form = (
    title: string,
    fields: Field[],
    path: string,
    extra: Row = {},
    method = "POST",
    description?: string,
  ) =>
    setModal(
      <FormModal
        title={title}
        fields={fields}
        description={description}
        onClose={() => setModal(null)}
        onSubmit={async (values) => {
          const body = { ...values, ...extra };
          if (typeof body.active === "string")
            body.active = body.active === "true";
          if (path === "/control-requests") {
            const { kind, reason, _request_key, ...payload } = body;
            if (payload.document_key) {
              const [document_kind, document_id] = String(
                payload.document_key,
              ).split(":");
              payload.document_kind = document_kind;
              payload.document_id = document_id;
              delete payload.document_key;
            }
            await api(path, method, {
              kind,
              reason,
              payload,
              request_key: _request_key,
            });
            refresh("Request submitted for independent manager review");
            return;
          }
          if (path === "/reconciliation/proposals")
            for (const key of ["transaction_ids", "line_ids"])
              body[key] = String(body[key])
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean);
          if (path === "/reconciliation/policy")
            for (const key of ["date_days", "amount_minor"])
              body[key] = Number(body[key]);
          const result = await api(path, method, body);
          refresh(
            result.warnings?.length
              ? result.warnings.join(" ")
              : "Saved successfully",
          );
        }}
      />,
    );
  const options = (rows: Row[]) =>
    rows.map((r) => ({ value: r.id, label: r.name }));
  const newTransaction = (
    entryKind: "sale" | "receipt" | "expense" = "receipt",
  ) =>
    form(
      entryKind === "sale"
        ? "Record sale"
        : entryKind === "expense"
          ? "Record expense"
          : user?.role === "cashier"
            ? "Record receipt"
            : "Record a transaction",
      [
        {
          name: "date",
          label: "Transaction date",
          type: "date",
          value: today(),
        },
        {
          name: "amount",
          label: "Amount (SLE)",
          type: "number",
          placeholder: "0.00",
        },
        {
          name: "direction",
          label: "Direction",
          value: entryKind === "expense" ? "out" : "in",
          options: [
            { value: "in", label: "Inflow / receipt" },
            ...(finance ? [{ value: "out", label: "Outflow / expense" }] : []),
          ],
        },
        {
          name: "account_id",
          label: "Financial account",
          options: options(master.accounts.filter((a: Row) => a.active)),
        },
        {
          name: "reference",
          label: "Receipt / external reference",
          required: false,
          placeholder: "Required for cash entries",
        },
        {
          name: "category",
          label: "Category",
          options: (master.categories || [])
            .filter((c: Row) => c.active)
            .map((c: Row) => ({ value: c.name, label: c.name })),
        },
        {
          name: "contact_id",
          label: user?.role === "cashier" ? "Customer" : "Customer / supplier",
          options: options(master.contacts.filter((c: Row) => c.active)),
          required: false,
        },
        { name: "description", label: "Description", type: "textarea" },
      ],
      "/transactions",
      {
        request_key: crypto.randomUUID(),
        ...(user?.role === "cashier" ? { entry_kind: entryKind } : {}),
      },
      "POST",
      user?.role === "cashier"
        ? "Record an incoming receipt in SLE. Cash entries require a receipt reference."
        : "Outflows require independent approval. All amounts are recorded in SLE.",
    );
  const txTable = (rows: Row[], compact = false) => (
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
            <th>Transaction</th>
            {!compact && <th>Date</th>}
            <th>Account / channel</th>
            <th>Status</th>
            <th className="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td>
                <button
                  className="row-link"
                  onClick={() =>
                    setModal(
                      <div className="overlay">
                        <section className="modal">
                          <div className="modal-head">
                            <h2>Transaction details</h2>
                            <button
                              className="icon-button"
                              aria-label="Close details"
                              onClick={() => setModal(null)}
                            >
                              <X />
                            </button>
                          </div>
                          <dl className="details">
                            {[
                              ["Description", t.description],
                              ["Reference", t.reference || "Not provided"],
                              ["Date", t.date],
                              ["Account", t.account_name],
                              [
                                "Amount",
                                `SLE ${fmt(t.amount)} (${t.direction})`,
                              ],
                              ["Category", t.category],
                              ["Contact", t.contact_name || "Not assigned"],
                              ["Recorded by", t.user_name],
                              ["Approval", t.approval],
                              [
                                "Reconciliation",
                                t.reconciliation_display || t.reconciliation,
                              ],
                              ["Internal ID", t.id],
                            ].map(([k, v]) => (
                              <div key={k}>
                                <dt>{k}</dt>
                                <dd>{v}</dd>
                              </div>
                            ))}
                          </dl>
                          <TransactionEvidence
                            transaction={t}
                            api={api}
                            form={form}
                            money={fmt}
                            refresh={refresh}
                            canEdit={
                              finance ||
                              (user?.role === "cashier" &&
                                t.user_id === user.id)
                            }
                            role={user?.role || ""}
                            revision={revision}
                          />
                          {user?.role === "cashier" &&
                            master.permissions?.can_allocate_receipts && (
                              <ReceiptAllocation
                                transaction={t}
                                api={api}
                                refresh={refresh}
                                money={fmt}
                              />
                            )}
                          {user?.role === "manager" &&
                            !t.reversal_of &&
                            ["approved", "not_required"].includes(
                              t.approval,
                            ) && (
                              <button
                                className="button danger"
                                onClick={() =>
                                  form(
                                    "Reverse transaction",
                                    [
                                      {
                                        name: "date",
                                        label: "Reversal date",
                                        type: "date",
                                        value: today(),
                                      },
                                      {
                                        name: "reason",
                                        label: "Reason",
                                        type: "textarea",
                                      },
                                    ],
                                    `/transactions/${t.id}/reverse`,
                                    {},
                                    "POST",
                                    "Creates a linked opposite entry. The original record remains unchanged.",
                                  )
                                }
                              >
                                Create reversal
                              </button>
                            )}
                        </section>
                      </div>,
                    )
                  }
                >
                  <span className={`transaction-symbol ${t.direction}`}>
                    {t.direction === "in" ? (
                      <ArrowDownLeft size={16} />
                    ) : (
                      <ArrowUpRight size={16} />
                    )}
                  </span>
                  <span>
                    <strong>{t.description}</strong>
                    <small>{t.reference || "No external reference"}</small>
                  </span>
                </button>
              </td>
              {!compact && <td className="nowrap">{t.date}</td>}
              <td>
                <strong className="table-main">{t.account_name}</strong>
                <small>{channelLabel[t.channel]}</small>
              </td>
              <td>
                <Badge
                  value={
                    t.approval === "pending" || t.approval === "rejected"
                      ? t.approval
                      : t.reconciliation === "reconciled"
                        ? "reconciled"
                        : t.reconciliation_display === "partially_matched"
                          ? "partially_matched"
                          : "recorded"
                  }
                />
              </td>
              <td
                className={`right amount ${t.direction === "in" ? "positive" : ""}`}
              >
                {t.direction === "in" ? "+" : "−"} {fmt(t.amount)}
                <small>SLE</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty />}
    </div>
  );
  if (route === "/") return <Home />;
  if (!["/login", "/register", "/workspace"].includes(route))
    return (
      <div className="boot">
        <CircleAlert />
        <h1>Page not found</h1>
        <a className="button" href="/">
          Back to home
        </a>
      </div>
    );
  if (initial)
    return (
      <div className="boot">
        <span className="brand-icon">
          <ChartNoAxesCombined />
        </span>
        <p>Opening your workspace…</p>
      </div>
    );
  if (sessionError)
    return (
      <div className="boot">
        <CircleAlert />
        <h2>Cannot connect to FinBiz</h2>
        <p>Start the app with npm run dev, then refresh this page.</p>
        <button className="button" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  if (setupRequired && route === "/register")
    return (
      <Setup
        tokenRequired={setupTokenRequired}
        onComplete={async (values) => {
          const { owner_confirm, admin_confirm, ...body } = values;
          await api("/setup", "POST", body);
          setSetupRequired(false);
          setWorkspaceMode("live");
          navigate("/login", true);
        }}
      />
    );
  if (route === "/register" && !setupRequired && !user)
    return (
      <AuthFrame registration>
        <header className="auth-heading">
          <span className="auth-product">FINBIZ 360</span>
          <h2>Your company is already set up</h2>
          <p>
            Sign in to enter your workspace. If you need a staff account, ask
            your administrator to add you under Settings → Create user.
          </p>
        </header>
        <a className="button auth-entry-link" href="/login">
          Sign in to workspace
          <ArrowRight size={16} />
        </a>
      </AuthFrame>
    );
  if (route === "/login" || !user)
    return (
      <Login
        demo={workspaceMode === "demo"}
        onAuthenticate={async (values) => {
          const session = await api("/session");
          csrf = session.csrf;
          const result = await api("/login", "POST", values);
          csrf = result.csrf;
          setOverview(null);
          setData(null);
          setMaster({ accounts: [], contacts: [], settings: {} });
          setModal(null);
          setPreview(null);
          setImportFile(null);
          setExtraFilters({});
          setError("");
          setQuery("");
          setAccountFilter("");
          setFrom("");
          setTo("");
          setTxPage(1);
          setLoading(true);
          setUser(result.user);
          setPage("Overview");
          navigate("/workspace", true);
        }}
      />
    );
  const shared = {
    api,
    form,
    money: fmt,
    refresh,
    canEdit: finance,
    canExport: !!master.permissions?.can_export,
    role: user.role,
    revision,
    userId: user.id,
  };
  const exportUrl = (format: string) =>
    `/api/reports/export?${params}&format=${format}`;
  const PageIcon =
    nav
      .map((group) => group.items.find(([name]) => name === page))
      .find(Boolean)?.[1] || LayoutDashboard;
  const changePassword = () =>
    setModal(
      <FormModal
        title="Change your password"
        description="Use at least 12 characters. All sessions will be signed out after this change."
        submit="Change password"
        fields={[
          { name: "current", label: "Current password", type: "password" },
          {
            name: "password",
            label: "New password (12+ characters)",
            type: "password",
          },
          {
            name: "confirmation",
            label: "Confirm new password",
            type: "password",
          },
        ]}
        onClose={() => setModal(null)}
        onSubmit={async (values) => {
          if (String(values.password).length < 12)
            throw new Error(
              "Use at least 12 characters for your new password.",
            );
          if (values.password !== values.confirmation)
            throw new Error("The new passwords do not match.");
          await api("/password", "POST", {
            current: values.current,
            password: values.password,
          });
          const session = await api("/session");
          csrf = session.csrf;
          setUser(null);
        }}
      />,
    );
  const headerActions = () =>
    page === "Transactions" && (finance || user.role === "cashier") ? (
      <button className="button" onClick={() => newTransaction()}>
        <Plus size={17} /> Record transaction
      </button>
    ) : page === "Invoices" && finance ? (
      <button
        className="button"
        onClick={() =>
          form(
            "Create invoice",
            [
              {
                name: "number",
                label: "Invoice number",
                placeholder: "INV-2026-002",
              },
              {
                name: "contact_id",
                label: "Customer",
                options: options(
                  master.contacts.filter((c: Row) => c.type === "customer"),
                ),
              },
              {
                name: "issued",
                label: "Issue date",
                type: "date",
                value: today(),
              },
              { name: "due", label: "Due date", type: "date" },
              { name: "amount", label: "Amount (SLE)", type: "number" },
              { name: "description", label: "Description", type: "textarea" },
              {
                name: "lifecycle",
                label: "Lifecycle",
                value: "issued",
                options: [
                  { value: "issued", label: "Issued" },
                  { value: "draft", label: "Draft" },
                ],
              },
            ],
            "/invoices",
          )
        }
      >
        <Plus size={17} /> Create invoice
      </button>
    ) : ["Customers", "Suppliers"].includes(page) &&
      (finance ||
        (page === "Customers" && master.permissions?.can_create_customers)) ? (
      <button
        className="button"
        onClick={() =>
          form(
            `Add ${page === "Customers" ? "customer" : "supplier"}`,
            [
              { name: "name", label: "Business / contact name" },
              { name: "phone", label: "Phone", required: false },
              { name: "email", label: "Email", type: "email", required: false },
              {
                name: "address",
                label: "Address",
                type: "textarea",
                required: false,
              },
              {
                name: "reference",
                label: "Contact reference",
                required: false,
              },
            ],
            "/contacts",
            { type: page === "Customers" ? "customer" : "supplier" },
          )
        }
      >
        <Plus size={17} /> Add {page === "Customers" ? "customer" : "supplier"}
      </button>
    ) : page === "Accounts" && (finance || user.role === "admin") ? (
      <button
        className="button"
        onClick={() =>
          form(
            "Add financial account",
            [
              { name: "name", label: "Account name" },
              {
                name: "channel",
                label: "Payment channel",
                options: Object.entries(channelLabel).map(([value, label]) => ({
                  value,
                  label,
                })),
              },
              { name: "provider", label: "Provider / bank", required: false },
              {
                name: "kind",
                label: "Account purpose",
                required: false,
                options: [
                  { value: "cash", label: "Cash" },
                  { value: "bank", label: "Bank" },
                  { value: "mobile", label: "Mobile money" },
                  { value: "clearing", label: "Clearing" },
                ],
              },
              {
                name: "opening_amount",
                label: "Opening balance (SLE)",
                value: "0.00",
              },
              {
                name: "opening_date",
                label: "Opening balance date",
                type: "date",
                value: today(),
              },
            ],
            "/accounts",
          )
        }
      >
        <Plus size={17} /> Add account
      </button>
    ) : page === "Overview" && (finance || user.role === "cashier") ? (
      <button className="button" onClick={() => newTransaction()}>
        <Plus size={17} /> Record transaction
      </button>
    ) : null;
  return (
    <div
      className={`app-shell reference-workspace ${page === "Overview" ? "is-dashboard" : ""}`}
    >
      <a className="workspace-skip" href="#workspace-content">
        Skip to workspace content
      </a>
      <aside
        ref={drawer.sidebar}
        id="workspace-navigation"
        role={mobile ? "dialog" : undefined}
        aria-modal={mobile || undefined}
        className={`sidebar ${mobile ? "open" : ""}`}
        aria-label="Workspace sidebar"
      >
        <header className="sidebar-header">
          <button
            className="icon-button drawer-close"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
          <a
            className="brand sidebar-brand"
            href="/"
            aria-label="FinBiz 360 home"
          >
            <span className="brand-icon">
              <ChartNoAxesCombined size={23} />
            </span>
            <span className="sidebar-brand-copy">
              <strong>
                FinBiz <span>360</span>
              </strong>
              <small>{roleLabel[user.role]}</small>
            </span>
          </a>
        </header>
        <nav aria-label="Workspace navigation">
          {nav
            .filter((group) =>
              group.items.some(([name]) => canAccessPage(user.role, name)),
            )
            .map((group) => (
              <div
                className="nav-group"
                key={group.group}
                role="group"
                aria-label={group.group}
              >
                <span className="nav-label">{group.group}</span>
                {group.items
                  .filter(([name]) => canAccessPage(user.role, name))
                  .map(([name, Icon]) => (
                    <button
                      key={name}
                      className={`nav-item ${page === name ? "active" : ""}`}
                      aria-current={page === name ? "page" : undefined}
                      onClick={() => changePage(name)}
                    >
                      <span
                        className={`nav-icon tone-${moduleTones[name] || "teal"}`}
                        aria-hidden="true"
                      >
                        <Icon size={18} />
                      </span>
                      <span className="nav-item-label">
                        {name === "Overview" ? "Dashboard" : name}
                      </span>
                      {name === "Approvals" &&
                        Number(overview?.pending) > 0 && (
                          <span className="nav-count">{overview?.pending}</span>
                        )}
                    </button>
                  ))}
              </div>
            ))}
        </nav>
        <footer className="sidebar-bottom">
          <div className="user-card">
            <div className="user-summary">
              <span className="user-avatar" aria-hidden="true">
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <div>
                <strong>{user.name}</strong>
                <small>{roleLabel[user.role]}</small>
              </div>
            </div>
            <button
              className="button secondary small sidebar-logout"
              onClick={async () => {
                try {
                  await api("/logout", "POST");
                  const session = await api("/session");
                  csrf = session.csrf;
                  setOverview(null);
                  setData(null);
                  setModal(null);
                  setUser(null);
                } catch (error) {
                  setError((error as Error).message);
                }
              }}
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </footer>
      </aside>
      {mobile && (
        <button
          aria-label="Close menu"
          className="sidebar-backdrop"
          onClick={() => setMobile(false)}
        />
      )}
      <main ref={drawer.background}>
        <WorkspaceTopbar
          user={user}
          api={api}
          notificationRevision={revision}
          page={page}
          company={master.settings.name}
          accounts={master.accounts}
          account={accountFilter}
          onAccount={
            user.role === "admin"
              ? undefined
              : (value) => {
                  setAccountFilter(value);
                  setTxPage(1);
                }
          }
          from={from}
          to={to}
          onFrom={user.role === "admin" ? undefined : setFrom}
          onTo={user.role === "admin" ? undefined : setTo}
          pending={Number(overview?.pending || 0)}
          readAll={canAccessPage(user.role, "Approvals")}
          onMenu={() => setMobile(true)}
          menuOpen={mobile}
          onNavigate={changePage}
          onRefresh={() => setRevision((value) => value + 1)}
          onSearch={(value) => {
            if (!changePage("Transactions")) return;
            setExtraFilters({});
            setAccountFilter("");
            setFrom("");
            setTo("");
            setQuery(value);
            setTxPage(1);
          }}
        />
        <div
          className={`page-content tone-${moduleTones[page] || "teal"}`}
          id="workspace-content"
          tabIndex={-1}
        >
          {page !== "Overview" && (
            <nav className="workspace-breadcrumb" aria-label="Breadcrumb">
              <button type="button" onClick={() => changePage("Overview")}>
                Dashboard
              </button>
              <ArrowRight size={15} aria-hidden="true" />
              <span aria-current="page">{page}</span>
            </nav>
          )}
          <PageHero page={page}>
            <div className="page-heading-identity">
              <span className="page-heading-icon" aria-hidden="true">
                <PageIcon size={34} strokeWidth={1.8} />
              </span>
              <div>
                <div className="eyebrow">
                  {page === "Overview"
                    ? roleLabel[user.role].toUpperCase() + " WORKSPACE"
                    : roleLabel[user.role].toUpperCase() + " WORKSPACE"}
                </div>
                <h1>
                  {page === "Overview" ? roleWorkspaces[user.role].title : page}
                </h1>
                <p>
                  {
                    (
                      {
                        Overview: roleWorkspaces[user.role].description,
                        Users:
                          "Create staff accounts and manage roles and access.",
                        Transactions:
                          "Every receipt and payment, in one reliable record.",
                        Statements:
                          "Bring your bank and mobile money evidence together.",
                        Reconciliation:
                          "Compare the evidence. Confirm with confidence.",
                        Approvals:
                          "Independent review for your outgoing payments.",
                        Exceptions:
                          "Investigate and explain unmatched or invalid financial evidence.",
                        Analytics:
                          "Explainable indicators and conditional cash-flow baselines.",
                        "Supplier bills":
                          "Supplier obligations and approved payment allocations.",
                        Invoices:
                          "Keep customer payments and outstanding balances in view.",
                        Reports:
                          "Turn your financial records into a clearer picture.",
                        "Audit trail":
                          "A traceable history of actions and decisions.",
                        Accounts:
                          "One view of your cash, bank and mobile money accounts.",
                        Customers: "The people and businesses you sell to.",
                        Suppliers: "The people and businesses you buy from.",
                        Profile:
                          "Manage your personal account details and access profile.",
                        Settings:
                          user.role === "admin"
                            ? "Manage organisation settings and database backups."
                            : "Manage financial categories, reporting periods and approval controls.",
                      } as Row
                    )[page]
                  }
                </p>
              </div>
            </div>
            <div className="heading-actions">{headerActions()}</div>
          </PageHero>
          <div className="workspace-scope" role="note">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>
              {user.role === "admin"
                ? "System administration: Financial records are restricted. Backups contain the full database."
                : user.role === "cashier"
                  ? "Personal receipt workspace: Transaction history shows only records created by you."
                  : user.role === "auditor"
                    ? "Read-only audit workspace: Review and export evidence without changing financial records."
                    : user.role === "finance"
                      ? "Finance operations: Payments require independent review; approval authority must be delegated."
                      : "Management workspace: Review business performance and independently authorise financial controls."}
            </span>
          </div>
          {error && (
            <div className="error" role="alert">
              <CircleAlert size={17} />
              {error}
              <button onClick={() => setRevision((v) => v + 1)}>Retry</button>
            </div>
          )}
          {["Transactions", "Reports", "Accounts", "Analytics"].includes(
            page,
          ) && (
            <div className="filter-bar">
              {page === "Transactions" && (
                <label className="search-box">
                  <Search size={17} />
                  <InputSurface>
                    <input
                      className="input"
                      aria-label="Search transactions"
                      placeholder="Search description or reference…"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setTxPage(1);
                      }}
                    />
                  </InputSurface>
                </label>
              )}
              <div className="filter-controls">
                <InputSurface>
                  <select
                    className="input"
                    aria-label="Filter by account"
                    value={accountFilter}
                    onChange={(e) => {
                      setAccountFilter(e.target.value);
                      setTxPage(1);
                    }}
                  >
                    <option value="">All accounts</option>
                    {master.accounts.map((a: Row) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </InputSurface>
                <label className="date-filter">
                  From
                  <InputSurface>
                    <input
                      className="input"
                      aria-label="From date"
                      type="date"
                      value={from}
                      onChange={(e) => {
                        setFrom(e.target.value);
                        setTxPage(1);
                      }}
                    />
                  </InputSurface>
                </label>
                <label className="date-filter">
                  To
                  <InputSurface>
                    <input
                      className="input"
                      aria-label="To date"
                      type="date"
                      value={to}
                      onChange={(e) => {
                        setTo(e.target.value);
                        setTxPage(1);
                      }}
                    />
                  </InputSurface>
                </label>
                {["Transactions", "Reports", "Analytics"].includes(page) && (
                  <>
                    {[
                      {
                        name: "channel",
                        label: "Payment channel",
                        options: [
                          ["cash", "Cash"],
                          ["mobile", "Mobile money"],
                          ["bank", "Bank"],
                        ],
                      },
                      {
                        name: "category",
                        label: "Category",
                        options: (master.categories || []).map((c: Row) => [
                          c.name,
                          c.name,
                        ]),
                      },
                      {
                        name: "approval",
                        label: "Approval status",
                        options: [
                          "not_required",
                          "pending",
                          "approved",
                          "rejected",
                        ].map((v) => [v, v.replaceAll("_", " ")]),
                      },
                      {
                        name: "status",
                        label: "Reconciliation status",
                        options: [
                          ["unmatched", "Unmatched"],
                          ["partially_matched", "Partially matched"],
                          ["reconciled", "Reconciled"],
                        ],
                      },
                      {
                        name: "sort",
                        label: "Sort transactions",
                        options: [
                          ["date_desc", "Newest first"],
                          ["date_asc", "Oldest first"],
                          ["amount_desc", "Largest amount first"],
                          ["amount_asc", "Smallest amount first"],
                        ],
                      },
                    ]
                      .filter(
                        (f) => page === "Transactions" || f.name !== "sort",
                      )
                      .map((f) => (
                        <InputSurface key={f.name}>
                          <select
                            className="input"
                            aria-label={f.label}
                            value={extraFilters[f.name] || ""}
                            onChange={(e) => {
                              setExtraFilters({
                                ...extraFilters,
                                [f.name]: e.target.value,
                              });
                              setTxPage(1);
                            }}
                          >
                            <option value="">{f.label}</option>
                            {f.options.map(([value, label]: string[]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </InputSurface>
                      ))}
                  </>
                )}
                {(from ||
                  to ||
                  accountFilter ||
                  query ||
                  Object.values(extraFilters).some(Boolean)) && (
                  <button
                    className="button secondary small"
                    onClick={() => {
                      setFrom("");
                      setTo("");
                      setAccountFilter("");
                      setExtraFilters({});
                      setQuery("");
                      setTxPage(1);
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>
              {page !== "Transactions" && (
                <span className="live-label">
                  <span />
                  {lastUpdated
                    ? `Synced ${lastUpdated.toLocaleTimeString("en-GB", { timeZone: "Africa/Freetown" })} · 15s refresh`
                    : "Syncing records…"}
                </span>
              )}
            </div>
          )}
          {(accountFilter ||
            from ||
            to ||
            query ||
            Object.values(extraFilters).some(Boolean)) && (
            <div
              className="active-scope"
              aria-label="Applied financial filters"
            >
              <span className="field-help">Current scope</span>
              {accountFilter && (
                <span className="scope-chip">
                  <strong>Account:</strong>{" "}
                  {master.accounts.find((a: Row) => a.id === accountFilter)
                    ?.name || "Selected account"}
                </span>
              )}
              {from && (
                <span className="scope-chip">
                  <strong>From:</strong> {from}
                </span>
              )}
              {to && (
                <span className="scope-chip">
                  <strong>To:</strong> {to}
                </span>
              )}
              {query && (
                <span className="scope-chip">
                  <strong>Search:</strong> {query}
                </span>
              )}
              {Object.entries(extraFilters)
                .filter(([, value]) => value)
                .map(([key, value]) => (
                  <span className="scope-chip" key={key}>
                    <strong>{key.replaceAll("_", " ")}:</strong>{" "}
                    {String(value).replaceAll("_", " ")}
                  </span>
                ))}
            </div>
          )}
          {loading ? (
            <div
              className="loading-skeleton"
              role="status"
              aria-label="Loading financial records"
            >
              {[0, 1, 2, 3, 4].map((i) => (
                <span aria-hidden="true" key={i} />
              ))}
            </div>
          ) : !canAccessPage(user.role, page) ? (
            <section className="panel" role="alert">
              <ShieldCheck size={32} />
              <h2>Access denied</h2>
              <p>
                This page is outside your assigned workspace. Your role is{" "}
                {roleLabel[user.role]}.
              </p>
              <button className="button" onClick={() => changePage("Overview")}>
                Return to my dashboard
              </button>
            </section>
          ) : (
            <>
              {page === "Overview" && overview && user.role !== "manager" && (
                <RoleDashboard
                  user={user}
                  overview={overview}
                  money={fmt}
                  onNavigate={changePage}
                  onRecord={() => newTransaction()}
                  lastUpdated={lastUpdated}
                  onSale={() => newTransaction("sale")}
                  onExpense={() => newTransaction("expense")}
                  demo={workspaceMode === "demo"}
                />
              )}
              {page === "Users" && user.role === "admin" && (
                <UserAdmin revision={revision} refresh={refresh} form={form} />
              )}
              {page === "Overview" && overview && user.role === "manager" && (
                <Dashboard
                  overview={overview}
                  user={user}
                  role={roleLabel[user.role]}
                  accounts={master.accounts}
                  readAll={readAll}
                  canRecord={finance}
                  canManageAccounts={finance}
                  onRecord={() => newTransaction()}
                  onNavigate={changePage}
                  money={fmt}
                  from={from}
                  to={to}
                  account={accountFilter}
                  onFrom={setFrom}
                  onTo={setTo}
                  onAccount={setAccountFilter}
                  lastUpdated={lastUpdated}
                  demo={workspaceMode === "demo"}
                />
              )}
              {page === "Profile" && user && (
                <ProfilePage
                  user={user}
                  role={roleLabel[user.role]}
                  company={master.settings.name || "FinBiz 360"}
                  demo={workspaceMode === "demo"}
                  canApprove={!!master.permissions?.can_approve}
                  onPassword={changePassword}
                  onEdit={() =>
                    setModal(
                      <FormModal
                        title="Edit your profile"
                        description="Update the name shown on your account. Your email and role remain unchanged."
                        submit="Save changes"
                        fields={[
                          {
                            name: "name",
                            label: "Full name",
                            value: user.name,
                          },
                        ]}
                        onClose={() => setModal(null)}
                        onSubmit={async (values) => {
                          const result = await api("/profile", "PATCH", {
                            name: values.name,
                          });
                          setUser(result.user);
                        }}
                      />,
                    )
                  }
                />
              )}
              {page === "Transactions" && data && (
                <section className="panel">
                  <div className="panel-header">
                    <CardTitle icon={ArrowLeftRight}>
                      <h2>
                        Transaction register{" "}
                        <span className="count-label">{data.total}</span>
                      </h2>
                    </CardTitle>
                    {readAll && master.permissions?.can_export && (
                      <a
                        className="button secondary small"
                        href={exportUrl("csv")}
                      >
                        <Download size={15} /> Export CSV
                      </a>
                    )}
                  </div>
                  {txTable(data.rows)}
                  <div className="pagination">
                    <span>
                      {data.total
                        ? `${(txPage - 1) * 15 + 1}–${Math.min(txPage * 15, data.total)}`
                        : "0"}{" "}
                      of {data.total} records
                    </span>
                    <div>
                      <button
                        aria-label="Previous page"
                        className="icon-button"
                        disabled={txPage === 1}
                        onClick={() => setTxPage((p) => p - 1)}
                      >
                        <ChevronLeft size={17} />
                      </button>
                      <span>Page {txPage}</span>
                      <button
                        aria-label="Next page"
                        className="icon-button"
                        disabled={txPage * 15 >= data.total}
                        onClick={() => setTxPage((p) => p + 1)}
                      >
                        <ChevronRight size={17} />
                      </button>
                    </div>
                  </div>
                </section>
              )}
              {["Customers", "Suppliers"].includes(page) && (
                <section className="panel">
                  <div className="panel-header">
                    <CardTitle icon={page === "Suppliers" ? Building2 : Users}>
                      <h2>{page} directory</h2>
                    </CardTitle>
                    <span className="subtle-tag">Master records</span>
                  </div>
                  <ContactDirectory
                    {...shared}
                    contacts={master.contacts}
                    type={page === "Customers" ? "customer" : "supplier"}
                  />
                </section>
              )}
              {page === "Accounts" && overview && (
                <>
                  <div className="account-cards">
                    {overview.accounts
                      .filter(
                        (a: Row) => !accountFilter || a.id === accountFilter,
                      )
                      .map((a: Row) => (
                        <section className="panel account-card" key={a.id}>
                          <span className={`account-icon ${a.channel}`}>
                            {a.channel === "cash" ? (
                              <Banknote size={22} />
                            ) : a.channel === "mobile" ? (
                              <Smartphone size={22} />
                            ) : (
                              <Landmark size={22} />
                            )}
                          </span>
                          <Badge value={a.channel} />
                          <h2>{a.name}</h2>
                          <p>{a.provider || channelLabel[a.channel]}</p>
                          <div className="large-amount">
                            <small>SLE </small>
                            {fmt(a.closing || a.balance)}
                          </div>
                          <span className="muted">
                            Net movement · selected period
                          </span>
                          <p>
                            Opening: SLE {fmt(a.opening || "0")} ? Movement: SLE{" "}
                            {fmt(a.movement || a.balance)}
                          </p>
                          <span
                            className={`badge ${a.active ? "active" : "inactive"}`}
                          >
                            {a.active ? "Active" : "Inactive"}
                          </span>
                          {(finance || user.role === "admin") && (
                            <button
                              className="button secondary small"
                              onClick={() =>
                                form(
                                  "Edit financial account",
                                  [
                                    {
                                      name: "name",
                                      label: "Account name",
                                      value: a.name,
                                    },
                                    {
                                      name: "provider",
                                      label: "Provider / bank",
                                      value: a.provider,
                                      required: false,
                                    },
                                    {
                                      name: "active",
                                      label: "Status",
                                      value: String(Boolean(a.active)),
                                      options: [
                                        { value: "true", label: "Active" },
                                        { value: "false", label: "Inactive" },
                                      ],
                                    },
                                    {
                                      name: "reason",
                                      label: "Change reason",
                                      type: "textarea",
                                    },
                                  ],
                                  `/accounts/${a.id}`,
                                  {},
                                  "PATCH",
                                )
                              }
                            >
                              Edit account
                            </button>
                          )}
                        </section>
                      ))}
                  </div>
                  <p className="footnote">
                    Closing balances include the recorded opening balance and
                    accepted entries through the selected end date. Opening and
                    movement are shown separately; opening balances are not
                    income.
                  </p>
                </>
              )}
              {page === "Invoices" && data && (
                <section className="panel">
                  <div className="panel-header">
                    <CardTitle icon={FileText}>
                      <h2>Customer invoices</h2>
                    </CardTitle>
                    <span className="subtle-tag">
                      Payments allocated separately
                    </span>
                  </div>
                  {finance && (
                    <ItemisedInvoice
                      {...shared}
                      customers={master.contacts.filter(
                        (c: Row) => c.type === "customer",
                      )}
                    />
                  )}
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
                          <th>Invoice / customer</th>
                          <th>Due date</th>
                          <th>Status</th>
                          <th className="right">Amount</th>
                          <th className="right">Outstanding</th>
                          <th>History / actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((i: Row) => (
                          <tr key={i.id}>
                            <td>
                              <strong className="table-main">{i.number}</strong>
                              <small>{i.customer}</small>
                            </td>
                            <td>{i.due}</td>
                            <td>
                              <Badge value={i.status} />
                            </td>
                            <td className="right">{fmt(i.amount)}</td>
                            <td className="right amount">
                              {fmt(i.outstanding)}
                            </td>
                            {
                              <td>
                                {finance &&
                                  i.lifecycle === "issued" &&
                                  i.status !== "paid" && (
                                    <button
                                      className="button secondary small"
                                      onClick={() =>
                                        form(
                                          "Allocate customer payment",
                                          [
                                            {
                                              name: "transaction_id",
                                              label: "Receipt internal ID",
                                              placeholder:
                                                "Copy from transaction details",
                                            },
                                            {
                                              name: "amount",
                                              label: "Amount to allocate (SLE)",
                                              type: "number",
                                            },
                                          ],
                                          `/invoices/${i.id}/allocate`,
                                          {},
                                          "POST",
                                          "Use an accepted receipt belonging to the same customer. Allocation does not create additional income.",
                                        )
                                      }
                                    >
                                      Allocate payment
                                      <ArrowRight size={13} />
                                    </button>
                                  )}
                                <InvoiceActions {...shared} invoice={i} />
                              </td>
                            }
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!data.length && <Empty />}
                  </div>
                </section>
              )}
              {page === "Statements" && (
                <>
                  {finance && (
                    <section className="panel import-panel">
                      <div className="panel-header">
                        <CardTitle icon={Upload}>
                          <h2>Import a statement</h2>
                          <p>
                            Preview first. Confirm only when your records look
                            right.
                          </p>
                        </CardTitle>
                        <span className="subtle-tag">
                          CSV or XLSX · up to 2 MB
                        </span>
                      </div>
                      <form
                        className="import-form"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!importFile) return;
                          setImportBusy(true);
                          setError("");
                          const values = Object.fromEntries(
                            new FormData(e.currentTarget),
                          );
                          const body = new FormData();
                          body.append("file", importFile);
                          body.append("account_id", importAccount);
                          body.append("mapping", JSON.stringify(values));
                          try {
                            setPreview(
                              await api("/imports/preview", "POST", body),
                            );
                            refresh("Statement preview ready");
                          } catch (err) {
                            setError((err as Error).message);
                          } finally {
                            setImportBusy(false);
                          }
                        }}
                      >
                        <div className="upload-area">
                          <Upload size={28} />
                          <h3>Bring your statement into focus</h3>
                          <p>
                            Dates: YYYY-MM-DD · Directions: in / out · Amounts:
                            123.45
                          </p>
                          <InputSurface>
                            <input
                              className="input"
                              aria-label="Statement file"
                              type="file"
                              accept=".csv,.xlsx"
                              required
                              onChange={(e) =>
                                setImportFile(e.target.files?.[0] || null)
                              }
                            />
                          </InputSurface>
                        </div>
                        <div className="form-grid">
                          <label>
                            Financial account
                            <InputSurface>
                              <select
                                className="input"
                                required
                                value={importAccount}
                                onChange={(e) =>
                                  setImportAccount(e.target.value)
                                }
                              >
                                <option value="">
                                  Select bank or mobile money account
                                </option>
                                {master.accounts
                                  .filter((a: Row) => a.channel !== "cash")
                                  .map((a: Row) => (
                                    <option value={a.id} key={a.id}>
                                      {a.name}
                                    </option>
                                  ))}
                              </select>
                            </InputSurface>
                          </label>
                          {[
                            "date",
                            "reference",
                            "amount",
                            "direction",
                            "description",
                            "currency",
                          ].map((key) => (
                            <label key={key}>
                              {key[0].toUpperCase() + key.slice(1)} column
                              <InputSurface>
                                <input
                                  className="input"
                                  name={key}
                                  defaultValue={key}
                                  placeholder={`Enter the ${key} column header`}
                                  required={
                                    !["description", "currency"].includes(key)
                                  }
                                />
                              </InputSurface>
                            </label>
                          ))}
                        </div>
                        <div className="import-action">
                          <span className="muted">
                            Column names must match the file header. Clear
                            optional mappings when absent.
                          </span>
                          <button className="button" disabled={importBusy}>
                            {importBusy ? "Reading file…" : "Preview statement"}
                            <Eye size={16} />
                          </button>
                        </div>
                      </form>
                    </section>
                  )}
                  {preview && (
                    <section className="panel">
                      <div className="panel-header">
                        <CardTitle icon={Eye}>
                          <h2>Preview: {preview.filename}</h2>
                          <p>
                            {preview.rows.length} valid rows ·{" "}
                            {preview.errors.length} excluded rows
                          </p>
                        </CardTitle>
                        <a
                          className="button secondary small"
                          href={`/api/imports/${preview.id}/errors`}
                        >
                          Download validation errors
                        </a>
                        {preview.status === "preview" && finance && (
                          <button
                            className="button"
                            disabled={importBusy || !preview.rows.length}
                            onClick={async () => {
                              setImportBusy(true);
                              try {
                                await api(
                                  `/imports/${preview.id}/commit`,
                                  "POST",
                                );
                                setPreview({ ...preview, status: "committed" });
                                refresh("Valid statement rows imported");
                              } catch (err) {
                                setError((err as Error).message);
                              } finally {
                                setImportBusy(false);
                              }
                            }}
                          >
                            <Check size={17} />
                            Confirm {preview.rows.length} valid rows
                          </button>
                        )}
                      </div>
                      {preview.warnings?.length > 0 && (
                        <div className="panel-note">
                          {preview.warnings.map((w: Row) => (
                            <p key={w.row}>
                              Row {w.row}: {w.warning}
                            </p>
                          ))}
                        </div>
                      )}
                      {preview.errors.length > 0 && (
                        <div className="import-errors">
                          {preview.errors.map((e: Row) => (
                            <p key={e.row}>
                              Row {e.row}: {e.error}
                            </p>
                          ))}
                        </div>
                      )}
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
                              <th>Row</th>
                              <th>Date</th>
                              <th>Reference</th>
                              <th>Direction</th>
                              <th className="right">Amount (SLE)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.rows.map((r: Row) => (
                              <tr key={r.row_number}>
                                <td>{r.row_number}</td>
                                <td>{r.date}</td>
                                <td>{r.reference || "Missing reference"}</td>
                                <td>{r.direction}</td>
                                <td className="right">{fmt(r.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                  <section className="panel">
                    <div className="panel-header">
                      <CardTitle icon={History}>
                        <h2>Import history</h2>
                      </CardTitle>
                      <a
                        className="button secondary small"
                        href="/samples/mobile-statement.csv"
                        download
                      >
                        Sample CSV
                        <Download size={14} />
                      </a>
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
                            <th>Statement</th>
                            <th>Account</th>
                            <th>Rows</th>
                            <th>Status</th>
                            <th>Review</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data || []).map((i: Row) => (
                            <tr key={i.id}>
                              <td>
                                <strong className="table-main">
                                  {i.filename}
                                </strong>
                                <small>{i.created_at}</small>
                              </td>
                              <td>{i.account_name}</td>
                              <td>
                                {i.valid} valid / {i.invalid} invalid
                              </td>
                              <td>
                                <Badge value={i.status} />
                              </td>
                              <td>
                                <button
                                  className="button secondary small"
                                  onClick={async () => {
                                    try {
                                      setPreview(await api(`/imports/${i.id}`));
                                    } catch (e) {
                                      setError((e as Error).message);
                                    }
                                  }}
                                >
                                  View preview <Eye size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!data?.length && (
                        <Empty
                          title="No statements imported"
                          description="Upload a bank or mobile money statement to begin reconciliation."
                        />
                      )}
                    </div>
                  </section>
                </>
              )}
              {page === "Reconciliation" && data && (
                <>
                  <div className="recon-summary">
                    {[
                      "suggested",
                      "reconciled",
                      "partially_matched",
                      "unmatched",
                      "duplicate",
                      "ambiguous",
                    ].map((s) => (
                      <div key={s}>
                        <strong>
                          {data.filter((r: Row) => r.status === s).length}
                        </strong>
                        <Badge value={s} />
                      </div>
                    ))}
                  </div>
                  <section className="panel">
                    <div className="panel-header">
                      <CardTitle icon={GitCompareArrows}>
                        <h2>Statement matching workspace</h2>
                        <p>
                          Exact reference, amount, date, direction and account ·
                          rule v1
                        </p>
                      </CardTitle>
                      <span className="subtle-tag">
                        Human confirmation required
                      </span>
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
                            <th>Statement evidence</th>
                            <th>Internal candidate</th>
                            <th>Result</th>
                            <th className="right">Amount</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.map((l: Row) => (
                            <tr key={l.id}>
                              <td>
                                <strong className="table-main">
                                  {l.reference || "No reference"}
                                </strong>
                                <small>Line ID: {l.id}</small>
                                <small>
                                  {l.date} · {l.account_name}
                                </small>
                              </td>
                              <td>
                                {l.candidates.length === 1 ? (
                                  <>
                                    <strong className="table-main">
                                      {l.candidates[0].description}
                                    </strong>
                                    <small>{l.candidates[0].reference}</small>
                                  </>
                                ) : l.reconciliation_id || l.group_id ? (
                                  "Evidence linked"
                                ) : l.candidates.length > 1 ? (
                                  `${l.candidates.length} possible records`
                                ) : (
                                  "No exact candidate"
                                )}
                              </td>
                              <td>
                                <Badge value={l.status} />
                              </td>
                              <td className="right amount">
                                {fmt(l.amount)}
                                <small>SLE · {l.direction}</small>
                                {BigInt(l.allocated_minor || 0) > 0n && (
                                  <small>
                                    Remaining: SLE {fmt(l.remaining_minor)}
                                  </small>
                                )}
                              </td>
                              <td>
                                {finance && l.status === "suggested" && (
                                  <button
                                    className="button secondary small"
                                    onClick={() =>
                                      form(
                                        "Confirm exact match",
                                        [
                                          {
                                            name: "reason",
                                            label: "Review note",
                                            type: "textarea",
                                            value:
                                              "Reviewed reference, amount, date, account and direction.",
                                          },
                                        ],
                                        "/reconciliation",
                                        {
                                          line_id: l.id,
                                          transaction_id: l.candidates[0].id,
                                        },
                                      )
                                    }
                                  >
                                    <Check size={15} />
                                    Confirm
                                  </button>
                                )}
                                {finance && l.status === "suggested" && (
                                  <button
                                    className="button secondary small"
                                    onClick={() =>
                                      form(
                                        "Reject exact suggestion",
                                        [
                                          {
                                            name: "reason",
                                            label:
                                              "Why this suggestion is incorrect",
                                            type: "textarea",
                                          },
                                        ],
                                        "/reconciliation/suggestions/reject",
                                        {
                                          line_id: l.id,
                                          transaction_id: l.candidates[0].id,
                                        },
                                      )
                                    }
                                  >
                                    Reject suggestion
                                  </button>
                                )}
                                {finance && l.reconciliation_id && (
                                  <button
                                    className="button secondary small"
                                    onClick={() =>
                                      form(
                                        "Undo reconciliation",
                                        [
                                          {
                                            name: "reason",
                                            label: "Reason",
                                            type: "textarea",
                                          },
                                        ],
                                        `/reconciliation/${l.reconciliation_id}/undo`,
                                      )
                                    }
                                  >
                                    Undo
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!data.length && (
                        <Empty
                          title="Ready when your statements are"
                          description="Import and confirm a statement to see matching suggestions and exceptions."
                        />
                      )}
                    </div>
                    <p className="panel-note">
                      Duplicate, ambiguous and unmatched rows remain exceptions.
                      Use the reviewed matching workspace below for split
                      settlements, fee-aware groups and tolerance suggestions.
                      Original evidence and decisions remain available.
                    </p>
                  </section>
                </>
              )}
              {page === "Reconciliation" && (
                <AdvancedReconciliation {...shared} />
              )}
              {page === "Exceptions" && data && (
                <ExceptionQueue {...shared} data={data} />
              )}
              {page === "Analytics" && data && (
                <AnalyticsPanel data={data} money={fmt} />
              )}
              {page === "Supplier bills" && data && (
                <SupplierBills
                  {...shared}
                  data={data}
                  contacts={master.contacts}
                />
              )}
              {page === "Approvals" && data && (
                <section className="panel">
                  <div className="panel-header">
                    <CardTitle icon={ShieldCheck}>
                      <h2>Pending outgoing payments</h2>
                      <p>
                        Each decision requires a reason and a different manager.
                      </p>
                    </CardTitle>
                    <span className="count-label">{data.length} to review</span>
                  </div>
                  {data.map((t: Row) => (
                    <article className="approval-card" key={t.id}>
                      <span className="stat-icon amber">
                        <ShieldCheck size={22} />
                      </span>
                      <div>
                        <h3>{t.description}</h3>
                        <p>
                          {t.user_name} · {t.date} · {t.account_name}
                        </p>
                        <small>{t.reference}</small>
                      </div>
                      <strong>SLE {fmt(t.amount)}</strong>
                      {(user.role === "manager" ||
                        master.permissions?.can_approve) &&
                      t.user_id !== user.id ? (
                        <div className="approval-actions">
                          {["approved", "rejected"].map((decision) => (
                            <button
                              key={decision}
                              className={`button ${decision === "rejected" ? "secondary" : ""}`}
                              onClick={() =>
                                form(
                                  decision === "approved"
                                    ? "Approve payment"
                                    : "Reject payment",
                                  [
                                    {
                                      name: "reason",
                                      label: "Decision reason",
                                      type: "textarea",
                                    },
                                  ],
                                  `/approvals/${t.id}`,
                                  { decision },
                                )
                              }
                            >
                              {decision === "approved" ? "Approve" : "Reject"}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <Badge
                          value={
                            t.user_id === user.id
                              ? "independent_review"
                              : "pending"
                          }
                        />
                      )}
                    </article>
                  ))}
                  {!data.length && (
                    <Empty
                      title="All caught up"
                      description="There are no outgoing payments awaiting a decision."
                    />
                  )}
                </section>
              )}
              {page === "Approvals" && user.role !== "admin" && (
                <ControlRequests {...shared} accounts={master.accounts} />
              )}
              {page === "Approvals" && (
                <ApprovalHistory
                  api={api}
                  params={params}
                  revision={revision}
                />
              )}
              {page === "Reports" && overview && (
                <>
                  <div className="report-intro">
                    <span className="report-icon">
                      <ChartNoAxesCombined size={32} />
                    </span>
                    <div>
                      <h2>From records to decisions.</h2>
                      <p>
                        Export the same filtered transactions used in your
                        dashboard. Invoice creation does not add to cash
                        inflows.
                      </p>
                    </div>
                  </div>
                  <div className="stat-grid reports-stats">
                    {[
                      ["Recorded inflows", overview.incoming, "green"],
                      ["Approved outflows", overview.outgoing, "orange"],
                      ["Net cash movement", overview.net, "blue"],
                    ].map(([label, value, tone]) => (
                      <div
                        className={`stat-card effect-card tone-${tone}`}
                        key={label}
                      >
                        <div className="stat-label">
                          <span className="stat-icon blue">
                            <ChartNoAxesCombined size={19} />
                          </span>
                          <span className="stat-title">{label}</span>
                        </div>
                        <div className="stat-value">
                          <span>SLE </span>
                          {fmt(value)}
                        </div>
                      </div>
                    ))}
                  </div>
                  {master.permissions?.can_export && (
                    <div className="report-grid">
                      {[
                        [
                          "csv",
                          "Transaction spreadsheet",
                          "A detailed CSV register for review in Excel. Amounts are exported as exact minor units.",
                        ],
                        [
                          "pdf",
                          "Transaction report",
                          "A shareable PDF with transaction details, approval status and active filters.",
                        ],
                      ].map(([format, title, description]) => (
                        <section
                          className={`panel report-card effect-card tone-${format === "csv" ? "green" : "purple"}`}
                          key={format}
                        >
                          <span className="card-icon" aria-hidden="true">
                            <FileText size={22} />
                          </span>
                          <h2>{title}</h2>
                          <p>{description}</p>
                          <a
                            className="button secondary"
                            href={exportUrl(format)}
                          >
                            <Download size={16} />
                            Download {format.toUpperCase()}
                          </a>
                        </section>
                      ))}
                    </div>
                  )}
                  <ReportCentre {...shared} params={params} />
                </>
              )}
              {page === "Audit trail" && data && (
                <section className="panel">
                  <div className="panel-header">
                    <CardTitle icon={History}>
                      <h2>Activity history</h2>
                      <p>Latest 200 immutable audit events</p>
                    </CardTitle>
                    <span className="subtle-tag">
                      <LockKeyhole size={13} />
                      Append-only
                    </span>
                  </div>
                  <div className="filter-bar">
                    <label>
                      User ID
                      <InputSurface>
                        <input
                          className="input"
                          value={extraFilters.user || ""}
                          onChange={(e) =>
                            setExtraFilters((v) => ({
                              ...v,
                              user: e.target.value,
                            }))
                          }
                          placeholder="Exact recorded user ID"
                        />
                      </InputSurface>
                    </label>
                    <label>
                      Action
                      <InputSurface>
                        <input
                          className="input"
                          value={extraFilters.action || ""}
                          onChange={(e) =>
                            setExtraFilters((v) => ({
                              ...v,
                              action: e.target.value,
                            }))
                          }
                          placeholder="e.g. transaction.create"
                        />
                      </InputSurface>
                    </label>
                    <label>
                      From date
                      <input
                        className="input"
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                    </label>
                    <label>
                      To date
                      <input
                        className="input"
                        type="date"
                        value={to}
                        min={from || undefined}
                        onChange={(e) => setTo(e.target.value)}
                      />
                    </label>
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
                          <th>Action</th>
                          <th>Performed by</th>
                          <th>Time (UTC)</th>
                          <th>Evidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((a: Row) => (
                          <tr key={a.id}>
                            <td>
                              <strong className="table-main">
                                {a.action.replaceAll(".", " / ")}
                              </strong>
                              <small className="truncate">{a.entity}</small>
                            </td>
                            <td>{a.user_name || "System"}</td>
                            <td className="nowrap">{a.created_at}</td>
                            <td>
                              <details>
                                <summary>View details</summary>
                                <pre>
                                  {JSON.stringify(
                                    JSON.parse(a.details),
                                    null,
                                    2,
                                  )}
                                </pre>
                              </details>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              {page === "Settings" && data && (
                <>
                  {user.role === "manager" && <ApprovalPolicy {...shared} />}
                  {user.role === "admin" && <AdminConfiguration {...shared} />}
                  {finance && (
                    <ReferenceCategories
                      {...shared}
                      canEdit={finance}
                      categories={master.categories || []}
                    />
                  )}
                  {user.role === "admin" && (
                    <section className="panel">
                      <div className="panel-header">
                        <CardTitle icon={Download}>
                          <h2>Database backup</h2>
                          <p>
                            Includes private financial evidence. Store securely.
                            Restoration is an offline operator procedure.
                          </p>
                        </CardTitle>
                        <a
                          className="button secondary small"
                          href="/api/backup"
                        >
                          <Download size={16} />
                          Download consistent backup
                        </a>
                      </div>
                    </section>
                  )}
                  <section className="panel settings-panel">
                    <div className="panel-header">
                      <CardTitle icon={Settings}>
                        <h2>Organisation settings</h2>
                      </CardTitle>
                      {user.role === "admin" && (
                        <button
                          className="button secondary small"
                          onClick={() =>
                            form(
                              "Update organisation",
                              [
                                {
                                  name: "name",
                                  label: "Organisation name",
                                  value: data.organisation.name,
                                },
                              ],
                              "/settings",
                              {},
                              "PATCH",
                            )
                          }
                        >
                          Edit settings
                        </button>
                      )}
                    </div>
                    <dl className="settings-grid">
                      <div>
                        <dt>Organisation</dt>
                        <dd>{data.organisation.name}</dd>
                      </div>
                      <div>
                        <dt>Currency</dt>
                        <dd>SLE · 2 decimal places</dd>
                      </div>
                      <div>
                        <dt>Timezone</dt>
                        <dd>Africa/Freetown</dd>
                      </div>
                      <div>
                        <dt>Your role</dt>
                        <dd>{roleLabel[user.role]}</dd>
                      </div>
                    </dl>
                    <div className="settings-actions">
                      <button
                        className="button secondary"
                        onClick={changePassword}
                      >
                        <LockKeyhole size={16} />
                        Change password
                      </button>
                      {user.role === "admin" && (
                        <button
                          className="button secondary"
                          onClick={() =>
                            form(
                              "Create user",
                              [
                                { name: "name", label: "Full name" },
                                {
                                  name: "email",
                                  label: "Email address",
                                  type: "email",
                                },
                                {
                                  name: "password",
                                  label: "Initial password (12+ characters)",
                                  type: "password",
                                },
                                {
                                  name: "role",
                                  label: "Role",
                                  options: Object.entries(roleLabel).map(
                                    ([value, label]) => ({ value, label }),
                                  ),
                                },
                              ],
                              "/users",
                            )
                          }
                        >
                          <Plus size={16} />
                          Create user
                        </button>
                      )}
                    </div>
                  </section>
                  {finance && (
                    <section className="panel">
                      <div className="panel-header">
                        <CardTitle icon={LockKeyhole}>
                          <h2>Reporting periods</h2>
                          <p>
                            Closed periods prevent transaction changes and new
                            reconciliation.
                          </p>
                        </CardTitle>
                      </div>
                      {user.role === "manager" && (
                        <div className="period-actions">
                          <button
                            className="button secondary small"
                            onClick={() =>
                              setModal(
                                <FormModal
                                  title="Close reporting period"
                                  fields={[
                                    {
                                      name: "month",
                                      label: "Month",
                                      type: "month",
                                      value: today().slice(0, 7),
                                    },
                                    {
                                      name: "reason",
                                      label: "Reason",
                                      type: "textarea",
                                    },
                                  ]}
                                  onClose={() => setModal(null)}
                                  onSubmit={async (v) => {
                                    await api("/periods", "POST", {
                                      ...v,
                                      closed: true,
                                    });
                                    refresh("Period closed");
                                  }}
                                />,
                              )
                            }
                          >
                            Close period
                          </button>
                          <button
                            className="button secondary small"
                            onClick={() =>
                              setModal(
                                <FormModal
                                  title="Reopen reporting period"
                                  fields={[
                                    {
                                      name: "month",
                                      label: "Month",
                                      type: "month",
                                      value: today().slice(0, 7),
                                    },
                                    {
                                      name: "reason",
                                      label: "Reason",
                                      type: "textarea",
                                    },
                                  ]}
                                  onClose={() => setModal(null)}
                                  onSubmit={async (v) => {
                                    await api("/periods", "POST", {
                                      ...v,
                                      closed: false,
                                    });
                                    refresh("Period reopened");
                                  }}
                                />,
                              )
                            }
                          >
                            Reopen period
                          </button>
                        </div>
                      )}
                      {data.periods.length ? (
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
                                <th>Month</th>
                                <th>Status</th>
                                <th>Reason</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.periods.map((p: Row) => (
                                <tr key={p.month}>
                                  <td>{p.month}</td>
                                  <td>
                                    <Badge
                                      value={p.closed ? "closed" : "open"}
                                    />
                                  </td>
                                  <td>{p.reason}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <Empty
                          title="No period controls applied"
                          description="A manager can close completed reporting months after all approvals are resolved."
                        />
                      )}
                    </section>
                  )}
                </>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              <span className="footer-logo">f.</span>FinBiz 360 · A clearer
              picture of your business.
            </span>
            <span>Internal financial workspace · SLE</span>
          </footer>
        </div>
      </main>
      {modal}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
function CashChart({ trend }: { trend: Row[] }) {
  if (!trend.length)
    return (
      <Empty
        title="Your cash flow starts here"
        description="Record a transaction to start building your financial picture."
      />
    );
  const groups: Row[] = [];
  const size = Math.max(1, Math.ceil(trend.length / 14));
  for (let i = 0; i < trend.length; i += size) {
    const part = trend.slice(i, i + size);
    groups.push({
      date: part[0].date,
      in: part.reduce((s, t) => s + Number(t.in), 0),
      out: part.reduce((s, t) => s + Number(t.out), 0),
    });
  }
  const max = Math.max(...groups.map((g) => Math.max(g.in, g.out)), 1),
    height = 190,
    width = 700,
    pad = 55,
    plotWidth = width - pad - 12,
    step = plotWidth / groups.length,
    bar = Math.min(17, step * 0.3);
  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${width} 255`}
        role="img"
        aria-label="Cash inflow and outflow bar chart"
      >
        <title>Cash flow in SLE, grouped chronologically</title>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line
              x1={pad}
              x2={width}
              y1={20 + height * (1 - v)}
              y2={20 + height * (1 - v)}
              stroke="var(--line)"
              strokeDasharray="3 4"
            />
            <text
              x={pad - 12}
              y={24 + height * (1 - v)}
              textAnchor="end"
              fill="var(--muted)"
              fontSize="18"
            >
              {new Intl.NumberFormat("en", { notation: "compact" }).format(
                (max * v) / 100,
              )}
            </text>
          </g>
        ))}
        {groups.map((g, i) => (
          <g key={g.date}>
            <rect
              x={pad + i * step + step / 2 - bar - 2}
              y={20 + height * (1 - g.in / max)}
              width={bar}
              height={(height * g.in) / max}
              rx="3"
              fill="var(--primary)"
            >
              <title>
                {g.date}: inflow SLE {fmt(g.in)}
              </title>
            </rect>
            <rect
              x={pad + i * step + step / 2 + 2}
              y={20 + height * (1 - g.out / max)}
              width={bar}
              height={(height * g.out) / max}
              rx="3"
              fill="var(--brand-start)"
              stroke="var(--teal)"
              strokeWidth="1"
            >
              <title>
                {g.date}: outflow SLE {fmt(g.out)}
              </title>
            </rect>
            {(i % Math.max(1, Math.ceil(groups.length / 7)) === 0 ||
              i === groups.length - 1) && (
              <text
                x={pad + i * step + step / 2}
                y="237"
                textAnchor="middle"
                fill="var(--muted)"
                fontSize="18"
              >
                {new Date(g.date + "T00:00:00Z").toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  timeZone: "UTC",
                })}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
function UserAdmin({
  revision,
  refresh,
  form,
}: {
  revision: number;
  refresh: (message?: string) => void;
  form: (
    title: string,
    fields: Field[],
    path: string,
    extra?: Row,
    method?: string,
    description?: string,
  ) => void;
}) {
  const [userQuery, setUserQuery] = useState(""),
    [userRole, setUserRole] = useState(""),
    [userStatus, setUserStatus] = useState(""),
    [resetUser, setResetUser] = useState<Row | null>(null);
  const [users, setUsers] = useState<Row[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api(
      `/users?q=${encodeURIComponent(userQuery)}&role=${userRole}${userStatus ? `&active=${userStatus}` : ""}`,
    )
      .then((r) => {
        if (live) {
          setUsers(r);
          setError("");
        }
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [revision, userQuery, userRole, userStatus]);
  return (
    <section className="panel">
      <div className="panel-header">
        <CardTitle icon={Users}>
          <h2>User access</h2>
        </CardTitle>
        <button
          className="button"
          onClick={() =>
            form(
              "Create user",
              [
                { name: "name", label: "Full name" },
                { name: "email", label: "Email address", type: "email" },
                {
                  name: "password",
                  label: "Initial password (12+ characters)",
                  type: "password",
                },
                {
                  name: "role",
                  label: "Role",
                  options: Object.entries(roleLabel).map(([value, label]) => ({
                    value,
                    label,
                  })),
                },
              ],
              "/users",
            )
          }
        >
          <Plus size={16} /> Create user
        </button>
      </div>
      <div className="filter-bar">
        <label>
          Search staff
          <InputSurface>
            <input
              className="input"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Name or email"
            />
          </InputSurface>
        </label>
        <label>
          Role
          <select
            className="input"
            value={userRole}
            onChange={(e) => setUserRole(e.target.value)}
          >
            <option value="">All roles</option>
            {Object.entries(roleLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            className="input"
            value={userStatus}
            onChange={(e) => setUserStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
        </label>
      </div>
      {resetUser && (
        <PasswordReset
          user={resetUser}
          api={api}
          refresh={refresh}
          onClose={() => setResetUser(null)}
        />
      )}
      <details className="user-role-guide">
        <summary>Role responsibilities and access</summary>
        <dl className="settings-grid">
          {Object.entries(roleWorkspaces).map(([role, workspace]) => (
            <div key={role}>
              <dt>{roleLabel[role]}</dt>
              <dd>{workspace.description}</dd>
            </div>
          ))}
        </dl>
      </details>
      {error && <div className="error">{error}</div>}
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
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Registered / last sign-in (UTC)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.name}</strong>
                  <small>{u.email}</small>
                </td>
                <td>{roleLabel[u.role]}</td>
                <td>
                  <Badge value={u.active ? "active" : "inactive"} />
                </td>
                <td>
                  <small>Registered: {u.registered_at || "Not recorded"}</small>
                  <small>
                    Last sign-in: {u.last_login_at || "Not recorded"}
                  </small>
                </td>
                <td>
                  <button
                    className="button secondary small"
                    onClick={() =>
                      form(
                        "Edit user",
                        [
                          { name: "name", label: "Full name", value: u.name },
                          {
                            name: "email",
                            label: "Email",
                            type: "email",
                            value: u.email,
                          },
                          {
                            name: "role",
                            label: "Role",
                            value: u.role,
                            options: Object.entries(roleLabel).map(
                              ([value, label]) => ({ value, label }),
                            ),
                          },
                          {
                            name: "reason",
                            label: "Change reason",
                            type: "textarea",
                          },
                        ],
                        `/users/${u.id}`,
                        {},
                        "PATCH",
                      )
                    }
                  >
                    Edit user
                  </button>
                  <button
                    className="button secondary small"
                    onClick={async () => {
                      try {
                        await api(`/users/${u.id}`, "PATCH", {
                          active: !u.active,
                        });
                        refresh("User access updated");
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    {u.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    className="button secondary small"
                    onClick={() => setResetUser(u)}
                  >
                    Reset password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
