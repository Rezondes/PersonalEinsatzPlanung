import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';

const SECTIONS = [
  {
    title: 'Wo werden die Daten gespeichert?',
    text: 'Alle Daten (Filialen, Mitarbeiter, Wochenpläne, Abwesenheiten, Schichtvorlagen) werden ausschließlich lokal im Browser dieses Geräts gespeichert (IndexedDB). Es gibt keinen Server, an den Daten übertragen werden. Die App funktioniert vollständig offline.',
  },
  {
    title: 'Wann verlassen Daten dieses Gerät?',
    text: 'Nur wenn du unter „Einstellungen“ bewusst einen Datenexport auslöst, um ein Backup zu erstellen oder die Daten auf ein anderes Gerät zu übertragen. Die App sendet nie automatisch Daten an externe Dienste.',
  },
  {
    title: 'Welche Gesundheitsdaten werden bei Krankmeldungen erfasst?',
    text: 'Bei Abwesenheiten vom Typ „Krankheit“ wird ausschließlich der Zeitraum erfasst. Es gibt kein Feld für Diagnosen oder sonstige Gesundheitsdetails. Diese Beschränkung ist technisch im Datenmodell verankert.',
  },
  {
    title: 'Wie kann ich meine Daten löschen?',
    text: 'Unter „Einstellungen“ kannst du jederzeit alle gespeicherten Daten unwiderruflich löschen. Beachte dabei die auf den Formularen vermerkten gesetzlichen Aufbewahrungsfristen (z. B. für geringfügig Beschäftigte), bevor du Daten löschst.',
  },
  {
    title: 'Werden Nutzungsdaten oder Tracking-Informationen erhoben?',
    text: 'Nein. Die App bindet keine Analyse- oder Tracking-Dienste ein und lädt keine externen Skripte oder Schriftarten nach.',
  },
];

export function PrivacyView() {
  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography variant="h5" fontWeight={500} sx={{ mb: 3 }}>
        Datenschutzhinweise
      </Typography>
      <Stack spacing={2}>
        {SECTIONS.map((section) => (
          <Paper key={section.title} sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={500} sx={{ mb: 1 }}>
              {section.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {section.text}
            </Typography>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
