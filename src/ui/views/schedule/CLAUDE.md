# views/schedule

`DayEditor.tsx` (not `ShiftEditor` - renamed and scope-expanded) is the single modal for editing
one employee's one day: it covers Off / Arbeitszeit(Shift) / Vacation / Illness / Other in
one component, because users need to set absences directly from the weekly grid, not only from
the separate Abwesenheiten tab.

`DayEditor` live-validates the in-progress draft shifts (via `validateShiftDuration`,
`validateBreaks`, `validateDailyWorkingTime` directly from `domain/`, not the parent's stale
`validationResults`) and shows a `ConfirmDialog` requiring explicit confirmation before
saving if that produces any `severity: 'error'` result - matches the plan's "error requires
explicit confirmation on save" rule. Needs `employeeId` (not just `employeeName`) as a prop
for the validation context.

Its state is `ShiftDraft[]` (`domain/schedule/shiftDraft.ts`), not `Shift[]`: time inputs are kept
as the raw strings the user typed, so a cleared Beginn stays visibly empty and is flagged by
`validateShiftDrafts` on Speichern (via `hooks/useFormValidation.ts`, see the "Forms and dialogs"
section in `src/ui/CLAUDE.md`) instead of being silently discarded. Only complete drafts are
parsed (`shiftDraftsToShifts`) for the ArbZG live check. Order in `save()`: field validation
blocks first, then the ArbZG ConfirmDialog only asks. "Sonstige" requires a Bezeichnung; there is
no "Sonstige Abwesenheit" fallback text anywhere anymore (`createAbsence` rejects an empty label).

## Gotchas

- Clicking an empty ("Off") cell defaults straight into Arbeitszeit mode with one pre-filled
  default shift already added (06:00-14:00). This is deliberate (saves a click for the common
  case), NOT a bug. Clicking Abbrechen persists nothing, so the day stays Off.
- A cell showing a multi-day Absence (`from != to`) opens a read-only info dialog instead of
  the editable form - editing multi-day ranges is only supported from the Abwesenheiten tab
  (splitting a date range from the single-day grid editor was judged too complex/risky to build).
- `useScheduleValidation.ts` runs domain ArbZG validation reactively; it calls
  `scheduleWithoutAbsentDays` first specifically so validation never fires against stale Shift
  data left behind on a day that's now marked as an Absence.
- `ScheduleTable.tsx` shows Mitarbeiter as ROWS and weekdays as COLUMNS (unlike the printed
  paper form, which has Mitarbeiter as columns) - a deliberate ergonomic choice for on-screen
  editing at normal laptop widths. The print views in `../print/` independently re-lay-out
  the same data with Mitarbeiter as columns to match the paper original. Never assume the two
  layouts should share table markup.
- `ScheduleView.tsx`'s `weekView` useMemo sorts rows by Nachname A-Z (`compareByLastName`
  from `domain/employee/Employee.ts`, the single source of truth for employee ordering - also
  used by `employeeService.forBranch` and `printDataPreparation.ts`). It filters out any
  assignment whose `employeeId` no longer resolves to a known Employee BEFORE sorting, not after:
  `schedule.employeeAssignments` can contain orphaned entries from a hard-deleted employee (from before
  "deactivate instead of delete" existed), and a comparator that falls back to "treat as equal" for
  unresolvable entries will scramble the real rows around those orphans if they're still in the
  array during the sort. `ScheduleTable` also skips unresolvable entries at render time, but
  that's not a substitute for filtering before sorting here.

## Copy/Paste/Frei (Rechtsklick)

`ScheduleTable.tsx` does NOT have an `onContextMenu` handler on its cells - it only stamps each
cell with `data-employeeid`/`data-day` attributes. The context menu is driven entirely by a
single **document-level** `contextmenu` listener in `ScheduleView.tsx`, using
`document.elementsFromPoint(x, y)` (not `e.target`) to find the cell. This is deliberate, not
incidental complexity: MUI's `Menu` renders a full-viewport backdrop while open, which is the
topmost element at any point on screen and would swallow a per-cell `onContextMenu` handler,
so right-clicking a SECOND cell while the menu is already open would fall back to the browser's
native menu instead of reopening the custom one (a real reported bug). `elementsFromPoint` returns
the whole element stack at that point, not just the topmost, so the actual cell underneath the
backdrop can still be found via `.closest('[data-employeeid]')`. Right-clicking the open menu
itself is special-cased (checks `[role="menu"]` in the stack) to just block the native menu without
touching state, rather than closing/reopening. If you ever refactor this menu, keep it centralized
here - reintroducing a per-cell handler reintroduces the bug.

Clipboard state and the `copy`/`paste`/`setToOff` handlers live in `ScheduleView.tsx`.
Paste works between ANY two cells (any employee, any day), not just within one employee's row - a
deliberate choice (e.g. to duplicate one employee's shift onto a colleague). Pasting regenerates
`id`s for the copied Shift/Break objects (`crypto.randomUUID()`) so they never collide with the
source's ids. Both pasting and the "Frei" menu item (quick-resets a cell back to Off) route through
the shared `setEntryInCell` helper, which deletes a single-day Absence on that cell first
(same rule as `DayEditor.save()`) before writing the new DayEntry; both are disabled (menu
item greyed) for cells covered by a multi-day Absence, consistent with the read-only multi-day
behavior above. "Frei" is additionally disabled when the cell is already plain Off with no
Absence (`isAlreadyOff`).

## Soll vs. Ist (Punkt 3) and Vorwoche-Stundenübertrag (Punkt 6)

`ScheduleTable.tsx`'s "Soll" column and the warning tooltip on "Gesamt" both use
`effectiveTargetMinutes` from `application/schedule/scheduleAssessment.ts` - contract
target hours (`targetWeeklyHours`) plus `EmployeeWeekView.targetAdjustmentMinutes` (0 unless a
transfer was applied). No tolerance threshold: any nonzero difference shows the warning icon, as
explicitly requested.

`targetAdjustmentMinutes` (on `EmployeeWeekAssignment`, set via `domain/schedule/WeeklySchedule.ts`'s
`withTargetAdjustment`) is the carry-over from exactly the ONE previous week's Ist/Soll difference, not
a running multi-week ledger - re-transferring is a fresh action each time, it does not chain.
Sign convention: **positive = this week needs MORE Soll** (was behind last week), **negative =
LESS** (was ahead). `CarryOverPreviousWeekDialog.tsx` computes the suggestion as
`previousTargetMinutes - previousActualMinutes` - do not flip this sign, it was worked out carefully (see the plan
file's worked example) and getting it backwards silently makes the feature do the opposite of what
a store manager expects. Re-opening the dialog prefers an already-stored current-week
`targetAdjustmentMinutes` over recomputing a fresh suggestion, so a manually edited value survives
being looked at again (the freshly computed suggestion is still shown as read-only context in the
"Vorschlag" column).

## Wochenauswahl-Schnellauswahl (Punkt 5)

`WeekSelectionDialog.tsx` deliberately does NOT run the ArbZG rest-period/error check per week
(that needs the async cross-week `restPeriodCheck` service, too expensive to run for a whole
month of weeks at once) - it only shows each week's total Ist-Stunden via `createWeekView`.
Errors stay visible only after actually opening a week, same as before this dialog existed.
