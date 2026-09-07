import { WOCHENTAGE } from '@domain/shared/Kalenderwoche';
import type { Wochentag } from '@domain/shared/Kalenderwoche';
import type { Mitarbeiter } from '@domain/mitarbeiter/Mitarbeiter';
import type { Wochenplan } from '@domain/wochenplan/Wochenplan';
import type { Abwesenheit } from '@domain/abwesenheit/Abwesenheit';
import type { Pause } from '@domain/wochenplan/Pause';
import type { Schicht } from '@domain/wochenplan/Schicht';
import { minutenZuDezimalstunden } from '@domain/wochenplan/wochenplanBerechnung';
import { erstelleWochenAnsicht } from '@application/wochenplan/wochenplanAuswertung';
import type { TagesAnsicht } from '@application/wochenplan/wochenplanAuswertung';

export function formatDezimalstunden(minuten: number): string {
  if (minuten === 0) {
    return '';
  }
  return minutenZuDezimalstunden(minuten).toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

function abwesenheitsKuerzel(abwesenheit: Abwesenheit): string {
  switch (abwesenheit.art) {
    case 'Urlaub':
      return 'U';
    case 'Krankheit':
      return 'K';
    case 'Sonstige':
      return abwesenheit.bezeichnung;
  }
}

export interface DruckPauseZelle {
  zeitText: string;
  stdText: string;
}

export interface DruckTagesZelle {
  datum: string;
  zeitText: string;
  stdText: string;
  /** Always exactly 2 entries; the paper form always has 2 break rows per day, regardless of
   * whether 0, 1, or 2 breaks were actually entered. With more than 2 breaks, the remainder is
   * summed into the second row. */
  pausen: [DruckPauseZelle, DruckPauseZelle];
  istAbwesenheit: boolean;
  abwesenheitsKuerzel?: string;
}

const LEERE_PAUSENZEILE: DruckPauseZelle = { zeitText: '', stdText: '' };

function formatPauseZelle(pause: Pause | undefined): DruckPauseZelle {
  if (!pause) {
    return LEERE_PAUSENZEILE;
  }
  return { zeitText: pause.beginn ?? '', stdText: formatDezimalstunden(pause.dauerMinuten) };
}

function pausenFuerTag(schichten: Schicht[]): [DruckPauseZelle, DruckPauseZelle] {
  const pausen = schichten.flatMap((s) => s.pausen);
  if (pausen.length <= 2) {
    return [formatPauseZelle(pausen[0]), formatPauseZelle(pausen[1])];
  }
  const restMinuten = pausen.slice(1).reduce((summe, p) => summe + p.dauerMinuten, 0);
  return [formatPauseZelle(pausen[0]), { zeitText: '', stdText: formatDezimalstunden(restMinuten) }];
}

function zuDruckZelle(tag: TagesAnsicht): DruckTagesZelle {
  // A halbtags-Urlaub day still has real worked hours (tag.nettoMinuten > 0, see
  // wochenplanAuswertung.effektiveNettoMinuten) - only a full-day Abwesenheit collapses to just the
  // Kuerzel with no shift data.
  const istGanztagsAbwesend = !!tag.abwesenheit && tag.nettoMinuten === 0;

  if (istGanztagsAbwesend && tag.abwesenheit) {
    return {
      datum: tag.datum,
      zeitText: abwesenheitsKuerzel(tag.abwesenheit),
      stdText: '',
      pausen: [LEERE_PAUSENZEILE, LEERE_PAUSENZEILE],
      istAbwesenheit: true,
      abwesenheitsKuerzel: abwesenheitsKuerzel(tag.abwesenheit),
    };
  }

  if (tag.eintrag.typ !== 'Schicht' || tag.eintrag.schichten.length === 0) {
    return {
      datum: tag.datum,
      zeitText: '',
      stdText: '',
      pausen: [LEERE_PAUSENZEILE, LEERE_PAUSENZEILE],
      istAbwesenheit: false,
    };
  }

  const zeitText = tag.eintrag.schichten.map((s) => `${s.beginn}-${s.ende}`).join(' / ');

  return {
    datum: tag.datum,
    zeitText,
    stdText: formatDezimalstunden(tag.nettoMinuten),
    pausen: pausenFuerTag(tag.eintrag.schichten),
    istAbwesenheit: false,
    abwesenheitsKuerzel: tag.abwesenheit ? abwesenheitsKuerzel(tag.abwesenheit) : undefined,
  };
}

interface DruckZeileBasis {
  mitarbeiter: Mitarbeiter;
  tage: Record<Wochentag, DruckTagesZelle>;
  gesamtstundenWoche: string;
}

export interface DruckZeileVollTeilzeit extends DruckZeileBasis {
  wochenstunden: number;
}

export interface DruckZeileMinijob extends DruckZeileBasis {
  minStunden: number;
  maxStunden: number;
}

export interface DruckDaten {
  vollTeilzeitZeilen: DruckZeileVollTeilzeit[];
  minijobZeilen: DruckZeileMinijob[];
  /** Sum of net hours across all employees per weekday (decimal hours, rounded). */
  tagessummen: Record<Wochentag, number>;
}

/**
 * Prepares the weekly-plan data for print export (form 1: full-/part-time vs. form 2:
 * Minijob). Contains NO calculation logic of its own; relies exclusively on wochenplanBerechnung.ts
 * (via erstelleWochenAnsicht), same as the interactive view, to avoid duplication.
 */
export function bereiteDruckDatenAuf(
  plan: Wochenplan,
  mitarbeiterListe: Mitarbeiter[],
  abwesenheiten: Abwesenheit[],
): DruckDaten {
  const wochenAnsicht = erstelleWochenAnsicht(plan, abwesenheiten);

  const vollTeilzeitZeilen: DruckZeileVollTeilzeit[] = [];
  const minijobZeilen: DruckZeileMinijob[] = [];
  const tagessummenMinuten: Record<Wochentag, number> = Object.fromEntries(
    WOCHENTAGE.map((tag) => [tag, 0]),
  ) as Record<Wochentag, number>;

  for (const einsatz of wochenAnsicht) {
    const mitarbeiter = mitarbeiterListe.find((m) => m.id === einsatz.mitarbeiterId);
    if (!mitarbeiter) {
      continue;
    }

    for (const tagesAnsicht of einsatz.tage) {
      tagessummenMinuten[tagesAnsicht.tag] += tagesAnsicht.nettoMinuten;
    }

    const tage = Object.fromEntries(einsatz.tage.map((t) => [t.tag, zuDruckZelle(t)])) as Record<
      Wochentag,
      DruckTagesZelle
    >;

    const basis: DruckZeileBasis = {
      mitarbeiter,
      tage,
      gesamtstundenWoche: formatDezimalstunden(einsatz.gesamtNettoMinuten),
    };

    if (mitarbeiter.beschaeftigungsart.typ === 'Minijob') {
      minijobZeilen.push({
        ...basis,
        minStunden: mitarbeiter.beschaeftigungsart.minStunden,
        maxStunden: mitarbeiter.beschaeftigungsart.maxStunden,
      });
    } else {
      vollTeilzeitZeilen.push({ ...basis, wochenstunden: mitarbeiter.beschaeftigungsart.wochenstunden });
    }
  }

  const tagessummen = Object.fromEntries(
    WOCHENTAGE.map((tag) => [tag, minutenZuDezimalstunden(tagessummenMinuten[tag])]),
  ) as Record<Wochentag, number>;

  return { vollTeilzeitZeilen, minijobZeilen, tagessummen };
}
