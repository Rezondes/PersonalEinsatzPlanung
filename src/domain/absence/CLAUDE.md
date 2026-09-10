# domain/absence/

Absence is a discriminated union (`Vacation | Illness | PublicHoliday | Other`). The `Illness`
variant deliberately has **no** free-text/diagnosis field at the type level - Privacy by Design
enforced by the type system itself, not just convention (GDPR: no health-detail data is even
representable, let alone stored). Do not add a notes field to `Illness`.

`PublicHoliday` ("Feiertag" in the UI) exists so a public holiday no longer has to be recorded via
`Other` - it auto-defaults to `Employee.holidayVacationHours` like Vacation, but unlike Vacation
does NOT zero out on a day the injected `isHoliday` check already flags (see
`application/schedule/scheduleAssessment.ts` - marking a day PublicHoliday IS the statement that it
is such a day).

`Vacation`, `Illness` and `PublicHoliday` all support an optional `creditedMinutesOverride`: a
plain number of minutes that always wins over the calculated value, on every day of the range. It
carries no health/diagnosis information, so adding it to `Illness` does not violate the
Privacy-by-Design rule above - it is the same kind of value as `Other.hoursPerDay` below, just an
override rather than the sole source of truth.

Only the `Other` variant has `hoursPerDay` (optional): hours credited to the employee for **each
day** of the range, e.g. a training day (a public holiday now has its own `PublicHoliday` type
above, rather than going through `Other`). It is the manual escape hatch, so it is credited exactly
as entered - including on Sundays and public holidays, unlike a vacation day (see
`application/schedule/scheduleAssessment.ts`).

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
