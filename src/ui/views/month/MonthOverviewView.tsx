import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import CircularProgress from '@mui/material/CircularProgress';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import { MONTH_NAMES, stepMonth } from '@domain/shared/CalendarWeek';
import type { ValidationResult } from '@domain/validation/ValidationResult';
import { fullName } from '@domain/employee/Employee';
import { targetWeeklyHoursRange } from '@domain/employee/EmploymentType';
import { createMonthOverview } from '@application/schedule/scheduleAssessment';
import { createMonthValidation } from '@application/schedule/scheduleValidation';
import { buildMonthCsv } from '@application/export/monthCsvExport';
import { formatHoursGerman, formatHoursRangeGerman } from '@domain/schedule/scheduleCalculation';
import { services } from '@infrastructure/services';
import { createHolidayCheck } from '@infrastructure/holidays/germanHolidays';
import { downloadTextFile } from '@infrastructure/export/fileAccess';
import { notify } from '@ui/app/store/notificationStore';
import { useSelectedBranch } from '@ui/hooks/useBranch';
import { useEmployeeList } from '@ui/hooks/useEmployeeList';
import { useAbsences } from '@ui/hooks/useAbsences';
import { useAsyncData } from '@ui/hooks/useAsyncData';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { useTapTooltip } from '@ui/hooks/useTapTooltip';
import { useCalendarWeekStore } from '@ui/app/store/calendarWeekStore';
import { usePageActions } from '@ui/app/PageActionsContext';
import { NoBranchSelectedAlert } from '@ui/components/NoBranchSelectedAlert';
import { stickyCornerSx, stickyFirstColumnSx, stickyHeaderRowSx } from '@ui/components/stickyFirstColumn';
import { useLocale } from '@ui/app/locale/useLocale';
import { buildLocalizedPath } from '@ui/app/locale/locale';

/** Moves focus to the previous/next week cell within the SAME row (header or data), so arrow keys
 * still reach every column once only the first cell of each row is a Tab stop (see the tabIndex
 * comment below) - a week cell is the only thing in a row carrying role="button", found via the
 * same closest()-based DOM lookup ScheduleView's context-menu handler already uses for a similar
 * "find the relevant cell" problem. */
function focusAdjacentWeekCell(e: KeyboardEvent<HTMLElement>, direction: 1 | -1) {
  const row = e.currentTarget.closest('tr');
  const weekCells = Array.from(row?.querySelectorAll<HTMLElement>('[role="button"]') ?? []);
  const index = weekCells.indexOf(e.currentTarget);
  weekCells[index + direction]?.focus();
}

export function MonthOverviewView() {
  const { t } = useTranslation('month');
  const { t: tCommon } = useTranslation();
  const { branch } = useSelectedBranch();
  const { employeeList } = useEmployeeList(branch?.id ?? null);
  const { absences } = useAbsences(employeeList.map((emp) => emp.id));
  const layout = useBreakpoint();
  usePageActions({ fullBleedPage: true });
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const navigate = useNavigate();
  const locale = useLocale();
  const setSelectedWeek = useCalendarWeekStore((s) => s.setSelectedWeek);
  // Shared controller (see useTapTooltip's own doc comment) - hover from tablet width up, tap
  // everywhere, only one warning open at a time; matches ScheduleTable's identical pattern.
  const { toggle: toggleWarning, tooltipProps: warningTooltipProps, close: closeWarning } = useTapTooltip();

  // useAsyncData (not a bare useState+useEffect) for the same reason every other selection-scoped
  // load in this app uses it: error reporting, a loading flag, and a guard against a slow response
  // for a since-abandoned branch overwriting a faster one for the branch since switched to.
  const { data: schedules, loading: schedulesLoading } = useAsyncData<WeeklySchedule[]>(
    [],
    () => (branch ? services.schedule.forBranch(branch.id) : Promise.resolve([])),
    [branch],
  );

  // Guarded (not `branch!`) since these run even on the render where branch is still null - the
  // early return below happens after every hook, matching EmployeeMasterDataView's identical
  // isHoliday-before-the-branch-check pattern.
  const isHoliday = useMemo(() => (branch ? createHolidayCheck(branch.federalState) : () => false), [branch]);
  const rows = useMemo(
    () => createMonthOverview(schedules, year, month, absences, { employees: employeeList, isHoliday }),
    [schedules, year, month, absences, employeeList, isHoliday],
  );
  // A departed employee stays visible only while this month still has hours attributed to them -
  // otherwise removing them from the branch would make an already-shown month silently lose rows,
  // and once those hours are gone (a new month with nothing left to show) they'd linger forever as
  // a permanent, pointless all-dashes row. Matches ScheduleView's own documented visibility rule
  // (scheduleRows.ts) for the same "still shown while it still carries something" reasoning - an
  // ACTIVE employee is never filtered here, regardless of hours, same as scheduleRows' `editable`.
  const visibleEmployees = useMemo(
    () =>
      employeeList.filter((employee) => {
        if (employee.active) return true;
        const row = rows.find((r) => r.employeeId === employee.id);
        return (row?.totalNetMinutes ?? 0) > 0;
      }),
    [employeeList, rows],
  );
  // Per (employee, week) ArbZG/JArbSchG hints - day/week rules only, no cross-week rest-period
  // check (too expensive to run for every week of a month at once, see the info footnote below).
  const weekValidation = useMemo(
    () =>
      branch
        ? createMonthValidation(schedules, year, month, absences, branch, employeeList, isHoliday)
        : new Map<string, ValidationResult[]>(),
    [schedules, year, month, absences, branch, employeeList, isHoliday],
  );

  if (!branch) {
    return <NoBranchSelectedAlert />;
  }

  const changeMonth = (direction: -1 | 1) => {
    const next = stepMonth(year, month, direction);
    setYear(next.year);
    setMonth(next.month);
  };

  // Jahr-Bereich: aktuelles Jahr ±5 - reicht für Vor-/Rückplanung ohne eine Freitext-Eingabe zu
  // brauchen (kein @mui/x-date-pickers im Projekt, siehe Plan).
  const yearOptions = Array.from({ length: 11 }, (_, i) => now.getFullYear() - 5 + i);

  const allWeeks = rows[0]?.weeks.map((w) => w.calendarWeek) ?? [];

  /** Same columns as the screen (buildMonthCsv iterates visibleEmployees, not rows, for the same
   * "no active employee silently disappears" reason the table itself does - and, since N26, the
   * same "an empty departed employee doesn't linger forever" rule too) - see
   * application/export/monthCsvExport.ts. */
  const exportCsv = () => {
    try {
      const filename = `monatsuebersicht-${year}-${String(month).padStart(2, '0')}.csv`;
      const csv = buildMonthCsv(rows, visibleEmployees, allWeeks);
      downloadTextFile(filename, csv, 'text/csv;charset=utf-8');
    } catch (e) {
      notify.report(e, t('exportError'));
    }
  };

  const jumpToWeek = (cw: CalendarWeek) => {
    setSelectedWeek(cw);
    navigate(buildLocalizedPath(locale, '/schedule'));
  };

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
      <Stack direction="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" gap={1} sx={{ mb: 1 }}>
        <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1}>
          <Stack direction="row" alignItems="center" gap={1}>
            <IconButton onClick={() => changeMonth(-1)} aria-label={t('previousMonth')}>
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="body1" sx={{ minWidth: 160, textAlign: 'center' }}>
              {MONTH_NAMES[month - 1]} {year}
            </Typography>
            <IconButton onClick={() => changeMonth(1)} aria-label={t('nextMonth')}>
              <ChevronRightIcon />
            </IconButton>
          </Stack>

          <Stack direction="row" gap={1}>
            <TextField
              select
              size="small"
              label={t('monthLabel')}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              sx={{ minWidth: 140 }}
            >
              {MONTH_NAMES.map((name, i) => (
                <MenuItem key={name} value={i + 1}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label={tCommon('yearLabel')}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              sx={{ minWidth: 100 }}
            >
              {yearOptions.map((y) => (
                <MenuItem key={y} value={y}>
                  {y}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Stack>

        <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={exportCsv}>
          {t('exportButton')}
        </Button>
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        {t('infoCaption')}
      </Typography>

      {schedulesLoading ? (
        <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ flex: 1, minHeight: 0 }}>
          <CircularProgress />
          <Typography role="status" variant="body2" color="text.secondary">
            {t('loading')}
          </Typography>
        </Stack>
      ) : (
      /* Bounded height, self-scrolling (both axes) - see stickyFirstColumn.ts for why a sticky
          header row and horizontal scroll on a real <table> can't coexist any other way. height:
          '100%', not a vh cap: the root Box above gives this a flex:1 region bounded by the header
          Stack, at every breakpoint, and this needs to fill exactly that. */
      <TableContainer component={Paper} sx={{ flex: 1, minHeight: 0, height: '100%' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={stickyCornerSx()}>{t('columnEmployee')}</TableCell>
              <TableCell align="right" sx={stickyHeaderRowSx()}>
                {t('columnTargetWeekly')}
              </TableCell>
              {allWeeks.map((cw, weekIndex) => (
                <TableCell key={`${cw.year}-${cw.week}`} align="center" sx={stickyHeaderRowSx()}>
                  {/* Interactive role/aria-label live on this inner Box, not the <th> itself
                      (N23) - matches ScheduleTable.tsx's own correct pattern. */}
                  <Box
                    onClick={() => jumpToWeek(cw)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        jumpToWeek(cw);
                      } else if (e.key === 'ArrowRight') {
                        focusAdjacentWeekCell(e, 1);
                      } else if (e.key === 'ArrowLeft') {
                        focusAdjacentWeekCell(e, -1);
                      }
                    }}
                    role="button"
                    // Only the first week cell of a row is a Tab stop - with one row per employee
                    // this used to add a tab stop per week per employee (75+ on a full month), a
                    // keyboard trap rather than a shortcut. ArrowLeft/ArrowRight above still reach
                    // every other week cell in the same row.
                    tabIndex={weekIndex === 0 ? 0 : -1}
                    aria-label={t('jumpToWeekAriaLabel', { week: cw.week })}
                    sx={(theme) => ({ cursor: 'pointer', display: 'inline-block', '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 } })}
                  >
                    {t('weekPrefix', { week: cw.week })}
                  </Box>
                </TableCell>
              ))}
              <TableCell align="right" sx={stickyHeaderRowSx()}>
                {t('columnTotal')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleEmployees.map((employee) => {
              const row = rows.find((r) => r.employeeId === employee.id);
              const totalNetMinutes = row?.totalNetMinutes ?? 0;
              // totalNetMinutes is worked + credited (see application/CLAUDE.md) - deliberately not
              // worked-only, since paid absences (Urlaub/Krankheit) count towards a Minijob's real
              // earnings limit too, just like actually worked hours do.
              const monthlyLimit = employee.employmentType.type === 'Minijob' ? employee.employmentType.maxMonthlyHours : undefined;
              const overMonthlyLimit = monthlyLimit != null && totalNetMinutes > monthlyLimit * 60;
              return (
                <TableRow key={employee.id} hover sx={{ opacity: employee.active ? 1 : 0.55 }}>
                  <TableCell sx={stickyFirstColumnSx}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {fullName(employee)}
                      {!employee.active && <Chip size="small" label={tCommon('inactive')} />}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    {formatHoursRangeGerman(
                      targetWeeklyHoursRange(employee.employmentType).min * 60,
                      targetWeeklyHoursRange(employee.employmentType).max * 60,
                    )}
                  </TableCell>
                  {allWeeks.map((cw, weekIndex) => {
                    const weekValue = row?.weeks.find(
                      (w) => w.calendarWeek.year === cw.year && w.calendarWeek.week === cw.week,
                    );
                    const cellKey = `${employee.id}|${cw.year}-${cw.week}`;
                    const weekResults = weekValidation.get(cellKey) ?? [];
                    const hasError = weekResults.some((r) => r.severity === 'error');
                    const hasWarning = weekResults.some((r) => r.severity === 'warning');
                    const hoursText = weekValue ? t('hoursValue', { hours: formatHoursGerman(weekValue.totalNetMinutes) }) : t('noEntries');
                    return (
                      <TableCell key={`${cw.year}-${cw.week}`} align="center">
                      {/* Interactive role/aria-label live on this inner Box, not the <td> itself
                          (N23) - matches ScheduleTable.tsx's own correct pattern. position:relative
                          moves here too, so the absolutely-positioned warning icon below (now a
                          descendant, not a TableCell-level sibling) still anchors correctly. */}
                      <Box
                        onClick={() => jumpToWeek(cw)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            jumpToWeek(cw);
                          } else if (e.key === 'ArrowRight') {
                            focusAdjacentWeekCell(e, 1);
                          } else if (e.key === 'ArrowLeft') {
                            focusAdjacentWeekCell(e, -1);
                          }
                        }}
                        role="button"
                        // See the matching comment on the header cell above - only the first week
                        // cell of each row is a Tab stop, ArrowLeft/ArrowRight reach the rest.
                        tabIndex={weekIndex === 0 ? 0 : -1}
                        aria-label={t('weekCellAriaLabel', { name: fullName(employee), week: cw.week, hoursText })}
                        sx={(theme) => ({
                          position: 'relative',
                          cursor: 'pointer',
                          '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
                        })}
                      >
                        {(hasError || hasWarning) && (
                          <ClickAwayListener onClickAway={() => closeWarning(cellKey)}>
                            <Tooltip
                              title={
                                <Stack spacing={0.5}>
                                  {weekResults.map((r, i) => (
                                    <span key={i}>{r.message}</span>
                                  ))}
                                </Stack>
                              }
                              arrow
                              {...warningTooltipProps(cellKey)}
                            >
                              <Box
                                component="button"
                                type="button"
                                aria-label={t('showHintAriaLabel')}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleWarning(cellKey);
                                }}
                                sx={(theme) => ({
                                  position: 'absolute',
                                  top: 2,
                                  right: 2,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 20,
                                  height: 20,
                                  p: 0,
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  color: hasError ? theme.palette.error.main : theme.palette.warning.main,
                                })}
                              >
                                <WarningAmberIcon sx={{ fontSize: 16 }} />
                              </Box>
                            </Tooltip>
                          </ClickAwayListener>
                        )}
                        {weekValue ? formatHoursGerman(weekValue.totalNetMinutes) : '–'}
                      </Box>
                      </TableCell>
                    );
                  })}
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                      <Typography fontWeight={500}>{formatHoursGerman(totalNetMinutes)}</Typography>
                      {overMonthlyLimit && (
                        <ClickAwayListener onClickAway={() => closeWarning(employee.id)}>
                          <Tooltip
                            title={t('monthlyLimitTooltip', {
                              hours: formatHoursGerman(totalNetMinutes),
                              limit: monthlyLimit!.toLocaleString('de-DE'),
                            })}
                            arrow
                            {...warningTooltipProps(employee.id)}
                          >
                            <Box
                              component="button"
                              type="button"
                              aria-label={t('monthlyLimitAriaLabel')}
                              onClick={() => toggleWarning(employee.id)}
                              sx={{ display: 'flex', alignItems: 'center', p: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                            >
                              <WarningAmberIcon fontSize="small" sx={{ color: '#c8973a' }} />
                            </Box>
                          </Tooltip>
                        </ClickAwayListener>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      )}
    </Box>
  );
}
