const common = [
  "Overview",
  "Profile",
  "Notifications",
  "Workspace guide",
  "Security",
  "Reminders",
];
const financialPages = [
  "Transactions",
  "Invoices",
  "Customers",
  "Suppliers",
  "Supplier bills",
  "Accounts",
  "Statements",
  "Reconciliation",
  "Exceptions",
  "Approvals",
  "Reports",
  "Analytics",
  "Audit trail",
  "Cash shifts",
  "Budgets",
  "Collections & payables",
  "Recurring drafts",
  "Purchases",
];
export const roleWorkspaces: Record<
  string,
  {
    title: string;
    description: string;
    pages: string[];
    tasks: { page: string; title: string; description: string }[];
  }
> = {
  admin: {
    title: "System administration",
    description:
      "Manage staff access, organisation settings and database backups.",
    pages: [
      ...common,
      "Users",
      "Roles & permissions",
      "Active sessions",
      "System maintenance",
      "Audit trail",
      "Settings",
    ],
    tasks: [
      {
        page: "Users",
        title: "Manage staff access",
        description: "Create users, assign roles and deactivate accounts.",
      },
      {
        page: "Settings",
        title: "Organisation and backups",
        description:
          "Update company settings and download a consistent backup.",
      },
      {
        page: "Audit trail",
        title: "Review system activity",
        description:
          "Inspect recorded sign-ins, access changes and administrative actions.",
      },
    ],
  },
  manager: {
    title: "Manager dashboard",
    description:
      "Oversee business performance, review payments and manage financial controls.",
    pages: [...common, ...financialPages, "Settings", "Staff overview"],
    tasks: [],
  },
  finance: {
    title: "Finance operations",
    description:
      "Record financial activity, import statements and resolve reconciliation work.",
    pages: [...common, ...financialPages, "Settings"],
    tasks: [
      {
        page: "Statements",
        title: "Import statements",
        description: "Preview and commit bank or mobile money evidence.",
      },
      {
        page: "Reconciliation",
        title: "Reconcile records",
        description: "Match recorded transactions against statement evidence.",
      },
      {
        page: "Exceptions",
        title: "Resolve exceptions",
        description: "Investigate unmatched and invalid evidence.",
      },
      {
        page: "Invoices",
        title: "Manage receivables",
        description: "Issue invoices and allocate customer receipts.",
      },
    ],
  },
  cashier: {
    title: "Cashier workspace",
    description:
      "Record incoming receipts and review your own transaction history.",
    pages: [
      ...common,
      "Transactions",
      "Customers",
      "Receipts",
      "Assigned invoices",
      "Cash shifts",
    ],
    tasks: [
      {
        page: "Transactions",
        title: "My receipts",
        description: "Review transactions recorded by your account.",
      },
      {
        page: "Customers",
        title: "Customer directory",
        description: "Find customer details before recording a receipt.",
      },
    ],
  },
  auditor: {
    title: "Audit workspace",
    description:
      "Review financial evidence, reports and the audit trail with read-only access.",
    pages: [...common, ...financialPages],
    tasks: [
      {
        page: "Audit trail",
        title: "Trace recorded actions",
        description: "Review who performed each action and when.",
      },
      {
        page: "Reports",
        title: "Inspect financial reports",
        description:
          "Review reports; exports follow the organisation audit policy.",
      },
      {
        page: "Reconciliation",
        title: "Review reconciliation",
        description: "Inspect matches and their supporting statement evidence.",
      },
      {
        page: "Approvals",
        title: "Review payment decisions",
        description:
          "Inspect outgoing payment approvals without changing them.",
      },
    ],
  },
};
export const canOpenPage = (
  role: string,
  page: string,
  delegatedApproval = false,
  permittedPages?: string[],
) =>
  (permittedPages === undefined || permittedPages.includes(page)) &&
  ((role === "admin" && page === "Approvals" && delegatedApproval) ||
    (roleWorkspaces[role]?.pages.includes(page) ?? false));

// Direct links use the same page names and authorization as sidebar navigation.
export const workspacePageFromSearch = (search: string) =>
  new URLSearchParams(search).get("page") || "Overview";
export const workspacePageUrl = (page: string) =>
  `/workspace?page=${encodeURIComponent(page)}`;
