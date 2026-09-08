# domain/

Pure business rules for staff scheduling at a German supermarket chain - zero framework/IO dependencies.

## Aggregates
- **Branch** - a store: address, federal state, allowed open Sundays.
- **Employee** - employment type, vacation entitlement, optional birth date.
- **WeeklySchedule** - one weekly schedule per (branchId, CalendarWeek).
- **Absence** - vacation/sick/other absence, a separate aggregate from WeeklySchedule.

## Hard rules
- `domain/` must never import from `application/`, `infrastructure/`, or `ui/`. Enforced by
  `import/no-restricted-paths` in `.eslintrc.cjs` - a build-time error, not just a convention.
- Value objects are branded primitives (e.g. `ClockTime`, `BranchId`) or plain object literals + free
  functions, never classes. This keeps Dexie/JSON serialization ceremony-free.

## Language
Code (types, functions, fields, file/folder names) is English. Comments are English. String
**values** that are either shown verbatim in the UI with no separate label/translation function, or
real-world proper nouns, stay German (e.g. `Weekday` values `'Montag'`...`'Sonntag'`, `FederalState`
values like `'Bayern'`, and `"Minijob"` as an established German legal term with no equivalent).
Discriminant values that route through a separate display-label function (e.g.
`EmploymentType.type`) may be English since the UI never reads them directly.

The user interface itself stays German - the app's users are German-speaking store managers.
UI-facing strings (validation `message` values, labels) stay German; do not translate them.
