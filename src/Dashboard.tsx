import { useEffect, useId, useRef, useState } from "react";
import { canOpenPage } from "./roleWorkspace";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  CircleAlert,
  Clock3,
  FileText,
  Landmark,
  Lightbulb,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Upload,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

type Row = Record<string, any>;
type Money = (value?: string | number) => string;

export function WorkspaceTopbar({
  user,
  pending,
  notificationRevision = 0,
  readAll,
  onMenu,
  menuOpen = false,
  onNavigate,
  onSearch,
  onRefresh,
  api,
  page,
  company,
  accounts = [],
  account = "",
  onAccount,
  from = "",
  to = "",
  onFrom,
  onTo,
}: {
  user: Row;
  pending: number;
  notificationRevision?: number;
  readAll: boolean;
  onMenu: () => void;
  menuOpen?: boolean;
  onNavigate: (page: string) => void;
  onSearch: (query: string) => void;
  onRefresh: () => void;
  api?: (path: string) => Promise<any>;
  page?: string;
  company?: string;
  accounts?: Row[];
  account?: string;
  onAccount?: (value: string) => void;
  from?: string;
  to?: string;
  onFrom?: (value: string) => void;
  onTo?: (value: string) => void;
}) {
  const [notificationOpen, setNotificationOpen] = useState(false),
    [notices, setNotices] = useState<Row[]>([]),
    [noticeError, setNoticeError] = useState("");
  useEffect(() => {
    if (!api) return;
    let live = true;
    const load = () =>
      api("/notifications")
        .then((r) => {
          if (live) {
            setNotices(r.items);
            setNoticeError("");
          }
        })
        .catch(
          () =>
            live && setNoticeError("Activity notifications could not load."),
        );
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 15000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [api, user.id, notificationRevision]);
  const [search, setSearch] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<Row | null>(null),
    [searchError, setSearchError] = useState("");
  useEffect(() => {
    let live = true;
    if (!api || search.trim().length < 2) {
      setResults(null);
      return;
    }
    const timer = window.setTimeout(() => {
      api("/search?q=" + encodeURIComponent(search.trim()))
        .then((r) => {
          if (live) {
            setResults(r);
            setSearchError("");
          }
        })
        .catch(() => {
          if (live) setSearchError("Search could not load. Try again.");
        });
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [search, api]);
  useEffect(() => {
    const focus = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", focus);
    return () => window.removeEventListener("keydown", focus);
  }, []);
  return (
    <header className="workspace-topbar">
      <button
        className="icon-button mobile-menu"
        aria-label="Open navigation"
        aria-expanded={menuOpen}
        aria-controls="workspace-navigation"
        onClick={onMenu}
      >
        <Menu />
      </button>
      {user.role !== "admin" && (
        <form
          className="workspace-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setResults(null);
            onSearch(search.trim());
          }}
        >
          <Search size={20} aria-hidden="true" />
          <input
            ref={input}
            aria-label="Search transactions, contacts and documents"
            placeholder="Search anything… (Ctrl + K)"
            autoComplete="off"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setResults(null);
                input.current?.blur();
              }
            }}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="submit" aria-label="Search transactions">
            <ArrowRight size={17} />
          </button>
          {searchError && (
            <span className="global-search-error" role="status">
              {searchError}
            </span>
          )}
          {results && (
            <div className="global-search-results">
              <div className="global-search-heading">
                <strong>Search results</strong>
                <button type="button" onClick={() => setResults(null)}>
                  Close
                </button>
              </div>
              {results.transactions.map((t: Row) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => {
                    setResults(null);
                    onSearch(t.reference || t.description);
                  }}
                >
                  <span>Transaction</span>
                  <strong>{t.reference || t.description}</strong>
                </button>
              ))}
              {results.contacts
                .filter((c: Row) =>
                  canOpenPage(
                    user.role,
                    c.type === "supplier" ? "Suppliers" : "Customers",
                  ),
                )
                .map((c: Row) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => {
                      setResults(null);
                      onNavigate(
                        c.type === "supplier" ? "Suppliers" : "Customers",
                      );
                    }}
                  >
                    <span>{c.type}</span>
                    <strong>{c.name}</strong>
                  </button>
                ))}
              {results.documents
                .filter((d: Row) =>
                  canOpenPage(
                    user.role,
                    d.document_kind === "invoice"
                      ? "Invoices"
                      : "Supplier bills",
                  ),
                )
                .map((d: Row) => (
                  <button
                    type="button"
                    key={d.id}
                    onClick={() => {
                      setResults(null);
                      onNavigate(
                        d.document_kind === "invoice"
                          ? "Invoices"
                          : "Supplier bills",
                      );
                    }}
                  >
                    <span>Document</span>
                    <strong>
                      {d.number} · {d.contact_name}
                    </strong>
                  </button>
                ))}
              {!results.transactions.length &&
                !results.contacts.length &&
                !results.documents.length && <p>No matching records.</p>}
            </div>
          )}
        </form>
      )}
      <div className="workspace-topbar-tools">
        {onAccount && (
          <label className="header-account">
            <span>{company || "Company account"}</span>
            <select
              aria-label="Account scope"
              value={account}
              onChange={(e) => onAccount(e.target.value)}
            >
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          className="dashboard-refresh"
          aria-label="Refresh company records"
          title="Refresh company records"
          onClick={onRefresh}
        >
          <RefreshCw size={18} />
        </button>
        <div className="role-notifications">
          <button
            className="dashboard-notifications"
            aria-label="Open role activity notifications"
            aria-expanded={notificationOpen}
            onClick={() => setNotificationOpen((v) => !v)}
          >
            <Bell size={23} />
            {user.role === "manager" && pending > 0 && <span>{pending}</span>}
          </button>
          {notificationOpen && (
            <section
              className="role-notification-popover"
              aria-label="Role activity notifications"
              onKeyDown={(e) => {
                if (e.key === "Escape") setNotificationOpen(false);
              }}
            >
              <header>
                <strong>Workspace activity</strong>
                <button
                  className="button secondary small"
                  onClick={() => setNotificationOpen(false)}
                >
                  Close
                </button>
              </header>
              {noticeError && <p role="alert">{noticeError}</p>}
              {notices.length
                ? notices.map((n) => (
                    <button
                      className="notification-row"
                      key={n.id}
                      onClick={() => {
                        setNotificationOpen(false);
                        onNavigate(n.page);
                      }}
                    >
                      <strong>
                        {String(n.title)
                          .replaceAll(".", " / ")
                          .replaceAll("_", " ")}
                      </strong>
                      <span>{n.detail}</span>
                    </button>
                  ))
                : !noticeError && <p>No recorded activity notifications.</p>}
              <small>
                Based on saved records; these are recent events, not unread
                messages.
              </small>
            </section>
          )}
        </div>
        {onFrom && onTo && (
          <details className="header-date-controls">
            <summary className="workspace-date">
              <CalendarDays size={19} />
              {new Intl.DateTimeFormat("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "Africa/Freetown",
              }).format(new Date())}
            </summary>
            <div className="header-date-popover">
              <label>
                From
                <input
                  type="date"
                  value={from}
                  onChange={(e) => onFrom?.(e.target.value)}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  min={from || undefined}
                  value={to}
                  onChange={(e) => onTo?.(e.target.value)}
                />
              </label>
              <button
                className="button secondary small"
                onClick={() => {
                  onFrom?.("");
                  onTo?.("");
                }}
              >
                All recorded dates
              </button>
            </div>
          </details>
        )}
        <button
          className="workspace-profile"
          aria-label={`Open profile for ${user.name}`}
          title={user.name}
          onClick={() => onNavigate("Profile")}
        >
          {String(user.name)
            .split(" ")
            .map((word) => word[0])
            .slice(0, 2)
            .join("")}
          <span />
        </button>
      </div>
    </header>
  );
}

function FinancialChart({
  trend,
  money,
  mini = false,
  field = "in",
}: {
  trend: Row[];
  money: Money;
  mini?: boolean;
  field?: "in" | "out" | "net";
}) {
  const uid = useId().replaceAll(":", "");
  const rows = [...trend].sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length)
    return mini ? null : (
      <div className="dashboard-chart-empty">
        <ChartNoAxesCombined size={36} />
        <strong>Your financial picture starts here</strong>
        <p>
          Record accepted transactions to see your income and expenses over
          time.
        </p>
      </div>
    );
  const amounts = rows.flatMap((row) => [
    Number(row.in) / 100,
    Number(row.out) / 100,
  ]);
  const max = Math.max(...amounts, 1);
  const min =
    field === "net" && mini
      ? Math.min(0, ...rows.map((r) => (Number(r.in) - Number(r.out)) / 100))
      : 0;
  const top = 18,
    bottom = mini ? 78 : 222,
    left = mini ? 0 : 56,
    right = mini ? 240 : 736;
  const points = (key: "in" | "out" | "net") =>
    rows.map((row, i) => {
      const amount =
        key === "net"
          ? (Number(row.in) - Number(row.out)) / 100
          : Number(row[key]) / 100;
      return [
        rows.length === 1
          ? (left + right) / 2
          : left + (i * (right - left)) / (rows.length - 1),
        bottom - ((amount - min) / (max - min)) * (bottom - top),
      ];
    });
  const line = (key: "in" | "out" | "net") =>
    points(key)
      .map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`)
      .join(" ");
  const area = (key: "in" | "out" | "net") =>
    `${line(key)} L${points(key).at(-1)![0]},${bottom} L${points(key)[0][0]},${bottom} Z`;
  return (
    <svg
      className={mini ? "metric-sparkline" : "financial-area-chart"}
      viewBox={mini ? "0 0 240 80" : "0 0 760 264"}
      role="img"
      aria-label={
        mini
          ? "Recorded movement trend"
          : "Accepted inflows and outflows in SLE by transaction date"
      }
    >
      <defs>
        <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="currentColor" stopOpacity=".22" />
          <stop offset="1" stopColor="currentColor" stopOpacity=".01" />
        </linearGradient>
      </defs>
      {!mini &&
        [0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <g key={fraction}>
            <line
              x1={left}
              x2={right}
              y1={bottom - fraction * (bottom - top)}
              y2={bottom - fraction * (bottom - top)}
              stroke="#e5eff3"
            />
            <text
              x={left - 12}
              y={bottom - fraction * (bottom - top) + 5}
              textAnchor="end"
            >
              {new Intl.NumberFormat("en", {
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(max * fraction)}
            </text>
          </g>
        ))}
      {(mini ? [field] : (["in", "out"] as const)).map((key) => (
        <g key={key} className={mini ? undefined : `chart-series-${key}`}>
          <path d={area(key)} fill={`url(#${uid}-fill)`} />
          <path
            d={line(key)}
            fill="none"
            stroke="currentColor"
            strokeWidth={mini ? 2 : 3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {!mini &&
            points(key).map(([x, y], i) => (
              <circle
                key={rows[i].date}
                cx={x}
                cy={y}
                r="4"
                fill="currentColor"
                stroke="white"
                strokeWidth="2"
              >
                <title>
                  {`${rows[i].date}: ${key === "in" ? "Inflows" : "Outflows"} SLE ${money(rows[i][key])}`}
                </title>
              </circle>
            ))}
        </g>
      ))}
      {!mini &&
        rows
          .filter(
            (_, i) =>
              i % Math.max(1, Math.ceil(rows.length / 5)) === 0 ||
              i === rows.length - 1,
          )
          .map((row) => {
            const i = rows.indexOf(row);
            const x = points("in")[i][0];
            return (
              <text key={row.date} x={x} y="251" textAnchor="middle">
                {new Intl.DateTimeFormat("en-GB", {
                  day: "numeric",
                  month: "short",
                  timeZone: "UTC",
                }).format(new Date(row.date + "T00:00:00Z"))}
              </text>
            );
          })}
    </svg>
  );
}

function WorkspaceArt() {
  return (
    <div className="welcome-art" aria-hidden="true">
      <div className="welcome-laptop">
        <div>
          <ChartNoAxesCombined size={88} strokeWidth={1.5} />
        </div>
        <span />
      </div>
      <div className="welcome-plant">
        <i />
        <i />
        <i />
        <span />
      </div>
    </div>
  );
}

export default function Dashboard({
  overview,
  user,
  role,
  accounts,
  readAll,
  canRecord,
  canManageAccounts,
  onRecord,
  onNavigate,
  money,
  from,
  to,
  account,
  onFrom,
  onTo,
  onAccount,
  lastUpdated,
  demo,
}: {
  overview: Row;
  user: Row;
  role: string;
  accounts: Row[];
  readAll: boolean;
  canRecord: boolean;
  canManageAccounts: boolean;
  onRecord: () => void;
  onNavigate: (page: string) => void;
  money: Money;
  from: string;
  to: string;
  account: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  onAccount: (v: string) => void;
  lastUpdated: Date | null;
  demo: boolean;
}) {
  const net = BigInt(overview.net);
  const metrics = [
    {
      title: "Net Cash Movement",
      value: `SLE ${money(overview.net)}`,
      icon: Wallet,
      tone: "blue",
      foot: "Accepted inflows less outflows",
      field: "net" as const,
    },
    {
      title: "Total Inflows",
      value: `SLE ${money(overview.incoming)}`,
      icon: ArrowLeftRight,
      tone: "green",
      foot: "Accepted receipts",
      field: "in" as const,
    },
    {
      title: "Total Outflows",
      value: `SLE ${money(overview.outgoing)}`,
      icon: ArrowUpRight,
      tone: "orange",
      foot: "Approved payments",
      field: "out" as const,
    },
    {
      title: "Transactions",
      value: `${overview.count} Records`,
      icon: FileText,
      tone: "purple",
      foot: `${overview.pending} awaiting approval`,
      field: "in" as const,
    },
  ];
  const actions = [
    {
      label: "Record Transaction",
      icon: Wallet,
      action: onRecord,
      visible: canRecord,
      tone: "teal",
    },
    {
      label: "Import Statement",
      icon: Upload,
      action: () => onNavigate("Statements"),
      visible: canRecord && readAll,
      tone: "cyan",
    },
    {
      label: "Run Reconciliation",
      icon: RefreshCw,
      action: () => onNavigate("Reconciliation"),
      visible: readAll,
      tone: "green",
    },
    {
      label: "View Reports",
      icon: ChartNoAxesCombined,
      action: () => onNavigate("Reports"),
      visible: readAll,
      tone: "blue",
    },
    {
      label: "Manage Customers",
      icon: Users,
      action: () => onNavigate("Customers"),
      visible: true,
      tone: "purple",
    },
  ].filter((a) => a.visible);
  return (
    <div className="reference-dashboard">
      <section className="dashboard-welcome">
        <div>
          <h1>
            Welcome back, {String(user.name).split(" ")[0]}!{" "}
            <span aria-hidden="true">👋</span>
          </h1>
          <p>Here’s your business overview at a glance.</p>
        </div>
        <WorkspaceArt />
        {canRecord && (
          <button className="welcome-record button" onClick={onRecord}>
            <Plus size={20} />
            Record Transaction
            <ArrowRight size={17} />
          </button>
        )}
      </section>
      {user.role === "manager" && (
        <section className="reference-panel manager-decisions">
          <div>
            <h2>Manager decisions</h2>
            <p>
              Review outgoing payments and independently decide financial
              control requests.
            </p>
          </div>
          <button className="button" onClick={() => onNavigate("Approvals")}>
            Review {overview.pending} pending payments
          </button>
          <button
            className="button secondary"
            onClick={() => onNavigate("Settings")}
          >
            Financial controls and delegation
          </button>
        </section>
      )}
      <div className="reference-metrics">
        {metrics.map(({ title, value, icon: Icon, tone, foot, field }, i) => (
          <section
            className={`reference-metric effect-card tone-${tone}`}
            key={title}
          >
            <span className="metric-icon">
              <Icon size={29} />
            </span>
            <div className="metric-copy">
              <h2>{title}</h2>
              <strong>{value}</strong>
              <span className="metric-note">{foot}</span>
            </div>
            {i !== 3 && (
              <FinancialChart
                trend={overview.trend}
                money={money}
                mini
                field={field}
              />
            )}
          </section>
        ))}
      </div>
      <div className="reference-dashboard-grid">
        <section className="reference-panel financial-panel">
          <header>
            <div className="reference-panel-title">
              <span className="panel-symbol">
                <ChartNoAxesCombined size={27} />
              </span>
              <div>
                <h2>Financial Overview</h2>
                <p>A clear view of your recorded cash movement.</p>
              </div>
            </div>
            <details className="dashboard-range">
              <summary>
                <CalendarDays size={15} />
                {from || to ? "Custom period" : "All dates"}
              </summary>
              <div className="dashboard-range-popover">
                <label>
                  From
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => onFrom(e.target.value)}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={to}
                    min={from || undefined}
                    onChange={(e) => onTo(e.target.value)}
                  />
                </label>
                <label>
                  Account
                  <select
                    value={account}
                    onChange={(e) => onAccount(e.target.value)}
                  >
                    <option value="">All accounts</option>
                    {accounts.map((a) => (
                      <option value={a.id} key={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="button secondary small"
                  onClick={() => {
                    onFrom("");
                    onTo("");
                    onAccount("");
                  }}
                >
                  Reset filters
                </button>
              </div>
            </details>
          </header>
          <div className="reference-legend">
            <span>
              <i />
              Inflows
            </span>
            <span>
              <i />
              Outflows
            </span>
          </div>
          <FinancialChart trend={overview.trend} money={money} />
          <p className="chart-scope">
            {role} · {demo ? "Synthetic demo" : "Company records"}
            {account ? " · Selected account" : " · All accounts"}
          </p>
        </section>
        <section className="reference-panel insights-panel">
          <header>
            <div className="reference-panel-title">
              <Lightbulb size={27} className="insights-bulb" />
              <h2>Business Insights</h2>
            </div>
            {readAll && (
              <button
                className="reference-link"
                onClick={() => onNavigate("Reports")}
              >
                View More
                <ArrowRight size={16} />
              </button>
            )}
          </header>
          <div className="cash-insight">
            <ChartNoAxesCombined size={43} />
            <div>
              <h3>
                {net > 0n
                  ? "Your cash flow is positive!"
                  : net < 0n
                    ? "Outflows exceed inflows."
                    : overview.count
                      ? "Cash movement is balanced."
                      : "Your workspace is ready."}
              </h3>
              <p>
                {overview.count
                  ? `Net recorded movement is SLE ${money(overview.net)} in this view.`
                  : "Add your accounts and record transactions to build your financial picture."}
              </p>
            </div>
          </div>
          <div className="insight-rows">
            {readAll && (
              <button onClick={() => onNavigate("Approvals")}>
                <span className="insight-icon alert">
                  <CircleAlert size={19} />
                </span>
                <span>{overview.pending} payments awaiting approval.</span>
                <ArrowRight size={16} />
              </button>
            )}
            {readAll && (
              <button onClick={() => onNavigate("Reconciliation")}>
                <span className="insight-icon">
                  <RefreshCw size={19} />
                </span>
                <span>
                  {overview.reconciled} records reconciled in this view.
                </span>
                <ArrowRight size={16} />
              </button>
            )}
            <button onClick={() => onNavigate("Accounts")}>
              <span className="insight-icon success">
                <Landmark size={19} />
              </span>
              <span>{accounts.length} financial accounts configured.</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
        <section className="reference-panel quick-actions-panel">
          <header>
            <div className="reference-panel-title">
              <Zap size={25} />
              <h2>Quick Actions</h2>
            </div>
          </header>
          <div className="reference-quick-actions">
            {actions.map(({ label, icon: Icon, action, tone }) => (
              <button key={label} className={`tone-${tone}`} onClick={action}>
                <span className="metric-icon">
                  <Icon size={27} />
                </span>
                <strong>{label}</strong>
              </button>
            ))}
          </div>
        </section>
        <section className="reference-panel activity-panel">
          <header>
            <div className="reference-panel-title">
              <Clock3 size={25} />
              <h2>Recent Activity</h2>
            </div>
            <button
              className="reference-link"
              onClick={() => onNavigate("Transactions")}
            >
              View All
              <ArrowRight size={16} />
            </button>
          </header>
          {overview.recent.length ? (
            <div className="reference-activity-list">
              {overview.recent.slice(0, 3).map((t: Row) => (
                <button key={t.id} onClick={() => onNavigate("Transactions")}>
                  <span
                    className={`activity-icon ${t.direction === "in" ? "receipt" : "payment"}`}
                  >
                    {t.direction === "in" ? (
                      <ArrowDownLeft size={22} />
                    ) : (
                      <ArrowUpRight size={22} />
                    )}
                  </span>
                  <span>
                    <strong>{t.description || "Transaction recorded"}</strong>
                    <small>
                      {t.account_name} · SLE {money(t.amount)}
                    </small>
                  </span>
                  <time dateTime={t.date}>
                    {new Intl.DateTimeFormat("en-GB", {
                      day: "numeric",
                      month: "short",
                      timeZone: "UTC",
                    }).format(new Date(t.date + "T00:00:00Z"))}
                  </time>
                </button>
              ))}
            </div>
          ) : (
            <div className="activity-empty">
              <Clock3 size={26} />
              <p>No transactions recorded yet.</p>
              {canRecord && (
                <button className="reference-link" onClick={onRecord}>
                  Record your first transaction
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          )}
        </section>
      </div>
      {overview.accounts.length > 0 && (
        <details className="dashboard-account-summary">
          <summary>
            <Landmark size={18} />
            Account balances & movement
          </summary>
          <div>
            {overview.accounts.map((item: Row) => (
              <button key={item.id} onClick={() => onNavigate("Accounts")}>
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.channel === "mobile"
                      ? "Mobile money"
                      : item.channel === "bank"
                        ? "Bank"
                        : "Cash"}
                  </small>
                </span>
                <span>
                  <strong>SLE {money(item.closing || item.balance)}</strong>
                  <small>Movement: {money(item.balance)}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        </details>
      )}
      {readAll && (
        <>
          <div className="dashboard-obligations">
            <button onClick={() => onNavigate("Invoices")}>
              <span>Outstanding customer invoices</span>
              <strong>
                SLE {money(overview.outstanding_customers || "0")}
              </strong>
              <small>Open invoice balances</small>
            </button>
            <button onClick={() => onNavigate("Supplier bills")}>
              <span>Outstanding supplier bills</span>
              <strong>
                SLE {money(overview.outstanding_suppliers || "0")}
              </strong>
              <small>Approved allocations deducted</small>
            </button>
            <button onClick={() => onNavigate("Exceptions")}>
              <span>Unmatched accepted transactions</span>
              <strong>{overview.unmatched || 0}</strong>
              <small>Selected date and account scope</small>
            </button>
          </div>
          <p className="dashboard-obligation-scope">
            {overview.document_scope}
          </p>
        </>
      )}
      {!accounts.length && canManageAccounts && (
        <button
          className="dashboard-onboarding"
          onClick={() => onNavigate("Accounts")}
        >
          <Plus size={18} />
          <span>Add your first cash, bank or mobile money account</span>
          <ArrowRight size={17} />
        </button>
      )}
      <p className="dashboard-sync">
        <Check size={14} />
        {lastUpdated
          ? `Records updated ${lastUpdated.toLocaleTimeString("en-GB", { timeZone: "Africa/Freetown" })} · Refreshes every 15 seconds`
          : "Loading company records"}
      </p>
    </div>
  );
}
