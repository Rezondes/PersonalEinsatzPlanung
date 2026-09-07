import { describe, it, expect } from 'vitest';
import type { MitarbeiterId } from '@domain/shared/ids';
import { validiereTagesarbeitszeit, validiereWochenarbeitszeit } from './hoechstarbeitszeitValidierung';

const kontext = { mitarbeiterId: 'm1' as MitarbeiterId, datum: '2026-09-07' };

describe('validiereTagesarbeitszeit', () => {
  it('gibt keine Meldung bei genau 8 Stunden', () => {
    expect(validiereTagesarbeitszeit(8 * 60, kontext)).toHaveLength(0);
  });

  it('warnt bei über 8 Stunden', () => {
    const ergebnisse = validiereTagesarbeitszeit(8 * 60 + 30, kontext);
    expect(ergebnisse).toHaveLength(1);
    expect(ergebnisse[0].schweregrad).toBe('warnung');
  });

  it('gibt nur eine Warnung bei genau 10 Stunden (Grenze ist "größer als")', () => {
    const ergebnisse = validiereTagesarbeitszeit(10 * 60, kontext);
    expect(ergebnisse).toHaveLength(1);
    expect(ergebnisse[0].schweregrad).toBe('warnung');
  });

  it('meldet einen Fehler bei über 10 Stunden', () => {
    const ergebnisse = validiereTagesarbeitszeit(10 * 60 + 1, kontext);
    expect(ergebnisse).toHaveLength(1);
    expect(ergebnisse[0].schweregrad).toBe('fehler');
  });
});

describe('validiereWochenarbeitszeit', () => {
  it('warnt bei über 48 Wochenstunden', () => {
    const ergebnisse = validiereWochenarbeitszeit(48 * 60 + 1, { mitarbeiterId: 'm1' as MitarbeiterId });
    expect(ergebnisse).toHaveLength(1);
  });

  it('warnt nicht bei genau 48 Wochenstunden', () => {
    expect(validiereWochenarbeitszeit(48 * 60, { mitarbeiterId: 'm1' as MitarbeiterId })).toHaveLength(0);
  });
});
