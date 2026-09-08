import { useEffect, useState } from 'react';
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
import Alert from '@mui/material/Alert';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import { fullName } from '@domain/employee/Employee';
import { targetWeeklyHours } from '@domain/employee/EmploymentType';
import { createMonthOverview } from '@application/schedule/scheduleAssessment';
import { minutesToDecimalHours } from '@domain/schedule/scheduleCalculation';
import { services } from '@infrastructure/services';
import { useSelectedBranch } from '@ui/hooks/useBranch';
import { useEmployeeList } from '@ui/hooks/useEmployeeList';
import { useAbsences } from '@ui/hooks/useAbsences';
import { useCalendarWeekStore } from '@ui/app/store/calendarWeekStore';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export function MonthOverviewView() {
  const { branch } = useSelectedBranch();
  const { employeeList } = useEmployeeList(branch?.id ?? null);
  const { absences } = useAbsences(employeeList.map((emp) => emp.id));
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

  const rows = createMonthOverview(schedules, year, month, absences);
  const allWeeks = rows[0]?.weeks.map((w) => w.calendarWeek) ?? [];

  const jumpToWeek = (cw: CalendarWeek) => {
    setSelectedWeek(cw);
    navigate('/schedule');
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={500}>
          Monatsübersicht · {branch.name}
        </Typography>
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

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Mitarbeiter</TableCell>
              <TableCell align="right">Soll/Woche</TableCell>
              {allWeeks.map((cw) => (
                <TableCell
                  key={`${cw.year}-${cw.week}`}
                  align="center"
                  sx={{ cursor: 'pointer', '&:focus-visible': { outline: '2px solid #2f5d50', outlineOffset: -2 } }}
                  onClick={() => jumpToWeek(cw)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      jumpToWeek(cw);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Zu Kalenderwoche ${cw.week} springen`}
                >
                  KW {cw.week}
                </TableCell>
              ))}
              <TableCell align="right">Gesamt Monat</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employeeList.map((employee) => {
              const row = rows.find((r) => r.employeeId === employee.id);
              return (
                <TableRow key={employee.id} hover>
                  <TableCell>{fullName(employee)}</TableCell>
                  <TableCell align="right">{targetWeeklyHours(employee.employmentType).toLocaleString('de-DE')}</TableCell>
                  {allWeeks.map((cw) => {
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
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`${fullName(employee)}, KW ${cw.week} bearbeiten`}
                      >
                        {weekValue ? minutesToDecimalHours(weekValue.netMinutes).toLocaleString('de-DE') : '–'}
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
