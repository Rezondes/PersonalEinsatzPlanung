import { describe, it, expect } from 'vitest';
import type { FilialId, MitarbeiterId } from '@domain/shared/ids';
import type { Kalenderwoche } from '@domain/shared/Kalenderwoche';
import { neuerWochenplan, mitSollAnpassung, einsatzFuerMitarbeiter } from './Wochenplan';

const filialeId = 'f1' as FilialId;
const kw: Kalenderwoche = { jahr: 2026, woche: 37 };
const m1 = 'm1' as MitarbeiterId;
const m2 = 'm2' as MitarbeiterId;

describe('mitSollAnpassung', () => {
  it('setzt sollAnpassungMinuten für einen bereits vorhandenen Einsatz', () => {
    const plan = neuerWochenplan(filialeId, kw, [m1, m2]);
    const aktualisiert = mitSollAnpassung(plan, m1, 180);

    expect(einsatzFuerMitarbeiter(aktualisiert, m1)?.sollAnpassungMinuten).toBe(180);
    expect(einsatzFuerMitarbeiter(aktualisiert, m2)?.sollAnpassungMinuten).toBeUndefined();
  });

  it('legt einen neuen Einsatz an, wenn der Mitarbeiter noch nicht im Plan ist', () => {
    const plan = neuerWochenplan(filialeId, kw, []);
    const aktualisiert = mitSollAnpassung(plan, m1, -120);

    expect(aktualisiert.mitarbeiterEinsaetze).toHaveLength(1);
    expect(einsatzFuerMitarbeiter(aktualisiert, m1)?.sollAnpassungMinuten).toBe(-120);
  });

  it('lässt andere Felder des Einsatzes unverändert', () => {
    const plan = neuerWochenplan(filialeId, kw, [m1]);
    const aktualisiert = mitSollAnpassung(plan, m1, 60);

    expect(einsatzFuerMitarbeiter(aktualisiert, m1)?.tage.Montag).toEqual({ typ: 'Frei' });
  });

  it('überschreibt einen bereits gesetzten Wert', () => {
    const plan = neuerWochenplan(filialeId, kw, [m1]);
    const einmal = mitSollAnpassung(plan, m1, 60);
    const nochmal = mitSollAnpassung(einmal, m1, -30);

    expect(einsatzFuerMitarbeiter(nochmal, m1)?.sollAnpassungMinuten).toBe(-30);
  });
});
