# infrastructure/

Dexie/IndexedDB persistence, browser file I/O, and German holiday calculation - the only layer
allowed to touch browser APIs.

- Dexie schema is defined in `persistence/db.ts`. Version 1 (German store names: filialen,
  mitarbeiter, wochenplaene, abwesenheiten) is the original pre-rename schema; version 2 renames
  every store to English (branches, employees, weeklySchedules, absences) and migrates existing
  records' field names via an `.upgrade()` step, so local data made before the German->English code
  rename survives. Never edit an existing version's `.stores()` in place - any future structural
  change goes through a new `this.version(n)` block with its own `.upgrade()` migration.
- JSON backup format (`application/export/jsonExportFormat.ts` - note: lives in `application/`, not
  here, despite the name suggesting otherwise, because it's a pure DTO/versioning concern, not a
  browser-API concern) has its own independent `formatVersion` from the Dexie schema version;
  `jsonMigrations.ts` (also in `application/`) handles cross-version import compatibility, with its
  own v1->v2 field-rename migration mirroring db.ts's (kept as an independent implementation since
  the two migration concerns can diverge over time).
- Full data replace on import is the only supported import mode (no merge) - simplest correct
  behavior for the "move to a new device" use case.
- German holidays are computed locally via the Meeus/Jones/Butcher Easter algorithm
  (`holidays/germanHolidays.ts`) plus a hardcoded federal-state table - deliberately no external
  holiday library/API (keeps the app fully offline, no network calls, GDPR-friendly).
- CSP in `index.html` only allows `connect-src 'self' ws://localhost:*` - the websocket exception is
  only for Vite's dev-server HMR and has zero effect in the production build. Do not widen this
  without a real reason; it's load-bearing for the "no data leaves the browser" privacy guarantee.
