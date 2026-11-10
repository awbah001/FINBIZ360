# FinBiz 360

A local financial management workspace for a retail/trading business in Freetown. Built with **React + TypeScript, Node.js + Express, and SQLite**. The PDF supplies the business requirements; the user-selected stack replaces its Django/PostgreSQL proposal.

The default app now opens a **clean company workspace**, without synthetic transactions, customers or accounts. A separate optional demo is available. This is an initial development release, not the completed enterprise roadmap or a payment service.

## Start on Windows

Use Node.js 22.16 or newer; development was verified with Node.js 25.2.1. SQLite is included through `node:sqlite`, so no database installation or native npm compilation is needed. Some Node versions print an experimental SQLite notice.

```powershell
cd "C:\Users\DEVNET\Desktop\HANNAH PROJECT"
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. The backend runs at http://127.0.0.1:3001. Vite proxies `/api` to the backend so cookies and CSRF work on the same origin. Both servers bind to loopback by default.

The root URL is the public home page, introducing the system's features and workflow. Its entry button opens `/register` for an empty company workspace, `/login` for existing users, or `/workspace` for an authenticated user. Direct access to `/workspace` redirects to the appropriate authentication flow. Login, registration and the dashboard brand link back to the home page. Registration on an already configured company explains how staff obtain access; it cannot reset company data.

On the first visit, enter your organisation details and create distinct owner/manager and administrator accounts. Then sign in, add your real cash/bank/mobile money accounts, and record transactions or import statements. Company data is persisted in `data/workspace.db`. Dashboard and open record views refresh every 15 seconds while visible, on window focus, and after your own changes. A timestamp shows the last successful refresh. This refreshes application records; it is not an automatic bank or mobile money feed.

If you are still seeing the old demo, stop the old development server with Ctrl+C, ensure `DB_PATH` is not pointing at the old demo file, run `npm run dev` again, and refresh the browser. Existing `data/finbiz.db` is preserved; no old records are deleted or silently converted.

## Optional separate demo

With `DB_PATH` unset, use `npm run seed` followed by `npm run dev:demo`. These commands use **data/finbiz-demo.db**, separate from company records. The seed command generates and prints one random demo password for these accounts:

| Email               | Role                    |
| ------------------- | ----------------------- |
| manager@finbiz.demo | Owner / Manager         |
| finance@finbiz.demo | Finance Officer         |
| cashier@finbiz.demo | Cashier / Sales Officer |
| auditor@finbiz.demo | Read-only Auditor       |
| admin@finbiz.demo   | System Administrator    |

Seeding an existing database is intentionally refused. For another fresh demo without removing existing data, set `$env:DB_PATH='./data/another-demo.db'` before both `npm run seed` and `npm run dev:demo`. You may set `$env:DEMO_PASSWORD` to a unique password of at least 12 characters before seeding; it is never committed to source. Never seed your company database. To inspect the original preserved demo instead, set `$env:DB_PATH='./data/finbiz.db'` before starting the app, then unset that override before returning to company records.

## What works

- Persistent, hashed server-side sessions; scrypt password hashes; CSRF checks; login throttling; deactivation and password-change session invalidation.
- Five server-enforced roles, including cashier-owned records and independent manager approval. Administrators have no business approval authority.
- Cash, mobile money and bank accounts; customer/supplier creation; exact monetary recording; searchable, paginated transaction register; retry-safe transaction creation.
- Cash receipt/voucher validation; incoming receipts and outgoing expenses; outgoing payments held for independent approval.
- Invoices and partial payment allocation with customer validation and over-allocation protection.
- CSV/XLSX statement mapping, preview, row validation, excluded-row reasons, duplicate-file checks, explicit commit, original source retention and retry-safe commits.
- Exact reference/amount/date/account/direction suggestions, explicit confirmation, duplicate/ambiguous/unmatched exceptions and audited undo.
- Filtered cash-flow dashboard, account movements, CSV/PDF exports, immutable audit events and closed reporting periods.
- Consistent SQLite backups and automated restoration/integrity tests.

## Useful commands

```powershell
npm test           # API/integrity tests, temporary isolated databases
npm run build      # TypeScript check and production frontend build
npm start          # API and built frontend at http://127.0.0.1:3001
npm run backup     # Consistent database snapshot under backups/
npm run format:check
```

To use a different backend port during Vite development, also update the Vite proxy target. `.env.example` describes environment variables; this app does not automatically load `.env` files. Set variables with PowerShell, for example `$env:PORT='3001'`.

## Design and financial assumptions

The interface uses locally bundled **Plus Jakarta Sans**, with 15px body and desktop input text, 14px navigation/table/action text and captions, 17px card titles and responsive larger headings. Mobile inputs stay at 16px for comfortable entry. Font files are served by the app; Google Fonts access is not required. The turquoise-to-indigo palette and raised pill buttons remain the visual theme. A shared design layer keeps the public home page, authentication and workspace consistent: neutral canvas, white cards, restrained accent gradients, rounded status badges, clearer table hierarchy, accessible focus states and responsive dialogs.

One organisation, SLE with two decimal places and Africa/Freetown. Accounts support an immutable nonnegative opening balance/date. Additional currencies and configurable precision are not yet implemented. The organisation name is editable by an administrator. All timestamps in audit history are UTC.

Money is stored as integer minor units, constrained below 1 trillion minor units per transaction and sent as JSON strings. Aggregate cash-flow sums and displayed monetary formatting use BigInt. Chart geometry uses approximate numbers for visualization only. No financial operation uses floating-point currency arithmetic.

`Net cash movement = accepted inflows − accepted outflows`. Accepted means `approved` or `not_required`. Pending/rejected outflows do not affect the displayed movement. Account closing values include the opening snapshot and accepted entries through the selected end date; movement is shown separately. These are recorded book balances, not independently verified bank balances. Invoices do not generate cash receipts; allocation links an existing receipt without counting income again. Reversals create linked opposite entries. A full balanced double-entry ledger is not implemented.

Core financial fields cannot be updated/deleted. SQLite triggers also prevent audit modification/deletion. This protects against ordinary application changes, not an operator with direct database-file access. SQLite uses foreign keys, WAL, a busy timeout and atomic write transactions. Run a single API instance; this version is not designed for multiple writers across networked hosts.

## Backup and deployment

See [operations](docs/OPERATIONS.md), [API and architecture](docs/ARCHITECTURE.md), [user walkthrough](docs/USER_GUIDE.md) and [requirements status](docs/REQUIREMENTS.md).

No external payment credentials are requested. Actual bank/mobile money data currently enters through statement imports; a future automatic feed needs official provider access and authorization. Statement source files are stored inside the SQLite database, so database backups include the source evidence. Encrypt backups before off-device storage; automatic backup encryption and scheduling are not implemented. The default SQLite file itself is not encrypted.

Before a real pilot, use the company workspace with individual staff accounts, obtain organisational approval, configure HTTPS and secure production cookies, choose backup/retention policies, validate provider statement formats, and complete user acceptance/security review. Live APIs, transaction evidence attachments, configurable categories/approval thresholds, split/grouped/manual exception settlement, notifications, anomaly detection, forecasting and production hosting remain later work. See the traceability file for precise limits.

## Verification recorded for this release

The expanded suite contains 45 passing automated tests (including the original 21). The API suite covers empty-company setup, setup validation/lockout, demo isolation, cross-session visibility and persistence, production setup tokens, permissions, CSRF, currency precision, invalid dates, all payment channels, retries, self-approval, closed periods, CSV/XLSX imports, matching ambiguity, repeated reconciliation, invoice allocation, immutable audit/financial records, exports, session invalidation and backup restoration. The TypeScript/frontend build passes. The current `npm audit --json` reported zero known dependency vulnerabilities; see docs/DEPENDENCY_AUDIT.json. This is not a production security certification.

Local HTML and proxied session endpoints returned HTTP 200. Browser visual verification could not be completed: the browser connector was unavailable and the native browser launch timed out awaiting app approval. Responsive CSS and accessibility support are implemented but require a subsequent visual/UAT pass.

The workspace dashboard follows the teal reference layout with personalised welcome, financial summary cards, a cash-flow area chart, saved-record insights, permission-aware quick actions and recent transactions. Header search opens the transaction register with a description/reference query; Ctrl/Cmd+K focuses it. The chart?s period control provides date and account filters. The bell opens payment approvals, the profile opens Settings, and Refresh reloads saved records. Account movement remains available in an expandable section. Empty workspaces show no sample financial activity, invented growth percentages or reconciliation deadlines.

## Enhancement handover

Read [the final implementation report and requirements matrix](docs/ENHANCEMENT_REPORT.md), [pre-change audit](docs/ENHANCEMENT_AUDIT.md) and [user acceptance checklist](docs/UAT_CHECKLIST.md). The source was extended in place; local technical verification does not establish production or human acceptance.

Additional workflows include Supplier bills, Exceptions and Analytics; editable references/users; private evidence; invoice lifecycle/itemised invoices; independently reviewed adjustments/write-offs/period requests; balanced and partial reconciliation; broader report exports; and safe restoration. Income and expenses continue to use the existing transaction workflow. New table/field migrations v3-v6 run at startup without deleting original postings.

```powershell
npm test
npm run build
npm run benchmark
npm run restore -- --source backups/selected-snapshot.db --destination data/restored-new.db
```

Restoration refuses an existing destination and invalidates restored sessions. Set `DB_PATH` to the verified new file only after operator review. Admin Settings also provides a consistent backup download. Encrypted scheduled snapshots are available in System maintenance once the server encryption key is configured. Production HTTPS, off-site storage/key custody and company UAT remain operator requirements; see docs/OPERATIONS.md. A local Git repository was initialised; changes were not committed or published.

## UI/UX enhancement

The 2 November 2026 UI pass consolidates shared tokens and actions, rebalances login, improves modal fields and mobile navigation, and adds searchable checkbox selection with exact reconciliation summaries. See [UI/UX handover and component guide](docs/UI_UX_HANDOVER.md) for the changed-screen inventory, test evidence and outstanding browser acceptance checks.

## Role responsibilities and access policies

All five roles now have dedicated dashboard content and server-enforced workspaces. Users provides searchable staff management and reauthenticated password reset; Settings provides explicit auditor export and cashier customer/allocation policies. Migration 7 adds only those default-off policies and audit indexes. The Approval Centre includes completed decision history; cashier daily figures distinguish receipted sales without recording cash twice. See [the complete role matrix, implementation report and limitations](docs/ROLE_WORKSPACE_AUDIT.md). Restart the backend to install the updated routes and safe startup migration. Browser UAT remains pending because the browser host is unavailable.

Profile supports adding, previewing, replacing and removing a personal photo for every role. Choose **Profile → Add photo → Save photo**. JPG, PNG and WebP images up to 10 MB are resized locally before saving; the saved image appears in the sidebar as well. Startup migration 8 stores photos separately from user credentials in the database, and photos are included in database backups. Restart the backend after updating to install the migration and upload routes.

Profile photos also appear in the desktop/mobile header, staff directory, approval identities, transaction recorder details and audit/activity entries. Authenticated staff can see workspace profile photos; each user can edit only their own. Missing or unavailable images fall back to initials alongside the existing user names.
