import { useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import { fullName } from '@domain/employee/Employee';
import { targetWeeklyHoursRange } from '@domain/employee/EmploymentType';
import { createMonthOverview } from '@application/schedule/scheduleAssessment';
import { formatHoursRangeGerman, minutesToDecimalHours } from '@domain/schedule/scheduleCalculation';
import { services } from '@infrastructure/services';
import { createHolidayCheck } from '@infrastructure/holidays/germanHolidays';
import { useSelectedBranch } from '@ui/hooks/useBranch';
import { useEmployeeList } from '@ui/hooks/useEmployeeList';
import { useAbsences } from '@ui/hooks/useAbsences';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { useCalendarWeekStore } from '@ui/app/store/calendarWeekStore';
import { usePageActions } from '@ui/app/PageActionsContext';
import { stickyCornerSx, stickyFirstColumnSx, stickyHeaderRowSx } from '@ui/components/stickyFirstColumn';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

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
  const { branch } = useSelectedBranch();
  const { employeeList } = useEmployeeList(branch?.id ?? null);
  const { absences } = useAbsences(employeeList.map((emp) => emp.id));
  const layout = useBreakpoint();
  usePageActions({ fullBleedPage: true });
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [schedules, setSchedules] = useState<WeeklySchedule[]>([]);
  const navigate = useNavigate();
  const setSelectedWeek = useCalendarWeekStore((s) => s.setSelectedWeek);

  useEffect(() => {
    if (!branch) return;
    services.schedule.forBranch(branch.id).then(setSchedules);
  }, [branch]);

  if (!branch) {
    return <Alert severity="info">Bitte zuerst oben eine Filiale auswählen oder anlegen.</Alert>;
  }

  const changeMonth = (direction: -1 | 1) => {
    let newMonth = month + direction;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    setMonth(newMonth);
    setYear(newYear);
  };

  const rows = createMonthOverview(schedules, year, month, absences, {
    employees: employeeList,
    isHoliday: createHolidayCheck(branch.federalState),
  });
  const allWeeks = rows[0]?.weeks.map((w) => w.calendarWeek) ?? [];

  const jumpToWeek = (cw: CalendarWeek) => {
    setSelectedWeek(cw);
    navigate('/schedule');
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
      <Stack direction="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" gap={1} sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <IconButton onClick={() => changeMonth(-1)} aria-label="Vorheriger Monat">
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="body1" sx={{ minWidth: 160, textAlign: 'center' }}>
            {MONTH_NAMES[month - 1]} {year}
          </Typography>
          <IconButton onClick={() => changeMonth(1)} aria-label="Nächster Monat">
            <ChevronRightIcon />
          </IconButton>
        </Stack>
      </Stack>

      {/* Bounded height, self-scrolling (both axes) - see stickyFirstColumn.ts for why a sticky
          header row and horizontal scroll on a real <table> can't coexist any other way. height:
          '100%', not a vh cap: the root Box above gives this a flex:1 region bounded by the header
          Stack, at every breakpoint, and this needs to fill exactly that. */}
      <TableContainer component={Paper} sx={{ flex: 1, minHeight: 0, height: '100%' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={stickyCornerSx()}>Mitarbeiter</TableCell>
              <TableCell align="right" sx={stickyHeaderRowSx()}>
                Soll/Woche
              </TableCell>
              {allWeeks.map((cw, weekIndex) => (
                <TableCell
                  key={`${cw.year}-${cw.week}`}
                  align="center"
                  sx={{ ...stickyHeaderRowSx(), cursor: 'pointer', '&:focus-visible': { outline: '2px solid #2f5d50', outlineOffset: -2 } }}
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
                  aria-label={`Zu Kalenderwoche ${cw.week} springen`}
                >
                  KW {cw.week}
                </TableCell>
              ))}
              <TableCell align="right" sx={stickyHeaderRowSx()}>
                Gesamt Monat
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employeeList.map((employee) => {
              const row = rows.find((r) => r.employeeId === employee.id);
              return (
                <TableRow key={employee.id} hover sx={{ opacity: employee.active ? 1 : 0.55 }}>
                  <TableCell sx={stickyFirstColumnSx}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {fullName(employee)}
                      {!employee.active && <Chip size="small" label="Inaktiv" />}
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
                    return (
                      <TableCell
                        key={`${cw.year}-${cw.week}`}
                        align="center"
                        sx={{ cursor: 'pointer', '&:focus-visible': { outline: '2px solid #2f5d50', outlineOffset: -2 } }}
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
                        aria-label={`${fullName(employee)}, KW ${cw.week} bearbeiten`}
                      >
                        {weekValue ? minutesToDecimalHours(weekValue.totalNetMinutes).toLocaleString('de-DE') : '–'}
                      </TableCell>
                    );
                  })}
                  <TableCell align="right">
                    <Typography fontWeight={500}>
                      {row ? minutesToDecimalHours(row.totalNetMinutes).toLocaleString('de-DE') : '0'}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
