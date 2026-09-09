import { useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Popover from '@mui/material/Popover';
import Button from '@mui/material/Button';
import { formatISODateGerman } from '@domain/shared/DateFormat';
import type { ValidationResult } from '@domain/validation/ValidationResult';
import type { Employee } from '@domain/employee/Employee';
import { fullName } from '@domain/employee/Employee';

interface ValidationNoticesProps {
  results: ValidationResult[];
  employeeList: Employee[];
  /** Lets a caller render its own trigger (the mockup's colored Fehler/Warnungen chip, styled
   * differently per breakpoint) instead of the plain default Button below - this component still
   * owns the open/closed state and the overlay, only the trigger's own markup is swapped. */
  renderTrigger?: (props: {
    errorCount: number;
    warningCount: number;
    onClick: (e: MouseEvent<HTMLElement>) => void;
  }) => ReactNode;
}

function employeeName(id: string | undefined, list: Employee[]): string {
  const found = list.find((e) => e.id === id);
  return found ? fullName(found) : '';
}

/**
 * Collapsed by default, opened as a MUI Popover anchored on the trigger - not a manually
 * `position: absolute`-placed Box. The trigger's own screen position varies a lot now (a plain
 * left-aligned button on laptop, but one of several chips inside a horizontally-scrolling KPI
 * strip on mobile/tablet - see ScheduleView), and a fixed-width panel positioned via a bare
 * `left: 0` relative to whichever chip happens to be tapped would overflow past the right edge of
 * the viewport on a narrow screen. Popover's own Popper-based positioning keeps the panel inside
 * the viewport regardless of where the trigger sits, which a hand-rolled absolute Box can't do
 * without reimplementing that same collision logic.
 */
export function ValidationNotices({ results, employeeList, renderTrigger }: ValidationNoticesProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const errors = results.filter((e) => e.severity === 'error');
  const warnings = results.filter((e) => e.severity === 'warning');

  if (results.length === 0) {
    return null;
  }

  const open = (e: MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const close = () => setAnchorEl(null);
  const expanded = !!anchorEl;

  return (
    <>
      {renderTrigger ? (
        renderTrigger({ errorCount: errors.length, warningCount: warnings.length, onClick: open })
      ) : (
        <Button size="small" onClick={open}>
          {errors.length} Fehler, {warnings.length} Warnung(en) {expanded ? 'ausblenden' : 'anzeigen'}
        </Button>
      )}

      <Popover
        open={expanded}
        anchorEl={anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { p: 1.5, width: 480, maxWidth: '90vw', maxHeight: 360 } } }}
      >
        <Stack spacing={1}>
          {errors.map((e, i) => (
            <Alert severity="error" key={`f-${i}`}>
              <AlertTitle>
                {employeeName(e.employeeId, employeeList)}
                {e.date ? ` · ${formatISODateGerman(e.date)}` : ''}
              </AlertTitle>
              {e.message}
            </Alert>
          ))}
          {warnings.map((e, i) => (
            <Alert severity="warning" key={`w-${i}`}>
              <AlertTitle>
                {employeeName(e.employeeId, employeeList)}
                {e.date ? ` · ${formatISODateGerman(e.date)}` : ''}
              </AlertTitle>
              {e.message}
            </Alert>
          ))}
        </Stack>
      </Popover>
    </>
  );
}
