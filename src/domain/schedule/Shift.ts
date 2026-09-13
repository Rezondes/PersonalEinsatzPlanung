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

/** Copies each shift (and its breaks) with fresh ids - for wherever a shift list is duplicated
 * onto a different day/week (drag-and-drop, paste, copying a previous week's schedule), so the
 * copy never shares an id with its source. */
export function withFreshShiftIds(shifts: Shift[]): Shift[] {
  return shifts.map((shift) => ({
    ...shift,
    id: crypto.randomUUID(),
    breaks: shift.breaks.map((brk) => ({ ...brk, id: crypto.randomUUID() })),
  }));
}
