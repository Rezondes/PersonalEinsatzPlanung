import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Alert from '@mui/material/Alert';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { Wochenplan } from '@domain/wochenplan/Wochenplan';
import type { Kalenderwoche } from '@domain/shared/Kalenderwoche';
import { vollerName } from '@domain/mitarbeiter/Mitarbeiter';
import { sollWochenstunden } from '@domain/mitarbeiter/Beschaeftigungsart';
import { erstelleMonatsUebersicht } from '@application/wochenplan/wochenplanAuswertung';
import { minutenZuDezimalstunden } from '@domain/wochenplan/wochenplanBerechnung';
import { services } from '@infrastructure/services';
import { useAusgewaehlteFiliale } from '@ui/hooks/useFiliale';
import { useMitarbeiterListe } from '@ui/hooks/useMitarbeiterListe';
import { useAbwesenheiten } from '@ui/hooks/useAbwesenheiten';
import { useKalenderwocheStore } from '@ui/app/store/kalenderwocheStore';

const MONATSNAMEN = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export function MonatsUebersichtView() {
  const { filiale } = useAusgewaehlteFiliale();
  const { mitarbeiterListe } = useMitarbeiterListe(filiale?.id ?? null);
  const { abwesenheiten } = useAbwesenheiten(mitarbeiterListe.map((m) => m.id));
  const jetzt = new Date();
  const [jahr, setJahr] = useState(jetzt.getFullYear());
  const [monat, setMonat] = useState(jetzt.getMonth() + 1);
  const [wochenplaene, setWochenplaene] = useState<Wochenplan[]>([]);
  const navigate = useNavigate();
  const setAusgewaehlteWoche = useKalenderwocheStore((s) => s.setAusgewaehlteWoche);

  useEffect(() => {
    if (!filiale) return;
    services.wochenplan.fuerFiliale(filiale.id).then(setWochenplaene);
  }, [filiale]);

  if (!filiale) {
    return <Alert severity="info">Bitte zuerst oben eine Filiale auswählen oder anlegen.</Alert>;
  }

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

  const zeilen = erstelleMonatsUebersicht(wochenplaene, jahr, monat, abwesenheiten);
  const alleWochen = zeilen[0]?.wochen.map((w) => w.kalenderwoche) ?? [];

  const zuWocheSpringen = (kw: Kalenderwoche) => {
    setAusgewaehlteWoche(kw);
    navigate('/wochenplan');
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={500}>
          Monatsübersicht · {filiale.name}
        </Typography>
        <Stack direction="row" alignItems="center" gap={1}>
          <IconButton onClick={() => monatWechseln(-1)} aria-label="Vorheriger Monat">
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="body1" sx={{ minWidth: 160, textAlign: 'center' }}>
            {MONATSNAMEN[monat - 1]} {jahr}
          </Typography>
          <IconButton onClick={() => monatWechseln(1)} aria-label="Nächster Monat">
            <ChevronRightIcon />
          </IconButton>
        </Stack>
      </Stack>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Mitarbeiter</TableCell>
              <TableCell align="right">Soll/Woche</TableCell>
              {alleWochen.map((kw) => (
                <TableCell
                  key={`${kw.jahr}-${kw.woche}`}
                  align="center"
                  sx={{ cursor: 'pointer', '&:focus-visible': { outline: '2px solid #2f5d50', outlineOffset: -2 } }}
                  onClick={() => zuWocheSpringen(kw)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      zuWocheSpringen(kw);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Zu Kalenderwoche ${kw.woche} springen`}
                >
                  KW {kw.woche}
                </TableCell>
              ))}
              <TableCell align="right">Gesamt Monat</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mitarbeiterListe.map((mitarbeiter) => {
              const zeile = zeilen.find((z) => z.mitarbeiterId === mitarbeiter.id);
              return (
                <TableRow key={mitarbeiter.id} hover>
                  <TableCell>{vollerName(mitarbeiter)}</TableCell>
                  <TableCell align="right">{sollWochenstunden(mitarbeiter.beschaeftigungsart).toLocaleString('de-DE')}</TableCell>
                  {alleWochen.map((kw) => {
                    const wochenWert = zeile?.wochen.find(
                      (w) => w.kalenderwoche.jahr === kw.jahr && w.kalenderwoche.woche === kw.woche,
                    );
                    return (
                      <TableCell
                        key={`${kw.jahr}-${kw.woche}`}
                        align="center"
                        sx={{ cursor: 'pointer', '&:focus-visible': { outline: '2px solid #2f5d50', outlineOffset: -2 } }}
                        onClick={() => zuWocheSpringen(kw)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            zuWocheSpringen(kw);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`${vollerName(mitarbeiter)}, KW ${kw.woche} bearbeiten`}
                      >
                        {wochenWert ? minutenZuDezimalstunden(wochenWert.nettoMinuten).toLocaleString('de-DE') : '–'}
                      </TableCell>
                    );
                  })}
                  <TableCell align="right">
                    <Typography fontWeight={500}>
                      {zeile ? minutenZuDezimalstunden(zeile.gesamtNettoMinuten).toLocaleString('de-DE') : '0'}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
