import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { MitarbeiterId } from '@domain/shared/ids';
import { formatISODatumDeutsch } from '@domain/shared/Zeitspanne';
import type { Abwesenheit } from '@domain/abwesenheit/Abwesenheit';
import { vollerName } from '@domain/mitarbeiter/Mitarbeiter';
import { services } from '@infrastructure/services';
import { erstelleFeiertagsPruefung } from '@infrastructure/feiertage/feiertageDeutschland';
import { useAusgewaehlteFiliale } from '@ui/hooks/useFiliale';
import { useMitarbeiterListe } from '@ui/hooks/useMitarbeiterListe';
import { useAbwesenheiten } from '@ui/hooks/useAbwesenheiten';
import { useFehlerSnackbar } from '@ui/hooks/useFehlerSnackbar';
import { FehlerSnackbar } from '@ui/components/FehlerSnackbar';
import { BestaetigungsDialog } from '@ui/components/BestaetigungsDialog';

type AbwesenheitsArt = 'Urlaub' | 'Krankheit' | 'Sonstige';

interface FormZustand {
  mitarbeiterId: string;
  art: AbwesenheitsArt;
  von: string;
  bis: string;
  bezeichnung: string;
  notiz: string;
  halbtagsAmBeginn: boolean;
  halbtagsAmEnde: boolean;
}

function leeresFormular(ersteMitarbeiterId: string): FormZustand {
  const heute = new Date().toISOString().slice(0, 10);
  return {
    mitarbeiterId: ersteMitarbeiterId,
    art: 'Urlaub',
    von: heute,
    bis: heute,
    bezeichnung: '',
    notiz: '',
    halbtagsAmBeginn: false,
    halbtagsAmEnde: false,
  };
}

export function AbwesenheitenView() {
  const { filiale } = useAusgewaehlteFiliale();
  const { mitarbeiterListe } = useMitarbeiterListe(filiale?.id ?? null);
  const aktiveMitarbeiter = mitarbeiterListe.filter((m) => m.aktiv);
  const mitarbeiterIds = mitarbeiterListe.map((m) => m.id);
  const { abwesenheiten, neuLaden } = useAbwesenheiten(mitarbeiterIds);
  const [dialogOffen, setDialogOffen] = useState(false);
  const [formular, setFormular] = useState<FormZustand>(leeresFormular(''));
  const [resturlaub, setResturlaub] = useState<Record<string, number>>({});
  const [loeschZiel, setLoeschZiel] = useState<Abwesenheit | null>(null);
  const [formFehler, setFormFehler] = useState<string | null>(null);
  const { fehler, melden, zuruecksetzen } = useFehlerSnackbar();

  const jahr = new Date().getFullYear();

  useEffect(() => {
    if (!filiale) return;
    const istFeiertag = erstelleFeiertagsPruefung(filiale.bundesland);
    (async () => {
      const eintraege = await Promise.all(
        mitarbeiterListe.map(
          async (m) => [m.id, await services.abwesenheit.resturlaubBerechnen(m, jahr, istFeiertag)] as const,
        ),
      );
      setResturlaub(Object.fromEntries(eintraege));
    })();
    // abwesenheiten as a dependency: remaining vacation must be recalculated after adding/deleting an absence.
  }, [filiale, mitarbeiterListe, jahr, abwesenheiten]);

  const dialogOeffnen = () => {
    setFormular(leeresFormular(aktiveMitarbeiter[0]?.id ?? ''));
    setFormFehler(null);
    setDialogOffen(true);
  };

  const speichern = async () => {
    if (!formular.mitarbeiterId || !formular.von || !formular.bis) return;
    if (formular.bis < formular.von) {
      setFormFehler('"Bis" darf nicht vor "Von" liegen.');
      return;
    }
    setFormFehler(null);

    try {
      if (formular.art === 'Urlaub') {
        const halbtags =
          formular.halbtagsAmBeginn || formular.halbtagsAmEnde
            ? { amBeginn: formular.halbtagsAmBeginn, amEnde: formular.halbtagsAmEnde }
            : undefined;
        await services.abwesenheit.anlegen({
          mitarbeiterId: formular.mitarbeiterId as MitarbeiterId,
          art: 'Urlaub',
          von: formular.von,
          bis: formular.bis,
          halbtags,
          notiz: formular.notiz || undefined,
        });
      } else if (formular.art === 'Krankheit') {
        await services.abwesenheit.anlegen({
          mitarbeiterId: formular.mitarbeiterId as MitarbeiterId,
          art: 'Krankheit',
          von: formular.von,
          bis: formular.bis,
        });
      } else {
        await services.abwesenheit.anlegen({
          mitarbeiterId: formular.mitarbeiterId as MitarbeiterId,
          art: 'Sonstige',
          von: formular.von,
          bis: formular.bis,
          bezeichnung: formular.bezeichnung || 'Sonstige Abwesenheit',
          notiz: formular.notiz || undefined,
        });
      }
      setDialogOffen(false);
      await neuLaden();
    } catch (e) {
      melden(e, 'Abwesenheit konnte nicht gespeichert werden');
    }
  };

  const loeschen = async () => {
    if (!loeschZiel) return;
    try {
      await services.abwesenheit.loeschen(loeschZiel.id);
      await neuLaden();
    } catch (e) {
      melden(e, 'Abwesenheit konnte nicht gelöscht werden');
    } finally {
      setLoeschZiel(null);
    }
  };

  if (!filiale) {
    return <Alert severity="info">Bitte zuerst oben eine Filiale auswählen oder anlegen.</Alert>;
  }

  const sortiert = [...abwesenheiten].sort((a, b) => b.von.localeCompare(a.von));
  const einzelnerTag = formular.von === formular.bis;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={500}>
          Abwesenheiten · {filiale.name}
        </Typography>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={dialogOeffnen} disabled={aktiveMitarbeiter.length === 0}>
          Abwesenheit erfassen
        </Button>
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        {mitarbeiterListe.map((m) => (
          <Paper key={m.id} sx={{ p: 2, flex: '1 1 220px', minWidth: 220, opacity: m.aktiv ? 1 : 0.55 }}>
            <Typography variant="body2" fontWeight={500}>
              {vollerName(m)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Resturlaub {jahr}: {resturlaub[m.id]?.toLocaleString('de-DE') ?? '–'} von{' '}
              {m.urlaubsanspruchProJahr.toLocaleString('de-DE')} Tagen
            </Typography>
          </Paper>
        ))}
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Mitarbeiter</TableCell>
              <TableCell>Art</TableCell>
              <TableCell>Von</TableCell>
              <TableCell>Bis</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortiert.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    Noch keine Abwesenheiten erfasst.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {sortiert.map((a) => {
              const mitarbeiter = mitarbeiterListe.find((m) => m.id === a.mitarbeiterId);
              // amBeginn = absent at the start of the day (morning), amEnde = absent at the end
              // (afternoon) - must match the "Nur vormittags/nachmittags frei" checkbox labels below.
              const halbtagsText =
                a.art === 'Urlaub' && a.halbtags && a.von === a.bis
                  ? a.halbtags.amBeginn
                    ? ' (vormittags)'
                    : a.halbtags.amEnde
                      ? ' (nachmittags)'
                      : ''
                  : '';
              return (
                <TableRow key={a.id} hover>
                  <TableCell>{mitarbeiter ? vollerName(mitarbeiter) : '–'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={(a.art === 'Sonstige' ? a.bezeichnung : a.art) + halbtagsText} />
                  </TableCell>
                  <TableCell>{formatISODatumDeutsch(a.von)}</TableCell>
                  <TableCell>{formatISODatumDeutsch(a.bis)}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setLoeschZiel(a)} aria-label="Löschen">
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOffen} onClose={() => setDialogOffen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Abwesenheit erfassen</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Mitarbeiter"
              value={formular.mitarbeiterId}
              onChange={(e) => setFormular((f) => ({ ...f, mitarbeiterId: e.target.value }))}
              fullWidth
            >
              {aktiveMitarbeiter.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {vollerName(m)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Art"
              value={formular.art}
              onChange={(e) => setFormular((f) => ({ ...f, art: e.target.value as AbwesenheitsArt }))}
              fullWidth
            >
              <MenuItem value="Urlaub">Urlaub</MenuItem>
              <MenuItem value="Krankheit">Krankheit</MenuItem>
              <MenuItem value="Sonstige">Sonstige</MenuItem>
            </TextField>
            {formular.art === 'Sonstige' && (
              <TextField
                label="Bezeichnung"
                value={formular.bezeichnung}
                onChange={(e) => setFormular((f) => ({ ...f, bezeichnung: e.target.value }))}
                fullWidth
              />
            )}
            <Stack direction="row" spacing={2}>
              <TextField
                label="Von"
                type="date"
                value={formular.von}
                onChange={(e) => setFormular((f) => ({ ...f, von: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Bis"
                type="date"
                value={formular.bis}
                onChange={(e) => setFormular((f) => ({ ...f, bis: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
            {formFehler && <Alert severity="error">{formFehler}</Alert>}
            {formular.art === 'Urlaub' && einzelnerTag && (
              <Stack direction="row" spacing={2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formular.halbtagsAmBeginn}
                      onChange={(e) =>
                        setFormular((f) => ({ ...f, halbtagsAmBeginn: e.target.checked, halbtagsAmEnde: false }))
                      }
                    />
                  }
                  label="Nur vormittags frei"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formular.halbtagsAmEnde}
                      onChange={(e) =>
                        setFormular((f) => ({ ...f, halbtagsAmEnde: e.target.checked, halbtagsAmBeginn: false }))
                      }
                    />
                  }
                  label="Nur nachmittags frei"
                />
              </Stack>
            )}
            {formular.art === 'Urlaub' && (
              <TextField
                label="Notiz (optional)"
                value={formular.notiz}
                onChange={(e) => setFormular((f) => ({ ...f, notiz: e.target.value }))}
                fullWidth
                multiline
                minRows={2}
              />
            )}
            {formular.art === 'Krankheit' && (
              <Alert severity="info">Es werden bewusst keine Diagnose- oder Gesundheitsdetails erfasst.</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOffen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={speichern}>
            Speichern
          </Button>
        </DialogActions>
      </Dialog>

      <BestaetigungsDialog
        open={!!loeschZiel}
        titel="Abwesenheit löschen?"
        text="Dieser Eintrag wird unwiderruflich entfernt."
        bestaetigenText="Löschen"
        gefaehrlich
        onBestaetigen={loeschen}
        onAbbrechen={() => setLoeschZiel(null)}
      />

      <FehlerSnackbar fehler={fehler} onClose={zuruecksetzen} />
    </Box>
  );
}
