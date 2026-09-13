import { describe, it, expect } from 'vitest';
import { toISODate } from '@domain/shared/DateFormat';
import { validateEmployee } from './employeeValidation';
import type { EmployeeDraft } from './employeeValidation';

function draft(overrides: Partial<EmployeeDraft> = {}): EmployeeDraft {
  return {
    firstName: 'Anna',
    lastName: 'Müller',
    jobTitle: 'Verkauf',
    employmentType: { type: 'PartTime', weeklyHours: 20 },
    vacationEntitlementPerYear: 28,
    holidayVacationHours: 5,
    ...overrides,
  };
}

function messagesByField(errors: ReturnType<typeof validateEmployee>) {
  return Object.fromEntries(errors.map((e) => [e.field, e.message]));
}

describe('validateEmployee', () => {
  it('accepts a complete draft', () => {
    expect(validateEmployee(draft())).toEqual([]);
  });

  it('reports every empty text field at once, ignoring whitespace', () => {
    const errors = validateEmployee(draft({ firstName: ' ', lastName: '', jobTitle: '   ' }));
    expect(messagesByField(errors)).toEqual({
      firstName: 'Bitte Vornamen eingeben.',
      lastName: 'Bitte Nachnamen eingeben.',
      jobTitle: 'Bitte Tätigkeit angeben.',
    });
  });

  it('requires weekly hours for full-time and part-time and rejects zero', () => {
    expect(messagesByField(validateEmployee(draft({ employmentType: { type: 'FullTime' } })))).toEqual({
      weeklyHours: 'Bitte Wochenstunden eingeben.',
    });
    expect(messagesByField(validateEmployee(draft({ employmentType: { type: 'PartTime', weeklyHours: 0 } })))).toEqual({
      weeklyHours: 'Muss größer als 0 sein.',
    });
    expect(validateEmployee(draft({ employmentType: { type: 'PartTime', weeklyHours: 0.5 } }))).toEqual([]);
  });

  it('rejects implausibly high weekly hours, catching a data-entry slip rather than a real contract', () => {
    expect(messagesByField(validateEmployee(draft({ employmentType: { type: 'FullTime', weeklyHours: 600 } })))).toEqual({
      weeklyHours: 'Höchstens 60 Std. pro Woche.',
    });
    expect(validateEmployee(draft({ employmentType: { type: 'FullTime', weeklyHours: 60 } }))).toEqual([]);
  });

  it('requires both Minijob bounds and rejects zero on each', () => {
    expect(messagesByField(validateEmployee(draft({ employmentType: { type: 'Minijob' } })))).toEqual({
      minHours: 'Bitte Min. Std. eingeben.',
      maxHours: 'Bitte Max. Std. eingeben.',
    });
    expect(
      messagesByField(validateEmployee(draft({ employmentType: { type: 'Minijob', minHours: 0, maxHours: 0 } }))),
    ).toEqual({
      minHours: 'Muss größer als 0 sein.',
      maxHours: 'Muss größer als 0 sein.',
    });
  });

  it('rejects implausibly high Minijob bounds on each field independently', () => {
    expect(
      messagesByField(validateEmployee(draft({ employmentType: { type: 'Minijob', minHours: 61, maxHours: 61 } }))),
    ).toEqual({
      minHours: 'Höchstens 60 Std. pro Woche.',
      maxHours: 'Höchstens 60 Std. pro Woche.',
    });
  });

  it('rejects a Minijob minimum above the maximum, on the minimum field', () => {
    const errors = validateEmployee(draft({ employmentType: { type: 'Minijob', minHours: 12, maxHours: 10 } }));
    expect(errors).toEqual([{ field: 'minHours', message: 'Min. Std. darf nicht über Max. Std. liegen.' }]);
  });

  it('accepts a Minijob with equal bounds', () => {
    expect(validateEmployee(draft({ employmentType: { type: 'Minijob', minHours: 10, maxHours: 10 } }))).toEqual([]);
  });

  it('rejects a zero or negative maxMonthlyHours when provided, but leaves it optional otherwise', () => {
    expect(
      messagesByField(
        validateEmployee(draft({ employmentType: { type: 'Minijob', minHours: 10, maxHours: 10, maxMonthlyHours: 0 } })),
      ),
    ).toEqual({ maxMonthlyHours: 'Muss größer als 0 sein.' });
    expect(
      validateEmployee(draft({ employmentType: { type: 'Minijob', minHours: 10, maxHours: 10, maxMonthlyHours: 43 } })),
    ).toEqual([]);
  });

  it('does not report the min/max order while one of them is still missing', () => {
    const errors = validateEmployee(draft({ employmentType: { type: 'Minijob', minHours: 12 } }));
    expect(errors).toEqual([{ field: 'maxHours', message: 'Bitte Max. Std. eingeben.' }]);
  });

  it('requires the vacation entitlement and rejects negative values but allows zero', () => {
    expect(messagesByField(validateEmployee(draft({ vacationEntitlementPerYear: undefined })))).toEqual({
      vacationEntitlementPerYear: 'Bitte Urlaubsanspruch eingeben.',
    });
    expect(messagesByField(validateEmployee(draft({ vacationEntitlementPerYear: -1 })))).toEqual({
      vacationEntitlementPerYear: 'Darf nicht negativ sein.',
    });
    expect(validateEmployee(draft({ vacationEntitlementPerYear: 0 }))).toEqual([]);
  });

  it('treats NaN like a missing number', () => {
    expect(messagesByField(validateEmployee(draft({ vacationEntitlementPerYear: Number.NaN })))).toEqual({
      vacationEntitlementPerYear: 'Bitte Urlaubsanspruch eingeben.',
    });
  });

  it('rejects an implausibly high vacation entitlement', () => {
    expect(messagesByField(validateEmployee(draft({ vacationEntitlementPerYear: 61 })))).toEqual({
      vacationEntitlementPerYear: 'Höchstens 60 Tage.',
    });
    expect(validateEmployee(draft({ vacationEntitlementPerYear: 60 }))).toEqual([]);
  });
});

describe('validateEmployee - Geburtsdatum', () => {
  it('accepts no birth date at all, same as every record stored before the field existed', () => {
    expect(validateEmployee(draft())).toEqual([]);
  });

  it('accepts a plausible birth date', () => {
    expect(validateEmployee(draft({ birthDate: '2010-05-01' }))).toEqual([]);
  });

  it('rejects a birth date in the future', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(messagesByField(validateEmployee(draft({ birthDate: toISODate(tomorrow) })))).toEqual({
      birthDate: 'Geburtsdatum darf nicht in der Zukunft liegen.',
    });
  });

  it('rejects an implausibly old birth date', () => {
    expect(messagesByField(validateEmployee(draft({ birthDate: '1850-01-01' })))).toEqual({
      birthDate: 'Geburtsdatum ist unplausibel.',
    });
  });
});

describe('validateEmployee - Feier-/Urlaubsstunden und Beschäftigungszeitraum', () => {
  it('requires the holiday/vacation hours and rejects negative values but allows zero', () => {
    expect(messagesByField(validateEmployee(draft({ holidayVacationHours: undefined })))).toEqual({
      holidayVacationHours: 'Bitte Std. je Feier-/Urlaubstag eingeben.',
    });
    expect(messagesByField(validateEmployee(draft({ holidayVacationHours: -1 })))).toEqual({
      holidayVacationHours: 'Darf nicht negativ sein.',
    });
    expect(validateEmployee(draft({ holidayVacationHours: 0 }))).toEqual([]);
  });

  it('rejects more than 24 hours for a single day', () => {
    expect(messagesByField(validateEmployee(draft({ holidayVacationHours: 25 })))).toEqual({
      holidayVacationHours: 'Höchstens 24 Stunden.',
    });
  });

  it('reports an exit date before the entry date, on the exit field', () => {
    expect(
      messagesByField(validateEmployee(draft({ entryDate: '2026-03-01', exitDate: '2026-02-28' }))),
    ).toEqual({ exitDate: 'Austrittsdatum darf nicht vor dem Eintrittsdatum liegen.' });
  });

  it('accepts either date on its own, and an exit date on the entry date itself', () => {
    expect(validateEmployee(draft({ entryDate: '2026-03-01' }))).toEqual([]);
    expect(validateEmployee(draft({ exitDate: '2026-03-01' }))).toEqual([]);
    expect(validateEmployee(draft({ entryDate: '2026-03-01', exitDate: '2026-03-01' }))).toEqual([]);
  });
});
