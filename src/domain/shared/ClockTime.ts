import { DomainError } from './DomainError';

/** 24h time in "HH:mm" format, e.g. "06:00" or "22:30". */
export type ClockTime = string & { readonly __brand: 'ClockTime' };

const CLOCK_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseClockTime(input: string): ClockTime | null {
  return CLOCK_TIME_REGEX.test(input) ? (input as ClockTime) : null;
}

export function clockTime(input: string): ClockTime {
  const parsed = parseClockTime(input);
  if (!parsed) {
    throw new DomainError(`Ungültige Uhrzeit: "${input}". Erwartet wird das Format HH:mm.`);
  }
  return parsed;
}

export function clockTimeToMinutes(t: ClockTime): number {
  const [hours, minutes] = t.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToClockTime(minutesSinceMidnight: number): ClockTime {
  const normalized = ((minutesSinceMidnight % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` as ClockTime;
}
