import type { DayEntry } from '@domain/schedule/EmployeeWeekAssignment';
import type { Shift } from '@domain/schedule/Shift';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import { minutesToDecimalHours, shiftNetMinutes } from '@domain/schedule/scheduleCalculation';

/** Marker type on the drag payload. During dragover the browser hides the DATA of a drag but not
 * its types, so this is the only thing a drop target can check to tell one of our tools apart from
 * a file or some text dragged in from outside the app. Must stay lowercase - setData lowercases it. */
export const TOOL_MIME = 'application/x-pep-tool';

/**
 * Something the user can apply to a day: the fixed "Frei" tile, whatever was last copied, or one of
 * their own saved shift templates. One type for all three, so the toolbar, the clipboard and the
 * drop target do not each grow their own three-way branch.
 */
export type ScheduleTool =
  | { kind: 'off' }
  | { kind: 'clipboard'; entry: DayEntry }
  | { kind: 'template'; template: ShiftTemplate };

export const OFF_TOOL: ScheduleTool = { kind: 'off' };

/** Stable identity of a tool, for React keys and for the drag payload marker. */
export function toolKey(tool: ScheduleTool): string {
  switch (tool.kind) {
    case 'off':
      return 'off';
    case 'clipboard':
      return 'clipboard';
    case 'template':
      return `template:${tool.template.id}`;
  }
}

/** Fresh ids for every shift and break, so two cells can never share a Shift.id. Applying a tool
 * always COPIES - a template is never referenced by a weekly schedule. */
function withFreshIds(shifts: Shift[]): Shift[] {
  return shifts.map((shift) => ({
    ...shift,
    id: crypto.randomUUID(),
    breaks: shift.breaks.map((brk) => ({ ...brk, id: crypto.randomUUID() })),
  }));
}

/**
 * The day entry this tool writes into a cell. A manual netMinutesOverride is deliberately never
 * carried along: it corrects one specific day (same rule the clipboard already followed), and a
 * template cannot even represent one - it holds Shift[], not a DayEntry.
 */
export function toolToDayEntry(tool: ScheduleTool): DayEntry {
  switch (tool.kind) {
    case 'off':
      return { type: 'Off' };
    case 'template':
      return { type: 'Shift', shifts: withFreshIds(tool.template.shifts) };
    case 'clipboard':
      return tool.entry.type === 'Shift'
        ? { type: 'Shift', shifts: withFreshIds(tool.entry.shifts) }
        : { type: 'Off' };
  }
}

function shiftsMatch(a: Shift, b: Shift): boolean {
  if (a.start !== b.start || a.end !== b.end || a.endsNextDay !== b.endsNextDay) return false;
  if (a.breaks.length !== b.breaks.length) return false;
  return a.breaks.every((brk, i) => brk.start === b.breaks[i].start && brk.durationMinutes === b.breaks[i].durationMinutes);
}

/**
 * Whether a cell's ALREADY-SAVED entry is what applying `tool` there would produce - tap-to-assign
 * uses this to toggle a tile off (write `{ type: 'Off' }`) instead of reapplying an identical entry
 * when the user taps a cell a second time. Compares resolved shift times, ignoring generated ids
 * (`toolToDayEntry` always mints fresh ones via `withFreshIds`) and any manual `netMinutesOverride`
 * (a tool can never carry one - see `toolToDayEntry`'s own comment).
 *
 * Order-independent (a multiset match, not a positional one): ShiftListEditor's removeShift/addShift
 * always drops from wherever the removed draft was and appends the new one at the end, so a day
 * edited by removing then re-adding one of two split shifts ends up with the same shifts in a
 * different array position - that must still count as a match, or the toggle-off tap silently
 * rewrites the day instead (a real case found during review, not a hypothetical).
 */
export function dayEntryMatchesTool(entry: DayEntry, tool: ScheduleTool): boolean {
  const candidate = toolToDayEntry(tool);
  if (entry.type === 'Off' || candidate.type === 'Off') {
    return entry.type === 'Off' && candidate.type === 'Off';
  }
  if (entry.shifts.length !== candidate.shifts.length) return false;
  const unmatched = [...candidate.shifts];
  return entry.shifts.every((shift) => {
    const i = unmatched.findIndex((candidateShift) => shiftsMatch(shift, candidateShift));
    if (i === -1) return false;
    unmatched.splice(i, 1);
    return true;
  });
}

export function toolLabel(tool: ScheduleTool): string {
  switch (tool.kind) {
    case 'off':
      return 'Frei';
    case 'clipboard':
      return 'Zwischenablage';
    case 'template':
      return tool.template.name;
  }
}

function shiftsSummary(shifts: Shift[]): string {
  if (shifts.length === 0) {
    return 'Frei';
  }
  const times = shifts.map((s) => `${s.start}-${s.end}`).join(' / ');
  const netMinutes = shifts.reduce((sum, s) => sum + shiftNetMinutes(s), 0);
  return `${times} · ${minutesToDecimalHours(netMinutes).toLocaleString('de-DE')} Std.`;
}

/** Second line of a toolbar tile: the times behind the name, so two templates with similar names
 * stay distinguishable. */
export function toolSummary(tool: ScheduleTool): string {
  switch (tool.kind) {
    case 'off':
      return 'Tag leeren';
    case 'template':
      return shiftsSummary(tool.template.shifts);
    case 'clipboard':
      return tool.entry.type === 'Shift' ? shiftsSummary(tool.entry.shifts) : 'Frei';
  }
}
