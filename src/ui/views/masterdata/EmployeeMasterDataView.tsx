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
import type { EmployeeId } from '@domain/shared/ids';
import { formatISODateGerman } from '@domain/shared/DateFormat';
import { isMinor } from '@domain/validation/arbzg/youthProtection';
import type { Absence } from '@domain/absence/Absence';
import { remainingVacationByEmployee, carriedOverVacationDays } from '@domain/absence/vacationCalculation';
import { createHolidayCheck } from '@infrastructure/holidays/germanHolidays';
import { services } from '@infrastructure/services';
import { useSelectedBranch } from '@ui/hooks/useBranch';
import { useEmployeeList } from '@ui/hooks/useEmployeeList';
import { useAbsences } from '@ui/hooks/useAbsences';
import { useTableSort } from '@ui/hooks/useTableSort';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { useActivationToggle } from '@ui/hooks/useActivationToggle';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { NoBranchSelectedAlert } from '@ui/components/NoBranchSelectedAlert';
import { stickyCornerSx, stickyFirstColumnSx, stickyHeaderRowSx } from '@ui/components/stickyFirstColumn';
import { ResponsiveDataList } from '@ui/components/ResponsiveList/ResponsiveDataList';
import { RowActionSheet } from '@ui/components/ResponsiveList/RowActionSheet';
import type { RowAction } from '@ui/components/ResponsiveList/RowAction';
import { useLongPress } from '@ui/components/ResponsiveList/useLongPress';
import { EmployeeDialog } from './EmployeeDialog';
import { notify } from '@ui/app/store/notificationStore';
import { usePageActions } from '@ui/app/PageActionsContext';

type SortKey = 'name' | 'jobTitle' | 'employment' | 'hours' | 'vacation' | 'remainingVacation' | 'holidayHours' | 'status';
type StatusFilter = 'all' | 'active' | 'inactive';
type EmploymentFilter = 'all' | EmploymentTypeKind;

const COLUMN_COUNT = 9;
// Tätigkeit and Std./Urlaubstag fold into the Name cell / drop out at tablet width - see the Name
// TableCell and the layout checks below. Resturlaub stays visible at both widths.
const COLUMN_COUNT_TABLET = 7;

/** German collation, like compareByLastName - a plain "a < b" would sort umlauts wrongly. */
function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'de');
}

/** Combines each employee's current-year remaining entitlement with any still-valid carry-over
 * from the prior year into one displayed number, plus a ready-to-render breakdown hint - `null`
 * for the common case of nobody carrying anything over, so the Resturlaub column's look for that
 * majority stays byte-for-byte what it was before this existed. */
function vacationDisplayByEmployee(
  employeeList: Employee[],
  remainingVacation: Map<EmployeeId, number>,
  absences: Absence[],
  currentYear: number,
  isHoliday: (isoDate: string) => boolean,
  referenceDate: Date,
): Map<EmployeeId, { totalDays: number; hint: string | null }> {
  const absencesByEmployee = new Map<EmployeeId, Absence[]>();
  for (const absence of absences) {
    const list = absencesByEmployee.get(absence.employeeId);
    if (list) {
      list.push(absence);
    } else {
      absencesByEmployee.set(absence.employeeId, [absence]);
    }
  }

  const priorYear = currentYear - 1;
  return new Map(
    employeeList.map((employee) => {
      const carriedOverDays = carriedOverVacationDays(
        employee,
        absencesByEmployee.get(employee.id) ?? [],
        priorYear,
        referenceDate,
        isHoliday,
      );
      const totalDays = (remainingVacation.get(employee.id) ?? 0) + carriedOverDays;
      const hint =
        carriedOverDays > 0
          ? `${totalDays.toLocaleString('de-DE')} Tage, davon ${carriedOverDays.toLocaleString('de-DE')} aus ${priorYear}, gültig bis 31.03.${currentYear}`
          : null;
      return [employee.id, { totalDays, hint }];
    }),
  );
}

/** Every comparator falls back to the name order, so equal values keep a stable, familiar order
 * instead of whatever the previous sort left behind. Everything except `remainingVacation` only
 * needs the Employee record itself, so it can stay a static, module-level object; that one needs
 * the same per-branch remainingVacation/vacationDisplay Maps the column itself renders from, so it
 * is built per-render instead - see STATIC_COMPARATORS's only caller. */
const STATIC_COMPARATORS: Record<Exclude<SortKey, 'remainingVacation'>, (a: Employee, b: Employee) => number> = {
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

/** Mobile card: the ButtonBase portion is the primary action (tap/keyboard = edit), long-press OR
 * the visible kebab icon opens the action sheet - matches the mockup's "row = one target" pattern,
 * replacing per-row icon buttons, while still giving the second action its own focusable, labelled
 * control. The kebab is a sibling of the ButtonBase, not nested inside it - a <button> inside
 * another <button> is invalid HTML (see BranchCard's identical comment). */
function EmployeeCard({
  employee,
  remainingVacationDays,
  vacationHint,
  onTap,
  onLongPress,
}: {
  employee: Employee;
  remainingVacationDays: number;
  vacationHint: string | null;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const handlers = useLongPress({ onTap, onLongPress });
  const minor = isMinor(employee.birthDate, new Date());
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0.5,
        width: '100%',
        minHeight: 76,
        pr: 0.5,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        opacity: employee.active ? 1 : 0.55,
      }}
    >
      <ButtonBase
        {...handlers}
        sx={{
          display: 'flex',
          flex: 1,
          minWidth: 0,
          alignItems: 'flex-start',
          gap: 1,
          minHeight: 76,
          p: '12px 4px 12px 14px',
          textAlign: 'left',
          borderRadius: 2,
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
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            {remainingVacationDays.toLocaleString('de-DE')} Resturlaub
          </Typography>
          {vacationHint && (
            <Typography variant="caption" color="text.secondary" display="block">
              {vacationHint}
            </Typography>
          )}
        </Box>
        <ChevronRightIcon sx={{ color: 'rgba(0,0,0,0.38)', flexShrink: 0, mt: 0.5 }} />
      </ButtonBase>
      <IconButton
        onClick={onLongPress}
        aria-label={`Weitere Aktionen für ${fullName(employee)}`}
        sx={{ flexShrink: 0, mt: 0.5 }}
      >
        <MoreVertIcon />
      </IconButton>
    </Box>
  );
}

export function EmployeeMasterDataView() {
  const layout = useBreakpoint();
  const { branch } = useSelectedBranch();
  const { employeeList, loading, reload } = useEmployeeList(branch?.id ?? null);
  // null = closed; { employee: null } = "Neuer Mitarbeiter"; { employee } = edit. The dialog is
  // mounted only while open so its form state starts fresh each time.
  const [dialog, setDialog] = useState<{ employee: Employee | null } | null>(null);
  const {
    target: statusTarget,
    request: requestStatusChange,
    cancel: cancelStatusChange,
    confirm: changeStatus,
    busy: statusChangeBusy,
  } = useActivationToggle(services.employee, reload, 'Mitarbeiter');
  const [sheetEmployee, setSheetEmployee] = useState<Employee | null>(null);
  const [search, setSearch] = useState('');
  // Both filters default to "Alle": opening the view must never hide records the user expects.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [employmentFilter, setEmploymentFilter] = useState<EmploymentFilter>('all');
  const sort = useTableSort<SortKey>('name');

  usePageActions({
    fab: { label: 'Neuer Mitarbeiter', icon: AddIcon, onClick: () => setDialog({ employee: null }) },
    fullBleedPage: true,
  });

  const { headProps, sortRows } = sort;

  const { absences } = useAbsences(employeeList.map((emp) => emp.id));
  // Guarded (not `branch!`) since this runs even on the render where branch is still null - the
  // early return below happens after every hook, matching every other hook call in this component.
  const isHoliday = useMemo(() => (branch ? createHolidayCheck(branch.federalState) : () => false), [branch]);
  const currentYear = new Date().getFullYear();
  const remainingVacation = useMemo(
    () => remainingVacationByEmployee(employeeList, absences, currentYear, isHoliday),
    [employeeList, absences, currentYear, isHoliday],
  );
  const vacationDisplay = useMemo(
    () => vacationDisplayByEmployee(employeeList, remainingVacation, absences, currentYear, isHoliday, new Date()),
    [employeeList, remainingVacation, absences, currentYear, isHoliday],
  );

  // remainingVacation needs the Maps just computed above, unlike every other column - see
  // STATIC_COMPARATORS's own comment.
  const comparators = useMemo<Record<SortKey, (a: Employee, b: Employee) => number>>(
    () => ({
      ...STATIC_COMPARATORS,
      remainingVacation: (a, b) =>
        (vacationDisplay.get(a.id)?.totalDays ?? remainingVacation.get(a.id) ?? 0) -
          (vacationDisplay.get(b.id)?.totalDays ?? remainingVacation.get(b.id) ?? 0) || compareByLastName(a, b),
    }),
    [vacationDisplay, remainingVacation],
  );

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
    return sortRows(filtered, comparators);
  }, [employeeList, search, statusFilter, employmentFilter, sortRows, comparators]);

  if (!branch) {
    return <NoBranchSelectedAlert />;
  }

  const columnCount = layout === 'laptop' ? COLUMN_COUNT : COLUMN_COUNT_TABLET;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        height: '100%',
        px: layout === 'mobile' ? 1.5 : 3,
        py: layout === 'mobile' ? 1.5 : 3,
      }}
    >
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
            <MenuItem value="Minijob">{employmentTypeLabel({ type: 'Minijob', minHours: 0, maxHours: 0 })}</MenuItem>
          </TextField>
          <Typography variant="body2" color="text.secondary">
            {visibleEmployees.length} von {employeeList.length} Mitarbeitern
          </Typography>
        </Stack>
      </Paper>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <ResponsiveDataList
          rows={visibleEmployees}
          getKey={(emp) => emp.id}
          emptyMessage={employeeList.length === 0 ? 'Noch kein Mitarbeiter angelegt.' : 'Kein Mitarbeiter passt zu den Filtern.'}
          renderCard={(emp) => (
            <EmployeeCard
              employee={emp}
              remainingVacationDays={vacationDisplay.get(emp.id)?.totalDays ?? remainingVacation.get(emp.id) ?? 0}
              vacationHint={vacationDisplay.get(emp.id)?.hint ?? null}
              onTap={() => setDialog({ employee: emp })}
              onLongPress={() => setSheetEmployee(emp)}
            />
          )}
        >
          <TableContainer component={Paper} sx={{ height: '100%' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={stickyCornerSx()}>
                    <TableSortLabel {...headProps('name')}>Name</TableSortLabel>
                  </TableCell>
                  {layout === 'laptop' && (
                    <TableCell sx={stickyHeaderRowSx()}>
                      <TableSortLabel {...headProps('jobTitle')}>Tätigkeit</TableSortLabel>
                    </TableCell>
                  )}
                  <TableCell sx={stickyHeaderRowSx()}>
                    <TableSortLabel {...headProps('employment')}>Beschäftigung</TableSortLabel>
                  </TableCell>
                  <TableCell sx={stickyHeaderRowSx()}>
                    <TableSortLabel {...headProps('hours')}>Wochenstunden</TableSortLabel>
                  </TableCell>
                  <TableCell sx={stickyHeaderRowSx()}>
                    <TableSortLabel {...headProps('vacation')}>Urlaub/Jahr</TableSortLabel>
                  </TableCell>
                  <TableCell sx={stickyHeaderRowSx()}>
                    <TableSortLabel {...headProps('remainingVacation')}>Resturlaub</TableSortLabel>
                  </TableCell>
                  {layout === 'laptop' && (
                    <TableCell sx={stickyHeaderRowSx()}>
                      <TableSortLabel {...headProps('holidayHours')}>Std./Urlaubstag</TableSortLabel>
                    </TableCell>
                  )}
                  <TableCell sx={stickyHeaderRowSx()}>
                    <TableSortLabel {...headProps('status')}>Status</TableSortLabel>
                  </TableCell>
                  <TableCell align="right" sx={stickyHeaderRowSx()}>
                    Aktionen
                  </TableCell>
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
                  const vacation = vacationDisplay.get(emp.id);
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
                      <TableCell>
                        {(vacation?.totalDays ?? remainingVacation.get(emp.id) ?? 0).toLocaleString('de-DE')}
                        {vacation?.hint && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {vacation.hint}
                          </Typography>
                        )}
                      </TableCell>
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
                              onClick={() => requestStatusChange(emp)}
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
      </Box>

      {dialog && (
        <EmployeeDialog
          branchId={branch.id}
          employee={dialog.employee}
          onClose={() => setDialog(null)}
          onSaved={reload}
          onError={notify.report}
          secondaryActions={
            dialog.employee
              ? getRowActions(dialog.employee, (e) => setDialog({ employee: e }), (e) => requestStatusChange(e)).filter(
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
            : `${statusTarget ? fullName(statusTarget) : ''} wird wieder als aktiv markiert und kann wieder in der Wochenplanung eingeplant werden.`
        }
        confirmText={statusTarget?.active ? 'Deaktivieren' : 'Aktivieren'}
        dangerous={!!statusTarget?.active}
        busy={statusChangeBusy}
        onConfirm={changeStatus}
        onCancel={cancelStatusChange}
      />

      <RowActionSheet
        open={!!sheetEmployee}
        onClose={() => setSheetEmployee(null)}
        title={sheetEmployee ? fullName(sheetEmployee) : ''}
        subtitle={sheetEmployee ? `${sheetEmployee.jobTitle} · ${employmentTypeLabel(sheetEmployee.employmentType)}` : undefined}
        actions={sheetEmployee ? getRowActions(sheetEmployee, (e) => setDialog({ employee: e }), (e) => requestStatusChange(e)) : []}
      />
    </Box>
  );
}
