// Permission identities are shared by the API boundary, capability payload and
// access-management UI. A profile may narrow its base role, never expand it.
export const roleNames = {
  admin: "System Administrator",
  manager: "Owner / Manager",
  finance: "Finance Officer",
  cashier: "Cashier / Sales Officer",
  auditor: "Auditor / Read-only Reviewer",
};

export function basePermissions(db, user) {
  if (!user || !Object.hasOwn(roleNames, user.role)) return [];
  const role = user.role,
    admin = role === "admin",
    cashier = role === "cashier";
  const writer = ["manager", "finance"].includes(role);
  const reviewer = writer || role === "auditor";
  const settings = db.prepare("SELECT * FROM settings WHERE id=1").get();
  const grants = [];
  const add = (module, actions, scope) =>
    actions
      .split(" ")
      .forEach((action) =>
        grants.push({ id: `${module}.${action}`, module, action, scope }),
      );
  add("workspace", "view", admin ? "system" : cashier ? "own" : "company");
  add("profile", "view update", "self");
  add("notifications", "view", "self");
  add("security.mfa", "view manage", "self");
  add("reminders", "view update", "self");
  if (admin) add("system.backup", "configure", "system");
  if (reviewer || cashier)
    add("finance.shift", "view", cashier ? "own" : "company");
  if (cashier) add("finance.shift", "open close", "own");
  if (reviewer) {
    for (const module of ["budget", "followup", "recurring", "purchase"])
      add(`finance.${module}`, "view", "company");
  }
  if (writer) {
    add("finance.followup", "manage", "company");
    add("finance.recurring", "manage", "company");
    add("finance.purchase", "create order link", "company");
  }
  if (role === "manager") {
    add("finance.shift", "review", "company");
    add("finance.budget", "manage", "company");
    add("finance.purchase", "approve", "company");
  }
  if (admin) {
    add("users.staff", "view create update deactivate reset", "system");
    add("system.access", "view manage", "system");
    add("system.sessions", "view revoke", "system");
    add("system.maintenance", "view", "system");
    add("system.backup", "create", "system");
    add("settings.organisation", "view update", "system");
    add("finance.account", "create update", "reference");
    add("finance.category", "view create update", "reference");
    add("audit.logs", "view", "administrative");
  }
  if (reviewer || cashier) {
    add("finance.transaction", "view", cashier ? "own" : "company");
    add("finance.contact", "view", cashier ? "customer_lookup" : "company");
    add("finance.evidence", "view", cashier ? "own" : "company");
    add("finance.category", "view", cashier ? "income_lookup" : "company");
  }
  if (reviewer) {
    for (const module of [
      "account",
      "invoice",
      "supplier_bill",
      "statement",
      "reconciliation",
      "exception",
      "approval",
      "control",
      "approval_policy",
    ])
      add(`finance.${module}`, "view", "company");
    add("reports.financial", "view", "company");
    add("analytics", "view", "company");
    add("audit.logs", "view", "company");
  }
  if (writer) {
    add("settings.organisation", "view", "company");
    for (const module of ["account", "category", "contact", "invoice"])
      add(`finance.${module}`, "create update", "company");
    add("finance.invoice", "allocate", "company");
    add("finance.supplier_bill", "create allocate", "company");
    add("finance.allocation", "correct", "company");
    add("finance.transaction", "create verify", "company");
    add("finance.expense", "create", "company");
    add("finance.evidence", "upload", "company");
    add("finance.statement", "import commit", "company");
    add("finance.reconciliation", "execute undo", "company");
    add("finance.exception", "review", "company");
    add("finance.control", "create", "company");
  }
  if (cashier) {
    add("finance.transaction", "create", "own");
    add("finance.evidence", "upload", "own");
    add("sales.receipt", "view print request_reversal", "own");
    add("sales.invoice", "view create", "assigned");
    if (settings.cashier_create_customers)
      add("finance.contact", "create", "customer");
    if (settings.cashier_invoice_allocation)
      add("sales.receipt", "allocate", "own_customer");
  }
  if (writer || (role === "auditor" && settings.auditor_export_allowed))
    add("reports.financial", "export", "company");
  if (role === "manager") {
    add("finance.transaction", "reverse", "company");
    add("finance.control", "approve", "company");
    add("finance.reconciliation", "confirm configure", "company");
    add("finance.approval_policy", "configure", "company");
    add("finance.period", "close", "company");
    add("users.overview", "view", "directory");
  }
  const delegated =
    ["admin", "finance"].includes(role) &&
    user.id &&
    !!db
      .prepare("SELECT 1 FROM approval_delegates WHERE user_id=? AND active=1")
      .get(user.id);
  if (role === "manager" || delegated) {
    add("finance.approval", "approve", delegated ? "delegated" : "company");
    add("finance.expense", "approve", delegated ? "delegated" : "company");
  }
  if (admin && delegated) add("finance.approval", "view", "delegated");
  return grants;
}

export function effectivePermissions(db, user) {
  const grants = basePermissions(db, user);
  const profile =
    user?.id &&
    db
      .prepare(
        "SELECT r.* FROM access_roles r JOIN user_access_roles a ON a.access_role_id=r.id WHERE a.user_id=?",
      )
      .get(user.id);
  if (!profile) return grants;
  // A changed responsibility class must never inherit an old custom role.
  if (profile.base_role !== user.role)
    return grants.filter((g) =>
      [
        "workspace",
        "profile",
        "notifications",
        "security.mfa",
        "reminders",
      ].includes(g.module),
    );
  const allowed = new Set(JSON.parse(profile.permissions));
  return grants.filter((g) => inheritedPermission(g) || allowed.has(g.id));
}

export function permissionTemplate(db, role) {
  const grants = basePermissions(db, { role });
  const conditional = (module, action, scope, condition) => {
    const grant = {
      id: `${module}.${action}`,
      module,
      action,
      scope,
      condition,
    };
    const index = grants.findIndex((g) => g.id === grant.id);
    if (index >= 0) grants[index] = grant;
    else grants.push(grant);
  };
  if (role === "finance") {
    conditional(
      "finance.approval",
      "approve",
      "delegated",
      "Requires explicit manager delegation",
    );
    conditional(
      "finance.expense",
      "approve",
      "delegated",
      "Requires explicit manager delegation",
    );
  }
  if (role === "cashier") {
    conditional(
      "finance.contact",
      "create",
      "customer",
      "Requires organisation customer-creation policy",
    );
    conditional(
      "sales.receipt",
      "allocate",
      "own_customer",
      "Requires organisation receipt-allocation policy",
    );
  }
  if (role === "auditor")
    conditional(
      "reports.financial",
      "export",
      "company",
      "Requires organisation audit-export policy",
    );
  return grants;
}

export const inheritedPermission = (g) =>
  g.action === "view" ||
  [
    "workspace",
    "profile",
    "notifications",
    "security.mfa",
    "reminders",
  ].includes(g.module);
export const hasPermission = (db, user, id) =>
  effectivePermissions(db, user).some((g) => g.id === id);

export function assertApprovalLimit(db, user, amount) {
  const limit = db
    .prepare("SELECT max_amount FROM approval_limits WHERE user_id=?")
    .get(user.id);
  if (limit && BigInt(amount) > BigInt(limit.max_amount)) {
    const error = new Error(
      "This amount exceeds your configured approval limit. Another authorised approver must review it.",
    );
    error.status = 403;
    throw error;
  }
}

export function requestPermission(method, path) {
  const read = ["GET", "HEAD"].includes(method),
    parts = path.split("/").filter(Boolean),
    root = parts[0];
  if (root === "mfa") return `security.mfa.${read ? "view" : "manage"}`;
  if (root === "reminders") return `reminders.${read ? "view" : "update"}`;
  if (root === "cash-shifts")
    return `finance.shift.${read ? "view" : parts[2] === "review" ? "review" : parts[2] === "close" ? "close" : "open"}`;
  if (root === "budgets") return `finance.budget.${read ? "view" : "manage"}`;
  if (root === "followups")
    return `finance.followup.${read ? "view" : "manage"}`;
  if (root === "recurring")
    return `finance.recurring.${read ? "view" : "manage"}`;
  if (root === "purchases")
    return `finance.purchase.${read ? "view" : parts[2] === "decide" ? "approve" : parts[2] === "order" ? "order" : parts[2] === "link-bill" ? "link" : "create"}`;
  if (root === "secure-backups") return "system.backup.configure";
  if (
    ["session", "master", "logout", "overview", "workspace-summary"].includes(
      root,
    )
  )
    return "workspace.view";
  if (["profile", "password"].includes(root))
    return `profile.${read ? "view" : "update"}`;
  if (root === "notifications") return "notifications.view";
  if (root === "admin") {
    if (parts[1] === "overview") return "workspace.view";
    if (parts[1] === "configuration") return "settings.organisation.view";
    if (parts[1] === "access")
      return `system.access.${read ? "view" : "manage"}`;
    if (parts[1] === "sessions")
      return `system.sessions.${read ? "view" : "revoke"}`;
    return "system.maintenance.view";
  }
  if (root === "staff-overview") return "users.overview.view";
  if (root === "users") {
    if (parts[2] === "image") return "profile.view";
    return `users.staff.${read ? "view" : parts[2] === "reset-password" ? "reset" : method === "POST" ? "create" : "update"}`;
  }
  if (root === "sales") return `sales.invoice.${read ? "view" : "create"}`;
  if (root === "receipts")
    return `sales.receipt.${read ? "view" : parts[2] === "allocate" ? "allocate" : parts[2] === "print" ? "print" : "request_reversal"}`;
  if (root === "backup") return "system.backup.create";
  if (root === "settings")
    return `settings.organisation.${read ? "view" : "update"}`;
  if (root === "audit") return "audit.logs.view";
  if (root === "analytics") return "analytics.view";
  if (root === "reports")
    return `reports.financial.${["export", "download"].includes(parts[1]) ? "export" : "view"}`;
  if (root === "search") return "finance.transaction.view";
  if (
    root === "evidence" ||
    (root === "transactions" && parts[2] === "evidence")
  )
    return `finance.evidence.${read ? "view" : "upload"}`;
  if (root === "transactions")
    return `finance.transaction.${read ? "view" : parts[2] === "reverse" ? "reverse" : parts[2] === "verify" ? "verify" : "create"}`;
  if (root === "approvals")
    return `finance.approval.${read ? "view" : "approve"}`;
  if (root === "approval-policy")
    return `finance.approval_policy.${read ? "view" : "configure"}`;
  if (root === "periods") return "finance.period.close";
  if (root === "imports")
    return `finance.statement.${read ? "view" : parts[2] === "commit" ? "commit" : "import"}`;
  if (root === "reconciliation")
    return `finance.reconciliation.${read ? "view" : path.endsWith("/decide") ? "confirm" : path.endsWith("/undo") ? "undo" : parts[1] === "policy" ? "configure" : "execute"}`;
  if (root === "exceptions")
    return `finance.exception.${read ? "view" : "review"}`;
  if (root === "control-requests")
    return `finance.control.${read ? "view" : path.endsWith("/decide") ? "approve" : "create"}`;
  if (["allocations", "supplier-allocations"].includes(root))
    return "finance.allocation.correct";
  const modules = {
    accounts: "account",
    categories: "category",
    contacts: "contact",
    invoices: "invoice",
    "supplier-bills": "supplier_bill",
  };
  if (modules[root])
    return `finance.${modules[root]}.${read ? "view" : parts[2] === "assign" ? "update" : parts[2] === "allocate" ? "allocate" : method === "PATCH" ? "update" : "create"}`;
  return null;
}

export function permittedPages(db, user) {
  const grants = new Set(effectivePermissions(db, user).map((g) => g.id));
  const pages = {
    "Cash shifts": "finance.shift.view",
    Budgets: "finance.budget.view",
    "Collections & payables": "finance.followup.view",
    "Recurring drafts": "finance.recurring.view",
    Purchases: "finance.purchase.view",
    Security: "security.mfa.view",
    Reminders: "reminders.view",
    Overview: "workspace.view",
    Profile: "profile.view",
    Notifications: "notifications.view",
    Transactions: "finance.transaction.view",
    Invoices: "finance.invoice.view",
    Customers: "finance.contact.view",
    Suppliers: "finance.contact.view",
    "Supplier bills": "finance.supplier_bill.view",
    Accounts: "finance.account.view",
    Statements: "finance.statement.view",
    Reconciliation: "finance.reconciliation.view",
    Exceptions: "finance.exception.view",
    Approvals: "finance.approval.view",
    Reports: "reports.financial.view",
    Analytics: "analytics.view",
    "Audit trail": "audit.logs.view",
    Users: "users.staff.view",
    Settings: "settings.organisation.view",
    "Roles & permissions": "system.access.view",
    "Active sessions": "system.sessions.view",
    "System maintenance": "system.maintenance.view",
    "Staff overview": "users.overview.view",
    Receipts: "sales.receipt.view",
    "Assigned invoices": "sales.invoice.view",
  };
  return [
    "Workspace guide",
    ...Object.entries(pages)
      .filter(
        ([page, grant]) =>
          grants.has(grant) &&
          !(user.role === "cashier" && page === "Suppliers"),
      )
      .map(([page]) => page),
  ];
}
