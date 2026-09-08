import { differenceInYears } from 'date-fns';

/** Returns whether the person is a minor on the reference date, or null if the birth date is unknown. */
export function isMinor(birthDate: string | undefined, referenceDate: Date): boolean | null {
  if (!birthDate) {
    return null;
  }
  return differenceInYears(referenceDate, new Date(birthDate)) < 18;
}

// Extension point for later: full JArbSchG validation (max. 8h/day, no work before 6/after 20:00,
// no Sunday work, different break rules) following the same ValidationResult[] pattern as the other
// arbzg/* modules, once the app is used for minor employees.
