import { describe, it, expect } from 'vitest';
import { uhrzeit } from '@domain/shared/Uhrzeit';
import { neueSchicht } from './Schicht';
import { neuePause } from './Pause';
import {
  schichtBruttoMinuten,
  schichtNettoMinuten,
  minutenZuDezimalstunden,
  tageseintragNettoMinuten,
  wocheneinsatzNettoMinuten,
} from './wochenplanBerechnung';
import { leererWocheneinsatz } from './MitarbeiterWocheneinsatz';
import type { MitarbeiterId } from '@domain/shared/ids';

describe('schichtBruttoMinuten', () => {
  it('berechnet die Bruttominuten einer normalen Tagschicht', () => {
    const schicht = neueSchicht(uhrzeit('06:00'), uhrzeit('12:00'));
    expect(schichtBruttoMinuten(schicht)).toBe(360);
  });

  it('berechnet Bruttominuten korrekt über Mitternacht hinaus bei endeFolgetag', () => {
    const schicht = neueSchicht(uhrzeit('22:00'), uhrzeit('06:00'), true);
    expect(schichtBruttoMinuten(schicht)).toBe(480); // 22:00 -> 06:00 next day = 8h
  });
});

describe('schichtNettoMinuten', () => {
  it('zieht Pausen von der Bruttozeit ab', () => {
    const schicht = neueSchicht(uhrzeit('06:00'), uhrzeit('12:00'));
    schicht.pausen.push(neuePause(30));
    expect(schichtNettoMinuten(schicht)).toBe(330); // 6h - 30min = 5.5h
  });

  it('ergibt die volle Bruttozeit, wenn keine Pause eingetragen ist', () => {
    const schicht = neueSchicht(uhrzeit('14:00'), uhrzeit('20:15'));
    expect(schichtNettoMinuten(schicht)).toBe(375);
  });
});

describe('minutenZuDezimalstunden', () => {
  it('rundet auf 2 Nachkommastellen ohne Float-Artefakte', () => {
    expect(minutenZuDezimalstunden(330)).toBe(5.5);
    expect(minutenZuDezimalstunden(450)).toBe(7.5);
    expect(minutenZuDezimalstunden(30)).toBe(0.5);
    expect(minutenZuDezimalstunden(400)).toBeCloseTo(6.67, 2);
  });
});

describe('wocheneinsatzNettoMinuten', () => {
  it('summiert mehrere Schichten pro Tag und mehrere Tage korrekt (Split-Shift)', () => {
    const mitarbeiterId = 'm1' as MitarbeiterId;
    const einsatz = leererWocheneinsatz(mitarbeiterId);

    einsatz.tage.Montag = {
      typ: 'Schicht',
      schichten: [neueSchicht(uhrzeit('06:00'), uhrzeit('08:00')), neueSchicht(uhrzeit('14:00'), uhrzeit('18:00'))],
    };
    einsatz.tage.Dienstag = { typ: 'Schicht', schichten: [neueSchicht(uhrzeit('06:00'), uhrzeit('12:30'))] };

    expect(wocheneinsatzNettoMinuten(einsatz)).toBe(2 * 60 + 4 * 60 + 6.5 * 60);
  });

  it('zählt freie Tage als 0 Minuten', () => {
    const einsatz = leererWocheneinsatz('m1' as MitarbeiterId);
    expect(wocheneinsatzNettoMinuten(einsatz)).toBe(0);
  });
});

describe('tageseintragNettoMinuten', () => {
  it('gibt 0 für einen freien Tag zurück', () => {
    expect(tageseintragNettoMinuten({ typ: 'Frei' })).toBe(0);
  });
});
