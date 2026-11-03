# First walkthrough

1. Start the app with `npm run dev` and open the home page at `http://127.0.0.1:5173`. Choose **Sign in**, which opens `/login` even when a session exists. For first-time company registration, follow the registration link or open `/register`. During registration, configure your company and create owner/manager and administrator accounts with distinct email addresses. Sign in as the owner/manager. Overview starts at zero. Add your cash, bank and mobile money accounts under Accounts, and create contacts as needed. Sign in as administrator to create finance/cashier users for your staff. The optional `npm run seed` + `npm run dev:demo` flow is separate and contains synthetic activity.
2. Open Transactions. Record an inflow with its date, SLE amount, account, category and description. Cash requires a receipt/voucher reference. Click a transaction's description for full details and its internal ID.
3. Sign out and sign in as finance. Record an outflow. It remains pending and is excluded from accepted cash-flow totals. Sign in as the manager, open Approvals, and approve/reject with a reason. The creator cannot approve their own payment.
4. Finance or manager can add customers and suppliers. Create a customer invoice under Invoices. Record an incoming receipt for the same customer, copy its internal ID from transaction details, and allocate part or all of the receipt to the invoice. Amounts cannot exceed the invoice balance or available receipt.
5. For reconciliation, first create a mobile money receipt for `2026-10-01`, reference `TEST-REF`, amount `123.45`. Create a local CSV with the content below. This deliberate test date is independent of the demo seed date.

```csv
date,reference,amount,direction,description,currency
2026-10-01,TEST-REF,123.45,in,Test mobile receipt,SLE
2026-10-01,UNRECORDED,55.00,in,Exception example,SLE
bad-date,INVALID,10.00,in,Rejected row,SLE
```

6. In Statements, choose the same mobile money account and upload this file. The default mapping matches these column names. For files without `currency` or `description`, clear those optional column mappings. Preview should show two valid rows and one error. Confirm the two valid rows explicitly. The invalid row stays excluded and its reason is retained.
7. Open Reconciliation. `TEST-REF` has an exact suggestion; `UNRECORDED` remains unmatched. Review and confirm the suggestion with a reason. Confirmed evidence can be undone with a reason. Similar amounts never create an automatic confirmation; duplicate/ambiguous evidence remains an exception.
8. Open Reports. Apply the same date/account filters used in the dashboard. Download CSV or PDF. CSV amounts are minor units (divide by 100 to interpret as SLE). The CSV is protected against spreadsheet formula execution in text fields.
9. Open Audit trail to inspect actions and reasons. Open Settings as manager to close/reopen a reporting month. Resolve pending approvals first. Closed months reject financial changes, new imports for that month, reconciliation decisions and allocations touching that month.
10. Open Settings as administrator to rename the organisation or download backups. Use Users to create staff, change roles or deactivate accounts. Administrator role alone does not allow financial approval. All roles can change their own password; doing so signs out all sessions for that user.

The included downloadable sample under Statements uses fixed November 2026 dates. It demonstrates valid, unmatched and invalid rows; it may not match the seed records when seeded on a different date/account. Use the explicit scenario above for a reproducible match.

## User acceptance record

For each walkthrough task, record the participant role (use an anonymized identifier), date, completion result, elapsed time, errors, assistance needed and feedback. Compare reconciliation batches against a documented baseline using comparable item counts and channels. Do not record invented participants or achieved improvements.

Reconciliation rate is confirmed matched eligible statement lines divided by all eligible statement lines. Report suggestions, confirmed matches and human resolutions separately. Record completeness is complete records divided by tested records. Duplicate precision/recall require a labelled test set. Forecast MAE is not applicable until a forecast model exists.

## Enhanced daily workflows

- **Customers/Suppliers:** search by name/reference/contact details, filter active status, edit with a reason, and open account history. Inactivation retains historical records.
- **Accounts:** enter the base SLE balance and effective date when creating an account. Opening amounts are immutable, nonnegative snapshots. View closing book balance and separate period movement; edit name/provider/status with a reason. Clearing is an account purpose using the chosen payment channel.
- **Transactions:** use channel/category/approval/reconciliation filters and date/amount sorting. A possible repeated external reference produces a warning. Correct posted entries with audited reversals/adjustments instead of editing/deleting their financial fields.
- **Evidence:** open transaction details to upload PDF/PNG/JPEG (2 MB, up to five files). Do not upload payment credentials. Finance can record manual evidence verification; it is not a provider API confirmation and does not automatically reconcile a statement.
- **Invoices:** create simple or itemised invoices, choose draft/issued, issue drafts or cancel unallocated documents with a reason. Partial receipts must already exist for the same customer. Payment history allows allocation correction without deleting history. Issued documents with write-offs cannot be casually cancelled.
- **Supplier bills:** record the obligation, then allocate an independently approved same-supplier outgoing payment. Review payment history and correct allocations before reversing a linked payment.
- **Reconciliation:** exact suggestions retain Confirm/Reject. Configure tolerances as manager; these only suggest evidence. Use reviewed matching for balanced groups/net-of-fee settlements or partial mode for a named amount between one transaction/statement line. A different manager approves. Partial remainders stay visible; original amounts do not change. Undo retains history and honours period locks.
- **Exceptions:** filter source issues by account/channel/date/type/status and record an investigation reason. Managers may dismiss documented invalid/duplicate non-posting evidence. Resolve financial differences using actual recorded adjustments and approved matches; do not hide them with a note.
- **Approvals:** payment approvals require a manager or explicitly delegated active finance/admin reviewer, always different from the author. Additional control requests cover adjustment/fee, non-cash document write-off, reversal and reporting-period closure; a different manager decides. Write-offs reduce outstanding documents only and never generate cash income or mark an unpaid amount paid.
- **Reports/Analytics:** choose financial report type and CSV/XLSX/PDF downloads. Monetary export fields are exact minor units. Customer/supplier document balances use issue-date scope and have no account attribution. Account statements show running filtered accepted movements; use the Accounts report for full book balances. Analytics rules explain why an item needs investigation; a gated, dated baseline appears only with sufficient recent recorded history.
- **Header:** global search returns permitted transactions/contacts/documents, Ctrl/Cmd+K focuses search, the account and date controls filter recorded scope, the bell opens approvals, Refresh reloads records and the profile opens Settings.
- **Settings:** administrators manage organisation settings and backup downloads; Users provides staff profiles, roles and status. Managers explicitly grant/revoke additional payment approval authority. Category references can be maintained without changing old transactions. Follow OPERATIONS.md for a new-file restore and deployment controls.

The browser/company UAT checklist remains pending; record actual acceptance evidence in UAT_CHECKLIST.md. No live payment provider is connected and the app never initiates payments.

## Role-specific workspaces

Each sign-in opens the workspace assigned to the user's role:

- **System administrator:** staff counts, active sessions, recent system activity, a dedicated Users directory, organisation settings and consistent backup downloads.
- **Owner / manager:** company cash-flow dashboard, business records, independent payment review, reporting and financial controls.
- **Finance officer:** reconciliation workload, pending payments, customer/supplier balances, statement imports, exceptions and receivables.
- **Cashier:** personal receipt totals and transaction history, receipt recording and customer lookup. Transaction data remains restricted to the signed-in cashier by the server.
- **Auditor:** read-only record/reconciliation summaries, reports, payment decision inspection and audit evidence.

Navigation and dashboard shortcuts follow the role. All users can open Profile to change their own password. Administrators create and edit staff under Users; Settings contains organisation, access-policy, reference configuration and backup controls. A manager's explicit approval delegation also enables the Approvals menu for that administrator. A central server-side role boundary enforces both read and write access. Administrators cannot retrieve financial records, statement evidence, reports or reconciliation data through direct API requests. Delegation grants access only to payment review, decisions and completed payment history. Administrators retain full-database backup access as part of system operations. Cashier account choices omit opening balances; customer search and history exclude suppliers. Hiding a menu is not the API access boundary.

## Complete role workflows

- Administrators use **Users** to search/filter staff and reset passwords. A reset requires the administrator's own current password and a reason; it revokes the user's sessions and shows a temporary password to share privately. Users should change it in Profile. Old accounts without a recorded creation date display Not recorded.
- **Settings** now contains organisation access policies, categories and payment-account references. Auditor report exports, cashier customer creation and cashier invoice allocation are disabled until explicitly enabled. Account-reference setup does not permit administrative financial postings or nonzero opening balances. SLE and CSV/XLSX remain the supported currency and statement formats.
- Managers and authorised reviewers use **Approvals** for pending work and completed decision history. Auditors can inspect that history. Role changes and deactivation remove old payment delegations; reactivation alone does not restore them.
- Cashiers can choose **Record sale** for an incoming receipted sale or **Record receipt** for another incoming payment. A sale already counts as a receipt; do not enter both for the same payment. Today's totals and cash/mobile/bank breakdowns use the signed-in cashier and selected filters.
- Where the organisation permits it, open an own receipt's transaction details to allocate an exact amount to an existing same-customer invoice. Allocating does not create a second cash entry. Finance handles corrections to an existing invoice/receipt allocation pair.
- **Audit trail** filters immutable events by exact user ID, exact action and date. **Approvals** includes completed decisions with reasons and reviewers. The bell shows recent role-scoped activity rather than an unread-message count.
- Authenticated direct links use `/workspace?page=Statements` or other existing page names. Forbidden destinations display Access denied; the API still enforces permissions independently.

See [the complete RBAC matrix and limitations](ROLE_WORKSPACE_AUDIT.md) for policy defaults, migration details and verification status.
