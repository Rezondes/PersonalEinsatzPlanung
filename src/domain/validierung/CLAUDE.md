# domain/validierung/

German labor-law (ArbZG) compliance checks for shift schedules.

## Critical gotcha
§4 ArbZG break thresholds (30min if >6h, 45min if >9h) are evaluated against **net** working time
(`schichtNettoMinuten`, i.e. after subtracting breaks), **never** gross/scheduled span - because
ArbZG §2(1) defines "Arbeitszeit" as excluding Ruhepausen. Getting this wrong was a bug caught during
implementation. Only break blocks >= 15 minutes (`minPausenblockMinuten`) count toward the legal
minimum; shorter blocks produce a warning, not a count.

`validierePausen(schichten, kontext)` takes ALL of one day's shifts (not one `Schicht`) and sums
net time / break minutes across them before checking the threshold - §4 applies to the day's total
working time, so two 4h split-shift blocks (8h combined) still need a break even though neither
block alone crosses 6h. `useWochenplanValidierung.ts` calls it once per day, outside the per-shift
loop. Do not go back to calling it per-shift.

## Rest-period validation (§5 ArbZG, 11h)
Operates on `DatierteSchicht` records (real `Date` objects, already resolved to a calendar date)
specifically because rest periods can cross week boundaries. The week-crossing aggregation
(loading prev/current/next week and stitching shifts together) lives in
`application/wochenplan/ruhezeitPruefungService.ts`, not here - this module only sorts and diffs an
already-assembled chronological list.

## Known limitations (documented, not bugs to fix reflexively)
- Same-day split-shifts are validated independently for rest-period purposes (stricter than strictly
  necessary) - deliberate simplification.
- §3 ArbZG max daily/weekly hours: only per-day/per-week warnings, no 6-month averaging account
  (out of scope, too complex).

Rest-period validation across week boundaries DOES account for Abwesenheiten as of the "deactivate
not delete" fix round: `ruhezeitPruefungService.pruefeFuerMitarbeiter` takes an `abwesenheiten`
parameter and runs `wochenplanOhneAbwesendeTage` on each loaded neighboring week before extracting
shifts, so a stale shift next to a since-added vacation/sick day is no longer counted.

## Shift-duration sanity check
`schichtdauerValidierung.ts` is not an ArbZG paragraph - it catches a shift where Ende is at or
before Beginn without "Ende liegt am Folgetag" set, which would otherwise compute a zero/negative
`schichtBruttoMinuten` and silently bypass every other validation (negative numbers never exceed a
">" threshold). Runs alongside `validierePausen` in `useWochenplanValidierung.ts`.

## Sonntags-/Feiertagsarbeit
Configurable warning, not a hard rule, because Ladenöffnungsrecht (Sunday-trading law) is
state-specific in Germany. Holidays are computed in `infrastructure/feiertage/feiertageDeutschland.ts`
(Meeus/Jones/Butcher Easter algorithm) and injected as an `istFeiertag` function - this layer has no
Bundesland knowledge of its own.

## Schweregrad
`"fehler"` = clear legal violation (UI red). `"warnung"` = borderline/config-dependent (UI yellow).
The app never hard-blocks saving - the Marktleiter stays responsible; violations are surfaced, not
prevented.
