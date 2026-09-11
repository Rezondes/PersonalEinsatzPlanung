import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { TermsView } from './TermsView';

const SECTIONS: Array<{ title: string; text: string }> = [
  {
    title: 'Geltungsbereich',
    text: 'Diese Nutzungsbedingungen gelten für Personaleinsatzplanung (PEP), ein kostenloses Werkzeug zur Personaleinsatzplanung für Filialleiter im Einzelhandel. PEP speichert alle Daten ausschließlich lokal im Browser dieses Geräts (IndexedDB), kommt ohne Server-Backend aus und funktioniert als Progressive Web App vollständig offline. Zusätzlich gibt es eine optionale Sicherung deiner Daten in deinem eigenen Google Drive.',
  },
  {
    title: 'Keine Gewährleistung für die Planungsrichtigkeit',
    text: 'PEP unterstützt dich bei der Erstellung von Dienstplänen und führt dabei automatisierte Prüfungen nach dem Arbeitszeitgesetz (ArbZG) durch, etwa zu Ruhezeiten, Höchstarbeitszeiten und Pausen. Diese Prüfungen sind eine Arbeitshilfe, keine Rechtsberatung und kein Ersatz für eine juristische Prüfung. Die Verantwortung für die Rechtmäßigkeit der tatsächlich erstellten und eingesetzten Dienstpläne liegt bei dir als Filialleiter bzw. bei deinem Arbeitgeber. Prüfe die Hinweise der App eigenständig, insbesondere bei Sonderfällen wie Jugendlichen, Schwangeren oder abweichenden tarifvertraglichen Regelungen.',
  },
  {
    title: 'Datenhoheit',
    text: 'Alle in PEP erfassten Daten - Filialen, Mitarbeiter, Wochenpläne, Abwesenheiten und Schichtvorlagen - verbleiben ausschließlich auf deinem eigenen Gerät bzw. in deinem Browser. Du bist alleiniger Eigentümer dieser Daten. Es existiert keine serverseitige Kopie der App, mit einer einzigen Ausnahme: die optionale Sicherung, die du unter „Einstellungen“ bewusst in dein eigenes Google-Drive-Konto auslöst. Näheres dazu findest du in den Datenschutzhinweisen.',
  },
  {
    title: 'Verfügbarkeit',
    text: 'PEP ist ein kostenloses Werkzeug. Es besteht kein Anspruch auf eine bestimmte Verfügbarkeit, Fehlerfreiheit oder Weiterentwicklung der App. Da alle Kernfunktionen lokal im Browser laufen, funktioniert PEP schon by design auch ohne Internetverbindung; lediglich die optionale Google-Drive-Sicherung benötigt eine Verbindung zu Google.',
  },
  {
    title: 'Google-Drive-Sicherung (optional)',
    text: 'Die Sicherung deiner Daten in Google Drive ist freiwillig und rein optional - PEP funktioniert ohne sie vollständig. Nutzt du diese Funktion, gelten zusätzlich die Nutzungsbedingungen von Google für dein Google-Konto und für Google Drive. Welche Berechtigungen die App dabei von Google erhält und was sie sehen kann, ist in den Datenschutzhinweisen im Abschnitt „Was sieht Google, wenn ich die Drive-Sicherung nutze?“ beschrieben - wir wiederholen das hier nicht, damit die Angaben nicht auseinanderlaufen.',
  },
  {
    title: 'Haftungsbeschränkung',
    text: 'Die Haftung für Schäden, die aus der Nutzung von PEP entstehen, ist im gesetzlich zulässigen Umfang ausgeschlossen bzw. beschränkt - insbesondere für mittelbare Schäden, entgangenen Gewinn und Datenverlust. Das gilt ausdrücklich auch für Schäden, die aus fehlerhaften Dienstplänen, nicht erkannten ArbZG-Verstößen oder dem Verlust lokal gespeicherter Daten entstehen, einschließlich Mitarbeiterdaten und der in begrenztem Umfang erfassten Krankheitszeiträume. Für Vorsatz, grobe Fahrlässigkeit sowie Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit bleibt die Haftung unberührt.',
  },
  {
    title: 'Änderungen dieser Nutzungsbedingungen',
    text: 'Diese Nutzungsbedingungen können bei Bedarf angepasst werden, etwa wenn sich der Funktionsumfang der App ändert. Die jeweils aktuelle Fassung ist in der App unter diesem Menüpunkt einsehbar. Durch die weitere Nutzung von PEP nach einer Änderung erklärst du dich mit der jeweils aktuellen Fassung einverstanden.',
  },
  {
    title: 'Kontakt',
    text: 'Bei Fragen zu diesen Nutzungsbedingungen erreichst du uns unter dev@rezondes.net oder rezondes.business@gmail.com.',
  },
  {
    title: 'Anwendbares Recht',
    text: 'Es gilt das Recht der Bundesrepublik Deutschland. PEP ist proprietäre Software, alle Rechte sind vorbehalten (siehe LICENSE-Datei, Copyright Steven Richter, „Proprietär, alle Rechte vorbehalten“). Der interne Projektname lautet „personaleinsatzplanung“ (siehe package.json).',
  },
];

describe('TermsView', () => {
  it('renders the heading and every terms section with its exact title and body text, in order', () => {
    render(<TermsView />);

    expect(screen.getByRole('heading', { level: 5, name: 'Nutzungsbedingungen' })).toBeInTheDocument();

    const sectionHeadings = screen.getAllByRole('heading', { level: 6 });
    expect(sectionHeadings).toHaveLength(SECTIONS.length);

    sectionHeadings.forEach((heading, index) => {
      const { title, text } = SECTIONS[index];
      expect(heading).toHaveTextContent(title);
      const paper = heading.parentElement as HTMLElement;
      expect(within(paper).getByText(text)).toBeInTheDocument();
    });
  });

  it('marks the section list as selectable text, so the terms can be copied', () => {
    const { container } = render(<TermsView />);

    const selectable = container.querySelector('[data-selectable]');
    expect(selectable).not.toBeNull();
    expect(within(selectable as HTMLElement).getAllByRole('heading', { level: 6 })).toHaveLength(SECTIONS.length);
  });
});
