import { describe, it, expect } from 'vitest';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import type { EmployeeId } from '@domain/shared/ids';
import { validateShiftDuration } from './shiftDurationValidation';

const context = { employeeId: 'm1' as EmployeeId, date: '2026-09-07' };

describe('validateShiftDuration', () => {
  it('reports no error for a normal shift', () => {
    const shift = createShift(clockTime('06:00'), clockTime('14:00'));
    expect(validateShiftDuration(shift, context)).toHaveLength(0);
  });

  it('reports an error when end is before start without endsNextDay', () => {
    const shift = createShift(clockTime('14:00'), clockTime('06:00'), false);
    const results = validateShiftDuration(shift, context);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('error');
  });

  it('reports an error when end equals start (0 minutes duration)', () => {
    const shift = createShift(clockTime('06:00'), clockTime('06:00'), false);
    expect(validateShiftDuration(shift, context)).toHaveLength(1);
  });

  it('reports no error for a night shift with endsNextDay set', () => {
    const shift = createShift(clockTime('20:00'), clockTime('06:00'), true);
    expect(validateShiftDuration(shift, context)).toHaveLength(0);
  });
});
