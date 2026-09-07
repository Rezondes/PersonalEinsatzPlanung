import type { MitarbeiterId } from '@domain/shared/ids';
import type { Wochentag } from '@domain/shared/Kalenderwoche';
import { WOCHENTAGE } from '@domain/shared/Kalenderwoche';
import type { Schicht } from './Schicht';

export type Tageseintrag = { typ: 'Schicht'; schichten: Schicht[] } | { typ: 'Frei' };

export interface MitarbeiterWocheneinsatz {
  mitarbeiterId: MitarbeiterId;
  tage: Record<Wochentag, Tageseintrag>;
  /** Adjustment to this week's Soll-Stunden, carried forward from the previous week's Ist/Soll
   * difference (see Wochenplan.mitSollAnpassung). Positive = more Soll expected this week (was
   * behind), negative = less (was ahead). Absent/undefined is treated as 0 everywhere. */
  sollAnpassungMinuten?: number;
}

export function leererWocheneinsatz(mitarbeiterId: MitarbeiterId): MitarbeiterWocheneinsatz {
  const tage = Object.fromEntries(WOCHENTAGE.map((tag) => [tag, { typ: 'Frei' } as Tageseintrag])) as Record<
    Wochentag,
    Tageseintrag
  >;
  return { mitarbeiterId, tage };
}
