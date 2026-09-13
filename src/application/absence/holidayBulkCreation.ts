import type { Employee } from '@domain/employee/Employee';
import { isEmployedOn } from '@domain/employee/Employee';
import type { Absence } from '@domain/absence/Absence';
import { createAbsence } from '@domain/absence/Absence';
import { findOverlappingAbsences } from '@domain/absence/absenceOverlap';
import type { AbsenceRepository } from '@application/ports/AbsenceRepository';

/**
 * Creates a PublicHoliday absence for every (employee, holidayDate) pair that is safe to add
 * without asking per element - the Wochenplanung's "Feiertage anlegen" bulk action.
 *
 * `holidayDates` is already resolved by the caller (see infrastructure/holidays/germanHolidays.ts's
 * holidaysForYearAndFederalState) - application/ may not import infrastructure/ directly, the same
 * reason application/schedule/scheduleAssessment.ts takes an injected `isHoliday` instead of calling
 * the holiday calculator itself.
 *
 * `employees` is a caller-filtered list, same convention as
 * domain/absence/vacationCalculation.remainingVacationByEmployee: this function has no opinion on
 * what "active" means, it only decides per (employee, date) whether creating one specific absence is
 * safe.
 */
export function createHolidayBulkCreationService(repo: AbsenceRepository) {
  return {
    createHolidaysForYear: async (
      holidayDates: Set<string>,
      employees: Employee[],
      existingAbsences: Absence[],
    ): Promise<{ created: number; skipped: number }> => {
      let created = 0;
      let skipped = 0;

      for (const employee of employees) {
        for (const date of holidayDates) {
          if (!isEmployedOn(employee, date)) {
            skipped += 1;
            continue;
          }
          // Deliberately the RAW overlap check (not findConflictingAbsences): a bulk run with no
          // per-element confirmation must treat ANY existing coverage - including a PublicHoliday
          // already created by a previous run (idempotency) - as a reason to skip, never as
          // something to double-book.
          const overlaps = findOverlappingAbsences({ employeeId: employee.id, from: date, to: date }, existingAbsences);
          if (overlaps.length > 0) {
            skipped += 1;
            continue;
          }
          await repo.save(createAbsence({ employeeId: employee.id, type: 'PublicHoliday', from: date, to: date }));
          created += 1;
        }
      }

      return { created, skipped };
    },
  };
}
