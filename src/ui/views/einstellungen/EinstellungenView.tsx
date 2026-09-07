import { useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Link from '@mui/material/Link';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import UploadOutlinedIcon from '@mui/icons-material/UploadOutlined';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import { services } from '@infrastructure/services';
import { dateiHerunterladen, backupDateiname, datenDateiEinlesen } from '@infrastructure/export/dateiZugriff';
import { BestaetigungsDialog } from '@ui/components/BestaetigungsDialog';

export function EinstellungenView() {
  const [meldung, setMeldung] = useState<{ art: 'success' | 'error'; text: string } | null>(null);
  const [loeschDialogOffen, setLoeschDialogOffen] = useState(false);
  const [bestaetigungstext, setBestaetigungstext] = useState('');
  const [importDatei, setImportDatei] = useState<File | null>(null);
  const dateiInputRef = useRef<HTMLInputElement>(null);

  const exportieren = async () => {
    const datei = await services.datenExport.exportieren();
    dateiHerunterladen(backupDateiname(), datei);
    setMeldung({ art: 'success', text: 'Backup wurde heruntergeladen.' });
  };

  const importDurchfuehren = async () => {
    const datei = importDatei;
    setImportDatei(null);
    if (dateiInputRef.current) dateiInputRef.current.value = '';
    if (!datei) return;
    try {
      const rohdaten = await datenDateiEinlesen(datei);
      await services.datenExport.importierenUndErsetzen(rohdaten);
      setMeldung({ art: 'success', text: 'Import erfolgreich. Die Seite wird neu geladen.' });
      setTimeout(() => window.location.reload(), 1200);
    } catch (fehler) {
      setMeldung({ art: 'error', text: fehler instanceof Error ? fehler.message : 'Import fehlgeschlagen.' });
    }
  };

  const alleDatenLoeschen = async () => {
    if (bestaetigungstext !== 'LÖSCHEN') return;
    await services.datenExport.alleDatenLoeschen();
    setLoeschDialogOffen(false);
    setMeldung({ art: 'success', text: 'Alle Daten wurden gelöscht. Die Seite wird neu geladen.' });
    setTimeout(() => window.location.reload(), 1200);
  };

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="h5" fontWeight={500} sx={{ mb: 3 }}>
        Einstellungen
      </Typography>

      {meldung && (
        <Alert severity={meldung.art} sx={{ mb: 2 }} onClose={() => setMeldung(null)}>
          {meldung.text}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={500} sx={{ mb: 1 }}>
          Backup & Datenübertragung
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Alle Daten liegen ausschließlich lokal in diesem Browser. Für ein Backup oder einen Geräte-/Browserwechsel
          exportiere den kompletten Datenbestand als Datei und importiere ihn auf dem anderen Gerät wieder.
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" startIcon={<DownloadOutlinedIcon />} onClick={exportieren}>
            Daten exportieren
          </Button>
          <Button variant="outlined" component="label" startIcon={<UploadOutlinedIcon />}>
            Daten importieren
            <input
              ref={dateiInputRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => setImportDatei(e.target.files?.[0] ?? null)}
            />
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={500} sx={{ mb: 1 }}>
          Datenschutz
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Informationen dazu, welche Daten wo gespeichert werden, findest du in den{' '}
          <Link component={RouterLink} to="/datenschutz">
            Datenschutzhinweisen
          </Link>
          .
        </Typography>
      </Paper>

      <Paper sx={{ p: 3, borderColor: '#e5a3a0' }}>
        <Typography variant="subtitle1" fontWeight={500} sx={{ mb: 1 }}>
          Alle Daten löschen
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Entfernt unwiderruflich alle Filialen, Mitarbeiter, Wochenpläne und Abwesenheiten aus diesem Browser.
          Erstelle vorher ein Backup, falls du die Daten noch benötigst.
        </Typography>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteForeverOutlinedIcon />}
          onClick={() => setLoeschDialogOffen(true)}
        >
          Alle Daten löschen
        </Button>
      </Paper>

      <Dialog open={loeschDialogOffen} onClose={() => setLoeschDialogOffen(false)}>
        <DialogTitle>Alle Daten wirklich löschen?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Dieser Vorgang kann nicht rückgängig gemacht werden. Tippe zur Bestätigung <strong>LÖSCHEN</strong> ein.
          </Typography>
          <TextField
            fullWidth
            value={bestaetigungstext}
            onChange={(e) => setBestaetigungstext(e.target.value)}
            placeholder="LÖSCHEN"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLoeschDialogOffen(false)}>Abbrechen</Button>
          <Button variant="contained" color="error" disabled={bestaetigungstext !== 'LÖSCHEN'} onClick={alleDatenLoeschen}>
            Endgültig löschen
          </Button>
        </DialogActions>
      </Dialog>

      <BestaetigungsDialog
        open={!!importDatei}
        titel="Daten importieren?"
        text="Der komplette lokale Datenbestand wird durch den Inhalt dieser Datei ersetzt. Dieser Vorgang kann nicht rückgängig gemacht werden."
        bestaetigenText="Importieren"
        gefaehrlich
        onBestaetigen={importDurchfuehren}
        onAbbrechen={() => {
          setImportDatei(null);
          if (dateiInputRef.current) dateiInputRef.current.value = '';
        }}
      />
    </Box>
  );
}
