import { DomainError } from './DomainError';

/** 24h time in "HH:mm" format, e.g. "06:00" or "22:30". */
export type Uhrzeit = string & { readonly __brand: 'Uhrzeit' };

const UHRZEIT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseUhrzeit(input: string): Uhrzeit | null {
  return UHRZEIT_REGEX.test(input) ? (input as Uhrzeit) : null;
}

export function uhrzeit(input: string): Uhrzeit {
  const parsed = parseUhrzeit(input);
  if (!parsed) {
    throw new DomainError(`Ungültige Uhrzeit: "${input}". Erwartet wird das Format HH:mm.`);
  }
  return parsed;
}

export function uhrzeitZuMinuten(u: Uhrzeit): number {
  const [stunden, minuten] = u.split(':').map(Number);
  return stunden * 60 + minuten;
}

export function minutenZuUhrzeit(minutenSeitMitternacht: number): Uhrzeit {
  const normalisiert = ((minutenSeitMitternacht % 1440) + 1440) % 1440;
  const stunden = Math.floor(normalisiert / 60);
  const minuten = normalisiert % 60;
  return `${String(stunden).padStart(2, '0')}:${String(minuten).padStart(2, '0')}` as Uhrzeit;
}
