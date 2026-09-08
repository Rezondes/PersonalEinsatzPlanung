# views/print

The print views (`FullPartTimeForm.tsx`, `MinijobForm.tsx`) intentionally
always render exactly 9 employee-column-pairs (`COLUMNS_PER_SHEET = 9`), padding with empty
placeholder columns when fewer than 9 employees are on a page - because the real paper form has 9
fixed pre-printed columns, and column width must stay identical whether 3 or 9 are filled. Never
make the colgroup width computation depend on `rows.length`.

Each weekday renders as 4 physical table rows:
1. A standalone date|Ist-Std summary row with NO employee data (just the day's aggregate hours
   across the whole team).
2. The weekday-name row carrying the actual per-employee time/hours shift data.
3.-4. Two break rows (always exactly 2, regardless of how many breaks were actually entered - extra
   breaks beyond 2 get summed into the second row).

This exact 4-row shape was specified precisely by the user after comparing against the real paper
form photos - don't collapse or reorder these rows.

`printDataPreparation.ts` (in `application/`, not here) is the ONLY place that shapes print
data - these components must stay pure presentation, never compute hours/breaks themselves (reuse
`PrintDayCell`/`PrintBreakCell` as given).

`.print-header` is a 3-part flex row (left: plannedWeeklyRevenue/plannedWeeklyHours meta, stacked and
left-aligned; center: title, flex-grow + centered; right: branch logo or an empty placeholder div
of the same width so the title stays visually centered even with no logo) - keep the placeholder
divs when editing, removing them re-breaks title centering.

`EMPLOYEES_PER_SHEET` pagination (chunks of 9) lives in `PrintPreviewView.tsx`; the two
form components independently pad up to 9 again internally - both numbers must stay in sync
at 9.

## Welche Stunden auf dem Papier stehen

The printed figures are **worked** hours throughout - the day cells, the per-weekday `dayTotals`
row and the per-employee total. Hours credited without presence in the store (a vacation day worth
`Employee.holidayVacationHours`, a "Sonstige" entry with `hoursPerDay`) are deliberately left out,
for two reasons: this sheet is a duty roster of clock times, so a paid-but-absent figure in a time
column would claim presence that did not happen; and the sheet has to add up in both directions,
seven day cells to the row total and the columns to the Summe row. The row label therefore says
"Gesamtstunden (gearbeitet)". The employee's full Ist-Wochenstunden including credited hours are an
on-screen figure (weekly grid and Monatsübersicht), see `application/CLAUDE.md`.

`preparePrintData` applies the same visibility rule as the on-screen grid (`hasAnyEntry` in
`application/schedule/scheduleAssessment.ts`): an employee who may no longer be scheduled is only
printed while they still carry entries for that week. Otherwise every deactivated employee would
occupy one of the nine columns per sheet with an empty column and push real staff onto a second
sheet. Covered by `application/export/printDataPreparation.test.ts`.
