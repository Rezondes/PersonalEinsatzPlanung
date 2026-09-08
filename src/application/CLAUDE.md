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
- `scheduleAssessment.effectiveTargetMinutes` is the single place that combines an Employee's
  contract target hours with a week's `targetAdjustmentMinutes` carry-over (see
  `ui/views/schedule/CLAUDE.md` for the sign convention) - the UI never adds these two numbers
  itself.
- `scheduleService.findForWeek` is a **read-only** lookup (unlike `getOrCreate`, it never
  creates a schedule) - used when a caller needs to look at another week (e.g. the previous one) without
  side-effecting it into existence.
- `export/jsonExportFormat.ts` and `export/jsonMigrations.ts` are the backup-file format's
  versioning boundary: any future rename of a persisted field must bump `CURRENT_FORMAT_VERSION`
  and add a migration step in `migrateToCurrentVersion`, the same way the German->English rename
  added the v1->v2 step (old German field names -> current English field names) - otherwise old
  export files silently fail to import or corrupt on import.
