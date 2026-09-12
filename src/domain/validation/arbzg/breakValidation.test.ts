import { describe, it, expect } from 'vitest';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import { createBreak } from '@domain/schedule/Break';
import type { EmployeeId } from '@domain/shared/ids';
import { validateBreaks } from './breakValidation';

const context = { employeeId: 'm1' as EmployeeId, date: '2026-09-07' };

function errors(results: ReturnType<typeof validateBreaks>) {
  return results.filter((e) => e.severity === 'error');
}

describe('validateBreaks', () => {
  it('requires no break at exactly 6 hours net (law: "more than 6 hours")', () => {
    const shift = createShift(clockTime('06:00'), clockTime('12:00'));
    expect(errors(validateBreaks([shift], context))).toHaveLength(0);
  });

  it('requires at least 30 min. break just over 6 hours net', () => {
    const shift = createShift(clockTime('06:00'), clockTime('12:01'));
    expect(errors(validateBreaks([shift], context))).toHaveLength(1);

    shift.breaks.push(createBreak(30));
    // Shift now longer overall, but the break covers the 30 min -> net back to ~6h01, no error
    expect(errors(validateBreaks([shift], context))).toHaveLength(0);
  });

  it('still requires only 30 min. at exactly 9 hours net (45 min. only kicks in above "more than 9 hours")', () => {
    // Gross span 9h30 minus 30 min. break = exactly 9h net
    const shift = createShift(clockTime('06:00'), clockTime('15:30'));
    shift.breaks.push(createBreak(30));
    expect(errors(validateBreaks([shift], context))).toHaveLength(0);
  });

  it('still requires at least 30 min. at a continuous 9 hours with no break at all', () => {
    const shift = createShift(clockTime('06:00'), clockTime('15:00'));
    expect(errors(validateBreaks([shift], context))).toHaveLength(1);
  });

  it('requires at least 45 min. break over 9 hours net', () => {
    const shift = createShift(clockTime('06:00'), clockTime('16:00'), false);
    shift.breaks.push(createBreak(30));
    // Gross span 10h, break 30min -> net 9.5h > 9h -> 45 min required, only 30 present
    expect(errors(validateBreaks([shift], context))).toHaveLength(1);

    shift.breaks[0].durationMinutes = 45;
    expect(errors(validateBreaks([shift], context))).toHaveLength(0);
  });

  it('does not count break blocks under 15 minutes as a legal break (warning only, no error for the block itself)', () => {
    const shift = createShift(clockTime('06:00'), clockTime('13:00'));
    shift.breaks.push(createBreak(14));
    const results = validateBreaks([shift], context);
    expect(results.some((e) => e.rule === 'ArbZG_4_Pausenblock' && e.severity === 'warning')).toBe(true);
    expect(errors(results).some((e) => e.rule === 'ArbZG_4_Mindestpause')).toBe(true); // 14 min doesn't count -> still too little
  });

  it('fully credits a break block of exactly 15 minutes', () => {
    const shift = createShift(clockTime('06:00'), clockTime('12:30'));
    shift.breaks.push(createBreak(15), createBreak(15));
    expect(errors(validateBreaks([shift], context))).toHaveLength(0);
  });

  it('correctly sums multiple creditable break blocks', () => {
    const shift = createShift(clockTime('06:00'), clockTime('16:00'));
    shift.breaks.push(createBreak(20), createBreak(25)); // net 9h20 > 9h -> 45 min required, 20+25=45 is enough
    expect(errors(validateBreaks([shift], context))).toHaveLength(0);
  });

  it('accounts for endsNextDay on night shifts crossing midnight', () => {
    const shift = createShift(clockTime('20:00'), clockTime('06:00'), true); // 10h gross
    expect(errors(validateBreaks([shift], context))).toHaveLength(1); // no break -> error (>9h net)

    shift.breaks.push(createBreak(45));
    expect(errors(validateBreaks([shift], context))).toHaveLength(0);
  });

  it('reports one clear error, not a normal break-length error, when breaks add up to at least the shift itself', () => {
    const shift = createShift(clockTime('06:00'), clockTime('14:00')); // 8h gross
    shift.breaks.push(createBreak(480)); // exactly 8h break -> net 0
    const results = validateBreaks([shift], context);
    expect(errors(results)).toHaveLength(1);
    expect(errors(results)[0].rule).toBe('Pausendauer_Ungueltig');
  });

  it('sums net time across multiple shifts on the same day (split shift) instead of checking each in isolation', () => {
    // Two 4h blocks, neither individually over the 6h threshold, but together 8h -> break required
    const morning = createShift(clockTime('06:00'), clockTime('10:00'));
    const afternoon = createShift(clockTime('14:00'), clockTime('18:00'));
    expect(errors(validateBreaks([morning, afternoon], context))).toHaveLength(1);

    afternoon.breaks.push(createBreak(30));
    expect(errors(validateBreaks([morning, afternoon], context))).toHaveLength(0);
  });
});

describe('Meldungstexte (deutsche Schreibweise)', () => {
  it('writes decimal hours with a German comma, never a point', () => {
    // 6.5 h net without any break: over the 6 h threshold, so 30 min are required.
    const shift = createShift(clockTime('06:00'), clockTime('12:30'));
    const [error] = errors(validateBreaks([shift], context));
    expect(error.message).toBe(
      'Bei 6,5 Std. Arbeitszeit sind mind. 30 Min. Pause vorgeschrieben (angerechnet: 0 Min.).',
    );
  });
});
