# Requirements traceability — initial development release

“Implemented” means an initial working workflow with API coverage where relevant. It does not mean company validation or production acceptance. The requested scope is larger than this first development release.

| ID    | Requirement           | Status and evidence                                                                                               |
| ----- | --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| FR-01 | Authentication        | Implemented: sessions, login/logout/password API; authentication test                                             |
| FR-02 | Role-based access     | Implemented: API middleware, cashier scoping, role tests                                                          |
| FR-03 | User administration   | Partial: create and activate/deactivate via settings; role reassignment/edit profile later                        |
| FR-04 | Customer management   | Partial: create/list; edit/inactivate later                                                                       |
| FR-05 | Supplier management   | Partial: create/list; supplier bills/balances later                                                               |
| FR-06 | Account setup         | Partial: create/list accounts; SLE only, fixed categories, zero openings                                          |
| FR-07 | Transaction capture   | Implemented core fields, exact amounts, date checks, immutable records and request keys                           |
| FR-08 | Cash transactions     | Implemented receipt/voucher-required cash records; cash count sessions later                                      |
| FR-09 | Mobile money records  | Implemented provider/account context and references; attached confirmation evidence later                         |
| FR-10 | Bank transfer records | Implemented records and statement evidence; explicit provider-confirmation state later                            |
| FR-11 | Sales/invoices        | Partial: simple single-description invoice, statuses and partial allocations; line items/credit notes later       |
| FR-12 | Expenses              | Partial: outflow category, counterparty, approval; evidence attachment and standalone expense module later        |
| FR-13 | Statement import      | Implemented CSV/XLSX preview/mapping/commit, 2 MB/2,000 row limits                                                |
| FR-14 | Import validation     | Implemented invalid-row reasons, duplicate file/account fingerprint; downloadable error-only file later           |
| FR-15 | Transaction matching  | Partial: exact reference/amount/date/account/direction rule v1; tolerances later                                  |
| FR-16 | Exception queue       | Partial: duplicate, ambiguous and unmatched line statuses; partial/difference classifications later               |
| FR-17 | Manual resolution     | Partial: exact suggestion confirmation/undo only; split, fee, grouped and manual resolution workflows later       |
| FR-18 | Reconciliation report | Partial: workspace/status counts; dedicated filtered reconciliation export later                                  |
| FR-19 | Cash-flow view        | Implemented accepted inflow/outflow/movement by account and dates; opening balance configuration later            |
| FR-20 | Dashboard             | Partial: real cash movement, counts, pending/reconciled, chart, accounts; invoice KPIs and richer filters later   |
| FR-21 | Audit log             | Implemented immutable significant events with actor/time/details; audit UI shows latest 200                       |
| FR-22 | Approval workflow     | Partial: all outflows require independent manager approval; configurable threshold routing/write-offs later       |
| FR-23 | Exports               | Partial: filtered transaction CSV and PDF; other report formats later                                             |
| FR-24 | Notifications         | Not implemented                                                                                                   |
| FR-25 | Anomaly indicators    | Not implemented; duplicate import/matching checks are controls, not an anomaly module                             |
| FR-26 | Cash-flow forecasting | Not implemented; UI accurately identifies this as later work                                                      |
| FR-27 | Backup and restore    | Partial: online backup command, automated test restore and operating guide; automated scheduling/encryption later |
| FR-28 | Period locking        | Implemented manager close/reopen/reason, pending-approval checks, write protections                               |

| NFR                           | Status / practical limit                                                                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security                      | Password hashing, CSRF, HttpOnly/SameSite cookies, Helmet, role checks and throttling implemented; HTTPS must be configured on deployment; privileged MFA later                    |
| Data integrity                | Foreign keys, checks, exact minor-unit money, atomic writes, uniqueness and immutable record/audit triggers; integration tests                                                     |
| Auditability                  | Significant actions traceable; DB-file operators remain trusted                                                                                                                    |
| Performance                   | Indexed lookups and paginated transaction register; p95 benchmark against agreed dataset not yet performed; matching workspace is bounded by small pilot size                      |
| Usability                     | Responsive layouts, labels, keyboard form-dialog handling and error/empty/loading states; visual checks and participant evaluation outstanding                                     |
| Availability / recoverability | Backup command, restoration test and documented procedures; organisation must confirm recovery objectives and retention                                                            |
| Scalability                   | Modular Express service with SQLite single-writer constraint; not a multi-instance deployment                                                                                      |
| Maintainability               | Organized frontend/backend/docs/tests, migrations table, lockfile and formatting; backend uses JavaScript ES modules, frontend TypeScript                                          |
| Compatibility                 | Browser-targeted build; visual desktop/mobile browser validation blocked in this environment                                                                                       |
| Privacy                       | Empty company database by default; separate optional demo, minimal contacts, private statement downloads, no payment secrets; deployment retention/encryption policies outstanding |
| Explainability                | Exact-match rule ID and evidence retained; no unsupported fraud/forecast claims                                                                                                    |

Next iteration priorities: visually validate all screens, add editable/inactive master records, expense attachments, explicit payment evidence state, filtered reconciliation exports and exception resolution workflows before advanced analytics. Obtain company-specific requirements before changing currency, provider mappings or approval policies.
