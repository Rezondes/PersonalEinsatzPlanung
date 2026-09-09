import { memo, useMemo, useState } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { WEEKDAYS } from '@domain/shared/CalendarWeek';
import type { EmployeeId } from '@domain/shared/ids';
import { fullName } from '@domain/employee/Employee';
import {
  formatHoursRangeGerman,
  minutesToDecimalHours,
  shiftBreakMinutes,
} from '@domain/schedule/scheduleCalculation';
import type { ValidationResult } from '@domain/validation/ValidationResult';
import type { DayView } from '@application/schedule/scheduleAssessment';
import { effectiveTargetMinutesRange } from '@application/schedule/scheduleAssessment';
import type { RowLockReason, ScheduleRow } from '../scheduleRows';
import { canReceiveEntry, isCellLocked } from '../scheduleRows';
import { TOOL_MIME } from '../scheduleTools';
import { stickyCornerSx, stickyFirstColumnSx, stickyHeaderRowSx } from '@ui/components/stickyFirstColumn';

interface ScheduleTableProps {
  rows: ScheduleRow[];
  validationResults: ValidationResult[];
  onCellClick: (employeeId: EmployeeId, dayView: DayView) => void;
  /** A toolbar tool was dropped on this cell. Which tool it was comes from the drag payload the
   * parent holds - the table stays free of any knowledge about tools. */
  onToolDrop: (employeeId: EmployeeId, dayView: DayView) => void;
  /** Touch-only tap-to-assign: true once the parent has armed a tool on a touch breakpoint (see
   * ScheduleView/ScheduleToolbar). While active, tapping a cell that can receive an entry calls
   * onToolTap instead of opening DayEditor; the table still stays free of which tool is active -
   * that lives in the parent, same as onToolDrop. */
  assignMode: boolean;
  onToolTap: (employeeId: EmployeeId, dayView: DayView) => void;
  /** Whether this cell's entry already matches the armed tool - drives the "already set" highlight
   * (the mockup's Zuweisen-Modus target color). Only consulted while assignMode is true. */
  isAssignTarget: (employeeId: EmployeeId, dayView: DayView) => boolean;
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

const LOCK_LABEL: Record<RowLockReason, string> = {
  inactive: 'Inaktiv',
  notEmployed: 'Nicht beschäftigt',
};

const NO_RESULTS: ValidationResult[] = [];

function cellKey(employeeId: EmployeeId, date: string): string {
  return `${employeeId}|${date}`;
}

/** How far the actual hours fall outside the target band. Zero while they are inside it, which for
 * a Minijob is the whole Min-Max range - FullTime/PartTime, whose min and max are the same number,
 * still flag every deviation exactly as before. */
function deviationFromTarget(actualMinutes: number, target: { min: number; max: number }): number {
  if (actualMinutes < target.min) {
    return actualMinutes - target.min;
  }
  if (actualMinutes > target.max) {
    return actualMinutes - target.max;
  }
  return 0;
}

/** Memoized: ScheduleView re-renders on every context-menu/dialog/snackbar state change, and this
 * table is by far its most expensive subtree (seven styled cells per employee). With stable props
 * from the parent (memoized rows, useCallback'd onCellClick) those re-renders skip it. */
export const ScheduleTable = memo(function ScheduleTable({
  rows,
  validationResults,
  onCellClick,
  onToolDrop,
  assignMode,
  onToolTap,
  isAssignTarget,
}: ScheduleTableProps) {
  // Kept HERE and not in ScheduleView on purpose: dragover fires continuously, and a highlight in
  // the parent would re-render it (and defeat this component's memo) many times per second. As
  // cell state it only changes when the pointer crosses a cell boundary.
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  // Grouped once per validation run instead of filtering the whole result list for every cell.
  // Week-level results (no date) belong to no cell; ValidationNotices lists them instead.
  const resultsByCell = useMemo(() => {
    const map = new Map<string, ValidationResult[]>();
    for (const result of validationResults) {
      if (!result.employeeId || !result.date) continue;
      const key = cellKey(result.employeeId, result.date);
      const list = map.get(key);
      if (list) {
        list.push(result);
      } else {
        map.set(key, [result]);
      }
    }
    return map;
  }, [validationResults]);

  const resultsFor = (employeeId: EmployeeId, date: string) =>
    resultsByCell.get(cellKey(employeeId, date)) ?? NO_RESULTS;

  return (
    // Bounded height, self-scrolling on both axes - see stickyFirstColumn.ts for why a sticky
    // header row and horizontal scroll on a real <table> can't coexist any other way (overflow-x:
    // auto unconditionally makes the browser treat this element as the scroll container for both
    // axes, so it has to be the intended one, not an accident).
    <TableContainer component={Paper} sx={{ maxHeight: '70vh' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...stickyCornerSx(), minWidth: 180 }}>Mitarbeiter</TableCell>
            {WEEKDAYS.map((day) => (
              <TableCell key={day} align="center" sx={{ ...stickyHeaderRowSx(), minWidth: 120 }}>
                {day}
              </TableCell>
            ))}
            <TableCell align="center" sx={stickyHeaderRowSx()}>
              Soll
            </TableCell>
            <TableCell align="center" sx={stickyHeaderRowSx()}>
              Gesamt
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const { employee, view } = row;
            const target = effectiveTargetMinutesRange(employee, view);
            const differenceMinutes = deviationFromTarget(view.totalNetMinutes, target);

            return (
              <TableRow key={view.employeeId} hover sx={{ opacity: row.editable ? 1 : 0.55 }}>
                <TableCell sx={stickyFirstColumnSx}>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography variant="body2" fontWeight={500}>
                      {fullName(employee)}
                    </Typography>
                    {row.lockReason && <Chip size="small" label={LOCK_LABEL[row.lockReason]} />}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {employee.jobTitle}
                  </Typography>
                </TableCell>

                {view.days.map((dayView: DayView) => {
                  const matches = resultsFor(view.employeeId, dayView.date);
                  const hasError = matches.some((e) => e.severity === 'error');
                  const hasWarning = matches.some((e) => e.severity === 'warning');
                  const locked = isCellLocked(row, dayView.day);
                  const droppable = canReceiveEntry(row, dayView);
                  const cellId = cellKey(view.employeeId, dayView.date);
                  const isDropTarget = dropTargetKey === cellId;
                  const hasOverride =
                    dayView.entry.type === 'Shift' && dayView.entry.netMinutesOverride !== undefined;
                  // Same guard tap-to-assign shares with drag-and-drop (canReceiveEntry/droppable
                  // below) - a cell that cannot receive an entry never shows the target highlight
                  // either, even while assignMode is on.
                  const isTarget = assignMode && droppable && isAssignTarget(view.employeeId, dayView);
                  const background = isDropTarget || isTarget
                    ? '#dce9e3'
                    : locked
                    ? '#f0f0ee'
                    : dayView.absence
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

                  // A locked cell is deliberately not a button: no click, no keyboard focus, and
                  // ScheduleView checks the same predicate before opening the context menu. Its
                  // content stays fully readable so nothing looks lost. A cell the row/day lock
                  // spares but that still cannot RECEIVE an entry (a multi-day absence) keeps
                  // opening the (read-only) editor even in assign mode - tap-to-assign only takes
                  // over where a drop would already have been accepted.
                  const activateCell = () =>
                    assignMode && droppable
                      ? onToolTap(view.employeeId, dayView)
                      : onCellClick(view.employeeId, dayView);
                  const interaction = locked
                    ? { 'aria-disabled': true }
                    : {
                        role: 'button',
                        tabIndex: 0,
                        'aria-label':
                          assignMode && droppable ? `${dayView.day} zuweisen` : `${dayView.day} bearbeiten`,
                        onClick: activateCell,
                        onKeyDown: (e: KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            activateCell();
                          }
                        },
                      };

                  // A cell that cannot receive an entry gets no drag handlers at all - the browser
                  // then shows the "no drop" cursor by itself, no extra code needed. getData() is
                  // blanked during dragover by every browser, so only the marker type can be checked
                  // there; the payload itself is read from the parent on drop.
                  const dropHandlers = droppable
                    ? {
                        onDragEnter: (e: DragEvent) => {
                          if (!e.dataTransfer.types.includes(TOOL_MIME)) return;
                          e.preventDefault();
                          setDropTargetKey(cellId);
                        },
                        onDragOver: (e: DragEvent) => {
                          if (!e.dataTransfer.types.includes(TOOL_MIME)) return;
                          // Without this the drop event never fires at all.
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'copy';
                        },
                        onDragLeave: (e: DragEvent<HTMLElement>) => {
                          // Moving onto a child element also fires dragleave; only a real exit counts.
                          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                            setDropTargetKey(null);
                          }
                        },
                        onDrop: (e: DragEvent) => {
                          e.preventDefault();
                          setDropTargetKey(null);
                          if (!e.dataTransfer.types.includes(TOOL_MIME)) return;
                          onToolDrop(view.employeeId, dayView);
                        },
                      }
                    : {};

                  const cell = (
                    <Box
                      data-employeeid={view.employeeId}
                      data-day={dayView.day}
                      {...interaction}
                      {...dropHandlers}
                      sx={{
                        cursor: locked ? 'default' : 'pointer',
                        borderRadius: 1.5,
                        p: 1,
                        backgroundColor: background,
                        border: isTarget
                          ? '1px solid #2f5d50'
                          : hasError
                            ? '1px solid #e5a3a0'
                            : hasWarning
                              ? '1px solid #e6c988'
                              : '1px solid transparent',
                        minHeight: 48,
                        '&:focus-visible': { outline: '2px solid #2f5d50', outlineOffset: 2 },
                      }}
                    >
                      {dayView.absenceCoversWholeDay && dayView.absence ? (
                        <>
                          <Typography variant="body2" color="#2f5d50" fontWeight={500}>
                            {absenceText(dayView.absence.type)}
                          </Typography>
                          {dayView.creditedMinutes > 0 && (
                            <Typography variant="caption" color="text.secondary">
                              {minutesToDecimalHours(dayView.creditedMinutes).toLocaleString('de-DE')} Std.
                              angerechnet
                            </Typography>
                          )}
                        </>
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
                            {minutesToDecimalHours(dayView.workedMinutes).toLocaleString('de-DE')} Std.
                            {hasOverride && ' (manuell)'}
                            {breakMinutes > 0 &&
                              ` · ${minutesToDecimalHours(breakMinutes).toLocaleString('de-DE')} Std. Pause`}
                          </Typography>
                          {dayView.creditedMinutes > 0 && (
                            <Typography variant="caption" display="block" color="text.secondary">
                              + {minutesToDecimalHours(dayView.creditedMinutes).toLocaleString('de-DE')} Std.
                              angerechnet
                            </Typography>
                          )}
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
                    {formatHoursRangeGerman(target.min, target.max)}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                    <Typography variant="body2" fontWeight={500}>
                      {minutesToDecimalHours(view.totalNetMinutes).toLocaleString('de-DE')}
                    </Typography>
                    {differenceMinutes !== 0 && (
                      <Tooltip
                        title={`${differenceMinutes > 0 ? '+' : ''}${minutesToDecimalHours(differenceMinutes).toLocaleString('de-DE')} Std. ${differenceMinutes > 0 ? 'über' : 'unter'} Soll (${formatHoursRangeGerman(target.min, target.max)} Std.)`}
                        arrow
                      >
                        <WarningAmberIcon fontSize="small" sx={{ color: '#c8973a' }} />
                      </Tooltip>
                    )}
                  </Stack>
                  {view.creditedMinutes > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      {minutesToDecimalHours(view.workedMinutes).toLocaleString('de-DE')} gearbeitet +{' '}
                      {minutesToDecimalHours(view.creditedMinutes).toLocaleString('de-DE')} angerechnet
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
});
