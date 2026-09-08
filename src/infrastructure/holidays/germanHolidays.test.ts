import { describe, it, expect } from 'vitest';
import { holidaysForYearAndFederalState, createHolidayCheck } from './germanHolidays';

describe('holidaysForYearAndFederalState', () => {
  it('correctly calculates the movable (Easter-based) holidays for known years', () => {
    // Easter Sunday: 2024-03-31, 2025-04-20, 2026-04-05 (publicly known reference values)
    const h2024 = holidaysForYearAndFederalState(2024, 'Niedersachsen');
    expect(h2024.has('2024-03-29')).toBe(true); // Good Friday
    expect(h2024.has('2024-04-01')).toBe(true); // Easter Monday
    expect(h2024.has('2024-05-09')).toBe(true); // Ascension Day
    expect(h2024.has('2024-05-20')).toBe(true); // Whit Monday

    const h2025 = holidaysForYearAndFederalState(2025, 'Niedersachsen');
    expect(h2025.has('2025-04-18')).toBe(true); // Good Friday
    expect(h2025.has('2025-04-21')).toBe(true); // Easter Monday

    const h2026 = holidaysForYearAndFederalState(2026, 'Niedersachsen');
    expect(h2026.has('2026-04-03')).toBe(true); // Good Friday
    expect(h2026.has('2026-04-06')).toBe(true); // Easter Monday
  });

  it('includes the nationwide fixed holidays', () => {
    const holidays = holidaysForYearAndFederalState(2026, 'Bayern');
    expect(holidays.has('2026-01-01')).toBe(true);
    expect(holidays.has('2026-05-01')).toBe(true);
    expect(holidays.has('2026-10-03')).toBe(true);
    expect(holidays.has('2026-12-25')).toBe(true);
    expect(holidays.has('2026-12-26')).toBe(true);
  });

  it('only applies state-specific holidays in the respective federal state', () => {
    expect(holidaysForYearAndFederalState(2026, 'Bayern').has('2026-01-06')).toBe(true); // Epiphany
    expect(holidaysForYearAndFederalState(2026, 'Niedersachsen').has('2026-01-06')).toBe(false);

    expect(holidaysForYearAndFederalState(2026, 'Niedersachsen').has('2026-10-31')).toBe(true); // Reformation Day
    expect(holidaysForYearAndFederalState(2026, 'Bayern').has('2026-10-31')).toBe(false);
  });
});

describe('createHolidayCheck', () => {
  it('returns a working, cached isHoliday function', () => {
    const isHoliday = createHolidayCheck('Niedersachsen');
    expect(isHoliday('2026-01-01')).toBe(true);
    expect(isHoliday('2026-01-02')).toBe(false);
    expect(isHoliday('2026-12-25')).toBe(true);
  });
});
