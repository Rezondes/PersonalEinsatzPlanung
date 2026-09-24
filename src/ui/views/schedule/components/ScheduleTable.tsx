import { memo, useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Stack from '@mui/material/Stack';
import Checkbox from '@mui/material/Checkbox';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { Weekday } from '@domain/shared/CalendarWeek';
import { WEEKDAYS_SHORT } from '@domain/shared/CalendarWeek';
import { formatISODateShortGerman } from '@domain/shared/DateFormat';
import type { EmployeeId } from '@domain/shared/ids';
import { fullName } from '@domain/employee/Employee';
import {
  formatHoursGerman,
  formatHoursRangeGerman,
  shiftBreakMinutes,
} from '@domain/schedule/scheduleCalculation';
import type { ValidationResult } from '@domain/validation/ValidationResult';
import { absenceKindLabel } from '@domain/absence/Absence';
import type { DayView } from '@application/schedule/scheduleAssessment';
import { effectiveTargetMinutesRange } from '@application/schedule/scheduleAssessment';
import type { ScheduleRow } from '../scheduleRows';
import { canReceiveEntry, isCellLocked } from '../scheduleRows';
import {
  stickyCornerSx,
  stickyFirstColumnSx,
  stickyHeaderRowSx,
  STICKY_FIRST_COLUMN_CLASS,
  stickyFirstColumnRowHoverSx,
} from '@ui/components/stickyFirstColumn';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { useTapTooltip } from '@ui/hooks/useTapTooltip';

interface ScheduleTableProps {
  rows: ScheduleRow[];
  /** One entry per weekday, carrying that column's actual calendar date - the header needs a real
   * date (Aufgabe 3), which the per-employee DayView data doesn't give a single canonical source
   * for independent of `rows` being non-empty. Computed by ScheduleView from `selectedWeek`. */
  weekDays: { day: Weekday; date: string }[];
  validationResults: ValidationResult[];
  onCellClick: (employeeId: EmployeeId, dayView: DayView) => void;
  /** Touch-only tap-to-assign: true once the parent has armed a tool on a touch breakpoint (see
   * ScheduleView/ScheduleToolbar). While active, tapping a cell that can receive an entry calls
   * onToolTap instead of opening DayEditor; the table still stays free of which tool is active -
   * that lives in the parent, same as onToolDrop. */
  assignMode: boolean;
  onToolTap: (employeeId: EmployeeId, dayView: DayView) => void;
  /** Whether this cell's entry already matches the armed tool - drives the "already set" highlight
   * (the mockup's Zuweisen-Modus target color). Only consulted while assignMode is true. */
  isAssignTarget: (employeeId: EmployeeId, dayView: DayView) => boolean;
  /** True once the parent has armed multi-cell bulk selection (ScheduleView/ScheduleToolbar) -
   * mutually exclusive with assignMode. While active, every cell that canReceiveEntry (the same
   * rule drag-and-drop/tap-to-assign already use) becomes a checkbox instead of its normal
   * click-to-open/assign behavior. */
  selectionMode: boolean;
  /** Keys already selected, in `cellKey` format - the table stays free of any knowledge about what
   * happens with a selection once made, same as activeTool for assignMode. */
  selectedCells: Set<string>;
  onToggleCellSelection: (employeeId: EmployeeId, dayView: DayView) => void;
}

// Einzige Stelle für die Breite der Mitarbeiter-Spalte - width, minWidth UND maxWidth auf denselben
// Wert (echt fixe Breite, kein Wachsen mehr): bei einem breiten Fenster (z. B. 1920px) hatte
// table-layout:auto die freie Restfläche komplett dieser Spalte gegeben (beobachtet: bis zu 674px
// bei einem echten Mitarbeiternamen wie "Schwartinski, Kim Stefanie"), wodurch die 7
// Wochentag-Spalten optisch nach rechts zusammengeschoben wirkten ("Tage sind rechtsbündig").
// Ein langer Name/Tätigkeit bricht jetzt ggf. auf 2 Zeilen um, statt die Spalte zu verbreitern.
// Mobil 120px: mit 180px war die Spalte auf einem 360px-Handy die halbe Bildschirmbreite und nur
// ein einziger Tag sichtbar. Dazu gehört das schmalere Zell-Padding (FIRST_COLUMN_MOBILE_PX); mit
// ihm passen ein Name wie "Becker, Sophie" und "0 / 5-10 Std." plus Warn-Icon je in eine Zeile
// (bei 112px brachen beide um und die Zeile wurde höher statt kompakter).
const EMPLOYEE_COLUMN_WIDTH = { mobile: 120, desktop: 180 } as const;
const FIRST_COLUMN_MOBILE_PX = 1;

// Einzige Stelle für die Breite der 7 Wochentag-Spalten (Kopf- UND Datenzelle nutzen denselben
// Wert, siehe unten) - hier anpassen, keine Suche nach magischen Zahlen im Rest der Datei nötig.
// width, minWidth UND maxWidth (alle auf denselben Wert - eine echt fixe Breite, kein Minimum):
// mit width allein komprimiert table-layout:auto die Spalte proportional, sobald nicht genug Platz
// für alle Spalten da ist (bestätigt per getComputedStyle im echten Browser bei 1200px
// Fensterbreite); ohne maxWidth hätte sie umgekehrt bei ÜBERSCHÜSSIGEM Platz wachsen können. Die
// minWidth erzwingt stattdessen
// horizontales Scrollen (siehe stickyFirstColumn.ts) statt eines Schrumpfens unter diesen Wert.
// Mobil 150px: neben der 120px-Namensspalte sind so auf einem 360px-Handy 1,6 Tage sichtbar statt 1,3.
const WEEKDAY_COLUMN_WIDTH = { mobile: 150, desktop: 180 } as const;

const NO_RESULTS: ValidationResult[] = [];

/** Exported so ScheduleView can build/read the same key format for its selectedCells Set (P11)
 * without duplicating this one-liner. */
export function cellKey(employeeId: EmployeeId, date: string): string {
  return `${employeeId}|${date}`;
}

/** One-line summary of a cell's current content, for the aria-label (H6) - mirrors the exact same
 * branching the cell's own visible content below uses, so the two can never drift apart.
 * `emptyLabel` is the already-translated fallback text (the only translatable literal here). */
function cellSummaryText(dayView: DayView, emptyLabel: string): string {
  if (dayView.absenceCoversWholeDay && dayView.absence) {
    return absenceKindLabel(dayView.absence.type);
  }
  if (dayView.entry.type === 'Shift' && dayView.entry.shifts.length > 0) {
    return dayView.entry.shifts.map((s) => `${s.start}-${s.end}`).join(', ');
  }
  return emptyLabel;
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
  weekDays,
  validationResults,
  onCellClick,
  assignMode,
  onToolTap,
  isAssignTarget,
  selectionMode,
  selectedCells,
  onToggleCellSelection,
}: ScheduleTableProps) {
  const { t } = useTranslation('schedule');
  const { t: tCommon } = useTranslation();
  const theme = useTheme();
  const layout = useBreakpoint();
  const emptyCellText = t('emptyCellText');
  // Only 2 fixed, non-interpolated outputs possible - computed once instead of once per locked row.
  const inactiveLabel = tCommon('inactive');
  const notEmployedLabel = t('notEmployedLabel');
  // Warning/deviation tooltips: shared controller (see useTapTooltip's own doc comment) - one open
  // key at a time, hover enabled from tablet width up, tap-to-toggle everywhere, and each trigger
  // below is wrapped in ClickAwayListener since MUI's Tooltip adds no click-away handling of its own
  // even when controlled.
  const { toggle: toggleTooltip, tooltipProps, close: closeTooltip } = useTapTooltip();
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
    // axes, so it has to be the intended one, not an accident). height:'100%', not a vh cap:
    // ScheduleView gives this component a flex:1 region bounded between the header and whatever
    // fixed chrome sits below it, at every breakpoint, and this needs to fill exactly that.
    <TableContainer
      component={Paper}
      sx={{
        height: '100%',
        // Reaches the true screen edges on mobile, cancelling the wrapper Box's own px:1.5 in
        // ScheduleView - same edge-to-edge treatment as the mobile toolbar bar, and it buys back a
        // little extra width for the grid's own inevitable horizontal scroll on a phone.
        mx: layout === 'mobile' ? -1.5 : 0,
        // MuiTableContainer's own base style sets width:'100%', which resolves to the parent's
        // (padded) content width BEFORE the negative mx above is applied. With width fixed (not
        // auto), the box model is over-constrained once both margin-left and margin-right are
        // also fixed, and per the CSS2.1 rule for that case the browser silently recalculates
        // margin-right instead of honouring it - so only the left edge reached the true screen
        // edge and the right edge stayed 2x the negative margin short of it. width:'auto' lets the
        // browser solve width from both (now negative) margins instead, so it expands symmetrically.
        width: layout === 'mobile' ? 'auto' : undefined,
        borderRadius: layout === 'mobile' ? 0 : undefined,
        // overflow-x:auto (required for the horizontal scroll, see stickyFirstColumn.ts) forces the
        // browser to treat this element as a scroll container on BOTH axes even though only one is
        // ever visually scrolled far right - a classic (non-overlay) vertical scrollbar then
        // reserves its own width at the container's right edge, which reads as an asymmetric gap
        // against the left edge (flush, nothing reserved there). Hiding the scrollbar itself (touch
        // scrolling keeps working) removes that reserved strip instead of fighting it with margins.
        ...(layout === 'mobile'
          ? { scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }
          : {}),
      }}
    >
      {/* MUI's Table hardcodes width:'100%' (node_modules/@mui/material/Table/Table.js) - under
          table-layout:auto that forces the browser to grow columns past their own max-width to
          fill the container whenever the declared column widths add up to less than it (confirmed
          live: every column exceeded its max-width at a wide 1920px window). width:'auto' lets the
          table size to its columns' own declared widths instead, leaving real slack space empty in
          the TableContainer - the existing overflow-x:auto (see stickyFirstColumn.ts) still handles
          the opposite case, where the table is WIDER than its container. */}
      <Table size="small" sx={{ width: 'auto' }}>
        <TableHead>
          <TableRow>
            <TableCell
              sx={{
                ...stickyCornerSx(),
                width: layout === 'mobile' ? EMPLOYEE_COLUMN_WIDTH.mobile : EMPLOYEE_COLUMN_WIDTH.desktop,
                minWidth: layout === 'mobile' ? EMPLOYEE_COLUMN_WIDTH.mobile : EMPLOYEE_COLUMN_WIDTH.desktop,
                maxWidth: layout === 'mobile' ? EMPLOYEE_COLUMN_WIDTH.mobile : EMPLOYEE_COLUMN_WIDTH.desktop,
                ...(layout === 'mobile' && { px: FIRST_COLUMN_MOBILE_PX }),
              }}
            >
              {t('columnEmployee')}
            </TableCell>
            {weekDays.map(({ day, date }) => (
              <TableCell
                key={day}
                align="center"
                sx={{
                  ...stickyHeaderRowSx(),
                  width: layout === 'mobile' ? WEEKDAY_COLUMN_WIDTH.mobile : WEEKDAY_COLUMN_WIDTH.desktop,
                  minWidth: layout === 'mobile' ? WEEKDAY_COLUMN_WIDTH.mobile : WEEKDAY_COLUMN_WIDTH.desktop,
                  maxWidth: layout === 'mobile' ? WEEKDAY_COLUMN_WIDTH.mobile : WEEKDAY_COLUMN_WIDTH.desktop,
                }}
              >
                {layout === 'mobile' ? (
                  <Stack direction="column" alignItems="center">
                    <Typography variant="caption" fontWeight={500}>
                      {WEEKDAYS_SHORT[day]}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatISODateShortGerman(date)}
                    </Typography>
                  </Stack>
                ) : (
                  <Stack direction="row" spacing={0.5} justifyContent="center">
                    <Typography variant="caption" fontWeight={500}>
                      {WEEKDAYS_SHORT[day]}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatISODateShortGerman(date)}
                    </Typography>
                  </Stack>
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const { employee, view } = row;
            const target = effectiveTargetMinutesRange(employee, view);
            const differenceMinutes = deviationFromTarget(view.totalNetMinutes, target);

            return (
              <TableRow
                key={view.employeeId}
                hover={row.editable}
                sx={{
                  // Only an editable row keeps its native hover tint (see below) - matching that,
                  // the sticky-cell highlight rule is spread in only for editable rows too, or a
                  // locked/inactive row's sticky Mitarbeiter cell would light up on hover while the
                  // rest of the row deliberately does not.
                  ...(row.editable ? stickyFirstColumnRowHoverSx : {}),
                  bgcolor: row.editable ? undefined : 'inactiveSurface',
                  color: row.editable ? undefined : 'text.secondary',
                }}
              >
                <TableCell
                  component="th"
                  scope="row"
                  className={STICKY_FIRST_COLUMN_CLASS}
                  sx={layout === 'mobile' ? { ...stickyFirstColumnSx, px: FIRST_COLUMN_MOBILE_PX } : stickyFirstColumnSx}
                >
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography variant="body2" fontWeight={500} sx={{ overflowWrap: 'anywhere' }}>
                      {fullName(employee)}
                    </Typography>
                    {row.lockReason && (
                      <Chip size="small" label={row.lockReason === 'inactive' ? inactiveLabel : notEmployedLabel} />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {employee.jobTitle}
                  </Typography>
                  {/* Wraps the warning icon under the hours instead of overflowing the 112px mobile column. */}
                  <Stack direction="row" columnGap={0.5} alignItems="center" flexWrap="wrap">
                    <Typography variant="caption" color="text.secondary">
                      {t('actualVsTargetSuffix', {
                        worked: formatHoursGerman(view.totalNetMinutes),
                        range: formatHoursRangeGerman(target.min, target.max),
                      })}
                    </Typography>
                    {differenceMinutes !== 0 && (
                      <ClickAwayListener onClickAway={() => closeTooltip(`deviation|${view.employeeId}`)}>
                        <Tooltip
                          title={t('deviationTooltip', {
                            sign: differenceMinutes > 0 ? '+' : '',
                            hours: formatHoursGerman(differenceMinutes),
                            direction: differenceMinutes > 0 ? t('overTarget') : t('underTarget'),
                            range: formatHoursRangeGerman(target.min, target.max),
                          })}
                          arrow
                          {...tooltipProps(`deviation|${view.employeeId}`)}
                        >
                          <IconButton
                            aria-label={t('deviationAriaLabel')}
                            onClick={() => toggleTooltip(`deviation|${view.employeeId}`)}
                            // Mobile: the negative margin keeps the 44px hit area but lets it take
                            // only ~28px of layout, so it stays on the hours line in the 120px column.
                            sx={layout === 'mobile' ? { m: -1 } : undefined}
                          >
                            <WarningAmberIcon fontSize="small" sx={{ color: 'warning.main' }} />
                          </IconButton>
                        </Tooltip>
                      </ClickAwayListener>
                    )}
                  </Stack>
                </TableCell>

                {view.days.map((dayView: DayView) => {
                  const matches = resultsFor(view.employeeId, dayView.date);
                  const hasError = matches.some((e) => e.severity === 'error');
                  const hasWarning = matches.some((e) => e.severity === 'warning');
                  const locked = isCellLocked(row, dayView.day);
                  const droppable = canReceiveEntry(row, dayView);
                  const cellId = cellKey(view.employeeId, dayView.date);
                  const hasOverride =
                    dayView.entry.type === 'Shift' && dayView.entry.netMinutesOverride !== undefined;
                  // Same guard tap-to-assign shares with drag-and-drop (canReceiveEntry/droppable
                  // below) - a cell that cannot receive an entry never shows the target highlight
                  // either, even while assignMode is on.
                  const isTarget = assignMode && droppable && isAssignTarget(view.employeeId, dayView);
                  // locked/the plain default are the common-path cells (most of the table, every
                  // day); theme.palette.background.default is an exact match for the pre-existing
                  // light-mode default literal, so light mode is pixel-identical. hasError/hasWarning
                  // route through theme.palette.errorSurface/warningSurface, which carry their own
                  // dark-mode tints (see theme.ts).
                  const background = isTarget
                    ? theme.palette.accentSurface.strong
                    : locked
                    ? theme.palette.lockedSurface
                    : dayView.absence
                      ? theme.palette.accentSurface.subtle
                      : hasError
                        ? theme.palette.errorSurface.subtle
                        : hasWarning
                          ? theme.palette.warningSurface.subtle
                          : theme.palette.background.default;
                  const breakMinutes =
                    dayView.entry.type === 'Shift'
                      ? dayView.entry.shifts.reduce((sum, s) => sum + shiftBreakMinutes(s), 0)
                      : 0;

                  // Only a cell canReceiveEntry accepts becomes a checkbox in selection mode - the
                  // same three cases (inactive row, outside employment, multi-day absence) that
                  // already block drag-and-drop/tap-to-assign have nothing sensible to bulk-write
                  // into either.
                  const selectable = selectionMode && droppable;
                  const isSelected = selectable && selectedCells.has(cellId);

                  // A locked cell is deliberately not a button: no click, no keyboard focus, and
                  // ScheduleView checks the same predicate before opening the context menu. Its
                  // content stays fully readable so nothing looks lost. A cell the row/day lock
                  // spares but that still cannot RECEIVE an entry (a multi-day absence) keeps
                  // opening the (read-only) editor even in assign/selection mode - both only take
                  // over where a drop would already have been accepted.
                  const activateCell = () => {
                    if (selectable) return onToggleCellSelection(view.employeeId, dayView);
                    return assignMode && droppable
                      ? onToolTap(view.employeeId, dayView)
                      : onCellClick(view.employeeId, dayView);
                  };
                  const interaction = locked
                    ? { 'aria-disabled': true }
                    : {
                        role: selectable ? 'checkbox' : 'button',
                        ...(selectable ? { 'aria-checked': isSelected } : {}),
                        tabIndex: 0,
                        'aria-label': selectable
                          ? t('selectCellAriaLabel', { name: fullName(employee), day: dayView.day, summary: cellSummaryText(dayView, emptyCellText) })
                          : assignMode && droppable
                            ? t('assignCellAriaLabel', { name: fullName(employee), day: dayView.day, summary: cellSummaryText(dayView, emptyCellText) })
                            : t('editCellAriaLabel', { name: fullName(employee), day: dayView.day, summary: cellSummaryText(dayView, emptyCellText) }),
                        onClick: activateCell,
                        onKeyDown: (e: KeyboardEvent) => {
                          // Ignores a keydown that bubbled up from a nested interactive element
                          // (the warning icon below) - stopPropagation() on ITS click only stops
                          // the click, not the separate keydown event, which still bubbles here
                          // regardless. Without this, Enter/Space on the focused icon would also
                          // activate the cell underneath it.
                          if (e.target !== e.currentTarget) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            activateCell();
                          }
                        },
                      };

                  const warningKey = `cell|${cellId}`;

                  const cell = (
                    <Box
                      data-employeeid={view.employeeId}
                      data-day={dayView.day}
                      {...interaction}
                      sx={{
                        position: 'relative',
                        cursor: locked ? 'default' : 'pointer',
                        borderRadius: 1.5,
                        p: 1,
                        backgroundColor: background,
                        border: isTarget
                          ? `1px solid ${theme.palette.primary.main}`
                          : hasError
                            ? `1px solid ${theme.palette.errorSurface.border}`
                            : hasWarning
                              ? `1px solid ${theme.palette.warningSurface.border}`
                              : '1px solid transparent',
                        minHeight: 48,
                        '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
                      }}
                    >
                      {selectable && (
                        <Checkbox
                          checked={isSelected}
                          size="small"
                          // Purely the visual indicator - the outer Box carries the real
                          // role="checkbox"/aria-checked/onClick, so this must never intercept its
                          // own click or it would toggle twice (once here, once via the parent).
                          tabIndex={-1}
                          disableRipple
                          sx={{ position: 'absolute', top: 0, left: 0, p: 0.25, pointerEvents: 'none' }}
                        />
                      )}
                      {matches.length > 0 && (
                        <ClickAwayListener onClickAway={() => closeTooltip(warningKey)}>
                          <Tooltip
                            title={
                              <Stack spacing={0.5}>
                                {matches.map((e, i) => (
                                  <span key={i}>{e.message}</span>
                                ))}
                              </Stack>
                            }
                            arrow
                            {...tooltipProps(warningKey)}
                          >
                            {/* A dedicated tap target (not the whole cell, which already opens the
                                Tageseditor on tap) - stopPropagation keeps the two from competing for
                                the same tap, matching the row-level deviation icon's own pattern. */}
                            <IconButton
                              aria-label={t('hintAriaLabel')}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTooltip(warningKey);
                              }}
                              sx={{
                                position: 'absolute',
                                // Vertically centered on the cell regardless of its actual height
                                // (2 lines for a plain shift, 3+ for one with a Pause line) - a
                                // fixed `top` would pin it near the top edge instead, visibly
                                // off-center on any taller cell.
                                top: '50%',
                                right: 2,
                                transform: 'translateY(-50%)',
                                color: hasError ? 'error.main' : 'warning.main',
                              }}
                            >
                              <WarningAmberIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </ClickAwayListener>
                      )}
                      {dayView.absenceCoversWholeDay && dayView.absence ? (
                        <>
                          <Typography variant="body2" color={theme.palette.primary.main} fontWeight={500}>
                            {absenceKindLabel(dayView.absence.type)}
                          </Typography>
                          {dayView.creditedMinutes > 0 && (
                            <Typography variant="caption" color="text.secondary">
                              {t('creditedMinutesSuffix', { hours: formatHoursGerman(dayView.creditedMinutes) })}
                            </Typography>
                          )}
                        </>
                      ) : dayView.entry.type === 'Shift' && dayView.entry.shifts.length > 0 ? (
                        <>
                          {dayView.absence && (
                            <Typography variant="caption" display="block" color={theme.palette.primary.main} fontWeight={500}>
                              {t('halfDaySuffix', { label: absenceKindLabel(dayView.absence.type) })}
                            </Typography>
                          )}
                          {dayView.entry.shifts.map((s) => (
                            <Typography key={s.id} variant="body2" fontWeight={500}>
                              {s.start}-{s.end}
                            </Typography>
                          ))}
                          <Typography variant="caption" color="text.secondary">
                            {t('workedHoursSuffix', { hours: formatHoursGerman(dayView.workedMinutes) })}
                            {hasOverride && t('manualSuffix')}
                            {breakMinutes > 0 && t('breakSuffix', { hours: formatHoursGerman(breakMinutes) })}
                          </Typography>
                          {dayView.creditedMinutes > 0 && (
                            <Typography variant="caption" display="block" color="text.secondary">
                              {t('creditedMinutesSuffixPlus', { hours: formatHoursGerman(dayView.creditedMinutes) })}
                            </Typography>
                          )}
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          {emptyCellText}
                        </Typography>
                      )}
                    </Box>
                  );

                  return (
                    // overflowWrap: table-layout stays 'auto' (the sticky Mitarbeiter column still needs
                    // content-driven sizing), and 'auto' still grows a column past its declared `width`
                    // for any cell whose content has no in-word break opportunity (confirmed live: without
                    // this, a shift's "06:00-14:00" pushed its column from 76px to over 100px). 'anywhere'
                    // gives the browser a fallback break point so long content wraps instead of widening.
                    <TableCell
                      key={dayView.day}
                      align="center"
                      sx={{
                        p: 0.5,
                        width: layout === 'mobile' ? WEEKDAY_COLUMN_WIDTH.mobile : WEEKDAY_COLUMN_WIDTH.desktop,
                        minWidth: layout === 'mobile' ? WEEKDAY_COLUMN_WIDTH.mobile : WEEKDAY_COLUMN_WIDTH.desktop,
                        maxWidth: layout === 'mobile' ? WEEKDAY_COLUMN_WIDTH.mobile : WEEKDAY_COLUMN_WIDTH.desktop,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {cell}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
});
