# domain/

Pure business rules for staff scheduling at a German supermarket chain - zero framework/IO dependencies.

## Aggregates
- **Filiale** - a branch (store): address, Bundesland, allowed open Sundays.
- **Mitarbeiter** - an employee: employment type, vacation entitlement, optional birth date.
- **Wochenplan** - one weekly schedule per (filialeId, Kalenderwoche).
- **Abwesenheit** - vacation/sick/other absence, a separate aggregate from Wochenplan.

## Hard rules
- `domain/` must never import from `application/`, `infrastructure/`, or `ui/`. Enforced by
  `import/no-restricted-paths` in `.eslintrc.cjs` - a build-time error, not just a convention.
- Value objects are branded primitives (e.g. `Uhrzeit`, `FilialId`) or plain object literals + free
  functions, never classes. This keeps Dexie/JSON serialization ceremony-free.

## Ubiquitous language
Domain identifiers (types, functions, fields) are German on purpose - they mirror the paper forms
this app replaces and the ArbZG legal text. Infra/technical terms stay English. Comments are English.
User-facing strings (validation `meldung`, UI labels) stay German - the app's users are German-speaking.
Do not rename domain identifiers to English; do not translate `meldung` strings.
