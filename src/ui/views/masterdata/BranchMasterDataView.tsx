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
import type { Branch, FederalState } from '@domain/branch/Branch';
import { FEDERAL_STATES } from '@domain/branch/Branch';
import { formatISODateGerman } from '@domain/shared/DateFormat';
import { services } from '@infrastructure/services';
import { useBranchList } from '@ui/hooks/useBranch';
import { useErrorSnackbar } from '@ui/hooks/useErrorSnackbar';
import { ErrorSnackbar } from '@ui/components/ErrorSnackbar';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';

interface FormState {
  id: string | null;
  name: string;
  branchNumber: string;
  federalState: FederalState;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  logoBase64: string | null;
  allowedOpenSundays: string[];
}

function emptyForm(): FormState {
  return {
    id: null,
    name: '',
    branchNumber: '',
    federalState: 'Niedersachsen',
    street: '',
    houseNumber: '',
    postalCode: '',
    city: '',
    logoBase64: null,
    allowedOpenSundays: [],
  };
}

function formFromBranch(b: Branch): FormState {
  return {
    id: b.id,
    name: b.name,
    branchNumber: b.branchNumber,
    federalState: b.federalState,
    street: b.address.street,
    houseNumber: b.address.houseNumber,
    postalCode: b.address.postalCode,
    city: b.address.city,
    logoBase64: b.logoBase64,
    allowedOpenSundays: b.allowedOpenSundays,
  };
}

function readLogoAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Logo konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
}

export function BranchMasterDataView() {
  const { branches, loading, reload } = useBranchList();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [logoReading, setLogoReading] = useState(false);
  const [newSunday, setNewSunday] = useState('');
  const [statusTarget, setStatusTarget] = useState<Branch | null>(null);
  const { error, report, reset } = useErrorSnackbar();

  const openNewDialog = () => {
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEditDialog = (b: Branch) => {
    setForm(formFromBranch(b));
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.branchNumber.trim()) {
      return;
    }
    setSaving(true);
    try {
      const address = {
        street: form.street,
        houseNumber: form.houseNumber,
        postalCode: form.postalCode,
        city: form.city,
      };

      if (form.id) {
        const existing = branches.find((b) => b.id === form.id);
        if (existing) {
          await services.branch.update({
            ...existing,
            name: form.name,
            branchNumber: form.branchNumber,
            federalState: form.federalState,
            address,
            logoBase64: form.logoBase64,
            allowedOpenSundays: form.allowedOpenSundays,
          });
        }
      } else {
        const created = await services.branch.create({
          name: form.name,
          branchNumber: form.branchNumber,
          federalState: form.federalState,
          address,
          logoBase64: form.logoBase64,
        });
        if (form.allowedOpenSundays.length > 0) {
          await services.branch.update({
            ...created,
            allowedOpenSundays: form.allowedOpenSundays,
          });
        }
      }
      setDialogOpen(false);
      await reload();
    } catch (e) {
      report(e, 'Filiale konnte nicht gespeichert werden');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async () => {
    if (!statusTarget) return;
    try {
      await services.branch.changeActiveStatus(statusTarget, !statusTarget.active);
      await reload();
    } catch (e) {
      report(e, 'Status konnte nicht geändert werden');
    } finally {
      setStatusTarget(null);
    }
  };

  const uploadLogo = async (file: File | null) => {
    if (!file) return;
    setLogoReading(true);
    try {
      const base64 = await readLogoAsBase64(file);
      setForm((f) => ({ ...f, logoBase64: base64 }));
    } catch (e) {
      report(e, 'Logo konnte nicht gelesen werden');
    } finally {
      setLogoReading(false);
    }
  };

  const addSunday = () => {
    if (!newSunday || form.allowedOpenSundays.includes(newSunday)) return;
    setForm((f) => ({
      ...f,
      allowedOpenSundays: [...f.allowedOpenSundays, newSunday].sort(),
    }));
    setNewSunday('');
  };

  const removeSunday = (date: string) => {
    setForm((f) => ({
      ...f,
      allowedOpenSundays: f.allowedOpenSundays.filter((d) => d !== date),
    }));
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={500}>
          Filialen
        </Typography>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={openNewDialog}>
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
            {!loading && branches.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    Noch keine Filiale angelegt.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {branches.map((b) => (
              <TableRow key={b.id} hover sx={{ opacity: b.active ? 1 : 0.55 }}>
                <TableCell>
                  <Avatar src={b.logoBase64 ?? undefined} variant="rounded" sx={{ bgcolor: '#eef3f1' }}>
                    <StoreOutlinedIcon sx={{ color: '#2f5d50' }} fontSize="small" />
                  </Avatar>
                </TableCell>
                <TableCell>{b.name}</TableCell>
                <TableCell>{b.branchNumber}</TableCell>
                <TableCell>{b.address.city || '-'}</TableCell>
                <TableCell>{b.federalState}</TableCell>
                <TableCell>
                  <Chip size="small" label={b.active ? 'Aktiv' : 'Inaktiv'} color={b.active ? 'success' : 'default'} />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEditDialog(b)} aria-label={`${b.name} bearbeiten`}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => setStatusTarget(b)}
                    aria-label={b.active ? `${b.name} deaktivieren` : `${b.name} aktivieren`}
                  >
                    {b.active ? <ToggleOnOutlinedIcon fontSize="small" /> : <ToggleOffOutlinedIcon fontSize="small" />}
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{form.id ? 'Filiale bearbeiten' : 'Neue Filiale'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar src={form.logoBase64 ?? undefined} variant="rounded" sx={{ width: 56, height: 56, bgcolor: '#eef3f1' }}>
                <StoreOutlinedIcon sx={{ color: '#2f5d50' }} />
              </Avatar>
              <Button variant="text" component="label" size="small" disabled={logoReading}>
                {logoReading ? 'Logo wird gelesen…' : 'Logo hochladen'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => uploadLogo(e.target.files?.[0] ?? null)}
                />
              </Button>
            </Stack>
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Velpke - Weidenweg"
              fullWidth
            />
            <TextField
              label="Filialnummer"
              value={form.branchNumber}
              onChange={(e) => setForm((f) => ({ ...f, branchNumber: e.target.value }))}
              placeholder="2504"
              fullWidth
            />
            <TextField
              select
              label="Bundesland"
              value={form.federalState}
              onChange={(e) => setForm((f) => ({ ...f, federalState: e.target.value as FederalState }))}
              fullWidth
            >
              {FEDERAL_STATES.map((state) => (
                <MenuItem key={state} value={state}>
                  {state}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Straße"
                value={form.street}
                onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Nr."
                value={form.houseNumber}
                onChange={(e) => setForm((f) => ({ ...f, houseNumber: e.target.value }))}
                sx={{ width: 100 }}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="PLZ"
                value={form.postalCode}
                onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                sx={{ width: 140 }}
              />
              <TextField
                label="Ort"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
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
                value={newSunday}
                onChange={(e) => setNewSunday(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <Button onClick={addSunday} disabled={!newSunday}>
                Hinzufügen
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {form.allowedOpenSundays.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Keine verkaufsoffenen Sonntage hinterlegt.
                </Typography>
              )}
              {form.allowedOpenSundays.map((date) => (
                <Chip key={date} label={formatISODateGerman(date)} onDelete={() => removeSunday(date)} size="small" />
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={save} disabled={saving || logoReading}>
            Speichern
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!statusTarget}
        title={statusTarget?.active ? 'Filiale deaktivieren?' : 'Filiale aktivieren?'}
        text={
          statusTarget?.active
            ? `${statusTarget?.name} wird als inaktiv markiert und verschwindet aus der Filial-Auswahl. Mitarbeiter, Wochenpläne und Abwesenheiten bleiben vollständig erhalten und die Filiale kann jederzeit wieder aktiviert werden.`
            : `${statusTarget?.name} wird wieder als aktiv markiert und erscheint wieder in der Filial-Auswahl.`
        }
        confirmText={statusTarget?.active ? 'Deaktivieren' : 'Aktivieren'}
        onConfirm={changeStatus}
        onCancel={() => setStatusTarget(null)}
      />

      <ErrorSnackbar error={error} onClose={reset} />
    </Box>
  );
}
