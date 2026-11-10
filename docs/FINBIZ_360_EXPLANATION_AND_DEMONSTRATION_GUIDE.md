# FinBiz 360 Project Explanation and Demonstration Guide

Prepared for the project owner and presenter on 8 November 2026.

This guide explains what FinBiz 360 does, the terms used in the application, the responsibilities of each user, and how to demonstrate its workflows to a client, colleague, supervisor or assessment panel. It provides a short spoken introduction, a complete presentation sequence and a practical demonstration using fictional records.

The project is an implemented local financial management application with automated tests and selected browser checks. Some browser acceptance, operational configuration and production preparation remain outstanding. Present the implemented features confidently, but describe those limits accurately.

## 1 Explain the project in one minute

You can say:

> FinBiz 360 is a financial management workspace for a retail or trading business. It brings cash, bank and mobile-money records into one system. Staff can record receipts and expenses, manage customer invoices and supplier bills, import statements, reconcile transactions and review reports.
>
> Each person has a role. A cashier records incoming receipts, finance prepares financial work, a manager independently reviews important decisions, an auditor reviews evidence, and an administrator manages access and maintenance. The server enforces these responsibilities.
>
> The main benefit is that a business can trace a financial record from its creation to its payment, approval, supporting evidence and reconciliation. The system records financial activity; it does not send money to a bank or mobile-money provider.

For a nontechnical audience, start with the business problem and this explanation. Save the programming languages and database details for the technical section near the end.

## 2 Explain the business problem

A business may receive cash at its counter, collect mobile-money payments and pay suppliers through a bank. If these records are scattered across notebooks, spreadsheets and statement files, staff must manually work out what was received, what is still owed, which expenses were approved and which records match external evidence.

FinBiz 360 addresses that problem by keeping these records and their review history in one workspace. The intended results are more organised recordkeeping, clearer responsibility, fewer duplicate entries and better visibility of recorded cash movement. These are design objectives; do not claim measured financial savings or error reductions unless the business has collected evidence.

### Questions the application helps answer

- How much accepted money came in and went out during a selected period?
- Which customer invoices and supplier bills still have outstanding balances?
- Which expenses are awaiting an independent decision?
- Which internal transactions match the imported statement evidence?
- Who created, reviewed, corrected or reconciled a record?
- Are cash counts, category budgets or overdue documents calling for attention?

## 3 Define the important terms

### Everyday financial terms

| Term                     | Meaning in this project                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| SLE                      | The currency used by the application, shown with two decimal places.                                                                       |
| Financial account        | A recorded place where money is held, such as cash, a bank account or a mobile-money wallet. It is different from a staff sign-in account. |
| Payment channel          | The type of account used: cash, bank or mobile money.                                                                                      |
| Transaction              | An internal record of an incoming or outgoing amount. Recording it does not initiate a provider transfer.                                  |
| Accepted transaction     | A transaction approved where required, or marked as not requiring approval, that contributes under the relevant reporting rules.           |
| Reference                | A human-readable identifier such as a receipt number or provider reference.                                                                |
| Internal ID              | The application's unique stored identifier for a record. It is different from the human-readable reference.                                |
| Inflow                   | Money recorded as coming into a financial account.                                                                                         |
| Outflow                  | Money recorded as leaving a financial account.                                                                                             |
| Receipt                  | The record or acknowledgement of incoming money.                                                                                           |
| Receipted sale           | An incoming receipt classified as a sale. Sales are included in receipt totals and are not added a second time.                            |
| Expense                  | An outgoing financial record, normally submitted for independent approval.                                                                 |
| Customer                 | A person or organisation from whom the business receives money or to whom it issues invoices.                                              |
| Supplier                 | A person or organisation that provides goods or services to the business.                                                                  |
| Invoice                  | A document stating what a customer owes. Creating an invoice does not record cash received.                                                |
| Supplier bill            | A document stating what the business owes a supplier. Creating a bill does not record payment.                                             |
| Receivable               | An amount still owed by a customer.                                                                                                        |
| Payable                  | An amount still owed to a supplier.                                                                                                        |
| Allocation               | A link assigning part or all of an existing receipt or accepted payment to an invoice or bill. It does not create another transaction.     |
| Partial payment          | A payment that settles only part of a document's outstanding amount.                                                                       |
| Outstanding balance      | The amount that remains unsettled on a document.                                                                                           |
| Opening balance          | A financial account's recorded starting amount on its opening date.                                                                        |
| Net cash movement        | Accepted inflows minus accepted outflows for the selected scope and period.                                                                |
| Recorded closing balance | Opening balance plus accepted movements through the selected end date. It is a book balance, not automatically verified provider data.     |
| Category                 | A classification such as Sales or Supplies used to organise transactions and budgets.                                                      |

### Review and control terms

| Term                  | Meaning in this project                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Draft                 | A document or prepared occurrence that still needs review before it is issued or submitted.                                |
| Issued                | A document released into the operational workflow.                                                                         |
| Pending               | A request or expense waiting for an authorised decision.                                                                   |
| Approved              | Accepted by a permitted reviewer under the applicable rules.                                                               |
| Rejected              | Declined with a recorded reason. Rejection does not delete the history.                                                    |
| Independent approval  | A permitted person other than the creator makes the decision.                                                              |
| Approval limit        | The maximum monetary authority configured for a reviewer.                                                                  |
| Statement             | External account evidence, imported from a CSV or XLSX file.                                                               |
| Column mapping        | Telling the importer which file columns contain date, amount, direction and other fields.                                  |
| Reconciliation        | Linking internal transactions to supporting statement lines after checking that they agree.                                |
| Exact match           | A suggestion based on matching reference, amount, date, direction and account.                                             |
| Grouped match         | A reviewed relationship between multiple records whose relevant totals balance.                                            |
| Partial match         | Linking only part of a record's amount while retaining the remaining amount for later work.                                |
| Exception             | A record needing investigation, such as an unmatched item, duplicate reference or ambiguous candidate.                     |
| Evidence              | Supporting information or a retained attachment used to explain or verify a record.                                        |
| Reversal              | A new linked entry in the opposite direction that corrects an accepted transaction without deleting the original.          |
| Allocation correction | A retained correction of a document-payment link. It does not by itself reverse the underlying money transaction.          |
| Write-off             | An authorised non-cash reduction of a document balance. It is not a receipt or payment.                                    |
| Audit trail           | Recorded history of significant actions, their actor, time and relevant details.                                           |
| Closed period         | A protected reporting month in which affected financial postings are blocked until authorised reopening.                   |
| Budget                | A monthly spending plan for a category.                                                                                    |
| Actual spending       | Accepted outgoing records, reduced by relevant recorded expense reversals. Pending expenses are excluded.                  |
| Variance              | A difference between two values, such as expected cash and counted cash or budget and actual spending.                     |
| Cash shift            | A cashier's cash-count session for a particular cash account, with opening cash, linked receipts and a submitted handover. |

### Technical and security terms

| Term            | Meaning in this project                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Frontend        | The screens and interactions presented in the browser.                                                                          |
| Backend         | The server that validates requests, enforces permissions and performs data operations.                                          |
| API             | The structured interface through which the browser asks the server to read or change records.                                   |
| Database        | Persistent storage for users, financial records, relationships and history.                                                     |
| RBAC            | Role-based access control: a user's role helps determine permitted actions and record scope.                                    |
| Session         | The server-recognised signed-in state of a user.                                                                                |
| CSRF protection | A request-token check that helps prevent another site from submitting unauthorised actions through a signed-in browser.         |
| Password hash   | A one-way representation used to verify a password without storing its readable text.                                           |
| MFA             | Multi-factor authentication: a password plus an authenticator or recovery code for an enrolled user.                            |
| TOTP            | A short-lived authenticator code derived from a shared secret and the current time.                                             |
| Recovery code   | A one-use backup sign-in factor saved during MFA enrolment.                                                                     |
| Backup          | A consistent snapshot that can be used for recovery.                                                                            |
| Encryption      | Protecting readable data with a key. Encrypted backup files require the correct key to restore.                                 |
| Integrity check | A check that the database structure and relationships remain valid. It is not a guarantee that every business entry is correct. |
| Idempotency     | Safe retry behaviour that prevents a repeated request from creating a second copy of the same operation.                        |
| Minor units     | Whole-number currency storage: SLE 12.35 is stored as 1235 minor units.                                                         |
| UAT             | User acceptance testing: checking real user workflows and expected outcomes before accepting a release.                         |

## 4 Explain the five user roles

The application follows the relationship User → Role → Permissions → Module → Action → Scope. For example, a cashier may create an incoming transaction but can review only their own transaction history. Merely hiding a button is insufficient; the server also checks the action.

| Role                     | Main responsibility                                                                                                           | Important boundary                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Owner or Manager         | Oversees recorded performance, independently reviews payments and controls, sets budgets and reviews handovers and purchases. | Cannot approve their own request; monetary authority and other rules still apply.                                          |
| Finance Officer          | Records financial work, manages documents and evidence, imports statements and investigates reconciliation.                   | Approval of business payments needs explicit authority; finance does not automatically gain manager control powers.        |
| Cashier or Sales Officer | Records incoming receipts and receipted sales, reviews own records, handles assigned invoices and cash shifts.                | Cannot create outgoing expenses or approve financial decisions. Customer creation and invoice allocation depend on policy. |
| Auditor                  | Reviews financial evidence, reports, history and decisions.                                                                   | Financial work is read-only. Exporting depends on the organisation's auditor-export policy.                                |
| System Administrator     | Manages staff, restrictive role profiles, sessions, organisation configuration and backups.                                   | Administration is separate from financial approval authority.                                                              |

Every role can manage its own profile and password and, when configured, its own MFA. Personal reminder snoozing affects that user's queue. A custom permission profile can narrow a base role; it is not a route to bypass the base role's limits.

### Presentation sign-in identities

The requested persistent test identities are `manager@gmail.com`, `finance@gmail.com`, `cashier@gmail.com`, `auditor@gmail.com` and `admin@gmail.com`. They are application login identifiers; the application does not create Gmail mailboxes or establish ownership of those addresses. Passwords are intentionally excluded from this shareable guide.

Those accounts belong to the main workspace. Use a separate demonstration database for fictional financial postings. Its seeded identities are `manager@finbiz.demo`, `finance@finbiz.demo`, `cashier@finbiz.demo`, `auditor@finbiz.demo` and `admin@finbiz.demo`; use the password generated when that demonstration database is seeded. Do not assume that two different databases share users or records.

## 5 Explain the features by business purpose

### Record daily activity

**Dashboard.** Each role receives a workspace suited to its responsibilities. Financial dashboards show accepted movement, accounts and saved-record activity. The cashier sees personal receipts and channel breakdowns; the administrator sees system and access information. Dashboard figures reflect current filters. A zero or empty state is a valid result when no records exist in the selected scope.

**Transactions and receipts.** Staff record a date, direction, amount, financial account, category, reference and description. A customer or supplier can be associated where appropriate. Cash entries require a reference. The register supports filtering, search and pagination. Receipts and accepted transactions use the application's exact monetary model.

**Receipted sales and receipt printing.** The cashier can distinguish a sale from another incoming receipt and inspect receipt details. Print and reprint use the browser's printing workflow and retain a print action record. An actual printer or print-preview result should be checked before a public demonstration that promises a printed document.

**Accounts and reference records.** Accounts identify cash, bank and mobile-money holdings. Customer and supplier directories retain contact information. Categories classify activity. Opening balance and date affect the recorded balance; deactivation is used to retire reference records while keeping related history.

### Manage money owed

**Customer invoices.** Finance or management can create documents, including itemised invoices, keep them as drafts and issue them after review. Existing receipts can be allocated partially or fully. Paid and outstanding amounts are derived from the document's valid payment and control history.

**Supplier bills.** Staff record supplier obligations and allocate accepted outgoing payments. A customer receipt cannot be used as a supplier payment. The supplier, available payment amount and bill's outstanding amount must agree with the allocation rules.

**Payment history and corrections.** The history shows what was allocated and any retained corrections. Incorrect allocations are corrected through an explicit reasoned workflow. Where another valid allocation is needed, use the supported correction and reallocation process; do not delete original evidence or post another receipt merely to change a link.

**Collections and payables.** Outstanding documents are grouped by due date and age. Finance or management assigns a responsible finance officer or manager, records a promised follow-up date and appends contact notes. A note does not settle the invoice or bill. The age groups include Current, 1–30 days, 31–60 days, 61–90 days and Over 90 days.

### Review decisions and protect records

**Expense approval.** An outgoing record is prepared and independently reviewed. Pending and rejected expenses do not enter accepted cash movement. An authorised reviewer provides a decision reason. A payment approval is a recorded business control; it does not send money externally.

**Financial controls.** Reasoned workflows cover reversals, adjustments, write-offs and reporting-period decisions. A reversal preserves the original transaction. A write-off changes a document balance without pretending cash was received. Closed periods prevent affected postings into a protected month.

**Approval history and evidence.** Reviewers can trace completed decisions and supporting evidence. Private evidence access follows permissions. History identifies the person who created the item separately from the person who reviewed it.

**Cash shifts.** A cashier opens a shift with counted opening cash. Only that cashier's qualifying receipts for that cash account are linked. Expected cash is opening cash plus linked accepted receipts and relevant reversals before submission. Bank, mobile-money and another staff member's records do not belong to that shift. Submitted figures are frozen. Manager approval or rejection does not automatically post an adjustment for a shortage.

**Audit trail.** Important financial, access and administrative actions leave history. Application and database controls protect posted financial fields and audit events from ordinary silent changes. This protection does not make the system immune to someone with unrestricted access to the underlying machine and files.

### Compare records with evidence

**Statement import.** CSV and XLSX statement data can be mapped, previewed and validated before committing. Invalid rows and explicit exclusion reasons remain visible. The original uploaded file is retained, and duplicate-file handling helps prevent repeated imports. An import adds external evidence; it does not create the same business receipt or expense again.

**Reconciliation.** The application suggests exact candidates using reference, amount, date, direction and account. A permitted user checks the evidence and confirms a match. Additional workflows support grouped and partial evidence relationships with review, limits, remaining amounts and history. Undo retains an explanation and history rather than silently removing the decision.

**Exceptions.** Unmatched, ambiguous or duplicate evidence is investigated. A bank fee that appears only in the statement is a reason to investigate and, if valid, create an approved adjustment; it is not permission to force an incorrect match.

### Plan and follow up

**Budgets.** A manager sets a monthly category budget. Actual spending includes accepted outgoing records and relevant reversals, excluding pending items. Budgets are company-wide by month and category, not restricted by the account filter. Overspending generates an alert; it is not a hard block on recording a transaction.

**Purchases.** A request records supplier, purpose, reference and amount. A different manager approves or rejects it. An approved request can produce one purchase order, and that order can link one issued bill from the same supplier within the approved amount. Ordering, bill recognition and payment approval are separate steps. This release does not provide inventory receiving or stock control.

**Recurring drafts.** Finance or management creates invoice or expense schedules. While the normal server is running, due occurrences are prepared as drafts. Reviewed invoice occurrences create draft invoices; reviewed expense occurrences create pending expenses. No financial posting or external payment happens automatically. Duplicate preparation or submission is controlled. Paused schedules do not run.

**Reminders and notifications.** Reminders point to permitted outstanding work, such as overdue documents, budget excess, submitted shifts or operational problems. Snoozing postpones one user's reminder without fixing the underlying item. Notifications show role-relevant activity. Neither feature is a configured email, SMS or push service.

### Understand results and maintain the system

**Reports.** Filtered views organise recorded cash movement, account activity, obligations and related financial information. Available reports can be exported in supported formats such as CSV, XLSX and PDF, subject to permission and report type. Check filters and the selected report before explaining a number.

**Analytics.** The system provides recorded trends and breakdowns, explained anomaly indicators and a conditional short forecast when sufficient acceptable history is available. An anomaly is an investigation clue, not a fraud finding. The forecast is a limited baseline derived from recorded history, not a guaranteed prediction or a substitute for judgement.

**Staff and access management.** Administrators create users, change roles or active status, manage restrictive permission profiles and inspect or revoke sessions. Password resets and account changes leave history. Deactivated users cannot sign in; retained historical records can still identify their earlier actions.

**Profile and security.** Users can maintain their own name, profile photo and password. Password changes invalidate sessions. Optional MFA uses an authenticator and one-use recovery codes. A server security key must be configured before enrolment. Do not enable MFA during a public presentation unless the test user has a safe way to retain recovery codes.

**Backups and recovery.** Consistent manual SQLite snapshots are available. Encrypted scheduled backups can be configured in System maintenance after the server security key is set. Encrypted runs are checked before being labelled verified and have retention history. Restoration uses a new destination and invalidates restored sessions. Local scheduling is not an off-site recovery service.

## 6 Explain how the application is built

Use this explanation for a technical audience:

> The browser interface uses React and TypeScript, built with Vite. It calls a Node.js and Express API. The API checks the session, request token, permissions and business rules before reading or writing SQLite. This keeps critical financial and access decisions on the server.

The main relationship is:

```text
User in a browser
        |
React and TypeScript screens
        |
Express API with session and permission checks
        |
Financial validation and atomic operations
        |
SQLite records and audit history
        |
Consistent backups and controlled restoration
```

An atomic operation succeeds as a unit or rolls back. This helps prevent half-saved financial relationships. Amounts are stored in whole minor units and financial totals use exact arithmetic; chart drawing can use approximations for geometry without changing the recorded financial amount.

The current design supports one organisation, SLE, the Africa/Freetown business timezone and a single local API instance. SQLite is embedded storage; there is no separate PostgreSQL server in this implementation. A complete balanced double-entry ledger is not part of the current release.

## 7 Prepare before the demonstration

### Choose a presentation length

| Length           | Suggested coverage                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| 10 minutes       | Introduction, role boundary, invoice and receipt distinction, one approval, dashboard and audit trail. |
| 30 to 45 minutes | Complete main demonstration in Section 9, with prepared references and statement file.                 |
| 60 to 75 minutes | Main demonstration plus selected advanced workflows, questions and technical discussion.               |

Rehearse the role changes and prepare reference records in advance if the audience has limited time. Keep the presentation focused on a business story rather than opening every menu without context.

### Prepare the environment

1. Use a separate demonstration database with fictional records. The normal company file is `data/workspace.db`; do not seed it or fill it with presentation entries.
2. Ask the operator to prepare and start the demo before the audience arrives. The browser must point to the server running that demo. Port 3191 was used by a temporary testing preview and is not a guaranteed permanent address.
3. For the standard development setup, the frontend address is `http://127.0.0.1:5173/login` and the API is on port 3001. The selected database depends on how that server was started. Port number alone does not prove that the database is safe for demonstrations.
4. Verify the visible demo label, your role, the organisation name, date and account filters. Confirm the database with the operator if uncertain.
5. Keep test passwords privately available. Do not include passwords, MFA secrets or recovery codes in projected slides or handouts.
6. Use the same open business date for the internal records and sample statement rows. Choose a reporting month that is not closed.
7. Prepare a statement file, a fictional evidence attachment and the role accounts. Close unrelated windows and enlarge the browser text if the audience needs it.
8. Confirm optional policies, approval limits, export permission and MFA/backup configuration before choosing the advanced demonstrations.

### Optional operator commands for a separate demo

These are setup instructions, not commands to run while the presenter is speaking. From the project folder, with existing development servers stopped and a new filename selected:

```powershell
$env:DB_PATH = './data/presentation-demo-20261108.db'
npm run seed
npm run dev:demo
```

The seed command prints the generated demo password and refuses to seed an existing database containing users. If the filename already exists, choose a new one. Keep `DB_PATH` set to that same demo file for both commands. After the presentation, stop that server, remove the `DB_PATH` environment override in that terminal and restart the normal company app only when intended. Never change the server's database while it is running.

The separate lightweight preview used for browser testing may not run scheduled workers. Demonstrate automatic scheduling only on the normal server entry point with its workers running.

## 8 Prepare one consistent demonstration story

Use a fictional business scenario: a customer buys SLE 1,000.00 of goods, pays in two instalments, and the business separately buys SLE 250.00 of supplies through its bank account.

Create these uniquely named records in the demonstration database. If similar records already exist, use a fresh suffix rather than reusing unrelated financial history.

| Record                   | Demonstration value                                            |
| ------------------------ | -------------------------------------------------------------- |
| Customer                 | Presentation Customer                                          |
| Supplier                 | Presentation Supplies                                          |
| Cash account             | Presentation Cash, opening balance SLE 50.00 on the demo date  |
| Bank account             | Presentation Bank, opening balance SLE 500.00 on the demo date |
| Income category          | Presentation Sales                                             |
| Expense category         | Presentation Supplies Expense                                  |
| Customer invoice         | PRESENT-INV-001, SLE 1,000.00                                  |
| First cash receipt       | PRESENT-RCT-001, SLE 400.00                                    |
| Second cash receipt      | PRESENT-RCT-002, SLE 600.00                                    |
| Monthly expense budget   | SLE 200.00 for Presentation Supplies Expense                   |
| Supplier bill            | PRESENT-BILL-001, SLE 250.00                                   |
| Bank expense             | PRESENT-EXP-001, SLE 250.00                                    |
| Cash shift opening count | SLE 50.00 for the cashier and Presentation Cash                |

Use an actual issue date and a later due date. The example avoids discounts, taxes and write-offs so the audience can follow the basic arithmetic. If using an itemised invoice, ten units at SLE 100.00 give SLE 1,000.00 before any extra line adjustments.

### Expected numbers for this story

| Point in the story                            | Expected result                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| Invoice issued before receipts                | Invoice outstanding SLE 1,000.00; no cash receipt created by issuing it.     |
| First receipt allocated                       | Invoice paid SLE 400.00; outstanding SLE 600.00.                             |
| Second receipt allocated                      | Invoice paid SLE 1,000.00; outstanding SLE 0.00.                             |
| Before expense approval                       | Pending expense excluded from accepted movement and budget actuals.          |
| After expense approval                        | Accepted outflow SLE 250.00; category budget exceeded by SLE 50.00.          |
| Total accepted movement for these new records | SLE 1,000.00 inflow minus SLE 250.00 outflow equals SLE 750.00 net movement. |
| Cash account closing record                   | Opening SLE 50.00 plus receipts SLE 1,000.00 equals SLE 1,050.00.            |
| Bank account closing record                   | Opening SLE 500.00 minus expense SLE 250.00 equals SLE 250.00.               |
| Cashier shift expected count                  | SLE 50.00 opening plus the two linked cash receipts equals SLE 1,050.00.     |

The two financial account closing values total SLE 1,300.00 because they include SLE 550.00 of opening balances. Net movement is SLE 750.00 because it excludes those opening balances. Opening a cash shift records a count; it does not create another SLE 50.00 transaction.

Seeded demonstrations contain other records. Use the presentation accounts and date filters, a unique category and document references to isolate the example. When reviewing an unfiltered company-wide figure, explain the change caused by the example rather than claiming the total must equal this story alone.

## 9 Demonstrate the main workflow step by step

### Step 1 Introduce the home page

**Do:** Open the home page, briefly identify the purpose and enter Sign in.

**Say:** “This is one workspace for recorded financial activity, supporting evidence and controlled review.”

**Show:** The sign-in page and the optional authenticator-code entry. Do not expose private credentials while presenting.

### Step 2 Show the administrator boundary and reference setup

**Do:** Sign in as the demonstration administrator. Show Users, Roles and permissions, Active sessions and System maintenance. Confirm that the manager and finance users exist. Prepare categories and relevant policies. Financial accounts and contacts can be prepared by permitted finance or management users.

**Say:** “The administrator manages access and system operation. Financial approval is a separate responsibility.”

**Expected:** Administrative destinations are available; a business payment approval is not granted merely by being an administrator. If using cashier allocation, enable its policy in the demo deliberately; otherwise let finance perform the allocation later.

### Step 3 Explain the finance dashboard

**Do:** Sign out and sign in as finance. Open the dashboard. Identify inflows, outflows, net movement, pending work and the account/date filters. Prepare the named customer, supplier and two financial accounts from Section 8.

**Say:** “These figures come from saved records in the selected scope. Pending expenses are not counted as accepted spending.”

**Expected:** The financial workspace differs from the administrative workspace. Account and date changes alter the relevant view rather than pulling a live bank feed.

### Step 4 Create and issue the customer invoice

**Do:** Open Invoices. Create PRESENT-INV-001 for Presentation Customer at SLE 1,000.00. Where using the itemised form, choose Draft, save the document and inspect its details. Use Issue invoice with a reason when ready. If the chosen basic form creates an issued document directly, explain the resulting lifecycle instead of claiming a separate draft step occurred.

**Say:** “An invoice records what the customer owes. It is not proof that money has been received.”

**Expected:** The issued invoice has SLE 1,000.00 outstanding and no allocated receipt. Record its reference for the next steps.

### Step 5 Open a cashier shift and record the first receipt

**Do:** Sign in as cashier. Open Cash shifts for Presentation Cash with SLE 50.00 opening cash. Return to the cashier workspace and record an incoming cash receipt of SLE 400.00, reference PRESENT-RCT-001, for Presentation Customer and Presentation Sales.

**Say:** “The cashier records money received and sees their own records. The receipt is linked to the open shift for this cashier and cash account.”

**Expected:** The cashier's cash-receipt total increases by SLE 400.00. The shift's expected cash becomes SLE 450.00. Use Record sale only if you want the incoming item classified as a receipted sale; do not record both a sale and a receipt for the same money.

### Step 6 Allocate the first receipt

**Do:** If cashier allocation is enabled and the invoice is assigned correctly, use Assigned invoices and the permitted allocation workflow. Otherwise sign in as finance, open the invoice and allocate the existing receipt. Use its internal record ID if the form requests one; do not substitute the printed reference for an internal ID field.

**Say:** “Allocation connects an existing receipt to the invoice. It does not receive the money again.”

**Expected:** Paid SLE 400.00, outstanding SLE 600.00 and a partial payment status. Open Payment history to show the link.

### Step 7 Complete the customer payment

**Do:** As cashier, record PRESENT-RCT-002 for SLE 600.00 in Presentation Cash for the same customer. Allocate that existing receipt through the permitted role workflow.

**Say:** “A second receipt settles the remaining balance. The application prevents allocations beyond what the receipt or invoice can support.”

**Expected:** Invoice paid SLE 1,000.00, outstanding zero. The shift expected cash is SLE 1,050.00. If demonstrating an over-allocation error, attempt only a synthetic invalid allocation and show that validation leaves the accepted balances unchanged.

### Step 8 Set the category budget

**Do:** Sign in as manager. Open Budgets, select the demo month and set SLE 200.00 for Presentation Supplies Expense with a reason.

**Say:** “The category budget is a company-wide plan for this month. It will compare accepted expenses with the limit.”

**Expected:** A new unused demonstration category starts with zero actual spending and SLE 200.00 remaining. If it has prior activity, stop and use a new category so the example remains clear.

### Step 9 Record the supplier bill and pending expense

**Do:** As finance, create PRESENT-BILL-001 for Presentation Supplies at SLE 250.00. Record PRESENT-EXP-001 as an outgoing payment of SLE 250.00 from Presentation Bank, using Presentation Supplies Expense and the same supplier. Retain its internal ID. Attach fictional evidence if you want to demonstrate evidence review.

**Say:** “The bill records an obligation. The expense records a payment entered by finance, and it still needs an independent decision.”

**Expected:** The expense is Pending. It does not yet increase accepted outflows or budget actuals. The bill remains outstanding until an eligible accepted payment is allocated to it.

### Step 10 Review and approve the expense independently

**Do:** Sign out of finance and sign in as manager. Open Approvals, inspect the amount, account, reference and evidence, then approve with a reason. Confirm the reviewer has enough monetary authority.

**Say:** “Preparation and approval belong to different users. The reviewer records why the expense was accepted.”

**Expected:** The approved SLE 250.00 enters accepted spending. Budgets shows SLE 250.00 actual, minus SLE 50.00 remaining and Over budget. Reminders shows the excess where permitted. A creator cannot approve their own entry.

### Step 11 Allocate the supplier payment

**Do:** Return to finance, open Supplier bills and allocate the approved outgoing payment to PRESENT-BILL-001. Enter its internal ID and SLE 250.00 if those fields are requested. Open Payment history.

**Say:** “This links the accepted supplier payment to the bill. It does not create another expense.”

**Expected:** The bill's outstanding amount becomes zero. A customer receipt or unrelated supplier payment should not qualify.

### Step 12 Import external statement evidence

**Do:** Open Statements and select Presentation Bank. Upload the supplied sample CSV, adjusting its dates first if the demonstration date differs. Map Date, Amount, Direction, Reference, Description and Currency to their matching columns. Preview, inspect rows and commit only the intended valid evidence.

**Say:** “Importing a statement adds evidence for checking our internal records. We preview and validate it before committing.”

**Expected:** The SLE 250.00 row has the same date, reference, direction and account as PRESENT-EXP-001. The additional SLE 15.00 fee row remains evidence needing investigation. Do not create another SLE 250.00 expense from the import.

### Step 13 Reconcile and investigate an exception

**Do:** Open Reconciliation. Inspect the exact candidate for PRESENT-EXP-001. Compare the internal entry with the statement line and confirm with a reason. Then open Exceptions to inspect the unmatched fee.

**Say:** “Reconciliation confirms that an internal record agrees with its evidence. An unmatched fee needs investigation; it should not be forced onto a different transaction.”

**Expected:** The SLE 250.00 relationship is reconciled and traceable. The fee remains an exception until an authorised, justified workflow handles it. Duplicate confirmation should not create another active match.

### Step 14 Submit the cash handover

**Do:** As cashier, open the shift. Confirm that it contains the two cash receipts and expected cash SLE 1,050.00. Submit the physical count and an explanation. For a shortage example, use SLE 1,049.00, then let the separate manager review with a reason.

**Say:** “A handover compares expected cash with what was counted. The submitted figures are preserved, and review does not automatically change the account balance.”

**Expected:** Difference minus SLE 1.00 in the shortage example. Bank supplier spending is outside the cashier's cash-receipt shift. Approval or rejection retains the original submitted count.

### Step 15 Close the main demonstration with reports and history

**Do:** Open Reports as finance or manager and filter the presentation records. Explain SLE 1,000.00 inflow, SLE 250.00 accepted outflow and SLE 750.00 net movement. Show account opening and closing amounts separately. Open the audit trail to trace the records. Finally sign in as auditor and show review-only access.

**Say:** “We can trace the invoice to receipts, the bill to an approved payment, the payment to external evidence, and each important decision to a responsible user.”

**Expected:** The invoice and bill are settled, the bank payment is reconciled, the unmatched fee remains visible and the auditor cannot change financial data. An export is available only when the user's permission and relevant policy allow it.

## 10 Demonstrate additional workflows when time allows

### Follow up an outstanding document

1. Use a separate fictional invoice that still has an outstanding balance; the fully paid invoice from the main demonstration will not belong in this queue.
2. Open Collections and payables, filter customer or supplier documents and the age group.
3. Record a follow-up, choose a responsible finance officer or manager, set a promised date and write the contact outcome.
4. Expand history and confirm the note is retained. Compare outstanding before and after; it must not change from the note alone.
5. Explain the difference between an assigned task and a recorded payment.

### Request a purchase and create its order

1. Finance creates a new request for Presentation Supplies with a unique reference, purpose and SLE 250.00 amount.
2. A different manager approves with a reason and sufficient authority.
3. Finance creates a unique purchase order from that approved request.
4. Link one issued bill from the same supplier within the approved amount. Use an unlinked fictional bill where necessary.
5. Show that purchase approval and bill linking do not approve or create a bank payment. This release allows one order per request and one bill per order.

### Prepare a recurring draft

1. Open Recurring drafts as finance or manager. Choose an invoice or expense schedule.
2. Select the contact, amount, description, first occurrence and interval. Expense schedules also require an appropriate expense category.
3. Demonstrate a prepared occurrence using the page's preparation action where available, or the normal running scheduler after it becomes due.
4. Review the occurrence and submit it with a unique reference and the other required fields.
5. Show the result: a draft invoice still needs issue; an expense still needs independent approval. Repeat submission must not produce another posting.
6. Explain that the server must remain running. A paused schedule will not generate new occurrences.

### Snooze a reminder

1. Open Reminders and select an existing permitted item.
2. Open the associated page to show the source of the work, then return.
3. Choose Snooze and select a future date.
4. Save and confirm the item leaves this user's current queue.
5. Explain that the source record remains unresolved and another user's queue is not automatically cleared.

### Correct an error while preserving history

1. Choose a separate accepted synthetic expense. Note its amount, category and current budget actual.
2. Use the permitted financial-control workflow to request a reversal with the original internal ID, an open date and a reason.
3. Have a different authorised manager review the request.
4. Inspect the original and linked opposite entry. For a reversal in the same month and category, budget actual should reduce by the reversed expense amount.
5. Explain separately that correcting an allocation changes a link, while reversing a transaction corrects the recorded movement.

### Show security and backup readiness

1. As a user, open Security. Explain password plus authenticator and the need for securely retained one-use recovery codes.
2. If the server key is not configured, show the unavailable setup state honestly. Do not claim MFA is enabled merely because its page exists.
3. As administrator, open System maintenance and show backup status, schedule and retained run history.
4. Where configured and rehearsed, create a test encrypted snapshot and inspect its verified result. Avoid displaying the encryption key.
5. Explain restoration to a new database file and invalidation of restored sessions. Do not switch or restore the live company database during a presentation.

## 11 Use the supplied statement files

`PRESENTATION_BANK_STATEMENT.csv` contains a valid SLE 250.00 supplier payment and an unmatched SLE 15.00 fee. It uses 8 November 2026. If the demonstration uses another date, update both internal records and CSV dates to the same actual demo date before importing.

`PRESENTATION_INVALID_STATEMENT.csv` contains deliberately invalid date, amount and direction values. Use it only to demonstrate preview validation in the separate demo. Do not commit invalid rows. Keep it separate from the main successful import so the audience can see one clear success before seeing an error case.

The sample columns are Date, Amount, Direction, Reference, Description and Currency. Amounts are positive decimal values; Direction is `in` or `out`. The selected import account supplies the account identity. These samples demonstrate the supported importer format; they are not a claim that every provider exports those exact column names.

## 12 Explain security and financial correctness plainly

Use five points rather than listing technical acronyms without context:

1. **Identity:** users sign in and the server recognises their session. Passwords are hashed, not stored as readable text.
2. **Authority:** the server checks the user's permitted action and record scope. A manager, cashier and administrator have different responsibilities.
3. **Accuracy:** currency uses whole minor units and exact totals. For example, SLE 12.35 is stored as 1235, not a binary floating-point approximation.
4. **Traceability:** important changes and decisions retain reasons and history. Posted records are corrected through controlled linked entries rather than silent edits.
5. **Recovery:** consistent backups and restoration checks support recovery. Encrypted scheduling, off-site copies, key custody and a real recovery rehearsal require operational preparation.

Do not describe the product as completely secure or production certified. HTTPS, hosting configuration, operating-system access, backup handling and actual business acceptance are part of the deployment environment.

## 13 Answer common questions

### Does it transfer money

No. It records financial activity and compares records with imported evidence. A permitted staff member still carries out real payments through the authorised provider process outside this application.

### Is the dashboard figure profit

The main movement figure is accepted inflows minus accepted outflows. It should not be presented as full accounting profit. The project does not include a complete accrual and double-entry accounting ledger, inventory valuation, payroll or tax computation.

### Why do we need an invoice and a receipt

They describe different events. The invoice says what is owed; the receipt says money was received. Allocation connects them, including when one invoice is paid in instalments.

### Why does an expense not affect totals immediately

Pending approval is a separate state. Accepted movement and budget actuals include accepted records under the system's rules. This keeps preparation separate from review.

### Why is the administrator not allowed to approve everything

Managing access and approving business money are different responsibilities. Separating them reduces reliance on one unrestricted role and allows clearer review.

### Can an incorrect record be deleted

Posted financial records retain history. Use the applicable reversal, correction, cancellation or authorised control workflow. A cancelled draft, allocation correction and financial reversal have different meanings and rules.

### Are anomalies proof of fraud

No. They identify conditions worth investigating, such as unusual amounts or repeated references. A person must examine the evidence and context.

### Does it synchronise automatically with banks

No provider feed is currently configured. Saved application views refresh, but external evidence is supplied through authorised statement imports. A 15-second application refresh is not a live banking integration.

### Can many organisations share the same installation

The current database represents one organisation. A hosted multi-organisation service with tenant isolation is future work and should not be claimed as part of this release.

### Are reminders sent by email

The implemented reminders and notifications are inside the application. Email, SMS and push delivery are not configured services in this release.

### What happens if the encryption key is lost

Encrypted backups and stored MFA secrets depend on the configured key. Losing it can prevent recovery. Key custody must be planned separately from storing the backup files; an administrator does not have an MFA bypass.

## 14 Describe the current delivery status honestly

The latest recorded complete automated run passed 84 tests on 7 November 2026, and the production build passed. A later design consistency pass on 8 November passed five focused UI checks and a new production build. These are specific recorded results, not a promise that every future run or deployed environment will pass.

Selected browser checks confirmed cash-shift opening and handover, cash-only receipt inclusion, independent approval and rejection, budget displays, pending-expense exclusion and the overspend reminder. A later browser continuation also observed the budget returning within limit after reversal, removal of the overspend reminder and saving a future snooze. The design pass visually checked the Collections and payables table, date formatting, action readability and panel scrolling.

A follow-up form was inspected and filled during browser work, but its save was not observed before interruption; do not present that as a completed browser acceptance test. Further browser acceptance remains for complete advanced workflows, other role interactions, statement and reconciliation variants, mobile/tablet layouts, exports, printing, MFA enrolment and an operational restore drill.

Implemented does not mean configured, and configured does not mean accepted by the business. For example, the backup and MFA code exists, but those features require the server key and a rehearsed operating procedure. The presence of a feature page alone is not proof that the corresponding service is active.

## 15 Handle demonstration problems calmly

| What happens                            | What to check or explain                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in fails                           | Confirm the correct server/database, identity and current password. MFA-enrolled accounts also need a valid factor. Avoid repeated guesses. |
| A page or button is missing             | Check the signed-in role, restrictive permission profile and relevant organisation policy.                                                  |
| An approval is refused                  | Check creator/reviewer independence, current request state and approval limit.                                                              |
| A document balance is unexpected        | Check existing allocations, corrections, write-offs and whether the right document/customer was selected.                                   |
| An internal ID is rejected              | Retrieve the record's internal identifier; a human reference is not always accepted in an ID field.                                         |
| A statement produces no exact candidate | Compare account, amount, date, direction and reference. Show the exception instead of forcing a match.                                      |
| Totals include other records            | Apply the account/date filters and use a unique demonstration category. Explain the difference from a company-wide total.                   |
| A date is blocked                       | Check period protection and the account opening date. Do not weaken company controls merely to continue a presentation.                     |
| A forecast is unavailable               | Explain that its history and quality requirements are not met. Unavailable is preferable to an invented prediction.                         |
| Backup or MFA setup is unavailable      | Check the server-key configuration with the operator. Do not expose secrets on screen.                                                      |
| A table is wider than the panel         | Use its horizontal scrollbar. Financial details should remain readable rather than being squeezed into narrow columns.                      |
| The browser preview stops               | Confirm that its server is running. A temporary test preview is not permanent hosting.                                                      |

If a workflow fails during the presentation, state what you expected, show the visible validation message and move to a rehearsed example. Do not claim an unsuccessful step passed, delete history to hide the problem or enter fictional activity into company records.

## 16 End the presentation clearly

You can say:

> We have followed one business story from an invoice to partial receipts, a supplier bill to an independently approved expense, and an internal payment to imported statement evidence. We also saw how budgets, cash counts and audit history help staff follow up differences and explain decisions.
>
> FinBiz 360 is therefore a controlled financial recordkeeping workspace with distinct staff responsibilities. The next stage is to complete the remaining acceptance checks, configure deployment and recovery controls, and validate the workflows with the organisation's actual authorised users.

### Presenter checklist

- Rehearse the opening explanation without reading technical implementation details first.
- Confirm the demonstration database and private sign-in credentials.
- Prepare fictional references, accounts, documents and files with matching dates.
- Check permissions, policies and monetary approval limits.
- Keep invoice creation, money recording and allocation visibly separate.
- Use different people for preparation and independent approval.
- Explain movement, opening balance and closing balance without calling movement profit.
- Show both one successful operation and one meaningful validation or exception.
- End with the audit trail and a precise account of implementation limits.
- Record questions and any failed steps for follow-up after the presentation.

## 17 Source documents and implementation references

This guide follows the current source where older documents describe superseded releases. The role model was checked against `server/permissions.js` and `src/roleWorkspace.ts`; the new operational workflows were checked against their feature guide and implementation. Passwords and security keys are excluded.

- [Operational feature guide](OPERATIONS_FEATURES_2026-11-06.md)
- [Testing handover](TESTING_HANDOVER_2026-11-07.md)
- [Workflow testing record](WORKFLOW_TESTING_2026-11-06.md)
- [Design consistency pass](DESIGN_CONSISTENCY_2026-11-08.md)
- [Local operations and recovery](OPERATIONS.md)
- [Current requirements traceability](REQUIREMENTS.md)
- [Implementation and enhancement report](ENHANCEMENT_REPORT.md)

The presentation example is instructional material. It does not assert that these fictional records have already been posted or that every demonstration step has passed browser testing.
