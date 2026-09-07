import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import type { ValidierungsErgebnis } from '@domain/validierung/ValidierungsErgebnis';
import type { Mitarbeiter } from '@domain/mitarbeiter/Mitarbeiter';
import { vollerName } from '@domain/mitarbeiter/Mitarbeiter';

interface ValidierungsHinweiseProps {
  ergebnisse: ValidierungsErgebnis[];
  mitarbeiterListe: Mitarbeiter[];
}

function mitarbeiterName(id: string | undefined, liste: Mitarbeiter[]): string {
  const gefunden = liste.find((m) => m.id === id);
  return gefunden ? vollerName(gefunden) : '';
}

/**
 * Collapsed by default and rendered as an overlay (position: absolute) instead of in normal
 * document flow - this way the weekly overview underneath doesn't shift when expanded.
 */
export function ValidierungsHinweise({ ergebnisse, mitarbeiterListe }: ValidierungsHinweiseProps) {
  const [aufgeklappt, setAufgeklappt] = useState(false);
  const fehler = ergebnisse.filter((e) => e.schweregrad === 'fehler');
  const warnungen = ergebnisse.filter((e) => e.schweregrad === 'warnung');

  if (ergebnisse.length === 0) {
    return null;
  }

  return (
    <Box sx={{ position: 'relative', mb: 2 }}>
      <Button size="small" onClick={() => setAufgeklappt((v) => !v)}>
        {fehler.length} Fehler, {warnungen.length} Warnung(en) {aufgeklappt ? 'ausblenden' : 'anzeigen'}
      </Button>

      {aufgeklappt && (
        <ClickAwayListener onClickAway={() => setAufgeklappt(false)}>
          <Paper
            sx={{
              position: 'absolute',
              top: '100%',
              left: 0,
              zIndex: 10,
              mt: 0.5,
              p: 1.5,
              width: 480,
              maxWidth: '90vw',
              maxHeight: 360,
              overflowY: 'auto',
              boxShadow: 3,
            }}
          >
            <Stack spacing={1}>
              {fehler.map((e, i) => (
                <Alert severity="error" key={`f-${i}`}>
                  <AlertTitle>
                    {mitarbeiterName(e.mitarbeiterId, mitarbeiterListe)}
                    {e.datum ? ` · ${e.datum}` : ''}
                  </AlertTitle>
                  {e.meldung}
                </Alert>
              ))}
              {warnungen.map((e, i) => (
                <Alert severity="warning" key={`w-${i}`}>
                  <AlertTitle>
                    {mitarbeiterName(e.mitarbeiterId, mitarbeiterListe)}
                    {e.datum ? ` · ${e.datum}` : ''}
                  </AlertTitle>
                  {e.meldung}
                </Alert>
              ))}
            </Stack>
          </Paper>
        </ClickAwayListener>
      )}
    </Box>
  );
}
