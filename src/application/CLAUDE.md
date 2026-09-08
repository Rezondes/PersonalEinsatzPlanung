# application/

Use-cases orchestrating domain logic + ports; no framework/browser dependencies of its own.

- Hard rule: `application/` may only depend on `application/ports/*` interfaces, never directly on
  `infrastructure/` or `ui/`. Enforced by `import/no-restricted-paths` in `.eslintrc.cjs`.
- Composition happens **outside** this layer, in `src/infrastructure/services.ts` - the one place
  that wires concrete Dexie repos into these services. No DI framework, just a plain object.
- Service factory pattern: every service is `createXService(repo)` returning a plain object of
  functions (not a class). Keep new services consistent with this shape.
- `scheduleAssessment.ts` and `printDataPreparation.ts` (export) share the same overlay/calculation
  logic (`createWeekView`) deliberately - the print view must never reimplement hour math.
  `createMonthOverview` (same file) also calls `createWeekView` internally per week and
  sums its `totalNetMinutes`, rather than re-walking days/Absences itself - the per-day
  overlay logic (including half-day handling) must only exist once.
- `scheduleAssessment` splits hours into **two** figures, and mixing them up is the easiest way to
  break this app:
  - `workedMinutes` - actually worked in the store (shift minus breaks, or the day's manual
    override; 0 on a full-day absence). The **only** figure a branch-wide total may use:
    the "Ist-Wochenstd. (gearbeitet)" tile, the week picker's per-week total, the print export's
    per-weekday `dayTotals` and its per-employee week total.
  - `creditedMinutes` - paid without presence in the store: a vacation day worth
    `Employee.holidayVacationHours`, or an "Other" absence carrying `hoursPerDay`. Counts for the
    employee, never for the branch.
  - `totalNetMinutes` = worked + credited, i.e. the employee's Ist-Wochenstunden. Used by the Soll/Ist
    comparison, the monthly overview and the previous week's carry-over.
  A vacation day only credits on days that actually consume entitlement (Mon-Sat, minus public
  holidays), matching `vacationCalculation.countWorkDays` - otherwise a Mon-Sun vacation would
  credit seven days and push the employee past their weekly target. That is why `createWeekView`
  takes a `WeekViewContext` with the employees and an injected `isHoliday`; it is a **required**
  object on purpose, because an optional one defaulting to "no employees" would silently credit 0
  everywhere a call site was forgotten.
- `DayView.absenceCoversWholeDay` is an explicit flag, not `minutes === 0`. Since a day's hours can
  now be overridden to zero, deriving it from the minutes would make a manually zeroed day render as
  an absence.
- Overlapping absences (typically a one-day "Sonstige" public holiday inside a vacation range) are
  resolved deterministically in `findAbsenceForDay`: the narrower range wins, `createdAt` breaks
  ties. Without that, how many hours get credited would depend on the repository's return order.
- `scheduleAssessment.effectiveTargetMinutes` / `effectiveTargetMinutesRange` are the single place
  that combines an Employee's contract target hours with a week's `targetAdjustmentMinutes`
  carry-over (see `ui/views/schedule/CLAUDE.md` for the sign convention) - the UI never adds these
  two numbers itself. The **range** version is what the Soll column and its warning icon use, so a
  Minijobber inside their Min-Max band counts as on target; the single-number version returns the
  upper bound and exists for the one caller that needs exactly one figure, the carry-over dialog.
- `absenceService.restore` writes an Absence back verbatim (id and `createdAt` preserved),
  deliberately past `createAbsence` - the same exception the JSON import makes. It exists solely for
  the Wochenplanung's undo/redo, which would otherwise mint new ids and break the next step.
- `shiftTemplateService` is the fifth aggregate's service, wired like every other one. Its `delete`
  is a real delete (see `domain/schedule/CLAUDE.md`), and `forBranch` sorts by name so the toolbar
  order is the same everywhere by construction.
- `scheduleService.findForWeek` is a **read-only** lookup (unlike `getOrCreate`, it never
  creates a schedule) - used when a caller needs to look at another week (e.g. the previous one) without
  side-effecting it into existence.
- `export/jsonExportFormat.ts` and `export/jsonMigrations.ts` are the backup-file format's
  versioning boundary: any future rename of a persisted field must bump `CURRENT_FORMAT_VERSION`
  and add a migration step in `migrateToCurrentVersion`, the same way the German->English rename
  added the v1->v2 step (old German field names -> current English field names) - otherwise old
  export files silently fail to import or corrupt on import.
