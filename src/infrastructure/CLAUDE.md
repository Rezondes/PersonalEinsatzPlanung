# infrastructure/

Dexie/IndexedDB persistence, browser file I/O, and German holiday calculation - the only layer
allowed to touch browser APIs.

- Dexie schema is defined in `persistence/db.ts`. Version 1 (German store names: filialen,
  mitarbeiter, wochenplaene, abwesenheiten) is the original pre-rename schema; version 2 renames
  every store to English (branches, employees, weeklySchedules, absences) and migrates existing
  records' field names via an `.upgrade()` step, so local data made before the German->English code
  rename survives. Version 3 adds no index and therefore no
  `.stores()` call at all - it only runs an `.upgrade()` that backfills the now-required
  `Employee.holidayVacationHours` with `targetWeeklyHours / 6`. The divisor is 6, not 5, because
  `vacationCalculation.countWorkDays` counts Mon-Sat as work days (BUrlG practice), so a full week
  of vacation then credits exactly the contract's weekly hours; `defaultHolidayVacationHours` in
  `domain/employee/EmploymentType.ts` is shared with the JSON v2->v3 migration so a restored backup
  and a locally upgraded database cannot disagree. Never edit an existing version's `.stores()` in
  place - any future structural change goes through a new `this.version(n)` block with its own
  `.upgrade()` migration. Version 4 adds the `shiftTemplates` store; a brand-new, initially empty
  store needs a `.stores()` declaration but no `.upgrade()`, since there is nothing to migrate into
  it. **When a store is added, `transaction()` at the bottom of the file has to list it too** -
  otherwise the JSON import writes into a store outside its own transaction and Dexie throws.
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
- `backup/` is the only outbound network code in the app: Google Drive as an **optional** second
  destination for the very same JSON backup, behind the `application/ports/BackupStorage` port so
  the UI never talks to Google and the whole flow is testable against a fake (`SettingsView.test.tsx`,
  `DriveBackupDialog.test.tsx`). The real sign-in dialog cannot be automated - that one step is only
  ever verified by hand. Five decisions here are load-bearing; none of them is an accident:
  - **The Google script is loaded lazily**, on the first `requestAccessToken` call, i.e. when the
    user actually clicks "Mit Google anmelden". Until then the app makes no request to Google at
    all. This is what keeps `PrivacyView`'s promise true for everyone who does not use the feature -
    do not move the `<script>` into `index.html` or preload it "for speed".
  - **The access token lives in a module variable, never in `localStorage`.** A stored token is
    readable by any XSS and is good for an hour of Drive access. What IS persisted is a single
    boolean under `pep.drive.connected` ("this user uses Drive"), which is worth nothing to an
    attacker but lets `restoreSession()` renew the authorisation silently after a reload. Without
    that, the reload at the end of `SettingsView.performImport` would drop the user back to the
    sign-in button immediately after they restored a backup - the exact bug this pair fixes.
    `restoreSession()` is silent-only on purpose and therefore safe to call from an effect;
    `signIn()` opens a popup and must stay inside a real click, or the browser blocks it.
  - **Scope is `drive.file`**, the narrowest Drive scope: the app only ever sees files it created
    itself, the rest of the Drive stays invisible to it. Anything wider drags in Google's expensive
    security review. Backups go into a normal, visible folder `Personaleinsatzplanung`, not the
    hidden app-data folder, so the user can see, tidy and download them by hand.
  - **Deleting a backup TRASHES it, it does not erase it.** `delete()` sends
    `PATCH {trashed: true}`, not `DELETE`. The scope would permit a real erase; the reason not to
    is that a Drive backup is frequently the user's only second copy, and one mis-tap on a phone
    would be unrecoverable. In the trash it can be restored for 30 days. `list()` already filters
    `trashed = false`, so it leaves the app's list immediately either way, and the confirmation
    text says which of the two happened - do not "tidy" it into a DELETE.
  - **The client id in `googleConfig.ts` is public by design** (every browser app ships it) and may
    stay in the repository. There is no client secret; this flow does not use one. An empty id makes
    `isConfigured()` false and the feature disappears from the UI entirely.
- `persistence/storagePersistence.ts` answers whether the browser promises to KEEP this data. It
  matters more here than in most apps: the IndexedDB next door holds the only copy of a store's
  schedules, and Safari clears script-writable storage of ordinary websites after seven days
  without a visit (an installed home-screen app is exempt, which is why Einstellungen pushes
  installation). Reading the state never asks for anything; `persist()` is only called from a
  button the user pressed. That split is deliberate: Firefox shows a real permission dialog for
  `persist()`, and one that appears unprompted gets denied reflexively - a denial Firefox then
  remembers, forfeiting exactly the durability we wanted. Every entry point is guarded with
  `typeof ... !== 'function'`, because jsdom has no `navigator.storage` at all.
- The **service worker** (generated by `vite-plugin-pwa`, configured in `vite.config.ts`) precaches
  the whole bundle so the app starts without a network. Two rules there are load-bearing:
  - **No `runtimeCaching`, ever.** Without a matching route Workbox never calls `respondWith()`, so
    `accounts.google.com` and `googleapis.com` go straight to the network, untouched by the cache.
    Adding caching for the Google script "for speed" would break the promise in `PrivacyView` that
    the script is fetched only after an explicit click. A `navigateFallbackDenylist` is NOT the
    mechanism and would give false comfort: it only ever applies to navigations, and the Google
    script is a `script` request.
  - **`manifest.webmanifest` must not appear in `globPatterns`.** The plugin adds it to the
    precache itself; a duplicate URL makes Workbox throw `add-to-cache-list-conflicting-entries`
    at install time, so the worker never activates - and the build says nothing.
- CSP in `index.html` is `default-src 'self'` plus exactly what the Drive sign-in needs
  (`accounts.google.com` for script and frame, `googleapis.com` for connect) and the localhost
  websocket for Vite's dev-server HMR, which has zero effect in the production build. Do not widen
  this without a real reason; it's load-bearing for the "no data leaves the browser" privacy
  guarantee, which now reads "unless the user connects Drive themselves".
  The service worker needed **no** CSP change, and that is not an oversight worth "fixing":
  `navigator.serviceWorker.register()` is governed by `worker-src`, which falls back to
  `script-src` (`'self'` is already there), and `<link rel="manifest">` by `manifest-src`, which
  falls back to `default-src 'self'`. A `<meta http-equiv>` CSP applies to the document only, never
  to the worker's own script.
