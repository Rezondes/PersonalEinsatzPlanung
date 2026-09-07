import type { MitarbeiterId } from '@domain/shared/ids';
import type { Wochentag } from '@domain/shared/Kalenderwoche';
import { WOCHENTAGE } from '@domain/shared/Kalenderwoche';
import type { Schicht } from './Schicht';

export type Tageseintrag = { typ: 'Schicht'; schichten: Schicht[] } | { typ: 'Frei' };

export interface MitarbeiterWocheneinsatz {
  mitarbeiterId: MitarbeiterId;
  tage: Record<Wochentag, Tageseintrag>;
}

export function leererWocheneinsatz(mitarbeiterId: MitarbeiterId): MitarbeiterWocheneinsatz {
  const tage = Object.fromEntries(WOCHENTAGE.map((tag) => [tag, { typ: 'Frei' } as Tageseintrag])) as Record<
    Wochentag,
    Tageseintrag
  >;
  return { mitarbeiterId, tage };
}
