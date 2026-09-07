export interface Adresse {
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
}

export function leereAdresse(): Adresse {
  return { strasse: '', hausnummer: '', plz: '', ort: '' };
}
