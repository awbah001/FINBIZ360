# FinBiz 360 UI/UX improvement prompt

Use the implementation prompt below to improve the existing application. This is an enhancement brief, not a request to rebuild the system.

## Current card design scope

### Shared form pattern (latest form direction)

Adapt the supplied Uiverse.io pattern by mahbowal throughout business forms using `form-pattern.css` and the shared `finbiz-form` class. Use white-to-light-grey gradient surfaces, thick white edges, rounded corners, raised white inputs, teal focus edges, gradient submit buttons and gentle button feedback. Retain the existing teal brand, labels, validation, password visibility controls, checkbox/radio semantics and business layouts. Authentication and modal wrappers provide their form surface without nesting duplicate borders or shadows. Complex business forms keep their responsive widths rather than the sample's fixed 350px width. Honour reduced motion and retain visible keyboard focus.

### Full-system smooth white presentation (latest direction)

The supplied image is a reference for the complete visual language, not only KPI cards. Keep the existing page arrangement, sections, role workflows and teal brand while carrying an airy white canvas, softly coloured icon wells, restrained violet/coral/amber/blue accents, rounded record rows and gentle transitions across navigation, header tools, filters, forms, dialogs, activity, public features and all role dashboards. The sidebar remains teal; financial data stays readable. Replace the old wave-dominant workspace background with the requested quiet white surfaces.

`SystemIcon.tsx` owns the shared layered duotone icon treatment and semantic icon-to-colour mapping. Use it for sidebar destinations, module heroes, section headings, summaries, shortcuts and public feature icons. Icon plates and decorative underlays are hidden from assistive technology; visible labels retain their meaning. `reference-polish.css` owns the complete finishing layer and removes abrupt offset-button jumps in favour of softer feedback. Preserve keyboard focus, coarse-pointer targets and reduced-motion preferences. Keep the working calendar and existing range inputs.

### Card and calendar reference (3 November 2026)

Use the supplied file-dashboard image for card shape, softly raised depth, compact icon wells, coral/violet/gold accents and restrained animation. Preserve FinBiz 360's teal branding, sidebar, page arrangement, dashboard sections, business controls and role boundaries. Give existing KPI cards solid semantic-colour surfaces with readable values, while keeping operational forms, tables and charts on quiet white panels. Carry the rounded-card/icon treatment into the public site, authentication shell and all role workspaces.

`reference-polish.css` owns this additional presentation layer and is imported after the existing design styles. Preserve the stylesheet edits already present in the workspace. `WorkspaceCalendar.tsx` extends the current topbar date popover with Month/Week views, previous/next navigation and Today. Selecting a day applies the existing date filters only where authorised; administrators get a reference-only calendar. Keep manual range fields and All recorded dates. Honour reduced motion and visible keyboard focus. Do not introduce unrelated storage charts, fake tasks, avatars or financial data from the reference image.

### Workspace reference (latest visual direction)

Use the supplied Transactions reference to guide the actual application pages: a soft wave background, breadcrumb navigation, prominent module icon and title, grouped pill-shaped filters, rounded white register panels, quiet table headers and illustrated empty states. Apply the shared presentation to operational pages without replacing their controls or data. Retain existing module and semantic colours, the reference deep-teal sidebar with white labels and turquoise active navigation, filters, transaction operations, role permissions, export scope and backend integrations. Keep login styling separate. System workflow testing is paused at the user's request; a successful build does not imply browser or workflow verification.

### Sidebar page hero cards

Keep the dashboard welcome card. Every other sidebar destination has a rounded hero card with its existing title, description and authorised actions. Use a distinct module illustration and background composition on each page, retaining its assigned colour. `PageHero.tsx` and `page-hero.css` own this presentation. Illustrations are decorative, contain no financial data, and hide on narrow screens to leave room for content and actions. Keep a single breadcrumb above the hero. The production build passes; browser and system workflow verification remain paused.

### Card depth

Use the shared layered shadow tokens across application cards, page heroes, dashboard panels, public-site cards and authentication shells for a raised 3D appearance. Combine a subtle inset top highlight with contact and broad depth shadows. Use `--card-shadow` for standard cards, `--card-shadow-hover` for existing hover/focus elevation, and `--card-shadow-floating` for prominent floating cards and authentication shells. Preserve module colours and existing motion preferences; keep operational controls readable.

### Login background and fields

The login uses softly moving mint/blue background glows and floating decorative spheres, with an explicit pause/resume control and automatic reduced-motion support. Keep animation behind the form. Use raised white fields, tinted icon wells, clear focus/error borders, password visibility, Caps Lock feedback and focused authentication errors. Preserve password-manager autocomplete, native validation and duplicate-submit protection. Keep the mobile login in one column. The user explicitly requested that existing session behaviour remain unchanged; retain the eight-hour server session, cookie/CSRF controls and existing expiry/sign-out handling.

### Fixed component colours (latest direction)

Use a mixed palette with stable component identities. Teal remains the brand/sign-in accent. Use blue for net movement, accounts and transaction components; green for inflows, approved statuses and reconciliation; coral for outflows and supplier obligations; violet for invoices, analytics and transaction-count summaries; cyan for customers and statements; amber for approval/review actions; rose for exceptions; and slate for audit/settings. Apply these colours to summary surfaces, content icons, sidebar icons and relevant actions. Keep the deep-teal sidebar background, white labels and turquoise active row. Sidebar icons must retain their individual module hues in both normal and active states, using lighter variants for readability on the dark background. Keep operational forms/tables neutral. Card hover effects must keep each card's assigned hue. Preserve written status labels and icons so meaning never depends only on colour. This direction supersedes the earlier teal-only palette guidance below.

Apply the supplied SouravBandyopadhyay gradient, corner arrow and expanding hover effect selectively to standalone KPI/summary cards, report action cards and landing-page feature cards. Use stable neutral surfaces for forms, tables, charts, reconciliation, approvals, contact/account management, navigation and the user profile. Choose treatment by the component's purpose, not merely because its class contains ?card? or ?panel?. Preserve approved designs and explain material changes before implementing them.

## Current button design

Keep buttons compact: standard actions use a 40px minimum height with 14px labels and 8px by 16px padding; compact table/export actions use a 32px minimum height with 13px labels and 6px by 10–12px padding. Keep touch targets at least 44px on coarse-pointer devices and authentication submission at 44px. Preserve module colours, pill shapes, visible labels and all existing actions. Input heights are independent of button sizes.

Use the supplied Uiverse sekaiking action-button design: pill radius, outlined edge, solid offset shadow on hover, upward/left hover movement and downward/right pressed movement. Apply the teal gradient theme to primary actions and secondary hover states. Keep compact table actions appropriately sized, destructive actions clearly red, navigation/icon controls distinct and reduced-motion support. This supersedes earlier recommendations for subtle button hover movement.

## Review basis

Reviewed the current React components, shared form/modal implementation, navigation, dashboard, authentication layouts, tables, enhancement modules and CSS layers, together with the supplied login/dashboard screenshots and recent design feedback. This is a source review and screenshot assessment; current browser interaction, accessibility and pixel accuracy have not been verified.

### Findings to address

- Styling is distributed across `styles.css`, `design.css`, `dashboard.css`, `reference-dashboard.css`, `cards.css`, `auth.css`, `inputs.css` and `enhancements.css`. Repeated selectors, competing overrides and obsolete selectors make consistency difficult to maintain.
- The login page has accumulated fixed dimensions, height breakpoints, viewport sizing and an internally scrollable form area. Treat its proportions as one responsive composition instead of continuing isolated width/height patches.
- Newly added action buttons were recently moved onto the existing pill style. Preserve that consistency, but audit action hierarchy and table width: giving every secondary action equal visual weight can crowd financial records.
- Shared modal fields use `InputSurface`; some standalone operational forms use directly styled inputs. Placeholder coverage has improved, but guidance, error association and spacing still need a common standard.
- Global tables have a 700px minimum width. Horizontal scrolling can be appropriate for financial comparisons, but narrow screens need deliberate column priorities, discoverable scrolling and accessible record details.
- Group reconciliation currently uses native multi-select controls and Ctrl/Cmd selection instructions. This is difficult to discover and awkward on touch screens; improve selection without changing financial matching rules.
- The shared modal already has dialog semantics, a Tab trap, Escape handling and focus restoration. Extend and verify this existing work rather than replacing it blindly.
- Preserve the working dashboard, role-aware navigation, global search, filters, exports, evidence workflows, account balances and real empty states. Improve presentation without inventing financial data or unavailable capabilities.

---

## Copy-ready implementation prompt

Act as a senior product designer, accessibility-focused UI/UX engineer and React developer. Review and improve **the existing FinBiz 360 application** into a consistent, professional, responsive financial workspace. Implement the changes in the repository, validate them and provide a concise handover with evidence. Do not stop at a design proposal or deliver a static mockup.

### 1. Required boundaries

- Keep React/TypeScript/Vite, Node.js/Express and SQLite. Retain the existing architecture, authentication, API contracts, database records and migrations.
- Read applicable repository instructions, `BUILD_PROMPT.md`, `docs/ENHANCEMENT_REPORT.md`, `docs/ARCHITECTURE.md` and `docs/UAT_CHECKLIST.md`. Use the current code as the source of implemented functionality; do not implement outdated historical requirements blindly.
- This is a UI/UX enhancement. Preserve calculations, exact minor-unit money handling, approval independence, permissions, closed-period rules, immutable records, correction history, reconciliation semantics, retry protection and export scope.
- Preserve all existing user roles and accessible destinations. Do not hide a required workflow merely to simplify the screen.
- Use real API-backed data. Keep synthetic data confined to isolated testing/demo environments. Never seed or modify the company database for visual testing.
- Preserve Plus Jakarta Sans, the current turquoise/deep-teal palette, neutral surfaces, rounded cards, pill-shaped action buttons and compact sidebar profile. Use the supplied reference deep-teal sidebar gradient, white navigation labels and turquoise active state. Keep the profile compact and do not add a location card.
- Keep the landing-page entry labelled **Sign in**, linking to `/login`. Registration remains a separate company-setup workflow.
- Do not add fake notifications, percentages, activity, help links, provider connections, password-reset flows or other unsupported capabilities.

### 2. Establish a maintainable design system first

Audit the CSS import order and cascade before editing. Consolidate competing declarations into clear ownership without dropping working responsive rules. Remove obsolete rules only after checking their consumers. Avoid solving layout problems through a growing list of overrides or global `!important` rules.

Define shared tokens for typography, spacing, control heights, radii, borders, elevation, semantic colours, content widths, sidebar dimensions and responsive breakpoints. Use the existing palette as the starting point. Provide light, readable surfaces and reserve strong teal for emphasis.

Use a consistent type hierarchy: approximately 15–16px body copy, 14–15px labels/table content, 12–13px secondary metadata, 20–24px section headings and 28–32px page headings where space permits. Respect browser text sizing and zoom. Do not shrink financial data or labels to force a layout to fit. Use tabular numerals and consistent alignment for amounts.

Create or refine reusable components where repetition justifies them: action button variants, field/field error/help text, status badge, page header, filter toolbar, empty/loading/error states and record-detail presentation. Reuse existing `InputSurface`, `CardTitle` and modal behaviour where suitable. Avoid introducing a new UI framework merely for styling.

### 3. Fix login and registration as complete layouts

The login must feel medium-sized, balanced and professional. The latest feedback rejects a tiny card, a narrow form, excessive height and awkward decorative overlap.

- Use a centred two-panel card on desktop, with an explicit full-width parent grid and stable column sizing. Start around 1080–1160px maximum card width, with roughly 42–44% brand panel and 56–58% form panel; adjust from rendered evidence.
- Keep the form around 380–420px wide, with comfortable inputs, a clear heading, useful labels, a strong teal sign-in button and restrained secondary actions.
- Reduce repeated branding, excess vertical gaps and decorative clutter. Position brand text, illustration and footer so they never collide. Keep the left panel informative rather than visually dominant.
- At normal zoom on desktop/laptop viewports of 1366×768, 1440×900 and 1920×1080, the default login state must fit without page or form scrollbars. Include a 1280×720 check. Do not achieve this by clipping content, scaling the whole page or globally disabling document scrolling.
- Collapse the brand panel appropriately on mobile. Preserve input readability and keyboard access. When a mobile keyboard, extreme zoom or long error/help content reduces available space, allow necessary scrolling so every control remains reachable.
- Check default, validation error, incorrect-password, help-expanded and submitting states. Clearly distinguish signing in from registering a company.
- Keep registration consistent while allowing its longer multi-step content to scroll naturally. Never apply the login's no-scroll constraint globally.

### 4. Improve the workspace shell and navigation

- Use a consistent page header with title, concise description, breadcrumbs where useful and one clearly dominant task action.
- Keep sidebar groups understandable and ordered by daily work. Retain active-state emphasis, icons, role information and compact sign-out area.
- Keep navigation available on short displays without enlarging the profile card. Make any necessary sidebar scrolling intentional and unobtrusive.
- On mobile, provide an accessible drawer with an identifiable close action, focus management, Escape support and focus restoration. Prevent obscured background interaction while open.
- Keep global search, account/date controls, notifications and profile actions functional. Show active scope and record freshness accurately; do not imply live provider balances.
- Verify page changes and search-result navigation do not retain invisible filters that make results appear missing.

### 5. Unify buttons, forms and feedback

All action buttons, including new modules and link-based downloads, must use the shared pill design. No button text should be underlined in default, hover, active or focus states. Retain visible keyboard focus; ordinary inline hyperlinks can remain distinguishable from buttons.

Use primary, secondary, destructive and compact variants with clear hierarchy. Keep the requested rounded appearance and subtle shadow, but use restrained hover movement; respect reduced-motion preferences. Navigation, icon-only controls and field adornments should retain their appropriate layouts. Keep touch targets comfortable and avoid rows of equally prominent, oversized actions.

Every text field and textarea must have a persistent label and a useful placeholder. Prefer a relevant example or expected format over repeating a label. Put essential requirements in persistent helper text because placeholders disappear during entry. Never use placeholders as defaults, accessible names or substitutes for validation.

Use consistent input spacing, required/optional indicators, disabled/read-only presentation and error placement. Associate help/errors with fields, mark invalid fields appropriately and focus the first invalid field after submission. Keep entered values after validation/network failures. Preserve native email/date/number behaviour and existing precise money parsing. Do not add fake placeholders to file/date inputs where the browser does not support them.

Show meaningful pending/success/error states. Prevent duplicate submissions, retain request-key behaviour and avoid losing edits during background refresh. Warn before discarding substantial unsaved changes. Do not introduce repetitive confirmation dialogs for routine reversible actions; keep financial approval and destructive decisions explicit.

### 6. Improve dashboards and record-heavy pages

Preserve the reference dashboard's broad composition while improving alignment, whitespace, card proportions and hierarchy. Keep KPI definitions honest: opening balance, filtered movement and closing book balance are different concepts. Separate outstanding document obligations from cash movements. Use colour plus text/icons for status; never colour alone.

Charts must use actual data with clear date scope, currency/unit labels and accessible summaries. Provide honest zero/insufficient-history states. Preserve the forecast eligibility rules, training dates, error measure and limitations. No decorative fake sparklines or invented growth percentages.

For transactions, customers, suppliers, accounts, invoices, supplier bills, statements, exceptions, approvals, reports, audit history and settings:

- Adopt consistent card/table headers, filter bars, loading states, spacing, totals and pagination presentation.
- Make applied filters visible with a clear reset action; keep displayed totals and downloaded exports consistent with the stated scope.
- Align money columns to the right and use consistent date, SLE amount and status formatting. Keep references and long names readable without breaking the layout.
- Use clear row summaries and a deliberate detail view for evidence, allocations, history and secondary actions. On touch/keyboard, no essential action may depend on hover.
- Use an accessible action menu only when it improves density; do not hide the main task or change permissions. Verify focus, dismissal and labels if a menu is introduced.
- On narrow displays, prioritise essential fields and allow labelled horizontal scrolling or equivalent details. Do not remove comparison data required for reconciliation or approval.
- Distinguish no records, no search results, insufficient permission, loading and request failure. Offer only actions the current role can actually complete.

### 7. Make reconciliation and financial review easier to understand

Replace the Ctrl/Cmd-dependent group-selection experience with searchable, keyboard/touch-friendly selectable rows or checkboxes. Keep one-to-one, grouped and partial modes explicit. Show the selected account, entry counts, signed totals, proposed allocation, remaining amounts and any difference before submission.

Use plain explanations for exact suggestions, tolerance differences, duplicates, exceptions and partial remainders. Show why a proposal is eligible or blocked. Preserve explicit confirmation, independent review, locks, overmatching prevention, concurrency checks and undo history. Never automatically approve or adjust money to make a design appear complete.

In approvals and control requests, present the amount, source records, requester, reason, financial effect and decision history clearly. Keep write-offs distinct from receipts and corrections distinct from deletion. Never label written-off amounts as paid.

For statement imports, keep the sequence clear: select account/file, map columns, preview valid/invalid/duplicate rows, confirm and view the result. Retain validation reasons, original evidence and retry safety. Use actual server progress/state rather than fabricated progress indicators.

### 8. Accessibility and responsive acceptance

Work toward WCAG 2.2 AA for changed components and document actual checks instead of claiming certification. Verify contrast, accessible names, headings/landmarks, keyboard order, focus visibility, dialog focus behaviour and announced status/errors. Target at least 44px touch areas where practical; ensure compact controls meet minimum target-size requirements or suitable spacing.

Check 360px, 390px, 768px, 1024px, 1366px, 1440px and 1920px viewport widths, including short laptop heights. Test 200% zoom and reflow at 320 CSS pixels, with deliberate exceptions for essential two-dimensional financial tables. Avoid page-level horizontal overflow. Honour reduced motion. Tooltips must not be the only source of required information.

### 9. Implementation order and verification

1. Record a concise audit of current components and routes, separating source findings from browser-verified defects. Capture authorised before screenshots with an isolated synthetic dataset where browser access is available.
2. Establish tokens and shared components, then fix login sizing and common button/field behaviour first.
3. Apply the system to shell/dashboard, daily financial workflows, reconciliation/import/review, then reports/settings and public pages.
4. Verify populated, empty, loading, validation, error, long-content and permission-restricted states as applicable. Exercise long names/references, large balances, inactive records, pending approvals and partial allocations.
5. Run the existing test suite, production build and formatting checks. Add focused interaction/regression coverage only where it protects meaningful changed behaviour. Update tests when component structure changes while preserving the original business assertions.
6. Manually verify login/no-scroll targets, mobile navigation, modal keyboard handling, form errors, filters, row actions, exports and role boundaries. Use real browser screenshots to assess layout; a passing build or server-render test is not visual verification.
7. If browser access or external acceptance is unavailable, state exactly what remains unverified. Do not invent screenshots, claim pixel accuracy or mark human acceptance complete.

### 10. Completion criteria and handover

The result should feel like one product: balanced login, consistent typography/spacing, restrained teal emphasis, readable tables, discoverable actions, clear financial states and responsive workflows. New buttons and forms must inherit the system without individual styling patches. Existing workflows and financial results must remain intact.

Deliver the implemented source changes, a short design-token/component guide, changed-screen inventory, validation results and before/after screenshots where actually captured. Explain any remaining browser, accessibility or company-acceptance limitations. Do not publish, deploy or alter company financial data as part of this UI/UX task.
