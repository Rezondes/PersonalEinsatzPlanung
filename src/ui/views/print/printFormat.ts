/** Shared by FullPartTimeForm.tsx and MinijobForm.tsx, which used to each define byte-identical
 * copies of both functions. formatDateShort is a narrower sibling of
 * domain/shared/DateFormat.ts's formatISODateShortGerman (DD.MM., no year, matching the paper
 * form) but takes a Date instead of an ISO string, since the print views already work with Date
 * objects (see domain/shared/DateFormat.ts's comment on formatISODateShortGerman for why this is
 * a deliberate exception to the general "one shared date formatter" rule, not an oversight). */
export function formatDateShort(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.`;
}

export function formatHours(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
