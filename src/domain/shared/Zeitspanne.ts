import type { Uhrzeit } from './Uhrzeit';
import { uhrzeitZuMinuten } from './Uhrzeit';

export function toISODatum(datum: Date): string {
  const jahr = datum.getFullYear();
  const monat = String(datum.getMonth() + 1).padStart(2, '0');
  const tag = String(datum.getDate()).padStart(2, '0');
  return `${jahr}-${monat}-${tag}`;
}

/** Combines an ISO date ("yyyy-MM-dd") with a time into a concrete local point in time.
 * Uses the overloaded Date constructor, which automatically rolls minutes >59 into hours. */
export function kombiniereDatumUndUhrzeit(isoDatum: string, zeit: Uhrzeit): Date {
  const [jahr, monat, tag] = isoDatum.split('-').map(Number);
  const minutenSeitMitternacht = uhrzeitZuMinuten(zeit);
  return new Date(jahr, monat - 1, tag, 0, minutenSeitMitternacht);
}
