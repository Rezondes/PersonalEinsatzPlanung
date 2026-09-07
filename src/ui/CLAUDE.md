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

- Zustand (`app/store/*`) is only for small global UI state (selected Filiale, selected
  Kalenderwoche) - never for domain data.
- Domain data lives in IndexedDB and is fetched into local component state via the `hooks/use*.ts`
  hooks, which call `@infrastructure/services` directly. Never import `@application/*` or
  repositories directly from `ui/` - always go through the composed `services` object.

## Routing

`app/router.tsx` uses react-router-dom. `/druck/:wochenplanId` is intentionally OUTSIDE the
`AppShell` layout (no nav chrome) since it's a print-only view.

## Gotchas

- Print stylesheets need `!important` to reliably hide the `.druck-aktionsleiste` action bar
  during printing: MUI/Emotion injects its own `display:flex` styles at runtime, often AFTER the
  imported print CSS, so a plain `display:none` gets silently overridden. Don't remove the
  `!important` in `views/export/print/druckansicht.css`.
- MUI `Collapse`-based expandable panels push layout below them when opened.
  `ValidierungsHinweise.tsx` deliberately renders its expanded panel as a `position: absolute`
  overlay (not `Collapse`) specifically so opening it never shifts the Wochenplan table underneath
  - a UX requirement from the user. Don't revert to `Collapse` there.
- `public/favicon.svg` matches the app's own StoreOutlined-style icon/brand color; keep them in
  sync if the icon or theme color changes.
