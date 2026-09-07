export type Beschaeftigungsart =
  | { typ: 'Vollzeit' | 'Teilzeit'; wochenstunden: number }
  | { typ: 'Minijob'; minStunden: number; maxStunden: number };

export function sollWochenstunden(art: Beschaeftigungsart): number {
  return art.typ === 'Minijob' ? art.maxStunden : art.wochenstunden;
}

export function beschaeftigungsartLabel(art: Beschaeftigungsart): string {
  switch (art.typ) {
    case 'Vollzeit':
      return 'Vollzeit';
    case 'Teilzeit':
      return 'Teilzeit';
    case 'Minijob':
      return 'Geringfügig beschäftigt';
  }
}
