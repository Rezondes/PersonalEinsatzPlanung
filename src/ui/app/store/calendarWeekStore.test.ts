import { describe, it, expect, beforeEach } from 'vitest';
import { useCalendarWeekStore } from './calendarWeekStore';
import { calendarWeekFromDate } from '@domain/shared/CalendarWeek';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';

describe('useCalendarWeekStore', () => {
  beforeEach(() => {
    useCalendarWeekStore.setState({ selectedWeek: calendarWeekFromDate(new Date()) });
  });

  it('starts with a selectedWeek matching the current real date', () => {
    const expected = calendarWeekFromDate(new Date());

    const state = useCalendarWeekStore.getState();

    expect(typeof state.selectedWeek.year).toBe('number');
    expect(typeof state.selectedWeek.week).toBe('number');
    expect(state.selectedWeek.week).toBeGreaterThanOrEqual(1);
    expect(state.selectedWeek.week).toBeLessThanOrEqual(53);
    expect(state.selectedWeek).toEqual(expected);
  });

  it('setSelectedWeek replaces selectedWeek with the exact object passed in', () => {
    const cw: CalendarWeek = { year: 2027, week: 12 };

    useCalendarWeekStore.getState().setSelectedWeek(cw);

    expect(useCalendarWeekStore.getState().selectedWeek).toBe(cw);
  });

  it('setSelectedWeek can be called again to replace a previously set week', () => {
    useCalendarWeekStore.getState().setSelectedWeek({ year: 2025, week: 1 });
    const second: CalendarWeek = { year: 2025, week: 53 };

    useCalendarWeekStore.getState().setSelectedWeek(second);

    expect(useCalendarWeekStore.getState().selectedWeek).toEqual(second);
  });
});
