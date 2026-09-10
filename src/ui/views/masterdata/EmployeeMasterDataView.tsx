import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
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
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { Employee } from '@domain/employee/Employee';
import { compareByLastName, fullName } from '@domain/employee/Employee';
import { employmentTypeLabel, targetWeeklyHoursRange } from '@domain/employee/EmploymentType';
import type { EmploymentTypeKind } from '@domain/employee/EmploymentType';
import { formatISODateGerman } from '@domain/shared/DateFormat';
import { isMinor } from '@domain/validation/arbzg/youthProtection';
import { services } from '@infrastructure/services';
import { useSelectedBranch } from '@ui/hooks/useBranch';
import { useEmployeeList } from '@ui/hooks/useEmployeeList';
import { useTableSort } from '@ui/hooks/useTableSort';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { stickyFirstColumnSx } from '@ui/components/stickyFirstColumn';
import { ResponsiveDataList } from '@ui/components/ResponsiveList/ResponsiveDataList';
import { RowActionSheet } from '@ui/components/ResponsiveList/RowActionSheet';
import type { RowAction } from '@ui/components/ResponsiveList/RowAction';
import { useLongPress } from '@ui/components/ResponsiveList/useLongPress';
import { EmployeeDialog } from './EmployeeDialog';
import { notify } from '@ui/app/store/notificationStore';
import { usePageActions } from '@ui/app/PageActionsContext';

type SortKey = 'name' | 'jobTitle' | 'employment' | 'hours' | 'vacation' | 'holidayHours' | 'status';
type StatusFilter = 'all' | 'active' | 'inactive';
type EmploymentFilter = 'all' | EmploymentTypeKind;

const COLUMN_COUNT = 8;
// Tätigkeit and Std./Urlaubstag fold into the Name cell / drop out at tablet width - see the Name
// TableCell and the layout checks below.
const COLUMN_COUNT_TABLET = 6;

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

function getRowActions(
  employee: Employee,
  onEdit: (e: Employee) => void,
  onToggle: (e: Employee) => void,
): RowAction[] {
  return [
    { key: 'edit', label: 'Bearbeiten', icon: EditOutlinedIcon, onSelect: () => onEdit(employee) },
    {
      key: 'toggle',
      label: employee.active ? 'Deaktivieren' : 'Aktivieren',
      hint: employee.active ? 'Bleibt in erfassten Wochen sichtbar' : undefined,
      icon: employee.active ? ToggleOnOutlinedIcon : ToggleOffOutlinedIcon,
      dangerous: employee.active,
      onSelect: () => onToggle(employee),
    },
  ];
}

/** Mobile card: the whole card is the primary action (tap = edit), long-press opens the action
 * sheet - matches the mockup's "row = one target" pattern, replacing per-row icon buttons. */
function EmployeeCard({
  employee,
  onTap,
  onLongPress,
}: {
  employee: Employee;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const handlers = useLongPress({ onTap, onLongPress });
  const minor = isMinor(employee.birthDate, new Date());
  return (
    <ButtonBase
      {...handlers}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        width: '100%',
        minHeight: 76,
        p: '12px 12px 12px 14px',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        textAlign: 'left',
        opacity: employee.active ? 1 : 0.55,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" fontWeight={500} noWrap>
            {fullName(employee)}
          </Typography>
          {minor && (
            <ChildCareOutlinedIcon
              fontSize="small"
              sx={{ color: 'text.secondary', flexShrink: 0 }}
              titleAccess="Minderjährig — Jugendarbeitsschutz beachten"
            />
          )}
          <Chip
            size="small"
            label={employee.active ? 'Aktiv' : 'Inaktiv'}
            color={employee.active ? 'success' : 'default'}
            sx={{ ml: 'auto', flexShrink: 0 }}
          />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {employee.jobTitle} · {employmentTypeLabel(employee.employmentType)}
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {weeklyHoursText(employee)} Std./Wo.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {employee.vacationEntitlementPerYear.toLocaleString('de-DE')} Urlaubstage
          </Typography>
        </Stack>
      </Box>
      <ChevronRightIcon sx={{ color: 'rgba(0,0,0,0.38)', flexShrink: 0, mt: 0.5 }} />
    </ButtonBase>
  );
}

export function EmployeeMasterDataView() {
  const layout = useBreakpoint();
  const { branch } = useSelectedBranch();
  const { employeeList, loading, reload } = useEmployeeList(branch?.id ?? null);
  // null = closed; { employee: null } = "Neuer Mitarbeiter"; { employee } = edit. The dialog is
  // mounted only while open so its form state starts fresh each time.
  const [dialog, setDialog] = useState<{ employee: Employee | null } | null>(null);
  const [statusTarget, setStatusTarget] = useState<Employee | null>(null);
  const [sheetEmployee, setSheetEmployee] = useState<Employee | null>(null);
  const [search, setSearch] = useState('');
  // Both filters default to "Alle": opening the view must never hide records the user expects.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [employmentFilter, setEmploymentFilter] = useState<EmploymentFilter>('all');
  const sort = useTableSort<SortKey>('name');

  usePageActions({ fab: { label: 'Neuer Mitarbeiter', icon: AddIcon, onClick: () => setDialog({ employee: null }) } });

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

  const columnCount = layout === 'laptop' ? COLUMN_COUNT : COLUMN_COUNT_TABLET;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        {/* Hidden on mobile: MobileFab (registered above via usePageActions) is the primary
            action there, matching the mockup's mobile Mitarbeiter screen (FAB only, no inline
            button in the header). */}
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setDialog({ employee: null })}
          sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
        >
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

      <ResponsiveDataList
        rows={visibleEmployees}
        getKey={(emp) => emp.id}
        emptyMessage={employeeList.length === 0 ? 'Noch kein Mitarbeiter angelegt.' : 'Kein Mitarbeiter passt zu den Filtern.'}
        renderCard={(emp) => (
          <EmployeeCard employee={emp} onTap={() => setDialog({ employee: emp })} onLongPress={() => setSheetEmployee(emp)} />
        )}
      >
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={stickyFirstColumnSx}>
                  <TableSortLabel {...headProps('name')}>Name</TableSortLabel>
                </TableCell>
                {layout === 'laptop' && (
                  <TableCell>
                    <TableSortLabel {...headProps('jobTitle')}>Tätigkeit</TableSortLabel>
                  </TableCell>
                )}
                <TableCell>
                  <TableSortLabel {...headProps('employment')}>Beschäftigung</TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel {...headProps('hours')}>Wochenstunden</TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel {...headProps('vacation')}>Urlaub/Jahr</TableSortLabel>
                </TableCell>
                {layout === 'laptop' && (
                  <TableCell>
                    <TableSortLabel {...headProps('holidayHours')}>Std./Urlaubstag</TableSortLabel>
                  </TableCell>
                )}
                <TableCell>
                  <TableSortLabel {...headProps('status')}>Status</TableSortLabel>
                </TableCell>
                <TableCell align="right">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && employeeList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columnCount}>
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                      Noch kein Mitarbeiter angelegt.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {!loading && employeeList.length > 0 && visibleEmployees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columnCount}>
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                      Kein Mitarbeiter passt zu den Filtern.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {visibleEmployees.map((emp) => {
                const minor = isMinor(emp.birthDate, new Date());
                const period = employmentPeriodText(emp);
                // Tablet: the row itself opens the edit dialog (matching the mockup's "row
                // clickable, one overflow button" pattern); laptop keeps its inline icon buttons
                // and no row click, exactly as today.
                const rowClickable = layout !== 'laptop';
                return (
                  <TableRow
                    key={emp.id}
                    hover
                    onClick={rowClickable ? () => setDialog({ employee: emp }) : undefined}
                    sx={{ opacity: emp.active ? 1 : 0.55, cursor: rowClickable ? 'pointer' : undefined }}
                  >
                    <TableCell sx={stickyFirstColumnSx}>
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
                      {layout === 'laptop' ? (
                        period && (
                          <Typography variant="caption" color="text.secondary">
                            {period}
                          </Typography>
                        )
                      ) : (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {emp.jobTitle}
                        </Typography>
                      )}
                    </TableCell>
                    {layout === 'laptop' && <TableCell>{emp.jobTitle}</TableCell>}
                    <TableCell>
                      <Chip size="small" label={employmentTypeLabel(emp.employmentType)} />
                    </TableCell>
                    <TableCell>{weeklyHoursText(emp)}</TableCell>
                    <TableCell>{emp.vacationEntitlementPerYear.toLocaleString('de-DE')}</TableCell>
                    {layout === 'laptop' && <TableCell>{(emp.holidayVacationHours ?? 0).toLocaleString('de-DE')}</TableCell>}
                    <TableCell>
                      <Chip size="small" label={emp.active ? 'Aktiv' : 'Inaktiv'} color={emp.active ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell align="right">
                      {layout === 'laptop' ? (
                        <>
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
                        </>
                      ) : (
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            setSheetEmployee(emp);
                          }}
                          aria-label={`Weitere Aktionen für ${fullName(emp)}`}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </ResponsiveDataList>

      {dialog && (
        <EmployeeDialog
          branchId={branch.id}
          employee={dialog.employee}
          onClose={() => setDialog(null)}
          onSaved={reload}
          onError={notify.report}
          secondaryActions={
            dialog.employee
              ? getRowActions(dialog.employee, (e) => setDialog({ employee: e }), (e) => setStatusTarget(e)).filter(
                  (a) => a.key !== 'edit',
                )
              : undefined
          }
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

      <RowActionSheet
        open={!!sheetEmployee}
        onClose={() => setSheetEmployee(null)}
        title={sheetEmployee ? fullName(sheetEmployee) : ''}
        subtitle={sheetEmployee ? `${sheetEmployee.jobTitle} · ${employmentTypeLabel(sheetEmployee.employmentType)}` : undefined}
        actions={sheetEmployee ? getRowActions(sheetEmployee, (e) => setDialog({ employee: e }), (e) => setStatusTarget(e)) : []}
      />
    </Box>
  );
}
