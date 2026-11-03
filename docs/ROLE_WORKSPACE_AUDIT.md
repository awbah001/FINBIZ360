# FinBiz 360 RBAC implementation and responsibility matrix

Date: 3 November 2026. This document describes the final implementation for the supplied complete-RBAC brief and supersedes the earlier dashboard-only audit.

## Architecture and audit findings

The existing React/TypeScript/Vite frontend, Express API, SQLite database, five role identifiers, cookie sessions, eight-hour expiry, scrypt password hashing and CSRF controls are retained. No role tables, authentication replacement or financial ledger replacement were introduced.

The existing code already implemented immutable postings and audit events, receipt/expense recording, evidence, CSV/XLSX import, reconciliation and partial/group proposals, invoices and supplier allocations, independent manager controls, reports, backups and new-file restoration. These workflows were preserved and regression-tested. The remaining gaps were user search/reset, administrative reference configuration, explicit organisation policies, daily dashboards, completed approval history, audit filters, role activity notifications and direct-link denial states.

## Role and permission matrix

| Capability                                            | Administrator                                 | Owner / manager                  | Finance                           | Cashier / sales                                          | Auditor                                      |
| ----------------------------------------------------- | --------------------------------------------- | -------------------------------- | --------------------------------- | -------------------------------------------------------- | -------------------------------------------- |
| User creation, roles, activation and reset            | Yes, with self/last-admin protections         | No                               | No                                | No                                                       | No                                           |
| Organisation and access policy                        | Yes                                           | View financial settings          | View financial settings           | No                                                       | No                                           |
| Categories and account reference setup                | Yes; no financial opening amounts             | Yes                              | Yes                               | Active choices only                                      | Read-only financial evidence                 |
| Company financial dashboard / records                 | No                                            | Yes                              | Yes                               | Own records only                                         | Read-only                                    |
| Receipts and receipted sales                          | No                                            | Yes                              | Yes                               | Own incoming records                                     | No                                           |
| Expenses / payments                                   | No                                            | Yes                              | Yes; pending independent approval | No                                                       | No                                           |
| Customers / suppliers                                 | Reference setup does not grant contact access | Maintain                         | Maintain                          | Active customer lookup; customer creation only by policy | Read-only                                    |
| Invoice allocation                                    | No                                            | Yes                              | Yes                               | Own receipt, same customer, only by policy               | Read-only                                    |
| Statements / reconciliation                           | No                                            | Operate and review               | Operate                           | No                                                       | Read-only review                             |
| Payment decisions                                     | Only explicit manager delegation              | Independent decisions            | Only explicit manager delegation  | No                                                       | History/review only                          |
| Control requests, write-offs, group/partial decisions | No                                            | Independent management decisions | Prepare requests                  | No                                                       | Review only                                  |
| Financial reports                                     | No                                            | Review/export                    | Review/export                     | No                                                       | Review; export only by explicit audit policy |
| Audit history                                         | Administrative/configuration events           | Financial and system evidence    | Financial and system evidence     | No                                                       | Read-only evidence                           |
| Full database backup                                  | Yes                                           | No                               | No                                | No                                                       | No                                           |
| Own profile and password                              | Yes                                           | Yes                              | Yes                               | Yes                                                      | Yes                                          |

Internal role values remain `admin`, `manager`, `finance`, `cashier`, `auditor`. An administrator cannot change their own role or deactivate themselves. The last active administrator cannot be removed. User access changes revoke sessions. Role changes and deactivation also revoke old payment delegations; activation or reassignment does not revive them. Administrators can assign business roles to other staff as an explicit user-management action; this does not grant their own account financial decision authority.

## Enforcement and scope

`server/access.js` enforces a default-deny API boundary after authenticated session and CSRF processing. Existing route-level authorization and business checks remain in place. The server reads role and active status from the database session context, never from request-body role claims. HEAD requests use GET authorization. Auditor mutation requests, cashier administration/reconciliation requests and unauthenticated/inactive-user requests are rejected.

Frontend pages, shortcuts and exports use the same role/capability context. Direct links use `/workspace?page=Users`, `/workspace?page=Statements`, etc. Unauthorised pages render an Access denied state and do not mount the forbidden workflow or fetch its module data. Browser back/forward navigation retains unsaved-change checks. Role changes invalidate the old session; policy/delegation changes are rechecked on every API request and refreshed by the client.

This is one organisation per database, with company-wide account access for manager/finance/auditor and own-transaction scope for cashiers. There is no tenant identifier or per-person account-assignment model. Cross-organisation isolation is therefore a deployment/database boundary, not a claimed multi-tenant feature.

Cashier master payloads omit opening balances, suppliers and expense-only categories. Search excludes supplier and inactive-customer results. Supplier histories and other users' receipt/evidence identifiers are denied. Receipt allocation checks ownership and same-customer scope before invoking the existing atomic invoice allocation logic. The original accepted/unreversed receipt, closed-period, invoice state, available amount, write-off and over-allocation checks still apply.

Administrators receive no financial master payload, transaction register, statement evidence, financial reports or reconciliation access. Their dedicated configuration payload includes account metadata and categories. Administrative account audit snapshots are redacted to reference fields. A manager-granted administrator delegation permits only the payment queue, payment decisions and completed payment history. Backup access intentionally includes the full database and its private evidence.

## Implemented responsibilities and workflows

### Administration

Users provides name/email search, role/status filters, status and role editing, account creation and secure password reset. Registration and last-login timestamps are derived from immutable audit events where available; unavailable legacy dates display Not recorded. Reset requires the acting administrator's current password and a reason, is rate-limited, uses the existing scrypt hashing and revokes the target's sessions. A random temporary password is shown in memory once and is never written to audit logs. Users must change it through Profile; automatic emailed recovery and forced-change-at-login are not implemented.

Settings reuses category maintenance and account-reference APIs, with supported channels, SLE currency and CSV/XLSX import capabilities clearly identified. Admin-created account references start at zero; financial opening balances require financial authority. Three explicit organisation policies control auditor exports, cashier customer creation and cashier receipt allocation. All default off. Policy changes record before/after values and a reason.

The administrator dashboard includes total/active/inactive users, session counts, role distribution, configuration status and recent administrative activity. The administrative audit view supports exact user/action and date filtering. Server errors with HTTP 5xx are recorded as sanitised operational events; no persistent stack-trace viewer or external monitoring service is claimed.

### Management and finance

Managers retain the existing cash-flow chart, inflow/outflow/net/count metrics, account movements, customer/supplier obligations and reconciliation information. Their decision panel leads to payment review and financial controls/delegation.

The Approval Centre retains pending payments and control requests and adds completed payment, adjustment, write-off, reversal, reporting-period, grouped reconciliation and partial-match history with reviewer, status, timestamp, reason and record reference. Current financial filters apply to relevant records; no account attribution is invented for unrelated document/system events. Self-approval and duplicate/completed decisions remain blocked.

Finance retains receipt/expense recording, evidence, invoices, suppliers/customers, report preparation, statement imports, matching and exception investigation. A direct Record expense action preselects outflow in the existing transaction form. Its dashboard adds transaction totals, today's accepted inflows/outflows, unmatched records, pending expense approvals, obligations and recent statement imports.

### Cashier / sales

The simplified dashboard provides separate Record sale and Record receipt actions, today's receipted sales, total receipts, cash/mobile/bank breakdowns, sale counts, own transaction counts and recent records. A sale is an incoming receipted sale, classified in the existing immutable transaction-create audit event; legacy incoming transactions retain receipt classification. Sales are included in receipt totals and are not added again. This is not a separate inventory or accrual sales ledger.

Daily totals use Africa/Freetown and the selected date/account filters. A range excluding today returns zero daily amounts. Customer creation and same-customer invoice allocation appear only when their organisation policies are enabled. A receipt can partially pay an invoice using the existing exact allocation model. The existing unique invoice/receipt pair is retained; further changes to that pair require the existing finance correction process rather than duplicate allocations.

### Auditor

The auditor receives a review dashboard, reconciliation/exception counts, recent financial decisions, audit activity, transaction/evidence review, imports, matching history and the Approval Centre history. No financial mutation controls or APIs are enabled. Report previews remain available; export links and APIs are disabled until the administrator explicitly enables the audit export policy. There is no individual review-completion tracking, so available record counts are not falsely labelled transactions reviewed.

### Notifications and audit

The existing bell now opens recent role-scoped activity, refreshed every 15 seconds: administrative events, management decision queues, finance imports/decisions, own cashier receipts or auditor audit activity. It reports saved events, not fabricated unread messages. Save/validation/import errors continue to use the existing immediate feedback. Failed requests that never create an import are not represented as successful imports. No email/push delivery or persistent read/unread inbox was added.

Critical business and administrative operations continue to append immutable audit events, including reset, policy changes, role/status edits, financial postings, allocation, import, reconciliation, exception decisions, management decisions and exports. Request passwords and generated temporary passwords are excluded from audit details.

## Database migration and compatibility

Migration 7 adds three constrained boolean fields to the existing settings row:

- `auditor_export_allowed`, default 0.
- `cashier_create_customers`, default 0.
- `cashier_invoice_allocation`, default 0.

Two audit indexes support role metadata and transaction classification lookups. No user or financial rows are deleted, reseeded or rewritten; primary roles and relationships remain unchanged. Restore validation now recognises version 7. The populated-v2 migration test confirms preservation of original users, transactions, invoices and immutable audit events, database integrity and idempotent reopening.

For rollback, stop all app processes, keep a consistent backup and use a verified database copy with the matching version-6 application. Confirm `SELECT MAX(version) FROM migrations` returns 7 and no later migration exists. Then apply [the version-7 rollback SQL](RBAC_V7_ROLLBACK.sql). This removes only the new policy fields/indexes and migration marker. It intentionally discards those policy choices; financial/user/audit records remain. Restarting the current application reapplies migration 7, so pair a rollback with the intended application version. No rollback was run against company records.

## Modified implementation files

- `server/access.js`: role/policy/API boundary.
- `server/app.js`: capabilities, sale classification, user delegation revocation, admin summary, shared allocation handler and scoped approvals.
- `server/role-features.js`: user search/reset, configuration, audit filters/redaction, approval history, cashier allocation and notifications.
- `server/role-data.js`: business date and normalised decision history.
- `server/enhancements.js`: daily/role summaries, scoped search and reference audit handling.
- `server/db.js`, `server/restore.js`: migration 7 and restore compatibility.
- `src/main.tsx`, `src/roleWorkspace.ts`: deep links, denial states, capabilities, filters and role workflow integration.
- `src/RoleWorkflows.tsx`: policy/configuration, decision history, reset and receipt allocation interfaces.
- `src/RoleDashboard.tsx`, `src/Dashboard.tsx`, `src/role-workspace.css`: daily/administrative/review content and role activity popover using the existing design.
- `src/Enhancements.tsx`: organisation-policy-controlled report exports.
- `tests/rbac-complete.test.js`, `tests/role-boundaries.test.js`, `tests/role-workspace.test.js`, `tests/migrations.test.js`, `tests/enhancements.test.js`: workflow, policy, direct-link/API and migration evidence.

## Verification and remaining limits

Final verification: **56 automated tests passed, 0 failed** (`npm test`); the production TypeScript/Vite build passed (`npm run build`); formatting checks passed for all changed implementation/test files. The migration-7 rollback test also passed and confirmed preservation of users, financial records and immutable audit events. Tests use isolated databases. No company records were seeded for evaluation.

| Role / boundary         | Verified scenarios                                                                                                                                              | Result |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Administrator           | User creation/search/filter, metadata, reset reauthentication, session revocation, configuration/reference setup, no automatic approval                         | Passed |
| Owner / manager         | Financial records/reports, independent payment/control/group/partial decisions, immutable history and reporting locks                                           | Passed |
| Finance                 | Receipts/expenses, statements, evidence, invoice/supplier allocation, reconciliation, reporting, no unauthorised/self decisions                                 | Passed |
| Cashier                 | Receipted sales, exact daily/channel/account totals, own history/evidence, policy-controlled customers and partial invoice allocation, IDOR/admin/report denial | Passed |
| Auditor                 | Financial/evidence/audit/approval review, default export denial, explicit policy grant/revocation, forbidden writes                                             | Passed |
| Authentication / policy | CSRF, session expiry/renewal, inactive accounts, role-spoof denial, access/delegation revocation and direct-link authorization helpers                          | Passed |
| Preservation / recovery | Populated legacy migration, integrity, unchanged users/postings/audit, consistent backup, new-file restoration and safe rollback                                | Passed |

Direct browser interaction and visual acceptance were not passed or claimed; they remain blocked as described below.

Browser inspection was attempted again. Native Computer Use returned `Computer Use native pipe is unavailable`; browser inventory returned `The browser access host is unavailable`. React render checks and the production build verify markup/compilation, not interactive browser acceptance, mobile keyboard behaviour or pixel accuracy. Human role-by-role UAT remains pending.

The app remains a local, single-organisation SLE workspace. Arbitrary currencies, extra channel/parser plugins, tenant/account assignment, persistent notification delivery, draft posted transactions, automated email recovery, forced initial-password rotation, per-auditor review tracking and external error monitoring are outside the current compatible implementation. Existing draft invoice support is retained. These are stated limits, not placeholder buttons.
