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
import TableSortLabel from '@mui/material/TableSortLabel';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { EmployeeId } from '@domain/shared/ids';
import { formatISODateGerman } from '@domain/shared/DateFormat';
import type { Absence } from '@domain/absence/Absence';
import { remainingVacationByEmployee } from '@domain/absence/vacationCalculation';
import type { Employee } from '@domain/employee/Employee';
import { compareByLastName, fullName } from '@domain/employee/Employee';
import { services } from '@infrastructure/services';
import { createHolidayCheck } from '@infrastructure/holidays/germanHolidays';
import { useSelectedBranch } from '@ui/hooks/useBranch';
import { useEmployeeList } from '@ui/hooks/useEmployeeList';
import { useAbsences } from '@ui/hooks/useAbsences';
import { useErrorSnackbar } from '@ui/hooks/useErrorSnackbar';
import { useTableSort } from '@ui/hooks/useTableSort';
import { ErrorSnackbar } from '@ui/components/ErrorSnackbar';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { AbsenceDialog } from './AbsenceDialog';

type SortKey = 'employee' | 'type' | 'from' | 'to';
type TypeFilter = 'all' | 'Vacation' | 'Illness' | 'Other';

const ALL = 'all';
const COLUMN_COUNT = 6;

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

/** The plain kind, independent of the free-text label an "Other" entry carries - so sorting by
 * "Art" groups all Sonstige entries together instead of scattering them by their label. */
function absenceKindLabel(a: Absence): string {
  switch (a.type) {
    case 'Vacation':
      return 'Urlaub';
    case 'Illness':
      return 'Krankheit';
    case 'Other':
      return 'Sonstige';
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
  const [employeeFilter, setEmployeeFilter] = useState<string>(ALL);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(ALL);
  const [yearFilter, setYearFilter] = useState<string>(ALL);
  const { error, report, reset } = useErrorSnackbar();
  // Newest first, the order this view had before it became sortable.
  const sort = useTableSort<SortKey>('from', 'desc');

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

  const employeeById = useMemo(
    () => new Map(employeeList.map((emp) => [emp.id, emp])),
    [employeeList],
  );

  /** Every year any absence touches, so a range crossing New Year shows up under both. */
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const absence of absences) {
      const fromYear = Number(absence.from.slice(0, 4));
      const toYear = Number(absence.to.slice(0, 4));
      for (let y = fromYear; y <= toYear; y += 1) {
        years.add(String(y));
      }
    }
    return [...years].sort((a, b) => b.localeCompare(a));
  }, [absences]);

  const { headProps, sortRows } = sort;
  const visibleAbsences = useMemo(() => {
    const comparators: Record<SortKey, (a: Absence, b: Absence) => number> = {
      employee: (a, b) => {
        const empA = employeeById.get(a.employeeId);
        const empB = employeeById.get(b.employeeId);
        if (!empA || !empB) return 0;
        return compareByLastName(empA, empB) || a.from.localeCompare(b.from);
      },
      type: (a, b) => absenceKindLabel(a).localeCompare(absenceKindLabel(b), 'de') || a.from.localeCompare(b.from),
      from: (a, b) => a.from.localeCompare(b.from),
      to: (a, b) => a.to.localeCompare(b.to),
    };

    const filtered = absences.filter((a) => {
      if (employeeFilter !== ALL && a.employeeId !== employeeFilter) return false;
      if (typeFilter !== ALL && a.type !== typeFilter) return false;
      // An absence belongs to a year when its range overlaps it, so a range crossing New Year is
      // found under both years - the same rule countVacationDaysInYear applies.
      if (yearFilter !== ALL && !(a.from.slice(0, 4) <= yearFilter && yearFilter <= a.to.slice(0, 4))) {
        return false;
      }
      return true;
    });
    return sortRows(filtered, comparators);
  }, [absences, employeeById, employeeFilter, typeFilter, yearFilter, sortRows]);

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

  const employeeName = (employee: Employee | undefined) => (employee ? fullName(employee) : '–');

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

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
          <TextField
            select
            size="small"
            label="Mitarbeiter"
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            sx={{ width: 240 }}
          >
            <MenuItem value={ALL}>Alle</MenuItem>
            {employeeList.map((emp) => (
              <MenuItem key={emp.id} value={emp.id}>
                {fullName(emp)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Art"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            sx={{ width: 180 }}
          >
            <MenuItem value={ALL}>Alle</MenuItem>
            <MenuItem value="Vacation">Urlaub</MenuItem>
            <MenuItem value="Illness">Krankheit</MenuItem>
            <MenuItem value="Other">Sonstige</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Jahr"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            sx={{ width: 140 }}
          >
            <MenuItem value={ALL}>Alle</MenuItem>
            {availableYears.map((y) => (
              <MenuItem key={y} value={y}>
                {y}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="body2" color="text.secondary">
            {visibleAbsences.length} von {absences.length} Einträgen
          </Typography>
        </Stack>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel {...headProps('employee')}>Mitarbeiter</TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel {...headProps('type')}>Art</TableSortLabel>
              </TableCell>
              <TableCell>Std./Tag</TableCell>
              <TableCell>
                <TableSortLabel {...headProps('from')}>Von</TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel {...headProps('to')}>Bis</TableSortLabel>
              </TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {absences.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    Noch keine Abwesenheiten erfasst.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {absences.length > 0 && visibleAbsences.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    Kein Eintrag passt zu den Filtern.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {visibleAbsences.map((a) => {
              const employee = employeeById.get(a.employeeId);
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
                  <TableCell>{employeeName(employee)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={absenceTypeLabel(a) + halfDayText} />
                  </TableCell>
                  <TableCell>
                    {a.type === 'Other' && a.hoursPerDay !== undefined
                      ? a.hoursPerDay.toLocaleString('de-DE')
                      : '–'}
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
