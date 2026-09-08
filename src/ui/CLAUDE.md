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

## Gotchas

- Print stylesheets need `!important` to reliably hide the `.print-action-bar` action bar
  during printing: MUI/Emotion injects its own `display:flex` styles at runtime, often AFTER the
  imported print CSS, so a plain `display:none` gets silently overridden. Don't remove the
  `!important` in `views/print/printView.css`.
- MUI `Collapse`-based expandable panels push layout below them when opened.
  `ValidationNotices.tsx` deliberately renders its expanded panel as a `position: absolute`
  overlay (not `Collapse`) specifically so opening it never shifts the Wochenplan table underneath
  - a UX requirement from the user. Don't revert to `Collapse` there.
- `public/favicon.svg` matches the app's own StoreOutlined-style icon/brand color; keep them in
  sync if the icon or theme color changes.
