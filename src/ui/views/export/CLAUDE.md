# views/export

The print views (`print/FormularVollTeilzeit.tsx`, `print/FormularMinijob.tsx`) intentionally
always render exactly 9 employee-column-pairs (`SPALTEN_PRO_BLATT = 9`), padding with empty
placeholder columns when fewer than 9 employees are on a page - because the real paper form has 9
fixed pre-printed columns, and column width must stay identical whether 3 or 9 are filled. Never
make the colgroup width computation depend on `zeilen.length`.

Each weekday renders as 4 physical table rows:
1. A standalone Datum|Ist-Std summary row with NO employee data (just the day's aggregate hours
   across the whole team).
2. The weekday-name row carrying the actual per-employee Zeit/Std shift data.
3.-4. Two Pause rows (always exactly 2, regardless of how many breaks were actually entered - extra
   breaks beyond 2 get summed into the second row).

This exact 4-row shape was specified precisely by the user after comparing against the real paper
form photos - don't collapse or reorder these rows.

`druckDatenAufbereitung.ts` (in `application/`, not here) is the ONLY place that shapes print
data - these components must stay pure presentation, never compute hours/pauses themselves (reuse
`DruckTagesZelle`/`DruckPauseZelle` as given).

`.druck-kopf` is a 3-part flex row (left: geplanter Wochenumsatz/-stunden meta, stacked and
left-aligned; center: title, flex-grow + centered; right: branch logo or an empty placeholder div
of the same width so the title stays visually centered even with no logo) - keep the placeholder
divs when editing, removing them re-breaks title centering.

`MITARBEITER_PRO_BLATT` pagination (chunks of 9) lives in `DruckvorschauView.tsx`; the two
Formular components independently pad up to 9 again internally - both numbers must stay in sync
at 9.
