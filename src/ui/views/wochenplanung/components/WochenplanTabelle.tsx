import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { WOCHENTAGE } from '@domain/shared/Kalenderwoche';
import type { MitarbeiterId } from '@domain/shared/ids';
import type { Mitarbeiter } from '@domain/mitarbeiter/Mitarbeiter';
import { vollerName } from '@domain/mitarbeiter/Mitarbeiter';
import { minutenZuDezimalstunden, schichtPausenMinuten } from '@domain/wochenplan/wochenplanBerechnung';
import type { ValidierungsErgebnis } from '@domain/validierung/ValidierungsErgebnis';
import type { MitarbeiterWochenAnsicht, TagesAnsicht } from '@application/wochenplan/wochenplanAuswertung';
import { effektiveSollMinuten } from '@application/wochenplan/wochenplanAuswertung';

interface WochenplanTabelleProps {
  wochenAnsicht: MitarbeiterWochenAnsicht[];
  mitarbeiterListe: Mitarbeiter[];
  validierungsErgebnisse: ValidierungsErgebnis[];
  onZelleKlick: (mitarbeiterId: MitarbeiterId, tagesAnsicht: TagesAnsicht) => void;
  onZelleKontextmenu: (mitarbeiterId: MitarbeiterId, tagesAnsicht: TagesAnsicht, x: number, y: number) => void;
}

function abwesenheitsText(art: string): string {
  switch (art) {
    case 'Urlaub':
      return 'Urlaub';
    case 'Krankheit':
      return 'Krank';
    default:
      return art;
  }
}

export function WochenplanTabelle({
  wochenAnsicht,
  mitarbeiterListe,
  validierungsErgebnisse,
  onZelleKlick,
  onZelleKontextmenu,
}: WochenplanTabelleProps) {
  const ergebnisseFuer = (mitarbeiterId: MitarbeiterId, datum: string) =>
    validierungsErgebnisse.filter((e) => e.mitarbeiterId === mitarbeiterId && e.datum === datum);

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ minWidth: 180 }}>Mitarbeiter</TableCell>
            {WOCHENTAGE.map((tag) => (
              <TableCell key={tag} align="center" sx={{ minWidth: 120 }}>
                {tag}
              </TableCell>
            ))}
            <TableCell align="center">Soll</TableCell>
            <TableCell align="center">Gesamt</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {wochenAnsicht.map((einsatz) => {
            const mitarbeiter = mitarbeiterListe.find((m) => m.id === einsatz.mitarbeiterId);
            if (!mitarbeiter) return null;

            const sollMinuten = effektiveSollMinuten(mitarbeiter, einsatz);
            const differenzMinuten = einsatz.gesamtNettoMinuten - sollMinuten;

            return (
              <TableRow key={einsatz.mitarbeiterId} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {vollerName(mitarbeiter)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {mitarbeiter.taetigkeit}
                  </Typography>
                </TableCell>

                {einsatz.tage.map((tagesAnsicht: TagesAnsicht) => {
                  const treffer = ergebnisseFuer(einsatz.mitarbeiterId, tagesAnsicht.datum);
                  const hatFehler = treffer.some((e) => e.schweregrad === 'fehler');
                  const hatWarnung = treffer.some((e) => e.schweregrad === 'warnung');
                  // A halbtags-Urlaub day still carries a real entered shift for its worked half
                  // (nettoMinuten > 0, see wochenplanAuswertung.effektiveNettoMinuten) - only a
                  // full-day Abwesenheit hides the shift entirely.
                  const istGanztagsAbwesend = !!tagesAnsicht.abwesenheit && tagesAnsicht.nettoMinuten === 0;
                  const hintergrund = tagesAnsicht.abwesenheit
                    ? '#eef3f1'
                    : hatFehler
                      ? '#fbeaea'
                      : hatWarnung
                        ? '#fdf3e0'
                        : '#f7f7f5';
                  const pausenMinuten =
                    tagesAnsicht.eintrag.typ === 'Schicht'
                      ? tagesAnsicht.eintrag.schichten.reduce((summe, s) => summe + schichtPausenMinuten(s), 0)
                      : 0;

                  const zelle = (
                    <Box
                      onClick={() => onZelleKlick(einsatz.mitarbeiterId, tagesAnsicht)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        onZelleKontextmenu(einsatz.mitarbeiterId, tagesAnsicht, e.clientX, e.clientY);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onZelleKlick(einsatz.mitarbeiterId, tagesAnsicht);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${tagesAnsicht.tag} bearbeiten`}
                      sx={{
                        cursor: 'pointer',
                        borderRadius: 1.5,
                        p: 1,
                        backgroundColor: hintergrund,
                        border: hatFehler ? '1px solid #e5a3a0' : hatWarnung ? '1px solid #e6c988' : '1px solid transparent',
                        minHeight: 48,
                        '&:focus-visible': { outline: '2px solid #2f5d50', outlineOffset: 2 },
                      }}
                    >
                      {istGanztagsAbwesend && tagesAnsicht.abwesenheit ? (
                        <Typography variant="body2" color="#2f5d50" fontWeight={500}>
                          {abwesenheitsText(tagesAnsicht.abwesenheit.art)}
                        </Typography>
                      ) : tagesAnsicht.eintrag.typ === 'Schicht' && tagesAnsicht.eintrag.schichten.length > 0 ? (
                        <>
                          {tagesAnsicht.abwesenheit && (
                            <Typography variant="caption" display="block" color="#2f5d50" fontWeight={500}>
                              {abwesenheitsText(tagesAnsicht.abwesenheit.art)} (halbtags)
                            </Typography>
                          )}
                          {tagesAnsicht.eintrag.schichten.map((s) => (
                            <Typography key={s.id} variant="body2" fontWeight={500}>
                              {s.beginn}-{s.ende}
                            </Typography>
                          ))}
                          <Typography variant="caption" color="text.secondary">
                            {minutenZuDezimalstunden(tagesAnsicht.nettoMinuten).toLocaleString('de-DE')} Std.
                            {pausenMinuten > 0 &&
                              ` · ${minutenZuDezimalstunden(pausenMinuten).toLocaleString('de-DE')} Std. Pause`}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          frei
                        </Typography>
                      )}
                    </Box>
                  );

                  return (
                    <TableCell key={tagesAnsicht.tag} align="center" sx={{ p: 0.5 }}>
                      {treffer.length > 0 ? (
                        <Tooltip
                          title={
                            <Stack spacing={0.5}>
                              {treffer.map((e, i) => (
                                <span key={i}>{e.meldung}</span>
                              ))}
                            </Stack>
                          }
                          arrow
                        >
                          {zelle}
                        </Tooltip>
                      ) : (
                        zelle
                      )}
                    </TableCell>
                  );
                })}

                <TableCell align="center">
                  <Typography variant="body2" color="text.secondary">
                    {minutenZuDezimalstunden(sollMinuten).toLocaleString('de-DE')}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                    <Typography variant="body2" fontWeight={500}>
                      {minutenZuDezimalstunden(einsatz.gesamtNettoMinuten).toLocaleString('de-DE')}
                    </Typography>
                    {differenzMinuten !== 0 && (
                      <Tooltip
                        title={`${differenzMinuten > 0 ? '+' : ''}${minutenZuDezimalstunden(differenzMinuten).toLocaleString('de-DE')} Std. ${differenzMinuten > 0 ? 'über' : 'unter'} Soll (${minutenZuDezimalstunden(sollMinuten).toLocaleString('de-DE')} Std.)`}
                        arrow
                      >
                        <WarningAmberIcon fontSize="small" sx={{ color: '#c8973a' }} />
                      </Tooltip>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
