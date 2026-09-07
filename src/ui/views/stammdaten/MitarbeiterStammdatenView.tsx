import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Autocomplete from '@mui/material/Autocomplete';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined';
import ChildCareOutlinedIcon from '@mui/icons-material/ChildCareOutlined';
import type { Mitarbeiter } from '@domain/mitarbeiter/Mitarbeiter';
import { vollerName } from '@domain/mitarbeiter/Mitarbeiter';
import { beschaeftigungsartLabel } from '@domain/mitarbeiter/Beschaeftigungsart';
import { TAETIGKEITS_VORSCHLAEGE } from '@domain/mitarbeiter/taetigkeitsVorschlaege';
import { istMinderjaehrig } from '@domain/validierung/arbeitszeitgesetz/jugendarbeitsschutz';
import { services } from '@infrastructure/services';
import { useAusgewaehlteFiliale } from '@ui/hooks/useFiliale';
import { useMitarbeiterListe } from '@ui/hooks/useMitarbeiterListe';
import { useFehlerSnackbar } from '@ui/hooks/useFehlerSnackbar';
import { FehlerSnackbar } from '@ui/components/FehlerSnackbar';
import { BestaetigungsDialog } from '@ui/components/BestaetigungsDialog';

type BeschaeftigungstypAuswahl = 'Vollzeit' | 'Teilzeit' | 'Minijob';

interface FormZustand {
  id: string | null;
  nachname: string;
  vorname: string;
  taetigkeit: string;
  typ: BeschaeftigungstypAuswahl;
  wochenstunden: string;
  minStunden: string;
  maxStunden: string;
  urlaubsanspruchProJahr: string;
  geburtsdatum: string;
}

function leeresFormular(): FormZustand {
  return {
    id: null,
    nachname: '',
    vorname: '',
    taetigkeit: '',
    typ: 'Teilzeit',
    wochenstunden: '',
    minStunden: '',
    maxStunden: '',
    urlaubsanspruchProJahr: '28',
    geburtsdatum: '',
  };
}

function formularAusMitarbeiter(m: Mitarbeiter): FormZustand {
  const art = m.beschaeftigungsart;
  return {
    id: m.id,
    nachname: m.nachname,
    vorname: m.vorname,
    taetigkeit: m.taetigkeit,
    typ: art.typ,
    wochenstunden: art.typ !== 'Minijob' ? String(art.wochenstunden) : '',
    minStunden: art.typ === 'Minijob' ? String(art.minStunden) : '',
    maxStunden: art.typ === 'Minijob' ? String(art.maxStunden) : '',
    urlaubsanspruchProJahr: String(m.urlaubsanspruchProJahr),
    geburtsdatum: m.geburtsdatum ?? '',
  };
}

export function MitarbeiterStammdatenView() {
  const { filiale } = useAusgewaehlteFiliale();
  const { mitarbeiterListe, laedt, neuLaden } = useMitarbeiterListe(filiale?.id ?? null);
  const [dialogOffen, setDialogOffen] = useState(false);
  const [formular, setFormular] = useState<FormZustand>(leeresFormular());
  const [wirdGespeichert, setWirdGespeichert] = useState(false);
  const [statusZiel, setStatusZiel] = useState<Mitarbeiter | null>(null);
  const { fehler, melden, zuruecksetzen } = useFehlerSnackbar();

  const dialogOeffnenNeu = () => {
    setFormular(leeresFormular());
    setDialogOffen(true);
  };

  const dialogOeffnenBearbeiten = (m: Mitarbeiter) => {
    setFormular(formularAusMitarbeiter(m));
    setDialogOffen(true);
  };

  const speichern = async () => {
    if (!filiale || !formular.nachname.trim() || !formular.vorname.trim()) {
      return;
    }

    const beschaeftigungsart =
      formular.typ === 'Minijob'
        ? { typ: 'Minijob' as const, minStunden: Number(formular.minStunden) || 0, maxStunden: Number(formular.maxStunden) || 0 }
        : { typ: formular.typ, wochenstunden: Number(formular.wochenstunden) || 0 };

    setWirdGespeichert(true);
    try {
      if (formular.id) {
        const bestehend = mitarbeiterListe.find((m) => m.id === formular.id);
        if (bestehend) {
          await services.mitarbeiter.aktualisieren({
            ...bestehend,
            nachname: formular.nachname,
            vorname: formular.vorname,
            taetigkeit: formular.taetigkeit,
            beschaeftigungsart,
            urlaubsanspruchProJahr: Number(formular.urlaubsanspruchProJahr) || 0,
            geburtsdatum: formular.geburtsdatum || undefined,
          });
        }
      } else {
        await services.mitarbeiter.anlegen({
          filialeId: filiale.id,
          nachname: formular.nachname,
          vorname: formular.vorname,
          taetigkeit: formular.taetigkeit,
          beschaeftigungsart,
          urlaubsanspruchProJahr: Number(formular.urlaubsanspruchProJahr) || 0,
          geburtsdatum: formular.geburtsdatum || undefined,
        });
      }
      setDialogOffen(false);
      await neuLaden();
    } catch (e) {
      melden(e, 'Mitarbeiter konnte nicht gespeichert werden');
    } finally {
      setWirdGespeichert(false);
    }
  };

  const statusAendern = async () => {
    if (!statusZiel) return;
    try {
      await services.mitarbeiter.aktivStatusAendern(statusZiel, !statusZiel.aktiv);
      await neuLaden();
    } catch (e) {
      melden(e, 'Status konnte nicht geändert werden');
    } finally {
      setStatusZiel(null);
    }
  };

  if (!filiale) {
    return <Alert severity="info">Bitte zuerst oben eine Filiale auswählen oder anlegen.</Alert>;
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={500}>
          Mitarbeiter · {filiale.name}
        </Typography>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={dialogOeffnenNeu}>
          Neuer Mitarbeiter
        </Button>
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Tätigkeit</TableCell>
              <TableCell>Beschäftigung</TableCell>
              <TableCell>Wochenstunden</TableCell>
              <TableCell>Urlaub/Jahr</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!laedt && mitarbeiterListe.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    Noch kein Mitarbeiter angelegt.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {mitarbeiterListe.map((m) => {
              const minderjaehrig = istMinderjaehrig(m.geburtsdatum, new Date());
              return (
                <TableRow key={m.id} hover sx={{ opacity: m.aktiv ? 1 : 0.55 }}>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {vollerName(m)}
                      {minderjaehrig && (
                        <ChildCareOutlinedIcon
                          fontSize="small"
                          sx={{ color: 'text.secondary' }}
                          titleAccess="Minderjährig — Jugendarbeitsschutz beachten"
                        />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>{m.taetigkeit}</TableCell>
                  <TableCell>
                    <Chip size="small" label={beschaeftigungsartLabel(m.beschaeftigungsart)} />
                  </TableCell>
                  <TableCell>
                    {m.beschaeftigungsart.typ === 'Minijob'
                      ? `${m.beschaeftigungsart.minStunden}-${m.beschaeftigungsart.maxStunden}`
                      : m.beschaeftigungsart.wochenstunden}
                  </TableCell>
                  <TableCell>{m.urlaubsanspruchProJahr}</TableCell>
                  <TableCell>
                    <Chip size="small" label={m.aktiv ? 'Aktiv' : 'Inaktiv'} color={m.aktiv ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => dialogOeffnenBearbeiten(m)} aria-label={`${vollerName(m)} bearbeiten`}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setStatusZiel(m)}
                      aria-label={m.aktiv ? `${vollerName(m)} deaktivieren` : `${vollerName(m)} aktivieren`}
                    >
                      {m.aktiv ? <ToggleOnOutlinedIcon fontSize="small" /> : <ToggleOffOutlinedIcon fontSize="small" />}
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOffen} onClose={() => setDialogOffen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{formular.id ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Vorname"
                value={formular.vorname}
                onChange={(e) => setFormular((f) => ({ ...f, vorname: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Nachname"
                value={formular.nachname}
                onChange={(e) => setFormular((f) => ({ ...f, nachname: e.target.value }))}
                fullWidth
              />
            </Stack>

            <Autocomplete
              freeSolo
              options={[...TAETIGKEITS_VORSCHLAEGE]}
              value={formular.taetigkeit}
              onInputChange={(_, wert) => setFormular((f) => ({ ...f, taetigkeit: wert }))}
              renderInput={(params) => <TextField {...params} label="Tätigkeit" />}
            />

            <TextField
              select
              label="Beschäftigungsart"
              value={formular.typ}
              onChange={(e) => setFormular((f) => ({ ...f, typ: e.target.value as BeschaeftigungstypAuswahl }))}
            >
              <MenuItem value="Vollzeit">Vollzeit</MenuItem>
              <MenuItem value="Teilzeit">Teilzeit</MenuItem>
              <MenuItem value="Minijob">Geringfügig beschäftigt (Minijob)</MenuItem>
            </TextField>

            {formular.typ === 'Minijob' ? (
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Min. Std./Woche"
                  type="number"
                  value={formular.minStunden}
                  onChange={(e) => setFormular((f) => ({ ...f, minStunden: e.target.value }))}
                  fullWidth
                />
                <TextField
                  label="Max. Std./Woche"
                  type="number"
                  value={formular.maxStunden}
                  onChange={(e) => setFormular((f) => ({ ...f, maxStunden: e.target.value }))}
                  fullWidth
                />
              </Stack>
            ) : (
              <TextField
                label="Wochenstunden"
                type="number"
                value={formular.wochenstunden}
                onChange={(e) => setFormular((f) => ({ ...f, wochenstunden: e.target.value }))}
                fullWidth
              />
            )}

            <Stack direction="row" spacing={2}>
              <TextField
                label="Urlaubsanspruch/Jahr (Tage)"
                type="number"
                value={formular.urlaubsanspruchProJahr}
                onChange={(e) => setFormular((f) => ({ ...f, urlaubsanspruchProJahr: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Geburtsdatum (optional)"
                type="date"
                value={formular.geburtsdatum}
                onChange={(e) => setFormular((f) => ({ ...f, geburtsdatum: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                helperText="Nur für Jugendarbeitsschutz relevant"
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOffen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={speichern} disabled={wirdGespeichert}>
            Speichern
          </Button>
        </DialogActions>
      </Dialog>

      <BestaetigungsDialog
        open={!!statusZiel}
        titel={statusZiel?.aktiv ? 'Mitarbeiter deaktivieren?' : 'Mitarbeiter aktivieren?'}
        text={
          statusZiel?.aktiv
            ? `${statusZiel ? vollerName(statusZiel) : ''} wird als inaktiv markiert und erscheint nicht mehr in neuen Wochenplänen. Bereits erfasste Wochenpläne und Abwesenheiten bleiben vollständig erhalten, der Mitarbeiter kann jederzeit wieder aktiviert werden.`
            : `${statusZiel ? vollerName(statusZiel) : ''} wird wieder als aktiv markiert.`
        }
        bestaetigenText={statusZiel?.aktiv ? 'Deaktivieren' : 'Aktivieren'}
        onBestaetigen={statusAendern}
        onAbbrechen={() => setStatusZiel(null)}
      />

      <FehlerSnackbar fehler={fehler} onClose={zuruecksetzen} />
    </Box>
  );
}
