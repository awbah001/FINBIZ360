# Implementation plan and status

Build an initial local application using React, Node.js/Express and SQLite. Preserve the PDF's business requirements and the user's stack override.

1. Foundation: SQLite migrations, persistent sessions, CSRF, password hashing, server permissions and audit events.
2. Daily work: master records, exact-money transactions, invoices/payment allocations and independent expense approval.
3. Reconciliation: CSV/XLSX preview, mapping, fingerprint checks, explicit exact-match confirmation and exception visibility.
4. Interface: responsive management dashboard, searchable records, statements, reconciliation, reports, settings and audit views.
5. Verification: meaningful API tests, build, browser checks and setup/handover documentation.

Initial implementation deliberately does not claim the complete enterprise roadmap. Full traceability and outstanding scope will be recorded in REQUIREMENTS.md.

Assumptions: one organisation, SLE (two decimal places), Africa/Freetown, single Node.js instance and explicit nonnegative opening balance snapshots (zero by default). The default company database starts empty with first-time organisation/account setup; synthetic records are available only in the optional separate demo. Open views refresh every 15 seconds while visible and on window focus. No external payment feed is connected. Cash-flow totals describe recorded cash movement and exclude unapproved expenses; they are not profit.

The current enhancement checklist, technical results and external acceptance boundaries are recorded in ENHANCEMENT_AUDIT.md and ENHANCEMENT_REPORT.md. The original 21 tests remain, with 23 additional API/migration/render cases. Additive migrations v3-v6 preserve the original financial rows.
