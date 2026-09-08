# Personaleinsatzplanung (PEP)

Web-App zur digitalen Personaleinsatzplanung fuer kleine Einzelhandelsfilialen. Ersetzt die bisherige papierbasierte Wochenplanung durch eine
lokale, datenschutzfreundliche Anwendung ohne Server-Backend.

> **Status: In aktiver Entwicklung.** Diese Software ist noch nicht fuer den produktiven Einsatz
> freigegeben und kann Fehler enthalten. Es wird keinerlei Haftung fuer Fehler, Datenverlust oder
> daraus resultierende Schaeden uebernommen. Nutzung auf eigenes Risiko. Siehe auch [LICENSE](./LICENSE).

## Kernfunktionen

- Wochen- und Monatsplanung fuer Voll-/Teilzeitkraefte sowie Minijobber
- Automatische Pruefung gesetzlicher Vorgaben (ArbZG): Pausenzeiten, Ruhezeiten,
  Hoechstarbeitszeit, Sonntags-/Feiertagsarbeit
- Urlaubs- und Krankheitsverwaltung inkl. Resturlaubsberechnung
- Druckexport im Layout der bisherigen Papierformulare
- Unterstuetzung mehrerer Filialen
- Keine Serveranbindung: alle Daten bleiben ausschliesslich lokal im Browser (IndexedDB), Transfer
  nur per manuellem JSON-Export/-Import

## Tech-Stack

React, TypeScript, Vite, Material UI, Dexie (IndexedDB), Zustand

## Setup

```bash
npm install
npm run dev
```

Weitere Skripte: `npm run build`, `npm run test`, `npm run lint`.

## Architektur

DDD-inspirierte Schichtenarchitektur (`domain` -> `application` -> `infrastructure` -> `ui`), per
ESLint-Regel gegen Schichtverletzungen abgesichert. Details und Hintergrundentscheidungen stehen in
den `CLAUDE.md`-Dateien der jeweiligen Verzeichnisse.

## Lizenz

Proprietaer, alle Rechte vorbehalten. Siehe [LICENSE](./LICENSE) - keine Nutzung, Vervielfaeltigung
oder Weitergabe ohne ausdrueckliche Genehmigung.

---

*Diese README ist bewusst knapp gehalten und wird mit fortschreitender Entwicklung ausgebaut.*
