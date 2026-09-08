import type { ClockTime } from '@domain/shared/ClockTime';
import type { Break } from './Break';

export interface Shift {
  id: string;
  start: ClockTime;
  end: ClockTime;
  /** true for night shifts whose end falls after midnight arithmetically (end < start). */
  endsNextDay: boolean;
  breaks: Break[];
}

export function createShift(start: ClockTime, end: ClockTime, endsNextDay = false): Shift {
  return { id: crypto.randomUUID(), start, end, endsNextDay, breaks: [] };
}
