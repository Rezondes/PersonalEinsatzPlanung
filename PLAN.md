# Plan: Seitenüberschriften, Wochenplanung-Layout, Vorlagen für alle Eintragsarten (Teil 9)

## Überblick

| # | Package | Ziel in einem Satz | Abhängig von | Punkt |
|---|---------|--------------------|--------------|-------|
| 1 | Seitenüberschriften unsichtbar | Die Seitenüberschriften sind für Nutzer unsichtbar, für Screenreader und den Fokus nach Seitenwechsel aber weiter da | - | 1 |
| 2 | Seitenleiste "Wochendetails" | Es gibt eine einklappbare Seitenleiste mit Kennzahlen, Wochenangaben und Wochenaktionen, deren Zustand pro Gerät erhalten bleibt | - | 2 |
| 3 | Wochenplanung: Tabelle im Mittelpunkt | Auf dem Desktop stehen über der Tabelle nur noch eine Kopfzeile und die Vorlagen-Toolbar, alles andere liegt in der Seitenleiste | 1, 2 | 2 |
| 4 | Vorlagen für Urlaub, Krankheit, Feiertag | Vorlagen können jede Eintragsart tragen, auch Urlaub (mit Halbtag), Krankheit und Feiertag mit angerechneten Stunden | - | 3 |
| 5 | Kopieren, Einfügen, "Als Vorlage speichern" für Abwesenheiten | Eine Zelle mit Urlaub, Krankheit, Feiertag oder Sonstiges lässt sich kopieren, einfügen und als Vorlage speichern | 4 | 3 |

Punkt 2 und Punkt 3 der Anfrage sind je in zwei Packages geteilt, damit jedes in einem Zug grün und commitfähig bleibt: die Seitenleiste ist eine eigenständige, für sich testbare Komponente (P2), das Umbauen der Wochenplanung nutzt sie (P3); die neuen Vorlagenarten (P4) sind die Grundlage, auf der das Kopieren von Abwesenheiten (P5) aufsetzt.

Parallel möglich: P1, P2 und P4 sind unabhängig. P3 wartet auf P1 und P2 (dieselbe Kopfzeile in `ScheduleView.tsx`), P5 auf P4. Gemeinsam berührte Datei: `src/ui/views/schedule/ScheduleView.tsx` (P1, P3, P4, P5) - nacheinander umsetzen.

## Annahmen

Vom Nutzer am 2026-10-06 entschieden:

- **P1:** Die Überschriften bleiben im Code, werden aber für Nutzer unsichtbar (visuell versteckt, nicht entfernt). Screenreader und der h1-Fokus nach Seitenwechsel (Teil 6, Package 7) funktionieren weiter.
- **P2/P3:** Layout "Einklappbare Seitenleiste": Kopfzeile nur mit KW-Navigation, Rückgängig/Wiederholen und dem Schalter für die Seitenleiste. Kennzahlen, Wochenangaben (Wochenumsatz/-stunden) und Wochenaktionen (Vorwoche übertragen, Vorwoche kopieren, Drucken) liegen in einer rechten Seitenleiste. Die Vorlagen-Toolbar bleibt direkt über der Tabelle.
- **P3:** Die Zeilenhöhe der Tabelle bleibt (Name, Tätigkeit, Ist/Soll in der Namensspalte).
- **P4:** Eine Vorlage für Urlaub, Krankheit oder Feiertag speichert den Typ, bei Urlaub den Halbtag (ganz / vormittags / nachmittags) und optional angerechnete Stunden, wie der Abwesenheits-Dialog.

Eigene Annahmen:

- **P1:** Betroffen sind alle Seiten mit einer Seitenüberschrift: Wochenplanung, Monatsübersicht, Mitarbeiter, Abwesenheiten, Filialen, Änderungen, Einstellungen, Datenschutz, Nutzungsbedingungen, Mehr. Ausnahme: die Fehlerseite (`RouteErrorPage`), deren Überschrift "Seite nicht gefunden" / "Etwas ist schiefgelaufen" die Meldung selbst ist und sichtbar bleibt.
- **P1:** Der Info-Knopf "Hinweis zur Prüfung" der Monatsübersicht steht heute neben der Überschrift und zieht in die Zeile der Monatsnavigation (rechts neben dem Monatsnamen).
- **P2:** Die Seitenleiste schiebt die Tabelle zur Seite (kein Overlay), ist 280px breit und hat einen eigenen Scrollbereich. Standard beim ersten Öffnen: offen ab 1600px Fensterbreite, sonst eingeklappt; danach gilt pro Gerät, was der Nutzer zuletzt gewählt hat (`persist`-Store wie `navRailStore`).
- **P2:** Damit ArbZG-Befunde bei eingeklappter Leiste nicht verschwinden, zeigt der Schalter ein Badge mit der Zahl der Fehler (bei 0 Fehlern und Warnungen die Zahl der Warnungen in Warnfarbe; sonst kein Badge). Die Live-Region `validation-announcer` aus Teil 8 bleibt außerhalb der Leiste und sagt Änderungen weiter an.
- **P3:** Die Mitarbeitersuche bleibt in der Kopfzeile, als Lupen-Knopf, der ein Suchfeld aufklappt (dasselbe Muster wie heute am Handy). Eine aktive Suche bleibt sichtbar.
- **P3:** Das Handy-Layout (< 1025px, inkl. Querformat) bleibt unverändert; nur die Desktop-Ansicht (`layout === 'tablet'`, also >= 1025px) wird umgebaut.
- **P4:** Keine Migration und kein neuer `formatVersion`: die neuen Vorlagenarten erweitern die Union nur, alte Datensicherungen und alte IndexedDB-Datensätze bleiben gültig. Der Vorlagenname für die neuen Arten ist vorbelegt mit der Typbezeichnung ("Urlaub", "Krankheit", "Feiertag") und änderbar.
- **P4:** Mehrfachauswahl mit einer Abwesenheitsvorlage überspringt Tage, auf denen schon irgendeine Abwesenheit liegt, genau wie heute bei Sonstiges-Vorlagen (nie stilles Überschreiben von Urlaub/Krankheit).
- **P5:** Kopieren übernimmt, was die Zelle zeigt: Typ, bei Sonstiges Bezeichnung und Stunden, bei Urlaub den Halbtag. Angerechnete Stunden (`creditedMinutesOverride`) werden nicht mitkopiert, aus demselben Grund wie die manuellen Netto-Stunden einer Schicht heute (eine Korrektur für genau diesen Tag). Bei einer mehrtägigen Abwesenheit wird ein eintägiger Eintrag desselben Typs kopiert, ohne Halbtag.

Befehle für jedes Package: `npx vitest run <testdatei>` während der Arbeit, am Ende `npm test`, `npm run lint`, `npx tsc -b`, dann `graphify update .`. Jedes Package mit Änderungen an der Wochenplanung zusätzlich im Browser-Pane prüfen (Messung, keine echten Downloads/Drucke).

Gemessener Ausgangszustand (2026-10-06, Browser-Pane 1366x768, 10 Mitarbeiter, Desktop-Layout): App-Kopfleiste 8-74px, Überschrift 122-154, Wochennavigation 162-242, Suche + Wochenangaben 258-314, Kennzahlen bis ~390, Vorlagen-Toolbar 404-472, Tabellenkopf ab 489px, eine Zeile 98px hoch. Sichtbar: etwa 2 von 10 Mitarbeitern.

---

## Package 1: Seitenüberschriften unsichtbar

**Ziel:** Die Seitenüberschriften sind für Nutzer unsichtbar, für Screenreader und den Fokus nach Seitenwechsel aber weiter da.

**Abhängigkeiten:** keine

**Betroffene Dateien:**
- `src/ui/views/schedule/ScheduleView.tsx`, `src/ui/views/month/MonthOverviewView.tsx`, `src/ui/views/masterdata/EmployeeMasterDataView.tsx`, `src/ui/views/masterdata/BranchMasterDataView.tsx`, `src/ui/views/absences/AbsencesView.tsx`, `src/ui/views/changelog/ChangelogView.tsx`, `src/ui/views/settings/SettingsView.tsx`, `src/ui/views/settings/PrivacyView.tsx`, `src/ui/views/settings/TermsView.tsx`, `src/ui/app/nav/MorePage.tsx` (ändern)
- `src/ui/components/PageHeading.tsx` (neu), `src/ui/components/PageHeading.test.tsx` (neu)
- `src/ui/views/month/MonthOverviewView.test.tsx`, `src/ui/app/AppShell.test.tsx` (ändern)

### Kontext

Jede dieser Seiten rendert `<Typography variant="h5" component="h1" ...>{Titel}</Typography>`, die Wochenplanung am Handy bereits mit `VISUALLY_HIDDEN_SX` (`src/ui/components/visuallyHidden.ts`). Die Navigation zeigt den Seitennamen schon (aktiver Eintrag in NavRail/BottomTabBar), die sichtbare Überschrift kostet auf jeder Seite ~40px plus Abstand. `AppShell` setzt nach einem Seitenwechsel den Fokus auf das h1 der neuen Seite (`tabIndex=-1`), das muss weiter funktionieren. In der Monatsübersicht steht der Info-Knopf "Hinweis zur Prüfung" in derselben Zeile wie die Überschrift.

### Acceptance Criteria

- [ ] AC1: Eine gemeinsame Komponente `PageHeading` rendert ein `h1` mit `VISUALLY_HIDDEN_SX` und dem übergebenen Text.
- [ ] AC2: Alle zehn genannten Seiten nutzen `PageHeading`; sichtbar ist keine Seitenüberschrift mehr, `getByRole('heading', { level: 1 })` findet sie weiter.
- [ ] AC3: Nach einem Seitenwechsel hat das (unsichtbare) h1 weiter den Fokus (bestehender AppShell-Test bleibt grün, ein neuer prüft es mit `PageHeading`).
- [ ] AC4: Der Info-Knopf der Monatsübersicht steht in der Zeile der Monatsnavigation und funktioniert unverändert (Tooltip, `describeChild`).
- [ ] AC5: Die Fehlerseite behält ihre sichtbare Überschrift.
- [ ] AC6 (manuell): Auf jeder Seite beginnt der Inhalt direkt unter der App-Kopfleiste, ohne leere Lücke; kein Element überlappt.

### Tests (TDD)

1. `PageHeading.test.tsx > "rendert ein visuell verstecktes h1"` - AC1: `getByRole('heading', { level: 1, name: 'Mitarbeiter' })`, Stil `position: absolute`, `width: 1px`
2. Je Seite ein Test im vorhandenen Testfile (z. B. `EmployeeMasterDataView.test.tsx > "hat eine unsichtbare Seitenüberschrift"`) - AC2: h1 vorhanden und mit den Stilen aus AC1
3. `AppShell.test.tsx > "fokussiert die unsichtbare Überschrift nach einem Seitenwechsel"` - AC3
4. `MonthOverviewView.test.tsx > "Info-Knopf steht neben der Monatsnavigation"` - AC4: Knopf und "Nächster Monat" haben dasselbe Elternelement
5. `router.test.tsx` (bestehend) - AC5 bleibt grün

Testbefehl: `npx vitest run src/ui/components/PageHeading.test.tsx src/ui/views src/ui/app`

### Umsetzungsschritte

1. `PageHeading` per TDD.
2. Seite für Seite: Test rot, Überschrift durch `<PageHeading>` ersetzen, Abstände (`mb`) der nächsten Zeile prüfen, grün.
3. Info-Knopf der Monatsübersicht verschieben.
4. Manueller Check AC6 bei 1366x768 und 390x844 auf allen Seiten.

### Out of Scope

- Die übrige Neustrukturierung der Wochenplanung (P3).
- Die Überschriften innerhalb der Seiten (h2, z. B. in den Einstellungen).

---

## Package 2: Seitenleiste "Wochendetails"

**Ziel:** Es gibt eine einklappbare Seitenleiste mit Kennzahlen, Wochenangaben und Wochenaktionen, deren Zustand pro Gerät erhalten bleibt.

**Abhängigkeiten:** keine

**Betroffene Dateien:**
- `src/ui/app/store/weekSidePanelStore.ts`, `weekSidePanelStore.test.ts` (neu)
- `src/ui/views/schedule/components/WeekSidePanel.tsx`, `WeekSidePanel.test.tsx` (neu)
- `src/ui/views/schedule/components/WeekSidePanelToggle.tsx`, `WeekSidePanelToggle.test.tsx` (neu)
- `src/ui/i18n/resources/de/schedule.ts` (Texte)

### Kontext

Heute liegen Kennzahlen (Ist/Soll, ArbZG-Chip mit `ValidationNotices`-Popover, "Nicht eingeplant"), Wochenangaben (`ScheduleHeaderFields`) und Wochenaktionen (Vorwoche übertragen, Vorwoche kopieren, Drucken) als eigene Zeilen über der Tabelle in `ScheduleView.tsx`. Die Leiste fasst sie zusammen; dieses Package baut sie als eigenständige, rein darstellende Komponente (Props rein, Callbacks raus), damit P3 sie nur noch einhängen muss. `navRailStore.ts` zeigt das Muster für einen gespeicherten UI-Zustand (`zustand/middleware` `persist`).

### Acceptance Criteria

- [ ] AC1: `useWeekSidePanelStore` hat `open: boolean | null` (null = noch nie gewählt) und `setOpen`, gespeichert unter `pep-week-side-panel-open`.
- [ ] AC2: `resolveSidePanelOpen(stored, viewportWidth)` liefert `stored`, wenn gesetzt, sonst `viewportWidth >= 1600`.
- [ ] AC3: `WeekSidePanel` zeigt drei Abschnitte mit h2: "Kennzahlen" (Ist/Soll, ArbZG-Befunde mit Öffnen der Liste, Nicht eingeplant), "Wochenangaben" (die beiden Felder aus `ScheduleHeaderFields`), "Aktionen" (Vorwoche übertragen, Vorwoche kopieren, Drucken; Drucken nur, wenn ein Plan existiert).
- [ ] AC4: `WeekSidePanel` ist ein `complementary`-Landmark mit Namen "Wochendetails", 280px breit, mit eigenem Scrollbereich.
- [ ] AC5: `WeekSidePanelToggle` ist ein Knopf "Wochendetails anzeigen/ausblenden" mit `aria-expanded` und `aria-controls` auf die Leiste.
- [ ] AC6: Das Badge am Schalter zeigt bei Fehlern deren Zahl (Fehlerfarbe), sonst bei Warnungen deren Zahl (Warnfarbe), sonst nichts; der zugängliche Name nennt die Zahl ("Wochendetails anzeigen, 2 Fehler").

### Tests (TDD)

1. `weekSidePanelStore.test.ts > "merkt sich die Wahl"`, `"ist anfangs null"` - AC1
2. `weekSidePanelStore.test.ts > "Standard: offen ab 1600px, sonst zu"`, `"gespeicherte Wahl gewinnt"` - AC2
3. `WeekSidePanel.test.tsx > "zeigt die drei Abschnitte"` - AC3 (inkl. Callback-Aufrufe für die drei Aktionen, Drucken fehlt ohne Plan)
4. `WeekSidePanel.test.tsx > "ist ein benannter complementary-Bereich"` - AC4
5. `WeekSidePanelToggle.test.tsx > "meldet aria-expanded und steuert die Leiste"` - AC5
6. `WeekSidePanelToggle.test.tsx > "Badge: Fehler vor Warnungen, sonst keins"` - AC6 (drei Fälle)

Testbefehl: `npx vitest run src/ui/app/store/weekSidePanelStore.test.ts src/ui/views/schedule/components/WeekSidePanel.test.tsx src/ui/views/schedule/components/WeekSidePanelToggle.test.tsx`

### Umsetzungsschritte

1. Store und `resolveSidePanelOpen` per TDD.
2. `WeekSidePanel`: Tests, dann Komponente; Kennzahlen-Darstellung aus `ScheduleView.tsx` (KPI-Kacheln) als Teil der Leiste nachbauen, `ValidationNotices` mit seinem `renderTrigger` weiterverwenden, `ScheduleHeaderFields` unverändert einsetzen.
3. `WeekSidePanelToggle` per TDD (MUI `Badge`).
4. Grün; noch nicht in `ScheduleView` eingebaut.

### Out of Scope

- Einbau in die Wochenplanung und Entfernen der alten Zeilen (P3).

---

## Package 3: Wochenplanung: Tabelle im Mittelpunkt

**Ziel:** Auf dem Desktop stehen über der Tabelle nur noch eine Kopfzeile und die Vorlagen-Toolbar, alles andere liegt in der Seitenleiste.

**Abhängigkeiten:** Package 1, Package 2

**Betroffene Dateien:**
- `src/ui/views/schedule/ScheduleView.tsx` (ändern)
- `src/ui/views/schedule/ScheduleView.test.tsx` (ändern)
- `src/ui/views/schedule/CLAUDE.md` (Abschnitt Werkzeugleiste / Layout ergänzen)

### Kontext

Desktop-Aufbau heute (Messung oben): Überschrift, Wochennavigation mit Rückgängig/Wiederholen und drei Text-Buttons, Suche + Wochenangaben, Kennzahlen-Kacheln, Vorlagen-Toolbar, Tabelle. Die Tabelle beginnt bei 489px von 768px. Nach P1 ist die Überschrift schon unsichtbar. Die Tabelle nimmt per `flex: 1` den Rest ein (`ScheduleTable` mit `height: '100%'`), das bleibt so; der Rest wird in eine Zeile plus Seitenleiste umgezogen.

### Acceptance Criteria

- [ ] AC1: Desktop: Die Kopfzeile enthält genau Wochenlabel/-auswahl, Vorwoche/Nächste Woche, Heute, Rückgängig, Wiederholen, Suche (Lupe), Seitenleisten-Schalter. Vorwoche übertragen, Vorwoche kopieren und Drucken sind nicht mehr in der Kopfzeile.
- [ ] AC2: Desktop: Unter der Kopfzeile folgen direkt die Vorlagen-Toolbar und darunter die Tabelle; Kennzahlen-Kacheln und Wochenangaben stehen nicht mehr über der Tabelle.
- [ ] AC3: Desktop: Die Seitenleiste aus P2 steht rechts neben Toolbar und Tabelle, ihr Öffnen/Schließen ändert nur die Breite der Tabelle; Zustand nach `resolveSidePanelOpen`.
- [ ] AC4: Alle Funktionen bleiben erreichbar und verhalten sich wie vorher: Vorwoche übertragen/kopieren öffnen ihre Dialoge, Drucken navigiert zur Druckvorschau, die Wochenangaben speichern beim Verlassen des Felds, der ArbZG-Befund öffnet seine Liste.
- [ ] AC5: Die Suche: Lupe klappt das Suchfeld auf und fokussiert es; bei aktivem Suchbegriff bleibt das Feld offen; Escape leert und schließt.
- [ ] AC6: Der Ladezustand (`inert`, `aria-busy`, Spinner) deckt weiter Kopfzeile-Inhalt, Toolbar, Tabelle und Seitenleiste ab, wie in Teil 8 Package 16.
- [ ] AC7: Handy-Layout (< 1025px) ist unverändert (bestehende Mobile-Tests bleiben grün).
- [ ] AC8 (manuell, Browser-Pane): Bei 1366x768 mit 10 Mitarbeitern und eingeklappter Leiste beginnt der Tabellenkopf höchstens 230px unter der Fensteroberkante (heute 489px), mindestens 4 Mitarbeiterzeilen sind vollständig sichtbar (heute 2). Bei 1280x720 mindestens 3. Mit offener Leiste bleibt die Tabelle ohne Überlappung bedienbar (horizontales Scrollen innerhalb der Tabelle ist erlaubt).

### Tests (TDD)

1. `ScheduleView.test.tsx > "Desktop: Kopfzeile ohne Wochenaktionen"` - AC1 (Buttons "Vorwoche übertragen" etc. nicht außerhalb der Leiste; Lupe und Schalter vorhanden)
2. `… > "Desktop: Toolbar direkt vor der Tabelle, keine Kennzahlen davor"` - AC2 (DOM-Reihenfolge Kopfzeile → Toolbar → grid, `compareDocumentPosition`)
3. `… > "Desktop: Seitenleiste lässt sich ein- und ausklappen"` - AC3
4. `… > "Wochenaktionen funktionieren aus der Seitenleiste"` - AC4 (die bestehenden Tests zu Vorwoche übertragen/kopieren, Drucken und Wochenangaben auf die Leiste umstellen statt neu zu schreiben)
5. `… > "Suche klappt per Lupe auf und mit Escape zu"` - AC5
6. `… > "Seitenleiste ist während des Wochenwechsels inert"` - AC6
7. Bestehende Mobile-Tests in `ScheduleView.test.tsx` (Abschnitt "responsive layout") - AC7

Testbefehl: `npx vitest run src/ui/views/schedule/ScheduleView.test.tsx`

### Umsetzungsschritte

1. Tests 1-3 rot.
2. Desktop-Zweig in `ScheduleView` umbauen: äußere Zeile (`flex-direction: row`) aus linker Spalte (Kopfzeile, Toolbar, Tabelle) und `WeekSidePanel`; die bisherigen Zeilen für Wochenangaben/Kennzahlen/Wochenaktionen nur noch im Handy-Zweig rendern.
3. Bestehende Tests der verschobenen Funktionen auf die Leiste umstellen (Test 4), grün.
4. Suche (Test 5) und Ladezustand (Test 6).
5. Abstände der Seite (`py` der Seite) auf dem Desktop reduzieren, wo sie nach P1 doppelt wirken.
6. Manueller Check AC8 bei 1366x768 und 1280x720, Leiste offen und zu; Screenshot.
7. `views/schedule/CLAUDE.md` um den neuen Desktop-Aufbau ergänzen.

### Out of Scope

- Zeilenhöhe der Tabelle (vom Nutzer abgewählt).
- Die App-Kopfleiste mit der Filialauswahl (betrifft alle Seiten).
- Handy-Layout.

---

## Package 4: Vorlagen für Urlaub, Krankheit, Feiertag

**Ziel:** Vorlagen können jede Eintragsart tragen, auch Urlaub (mit Halbtag), Krankheit und Feiertag mit angerechneten Stunden.

**Abhängigkeiten:** keine

**Betroffene Dateien:**
- `src/domain/schedule/ShiftTemplate.ts`, `ShiftTemplate.test.ts` (ändern)
- `src/domain/schedule/shiftTemplateValidation.ts` (ändern)
- `src/application/schedule/shiftTemplateService.ts`, `shiftTemplateService.test.ts` (ändern, falls `create`/`update` die Union einschränken)
- `src/ui/views/schedule/scheduleTools.ts`, `scheduleTools.test.ts` (ändern)
- `src/ui/views/schedule/components/ShiftTemplateDialog.tsx`, `ShiftTemplateDialog.test.tsx` (ändern)
- `src/ui/views/schedule/components/ScheduleToolbar.tsx`, `ScheduleToolbar.test.tsx` (Kachel-Text)
- `src/ui/views/schedule/ScheduleView.tsx`, `ScheduleView.test.tsx` (`applyTool`, `applyBulkTool`)
- `src/domain/schedule/CLAUDE.md` bzw. Kommentar in `ShiftTemplate.ts` (der Satz "Urlaub, Feiertag und Krankheit deliberately have no template support" wird ersetzt)
- `src/ui/i18n/resources/de/schedule.ts` (Texte)

### Kontext

`ShiftTemplate` ist heute eine Union aus `kind: 'Shift'` und `kind: 'Other'` (Sonstiges mit Bezeichnung und Stunden). Urlaub, Krankheit und Feiertag sind bewusst ausgeschlossen (Kommentar in `ShiftTemplate.ts`). `scheduleTools.toolToAbsenceDraft` liefert nur für Other-Vorlagen einen Entwurf, `ScheduleView.applyTool` und `applyBulkTool` schreiben damit immer `type: 'Other'`. `writeAbsenceToCell` kann bereits alle Typen schreiben, inkl. `creditedMinutesOverride`; Halbtag (`halfDay`) kennt es noch nicht. Die Absence-Typen stehen in `src/domain/absence/Absence.ts` (Vacation mit `halfDay` und `creditedMinutesOverride`, Illness und PublicHoliday mit `creditedMinutesOverride`). Die Feldregeln für angerechnete Stunden stehen in `src/domain/absence/absenceValidation.ts` (`validateHourRange`, 0-24h).

### Acceptance Criteria

- [ ] AC1: `ShiftTemplate` kennt zusätzlich `kind: 'Vacation'` (mit optionalem `halfDay: 'morning' | 'afternoon'` und `creditedMinutesOverride`), `kind: 'Illness'` und `kind: 'PublicHoliday'` (je mit optionalem `creditedMinutesOverride`); `createShiftTemplate` erzeugt alle Arten.
- [ ] AC2: `validateShiftTemplate` verlangt einen Namen und prüft `creditedMinutesOverride` auf 0-24h, für alle drei neuen Arten.
- [ ] AC3: Alte Vorlagen (Shift, Other) und alte Datensicherungen laden und funktionieren unverändert.
- [ ] AC4: `toolToAbsenceDraft` liefert für die neuen Arten einen Entwurf mit `type`, `halfDay` und `creditedMinutesOverride`; `toolMatchesCell` erkennt eine Zelle, die genau diese Abwesenheit schon trägt.
- [ ] AC5: Anwenden einer Urlaubs-/Krankheits-/Feiertagsvorlage auf eine Zelle (Kachel + Tippen, Einfügen) legt eine eintägige Abwesenheit dieses Typs an, inkl. Halbtag und angerechneter Stunden, und ist mit Strg+Z rückgängig zu machen.
- [ ] AC6: Mehrfachauswahl mit einer solchen Vorlage legt sie auf jeder freien gewählten Zelle an und überspringt Zellen mit schon vorhandener Abwesenheit (Meldung mit Anzahl wie heute).
- [ ] AC7: Der Vorlagen-Dialog bietet die Arten Arbeitszeit, Sonstiges, Urlaub, Krankheit, Feiertag; bei Urlaub eine Halbtag-Auswahl (ganzer Tag / vormittags / nachmittags), bei Urlaub, Krankheit und Feiertag ein optionales Feld "Angerechnete Stunden"; der Name ist mit der Typbezeichnung vorbelegt.
- [ ] AC8: Die Toolbar-Kachel zeigt als zweite Zeile Typ und Zusatz, z. B. "Urlaub (vormittags)" oder "Krankheit, 8 Std.".

### Tests (TDD)

1. `ShiftTemplate.test.ts > "legt Urlaubs-, Krankheits- und Feiertagsvorlagen an"` - AC1
2. `ShiftTemplate.test.ts > "lehnt angerechnete Stunden über 24 ab"`, `"verlangt einen Namen"` - AC2
3. `ShiftTemplate.test.ts > "alte Vorlagen bleiben gültig"` - AC3 (ein v5-Shift- und -Other-Datensatz als Objekt)
4. `scheduleTools.test.ts > "Entwurf für Urlaub mit Halbtag und Stunden"`, `"erkennt eine passende Zelle"` - AC4
5. `ScheduleView.test.tsx > "Urlaubsvorlage legt einen halben Urlaubstag an und ist rückgängig zu machen"` - AC5 (Abwesenheits-`create`-Mock mit `type: 'Vacation'`, `halfDay`, danach Strg+Z → `delete`)
6. `ScheduleView.test.tsx > "Mehrfachauswahl mit Krankheitsvorlage überspringt belegte Tage"` - AC6
7. `ShiftTemplateDialog.test.tsx > "bietet Urlaub mit Halbtag und Stunden an"`, `"speichert eine Feiertagsvorlage"` - AC7
8. `ScheduleToolbar.test.tsx > "Kachel nennt Typ und Zusatz"` - AC8

Testbefehl: `npx vitest run src/domain/schedule src/ui/views/schedule src/application/schedule/shiftTemplateService.test.ts`

### Umsetzungsschritte

1. Domain: Typ, `createShiftTemplate`, Validierung per TDD; Kommentar zur bisherigen Ausnahme ersetzen.
2. `scheduleTools`: `toolToAbsenceDraft` auf `{ type, label?, hoursPerDay?, halfDay?, creditedMinutesOverride? }` verallgemeinern; `toolMatchesCell` und `toolSummary` anpassen.
3. `ScheduleView`: `writeAbsenceToCell` um `halfDay` erweitern (Umrechnung `'morning'` → `{ atStart: true, atEnd: false }`), `applyTool` und `applyBulkTool` den Typ aus dem Entwurf nehmen lassen.
4. Dialog und Toolbar-Kachel.
5. Grün. `conventions-reviewer` vor dem Commit laufen lassen (keine ArbZG-Logik berührt).

### Out of Scope

- Mehrtägige Vorlagen (eine Vorlage wirkt immer auf einen Tag).
- Kopieren/Einfügen und "Als Vorlage speichern" aus Abwesenheitszellen (P5).

---

## Package 5: Kopieren, Einfügen, "Als Vorlage speichern" für Abwesenheiten

**Ziel:** Eine Zelle mit Urlaub, Krankheit, Feiertag oder Sonstiges lässt sich kopieren, einfügen und als Vorlage speichern.

**Abhängigkeiten:** Package 4

**Betroffene Dateien:**
- `src/ui/views/schedule/scheduleTools.ts`, `scheduleTools.test.ts` (ändern)
- `src/ui/views/schedule/ScheduleView.tsx`, `ScheduleView.test.tsx` (ändern: `copy`, `saveAsTemplate`, `saveAsTemplateDisabled`)
- `src/ui/views/schedule/components/ShiftTemplateDialog.tsx`, `ShiftTemplateDialog.test.tsx` (Vorbelegung aus einer Abwesenheit)
- `src/ui/views/schedule/CLAUDE.md` (Abschnitt Copy/Paste/Frei)

### Kontext

Die Zwischenablage ist ein `ScheduleTool` `{ kind: 'clipboard'; entry: DayEntry }`. `copy` übernimmt nur `dayView.entry`; eine Abwesenheit ist ein eigenes Aggregat und landet nie in der Zwischenablage, Einfügen schreibt dann "Frei" (Kommentar über `copy` in `ScheduleView.tsx`). "Als Vorlage speichern" ist nur für Zellen mit Schichten aktiv (`saveAsTemplateDisabled`) und öffnet den Dialog mit `drafts`. Nach P4 kann eine Vorlage jede Abwesenheitsart tragen, und `toolToAbsenceDraft` beschreibt einen Abwesenheitsentwurf.

### Acceptance Criteria

- [ ] AC1: Die Zwischenablage kann einen Abwesenheitsentwurf halten (`{ kind: 'clipboard'; absence: AbsenceDraft }` neben dem bisherigen `entry`); `toolToAbsenceDraft` liefert ihn.
- [ ] AC2: "Kopieren" auf einer Zelle mit Abwesenheit kopiert Typ, bei Sonstiges Bezeichnung und Stunden, bei eintägigem Urlaub den Halbtag; angerechnete Stunden nicht; bei mehrtägiger Abwesenheit einen eintägigen Eintrag desselben Typs ohne Halbtag.
- [ ] AC3: "Einfügen" einer kopierten Abwesenheit schreibt sie über `writeAbsenceToCell` (ersetzt eine vorhandene eintägige Abwesenheit, ein Schritt für Strg+Z); Kachel + Tippen und Mehrfachauswahl verhalten sich wie mit einer Vorlage aus P4.
- [ ] AC4: Kopieren einer Zelle mit Schichten oder "frei" verhält sich wie bisher.
- [ ] AC5: "Als Vorlage speichern" ist auch auf Zellen mit Abwesenheit aktiv und öffnet den Vorlagen-Dialog vorbelegt mit Art, Halbtag, Bezeichnung/Stunden (Sonstiges) bzw. angerechneten Stunden; auf "frei" ohne Abwesenheit bleibt es gesperrt.
- [ ] AC6: Die Toolbar-Kachel der Zwischenablage zeigt eine kopierte Abwesenheit mit Typ und Zusatz (wie AC8 aus P4).

### Tests (TDD)

1. `scheduleTools.test.ts > "Zwischenablage mit Abwesenheit liefert ihren Entwurf"`, `"Zusammenfassung nennt den Typ"` - AC1, AC6
2. `ScheduleView.test.tsx > "kopiert einen halben Urlaubstag und fügt ihn woanders ein"` - AC2, AC3 (Reproduktion: heute entsteht "Frei")
3. `ScheduleView.test.tsx > "kopiert aus einer mehrtägigen Krankheit einen Tag"` - AC2
4. `ScheduleView.test.tsx > "angerechnete Stunden werden nicht mitkopiert"` - AC2
5. Bestehende Kopieren/Einfügen-Tests für Schichten - AC4 bleiben grün
6. `ScheduleView.test.tsx > "Als Vorlage speichern aus einer Feiertagszelle"` - AC5; `ShiftTemplateDialog.test.tsx > "übernimmt eine Abwesenheit als Vorbelegung"` - AC5

Testbefehl: `npx vitest run src/ui/views/schedule`

### Umsetzungsschritte

1. `ScheduleTool`-Typ erweitern, `scheduleTools`-Funktionen per TDD.
2. `copy` und `saveAsTemplate` in `ScheduleView` umstellen, `saveAsTemplateDisabled` lockern.
3. `ShiftTemplateDialog` um eine Vorbelegung aus einem Abwesenheitsentwurf erweitern.
4. Grün; `views/schedule/CLAUDE.md` (Copy/Paste/Frei) aktualisieren.
5. Manueller Check im Browser-Pane: Urlaub kopieren, auf anderen Mitarbeiter einfügen, Strg+Z.

### Out of Scope

- Kopieren mehrerer Zellen auf einmal.
- Mitkopieren von Notizen (`note`) einer Abwesenheit.
