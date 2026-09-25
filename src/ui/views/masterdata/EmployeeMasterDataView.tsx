import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import Collapse from '@mui/material/Collapse';
import FilterListIcon from '@mui/icons-material/FilterList';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined';
import ChildCareOutlinedIcon from '@mui/icons-material/ChildCareOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { TFunction } from 'i18next';
import type { Employee } from '@domain/employee/Employee';
import { compareByLastName, fullName } from '@domain/employee/Employee';
import { employmentTypeLabel, targetWeeklyHoursRange } from '@domain/employee/EmploymentType';
import type { EmploymentTypeKind } from '@domain/employee/EmploymentType';
import type { EmployeeId } from '@domain/shared/ids';
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
import {
  stickyCornerSx,
  stickyFirstColumnSx,
  stickyHeaderRowSx,
  STICKY_FIRST_COLUMN_CLASS,
  stickyFirstColumnRowHoverSx,
} from '@ui/components/stickyFirstColumn';
import { ResponsiveDataList } from '@ui/components/ResponsiveList/ResponsiveDataList';
import { RowActionSheet } from '@ui/components/ResponsiveList/RowActionSheet';
import type { RowAction } from '@ui/components/ResponsiveList/RowAction';
import { useLongPress } from '@ui/components/ResponsiveList/useLongPress';
import { EmployeeDialog } from './EmployeeDialog';
import { notify } from '@ui/app/store/notificationStore';
import { usePageActions } from '@ui/app/PageActionsContext';

type SortKey = 'name' | 'employment' | 'hours' | 'vacation' | 'remainingVacation' | 'status';
type StatusFilter = 'all' | 'active' | 'inactive';
type EmploymentFilter = 'all' | EmploymentTypeKind;

const COLUMN_COUNT = 7;

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
  employment: (a, b) =>
    compareText(employmentTypeLabel(a.employmentType), employmentTypeLabel(b.employmentType)) ||
    compareByLastName(a, b),
  hours: (a, b) =>
    targetWeeklyHoursRange(a.employmentType).max - targetWeeklyHoursRange(b.employmentType).max ||
    compareByLastName(a, b),
  vacation: (a, b) => a.vacationEntitlementPerYear - b.vacationEntitlementPerYear || compareByLastName(a, b),
  status: (a, b) => Number(a.active) - Number(b.active) || compareByLastName(a, b),
};

function weeklyHoursText(employee: Employee): string {
  const range = targetWeeklyHoursRange(employee.employmentType);
  return range.min === range.max
    ? range.max.toLocaleString('de-DE')
    : `${range.min.toLocaleString('de-DE')}-${range.max.toLocaleString('de-DE')}`;
}

function getRowActions(
  employee: Employee,
  onEdit: (e: Employee) => void,
  onToggle: (e: Employee) => void,
  t: TFunction<'masterdata'>,
  tCommon: TFunction,
): RowAction[] {
  return [
    { key: 'edit', label: tCommon('edit'), icon: EditOutlinedIcon, onSelect: () => onEdit(employee) },
    {
      key: 'toggle',
      label: employee.active ? tCommon('deactivate') : tCommon('activate'),
      hint: employee.active ? t('employee.deactivateHint') : undefined,
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
  const { t } = useTranslation('masterdata');
  const { t: tCommon } = useTranslation();
  const handlers = useLongPress({ onTap, onLongPress });
  const minor = isMinor(employee.birthDate, new Date());
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1, // 8px between card and kebab: the minimum gap between two touch targets
        width: '100%',
        minHeight: 76,
        pr: 0.5,
        bgcolor: employee.active ? 'background.paper' : 'inactiveSurface',
        color: employee.active ? undefined : 'text.secondary',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
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
                titleAccess={t('employee.minorTitle')}
              />
            )}
            <Chip
              size="small"
              label={employee.active ? tCommon('active') : tCommon('inactive')}
              color={employee.active ? 'success' : 'default'}
              sx={{ ml: 'auto', flexShrink: 0 }}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {employee.jobTitle} · {employmentTypeLabel(employee.employmentType)}
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {weeklyHoursText(employee)} {t('employee.weeklyHoursSuffix')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {employee.vacationEntitlementPerYear.toLocaleString('de-DE')} {t('employee.vacationDaysSuffix')}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            {remainingVacationDays.toLocaleString('de-DE')} {t('employee.columnRemainingVacation')}
          </Typography>
          {vacationHint && (
            <Typography variant="caption" color="text.secondary" display="block">
              {vacationHint}
            </Typography>
          )}
        </Box>
      </ButtonBase>
      <IconButton
        onClick={onLongPress}
        aria-label={tCommon('otherActionsFor', { name: fullName(employee) })}
        sx={{ flexShrink: 0, mt: 0.5 }}
      >
        <MoreVertIcon />
      </IconButton>
    </Box>
  );
}

export function EmployeeMasterDataView() {
  const { t } = useTranslation('masterdata');
  const { t: tCommon } = useTranslation();
  const { t: tNav } = useTranslation('nav');
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
  } = useActivationToggle(services.employee, reload, t('employee.entityLabel'));
  const [sheetEmployee, setSheetEmployee] = useState<Employee | null>(null);
  const [search, setSearch] = useState('');
  // Both filters default to "Alle": opening the view must never hide records the user expects.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [employmentFilter, setEmploymentFilter] = useState<EmploymentFilter>('all');
  // Phone only: the two selects fold behind a "Filter" button (see the filter Paper below).
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = Number(statusFilter !== 'all') + Number(employmentFilter !== 'all');
  const sort = useTableSort<SortKey>('name');

  usePageActions({
    fab: { label: t('employee.newButton'), icon: AddIcon, onClick: () => setDialog({ employee: null }) },
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
      <Typography variant="h5" component="h1" fontWeight={500} sx={{ mb: 1 }}>
        {tNav('employees')}
      </Typography>
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
          {t('employee.newButton')}
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        {(() => {
          const isMobile = layout === 'mobile';
          const selects = (
            <>
              <TextField
                select
                size="small"
                label={t('employee.statusLabel')}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                fullWidth={isMobile}
                sx={isMobile ? undefined : { width: 160 }}
              >
                <MenuItem value="all">{t('employee.filterAll')}</MenuItem>
                <MenuItem value="active">{tCommon('active')}</MenuItem>
                <MenuItem value="inactive">{tCommon('inactive')}</MenuItem>
              </TextField>
              <TextField
                select
                size="small"
                label={t('employee.employmentLabel')}
                value={employmentFilter}
                onChange={(e) => setEmploymentFilter(e.target.value as EmploymentFilter)}
                fullWidth={isMobile}
                sx={isMobile ? undefined : { width: 220 }}
              >
                <MenuItem value="all">{t('employee.filterAll')}</MenuItem>
                <MenuItem value="FullTime">{t('employee.fullTimeOption')}</MenuItem>
                <MenuItem value="PartTime">{t('employee.partTimeOption')}</MenuItem>
                <MenuItem value="Minijob">{employmentTypeLabel({ type: 'Minijob', minHours: 0, maxHours: 0 })}</MenuItem>
              </TextField>
            </>
          );
          const count = (
            <Typography variant="body2" color="text.secondary">
              {t('employee.countSummary', {
                visible: visibleEmployees.length.toLocaleString('de-DE'),
                total: employeeList.length.toLocaleString('de-DE'),
              })}
            </Typography>
          );
          return (
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
              <TextField
                size="small"
                placeholder={t('employee.searchPlaceholder')}
                // A top-level aria-label prop lands on TextField's outer wrapper, not the native input
                // getByLabelText/screen readers need - inputProps forwards down to that inner element
                // (same fix as AppHeader.tsx's Filiale Select, see its comment there).
                inputProps={{ 'aria-label': t('employee.searchAriaLabel') }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                fullWidth={isMobile}
                sx={isMobile ? undefined : { width: 260 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlinedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              {isMobile ? (
                // Phone: the selects took ~220px of height for good; they fold behind a button whose
                // label counts the active ones, so a hidden filter is never a silent one.
                <>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                    <Button
                      size="small"
                      startIcon={<FilterListIcon />}
                      aria-expanded={filtersOpen}
                      onClick={() => setFiltersOpen((open) => !open)}
                    >
                      {activeFilterCount > 0
                        ? tCommon('filtersButtonWithCount', { count: activeFilterCount })
                        : tCommon('filtersButton')}
                    </Button>
                    {count}
                  </Stack>
                  <Collapse in={filtersOpen} unmountOnExit sx={{ width: '100%' }}>
                    <Stack spacing={2}>{selects}</Stack>
                  </Collapse>
                </>
              ) : (
                <>
                  {selects}
                  {count}
                </>
              )}
            </Stack>
          );
        })()}
      </Paper>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <ResponsiveDataList
          rows={visibleEmployees}
          getKey={(emp) => emp.id}
          emptyMessage={employeeList.length === 0 ? t('employee.emptyNone') : t('employee.emptyNoMatch')}
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
                    <TableSortLabel {...headProps('name')}>{t('employee.columnName')}</TableSortLabel>
                  </TableCell>
                  <TableCell sx={stickyHeaderRowSx()}>
                    <TableSortLabel {...headProps('employment')}>{t('employee.columnEmployment')}</TableSortLabel>
                  </TableCell>
                  <TableCell sx={stickyHeaderRowSx()}>
                    <TableSortLabel {...headProps('hours')}>{t('employee.columnHours')}</TableSortLabel>
                  </TableCell>
                  <TableCell sx={stickyHeaderRowSx()}>
                    <TableSortLabel {...headProps('vacation')}>{t('employee.columnVacation')}</TableSortLabel>
                  </TableCell>
                  <TableCell sx={stickyHeaderRowSx()}>
                    <TableSortLabel {...headProps('remainingVacation')}>{t('employee.columnRemainingVacation')}</TableSortLabel>
                  </TableCell>
                  <TableCell sx={stickyHeaderRowSx()}>
                    <TableSortLabel {...headProps('status')}>{t('employee.statusLabel')}</TableSortLabel>
                  </TableCell>
                  <TableCell align="right" sx={stickyHeaderRowSx()}>
                    {tCommon('columnActions')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!loading && employeeList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={COLUMN_COUNT}>
                      <Typography color="text.secondary" sx={{ py: 2 }}>
                        {t('employee.emptyNone')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && employeeList.length > 0 && visibleEmployees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={COLUMN_COUNT}>
                      <Typography color="text.secondary" sx={{ py: 2 }}>
                        {t('employee.emptyNoMatch')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {visibleEmployees.map((emp) => {
                  const minor = isMinor(emp.birthDate, new Date());
                  const vacation = vacationDisplay.get(emp.id);
                  return (
                    <TableRow
                      key={emp.id}
                      hover
                      onClick={() => setDialog({ employee: emp })}
                      sx={{
                        ...stickyFirstColumnRowHoverSx,
                        cursor: 'pointer',
                        bgcolor: emp.active ? undefined : 'inactiveSurface',
                        color: emp.active ? undefined : 'text.secondary',
                      }}
                    >
                      <TableCell className={STICKY_FIRST_COLUMN_CLASS} sx={stickyFirstColumnSx}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {fullName(emp)}
                          {minor && (
                            <ChildCareOutlinedIcon
                              fontSize="small"
                              sx={{ color: 'text.secondary' }}
                              titleAccess={t('employee.minorTitle')}
                            />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {emp.jobTitle}
                        </Typography>
                      </TableCell>
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
                      <TableCell>
                        <Chip size="small" label={emp.active ? tCommon('active') : tCommon('inactive')} color={emp.active ? 'success' : 'default'} />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            setSheetEmployee(emp);
                          }}
                          aria-label={tCommon('otherActionsFor', { name: fullName(emp) })}
                        >
                          <MoreVertIcon />
                        </IconButton>
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
              ? getRowActions(dialog.employee, (e) => setDialog({ employee: e }), (e) => requestStatusChange(e), t, tCommon).filter(
                  (a) => a.key !== 'edit',
                )
              : undefined
          }
        />
      )}

      <ConfirmDialog
        open={!!statusTarget}
        title={statusTarget?.active ? t('employee.deactivateTitle') : t('employee.activateTitle')}
        text={t(statusTarget?.active ? 'employee.deactivateText' : 'employee.activateText', {
          name: statusTarget ? fullName(statusTarget) : '',
        })}
        confirmText={statusTarget?.active ? tCommon('deactivate') : tCommon('activate')}
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
        actions={sheetEmployee ? getRowActions(sheetEmployee, (e) => setDialog({ employee: e }), (e) => requestStatusChange(e), t, tCommon) : []}
      />
    </Box>
  );
}
