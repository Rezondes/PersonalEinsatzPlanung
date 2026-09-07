import { DexieFilialeRepository } from './persistence/DexieFilialeRepository';
import { DexieMitarbeiterRepository } from './persistence/DexieMitarbeiterRepository';
import { DexieWochenplanRepository } from './persistence/DexieWochenplanRepository';
import { DexieAbwesenheitRepository } from './persistence/DexieAbwesenheitRepository';

/**
 * Simple manual composition (no DI framework needed): the application layer only knows the
 * port interfaces; the UI layer gets the concrete implementations from here.
 */
export const repositories = {
  filiale: new DexieFilialeRepository(),
  mitarbeiter: new DexieMitarbeiterRepository(),
  wochenplan: new DexieWochenplanRepository(),
  abwesenheit: new DexieAbwesenheitRepository(),
};
