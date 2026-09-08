import type { ClockTime } from '@domain/shared/ClockTime';

export interface Break {
  id: string;
  /** Optional; on the paper form sometimes only recorded as a checkmark instead of a concrete time. */
  start?: ClockTime;
  durationMinutes: number;
}

export function createBreak(durationMinutes: number, start?: ClockTime): Break {
  return { id: crypto.randomUUID(), durationMinutes, start };
}
