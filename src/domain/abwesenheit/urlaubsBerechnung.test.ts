import { describe, it, expect } from 'vitest';
import type { MitarbeiterId } from '@domain/shared/ids';
import { neueAbwesenheit } from './Abwesenheit';
import { zaehleWerktage, zaehleUrlaubstageInZeitraum, berechneResturlaub } from './urlaubsBerechnung';

const m1 = 'm1' as MitarbeiterId;

describe('zaehleWerktage', () => {
  it('zählt Mo-Sa als Werktage und schließt Sonntag aus', () => {
    // 2026-09-07 = Monday, 2026-09-13 = Sunday -> full week
    expect(zaehleWerktage('2026-09-07', '2026-09-13')).toBe(6);
  });

  it('zählt einen einzelnen Werktag als 1', () => {
    expect(zaehleWerktage('2026-09-07', '2026-09-07')).toBe(1);
  });

  it('berücksichtigt Halbtage am Anfang und Ende', () => {
    expect(zaehleWerktage('2026-09-07', '2026-09-09', { amBeginn: true, amEnde: false })).toBe(2.5);
    expect(zaehleWerktage('2026-09-07', '2026-09-09', { amBeginn: false, amEnde: true })).toBe(2.5);
  });

  it('zählt einen einzelnen Halbtag als 0,5 statt 0, auch wenn beide Flags gesetzt sind', () => {
    expect(zaehleWerktage('2026-09-07', '2026-09-07', { amBeginn: true, amEnde: false })).toBe(0.5);
    expect(zaehleWerktage('2026-09-07', '2026-09-07', { amBeginn: false, amEnde: true })).toBe(0.5);
    expect(zaehleWerktage('2026-09-07', '2026-09-07', { amBeginn: true, amEnde: true })).toBe(0.5);
  });

  it('zählt Feiertage nicht als Urlaubstag, wenn istFeiertag übergeben wird', () => {
    // 2026-10-03 (Sa) = Tag der Deutschen Einheit, nationaler Feiertag
    const istFeiertag = (d: string) => d === '2026-10-03';
    expect(zaehleWerktage('2026-09-30', '2026-10-03', undefined, istFeiertag)).toBe(3); // Mi,Do,Fr work, Sa is a holiday
    expect(zaehleWerktage('2026-09-30', '2026-10-03')).toBe(4); // without istFeiertag, Saturday counts normally
  });
});

describe('zaehleUrlaubstageInZeitraum', () => {
  it('summiert nur Abwesenheiten vom Typ Urlaub im gegebenen Jahr', () => {
    const abwesenheiten = [
      neueAbwesenheit({ mitarbeiterId: m1, art: 'Urlaub', von: '2026-09-07', bis: '2026-09-11' }), // 5 work days
      neueAbwesenheit({ mitarbeiterId: m1, art: 'Krankheit', von: '2026-03-01', bis: '2026-03-03' }),
      neueAbwesenheit({ mitarbeiterId: m1, art: 'Urlaub', von: '2025-12-01', bis: '2025-12-05' }), // different year
    ];
    expect(zaehleUrlaubstageInZeitraum(abwesenheiten, 2026)).toBe(5);
  });

  it('teilt eine Abwesenheit über den Jahreswechsel korrekt auf beide Jahre auf', () => {
    // 2026-12-29 (Di) - 2027-01-02 (Sa): 3 work days in 2026 (Di,Mi,Do), 2 work days in 2027 (Fr,Sa)
    const abwesenheiten = [neueAbwesenheit({ mitarbeiterId: m1, art: 'Urlaub', von: '2026-12-29', bis: '2027-01-02' })];
    expect(zaehleUrlaubstageInZeitraum(abwesenheiten, 2026)).toBe(3);
    expect(zaehleUrlaubstageInZeitraum(abwesenheiten, 2027)).toBe(2);
  });

  it('wendet Halbtage am Jahreswechsel nur auf das echte Anfangs-/Enddatum an, nicht auf die Kappungsgrenze', () => {
    const abwesenheiten = [
      neueAbwesenheit({
        mitarbeiterId: m1,
        art: 'Urlaub',
        von: '2026-12-30',
        bis: '2027-01-04',
        halbtags: { amBeginn: true, amEnde: true },
      }),
    ];
    // 2026-12-30 (Mi, halbtags) - 2026-12-31 (Do) = 1.5 work days in 2026
    expect(zaehleUrlaubstageInZeitraum(abwesenheiten, 2026)).toBe(1.5);
    // 2027-01-01 (Fr) - 2027-01-04 (Mo, halbtags), Sunday excluded = 3 work days - 0.5 = 2.5 in 2027
    expect(zaehleUrlaubstageInZeitraum(abwesenheiten, 2027)).toBe(2.5);
  });
});

describe('berechneResturlaub', () => {
  it('zieht genommene Tage vom Jahresanspruch ab', () => {
    expect(berechneResturlaub({ urlaubsanspruchProJahr: 28 }, 10)).toBe(18);
  });
});
