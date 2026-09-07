import { describe, it, expect } from 'vitest';
import { addDays, differenceInCalendarDays } from 'date-fns';
import {
  kalenderwocheVonDatum,
  montagDerWoche,
  datumFuerWochentag,
  kalenderwocheDavor,
  kalenderwocheDanach,
  kalenderwochenGleich,
  kalenderwochenImMonat,
} from './Kalenderwoche';

describe('kalenderwocheVonDatum / montagDerWoche', () => {
  it('der 4. Januar gehört per ISO-8601-Definition immer zu KW1 seines Jahres', () => {
    for (const jahr of [2023, 2024, 2025, 2026, 2027, 2028]) {
      const kw = kalenderwocheVonDatum(new Date(jahr, 0, 4));
      expect(kw.woche).toBe(1);
      expect(kw.jahr).toBe(jahr);
    }
  });

  it('montagDerWoche liefert stets einen Montag, und das Ausgangsdatum liegt in dieser Woche', () => {
    const stichtage = [
      new Date(2024, 11, 30), // year-boundary edge case
      new Date(2025, 0, 1),
      new Date(2025, 11, 29), // week-53 candidate
      new Date(2026, 8, 7),
      new Date(2027, 5, 15),
    ];
    for (const datum of stichtage) {
      const kw = kalenderwocheVonDatum(datum);
      const montag = montagDerWoche(kw);
      expect(montag.getDay()).toBe(1); // 1 = Monday
      const abstand = differenceInCalendarDays(datum, montag);
      expect(abstand).toBeGreaterThanOrEqual(0);
      expect(abstand).toBeLessThanOrEqual(6);
    }
  });

  it('ist über Jahreswechsel hinweg konsistent (roundtrip für jeden Tag in einem Zeitraum)', () => {
    let datum = new Date(2024, 11, 1);
    const ende = new Date(2026, 1, 1);
    while (datum <= ende) {
      const kw = kalenderwocheVonDatum(datum);
      const montag = montagDerWoche(kw);
      const kwZurueck = kalenderwocheVonDatum(montag);
      expect(kalenderwochenGleich(kw, kwZurueck)).toBe(true);
      datum = addDays(datum, 1);
    }
  });
});

describe('datumFuerWochentag', () => {
  it('Montag entspricht montagDerWoche, Sonntag liegt 6 Tage danach', () => {
    const kw = kalenderwocheVonDatum(new Date(2026, 8, 7));
    expect(datumFuerWochentag(kw, 'Montag').getTime()).toBe(montagDerWoche(kw).getTime());
    expect(differenceInCalendarDays(datumFuerWochentag(kw, 'Sonntag'), montagDerWoche(kw))).toBe(6);
  });
});

describe('kalenderwocheDavor / kalenderwocheDanach', () => {
  it('sind zueinander invers', () => {
    const kw = kalenderwocheVonDatum(new Date(2026, 0, 1));
    expect(kalenderwochenGleich(kalenderwocheDanach(kalenderwocheDavor(kw)), kw)).toBe(true);
    expect(kalenderwochenGleich(kalenderwocheDavor(kalenderwocheDanach(kw)), kw)).toBe(true);
  });

  it('funktioniert korrekt über einen Jahreswechsel hinweg', () => {
    const ersteKwDesJahres = kalenderwocheVonDatum(new Date(2026, 0, 4));
    const vorherige = kalenderwocheDavor(ersteKwDesJahres);
    expect(vorherige.jahr).toBeLessThanOrEqual(2026);
    expect(kalenderwochenGleich(kalenderwocheDanach(vorherige), ersteKwDesJahres)).toBe(true);
  });
});

describe('kalenderwochenImMonat', () => {
  it('liefert nur Wochen, deren Montag tatsächlich im angefragten Monat liegt', () => {
    const wochen = kalenderwochenImMonat(2026, 9);
    for (const kw of wochen) {
      const montag = montagDerWoche(kw);
      expect(montag.getFullYear()).toBe(2026);
      expect(montag.getMonth()).toBe(8); // September = index 8
    }
    expect(wochen.length).toBeGreaterThanOrEqual(4);
    expect(wochen.length).toBeLessThanOrEqual(5);
  });
});
