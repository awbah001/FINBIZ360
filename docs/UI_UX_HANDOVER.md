# FinBiz 360 UI/UX implementation handover

Date: 2 November 2026. Implements the repository's `UI_UX_IMPROVEMENT_PROMPT.md` in the existing React application. No backend, database, financial calculations, authorisation policy, dependency versions or company records were changed in this pass.

## Current card treatment

Following the user's clarification, the supplied animated card treatment is scoped to dashboard KPI tiles, report summary/action cards and landing feature cards. Forms, table containers, charts, review/approval panels, contact/account management, the landing workspace preview and sidebar user profile use stable neutral surfaces. This separates summary emphasis from areas where users read or edit detailed records. Shared styles and financial behaviours remain unchanged by this scope correction.

## Audit and evidence boundary

Source review identified repeated theme/button declarations, an obsolete animated card layer, inconsistent standalone fields, viewport-bound login overrides, Ctrl/Cmd-dependent matching selection and incomplete mobile navigation isolation. Previous user screenshots informed the login composition; they are not before/after screenshots of this release.

A fresh browser-access attempt returned **“The browser access host is unavailable.”** No live page, before/after screenshot, mobile layout, keyboard interaction or screen-reader session was captured. Do not describe this release as pixel-verified, WCAG-certified or company-accepted. The layout targets below require browser acceptance.

## Changed-screen inventory

| Area                             | Implemented change                                                                                                                                                                     | Preserved behaviour                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Landing page                     | Shared typography/actions, teal emphasis and neutral feature cards                                                                                                                     | Sign in continues to `/login`; existing content and links                                                      |
| Login                            | Single natural-height composition, explicit full-width parent grid, 44/56 panels, 1160px maximum card, 400px form, quieter decoration, reduced duplicate branding                      | Actual sign-in, password visibility/help, account access, error text and submitting state                      |
| Registration                     | Shared field/action treatment and persistent password guidance linked to fields                                                                                                        | Company setup steps, real validation, password confirmation and server setup-token rules                       |
| Workspace shell                  | Consistent headers/actions, compact profile retained, mobile close control, expanded-state semantics, drawer focus trap/restoration, background isolation and hidden-drawer inertness  | All role-specific destinations, search, refresh, date/account controls and sign-out                            |
| Dashboard                        | Shared neutral cards, typography and action hierarchy without animated overlays                                                                                                        | Real KPIs, chart data, obligations, account semantics and role-aware actions                                   |
| Transactions, accounts, contacts | Shared field/modal validation, readable action variants, applied-filter summary, labelled keyboard-focusable table regions                                                             | Existing details, evidence, edits, transaction creation/reversal and permissions                               |
| Invoices/supplier bills          | Shared standalone fields, clearer secondary/destructive actions, itemised-invoice unsaved-change warning, table navigation                                                             | Exact invoice items, payments, write-offs, correction histories and approved allocations                       |
| Statements                       | Shared input/actions, visible filter context and accessible scroll regions                                                                                                             | File mapping, preview/commit, invalid rows, source evidence and retry rules                                    |
| Reconciliation                   | Searchable checkbox lists, selection counts/limits, available amounts, account summary, exact signed totals and differences, one-pair partial mode, selection retained while searching | Existing API routes, independent decisions, period/date/direction checks, remaining-amount validation and undo |
| Exceptions/approvals             | Shared table/form treatment, clear review actions and destructive variants where applied                                                                                               | Actual exception investigations and independent financial decisions                                            |
| Reports/analytics/audit/settings | Shared filters, table focus/scroll hints, form feedback, actions and theme                                                                                                             | Existing report/export scope, analytics gates, audit events, categories, users, backup and configuration       |

The inventory describes shared presentation changes as well as direct component edits. It does not imply that every record-heavy page was replaced with a new component or that new financial functionality was added.

## Design-token and component guide

### Ownership and import order

`ui-tokens.css` owns shared palette, spacing, type scale, control heights, card radii and elevations. It loads before layout styles. `ui.css` owns shared action variants, field feedback, table access, record-picker presentation and cross-page refinements; it loads last. `auth.css`, `home.css` and `reference-dashboard.css` retain their page compositions and responsive rules. Other existing layout files remain for compatibility; this is a scoped consolidation, not a complete CSS rewrite.

Removed duplicate root theme declarations from legacy layers, the old base button rules, obsolete `.text-button` rules and expanding blue card overlays. Keep new shared changes in the owning file instead of appending overrides to unrelated page styles.

| Token family | Current baseline                                                                |
| ------------ | ------------------------------------------------------------------------------- |
| Brand        | Teal `#0f766e`, hover `#0b625c`, restrained turquoise gradient                  |
| Surfaces     | White, soft `#f4fafa`, accent tint `#e2f8f3`                                    |
| Copy         | Ink `#172b3a`, muted `#526477`, Plus Jakarta Sans                               |
| Type         | Body/input 15px, UI 14px, metadata 13px at default browser font size            |
| Spacing      | 4, 8, 12, 16, 24, 32px                                                          |
| Controls     | 46px standard, 36px compact; compact actions increase to 40px on narrow screens |
| Shape        | 8px fields, 16px cards, pill actions                                            |
| Destructive  | `#b42336` plus explicit action text; never colour alone                         |

### Actions

Use `button` for the dominant action, `button secondary` for alternatives, `button danger` for destructive decisions and append `small` for compact table/toolbar controls. Downloads may use an anchor with the same classes. Do not recreate `text-button`. Icon controls and navigation retain dedicated classes. Shared buttons have no text underlines, a visible keyboard outline and restrained hover movement. Reduced-motion/touch rules suppress hover translation.

### Forms and dialogs

Continue using the shared `Field`/`FormModal` system for operational dialogs. It now supplies required/optional labels, stable field IDs, helper/error association, native-constraint-derived inline errors, invalid-field focus, pending state and duplicate-submit protection. Add `help` and `placeholder` to field definitions when the field needs a format example or explanation.

The modal retains Tab/Escape/focus-restoration behaviour and makes the background inert. Dirty modal dismissal and itemised-invoice/page-unload navigation warn before losing edits. Search-result navigation respects a cancelled unsaved-change transition. These guards cover the implemented shared modal, itemised invoice and selected matching records; they are not a universal draft-persistence system for every inline field.

Keep file/date inputs native. Labels remain visible when placeholders disappear. API errors still appear at form level because the existing API does not expose a structured field-error contract.

### Reconciliation selection

`RecordPicker.tsx` owns searchable selectable records. `selectedSummary` uses BigInt and each record's remaining amount when present. Searching does not clear selected records. Full grouping permits up to 30 records per side; partial mode permits one per side. Mode changes clear selection deliberately. The form shows account, counts, signed totals and difference before submission. Client checks improve feedback; the unchanged server remains authoritative for all financial and concurrency decisions.

`useNavigationDrawer.ts` manages mobile focus and inertness. `useUnsavedChanges.ts` supplies cancellable workspace navigation and native unload warnings. These hooks contain no financial operations.

### Tables and state feedback

Existing financial tables retain required comparison columns and intentional horizontal scrolling. Their regions are keyboard-focusable with accessible scroll guidance; narrow screens also show a visible scroll hint. Secondary actions use compact variants. Preserve existing right-aligned money cells and tabular numbers. No inaccessible hover-only action menus were introduced.

Existing real empty, skeleton/loading, error and success states remain. Applied account/date/search/advanced filters are visible above the page content. No fake financial trend, notification, record or provider status was introduced.

## Validation

- Production build: `npm run build`.
- Regression suite: `npm test`, including the original financial/API, migration, backup, session and role-render cases.
- New focused UI regression: `tests/ui-system.test.js` checks exact selected remaining totals beyond JavaScript's safe integer range, signed fees, account grouping, accessible checkbox/selection-limit rendering, login labels/autocomplete/password toggle and cancellable navigation.
- Formatting: `npm run format:check`.
- Tests use isolated synthetic/in-memory/temporary data. No company database or external service is used for visual acceptance.

Final results: **45 tests passed**, production build passed, and formatting checks passed. The new test's initial case-sensitive autocomplete assertion was corrected to handle React's rendered attribute casing before the final successful run. Server rendering and protocol tests do not prove browser layout, touch behaviour or keyboard focus execution.

## Browser acceptance still required

| Check                             | Target                                                                                     | Status                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Default desktop login             | 1280×720, 1366×768, 1440×900, 1920×1080; no page/form scrollbar at normal zoom             | Unverified: browser host unavailable                                |
| Login error/help and registration | All controls reachable; long content may scroll naturally                                  | Unverified                                                          |
| Mobile/reflow                     | 360, 390, 768, 1024px; 320 CSS-pixel reflow and 200% zoom                                  | Unverified                                                          |
| Drawer                            | Open/close, Tab/Shift+Tab, Escape, resize, inert background, opener focus                  | Source implemented; browser interaction unverified                  |
| Modal                             | First field focus, invalid-field focus, trap, Escape, dirty cancellation, restoration      | Source implemented; browser interaction unverified                  |
| Financial selection               | Touch/keyboard checkbox search, clear, partial/group switch and independent review         | Exact totals/render regression covered; browser workflow unverified |
| Tables and exports                | Scroll hints/focus, long references, large amounts, all columns and existing export scope  | Financial/export regressions covered; visual review unverified      |
| Accessibility                     | Contrast in actual rendered states, screen reader, zoom, target spacing and reduced motion | No certification or full accessibility audit claimed                |
| Company acceptance                | Actual users complete the existing UAT scenarios                                           | Pending company review                                              |

Use a separate synthetic demo for these checks. Do not enter evaluation transactions in the real company workspace. The existing `UAT_CHECKLIST.md` remains the business acceptance checklist.
