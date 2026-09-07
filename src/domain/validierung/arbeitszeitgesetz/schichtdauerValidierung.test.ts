import { describe, it, expect } from 'vitest';
import { uhrzeit } from '@domain/shared/Uhrzeit';
import { neueSchicht } from '@domain/wochenplan/Schicht';
import type { MitarbeiterId } from '@domain/shared/ids';
import { validiereSchichtdauer } from './schichtdauerValidierung';

const kontext = { mitarbeiterId: 'm1' as MitarbeiterId, datum: '2026-09-07' };

describe('validiereSchichtdauer', () => {
  it('meldet keinen Fehler bei einer normalen Schicht', () => {
    const schicht = neueSchicht(uhrzeit('06:00'), uhrzeit('14:00'));
    expect(validiereSchichtdauer(schicht, kontext)).toHaveLength(0);
  });

  it('meldet einen Fehler wenn Ende vor Beginn liegt ohne endeFolgetag', () => {
    const schicht = neueSchicht(uhrzeit('14:00'), uhrzeit('06:00'), false);
    const ergebnisse = validiereSchichtdauer(schicht, kontext);
    expect(ergebnisse).toHaveLength(1);
    expect(ergebnisse[0].schweregrad).toBe('fehler');
  });

  it('meldet einen Fehler wenn Ende gleich Beginn ist (0 Minuten Dauer)', () => {
    const schicht = neueSchicht(uhrzeit('06:00'), uhrzeit('06:00'), false);
    expect(validiereSchichtdauer(schicht, kontext)).toHaveLength(1);
  });

  it('meldet keinen Fehler bei einer Nachtschicht mit gesetztem endeFolgetag', () => {
    const schicht = neueSchicht(uhrzeit('20:00'), uhrzeit('06:00'), true);
    expect(validiereSchichtdauer(schicht, kontext)).toHaveLength(0);
  });
});
