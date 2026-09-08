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
import { downloadFile, backupFilename, readDataFile } from '@infrastructure/export/fileAccess';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { APP_BUILD_TIME, APP_COMMIT, APP_VERSION } from '@ui/app/buildInfo';

export function SettingsView() {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportData = async () => {
    const file = await services.dataExport.export();
    downloadFile(backupFilename(), file);
    setMessage({ type: 'success', text: 'Backup wurde heruntergeladen.' });
  };

  const performImport = async () => {
    const file = importFile;
    setImportFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    try {
      const rawData = await readDataFile(file);
      await services.dataExport.importAndReplace(rawData);
      setMessage({ type: 'success', text: 'Import erfolgreich. Die Seite wird neu geladen.' });
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Import fehlgeschlagen.' });
    }
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    // Otherwise the typed confirmation would still be there the next time the dialog opens.
    setConfirmationText('');
  };

  const deleteAllData = async () => {
    if (confirmationText !== 'LÖSCHEN') return;
    await services.dataExport.deleteAllData();
    closeDeleteDialog();
    setMessage({ type: 'success', text: 'Alle Daten wurden gelöscht. Die Seite wird neu geladen.' });
    setTimeout(() => window.location.reload(), 1200);
  };

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="h5" fontWeight={500} sx={{ mb: 3 }}>
        Einstellungen
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
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
          <Button variant="outlined" startIcon={<DownloadOutlinedIcon />} onClick={exportData}>
            Daten exportieren
          </Button>
          <Button variant="outlined" component="label" startIcon={<UploadOutlinedIcon />}>
            Daten importieren
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
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
          <Link component={RouterLink} to="/privacy">
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
          Entfernt unwiderruflich alle Filialen, Mitarbeiter, Wochenpläne, Abwesenheiten und Schichtvorlagen aus
          diesem Browser.
          Erstelle vorher ein Backup, falls du die Daten noch benötigst.
        </Typography>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteForeverOutlinedIcon />}
          onClick={() => setDeleteDialogOpen(true)}
        >
          Alle Daten löschen
        </Button>
      </Paper>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="subtitle1" fontWeight={500} sx={{ mb: 1 }}>
          Version
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Kennung des installierten Stands. Sie steht auch klein unten rechts in der Ecke, damit sie auf
          Screenshots mitkommt. Bei einer Rückfrage bitte diese Angaben mitschicken.
        </Typography>
        <Stack spacing={0.5} sx={{ fontFamily: 'monospace', fontSize: 14, userSelect: 'all' }}>
          <span>Version: {APP_VERSION}</span>
          {/* The raw ISO timestamp on purpose: unambiguous, time-zone free, and it sidesteps the
              German date-format rules that apply to user-facing dates. */}
          <span>Build: {APP_BUILD_TIME}</span>
          <span>Commit: {APP_COMMIT || '-'}</span>
        </Stack>
      </Paper>

      <Dialog open={deleteDialogOpen} onClose={closeDeleteDialog}>
        <DialogTitle>Alle Daten wirklich löschen?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Dieser Vorgang kann nicht rückgängig gemacht werden. Tippe zur Bestätigung <strong>LÖSCHEN</strong> ein.
          </Typography>
          <TextField
            fullWidth
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            placeholder="LÖSCHEN"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDeleteDialog}>Abbrechen</Button>
          <Button variant="contained" color="error" disabled={confirmationText !== 'LÖSCHEN'} onClick={deleteAllData}>
            Endgültig löschen
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!importFile}
        title="Daten importieren?"
        text="Der komplette lokale Datenbestand wird durch den Inhalt dieser Datei ersetzt. Dieser Vorgang kann nicht rückgängig gemacht werden."
        confirmText="Importieren"
        dangerous
        onConfirm={performImport}
        onCancel={() => {
          setImportFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      />
    </Box>
  );
}
