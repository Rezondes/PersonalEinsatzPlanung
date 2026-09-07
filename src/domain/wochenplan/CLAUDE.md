# domain/wochenplan/

Wochenplan is keyed by `(filialeId, Kalenderwoche)` - one aggregate per branch per ISO week.

- References `Mitarbeiter` only by ID. Name/position are **not** snapshotted - always loaded live
  from the current Mitarbeiter record at display/export time (DRY, avoids stale duplicated data).
- Abwesenheiten (vacation/sick days) are a **separate** aggregate, never stored inside Wochenplan.
  They're overlaid at read time in `application/wochenplan/wochenplanAuswertung.ts`
  (`erstelleWochenAnsicht`) to avoid sync problems between two aggregates that could otherwise drift
  apart. On a day covered by an Abwesenheit, any leftover Schicht data in the aggregate is
  intentionally **not deleted** (so restoring/removing the Abwesenheit brings the old shift back) but
  is excluded from all hour totals via `effektiveNettoMinuten` in `wochenplanAuswertung.ts` - a bug
  fixed during implementation where vacation days were incorrectly still counting scheduled hours.
- `wochenplanBerechnung.ts` is the single source of truth for all hour math (gross/net minutes,
  decimal-hour formatting). Both the interactive UI table and the print export call into it - never
  duplicate the math elsewhere.
- `wochenplanService.getOderErstelle` self-heals: employees added to the branch **after** a week's
  plan already existed are automatically appended with an empty Tageseintrag the next time that week
  is loaded - otherwise newly hired staff would silently be missing from already-created weekly
  plans. This was a bug found and fixed during implementation.
