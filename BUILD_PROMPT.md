# FinBiz 360 - System Build Prompt

Copy the prompt below into your coding assistant to begin implementation.

---

Act as a senior full-stack engineer, financial systems analyst and UX designer. Build **FinBiz 360**, a working browser-based financial management and business intelligence system for one retail or trading enterprise in Freetown, Sierra Leone.

Use the project proposal and requirements in `For Hannah.pdf` as the source of business requirements. This prompt translates that document into implementation instructions. The user's required development stack is React, Node.js and SQLite; this explicitly overrides the PDF's proposed Django/PostgreSQL architecture. Clearly document implementation assumptions and distinguish them from confirmed organisational requirements.

## 1. Objective and boundaries

Centralise cash, mobile money and bank transfer records; manage customer and supplier balances, income, expenses and invoices; import statements; reconcile internal transactions with independent evidence; and provide reliable dashboards, reports, approvals and audit trails.

Deliver a functioning application with persistent data and complete business workflows, not just screens or a static prototype. Build for one organisation. Keep the organisation name, currency, approval thresholds, statement mappings and reconciliation rules configurable because the proposal does not confirm them. Use clearly labelled synthetic demonstration data. Assume SLE as the provisional demonstration currency and Africa/Freetown as the display timezone, and document both assumptions.

The system is an internal record-management platform. Do not implement payment initiation, customer fund custody, wallets, clearing or settlement. Do not store mobile money PINs, bank passwords or card CVVs. Live provider APIs are outside the initial build and require official documentation, access and written authorisation. Tax filing, payroll, inventory management and a full ERP are outside scope. Do not claim statutory accounting compliance or fabricate research findings.

## 2. Technical architecture

Use this required development stack:

- React with TypeScript and Vite for the responsive frontend.
- Node.js with TypeScript and Express for the backend REST API.
- SQLite for persistent relational data, using a maintained Node.js SQLite driver such as better-sqlite3 and versioned migrations.
- Node.js services for import validation, reconciliation, reporting and conditional analytics.

React, Node.js and SQLite are mandatory for development. TypeScript, Vite, Express and the specific SQLite driver are recommended implementation choices. Do not introduce a Python backend or require PostgreSQL, MySQL or an external database server. Use a modular monolith with clear service boundaries. Use server-managed sessions persisted in SQLite, secure HttpOnly cookies and CSRF protection for a same-origin deployment. Document configuration if a separate frontend origin is used. Use server-side authorization on every protected operation.

Build dashboards directly in the application; make Power BI an optional documented extension. Store uploaded evidence in controlled private storage. Supply environment examples without secrets, migrations, dependency manifests and reproducible npm-based setup instructions, including Windows PowerShell commands. Development must run locally with Node.js and a SQLite file without requiring Docker or a database service. Keep the database file, uploaded evidence and secrets out of version control.

Enable SQLite foreign-key enforcement on every connection, use WAL mode and a bounded busy timeout, and keep write transactions short. Use atomic conditional updates and uniqueness constraints to protect financial operations against concurrent requests. Run one backend instance for the initial deployment and document SQLite's single-writer limitations. Use SQLite's supported online backup mechanism or a controlled consistent snapshot; do not copy a live database file while ignoring its WAL. Verify restoration of both the database and linked evidence files.

First inspect the repository and applicable project instructions. Preserve and extend useful existing code. For an empty repository, scaffold the application. Record your implementation plan and then implement it; do not stop after planning.

## 3. Roles and permissions

Implement a server-enforced permission matrix for:

1. **System Administrator:** users, roles, organisation settings, reference data and backup administration. This role does not automatically grant business approval authority.
2. **Owner / Manager:** management dashboards, reports and designated transaction, adjustment, write-off and exception approvals.
3. **Finance Officer:** customers, suppliers, transaction and expense recording, invoices, imports, reconciliation and permitted reports.
4. **Cashier / Sales Officer:** sales and receipts, with access limited to assigned records and actions.
5. **Auditor / Read-only Reviewer:** permitted financial records, reconciliation evidence, reports and audit history, without modification rights.

Support user deactivation, password changes and session invalidation. Prevent unauthorized access through both the interface and direct API requests. Apply independent approval where configured, including preventing self-approval of material adjustments. An administrator may approve business items only when separately assigned the relevant permission.

## 4. Core modules

### Organisation and master data

Manage organisation settings, customers, suppliers, cash accounts, bank accounts, mobile money clearing accounts, payment channels/providers and income/expense categories. Use minimal necessary personal information. Allow inactive reference records to remain linked to historical transactions.

### Financial transactions

Record unique internal ID, transaction date, amount, currency, direction, financial account, payment channel, external reference, category, description, responsible user, counterparty and evidence where applicable. Cash entries require receipt or voucher references. Capture provider or bank references for their respective channels when available, with explicit handling of missing references.

Preserve the proposal's exact-money requirement using SQLite INTEGER values in minor currency units, with explicit currency codes and configured currency precision. SQLite DECIMAL/NUMERIC declarations do not guarantee fixed-point arithmetic, so do not store money as REAL or rely on decimal column declarations for accuracy. Use decimal-safe parsing and formatting; reject unsupported precision and out-of-range values. Use BigInt or an exact-decimal library when needed, and serialize monetary values as strings across JSON APIs to avoid JavaScript Number precision loss. Do not combine currencies into a single total without a defined conversion mechanism. Validate required fields and positive amounts, using direction to represent inflows and outflows.

Represent fees, refunds, reversals, partial payments and settlement differences explicitly. Separate transaction lifecycle, approval status and reconciliation status. In particular, recorded, provider-confirmed and statement-reconciled must remain distinguishable. Cash transactions use cash evidence and cash-control workflows; they must not require a bank statement to become valid records.

Protect completed financial records against silent overwrites or deletion. Use linked reversals, adjustments or controlled amendments with reasons, audit history and required approval. Use atomic database transactions for financial changes and safe retry behaviour to prevent duplicate posting.

### Sales, invoices and expenses

Manage customer invoices, issue and due dates, invoice amounts and payment allocations. Derive unpaid, partially paid, paid and overdue status from actual allocations and dates. Track outstanding customer and supplier balances using documented rules. Prevent duplicate allocations and over-allocation unless an explicit credit-balance workflow is implemented.

Record expense category, payee, amount, date, account, evidence and approval status. Ensure invoices and their payments do not double-count income. Document whether each dashboard figure represents recorded cash movement or invoice-based amounts.

### Statement import

Support CSV and XLSX bank/mobile money statements through this workflow:

1. Select provider, account and currency, then upload a file.
2. Map source columns to date, reference, description, amount/direction and optional fee fields.
3. Preview parsed rows and validation errors before committing.
4. Confirm the intended valid rows explicitly; report excluded rows and reasons.
5. Commit once and retain the import result.

Validate dates, decimal formats, required columns, currencies and account context. Preserve original evidence and normalized values. Store file fingerprint, original filename, uploader, upload time, mapping, validation outcome and source row identifiers. Detect repeated file imports and potential repeated statement rows without assuming external references are globally unique. Make repeated import confirmation safe. Provide a downloadable validation-error report. Apply upload size/type controls and private, permission-checked downloads.

### Reconciliation and exceptions

Create an explainable matching engine using reference, amount, date, direction, currency, account, channel and provider context. Scope duplicate-reference checks to relevant provider/account/channel/date context.

- Generate deterministic exact-reference/amount candidates only when evidence is unambiguous and other required dimensions agree.
- Treat date/amount tolerance matches as suggestions requiring human review.
- Never reconcile an item solely because its amount resembles another amount.
- Keep suggestions distinguishable from confirmed reconciliations. Default to explicit confirmation; any future automatic confirmation policy must be configurable and audited.
- Show the applied rule, candidate evidence, difference amount and ambiguity.
- Support unmatched, partially matched, duplicate, ambiguous and amount-difference exceptions.
- Support documented manual matches, split payments, grouped settlements, fees and reversals through allocation records and explicit resolutions.
- Prevent reuse or over-allocation of transaction/statement amounts, including concurrent confirmations.
- Require resolution reasons and independent approval for configured material items.
- Allow authorized reversal of a reconciliation while retaining its original evidence and audit history.

Provide a side-by-side reconciliation workspace and reports by account, channel, period and status. Retain rule versions and relevant parameters so decisions can be reproduced. Report confirmed matches separately from suggestions and manually resolved items.

### Approvals, audit and period controls

Configure approval rules for designated transactions, expenses, adjustments, write-offs and material exception resolutions. Record requester, approver, timestamps, decision and reason. Enforce pending/approved/rejected transitions on the server.

Keep attributable, append-only application audit events for significant changes, imports, approvals, reversals, reconciliation decisions, configuration changes and period closure/reopening. Capture relevant before/after values without logging passwords, tokens or unnecessary sensitive data. Ordinary users cannot change audit records.

Allow permitted users to close reporting periods. Block prohibited changes in closed periods and require an authorized reopening with a reason and audit event.

### Dashboards, reports and exports

Provide role-appropriate dashboards for recorded inflows, outflows, net cash movement, account balances, transaction volume, income/expense categories, outstanding balances, overdue invoices, reconciliation progress and pending approvals/exceptions.

Include date, account, currency, channel and status filters, trend charts and drill-down tables. Document formulas and opening-balance treatment. Use consistent filters across summaries, details and exports so totals agree. Do not present net cash movement as accounting profit. Add PDF and spreadsheet exports with permission checks, generation timestamps and filter context. Protect spreadsheet exports against formula injection. Budget-versus-actual reports are a later extension unless a budget model is explicitly included and documented.

### Conditional analytics

After the core workflows are complete, add configurable anomaly rules such as possible duplicate entries, unusually large amounts and unusual transaction frequency. Each alert must explain the triggering rule and support human review and resolution. An alert is not proof of fraud.

Implement a short-term cash-flow forecasting prototype only if sufficient reliable historical data exist. Use a transparent baseline, such as a moving average, with chronological holdout evaluation and MAE. Display horizon, assumptions, data period, method and limitations. Show an insufficient-data state when appropriate; never fabricate predictions or accuracy results.

## 5. Data design

Design a normalized relational schema including Organisation, User, Role/Permission, Customer, Supplier, FinancialAccount, PaymentChannel, Category, Transaction, Invoice, InvoiceLine, PaymentAllocation, Expense, EvidenceAttachment, StatementImport, StatementLine, ReconciliationRun, MatchSuggestion, ReconciliationAllocation, Exception, Approval, AuditEvent and ReportingPeriod. Add analytics entities only when implemented.

Define foreign keys, constraints, indexes, uniqueness scopes and state transitions. Keep allocations flexible enough for one-to-many and many-to-one reconciliation. Prevent cascading deletion of financial history. Document balance calculations and financial invariants. A full accounting ledger is conditional in the proposal: do not claim double-entry accounting unless JournalEntry and JournalLine are implemented and each posted journal enforces equal total debits and credits.

## 6. Interface and reliability

Use **Plus Jakarta Sans**, bundled locally with the application, as the interface font for headings, body text, navigation, forms and buttons. Use a balanced medium type scale: 16px (1rem) body text and inputs, 15px navigation/table text/action buttons, 14px supporting labels/captions/status badges, 18px card headings and 24–32px page/form headings. Hero headings scale responsively. Use consistent weights, restrained letter spacing and comfortable line heights. Respect browser text-size preferences through rem units. Keep mobile text readable and let controls wrap or tables/charts scroll rather than reducing text to tiny sizes. Keep code and JSON in a readable monospace font.

Cards use white surfaces, thin solid borders, 16px rounded corners, consistent 24px padding and subtle shadows. Add a small tinted rounded-square icon anchor beside or above each card heading. Use bold, tightly spaced titles and quieter body copy. On supported pointers, lift cards by 1px with a slightly deeper shadow; respect reduced-motion settings. Keep card actions compact and pill-shaped, aligned right or full width as appropriate. Preserve the existing palette, using accent colours in icon containers and indicators.

The sidebar is a full-height panel of fixed width with rounded-square app branding, the current role beneath the app name, and grouped navigation under lightly styled uppercase labels. Each navigation item has a consistent minimum height, a square icon container, a label, a distinct active surface and an inset left accent bar. Keep the navigation scrollable independently. Pin the profile at the bottom in a soft rounded container with avatar, full name, role and a visible sign-out button beneath the user details. Preserve role restrictions and mobile drawer behavior.

Provide a public home page at `/` that introduces FinBiz 360, its features and workflow, and gives users a clear entry point. Link new-company setup at `/register`, existing-user sign-in at `/login`, and the protected application at `/workspace`. Signed-in users can open their workspace from the home page; anonymous users must authenticate before entering. Include home navigation from authentication pages and the dashboard. Existing-company registration must never replace or clear company data.

Use the user's chosen turquoise-to-indigo theme: `background: linear-gradient(90deg, #6FE3E1, #5257E5)`. Apply it to branding and prominent surfaces, use indigo primary controls and turquoise chart accents, and pair it with light slate backgrounds and white data cards. Preserve readable text contrast on gradients and distinct success, warning and error indicators. Keep theme values centralized in CSS custom properties.

Style primary and secondary action buttons using the user's supplied Uiverse.io/cssbuttons-io design: white pill-shaped surfaces, 45px corners, uppercase spaced lettering, a soft drop shadow, a 7px hover lift and a 1px active lift. Match hover colour and glow to the indigo theme. Apply the same treatment to action links; keep compact navigation/icon controls appropriately sized, preserve visible keyboard focus, and suppress movement for reduced-motion preferences and disabled controls.

Use the user's supplied Uiverse.io/TechByElijah input style throughout forms, authentication, search and filters: softly shaded fields, no heavy border, 6px corners, subtle resting shadows, a gentle hover surface, a white focused surface with slightly deeper shadow, and a 2px accent underline that grows to full width on focus. Use shared input containers to keep icons, native selects, textareas, date fields and password visibility controls aligned. Use 15px desktop input text and 16px mobile input text, with responsive widths instead of a universal 200px limit. Preserve native validation, keyboard focus indication, disabled states and reduced-motion support. Any optional focus pulse should be subtle and must not affect surrounding layout.

For login and first-time company registration, follow the user's supplied reference: a centered rounded split card, a decorative gradient panel with a bold introductory headline on the left, and a compact light form panel with a logo, icon-led inputs and primary action on the right. Include decorative rings, dots and turquoise spheres using CSS. Share this layout across sign-in and the two-step company/owner and administrator registration flow. Adapt to stacked panels on mobile. Keep every displayed control connected to real behavior; provider social login and email password reset are not implemented.

Create a polished, accessible interface with consistent navigation, clear financial formatting, searchable paginated tables, useful filters, inline validation, loading/empty/error states and responsive desktop/mobile layouts. Include login, dashboard, transactions/detail, customers, suppliers, accounts, invoices, expenses, import preview, reconciliation workspace, exceptions, approvals, reports, audit history and settings.

Persist business data on the backend. Use appropriate indexes and server-side pagination. Target common queries below three seconds at the 95th percentile in a documented test environment; report measured results and dataset size rather than claiming an unverified guarantee.

Use HTTPS in deployment, secure password hashing, secure cookies, CSRF protection, least privilege and safe errors. Provide application logging without exposing secrets. Supply scheduled encrypted backup guidance and controlled restore tooling. Define provisional recovery objectives as assumptions to confirm with the organisation, then demonstrate restoration of a test backup.

## 7. Implementation order

Implement and verify in increments:

1. Foundation: repository setup, database, authentication, permissions and audit foundation.
2. Release 1: master data, cash/mobile money/bank transaction capture, expenses, basic invoices, statement preview/import, basic matching, exceptions, audit logging and core reports.
3. Release 2: complete approval workflows, split/grouped resolutions, period locking, expanded dashboards, exports and cash-flow analysis.
4. Release 3: explainable anomaly rules and conditional forecasting.
5. Handover: security/integrity checks, backup restoration, user acceptance scenarios and documentation.

Prioritize all Must requirements FR-01 through FR-28 according to their priority in the PDF. Track Should and Could requirements separately. Maintain a requirements traceability matrix linking each FR/NFR to implementation, tests and completion status. Do not silently treat unfinished features as complete.

## 8. Verification and acceptance

Use meaningful automated backend and integration tests, plus browser verification of essential workflows. Cover:

- Unauthorized access, each role's restrictions and prevention of self-approval where configured.
- Valid and invalid records for all three payment channels, decimal accuracy and rollback on failure.
- Invoice partial payments and prevention of duplicate/over-allocation.
- Valid/invalid CSV and XLSX, malformed dates/amounts, repeated uploads and retry-safe import commits.
- Exact matches, ambiguous references, similar amounts, partial/grouped settlements, fees, reversals, duplicates and unmatched records.
- Concurrent or repeated confirmation without double-reconciliation.
- Audit evidence, financial correction controls and locked-period restrictions.
- Dashboard/report/export totals agreeing with the same underlying filtered records.
- A successfully restored test backup.

Supply synthetic examples covering these cases. Document reconciliation rate with its eligible-line denominator, elapsed batch reconciliation time, record completeness, duplicate precision/recall when labelled data exist, response time and conditional forecast MAE. Keep suggested, confirmed and manually resolved matches separate. Provide a user acceptance checklist and baseline/post-implementation evaluation template; do not invent participant feedback or improvements.

## 9. Deliverables and completion report

Deliver frontend/backend source, database migrations, synthetic seed command, sample statement files, automated tests, API documentation, ERD and architecture diagrams, role matrix, setup/deployment guide, backup/restore guide, user guide, requirements traceability matrix and documented assumptions/limitations. Bootstrap demo users safely without hard-coded production credentials.

Run the relevant checks and report their actual outcomes. Finish with concise instructions for starting the application, accessing the synthetic demo, running tests and reviewing key workflows. Identify incomplete or conditional features clearly. Ask only for genuinely blocking information; otherwise use reversible, documented defaults and continue implementation.

### Shared visual refinement

Maintain a consistent professional visual system across the home page, sign-in, registration and every workspace module. Use a quiet neutral canvas, white surfaces, thin borders, restrained shadows, clear page separators and consistent icon containers. Reserve the turquoise-to-indigo gradient for accents and key visual anchors. Keep status badges pill-shaped, table headers distinct, financial figures aligned with tabular numerals, and empty states purposeful. Keep the requested raised pill buttons and softly shaded input fields. Include visible keyboard focus and a skip link to workspace content. Preserve the readable 15px body / 14px supporting type scale, responsive layouts and reduced-motion support.

Dashboard layout: show role, organisation and current date/account scope above the summary metrics. Provide permission-aware shortcuts to transactions, approvals, reconciliation and accounts using saved record counts. Place accepted inflow/outflow totals above the cash-flow chart, identify account values as net movement for the selected period, and provide an explicit empty state when no accounts exist. Stack chart, accounts and review panels on narrower screens. Preserve existing permissions, data filters and automatic refresh.

Sidebar navigation uses the original neutral light surface, muted inactive items, subtle hover tint and a lightly accented active item. Keep the logo, grouped navigation and profile area. Do not apply a full sidebar gradient or gradient animation. The removed location card remains omitted.

Landing-page entry links must consistently say ?Sign in? and navigate to `/login`, including when a session already exists. The login route must display the login form instead of automatically forwarding visitors to the workspace. Navigate to the workspace after successful authentication. Company registration remains available as a separate flow.

### Current card design

Apply the Uiverse.io card design by SouravBandyopadhyay to dashboard summary cards, contact cards, account cards, report cards, reconciliation review cards and landing-page feature cards. Use a pale blue gradient (`#c3e6ec` to `#a7d1d9`), 10px corners and a small dark gradient corner arrow. Expand a dark blue gradient (`#364a60` to `#384c6c`) from the upper-right corner on hover or keyboard focus, changing titles to white and descriptions to soft white. Preserve Plus Jakarta Sans, the current readable type scale and responsive grid widths. Do not impose the reference?s fixed 300px width or 320px height. Keep table/chart panels readable and preserve existing button, badge and icon contrast. Disable transition animation under reduced-motion preferences. This card treatment supersedes the earlier plain-white card surface guidance for these cards.

### Dashboard reference layout (current)

Match the supplied teal dashboard reference: light curved sidebar, teal active navigation, rounded search field with Ctrl/Cmd+K support, current date, approval count and profile initials, personalised welcome banner, four compact financial cards, a two-column financial overview/insights row, and quick actions/recent activity beneath. Preserve every existing route, role restriction, transaction operation, account/date filter and refresh behaviour. Retain Accounts, Approvals and Audit trail even though the reference has a different menu. Do not add a nonfunctional Analytics menu or support button. Use actual recorded data for the area chart, small trends, counts and activity; show purposeful empty states instead of sample chart values. Do not invent percentage changes, provider health or reconciliation deadlines. Keep account movement accessible in an expandable section. Dashboard cards follow this reference instead of the earlier expanding blue hover cards. Use responsive layouts and the current readable Plus Jakarta Sans typography.

## Current enhancement brief and handover (supersedes earlier release limits)

The supplied master enhancement brief is retained in `docs/MASTER_ENHANCEMENT_REQUEST.md`. Audit and final traceability/evidence are in `docs/ENHANCEMENT_AUDIT.md` and `docs/ENHANCEMENT_REPORT.md`. Preserve this React/Node.js/SQLite application and existing APIs/data; extend existing conventions. Do not seed or benchmark company databases.

The current design uses soft turquoise (#14B8A6), deep teal (#0F766E), soft turquoise (#CCFBF1), pale backgrounds and neutral white cards; no emerald primary or full-sidebar gradient. Keep the teal dashboard layout, original navigation plus operational additions, readable Plus Jakarta Sans and compact profile card. The later enterprise design brief supersedes the earlier expanding blue hover-card treatment.

Maintain editable/audited users/reference records; exact opening/movement/closing balances; evidence and manual verification; invoices and supplier bills with allocation corrections; balanced and partial reviewed reconciliation; exception investigations; independent controls and explicit payment delegation; shared filtered reports; explained anomaly rules and conditional baselines; safe backup/restore. Do not auto-confirm tolerance discrepancies or invent financial data. Document actual external acceptance/deployment limits instead of claiming production readiness. Follow the 20 UAT scenarios before company sign-off.
