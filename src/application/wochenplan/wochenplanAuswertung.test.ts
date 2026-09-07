import { describe, it, expect } from 'vitest';
import type { FilialId, MitarbeiterId } from '@domain/shared/ids';
import type { Kalenderwoche } from '@domain/shared/Kalenderwoche';
import { neuerWochenplan, mitSollAnpassung } from '@domain/wochenplan/Wochenplan';
import type { Beschaeftigungsart } from '@domain/mitarbeiter/Beschaeftigungsart';
import { erstelleWochenAnsicht, effektiveSollMinuten } from './wochenplanAuswertung';

const filialeId = 'f1' as FilialId;
const kw: Kalenderwoche = { jahr: 2026, woche: 37 };
const m1 = 'm1' as MitarbeiterId;

const vollzeit: Beschaeftigungsart = { typ: 'Vollzeit', wochenstunden: 30 };
const minijob: Beschaeftigungsart = { typ: 'Minijob', minStunden: 6, maxStunden: 10 };

describe('effektiveSollMinuten', () => {
  it('entspricht den Vertragsstunden ohne Anpassung', () => {
    expect(effektiveSollMinuten({ beschaeftigungsart: vollzeit }, { sollAnpassungMinuten: 0 })).toBe(30 * 60);
  });

  it('addiert eine positive Anpassung (Rückstand aus Vorwoche)', () => {
    expect(effektiveSollMinuten({ beschaeftigungsart: vollzeit }, { sollAnpassungMinuten: 180 })).toBe(30 * 60 + 180);
  });

  it('subtrahiert bei negativer Anpassung (Vorwoche im Plus gearbeitet)', () => {
    expect(effektiveSollMinuten({ beschaeftigungsart: vollzeit }, { sollAnpassungMinuten: -120 })).toBe(30 * 60 - 120);
  });

  it('nutzt bei Minijob die Maximalstunden als Basis', () => {
    expect(effektiveSollMinuten({ beschaeftigungsart: minijob }, { sollAnpassungMinuten: 0 })).toBe(10 * 60);
  });
});

describe('erstelleWochenAnsicht - sollAnpassungMinuten', () => {
  it('reicht sollAnpassungMinuten aus dem Einsatz durch', () => {
    const plan = mitSollAnpassung(neuerWochenplan(filialeId, kw, [m1]), m1, 90);
    const [einsatz] = erstelleWochenAnsicht(plan, []);
    expect(einsatz.sollAnpassungMinuten).toBe(90);
  });

  it('liefert 0, wenn keine Anpassung gesetzt wurde', () => {
    const plan = neuerWochenplan(filialeId, kw, [m1]);
    const [einsatz] = erstelleWochenAnsicht(plan, []);
    expect(einsatz.sollAnpassungMinuten).toBe(0);
  });
});
