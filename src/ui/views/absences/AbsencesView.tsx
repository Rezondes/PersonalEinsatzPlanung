import { useMemo, useState } from 'react';
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
import type { EmployeeId } from '@domain/shared/ids';
import { formatISODateGerman } from '@domain/shared/DateFormat';
import type { Absence } from '@domain/absence/Absence';
import { remainingVacationByEmployee } from '@domain/absence/vacationCalculation';
import { fullName } from '@domain/employee/Employee';
import { services } from '@infrastructure/services';
import { createHolidayCheck } from '@infrastructure/holidays/germanHolidays';
import { useSelectedBranch } from '@ui/hooks/useBranch';
import { useEmployeeList } from '@ui/hooks/useEmployeeList';
import { useAbsences } from '@ui/hooks/useAbsences';
import { useErrorSnackbar } from '@ui/hooks/useErrorSnackbar';
import { ErrorSnackbar } from '@ui/components/ErrorSnackbar';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';

type AbsenceType = 'Vacation' | 'Illness' | 'Other';

interface FormState {
  employeeId: string;
  type: AbsenceType;
  from: string;
  to: string;
  label: string;
  note: string;
  halfDayAtStart: boolean;
  halfDayAtEnd: boolean;
}

function emptyForm(firstEmployeeId: string): FormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    employeeId: firstEmployeeId,
    type: 'Vacation',
    from: today,
    to: today,
    label: '',
    note: '',
    halfDayAtStart: false,
    halfDayAtEnd: false,
  };
}

function absenceTypeLabel(a: Absence): string {
  switch (a.type) {
    case 'Vacation':
      return 'Urlaub';
    case 'Illness':
      return 'Krankheit';
    case 'Other':
      return a.label;
  }
}

export function AbsencesView() {
  const { branch } = useSelectedBranch();
  const { employeeList } = useEmployeeList(branch?.id ?? null);
  const activeEmployees = employeeList.filter((emp) => emp.active);
  const employeeIds = employeeList.map((emp) => emp.id);
  const { absences, reload } = useAbsences(employeeIds);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(''));
  const [deleteTarget, setDeleteTarget] = useState<Absence | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { error, report, reset } = useErrorSnackbar();

  const year = new Date().getFullYear();

  // Derived synchronously from the absences this view already holds - no repository round trip
  // per employee. Recomputes after adding/deleting an absence, since `absences` changes identity
  // on reload.
  const remainingVacation = useMemo(
    () =>
      branch
        ? remainingVacationByEmployee(employeeList, absences, year, createHolidayCheck(branch.federalState))
        : new Map<EmployeeId, number>(),
    [branch, employeeList, absences, year],
  );

  const openDialog = () => {
    setForm(emptyForm(activeEmployees[0]?.id ?? ''));
    setFormError(null);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.employeeId || !form.from || !form.to) return;
    if (form.to < form.from) {
      setFormError('"Bis" darf nicht vor "Von" liegen.');
      return;
    }
    setFormError(null);

    try {
      if (form.type === 'Vacation') {
        const halfDay =
          form.halfDayAtStart || form.halfDayAtEnd
            ? { atStart: form.halfDayAtStart, atEnd: form.halfDayAtEnd }
            : undefined;
        await services.absence.create({
          employeeId: form.employeeId as EmployeeId,
          type: 'Vacation',
          from: form.from,
          to: form.to,
          halfDay,
          note: form.note || undefined,
        });
      } else if (form.type === 'Illness') {
        await services.absence.create({
          employeeId: form.employeeId as EmployeeId,
          type: 'Illness',
          from: form.from,
          to: form.to,
        });
      } else {
        await services.absence.create({
          employeeId: form.employeeId as EmployeeId,
          type: 'Other',
          from: form.from,
          to: form.to,
          label: form.label || 'Sonstige Abwesenheit',
          note: form.note || undefined,
        });
      }
      setDialogOpen(false);
      await reload();
    } catch (e) {
      report(e, 'Abwesenheit konnte nicht gespeichert werden');
    }
  };

  const deleteAbsence = async () => {
    if (!deleteTarget) return;
    try {
      await services.absence.delete(deleteTarget.id);
      await reload();
    } catch (e) {
      report(e, 'Abwesenheit konnte nicht gelöscht werden');
    } finally {
      setDeleteTarget(null);
    }
  };

  if (!branch) {
    return <Alert severity="info">Bitte zuerst oben eine Filiale auswählen oder anlegen.</Alert>;
  }

  const sorted = [...absences].sort((a, b) => b.from.localeCompare(a.from));
  const singleDay = form.from === form.to;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={500}>
          Abwesenheiten · {branch.name}
        </Typography>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={openDialog} disabled={activeEmployees.length === 0}>
          Abwesenheit erfassen
        </Button>
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        {employeeList.map((emp) => (
          <Paper key={emp.id} sx={{ p: 2, flex: '1 1 220px', minWidth: 220, opacity: emp.active ? 1 : 0.55 }}>
            <Typography variant="body2" fontWeight={500}>
              {fullName(emp)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Resturlaub {year}: {remainingVacation.get(emp.id)?.toLocaleString('de-DE') ?? '–'} von{' '}
              {emp.vacationEntitlementPerYear.toLocaleString('de-DE')} Tagen
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
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    Noch keine Abwesenheiten erfasst.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {sorted.map((a) => {
              const employee = employeeList.find((emp) => emp.id === a.employeeId);
              // atStart = absent at the start of the day (morning), atEnd = absent at the end
              // (afternoon) - must match the "Nur vormittags/nachmittags frei" checkbox labels below.
              const halfDayText =
                a.type === 'Vacation' && a.halfDay && a.from === a.to
                  ? a.halfDay.atStart
                    ? ' (vormittags)'
                    : a.halfDay.atEnd
                      ? ' (nachmittags)'
                      : ''
                  : '';
              return (
                <TableRow key={a.id} hover>
                  <TableCell>{employee ? fullName(employee) : '–'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={absenceTypeLabel(a) + halfDayText} />
                  </TableCell>
                  <TableCell>{formatISODateGerman(a.from)}</TableCell>
                  <TableCell>{formatISODateGerman(a.to)}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setDeleteTarget(a)} aria-label="Löschen">
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Abwesenheit erfassen</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Mitarbeiter"
              value={form.employeeId}
              onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
              fullWidth
            >
              {activeEmployees.map((emp) => (
                <MenuItem key={emp.id} value={emp.id}>
                  {fullName(emp)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Art"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AbsenceType }))}
              fullWidth
            >
              <MenuItem value="Vacation">Urlaub</MenuItem>
              <MenuItem value="Illness">Krankheit</MenuItem>
              <MenuItem value="Other">Sonstige</MenuItem>
            </TextField>
            {form.type === 'Other' && (
              <TextField
                label="Bezeichnung"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                fullWidth
              />
            )}
            <Stack direction="row" spacing={2}>
              <TextField
                label="Von"
                type="date"
                value={form.from}
                onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Bis"
                type="date"
                value={form.to}
                onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
            {formError && <Alert severity="error">{formError}</Alert>}
            {form.type === 'Vacation' && singleDay && (
              <Stack direction="row" spacing={2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.halfDayAtStart}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, halfDayAtStart: e.target.checked, halfDayAtEnd: false }))
                      }
                    />
                  }
                  label="Nur vormittags frei"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.halfDayAtEnd}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, halfDayAtEnd: e.target.checked, halfDayAtStart: false }))
                      }
                    />
                  }
                  label="Nur nachmittags frei"
                />
              </Stack>
            )}
            {form.type === 'Vacation' && (
              <TextField
                label="Notiz (optional)"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                fullWidth
                multiline
                minRows={2}
              />
            )}
            {form.type === 'Illness' && (
              <Alert severity="info">Es werden bewusst keine Diagnose- oder Gesundheitsdetails erfasst.</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={save}>
            Speichern
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Abwesenheit löschen?"
        text="Dieser Eintrag wird unwiderruflich entfernt."
        confirmText="Löschen"
        dangerous
        onConfirm={deleteAbsence}
        onCancel={() => setDeleteTarget(null)}
      />

      <ErrorSnackbar error={error} onClose={reset} />
    </Box>
  );
}
