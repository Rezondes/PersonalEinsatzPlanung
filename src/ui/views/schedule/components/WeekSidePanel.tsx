import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import type { Employee } from '@domain/employee/Employee';
import type { ValidationResult } from '@domain/validation/ValidationResult';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import { ScheduleHeaderFields } from './ScheduleHeaderFields';
import { ValidationNotices } from './ValidationNotices';

/** The panel's DOM id, so WeekSidePanelToggle can point aria-controls at it. */
export const WEEK_SIDE_PANEL_ID = 'week-side-panel';

interface WeekSidePanelProps {
  /** "Ist / Soll" tile value, already formatted German-style by the caller. */
  istSollText: string;
  /** "Nicht eingeplant" tile value (a dash while absences are still loading). */
  notYetScheduledText: string;
  validationResults: ValidationResult[];
  /** Same text as the view's validation live region, e.g. "2 Fehler, 1 Warnung". */
  validationSummaryText: string;
  employeeList: Employee[];
  schedule: WeeklySchedule | null;
  /** Set while another week loads; disables the save-on-blur Wochenangaben. */
  disabled?: boolean;
  onScheduleSaved: (updated: WeeklySchedule) => void;
  onError: (e: unknown, context?: string) => void;
  onCarryOver: () => void;
  onCopyPreviousWeek: () => void;
  onPrint: () => void;
  printAvailable: boolean;
}

const tileSx = {
  px: 1.5,
  py: 0.75,
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 4,
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack component="section" gap={1}>
      <Typography variant="subtitle2" component="h2">
        {title}
      </Typography>
      {children}
    </Stack>
  );
}

/**
 * Right-hand "Wochendetails" panel of the desktop Wochenplanung: Kennzahlen, Wochenangaben and the
 * week actions that used to sit as separate rows above the table. Purely presentational - all data
 * and callbacks come from ScheduleView. The validation live region deliberately stays outside, in
 * ScheduleView, so findings are still announced while this panel is collapsed.
 */
export function WeekSidePanel({
  istSollText,
  notYetScheduledText,
  validationResults,
  validationSummaryText,
  employeeList,
  schedule,
  disabled = false,
  onScheduleSaved,
  onError,
  onCarryOver,
  onCopyPreviousWeek,
  onPrint,
  printAvailable,
}: WeekSidePanelProps) {
  const { t } = useTranslation('schedule');

  return (
    <Box
      component="aside"
      id={WEEK_SIDE_PANEL_ID}
      aria-label={t('sidePanelTitle')}
      sx={{
        width: 280,
        flexShrink: 0,
        overflowY: 'auto',
        borderLeft: '1px solid',
        borderColor: 'divider',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      <Section title={t('sidePanelKpiHeading')}>
        <Box sx={{ ...tileSx, backgroundColor: 'background.paper' }}>
          <Typography variant="caption" color="text.secondary" display="block">
            {t('istSollCaption')}
          </Typography>
          <Typography variant="body2" fontWeight={500}>
            {istSollText}
          </Typography>
        </Box>
        <ValidationNotices
          results={validationResults}
          employeeList={employeeList}
          renderTrigger={({ errorCount, onClick, expanded }) => (
            <Box
              component="button"
              type="button"
              onClick={onClick}
              aria-expanded={expanded}
              aria-haspopup="dialog"
              // Red only with at least one error: a warnings-only week is no alarm.
              sx={(theme) => ({
                ...tileSx,
                backgroundColor: errorCount > 0 ? theme.palette.errorSurface.subtle : theme.palette.warningSurface.subtle,
                borderColor: errorCount > 0 ? theme.palette.errorSurface.border : theme.palette.warningSurface.border,
                color: errorCount > 0 ? theme.palette.error.main : theme.palette.warning.main,
                font: 'inherit',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                textAlign: 'left',
              })}
            >
              <WarningAmberIcon fontSize="small" />
              <Typography variant="body2" fontWeight={500}>
                {validationSummaryText}
              </Typography>
            </Box>
          )}
        />
        <Box sx={(theme) => ({ ...tileSx, backgroundColor: theme.palette.accentSurface.subtle, color: theme.palette.primary.main })}>
          <Typography variant="caption" color="text.secondary" display="block">
            {t('notYetScheduledLabel')}
          </Typography>
          <Typography variant="body2" fontWeight={500}>
            {notYetScheduledText}
          </Typography>
        </Box>
      </Section>

      <Section title={t('sidePanelWeekDataHeading')}>
        <ScheduleHeaderFields schedule={schedule} disabled={disabled} onSaved={onScheduleSaved} onError={onError} fullWidth />
      </Section>

      <Section title={t('sidePanelActionsHeading')}>
        <Button variant="outlined" startIcon={<SwapHorizOutlinedIcon />} onClick={onCarryOver} fullWidth>
          {t('carryOverButton')}
        </Button>
        <Button variant="outlined" startIcon={<ContentCopyOutlinedIcon />} onClick={onCopyPreviousWeek} fullWidth>
          {t('copyPreviousWeekButton')}
        </Button>
        {printAvailable && (
          <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={onPrint} fullWidth>
            {t('printButton')}
          </Button>
        )}
      </Section>
    </Box>
  );
}
