import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { WEEKDAYS, dateForWeekday } from '@domain/shared/CalendarWeek';
import type { CalendarWeek, Weekday } from '@domain/shared/CalendarWeek';
import type { Branch } from '@domain/branch/Branch';
import { fullName } from '@domain/employee/Employee';
import type { PrintRowMinijob } from '@application/export/printDataPreparation';

interface MinijobFormProps {
  branch: Branch;
  calendarWeek: CalendarWeek;
  rows: PrintRowMinijob[];
  dayTotals: Record<Weekday, number>;
}

/** The paper form always has 9 pre-printed employee columns of equal width, regardless of how
 * many of them are actually filled. */
const COLUMNS_PER_SHEET = 9;

function formatDateShort(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.`;
}

function formatHours(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Inserts a <wbr> right before every "/" so a long, space-less job title (e.g.
 * "Filialverantwortliche/-r") gets a controlled wrap point there instead of overflowing its
 * narrow print column - the break lands before the "/", so "/-r" wraps together onto the next line. */
function renderJobTitle(jobTitle: string | undefined): ReactNode {
  if (!jobTitle) return '';
  const parts = jobTitle.split('/');
  return parts.flatMap((part, i) => (i === 0 ? [part] : [<wbr key={i} />, `/${part}`]));
}

export function MinijobForm({ branch, calendarWeek, rows, dayTotals }: MinijobFormProps) {
  const slots = Array.from({ length: COLUMNS_PER_SHEET }, (_, i) => rows[i] ?? null);

  return (
    <div className="print-page">
      <div className="print-header">
        <div className="print-header-meta" />
        <p className="print-title">
          Personaleinsatzplanung (PEP): geringfügig Beschäftigte (Aufbewahrungsfrist: 2 Jahre)
        </p>
        {branch.logoBase64 ? (
          <img src={branch.logoBase64} className="print-header-logo" alt={`Logo ${branch.name}`} />
        ) : (
          <div className="print-header-logo" />
        )}
      </div>

      <table className="print-table">
        <colgroup>
          <col style={{ width: '4%' }} />
          <col style={{ width: '4%' }} />
          {slots.map((_, i) => (
            <Fragment key={i}>
              <col style={{ width: `${92 / (COLUMNS_PER_SHEET * 2)}%` }} />
              <col style={{ width: `${92 / (COLUMNS_PER_SHEET * 2)}%` }} />
            </Fragment>
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="column-label" colSpan={2}>
              Woche: {calendarWeek.week} / {calendarWeek.year}
            </th>
            <th colSpan={COLUMNS_PER_SHEET * 2} className="employee-header column-branch">
              Filiale: {branch.branchNumber} {branch.name}
            </th>
          </tr>
          <tr>
            <th className="column-label" colSpan={2}>
              Name
            </th>
            {slots.map((s, i) => (
              <th key={i} colSpan={2} className="employee-header">
                {s ? fullName(s.employee) : ''}
              </th>
            ))}
          </tr>
          <tr>
            <th className="column-label" colSpan={2}>
              Tätigkeit
            </th>
            {slots.map((s, i) => (
              <th key={i} colSpan={2}>
                {renderJobTitle(s?.employee.jobTitle)}
              </th>
            ))}
          </tr>
          <tr>
            <th className="column-label" colSpan={2}>
              Min. Std.
            </th>
            {slots.map((s, i) => (
              <th key={i} colSpan={2}>
                {s ? formatHours(s.minHours) : ''}
              </th>
            ))}
          </tr>
          <tr>
            <th className="column-label" colSpan={2}>
              Max. Std.
            </th>
            {slots.map((s, i) => (
              <th key={i} colSpan={2}>
                {s ? formatHours(s.maxHours) : ''}
              </th>
            ))}
          </tr>
          <tr>
            <th className="column-label">Soll-Std.</th>
            <th className="column-label">Ist-Std.</th>
            {slots.map((_, i) => (
              <Fragment key={i}>
                <th>Zeit</th>
                <th>Std.</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEKDAYS.map((day) => (
            <Fragment key={day}>
              <tr>
                <td className="column-label">{formatDateShort(dateForWeekday(calendarWeek, day))}</td>
                <td className="column-label">{dayTotals[day] > 0 ? formatHours(dayTotals[day]) : ''}</td>
                {slots.map((_, i) => (
                  <Fragment key={i}>
                    <td />
                    <td />
                  </Fragment>
                ))}
              </tr>
              <tr>
                <td className="column-label weekday-label" colSpan={2}>
                  {day}
                </td>
                {slots.map((s, i) => (
                  <Fragment key={i}>
                    <td>{s?.days[day].timeText ?? ''}</td>
                    <td>{s?.days[day].hoursText ?? ''}</td>
                  </Fragment>
                ))}
              </tr>
              <tr className="break-row">
                <td className="column-label pause-label" colSpan={2}>
                  Pause
                </td>
                {slots.map((s, i) => (
                  <Fragment key={i}>
                    <td>{s?.days[day].breaks[0].timeText ?? ''}</td>
                    <td>{s?.days[day].breaks[0].hoursText ?? ''}</td>
                  </Fragment>
                ))}
              </tr>
              <tr className="break-row">
                <td className="column-label pause-label" colSpan={2}>
                  Pause
                </td>
                {slots.map((s, i) => (
                  <Fragment key={i}>
                    <td>{s?.days[day].breaks[1].timeText ?? ''}</td>
                    <td>{s?.days[day].breaks[1].hoursText ?? ''}</td>
                  </Fragment>
                ))}
              </tr>
            </Fragment>
          ))}
          <tr>
            <td className="column-label" colSpan={2}>
              <strong>Gesamtstunden</strong>
            </td>
            {slots.map((s, i) => (
              <td key={i} colSpan={2}>
                <strong>{s?.totalHoursWeek ?? ''}</strong>
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <div className="print-signatures">
        <div className="field">Unterschrift ML</div>
        <div className="field">Unterschrift VL</div>
      </div>
    </div>
  );
}
