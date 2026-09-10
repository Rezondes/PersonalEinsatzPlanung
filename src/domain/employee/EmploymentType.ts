export type EmploymentType =
  | { type: 'FullTime' | 'PartTime'; weeklyHours: number }
  | { type: 'Minijob'; minHours: number; maxHours: number };

/** The single canonical source of the 3 discriminant values - every place that needs "just the
 * type" (form state, filters) imports this instead of retyping the literal union. */
export type EmploymentTypeKind = EmploymentType['type'];

/** Contract target hours as a range. Minijob has a real Min/Max band; FullTime/PartTime collapse to
 * a single value on both bounds, so callers never have to branch on the employment type. */
export interface WeeklyHoursRange {
  min: number;
  max: number;
}

export function targetWeeklyHoursRange(employmentType: EmploymentType): WeeklyHoursRange {
  return employmentType.type === 'Minijob'
    ? { min: employmentType.minHours, max: employmentType.maxHours }
    : { min: employmentType.weeklyHours, max: employmentType.weeklyHours };
}

/** Upper bound of the contract target. Deliberately the MAX for a Minijob: used where exactly one
 * number is needed (the previous week's carry-over calculation), never for the Soll/Ist comparison -
 * that one uses the full range so hours inside the Min/Max band don't count as a deviation. */
export function targetWeeklyHours(employmentType: EmploymentType): number {
  return targetWeeklyHoursRange(employmentType).max;
}

export function employmentTypeLabel(employmentType: EmploymentType): string {
  switch (employmentType.type) {
    case 'FullTime':
      return 'Vollzeit';
    case 'PartTime':
      return 'Teilzeit';
    case 'Minijob':
      return 'Geringfügig beschäftigt';
  }
}

/** Default hours credited for one holiday/vacation day, used to backfill employees stored before
 * Employee.holidayVacationHours existed (Dexie v3 and the JSON format v2->v3 migration).
 *
 * Divides by 6, not 5, on purpose: vacationCalculation.countWorkDays counts Mon-Sat as work days
 * (BUrlG practice), so a full week of vacation consumes 6 days - and with this default it credits
 * exactly the contract's weekly hours. The value is per employee and editable in the dialog. */
export function defaultHolidayVacationHours(employmentType: EmploymentType): number {
  return Math.round((targetWeeklyHours(employmentType) / 6) * 100) / 100;
}
