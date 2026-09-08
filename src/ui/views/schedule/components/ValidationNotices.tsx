import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import { formatISODateGerman } from '@domain/shared/DateFormat';
import type { ValidationResult } from '@domain/validation/ValidationResult';
import type { Employee } from '@domain/employee/Employee';
import { fullName } from '@domain/employee/Employee';

interface ValidationNoticesProps {
  results: ValidationResult[];
  employeeList: Employee[];
}

function employeeName(id: string | undefined, list: Employee[]): string {
  const found = list.find((e) => e.id === id);
  return found ? fullName(found) : '';
}

/**
 * Collapsed by default and rendered as an overlay (position: absolute) instead of in normal
 * document flow - this way the weekly overview underneath doesn't shift when expanded.
 */
export function ValidationNotices({ results, employeeList }: ValidationNoticesProps) {
  const [expanded, setExpanded] = useState(false);
  const errors = results.filter((e) => e.severity === 'error');
  const warnings = results.filter((e) => e.severity === 'warning');

  if (results.length === 0) {
    return null;
  }

  return (
    <Box sx={{ position: 'relative', mb: 2 }}>
      <Button size="small" onClick={() => setExpanded((v) => !v)}>
        {errors.length} Fehler, {warnings.length} Warnung(en) {expanded ? 'ausblenden' : 'anzeigen'}
      </Button>

      {expanded && (
        <ClickAwayListener onClickAway={() => setExpanded(false)}>
          <Paper
            sx={{
              position: 'absolute',
              top: '100%',
              left: 0,
              zIndex: 10,
              mt: 0.5,
              p: 1.5,
              width: 480,
              maxWidth: '90vw',
              maxHeight: 360,
              overflowY: 'auto',
              boxShadow: 3,
            }}
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
          </Paper>
        </ClickAwayListener>
      )}
    </Box>
  );
}
