import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { createHolidayCheck } from '@infrastructure/holidays/germanHolidays';
import { services } from '@infrastructure/services';
import { PanZoomContainer } from '@ui/components/PanZoomContainer';
import { FullPartTimeForm } from './FullPartTimeForm';
import { MinijobForm } from './MinijobForm';
import './printView.css';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

const EMPLOYEES_PER_SHEET = 9;

function splitIntoGroups<T>(list: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    groups.push(list.slice(i, i + size));
  }
  return groups;
}

export function PrintPreviewView() {
  const { t } = useTranslation('print');
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState<WeeklySchedule | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Must clear loading too: an early return here used to leave the view stuck on its
      // loading branch forever.
      if (!scheduleId) {
        setLoading(false);
        return;
      }
      const loadedSchedule = await services.schedule.find(scheduleId as WeeklyScheduleId);
      if (!loadedSchedule) {
        setLoading(false);
        return;
      }
      const [loadedBranch, loadedEmployees] = await Promise.all([
        services.branch.find(loadedSchedule.branchId),
        services.employee.forBranch(loadedSchedule.branchId),
      ]);
      const loadedAbsences = await services.absence.forEmployees(loadedEmployees.map((e) => e.id));

      setSchedule(loadedSchedule);
      setBranch(loadedBranch);
      setEmployeeList(loadedEmployees);
      setAbsences(loadedAbsences);
    })()
      .catch(() => {
        // Leaves schedule null, which renders the "nicht gefunden" alert below.
      })
      .finally(() => setLoading(false));
  }, [scheduleId]);

  if (loading) {
    // A blank white page was the old behaviour, and this route has no nav chrome to soften it.
    return (
      <Stack alignItems="center" spacing={2} sx={{ py: 8 }}>
        <CircularProgress />
        <Typography role="status" variant="body2" color="text.secondary">
          {t('loadingSchedule')}
        </Typography>
      </Stack>
    );
  }

  if (!schedule || !branch) {
    return <Alert severity="error">{t('notFoundAlert')}</Alert>;
  }

  const { fullPartTimeRows, minijobRows, dayTotals } = preparePrintData(
    schedule,
    employeeList,
    absences,
    createHolidayCheck(branch.federalState),
  );
  const fullPartTimeSheets = splitIntoGroups(fullPartTimeRows, EMPLOYEES_PER_SHEET);
  const minijobSheets = splitIntoGroups(minijobRows, EMPLOYEES_PER_SHEET);

  return (
    // Freigegeben: Die Druckansicht ist ein Dokument. Wer Zahlen daraus in eine Mail uebernimmt,
    // soll sie markieren koennen statt sie abzuschreiben.
    //
    // A bounded flex column (not plain document flow): PanZoomContainer below needs a concrete
    // height to pan/zoom within on screen. @media print reverts to plain block flow at auto height
    // so every sheet prints in full instead of being clipped to one viewport's worth of height -
    // same "screen-only, print completely unaffected" split PanZoomContainer's own sx uses.
    <Box
      data-selectable
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        '@media print': { display: 'block', height: 'auto' },
      }}
    >
      <Stack direction="row" gap={2} className="print-action-bar" sx={{ p: 2, flexShrink: 0 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          {t('backButton')}
        </Button>
        <Button variant="contained" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>
          {t('printButton')}
        </Button>
      </Stack>

      <PanZoomContainer>
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
      </PanZoomContainer>
    </Box>
  );
}
