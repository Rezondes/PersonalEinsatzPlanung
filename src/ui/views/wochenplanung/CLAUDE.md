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
