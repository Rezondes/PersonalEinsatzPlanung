# application/

Use-cases orchestrating domain logic + ports; no framework/browser dependencies of its own.

- Hard rule: `application/` may only depend on `application/ports/*` interfaces, never directly on
  `infrastructure/` or `ui/`. Enforced by `import/no-restricted-paths` in `.eslintrc.cjs`.
- Composition happens **outside** this layer, in `src/infrastructure/services.ts` - the one place
  that wires concrete Dexie repos into these services. No DI framework, just a plain object.
- Service factory pattern: every service is `erstelleXService(repo)` returning a plain object of
  functions (not a class). Keep new services consistent with this shape.
- `wochenplanAuswertung.ts` and `druckDatenAufbereitung.ts` (export) share the same overlay/calculation
  logic (`erstelleWochenAnsicht`) deliberately - the print view must never reimplement hour math.
  `erstelleMonatsUebersicht` (same file) also calls `erstelleWochenAnsicht` internally per week and
  sums its `gesamtNettoMinuten`, rather than re-walking days/Abwesenheiten itself - the per-day
  overlay logic (including halbtags handling) must only exist once.
