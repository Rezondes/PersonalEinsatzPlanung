# domain/abwesenheit/

Abwesenheit is a discriminated union (`Urlaub | Krankheit | Sonstige`). The `Krankheit` variant
deliberately has **no** free-text/diagnosis field at the type level - Privacy by Design enforced by
the type system itself, not just convention (GDPR: no health-detail data is even representable, let
alone stored). Do not add a notes field to `Krankheit`.

`AbwesenheitEingabe` uses a hand-written distributive conditional type instead of plain
`Omit<Abwesenheit, 'id' | 'erstelltAm'>`, because plain `Omit` over a union collapses to the
intersection of keys (a TS quirk) and would silently lose per-variant required fields (like
`Sonstige.bezeichnung`). Keep this pattern if the union grows new variants with required fields.

Urlaub day-counting (`urlaubsBerechnung.ts`) counts Mon-Sat as work days (6-day week per BUrlG
practice), excludes Sunday, and supports half-days via `halbtags`. `zaehleWerktage` /
`zaehleUrlaubstageInZeitraum` take an optional injected `istFeiertag` (Bundesland-specific, built
via `infrastructure/feiertage/feiertageDeutschland.erstelleFeiertagsPruefung` in the UI layer,
never imported here directly) so a public holiday inside a vacation range doesn't consume vacation
entitlement (standard BUrlG interpretation) - domain stays Bundesland-agnostic, same injection
pattern as `sonntagsFeiertagsValidierung.ts`.

`zaehleUrlaubstageInZeitraum` clips ranges crossing a year boundary to the requested year instead of
filtering by the range's start year - a range like Dec 29 - Jan 2 must split its days between both
years, not be attributed wholly to one or dropped from both.
