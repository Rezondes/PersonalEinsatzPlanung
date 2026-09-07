import { erstelleFilialeService } from '@application/filiale/filialeService';
import { erstelleMitarbeiterService } from '@application/mitarbeiter/mitarbeiterService';
import { erstelleWochenplanService } from '@application/wochenplan/wochenplanService';
import { erstelleRuhezeitPruefungService } from '@application/wochenplan/ruhezeitPruefungService';
import { erstelleAbwesenheitService } from '@application/abwesenheit/abwesenheitService';
import { erstelleDatenExportService } from '@application/export/datenExportService';
import { repositories } from './repositories';
import { transaktion } from './persistence/db';

/** Composition of the application services with the concrete repository implementations - the only
 * place where application/* and infrastructure/* are wired together. The UI layer imports
 * exclusively from here, never a Dexie repository class directly. */
export const services = {
  filiale: erstelleFilialeService(repositories.filiale),
  mitarbeiter: erstelleMitarbeiterService(repositories.mitarbeiter),
  wochenplan: erstelleWochenplanService(repositories.wochenplan, repositories.mitarbeiter),
  ruhezeitPruefung: erstelleRuhezeitPruefungService(repositories.wochenplan),
  abwesenheit: erstelleAbwesenheitService(repositories.abwesenheit),
  datenExport: erstelleDatenExportService({ ...repositories, transaktion }),
};
