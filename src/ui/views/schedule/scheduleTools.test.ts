import { describe, it, expect } from 'vitest';
import type { BranchId } from '@domain/shared/ids';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import { createBreak } from '@domain/schedule/Break';
import { createShiftTemplate } from '@domain/schedule/ShiftTemplate';
import type { DayEntry } from '@domain/schedule/EmployeeWeekAssignment';
import { OFF_TOOL, dayEntryMatchesTool, toolKey, toolLabel, toolSummary, toolToDayEntry } from './scheduleTools';

const branchId = 'b1' as BranchId;

function shiftWithBreak() {
  const shift = createShift(clockTime('06:00'), clockTime('14:00'));
  return { ...shift, breaks: [createBreak(30, clockTime('10:00'))] };
}

const template = createShiftTemplate({ branchId, name: 'Frühschicht', shifts: [shiftWithBreak()] });

describe('toolToDayEntry', () => {
  it('empties the day for the Frei tool', () => {
    expect(toolToDayEntry(OFF_TOOL)).toEqual({ type: 'Off' });
  });

  it('writes a template as a shift entry', () => {
    const entry = toolToDayEntry({ kind: 'template', template });
    expect(entry.type).toBe('Shift');
    expect(entry.type === 'Shift' && entry.shifts[0].start).toBe('06:00');
  });

  it('gives every application fresh shift and break ids, so two cells never share one', () => {
    const first = toolToDayEntry({ kind: 'template', template });
    const second = toolToDayEntry({ kind: 'template', template });
    if (first.type !== 'Shift' || second.type !== 'Shift') throw new Error('expected shifts');

    expect(first.shifts[0].id).not.toBe(template.shifts[0].id);
    expect(first.shifts[0].id).not.toBe(second.shifts[0].id);
    expect(first.shifts[0].breaks[0].id).not.toBe(second.shifts[0].breaks[0].id);
    // The template itself is untouched.
    expect(template.shifts[0].breaks).toHaveLength(1);
  });

  it('never carries a manual day override along', () => {
    const source: DayEntry = { type: 'Shift', shifts: [shiftWithBreak()], netMinutesOverride: 90 };
    const entry = toolToDayEntry({ kind: 'clipboard', entry: source });
    expect(entry.type === 'Shift' && entry.netMinutesOverride).toBeUndefined();
  });

  it('copies an Off day from the clipboard as an empty day', () => {
    expect(toolToDayEntry({ kind: 'clipboard', entry: { type: 'Off' } })).toEqual({ type: 'Off' });
  });
});

describe('dayEntryMatchesTool', () => {
  it('matches Off against Off and nothing else', () => {
    expect(dayEntryMatchesTool({ type: 'Off' }, OFF_TOOL)).toBe(true);
    expect(dayEntryMatchesTool({ type: 'Off' }, { kind: 'template', template })).toBe(false);
  });

  it('matches a template application against the same template, ignoring fresh ids', () => {
    const applied = toolToDayEntry({ kind: 'template', template });
    expect(dayEntryMatchesTool(applied, { kind: 'template', template })).toBe(true);
  });

  it('does not match a manual netMinutesOverride difference - a tool can never carry one anyway', () => {
    const applied = toolToDayEntry({ kind: 'template', template });
    if (applied.type !== 'Shift') throw new Error('expected a shift');
    const overridden: DayEntry = { ...applied, netMinutesOverride: 90 };
    expect(dayEntryMatchesTool(overridden, { kind: 'template', template })).toBe(true);
  });

  it('does not match when the shift times differ', () => {
    const otherTemplate = createShiftTemplate({ branchId, name: 'Spätschicht', shifts: [createShift(clockTime('14:00'), clockTime('22:00'))] });
    const applied = toolToDayEntry({ kind: 'template', template });
    expect(dayEntryMatchesTool(applied, { kind: 'template', template: otherTemplate })).toBe(false);
  });

  it('does not match a Shift entry against Off, or vice versa', () => {
    const applied = toolToDayEntry({ kind: 'template', template });
    expect(dayEntryMatchesTool(applied, OFF_TOOL)).toBe(false);
    expect(dayEntryMatchesTool({ type: 'Off' }, { kind: 'template', template })).toBe(false);
  });

  it('matches a multi-shift day even when the shifts are in a different array order', () => {
    // Regression: ShiftListEditor's removeShift/addShift always drops from wherever the removed
    // draft was and appends the new one at the end, so editing a split-shift day (e.g. remove the
    // first shift, re-add an identical one) leaves the two shifts in a different position than a
    // freshly-applied template would - that must still count as a match.
    const morning = createShift(clockTime('06:00'), clockTime('10:00'));
    const afternoon = createShift(clockTime('14:00'), clockTime('18:00'));
    const splitTemplate = createShiftTemplate({ branchId, name: 'Split', shifts: [morning, afternoon] });
    const reordered: DayEntry = {
      type: 'Shift',
      shifts: [
        { ...afternoon, id: 'x1' },
        { ...morning, id: 'x2' },
      ],
    };
    expect(dayEntryMatchesTool(reordered, { kind: 'template', template: splitTemplate })).toBe(true);
  });

  it('does not match two shifts against one shift that happens to equal one of them', () => {
    const morning = createShift(clockTime('06:00'), clockTime('10:00'));
    const afternoon = createShift(clockTime('14:00'), clockTime('18:00'));
    const oneShiftTemplate = createShiftTemplate({ branchId, name: 'Morgens', shifts: [morning] });
    const twoShifts: DayEntry = { type: 'Shift', shifts: [morning, afternoon] };
    expect(dayEntryMatchesTool(twoShifts, { kind: 'template', template: oneShiftTemplate })).toBe(false);
  });
});

describe('tool labels', () => {
  it('names each kind for the toolbar', () => {
    expect(toolLabel(OFF_TOOL)).toBe('Frei');
    expect(toolLabel({ kind: 'template', template })).toBe('Frühschicht');
    expect(toolLabel({ kind: 'clipboard', entry: { type: 'Off' } })).toBe('Zwischenablage');
  });

  it('summarises the times and net hours behind the name', () => {
    expect(toolSummary({ kind: 'template', template })).toBe('06:00-14:00 · 7,5 Std.');
    expect(toolSummary(OFF_TOOL)).toBe('Tag leeren');
  });

  it('keys a template by its id, so tiles stay stable across reloads', () => {
    expect(toolKey({ kind: 'template', template })).toBe(`template:${template.id}`);
    expect(toolKey(OFF_TOOL)).toBe('off');
  });
});
