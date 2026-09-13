import type { Employee } from '@domain/employee/Employee';
import { fullName } from '@domain/employee/Employee';
import { targetWeeklyHoursRange } from '@domain/employee/EmploymentType';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import { minutesToDecimalHours, formatHoursRangeGerman } from '@domain/schedule/scheduleCalculation';
import type { MonthRow } from '@application/schedule/scheduleAssessment';

const SEPARATOR = ';';

/** Built via fromCharCode rather than a literal character in the source: a raw BOM byte anywhere
 * outside the very first line of a file trips ESLint's no-irregular-whitespace rule. */
const UTF8_BOM = String.fromCharCode(0xfeff);

/** RFC 4180 field escaping: only fields containing the separator, a quote or a line break need
 * quoting at all - most names pass through untouched. */
function csvField(value: string): string {
  if (/[;"\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Fixed two decimal places, German comma - deliberately not scheduleCalculation's
 * formatHoursGerman (variable precision, "8" not "8,00"): a column of hour figures reads and sums
 * more predictably in Excel with a stable number of decimals throughout the sheet. */
function csvHours(minutes: number): string {
  return minutesToDecimalHours(minutes).toFixed(2).replace('.', ',');
}

/**
 * The Monatsübersicht's own MonthRow[] (see application/schedule/scheduleAssessment.ts) as a
 * semicolon-separated CSV - a comma is the German decimal separator and would collide with one.
 *
 * Iterates `employeeList`, not `rows`: exactly the pattern the screen itself uses
 * (MonthOverviewView.tsx), so an active employee with no MonthRow this month (no schedule touched
 * it at all) still gets a row instead of silently vanishing from the export.
 *
 * Prepends a UTF-8 BOM: Excel on Windows misreads a BOM-less UTF-8 file's umlauts as the system
 * codepage when opened by double-click ("Müller" -> "MÃ¼ller"). This is specific to a CSV meant for
 * Excel, so it belongs here rather than in the generic infrastructure/export/fileAccess.ts -
 * downloadTextFile stays agnostic to what kind of text it is asked to save.
 */
export function buildMonthCsv(rows: MonthRow[], employeeList: Employee[], weeks: CalendarWeek[]): string {
  const rowByEmployee = new Map(rows.map((row) => [row.employeeId, row]));
  const header = ['Mitarbeiter', 'Soll-Woche', ...weeks.map((cw) => `KW ${cw.week}`), 'Gesamt Monat'];

  const lines = employeeList.map((employee) => {
    const row = rowByEmployee.get(employee.id);
    const range = targetWeeklyHoursRange(employee.employmentType);
    const weekCells = weeks.map((cw) => {
      const weekRow = row?.weeks.find((w) => w.calendarWeek.year === cw.year && w.calendarWeek.week === cw.week);
      return csvHours(weekRow?.totalNetMinutes ?? 0);
    });
    return [
      csvField(fullName(employee)),
      formatHoursRangeGerman(range.min * 60, range.max * 60),
      ...weekCells,
      csvHours(row?.totalNetMinutes ?? 0),
    ].join(SEPARATOR);
  });

  return UTF8_BOM + [header.join(SEPARATOR), ...lines].join('\r\n');
}
