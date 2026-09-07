import { addDays } from 'date-fns';
import { toISODatum } from '@domain/shared/Zeitspanne';
import type { Bundesland } from '@domain/filiale/Filiale';

/** Easter Sunday via the Meeus/Jones/Butcher algorithm (Gregorian calendar). */
function ostersonntag(jahr: number): Date {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(jahr, monat - 1, tag);
}

/** Nationwide holidays (legally recognized in all 16 Bundesländer). */
function bundesweiteFeiertage(jahr: number): Date[] {
  const ostern = ostersonntag(jahr);
  return [
    new Date(jahr, 0, 1), // New Year's Day
    addDays(ostern, -2), // Good Friday
    addDays(ostern, 1), // Easter Monday
    new Date(jahr, 4, 1), // Labor Day
    addDays(ostern, 39), // Ascension Day
    addDays(ostern, 50), // Whit Monday
    new Date(jahr, 9, 3), // German Unity Day
    new Date(jahr, 11, 25), // Christmas Day
    new Date(jahr, 11, 26), // 2nd Christmas Day (Boxing Day)
  ];
}

/** Additional state-specific holidays. Not exhaustive/legally verified; serves as
 * reference data for Sunday/holiday validation, not legal advice. */
function landesspezifischeFeiertage(jahr: number, bundesland: Bundesland): Date[] {
  const ostern = ostersonntag(jahr);
  const feiertage: Date[] = [];

  const heiligeDreiKoenige: Bundesland[] = ['Baden-Württemberg', 'Bayern', 'Sachsen-Anhalt'];
  const fronleichnam: Bundesland[] = ['Baden-Württemberg', 'Bayern', 'Hessen', 'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland'];
  const mariaeHimmelfahrt: Bundesland[] = ['Saarland'];
  const reformationstag: Bundesland[] = [
    'Brandenburg', 'Bremen', 'Hamburg', 'Mecklenburg-Vorpommern', 'Niedersachsen',
    'Sachsen', 'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen',
  ];
  const allerheiligen: Bundesland[] = ['Baden-Württemberg', 'Bayern', 'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland'];
  const weltkindertag: Bundesland[] = ['Thüringen'];
  const frauentag: Bundesland[] = ['Berlin', 'Mecklenburg-Vorpommern'];

  if (heiligeDreiKoenige.includes(bundesland)) feiertage.push(new Date(jahr, 0, 6));
  if (frauentag.includes(bundesland)) feiertage.push(new Date(jahr, 2, 8));
  if (fronleichnam.includes(bundesland)) feiertage.push(addDays(ostern, 60));
  if (mariaeHimmelfahrt.includes(bundesland)) feiertage.push(new Date(jahr, 7, 15));
  if (weltkindertag.includes(bundesland)) feiertage.push(new Date(jahr, 8, 20));
  if (reformationstag.includes(bundesland)) feiertage.push(new Date(jahr, 9, 31));
  if (allerheiligen.includes(bundesland)) feiertage.push(new Date(jahr, 10, 1));

  return feiertage;
}

export function feiertageFuerJahrUndBundesland(jahr: number, bundesland: Bundesland): Set<string> {
  const alle = [...bundesweiteFeiertage(jahr), ...landesspezifischeFeiertage(jahr, bundesland)];
  return new Set(alle.map(toISODatum));
}

/** Creates an `istFeiertag` function for injection into the domain validation
 * (`sonntagsFeiertagsValidierung.ts`), which itself has no Bundesland knowledge. */
export function erstelleFeiertagsPruefung(bundesland: Bundesland): (isoDatum: string) => boolean {
  const cache = new Map<number, Set<string>>();
  return (isoDatum: string) => {
    const jahr = Number(isoDatum.slice(0, 4));
    if (!cache.has(jahr)) {
      cache.set(jahr, feiertageFuerJahrUndBundesland(jahr, bundesland));
    }
    return cache.get(jahr)!.has(isoDatum);
  };
}
