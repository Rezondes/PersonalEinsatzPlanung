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
import type { Employee } from '@domain/employee/Employee';
import { fullName } from '@domain/employee/Employee';
import { employmentTypeLabel } from '@domain/employee/EmploymentType';
import { JOB_TITLE_SUGGESTIONS } from '@domain/employee/jobTitleSuggestions';
import { isMinor } from '@domain/validation/arbzg/youthProtection';
import { services } from '@infrastructure/services';
import { useSelectedBranch } from '@ui/hooks/useBranch';
import { useEmployeeList } from '@ui/hooks/useEmployeeList';
import { useErrorSnackbar } from '@ui/hooks/useErrorSnackbar';
import { ErrorSnackbar } from '@ui/components/ErrorSnackbar';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { DecimalTextField } from '@ui/components/DecimalTextField';

type EmploymentTypeSelection = 'FullTime' | 'PartTime' | 'Minijob';

interface FormState {
  id: string | null;
  lastName: string;
  firstName: string;
  jobTitle: string;
  type: EmploymentTypeSelection;
  weeklyHours: number | undefined;
  minHours: number | undefined;
  maxHours: number | undefined;
  vacationEntitlementPerYear: number | undefined;
  birthDate: string;
}

function emptyForm(): FormState {
  return {
    id: null,
    lastName: '',
    firstName: '',
    jobTitle: '',
    type: 'PartTime',
    weeklyHours: undefined,
    minHours: undefined,
    maxHours: undefined,
    vacationEntitlementPerYear: 28,
    birthDate: '',
  };
}

function formFromEmployee(emp: Employee): FormState {
  const et = emp.employmentType;
  return {
    id: emp.id,
    lastName: emp.lastName,
    firstName: emp.firstName,
    jobTitle: emp.jobTitle,
    type: et.type,
    weeklyHours: et.type !== 'Minijob' ? et.weeklyHours : undefined,
    minHours: et.type === 'Minijob' ? et.minHours : undefined,
    maxHours: et.type === 'Minijob' ? et.maxHours : undefined,
    vacationEntitlementPerYear: emp.vacationEntitlementPerYear,
    birthDate: emp.birthDate ?? '',
  };
}

export function EmployeeMasterDataView() {
  const { branch } = useSelectedBranch();
  const { employeeList, loading, reload } = useEmployeeList(branch?.id ?? null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Employee | null>(null);
  const { error, report, reset } = useErrorSnackbar();

  const openNewDialog = () => {
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEditDialog = (emp: Employee) => {
    setForm(formFromEmployee(emp));
    setDialogOpen(true);
  };

  const save = async () => {
    if (!branch || !form.lastName.trim() || !form.firstName.trim()) {
      return;
    }

    const employmentType =
      form.type === 'Minijob'
        ? { type: 'Minijob' as const, minHours: form.minHours ?? 0, maxHours: form.maxHours ?? 0 }
        : { type: form.type, weeklyHours: form.weeklyHours ?? 0 };

    setSaving(true);
    try {
      if (form.id) {
        const existing = employeeList.find((emp) => emp.id === form.id);
        if (existing) {
          await services.employee.update({
            ...existing,
            lastName: form.lastName,
            firstName: form.firstName,
            jobTitle: form.jobTitle,
            employmentType,
            vacationEntitlementPerYear: form.vacationEntitlementPerYear ?? 0,
            birthDate: form.birthDate || undefined,
          });
        }
      } else {
        await services.employee.create({
          branchId: branch.id,
          lastName: form.lastName,
          firstName: form.firstName,
          jobTitle: form.jobTitle,
          employmentType,
          vacationEntitlementPerYear: form.vacationEntitlementPerYear ?? 0,
          birthDate: form.birthDate || undefined,
        });
      }
      setDialogOpen(false);
      await reload();
    } catch (e) {
      report(e, 'Mitarbeiter konnte nicht gespeichert werden');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async () => {
    if (!statusTarget) return;
    try {
      await services.employee.changeActiveStatus(statusTarget, !statusTarget.active);
      await reload();
    } catch (e) {
      report(e, 'Status konnte nicht geändert werden');
    } finally {
      setStatusTarget(null);
    }
  };

  if (!branch) {
    return <Alert severity="info">Bitte zuerst oben eine Filiale auswählen oder anlegen.</Alert>;
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={500}>
          Mitarbeiter · {branch.name}
        </Typography>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={openNewDialog}>
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
            {!loading && employeeList.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    Noch kein Mitarbeiter angelegt.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {employeeList.map((emp) => {
              const minor = isMinor(emp.birthDate, new Date());
              return (
                <TableRow key={emp.id} hover sx={{ opacity: emp.active ? 1 : 0.55 }}>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {fullName(emp)}
                      {minor && (
                        <ChildCareOutlinedIcon
                          fontSize="small"
                          sx={{ color: 'text.secondary' }}
                          titleAccess="Minderjährig — Jugendarbeitsschutz beachten"
                        />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>{emp.jobTitle}</TableCell>
                  <TableCell>
                    <Chip size="small" label={employmentTypeLabel(emp.employmentType)} />
                  </TableCell>
                  <TableCell>
                    {emp.employmentType.type === 'Minijob'
                      ? `${emp.employmentType.minHours.toLocaleString('de-DE')}-${emp.employmentType.maxHours.toLocaleString('de-DE')}`
                      : emp.employmentType.weeklyHours.toLocaleString('de-DE')}
                  </TableCell>
                  <TableCell>{emp.vacationEntitlementPerYear.toLocaleString('de-DE')}</TableCell>
                  <TableCell>
                    <Chip size="small" label={emp.active ? 'Aktiv' : 'Inaktiv'} color={emp.active ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEditDialog(emp)} aria-label={`${fullName(emp)} bearbeiten`}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setStatusTarget(emp)}
                      aria-label={emp.active ? `${fullName(emp)} deaktivieren` : `${fullName(emp)} aktivieren`}
                    >
                      {emp.active ? <ToggleOnOutlinedIcon fontSize="small" /> : <ToggleOffOutlinedIcon fontSize="small" />}
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{form.id ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Vorname"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Nachname"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                fullWidth
              />
            </Stack>

            <Autocomplete
              freeSolo
              options={[...JOB_TITLE_SUGGESTIONS]}
              value={form.jobTitle}
              onInputChange={(_, value) => setForm((f) => ({ ...f, jobTitle: value }))}
              renderInput={(params) => <TextField {...params} label="Tätigkeit" />}
            />

            <TextField
              select
              label="Beschäftigungsart"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as EmploymentTypeSelection }))}
            >
              <MenuItem value="FullTime">Vollzeit</MenuItem>
              <MenuItem value="PartTime">Teilzeit</MenuItem>
              <MenuItem value="Minijob">Geringfügig beschäftigt (Minijob)</MenuItem>
            </TextField>

            {form.type === 'Minijob' ? (
              <Stack direction="row" spacing={2}>
                <DecimalTextField
                  label="Min. Std./Woche"
                  value={form.minHours}
                  onChange={(value) => setForm((f) => ({ ...f, minHours: value }))}
                  fullWidth
                />
                <DecimalTextField
                  label="Max. Std./Woche"
                  value={form.maxHours}
                  onChange={(value) => setForm((f) => ({ ...f, maxHours: value }))}
                  fullWidth
                />
              </Stack>
            ) : (
              <DecimalTextField
                label="Wochenstunden"
                value={form.weeklyHours}
                onChange={(value) => setForm((f) => ({ ...f, weeklyHours: value }))}
                fullWidth
              />
            )}

            <Stack direction="row" spacing={2}>
              <DecimalTextField
                label="Urlaubsanspruch/Jahr (Tage)"
                value={form.vacationEntitlementPerYear}
                onChange={(value) => setForm((f) => ({ ...f, vacationEntitlementPerYear: value }))}
                fullWidth
              />
              <TextField
                label="Geburtsdatum (optional)"
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                helperText="Nur für Jugendarbeitsschutz relevant"
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={save} disabled={saving}>
            Speichern
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!statusTarget}
        title={statusTarget?.active ? 'Mitarbeiter deaktivieren?' : 'Mitarbeiter aktivieren?'}
        text={
          statusTarget?.active
            ? `${statusTarget ? fullName(statusTarget) : ''} wird als inaktiv markiert und erscheint nicht mehr in neuen Wochenplänen. Bereits erfasste Wochenpläne und Abwesenheiten bleiben vollständig erhalten, der Mitarbeiter kann jederzeit wieder aktiviert werden.`
            : `${statusTarget ? fullName(statusTarget) : ''} wird wieder als aktiv markiert.`
        }
        confirmText={statusTarget?.active ? 'Deaktivieren' : 'Aktivieren'}
        onConfirm={changeStatus}
        onCancel={() => setStatusTarget(null)}
      />

      <ErrorSnackbar error={error} onClose={reset} />
    </Box>
  );
}
