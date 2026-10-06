/** Layout of a "which kind of entry" ToggleButtonGroup (DayEditor's Eintragsart, ShiftTemplateDialog's
 * Art der Vorlage): one row of equal buttons on a wide screen, a three-column grid on a phone. Six
 * equal buttons in one row were 56px each on a 390px phone, clipping "Arbeitszeit" (61px) and
 * "Krankheit" (58px); a grid gives each a third. Margins stay with the caller. */
export function entryTypeToggleSx(isMobile: boolean) {
  return isMobile
    ? {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 0.5,
        // ToggleButtonGroup joins neighbours in ONE row (negative margin, removed inner borders/radii) -
        // in a grid every button needs its own full border back.
        '& .MuiToggleButtonGroup-grouped': {
          m: 0,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
        },
      }
    : { display: 'flex', '& .MuiToggleButton-root': { flex: 1, minWidth: 0 } };
}
