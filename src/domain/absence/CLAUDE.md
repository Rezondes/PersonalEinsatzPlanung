# domain/absence/

Absence is a discriminated union (`Vacation | Illness | Other`). The `Illness` variant
deliberately has **no** free-text/diagnosis field at the type level - Privacy by Design enforced by
the type system itself, not just convention (GDPR: no health-detail data is even representable, let
alone stored). Do not add a notes field to `Illness`.

`AbsenceInput` uses a hand-written distributive conditional type instead of plain
`Omit<Absence, 'id' | 'createdAt'>`, because plain `Omit` over a union collapses to the
intersection of keys (a TS quirk) and would silently lose per-variant required fields (like
`Other.label`). Keep this pattern if the union grows new variants with required fields.

Vacation day-counting (`vacationCalculation.ts`) counts Mon-Sat as work days (6-day week per BUrlG
practice), excludes Sunday, and supports half-days via `halfDay`. `countWorkDays` /
`countVacationDaysInYear` take an optional injected `isHoliday` (federal-state-specific, built
via `infrastructure/holidays/germanHolidays.createHolidayCheck` in the UI layer,
never imported here directly) so a public holiday inside a vacation range doesn't consume vacation
entitlement (standard BUrlG interpretation) - domain stays federal-state-agnostic, same injection
pattern as `sundayHolidayValidation.ts`.

`countVacationDaysInYear` clips ranges crossing a year boundary to the requested year instead of
filtering by the range's start year - a range like Dec 29 - Jan 2 must split its days between both
years, not be attributed wholly to one or dropped from both.
