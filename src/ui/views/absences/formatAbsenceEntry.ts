import type { Absence } from '@domain/absence/Absence';
import { absenceTypeLabel } from '@domain/absence/Absence';
import { formatISODateGerman } from '@domain/shared/DateFormat';

/** "Urlaub (01.06.2026 – 05.06.2026)": names one absence, for the conflict and delete questions. */
export function formatAbsenceEntry(a: Absence): string {
  const range =
    a.from === a.to ? formatISODateGerman(a.from) : `${formatISODateGerman(a.from)} – ${formatISODateGerman(a.to)}`;
  return `${absenceTypeLabel(a)} (${range})`;
}
