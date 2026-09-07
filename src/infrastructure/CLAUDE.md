# infrastructure/

Dexie/IndexedDB persistence, browser file I/O, and German holiday calculation - the only layer
allowed to touch browser APIs.

- Dexie schema is defined once at version 1 in `persistence/db.ts` with 4 stores (filialen,
  mitarbeiter, wochenplaene, abwesenheiten). Any future structural change must go through a new
  `this.version(n)` block with an `.upgrade()` migration - never edit version 1 in place.
- JSON backup format (`application/export/jsonExportFormat.ts` - note: lives in `application/`, not
  here, despite the name suggesting otherwise, because it's a pure DTO/versioning concern, not a
  browser-API concern) has its own independent `formatVersion` from the Dexie schema version;
  `jsonMigrations.ts` (also in `application/`) handles cross-version import compatibility.
- Full data replace on import is the only supported import mode (no merge) - simplest correct
  behavior for the "move to a new device" use case.
- German holidays are computed locally via the Meeus/Jones/Butcher Easter algorithm
  (`feiertage/feiertageDeutschland.ts`) plus a hardcoded Bundesland table - deliberately no external
  holiday library/API (keeps the app fully offline, no network calls, GDPR-friendly).
- CSP in `index.html` only allows `connect-src 'self' ws://localhost:*` - the websocket exception is
  only for Vite's dev-server HMR and has zero effect in the production build. Do not widen this
  without a real reason; it's load-bearing for the "no data leaves the browser" privacy guarantee.
