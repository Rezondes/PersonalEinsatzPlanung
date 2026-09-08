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
- `scheduleService.getOrCreate` self-heals: employees added to the branch **after** a week's
  schedule already existed are automatically appended with an empty DayEntry the next time that week
  is loaded - otherwise newly hired staff would silently be missing from already-created weekly
  schedules. This was a bug found and fixed during implementation.
