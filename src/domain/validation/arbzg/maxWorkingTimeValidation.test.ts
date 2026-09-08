import { describe, it, expect } from 'vitest';
import type { EmployeeId } from '@domain/shared/ids';
import { validateDailyWorkingTime, validateWeeklyWorkingTime } from './maxWorkingTimeValidation';

const context = { employeeId: 'm1' as EmployeeId, date: '2026-09-07' };

describe('validateDailyWorkingTime', () => {
  it('gives no result at exactly 8 hours', () => {
    expect(validateDailyWorkingTime(8 * 60, context)).toHaveLength(0);
  });

  it('warns above 8 hours', () => {
    const results = validateDailyWorkingTime(8 * 60 + 30, context);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('warning');
  });

  it('gives only a warning at exactly 10 hours (threshold is "greater than")', () => {
    const results = validateDailyWorkingTime(10 * 60, context);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('warning');
  });

  it('reports an error above 10 hours', () => {
    const results = validateDailyWorkingTime(10 * 60 + 1, context);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('error');
  });
});

describe('validateWeeklyWorkingTime', () => {
  it('warns above 48 weekly hours', () => {
    const results = validateWeeklyWorkingTime(48 * 60 + 1, { employeeId: 'm1' as EmployeeId });
    expect(results).toHaveLength(1);
  });

  it('does not warn at exactly 48 weekly hours', () => {
    expect(validateWeeklyWorkingTime(48 * 60, { employeeId: 'm1' as EmployeeId })).toHaveLength(0);
  });
});

describe('Meldungstexte (deutsche Schreibweise)', () => {
  it('writes decimal hours with a German comma, never a point', () => {
    const [warning] = validateDailyWorkingTime(8 * 60 + 30, context);
    expect(warning.message).toBe(
      'Tägliche Arbeitszeit von 8,5 Std. über 8 Std., muss innerhalb von 6 Kalendermonaten im Schnitt ausgeglichen werden (§3 ArbZG).',
    );

    const [error] = validateDailyWorkingTime(10 * 60 + 15, context);
    expect(error.message).toBe(
      'Tägliche Arbeitszeit von 10,25 Std. überschreitet die gesetzlich zulässige Höchstgrenze von 10 Std.',
    );

    const [weekly] = validateWeeklyWorkingTime(50 * 60 + 30, { employeeId: context.employeeId });
    expect(weekly.message).toBe('Wochenarbeitszeit von 50,5 Std. über 48 Std.');
  });
});
