import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PrivacyView } from './PrivacyView';

const SECTIONS: Array<{ title: string; text: string }> = [
  {
    title: 'Verantwortlicher',
    text: 'Verantwortlich für die Datenverarbeitung im Sinne der DSGVO ist Steven Richter. Kontakt: dev@rezondes.net oder rezondes.business@gmail.com. Es handelt sich um das Angebot einer Privatperson. Diese Datenschutzerklärung ist unter anderem wegen der optionalen Google-Anmeldung (OAuth) für die Google-Drive-Sicherung erforderlich.',
  },
  {
    title: 'Wo werden die Daten gespeichert?',
    text: 'Alle Daten (Filialen, Mitarbeiter, Wochenpläne, Abwesenheiten, Schichtvorlagen) werden ausschließlich lokal im Browser dieses Geräts gespeichert (IndexedDB). Es gibt keinen Server der App, an den Daten übertragen werden, und die App funktioniert vollständig offline. Die einzige Ausnahme ist die optionale Sicherung in deinem eigenen Google Drive, die du unter „Einstellungen“ selbst auslöst. Wenn du die App auf dem Startbildschirm installierst, wird nur das Programm selbst auf dem Gerät abgelegt, damit es ohne Internetverbindung startet. Deine Daten sind davon nicht betroffen: Sie liegen ohnehin schon lokal und werden dabei nirgendwohin übertragen. Backups (als Datei oder in Google Drive) kannst du unter „Einstellungen“ zusätzlich optional mit einem selbst gewählten Passwort verschlüsseln; ohne dieses Passwort lässt sich eine verschlüsselte Sicherung später nicht mehr öffnen. Die Daten im Browser selbst (IndexedDB) sind davon unabhängig und nicht verschlüsselt: Wer Zugriff auf das entsperrte Gerät hat, kann sie einsehen. Sichere deshalb das Gerät selbst ab (Geräte-/Festplattenverschlüsselung, Sperrbildschirm) und teile kein gemeinsames Login unter mehreren Mitarbeitenden.',
  },
  {
    title: 'Wann verlassen Daten dieses Gerät?',
    text: 'Nur wenn du unter „Einstellungen“ bewusst einen Datenexport auslöst: entweder als Datei auf dieses Gerät oder, falls du dich mit Google angemeldet hast, als Sicherung in deinem eigenen Google Drive. Beides passiert ausschließlich auf Knopfdruck. Die App sendet nie von sich aus Daten an externe Dienste, und es läuft keine Synchronisierung im Hintergrund.',
  },
  {
    title: 'Welche Gesundheitsdaten werden bei Krankmeldungen erfasst?',
    text: 'Bei Abwesenheiten vom Typ „Krankheit“ wird ausschließlich der Zeitraum erfasst. Es gibt kein Feld für Diagnosen oder sonstige Gesundheitsdetails. Diese Beschränkung ist technisch im Datenmodell verankert.',
  },
  {
    title: 'Was sieht Google, wenn ich die Drive-Sicherung nutze?',
    text: 'Die App fordert von Google nur die engste verfügbare Berechtigung an: Sie kann ausschließlich auf Dateien zugreifen, die sie selbst angelegt hat. Der übrige Inhalt deines Google Drive bleibt für sie unsichtbar. Die Sicherungen liegen im Ordner „Personaleinsatzplanung“ und du kannst sie jederzeit selbst ansehen und löschen, in Google Drive wie auch in dieser App. Gelöschte Sicherungen landen in Googles Papierkorb und werden dort nach 30 Tagen endgültig entfernt. Da die Sicherung Mitarbeiterdaten enthält, ist Google in diesem Fall Auftragsverarbeiter. Der Zugriffsschlüssel selbst wird nicht auf dem Gerät gespeichert: Die App merkt sich nur, dass du Drive nutzt, und erneuert die Freigabe still, solange du bei Google angemeldet bist. Über „Verbindung trennen“ endet das sofort.',
  },
  {
    title: 'Wie kann ich meine Daten löschen?',
    text: 'Unter „Einstellungen“ kannst du jederzeit alle gespeicherten Daten unwiderruflich löschen. Beachte dabei die auf den Formularen vermerkten gesetzlichen Aufbewahrungsfristen (z. B. für geringfügig Beschäftigte), bevor du Daten löschst.',
  },
  {
    title: 'Werden Nutzungsdaten oder Tracking-Informationen erhoben?',
    text: 'Nein. Die App bindet keine Analyse- oder Tracking-Dienste ein. Auch die Schriftart wird nicht nachgeladen, sondern ist Teil der App selbst, damit kein Schriftanbieter erfährt, wann du sie benutzt. Der Anmeldecode von Google wird erst in dem Moment geladen, in dem du auf „Mit Google anmelden“ klickst. Ohne diesen Klick nimmt die App zu keinem fremden Server Verbindung auf.',
  },
];

describe('PrivacyView', () => {
  it('renders the heading and every privacy section with its exact title and body text, in order', () => {
    render(<PrivacyView />);

    expect(screen.getByRole('heading', { level: 5, name: 'Datenschutzhinweise' })).toBeInTheDocument();

    const sectionHeadings = screen.getAllByRole('heading', { level: 6 });
    expect(sectionHeadings).toHaveLength(SECTIONS.length);

    sectionHeadings.forEach((heading, index) => {
      const { title, text } = SECTIONS[index];
      expect(heading).toHaveTextContent(title);
      const paper = heading.parentElement as HTMLElement;
      expect(within(paper).getByText(text)).toBeInTheDocument();
    });
  });

  it('marks the section list as selectable text, so the privacy notice can be copied', () => {
    const { container } = render(<PrivacyView />);

    const selectable = container.querySelector('[data-selectable]');
    expect(selectable).not.toBeNull();
    expect(within(selectable as HTMLElement).getAllByRole('heading', { level: 6 })).toHaveLength(SECTIONS.length);
  });
});
