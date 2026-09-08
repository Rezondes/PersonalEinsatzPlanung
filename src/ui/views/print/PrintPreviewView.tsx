import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import type { WeeklyScheduleId } from '@domain/shared/ids';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { Branch } from '@domain/branch/Branch';
import type { Employee } from '@domain/employee/Employee';
import type { Absence } from '@domain/absence/Absence';
import { preparePrintData } from '@application/export/printDataPreparation';
import { services } from '@infrastructure/services';
import { FullPartTimeForm } from './FullPartTimeForm';
import { MinijobForm } from './MinijobForm';
import './printView.css';

const EMPLOYEES_PER_SHEET = 9;

function splitIntoGroups<T>(list: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    groups.push(list.slice(i, i + size));
  }
  return groups;
}

export function PrintPreviewView() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState<WeeklySchedule | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!scheduleId) return;
      const loadedSchedule = await services.schedule.find(scheduleId as WeeklyScheduleId);
      if (!loadedSchedule) {
        setLoading(false);
        return;
      }
      const [loadedBranch, loadedEmployees] = await Promise.all([
        services.branch.find(loadedSchedule.branchId),
        services.employee.forBranch(loadedSchedule.branchId),
      ]);
      const loadedAbsences = await services.absence.forBranch(loadedEmployees.map((e) => e.id));

      setSchedule(loadedSchedule);
      setBranch(loadedBranch);
      setEmployeeList(loadedEmployees);
      setAbsences(loadedAbsences);
      setLoading(false);
    })();
  }, [scheduleId]);

  if (loading) {
    return null;
  }

  if (!schedule || !branch) {
    return <Alert severity="error">Wochenplan konnte nicht gefunden werden.</Alert>;
  }

  const { fullPartTimeRows, minijobRows, dayTotals } = preparePrintData(schedule, employeeList, absences);
  const fullPartTimeSheets = splitIntoGroups(fullPartTimeRows, EMPLOYEES_PER_SHEET);
  const minijobSheets = splitIntoGroups(minijobRows, EMPLOYEES_PER_SHEET);

  return (
    <Box>
      <Stack direction="row" gap={2} className="print-action-bar" sx={{ p: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Zurück
        </Button>
        <Button variant="contained" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>
          Drucken
        </Button>
      </Stack>

      {fullPartTimeSheets.map((sheet, index) => (
        <FullPartTimeForm
          key={`vt-${index}`}
          branch={branch}
          calendarWeek={schedule.calendarWeek}
          plannedWeeklyRevenue={schedule.plannedWeeklyRevenue}
          plannedWeeklyHours={schedule.plannedWeeklyHours}
          rows={sheet}
          dayTotals={dayTotals}
        />
      ))}

      {minijobSheets.map((sheet, index) => (
        <MinijobForm
          key={`mj-${index}`}
          branch={branch}
          calendarWeek={schedule.calendarWeek}
          rows={sheet}
          dayTotals={dayTotals}
        />
      ))}
    </Box>
  );
}
