import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { WEEKDAYS, dateForWeekday } from '@domain/shared/CalendarWeek';
import type { CalendarWeek, Weekday } from '@domain/shared/CalendarWeek';
import type { Branch } from '@domain/branch/Branch';
import { fullName } from '@domain/employee/Employee';
import type { PrintRowMinijob } from '@application/export/printDataPreparation';
import { PrintPageContent } from './PrintPageContent';
import { formatDateShort, formatHours } from './printFormat';

interface MinijobFormProps {
  branch: Branch;
  calendarWeek: CalendarWeek;
  rows: PrintRowMinijob[];
  dayTotals: Record<Weekday, number>;
}

/** The paper form always has 9 pre-printed employee columns of equal width, regardless of how
 * many of them are actually filled. */
const COLUMNS_PER_SHEET = 9;

/** Inserts a <wbr> right before every "/" so a long, space-less job title (e.g.
 * "Filialverantwortliche/-r") gets a controlled wrap point there instead of overflowing its
 * narrow print column - the break lands before the "/", so "/-r" wraps together onto the next line. */
function renderJobTitle(jobTitle: string | undefined): ReactNode {
  if (!jobTitle) return '';
  const parts = jobTitle.split('/');
  return parts.flatMap((part, i) => (i === 0 ? [part] : [<wbr key={i} />, `/${part}`]));
}

export function MinijobForm({ branch, calendarWeek, rows, dayTotals }: MinijobFormProps) {
  const { t } = useTranslation('print');
  const slots = Array.from({ length: COLUMNS_PER_SHEET }, (_, i) => rows[i] ?? null);
  // Same 2 strings for every one of the fixed COLUMNS_PER_SHEET columns - computed once instead of
  // once per column.
  const timeLabel = t('timeLabel');
  const hoursLabel = t('hoursLabel');

  return (
    <div className="print-page">
      <PrintPageContent>
      <div className="print-header">
        <div className="print-header-meta" />
        <h1 className="print-title">
          {t('minijobTitle')}
        </h1>
        {branch.logoBase64 ? (
          <img src={branch.logoBase64} className="print-header-logo" alt={t('logoAlt', { name: branch.name })} />
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
              {t('weekHeader', { week: calendarWeek.week, year: calendarWeek.year })}
            </th>
            <th colSpan={COLUMNS_PER_SHEET * 2} className="employee-header column-branch">
              {t('branchHeader', { number: branch.branchNumber, name: branch.name })}
            </th>
          </tr>
          <tr>
            <th className="column-label" colSpan={2}>
              {t('nameLabel')}
            </th>
            {slots.map((s, i) => (
              <th key={i} colSpan={2} className="employee-header">
                {s ? fullName(s.employee) : ''}
              </th>
            ))}
          </tr>
          <tr>
            <th className="column-label" colSpan={2}>
              {t('jobTitleLabel')}
            </th>
            {slots.map((s, i) => (
              <th key={i} colSpan={2}>
                {renderJobTitle(s?.employee.jobTitle)}
              </th>
            ))}
          </tr>
          <tr>
            <th className="column-label" colSpan={2}>
              {t('minHoursLabel')}
            </th>
            {slots.map((s, i) => (
              <th key={i} colSpan={2}>
                {s ? formatHours(s.minHours) : ''}
              </th>
            ))}
          </tr>
          <tr>
            <th className="column-label" colSpan={2}>
              {t('maxHoursLabel')}
            </th>
            {slots.map((s, i) => (
              <th key={i} colSpan={2}>
                {s ? formatHours(s.maxHours) : ''}
              </th>
            ))}
          </tr>
          <tr>
            <th className="column-label">{t('targetHoursLabel')}</th>
            <th className="column-label">{t('actualHoursLabel')}</th>
            {slots.map((_, i) => (
              <Fragment key={i}>
                <th>{timeLabel}</th>
                <th>{hoursLabel}</th>
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
                  {t('breakLabel')}
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
                  {t('breakLabel')}
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
              <strong>{t('totalWorkedLabel')}</strong>
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
        <div className="field">{t('signatureMl')}</div>
        <div className="field">{t('signatureVl')}</div>
      </div>
      </PrintPageContent>
    </div>
  );
}
