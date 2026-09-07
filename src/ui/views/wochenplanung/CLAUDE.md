# views/wochenplanung

`TagEditor.tsx` (not `SchichtEditor` - renamed and scope-expanded) is the single modal for editing
one employee's one day: it covers Frei / Arbeitszeit(Schicht) / Urlaub / Krankheit / Sonstige in
one component, because users need to set absences directly from the weekly grid, not only from
the separate Abwesenheiten tab.

`TagEditor` live-validates the in-progress draft shifts (via `validiereSchichtdauer`,
`validierePausen`, `validiereTagesarbeitszeit` directly from `domain/`, not the parent's stale
`validierungsErgebnisse`) and shows a `BestaetigungsDialog` requiring explicit confirmation before
saving if that produces any `schweregrad: 'fehler'` result - matches the plan's "fehler requires
explicit confirmation on save" rule. Needs `mitarbeiterId` (not just `mitarbeiterName`) as a prop
for the validation kontext.

## Gotchas

- Clicking an empty ("Frei") cell defaults straight into Arbeitszeit mode with one pre-filled
  default shift already added (06:00-14:00). This is deliberate (saves a click for the common
  case), NOT a bug. Clicking Abbrechen persists nothing, so the day stays Frei.
- A cell showing a multi-day Abwesenheit (`von != bis`) opens a read-only info dialog instead of
  the editable form - editing multi-day ranges is only supported from the Abwesenheiten tab
  (splitting a date range from the single-day grid editor was judged too complex/risky to build).
- `useWochenplanValidierung.ts` runs domain ArbZG validation reactively; it calls
  `wochenplanOhneAbwesendeTage` first specifically so validation never fires against stale Schicht
  data left behind on a day that's now marked as an Abwesenheit.
- `WochenplanTabelle.tsx` shows Mitarbeiter as ROWS and weekdays as COLUMNS (unlike the printed
  paper form, which has Mitarbeiter as columns) - a deliberate ergonomic choice for on-screen
  editing at normal laptop widths. The print views in `../export/print/` independently re-lay-out
  the same data with Mitarbeiter as columns to match the paper original. Never assume the two
  layouts should share table markup.
- `WochenplanView.tsx`'s `wochenAnsicht` useMemo sorts rows by Nachname A-Z (`vergleicheNachname`
  from `domain/mitarbeiter/Mitarbeiter.ts`, the single source of truth for employee ordering - also
  used by `mitarbeiterService.fuerFiliale` and `druckDatenAufbereitung.ts`). It filters out any
  einsatz whose `mitarbeiterId` no longer resolves to a known Mitarbeiter BEFORE sorting, not after:
  `plan.mitarbeiterEinsaetze` can contain orphaned entries from a hard-deleted employee (from before
  "deactivate instead of delete" existed), and a comparator that falls back to "treat as equal" for
  unresolvable entries will scramble the real rows around those orphans if they're still in the
  array during the sort. `WochenplanTabelle` also skips unresolvable entries at render time, but
  that's not a substitute for filtering before sorting here.

## Copy/Paste/Frei (Rechtsklick)

`WochenplanTabelle.tsx` does NOT have an `onContextMenu` handler on its cells - it only stamps each
cell with `data-mitarbeiterid`/`data-tag` attributes. The context menu is driven entirely by a
single **document-level** `contextmenu` listener in `WochenplanView.tsx`, using
`document.elementsFromPoint(x, y)` (not `e.target`) to find the cell. This is deliberate, not
incidental complexity: MUI's `Menu` renders a full-viewport backdrop while open, which is the
topmost element at any point on screen and would swallow a per-cell `onContextMenu` handler,
so right-clicking a SECOND cell while the menu is already open would fall back to the browser's
native menu instead of reopening the custom one (a real reported bug). `elementsFromPoint` returns
the whole element stack at that point, not just the topmost, so the actual cell underneath the
backdrop can still be found via `.closest('[data-mitarbeiterid]')`. Right-clicking the open menu
itself is special-cased (checks `[role="menu"]` in the stack) to just block the native menu without
touching state, rather than closing/reopening. If you ever refactor this menu, keep it centralized
here - reintroducing a per-cell handler reintroduces the bug.

Clipboard state and the `kopieren`/`einfuegen`/`aufFreiSetzen` handlers live in `WochenplanView.tsx`.
Paste works between ANY two cells (any employee, any day), not just within one employee's row - a
deliberate choice (e.g. to duplicate one employee's shift onto a colleague). Pasting regenerates
`id`s for the copied Schicht/Pause objects (`crypto.randomUUID()`) so they never collide with the
source's ids. Both pasting and the "Frei" menu item (quick-resets a cell back to Frei) route through
the shared `setzeEintragInZelle` helper, which deletes a single-day Abwesenheit on that cell first
(same rule as `TagEditor.speichern()`) before writing the new Tageseintrag; both are disabled (menu
item greyed) for cells covered by a multi-day Abwesenheit, consistent with the read-only multi-day
behavior above. "Frei" is additionally disabled when the cell is already plain Frei with no
Abwesenheit (`istBereitsFrei`).

## Soll vs. Ist (Punkt 3) and Vorwoche-Stundenübertrag (Punkt 6)

`WochenplanTabelle.tsx`'s "Soll" column and the warning tooltip on "Gesamt" both use
`effektiveSollMinuten` from `application/wochenplan/wochenplanAuswertung.ts` - contract
Soll-Stunden (`sollWochenstunden`) plus `MitarbeiterWochenAnsicht.sollAnpassungMinuten` (0 unless a
transfer was applied). No tolerance threshold: any nonzero difference shows the warning icon, as
explicitly requested.

`sollAnpassungMinuten` (on `MitarbeiterWocheneinsatz`, set via `domain/wochenplan/Wochenplan.ts`'s
`mitSollAnpassung`) is the carry-over from exactly the ONE previous week's Ist/Soll difference, not
a running multi-week ledger - re-transferring is a fresh action each time, it does not chain.
Sign convention: **positive = this week needs MORE Soll** (was behind last week), **negative =
LESS** (was ahead). `VorwocheUebertragenDialog.tsx` computes the suggestion as
`vorherigeSoll - vorherigeIst` - do not flip this sign, it was worked out carefully (see the plan
file's worked example) and getting it backwards silently makes the feature do the opposite of what
a store manager expects. Re-opening the dialog prefers an already-stored current-week
`sollAnpassungMinuten` over recomputing a fresh suggestion, so a manually edited value survives
being looked at again (the freshly computed suggestion is still shown as read-only context in the
"Vorschlag" column).

## Wochenauswahl-Schnellauswahl (Punkt 5)

`WochenauswahlDialog.tsx` deliberately does NOT run the ArbZG rest-period/Fehler check per week
(that needs the async cross-week `ruhezeitPruefung` service, too expensive to run for a whole
month of weeks at once) - it only shows each week's total Ist-Stunden via `erstelleWochenAnsicht`.
Fehler stay visible only after actually opening a week, same as before this dialog existed.
