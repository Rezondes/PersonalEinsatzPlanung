import { differenceInYears } from 'date-fns';

/** Returns whether the person is a minor on the reference date, or null if the birth date is unknown. */
export function istMinderjaehrig(geburtsdatum: string | undefined, stichtag: Date): boolean | null {
  if (!geburtsdatum) {
    return null;
  }
  return differenceInYears(stichtag, new Date(geburtsdatum)) < 18;
}

// Extension point for later: full JArbSchG validation (max. 8h/day, no work before 6/after 20:00,
// no Sunday work, different break rules) following the same ValidierungsErgebnis[] pattern as the other
// arbeitszeitgesetz/* modules, once the app is used for minor employees.
