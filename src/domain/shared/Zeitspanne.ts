import type { Uhrzeit } from './Uhrzeit';
import { uhrzeitZuMinuten } from './Uhrzeit';

export function toISODatum(datum: Date): string {
  const jahr = datum.getFullYear();
  const monat = String(datum.getMonth() + 1).padStart(2, '0');
  const tag = String(datum.getDate()).padStart(2, '0');
  return `${jahr}-${monat}-${tag}`;
}

/** The app's one and only date display format: DD.MM.YYYY, always zero-padded. Deliberately not
 * `Date.toLocaleDateString('de-DE')` - that neither zero-pads nor guarantees this exact shape
 * across browsers/environments, it just happens to look similar. Used everywhere a date is shown
 * to the user as read-only text (native `<input type="date">` pickers are unaffected - their
 * display format is controlled by the browser/OS, not by this app). */
export function formatDatumDeutsch(datum: Date): string {
  const tag = String(datum.getDate()).padStart(2, '0');
  const monat = String(datum.getMonth() + 1).padStart(2, '0');
  const jahr = datum.getFullYear();
  return `${tag}.${monat}.${jahr}`;
}

/** Same as formatDatumDeutsch, but takes an ISO date string ("YYYY-MM-DD", e.g. Abwesenheit.von)
 * directly instead of a Date - plain string rearrangement, no Date parsing/timezone involved. */
export function formatISODatumDeutsch(isoDatum: string): string {
  const [jahr, monat, tag] = isoDatum.split('-');
  return `${tag}.${monat}.${jahr}`;
}

/** Combines an ISO date ("yyyy-MM-dd") with a time into a concrete local point in time.
 * Uses the overloaded Date constructor, which automatically rolls minutes >59 into hours. */
export function kombiniereDatumUndUhrzeit(isoDatum: string, zeit: Uhrzeit): Date {
  const [jahr, monat, tag] = isoDatum.split('-').map(Number);
  const minutenSeitMitternacht = uhrzeitZuMinuten(zeit);
  return new Date(jahr, monat - 1, tag, 0, minutenSeitMitternacht);
}
