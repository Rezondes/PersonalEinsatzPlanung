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

## Sichtbarkeit und Sperren (inaktive Mitarbeiter, Ein-/Austritt)

`scheduleRows.ts` turns the week view into the rows the table renders, and it is the single place
that decides who is shown and what may be edited:

- An employee who may be scheduled this week (`active` **and** their employment period overlaps it)
  is always shown and editable.
- One who may not is shown **only while they still carry entries for that week**, and then the whole
  row is read-only, greyed, with an "Inaktiv"/"Nicht beschäftigt" chip. Hiding them outright would
  make already recorded hours look lost; leaving them editable would let the user keep planning
  someone who has left.
- Individual days outside `entryDate`/`exitDate` are locked inside an otherwise editable row
  (`lockedDays`), so someone starting on Wednesday cannot be given a Monday shift.

A locked cell is deliberately not a button at all: no `onClick`, no `tabIndex`, no `role="button"`,
and `ScheduleView`'s context-menu handler checks the same `isCellLocked` predicate before opening.
`scheduleService` applies the same rule when creating/expanding a schedule, so nobody outside their
employment period is silently appended in the first place.

## Undo/Redo (`useScheduleHistory.ts`)

The hook owns both the undo stacks and the **write queue** every mutation goes through. The queue is
not optional decoration: this view autosaves on every change with no save button, and the handlers
used to read the schedule from their render closure, so two quick edits could both start from the
same pre-edit aggregate and lose the first write. Every mutation now runs serialized and reads
`scheduleRef.current` at execution time.

Absences are recorded as **operations** (`created`/`deleted`), not as a snapshot of the absence
list. That is deliberate: `useAbsences` loads every absence of the whole branch, for every week and
year, so diffing two snapshots would let an undo in the Wochenplanung delete an unrelated absence
that was edited in the Abwesenheiten tab meanwhile. Restoring goes through
`absenceService.restore`, which writes the record back verbatim - re-creating it would mint a new
id and the next undo/redo step would target something that no longer exists.

Further rules that are load-bearing:

- A step is keyed to `branchId|year|week`; the stacks are cleared when that key changes and a step
  is never applied to a different week. `getOrCreate` writes on load (self-healing), and nothing
  records a step for it, so that write is intentionally not undoable.
- A failed mutation records nothing - otherwise Strg+Z would offer to undo a change that never
  reached the database.
- The Strg+Z/Strg+Y listener sits on `document`, next to the existing `contextmenu` one, and bails
  out inside inputs/textareas (`DecimalTextField` manages its own in-progress typing state, so the
  browser's field-level undo has to keep working) and while any dialog or the context menu is open.

## Manuelle Netto-Stunden und angerechnete Stunden

The Tageseditor has an optional "Netto-Stunden manuell" field per day; the Soll column shows a
Minijob's full Min-Max band and the warning icon only fires outside it. See
`application/CLAUDE.md` for the worked/credited split and `domain/schedule/CLAUDE.md` for why the
override never reaches the ArbZG checks.

## Werkzeugleiste und Drag and Drop

`ScheduleToolbar.tsx` is the always-visible tool palette. `scheduleTools.ts` gives all three kinds of
tool one type (`off`, `clipboard`, `template`), so the toolbar, the clipboard and the drop target do
not each grow a three-way branch. `toolToDayEntry` is the single place that turns a tool into a day
entry, and the only place that regenerates shift/break ids - the inline copy that used to live in
`ScheduleView.paste` is gone.

The clipboard **is** the active tool: clicking a tile makes it active, "Kopieren" on a cell makes the
copied entry active, and "Einfügen" applies whatever is active. There is deliberately no second
mechanism next to the clipboard.

Drag and drop is native HTML5, no library:

- The tile sets `dataTransfer.setData(TOOL_MIME, ...)` (Firefox refuses to start a drag otherwise)
  and `effectAllowed = 'copy'`; the cell sets `dropEffect = 'copy'`. Mismatched effects make Firefox
  cancel the drop silently.
- `onDragOver` **must** `preventDefault()`, or `drop` never fires. `onDragEnter` does the same.
- The dragged tool travels in a **ref** in `ScheduleView`, not in `dataTransfer`: `getData()` is
  blanked during dragover by every browser, so a payload there could not be inspected while hovering.
  `dataTransfer` carries only the marker type, which `types.includes(...)` **can** read - that is what
  tells our tools apart from a dragged file or text.
- The drop highlight lives in `ScheduleTable`, not in `ScheduleView`: dragover fires continuously and
  a highlight in the parent would re-render it (and defeat the table's `memo`) many times per second.
- `dragleave` also fires when the pointer moves onto a child element, so it only clears the highlight
  when `!currentTarget.contains(relatedTarget)`.

`scheduleRows.canReceiveEntry` is the ONE rule behind "Einfügen", "Frei" and a drop: it rules out
locked cells **and** cells inside a multi-day absence. Without the second half, drag and drop would
become the single path that writes a shift onto a vacation week, which the Tageseditor and the menu
both refuse. A cell that cannot receive an entry gets no drag handlers at all - the browser then
shows the "no drop" cursor by itself.

The template tiles use an explicit menu button, not right-click: the document-level `contextmenu`
listener leaves the native browser menu alone outside the table.

The bar is sticky under the app header, whose height varies because its toolbar wraps - `AppShell`
measures it into the `--pep-header-height` custom property (written straight to the DOM, no state, so
resizing does not re-render the shell). Its `zIndex` stays at 2 on purpose: `ValidationNotices`
renders its expanded panel at `zIndex: 10` right across this area and has to stay on top.
