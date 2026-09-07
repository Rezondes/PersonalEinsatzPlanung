import type { MitarbeiterId } from '@domain/shared/ids';

/**
 * "fehler" = clear legal violation (UI shows red, requires explicit confirmation on save).
 * "warnung" = borderline/config-dependent (yellow, blocks nothing).
 * "info" = pure notice. The software never hard-blocks, final responsibility stays with the Marktleiter,
 * but violations are surfaced and documented.
 */
export type Schweregrad = 'info' | 'warnung' | 'fehler';

export interface ValidierungsErgebnis {
  regel: string;
  schweregrad: Schweregrad;
  meldung: string;
  mitarbeiterId?: MitarbeiterId;
  datum?: string;
}
