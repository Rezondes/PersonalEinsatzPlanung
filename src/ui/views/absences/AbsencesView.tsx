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
import { AbsenceDialog } from './AbsenceDialog';

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
  // Mounted only while open, so the form starts fresh each time.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Absence | null>(null);
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

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={500}>
          Abwesenheiten · {branch.name}
        </Typography>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)} disabled={activeEmployees.length === 0}>
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

      {dialogOpen && (
        <AbsenceDialog employees={activeEmployees} onClose={() => setDialogOpen(false)} onSaved={reload} onError={report} />
      )}

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
