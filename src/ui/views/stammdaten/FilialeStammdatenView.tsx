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
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined';
import StoreOutlinedIcon from '@mui/icons-material/StoreOutlined';
import type { Filiale, Bundesland } from '@domain/filiale/Filiale';
import { BUNDESLAENDER } from '@domain/filiale/Filiale';
import { services } from '@infrastructure/services';
import { useFilialenListe } from '@ui/hooks/useFiliale';
import { useFehlerSnackbar } from '@ui/hooks/useFehlerSnackbar';
import { FehlerSnackbar } from '@ui/components/FehlerSnackbar';
import { BestaetigungsDialog } from '@ui/components/BestaetigungsDialog';

interface FormZustand {
  id: string | null;
  name: string;
  filialnummer: string;
  bundesland: Bundesland;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  logoBase64: string | null;
  erlaubteVerkaufsoffeneSonntage: string[];
}

function leeresFormular(): FormZustand {
  return {
    id: null,
    name: '',
    filialnummer: '',
    bundesland: 'Niedersachsen',
    strasse: '',
    hausnummer: '',
    plz: '',
    ort: '',
    logoBase64: null,
    erlaubteVerkaufsoffeneSonntage: [],
  };
}

function formularAusFiliale(f: Filiale): FormZustand {
  return {
    id: f.id,
    name: f.name,
    filialnummer: f.filialnummer,
    bundesland: f.bundesland,
    strasse: f.adresse.strasse,
    hausnummer: f.adresse.hausnummer,
    plz: f.adresse.plz,
    ort: f.adresse.ort,
    logoBase64: f.logoBase64,
    erlaubteVerkaufsoffeneSonntage: f.erlaubteVerkaufsoffeneSonntage,
  };
}

function logoAlsBase64Einlesen(datei: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Logo konnte nicht gelesen werden.'));
    reader.readAsDataURL(datei);
  });
}

export function FilialeStammdatenView() {
  const { filialen, laedt, neuLaden } = useFilialenListe();
  const [dialogOffen, setDialogOffen] = useState(false);
  const [formular, setFormular] = useState<FormZustand>(leeresFormular());
  const [wirdGespeichert, setWirdGespeichert] = useState(false);
  const [logoWirdGelesen, setLogoWirdGelesen] = useState(false);
  const [neuerSonntag, setNeuerSonntag] = useState('');
  const [statusZiel, setStatusZiel] = useState<Filiale | null>(null);
  const { fehler, melden, zuruecksetzen } = useFehlerSnackbar();

  const dialogOeffnenNeu = () => {
    setFormular(leeresFormular());
    setDialogOffen(true);
  };

  const dialogOeffnenBearbeiten = (f: Filiale) => {
    setFormular(formularAusFiliale(f));
    setDialogOffen(true);
  };

  const speichern = async () => {
    if (!formular.name.trim() || !formular.filialnummer.trim()) {
      return;
    }
    setWirdGespeichert(true);
    try {
      const adresse = {
        strasse: formular.strasse,
        hausnummer: formular.hausnummer,
        plz: formular.plz,
        ort: formular.ort,
      };

      if (formular.id) {
        const bestehend = filialen.find((f) => f.id === formular.id);
        if (bestehend) {
          await services.filiale.aktualisieren({
            ...bestehend,
            name: formular.name,
            filialnummer: formular.filialnummer,
            bundesland: formular.bundesland,
            adresse,
            logoBase64: formular.logoBase64,
            erlaubteVerkaufsoffeneSonntage: formular.erlaubteVerkaufsoffeneSonntage,
          });
        }
      } else {
        const angelegt = await services.filiale.anlegen({
          name: formular.name,
          filialnummer: formular.filialnummer,
          bundesland: formular.bundesland,
          adresse,
          logoBase64: formular.logoBase64,
        });
        if (formular.erlaubteVerkaufsoffeneSonntage.length > 0) {
          await services.filiale.aktualisieren({
            ...angelegt,
            erlaubteVerkaufsoffeneSonntage: formular.erlaubteVerkaufsoffeneSonntage,
          });
        }
      }
      setDialogOffen(false);
      await neuLaden();
    } catch (e) {
      melden(e, 'Filiale konnte nicht gespeichert werden');
    } finally {
      setWirdGespeichert(false);
    }
  };

  const statusAendern = async () => {
    if (!statusZiel) return;
    try {
      await services.filiale.aktivStatusAendern(statusZiel, !statusZiel.aktiv);
      await neuLaden();
    } catch (e) {
      melden(e, 'Status konnte nicht geändert werden');
    } finally {
      setStatusZiel(null);
    }
  };

  const logoHochladen = async (datei: File | null) => {
    if (!datei) return;
    setLogoWirdGelesen(true);
    try {
      const base64 = await logoAlsBase64Einlesen(datei);
      setFormular((f) => ({ ...f, logoBase64: base64 }));
    } catch (e) {
      melden(e, 'Logo konnte nicht gelesen werden');
    } finally {
      setLogoWirdGelesen(false);
    }
  };

  const sonntagHinzufuegen = () => {
    if (!neuerSonntag || formular.erlaubteVerkaufsoffeneSonntage.includes(neuerSonntag)) return;
    setFormular((f) => ({
      ...f,
      erlaubteVerkaufsoffeneSonntage: [...f.erlaubteVerkaufsoffeneSonntage, neuerSonntag].sort(),
    }));
    setNeuerSonntag('');
  };

  const sonntagEntfernen = (datum: string) => {
    setFormular((f) => ({
      ...f,
      erlaubteVerkaufsoffeneSonntage: f.erlaubteVerkaufsoffeneSonntage.filter((d) => d !== datum),
    }));
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={500}>
          Filialen
        </Typography>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={dialogOeffnenNeu}>
          Neue Filiale
        </Button>
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Logo</TableCell>
              <TableCell>Filiale</TableCell>
              <TableCell>Nr.</TableCell>
              <TableCell>Ort</TableCell>
              <TableCell>Bundesland</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!laedt && filialen.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    Noch keine Filiale angelegt.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {filialen.map((f) => (
              <TableRow key={f.id} hover sx={{ opacity: f.aktiv ? 1 : 0.55 }}>
                <TableCell>
                  <Avatar src={f.logoBase64 ?? undefined} variant="rounded" sx={{ bgcolor: '#eef3f1' }}>
                    <StoreOutlinedIcon sx={{ color: '#2f5d50' }} fontSize="small" />
                  </Avatar>
                </TableCell>
                <TableCell>{f.name}</TableCell>
                <TableCell>{f.filialnummer}</TableCell>
                <TableCell>{f.adresse.ort || '-'}</TableCell>
                <TableCell>{f.bundesland}</TableCell>
                <TableCell>
                  <Chip size="small" label={f.aktiv ? 'Aktiv' : 'Inaktiv'} color={f.aktiv ? 'success' : 'default'} />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => dialogOeffnenBearbeiten(f)} aria-label={`${f.name} bearbeiten`}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => setStatusZiel(f)}
                    aria-label={f.aktiv ? `${f.name} deaktivieren` : `${f.name} aktivieren`}
                  >
                    {f.aktiv ? <ToggleOnOutlinedIcon fontSize="small" /> : <ToggleOffOutlinedIcon fontSize="small" />}
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOffen} onClose={() => setDialogOffen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{formular.id ? 'Filiale bearbeiten' : 'Neue Filiale'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar src={formular.logoBase64 ?? undefined} variant="rounded" sx={{ width: 56, height: 56, bgcolor: '#eef3f1' }}>
                <StoreOutlinedIcon sx={{ color: '#2f5d50' }} />
              </Avatar>
              <Button variant="text" component="label" size="small" disabled={logoWirdGelesen}>
                {logoWirdGelesen ? 'Logo wird gelesen…' : 'Logo hochladen'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => logoHochladen(e.target.files?.[0] ?? null)}
                />
              </Button>
            </Stack>
            <TextField
              label="Name"
              value={formular.name}
              onChange={(e) => setFormular((f) => ({ ...f, name: e.target.value }))}
              placeholder="Velpke - Weidenweg"
              fullWidth
            />
            <TextField
              label="Filialnummer"
              value={formular.filialnummer}
              onChange={(e) => setFormular((f) => ({ ...f, filialnummer: e.target.value }))}
              placeholder="2504"
              fullWidth
            />
            <TextField
              select
              label="Bundesland"
              value={formular.bundesland}
              onChange={(e) => setFormular((f) => ({ ...f, bundesland: e.target.value as Bundesland }))}
              fullWidth
            >
              {BUNDESLAENDER.map((b) => (
                <MenuItem key={b} value={b}>
                  {b}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Straße"
                value={formular.strasse}
                onChange={(e) => setFormular((f) => ({ ...f, strasse: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Nr."
                value={formular.hausnummer}
                onChange={(e) => setFormular((f) => ({ ...f, hausnummer: e.target.value }))}
                sx={{ width: 100 }}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="PLZ"
                value={formular.plz}
                onChange={(e) => setFormular((f) => ({ ...f, plz: e.target.value }))}
                sx={{ width: 140 }}
              />
              <TextField
                label="Ort"
                value={formular.ort}
                onChange={(e) => setFormular((f) => ({ ...f, ort: e.target.value }))}
                fullWidth
              />
            </Stack>

            <Divider />
            <Typography variant="subtitle2">Verkaufsoffene Sonntage</Typography>
            <Typography variant="caption" color="text.secondary">
              Nur an diesen Terminen wird Sonntagsarbeit nicht als rechtlicher Hinweis markiert.
            </Typography>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Datum hinzufügen"
                type="date"
                size="small"
                value={neuerSonntag}
                onChange={(e) => setNeuerSonntag(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <Button onClick={sonntagHinzufuegen} disabled={!neuerSonntag}>
                Hinzufügen
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {formular.erlaubteVerkaufsoffeneSonntage.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Keine verkaufsoffenen Sonntage hinterlegt.
                </Typography>
              )}
              {formular.erlaubteVerkaufsoffeneSonntage.map((datum) => (
                <Chip key={datum} label={datum} onDelete={() => sonntagEntfernen(datum)} size="small" />
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOffen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={speichern} disabled={wirdGespeichert || logoWirdGelesen}>
            Speichern
          </Button>
        </DialogActions>
      </Dialog>

      <BestaetigungsDialog
        open={!!statusZiel}
        titel={statusZiel?.aktiv ? 'Filiale deaktivieren?' : 'Filiale aktivieren?'}
        text={
          statusZiel?.aktiv
            ? `${statusZiel?.name} wird als inaktiv markiert und verschwindet aus der Filial-Auswahl. Mitarbeiter, Wochenpläne und Abwesenheiten bleiben vollständig erhalten und die Filiale kann jederzeit wieder aktiviert werden.`
            : `${statusZiel?.name} wird wieder als aktiv markiert und erscheint wieder in der Filial-Auswahl.`
        }
        bestaetigenText={statusZiel?.aktiv ? 'Deaktivieren' : 'Aktivieren'}
        onBestaetigen={statusAendern}
        onAbbrechen={() => setStatusZiel(null)}
      />

      <FehlerSnackbar fehler={fehler} onClose={zuruecksetzen} />
    </Box>
  );
}
