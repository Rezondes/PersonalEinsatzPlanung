import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { WEEKDAYS } from '@domain/shared/CalendarWeek';
import type { EmployeeId } from '@domain/shared/ids';
import type { Employee } from '@domain/employee/Employee';
import { fullName } from '@domain/employee/Employee';
import { minutesToDecimalHours, shiftBreakMinutes } from '@domain/schedule/scheduleCalculation';
import type { ValidationResult } from '@domain/validation/ValidationResult';
import type { EmployeeWeekView, DayView } from '@application/schedule/scheduleAssessment';
import { effectiveTargetMinutes } from '@application/schedule/scheduleAssessment';

interface ScheduleTableProps {
  weekView: EmployeeWeekView[];
  employeeList: Employee[];
  validationResults: ValidationResult[];
  onCellClick: (employeeId: EmployeeId, dayView: DayView) => void;
}

function absenceText(type: 'Vacation' | 'Illness' | 'Other'): string {
  switch (type) {
    case 'Vacation':
      return 'Urlaub';
    case 'Illness':
      return 'Krank';
    case 'Other':
      return 'Sonstige';
  }
}

export function ScheduleTable({
  weekView,
  employeeList,
  validationResults,
  onCellClick,
}: ScheduleTableProps) {
  const resultsFor = (employeeId: EmployeeId, date: string) =>
    validationResults.filter((e) => e.employeeId === employeeId && e.date === date);

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ minWidth: 180 }}>Mitarbeiter</TableCell>
            {WEEKDAYS.map((day) => (
              <TableCell key={day} align="center" sx={{ minWidth: 120 }}>
                {day}
              </TableCell>
            ))}
            <TableCell align="center">Soll</TableCell>
            <TableCell align="center">Gesamt</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {weekView.map((assignment) => {
            const employee = employeeList.find((e) => e.id === assignment.employeeId);
            if (!employee) return null;

            const targetMinutes = effectiveTargetMinutes(employee, assignment);
            const differenceMinutes = assignment.totalNetMinutes - targetMinutes;

            return (
              <TableRow key={assignment.employeeId} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {fullName(employee)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {employee.jobTitle}
                  </Typography>
                </TableCell>

                {assignment.days.map((dayView: DayView) => {
                  const matches = resultsFor(assignment.employeeId, dayView.date);
                  const hasError = matches.some((e) => e.severity === 'error');
                  const hasWarning = matches.some((e) => e.severity === 'warning');
                  // A halbtags-Urlaub day still carries a real entered shift for its worked half
                  // (netMinutes > 0, see scheduleAssessment.effectiveNetMinutes) - only a
                  // full-day Absence hides the shift entirely.
                  const isFullDayAbsent = !!dayView.absence && dayView.netMinutes === 0;
                  const background = dayView.absence
                    ? '#eef3f1'
                    : hasError
                      ? '#fbeaea'
                      : hasWarning
                        ? '#fdf3e0'
                        : '#f7f7f5';
                  const breakMinutes =
                    dayView.entry.type === 'Shift'
                      ? dayView.entry.shifts.reduce((sum, s) => sum + shiftBreakMinutes(s), 0)
                      : 0;

                  const cell = (
                    <Box
                      data-employeeid={assignment.employeeId}
                      data-day={dayView.day}
                      onClick={() => onCellClick(assignment.employeeId, dayView)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onCellClick(assignment.employeeId, dayView);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${dayView.day} bearbeiten`}
                      sx={{
                        cursor: 'pointer',
                        borderRadius: 1.5,
                        p: 1,
                        backgroundColor: background,
                        border: hasError ? '1px solid #e5a3a0' : hasWarning ? '1px solid #e6c988' : '1px solid transparent',
                        minHeight: 48,
                        '&:focus-visible': { outline: '2px solid #2f5d50', outlineOffset: 2 },
                      }}
                    >
                      {isFullDayAbsent && dayView.absence ? (
                        <Typography variant="body2" color="#2f5d50" fontWeight={500}>
                          {absenceText(dayView.absence.type)}
                        </Typography>
                      ) : dayView.entry.type === 'Shift' && dayView.entry.shifts.length > 0 ? (
                        <>
                          {dayView.absence && (
                            <Typography variant="caption" display="block" color="#2f5d50" fontWeight={500}>
                              {absenceText(dayView.absence.type)} (halbtags)
                            </Typography>
                          )}
                          {dayView.entry.shifts.map((s) => (
                            <Typography key={s.id} variant="body2" fontWeight={500}>
                              {s.start}-{s.end}
                            </Typography>
                          ))}
                          <Typography variant="caption" color="text.secondary">
                            {minutesToDecimalHours(dayView.netMinutes).toLocaleString('de-DE')} Std.
                            {breakMinutes > 0 &&
                              ` · ${minutesToDecimalHours(breakMinutes).toLocaleString('de-DE')} Std. Pause`}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          frei
                        </Typography>
                      )}
                    </Box>
                  );

                  return (
                    <TableCell key={dayView.day} align="center" sx={{ p: 0.5 }}>
                      {matches.length > 0 ? (
                        <Tooltip
                          title={
                            <Stack spacing={0.5}>
                              {matches.map((e, i) => (
                                <span key={i}>{e.message}</span>
                              ))}
                            </Stack>
                          }
                          arrow
                        >
                          {cell}
                        </Tooltip>
                      ) : (
                        cell
                      )}
                    </TableCell>
                  );
                })}

                <TableCell align="center">
                  <Typography variant="body2" color="text.secondary">
                    {minutesToDecimalHours(targetMinutes).toLocaleString('de-DE')}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                    <Typography variant="body2" fontWeight={500}>
                      {minutesToDecimalHours(assignment.totalNetMinutes).toLocaleString('de-DE')}
                    </Typography>
                    {differenceMinutes !== 0 && (
                      <Tooltip
                        title={`${differenceMinutes > 0 ? '+' : ''}${minutesToDecimalHours(differenceMinutes).toLocaleString('de-DE')} Std. ${differenceMinutes > 0 ? 'über' : 'unter'} Soll (${minutesToDecimalHours(targetMinutes).toLocaleString('de-DE')} Std.)`}
                        arrow
                      >
                        <WarningAmberIcon fontSize="small" sx={{ color: '#c8973a' }} />
                      </Tooltip>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
