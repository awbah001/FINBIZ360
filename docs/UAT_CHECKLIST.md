# FinBiz 360 user acceptance checklist

Use a separate synthetic demo or isolated temporary database. Never enter evaluation transactions in the company database. Automated evidence is technical verification, not user sign-off. Human review remains **pending** because the browser host was unavailable and native app approval timed out.

## Setup and evidence

Record tester, role, date, browser/version, viewport, dataset, expected result, actual result, elapsed task time, screenshots where authorised and pass/fail. Use authorised masked records only. The automated suites use in-memory/temporary databases and synthetic identities. A fresh real company workspace remains empty.

| #   | Business scenario                           | Expected result                                                                                                               | Automated evidence                                                         | Human acceptance |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------- |
| 1   | Record a cash receipt                       | Exact amount, required voucher/reference, correct account/user, saved once                                                    | system.test.js all channels and retry safety                               | Pending          |
| 2   | Record mobile money receipt                 | Accepted recorded entry, explicit SLE/account/channel/reference; no provider API claim                                        | system.test.js channel capture; enhancements evidence states               | Pending          |
| 3   | Record a bank transfer                      | Valid date/money/account; wrong currency rejected; independent verification/reconciliation remain distinct                    | system.test.js channels; enhancements upload/currency checks               | Pending          |
| 4   | Register/edit/search a customer             | Reference/contact fields persist, audited edits and status, history accessible                                                | enhancements.test.js contacts/global search                                | Pending          |
| 5   | Register/edit a supplier                    | Contact persists; expenses, bills and outstanding visible in history                                                          | enhancements.test.js contacts and supplier bills                           | Pending          |
| 6   | Create simple/itemised/draft invoice        | Items equal total; draft cannot receive payments; issue/cancel supported without overwriting posted values                    | enhancements.test.js itemised lifecycle                                    | Pending          |
| 7   | Allocate partial invoice payment            | Accepted same-customer receipt only; no overpayment or double-counted income; history and correction retained                 | system.test.js allocations; enhancements lifecycle/corrections             | Pending          |
| 8   | Record an expense                           | Outflow awaits independent authorised approval; self-review and unassigned admin authority refused                            | system.test.js approvals; enhancements delegation                          | Pending          |
| 9   | Import a valid statement                    | Column mapping, preview, confirmation and retained original; repeat commit does not duplicate                                 | system.test.js CSV/XLSX imports                                            | Pending          |
| 10  | Import invalid statement rows               | Raw invalid rows and reasons retained/downloadable; valid rows separately confirmed; unsafe archive rejected                  | enhancements retained errors, malformed workbook and original import tests | Pending          |
| 11  | Detect duplicate records                    | Repeated file rejected, duplicate rows/references warned/queued, not silently dropped or auto-confirmed                       | system.test.js duplicates; enhancements preview warnings                   | Pending          |
| 12  | Review automated matching suggestions       | Exact suggestions require confirmation; tolerance rules explain date/amount; rejected suggestions remain auditable            | system.test.js exact/concurrency; enhancements tolerance/rejection         | Pending          |
| 13  | Review unmatched records                    | Exception filters by account/channel/date/type/status, reasons and evidence available                                         | enhancements exceptions/partial queue                                      | Pending          |
| 14  | Resolve a discrepancy/partial settlement    | Record real adjustment/fee or propose explicit partial amount; independent review, no overmatching; remaining amount accurate | enhancements net-of-fee, tolerance, partial allocation/undo                | Pending          |
| 15  | Approve adjustment/write-off/period request | Different manager, reason/time retained; no silent changes; write-off never creates cash or marks unpaid amount paid          | enhancements independent requests and period locks                         | Pending          |
| 16  | Generate filtered financial reports         | Exact accepted totals and opening/movement/closing; document attribution limits disclosed                                     | enhancements report variants; baseline dashboard/export consistency        | Pending          |
| 17  | Export CSV/XLSX/PDF                         | Downloads open, filtered values agree, spreadsheet formula injection escaped/treated as strings                               | system.test.js exports; enhancements workbook/report checks                | Pending          |
| 18  | Review audit history                        | Actor/action/entity/time/reason preserved; ordinary users cannot edit/delete events                                           | system.test.js immutable financial/audit records; migration preservation   | Pending          |
| 19  | Test restricted roles                       | Auditor cannot mutate; cashier sees permitted own records/evidence; admin has no implicit approval authority                  | baseline roles and new server/rendered controls                            | Pending          |
| 20  | Restore a backup                            | New destination only; integrity/foreign keys/counts match; original file unchanged and restored sessions invalidated          | system.test.js backup; enhancements safe restore; migrations.test.js       | Pending          |

## Cross-cutting interactive checks

- [ ] At desktop widths, verify every original and new navigation destination, active state, scrolling and compact user profile/sign-out area.
- [ ] At 390px mobile, tablet and desktop widths, check no unintended page overflow; data tables may scroll in their containers.
- [ ] Verify global search results and Enter/Ctrl/Cmd+K; breadcrumbs; account selector; header/financial date controls; notification count and approval navigation.
- [ ] Verify record forms, required validation, cancelled dialogs, submit loading, retry protection, success/error feedback and focus return.
- [ ] Verify keyboard-only navigation, visible focus, dialog focus trap, Escape, labels, native multiple selection and reduced-motion behaviour.
- [ ] Verify statement mapping, errors/warnings/downloads, exact rejection, full groups, partial mode, independent decision, remaining balances and undo.
- [ ] Verify actual empty/new-company states; no sample trends, percentages, provider health or deadlines appear as real data.
- [ ] Verify status, date, account, category/channel filters, sorting, pagination and every report/export with known expected totals.
- [ ] Check PDF/XLSX/CSV presentation and content manually; automated parsers do not establish visual quality.
- [ ] Repeat supported core tasks in organisation-selected current Chrome/Edge/Firefox and common mobile browsers.
- [ ] Review approved threshold/delegation/period/write-off policy, evidence access, backup storage/retention, HTTPS and recovery objectives with the owner.

## Sign-off

Technical verification is documented in ENHANCEMENT_REPORT.md. Company sponsor, finance representative, administrator and read-only reviewer must record actual results and approve the pilot. No names, feedback, task-time improvement or acceptance signature has been invented.

## Complete RBAC technical verification (3 November 2026)

The completed role implementation passed 56 automated tests, the production build and changed-file formatting checks. Technical role results, policy defaults, migration/rollback evidence and supported-scope limitations are recorded in [ROLE_WORKSPACE_AUDIT.md](ROLE_WORKSPACE_AUDIT.md). This does not change human acceptance to Passed.

When browser access is restored, verify each role at desktop, tablet and mobile widths, including direct `/workspace?page=...` links and forbidden destinations. Exercise admin search/reset/configuration, explicit policy toggles, manager pending/completed decisions, finance receipt/expense/import/reconciliation, cashier sale/receipt/customer/invoice allocation, auditor report review/export denial/grant and audit filters. Confirm focus/keyboard behaviour, notification popovers, monetary wrapping, truthful daily scopes and preserved unsaved-change prompts.
