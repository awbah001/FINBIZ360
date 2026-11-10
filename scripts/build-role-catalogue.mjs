import { readFileSync, writeFileSync } from "node:fs";

// Run with the accepted requirements text as the sole argument. Generates the
// in-app workflow guide and the same exhaustive, reviewable page mapping.
const source = readFileSync(process.argv[2], "utf8");
const classes = ["admin", "manager", "finance", "cashier", "auditor"];
const mappings = {
  admin: {
    Overview: [1],
    Users: [2, 3, 4, 5, 8],
    "Roles & permissions": [6, 7],
    "Active sessions": [9],
    Settings: [10, 11, 12, 13, 14, 15],
    "Audit trail": [16, 17, 18, 19],
    "System maintenance": [20, 21, 22, 23, 24],
    Profile: [25, 26],
    Notifications: [27],
  },
  manager: {
    Overview: [1, 2],
    Reports: [3, 4, 5, 23, 32, 36, 41],
    Accounts: [6, 7, 8, 18],
    Invoices: [9, 26, 27, 28],
    Transactions: [10, 11, 12, 20, 21, 24, 25],
    Exceptions: [13, 31],
    Customers: [14, 15],
    Suppliers: [16, 17],
    Settings: [19, 44],
    Analytics: [22, 37, 38, 39, 40],
    Reconciliation: [29, 30],
    Approvals: [33, 34, 35],
    "Audit trail": [42],
    "Staff overview": [43],
    Notifications: [45],
    Profile: [46, 47],
  },
  finance: {
    Overview: [1],
    Transactions: [2, 3, 4, 5, 6, 7, 25, 26, 28],
    Approvals: [8, 29],
    Exceptions: [9, 47],
    Accounts: [10, 11, 13, 14],
    Settings: [12, 27],
    Customers: [15, 16, 17, 18, 19],
    Suppliers: [20, 21, 22, 23, 24],
    Invoices: [30, 31, 32, 33, 34, 35, 36],
    Statements: [37, 38, 39, 40, 41],
    Reconciliation: [42, 43, 44, 45, 46, 48],
    Reports: [49, 50, 51, 52, 53, 54, 55],
    Profile: [56, 58],
    Notifications: [57],
  },
  cashier: {
    Overview: [1, 28, 29, 30],
    Transactions: [2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 26],
    Receipts: [7, 14, 15, 16, 17, 18],
    Customers: [19, 20, 21, 22],
    "Assigned invoices": [23, 24, 25, 27],
    Profile: [31, 33],
    Notifications: [32],
  },
  auditor: {
    Overview: [1, 2],
    Transactions: [3, 4, 5, 6],
    Invoices: [7, 8],
    Accounts: [9, 10, 11],
    Customers: [12],
    Suppliers: [13],
    Reconciliation: [14, 15, 16, 17],
    Exceptions: [18, 30],
    Reports: [19, 31, 32, 33, 34, 35, 36, 37],
    Approvals: [20, 21, 22, 23],
    "Audit trail": [24, 25, 26, 27, 28, 29],
    Profile: [38, 40],
    Notifications: [39],
  },
};
const notes = {
  Overview:
    "Use the role dashboard and its account/date filters. Daily figures use Africa/Freetown; selected-range totals remain separately labelled.",
  Users:
    "Search or filter staff, review account details, create accounts, edit roles/status or use the reauthenticated password reset action.",
  "Roles & permissions":
    "Inspect built-in grants; create or edit a restricted role and assign it to a staff member with the same responsibility class.",
  "Active sessions":
    "Review expiry and revoke a selected staff session with a reason.",
  Settings:
    "Use organisation configuration, category maintenance, payment account references or financial controls as permitted. This deployment supports SLE and Africa/Freetown.",
  "System maintenance":
    "Review database checks and recorded backup activity, download a consistent snapshot or follow the validated new-file operator restore procedure.",
  "Audit trail":
    "Filter immutable events by user, action and date. Administrator results contain administrative evidence; reviewers see permitted financial/system history.",
  Profile:
    "Review your identity and responsibility, update your profile/photo or choose Change password.",
  Notifications:
    "Review recent role-scoped saved activity and follow a link to the relevant work queue.",
  Reports:
    "Choose a report, date/account/status filters and preview the data. Export only when the organisation policy and your role permit it.",
  Accounts:
    "Review account details and balances; use the shared account filter and Transactions for the matching ledger entries.",
  Invoices:
    "Review document details, outstanding balances and payment history. Authorised staff create drafts, issue/cancel eligible invoices, allocate payments or request controlled corrections.",
  Transactions:
    "Use date/account/channel/direction/status filters. Open a record for evidence and history. Posted financial fields are immutable.",
  Exceptions:
    "Filter unmatched, duplicated and invalid evidence; investigate or dismiss only with the required permission and a reason.",
  Customers:
    "Search the customer directory and open customer history. Creation and updates follow your permissions; cashier history remains scoped to own receipts.",
  Suppliers:
    "Search supplier records and inspect transactions and obligations; maintenance is limited to authorised financial staff.",
  Analytics:
    "Review channel/category summaries, trends, explainable anomalies and the conditional cash-flow forecast. Insufficient data is labelled.",
  Reconciliation:
    "Review suggested, matched and unmatched evidence, group/partial proposals and decision history. Changes require operational permission and independent review where applicable.",
  Statements:
    "Upload CSV/XLSX evidence, map its columns, validate the preview and commit valid rows. Import history retains the original source and validation errors.",
  Approvals:
    "Review pending payments and control requests, open completed decision history and use independent decisions subject to authority and configured monetary limits.",
  "Staff overview":
    "Review staff names, responsibility classes and account status without changing access.",
  Receipts:
    "Review your receipt history, select an original receipt and print/reprint it. Request reversal with a reason; a manager must independently decide it.",
  "Assigned invoices":
    "Review only assigned invoices and your own drafts. Submit a customer invoice draft for finance review and issue; receipt allocation remains policy-controlled.",
};
const sections = [...source.matchAll(/^## ([3-7])\. .+$/gm)];
const catalogue = [];
for (let i = 0; i < sections.length; i++) {
  const role = classes[i],
    start = sections[i].index;
  const end = sections[i + 1]?.index ?? source.indexOf("## 8.", start);
  const block = source.slice(start, end);
  const list = block.slice(
    block.indexOf("### Required sidebar and pages"),
    block.indexOf("### ", block.indexOf("### Required sidebar and pages") + 5),
  );
  for (const match of list.matchAll(/^(\d+)\. (.+)$/gm)) {
    const number = Number(match[1]),
      title = match[2].trim();
    let page =
      Object.keys(mappings[role]).find((p) =>
        mappings[role][p].includes(number),
      ) || null;
    let state = "Existing equivalent",
      workflow = page
        ? notes[page]
        : "Use Sign out in the shared sidebar. This ends the current authenticated session.";
    if (!workflow) throw new Error(`Missing workflow for ${page}`);
    if (!page && !/sign out/i.test(title))
      throw new Error(`Unmapped requirement: ${role} ${number} ${title}`);
    if (
      [
        "Roles & permissions",
        "Active sessions",
        "System maintenance",
        "Notifications",
        "Staff overview",
        "Receipts",
        "Assigned invoices",
      ].includes(page)
    )
      state = "Implemented workspace";
    if (/edit pending sale/i.test(title)) {
      state = "In development";
      workflow =
        "An editable pending-sale stage is not implemented. Posted receipts remain immutable; request a reversal from Receipts for independent review.";
      page = "Receipts";
    }
    if (/edit transaction/i.test(title)) {
      state = "Controlled alternative";
      workflow =
        "Posted ledger fields cannot be edited. Open the transaction to inspect it and submit an adjustment or reversal through Approvals, then record a corrected entry when authorised.";
    }
    if (/profit and loss/i.test(title)) {
      state = "Cash-basis equivalent";
      workflow =
        "Reports show accepted income, expense and net movement. A separate accrual profit-and-loss ledger is not implemented.";
    }
    if (/database restore/i.test(title)) state = "Operator workflow";
    if (/currency and regional/i.test(title)) {
      state = "Fixed deployment configuration";
      workflow =
        "SLE (two decimal places) and Africa/Freetown are the supported deployment settings. Arbitrary currency/timezone switching is not implemented.";
    }
    if (!page) state = "Shared action";
    catalogue.push({ role, number, title, page, state, workflow });
  }
}
if (catalogue.length !== 210)
  throw new Error(
    `Expected 210 requested responsibilities; received ${catalogue.length}`,
  );
writeFileSync(
  "src/workspaceCatalogue.ts",
  `// Generated by scripts/build-role-catalogue.mjs from the accepted requirements.\nexport type Workflow = { role: string; number: number; title: string; page: string | null; state: string; workflow: string };\nexport const workspaceCatalogue: Workflow[] = ${JSON.stringify(catalogue, null, 2)};\n`,
);
let markdown =
  "# Complete requested-page coverage\n\n4 November 2026. All 210 numbered responsibilities from the accepted brief are mapped below. A mapping reuses a functional existing view and describes how to use it; it does not claim a separately implemented route. Development states and deployment limits are explicit.\n\n";
for (const role of classes) {
  markdown += `## ${role}\n\n| # | Requested page / action | Workspace equivalent | Status | Workflow |\n| --- | --- | --- | --- | --- |\n`;
  for (const entry of catalogue.filter((e) => e.role === role))
    markdown += `| ${entry.number} | ${entry.title} | ${entry.page || "Sidebar Sign out"} | ${entry.state} | ${entry.workflow} |\n`;
  markdown += "\n";
}
writeFileSync("docs/ROLE_PAGE_COVERAGE.md", markdown);
console.log(`Generated ${catalogue.length} role/workflow mappings.`);
