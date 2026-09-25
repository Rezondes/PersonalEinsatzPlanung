import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatMonthParam, parseMonthParam } from '@ui/app/weekSearchParam';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Menu from '@mui/material/Menu';
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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { ResponsiveDialog } from '@ui/components/ResponsiveDialog';
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
import { LoadErrorAlert } from '@ui/components/LoadErrorAlert';
import {
  stickyCornerSx,
  stickyFirstColumnSx,
  stickyHeaderRowSx,
  STICKY_FIRST_COLUMN_CLASS,
  stickyFirstColumnRowHoverSx,
} from '@ui/components/stickyFirstColumn';
import { useLocale } from '@ui/app/locale/useLocale';
import { buildLocalizedPath } from '@ui/app/locale/locale';

export function MonthOverviewView() {
  const { t } = useTranslation('month');
  const { t: tCommon } = useTranslation();
  const { t: tNav } = useTranslation('nav');
  const { branch } = useSelectedBranch();
  const { employeeList } = useEmployeeList(branch?.id ?? null);
  const { absences } = useAbsences(employeeList.map((emp) => emp.id));
  const layout = useBreakpoint();
  usePageActions({ fullBleedPage: true });
  const now = new Date();
  // The month lives in the URL (?monat=2027-03) so a link or F5 keeps it; without a valid value it
  // is today's month. Written with replace, so Back does not step through months. Year and month
  // always go out together: setSearchParams does not queue like setState, so two separate calls
  // (the old setYear + setMonth pair in changeMonth) would drop the first.
  const [searchParams, setSearchParams] = useSearchParams();
  const monthFromUrl = parseMonthParam(searchParams.get('monat'));
  const year = monthFromUrl?.year ?? now.getFullYear();
  const month = monthFromUrl?.month ?? now.getMonth() + 1;
  const setYearAndMonth = (nextYear: number, nextMonth: number) =>
    setSearchParams(
      (params) => {
        params.set('monat', formatMonthParam(nextYear, nextMonth));
        return params;
      },
      { replace: true },
    );
  const setYear = (nextYear: number) => setYearAndMonth(nextYear, month);
  const setMonth = (nextMonth: number) => setYearAndMonth(year, nextMonth);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const navigate = useNavigate();
  const locale = useLocale();
  const setSelectedWeek = useCalendarWeekStore((s) => s.setSelectedWeek);
  // Shared controller (see useTapTooltip's own doc comment) - hover from tablet width up, tap
  // everywhere, only one warning open at a time; matches ScheduleTable's identical pattern.
  const { toggle: toggleWarning, tooltipProps: warningTooltipProps, close: closeWarning } = useTapTooltip();
  // One shared Menu (see ScheduleToolbar.tsx's identical templateMenu pattern) rather than one per
  // week column - only ever one open at a time, closing the previous when a different week's
  // actions button is clicked.
  const [weekMenu, setWeekMenu] = useState<{ cw: CalendarWeek; anchor: HTMLElement } | null>(null);
  // Set by exportCsv, cleared by confirmCsvExport/onClose - holds the already-built CSV so the
  // preview dialog shows exactly the bytes confirmCsvExport will hand to downloadTextFile.
  const [csvPreview, setCsvPreview] = useState<{ filename: string; csv: string } | null>(null);

  // useAsyncData (not a bare useState+useEffect) for the same reason every other selection-scoped
  // load in this app uses it: error reporting, a loading flag, and a guard against a slow response
  // for a since-abandoned branch overwriting a faster one for the branch since switched to.
  const {
    data: schedules,
    loading: schedulesLoading,
    error: schedulesError,
    reload: reloadSchedules,
  } = useAsyncData<WeeklySchedule[]>(
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
    setYearAndMonth(next.year, next.month);
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
      setCsvPreview({ filename, csv });
    } catch (e) {
      notify.report(e, t('exportError'));
    }
  };

  const confirmCsvExport = () => {
    if (!csvPreview) return;
    try {
      downloadTextFile(csvPreview.filename, csvPreview.csv, 'text/csv;charset=utf-8');
      setCsvPreview(null);
    } catch (e) {
      notify.report(e, t('exportError'));
    }
  };

  const jumpToWeek = (cw: CalendarWeek) => {
    setSelectedWeek(cw);
    navigate(buildLocalizedPath(locale, '/schedule'));
  };

  const weekActionsMenu = (
    <Menu open={!!weekMenu} anchorEl={weekMenu?.anchor ?? null} onClose={() => setWeekMenu(null)}>
      {weekMenu && (
        <MenuItem
          onClick={() => {
            jumpToWeek(weekMenu.cw);
            setWeekMenu(null);
          }}
        >
          {t('jumpToWeekAriaLabel', { week: weekMenu.cw.week })}
        </MenuItem>
      )}
    </Menu>
  );

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
      <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 1 }}>
        <Typography variant="h5" component="h1" fontWeight={500}>
          {tNav('month')}
        </Typography>
        {/* The ArbZG scope note is jargon for most readers, so it is shown on demand only.
            enterTouchDelay 0: a tap opens it on a phone, where there is no hover. */}
        <Tooltip title={t('infoCaption')} enterTouchDelay={0} leaveTouchDelay={6000}>
          <IconButton size="small" aria-label={t('infoHintAriaLabel')}>
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Stack direction="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" gap={1} sx={{ mb: 2 }}>
        {/* One month navigation: arrows plus the label, which opens the Monat/Jahr picker - the
            same pattern as the Wochenplanung's week label. */}
        <Stack direction="row" alignItems="center" gap={1}>
          <IconButton onClick={() => changeMonth(-1)} aria-label={t('previousMonth')}>
            <ChevronLeftIcon />
          </IconButton>
          <Button
            onClick={() => setMonthPickerOpen(true)}
            aria-label={t('monthPickerAriaLabel', { month: `${MONTH_NAMES[month - 1]} ${year}` })}
            sx={{
              minWidth: 160,
              color: 'text.primary',
              fontWeight: 400,
              fontSize: '1rem',
              textTransform: 'none',
              textDecoration: 'underline',
              textDecorationStyle: 'dotted',
            }}
          >
            {MONTH_NAMES[month - 1]} {year}
          </Button>
          <IconButton onClick={() => changeMonth(1)} aria-label={t('nextMonth')}>
            <ChevronRightIcon />
          </IconButton>
        </Stack>

        <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={exportCsv}>
          {t('exportButton')}
        </Button>
      </Stack>

      <ResponsiveDialog
        open={monthPickerOpen}
        onClose={() => setMonthPickerOpen(false)}
        title={t('monthPickerTitle')}
        maxWidth="xs"
        actions={
          <Button variant="contained" onClick={() => setMonthPickerOpen(false)}>
            {t('monthPickerDone')}
          </Button>
        }
      >
        {/* Applies right away, like the selects did when they sat in the header. */}
        <Stack direction="row" gap={2} sx={{ pt: 1 }}>
          <TextField
            select
            label={t('monthLabel')}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            fullWidth
          >
            {MONTH_NAMES.map((name, i) => (
              <MenuItem key={name} value={i + 1}>
                {name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={tCommon('yearLabel')}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            sx={{ minWidth: 110 }}
          >
            {yearOptions.map((y) => (
              <MenuItem key={y} value={y}>
                {y}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </ResponsiveDialog>

      {schedulesLoading ? (
        <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ flex: 1, minHeight: 0 }}>
          <CircularProgress />
          <Typography role="status" variant="body2" color="text.secondary">
            {t('loading')}
          </Typography>
        </Stack>
      ) : schedulesError ? (
        // A failed load left every employee at 0 hours, which looked like real totals.
        <LoadErrorAlert onRetry={reloadSchedules} />
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
              {allWeeks.map((cw) => (
                <TableCell key={`${cw.year}-${cw.week}`} align="center" sx={stickyHeaderRowSx()}>
                  {/* The actions button lives on this inner element, not the <th> itself (N23) -
                      matches ScheduleTable.tsx's own correct pattern. A real IconButton needs no
                      manual tabIndex/keyboard handling, unlike the role="button" Box it replaces. */}
                  <Stack direction="row" spacing={0} alignItems="center" justifyContent="center" sx={{ whiteSpace: 'nowrap' }}>
                    {t('weekPrefix', { week: cw.week })}
                    <IconButton
                      size="small"
                      aria-label={t('weekActionsAriaLabel', { week: cw.week })}
                      onClick={(e) => setWeekMenu({ cw, anchor: e.currentTarget })}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </TableCell>
              ))}
              <TableCell align="right" sx={stickyHeaderRowSx()}>
                {t('columnTotal')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleEmployees.length === 0 && (
              <TableRow>
                <TableCell colSpan={3 + allWeeks.length}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    {t('emptyNoEmployees')}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {visibleEmployees.map((employee) => {
              const row = rows.find((r) => r.employeeId === employee.id);
              const totalNetMinutes = row?.totalNetMinutes ?? 0;
              // totalNetMinutes is worked + credited (see application/CLAUDE.md) - deliberately not
              // worked-only, since paid absences (Urlaub/Krankheit) count towards a Minijob's real
              // earnings limit too, just like actually worked hours do.
              const monthlyLimit = employee.employmentType.type === 'Minijob' ? employee.employmentType.maxMonthlyHours : undefined;
              const overMonthlyLimit = monthlyLimit != null && totalNetMinutes > monthlyLimit * 60;
              return (
                <TableRow
                  key={employee.id}
                  hover
                  sx={{
                    ...stickyFirstColumnRowHoverSx,
                    bgcolor: employee.active ? undefined : 'inactiveSurface',
                    color: employee.active ? undefined : 'text.secondary',
                  }}
                >
                  <TableCell className={STICKY_FIRST_COLUMN_CLASS} sx={stickyFirstColumnSx}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {/* Phone: one line with an ellipsis instead of 2-3 wrapped lines per row. */}
                      <Box
                        component="span"
                        title={fullName(employee)}
                        sx={
                          layout === 'mobile'
                            ? { display: 'block', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                            : undefined
                        }
                      >
                        {fullName(employee)}
                      </Box>
                      {!employee.active && <Chip size="small" label={tCommon('inactive')} />}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    {formatHoursRangeGerman(
                      targetWeeklyHoursRange(employee.employmentType).min * 60,
                      targetWeeklyHoursRange(employee.employmentType).max * 60,
                    )}
                  </TableCell>
                  {allWeeks.map((cw) => {
                    const weekValue = row?.weeks.find(
                      (w) => w.calendarWeek.year === cw.year && w.calendarWeek.week === cw.week,
                    );
                    const cellKey = `${employee.id}|${cw.year}-${cw.week}`;
                    const weekResults = weekValidation.get(cellKey) ?? [];
                    const hasError = weekResults.some((r) => r.severity === 'error');
                    const hasWarning = weekResults.some((r) => r.severity === 'warning');
                    return (
                      <TableCell key={`${cw.year}-${cw.week}`} align="center">
                      {/* Purely informational now - a week is only ever opened via the header's
                          actions menu (Package 5). position:relative stays so the absolutely
                          positioned warning icon below still anchors correctly. */}
                      <Box sx={{ position: 'relative' }}>
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
                              <IconButton
                                aria-label={hasError ? t('showErrorAriaLabel') : t('showWarningAriaLabel')}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleWarning(cellKey);
                                }}
                                sx={{
                                  position: 'absolute',
                                  top: 2,
                                  right: 2,
                                  color: hasError ? 'error.main' : 'warning.main',
                                }}
                              >
                                {/* Distinct icons, not just colours (WCAG 1.4.1). */}
                                {hasError ? <ErrorOutlineIcon sx={{ fontSize: 16 }} /> : <WarningAmberIcon sx={{ fontSize: 16 }} />}
                              </IconButton>
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
                            <IconButton aria-label={t('monthlyLimitAriaLabel')} onClick={() => toggleWarning(employee.id)}>
                              <WarningAmberIcon fontSize="small" sx={{ color: 'warning.main' }} />
                            </IconButton>
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
        {weekActionsMenu}
      </TableContainer>
      )}

      <Dialog open={!!csvPreview} onClose={() => setCsvPreview(null)} maxWidth="md" fullWidth>
        <DialogTitle>{t('exportPreviewTitle')}</DialogTitle>
        <DialogContent>
          {/* The exact bytes confirmCsvExport will download - a raw preformatted dump rather than a
              re-parsed table, so the preview can never visually diverge from the actual file. */}
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              bgcolor: 'action.hover',
              borderRadius: 1,
              overflow: 'auto',
              maxHeight: '60vh',
              fontFamily: 'monospace',
              fontSize: 13,
            }}
          >
            {csvPreview?.csv}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCsvPreview(null)}>{tCommon('cancel')}</Button>
          <Button variant="contained" onClick={confirmCsvExport}>
            {t('downloadButton')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
