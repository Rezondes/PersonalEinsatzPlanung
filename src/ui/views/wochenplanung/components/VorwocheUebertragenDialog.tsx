import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import type { FilialId } from '@domain/shared/ids';
import type { Kalenderwoche } from '@domain/shared/Kalenderwoche';
import { kalenderwocheDavor, montagDerWoche, datumFuerWochentag } from '@domain/shared/Kalenderwoche';
import type { Wochenplan } from '@domain/wochenplan/Wochenplan';
import type { Mitarbeiter } from '@domain/mitarbeiter/Mitarbeiter';
import { vollerName } from '@domain/mitarbeiter/Mitarbeiter';
import type { Abwesenheit } from '@domain/abwesenheit/Abwesenheit';
import { minutenZuDezimalstunden } from '@domain/wochenplan/wochenplanBerechnung';
import { erstelleWochenAnsicht, effektiveSollMinuten } from '@application/wochenplan/wochenplanAuswertung';
import { services } from '@infrastructure/services';

interface VorwocheUebertragenDialogProps {
  open: boolean;
  onClose: () => void;
  filialeId: FilialId;
  ausgewaehlteWoche: Kalenderwoche;
  plan: Wochenplan;
  mitarbeiterListe: Mitarbeiter[];
  abwesenheiten: Abwesenheit[];
  onUebernommen: (aktualisierterPlan: Wochenplan) => void;
  onFehler: (e: unknown, kontext?: string) => void;
}

interface ZeileDaten {
  mitarbeiter: Mitarbeiter;
  vorherigeIstMinuten: number | null;
  vorherigeSollMinuten: number | null;
  vorschlagMinuten: number;
}

function formatStd(minuten: number): string {
  return minutenZuDezimalstunden(minuten).toLocaleString('de-DE');
}

/** Std.-Eingabefeld -> Minuten, rundet auf ganze Minuten. Leere/ungültige Eingabe -> 0. */
function stundenZuMinuten(eingabe: string): number {
  const wert = Number(eingabe.replace(',', '.'));
  return Number.isFinite(wert) ? Math.round(wert * 60) : 0;
}

/** Modal für die Übernahme von Mehr-/Minusstunden aus der Vorwoche (Punkt 6): berechnet je aktivem
 * Mitarbeiter den Vorschlag aus Vorwoche-Ist minus Vorwoche-Soll, zeigt ihn in einem editierbaren
 * Feld an (das editierbare Feld ist zugleich die manuelle Eingabe-Alternative aus der Anforderung -
 * kein zweites UI nötig) und übernimmt alle Zeilen auf einmal in plan.mitarbeiterEinsaetze. */
export function VorwocheUebertragenDialog({
  open,
  onClose,
  filialeId,
  ausgewaehlteWoche,
  plan,
  mitarbeiterListe,
  abwesenheiten,
  onUebernommen,
  onFehler,
}: VorwocheUebertragenDialogProps) {
  const [zeilen, setZeilen] = useState<ZeileDaten[]>([]);
  const [eingaben, setEingaben] = useState<Record<string, string>>({});
  const [laedt, setLaedt] = useState(true);
  const [wirdUebernommen, setWirdUebernommen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLaedt(true);
    (async () => {
      const vorwoche = kalenderwocheDavor(ausgewaehlteWoche);
      const vorherigerPlan = await services.wochenplan.findenFuerWoche(filialeId, vorwoche);
      const vorherigeAnsicht = vorherigerPlan ? erstelleWochenAnsicht(vorherigerPlan, abwesenheiten) : [];

      const aktiveMitarbeiter = mitarbeiterListe.filter((m) => m.aktiv);
      const neueZeilen: ZeileDaten[] = aktiveMitarbeiter.map((mitarbeiter) => {
        const vorherigerEintrag = vorherigeAnsicht.find((e) => e.mitarbeiterId === mitarbeiter.id);
        if (!vorherigerEintrag) {
          return { mitarbeiter, vorherigeIstMinuten: null, vorherigeSollMinuten: null, vorschlagMinuten: 0 };
        }
        const vorherigeSollMinuten = effektiveSollMinuten(mitarbeiter, vorherigerEintrag);
        return {
          mitarbeiter,
          vorherigeIstMinuten: vorherigerEintrag.gesamtNettoMinuten,
          vorherigeSollMinuten,
          vorschlagMinuten: vorherigeSollMinuten - vorherigerEintrag.gesamtNettoMinuten,
        };
      });

      const neueEingaben: Record<string, string> = {};
      for (const zeile of neueZeilen) {
        const bestehenderEinsatz = plan.mitarbeiterEinsaetze.find((e) => e.mitarbeiterId === zeile.mitarbeiter.id);
        const bestehendeAnpassung = bestehenderEinsatz?.sollAnpassungMinuten;
        const minuten = bestehendeAnpassung != null && bestehendeAnpassung !== 0 ? bestehendeAnpassung : zeile.vorschlagMinuten;
        neueEingaben[zeile.mitarbeiter.id] = formatStd(minuten);
      }

      setZeilen(neueZeilen);
      setEingaben(neueEingaben);
      setLaedt(false);
    })();
  }, [open, filialeId, ausgewaehlteWoche, plan, mitarbeiterListe, abwesenheiten]);

  const uebernehmen = async () => {
    setWirdUebernommen(true);
    try {
      const anpassungen = zeilen.map((zeile) => ({
        mitarbeiterId: zeile.mitarbeiter.id,
        minuten: stundenZuMinuten(eingaben[zeile.mitarbeiter.id] ?? '0'),
      }));
      const aktualisiert = await services.wochenplan.sollAnpassungenUebernehmen(plan, anpassungen);
      onUebernommen(aktualisiert);
      onClose();
    } catch (e) {
      onFehler(e, 'Stundenübertrag konnte nicht übernommen werden');
    } finally {
      setWirdUebernommen(false);
    }
  };

  const vorwoche = kalenderwocheDavor(ausgewaehlteWoche);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Mehr-/Minusstunden aus Vorwoche übertragen
        <Typography variant="body2" color="text.secondary">
          KW {vorwoche.woche} · {montagDerWoche(vorwoche).toLocaleDateString('de-DE')} –{' '}
          {datumFuerWochentag(vorwoche, 'Sonntag').toLocaleDateString('de-DE')}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {!laedt && zeilen.length === 0 && (
          <Alert severity="info">Keine aktiven Mitarbeiter für diese Filiale.</Alert>
        )}
        {!laedt && zeilen.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Mitarbeiter</TableCell>
                  <TableCell align="center">Vorwoche Ist</TableCell>
                  <TableCell align="center">Vorwoche Soll</TableCell>
                  <TableCell align="center">Vorschlag</TableCell>
                  <TableCell align="center">Übernehmen (Std.)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {zeilen.map((zeile) => (
                  <TableRow key={zeile.mitarbeiter.id}>
                    <TableCell>{vollerName(zeile.mitarbeiter)}</TableCell>
                    <TableCell align="center">
                      {zeile.vorherigeIstMinuten != null ? formatStd(zeile.vorherigeIstMinuten) : 'keine Daten'}
                    </TableCell>
                    <TableCell align="center">
                      {zeile.vorherigeSollMinuten != null ? formatStd(zeile.vorherigeSollMinuten) : '–'}
                    </TableCell>
                    <TableCell align="center">
                      {zeile.vorherigeIstMinuten != null
                        ? `${zeile.vorschlagMinuten > 0 ? '+' : ''}${formatStd(zeile.vorschlagMinuten)}`
                        : '–'}
                    </TableCell>
                    <TableCell align="center">
                      <TextField
                        size="small"
                        type="number"
                        value={eingaben[zeile.mitarbeiter.id] ?? ''}
                        onChange={(e) => setEingaben((v) => ({ ...v, [zeile.mitarbeiter.id]: e.target.value }))}
                        sx={{ width: 100 }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button variant="contained" onClick={uebernehmen} disabled={laedt || wirdUebernommen || zeilen.length === 0}>
          Übernehmen
        </Button>
      </DialogActions>
    </Dialog>
  );
}
