import { describe, it, expect } from 'vitest';
import { uhrzeit } from '@domain/shared/Uhrzeit';
import { neueSchicht } from '@domain/wochenplan/Schicht';
import { neuePause } from '@domain/wochenplan/Pause';
import type { MitarbeiterId } from '@domain/shared/ids';
import { validierePausen } from './pausenValidierung';

const kontext = { mitarbeiterId: 'm1' as MitarbeiterId, datum: '2026-09-07' };

function fehler(ergebnisse: ReturnType<typeof validierePausen>) {
  return ergebnisse.filter((e) => e.schweregrad === 'fehler');
}

describe('validierePausen', () => {
  it('verlangt keine Pause bei genau 6 Stunden netto (Gesetz: "mehr als 6 Stunden")', () => {
    const schicht = neueSchicht(uhrzeit('06:00'), uhrzeit('12:00'));
    expect(fehler(validierePausen([schicht], kontext))).toHaveLength(0);
  });

  it('verlangt mind. 30 Min. Pause bei knapp über 6 Stunden netto', () => {
    const schicht = neueSchicht(uhrzeit('06:00'), uhrzeit('12:01'));
    expect(fehler(validierePausen([schicht], kontext))).toHaveLength(1);

    schicht.pausen.push(neuePause(30));
    // Shift now longer overall, but the break covers the 30 min -> net back to ~6h01, no error
    expect(fehler(validierePausen([schicht], kontext))).toHaveLength(0);
  });

  it('verlangt bei genau 9 Stunden netto weiterhin nur 30 Min. (45 Min. erst bei "mehr als 9 Stunden")', () => {
    // Gross span 9h30 minus 30 min. break = exactly 9h net
    const schicht = neueSchicht(uhrzeit('06:00'), uhrzeit('15:30'));
    schicht.pausen.push(neuePause(30));
    expect(fehler(validierePausen([schicht], kontext))).toHaveLength(0);
  });

  it('verlangt bei kontinuierlichen 9 Stunden ohne jede Pause trotzdem mind. 30 Min.', () => {
    const schicht = neueSchicht(uhrzeit('06:00'), uhrzeit('15:00'));
    expect(fehler(validierePausen([schicht], kontext))).toHaveLength(1);
  });

  it('verlangt mind. 45 Min. Pause bei über 9 Stunden netto', () => {
    const schicht = neueSchicht(uhrzeit('06:00'), uhrzeit('16:00'), false);
    schicht.pausen.push(neuePause(30));
    // Gross span 10h, break 30min -> net 9.5h > 9h -> 45 min required, only 30 present
    expect(fehler(validierePausen([schicht], kontext))).toHaveLength(1);

    schicht.pausen[0].dauerMinuten = 45;
    expect(fehler(validierePausen([schicht], kontext))).toHaveLength(0);
  });

  it('zählt Pausenblöcke unter 15 Minuten nicht als gesetzliche Pause (nur Warnung, kein Fehler für den Block selbst)', () => {
    const schicht = neueSchicht(uhrzeit('06:00'), uhrzeit('13:00'));
    schicht.pausen.push(neuePause(14));
    const ergebnisse = validierePausen([schicht], kontext);
    expect(ergebnisse.some((e) => e.regel === 'ArbZG_4_Pausenblock' && e.schweregrad === 'warnung')).toBe(true);
    expect(fehler(ergebnisse).some((e) => e.regel === 'ArbZG_4_Mindestpause')).toBe(true); // 14 min doesn't count -> still too little
  });

  it('zählt einen Pausenblock von genau 15 Minuten voll an', () => {
    const schicht = neueSchicht(uhrzeit('06:00'), uhrzeit('12:30'));
    schicht.pausen.push(neuePause(15), neuePause(15));
    expect(fehler(validierePausen([schicht], kontext))).toHaveLength(0);
  });

  it('summiert mehrere anrechenbare Pausenblöcke korrekt', () => {
    const schicht = neueSchicht(uhrzeit('06:00'), uhrzeit('16:00'));
    schicht.pausen.push(neuePause(20), neuePause(25)); // net 9h20 > 9h -> 45 min required, 20+25=45 is enough
    expect(fehler(validierePausen([schicht], kontext))).toHaveLength(0);
  });

  it('berücksichtigt endeFolgetag bei Nachtschichten über Mitternacht', () => {
    const schicht = neueSchicht(uhrzeit('20:00'), uhrzeit('06:00'), true); // 10h gross
    expect(fehler(validierePausen([schicht], kontext))).toHaveLength(1); // no break -> error (>9h net)

    schicht.pausen.push(neuePause(45));
    expect(fehler(validierePausen([schicht], kontext))).toHaveLength(0);
  });

  it('summiert die Nettozeit über mehrere Schichten am selben Tag (Split-Shift) statt jede isoliert zu prüfen', () => {
    // Two 4h blocks, neither individually over the 6h threshold, but together 8h -> break required
    const vormittag = neueSchicht(uhrzeit('06:00'), uhrzeit('10:00'));
    const nachmittag = neueSchicht(uhrzeit('14:00'), uhrzeit('18:00'));
    expect(fehler(validierePausen([vormittag, nachmittag], kontext))).toHaveLength(1);

    nachmittag.pausen.push(neuePause(30));
    expect(fehler(validierePausen([vormittag, nachmittag], kontext))).toHaveLength(0);
  });
});
