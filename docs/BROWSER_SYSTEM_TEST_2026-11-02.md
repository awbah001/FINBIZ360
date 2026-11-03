# Browser system test — 2 November 2026

Status: in progress. Browser evidence and automated coverage are recorded separately below.

## Environment

- Local application: http://127.0.0.1:3001, built React frontend and Express API.
- Browser: existing Brave desktop window, approximately 1137 × 778 including browser chrome, 90% browser zoom.
- Isolated synthetic database: `data/browser-uat-20261102.db`. Existing company databases were not used for test postings.
- Browser connector unavailable; native Windows browser automation used. URL confidence checks interrupted earlier turns. Native file dialogs required keyboard navigation.

## Test identities

Created through company registration and administrator Settings:

| Email | Role | Browser coverage |
| --- | --- | --- |
| owner@browser-uat.test | Owner / Manager | Login, independent payment approval, mobile receipt, statement import, reconciliation, exception investigation, reports |
| admin@browser-uat.test | Administrator | Login, empty dashboard, staff creation |
| finance@browser-uat.test | Finance Officer | Login, cash account, customer/supplier, invoice, receipt, allocation, expense, restricted approval view |
| cashier@browser-uat.test | Cashier | Login, own-record scope, inflow-only entry, missing cash reference rejection, valid receipt |
| auditor@browser-uat.test | Auditor | Login, full transaction scope/search, no posting action, invoice history without mutation controls |

Passwords were synthetic, entered locally and not saved in the browser. This report intentionally omits credentials.

## Browser results

| Scenario | Actual evidence | Result |
| --- | --- | --- |
| First company registration | Owner and administrator created, returned to login | Pass |
| Empty company | Zero financial totals and zero transactions, no synthetic activity displayed | Pass |
| Staff creation | Finance, cashier and auditor saved through administrator UI | Pass |
| Cash account | UAT Cash, SLE 1,000 opening, movement initially zero | Pass |
| Contacts | UAT Customer and UAT Supplier persisted with references and synthetic email addresses | Pass |
| Invoice | UAT-INV-001, issued 2026-11-02, due 2026-11-30, amount/outstanding SLE 500 | Pass |
| Cash receipt | UAT-CASH-001, SLE 300, Sales, same customer, recorded once | Pass |
| Partial allocation | SLE 200 allocated, invoice Partial, outstanding SLE 300 | Pass |
| Over-allocation | Further SLE 150 from receipt with SLE 100 remaining rejected: “Allocation exceeds the unpaid invoice or available receipt.” | Pass |
| Outgoing expense | UAT-EXP-001, SLE 120, Supplies, UAT Supplier, Pending | Pass |
| Pending excluded from cash flow | Inflows/net SLE 300, outflows SLE 0 while expense pending | Pass |
| Finance author approval restriction | Expense visible as Independent Review, no Approve/Reject buttons | Pass |
| Independent manager approval | Owner approved finance expense with reason, pending queue became zero | Pass |
| Account closing balance | UAT Cash SLE 1,180 = opening 1,000 + receipt 300 − approved expense 120 | Pass |
| Mobile receipt | UAT Mobile account, UAT-MOBILE-001 SLE 123.45, saved once | Pass |
| Statement preview | Synthetic CSV: two valid rows and one invalid-date row, excluded reason visible, error download available | Pass |
| Statement commit | Explicit confirmation committed two valid rows; history shows 2 valid / 1 invalid and Committed | Pass |
| Exact matching | One Suggested SLE 123.45 match; one Unmatched SLE 55 item, no automatic confirmation | Pass |
| Confirm reconciliation | Required review note saved; one Reconciled, one Unmatched | Pass |
| Undo/reconfirm | Undo with reason restored suggestion; reconfirmation returned to one Reconciled, one Unmatched | Pass |
| Exception queue | Unmatched SLE 55, invalid source row, and unmatched cash transactions retained | Pass |
| Investigation | Note saved, SLE 55 exception changed to In Review, amount preserved | Pass |
| Financial totals | Inflows 423.45, approved outflows 120.00, net 303.45; invoice allocation/import did not duplicate cash | Pass |
| Account report preview | Cash 100000 opening + 18000 movement = 118000 closing; mobile 0 + 12345 = 12345, exact minor units | Pass |
| CSV browser export | Saved `test-results/browser-transactions.csv`; exactly three rows, amounts 30000, 12000, 12345, expense approved and mobile reconciled | Pass |
| PDF browser export | Saved `test-results/browser-transactions.pdf`; one readable rendered page, all three export-time transactions/amounts/approval states verified | Pass |
| XLSX browser export | Saved `test-results/browser-accounts.xlsx`; workbook rows exactly match account report preview, including all opening/movement/closing minor units | Pass |
| Analytics | Correct cash/mobile channel amounts; insufficient history explicitly prevents forecasting | Pass |
| Audit history | Actors and UTC timestamps shown for allocation, approval, import, confirmation, undo, investigation and downloads | Pass |
| Cashier scope | Zero records before own entry, then only own SLE 25.50 receipt visible; other users' three transactions hidden | Pass |
| Cashier entry restrictions | Outflow option unavailable; missing cash reference rejected, then valid reference saved once | Pass |
| Auditor restrictions | Four records and full totals visible, no Record action; invoice offers Payment history only, no create/allocate/cancel/correct controls | Pass |
| Reference search | Auditor search UAT-MOBILE-001 returns one matching SLE 123.45 receipt | Pass |
| Supplier bill | UAT-BILL-001 SLE 120 created and allocated from independently approved same-supplier payment; Paid, outstanding zero | Pass |

## Defects and changes

1. **Navigation crash, high severity:** Invoices → Transactions produced a blank application. Console showed `Cannot read properties of undefined (reading 'map')`. A screen briefly received another screen's API response before the loading effect cleared state. Changed `src/main.tsx` to store page identity with each response and expose data only to its owning page. Rebuilt successfully. Later browser navigation Transactions → Invoices and Invoices → Transactions both rendered correctly.
2. **Table action wrapping, visual issue:** At the tested desktop size, some Exceptions action buttons wrap words into several fragments as the investigation note expands the adjacent column. Financial behavior passed. Visual polish remains open.
3. **Encoding/display issue:** Some helper text contains a replacement character or literal question mark, including account movement separator and manager-approval description. Requires text cleanup.

## Automated evidence

- `npm test`: 45 passed, zero failed, zero skipped before navigation patch.
- `npm run build`: passed before and after navigation patch.
- Automated suites cover additional boundary/permission cases, XLSX import, duplicate handling, grouped/partial matching, period controls, correction history, evidence, backup/restore, and immutable records. These do not substitute for browser execution.

## Remaining browser coverage

- Itemised/draft invoice lifecycle.
- Evidence upload and verification, transaction corrections, control requests and independent group/partial matching.
- Duplicate import rejection and original/error evidence downloads.
- Filters/search/pagination and all report variants.
- Detailed audit evidence expansion, period locks, administrator backup download and restore review.
- Mobile/tablet layouts, keyboard accessibility, cross-browser comparison.
- XLSX visual presentation; automated tests after final changes.

## Palette update during testing

The user requested stable mixed colours across components. Added shared tone tokens and explicit module/card mappings. Net movement/accounts use blue, inflows/reconciliation green, outflows/suppliers coral, invoices/analytics violet, statements/customers cyan, approvals amber, exceptions rose and audit/settings slate. Card hover uses the assigned hue. White operational record surfaces and the light sidebar remain. Browser inspection confirmed distinct dashboard cards and violet invoice navigation/action/icon. Current company workspace was inspected read-only for the palette change.

After the cashier receipt, expected company-wide totals are four transactions, SLE 448.95 inflows, SLE 120.00 outflows and SLE 328.95 net movement. Earlier downloaded exports intentionally reflect the three transactions present at their export time.

This is technical test evidence, not company acceptance or production sign-off.
