import type { MitarbeiterId } from '@domain/shared/ids';
import type { Kalenderwoche, Wochentag } from '@domain/shared/Kalenderwoche';
import { WOCHENTAGE, datumFuerWochentag, kalenderwochenImMonat } from '@domain/shared/Kalenderwoche';
import { toISODatum } from '@domain/shared/Zeitspanne';
import type { Wochenplan } from '@domain/wochenplan/Wochenplan';
import type { Tageseintrag } from '@domain/wochenplan/MitarbeiterWocheneinsatz';
import { tageseintragNettoMinuten } from '@domain/wochenplan/wochenplanBerechnung';
import type { Abwesenheit } from '@domain/abwesenheit/Abwesenheit';

export interface TagesAnsicht {
  tag: Wochentag;
  datum: string;
  eintrag: Tageseintrag;
  abwesenheit?: Abwesenheit;
  nettoMinuten: number;
}

export interface MitarbeiterWochenAnsicht {
  mitarbeiterId: MitarbeiterId;
  tage: TagesAnsicht[];
  gesamtNettoMinuten: number;
}

function findeAbwesenheitFuerTag(
  abwesenheiten: Abwesenheit[],
  mitarbeiterId: MitarbeiterId,
  datum: string,
): Abwesenheit | undefined {
  return abwesenheiten.find((a) => a.mitarbeiterId === mitarbeiterId && a.von <= datum && datum <= a.bis);
}

/** A halbtags-Urlaub only covers the first/last day of its range, and only the half that
 * `amBeginn`/`amEnde` marks - the entered shift for that day reflects real worked hours for the
 * other half and must not be discarded. */
function istHalbtagsAnDiesemTag(abwesenheit: Abwesenheit, datum: string): boolean {
  if (abwesenheit.art !== 'Urlaub' || !abwesenheit.halbtags) {
    return false;
  }
  return (datum === abwesenheit.von && abwesenheit.halbtags.amBeginn) ||
    (datum === abwesenheit.bis && abwesenheit.halbtags.amEnde);
}

/** On a full-day Abwesenheit, any shift still stored there does NOT count as actual hours. The shift
 * data stays in the aggregate (in case the Abwesenheit is later removed again), but is excluded from
 * hour totals as long as the Abwesenheit covers the whole day. A halbtags day keeps counting the
 * entered shift, since it represents the worked half. */
function effektiveNettoMinuten(eintrag: Tageseintrag, abwesenheit: Abwesenheit | undefined, datum: string): number {
  if (!abwesenheit || istHalbtagsAnDiesemTag(abwesenheit, datum)) {
    return tageseintragNettoMinuten(eintrag);
  }
  return 0;
}

/** Overlays Abwesenheiten onto the weekly plan at display time (instead of storing them in the aggregate),
 * avoiding sync problems between the Wochenplan and Abwesenheit aggregates. */
export function erstelleWochenAnsicht(plan: Wochenplan, abwesenheiten: Abwesenheit[]): MitarbeiterWochenAnsicht[] {
  return plan.mitarbeiterEinsaetze.map((einsatz) => {
    const tage: TagesAnsicht[] = WOCHENTAGE.map((tag) => {
      const datum = toISODatum(datumFuerWochentag(plan.kalenderwoche, tag));
      const eintrag = einsatz.tage[tag];
      const abwesenheit = findeAbwesenheitFuerTag(abwesenheiten, einsatz.mitarbeiterId, datum);
      return {
        tag,
        datum,
        eintrag,
        abwesenheit,
        nettoMinuten: effektiveNettoMinuten(eintrag, abwesenheit, datum),
      };
    });

    return {
      mitarbeiterId: einsatz.mitarbeiterId,
      tage,
      gesamtNettoMinuten: tage.reduce((summe, t) => summe + t.nettoMinuten, 0),
    };
  });
}

/** Returns a copy of the weekly plan where days with an Abwesenheit are set to "Frei". Used as the
 * basis for validation (ArbZG rules shouldn't check against leftover shifts on vacation/sick days). */
export function wochenplanOhneAbwesendeTage(plan: Wochenplan, abwesenheiten: Abwesenheit[]): Wochenplan {
  const mitarbeiterEinsaetze = plan.mitarbeiterEinsaetze.map((einsatz) => {
    const tage = Object.fromEntries(
      WOCHENTAGE.map((tag) => {
        const datum = toISODatum(datumFuerWochentag(plan.kalenderwoche, tag));
        const hatAbwesenheit = findeAbwesenheitFuerTag(abwesenheiten, einsatz.mitarbeiterId, datum) !== undefined;
        return [tag, hatAbwesenheit ? ({ typ: 'Frei' } satisfies Tageseintrag) : einsatz.tage[tag]];
      }),
    ) as Record<Wochentag, Tageseintrag>;
    return { ...einsatz, tage };
  });

  return { ...plan, mitarbeiterEinsaetze };
}

export interface MonatsWochenZeile {
  kalenderwoche: Kalenderwoche;
  nettoMinuten: number;
}

export interface MonatsZeile {
  mitarbeiterId: MitarbeiterId;
  wochen: MonatsWochenZeile[];
  gesamtNettoMinuten: number;
}

/** Aggregates multiple weekly plans into a monthly overview per employee. A calendar week belongs
 * to the month its Monday falls in (see kalenderwochenImMonat). */
export function erstelleMonatsUebersicht(
  wochenplaene: Wochenplan[],
  jahr: number,
  monat: number,
  abwesenheiten: Abwesenheit[] = [],
): MonatsZeile[] {
  const relevanteWochen = kalenderwochenImMonat(jahr, monat);
  const zeilenProMitarbeiter = new Map<MitarbeiterId, MonatsZeile>();

  for (const kw of relevanteWochen) {
    const plan = wochenplaene.find(
      (p) => p.kalenderwoche.jahr === kw.jahr && p.kalenderwoche.woche === kw.woche,
    );
    if (!plan) {
      continue;
    }

    // Reuses erstelleWochenAnsicht instead of re-walking days/Abwesenheiten here - the per-day
    // overlay logic (findeAbwesenheitFuerTag + effektiveNettoMinuten, including the halbtags
    // handling) must only exist once.
    const wochenAnsicht = erstelleWochenAnsicht(plan, abwesenheiten);

    for (const einsatz of wochenAnsicht) {
      const bestehendeZeile = zeilenProMitarbeiter.get(einsatz.mitarbeiterId);
      const wochenZeile: MonatsWochenZeile = { kalenderwoche: kw, nettoMinuten: einsatz.gesamtNettoMinuten };

      if (bestehendeZeile) {
        bestehendeZeile.wochen.push(wochenZeile);
        bestehendeZeile.gesamtNettoMinuten += einsatz.gesamtNettoMinuten;
      } else {
        zeilenProMitarbeiter.set(einsatz.mitarbeiterId, {
          mitarbeiterId: einsatz.mitarbeiterId,
          wochen: [wochenZeile],
          gesamtNettoMinuten: einsatz.gesamtNettoMinuten,
        });
      }
    }
  }

  return [...zeilenProMitarbeiter.values()];
}
