# MASTER DEVELOPMENT PROMPT — FINBIZ 360

## Existing System Enhancement, Requirements Compliance & UI/UX Modernisation

### 1. Your Role

Act as a senior full-stack software engineer, enterprise systems architect, financial software specialist, database engineer, QA engineer and UI/UX designer.

Your task is to inspect, improve, complete and validate the existing **FinBiz 360 — Integrated Digital Financial Management and Business Intelligence System**.

The system is being developed for a selected retail or trading enterprise in Freetown, Sierra Leone, as described in the project proposal.

You must work with the existing source code and application. This is an enhancement and completion exercise, NOT a request to rebuild the application.

### 2. CRITICAL: Preserve the Existing System

These instructions are mandatory:

- Do NOT rebuild the application from scratch.
- Do NOT replace the existing technology stack.
- Do NOT migrate the application to another framework or database.
- Do NOT delete existing features, pages, components, routes or working functionality.
- Do NOT unnecessarily restructure the project.
- Do NOT replace existing authentication or database systems.
- Do NOT change existing API contracts unless a genuine defect requires it.
- Do NOT remove existing data or modify database records destructively.
- Do NOT introduce sample financial transactions into production data.
- Do NOT create duplicate implementations of features that already exist.
- Do NOT change the established business logic without understanding its purpose.

Before making any modifications:

1. Inspect the entire project structure.
2. Identify the existing frontend, backend, database, APIs, authentication and routing.
3. Review existing database models, relationships and migrations.
4. Identify all existing pages, components, features and user roles.
5. Examine which functions are fully implemented, partially implemented or missing.
6. Identify existing bugs, duplicated code and architectural weaknesses.
7. Establish a baseline of existing functionality.

Create an internal implementation checklist mapping the project's existing capabilities against every requirement in this prompt.

**Preserve the current architecture and extend it using the existing conventions.** The technology stack proposed in the project document is a design reference, not permission to replace a different stack already implemented.

### 3. System Purpose

FinBiz 360 must provide a centralised platform for managing an organisation's financial activities.

It should support:

- Financial transaction recording.
- Cash, mobile money and bank transfer management.
- Customer and supplier management.
- Financial account management.
- Income and expense tracking.
- Invoices and payment statuses.
- Financial statement imports.
- Automated transaction matching.
- Financial reconciliation.
- Exception management.
- Approval workflows.
- Audit trails.
- Financial dashboards.
- Management reports.
- Cash-flow monitoring.
- Rule-based anomaly indicators.
- Short-term cash-flow forecasting where sufficient data exists.

The application is an internal financial management and reconciliation system. It is NOT a banking application, payment wallet or independent payment settlement platform.

---

# 4. USER MANAGEMENT AND ACCESS CONTROL

Implement and verify the following user roles without disrupting existing accounts.

### System Administrator

- Create, edit and deactivate users.
- Assign and manage roles.
- Configure system settings.
- Manage reference data.
- Manage backups and restoration.
- Review system activity.
- Do not automatically grant business approval authority unless separately assigned.

### Owner / Manager

- Access management dashboards.
- View financial summaries and reports.
- Monitor business performance.
- Approve designated transactions, adjustments and exceptions.
- Review reconciliation results.
- Monitor outstanding financial activities.

### Finance Officer

- Record and review transactions.
- Manage financial accounts.
- Record income and expenses.
- Manage invoices and payments.
- Import financial statements.
- Run reconciliation.
- Resolve permitted exceptions.
- Generate financial reports.

### Cashier / Sales Officer

- Record sales and receipts.
- Record cash transactions.
- View permitted transactions.
- Access assigned operational functions.

### Auditor / Read-only Reviewer

- View authorised financial records.
- Review reconciliation evidence.
- Access audit history.
- Generate permitted reports.
- Must not modify financial records.

Implement server-side role-based access control. Hiding buttons in the frontend is not sufficient protection.

---

# 5. CORE FUNCTIONAL MODULES

Inspect every existing module and ensure that it works correctly.

### A. Dashboard / Business Overview

Improve the existing dashboard without removing its current functionality.

It should provide:

- Net cash movement.
- Total inflows.
- Total outflows.
- Total transaction count.
- Account balances.
- Income and expense summaries.
- Outstanding customer payments.
- Outstanding supplier payments.
- Reconciliation status.
- Unmatched transactions.
- Recent financial activities.
- Cash-flow trends.
- Relevant business insights.

Provide date-range and account filters.

All dashboard figures must be calculated from actual database records using consistent business rules.

Ensure that changing filters updates all relevant KPIs, charts, tables and summaries.

Never display invented figures as real business performance.

When no records exist, show a meaningful empty state rather than misleading information.

### B. Transaction Management

Support recording, viewing, searching, filtering and managing financial transactions.

Each transaction should support the following fields where applicable:

- Unique internal transaction ID.
- Transaction date.
- Amount.
- Currency.
- Transaction direction (inflow or outflow).
- Payment channel.
- Account.
- Customer or supplier.
- External transaction reference.
- Description.
- Responsible user.
- Supporting evidence.
- Transaction status.

Payment channels must include:

1. Cash.
2. Mobile Money.
3. Bank Transfer.

Provide appropriate forms for each transaction type.

Implement:

- Transaction creation.
- Transaction details.
- Editing where permitted.
- Search and filtering.
- Transaction categorisation.
- Receipt and voucher references.
- Duplicate warnings.
- Transaction reversal and adjustment workflows.

Completed financial transactions must never be silently deleted or overwritten.

Corrections must use authorised reversals, adjustments or amendments with recorded reasons and audit history.

Keep recorded, provider-confirmed and statement-reconciled statuses distinct.

### C. Financial Accounts

Allow authorised users to configure and manage:

- Cash accounts.
- Bank accounts.
- Mobile money accounts.
- Clearing accounts.
- Income categories.
- Expense categories.

Support account names, types, currencies, opening balances and active/inactive status.

Ensure account balances are derived consistently from recorded financial activities.

### D. Customer Management

Provide complete customer management functionality.

Include:

- Customer registration.
- Contact information.
- Customer reference.
- Transaction history.
- Invoice history.
- Outstanding balances.
- Payment history.
- Customer search and filtering.

Collect only necessary customer information.

### E. Supplier Management

Support:

- Supplier registration.
- Contact information.
- Supplier reference.
- Purchase and payment records where applicable.
- Outstanding balances.
- Expense history.
- Supplier transaction history.

### F. Income and Expense Management

Income management must support:

- Income source.
- Amount.
- Date.
- Account.
- Category.
- Payment channel.
- Description.
- Supporting evidence.

Expense management must support:

- Expense category.
- Payee.
- Amount.
- Date.
- Payment channel.
- Account.
- Supporting evidence.
- Approval status.

Allow authorised users to review and approve designated expenses.

### G. Invoices and Payment Management

Provide invoice creation and management.

Support:

- Invoice number.
- Customer.
- Invoice date.
- Due date.
- Description.
- Line items where applicable.
- Amount.
- Currency.
- Payment status.
- Payment history.

Payment statuses should include:

- Draft.
- Issued.
- Partially Paid.
- Paid.
- Overdue.
- Cancelled.

Ensure partial payments and outstanding balances are calculated correctly.

Do not mark invoices as paid unless the corresponding payment has been recorded and appropriately verified.

### H. Statement Import

This is a critical component of FinBiz 360.

Allow authorised finance officers to import bank and mobile money statements using supported CSV and XLSX formats.

Implement the following workflow:

1. Select the payment channel and account.
2. Upload a statement file.
3. Validate the file format.
4. Allow column mapping where necessary.
5. Preview the imported records.
6. Identify missing or invalid fields.
7. Detect possible duplicate files and records.
8. Display valid and invalid rows separately.
9. Allow the user to confirm the import.
10. Save the validated statement and its records.
11. Generate transaction matching suggestions.
12. Display an import summary.

Preserve source-file metadata, upload time, uploader and validation results.

Never silently discard invalid records.

### I. Transaction Reconciliation

Build or improve the reconciliation engine.

Its responsibility is to compare internally recorded transactions against imported bank and mobile money statement entries.

Implement matching based on:

- External reference.
- Transaction amount.
- Transaction date.
- Payment channel.
- Account.
- Configured matching rules.

Support:

- Exact-reference matching.
- Amount and date matching.
- Configurable date and amount tolerances.
- One-to-many matching.
- Many-to-one matching.
- Duplicate detection.
- Partial matches.
- Unmatched transactions.
- Amount discrepancies.

Display reconciliation statuses clearly:

- Matched.
- Suggested Match.
- Unmatched.
- Partially Matched.
- Duplicate.
- Discrepancy.
- Pending Review.

A suggested match must never automatically become a confirmed reconciliation without satisfying the configured verification rules.

Provide a reconciliation workspace where authorised users can:

- Review suggested matches.
- Confirm valid matches.
- Reject incorrect suggestions.
- Investigate discrepancies.
- Resolve exceptions.
- Record explanations.
- Approve permitted adjustments.
- View reconciliation history.

Every manual resolution must be recorded in the audit trail.

### J. Exception Management

Create a central exception queue.

It should show:

- Unmatched transactions.
- Duplicate records.
- Amount differences.
- Missing references.
- Partial matches.
- Invalid statement entries.
- Reconciliation issues requiring approval.

Provide filters by account, channel, date, status and exception type.

Allow authorised users to investigate and resolve exceptions.

Record the user, resolution reason, date and approval details.

### K. Approval Workflows

Implement approval workflows for designated:

- Transactions.
- Expenses.
- Adjustments.
- Write-offs.
- Reconciliation exceptions.
- Reporting-period closures.

Approval permissions must be configurable.

Maintain separation between users who initiate an action and users who approve it where required.

Every approval or rejection must contain a timestamp, responsible user and reason.

### L. Statements and Financial Reports

Provide meaningful financial reporting.

Reports should include:

- Transaction reports.
- Income reports.
- Expense reports.
- Cash-flow reports.
- Account statements.
- Customer balances.
- Supplier balances.
- Invoice reports.
- Reconciliation reports.
- Outstanding transaction reports.
- Exception reports.

Allow filtering by date, account, payment channel, category and status.

Provide controlled PDF and spreadsheet exports where appropriate.

Ensure exported totals agree with the corresponding filtered database records.

### M. Business Intelligence and Analytics

Provide useful management insights.

Include:

- Income and expense trends.
- Cash-flow movement.
- Payment-channel analysis.
- Account performance.
- Transaction volumes.
- Outstanding balances.
- Period comparisons.
- Financial summaries.

Implement rule-based anomaly indicators to identify unusual transaction patterns.

Each anomaly must explain the rule that triggered it.

An anomaly is an indicator requiring human investigation, not proof of fraud.

Implement short-term cash-flow forecasting only where sufficient reliable historical data exists.

Display forecast assumptions, limitations and historical comparisons.

If data is insufficient, explain that forecasting is unavailable instead of generating misleading predictions.

---

# 6. BUSINESS RULES AND FINANCIAL DATA INTEGRITY

These requirements are essential.

1. Use fixed-precision decimal arithmetic for monetary values, never floating-point calculations for financial totals.
2. Store explicit currency codes.
3. Give every transaction a unique internal identifier.
4. Treat external transaction references separately from internal identifiers.
5. Preserve statement import metadata.
6. Prevent duplicate imports and duplicate transaction processing.
7. Keep transaction statuses logically consistent.
8. Make reconciliation decisions explainable and reversible through authorised workflows.
9. Explicitly represent fees, reversals, refunds, partial payments and settlement differences where supported.
10. Ensure adjustments are properly authorised.
11. Prevent unauthorised deletion or modification of completed financial records.
12. Use database constraints and atomic operations to maintain financial consistency.
13. Ensure dashboard and report calculations use the same underlying business rules.

If accounting-grade double-entry ledger functionality is already implemented or formally required, ensure posted journal entries balance, with total debits equal to total credits. Do not introduce an unnecessary ledger migration simply to change the existing architecture.

---

# 7. AUDIT TRAIL

Maintain a reliable audit trail for critical actions.

Record:

- User.
- Action performed.
- Affected record.
- Previous value where appropriate.
- New value where appropriate.
- Timestamp.
- Reason for changes.
- Approval or rejection details.

Cover transaction creation, amendments, reversals, approvals, statement imports, reconciliation and period closure.

Ordinary users must not be able to modify or delete audit records.

Provide authorised audit-history access.

---

# 8. SECURITY AND DATA PROTECTION

Implement and verify:

- Secure authentication.
- Proper password hashing.
- Server-side role permissions.
- Session management.
- Input validation.
- Protection against SQL injection.
- Protection against cross-site scripting.
- CSRF protection where applicable.
- Secure file upload validation.
- Restricted access to uploaded statements.
- HTTPS in deployed environments.
- Secure backup storage.
- Data privacy and access restrictions.

Never store:

- Mobile money PINs.
- Bank passwords.
- Card CVVs.
- Authentication secrets.

Use authorised financial records only. Mask or anonymise sensitive customer and account information where appropriate.

Use synthetic or masked records for testing unless live data access has been explicitly authorised.

---

# 9. MODERN UI/UX REDESIGN

Improve the visual presentation of the existing application while preserving its navigation, workflows and functionality.

The target design is a modern, premium financial SaaS dashboard.

### Colour direction

Use a soft turquoise-inspired visual identity.

Suggested palette:

- Primary turquoise: #14B8A6
- Deep teal: #0F766E
- Soft turquoise: #CCFBF1
- Pale background: #F4FAFA
- White: #FFFFFF
- Main text: #172B3A
- Secondary text: #64748B
- Borders: #E2E8F0

Do NOT use emerald green as the primary brand colour.

Avoid excessive gradients, excessive glass effects and oversaturated backgrounds.

Use turquoise as the primary accent, with complementary neutral colours and restrained blue, purple and amber accents for data visualisation.

### Sidebar

Improve the existing sidebar with:

- Refined FinBiz 360 branding.
- Consistent navigation icons.
- Clear active navigation states.
- Better spacing and typography.
- Organised navigation groups.
- Improved profile section.
- Accessible hover states.
- Collapsible navigation where appropriate.

Preserve all existing navigation destinations.

### Header

Provide:

- Breadcrumb navigation.
- Global search.
- Company/account selector.
- Notifications.
- Date controls.
- User profile.

### Dashboard

Redesign existing KPI cards with:

- Clear financial labels.
- Prominent monetary values.
- Small trend indicators where actual comparison data exists.
- Subtle illustrations or icons.
- Consistent spacing.
- Appropriate responsive behaviour.

Improve the financial overview chart, insights panel, quick actions and recent activity sections.

### Design quality

- Use consistent border radii.
- Use subtle shadows.
- Establish clear visual hierarchy.
- Use modern typography.
- Use consistent iconography.
- Avoid clutter.
- Provide meaningful empty states.
- Provide loading skeletons.
- Provide clear success and error feedback.
- Add responsive layouts for desktop, tablet and mobile.
- Ensure accessibility and sufficient colour contrast.

Use existing icon libraries where possible. Do not introduce unnecessary dependencies.

The final interface should look like a professionally designed enterprise fintech product, not a generic admin template.

---

# 10. FUNCTIONALITY AND INTERACTION REQUIREMENTS

Every visible interface element must work.

Verify:

- All navigation links.
- All buttons.
- All dropdowns.
- All search fields.
- All date filters.
- All forms.
- All modals.
- All table actions.
- All pagination.
- All sorting.
- All export controls.
- All approval actions.
- All notifications.
- All dashboard interactions.

Forms must include:

- Required-field validation.
- Appropriate input types.
- Clear error messages.
- Submission loading states.
- Success notifications.
- Prevention of accidental duplicate submissions.

Do not create decorative buttons that do nothing.

Do not use placeholder interactions for core functionality.

Ensure frontend actions communicate correctly with the existing backend and database.

---

# 11. NON-FUNCTIONAL REQUIREMENTS

Verify the following:

**Security:** HTTPS in deployment, secure password storage and server-side permissions.

**Data integrity:** Database constraints, validation and atomic transactions.

**Auditability:** Critical actions attributable to users and timestamps.

**Performance:** Target approximately three seconds or less at the 95th percentile for common queries under the agreed test conditions.

**Usability:** Core tasks should be understandable after brief training.

**Availability:** Documented backup, restoration and outage procedures.

**Scalability:** Appropriate indexing and modular application structure.

**Maintainability:** Documented, version-controlled source code.

**Compatibility:** Support current major desktop browsers and common mobile screen sizes.

**Privacy:** Collect only necessary information and protect sensitive records.

**Recoverability:** Test backup restoration and document recovery procedures.

**Explainability:** Matching suggestions and anomaly indicators must show their reasons.

---

# 12. TESTING AND QUALITY ASSURANCE

Do not assume a feature works simply because its page exists.

Test the application at three levels.

### Unit Testing

Test:

- Financial calculations.
- Transaction validation.
- Role permissions.
- Duplicate detection.
- Invoice balances.
- Matching rules.
- Approval logic.
- Report calculations.

### Integration Testing

Verify:

- Frontend-to-backend communication.
- Database operations.
- Statement import.
- Reconciliation workflows.
- Audit logging.
- Authentication and authorisation.
- Report generation.

### User Acceptance Testing

Test realistic business scenarios, including:

1. Record a cash receipt.
2. Record a mobile money transaction.
3. Record a bank transfer.
4. Register a customer.
5. Register a supplier.
6. Create an invoice.
7. Record a partial invoice payment.
8. Record an expense.
9. Import a valid statement.
10. Import an invalid statement.
11. Detect duplicate records.
12. Match transactions automatically.
13. Review unmatched transactions.
14. Resolve an amount discrepancy.
15. Approve an adjustment.
16. Generate a financial report.
17. Export a report.
18. Review audit history.
19. Test restricted role access.
20. Restore a backup.

Use controlled test data and ensure that test records cannot contaminate actual financial records.

---

# 13. ACCEPTANCE CRITERIA

The system should not be considered complete until the following conditions are satisfied:

- Authentication and role permissions work correctly.
- Valid financial transactions save correctly.
- Invalid financial records are rejected.
- Cash, mobile money and bank transactions are supported.
- Customers and suppliers can be managed.
- Invoices and partial payments calculate correctly.
- Income and expenses are correctly recorded.
- Valid statement files import successfully.
- Invalid rows are identified.
- Duplicate imports are controlled.
- Known matching scenarios produce expected outcomes.
- Unmatched and discrepant items enter the exception queue.
- Authorised users can resolve exceptions.
- Audit records are generated for critical actions.
- Dashboard totals agree with underlying records.
- Reports and exports produce correct figures.
- Backup restoration is successfully tested.
- The application works across supported screen sizes.
- Existing features continue functioning after enhancements.

Track every requirement against its implementation and test evidence.

---

# 14. IMPLEMENTATION STRATEGY

Work incrementally. Do not attempt to replace the entire application in one operation.

**Phase 1 — Existing System Audit**

- Inspect the source code.
- Map existing modules.
- Identify incomplete requirements.
- Document existing defects.
- Prepare a requirements traceability matrix.

**Phase 2 — Core Financial Management**

- Complete user management.
- Verify account management.
- Complete transaction recording.
- Verify customers and suppliers.
- Complete income, expenses and invoices.

**Phase 3 — Statement Import and Reconciliation**

- Complete statement upload.
- Implement validation.
- Implement duplicate detection.
- Improve matching.
- Complete exception management.

**Phase 4 — Reporting and Business Intelligence**

- Improve dashboard calculations.
- Complete financial reports.
- Implement exports.
- Add cash-flow summaries.
- Add anomaly indicators and forecasting where feasible.

**Phase 5 — Security and Quality Assurance**

- Verify permissions.
- Test financial data integrity.
- Test audit trails.
- Test backups.
- Run integration and UAT tests.
- Fix identified defects.

**Phase 6 — UI/UX Modernisation**

- Apply the turquoise design system.
- Improve navigation.
- Improve dashboard cards.
- Refine forms, tables and charts.
- Improve responsive behaviour.
- Preserve existing workflows.

**Phase 7 — Final Validation**

- Re-test all existing functionality.
- Validate the requirements traceability matrix.
- Document completed and outstanding requirements.
- Provide a final implementation report.

You may adjust the order when dependencies require it, but do not skip mandatory functionality.

---

# 15. RULES FOR WORKING WITH THE CODEBASE

Before modifying any file:

1. Understand what the file currently does.
2. Identify its dependencies.
3. Check whether the functionality already exists elsewhere.
4. Make the smallest appropriate change.
5. Preserve existing naming conventions and coding standards.
6. Avoid unnecessary packages.
7. Preserve existing database records.
8. Use safe, reversible database migrations when necessary.
9. Test the affected functionality.
10. Check for regressions in related modules.

Do not replace complete files when a targeted modification is sufficient.

Do not remove working functionality to make implementation easier.

Do not claim a feature is implemented unless it has been verified.

If a requirement cannot be implemented safely without changing the existing architecture, explain the technical limitation and propose the least disruptive solution before proceeding.

---

# 16. FINAL DELIVERABLE

At the end of the work, provide:

1. Summary of the existing system architecture.
2. List of existing features that were preserved.
3. List of completed enhancements.
4. List of incomplete requirements.
5. List of bugs identified and resolved.
6. Database changes and migrations performed.
7. Security improvements.
8. UI/UX improvements.
9. Testing results.
10. Remaining limitations and recommendations.

Include a requirements traceability matrix with:

- Requirement ID.
- Requirement description.
- Existing implementation status.
- Changes made.
- Test performed.
- Final status.

Use the following statuses:

- Already Implemented.
- Improved.
- Newly Implemented.
- Partially Implemented.
- Not Implemented.
- Blocked by External Dependency.

### FINAL DIRECTIVE

Your primary objective is to make the existing FinBiz 360 application fully functional, secure, reliable and compliant with the requirements of the project proposal.

**Do not confuse redesigning the interface with rebuilding the system.**

Preserve the existing application, its architecture, its data and its working functionality. Improve what exists, complete what is missing, correct what is broken and verify every important requirement.

Work carefully, incrementally and professionally. System correctness, financial data integrity and preservation of existing functionality take priority over visual changes.

Begin by auditing the existing codebase and producing the implementation checklist. Do not start making large-scale changes before completing that audit.
