import { hasPermission, requestPermission } from "./permissions.js";
// The API boundary is deliberately independent of menu visibility.
const readers = ["manager", "finance", "auditor"];
const writers = ["manager", "finance"];
const staff = [...readers, "cashier", "admin"];
const rules = [
  ["GET", /^\/(mfa|reminders)$/, staff],
  ["POST", /^\/mfa\/(setup|enable|disable)$/, staff],
  ["POST", /^\/reminders\/state$/, staff],
  ["GET", /^\/(cash-shifts)$/, [...readers, "cashier"]],
  ["POST", /^\/cash-shifts(\/[^/]+\/close)?$/, ["cashier"]],
  ["POST", /^\/cash-shifts\/[^/]+\/review$/, ["manager"]],
  ["GET", /^\/(budgets|followups|recurring|purchases)$/, readers],
  ["POST", /^\/budgets$/, ["manager"]],
  ["POST", /^\/followups$/, writers],
  [
    "POST",
    /^\/recurring(\/[^/]+\/(toggle|prepare)|\/drafts\/[^/]+\/(publish|dismiss))?$/,
    writers,
  ],
  ["POST", /^\/purchases(\/[^/]+\/(order|link-bill))?$/, writers],
  ["POST", /^\/purchases\/[^/]+\/decide$/, ["manager"]],
  ["GET", /^\/secure-backups(\/[^/]+\/download)?$/, ["admin"]],
  ["POST", /^\/secure-backups\/(policy|run)$/, ["admin"]],
  ["GET", /^\/admin\/(access|sessions|maintenance)$/, ["admin"]],
  ["POST", /^\/admin\/access\/(roles|assign)$/, ["admin"]],
  ["PATCH", /^\/admin\/access\/roles\/[^/]+$/, ["admin"]],
  ["POST", /^\/admin\/sessions\/[^/]+\/revoke$/, ["admin"]],
  ["GET", /^\/staff-overview$/, ["manager"]],
  ["GET", /^\/sales\/invoices$/, ["cashier"]],
  ["POST", /^\/sales\/invoices$/, ["cashier"]],
  ["GET", /^\/receipts$/, ["cashier"]],
  ["POST", /^\/receipts\/[^/]+\/reversal-request$/, ["cashier"]],
  ["POST", /^\/receipts\/[^/]+\/print$/, ["cashier"]],
  ["POST", /^\/invoices\/[^/]+\/assign$/, writers],
  ["POST", /^\/approval-policy\/limits$/, ["manager"]],
  ["POST", /^\/supplier-allocations\/[^/]+\/correct$/, writers],
  ["GET", /^\/(session|master)$/, staff],
  ["POST", /^\/(logout|password)$/, staff],
  ["PATCH", /^\/profile$/, staff],
  ["GET", /^\/profile\/image$/, staff],
  ["GET", /^\/users\/[^/]+\/image$/, staff],
  ["PUT", /^\/profile\/image$/, staff],
  ["DELETE", /^\/profile\/image$/, staff],
  ["GET", /^\/admin\/(overview|configuration)$/, ["admin"]],
  ["POST", /^\/users\/[^/]+\/reset-password$/, ["admin"]],
  ["GET", /^\/(notifications|approvals\/history)$/, staff],
  ["GET", /^\/workspace-summary$/, [...readers, "cashier"]],
  ["POST", /^\/(accounts|categories)$/, ["admin"]],
  ["PATCH", /^\/(accounts|categories)\/[^/]+$/, ["admin"]],
  ["GET", /^\/categories$/, ["admin"]],
  ["GET", /^\/(users|backup)$/, ["admin"]],
  ["POST", /^\/users$/, ["admin"]],
  ["PATCH", /^\/users\/[^/]+$/, ["admin"]],
  ["GET", /^\/settings$/, [...writers, "admin"]],
  ["PATCH", /^\/settings$/, ["admin"]],
  ["GET", /^\/audit$/, [...readers, "admin"]],
  ["POST", /^\/periods$/, ["manager"]],
  [
    "GET",
    /^\/(overview|transactions|search|categories)$/,
    [...readers, "cashier"],
  ],
  ["POST", /^\/transactions$/, [...writers, "cashier"]],
  ["GET", /^\/contacts\/[^/]+\/history$/, [...readers, "cashier"]],
  ["GET", /^\/transactions\/[^/]+\/evidence$/, [...readers, "cashier"]],
  ["POST", /^\/transactions\/[^/]+\/evidence$/, [...writers, "cashier"]],
  ["GET", /^\/evidence\/[^/]+$/, [...readers, "cashier"]],
  ["POST", /^\/transactions\/[^/]+\/verify$/, writers],
  ["POST", /^\/transactions\/[^/]+\/reverse$/, ["manager"]],
  ["POST", /^\/(accounts|contacts|categories)$/, writers],
  ["PATCH", /^\/(accounts|contacts|categories)\/[^/]+$/, writers],
  [
    "GET",
    /^\/(invoices|supplier-bills|imports|reconciliation|reports|exceptions|analytics|control-requests|approval-policy)(\/[^/]+)*$/,
    readers,
  ],
  [
    "POST",
    /^\/(invoices|supplier-bills|imports|reconciliation|allocations|exceptions|control-requests)(\/[^/]+)*$/,
    writers,
  ],
  ["PATCH", /^\/invoices\/[^/]+$/, writers],
  ["PATCH", /^\/reconciliation\/policy$/, ["manager"]],
  ["POST", /^\/approval-policy$/, ["manager"]],
];

export function hasApprovalAuthority(db, user) {
  return (
    hasPermission(db, user, "finance.approval.approve") &&
    (user?.role === "manager" ||
      (["finance", "admin"].includes(user?.role) &&
        !!db
          .prepare(
            "SELECT 1 FROM approval_delegates WHERE user_id=? AND active=1",
          )
          .get(user.id)))
  );
}

function rolePermitsRequest(db, user, method, path) {
  if (!user) return false;
  const verb = method === "HEAD" ? "GET" : method;
  const settings = db.prepare("SELECT * FROM settings WHERE id=1").get();
  if (
    user.role === "auditor" &&
    /^\/reports\/(export|download)$/.test(path) &&
    !settings.auditor_export_allowed
  )
    return false;
  if (path === "/approvals/history" && verb === "GET")
    return (
      readers.includes(user.role) ||
      (user.role === "admin" && hasApprovalAuthority(db, user))
    );
  if (path === "/contacts" && verb === "POST" && user.role === "cashier")
    return !!settings.cashier_create_customers;
  if (/^\/receipts\/[^/]+\/(invoices|allocate)$/.test(path))
    return (
      user.role === "cashier" &&
      !!settings.cashier_invoice_allocation &&
      ((verb === "GET" && path.endsWith("/invoices")) ||
        (verb === "POST" && path.endsWith("/allocate")))
    );
  // Delegation grants only payment review, never general financial access.
  if (/^\/approvals(\/[^/]+)?$/.test(path)) {
    if (verb === "GET" && path === "/approvals")
      return (
        readers.includes(user.role) ||
        (user.role === "admin" && hasApprovalAuthority(db, user))
      );
    return (
      verb === "POST" && path !== "/approvals" && hasApprovalAuthority(db, user)
    );
  }
  return rules.some(
    ([allowedMethod, pattern, roles]) =>
      verb === allowedMethod && pattern.test(path) && roles.includes(user.role),
  );
}

export function permitsRequest(db, user, method, path) {
  if (!rolePermitsRequest(db, user, method, path)) return false;
  const permission = requestPermission(method, path);
  return !!permission && hasPermission(db, user, permission);
}

export function roleBoundary(db) {
  return (req, res, next) => {
    if (
      (req.method === "GET" || req.method === "HEAD") &&
      req.path === "/session"
    )
      return next();
    if (req.method === "POST" && ["/login", "/setup"].includes(req.path))
      return next();
    if (!req.user) return res.status(401).json({ error: "Please sign in." });
    if (!permitsRequest(db, req.user, req.method, req.path))
      return res
        .status(403)
        .json({ error: "Your role does not permit this action." });
    if (
      req.method === "PATCH" &&
      /^\/users\/[^/]+$/.test(req.path) &&
      req.body.active !== undefined &&
      !hasPermission(db, req.user, "users.staff.deactivate")
    )
      return res.status(403).json({
        error: "Account status changes require a separate permission.",
      });
    if (
      req.method === "POST" &&
      req.path === "/transactions" &&
      req.body.direction === "out" &&
      !hasPermission(db, req.user, "finance.expense.create")
    )
      return res
        .status(403)
        .json({ error: "Expense creation is not permitted by your role." });
    next();
  };
}
