import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined';
import ChildCareOutlinedIcon from '@mui/icons-material/ChildCareOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import type { Employee } from '@domain/employee/Employee';
import { compareByLastName, fullName } from '@domain/employee/Employee';
import { employmentTypeLabel, targetWeeklyHoursRange } from '@domain/employee/EmploymentType';
import { formatISODateGerman } from '@domain/shared/DateFormat';
import { isMinor } from '@domain/validation/arbzg/youthProtection';
import { services } from '@infrastructure/services';
import { useSelectedBranch } from '@ui/hooks/useBranch';
import { useEmployeeList } from '@ui/hooks/useEmployeeList';
import { useTableSort } from '@ui/hooks/useTableSort';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { EmployeeDialog } from './EmployeeDialog';
import { notify } from '@ui/app/store/notificationStore';

type SortKey = 'name' | 'jobTitle' | 'employment' | 'hours' | 'vacation' | 'holidayHours' | 'status';
type StatusFilter = 'all' | 'active' | 'inactive';
type EmploymentFilter = 'all' | 'FullTime' | 'PartTime' | 'Minijob';

const COLUMN_COUNT = 8;

/** German collation, like compareByLastName - a plain "a < b" would sort umlauts wrongly. */
function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'de');
}

/** Every comparator falls back to the name order, so equal values keep a stable, familiar order
 * instead of whatever the previous sort left behind. */
const COMPARATORS: Record<SortKey, (a: Employee, b: Employee) => number> = {
  name: compareByLastName,
  jobTitle: (a, b) => compareText(a.jobTitle, b.jobTitle) || compareByLastName(a, b),
  employment: (a, b) =>
    compareText(employmentTypeLabel(a.employmentType), employmentTypeLabel(b.employmentType)) ||
    compareByLastName(a, b),
  hours: (a, b) =>
    targetWeeklyHoursRange(a.employmentType).max - targetWeeklyHoursRange(b.employmentType).max ||
    compareByLastName(a, b),
  vacation: (a, b) => a.vacationEntitlementPerYear - b.vacationEntitlementPerYear || compareByLastName(a, b),
  // Records written before the field existed sort as 0 rather than producing NaN.
  holidayHours: (a, b) =>
    (a.holidayVacationHours ?? 0) - (b.holidayVacationHours ?? 0) || compareByLastName(a, b),
  status: (a, b) => Number(a.active) - Number(b.active) || compareByLastName(a, b),
};

function weeklyHoursText(employee: Employee): string {
  const range = targetWeeklyHoursRange(employee.employmentType);
  return range.min === range.max
    ? range.max.toLocaleString('de-DE')
    : `${range.min.toLocaleString('de-DE')}-${range.max.toLocaleString('de-DE')}`;
}

/** Shown as a caption under the name instead of two more columns - the table is wide enough. */
function employmentPeriodText(employee: Employee): string {
  if (employee.entryDate && employee.exitDate) {
    return `${formatISODateGerman(employee.entryDate)} - ${formatISODateGerman(employee.exitDate)}`;
  }
  if (employee.entryDate) {
    return `seit ${formatISODateGerman(employee.entryDate)}`;
  }
  if (employee.exitDate) {
    return `bis ${formatISODateGerman(employee.exitDate)}`;
  }
  return '';
}

export function EmployeeMasterDataView() {
  const { branch } = useSelectedBranch();
  const { employeeList, loading, reload } = useEmployeeList(branch?.id ?? null);
  // null = closed; { employee: null } = "Neuer Mitarbeiter"; { employee } = edit. The dialog is
  // mounted only while open so its form state starts fresh each time.
  const [dialog, setDialog] = useState<{ employee: Employee | null } | null>(null);
  const [statusTarget, setStatusTarget] = useState<Employee | null>(null);
  const [search, setSearch] = useState('');
  // Both filters default to "Alle": opening the view must never hide records the user expects.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [employmentFilter, setEmploymentFilter] = useState<EmploymentFilter>('all');
  const sort = useTableSort<SortKey>('name');

  const { headProps, sortRows } = sort;
  const visibleEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = employeeList.filter((emp) => {
      if (term && !`${fullName(emp)} ${emp.jobTitle}`.toLowerCase().includes(term)) {
        return false;
      }
      if (statusFilter === 'active' && !emp.active) return false;
      if (statusFilter === 'inactive' && emp.active) return false;
      if (employmentFilter !== 'all' && emp.employmentType.type !== employmentFilter) return false;
      return true;
    });
    return sortRows(filtered, COMPARATORS);
  }, [employeeList, search, statusFilter, employmentFilter, sortRows]);

  const changeStatus = async () => {
    if (!statusTarget) return;
    try {
      await services.employee.changeActiveStatus(statusTarget, !statusTarget.active);
      await reload();
    } catch (e) {
      notify.report(e, 'Status konnte nicht geändert werden');
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
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setDialog({ employee: null })}>
          Neuer Mitarbeiter
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
          <TextField
            size="small"
            placeholder="Name oder Tätigkeit"
            aria-label="Mitarbeiter suchen"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: 260 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            sx={{ width: 160 }}
          >
            <MenuItem value="all">Alle</MenuItem>
            <MenuItem value="active">Aktiv</MenuItem>
            <MenuItem value="inactive">Inaktiv</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Beschäftigung"
            value={employmentFilter}
            onChange={(e) => setEmploymentFilter(e.target.value as EmploymentFilter)}
            sx={{ width: 220 }}
          >
            <MenuItem value="all">Alle</MenuItem>
            <MenuItem value="FullTime">Vollzeit</MenuItem>
            <MenuItem value="PartTime">Teilzeit</MenuItem>
            <MenuItem value="Minijob">Geringfügig beschäftigt</MenuItem>
          </TextField>
          <Typography variant="body2" color="text.secondary">
            {visibleEmployees.length} von {employeeList.length} Mitarbeitern
          </Typography>
        </Stack>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel {...headProps('name')}>Name</TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel {...headProps('jobTitle')}>Tätigkeit</TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel {...headProps('employment')}>Beschäftigung</TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel {...headProps('hours')}>Wochenstunden</TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel {...headProps('vacation')}>Urlaub/Jahr</TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel {...headProps('holidayHours')}>Std./Urlaubstag</TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel {...headProps('status')}>Status</TableSortLabel>
              </TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && employeeList.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    Noch kein Mitarbeiter angelegt.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {!loading && employeeList.length > 0 && visibleEmployees.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    Kein Mitarbeiter passt zu den Filtern.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {visibleEmployees.map((emp) => {
              const minor = isMinor(emp.birthDate, new Date());
              const period = employmentPeriodText(emp);
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
                    {period && (
                      <Typography variant="caption" color="text.secondary">
                        {period}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{emp.jobTitle}</TableCell>
                  <TableCell>
                    <Chip size="small" label={employmentTypeLabel(emp.employmentType)} />
                  </TableCell>
                  <TableCell>{weeklyHoursText(emp)}</TableCell>
                  <TableCell>{emp.vacationEntitlementPerYear.toLocaleString('de-DE')}</TableCell>
                  <TableCell>{(emp.holidayVacationHours ?? 0).toLocaleString('de-DE')}</TableCell>
                  <TableCell>
                    <Chip size="small" label={emp.active ? 'Aktiv' : 'Inaktiv'} color={emp.active ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setDialog({ employee: emp })} aria-label={`${fullName(emp)} bearbeiten`}>
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

      {dialog && (
        <EmployeeDialog
          branchId={branch.id}
          employee={dialog.employee}
          onClose={() => setDialog(null)}
          onSaved={reload}
          onError={notify.report}
        />
      )}

      <ConfirmDialog
        open={!!statusTarget}
        title={statusTarget?.active ? 'Mitarbeiter deaktivieren?' : 'Mitarbeiter aktivieren?'}
        text={
          statusTarget?.active
            ? `${statusTarget ? fullName(statusTarget) : ''} wird als inaktiv markiert und nicht mehr in der Wochenplanung eingeplant. Bereits erfasste Wochenpläne und Abwesenheiten bleiben vollständig erhalten und werden dort weiterhin schreibgeschützt angezeigt; der Mitarbeiter kann jederzeit wieder aktiviert werden.`
            : `${statusTarget ? fullName(statusTarget) : ''} wird wieder als aktiv markiert.`
        }
        confirmText={statusTarget?.active ? 'Deaktivieren' : 'Aktivieren'}
        onConfirm={changeStatus}
        onCancel={() => setStatusTarget(null)}
      />
    </Box>
  );
}
