import { describe, it, expect } from 'vitest';
import { addDays, differenceInCalendarDays } from 'date-fns';
import {
  calendarWeekFromDate,
  mondayOfWeek,
  dateForWeekday,
  previousCalendarWeek,
  nextCalendarWeek,
  calendarWeeksEqual,
  calendarWeeksInMonth,
} from './CalendarWeek';

describe('calendarWeekFromDate / mondayOfWeek', () => {
  it('January 4th always belongs to week 1 of its year, per the ISO-8601 definition', () => {
    for (const year of [2023, 2024, 2025, 2026, 2027, 2028]) {
      const cw = calendarWeekFromDate(new Date(year, 0, 4));
      expect(cw.week).toBe(1);
      expect(cw.year).toBe(year);
    }
  });

  it('mondayOfWeek always returns a Monday, and the source date falls within that week', () => {
    const referenceDates = [
      new Date(2024, 11, 30), // year-boundary edge case
      new Date(2025, 0, 1),
      new Date(2025, 11, 29), // week-53 candidate
      new Date(2026, 8, 7),
      new Date(2027, 5, 15),
    ];
    for (const date of referenceDates) {
      const cw = calendarWeekFromDate(date);
      const monday = mondayOfWeek(cw);
      expect(monday.getDay()).toBe(1); // 1 = Monday
      const distance = differenceInCalendarDays(date, monday);
      expect(distance).toBeGreaterThanOrEqual(0);
      expect(distance).toBeLessThanOrEqual(6);
    }
  });

  it('stays consistent across a year boundary (round-trip for every day in a range)', () => {
    let date = new Date(2024, 11, 1);
    const end = new Date(2026, 1, 1);
    while (date <= end) {
      const cw = calendarWeekFromDate(date);
      const monday = mondayOfWeek(cw);
      const cwBack = calendarWeekFromDate(monday);
      expect(calendarWeeksEqual(cw, cwBack)).toBe(true);
      date = addDays(date, 1);
    }
  });
});

describe('dateForWeekday', () => {
  it('Monday equals mondayOfWeek, Sunday falls 6 days after', () => {
    const cw = calendarWeekFromDate(new Date(2026, 8, 7));
    expect(dateForWeekday(cw, 'Montag').getTime()).toBe(mondayOfWeek(cw).getTime());
    expect(differenceInCalendarDays(dateForWeekday(cw, 'Sonntag'), mondayOfWeek(cw))).toBe(6);
  });
});

describe('previousCalendarWeek / nextCalendarWeek', () => {
  it('are inverse to each other', () => {
    const cw = calendarWeekFromDate(new Date(2026, 0, 1));
    expect(calendarWeeksEqual(nextCalendarWeek(previousCalendarWeek(cw)), cw)).toBe(true);
    expect(calendarWeeksEqual(previousCalendarWeek(nextCalendarWeek(cw)), cw)).toBe(true);
  });

  it('works correctly across a year boundary', () => {
    const firstWeekOfYear = calendarWeekFromDate(new Date(2026, 0, 4));
    const previous = previousCalendarWeek(firstWeekOfYear);
    expect(previous.year).toBeLessThanOrEqual(2026);
    expect(calendarWeeksEqual(nextCalendarWeek(previous), firstWeekOfYear)).toBe(true);
  });
});

describe('calendarWeeksInMonth', () => {
  it('returns only weeks whose Monday actually falls in the requested month', () => {
    const weeks = calendarWeeksInMonth(2026, 9);
    for (const cw of weeks) {
      const monday = mondayOfWeek(cw);
      expect(monday.getFullYear()).toBe(2026);
      expect(monday.getMonth()).toBe(8); // September = index 8
    }
    expect(weeks.length).toBeGreaterThanOrEqual(4);
    expect(weeks.length).toBeLessThanOrEqual(5);
  });
});
