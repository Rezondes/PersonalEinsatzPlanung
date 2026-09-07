import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Chip from '@mui/material/Chip';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { FilialId } from '@domain/shared/ids';
import type { Kalenderwoche } from '@domain/shared/Kalenderwoche';
import {
  kalenderwochenImMonat,
  kalenderwochenGleich,
  kalenderwocheVonDatum,
  montagDerWoche,
  datumFuerWochentag,
} from '@domain/shared/Kalenderwoche';
import { formatDatumDeutsch } from '@domain/shared/Zeitspanne';
import type { Wochenplan } from '@domain/wochenplan/Wochenplan';
import type { Abwesenheit } from '@domain/abwesenheit/Abwesenheit';
import { minutenZuDezimalstunden } from '@domain/wochenplan/wochenplanBerechnung';
import { erstelleWochenAnsicht } from '@application/wochenplan/wochenplanAuswertung';
import { services } from '@infrastructure/services';

const MONATSNAMEN = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

interface WochenauswahlDialogProps {
  open: boolean;
  onClose: () => void;
  filialeId: FilialId;
  abwesenheiten: Abwesenheit[];
  ausgewaehlteWoche: Kalenderwoche;
  onWocheAuswaehlen: (kw: Kalenderwoche) => void;
}

/** Quick week picker: shows a month at a time with each week's total Ist-Stunden across all
 * employees (no per-week ArbZG-Fehler-check here - that would need the async cross-week rest-period
 * service to run once per week, too expensive for a bulk overview; violations stay visible only
 * after opening a week, same as before). */
export function WochenauswahlDialog({
  open,
  onClose,
  filialeId,
  abwesenheiten,
  ausgewaehlteWoche,
  onWocheAuswaehlen,
}: WochenauswahlDialogProps) {
  const heute = kalenderwocheVonDatum(new Date());
  const [jahr, setJahr] = useState(montagDerWoche(ausgewaehlteWoche).getFullYear());
  const [monat, setMonat] = useState(montagDerWoche(ausgewaehlteWoche).getMonth() + 1);
  const [wochenplaene, setWochenplaene] = useState<Wochenplan[]>([]);

  useEffect(() => {
    if (!open) return;
    const start = montagDerWoche(ausgewaehlteWoche);
    setJahr(start.getFullYear());
    setMonat(start.getMonth() + 1);
    services.wochenplan.fuerFiliale(filialeId).then(setWochenplaene);
  }, [open, filialeId, ausgewaehlteWoche]);

  const monatWechseln = (richtung: -1 | 1) => {
    let neuerMonat = monat + richtung;
    let neuesJahr = jahr;
    if (neuerMonat < 1) {
      neuerMonat = 12;
      neuesJahr -= 1;
    } else if (neuerMonat > 12) {
      neuerMonat = 1;
      neuesJahr += 1;
    }
    setMonat(neuerMonat);
    setJahr(neuesJahr);
  };

  const wochen = kalenderwochenImMonat(jahr, monat);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <IconButton onClick={() => monatWechseln(-1)} aria-label="Vorheriger Monat" size="small">
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="subtitle1">
            {MONATSNAMEN[monat - 1]} {jahr}
          </Typography>
          <IconButton onClick={() => monatWechseln(1)} aria-label="Nächster Monat" size="small">
            <ChevronRightIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <List disablePadding>
          {wochen.map((kw) => {
            const plan = wochenplaene.find(
              (p) => p.kalenderwoche.jahr === kw.jahr && p.kalenderwoche.woche === kw.woche,
            );
            const gesamtMinuten = plan
              ? erstelleWochenAnsicht(plan, abwesenheiten).reduce((summe, e) => summe + e.gesamtNettoMinuten, 0)
              : null;
            const istAusgewaehlt = kalenderwochenGleich(kw, ausgewaehlteWoche);
            const istHeute = kalenderwochenGleich(kw, heute);

            return (
              <ListItemButton
                key={`${kw.jahr}-${kw.woche}`}
                selected={istAusgewaehlt}
                onClick={() => {
                  onWocheAuswaehlen(kw);
                  onClose();
                }}
                sx={{ py: 1.5, px: 2 }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: '100%' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" fontWeight={istAusgewaehlt ? 600 : 400}>
                      KW {kw.woche} · {formatDatumDeutsch(montagDerWoche(kw))} –{' '}
                      {formatDatumDeutsch(datumFuerWochentag(kw, 'Sonntag'))}
                    </Typography>
                    {istHeute && <Chip label="Heute" size="small" color="success" variant="outlined" />}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {gesamtMinuten != null ? `${minutenZuDezimalstunden(gesamtMinuten).toLocaleString('de-DE')} Std.` : 'kein Plan'}
                  </Typography>
                </Stack>
              </ListItemButton>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose}>Schließen</Button>
      </DialogActions>
    </Dialog>
  );
}
