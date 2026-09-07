import type { Uhrzeit } from '@domain/shared/Uhrzeit';

export interface Pause {
  id: string;
  /** Optional; on the paper form sometimes only recorded as a checkmark instead of a concrete time. */
  beginn?: Uhrzeit;
  dauerMinuten: number;
}

export function neuePause(dauerMinuten: number, beginn?: Uhrzeit): Pause {
  return { id: crypto.randomUUID(), dauerMinuten, beginn };
}
