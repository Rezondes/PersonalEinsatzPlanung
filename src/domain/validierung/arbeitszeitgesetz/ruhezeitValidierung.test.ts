import { describe, it, expect } from 'vitest';
import { uhrzeit } from '@domain/shared/Uhrzeit';
import { neueSchicht } from '@domain/wochenplan/Schicht';
import type { MitarbeiterId } from '@domain/shared/ids';
import { schichtZuDatiert, validiereRuhezeitReihe } from './ruhezeitValidierung';

const m1 = 'm1' as MitarbeiterId;

describe('validiereRuhezeitReihe', () => {
  it('meldet keinen Verstoß bei genau 11 Stunden Ruhezeit', () => {
    const gestern = schichtZuDatiert('2026-09-07', neueSchicht(uhrzeit('06:00'), uhrzeit('14:00')), m1);
    const heute = schichtZuDatiert('2026-09-08', neueSchicht(uhrzeit('01:00'), uhrzeit('09:00')), m1);
    expect(validiereRuhezeitReihe([gestern, heute])).toHaveLength(0);
  });

  it('meldet einen Fehler bei weniger als 11 Stunden Ruhezeit', () => {
    const gestern = schichtZuDatiert('2026-09-07', neueSchicht(uhrzeit('06:00'), uhrzeit('14:00')), m1);
    const heute = schichtZuDatiert('2026-09-08', neueSchicht(uhrzeit('00:59'), uhrzeit('09:00')), m1);
    const ergebnisse = validiereRuhezeitReihe([gestern, heute]);
    expect(ergebnisse).toHaveLength(1);
    expect(ergebnisse[0].regel).toBe('ArbZG_5_Ruhezeit');
    expect(ergebnisse[0].schweregrad).toBe('fehler');
  });

  it('erkennt eine Nachtschicht über den Wochenwechsel hinweg (Samstag -> Montag)', () => {
    // Saturday 22:00 - Sunday 02:00 (endeFolgetag), then Monday 06:00 -> 28h gap, clearly enough
    const samstagNacht = schichtZuDatiert('2026-09-05', neueSchicht(uhrzeit('22:00'), uhrzeit('02:00'), true), m1);
    const montagFrueh = schichtZuDatiert('2026-09-07', neueSchicht(uhrzeit('06:00'), uhrzeit('14:00')), m1);
    expect(validiereRuhezeitReihe([samstagNacht, montagFrueh])).toHaveLength(0);

    // Tight case: night shift ends Sunday 09:00, next shift Sunday 19:00 -> only 10h rest
    const nachtschicht = schichtZuDatiert('2026-09-06', neueSchicht(uhrzeit('23:00'), uhrzeit('09:00'), true), m1);
    const abendschicht = schichtZuDatiert('2026-09-07', neueSchicht(uhrzeit('19:00'), uhrzeit('23:00')), m1);
    const ergebnisse = validiereRuhezeitReihe([nachtschicht, abendschicht]);
    expect(ergebnisse).toHaveLength(1);
    expect(ergebnisse[0].regel).toBe('ArbZG_5_Ruhezeit');
  });

  it('erkennt überschneidende Schichten als Fehler statt als negative Ruhezeit', () => {
    const erste = schichtZuDatiert('2026-09-07', neueSchicht(uhrzeit('06:00'), uhrzeit('14:00')), m1);
    const zweite = schichtZuDatiert('2026-09-07', neueSchicht(uhrzeit('13:00'), uhrzeit('20:00')), m1);
    const ergebnisse = validiereRuhezeitReihe([erste, zweite]);
    expect(ergebnisse).toHaveLength(1);
    expect(ergebnisse[0].regel).toBe('Schichtueberschneidung');
  });

  it('funktioniert unabhängig von der Reihenfolge der Eingabe (wird intern sortiert)', () => {
    const gestern = schichtZuDatiert('2026-09-07', neueSchicht(uhrzeit('06:00'), uhrzeit('14:00')), m1);
    const heute = schichtZuDatiert('2026-09-08', neueSchicht(uhrzeit('00:59'), uhrzeit('09:00')), m1);
    expect(validiereRuhezeitReihe([heute, gestern])).toHaveLength(1);
  });

  it('bleibt über das DST-Wochenende Ende Oktober korrekt (Zeitumstellung)', () => {
    // Night of Oct 25, 2026 (summer->winter DST change in DE): shift ends 23:00, next starts Oct 26 10:00
    const freitag = schichtZuDatiert('2026-10-24', neueSchicht(uhrzeit('15:00'), uhrzeit('23:00')), m1);
    const montag = schichtZuDatiert('2026-10-26', neueSchicht(uhrzeit('10:00'), uhrzeit('18:00')), m1);
    // Almost 2 calendar days apart -> clearly no violation; checks that Date arithmetic doesn't crash/skew across DST
    expect(validiereRuhezeitReihe([freitag, montag])).toHaveLength(0);
  });
});
