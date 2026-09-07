import { uhrzeitZuMinuten } from '@domain/shared/Uhrzeit';
import { WOCHENTAGE } from '@domain/shared/Kalenderwoche';
import type { Schicht } from './Schicht';
import type { Tageseintrag, MitarbeiterWocheneinsatz } from './MitarbeiterWocheneinsatz';

export function schichtBruttoMinuten(schicht: Schicht): number {
  const beginn = uhrzeitZuMinuten(schicht.beginn);
  let ende = uhrzeitZuMinuten(schicht.ende);
  if (schicht.endeFolgetag) {
    ende += 24 * 60;
  }
  return ende - beginn;
}

export function schichtPausenMinuten(schicht: Schicht): number {
  return schicht.pausen.reduce((summe, pause) => summe + pause.dauerMinuten, 0);
}

export function schichtNettoMinuten(schicht: Schicht): number {
  return schichtBruttoMinuten(schicht) - schichtPausenMinuten(schicht);
}

export function tageseintragNettoMinuten(eintrag: Tageseintrag): number {
  return eintrag.typ === 'Schicht' ? eintrag.schichten.reduce((summe, s) => summe + schichtNettoMinuten(s), 0) : 0;
}

export function wocheneinsatzNettoMinuten(einsatz: MitarbeiterWocheneinsatz): number {
  return WOCHENTAGE.reduce((summe, tag) => summe + tageseintragNettoMinuten(einsatz.tage[tag]), 0);
}

/** Rounds to 2 decimal places (e.g. 7.5 hrs) to avoid float rounding artifacts in the display. */
export function minutenZuDezimalstunden(minuten: number): number {
  return Math.round((minuten / 60) * 100) / 100;
}
