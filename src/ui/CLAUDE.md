# src/ui

React/MUI presentation layer. The only layer allowed to depend on everything else (domain, application, infrastructure).

## UI framework

Material UI (MUI) v6 was deliberately chosen over Tailwind/shadcn: primary users are Netto store
managers who are not necessarily tech-savvy and need instantly recognizable, familiar controls
over a bespoke minimalist look. This was an explicit user decision - do not "improve" it toward a
different design system.

`app/theme.ts` deliberately flattens MUI's default elevation/shadows and uses a muted palette
(`#2f5d50` primary) for a calmer look, while keeping MUI's default interaction patterns intact.

## State

- Zustand (`app/store/*`) is only for small global UI state (selected Branch, selected
  CalendarWeek) - never for domain data.
- Domain data lives in IndexedDB and is fetched into local component state via the `hooks/use*.ts`
  hooks, which call `@infrastructure/services` directly. Never import `@application/*` or
  repositories directly from `ui/` - always go through the composed `services` object.

## Routing

`app/router.tsx` uses react-router-dom. `/print/:scheduleId` is intentionally OUTSIDE the
`AppShell` layout (no nav chrome) since it's a print-only view.

## German number/date formatting (mandatory, no exceptions)

- Every user-facing decimal number input MUST use `ui/components/DecimalTextField.tsx`, never a
  plain `TextField type="number"`. A native `type="number"` input enforces the browser's
  locale-invariant period decimal separator regardless of page locale - setting/typing a
  comma-formatted value like "-0,5" into one simply fails (shows blank), which was a real reported
  bug. `DecimalTextField` takes/returns a plain `number | undefined` and manages the comma-typing
  UX (including a lone "-" or trailing "," while mid-typing) internally.
- Every place a number is rendered as read-only text MUST call `.toLocaleString('de-DE')` - never
  interpolate a raw `number` into JSX/template strings directly (`{employee.weeklyHours}` renders via
  JS's default period-based `toString()`, e.g. "37.5" instead of "37,5"). This bit multiple views
  (Mitarbeiter table, Abwesenheiten Resturlaub, Monatsübersicht) before being swept and fixed.
- Every displayed date MUST use `formatDateGerman(date: Date)` or `formatISODateGerman(isoString)`
  from `domain/shared/DateFormat.ts` - never `Date.toLocaleDateString('de-DE')` (doesn't zero-pad,
  e.g. "7.9.2026" instead of "07.09.2026") and never render an ISO date string directly. The one
  exception is native `<input type="date">` pickers, whose display format is controlled by the
  browser/OS, not the app - only the stored VALUE matters there and it must stay ISO
  ("YYYY-MM-DD"). The print export's short "DD.MM." format (no year, `formatDateShort` in
  `views/print/`) is a deliberate different, narrower format matching the paper form and is
  not part of this rule.

## Forms and dialogs (required fields, validation)

Primary users are not tech-savvy, so a dialog must never look like "nothing happened" after
Speichern. Every data-entry dialog follows the same pattern (see `EmployeeDialog.tsx`,
`BranchDialog.tsx`, `AbsenceDialog.tsx`, `DayEditor.tsx`):

- Required fields get MUI's `required` prop (asterisk in the label); `components/RequiredLegend.tsx`
  ("* Pflichtfeld") is rendered once as the first child of `DialogContent`. Optional fields say
  "(optional)" in their label. A field is either one or the other, never unmarked.
- The rules live in the domain layer next to the aggregate (`validateEmployee`, `validateBranch`,
  `validateAbsence`, `validateShiftDrafts`) and return `FieldError[]`; the dialog only glues them
  to inputs via `hooks/useFormValidation.ts`: `fieldProps(field)` spreads `error`/`helperText`
  onto the field, `submit()` shows all errors, focuses the first invalid field and returns false.
  Never write an inline guard like `if (!form.name) return;` - a silent return is exactly the bug
  this pattern replaced.
- Speichern stays enabled; it is never disabled because of missing input (a greyed-out button
  gives no hint what is wrong). `components/FormErrorNotice.tsx` sits next to the buttons and
  announces a failed attempt. Disable Speichern only while a save is in flight.
- Errors appear only after the first Speichern attempt, then update live as the user types.
  Dialogs are therefore mounted only while open (`{dialog && <XDialog … />}`), so the flag and
  the form state reset by themselves; `DayEditor` stays mounted and calls `reset()` on open.
- Legacy records that violate newer rules (e.g. an employee without Tätigkeit) still open
  without errors; they are only flagged when the user presses Speichern.
- ArbZG results are a different thing: they never block, they only ask for confirmation
  (`DayEditor`'s ConfirmDialog). Empty/invalid fields do block.

## Gotchas

- Print stylesheets need `!important` to reliably hide the `.print-action-bar` action bar
  during printing: MUI/Emotion injects its own `display:flex` styles at runtime, often AFTER the
  imported print CSS, so a plain `display:none` gets silently overridden. Don't remove the
  `!important` in `views/print/printView.css`.
- MUI `Collapse`-based expandable panels push layout below them when opened.
  `ValidationNotices.tsx` deliberately renders its expanded panel as a `position: absolute`
  overlay (not `Collapse`) specifically so opening it never shifts the Wochenplan table underneath
  - a UX requirement from the user. Don't revert to `Collapse` there.
- `AppShell.tsx`'s header icon renders `public/favicon.svg` directly (`<img src={...}>`), the same
  file as the browser-tab favicon - not a separate MUI icon kept visually in sync by hand, so the
  two can never drift apart.
- **Never hardcode a root-relative path (`/favicon.svg`, `/whatever.png`) to reference a file in
  `public/` from application code.** This app is deployed to GitHub Pages as a project site under
  `/PersonalEinsatzPlanung/`, not the domain root (see `vite.config.ts`'s conditional `base`). Vite
  automatically rewrites asset URLs it processes through its own pipeline - `index.html`'s own
  `<link rel="icon">`, imported modules - to include that prefix, but a raw string literal in a
  `.tsx` file is just a string to Vite; it has no idea it's meant to be an asset path, so it's
  never rewritten and 404s once deployed (this exact bug shipped once: `AppShell.tsx`'s header logo
  broke on GitHub Pages while the identical browser-tab favicon worked fine, because only the tab
  icon went through `index.html`). Always build the path from
  `` `${import.meta.env.BASE_URL}favicon.svg` `` instead - Vite substitutes `BASE_URL` with the
  configured `base` at build time (`/PersonalEinsatzPlanung/` in the GitHub Pages build, `/`
  locally), so the same code works in both. Verify any future `public/`-asset reference by running
  `GITHUB_ACTIONS=true npm run build` and grepping `dist/assets/*.js` for the filename - it must
  show the `/PersonalEinsatzPlanung/` prefix, matching `dist/index.html`'s own reference.
