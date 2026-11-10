import SystemIcon from "./SystemIcon";
import { UserIdentity } from "./UserAvatar";
import {
  ArrowRight,
  ArrowDownLeft,
  ArrowsLeftRight as ArrowLeftRight,
  Users,
  UserMinus as UserX,
  ShieldCheck,
  Pulse as Activity,
  ClipboardText as History,
  FileText,
  ArrowsCounterClockwise as GitCompareArrows,
  WarningCircle as CircleAlert,
  Clock as Clock3,
  Wallet,
  BuildingOffice as Building2,
  UploadSimple as Upload,
  Gear as Settings,
  ChartLineUp as ChartNoAxesCombined,
  MagnifyingGlass as Search,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import { roleWorkspaces } from "./roleWorkspace";
import { HeroArt } from "./PageHero";
import { FinancialChart } from "./Dashboard";
import "./role-workspace.css";
import { auditActionLabel } from "./workspacePresentation";

type Row = Record<string, any>;
type Metric = {
  title: string;
  value: string | number;
  icon: PhosphorIcon;
  tone: string;
  note: string;
};
const destinations: Record<string, { icon: PhosphorIcon; tone: string }> = {
  Users: { icon: Users, tone: "cyan" },
  Settings: { icon: Settings, tone: "slate" },
  "Audit trail": { icon: History, tone: "slate" },
  Statements: { icon: Upload, tone: "cyan" },
  Reconciliation: { icon: GitCompareArrows, tone: "green" },
  Exceptions: { icon: CircleAlert, tone: "rose" },
  Invoices: { icon: FileText, tone: "purple" },
  Transactions: { icon: ArrowLeftRight, tone: "blue" },
  Customers: { icon: Users, tone: "cyan" },
  Reports: { icon: ChartNoAxesCombined, tone: "blue" },
  Approvals: { icon: ShieldCheck, tone: "amber" },
};
export default function RoleDashboard({
  user,
  overview,
  money,
  onNavigate,
  onRecord,
  onSale,
  onExpense,
  lastUpdated = null,
  demo = false,
  canRecord = true,
  scopeDescription = "All accounts · All recorded dates",
  onReviewTransactions,
}: {
  user: Row;
  overview: Row;
  money: (value?: string | number) => string;
  onNavigate: (page: string) => void;
  onRecord: () => void;
  onSale?: () => void;
  onExpense?: () => void;
  lastUpdated?: Date | null;
  demo?: boolean;
  canRecord?: boolean;
  scopeDescription?: string;
  onReviewTransactions?: (filters: Record<string, string>) => void;
}) {
  const workspace = roleWorkspaces[user.role];
  const admin = user.role === "admin",
    cashier = user.role === "cashier",
    auditor = user.role === "auditor";
  const roleAccent: Record<string, string> = {
    admin: "slate",
    finance: "blue",
    cashier: "green",
    auditor: "purple",
    manager: "teal",
  };
  const accent = roleAccent[user.role] || "teal";
  const metric = (
    title: string,
    value: string | number | undefined,
    icon: PhosphorIcon,
    tone: string,
    note: string,
  ): Metric => ({ title, value: value ?? 0, icon, tone, note });
  const daily = overview.daily || {};
  const metrics = admin
    ? [
        metric(
          "Total registered users",
          overview.total_users,
          Users,
          "cyan",
          "All registered staff accounts",
        ),
        metric(
          "Active staff",
          overview.active_users,
          Users,
          "cyan",
          "Enabled staff accounts",
        ),
        metric(
          "Inactive accounts",
          overview.inactive_users,
          UserX,
          "slate",
          "Disabled staff access",
        ),
        metric(
          "Active staff sessions",
          overview.active_sessions,
          Activity,
          "blue",
          "Unexpired signed-in sessions",
        ),
        metric(
          "System administrators",
          overview.administrators,
          ShieldCheck,
          "purple",
          "Active administrator accounts",
        ),
      ]
    : cashier
      ? [
          metric(
            "Today's sales",
            `SLE ${money(daily.sales || "0")}`,
            Wallet,
            "blue",
            "Receipted sales recorded today",
          ),
          metric(
            "Cash received today",
            `SLE ${money(daily.cash || "0")}`,
            Wallet,
            "green",
            "Your cash receipts today",
          ),
          metric(
            "Mobile money today",
            `SLE ${money(daily.mobile || "0")}`,
            Activity,
            "cyan",
            "Your mobile money receipts today",
          ),
          metric(
            "Bank receipts today",
            `SLE ${money(daily.bank || "0")}`,
            Building2,
            "blue",
            "Your bank receipts today",
          ),
          metric(
            "My accepted receipts",
            `SLE ${money(overview.incoming)}`,
            ArrowDownLeft,
            "green",
            "Your receipts in the selected scope",
          ),
          metric(
            "Sales recorded today",
            daily.sales_count,
            FileText,
            "purple",
            "Receipted sale count today",
          ),
          metric(
            "My transactions",
            overview.count,
            FileText,
            "purple",
            "Records created by your account",
          ),
        ]
      : auditor
        ? [
            metric(
              "Pending exceptions",
              overview.pending_exceptions,
              CircleAlert,
              "rose",
              "Unresolved exceptions in selected scope",
            ),
            metric(
              "Unmatched records",
              overview.unmatched,
              CircleAlert,
              "rose",
              "Accepted records awaiting a match",
            ),
            metric(
              "Pending payments",
              overview.pending,
              Clock3,
              "amber",
              "Awaiting an independent decision",
            ),
            metric(
              "Reconciled records",
              overview.reconciled,
              GitCompareArrows,
              "green",
              "Recorded evidence matches",
            ),
            metric(
              "Recorded transactions",
              overview.count,
              FileText,
              "purple",
              "Records in the selected scope",
            ),
          ]
        : [
            metric(
              "Unmatched records",
              overview.unmatched,
              GitCompareArrows,
              "green",
              "Accepted records awaiting a match",
            ),
            metric(
              "Pending payments",
              overview.pending,
              Clock3,
              "amber",
              "Awaiting independent approval",
            ),
            metric(
              "Customer balances",
              `SLE ${money(overview.outstanding_customers)}`,
              Wallet,
              "cyan",
              "Company documents in date range",
            ),
            metric(
              "Supplier balances",
              `SLE ${money(overview.outstanding_suppliers)}`,
              Building2,
              "orange",
              "Company documents in date range",
            ),
            metric(
              "Today's inflows",
              `SLE ${money(daily.incoming || "0")}`,
              ArrowDownLeft,
              "green",
              "Accepted inflows today within selected scope",
            ),
            metric(
              "Today's outflows",
              `SLE ${money(daily.outgoing || "0")}`,
              ArrowLeftRight,
              "orange",
              "Accepted outflows today within selected scope",
            ),
            metric(
              "Total recorded transactions",
              overview.count,
              FileText,
              "purple",
              "Transactions in selected scope",
            ),
          ];
  const recent: Row[] =
    (admin ? overview.recent_activity : overview.recent) || [];
  if (cashier)
    metrics.push(
      metric(
        "My total sales",
        `SLE ${money(overview.total_sales || "0")}`,
        Wallet,
        "green",
        "Accepted, unreversed sales in selected scope",
      ),
      metric(
        "Assigned pending payments",
        overview.pending_customer_payments,
        Clock3,
        "amber",
        "Issued assigned invoices with an outstanding balance",
      ),
    );
  if (user.role === "finance")
    metrics.push(
      metric(
        "This month's income",
        `SLE ${money(overview.monthly?.incoming || "0")}`,
        ArrowDownLeft,
        "green",
        `${overview.monthly?.month || "Current month"}; respects selected filters`,
      ),
      metric(
        "This month's expenses",
        `SLE ${money(overview.monthly?.outgoing || "0")}`,
        ArrowLeftRight,
        "orange",
        `${overview.monthly?.month || "Current month"}; respects selected filters`,
      ),
    );
  if (auditor)
    metrics.push(
      metric(
        "Total income",
        `SLE ${money(overview.incoming)}`,
        Wallet,
        "green",
        "Accepted inflows in selected scope",
      ),
      metric(
        "Total expenses",
        `SLE ${money(overview.outgoing)}`,
        Wallet,
        "orange",
        "Accepted outflows in selected scope",
      ),
      metric(
        "Reconciliation completion",
        `${Number(overview.reconciled || 0) + Number(overview.unmatched || 0) ? Math.round((Number(overview.reconciled || 0) * 100) / (Number(overview.reconciled || 0) + Number(overview.unmatched || 0))) : 0}%`,
        GitCompareArrows,
        "blue",
        "Reconciled accepted records in selected scope",
      ),
      metric(
        "Duplicate indicators",
        overview.duplicate_indicators,
        CircleAlert,
        "rose",
        "Unresolved duplicate evidence indicators",
      ),
    );
  const reviewFilters: Record<string, Record<string, string>> = {
    "Unmatched records": { status: "unmatched" },
    "Pending payments": { approval: "pending" },
    "Reconciled records": { status: "reconciled" },
    "Recorded transactions": {},
    "Total recorded transactions": {},
    "My transactions": {},
  };
  const renderMetric = ({ title, value, icon: Icon, tone, note }: Metric) => (
    <section
      className={`reference-metric effect-card tone-${tone}`}
      key={title}
    >
      <SystemIcon
        icon={Icon}
        tone={tone}
        variant="metric"
        className="metric-icon"
        size={25}
      />
      <div className="metric-copy">
        <h2>{title}</h2>
        <strong>{value}</strong>
        <span className="metric-note">{note}</span>
        {onReviewTransactions && reviewFilters[title] && (
          <button
            type="button"
            className="metric-review-link"
            onClick={() => onReviewTransactions(reviewFilters[title])}
          >
            View records<span className="sr-only">: {title}</span>
          </button>
        )}
      </div>
    </section>
  );
  return (
    <div
      className={`reference-dashboard role-dashboard role-dashboard-${user.role}`}
    >
      <section className={`dashboard-welcome role-welcome tone-${accent}`}>
        <div className="role-welcome-copy">
          <span className="role-eyebrow">Welcome back, {user.name}</span>
          <h1>{workspace.title}</h1>
          <p>{workspace.description}</p>
          <div className="role-welcome-actions">
            {["finance", "cashier"].includes(user.role) && canRecord ? (
              <button className="button" onClick={onRecord}>
                <ArrowDownLeft size={18} aria-hidden="true" focusable="false" />
                {cashier ? "Record receipt" : "Record transaction"}
                <ArrowRight size={16} aria-hidden="true" focusable="false" />
              </button>
            ) : (
              <button
                className="button"
                onClick={() => onNavigate(admin ? "Users" : "Audit trail")}
              >
                <ShieldCheck size={18} aria-hidden="true" focusable="false" />
                {admin ? "Manage staff access" : "Open audit trail"}
                <ArrowRight size={16} aria-hidden="true" focusable="false" />
              </button>
            )}
            {user.role === "finance" && canRecord && onExpense && (
              <button className="button secondary" onClick={onExpense}>
                <Wallet size={18} aria-hidden="true" focusable="false" />
                Record expense
              </button>
            )}
            {cashier && canRecord && onSale && (
              <button className="button secondary" onClick={onSale}>
                <Wallet size={18} aria-hidden="true" focusable="false" />
                Record sale
              </button>
            )}
            <span className="role-access-tag">
              <ShieldCheck size={14} aria-hidden="true" focusable="false" />
              {admin
                ? "System administration"
                : auditor
                  ? "Read-only review"
                  : cashier
                    ? "Personal receipts"
                    : "Finance operations"}
            </span>
          </div>
        </div>
        <HeroArt
          page={
            admin
              ? "Users"
              : cashier
                ? "Transactions"
                : auditor
                  ? "Audit trail"
                  : "Reconciliation"
          }
        />
      </section>
      <div className="role-dashboard-meta">
        <span>
          {demo
            ? `Demonstration workspace · ${admin ? "Staff access overview" : scopeDescription}`
            : admin
              ? "Staff access overview"
              : cashier
                ? `Your activity · ${scopeDescription}`
                : scopeDescription}
        </span>
        <span>
          {lastUpdated
            ? `Updated ${lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Freetown" })}`
            : "Refresh to load the latest records"}
        </span>
      </div>
      <div
        className="reference-metrics role-metrics role-metrics-primary"
        aria-label="Key figures"
      >
        {metrics.slice(0, 4).map(renderMetric)}
      </div>
      <section className="reference-panel role-tools">
        <header>
          <div className="reference-panel-title">
            <SystemIcon
              icon={Activity}
              tone={accent}
              className="role-panel-icon"
              size={23}
            />
            <div>
              <h2>
                {admin
                  ? "Administration tools"
                  : auditor
                    ? "Review tools"
                    : "Your work queue"}
              </h2>
              <p>
                {admin
                  ? "Keep access and organisation records in order."
                  : auditor
                    ? "Follow the evidence behind each recorded decision."
                    : "Continue with the tools assigned to your role."}
              </p>
            </div>
          </div>
        </header>
        <div className="role-task-grid">
          {workspace.tasks.map((task) => {
            const { icon: Icon, tone } = destinations[task.page] || {
              icon: FileText,
              tone: "teal",
            };
            return (
              <button
                className={`role-task tone-${tone}`}
                key={task.page}
                onClick={() => onNavigate(task.page)}
              >
                <SystemIcon
                  icon={Icon}
                  tone={tone}
                  variant="shortcut"
                  className="role-task-icon"
                  size={24}
                />
                <strong>{task.title}</strong>
                <span className="role-task-description">
                  {task.description}
                </span>
                <span className="role-task-open">
                  Open workspace
                  <ArrowRight size={16} aria-hidden="true" focusable="false" />
                </span>
              </button>
            );
          })}
        </div>
      </section>
      {metrics.length > 4 && (
        <details className="role-more-figures">
          <summary>More figures ({metrics.length - 4})</summary>
          <div className="reference-metrics role-metrics">
            {metrics.slice(4).map(renderMetric)}
          </div>
        </details>
      )}
      {!admin && (
        <p className="panel-note">
          Daily figures use {daily.date || "today"} in Africa/Freetown and the
          selected filters. Sales are receipted sales; they are included in
          receipts, not added again.
        </p>
      )}
      {user.role === "finance" && (
        <div className="role-dashboard-grid">
          <section className="reference-panel">
            <h2>Income and expense trends</h2>
            <FinancialChart trend={overview.trend || []} money={money} />
            <button
              className="button secondary small"
              onClick={() => onNavigate("Reports")}
            >
              Open financial reports
            </button>
          </section>
          <section className="reference-panel">
            <h2>Current account balances</h2>
            <dl className="settings-grid">
              {["cash", "bank", "mobile"].map((channel) => (
                <div key={channel}>
                  <dt>
                    {channel === "mobile"
                      ? "Mobile money"
                      : channel === "bank"
                        ? "Bank"
                        : "Cash"}
                  </dt>
                  <dd>
                    SLE{" "}
                    {money(
                      (overview.accounts || [])
                        .filter((a: Row) => a.channel === channel)
                        .reduce(
                          (sum: bigint, a: Row) =>
                            sum + BigInt(a.closing || "0"),
                          0n,
                        )
                        .toString(),
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <button
              className="button secondary small"
              onClick={() => onNavigate("Accounts")}
            >
              Review account balances
            </button>
          </section>
        </div>
      )}
      {admin && overview.role_distribution && (
        <section className="reference-panel">
          <header>
            <div className="reference-panel-title">
              <Users size={24} aria-hidden="true" focusable="false" />
              <div>
                <h2>Role distribution and configuration</h2>
                <p>Registered staff by assigned role.</p>
              </div>
            </div>
          </header>
          <dl className="settings-grid">
            {overview.role_distribution.map((r: Row) => (
              <div key={r.role}>
                <dt>{roleWorkspaces[r.role]?.title || r.role}</dt>
                <dd>
                  {r.total} registered / {r.active} active
                </dd>
              </div>
            ))}
          </dl>
          <p className="panel-note">
            Last successful backup:{" "}
            {overview.last_successful_backup || "Not recorded"}.{" "}
            {overview.backup_health}. {overview.configuration?.active_accounts}{" "}
            active account references /{" "}
            {overview.configuration?.active_categories} active categories.
            Currency: {overview.configuration?.currency}. Imports: CSV and XLSX.
            Auditor exports:{" "}
            {overview.configuration?.auditor_export_allowed
              ? "enabled"
              : "disabled"}
            .
          </p>
        </section>
      )}
      {admin && (
        <section className="reference-panel">
          <h2>Recent security events</h2>
          {overview.security_events?.length ? (
            <ul className="role-activity">
              {overview.security_events.map((event: Row) => (
                <li key={event.id}>
                  <div className="role-event-copy">
                    <strong>{auditActionLabel(event.action)}</strong>
                    <details className="audit-event-code">
                      <summary>Event code</summary>
                      <code>{event.action}</code>
                    </details>
                    <span>
                      {event.user_name || "System"} · {event.created_at} UTC
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-note">
              No account-access or credential changes recorded.
            </p>
          )}
          <button
            className="button secondary small"
            onClick={() => onNavigate("Audit trail")}
          >
            Review access history
          </button>
        </section>
      )}
      {!admin && !cashier && (
        <div className="role-dashboard-grid role-review-panels">
          <section className="reference-panel">
            <h2>
              {auditor
                ? "Recent adjustments and decisions"
                : "Recent statement imports"}
            </h2>
            {(auditor ? overview.approval_history : overview.recent_imports)
              ?.length ? (
              <ul className="role-activity">
                {(auditor
                  ? overview.approval_history
                  : overview.recent_imports
                ).map((r: Row) => (
                  <li key={r.id}>
                    <div className="role-event-copy">
                      <strong>
                        {auditor ? `${r.kind}: ${r.status}` : r.filename}
                      </strong>
                      <span>
                        {auditor ? (
                          <>
                            <UserIdentity
                              name={r.reviewer}
                              src={r.reviewer_image_url}
                            />
                            : {r.reason}
                          </>
                        ) : (
                          `${r.status} / ${r.created_at}`
                        )}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-note">No records in the selected scope.</p>
            )}
            <button
              className="button secondary small"
              onClick={() => onNavigate(auditor ? "Approvals" : "Statements")}
            >
              {auditor ? "View approval history" : "View import history"}
            </button>
          </section>
          <section className="reference-panel">
            <h2>
              {auditor ? "Recent audit activities" : "Reconciliation workload"}
            </h2>
            {auditor ? (
              overview.recent_audit?.length ? (
                <ul className="role-activity">
                  {overview.recent_audit.map((r: Row) => (
                    <li key={r.id}>
                      <div className="role-event-copy">
                        <strong>{auditActionLabel(r.action)}</strong>
                        <details className="audit-event-code">
                          <summary>Event code</summary>
                          <code>{r.action}</code>
                        </details>
                        <span>
                          <UserIdentity
                            name={r.user_name}
                            src={r.user_image_url}
                          />{" "}
                          / {r.created_at}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="panel-note">
                  No audit events in the selected dates.
                </p>
              )
            ) : (
              <>
                <p>
                  {overview.unmatched || 0} unmatched records and{" "}
                  {overview.pending_exceptions || 0} unresolved exceptions in
                  this scope.
                </p>
                <button
                  className="button secondary small"
                  onClick={() => onNavigate("Reconciliation")}
                >
                  Open reconciliation
                </button>
              </>
            )}
            <p className="panel-note">
              {auditor
                ? "Record counts show available evidence; individual review completion is not tracked."
                : "Only authorised reviewers can decide approval-required requests."}
            </p>
          </section>
        </div>
      )}
      <div className="role-recent-records">
        <section className="reference-panel role-records">
          <header>
            <div className="reference-panel-title">
              <span className="role-panel-icon tone-slate">
                <History
                  size={23}
                  aria-hidden="true"
                  focusable="false"
                  className="icon-history"
                />
              </span>
              <div>
                <h2>
                  {admin
                    ? "Recent system activity"
                    : cashier
                      ? "My recent receipts and transactions"
                      : "Recent financial records"}
                </h2>
                <p>
                  {admin
                    ? "Latest recorded staff and system actions."
                    : cashier
                      ? "Receipts and records created by your account."
                      : "Latest records in the selected scope."}
                </p>
              </div>
            </div>
          </header>
          {recent.length ? (
            <ul className="role-activity">
              {recent.map((entry) => (
                <li key={entry.id}>
                  <span
                    className={`role-event-icon tone-${admin ? "slate" : entry.direction === "out" ? "orange" : "green"}`}
                  >
                    {admin ? (
                      <ShieldCheck
                        size={18}
                        aria-hidden="true"
                        focusable="false"
                      />
                    ) : entry.direction === "out" ? (
                      <ArrowRight
                        size={18}
                        aria-hidden="true"
                        focusable="false"
                      />
                    ) : (
                      <ArrowDownLeft
                        size={18}
                        aria-hidden="true"
                        focusable="false"
                      />
                    )}
                  </span>
                  <div className="role-event-copy">
                    <strong>
                      {admin
                        ? auditActionLabel(entry.action)
                        : entry.reference || entry.description}
                    </strong>
                    <span>
                      {admin ? (
                        <UserIdentity
                          name={entry.user_name}
                          src={entry.user_image_url}
                        />
                      ) : (
                        entry.date
                      )}
                    </span>
                    {admin && (
                      <details className="audit-event-code">
                        <summary>Event code</summary>
                        <code>{entry.action}</code>
                      </details>
                    )}
                    {admin ? (
                      <time>
                        {new Date(
                          entry.created_at.endsWith("Z")
                            ? entry.created_at
                            : entry.created_at.replace(" ", "T") + "Z",
                        ).toLocaleString("en-GB", {
                          timeZone: "Africa/Freetown",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    ) : (
                      <span className={`badge ${entry.approval}`}>
                        {String(entry.approval).replaceAll("_", " ")}
                      </span>
                    )}
                  </div>
                  {!admin && (
                    <strong className="role-event-amount">
                      SLE {money(entry.amount)}
                    </strong>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="role-empty">
              <span>
                <Search size={30} aria-hidden="true" focusable="false" />
              </span>
              <h3>
                {admin ? "No system activity yet" : "No records in this view"}
              </h3>
              <p>
                {admin
                  ? "Recorded staff and system actions will appear here."
                  : "Saved records will appear here when available in your scope."}
              </p>
            </div>
          )}
          <button
            className="button secondary small role-view-all"
            onClick={() => onNavigate(admin ? "Audit trail" : "Transactions")}
          >
            {admin ? "View system activity" : "View transactions"}
            <ArrowRight size={16} aria-hidden="true" focusable="false" />
          </button>
        </section>
      </div>
    </div>
  );
}
