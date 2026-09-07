import type { Uhrzeit } from '@domain/shared/Uhrzeit';
import type { Pause } from './Pause';

export interface Schicht {
  id: string;
  beginn: Uhrzeit;
  ende: Uhrzeit;
  /** true for night shifts whose end falls after midnight arithmetically (ende < beginn). */
  endeFolgetag: boolean;
  pausen: Pause[];
}

export function neueSchicht(beginn: Uhrzeit, ende: Uhrzeit, endeFolgetag = false): Schicht {
  return { id: crypto.randomUUID(), beginn, ende, endeFolgetag, pausen: [] };
}
