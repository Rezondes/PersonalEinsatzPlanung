# domain/schedule/

WeeklySchedule is keyed by `(branchId, CalendarWeek)` - one aggregate per branch per ISO week.

- References `Employee` only by ID. Name/position are **not** snapshotted - always loaded live
  from the current Employee record at display/export time (DRY, avoids stale duplicated data).
- Absences (vacation/sick days) are a **separate** aggregate, never stored inside WeeklySchedule.
  They're overlaid at read time in `application/schedule/scheduleAssessment.ts`
  (`createWeekView`) to avoid sync problems between two aggregates that could otherwise drift
  apart. On a day covered by an Absence, any leftover Shift data in the aggregate is
  intentionally **not deleted** (so restoring/removing the Absence brings the old shift back) but
  is excluded from all hour totals via `effectiveNetMinutes` in `scheduleAssessment.ts` - a bug
  fixed during implementation where vacation days were incorrectly still counting scheduled hours.
- `scheduleCalculation.ts` is the single source of truth for all hour math (gross/net minutes,
  decimal-hour formatting). Both the interactive UI table and the print export call into it - never
  duplicate the math elsewhere.
- `DayEntry`'s Shift variant carries an optional `netMinutesOverride`: a manual correction of the
  whole day's net hours, entered in the Tageseditor. It exists in exactly **two** functions and the
  split between them is load-bearing:
  - `dayEntryNetMinutes` = what was **scheduled**, from the entered shift times. Every ArbZG rule
    goes through this one (`ui/views/schedule/useScheduleValidation.ts` feeds it into
    `validateDailyWorkingTime`/`validateWeeklyWorkingTime`), so overriding a 10h shift down to 8h
    still raises the §3 error - the person was still there for 10 hours.
  - `dayEntryWorkedMinutes` = what **counts**, override first. Everything that totals hours for a
    person or a branch uses this one.
  Do not merge the two "for simplicity": that would feed a manually corrected number straight into
  the working-time law checks. There is a regression test for it in `scheduleCalculation.test.ts`.
  `WeeklySchedule.withDayEntry` replaces the whole entry, so replacing a shift also drops its
  override - which is the intended behaviour, and why `ScheduleView.paste` does not carry one over.
- `scheduleService.getOrCreate` self-heals: employees added to the branch **after** a week's
  schedule already existed are automatically appended with an empty DayEntry the next time that week
  is loaded - otherwise newly hired staff would silently be missing from already-created weekly
  schedules. This was a bug found and fixed during implementation.

`ShiftTemplate` is the reusable working time behind the Wochenplanung toolbar. Three decisions are
load-bearing:

- It holds `Shift[]`, **not** a `DayEntry`. An empty day is the fixed "Frei" tool in the toolbar, not
  something the user creates, so `shifts` is guaranteed non-empty - and a per-day
  `netMinutesOverride` cannot even be represented in a template, which is exactly right: an override
  corrects one specific day.
- Applying a template **copies** its shifts with fresh ids (`ui/views/schedule/scheduleTools.ts`).
  A weekly schedule never references a template, so renaming or deleting one later can never change
  hours that were already planned. This is why the template service may hard-delete, unlike
  Branch/Employee which are soft-deleted.
- It belongs to a Branch: opening hours differ per store, so another branch's shifts would only be
  noise in the toolbar.
